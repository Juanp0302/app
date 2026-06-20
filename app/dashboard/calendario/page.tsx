import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
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
    const c = db.prepare('SELECT id FROM clientes WHERE user_id = ?').get(user.id) as any
    if (!c) redirect('/dashboard')
    clienteId = c.id
  }

  const clientes = user.role === 'admin'
    ? (db.prepare('SELECT id, razon_social, nit FROM clientes WHERE activo=1 ORDER BY razon_social').all() as any[])
    : []

  // Seleccionar primer cliente por defecto en admin
  const resolvedId = clienteId ?? clientes[0]?.id ?? null

  return (
    <CalendarioClient
      userRole={user.role}
      clienteId={resolvedId}
      clientes={clientes}
    />
  )
}
