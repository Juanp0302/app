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
        mfaCode:  { label: 'Código MFA', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const { queryOne, queryAll, execute } = await import('./db')

        const user = await queryOne(
          'SELECT * FROM users WHERE lower(email) = lower(?) AND activo = 1',
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

        // ── MFA para administradores y superadmin ──────────────────────────
        const esAdmin = (user as any).rol === 'admin' || (user as any).is_superadmin === 1
        if (esAdmin) {
          const code = (credentials.mfaCode as string | undefined)?.trim()
          if (!code) return null   // admin sin código → rechazar

          const token = await queryOne(
            `SELECT id FROM mfa_tokens
             WHERE lower(email) = lower(?)
               AND code = ?
               AND used = 0
               AND expires_at > datetime('now')
             LIMIT 1`,
            [credentials.email as string, code]
          ) as any

          if (!token) return null  // código inválido o expirado

          // Marcar como usado (un solo uso)
          await execute(
            `UPDATE mfa_tokens SET used = 1 WHERE id = ?`,
            [token.id]
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
