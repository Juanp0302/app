/**
 * POST /api/perfil/password
 * Cambia la contraseña del usuario autenticado. Requiere la contraseña
 * actual (o la temporal, en el primer login) y limpia must_change_password.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne, execute } from '@/lib/db'
import { verifyPassword, hashPassword, migrateMustChangePassword } from '@/lib/password'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const userId = (session.user as any).id

  const { passwordActual, passwordNueva } = await req.json()
  if (!passwordActual || !passwordNueva) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }
  if (passwordNueva.length < 8) {
    return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' }, { status: 400 })
  }

  await migrateMustChangePassword()

  const user = await queryOne('SELECT password FROM users WHERE id = ?', [userId]) as any
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  const { ok } = await verifyPassword(passwordActual, user.password)
  if (!ok) return NextResponse.json({ error: 'La contraseña actual es incorrecta' }, { status: 400 })

  const nuevoHash = await hashPassword(passwordNueva)
  await execute(
    `UPDATE users SET password = ?, must_change_password = 0 WHERE id = ?`,
    [nuevoHash, userId]
  )

  return NextResponse.json({ ok: true })
}
