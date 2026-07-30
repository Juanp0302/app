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

        // Los clientes eligen sus propios servicios en el primer login — si
        // todavía no tienen ninguno cargado, el middleware los manda a elegir.
        let debeElegirServicios = false
        if ((user as any).rol === 'cliente') {
          const cliente = await queryOne('SELECT id FROM clientes WHERE user_id = ?', [(user as any).id])
          if (cliente) {
            const servicios = await queryAll('SELECT id FROM cliente_servicios WHERE cliente_id = ?', [(cliente as any).id])
            debeElegirServicios = servicios.length === 0
          }
        }

        return {
          id:                    (user as any).id,
          email:                 (user as any).email,
          name:                  (user as any).nombre,
          role:                  (user as any).rol,
          is_superadmin:         (user as any).is_superadmin === 1,
          must_change_password:  (user as any).must_change_password === 1,
          debe_elegir_servicios: debeElegirServicios,
        }
      },
    }),
  ],
})
