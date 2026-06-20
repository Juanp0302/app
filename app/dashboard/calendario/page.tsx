import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { queryOne, queryAll } from '@/lib/db'
import CalendarioClient from './CalendarioClient'

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ clienteId?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const user   = session.user as any
  const params = await searchParams

  let clienteId = params.clienteId ?? null

  if (user.role === 'cliente') {
    const c = await queryOne('SELECT id FROM clientes WHERE user_id = ?', [user.id])
    if (!c) redirect('/dashboard')
    clienteId = (c as any).id
  }

  const clientes = user.role === 'admin'
    ? (await queryAll('SELECT id, razon_social, nit FROM clientes WHERE activo=1 ORDER BY razon_social') as any[])
    : []

  const resolvedId = clienteId ?? clientes[0]?.id ?? null

  return (
    <CalendarioClient
      userRole={user.role}
      clienteId={resolvedId}
      clientes={clientes}
    />
  )
}
