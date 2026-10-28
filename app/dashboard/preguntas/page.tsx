import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import PreguntasClient from './PreguntasClient'

export default async function PreguntasPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!(session.user as any)?.is_superadmin) redirect('/dashboard')

  return <PreguntasClient />
}
