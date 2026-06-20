import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const user = session.user as any
  return <DashboardClient userName={user?.name ?? ''} userRole={user?.role ?? ''} />
}
