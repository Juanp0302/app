'use client'

import { useEffect, useState, useCallback } from 'react'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

const TIPOS = [
  { key: 'financiera',   label: 'Financiera',   color: '#3b82f6' },
  { key: 'tecnica',      label: 'Técnica',      color: '#10b981' },
  { key: 'juridica',     label: 'Jurídica',     color: '#f59e0b' },
  { key: 'transversal',  label: 'Transversal',  color: '#8b5cf6' },
]
const PRIORIDADES = [
  { key: 'baja',    label: 'Baja',    color: '#6b7280' },
  { key: 'normal',  label: 'Normal',  color: '#3b82f6' },
  { key: 'alta',    label: 'Alta',    color: '#f59e0b' },
  { key: 'urgente', label: 'Urgente', color: '#dc2626' },
]
const ESTADOS = [
  { key: 'abierto',     label: 'Abierto',     color: '#3b82f6' },
  { key: 'en_progreso', label: 'En progreso', color: '#f59e0b' },
  { key: 'resuelto',    label: 'Resuelto',    color: '#16a34a' },
  { key: 'cerrado',     label: 'Cerrado',     color: '#6b7280' },
]
// Estados que el admin puede asignar manualmente (cerrado es solo automático)
const ESTADOS_MANUALES = ESTADOS.filter(e => e.key !== 'cerrado')

function badge(val: string, arr: { key: string; label: string; color: string }[]) {
  const item = arr.find(x => x.key === val)
  if (!item) return null
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
      background: item.color + '20', color: item.color, border: `1px solid ${item.color}40` }}>
      {item.label}
    </span>
  )
}

function numTicket(n: number | null | undefined) {
  if (!n && n !== 0) return ''
  return `#${String(n).padStart(4, '0')}`
}

const FORM_INIT = { tipo: 'financiera', asunto: '', descripcion: '', prioridad: 'normal' }

