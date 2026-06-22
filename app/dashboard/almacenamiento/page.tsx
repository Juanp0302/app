import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AlmacenamientoClient from './AlmacenamientoClient'

export default async function AlmacenamientoPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const user = session.user as any
  if (user.role !== 'cliente') redirect('/dashboard')
  return <AlmacenamientoClient />
}
