/**
 * /baja — página pública para dejar de recibir los correos de venta de Owl Compliance.
 * Pide confirmar con un botón: los filtros de correo abren los enlaces solos y no deben dar de baja a nadie.
 */
import type { CSSProperties } from 'react'
import { firmaBajaValida } from '@/lib/baja'

export const metadata = { title: 'Darse de baja · Owl Compliance', robots: { index: false } }

const caja: CSSProperties = {
  maxWidth: 480, margin: '80px auto', padding: '32px 28px', fontFamily: 'Arial, sans-serif',
  color: '#1a1a1a', background: '#fff', border: '1px solid #eee', borderRadius: 10, lineHeight: 1.5,
}
const titulo: CSSProperties = { fontSize: 22, color: '#712529' }

export default async function Baja({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const q = await searchParams
  const p = String(q.p ?? '')
  const t = String(q.t ?? '')
  const resultado = String(q.resultado ?? '')

  if (resultado === 'ok' || resultado === 'ya') {
    return (
      <main style={caja}>
        <h1 style={titulo}>Listo</h1>
        <p>No volverás a recibir correos comerciales de Owl Compliance. Si fue un error, escríbenos a contacto@owlcompliance.com.</p>
      </main>
    )
  }
  if (resultado === 'invalido' || !p || !firmaBajaValida(p, t)) {
    return (
      <main style={caja}>
        <h1 style={titulo}>Enlace no válido</h1>
        <p>No pudimos reconocer este enlace. Si quieres dejar de recibir nuestros correos, escríbenos a contacto@owlcompliance.com y lo hacemos de inmediato.</p>
      </main>
    )
  }
  return (
    <main style={caja}>
      <h1 style={titulo}>¿Dejar de recibir nuestros correos?</h1>
      <p>Al confirmar, Owl Compliance no te enviará más correos comerciales.</p>
      <form method="post" action={`/api/baja?p=${encodeURIComponent(p)}&t=${encodeURIComponent(t)}`}>
        <button type="submit" style={{ background: '#712529', color: '#fff', border: 0, borderRadius: 6, padding: '12px 22px', fontSize: 15, cursor: 'pointer' }}>
          Sí, darme de baja
        </button>
      </form>
    </main>
  )
}
