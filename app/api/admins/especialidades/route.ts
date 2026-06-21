import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryAll, execute } from '@/lib/db'
import crypto from 'crypto'

async function requireAdmin() {
  const session = await auth()
  if (!session?.user) return null
  return (session.user as any).role === 'admin' ? (session.user as any) : null
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const rows = await queryAll(
    `SELECT ae.user_id, ae.tipo, u.nombre FROM admin_especialidades ae JOIN users u ON u.id = ae.user_id`
  )
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { adminId, tipo } = await req.json()
  await execute(
    `INSERT OR IGNORE INTO admin_especialidades (id, user_id, tipo) VALUES (?,?,?)`,
    [crypto.randomUUID(), adminId, tipo]
  )
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { adminId, tipo } = await req.json()
  await execute(`DELETE FROM admin_especialidades WHERE user_id=? AND tipo=?`, [adminId, tipo])
  return NextResponse.json({ ok: true })
}
