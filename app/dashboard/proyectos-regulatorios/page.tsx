import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { queryOne } from '@/lib/db'
import ProyectosRegulatoriosClient from './ProyectosRegulatoriosClient'

export default async function ProyectosRegulatoriosPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const user = session.user as any

  let plan: string | null = null
  if (user.role === 'cliente') {
    const cliente = await queryOne('SELECT plan FROM clientes WHERE user_id = ?', [user.id]) as any
    plan = cliente?.plan ?? null
  }

  return (
    <ProyectosRegulatoriosClient
      userRole={user?.role ?? ''}
      isAdmin={user?.role === 'admin'}
      plan={plan}
    />
  )
}
