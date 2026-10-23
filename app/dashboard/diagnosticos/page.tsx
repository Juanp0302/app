import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DiagnosticosClient from './DiagnosticosClient'

export default async function DiagnosticosPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const user = session.user as any
  if (user.role !== 'admin' && !user.is_superadmin) redirect('/dashboard')

  return <DiagnosticosClient />
}
