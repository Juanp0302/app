import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne, queryAll, execute } from '@/lib/db'
import crypto from 'crypto'

function hashPassword(pwd: string) {
  return crypto.createHash('sha256').update(pwd + 'owl_salt_2026').digest('hex')
}

async function requireAdmin() {
  const session = await auth()
  if (!session?.user) return null
  return (session.user as any).role === 'admin' ? (session.user as any) : null
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admins = await queryAll(
    `SELECT id, email, nombre, activo, created_at FROM users WHERE rol = 'admin' ORDER BY created_at`
  )
  return NextResponse.json(admins)
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { email, nombre, password } = await req.json()
  if (!email || !nombre || !password)
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })

  const existe = await queryOne('SELECT id FROM users WHERE email = ?', [email])
  if (existe) return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 })

  const id = crypto.randomUUID()
  await execute(
    `INSERT INTO users (id, email, password, nombre, rol) VALUES (?, ?, ?, ?, 'admin')`,
    [id, email, hashPassword(password), nombre]
  )
  return NextResponse.json({ ok: true, id }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  // No permitir desactivarse a sí mismo
  if (id === user.id) return NextResponse.json({ error: 'No puedes modificar tu propia cuenta' }, { status: 400 })

  const { activo } = await req.json()
  await execute(`UPDATE users SET activo = ? WHERE id = ? AND rol = 'admin'`, [activo ? 1 : 0, id])
  return NextResponse.json({ ok: true })
}
