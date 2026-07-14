/**
 * POST /api/contrato/publico
 * Endpoint PÚBLICO — sin autenticación.
 * Genera PDFs del contrato + T&C (+ cuenta de cobro si aplica),
 * los envía al cliente por correo y los guarda en Drive vía Apps Script.
 * Se llama desde la página pública /suscribirse ANTES de ir a Mercado Pago.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  generarPDFContrato,
  generarPDFTyC,
  generarPDFCuentaCobro,
  DatosContrato,
  DatosCuentaCobro,
} from '@/lib/pdf-contrato'
import { PLANES, PlanKey } from '@/lib/suscripcion'

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
    console.error('[contrato/publico] Error webhook:', e)
  }
}

// Numeración temporal para clientes web (sin cuenta aún)
// Usamos timestamp para evitar colisiones; cuando el cliente active su cuenta
// se puede asignar número definitivo si es necesario.
function numeroCuentaTemp(anio: number): string {
  const seq = String(Date.now()).slice(-5)
  return `OWL-${String(anio).slice(-2)}-T${seq}`
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    nombreCliente, tipoPersona, tipoIdentificacion,
    numeroIdentificacion, ciudadCliente, nombreRepresentante,
    ccRepresentante, plan, email, cuentaCobroSolicitada,
  } = body

  // Validar campos requeridos
  const requeridos: Record<string, string> = {
    nombreCliente, tipoPersona, tipoIdentificacion,
    numeroIdentificacion, ciudadCliente, nombreRepresentante,
    ccRepresentante, plan, email,
  }
  for (const [campo, valor] of Object.entries(requeridos)) {
    if (!valor?.toString().trim()) {
      return NextResponse.json({ error: `Campo requerido: ${campo}` }, { status: 400 })
    }
  }

  if (!PLANES[plan as PlanKey]) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }

  const ip      = getIP(req)
  const ahora   = new Date()
  const fechaISO = ahora.toISOString()
  const planKey  = plan as PlanKey
  const planObj  = PLANES[planKey]

  // ── Generar PDFs ──────────────────────────────────────────────────────────

  const datosContrato: DatosContrato = {
    nombreCliente, tipoPersona, tipoIdentificacion,
    numeroIdentificacion, ciudadCliente, nombreRepresentante, ccRepresentante,
    plan: planKey, fechaAceptacion: fechaISO,
    ip, clienteEmail: email,
  }

  let pdfContrato: Buffer
  let pdfTyC:      Buffer
  let pdfCuenta:   Buffer | null = null
  let numeroCuenta: string | null = null

  try {
    ;[pdfContrato, pdfTyC] = await Promise.all([
      generarPDFContrato(datosContrato),
      generarPDFTyC({ fechaAceptacion: fechaISO, clienteEmail: email, ip }),
    ])
  } catch (e: any) {
    console.error('[contrato/publico] Error generando PDFs:', e)
    return NextResponse.json({ error: 'Error generando documentos: ' + e.message }, { status: 500 })
  }

  if (cuentaCobroSolicitada) {
    numeroCuenta = numeroCuentaTemp(ahora.getFullYear())
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
    } catch (e) {
      console.error('[contrato/publico] Error cuenta de cobro:', e)
    }
  }

  // ── Enviar vía Apps Script (correo + Drive) ───────────────────────────────

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
    cliente_email:       email,
    plan:                planKey,
    plan_label:          planObj.label,
    fecha:               fechaISO,
    ip,
    adjuntos,
    carpeta_drive:       nombreCliente.replace(/[^a-zA-Z0-9\s]/g, '').trim(),
    cuenta_cobro_numero: numeroCuenta ?? null,
  })

  return NextResponse.json({ ok: true, numeroCuenta: numeroCuenta ?? null })
}
