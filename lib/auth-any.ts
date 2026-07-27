/**
 * lib/auth-any.ts
 * Resuelve el usuario autenticado sin importar el origen: sesión de
 * NextAuth (web, cookie) o token Bearer de la app móvil. Las rutas de
 * API que deben servir tanto a la web como a la app móvil (tickets, chat)
 * usan este helper en lugar de llamar `auth()` directamente.
 */
import { NextRequest } from 'next/server'
import { auth } from './auth'
import { getMobileUser } from './mobile-auth'

export async function getUserFromRequest(req: NextRequest) {
  const mobileUser = getMobileUser(req)
  if (mobileUser) return mobileUser

  const session = await auth()
  if (!session?.user) return null
  return session.user as any
}
