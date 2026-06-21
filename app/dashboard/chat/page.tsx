import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { queryOne } from '@/lib/db'
import ChatClient from './ChatClient'

export default async function ChatPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const user = session.user as any

  let clienteId = null
  if (user.role === 'cliente') {
    const c = await queryOne('SELECT id FROM clientes WHERE user_id = ?', [user.id])
    if (!c) redirect('/dashboard')
    clienteId = (c as any).id
  }

  return <ChatClient userRole={user.role} userId={user.id} clienteId={clienteId} />
}
