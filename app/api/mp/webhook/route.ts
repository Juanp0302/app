/**
 * POST /api/mp/webhook
 * Recibe notificaciones de Mercado Pago para suscripciones.
 * Configurar en el panel de MP:  Notificaciones → URL = https://owlcompliance.onrender.com/api/mp/webhook
 */
import { NextRequest, NextResponse } from 'next/server'
import { queryOne, execute } from '@/lib/db'
import { obtenerSuscripcion, obtenerPago } from '@/lib/mercadopago'
import { migrateSuscripcion } from '@/lib/suscripcion'
import { notificarSuscripcion } from '@/lib/notificaciones'

function addDays(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

async function getCliente(clienteId: string) {
  return queryOne(
    `SELECT c.id, c.plan, c.razon_social, u.email
     FROM clientes c JOIN users u ON u.id = c.user_id
     WHERE c.id = ?`,
    [clienteId]
  ) as Promise<any>
}

async function handlePreapproval(mpId: string) {
  await migrateSuscripcion()
  const sub = await obtenerSuscripcion(mpId)

  const clienteId = sub.external_reference
  if (!clienteId) return

  const cliente = await getCliente(clienteId)
  if (!cliente) return

  const ESTADO: Record<string, string> = {
    authorized: 'activa',
    pending:    'trial',
    paused:     'suspendida',
    cancelled:  'cancelada',
  }
  const estadoMP    = sub.status as string
  const nuevoEstado = ESTADO[estadoMP] ?? 'suspendida'

  if (nuevoEstado === 'activa') {
    await execute(
      `UPDATE clientes
       SET mp_subscription_id      = ?,
           suscripcion_estado       = 'activa',
           suscripcion_inicio       = datetime('now'),
           suscripcion_vencimiento  = ?,
           tickets_mes              = 0,
           chats_mes                = 0,
           conteo_reset_at          = strftime('%Y-%m', 'now')
       WHERE id = ?`,
      [mpId, addDays(30), clienteId]
    )
  } else {
    await execute(
      `UPDATE clientes SET suscripcion_estado = ? WHERE id = ?`,
      [nuevoEstado, clienteId]
    )
  }

  // Notificar por email al superadmin
  try {
    await notificarSuscripcion({
      clienteId,
      cliente:      cliente.razon_social,
      clienteEmail: cliente.email,
      plan:         cliente.plan ?? sub.reason ?? '—',
      estado:       nuevoEstado,
      fecha:        new Date().toLocaleString('es-CO'),
    })
  } catch {}
}

async function handlePayment(paymentId: string) {
  await migrateSuscripcion()
  const pago = await obtenerPago(paymentId)

  if (pago.status !== 'approved') return
  if (!pago.external_reference) return

  const clienteId = pago.external_reference as string
  const cliente = await getCliente(clienteId)
  if (!cliente) return

  await execute(
    `UPDATE clientes
     SET suscripcion_estado      = 'activa',
         suscripcion_vencimiento = ?,
         tickets_mes             = 0,
         chats_mes               = 0,
         conteo_reset_at         = strftime('%Y-%m', 'now')
     WHERE id = ?`,
    [addDays(30), clienteId]
  )

  // Notificar pago exitoso
  try {
    await notificarSuscripcion({
      clienteId,
      cliente:      cliente.razon_social,
      clienteEmail: cliente.email,
      plan:         cliente.plan ?? '—',
      estado:       'activa',
      fecha:        new Date().toLocaleString('es-CO'),
    })
  } catch {}
}

export async function POST(req: NextRequest) {
  try {
    const body  = await req.json()
    const tipo   = body.type      as string | undefined
    const dataId = body.data?.id  as string | undefined

    if (!tipo || !dataId) return NextResponse.json({ ok: true })

    if (tipo === 'subscription_preapproval') {
      await handlePreapproval(dataId)
    } else if (tipo === 'payment' || tipo === 'subscription_authorized_payment') {
      await handlePayment(dataId)
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[mp/webhook]', err?.message ?? err)
    return NextResponse.json({ ok: true })
  }
}
