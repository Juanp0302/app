import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { queryOne, queryAll } from '@/lib/db'
import MapaClient from './MapaClient'

export default async function MapaPage({
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
    ? (await queryAll(`
        SELECT c.id, c.razon_social, c.nit,
               COUNT(co.id) AS total,
               SUM(CASE WHEN co.estado='cumplida' THEN 1 ELSE 0 END) AS cumplidas
        FROM clientes c
        LEFT JOIN cliente_obligaciones co ON co.cliente_id = c.id
        WHERE c.activo = 1
        GROUP BY c.id ORDER BY c.razon_social
      `) as any[])
    : []

  return (
    <MapaClient
      userRole={user.role}
      clienteId={clienteId}
      clientes={clientes}
    />
  )
}
