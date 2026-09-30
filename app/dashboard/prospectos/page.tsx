import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ProspectosClient from './ProspectosClient'

export default async function ProspectosPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const user = session.user as any
  if (user.role !== 'admin' && !user.is_superadmin) redirect('/dashboard')

  return <ProspectosClient userId={user.id} isSuperadmin={!!user.is_superadmin} />
}
