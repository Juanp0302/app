import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { authConfig } from './auth.config'
import { verifyPassword } from './password'

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
        const { queryOne, execute } = await import('./db')
        const user = await queryOne(
          'SELECT * FROM users WHERE email = ? AND activo = 1',
          [credentials.email as string]
        )
        if (!user) return null

        const { ok, rehash } = await verifyPassword(
          credentials.password as string,
          (user as any).password
        )
        if (!ok) return null

        // Migración silenciosa: si el hash era SHA-256, reemplazar por bcrypt
        if (rehash) {
          await execute(
            `UPDATE users SET password = ? WHERE id = ?`,
            [rehash, (user as any).id]
          )
        }

        return {
          id:            (user as any).id,
          email:         (user as any).email,
          name:          (user as any).nombre,
          role:          (user as any).rol,
          is_superadmin: (user as any).is_superadmin === 1,
        }
      },
    }),
  ],
})
