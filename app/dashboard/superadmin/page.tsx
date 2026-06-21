import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import SuperadminClient from './SuperadminClient'

export default async function SuperadminPage() {
  const session = await auth()
  const user = session?.user as any
  if (!user) redirect('/login')
  if (!user.is_superadmin) redirect('/dashboard')

  return <SuperadminClient />
}
