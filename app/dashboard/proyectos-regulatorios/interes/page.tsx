import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import InteresadosClient from './InteresadosClient'

export default async function InteresadosPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const user = session.user as any
  if (user.role !== 'admin') redirect('/dashboard')

  return <InteresadosClient />
}
