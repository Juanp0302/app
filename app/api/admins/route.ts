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

  const body = await req.json()

  // Toggle activo
  if (typeof body.activo !== 'undefined') {
    await execute(`UPDATE users SET activo = ? WHERE id = ? AND rol = 'admin'`, [body.activo ? 1 : 0, id])
    return NextResponse.json({ ok: true })
  }

  // Editar datos del administrador
  const { nombre, email, password } = body
  if (!nombre || !email)
    return NextResponse.json({ error: 'Nombre y email son requeridos' }, { status: 400 })

  // Verificar que el email no esté en uso por otro usuario
  const ocupado = await queryOne('SELECT id FROM users WHERE email = ? AND id != ?', [email, id])
  if (ocupado) return NextResponse.json({ error: 'Ese email ya está registrado por otro usuario' }, { status: 409 })

  if (password) {
    if (password.length < 8)
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
    await execute(
      `UPDATE users SET nombre = ?, email = ?, password = ? WHERE id = ? AND rol = 'admin'`,
      [nombre, email, hashPassword(password), id]
    )
  } else {
    await execute(
      `UPDATE users SET nombre = ?, email = ? WHERE id = ? AND rol = 'admin'`,
      [nombre, email, id]
    )
  }
  return NextResponse.json({ ok: true })
}
