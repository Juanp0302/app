'use client'

import { useEffect, useMemo, useState } from 'react'
import NavLogo from '@/components/NavLogo'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

interface Proyecto {
  id:                string
  entidad:           string
  titulo:            string
  estado:            string
  fecha_limite:      string | null
  total_interesados: number
}

interface Participacion {
  proyecto_id: string
  razon_social: string
  plan:         string | null
  comentario:   string | null
  updated_at:   string
}

const ESTADO_LABEL: Record<string, string> = {
  en_tramite:          'En trámite',
  abierto_comentarios: 'Abierto para comentarios',
  cerrado:             'Cerrado',
  publicado:           'Publicado / Expedido',
}
const ESTADO_COLOR: Record<string, string> = {
  en_tramite:          '#3b82f6',
  abierto_comentarios: '#f59e0b',
  cerrado:             '#6b7280',
  publicado:           '#16a34a',
}
const PLAN_LABEL: Record<string, string> = { basico: 'Básico', pro: 'Pro', premium: 'Premium' }

export default function InteresadosClient() {
  const [proyectos,      setProyectos]      = useState<Proyecto[]>([])
  const [participaciones, setParticipaciones] = useState<Participacion[]>([])
  const [cargando,       setCargando]       = useState(true)
  const [search,         setSearch]         = useState('')

  useEffect(() => {
    (async () => {
      const res  = await fetch('/api/proyectos-regulatorios?resumenInteres=1')
      const data = await res.json()
      setProyectos(data.proyectos ?? [])
      setParticipaciones(data.participaciones ?? [])
      setCargando(false)
    })()
  }, [])

  const porProyecto = useMemo(() => {
    const acc: Record<string, Participacion[]> = {}
    for (const p of participaciones) {
      if (!acc[p.proyecto_id]) acc[p.proyecto_id] = []
      acc[p.proyecto_id].push(p)
    }
    return acc
  }, [participaciones])

  const proyectosConInteres = useMemo(() => {
    const term = search.trim().toLowerCase()
    return proyectos
      .filter(p => p.total_interesados > 0)
      .filter(p => {
        if (!term) return true
        if (p.titulo.toLowerCase().includes(term)) return true
        return (porProyecto[p.id] ?? []).some(part => part.razon_social.toLowerCase().includes(term))
      })
  }, [proyectos, porProyecto, search])

  return (
    <div style={{ minHeight: '100vh', background: C.vino, fontFamily: "'Josefin Sans', sans-serif", color: C.marfil }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      <nav style={{ background: 'rgba(39,2,5,0.97)', borderBottom: '1px solid rgba(150,134,34,0.2)', padding: '0.9rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <NavLogo />
          <span style={{ color: 'rgba(231,223,202,0.3)' }}>›</span>
          <a href="/dashboard/proyectos-regulatorios" style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.5)', textDecoration: 'none' }}>Proyectos Regulatorios</a>
          <span style={{ color: 'rgba(231,223,202,0.3)' }}>›</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.olivo }}>Interesados</span>
        </div>
        <a href="/signout" style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.5)', textDecoration: 'none' }}>Salir</a>
      </nav>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '2.5rem 2rem' }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.3rem' }}>
          Manifestaciones de Interés
        </div>
        <p style={{ fontSize: '0.82rem', color: 'rgba(231,223,202,0.6)', lineHeight: 1.6, maxWidth: 560, marginBottom: '1.6rem' }}>
          Clientes que marcaron interés en participar, agrupados por proyecto regulatorio, con sus comentarios cuando los dejaron.
        </p>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por proyecto o cliente…"
          style={{
            width: '100%', maxWidth: 420, marginBottom: '1.8rem',
            background: 'rgba(231,223,202,0.06)', border: '1px solid rgba(150,134,34,0.3)',
            borderRadius: '8px', padding: '0.6rem 0.85rem', fontSize: '0.82rem', color: C.marfil,
            fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
          }}
        />

        {cargando && <div style={{ fontSize: '0.85rem', color: 'rgba(231,223,202,0.5)' }}>Cargando…</div>}
        {!cargando && proyectosConInteres.length === 0 && (
          <div style={{ fontSize: '0.85rem', color: 'rgba(231,223,202,0.4)', fontStyle: 'italic' }}>
            Todavía ningún cliente ha manifestado interés en un proyecto regulatorio.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>
          {proyectosConInteres.map(p => (
            <div key={p.id} style={{ background: 'rgba(231,223,202,0.04)', border: '1px solid rgba(150,134,34,0.2)', borderRadius: '12px', padding: '1.4rem 1.6rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.olivo, background: 'rgba(150,134,34,0.12)', border: `1px solid ${C.olivo}`, borderRadius: '20px', padding: '0.18rem 0.65rem' }}>
                      {p.entidad}
                    </span>
                    <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: ESTADO_COLOR[p.estado] ?? C.marfil }}>
                      ● {ESTADO_LABEL[p.estado] ?? p.estado}
                    </span>
                  </div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.05rem', fontWeight: 700 }}>{p.titulo}</div>
                </div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.45)', flexShrink: 0 }}>
                  {p.total_interesados} interesado{p.total_interesados !== 1 ? 's' : ''}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                {(porProyecto[p.id] ?? []).map((part, i) => (
                  <div key={i} style={{ background: 'rgba(39,2,5,0.35)', border: '1px solid rgba(150,134,34,0.12)', borderRadius: '8px', padding: '0.8rem 1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{part.razon_social}</span>
                      {part.plan && (
                        <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.olivo }}>{PLAN_LABEL[part.plan] ?? part.plan}</span>
                      )}
                    </div>
                    {part.comentario ? (
                      <div style={{ fontSize: '0.78rem', color: 'rgba(231,223,202,0.75)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: '0.5rem' }}>{part.comentario}</div>
                    ) : (
                      <div style={{ fontSize: '0.74rem', color: 'rgba(231,223,202,0.35)', fontStyle: 'italic', marginTop: '0.4rem' }}>Sin comentario — solo marcó interés.</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
