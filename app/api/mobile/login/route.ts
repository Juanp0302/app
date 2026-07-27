/**
 * POST /api/mobile/login
 * Login para la app móvil de administradores. Devuelve un JWT propio
 * (ver lib/mobile-auth.ts) para usar como "Authorization: Bearer <token>"
 * en el resto de las llamadas.
 */
import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { signMobileToken } from '@/lib/mobile-auth'
import { execute } from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const email    = (body.email ?? '').toString().trim()
  const password = (body.password ?? '').toString()

  if (!email || !password) {
    return NextResponse.json({ error: 'Correo y contraseña son requeridos' }, { status: 400 })
  }

  const user = await queryOne(
    'SELECT * FROM users WHERE lower(email) = lower(?) AND activo = 1',
    [email]
  ) as any
  if (!user) return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })

  // La app móvil es solo para administradores y superadmin.
  if (user.rol !== 'admin') {
    return NextResponse.json({ error: 'Esta app es solo para administradores' }, { status: 403 })
  }

  const { ok, rehash } = await verifyPassword(password, user.password)
  if (!ok) return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })

  if (rehash) {
    await execute(`UPDATE users SET password = ? WHERE id = ?`, [rehash, user.id])
  }

  const mobileUser = {
    id: user.id,
    email: user.email,
    name: user.nombre,
    role: user.rol,
    is_superadmin: user.is_superadmin === 1,
  }
  const token = signMobileToken(mobileUser)

  return NextResponse.json({ token, user: mobileUser })
}
