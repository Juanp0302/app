import type { Metadata } from 'next'
import { buscarServicioPorToken } from '@/lib/on-demand-db'
import PagoOnDemandClient from './PagoOnDemandClient'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Servicio Owl Compliance', robots: { index: false, follow: false } }

export default async function PagoOnDemandPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const s = await buscarServicioPorToken(token)
  const disponible = s && s.avance !== 'cancelado'

  return (
    <PagoOnDemandClient
      token={token}
      servicio={disponible ? {
        concepto: s.concepto, monto: s.monto, pagado: s.estado_pago === 'pagada',
        // Precarga: lo que el superadmin trajo del cliente, o lo que esta persona ya envió
        inicial: { nombre: s.nombre, empresa: s.empresa, tipo_id: s.tipo_id || 'NIT', numero_id: s.numero_id,
                   telefono: s.telefono, correo: s.correo, objeto: s.objeto },
      } : null}
    />
  )
}
