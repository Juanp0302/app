import { Suspense } from 'react'
import SuscribirseContratoClient from './SuscribirseContratoClient'

export default function SuscribirsePage() {
  return (
    <Suspense>
      <SuscribirseContratoClient />
    </Suspense>
  )
}
