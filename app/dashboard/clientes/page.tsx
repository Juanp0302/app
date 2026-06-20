import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { queryAll } from '@/lib/db'
import ClientesClient from './ClientesClient'

export default async function ClientesPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const user = session.user as any
  if (user.role !== 'admin') redirect('/dashboard')

  const servicios = await queryAll(`
    SELECT DISTINCT servicio, servicio_slug
    FROM obligaciones_catalogo
    ORDER BY servicio
  `) as { servicio: string; servicio_slug: string }[]

  return <ClientesClient serviciosDisponibles={servicios} />
}
