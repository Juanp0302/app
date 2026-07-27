'use client'

import { useEffect, useMemo, useState } from 'react'
import NavLogo from '@/components/NavLogo'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

interface Proyecto {
  id:                string
  entidad:           string
  titulo:            string
  descripcion:       string
  estado:            string
  fecha_limite:      string | null
  enlace:            string | null
  total_interesados: number
}

interface Participacion {
  id:          string
  proyecto_id: string
  interesado:  number
  comentario:  string | null
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

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(231,223,202,0.06)', border: '1px solid rgba(150,134,34,0.3)',
  borderRadius: '8px', padding: '0.6rem 0.85rem', fontSize: '0.82rem', color: C.marfil,
  fontFamily: "'Josefin Sans', sans-serif", outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: 'rgba(231,223,202,0.5)', marginBottom: '0.3rem',
}
const textareaStyle: React.CSSProperties = { ...inputStyle, minHeight: '100px', resize: 'vertical' as const }

function diasRestantes(fecha: string | null): number | null {
  if (!fecha) return null
  const ms = new Date(fecha).getTime() - Date.now()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

export default function ProyectosRegulatoriosClient({ userRole, isAdmin, plan }: { userRole: string; isAdmin: boolean; plan: string | null }) {
  const [items,     setItems]     = useState<Proyecto[]>([])
  const [mias,      setMias]      = useState<Record<string, Participacion>>({})
  const [cargando,  setCargando]  = useState(true)
  const [filtro,    setFiltro]    = useState('todos')
  const [showForm,  setShowForm]  = useState<{ modo: 'crear' | 'editar'; item: Proyecto | null } | null>(null)
  const [verParticipantes, setVerParticipantes] = useState<string | null>(null)

  const puedeComentar = plan === 'pro' || plan === 'premium'

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    try {
      const res  = await fetch('/api/proyectos-regulatorios')
      const data = await res.json()
      setItems(data.items ?? [])
      setMias(data.misParticipaciones ?? {})
    } finally {
      setCargando(false)
    }
  }

  const filtrados = useMemo(() => {
    if (filtro === 'todos') return items
    return items.filter(p => p.estado === filtro)
  }, [items, filtro])

  async function eliminar(id: string) {
    if (!window.confirm('¿Eliminar este proyecto regulatorio? Esta acción no se puede deshacer.')) return
    await fetch('/api/proyectos-regulatorios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'eliminar', id }),
    })
    cargar()
  }

  return (
    <div style={{ minHeight: '100vh', background: C.vino, fontFamily: "'Josefin Sans', sans-serif", color: C.marfil }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      <nav style={{ background: 'rgba(39,2,5,0.97)', borderBottom: '1px solid rgba(150,134,34,0.2)', padding: '0.9rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <NavLogo />
          <span style={{ color: 'rgba(231,223,202,0.3)' }}>›</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.olivo }}>Proyectos Regulatorios</span>
        </div>
        <a href="/signout" style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.5)', textDecoration: 'none' }}>Salir</a>
      </nav>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '2.5rem 2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.3rem' }}>Proyectos Regulatorios</div>
            <p style={{ fontSize: '0.82rem', color: 'rgba(231,223,202,0.6)', lineHeight: 1.6, maxWidth: 560 }}>
              Seguimiento a los proyectos regulatorios en trámite ante la CRC, el MinTIC y la SIC.
              Marque su interés y, si su plan lo permite, cuéntenos sus preocupaciones para que participemos en su nombre.
            </p>
          </div>
          {isAdmin && (
            <button onClick={() => setShowForm({ modo: 'crear', item: null })} style={{ background: 'rgba(150,134,34,0.12)', color: C.olivo, border: `1px solid ${C.olivo}`, borderRadius: '8px', padding: '0.55rem 1.1rem', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
              + Agregar proyecto
            </button>
          )}
        </div>

        {/* Filtro por estado */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.6rem' }}>
          {(['todos', 'abierto_comentarios', 'en_tramite', 'publicado', 'cerrado'] as const).map(key => (
            <button key={key} onClick={() => setFiltro(key)} style={{
              fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '0.4rem 0.9rem', borderRadius: '20px', cursor: 'pointer', fontFamily: 'inherit',
              background: filtro === key ? C.olivo : 'transparent',
              color: filtro === key ? C.vino : 'rgba(231,223,202,0.6)',
              border: `1px solid ${filtro === key ? C.olivo : 'rgba(150,134,34,0.3)'}`,
            }}>
              {key === 'todos' ? 'Todos' : ESTADO_LABEL[key]}
            </button>
          ))}
        </div>

        {cargando && <div style={{ fontSize: '0.85rem', color: 'rgba(231,223,202,0.5)' }}>Cargando…</div>}
        {!cargando && filtrados.length === 0 && (
          <div style={{ fontSize: '0.85rem', color: 'rgba(231,223,202,0.4)', fontStyle: 'italic' }}>No hay proyectos en esta categoría.</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {filtrados.map(p => (
            <ProyectoCard
              key={p.id}
              proyecto={p}
              userRole={userRole}
              isAdmin={isAdmin}
              puedeComentar={puedeComentar}
              miParticipacion={mias[p.id] ?? null}
              onEditar={() => setShowForm({ modo: 'editar', item: p })}
              onEliminar={() => eliminar(p.id)}
              onVerParticipantes={() => setVerParticipantes(p.id)}
              onParticiparOk={cargar}
            />
          ))}
        </div>
      </main>

      {showForm && isAdmin && (
        <FormularioProyecto
          modo={showForm.modo}
          item={showForm.item}
          onClose={() => setShowForm(null)}
          onSaved={() => { setShowForm(null); cargar() }}
        />
      )}

      {verParticipantes && (
        <ParticipantesModal proyectoId={verParticipantes} onClose={() => setVerParticipantes(null)} />
      )}
    </div>
  )
}

// ── Tarjeta de proyecto ─────────────────────────────────────────────────────────
function ProyectoCard({
  proyecto, userRole, isAdmin, puedeComentar, miParticipacion,
  onEditar, onEliminar, onVerParticipantes, onParticiparOk,
}: {
  proyecto:        Proyecto
  userRole:        string
  isAdmin:         boolean
  puedeComentar:   boolean
  miParticipacion: Participacion | null
  onEditar:        () => void
  onEliminar:      () => void
  onVerParticipantes: () => void
  onParticiparOk:  () => void
}) {
  const [comentario, setComentario] = useState(miParticipacion?.comentario ?? '')
  const [enviando,   setEnviando]   = useState(false)
  const [enviadoOk,  setEnviadoOk]  = useState(false)
  const [error,      setError]      = useState('')

  const yaInteresado = !!miParticipacion?.interesado
  const dias = diasRestantes(proyecto.fecha_limite)
  const urgente = dias !== null && dias >= 0 && dias <= 7 && proyecto.estado === 'abierto_comentarios'

  async function marcarInteres() {
    setEnviando(true)
    setError('')
    try {
      const res = await fetch('/api/proyectos-regulatorios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'participar', proyectoId: proyecto.id, interesado: !yaInteresado, comentario: miParticipacion?.comentario ?? null }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error'); setEnviando(false); return }
      onParticiparOk()
    } finally {
      setEnviando(false)
    }
  }

  async function enviarComentario() {
    if (!comentario.trim()) { setError('Escribe tus comentarios antes de enviar.'); return }
    setEnviando(true)
    setError('')
    try {
      const res = await fetch('/api/proyectos-regulatorios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'participar', proyectoId: proyecto.id, interesado: true, comentario: comentario.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al enviar.'); setEnviando(false); return }
      setEnviadoOk(true)
      onParticiparOk()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ background: 'rgba(231,223,202,0.04)', border: '1px solid rgba(150,134,34,0.2)', borderRadius: '12px', padding: '1.5rem 1.7rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.olivo, background: 'rgba(150,134,34,0.12)', border: `1px solid ${C.olivo}`, borderRadius: '20px', padding: '0.2rem 0.7rem' }}>
              {proyecto.entidad}
            </span>
            <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: ESTADO_COLOR[proyecto.estado] ?? C.marfil }}>
              ● {ESTADO_LABEL[proyecto.estado] ?? proyecto.estado}
            </span>
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.15rem', fontWeight: 700 }}>{proyecto.titulo}</div>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button onClick={onVerParticipantes} style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'transparent', color: C.marfil, border: '1px solid rgba(231,223,202,0.25)', borderRadius: '6px', padding: '0.35rem 0.7rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              Interesados ({proyecto.total_interesados})
            </button>
            <button onClick={onEditar} style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'transparent', color: C.olivo, border: `1px solid ${C.olivo}`, borderRadius: '6px', padding: '0.35rem 0.7rem', cursor: 'pointer', fontFamily: 'inherit' }}>Editar</button>
            <button onClick={onEliminar} style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'rgba(220,38,38,0.1)', color: '#f87171', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '6px', padding: '0.35rem 0.7rem', cursor: 'pointer', fontFamily: 'inherit' }}>Eliminar</button>
          </div>
        )}
      </div>

      <p style={{ fontSize: '0.85rem', color: 'rgba(231,223,202,0.75)', lineHeight: 1.7, marginBottom: '0.9rem' }}>{proyecto.descripcion}</p>

      <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', marginBottom: userRole === 'cliente' ? '1.1rem' : 0, fontSize: '0.78rem' }}>
        {proyecto.fecha_limite && (
          <div style={{ color: urgente ? '#f59e0b' : 'rgba(231,223,202,0.55)' }}>
            <strong>Plazo de comentarios:</strong> {new Date(proyecto.fecha_limite).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
            {urgente && dias !== null && <> · {dias === 0 ? 'vence hoy' : `${dias} día${dias !== 1 ? 's' : ''} restantes`}</>}
          </div>
        )}
        {proyecto.enlace && (
          <a href={proyecto.enlace} target="_blank" rel="noopener noreferrer" style={{ color: C.olivo, textDecoration: 'underline' }}>Ver documento oficial →</a>
        )}
        {!isAdmin && (
          <div style={{ color: 'rgba(231,223,202,0.4)' }}>{proyecto.total_interesados} cliente{proyecto.total_interesados !== 1 ? 's' : ''} interesado{proyecto.total_interesados !== 1 ? 's' : ''}</div>
        )}
      </div>

      {userRole === 'cliente' && (
        <div style={{ borderTop: '1px solid rgba(150,134,34,0.15)', paddingTop: '1rem' }}>
          <button onClick={marcarInteres} disabled={enviando} style={{
            background: yaInteresado ? 'rgba(22,163,74,0.12)' : C.olivo,
            color: yaInteresado ? '#4ade80' : C.vino,
            border: yaInteresado ? '1px solid rgba(22,163,74,0.4)' : `1px solid ${C.olivo}`,
            borderRadius: '8px', padding: '0.55rem 1.1rem', fontSize: '0.72rem', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase', cursor: enviando ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginBottom: '0.9rem',
          }}>
            {yaInteresado ? '✓ Marcaste tu interés' : 'Estoy interesado en participar'}
          </button>

          {puedeComentar ? (
            <div>
              <label style={labelStyle}>Sus preocupaciones o cambios sugeridos para este proyecto</label>
              <textarea value={comentario} onChange={e => setComentario(e.target.value)} style={textareaStyle}
                placeholder="Describa sus preocupaciones con el proyecto o los cambios que le gustaría que la entidad incluyera…" />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.6rem' }}>
                <button onClick={enviarComentario} disabled={enviando} style={{ background: enviando ? 'rgba(150,134,34,0.2)' : C.olivo, color: enviando ? C.olivo : C.vino, border: `1px solid ${C.olivo}`, borderRadius: '8px', padding: '0.5rem 1.2rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: enviando ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {enviando ? 'Enviando…' : miParticipacion?.comentario ? 'Actualizar comentario' : 'Enviar comentario'}
                </button>
              </div>
              {enviadoOk && <div style={{ marginTop: '0.5rem', fontSize: '0.76rem', color: '#4ade80' }}>Comentario enviado — nuestro equipo lo tendrá en cuenta al participar en su nombre.</div>}
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <textarea disabled value="" style={{ ...textareaStyle, minHeight: '70px', opacity: 0.4, cursor: 'not-allowed' }}
                placeholder="Describa sus preocupaciones o cambios sugeridos…" />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(39,2,5,0.55)', borderRadius: '8px' }}>
                <a href="/dashboard/suscripcion" style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.olivo, background: 'rgba(150,134,34,0.15)', border: `1px solid ${C.olivo}`, borderRadius: '6px', padding: '0.45rem 0.9rem', textDecoration: 'none' }}>
                  Disponible en planes Pro y Premium
                </a>
              </div>
            </div>
          )}

          {error && <div style={{ marginTop: '0.6rem', fontSize: '0.76rem', color: '#f87171' }}>{error}</div>}
        </div>
      )}
    </div>
  )
}

