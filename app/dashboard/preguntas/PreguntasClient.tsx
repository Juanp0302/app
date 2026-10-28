'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import NavLogo from '@/components/NavLogo'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }
const REFRESCO_MS = 10_000

type Estado = 'nueva' | 'seleccionada' | 'respondida'
type Pregunta = {
  id: number; fecha: string; nombre: string; empresa: string; celular: string; correo: string
  pregunta: string; utm_campaign: string; estado: Estado
}

const ESTADO: Record<Estado, { label: string; color: string }> = {
  nueva:        { label: 'Nueva',        color: '#2563eb' },
  seleccionada: { label: 'Seleccionada', color: '#d97706' },
  respondida:   { label: 'Respondida',   color: '#16a34a' },
}

const hora = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function PreguntasClient() {
  const [preguntas, setPreguntas] = useState<Pregunta[]>([])
  const [campanas, setCampanas]   = useState<string[]>([])
  const [campana, setCampana]     = useState('')
  const [filtro, setFiltro]       = useState<'todas' | Estado>('todas')
  const [cargando, setCargando]   = useState(true)
  const [error, setError]         = useState('')
  const [actualizado, setActualizado] = useState<Date | null>(null)
  const [ocupado, setOcupado]     = useState<number | null>(null)
  const vistas = useRef<Set<number> | null>(null)       // ids ya vistos, para resaltar las que llegan
  const [recien, setRecien]       = useState<Set<number>>(new Set())

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/preguntas${campana ? `?campana=${encodeURIComponent(campana)}` : ''}`, { cache: 'no-store' })
      if (!res.ok) { setError(res.status === 403 ? 'Solo el superadmin puede ver esta sección.' : 'No se pudieron cargar las preguntas.'); return }
      const json = await res.json()
      const lista: Pregunta[] = json.preguntas ?? []
      if (vistas.current) {
        const nuevas = lista.filter(p => !vistas.current!.has(p.id)).map(p => p.id)
        if (nuevas.length) setRecien(prev => new Set([...prev, ...nuevas]))
      }
      vistas.current = new Set(lista.map(p => p.id))
      setPreguntas(lista)
      setCampanas(json.campanas ?? [])
      setActualizado(new Date())
      setError('')
    } catch {
      setError('Sin conexión. Reintentando…')
    } finally {
      setCargando(false)
    }
  }, [campana])

  useEffect(() => {
    vistas.current = null
    cargar()
    const t = setInterval(cargar, REFRESCO_MS)
    return () => clearInterval(t)
  }, [cargar])

  async function marcar(p: Pregunta, estado: Estado) {
    setOcupado(p.id)
    const anterior = p.estado
    setPreguntas(ps => ps.map(x => x.id === p.id ? { ...x, estado } : x))
    setRecien(r => { const n = new Set(r); n.delete(p.id); return n })
    try {
      const res = await fetch('/api/preguntas', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, estado }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setPreguntas(ps => ps.map(x => x.id === p.id ? { ...x, estado: anterior } : x))
      setError('No se pudo cambiar el estado. Intente de nuevo.')
    } finally {
      setOcupado(null)
    }
  }

  const conteo = (e: Estado) => preguntas.filter(p => p.estado === e).length
  const visibles = filtro === 'todas' ? preguntas : preguntas.filter(p => p.estado === filtro)
  const csvHref = `/api/preguntas?formato=csv${campana ? `&campana=${encodeURIComponent(campana)}` : ''}`

  const chip = (activo: boolean, color: string): React.CSSProperties => ({
    fontSize: 13, fontWeight: 600, padding: '6px 12px', borderRadius: 16, cursor: 'pointer', fontFamily: 'inherit',
    border: `1px solid ${color}`, background: activo ? color : '#fff', color: activo ? '#fff' : color, whiteSpace: 'nowrap',
  })
  const boton = (color: string, lleno: boolean): React.CSSProperties => ({
    flex: 1, minHeight: 42, fontSize: 13, fontWeight: 700, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
    border: `1.5px solid ${color}`, background: lleno ? color : '#fff', color: lleno ? '#fff' : color,
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f5f3ee', fontFamily: "'Josefin Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      <nav style={{ position: 'sticky', top: 0, zIndex: 5, background: C.vino, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <NavLogo />
        <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.olivo }}>Preguntas</span>
        <a href="/dashboard" style={{ marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.6)', textDecoration: 'none' }}>← Volver</a>
      </nav>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <select value={campana} onChange={e => setCampana(e.target.value)}
            style={{ flex: '1 1 180px', minHeight: 40, padding: '0 10px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14, fontFamily: 'inherit', background: '#fff' }}>
            <option value="">Todas las campañas</option>
            {campanas.map(c => <option key={c} value={c}>{c || '(sin campaña)'}</option>)}
          </select>
          <a href={csvHref} style={{ minHeight: 40, display: 'inline-flex', alignItems: 'center', padding: '0 14px', borderRadius: 8, background: C.vino, color: C.marfil, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            Descargar CSV
          </a>
        </div>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 8 }}>
          <button onClick={() => setFiltro('todas')} style={chip(filtro === 'todas', '#555')}>Todas ({preguntas.length})</button>
          {(Object.keys(ESTADO) as Estado[]).map(e => (
            <button key={e} onClick={() => setFiltro(e)} style={chip(filtro === e, ESTADO[e].color)}>{ESTADO[e].label} ({conteo(e)})</button>
          ))}
        </div>

        <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
          {actualizado ? `Se actualiza sola cada 10 s · última: ${actualizado.toLocaleTimeString('es-CO')}` : 'Cargando…'}
        </div>
        {error && <div style={{ background: '#fef2f2', color: '#b91c1c', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 10 }}>{error}</div>}

        {!cargando && visibles.length === 0 && (
          <div style={{ background: '#fff', borderRadius: 12, padding: '2rem 1rem', textAlign: 'center', color: '#999', fontSize: 14 }}>
            {preguntas.length === 0 ? 'Todavía no hay preguntas.' : 'No hay preguntas con este filtro.'}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visibles.map(p => {
            const est = ESTADO[p.estado] ?? ESTADO.nueva
            return (
              <article key={p.id} style={{ background: '#fff', borderRadius: 12, padding: '0.9rem 1rem',
                border: `1px solid ${recien.has(p.id) ? '#2563eb' : '#e5e7eb'}`, borderLeft: `5px solid ${est.color}`,
                opacity: p.estado === 'respondida' ? 0.7 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 10, background: est.color + '1f', color: est.color }}>{est.label}</span>
                  {recien.has(p.id) && <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb' }}>● Acaba de llegar</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: '#999' }}>{hora(p.fecha)}</span>
                </div>
                <p style={{ fontSize: 17, lineHeight: 1.45, color: '#222', margin: '0 0 8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{p.pregunta}</p>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 10, lineHeight: 1.5 }}>
                  <strong style={{ color: C.vino }}>{p.nombre}</strong> · {p.empresa}
                  <br />{p.celular} · {p.correo}{p.utm_campaign ? ` · ${p.utm_campaign}` : ''}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {p.estado !== 'seleccionada'
                    ? <button disabled={ocupado === p.id} onClick={() => marcar(p, 'seleccionada')} style={boton(ESTADO.seleccionada.color, false)}>Seleccionar</button>
                    : <button disabled={ocupado === p.id} onClick={() => marcar(p, 'nueva')} style={boton(ESTADO.seleccionada.color, true)}>Seleccionada ✓</button>}
                  {p.estado !== 'respondida'
                    ? <button disabled={ocupado === p.id} onClick={() => marcar(p, 'respondida')} style={boton(ESTADO.respondida.color, false)}>Respondida</button>
                    : <button disabled={ocupado === p.id} onClick={() => marcar(p, 'nueva')} style={boton(ESTADO.respondida.color, true)}>Respondida ✓</button>}
                </div>
              </article>
            )
          })}
        </div>
      </main>
    </div>
  )
}
