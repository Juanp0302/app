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
        const { queryOne } = await import('./db')
        const user = await queryOne(
          'SELECT * FROM users WHERE email = ? AND activo = 1',
          [credentials.email as string]
        )
        if (!user) return null
        if (hashPassword(credentials.password as string) !== (user as any).password) return null
        return {
          id:    (user as any).id,
          email: (user as any).email,
          name:  (user as any).nombre,
          role:  (user as any).rol,
        }
      },
    }),
  ],
})