// ── Modal admin: crear/editar proyecto ──────────────────────────────────────────
function FormularioProyecto({ modo, item, onClose, onSaved }: {
  modo: 'crear' | 'editar'
  item: Proyecto | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    entidad:      item?.entidad ?? 'CRC',
    titulo:       item?.titulo ?? '',
    descripcion:  item?.descripcion ?? '',
    estado:       item?.estado ?? 'en_tramite',
    fechaLimite:  item?.fecha_limite ? item.fecha_limite.slice(0, 10) : '',
    enlace:       item?.enlace ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error,     setError]     = useState('')

  function setF(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function guardar() {
    if (!form.titulo.trim() || !form.descripcion.trim()) {
      setError('Título y descripción son obligatorios.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      const datos = { ...form, fechaLimite: form.fechaLimite || null, enlace: form.enlace || null }
      const body = modo === 'crear'
        ? { accion: 'crear', datos }
        : { accion: 'actualizar', id: item!.id, datos }
      const res  = await fetch('/api/proyectos-regulatorios', {
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
      <div style={{ background: '#1a0505', border: '1px solid rgba(150,134,34,0.3)', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', fontFamily: "'Josefin Sans', sans-serif" }}>
        <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid rgba(150,134,34,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: C.marfil }}>
            {modo === 'crear' ? 'Agregar proyecto regulatorio' : 'Editar proyecto regulatorio'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(231,223,202,0.4)', fontSize: '1.3rem', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
            <div>
              <label style={labelStyle}>Entidad *</label>
              <select value={form.entidad} onChange={e => setF('entidad', e.target.value)} style={inputStyle}>
                <option value="CRC">CRC</option>
                <option value="MinTIC">MinTIC</option>
                <option value="SIC">SIC</option>
                <option value="Otra">Otra</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Estado *</label>
              <select value={form.estado} onChange={e => setF('estado', e.target.value)} style={inputStyle}>
                <option value="en_tramite">En trámite</option>
                <option value="abierto_comentarios">Abierto para comentarios</option>
                <option value="cerrado">Cerrado</option>
                <option value="publicado">Publicado / Expedido</option>
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Título *</label>
            <input value={form.titulo} onChange={e => setF('titulo', e.target.value)} placeholder="Ej. Proyecto de resolución sobre..." style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Descripción *</label>
            <textarea value={form.descripcion} onChange={e => setF('descripcion', e.target.value)} style={{ ...textareaStyle, minHeight: '110px' }}
              placeholder="De qué trata el proyecto, motivación, alcance…" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
            <div>
              <label style={labelStyle}>Fecha límite de comentarios</label>
              <input type="date" value={form.fechaLimite} onChange={e => setF('fechaLimite', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Enlace al documento oficial</label>
              <input value={form.enlace} onChange={e => setF('enlace', e.target.value)} placeholder="https://…" style={inputStyle} />
            </div>
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

// ── Modal admin: ver participantes de un proyecto ───────────────────────────────
function ParticipantesModal({ proyectoId, onClose }: { proyectoId: string; onClose: () => void }) {
  const [items,    setItems]    = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    (async () => {
      const res  = await fetch(`/api/proyectos-regulatorios?id=${proyectoId}&participantes=1`)
      const data = await res.json()
      setItems(data.items ?? [])
      setCargando(false)
    })()
  }, [proyectoId])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#1a0505', border: '1px solid rgba(150,134,34,0.3)', borderRadius: '16px', width: '100%', maxWidth: '640px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', fontFamily: "'Josefin Sans', sans-serif" }}>
        <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid rgba(150,134,34,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: C.marfil }}>Clientes interesados</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(231,223,202,0.4)', fontSize: '1.3rem', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.2rem 1.5rem' }}>
          {cargando && <div style={{ fontSize: '0.82rem', color: 'rgba(231,223,202,0.5)' }}>Cargando…</div>}
          {!cargando && items.length === 0 && <div style={{ fontSize: '0.82rem', color: 'rgba(231,223,202,0.4)', fontStyle: 'italic' }}>Ningún cliente ha marcado interés todavía.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {items.map(p => (
              <div key={p.id} style={{ background: 'rgba(231,223,202,0.04)', border: '1px solid rgba(150,134,34,0.15)', borderRadius: '8px', padding: '0.9rem 1.1rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: p.comentario ? '0.5rem' : 0 }}>{p.razon_social}</div>
                {p.comentario && (
                  <div style={{ fontSize: '0.78rem', color: 'rgba(231,223,202,0.7)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{p.comentario}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
