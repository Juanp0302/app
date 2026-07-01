import { Suspense } from 'react'
import PagoExitosoClient from './PagoExitosoClient'

export default function PagoExitosoPage() {
  return (
    <Suspense>
      <PagoExitosoClient />
    </Suspense>
  )
}
