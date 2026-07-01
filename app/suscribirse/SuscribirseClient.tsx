'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

const C = { vino: '#270205', olivo: '#968622', marfil: '#e7dfca' }

const PLANES: Record<string, { label: string; precio: string }> = {
  basico:  { label: 'Básico',  precio: '$199.000/mes' },
  pro:     { label: 'Pro',     precio: '$890.000/mes' },
  premium: { label: 'Premium', precio: '$2.490.000/mes' },
}

export default function SuscribirseClient() {
  const params  = useSearchParams()
  const plan    = params.get('plan') ?? 'basico'
  const info    = PLANES[plan] ?? PLANES.basico

  const [email,    setEmail]    = useState('')
  const [nombre,   setNombre]   = useState('')
  const [cargando, setCargando] = useState(false)
  const [error,    setError]    = useState('')

  async function continuar(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !nombre) { setError('Completa todos los campos.'); return }
    setCargando(true)
    setError('')
    try {
      const res  = await fetch('/api/mp/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan, email, nombre }),
      })
      const data = await res.json()
      if (!res.ok || !data.init_point) {
        setError(data.error ?? 'Error al conectar con Mercado Pago.')
        setCargando(false)
        return
      }
      window.location.href = data.init_point
    } catch {
      setError('Error de conexión. Intenta nuevamente.')
      setCargando(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.vino, display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontFamily: "'Josefin Sans', sans-serif", color: C.marfil, padding: '2rem',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      <div style={{
        maxWidth: 460, width: '100%',
        background: 'rgba(231,223,202,0.04)', border: '1px solid rgba(150,134,34,0.25)',
        borderRadius: '16px', padding: '2.5rem',
      }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.3rem' }}>
          Owl Compliance
        </div>
        <div style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.olivo, marginBottom: '2rem' }}>
          Plan {info.label} · {info.precio}
        </div>

        <form onSubmit={continuar} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.5)', display: 'block', marginBottom: '0.4rem' }}>
              Nombre o razón social
            </label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Nombre de la empresa"
              style={{
                width: '100%', padding: '0.75rem 1rem', background: 'rgba(231,223,202,0.07)',
                border: '1px solid rgba(150,134,34,0.3)', borderRadius: '8px',
                color: C.marfil, fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.5)', display: 'block', marginBottom: '0.4rem' }}>
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="correo@empresa.com"
              style={{
                width: '100%', padding: '0.75rem 1rem', background: 'rgba(231,223,202,0.07)',
                border: '1px solid rgba(150,134,34,0.3)', borderRadius: '8px',
                color: C.marfil, fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{ fontSize: '0.8rem', color: '#f87171' }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={cargando}
            style={{
              marginTop: '0.5rem', padding: '0.85rem', background: C.olivo, color: C.vino,
              border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.82rem',
              letterSpacing: '0.12em', textTransform: 'uppercase', cursor: cargando ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', opacity: cargando ? 0.7 : 1,
            }}
          >
            {cargando ? 'Redirigiendo a Mercado Pago…' : 'Continuar al pago →'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', fontSize: '0.72rem', color: 'rgba(231,223,202,0.3)', lineHeight: 1.6 }}>
          Al continuar serás redirigido a Mercado Pago para completar el pago de forma segura. Recibirás tus credenciales de acceso por correo tras confirmar el pago.
        </div>
      </div>
    </div>
  )
}
