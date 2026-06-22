import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import RevisionesClient from './RevisionesClient'

export default async function RevisionesPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const user = session.user as any
  if (user.role === 'cliente') redirect('/dashboard')
  return <RevisionesClient />
}
