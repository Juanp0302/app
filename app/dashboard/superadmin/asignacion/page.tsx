import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AsignacionClient from './AsignacionClient'

export default async function AsignacionPage() {
  const session = await auth()
  const user = session?.user as any
  if (!user?.is_superadmin) redirect('/dashboard')
  return <AsignacionClient />
}
