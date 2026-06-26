'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

function iniciales(nombre: string) {
  return nombre.split(' ').slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('')
}

function formatHora(iso: string) {
  const d = new Date(iso)
  const hoy = new Date()
  const mismodia = d.toDateString() === hoy.toDateString()
  if (mismodia) return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

export default function MensajeriaClient({
  userId, userName, admins,
}: {
  userId:   string
  userName: string
  admins:   any[]
}) {
  const [canales,     setCanales]     = useState<{ general: any; directos: any[] } | null>(null)
  const [canalActivo, setCanalActivo] = useState<any | null>(null)
  const [mensajes,    setMensajes]    = useState<any[]>([])
  const [texto,       setTexto]       = useState('')
  const [enviando,    setEnviando]    = useState(false)
  const [cargandoMsg, setCargandoMsg] = useState(false)
  const mensajesRef = useRef<HTMLDivElement>(null)

  const cargarCanales = useCallback(async () => {
    const r = await fetch('/api/mensajeria')
    if (r.ok) setCanales(await r.json())
  }, [])

  const cargarMensajes = useCallback(async (canalId: string) => {
    const r = await fetch(`/api/mensajeria?canalId=${canalId}`)
    if (r.ok) {
      const d = await r.json()
      setMensajes(d.mensajes ?? [])
      setCanalActivo(d.canal)
    }
  }, [])

  useEffect(() => { cargarCanales() }, [cargarCanales])

  // Polling: mensajes cada 4s, lista de canales cada 10s
  useEffect(() => {
    if (!canalActivo) return
    const t1 = setInterval(() => cargarMensajes(canalActivo.id), 4000)
    const t2 = setInterval(cargarCanales, 10000)
    return () => { clearInterval(t1); clearInterval(t2) }
  }, [canalActivo, cargarMensajes, cargarCanales])

  // Scroll al último mensaje
  useEffect(() => {
    mensajesRef.current?.scrollTo({ top: 99999, behavior: 'smooth' })
  }, [mensajes])

  async function abrirCanal(canal: any) {
    setCargandoMsg(true)
    await cargarMensajes(canal.id)
    await cargarCanales()
    setCargandoMsg(false)
  }

  async function abrirDm(adminId: string) {
    const r = await fetch('/api/mensajeria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'abrir_dm', adminId }),
    })
    if (!r.ok) return
    const { canalId } = await r.json()
    await cargarCanales()
    setCargandoMsg(true)
    const r2 = await fetch(`/api/mensajeria?canalId=${canalId}`)
    if (r2.ok) {
      const d = await r2.json()
      setMensajes(d.mensajes ?? [])
      setCanalActivo(d.canal)
    }
    setCargandoMsg(false)
  }

  async function enviar() {
    if (!texto.trim() || !canalActivo || enviando) return
    setEnviando(true)
    const contenido = texto.trim()
    setTexto('')
    // Optimistic
    const temp = { id: 'tmp', canal_id: canalActivo.id, user_id: userId, contenido, autor_nombre: userName, created_at: new Date().toISOString() }
    setMensajes(prev => [...prev, temp])
    try {
      await fetch('/api/mensajeria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'mensaje', canalId: canalActivo.id, contenido }),
      })
      await cargarMensajes(canalActivo.id)
    } finally {
      setEnviando(false)
    }
  }

  function nombreCanal(c: any) {
    if (c.tipo === 'general') return 'General'
    const otro = c.admin_a_id === userId
      ? (c.nombre_b ?? c.email_b ?? '—')
      : (c.nombre_a ?? c.email_a ?? '—')
    return otro
  }

  function inicialesCanal(c: any) {
    if (c.tipo === 'general') return '★'
    return iniciales(nombreCanal(c))
  }

  const todosLosAdminsConDm = new Set([
    ...(canales?.directos ?? []).map((d: any) => d.admin_a_id === userId ? d.admin_b_id : d.admin_a_id),
  ])

  return (
    <div style={{ minHeight: '100vh', background: C.vino, fontFamily: "'Josefin Sans', sans-serif", color: C.marfil, display: 'flex', flexDirection: 'column' }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      {/* Nav */}
      <nav style={{ background: 'rgba(39,2,5,0.97)', borderBottom: '1px solid rgba(150,134,34,0.2)', padding: '0.9rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <a href="/dashboard" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', fontWeight: 700, color: C.marfil, textDecoration: 'none' }}>Owl Compliance</a>
          <span style={{ color: 'rgba(231,223,202,0.3)' }}>›</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.olivo }}>Mensajería interna</span>
        </div>
        <a href="/signout" style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.5)', textDecoration: 'none' }}>Salir</a>
      </nav>

      {/* Layout principal */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr', overflow: 'hidden', height: 'calc(100vh - 57px)' }}>

        {/* ── SIDEBAR ── */}
        <div style={{ background: 'rgba(0,0,0,0.25)', borderRight: '1px solid rgba(150,134,34,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Canal general */}
          <div style={{ padding: '1rem 1rem 0.5rem', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.35)' }}>
            Canales
          </div>
          {canales?.general && (
            <button
              onClick={() => abrirCanal(canales.general)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1rem',
                background: canalActivo?.id === canales.general.id ? 'rgba(150,134,34,0.18)' : 'transparent',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
                borderLeft: canalActivo?.id === canales.general.id ? `3px solid ${C.olivo}` : '3px solid transparent',
              }}
            >
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(150,134,34,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', flexShrink: 0, color: C.olivo }}>★</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: C.marfil }}>General</div>
                <div style={{ fontSize: '0.65rem', color: 'rgba(231,223,202,0.4)' }}>Todos los administradores</div>
              </div>
              {(canales.general.no_leidos ?? 0) > 0 && (
                <span style={{ background: C.olivo, color: C.vino, borderRadius: '50%', width: 18, height: 18, fontSize: '0.62rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {canales.general.no_leidos}
                </span>
              )}
            </button>
          )}

          {/* Mensajes directos */}
          <div style={{ padding: '1rem 1rem 0.5rem', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.35)', marginTop: '0.5rem' }}>
            Mensajes directos
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {(canales?.directos ?? []).map((dm: any) => {
              const nombre = nombreCanal(dm)
              const noLeidos = dm.no_leidos ?? 0
              return (
                <button key={dm.id} onClick={() => abrirCanal(dm)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 1rem',
                    background: canalActivo?.id === dm.id ? 'rgba(150,134,34,0.18)' : 'transparent',
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
                    borderLeft: canalActivo?.id === dm.id ? `3px solid ${C.olivo}` : '3px solid transparent',
                  }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(113,37,41,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0, color: C.marfil }}>
                    {iniciales(nombre)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: noLeidos > 0 ? 700 : 400, color: C.marfil, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</div>
                  </div>
                  {noLeidos > 0 && (
                    <span style={{ background: C.olivo, color: C.vino, borderRadius: '50%', width: 18, height: 18, fontSize: '0.62rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {noLeidos}
                    </span>
                  )}
                </button>
              )
            })}

            {/* Admins sin DM abierto */}
            {admins.filter(a => !todosLosAdminsConDm.has(a.id)).map(a => (
              <button key={a.id} onClick={() => abrirDm(a.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 1rem',
                  background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
                  borderLeft: '3px solid transparent', opacity: 0.6,
                }}
              >
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(231,223,202,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0, color: 'rgba(231,223,202,0.5)' }}>
                  {iniciales(a.nombre)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', color: 'rgba(231,223,202,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nombre}</div>
                </div>
                <span style={{ fontSize: '0.6rem', color: 'rgba(231,223,202,0.3)' }}>+</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── ÁREA DE CHAT ── */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!canalActivo ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: 'rgba(231,223,202,0.3)' }}>
              <div style={{ fontSize: '2rem' }}>💬</div>
              <div style={{ fontSize: '0.85rem' }}>Selecciona un canal o inicia un mensaje directo</div>
            </div>
          ) : (
            <>
              {/* Header del canal */}
              <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(150,134,34,0.15)', background: 'rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: canalActivo.tipo === 'general' ? 'rgba(150,134,34,0.25)' : 'rgba(113,37,41,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: 700, color: canalActivo.tipo === 'general' ? C.olivo : C.marfil }}>
                  {inicialesCanal(canalActivo)}
                </div>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{canalActivo.tipo === 'general' ? 'Canal General' : nombreCanal(canalActivo)}</div>
                  <div style={{ fontSize: '0.65rem', color: 'rgba(231,223,202,0.4)' }}>
                    {canalActivo.tipo === 'general' ? `${admins.length + 1} administradores` : 'Mensaje directo'}
                  </div>
                </div>
              </div>

              {/* Mensajes */}
              <div ref={mensajesRef} style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {cargandoMsg && (
                  <div style={{ textAlign: 'center', color: 'rgba(231,223,202,0.3)', fontSize: '0.8rem', padding: '2rem' }}>Cargando…</div>
                )}
                {!cargandoMsg && mensajes.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'rgba(231,223,202,0.25)', fontSize: '0.8rem', padding: '3rem' }}>
                    No hay mensajes aún. ¡Sé el primero en escribir!
                  </div>
                )}
                {mensajes.map((m, i) => {
                  const esMio = m.user_id === userId
                  const prev  = mensajes[i - 1]
                  const mismoAutor = prev && prev.user_id === m.user_id
                  return (
                    <div key={m.id} style={{ display: 'flex', flexDirection: esMio ? 'row-reverse' : 'row', gap: '0.6rem', alignItems: 'flex-end', marginTop: mismoAutor ? '0.15rem' : '0.8rem' }}>
                      {/* Avatar */}
                      {!esMio && (
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(113,37,41,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0, opacity: mismoAutor ? 0 : 1 }}>
                          {iniciales(m.autor_nombre ?? '')}
                        </div>
                      )}
                      <div style={{ maxWidth: '68%' }}>
                        {!esMio && !mismoAutor && (
                          <div style={{ fontSize: '0.62rem', fontWeight: 700, color: C.olivo, marginBottom: '0.2rem', paddingLeft: '0.2rem' }}>
                            {m.autor_nombre}
                          </div>
                        )}
                        <div style={{
                          background: esMio ? 'rgba(150,134,34,0.22)' : 'rgba(231,223,202,0.07)',
                          border: `1px solid ${esMio ? 'rgba(150,134,34,0.3)' : 'rgba(231,223,202,0.1)'}`,
                          borderRadius: esMio ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                          padding: '0.55rem 0.85rem',
                          fontSize: '0.85rem',
                          lineHeight: 1.5,
                          wordBreak: 'break-word',
                        }}>
                          {m.contenido}
                        </div>
                        <div style={{ fontSize: '0.58rem', color: 'rgba(231,223,202,0.3)', marginTop: '0.2rem', textAlign: esMio ? 'right' : 'left', paddingLeft: esMio ? 0 : '0.2rem', paddingRight: esMio ? '0.2rem' : 0 }}>
                          {formatHora(m.created_at)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Input */}
              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(150,134,34,0.15)', background: 'rgba(0,0,0,0.1)', flexShrink: 0 }}>
                <form onSubmit={e => { e.preventDefault(); enviar() }} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                  <textarea
                    value={texto}
                    onChange={e => setTexto(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                    placeholder={`Escribe un mensaje en ${canalActivo.tipo === 'general' ? 'General' : nombreCanal(canalActivo)}…`}
                    rows={1}
                    style={{
                      flex: 1, background: 'rgba(231,223,202,0.07)', border: '1px solid rgba(150,134,34,0.3)',
                      borderRadius: '10px', padding: '0.65rem 1rem', color: C.marfil, fontSize: '0.88rem',
                      fontFamily: 'inherit', outline: 'none', resize: 'none', lineHeight: 1.5,
                    }}
                  />
                  <button type="submit" disabled={!texto.trim() || enviando}
                    style={{
                      background: texto.trim() ? C.olivo : 'rgba(150,134,34,0.2)',
                      color: texto.trim() ? C.vino : 'rgba(231,223,202,0.3)',
                      border: 'none', borderRadius: '10px', padding: '0.65rem 1.1rem',
                      fontSize: '0.85rem', fontWeight: 700, cursor: texto.trim() ? 'pointer' : 'default',
                      fontFamily: 'inherit', transition: 'all 0.15s', flexShrink: 0,
                    }}>
                    Enviar
                  </button>
                </form>
                <div style={{ fontSize: '0.6rem', color: 'rgba(231,223,202,0.25)', marginTop: '0.4rem', paddingLeft: '0.2rem' }}>
                  Enter para enviar · Shift+Enter para nueva línea
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
