import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import LeadsClient from './LeadsClient'
import { primerNombreDe } from '@/lib/whatsapp'

export default async function LeadsPage() {
  const session = await auth()
  const user = session?.user as any
  if (!user) redirect('/login')
  if (!user.is_superadmin) redirect('/dashboard')
  return <LeadsClient vendedor={primerNombreDe(user.name ?? '')} />
}
