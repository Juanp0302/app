/**
 * POST /api/superadmin/auto-cuentas-cobro
 * Llamado por N8N diariamente.
 * Busca clientes cuya suscripcion_vencimiento sea en exactamente DIAS_ANTES días
 * y genera + envía la cuenta de cobro del SIGUIENTE período.
 * Auth: Authorization: Bearer INTERNAL_SECRET
 */
import { NextRequest, NextResponse } from 'next/server'
import { queryAll } from '@/lib/db'
import { crearCuentaCobro, migrateContrato } from '@/lib/contrato-db'
import { generarPDFCuentaCobro, DatosCuentaCobro } from '@/lib/pdf-contrato'
import { PLANES, PlanKey } from '@/lib/suscripcion'

const DIAS_ANTES = 10 // días antes del vencimiento para enviar la cuenta

/** Etiqueta del período siguiente: "del 15 de agosto al 15 de septiembre de 2026" */
function labelPeriodoSiguiente(vencimiento: Date): string {
  const inicio = new Date(vencimiento)
  const fin    = new Date(vencimiento)
  fin.setMonth(fin.getMonth() + 1)

  const fmt = (d: Date) =>
    d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })

  return `del ${fmt(inicio)} al ${fmt(fin)}`
}

/** Mes de inicio del período siguiente, para el concepto corto */
function mesLabel(vencimiento: Date): string {
  return vencimiento.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
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
    console.error('[auto-cuentas-cobro] Error webhook:', e)
  }
}

export async function POST(req: NextRequest) {
  // Verificar secret
  const secret = process.env.INTERNAL_SECRET
  const auth   = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  await migrateContrato()

  // Buscar clientes cuyo vencimiento es en exactamente DIAS_ANTES días Y tienen auto_cuenta_cobro activado
  const clientes = await queryAll(
    `SELECT c.id, c.razon_social, c.nit, c.contacto AS representante_legal,
            c.plan, c.suscripcion_vencimiento,
            u.email
     FROM clientes c
     JOIN users u ON u.id = c.user_id
     WHERE c.suscripcion_estado = 'activa'
       AND c.plan IS NOT NULL
       AND c.plan != 'trial'
       AND c.auto_cuenta_cobro = 1
       AND DATE(c.suscripcion_vencimiento) = DATE('now', '+${DIAS_ANTES} days')`,
    []
  ) as any[]

  if (clientes.length === 0) {
    return NextResponse.json({ ok: true, total: 0, mensaje: 'No hay clientes con vencimiento en ' + DIAS_ANTES + ' días' })
  }

  const ahora    = new Date()
  const fechaISO = ahora.toISOString()

  const resultados: { cliente: string; numero?: string; periodo?: string; error?: string }[] = []

  for (const c of clientes) {
    try {
      const planKey  = c.plan as PlanKey
      const planObj  = PLANES[planKey]
      if (!planObj) { resultados.push({ cliente: c.razon_social, error: 'plan inválido' }); continue }

      // El período facturado es el siguiente al vencimiento actual
      const vencimiento = new Date(c.suscripcion_vencimiento)
      const periodo     = labelPeriodoSiguiente(vencimiento)
      const concepto    = `Plan ${planObj.label} - ${periodo}`
      const mes         = mesLabel(vencimiento)
      const mesKey      = vencimiento.toISOString().slice(0, 7)

      const numero = await crearCuentaCobro({
        clienteId:    c.id,
        plan:         planKey,
        monto:        planObj.precio,
        concepto,
        mes:          mesKey,
        fechaEmision: fechaISO,
      })

      const datosCuenta: DatosCuentaCobro = {
        numero,
        fecha:              fechaISO,
        nombreEmpresa:      c.razon_social,
        nit:                c.nit ?? '',
        representanteLegal: c.representante_legal ?? c.razon_social,
        plan:               planKey,
        mes:                `Período: ${periodo}`,
      }

      const pdfBuffer = await generarPDFCuentaCobro(datosCuenta)

      await enviarAlWebhook({
        tipo_entidad:        'contrato_firmado',
        cliente:             c.razon_social,
        cliente_email:       c.email,
        cliente_id:          c.id,
        plan:                planKey,
        plan_label:          planObj.label,
        fecha:               fechaISO,
        adjuntos:            [{ nombre: `CuentaCobro-${numero}.pdf`, base64: pdfBuffer.toString('base64') }],
        carpeta_drive:       c.razon_social.replace(/[^a-zA-Z0-9\s]/g, '').trim(),
        cuenta_cobro_numero: numero,
      })

      resultados.push({ cliente: c.razon_social, numero, periodo })
    } catch (e: any) {
      resultados.push({ cliente: c.razon_social, error: e.message })
    }
  }

  return NextResponse.json({ ok: true, total: clientes.length, resultados })
}
