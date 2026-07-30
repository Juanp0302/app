/**
 * lib/auth.config.ts
 * Configuración base de NextAuth — sin imports de Node.js/SQLite.
 * Usada por el middleware (Edge runtime).
 */

import type { NextAuthConfig } from 'next-auth'

export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [],   // los providers reales van en auth.ts
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn  = !!auth?.user
      const isDashboard = request.nextUrl.pathname.startsWith('/dashboard')
      if (!isDashboard) return true
      if (!isLoggedIn) return false

      const mustChange = (auth!.user as any).must_change_password === true
      const isCambiarPasswordPage = request.nextUrl.pathname === '/dashboard/cambiar-password'
      if (mustChange && !isCambiarPasswordPage) {
        return Response.redirect(new URL('/dashboard/cambiar-password', request.nextUrl))
      }

      const debeElegirServicios = (auth!.user as any).debe_elegir_servicios === true
      const isSeleccionarServiciosPage = request.nextUrl.pathname === '/dashboard/seleccionar-servicios'
      if (debeElegirServicios && !isSeleccionarServiciosPage) {
        return Response.redirect(new URL('/dashboard/seleccionar-servicios', request.nextUrl))
      }

      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.role                  = (user as any).role
        token.id                    = user.id
        token.is_superadmin         = (user as any).is_superadmin ?? false
        token.must_change_password  = (user as any).must_change_password ?? false
        token.debe_elegir_servicios = (user as any).debe_elegir_servicios ?? false
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).role                  = token.role
        ;(session.user as any).id                    = token.id
        ;(session.user as any).is_superadmin         = token.is_superadmin ?? false
        ;(session.user as any).must_change_password  = token.must_change_password ?? false
        ;(session.user as any).debe_elegir_servicios = token.debe_elegir_servicios ?? false
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET ?? 'owl_dev_secret_2026_change_in_prod',
  trustHost: true,
}
