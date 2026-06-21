import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AdminsClient from './AdminsClient'

export default async function AdminsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const user = session.user as any
  if (user.role !== 'admin') redirect('/dashboard')
  return <AdminsClient currentUserId={user.id} />
}
