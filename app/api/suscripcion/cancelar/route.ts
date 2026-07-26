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
    `SELECT id, suscripcion_estado FROM clientes WHERE user_id = ?`,
    [user.id]
  ) as any

  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  if (cliente.suscripcion_estado === 'cancelada') {
    return NextResponse.json({ error: 'La suscripción ya está cancelada' }, { status: 409 })
  }

  await execute(`UPDATE clientes SET suscripcion_estado = 'cancelada' WHERE id = ?`, [cliente.id])

  return NextResponse.json({ ok: true, mensaje: 'Suscripción cancelada. Tu acceso continúa hasta el fin del período pagado.' })
}
