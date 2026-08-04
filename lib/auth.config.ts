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

      // El orden importa: si un cliente nuevo tiene AMBAS banderas en true
      // (must_change_password y debe_elegir_servicios — el caso normal de
      // toda cuenta recién creada automáticamente), exigir primero el
      // cambio de contraseña y solo evaluar "elegir servicios" cuando esa
      // ya no aplique. Evaluar las dos reglas de forma independiente
      // (como estaba antes) produce un bucle infinito: /cambiar-password
      // redirige a /seleccionar-servicios (porque aún debe elegir
      // servicios) y /seleccionar-servicios redirige de vuelta a
      // /cambiar-password (porque aún debe cambiar la contraseña).
      const mustChange = (auth!.user as any).must_change_password === true
      const isCambiarPasswordPage = request.nextUrl.pathname === '/dashboard/cambiar-password'
      if (mustChange) {
        if (!isCambiarPasswordPage) {
          return Response.redirect(new URL('/dashboard/cambiar-password', request.nextUrl))
        }
        return true
      }

      const debeElegirServicios = (auth!.user as any).debe_elegir_servicios === true
      const isSeleccionarServiciosPage = request.nextUrl.pathname === '/dashboard/seleccionar-servicios'
      if (debeElegirServicios) {
        if (!isSeleccionarServiciosPage) {
          return Response.redirect(new URL('/dashboard/seleccionar-servicios', request.nextUrl))
        }
        return true
      }

      return true
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role                  = (user as any).role
        token.id                    = user.id
        token.is_superadmin         = (user as any).is_superadmin ?? false
        token.must_change_password  = (user as any).must_change_password ?? false
        token.debe_elegir_servicios = (user as any).debe_elegir_servicios ?? false
      }
      // Permite refrescar el token sin cerrar sesión: el cliente llama a
      // update({ debe_elegir_servicios: false }) (ver SeleccionarServiciosClient)
      // después de guardar sus servicios, en vez de forzar un re-login.
      if (trigger === 'update' && session) {
        if (typeof (session as any).debe_elegir_servicios === 'boolean') {
          token.debe_elegir_servicios = (session as any).debe_elegir_servicios
        }
        if (typeof (session as any).must_change_password === 'boolean') {
          token.must_change_password = (session as any).must_change_password
        }
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
