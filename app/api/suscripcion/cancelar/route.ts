/**
 * POST /api/suscripcion/cancelar
 * El cliente cancela su propia suscripción. El acceso continúa hasta
 * el fin del período pagado; no se realizan más cobros.
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne, execute } from '@/lib/db'

export async function POST() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'cliente') {
    return NextResponse.json({ error: 'Solo los clientes pueden cancelar su suscripción' }, { status: 403 })
  }

  const cliente = await queryOne(
    `SELECT id, suscripcion_estado, suscripcion_externa_id FROM clientes WHERE user_id = ?`,
    [user.id]
  ) as any

  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  if (cliente.suscripcion_estado === 'cancelada') {
    return NextResponse.json({ error: 'La suscripción ya está cancelada' }, { status: 409 })
  }

  // Detener los cobros en Trazo (si la suscripción vive allá). Si Trazo falla,
  // NO cancelamos localmente: quedaría cobrando sin acceso — mejor avisar.
  if (cliente.suscripcion_externa_id) {
    try {
      const { cancelarSuscripcion } = await import('@/lib/trazo')
      await cancelarSuscripcion(cliente.suscripcion_externa_id)
      const { actualizarSuscripcionTrazo } = await import('@/lib/trazo-db')
      await actualizarSuscripcionTrazo(cliente.suscripcion_externa_id, { estado: 'cancelada' })
    } catch (e: any) {
      console.error('[suscripcion/cancelar] Error cancelando en Trazo:', e)
      return NextResponse.json({
        error: 'No pudimos detener el cobro automático en la pasarela. Escríbenos a contacto@owlcompliance.com para completar la cancelación.',
      }, { status: 502 })
    }
  }

  await execute(`UPDATE clientes SET suscripcion_estado = 'cancelada' WHERE id = ?`, [cliente.id])

  return NextResponse.json({ ok: true, mensaje: 'Suscripción cancelada. Tu acceso continúa hasta el fin del período pagado.' })
}
