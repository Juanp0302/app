/**
 * POST /api/suscripcion/solicitar
 * El cliente solicita activar o cambiar de plan. Solo queda registrada la
 * solicitud (plan_solicitado); el plan real y el estado de la cuenta cambian
 * cuando el equipo lo activa o cuando se confirma el pago.
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

  // Solo se registra la solicitud: el plan y el estado de la cuenta NO se tocan aquí.
  // El plan cambia cuando el equipo lo aprueba o cuando llega el pago (flujos de pago).
  await execute(
    `UPDATE clientes SET plan_solicitado = ?, plan_solicitado_at = datetime('now') WHERE id = ?`,
    [planKey, cliente.id]
  )

  return NextResponse.json({ ok: true })
}
