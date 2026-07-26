'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

const PLANES_INFO: Record<string, { label: string }> = {
  basico:  { label: 'Básico' },
  pro:     { label: 'Pro' },
  premium: { label: 'Premium' },
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: 'rgba(231,223,202,0.5)', marginBottom: '0.35rem',
}
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(231,223,202,0.06)', border: '1px solid rgba(150,134,34,0.3)',
  borderRadius: '8px', padding: '0.65rem 0.9rem', fontSize: '0.85rem', color: C.marfil,
  fontFamily: "'Josefin Sans', sans-serif", outline: 'none', boxSizing: 'border-box',
}
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer', appearance: 'none' }

export default function SuscribirseClient() {
  const params = useSearchParams()
  const planParam = params.get('plan') ?? ''
  const planInicial = PLANES_INFO[planParam] ? planParam : ''

  const [form, setForm] = useState({
    nombre:   '',
    email:    '',
    telefono: '',
    empresa:  '',
    plan:     planInicial,
  })
  const [cargando, setCargando] = useState(false)
  const [error,    setError]    = useState('')
  const [enviado,  setEnviado]  = useState(false)

  function setF(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function formValido() {
    return form.nombre.trim() && form.email.trim()
  }

  async function enviar() {
    if (!formValido()) {
      setError('Nombre y correo son requeridos.')
      return
    }
    setCargando(true)
    setError('')
    try {
      const res = await fetch('/api/waitlist', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al registrar tus datos.')
        setCargando(false)
        return
      }
      setEnviado(true)
      setCargando(false)
    } catch {
      setError('Error de conexión. Intenta nuevamente.')
      setCargando(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.vino, display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontFamily: "'Josefin Sans', sans-serif", color: C.marfil,
      padding: '2rem',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      <div style={{
        maxWidth: 480, width: '100%',
        background: 'rgba(231,223,202,0.04)', border: '1px solid rgba(150,134,34,0.25)',
        borderRadius: '16px', overflow: 'hidden',
      }}>
        {/* Cabecera */}
        <div style={{ padding: '1.8rem 2rem 1.2rem', borderBottom: '1px solid rgba(150,134,34,0.15)' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Owl Compliance
          </div>
          <div style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.olivo }}>
            Suscripciones · Próximamente
          </div>
        </div>

        <div style={{ padding: '1.6rem 2rem 2rem' }}>
          {enviado ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '2.2rem', marginBottom: '1rem' }}>✅</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.8rem' }}>
                ¡Listo! Ya estás en la lista de espera
              </div>
              <p style={{ fontSize: '0.85rem', color: 'rgba(231,223,202,0.7)', lineHeight: 1.8 }}>
                Guardamos tus datos y nuestro equipo se pondrá en contacto contigo tan pronto
                abramos las suscripciones en línea.
              </p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: '0.85rem', color: 'rgba(231,223,202,0.7)', lineHeight: 1.8, marginBottom: '1.4rem' }}>
                Las suscripciones en línea estarán disponibles muy pronto. Déjanos tus datos
                y te contactaremos apenas se habiliten los planes
                {planParam && PLANES_INFO[planParam] ? <> — vimos que te interesa el <strong style={{ color: C.olivo }}>Plan {PLANES_INFO[planParam].label}</strong></> : null}.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div>
                  <label style={labelStyle}>Nombre *</label>
                  <input value={form.nombre} onChange={e => setF('nombre', e.target.value)}
                    placeholder="Tu nombre" style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Correo electrónico *</label>
                  <input type="email" value={form.email} onChange={e => setF('email', e.target.value)}
                    placeholder="correo@empresa.com" style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Teléfono</label>
                  <input value={form.telefono} onChange={e => setF('telefono', e.target.value)}
                    placeholder="+57 300 000 0000" style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Empresa / NIT</label>
                  <input value={form.empresa} onChange={e => setF('empresa', e.target.value)}
                    placeholder="Nombre de la empresa" style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Plan de interés</label>
                  <select value={form.plan} onChange={e => setF('plan', e.target.value)} style={selectStyle}>
                    <option value="">Sin definir</option>
                    <option value="basico">Básico</option>
                    <option value="pro">Pro</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>

                {error && (
                  <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '8px', padding: '0.7rem 1rem', fontSize: '0.78rem', color: '#f87171' }}>
                    {error}
                  </div>
                )}

                <button
                  onClick={enviar}
                  disabled={cargando}
                  style={{
                    background: cargando ? 'rgba(150,134,34,0.2)' : C.olivo,
                    color: cargando ? C.olivo : C.vino,
                    border: `1px solid ${C.olivo}`, borderRadius: '8px',
                    padding: '0.75rem 1.6rem', fontWeight: 700, fontSize: '0.75rem',
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    cursor: cargando ? 'not-allowed' : 'pointer',
                    fontFamily: "'Josefin Sans', sans-serif", transition: 'all 0.2s',
                    marginTop: '0.4rem',
                  }}>
                  {cargando ? 'Enviando…' : 'Unirme a la lista de espera'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
