import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { queryOne } from '@/lib/db'
import { resumenUso, PLANES } from '@/lib/suscripcion'
import SuscripcionClient from './SuscripcionClient'

export default async function SuscripcionPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const user = session.user as any

  let clienteId: string | null = null
  if (user.role === 'cliente') {
    const c = await queryOne('SELECT id FROM clientes WHERE user_id = ?', [user.id]) as any
    if (!c) redirect('/dashboard')
    clienteId = c.id
  } else {
    redirect('/dashboard')
  }

  const resumen = await resumenUso(clienteId!)

  return <SuscripcionClient resumen={resumen} planes={PLANES} />
}
