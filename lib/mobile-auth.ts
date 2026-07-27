/**
 * lib/mobile-auth.ts
 * Autenticación para la app móvil (React Native): un JWT propio, firmado
 * con NEXTAUTH_SECRET, independiente de la sesión por cookie de NextAuth
 * (que la app móvil no puede usar). Se envía como header
 * "Authorization: Bearer <token>".
 */
import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

const SECRET = process.env.NEXTAUTH_SECRET ?? 'owl_dev_secret_2026_change_in_prod'
const EXPIRES_IN = '90d'

export interface MobileUser {
  id: string
  email: string
  name: string
  role: string
  is_superadmin: boolean
}

export function signMobileToken(user: MobileUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, is_superadmin: user.is_superadmin },
    SECRET,
    { expiresIn: EXPIRES_IN }
  )
}

/** Verifica el header Authorization: Bearer <token>. Devuelve el usuario o null. */
export function getMobileUser(req: NextRequest): MobileUser | null {
  const header = req.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice('Bearer '.length)
  try {
    const payload = jwt.verify(token, SECRET) as any
    return {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      is_superadmin: !!payload.is_superadmin,
    }
  } catch {
    return null
  }
}
