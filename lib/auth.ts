/**
 * lib/auth.ts
 * NextAuth completo con provider de credenciales y acceso a SQLite.
 * Solo se importa desde Server Components y API routes (no desde middleware).
 */

import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import crypto from 'crypto'
import { authConfig } from './auth.config'

function hashPassword(pwd: string): string {
  return crypto.createHash('sha256').update(pwd + 'owl_salt_2026').digest('hex')
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',      type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        // Importación dinámica para evitar que SQLite llegue al Edge
        const { db } = await import('./db')
        const user = db.prepare(
          'SELECT * FROM users WHERE email = ? AND activo = 1'
        ).get(credentials.email as string) as any

        if (!user) return null
        if (hashPassword(credentials.password as string) !== user.password) return null

        return {
          id:    user.id,
          email: user.email,
          name:  user.nombre,
          role:  user.rol,
        }
      },
    }),
  ],
})
