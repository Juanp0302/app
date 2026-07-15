/**
 * POST /api/superadmin/cuenta-cobro
 * Genera una cuenta de cobro manualmente para un cliente y la envía al webhook.
 * Solo superadmin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { crearCuentaCobro, migrateContrato } from '@/lib/contrato-db'
import { generarPDFCuentaCobro, DatosCuentaCobro } from '@/lib/pdf-contrato'
import { PLANES, PlanKey } from '@/lib/suscripcion'

async function requireSuperadmin() {
  const session = await auth()
  const user = session?.user as any
  return user?.is_superadmin ? user : null
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
    console.error('[superadmin/cuenta-cobro] Error webhook:', e)
  }
}

export async function POST(req: NextRequest) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Solo superadmin puede generar cuentas de cobro' }, { status: 403 })

  const body = await req.json()
  const { clienteId, plan, nombreEmpresa, nit, representanteLegal } = body

  if (!clienteId || !plan || !nombreEmpresa || !nit || !representanteLegal) {
    return NextResponse.json({ error: 'Faltan campos requeridos: clienteId, plan, nombreEmpresa, nit, representanteLegal' }, { status: 400 })
  }

  if (!PLANES[plan as PlanKey]) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }

  await migrateContrato()

  const cliente = await queryOne(
    `SELECT c.id, c.razon_social, u.email FROM clientes c JOIN users u ON u.id = c.user_id WHERE c.id = ?`,
    [clienteId]
  ) as any

  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const planKey = plan as PlanKey
  const planObj = PLANES[planKey]
  const ahora   = new Date()
  const fechaISO = ahora.toISOString()

  // Crear registro en DB y obtener número
  const numero = await crearCuentaCobro({
    clienteId,
    plan:         planKey,
    monto:        planObj.precio,
    concepto:     `Plan ${planObj.label} - ${mesLabel(ahora)}`,
    mes:          ahora.toISOString().slice(0, 7),
    fechaEmision: fechaISO,
  })

  // Generar PDF
  const datosCuenta: DatosCuentaCobro = {
    numero,
    fecha:              fechaISO,
    nombreEmpresa,
    nit,
    representanteLegal,
    plan:               planKey,
    mes:                mesLabel(ahora),
  }

  let pdfBuffer: Buffer
  try {
    pdfBuffer = await generarPDFCuentaCobro(datosCuenta)
  } catch (e: any) {
    console.error('[superadmin/cuenta-cobro] Error generando PDF:', e)
    return NextResponse.json({ error: 'Error generando PDF: ' + e.message }, { status: 500 })
  }

  const adjuntos = [
    { nombre: `CuentaCobro-${numero}.pdf`, base64: pdfBuffer.toString('base64') },
  ]

  await enviarAlWebhook({
    tipo_entidad:        'contrato_firmado',
    cliente:             nombreEmpresa,
    cliente_email:       cliente.email,
    cliente_id:          clienteId,
    plan:                planKey,
    plan_label:          planObj.label,
    fecha:               fechaISO,
    adjuntos,
    carpeta_drive:       nombreEmpresa.replace(/[^a-zA-Z0-9\s]/g, '').trim(),
    cuenta_cobro_numero: numero,
  })

  return NextResponse.json({ ok: true, numero })
}
