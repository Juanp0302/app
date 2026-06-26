import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { queryAll } from '@/lib/db'
import MensajeriaClient from './MensajeriaClient'

export default async function MensajeriaPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const user = session.user as any
  if (user.role === 'cliente') redirect('/dashboard')

  const admins = await queryAll(
    `SELECT id, nombre, email FROM users WHERE rol = 'admin' AND activo = 1 AND id != ? ORDER BY nombre`,
    [user.id]
  ) as any[]

  return <MensajeriaClient userId={user.id} userName={user.name ?? user.email} admins={admins} />
}
