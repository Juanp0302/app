'use client'

import { useEffect, useState } from 'react'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

const TIPO_COLOR: Record<string, string> = {
  financiera: '#3b82f6', tecnica: '#10b981', juridica: '#f59e0b', transversal: '#8b5cf6',
}
const PRIORIDAD_COLOR: Record<string, string> = {
  baja: '#6b7280', normal: '#3b82f6', alta: '#f59e0b', urgente: '#dc2626',
}
const ESTADO_COLOR: Record<string, string> = {
  abierto: '#3b82f6', en_progreso: '#f59e0b', resuelto: '#16a34a', cerrado: '#6b7280',
}

function numTicket(n: any) {
  if (!n && n !== 0) return '—'
  return `#${String(n).padStart(4, '0')}`
}

function formatHoras(h: number | null | undefined): string {
  if (h === null || h === undefined || isNaN(Number(h))) return '—'
  const n = Number(h)
  if (n < 1/60) return '< 1 min'
  if (n < 1)    return `${Math.round(n * 60)} min`
  if (n < 24)   return `${Math.round(n)} h`
  return `${(n / 24).toFixed(1)} días`
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: 'rgba(231,223,202,0.06)', border: '1px solid rgba(150,134,34,0.2)',
      borderRadius: 10, padding: '0.9rem 1.1rem', minWidth: 90, textAlign: 'center' }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: color ?? C.olivo }}>{value}</div>
      <div style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'rgba(231,223,202,0.45)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

