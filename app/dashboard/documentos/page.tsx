import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import DocumentosClient from './DocumentosClient'

export default async function DocumentosPage({
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
    ? (db.prepare('SELECT id, razon_social FROM clientes WHERE activo=1 ORDER BY razon_social').all() as any[])
    : []

  const resolvedId = clienteId ?? clientes[0]?.id ?? null

  // Obligaciones del cliente para el selector de subida
  const obligaciones = resolvedId
    ? (db.prepare(`
        SELECT DISTINCT
          co.id   AS obl_id,
          oc.aspecto,
          oc.grupo,
          oc.obligacion,
          oc.periodicidad
        FROM cliente_obligaciones co
        JOIN obligaciones_catalogo oc ON oc.sub_id = co.catalogo_id
        WHERE co.cliente_id = ?
        ORDER BY oc.aspecto, oc.obligacion
      `).all(resolvedId) as any[])
    : []

  return (
    <DocumentosClient
      userRole={user.role}
      clienteId={resolvedId}
      clientes={clientes}
      obligaciones={obligaciones}
    />
  )
}
