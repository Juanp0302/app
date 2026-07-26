/**
 * POST /api/suscripcion/solicitar
 * El cliente solicita activar o cambiar de plan. Sin pasarela de pago
 * integrada, el plan queda en estado 'trial' pendiente de activación
 * manual por el equipo de Owl Compliance.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne, execute } from '@/lib/db'
import { migrateSuscripcion, PLANES, PlanKey } from '@/lib/suscripcion'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'cliente') {
    return NextResponse.json({ error: 'Solo los clientes pueden solicitar un plan' }, { status: 403 })
  }

  const body = await req.json()
  const planKey = body.plan as PlanKey

  if (!planKey || !PLANES[planKey]) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }

  await migrateSuscripcion()

  const cliente = await queryOne(`SELECT id FROM clientes WHERE user_id = ?`, [user.id]) as any
  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  await execute(
    `UPDATE clientes SET plan = ?, suscripcion_estado = 'trial' WHERE id = ?`,
    [planKey, cliente.id]
  )

  return NextResponse.json({ ok: true })
}
