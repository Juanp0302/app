/**
 * middleware.ts
 * Protege rutas del dashboard. Usa authConfig (sin SQLite) para funcionar
 * en el Edge runtime de Next.js.
 */

import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'

export const { auth: middleware } = NextAuth(authConfig)

export default middleware

export const config = {
  matcher: ['/dashboard/:path*'],
}
