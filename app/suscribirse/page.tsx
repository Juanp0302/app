import { Suspense } from 'react'
import SuscribirseClient from './SuscribirseClient'

export default function SuscribirsePage() {
  return (
    <Suspense>
      <SuscribirseClient />
    </Suspense>
  )
}
