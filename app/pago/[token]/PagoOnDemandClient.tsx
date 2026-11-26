'use client'

import { useState } from 'react'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

type Datos = { nombre: string; empresa: string; tipo_id: string; numero_id: string; telefono: string; correo: string; objeto: string }
type Servicio = { concepto: string; monto: number; pagado: boolean; inicial: Datos }

const label: React.CSSProperties = {
  display: 'block', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'rgba(231,223,202,0.6)', marginBottom: '0.35rem',
}
const input = (error: boolean): React.CSSProperties => ({
  width: '100%', boxSizing: 'border-box', background: 'rgba(231,223,202,0.06)', color: C.marfil,
  border: `1px solid ${error ? '#f87171' : 'rgba(150,134,34,0.35)'}`, borderRadius: 8, padding: '0.7rem 0.85rem',
  fontSize: 16, fontFamily: 'inherit', outline: 'none',
})
const MENSAJES: Record<string, string> = {
  nombre: 'Escriba su nombre completo.', empresa: 'Escriba la empresa o razón social.', tipo_id: 'Elija el tipo de documento.',
  numero_id: 'Escriba el número de documento.', telefono: 'Escriba un celular válido (7 a 15 dígitos).',
  correo: 'Escriba un correo válido.', objeto: 'Cuéntenos un poco más (mínimo 10 caracteres).',
  autorizacion: 'Debe autorizar el tratamiento de datos para continuar.',
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: C.vino, color: C.marfil, fontFamily: "'Josefin Sans', sans-serif",
      display: 'flex', justifyContent: 'center', padding: '2rem 1rem' }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />
      <div style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.olivo, marginBottom: '1.5rem' }}>
          Owl Compliance
        </div>
        {children}
      </div>
    </div>
  )
}

