import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { queryAll } from '@/lib/db'
import { SessionProvider } from 'next-auth/react'
import SeleccionarServiciosClient from './SeleccionarServiciosClient'

export default async function SeleccionarServiciosPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const user = session.user as any
  if (user.role !== 'cliente') redirect('/dashboard')

  const servicios = await queryAll(`
    SELECT DISTINCT servicio, servicio_slug
    FROM obligaciones_catalogo
    ORDER BY servicio
  `) as { servicio: string; servicio_slug: string }[]

  return (
    <SessionProvider>
      <SeleccionarServiciosClient serviciosDisponibles={servicios} />
    </SessionProvider>
  )
}
