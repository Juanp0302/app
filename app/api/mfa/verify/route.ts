/**
 * POST /api/mfa/verify
 * Body: { email, password }
 *
 * Solo verifica credenciales. No genera OTP ni envía email.
 * Responde en ~300ms (solo bcrypt + 1 query).
 */
import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/db'
import { verifyPassword } from '@/lib/password'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password)
    return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })

  const user = await queryOne(
    'SELECT id, email, nombre, password, rol, is_superadmin FROM users WHERE lower(email) = lower(?) AND activo = 1',
    [email]
  ) as any

  if (!user)
    return NextResponse.json({ needsMfa: false, ok: false })

  const { ok } = await verifyPassword(password, user.password)
  if (!ok)
    return NextResponse.json({ needsMfa: false, ok: false })

  const esAdmin = Number(user.is_superadmin) === 1 || String(user.rol) === 'admin'
  return NextResponse.json({ needsMfa: esAdmin, ok: true })
}
