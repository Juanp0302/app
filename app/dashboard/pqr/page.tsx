import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import PqrClient from './PqrClient'

export default async function PqrPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const user = session.user as any

  return (
    <PqrClient
      userRole={user?.role ?? ''}
      isAdmin={user?.role === 'admin'}
    />
  )
}
