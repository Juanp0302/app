'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

const TIPOS = [
  { key: 'financiera',  label: 'Financiera',  color: '#3b82f6' },
  { key: 'tecnica',     label: 'Técnica',     color: '#10b981' },
  { key: 'juridica',   label: 'Jurídica',    color: '#f59e0b' },
  { key: 'transversal', label: 'Transversal', color: '#8b5cf6' },
]

function tipoBadge(tipo: string) {
  const t = TIPOS.find(x => x.key === tipo)
  return t ? (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: t.color + '20', color: t.color, border: `1px solid ${t.color}40` }}>
      {t.label}
    </span>
  ) : null
}

export default function ChatClient({ userRole, userId, clienteId }: { userRole: string; userId: string; clienteId: string | null }) {
  const isAdmin = userRole === 'admin'
  const [convs,        setConvs]        = useState<any[]>([])
  const [activa,       setActiva]       = useState<any | null>(null)
  const [mensajes,     setMensajes]     = useState<any[]>([])
  const [adminInfo,    setAdminInfo]    = useState<any | null>(null)
  const [admins,       setAdmins]       = useState<any[]>([])
  const [texto,        setTexto]        = useState('')
  const [enviando,     setEnviando]     = useState(false)
  const [modalNuevo,   setModalNuevo]   = useState(false)
  const [modalReasig,  setModalReasig]  = useState(false)
  const [formNuevo,    setFormNuevo]    = useState({ tipo: 'financiera', asunto: '' })
  const [motivo,       setMotivo]       = useState('')
  const [adminDest,    setAdminDest]    = useState('')
  const mensajesRef = useRef<HTMLDivElement>(null)

  const cargarConvs = useCallback(async () => {
    const url = isAdmin ? '/api/chat' : `/api/chat?clienteId=${clienteId}`
    const r = await fetch(url)
    setConvs(await r.json())
  }, [isAdmin, clienteId])

  const cargarMensajes = useCallback(async (convId: string) => {
    const r = await fetch(`/api/chat?id=${convId}`)
    const d = await r.json()
    setMensajes(d.mensajes ?? [])
    setActiva(d.conv)
    setAdminInfo(d.adminInfo)
  }, [])

  useEffect(() => { cargarConvs() }, [cargarConvs])

  useEffect(() => {
    if (!isAdmin) {
      const r = fetch('/api/admins').then(x => x.json()).then(setAdmins)
    } else {
      fetch('/api/admins').then(x => x.json()).then(setAdmins)
    }
  }, [isAdmin])

  // Polling cada 5s cuando hay conversación activa
  useEffect(() => {
    if (!activa) return
    const id = setInterval(() => cargarMensajes(activa.id), 5000)
    return () => clearInterval(id)
  }, [activa, cargarMensajes])

  useEffect(() => {
    mensajesRef.current?.scrollTo({ top: 9999, behavior: 'smooth' })
  }, [mensajes])

  async function abrirConv(conv: any) {
    await cargarMensajes(conv.id)
  }

  async function enviar() {
    if (!texto.trim() || !activa) return
    setEnviando(true)
    await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'mensaje', conversacionId: activa.id, contenido: texto }),
    })
    setTexto('')
    await cargarMensajes(activa.id)
    setEnviando(false)
  }

  async function crearConversacion() {
    if (!formNuevo.asunto.trim()) return
    const r = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'crear_conversacion', ...formNuevo, clienteId }),
    })
    const d = await r.json()
    setModalNuevo(false)
    setFormNuevo({ tipo: 'financiera', asunto: '' })
    await cargarConvs()
    await cargarMensajes(d.id)
  }

  async function cerrarConv() {
    if (!activa) return
    await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'cerrar', conversacionId: activa.id }) })
    await cargarConvs(); await cargarMensajes(activa.id)
  }

  async function reasignar() {
    if (!adminDest || !activa) return
    await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'reasignar', conversacionId: activa.id, adminId: adminDest, motivo }) })
    setModalReasig(false); setMotivo(''); setAdminDest('')
    await cargarConvs(); await cargarMensajes(activa.id)
  }

  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box' }
  const btn = (bg: string, color = '#fff'): React.CSSProperties => ({ background: bg, color, border: 'none', borderRadius: 8, padding: '10px 18px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 })

  return (
    <div style={{ minHeight: '100vh', background: '#f5f3ee', fontFamily: "'Josefin Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      {/* Nav */}
      <nav style={{ background: C.vino, padding: '0.9rem 2rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <a href="/dashboard" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', fontWeight: 700, color: C.marfil, textDecoration: 'none' }}>Owl Compliance</a>
        <span style={{ color: 'rgba(231,223,202,0.3)' }}>›</span>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.olivo }}>Chat</span>
      </nav>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', height: 'calc(100vh - 52px)' }}>

        {/* Lista conversaciones */}
        <div style={{ background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: C.vino, fontSize: 15 }}>Conversaciones</span>
            {!isAdmin && (
              <button style={btn(C.bordo)} onClick={() => setModalNuevo(true)}>+ Nueva</button>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {convs.length === 0 ? (
              <p style={{ padding: '1.5rem', color: '#aaa', fontSize: 13, textAlign: 'center' }}>
                {isAdmin ? 'No tienes conversaciones asignadas' : 'No hay conversaciones aún'}
              </p>
            ) : convs.map((c: any) => (
              <div key={c.id} onClick={() => abrirConv(c)}
                style={{ padding: '0.9rem 1rem', borderBottom: '1px solid #f5f5f5', cursor: 'pointer', background: activa?.id === c.id ? '#fef3c7' : 'transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: C.vino }}>{c.asunto}</span>
                  <span style={{ fontSize: 10, color: '#bbb' }}>{new Date(c.updated_at).toLocaleDateString('es-CO')}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {tipoBadge(c.tipo)}
                  <span style={{ fontSize: 11, color: c.estado === 'cerrada' ? '#dc2626' : '#16a34a' }}>● {c.estado}</span>
                </div>
                {isAdmin && c.razon_social && <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>{c.razon_social}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Área de chat */}
        {activa ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '1rem 1.5rem', background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, color: C.vino, fontSize: 15 }}>{activa.asunto}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                  {tipoBadge(activa.tipo)}
                  {adminInfo && <span style={{ fontSize: 12, color: '#666' }}>Responsable: {(adminInfo as any).nombre}</span>}
                </div>
              </div>
              {isAdmin && activa.estado === 'activa' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={btn('#f0f0f0', '#555')} onClick={() => setModalReasig(true)}>Reasignar</button>
                  <button style={btn('#fee2e2', '#dc2626')} onClick={cerrarConv}>Cerrar</button>
                </div>
              )}
            </div>

            {/* Mensajes */}
            <div ref={mensajesRef} style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {mensajes.map((m: any) => {
                const esMio = m.user_id === userId
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: esMio ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '70%' }}>
                      <div style={{ fontSize: 11, color: '#aaa', marginBottom: 3, textAlign: esMio ? 'right' : 'left' }}>
                        {m.autor_nombre} · {new Date(m.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ background: esMio ? C.bordo : '#fff', color: esMio ? '#fff' : '#333', padding: '10px 14px', borderRadius: esMio ? '16px 16px 4px 16px' : '16px 16px 16px 4px', fontSize: 14, lineHeight: 1.5, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                        {m.contenido}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Input */}
            {activa.estado === 'activa' ? (
              <div style={{ padding: '1rem 1.5rem', background: '#fff', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 10 }}>
                <input value={texto} onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                  placeholder="Escribe un mensaje..." style={{ ...inp, flex: 1 }} />
                <button onClick={enviar} disabled={enviando || !texto.trim()} style={btn(C.bordo)}>
                  {enviando ? '...' : 'Enviar'}
                </button>
              </div>
            ) : (
              <div style={{ padding: '1rem', background: '#fee2e2', textAlign: 'center', fontSize: 13, color: '#dc2626' }}>
                Esta conversación está cerrada
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 14 }}>
            Selecciona una conversación
          </div>
        )}
      </div>

      {/* Modal nueva conversación */}
      {modalNuevo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ margin: '0 0 1.5rem', color: C.vino }}>Nueva conversación</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.vino, display: 'block', marginBottom: 4 }}>Tipo de obligación</label>
                <select value={formNuevo.tipo} onChange={e => setFormNuevo(f => ({ ...f, tipo: e.target.value }))} style={inp}>
                  {TIPOS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.vino, display: 'block', marginBottom: 4 }}>Asunto</label>
                <input value={formNuevo.asunto} onChange={e => setFormNuevo(f => ({ ...f, asunto: e.target.value }))} style={inp} placeholder="Describe brevemente el tema" />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button style={btn('#f0f0f0', '#333')} onClick={() => setModalNuevo(false)}>Cancelar</button>
                <button style={btn(C.bordo)} onClick={crearConversacion}>Iniciar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal reasignar */}
      {modalReasig && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ margin: '0 0 1.5rem', color: C.vino, fontSize: 18 }}>Reasignar conversación</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.vino, display: 'block', marginBottom: 4 }}>Nuevo responsable</label>
                <select value={adminDest} onChange={e => setAdminDest(e.target.value)} style={inp}>
                  <option value="">Selecciona un administrador...</option>
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