export default function SuperadminClient() {
  const [data,       setData]       = useState<any>(null)
  const [loading,    setLoading]    = useState(true)
  const [asignando,  setAsignando]  = useState<string | null>(null)
  const [selAdmin,   setSelAdmin]   = useState<Record<string, string>>({})
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  async function cargar() {
    const d = await fetch('/api/superadmin').then(r => r.json())
    setData(d)
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  async function reasignar(tipo: string, id: string) {
    const adminId = selAdmin[id]
    if (!adminId) return
    setAsignando(id)
    try {
      await fetch('/api/superadmin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, id, adminId }),
      })
      await cargar()
      setSelAdmin(s => { const n = { ...s }; delete n[id]; return n })
    } finally {
      setAsignando(null)
    }
  }

  function SelectorAdmin({ tipo, id }: { tipo: string; id: string }) {
    const admins: any[] = data?.porAdmin ?? []
    const busy = asignando === id
    return (
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
        <select
          value={selAdmin[id] ?? ''}
          onChange={e => setSelAdmin(s => ({ ...s, [id]: e.target.value }))}
          disabled={busy}
          style={{ background: 'rgba(231,223,202,0.07)', border: '1px solid rgba(150,134,34,0.35)',
            borderRadius: 6, padding: '0.25rem 0.5rem', color: C.marfil, fontSize: '0.72rem',
            fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}
        >
          <option value=''>— Asignar a… —</option>
          {admins.map((a: any) => (
            <option key={a.id} value={a.id}>{a.nombre}</option>
          ))}
        </select>
        <button
          onClick={() => reasignar(tipo, id)}
          disabled={!selAdmin[id] || busy}
          style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            background: selAdmin[id] ? 'rgba(150,134,34,0.2)' : 'rgba(150,134,34,0.06)',
            color: selAdmin[id] ? C.olivo : 'rgba(150,134,34,0.35)',
            border: '1px solid rgba(150,134,34,0.3)', borderRadius: 6,
            padding: '0.25rem 0.7rem', cursor: selAdmin[id] ? 'pointer' : 'default',
            fontFamily: 'inherit', whiteSpace: 'nowrap' }}
        >
          {busy ? '…' : 'Asignar'}
        </button>
      </div>
    )
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.vino, display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: 'rgba(231,223,202,0.4)', fontFamily: "'Josefin Sans', sans-serif" }}>
      Cargando vista global…
    </div>
  )

  const { porAdmin = [], sinAsignar = [], chatsSinAsignar = [], docsSinAsignar = [], urgentes = [] } = data ?? {}
  const totalSinAsignar = sinAsignar.length + chatsSinAsignar.length + docsSinAsignar.length

  return (
    <div style={{ minHeight: '100vh', background: C.vino, fontFamily: "'Josefin Sans', sans-serif", color: C.marfil }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      {/* Nav */}
      <nav style={{ background: 'rgba(39,2,5,0.97)', borderBottom: '1px solid rgba(150,134,34,0.2)',
        padding: '0.9rem 2rem', display: 'flex', alignItems: 'center', gap: '1.5rem',
        position: 'sticky', top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem',
          fontWeight: 700, color: C.marfil, textDecoration: 'none' }}>Owl Compliance</a>
        <span style={{ color: 'rgba(231,223,202,0.3)' }}>›</span>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.15em',
          textTransform: 'uppercase', color: C.olivo }}>Vista Global — Super Administrador</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <a href="/dashboard/superadmin/asignacion" style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: C.olivo, textDecoration: 'none',
            border: `1px solid ${C.olivo}`, borderRadius: 6, padding: '0.3rem 0.8rem',
            background: 'rgba(150,134,34,0.08)' }}>
            Reglas de asignación
          </a>
          <a href="/dashboard/chat" style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: C.marfil, textDecoration: 'none',
            border: `1px solid rgba(231,223,202,0.3)`, borderRadius: 6, padding: '0.3rem 0.8rem' }}>
            Chats
          </a>
          <a href="/dashboard/tickets" style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: C.olivo, textDecoration: 'none',
            border: `1px solid ${C.olivo}`, borderRadius: 6, padding: '0.3rem 0.8rem' }}>
            Tickets
          </a>
          <a href="/api/superadmin/exportar?tipo=clientes" download style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: '#34d399', textDecoration: 'none',
            border: '1px solid rgba(52,211,153,0.4)', borderRadius: 6, padding: '0.3rem 0.8rem',
            background: 'rgba(52,211,153,0.08)' }}>
            Exportar clientes
          </a>
          <a href="/api/superadmin/exportar?tipo=admins" download style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: '#60a5fa', textDecoration: 'none',
            border: '1px solid rgba(96,165,250,0.4)', borderRadius: 6, padding: '0.3rem 0.8rem',
            background: 'rgba(96,165,250,0.08)' }}>
            Exportar admins
          </a>
          <a href="/signout" style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.15em',
            textTransform: 'uppercase', color: 'rgba(231,223,202,0.5)', textDecoration: 'none' }}>
            Salir
          </a>
        </div>
      </nav>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>

        {/* Título */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '2.5rem' }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(1.4rem,2.5vw,1.9rem)',
              fontWeight: 700, marginBottom: '0.3rem' }}>Vista General de Operaciones</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase',
              color: C.olivo }}>Tickets, chats y documentos por administrador</div>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <a href="/api/superadmin/exportar?tipo=clientes" download
              style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: '#34d399', textDecoration: 'none', border: '1px solid rgba(52,211,153,0.35)',
                borderRadius: 8, padding: '0.5rem 1rem', background: 'rgba(52,211,153,0.08)' }}>
              Exportar estadísticas clientes (CSV)
            </a>
            <a href="/api/superadmin/exportar?tipo=admins" download
              style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: '#60a5fa', textDecoration: 'none', border: '1px solid rgba(96,165,250,0.35)',
                borderRadius: 8, padding: '0.5rem 1rem', background: 'rgba(96,165,250,0.08)' }}>
              Exportar estadísticas admins (CSV)
            </a>
          </div>
        </div>

        {/* Alertas: urgentes */}
        {urgentes.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: '#dc2626', marginBottom: '0.8rem' }}>
              Tickets urgentes activos ({urgentes.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {urgentes.map((t: any) => (
                <div key={t.id} style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)',
                  borderRadius: 10, padding: '0.75rem 1.1rem', display: 'flex', alignItems: 'center',
                  gap: '1rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>{numTicket(t.numero)}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{t.asunto}</span>
                  <span style={{ fontSize: 11, color: 'rgba(231,223,202,0.5)' }}>{t.razon_social}</span>
                  <span style={{ fontSize: 11, color: C.olivo }}>{t.admin_nombre ?? 'Sin asignar'}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10,
                    background: (ESTADO_COLOR[t.estado] ?? '#888') + '20',
                    color: ESTADO_COLOR[t.estado] ?? '#888',
                    border: `1px solid ${(ESTADO_COLOR[t.estado] ?? '#888')}40` }}>
                    {t.estado.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sin asignar */}
        {totalSinAsignar > 0 && (
          <div style={{ marginBottom: '2rem', background: 'rgba(245,158,11,0.04)',
            border: '1px solid rgba(245,158,11,0.15)', borderRadius: 12, padding: '1.25rem 1.5rem' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: '#f59e0b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              ⚠ Sin asignar
              <span style={{ background: 'rgba(245,158,11,0.15)', padding: '1px 10px', borderRadius: 20, fontSize: '0.6rem' }}>
                {totalSinAsignar}
              </span>
            </div>

            {/* Tickets */}
            {sinAsignar.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
                  color: 'rgba(231,223,202,0.4)', marginBottom: '0.5rem' }}>Tickets ({sinAsignar.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {sinAsignar.map((t: any) => (
                    <div key={t.id} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '0.65rem 1rem',
                      display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.olivo }}>{numTicket(t.numero)}</span>
                      <span style={{ fontSize: 13, flex: 1 }}>{t.asunto}</span>
                      <span style={{ fontSize: 11, color: 'rgba(231,223,202,0.45)' }}>{t.razon_social}</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10,
                        background: (PRIORIDAD_COLOR[t.prioridad] ?? '#888') + '20',
                        color: PRIORIDAD_COLOR[t.prioridad] ?? '#888' }}>{t.prioridad}</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10,
                        background: (TIPO_COLOR[t.tipo] ?? '#888') + '20',
                        color: TIPO_COLOR[t.tipo] ?? '#888' }}>{t.tipo}</span>
                      <SelectorAdmin tipo="ticket" id={t.id} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chats */}
            {chatsSinAsignar.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
                  color: 'rgba(231,223,202,0.4)', marginBottom: '0.5rem' }}>Chats ({chatsSinAsignar.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {chatsSinAsignar.map((cv: any) => (
                    <div key={cv.id} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '0.65rem 1rem',
                      display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, flex: 1 }}>Chat {cv.tipo}</span>
                      <span style={{ fontSize: 11, color: 'rgba(231,223,202,0.45)' }}>{cv.razon_social}</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10,
                        background: (TIPO_COLOR[cv.tipo] ?? '#888') + '20',
                        color: TIPO_COLOR[cv.tipo] ?? '#888' }}>{cv.tipo}</span>
                      <SelectorAdmin tipo="chat" id={cv.id} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Documentos */}
            {docsSinAsignar.length > 0 && (
              <div>
                <div style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
                  color: 'rgba(231,223,202,0.4)', marginBottom: '0.5rem' }}>Documentos pendientes de revisión ({docsSinAsignar.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {docsSinAsignar.map((d: any) => (
                    <div key={d.id} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '0.65rem 1rem',
                      display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, flex: 1 }}>{d.nombre_archivo}</span>
                      <span style={{ fontSize: 11, color: 'rgba(231,223,202,0.45)' }}>{d.razon_social}</span>
                      {d.aspecto && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10,
                        background: (TIPO_COLOR[d.aspecto?.toLowerCase()] ?? '#888') + '20',
                        color: TIPO_COLOR[d.aspecto?.toLowerCase()] ?? 'rgba(231,223,202,0.5)' }}>{d.aspecto}</span>}
                      <SelectorAdmin tipo="documento" id={d.id} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Por administrador */}
        <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
          color: C.olivo, marginBottom: '1rem' }}>
          Por administrador ({porAdmin.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {porAdmin.map((a: any) => (
            <div key={a.id} style={{ background: 'rgba(231,223,202,0.04)', border: '1px solid rgba(150,134,34,0.2)',
              borderRadius: 14, padding: '1.25rem 1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: C.marfil }}>{a.nombre}</div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(231,223,202,0.45)', marginTop: 2 }}>{a.email}</div>
                </div>
                <a href="/dashboard/tickets" style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: C.olivo, textDecoration: 'none',
                  border: `1px solid rgba(150,134,34,0.4)`, borderRadius: 6, padding: '0.3rem 0.8rem' }}>
                  Ver tickets →
                </a>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: 'rgba(231,223,202,0.4)', marginBottom: '0.6rem' }}>
                    Tickets
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <StatCard label="Total"       value={a.tickets.total}       />
                    <StatCard label="Abiertos"    value={a.tickets.abiertos}    color="#3b82f6" />
                    <StatCard label="En progreso" value={a.tickets.en_progreso} color="#f59e0b" />
                    <StatCard label="Resueltos"   value={a.tickets.resueltos}   color="#16a34a" />
                    <StatCard label="Cerrados"    value={a.tickets.cerrados}    color="#6b7280" />
                    {a.tickets.urgentes > 0 && (
                      <StatCard label="Urgentes" value={a.tickets.urgentes} color="#dc2626" />
                    )}
                    <div style={{ background: 'rgba(231,223,202,0.06)', border: '1px solid rgba(150,134,34,0.2)',
                      borderRadius: 10, padding: '0.9rem 1.1rem', minWidth: 90, textAlign: 'center' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: a.tickets.avg_horas_respuesta === null ? '#6b7280' : '#f59e0b' }}>
                        {formatHoras(a.tickets.avg_horas_respuesta)}
                      </div>
                      <div style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: 'rgba(231,223,202,0.45)', marginTop: 2 }}>Resp. promedio</div>
                    </div>
                  </div>
                </div>

                <div style={{ minWidth: 200 }}>
                  <div style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: 'rgba(231,223,202,0.4)', marginBottom: '0.6rem' }}>
                    Chats
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <StatCard label="Total"    value={a.chats.total}   />
                    <StatCard label="Activos"  value={a.chats.activas}  color="#3b82f6" />
                    <StatCard label="Cerrados" value={a.chats.cerradas} color="#6b7280" />
                    <div style={{ background: 'rgba(231,223,202,0.06)', border: '1px solid rgba(150,134,34,0.2)',
                      borderRadius: 10, padding: '0.9rem 1.1rem', minWidth: 90, textAlign: 'center' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: a.chats.avg_horas_respuesta === null ? '#6b7280' : '#f59e0b' }}>
                        {formatHoras(a.chats.avg_horas_respuesta)}
                      </div>
                      <div style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: 'rgba(231,223,202,0.45)', marginTop: 2 }}>Resp. promedio</div>
                    </div>
                  </div>
                </div>

                {/* Documentos */}
                <div style={{ minWidth: 200 }}>
                  <div style={{ fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: 'rgba(231,223,202,0.4)', marginBottom: '0.6rem' }}>
                    Documentos
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <StatCard label="Pendientes" value={a.documentos?.pendientes ?? 0} color={a.documentos?.pendientes > 0 ? '#f59e0b' : undefined} />
                    <StatCard label="Revisados"  value={a.documentos?.revisados  ?? 0} />
                    <StatCard label="Aprobados"  value={a.documentos?.aprobados  ?? 0} color="#16a34a" />
                    <StatCard label="Rechazados" value={a.documentos?.rechazados ?? 0} color={a.documentos?.rechazados > 0 ? '#dc2626' : undefined} />
                  </div>
                </div>
              </div>

              {/* Botón expandir tickets/chats activos */}
              {(a.ticketsActivos?.length > 0 || a.chatsActivos?.length > 0) && (
                <div style={{ borderTop: '1px solid rgba(150,134,34,0.12)', marginTop: '1rem', paddingTop: '0.85rem' }}>
                  <button
                    onClick={() => setExpandidos(s => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n })}
                    style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                      background: 'none', border: '1px solid rgba(150,134,34,0.3)', borderRadius: 6,
                      color: C.olivo, padding: '0.3rem 0.85rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {expandidos.has(a.id) ? '▲ Ocultar' : '▼ Ver y reasignar'} tickets y chats activos
                    ({(a.ticketsActivos?.length ?? 0) + (a.chatsActivos?.length ?? 0)})
                  </button>

                  {expandidos.has(a.id) && (
                    <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>

                      {/* Tickets activos */}
                      {a.ticketsActivos?.length > 0 && (
                        <>
                          <div style={{ fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
                            color: 'rgba(231,223,202,0.35)', marginBottom: '0.2rem' }}>Tickets activos</div>
                          {a.ticketsActivos.map((t: any) => (
                            <div key={t.id} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8,
                              padding: '0.6rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: C.olivo }}>{numTicket(t.numero)}</span>
                              <span style={{ fontSize: 12, flex: 1 }}>{t.asunto}</span>
                              <span style={{ fontSize: 10, color: 'rgba(231,223,202,0.4)' }}>{t.razon_social}</span>
                              <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10,
                                background: (PRIORIDAD_COLOR[t.prioridad] ?? '#888') + '20',
                                color: PRIORIDAD_COLOR[t.prioridad] ?? '#888' }}>{t.prioridad}</span>
                              <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10,
                                background: (ESTADO_COLOR[t.estado] ?? '#888') + '20',
                                color: ESTADO_COLOR[t.estado] ?? '#888' }}>{t.estado.replace('_',' ')}</span>
                              <SelectorAdmin tipo="ticket" id={t.id} />
                            </div>
                          ))}
                        </>
                      )}

                      {/* Chats activos */}
                      {a.chatsActivos?.length > 0 && (
                        <>
                          <div style={{ fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
                            color: 'rgba(231,223,202,0.35)', margin: '0.4rem 0 0.2rem' }}>Chats activos</div>
                          {a.chatsActivos.map((cv: any) => (
                            <div key={cv.id} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8,
                              padding: '0.6rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 12, flex: 1 }}>{cv.asunto || `Chat ${cv.tipo}`}</span>
                              <span style={{ fontSize: 10, color: 'rgba(231,223,202,0.4)' }}>{cv.razon_social}</span>
                              <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10,
                                background: (TIPO_COLOR[cv.tipo] ?? '#888') + '20',
                                color: TIPO_COLOR[cv.tipo] ?? '#888' }}>{cv.tipo}</span>
                              <SelectorAdmin tipo="chat" id={cv.id} />
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {porAdmin.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(231,223,202,0.3)', fontSize: '0.85rem' }}>
              No hay administradores configurados.
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
