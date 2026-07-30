import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import CambiarPasswordClient from './CambiarPasswordClient'

export default async function CambiarPasswordPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const user = session.user as any
  return <CambiarPasswordClient obligatorio={!!user.must_change_password} />
}
