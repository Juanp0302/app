/**
 * POST /api/mp/webhook
 * Recibe notificaciones de Mercado Pago para suscripciones.
 * Configurar en el panel de MP:  Notificaciones → URL = https://owlcompliance.onrender.com/api/mp/webhook
 */
import { NextRequest, NextResponse } from 'next/server'
import { queryOne, execute } from '@/lib/db'
import { obtenerSuscripcion, obtenerPago } from '@/lib/mercadopago'
import { migrateSuscripcion } from '@/lib/suscripcion'

function addDays(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

async function handlePreapproval(mpId: string) {
  await migrateSuscripcion()
  const sub = await obtenerSuscripcion(mpId)

  // external_reference = clienteId en nuestra DB
  const clienteId = sub.external_reference
  if (!clienteId) return

  const cliente = await queryOne('SELECT id FROM clientes WHERE id = ?', [clienteId])
  if (!cliente) return

  // Mapear estados de MP a nuestros estados
  const ESTADO: Record<string, string> = {
    authorized: 'activa',
    pending:    'trial',
    paused:     'suspendida',
    cancelled:  'cancelada',
  }
  const estadoMP    = sub.status as string
  const nuevoEstado = ESTADO[estadoMP] ?? 'suspendida'

  if (nuevoEstado === 'activa') {
    // Activar: guardar ID, establecer vencimiento +30 días, resetear contadores
    await execute(
      `UPDATE clientes
       SET mp_subscription_id   = ?,
           suscripcion_estado    = 'activa',
           suscripcion_inicio    = datetime('now'),
           suscripcion_vencimiento = ?,
           tickets_mes           = 0,
           chats_mes             = 0,
           conteo_reset_at       = strftime('%Y-%m', 'now')
       WHERE id = ?`,
      [mpId, addDays(30), clienteId]
    )
  } else {
    await execute(
      `UPDATE clientes SET suscripcion_estado = ? WHERE id = ?`,
      [nuevoEstado, clienteId]
    )
  }
}

async function handlePayment(paymentId: string) {
  await migrateSuscripcion()
  const pago = await obtenerPago(paymentId)

  // Solo procesar pagos de suscripciones aprobados
  if (pago.status !== 'approved') return
  if (!pago.external_reference) return

  const clienteId = pago.external_reference as string
  const cliente = await queryOne('SELECT id FROM clientes WHERE id = ?', [clienteId])
  if (!cliente) return

  // Pago exitoso → extender vencimiento 30 días más, resetear contadores del mes
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
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const tipo    = body.type   as string | undefined
    const dataId  = body.data?.id as string | undefined

    if (!tipo || !dataId) {
      return NextResponse.json({ ok: true })
    }

    if (tipo === 'subscription_preapproval') {
      await handlePreapproval(dataId)
    } else if (tipo === 'payment' || tipo === 'subscription_authorized_payment') {
      await handlePayment(dataId)
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[mp/webhook]', err?.message ?? err)
    // Devolver 200 de todas formas para que MP no reintente
    return NextResponse.json({ ok: true })
  }
}
