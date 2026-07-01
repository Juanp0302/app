/**
 * GET  /api/suscripcion            → resumen de uso del cliente autenticado
 * PATCH /api/suscripcion           → superadmin asigna/cambia plan de un cliente
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne, execute } from '@/lib/db'
import { resumenUso, migrateSuscripcion, PLANES, type PlanKey, type EstadoSuscripcion } from '@/lib/suscripcion'

async function getUser() {
  const session = await auth()
  return session?.user as any ?? null
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  await migrateSuscripcion()

  // Superadmin: puede consultar cualquier cliente
  const clienteId = req.nextUrl.searchParams.get('clienteId') ??
    (user.role === 'cliente'
      ? ((await queryOne('SELECT id FROM clientes WHERE user_id = ?', [user.id])) as any)?.id
      : null)

  if (!clienteId) return NextResponse.json({ error: 'clienteId requerido' }, { status: 400 })

  const resumen = await resumenUso(clienteId)
  if (!resumen) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  return NextResponse.json({ ...resumen, planes: PLANES })
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const user = await getUser()
  if (!user?.is_superadmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  await migrateSuscripcion()

  const body = await req.json()
  const { clienteId, plan, estado } = body as {
    clienteId: string
    plan?: string
    estado?: string
  }

  if (!clienteId) return NextResponse.json({ error: 'clienteId requerido' }, { status: 400 })

  if (plan !== undefined && plan !== null && !PLANES[plan as PlanKey])
    return NextResponse.json({ error: 'Plan inválido. Opciones: basico, pro, premium' }, { status: 400 })

  const ESTADOS: EstadoSuscripcion[] = ['activa', 'suspendida', 'trial', 'cancelada']
  if (estado !== undefined && !ESTADOS.includes(estado as EstadoSuscripcion))
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })

  const campos: string[] = []
  const vals: any[]      = []

  if (plan !== undefined) {
    campos.push('plan = ?')
    vals.push(plan || null)
  }
  if (estado !== undefined) {
    campos.push('suscripcion_estado = ?')
    vals.push(estado)
    if (estado === 'activa') {
      // Activar: registrar inicio y próximo vencimiento (+30 días)
      const inicio     = new Date()
      const vencimiento = new Date(inicio)
      vencimiento.setDate(vencimiento.getDate() + 30)
      campos.push('suscripcion_inicio = ?', 'suscripcion_vencimiento = ?')
      vals.push(inicio.toISOString().slice(0, 10), vencimiento.toISOString().slice(0, 10))
    }
  }

  if (campos.length === 0)
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })

  vals.push(clienteId)
  await execute(`UPDATE clientes SET ${campos.join(', ')} WHERE id = ?`, vals)

  return NextResponse.json({ ok: true })
}