export default function PagoOnDemandClient({ token, servicio }: { token: string; servicio: Servicio | null }) {
  const [d, setD]             = useState<Datos>(servicio?.inicial ?? { nombre: '', empresa: '', tipo_id: 'NIT', numero_id: '', telefono: '', correo: '', objeto: '' })
  const [autorizo, setAutorizo] = useState(false)
  const [honey, setHoney]     = useState('')
  const [campos, setCampos]   = useState<string[]>([])
  const [error, setError]     = useState('')
  const [enviando, setEnviando] = useState(false)

  if (!servicio) return (
    <Marco>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem' }}>Enlace no disponible</h1>
      <p style={{ color: 'rgba(231,223,202,0.7)', lineHeight: 1.7 }}>
        Este enlace no existe o ya no está activo. Escríbanos a <strong style={{ color: C.olivo }}>contacto@owlcompliance.com</strong> y le ayudamos.
      </p>
    </Marco>
  )

  if (servicio.pagado) return (
    <Marco>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem' }}>Este servicio ya está pagado</h1>
      <p style={{ color: 'rgba(231,223,202,0.7)', lineHeight: 1.7 }}>
        Gracias. Nuestro equipo ya tiene sus datos y se pondrá en contacto con usted.
      </p>
    </Marco>
  )

  const set = (k: keyof Datos) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setD(x => ({ ...x, [k]: e.target.value }))

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true); setError(''); setCampos([])
    try {
      const r = await fetch(`/api/on-demand/${encodeURIComponent(token)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...d, autorizacion: autorizo, _honey: honey }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok && j.link) { window.location.href = j.link; return }
      setCampos(j.campos ?? [])
      setError(j.error ?? 'No se pudo continuar. Intente de nuevo.')
    } catch {
      setError('Sin conexión. Intente de nuevo.')
    }
    setEnviando(false)
  }

  const err = (k: string) => campos.includes(k)
  const ayuda = (k: string) => err(k) && <div style={{ fontSize: 12, color: '#f87171', marginTop: 4 }}>{MENSAJES[k]}</div>

  return (
    <Marco>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.7rem', lineHeight: 1.25, margin: '0 0 0.5rem' }}>{servicio.concepto}</h1>
      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: C.olivo, marginBottom: '0.4rem' }}>
        ${servicio.monto.toLocaleString('es-CO')} COP
      </div>
      <p style={{ color: 'rgba(231,223,202,0.65)', lineHeight: 1.7, fontSize: '0.92rem', margin: '0 0 1.75rem' }}>
        Complete sus datos para que podamos contactarle y cuéntenos qué necesita. Al continuar pasará al pago seguro en Trazo.
      </p>

      <form onSubmit={enviar} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={label} htmlFor="objeto">¿Qué necesita? Objeto del servicio *</label>
          <textarea id="objeto" rows={5} value={d.objeto} onChange={set('objeto')} maxLength={3000}
            placeholder="Ej.: Necesitamos acompañamiento en la visita de inspección del MinTIC programada para…"
            style={{ ...input(err('objeto')), resize: 'vertical' }} />
          {ayuda('objeto')}
        </div>
        <div>
          <label style={label} htmlFor="nombre">Nombre completo *</label>
          <input id="nombre" autoComplete="name" value={d.nombre} onChange={set('nombre')} style={input(err('nombre'))} />
          {ayuda('nombre')}
        </div>
        <div>
          <label style={label} htmlFor="empresa">Empresa o razón social *</label>
          <input id="empresa" autoComplete="organization" value={d.empresa} onChange={set('empresa')} style={input(err('empresa'))} />
          {ayuda('empresa')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,3fr)', gap: '0.75rem' }}>
          <div>
            <label style={label} htmlFor="tipo_id">Documento *</label>
            <select id="tipo_id" value={d.tipo_id} onChange={set('tipo_id')} style={input(err('tipo_id'))}>
              <option value="NIT">NIT</option>
              <option value="CC">Cédula</option>
              <option value="CE">Cédula de extranjería</option>
              <option value="PASAPORTE">Pasaporte</option>
            </select>
          </div>
          <div>
            <label style={label} htmlFor="numero_id">Número *</label>
            <input id="numero_id" value={d.numero_id} onChange={set('numero_id')} style={input(err('numero_id'))} />
          </div>
        </div>
        {ayuda('numero_id')}
        <div style={{ fontSize: 12, color: 'rgba(231,223,202,0.45)', marginTop: '-0.6rem' }}>
          Es el documento de quien paga: con NIT, el pago queda a nombre de la empresa.
        </div>
        <div>
          <label style={label} htmlFor="telefono">Celular / WhatsApp *</label>
          <input id="telefono" type="tel" autoComplete="tel" value={d.telefono} onChange={set('telefono')} style={input(err('telefono'))} />
          {ayuda('telefono')}
        </div>
        <div>
          <label style={label} htmlFor="correo">Correo *</label>
          <input id="correo" type="email" autoComplete="email" value={d.correo} onChange={set('correo')} style={input(err('correo'))} />
          {ayuda('correo')}
        </div>

        <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={honey} onChange={e => setHoney(e.target.value)}
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} name="website" />

        <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.82rem', lineHeight: 1.6,
          color: err('autorizacion') ? '#f87171' : 'rgba(231,223,202,0.75)', cursor: 'pointer' }}>
          <input type="checkbox" checked={autorizo} onChange={e => setAutorizo(e.target.checked)} style={{ marginTop: 4, width: 18, height: 18 }} />
          <span>
            Autorizo a Owl Compliance a tratar mis datos para prestar este servicio y contactarme, según su{' '}
            <a href="/privacidad" target="_blank" rel="noopener" style={{ color: C.olivo }}>política de tratamiento de datos</a>.
          </span>
        </label>

        {error && <div style={{ background: 'rgba(220,38,38,0.12)', color: '#fca5a5', borderRadius: 8, padding: '0.7rem 0.9rem', fontSize: '0.85rem' }}>{error}</div>}

        <button type="submit" disabled={enviando}
          style={{ minHeight: 50, background: C.olivo, color: C.vino, border: 'none', borderRadius: 8, fontFamily: 'inherit',
            fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
            cursor: enviando ? 'not-allowed' : 'pointer', opacity: enviando ? 0.65 : 1 }}>
          {enviando ? 'Preparando el pago…' : 'Continuar al pago'}
        </button>
      </form>
    </Marco>
  )
}
