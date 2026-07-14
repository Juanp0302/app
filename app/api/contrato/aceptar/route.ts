/**
 * POST /api/contrato/aceptar
 * Registra la aceptación electrónica del contrato:
 *  1. Valida datos del cliente
 *  2. Genera PDFs (contrato, T&C y cuenta de cobro si aplica)
 *  3. Envía documentos por correo (vía Apps Script)
 *  4. Sube a Google Drive (vía Apps Script)
 *  5. Guarda evidencia en BD
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import {
  migrateContrato,
  guardarAceptacionContrato,
  tieneContratoFirmado,
  siguienteNumeroCuenta,
  crearCuentaCobro,
} from '@/lib/contrato-db'
import {
  generarPDFContrato,
  generarPDFTyC,
  generarPDFCuentaCobro,
  DatosContrato,
  DatosCuentaCobro,
} from '@/lib/pdf-contrato'
import { PLANES, PlanKey } from '@/lib/suscripcion'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '0.0.0.0'
  )
}

function mesLabel(fecha: Date): string {
  return fecha.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
}

async function enviarAlWebhook(payload: object): Promise<void> {
  const url = process.env.SHEETS_WEBHOOK_URL
  if (!url) return
  try {
    await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
  } catch (e) {
    console.error('[contrato/aceptar] Error webhook:', e)
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'cliente') {
    return NextResponse.json({ error: 'Solo los clientes pueden firmar el contrato' }, { status: 403 })
  }

  await migrateContrato()

  // Obtener cliente
  const cliente = await queryOne(
    `SELECT c.id, c.nombre, c.plan AS planActual, u.email
     FROM clientes c JOIN users u ON u.id = c.user_id
     WHERE c.user_id = ?`,
    [user.id]
  ) as any

  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  // Validar campos del body
  const body = await req.json()
  const {
    nombreCliente, tipoPersona, tipoIdentificacion,
    numeroIdentificacion, ciudadCliente, nombreRepresentante,
    ccRepresentante, plan, cuentaCobroSolicitada,
  } = body

  const camposRequeridos: Record<string, string> = {
    nombreCliente, tipoPersona, tipoIdentificacion,
    numeroIdentificacion, ciudadCliente, nombreRepresentante, ccRepresentante, plan,
  }
  for (const [campo, valor] of Object.entries(camposRequeridos)) {
    if (!valor?.toString().trim()) {
      return NextResponse.json({ error: `Campo requerido: ${campo}` }, { status: 400 })
    }
  }

  if (!PLANES[plan as PlanKey]) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }

  // Verificar si ya aceptó (permitir re-firma si cambió de plan, pero no duplicar)
  const yaFirmado = await tieneContratoFirmado(cliente.id)

  const ip            = getIP(req)
  const ahora         = new Date()
  const fechaISO      = ahora.toISOString()
  const planKey       = plan as PlanKey
  const planObj       = PLANES[planKey]

  // ── Generar PDFs ────────────────────────────────────────────────────────────

  const datosContrato: DatosContrato = {
    nombreCliente, tipoPersona, tipoIdentificacion,
    numeroIdentificacion, ciudadCliente, nombreRepresentante, ccRepresentante,
    plan: planKey, fechaAceptacion: fechaISO,
    ip, clienteEmail: cliente.email,
  }

  let pdfContrato: Buffer
  let pdfTyC:      Buffer
  let pdfCuenta:   Buffer | null = null
  let numeroCuenta: string | null = null

  try {
    ;[pdfContrato, pdfTyC] = await Promise.all([
      generarPDFContrato(datosContrato),
      generarPDFTyC({ fechaAceptacion: fechaISO, clienteEmail: cliente.email, ip }),
    ])
  } catch (e: any) {
    console.error('[contrato/aceptar] Error generando PDFs:', e)
    return NextResponse.json({ error: 'Error generando documentos: ' + e.message }, { status: 500 })
  }

  // Cuenta de cobro (si el cliente la solicita)
  if (cuentaCobroSolicitada) {
    numeroCuenta = await siguienteNumeroCuenta(ahora.getFullYear())
    const datosCuenta: DatosCuentaCobro = {
      numero: numeroCuenta,
      fecha:  fechaISO,
      nombreEmpresa:      nombreCliente,
      nit:                numeroIdentificacion,
      representanteLegal: nombreRepresentante,
      plan:               planKey,
      mes:                mesLabel(ahora),
    }
    try {
      pdfCuenta = await generarPDFCuentaCobro(datosCuenta)
    } catch (e: any) {
      console.error('[contrato/aceptar] Error generando cuenta de cobro:', e)
      // No falla todo el flujo por esto
    }
  }

  // ── Guardar en BD ───────────────────────────────────────────────────────────

  await guardarAceptacionContrato({
    clienteId: cliente.id,
    ip,
    datos: {
      nombreCliente, tipoPersona, tipoIdentificacion,
      numeroIdentificacion, ciudadCliente, nombreRepresentante, ccRepresentante,
      plan: planKey, cuentaCobroSolicitada: !!cuentaCobroSolicitada,
    },
  })

  if (numeroCuenta && pdfCuenta) {
    try {
      await crearCuentaCobro({
        numero:       numeroCuenta,
        clienteId:    cliente.id,
        plan:         planKey,
        monto:        planObj.precio,
        concepto:     `Plan ${planObj.label} - ${mesLabel(ahora)}`,
        mes:          ahora.toISOString().slice(0, 7),
        fechaEmision: fechaISO,
      })
    } catch (e) {
      console.error('[contrato/aceptar] Error guardando cuenta cobro:', e)
    }
  }

  // ── Notificar vía Apps Script (correo + Drive) ──────────────────────────────

  const nombreArchivoContrato = `Contrato-${nombreCliente.replace(/\s+/g, '_')}-${ahora.toISOString().slice(0, 10)}.pdf`
  const nombreArchivoTyC      = `TyC-OWL-Compliance-${ahora.toISOString().slice(0, 10)}.pdf`

  const adjuntos: Array<{ nombre: string; base64: string }> = [
    { nombre: nombreArchivoContrato, base64: pdfContrato.toString('base64') },
    { nombre: nombreArchivoTyC,      base64: pdfTyC.toString('base64') },
  ]

  if (pdfCuenta && numeroCuenta) {
    adjuntos.push({
      nombre: `CuentaCobro-${numeroCuenta}.pdf`,
      base64: pdfCuenta.toString('base64'),
    })
  }

  await enviarAlWebhook({
    tipo_entidad:        'contrato_firmado',
    cliente:             nombreCliente,
    cliente_email:       cliente.email,
    cliente_id:          cliente.id,
    plan:                planKey,
    plan_label:          planObj.label,
    fecha:               fechaISO,
    ip,
    adjuntos,
    carpeta_drive:       nombreCliente.replace(/[^a-zA-Z0-9\s]/g, '').trim(),
    cuenta_cobro_numero: numeroCuenta ?? null,
  })

  return NextResponse.json({
    ok:             true,
    contrato:       nombreArchivoContrato,
    cuentaCobro:    numeroCuenta ?? null,
    yaFirmabaAntes: yaFirmado,
  })
}
