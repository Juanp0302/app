import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import HabeasDataClient from './HabeasDataClient'

export default async function HabeasDataPage() {
  const session = await auth()
  const user = session?.user as any
  if (!user) redirect('/login')
  if (!user.is_superadmin) redirect('/dashboard')

  return <HabeasDataClient />
}
