/**
 * POST /api/mp/cancelar
 * Cancela la suscripción activa del cliente en Mercado Pago.
 * El acceso continúa hasta el fin del período pagado; no se vuelve a cobrar.
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne, execute } from '@/lib/db'
import { cancelarSuscripcion } from '@/lib/mercadopago'

export async function POST() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'cliente') {
    return NextResponse.json({ error: 'Solo los clientes pueden cancelar su suscripción' }, { status: 403 })
  }

  const cliente = await queryOne(
    `SELECT id, mp_subscription_id, suscripcion_estado FROM clientes WHERE user_id = ?`,
    [user.id]
  ) as any

  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  if (!cliente.mp_subscription_id) {
    return NextResponse.json({ error: 'No tienes una suscripción activa en Mercado Pago' }, { status: 400 })
  }

  if (cliente.suscripcion_estado === 'cancelada') {
    return NextResponse.json({ error: 'La suscripción ya está cancelada' }, { status: 409 })
  }

  try {
    await cancelarSuscripcion(cliente.mp_subscription_id)
  } catch (err: any) {
    console.error('[mp/cancelar] Error MP:', err?.message ?? err)
    return NextResponse.json(
      { error: 'No se pudo cancelar en Mercado Pago. Intenta nuevamente.' },
      { status: 502 }
    )
  }

  // Actualizar estado local (el webhook también lo hará, pero actualizamos ya)
  await execute(
    `UPDATE clientes SET suscripcion_estado = 'cancelada' WHERE id = ?`,
    [cliente.id]
  )

  return NextResponse.json({ ok: true, mensaje: 'Suscripción cancelada. Tu acceso continúa hasta el fin del período pagado.' })
}
