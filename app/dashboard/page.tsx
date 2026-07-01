import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { queryOne } from '@/lib/db'
import { resumenUso } from '@/lib/suscripcion'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const user = session.user as any

  // Gate de suscripción para clientes
  let suscripcion: any = null
  if (user.role === 'cliente') {
    const c = await queryOne('SELECT id FROM clientes WHERE user_id = ?', [user.id]) as any
    if (c) {
      suscripcion = await resumenUso(c.id)
      // Si la suscripción está suspendida o cancelada → solo pueden ver /suscripcion
      if (suscripcion?.estado === 'suspendida' || suscripcion?.estado === 'cancelada') {
        redirect('/dashboard/suscripcion')
      }
    }
  }

  return (
    <DashboardClient
      userName={user?.name ?? ''}
      userRole={user?.role ?? ''}
      isSuperadmin={!!user?.is_superadmin}
      suscripcion={suscripcion}
    />
  )
}
