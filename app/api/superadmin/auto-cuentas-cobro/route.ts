/**
 * POST /api/superadmin/auto-cuentas-cobro
 * Llamado por N8N el día 1 de cada mes.
 * Verifica el setting auto_cuenta_cobro, obtiene todos los clientes activos
 * con plan real y genera + envía cuenta de cobro a cada uno.
 * Auth: Authorization: Bearer INTERNAL_SECRET
 */
import { NextRequest, NextResponse } from 'next/server'
import { queryAll, queryOne, execute } from '@/lib/db'
import { crearCuentaCobro, migrateContrato } from '@/lib/contrato-db'
import { generarPDFCuentaCobro, DatosCuentaCobro } from '@/lib/pdf-contrato'
import { PLANES, PlanKey } from '@/lib/suscripcion'

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

  // Verificar setting
  try {
    await execute(`CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT)`)
  } catch { /* already exists */ }

  const setting = await queryOne(`SELECT value FROM app_settings WHERE key = 'auto_cuenta_cobro'`) as any
  if (!setting || setting.value !== 'true') {
    return NextResponse.json({ ok: true, omitido: true, razon: 'auto_cuenta_cobro desactivado' })
  }

  await migrateContrato()

  // Obtener clientes activos con plan real
  const clientes = await queryAll(
    `SELECT c.id, c.razon_social, c.nit, c.contacto AS representante_legal, c.plan,
            u.email
     FROM clientes c
     JOIN users u ON u.id = c.user_id
     WHERE c.suscripcion_estado = 'activa'
       AND c.plan IS NOT NULL
       AND c.plan != 'trial'`,
    []
  ) as any[]

  const ahora    = new Date()
  const fechaISO = ahora.toISOString()
  const mes      = mesLabel(ahora)
  const mesKey   = ahora.toISOString().slice(0, 7)

  const resultados: { cliente: string; numero?: string; error?: string }[] = []

  for (const c of clientes) {
    try {
      const planKey = c.plan as PlanKey
      const planObj = PLANES[planKey]
      if (!planObj) { resultados.push({ cliente: c.razon_social, error: 'plan inválido' }); continue }

      const numero = await crearCuentaCobro({
        clienteId:    c.id,
        plan:         planKey,
        monto:        planObj.precio,
        concepto:     `Plan ${planObj.label} - ${mes}`,
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
        mes,
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
        solo_drive:          false,
      })

      resultados.push({ cliente: c.razon_social, numero })
    } catch (e: any) {
      resultados.push({ cliente: c.razon_social, error: e.message })
    }
  }

  return NextResponse.json({ ok: true, total: clientes.length, resultados })
}
