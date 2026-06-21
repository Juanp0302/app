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
      const isLoggedIn    = !!auth?.user
      const isDashboard   = request.nextUrl.pathname.startsWith('/dashboard')
      if (isDashboard) return isLoggedIn
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.id   = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).role = token.role
        ;(session.user as any).id   = token.id
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET ?? 'owl_dev_secret_2026_change_in_prod',
  trustHost: true,
}
