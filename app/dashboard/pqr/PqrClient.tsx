'use client'

import { useEffect, useMemo, useState } from 'react'
import NavLogo from '@/components/NavLogo'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

interface PqrItem {
  id:           string
  servicio:     string
  codigo:       string
  nombre:       string
  incidencia:   string | null
  severidad:    string | null
  norma:        string | null
  normativa:    string
  plantilla_si: string
  plantilla_no: string
  guia:         string
}

const SEVERIDAD_COLOR: Record<string, string> = {
  Alta:  '#dc2626',
  Media: '#f59e0b',
  Baja:  '#16a34a',
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(231,223,202,0.06)', border: '1px solid rgba(150,134,34,0.3)',
  borderRadius: '8px', padding: '0.6rem 0.85rem', fontSize: '0.82rem', color: C.marfil,
  fontFamily: "'Josefin Sans', sans-serif", outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: 'rgba(231,223,202,0.5)', marginBottom: '0.3rem',
}
const textareaStyle: React.CSSProperties = { ...inputStyle, minHeight: '120px', resize: 'vertical' as const, fontFamily: 'monospace' }

export default function PqrClient({ userRole, isAdmin }: { userRole: string; isAdmin: boolean }) {
  const [items,      setItems]      = useState<PqrItem[]>([])
  const [cargando,   setCargando]   = useState(true)
  const [search,     setSearch]     = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab,        setTab]        = useState<'normativa' | 'plantillas' | 'guia'>('normativa')
  const [copiado,    setCopiado]    = useState<string | null>(null)

  const [showProponer, setShowProponer] = useState(false)
  const [showForm,     setShowForm]     = useState<'crear' | 'editar' | null>(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    try {
      const res  = await fetch('/api/pqr')
      const data = await res.json()
      setItems(data.items ?? [])
      if (!selectedId && data.items?.length) setSelectedId(data.items[0].id)
    } finally {
      setCargando(false)
    }
  }

  const filtrados = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter(i =>
      i.nombre.toLowerCase().includes(term) ||
      i.codigo.toLowerCase().includes(term) ||
      i.servicio.toLowerCase().includes(term)
    )
  }, [items, search])

  const grupos = useMemo(() => {
    const acc: Record<string, PqrItem[]> = {}
    for (const it of filtrados) {
      if (!acc[it.servicio]) acc[it.servicio] = []
      acc[it.servicio].push(it)
    }
    return acc
  }, [filtrados])

  const selected = items.find(i => i.id === selectedId) ?? null

  function copiar(texto: string, key: string) {
    navigator.clipboard.writeText(texto)
    setCopiado(key)
    setTimeout(() => setCopiado(null), 1800)
  }

  async function eliminar(id: string) {
    if (!window.confirm('¿Eliminar esta tipología del repositorio? Esta acción no se puede deshacer.')) return
    await fetch('/api/pqr', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'eliminar', id }),
    })
    if (selectedId === id) setSelectedId(null)
    cargar()
  }

  return (
    <div style={{ minHeight: '100vh', background: C.vino, fontFamily: "'Josefin Sans', sans-serif", color: C.marfil }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      <nav style={{ background: 'rgba(39,2,5,0.97)', borderBottom: '1px solid rgba(150,134,34,0.2)', padding: '0.9rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <NavLogo />
          <span style={{ color: 'rgba(231,223,202,0.3)' }}>›</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.olivo }}>Repositorio PQR</span>
        </div>
        <a href="/signout" style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.5)', textDecoration: 'none' }}>Salir</a>
      </nav>

      <div style={{ display: 'flex', maxWidth: 1300, margin: '0 auto', minHeight: 'calc(100vh - 64px)' }}>

        {/* ── SIDEBAR ── */}
        <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid rgba(150,134,34,0.15)', padding: '1.5rem 1.2rem', overflowY: 'auto' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar tipología o código…"
            style={{ ...inputStyle, marginBottom: '1.2rem' }}
          />

          {isAdmin && (
            <button
              onClick={() => setShowForm('crear')}
              style={{ width: '100%', marginBottom: '1.2rem', background: 'rgba(150,134,34,0.12)', color: C.olivo, border: `1px solid ${C.olivo}`, borderRadius: '8px', padding: '0.55rem', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit' }}>
              + Agregar tipología
            </button>
          )}

          {cargando && <div style={{ fontSize: '0.8rem', color: 'rgba(231,223,202,0.5)' }}>Cargando…</div>}

          {Object.entries(grupos).map(([servicio, tips]) => (
            <div key={servicio} style={{ marginBottom: '1.2rem' }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.4)', marginBottom: '0.5rem', padding: '0 0.3rem' }}>
                {servicio}
              </div>
              {tips.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedId(t.id); setTab('normativa') }}
                  style={{
                    width: '100%', textAlign: 'left', display: 'block',
                    background: selectedId === t.id ? 'rgba(150,134,34,0.15)' : 'transparent',
                    border: selectedId === t.id ? `1px solid ${C.olivo}` : '1px solid transparent',
                    borderRadius: '8px', padding: '0.55rem 0.7rem', marginBottom: '0.3rem',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: selectedId === t.id ? C.olivo : 'rgba(231,223,202,0.55)' }}>{t.codigo}</div>
                  <div style={{ fontSize: '0.78rem', color: C.marfil, lineHeight: 1.4 }}>{t.nombre}</div>
                </button>
              ))}
            </div>
          ))}

          {!cargando && filtrados.length === 0 && (
            <div style={{ fontSize: '0.8rem', color: 'rgba(231,223,202,0.4)', fontStyle: 'italic' }}>Sin resultados.</div>
          )}
        </div>

        {/* ── DETALLE ── */}
        <div style={{ flex: 1, padding: '2rem 2.2rem', minWidth: 0 }}>
          {!selected ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(231,223,202,0.4)', fontSize: '0.9rem' }}>
              Selecciona una tipología del repositorio para comenzar.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.4rem', paddingBottom: '1.2rem', borderBottom: '1px solid rgba(150,134,34,0.15)' }}>
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(231,223,202,0.45)', marginBottom: '0.3rem' }}>{selected.codigo} · {selected.servicio}</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', fontWeight: 700 }}>{selected.nombre}</div>
                </div>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <button onClick={() => setShowForm('editar')} style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'transparent', color: C.olivo, border: `1px solid ${C.olivo}`, borderRadius: '6px', padding: '0.4rem 0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>Editar</button>
                    <button onClick={() => eliminar(selected.id)} style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'rgba(220,38,38,0.1)', color: '#f87171', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '6px', padding: '0.4rem 0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>Eliminar</button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.4rem', flexWrap: 'wrap' }}>
                {selected.incidencia && (
                  <div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.4)' }}>Incidencia</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: C.olivo }}>{selected.incidencia}</div>
                  </div>
                )}
                {selected.severidad && (
                  <div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.4)' }}>Severidad</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: SEVERIDAD_COLOR[selected.severidad] ?? C.marfil }}>{selected.severidad}</div>
                  </div>
                )}
                {selected.norma && (
                  <div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.4)' }}>Norma aplicable</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{selected.norma}</div>
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(150,134,34,0.2)', marginBottom: '1.2rem' }}>
                {([
                  ['normativa', 'Normativa y Fundamento'],
                  ['plantillas', 'Plantillas de Respuesta'],
                  ['guia', 'Guía de Aplicación'],
                ] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setTab(key)} style={{
                    background: 'none', border: 'none', padding: '0.6rem 1rem',
                    fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                    cursor: 'pointer', color: tab === key ? C.olivo : 'rgba(231,223,202,0.4)',
                    borderBottom: tab === key ? `2px solid ${C.olivo}` : '2px solid transparent',
                    marginBottom: '-1px', fontFamily: 'inherit',
                  }}>
                    {label}
                  </button>
                ))}
              </div>

              {tab === 'normativa' && (
                <div style={{ background: 'rgba(231,223,202,0.04)', border: '1px solid rgba(150,134,34,0.15)', borderRadius: '10px', padding: '1.3rem 1.5rem', fontSize: '0.83rem', color: 'rgba(231,223,202,0.85)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {selected.normativa}
                </div>
              )}

              {tab === 'plantillas' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                  <div style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: '10px', padding: '1.2rem 1.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4ade80' }}>✓ Cuando se ACOGE el reclamo</span>
                      <button onClick={() => copiar(selected.plantilla_si, 'si')} style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'rgba(22,163,74,0.15)', color: '#4ade80', border: '1px solid rgba(22,163,74,0.4)', borderRadius: '6px', padding: '0.35rem 0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                        {copiado === 'si' ? 'Copiado ✓' : 'Copiar'}
                      </button>
                    </div>
                    <pre style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(231,223,202,0.8)', whiteSpace: 'pre-wrap', fontFamily: "'Josefin Sans', sans-serif", lineHeight: 1.7 }}>{selected.plantilla_si}</pre>
                  </div>

                  <div style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '10px', padding: '1.2rem 1.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f87171' }}>✗ Cuando se RECHAZA el reclamo</span>
                      <button onClick={() => copiar(selected.plantilla_no, 'no')} style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'rgba(220,38,38,0.15)', color: '#f87171', border: '1px solid rgba(220,38,38,0.4)', borderRadius: '6px', padding: '0.35rem 0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                        {copiado === 'no' ? 'Copiado ✓' : 'Copiar'}
                      </button>
                    </div>
                    <pre style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(231,223,202,0.8)', whiteSpace: 'pre-wrap', fontFamily: "'Josefin Sans', sans-serif", lineHeight: 1.7 }}>{selected.plantilla_no}</pre>
                  </div>
                </div>
              )}

              {tab === 'guia' && (
                <div style={{ background: 'rgba(231,223,202,0.04)', border: '1px solid rgba(150,134,34,0.15)', borderRadius: '10px', padding: '1.3rem 1.5rem', fontSize: '0.83rem', color: 'rgba(231,223,202,0.85)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {selected.guia}
                </div>
              )}

              {userRole === 'cliente' && (
                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                  <button onClick={() => setShowProponer(true)} style={{ background: C.olivo, color: C.vino, border: 'none', borderRadius: '8px', padding: '0.7rem 1.6rem', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Proponer nueva respuesta tipo
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showProponer && selected && (
        <ProponerModal
          tipologia={selected}
          onClose={() => setShowProponer(false)}
        />
      )}

      {showForm && isAdmin && (
        <FormularioPqr
          modo={showForm}
          item={showForm === 'editar' ? selected : null}
          onClose={() => setShowForm(null)}
          onSaved={() => { setShowForm(null); cargar() }}
        />
      )}
    </div>
  )
}

// ── Modal: proponer nueva respuesta tipo (crea un ticket) ──────────────────────
function ProponerModal({ tipologia, onClose }: { tipologia: PqrItem; onClose: () => void }) {
  const [texto,     setTexto]     = useState('')
  const [enviando,  setEnviando]  = useState(false)
  const [error,     setError]     = useState('')
  const [enviado,   setEnviado]   = useState(false)

  async function enviar() {
    if (!texto.trim()) { setError('Describe la respuesta tipo que propones.'); return }
    setEnviando(true)
    setError('')
    try {
      const asunto = `Propuesta de plantilla PQR — ${tipologia.codigo} ${tipologia.nombre}`
      const descripcion =
        `Propuesta de nueva respuesta tipo para el Repositorio de PQR.\n\n` +
        `Tipología: ${tipologia.codigo} — ${tipologia.nombre} (${tipologia.servicio})\n\n` +
        `Propuesta del cliente:\n${texto.trim()}`

      const res  = await fetch('/api/tickets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'crear', tipo: 'juridica', asunto, descripcion, prioridad: 'normal' }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al enviar la propuesta.'); setEnviando(false); return }
      setEnviado(true)
      setEnviando(false)
    } catch {
      setError('Error de conexión. Intenta nuevamente.')
      setEnviando(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#1a0505', border: '1px solid rgba(150,134,34,0.3)', borderRadius: '16px', width: '100%', maxWidth: '560px', fontFamily: "'Josefin Sans', sans-serif" }}>
        <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid rgba(150,134,34,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.olivo, marginBottom: '0.2rem' }}>{tipologia.codigo}</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: C.marfil }}>Proponer respuesta tipo</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(231,223,202,0.4)', fontSize: '1.3rem', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: '1.2rem 1.5rem' }}>
          {enviado ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.8rem' }}>✅</div>
              <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Propuesta enviada</div>
              <p style={{ fontSize: '0.82rem', color: 'rgba(231,223,202,0.7)', lineHeight: 1.7 }}>
                Creamos un ticket con tu propuesta. Nuestro equipo la revisará y, si aplica, la incorporará al repositorio.
              </p>
              <button onClick={onClose} style={{ marginTop: '1rem', background: C.olivo, color: C.vino, border: 'none', borderRadius: '8px', padding: '0.6rem 1.4rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit' }}>Cerrar</button>
            </div>
          ) : (
            <>
              <p style={{ fontSize: '0.78rem', color: 'rgba(231,223,202,0.6)', lineHeight: 1.6, marginBottom: '1rem' }}>
                Cuéntanos la respuesta tipo que propones para esta tipología (texto, criterio de resolución o caso que quieras aportar).
                Se registrará como un ticket para que nuestro equipo la revise e incorpore al repositorio.
              </p>
              <label style={labelStyle}>Propuesta *</label>
              <textarea value={texto} onChange={e => setTexto(e.target.value)} style={textareaStyle}
                placeholder="Describe el texto de la respuesta o el criterio que propones…" />
              {error && (
                <div style={{ marginTop: '0.8rem', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '8px', padding: '0.6rem 0.9rem', fontSize: '0.76rem', color: '#f87171' }}>
                  {error}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.2rem' }}>
                <button onClick={onClose} style={{ background: 'transparent', color: 'rgba(231,223,202,0.5)', border: '1px solid rgba(231,223,202,0.15)', borderRadius: '8px', padding: '0.55rem 1.1rem', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                <button onClick={enviar} disabled={enviando} style={{ background: enviando ? 'rgba(150,134,34,0.2)' : C.olivo, color: enviando ? C.olivo : C.vino, border: `1px solid ${C.olivo}`, borderRadius: '8px', padding: '0.55rem 1.3rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: enviando ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {enviando ? 'Enviando…' : 'Enviar propuesta'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Modal admin: crear/editar tipología ─────────────────────────────────────────
function FormularioPqr({ modo, item, onClose, onSaved }: {
  modo: 'crear' | 'editar'
  item: PqrItem | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    servicio:    item?.servicio    ?? '',
    codigo:      item?.codigo      ?? '',
    nombre:      item?.nombre      ?? '',
    incidencia:  item?.incidencia  ?? '',
    severidad:   item?.severidad   ?? 'Media',
    norma:       item?.norma       ?? '',
    normativa:   item?.normativa   ?? '',
    plantillaSi: item?.plantilla_si ?? '',
    plantillaNo: item?.plantilla_no ?? '',
    guia:        item?.guia        ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error,     setError]     = useState('')

  function setF(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function guardar() {
    if (!form.servicio || !form.codigo || !form.nombre || !form.normativa || !form.plantillaSi || !form.plantillaNo || !form.guia) {
      setError('Completa los campos obligatorios: servicio, código, nombre, normativa, plantillas y guía.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      const body = modo === 'crear'
        ? { accion: 'crear', datos: form }
        : { accion: 'actualizar', id: item!.id, datos: form }
      const res  = await fetch('/api/pqr', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al guardar.'); setGuardando(false); return }
      onSaved()
    } catch {
      setError('Error de conexión. Intenta nuevamente.')
      setGuardando(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#1a0505', border: '1px solid rgba(150,134,34,0.3)', borderRadius: '16px', width: '100%', maxWidth: '680px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', fontFamily: "'Josefin Sans', sans-serif" }}>
        <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid rgba(150,134,34,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: C.marfil }}>
            {modo === 'crear' ? 'Agregar tipología' : 'Editar tipología'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(231,223,202,0.4)', fontSize: '1.3rem', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
            <div>
              <label style={labelStyle}>Servicio *</label>
              <select value={form.servicio} onChange={e => setF('servicio', e.target.value)} style={inputStyle}>
                <option value="">Selecciona…</option>
                <option value="INTERNET FIJO">Internet Fijo</option>
                <option value="INTERNET MÓVIL">Internet Móvil</option>
                <option value="TELEVISIÓN POR SUSCRIPCIÓN">Televisión por Suscripción</option>
                <option value="TELEFONÍA FIJA">Telefonía Fija</option>
                <option value="TELEFONÍA MÓVIL">Telefonía Móvil</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Código *</label>
              <input value={form.codigo} onChange={e => setF('codigo', e.target.value)} placeholder="ISP-FIJ-004" style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Nombre de la tipología *</label>
            <input value={form.nombre} onChange={e => setF('nombre', e.target.value)} placeholder="Nombre según CRC" style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.7rem' }}>
            <div>
              <label style={labelStyle}>% Incidencia</label>
              <input value={form.incidencia} onChange={e => setF('incidencia', e.target.value)} placeholder="12.5%" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Severidad</label>
              <select value={form.severidad} onChange={e => setF('severidad', e.target.value)} style={inputStyle}>
                <option value="Alta">Alta</option>
                <option value="Media">Media</option>
                <option value="Baja">Baja</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Norma aplicable</label>
              <input value={form.norma} onChange={e => setF('norma', e.target.value)} placeholder="Art. X (CRC 5050)" style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Normativa y fundamento *</label>
            <textarea value={form.normativa} onChange={e => setF('normativa', e.target.value)} style={textareaStyle} />
          </div>
          <div>
            <label style={labelStyle}>Plantilla — cuando se ACOGE (SÍ) *</label>
            <textarea value={form.plantillaSi} onChange={e => setF('plantillaSi', e.target.value)} style={textareaStyle} />
          </div>
          <div>
            <label style={labelStyle}>Plantilla — cuando se RECHAZA (NO) *</label>
            <textarea value={form.plantillaNo} onChange={e => setF('plantillaNo', e.target.value)} style={textareaStyle} />
          </div>
          <div>
            <label style={labelStyle}>Guía de aplicación *</label>
            <textarea value={form.guia} onChange={e => setF('guia', e.target.value)} style={textareaStyle} />
          </div>

          {error && (
            <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '8px', padding: '0.7rem 1rem', fontSize: '0.78rem', color: '#f87171' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: '0.9rem 1.5rem', borderTop: '1px solid rgba(150,134,34,0.2)', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'transparent', color: 'rgba(231,223,202,0.5)', border: '1px solid rgba(231,223,202,0.15)', borderRadius: '8px', padding: '0.55rem 1.1rem', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={{ background: guardando ? 'rgba(150,134,34,0.2)' : C.olivo, color: guardando ? C.olivo : C.vino, border: `1px solid ${C.olivo}`, borderRadius: '8px', padding: '0.55rem 1.4rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: guardando ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
