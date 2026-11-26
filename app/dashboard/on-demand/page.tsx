import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import OnDemandClient from './OnDemandClient'

export default async function OnDemandPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!(session.user as any)?.is_superadmin) redirect('/dashboard')

  return <OnDemandClient />
}