export default function TicketsClient({
  userRole, userId, clienteId, isSuperadmin,
}: {
  userRole: string
  userId: string
  clienteId: string | null
  isSuperadmin?: boolean
}) {
  const isAdmin = userRole === 'admin'
  const canEdit = isAdmin || isSuperadmin

  const [tickets,      setTickets]      = useState<any[]>([])
  const [activo,       setActivo]       = useState<any | null>(null)
  const [respuestas,   setRespuestas]   = useState<any[]>([])
  const [historial,    setHistorial]    = useState<any[]>([])
  const [admins,       setAdmins]       = useState<any[]>([])
  const [texto,        setTexto]        = useState('')
  const [enviando,     setEnviando]     = useState(false)
  const [modalNuevo,   setModalNuevo]   = useState(false)
  const [modalReasig,  setModalReasig]  = useState(false)
  const [form,         setForm]         = useState(FORM_INIT)
  const [motivo,       setMotivo]       = useState('')
  const [adminDest,    setAdminDest]    = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [busqueda,     setBusqueda]     = useState('')

  const cargarTickets = useCallback(async () => {
    const url = (isAdmin || isSuperadmin) ? '/api/tickets' : `/api/tickets?clienteId=${clienteId}`
    const r = await fetch(url)
    setTickets(await r.json())
  }, [isAdmin, isSuperadmin, clienteId])

  const cargarDetalle = useCallback(async (id: string) => {
    const r = await fetch(`/api/tickets?id=${id}`)
    const d = await r.json()
    setActivo(d.ticket)
    setRespuestas(d.respuestas ?? [])
    setHistorial(d.historial ?? [])
  }, [])

  useEffect(() => { cargarTickets() }, [cargarTickets])
  useEffect(() => { fetch('/api/admins').then(r => r.json()).then(setAdmins) }, [])

  async function crearTicket() {
    if (!form.asunto.trim() || !form.descripcion.trim()) return
    const r = await fetch('/api/tickets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'crear', ...form, clienteId }),
    })
    const d = await r.json()
    setModalNuevo(false); setForm(FORM_INIT)
    await cargarTickets(); await cargarDetalle(d.id)
  }

  async function responder() {
    if (!texto.trim() || !activo) return
    setEnviando(true)
    await fetch('/api/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'responder', ticketId: activo.id, contenido: texto }) })
    setTexto(''); await cargarDetalle(activo.id); await cargarTickets()
    setEnviando(false)
  }

  async function cambiarEstado(estado: string) {
    await fetch('/api/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'actualizar', ticketId: activo.id, estado }) })
    await cargarDetalle(activo.id); await cargarTickets()
  }

  async function reasignar() {
    if (!adminDest || !activo) return
    await fetch('/api/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'reasignar', ticketId: activo.id, adminId: adminDest, motivo }) })
    setModalReasig(false); setMotivo(''); setAdminDest('')
    await cargarDetalle(activo.id); await cargarTickets()
  }

  const ticketsFiltrados = tickets.filter((t: any) => {
    if (filtroEstado !== 'todos' && t.estado !== filtroEstado) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      const num = numTicket(t.numero).toLowerCase()
      if (!t.asunto?.toLowerCase().includes(q) && !t.razon_social?.toLowerCase().includes(q) && !num.includes(q)) return false
    }
    return true
  })

  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid #ddd', fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box' }
  const btn = (bg: string, color = '#fff'): React.CSSProperties => ({
    background: bg, color, border: 'none', borderRadius: 8, padding: '9px 16px',
    cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 })

  // Botones de estado para ticket activo: todos los estados manuales, excepto el actual
  const botonesEstado = ESTADOS_MANUALES.filter(e => e.key !== activo?.estado)

  return (
    <div style={{ minHeight: '100vh', background: '#f5f3ee', fontFamily: "'Josefin Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      <nav style={{ background: C.vino, padding: '0.9rem 2rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <a href="/dashboard" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem',
          fontWeight: 700, color: C.marfil, textDecoration: 'none' }}>Owl Compliance</a>
        <span style={{ color: 'rgba(231,223,202,0.3)' }}>›</span>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.15em',
          textTransform: 'uppercase', color: C.olivo }}>
          Tickets{isSuperadmin ? ' — Vista global' : ''}
        </span>
      </nav>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', height: 'calc(100vh - 52px)' }}>

        {/* ── Lista tickets ── */}
        <div style={{ background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, color: C.vino, fontSize: 15 }}>
                Tickets <span style={{ fontSize: 12, color: '#aaa', fontWeight: 400 }}>({ticketsFiltrados.length})</span>
              </span>
              {!canEdit && <button style={btn(C.bordo)} onClick={() => setModalNuevo(true)}>+ Nuevo</button>}
            </div>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por #número, asunto, cliente…"
              style={{ ...inp, padding: '7px 10px', fontSize: 12, marginBottom: 6 }} />
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
              style={{ ...inp, padding: '7px 10px', fontSize: 12 }}>
              <option value="todos">Todos los estados</option>
              {ESTADOS.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
            </select>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {ticketsFiltrados.length === 0 ? (
              <p style={{ padding: '1.5rem', color: '#aaa', fontSize: 13, textAlign: 'center' }}>No hay tickets</p>
            ) : ticketsFiltrados.map((t: any) => (
              <div key={t.id} onClick={() => cargarDetalle(t.id)}
                style={{ padding: '0.9rem 1rem', borderBottom: '1px solid #f5f5f5', cursor: 'pointer',
                  background: activo?.id === t.id ? '#fef3c7' : 'transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.olivo, flexShrink: 0 }}>
                      {numTicket(t.numero)}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 13, color: C.vino, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.asunto}</span>
                  </div>
                  {badge(t.prioridad, PRIORIDADES)}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {badge(t.tipo, TIPOS)}
                  {badge(t.estado, ESTADOS)}
                </div>
                {(isAdmin || isSuperadmin) && t.razon_social && (
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{t.razon_social}</div>
                )}
                {isSuperadmin && t.admin_nombre && (
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>Admin: {t.admin_nombre}</div>
                )}
                <div style={{ fontSize: 11, color: '#bbb', marginTop: 3 }}>
                  {new Date(t.updated_at).toLocaleDateString('es-CO')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Detalle ticket ── */}
        {activo ? (
          <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {/* Header */}
            <div style={{ padding: '1.25rem 1.5rem', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.olivo }}>{numTicket(activo.numero)}</span>
                    <h2 style={{ margin: 0, color: C.vino, fontSize: 18 }}>{activo.asunto}</h2>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {badge(activo.tipo, TIPOS)}
                    {badge(activo.prioridad, PRIORIDADES)}
                    {badge(activo.estado, ESTADOS)}
                    {activo.admin_nombre && <span style={{ fontSize: 12, color: '#666' }}>· {activo.admin_nombre}</span>}
                    {activo.razon_social && isSuperadmin && (
                      <span style={{ fontSize: 12, color: '#888' }}>· {activo.razon_social}</span>
                    )}
                  </div>
                  {activo.estado === 'cerrado' && (
                    <div style={{ fontSize: 12, color: '#dc2626', marginTop: 6, fontStyle: 'italic' }}>
                      Cerrado automáticamente por inactividad — no puede modificarse.
                    </div>
                  )}
                </div>

                {/* Botones de estado (disponibles si no está cerrado) */}
                {canEdit && activo.estado !== 'cerrado' && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {botonesEstado.map(e => (
                      <button key={e.key} style={btn(e.color + '20', e.color)} onClick={() => cambiarEstado(e.key)}>
                        {e.label}
                      </button>
                    ))}
                    <button style={btn('#f0f0f0', '#555')} onClick={() => setModalReasig(true)}>Reasignar</button>
                  </div>
                )}
              </div>
            </div>

            {/* Descripción */}
            <div style={{ padding: '1.25rem 1.5rem', background: '#fafafa', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', marginBottom: 6 }}>Descripción</div>
              <p style={{ margin: 0, fontSize: 14, color: '#333', lineHeight: 1.6 }}>{activo.descripcion}</p>
            </div>

            {/* Respuestas */}
            <div style={{ flex: 1, padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {respuestas.length === 0 && <p style={{ color: '#aaa', fontSize: 13 }}>Sin respuestas aún</p>}
              {respuestas.map((r: any) => {
                const esMio = r.user_id === userId
                return (
                  <div key={r.id} style={{ display: 'flex', justifyContent: esMio ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '75%' }}>
                      <div style={{ fontSize: 11, color: '#aaa', marginBottom: 3, textAlign: esMio ? 'right' : 'left' }}>
                        {r.autor_nombre} ({r.autor_rol}) · {new Date(r.created_at).toLocaleString('es-CO')}
                      </div>
                      <div style={{ background: esMio ? C.bordo : '#fff', color: esMio ? '#fff' : '#333',
                        padding: '10px 14px', borderRadius: esMio ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        fontSize: 14, lineHeight: 1.5, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                        {r.contenido}
                      </div>
                    </div>
                  </div>
                )
              })}

              {historial.length > 0 && (
                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, marginTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', marginBottom: 8 }}>
                    Historial de reasignaciones
                  </div>
                  {historial.map((h: any) => (
                    <div key={h.id} style={{ fontSize: 12, color: '#888', padding: '4px 0' }}>
                      {new Date(h.created_at).toLocaleDateString('es-CO')} — {h.de_nombre ?? 'Sin asignar'} → {h.a_nombre}
                      {h.motivo && <span style={{ color: '#aaa' }}> · "{h.motivo}"</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Responder (disponible mientras no esté cerrado) */}
            {activo.estado !== 'cerrado' && (
              <div style={{ padding: '1rem 1.5rem', background: '#fff', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 10 }}>
                <input value={texto} onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); responder() } }}
                  placeholder="Escribe una respuesta…" style={{ ...inp, flex: 1 }} />
                <button onClick={responder} disabled={enviando || !texto.trim()} style={btn(C.bordo)}>
                  {enviando ? '…' : 'Responder'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 14 }}>
            Selecciona un ticket
          </div>
        )}
      </div>

      {/* ── Modal nuevo ticket ── */}
      {modalNuevo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 500,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 1.5rem', color: C.vino }}>Nuevo ticket</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.vino, display: 'block', marginBottom: 4 }}>Tipo de obligación</label>
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} style={inp}>
                  {TIPOS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.vino, display: 'block', marginBottom: 4 }}>Prioridad</label>
                <select value={form.prioridad} onChange={e => setForm(f => ({ ...f, prioridad: e.target.value }))} style={inp}>
                  {PRIORIDADES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.vino, display: 'block', marginBottom: 4 }}>Asunto</label>
                <input value={form.asunto} onChange={e => setForm(f => ({ ...f, asunto: e.target.value }))}
                  style={inp} placeholder="Resumen del problema" />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.vino, display: 'block', marginBottom: 4 }}>Descripción</label>
                <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  style={{ ...inp, minHeight: 100, resize: 'vertical' }} placeholder="Explica el problema en detalle" />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button style={btn('#f0f0f0', '#333')} onClick={() => setModalNuevo(false)}>Cancelar</button>
                <button style={btn(C.bordo)} onClick={crearTicket}>Crear ticket</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal reasignar ── */}
      {modalReasig && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 400,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ margin: '0 0 1.5rem', color: C.vino, fontSize: 18 }}>Reasignar ticket</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.vino, display: 'block', marginBottom: 4 }}>Nuevo responsable</label>
                <select value={adminDest} onChange={e => setAdminDest(e.target.value)} style={inp}>
                  <option value="">Selecciona…</option>
                  {admins.filter((a: any) => a.id !== userId && a.activo).map((a: any) => (
                    <option key={a.id} value={a.id}>{a.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.vino, display: 'block', marginBottom: 4 }}>Motivo (opcional)</label>
                <input value={motivo} onChange={e => setMotivo(e.target.value)} style={inp} placeholder="¿Por qué reasignas?" />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button style={btn('#f0f0f0', '#333')} onClick={() => setModalReasig(false)}>Cancelar</button>
                <button style={btn(C.bordo)} onClick={reasignar} disabled={!adminDest}>Reasignar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
