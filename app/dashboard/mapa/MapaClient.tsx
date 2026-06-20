'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ─── Colores Owl ──────────────────────────────────────────────────────────────
const C = {
  vino:   '#270205',
  bordo:  '#712529',
  olivo:  '#968622',
  marfil: '#e7dfca',
  cream:  '#f4f0e6',
}

// ─── Colores de estado ────────────────────────────────────────────────────────
const ESTADO_CONFIG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  pendiente:   { label: 'Pendiente',   bg: 'rgba(150,134,34,0.12)',  color: '#7a6d1a', dot: '#968622' },
  en_progreso: { label: 'En progreso', bg: 'rgba(59,130,246,0.12)',  color: '#1d4ed8', dot: '#3b82f6' },
  cumplida:    { label: 'Cumplida',    bg: 'rgba(22,163,74,0.12)',   color: '#15803d', dot: '#16a34a' },
  vencida:     { label: 'Vencida',     bg: 'rgba(220,38,38,0.12)',   color: '#b91c1c', dot: '#dc2626' },
  no_aplica:   { label: 'No aplica',   bg: 'rgba(107,114,128,0.12)', color: '#4b5563', dot: '#6b7280' },
}

const ESTADOS = Object.entries(ESTADO_CONFIG).map(([value, cfg]) => ({ value, ...cfg }))

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Sub {
  obl_id:      string
  sub_titulo:  string
  periodicidad: string
  estado:      string
  fecha_limite: string | null
  normatividad: string[]
}

interface Obligacion {
  nombre:      string
  descripcion: string
  servicio:    string
  subs:        Sub[]
}

interface Grupo {
  nombre:      string
  obligaciones: Obligacion[]
}

interface Aspecto {
  nombre: string
  grupos: Grupo[]
  stats:  { total: number; cumplidas: number; vencidas: number; pendientes: number }
  pct:    number
}

interface MapaData {
  cliente:   { id: string; razon_social: string; nit: string }
  servicios: string[]
  aspectos:  Aspecto[]
  stats:     { total: number; cumplidas: number; vencidas: number; pendientes: number; pct: number }
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function MapaClient({
  userRole,
  clienteId: initialClienteId,
  clientes,
}: {
  userRole:   string
  clienteId:  string | null
  clientes:   any[]
}) {
  const router = useRouter()
  const [clienteId,    setClienteId]    = useState(initialClienteId ?? clientes[0]?.id ?? null)
  const [data,         setData]         = useState<MapaData | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [aspectoOpen,  setAspectoOpen]  = useState<Record<string, boolean>>({})
  const [grupoOpen,    setGrupoOpen]    = useState<Record<string, boolean>>({})
  const [oblOpen,      setOblOpen]      = useState<Record<string, boolean>>({})
  const [saving,       setSaving]       = useState<string | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')

  // Cargar datos del cliente seleccionado
  const cargar = useCallback(async (cid: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/obligaciones?clienteId=${cid}`)
      const json = await res.json()
      setData(json)
      // Abrir primer aspecto por defecto
      if (json.aspectos?.length > 0) {
        setAspectoOpen({ [json.aspectos[0].nombre]: true })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (clienteId) cargar(clienteId)
  }, [clienteId, cargar])

  // Cambiar estado de una subobligación
  async function cambiarEstado(oblId: string, nuevoEstado: string) {
    setSaving(oblId)
    try {
      const res = await fetch('/api/obligaciones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oblId, estado: nuevoEstado }),
      })
      if (res.ok) {
        // Actualizar localmente sin recargar toda la página
        setData(prev => {
          if (!prev) return prev
          return {
            ...prev,
            aspectos: prev.aspectos.map(asp => ({
              ...asp,
              grupos: asp.grupos.map(grp => ({
                ...grp,
                obligaciones: grp.obligaciones.map(obl => ({
                  ...obl,
                  subs: obl.subs.map(s =>
                    s.obl_id === oblId ? { ...s, estado: nuevoEstado } : s
                  ),
                })),
              })),
            })),
          }
        })
      }
    } finally {
      setSaving(null)
    }
  }

  // Toggle helpers
  const toggleAspecto = (nombre: string) =>
    setAspectoOpen(p => ({ ...p, [nombre]: !p[nombre] }))
  const toggleGrupo = (key: string) =>
    setGrupoOpen(p => ({ ...p, [key]: !p[key] }))
  const toggleObl = (key: string) =>
    setOblOpen(p => ({ ...p, [key]: !p[key] }))

  return (
    <div style={{ minHeight: '100vh', background: C.vino, fontFamily: "'Josefin Sans', sans-serif", color: C.marfil }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      {/* ── NAV ── */}
      <nav style={{ background: 'rgba(39,2,5,0.97)', borderBottom: '1px solid rgba(150,134,34,0.2)', padding: '0.9rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <a href="/dashboard" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', fontWeight: 700, color: C.marfil, textDecoration: 'none' }}>
            Owl Compliance
          </a>
          <span style={{ color: 'rgba(231,223,202,0.3)' }}>›</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.olivo }}>
            Mapa de Cumplimiento
          </span>
        </div>
        <a href="/api/auth/signout" style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.5)', textDecoration: 'none' }}>
          Salir
        </a>
      </nav>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>

        {/* ── SELECTOR DE CLIENTE (solo admin) ── */}
        {userRole === 'admin' && clientes.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.olivo, marginBottom: '0.5rem' }}>
              Cliente
            </label>
            <select
              value={clienteId ?? ''}
              onChange={e => setClienteId(e.target.value)}
              style={{ background: 'rgba(231,223,202,0.08)', border: '1px solid rgba(150,134,34,0.35)', borderRadius: '8px', padding: '0.7rem 1rem', color: C.marfil, fontSize: '0.9rem', fontFamily: 'inherit', width: '100%', maxWidth: '480px', cursor: 'pointer' }}
            >
              <option value="" disabled>Selecciona un cliente…</option>
              {clientes.map((c: any) => (
                <option key={c.id} value={c.id} style={{ background: C.vino }}>
                  {c.razon_social}{c.nit ? ` · NIT ${c.nit}` : ''} — {c.total ? Math.round((c.cumplidas/c.total)*100) : 0}% cumplimiento
                </option>
              ))}
            </select>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(231,223,202,0.4)', fontSize: '0.85rem', letterSpacing: '0.1em' }}>
            Cargando obligaciones…
          </div>
        )}

        {data && !loading && (
          <>
            {/* ── HEADER CLIENTE ── */}
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(1.4rem,2.5vw,2rem)', fontWeight: 700, marginBottom: '0.3rem' }}>
                {data.cliente.razon_social}
              </div>
              {data.cliente.nit && (
                <div style={{ fontSize: '0.72rem', color: 'rgba(231,223,202,0.5)', letterSpacing: '0.1em' }}>
                  NIT {data.cliente.nit}
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.8rem' }}>
                {data.servicios.map(s => (
                  <span key={s} style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'rgba(150,134,34,0.15)', border: '1px solid rgba(150,134,34,0.3)', color: C.olivo, padding: '0.25rem 0.7rem', borderRadius: '20px' }}>
                    {s.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>

            {/* ── RESUMEN GENERAL ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
              <StatCard label="Cumplimiento total" value={`${data.stats.pct}%`} color={pctColor(data.stats.pct)} big />
              <StatCard label="Cumplidas"  value={data.stats.cumplidas}  color="#16a34a" />
              <StatCard label="Pendientes" value={data.stats.pendientes} color="#968622" />
              <StatCard label="Vencidas"   value={data.stats.vencidas}   color="#dc2626" />
              <StatCard label="Total"      value={data.stats.total}      color="rgba(231,223,202,0.6)" />
            </div>

            {/* ── BARRAS POR ASPECTO ── */}
            <div style={{ background: 'rgba(231,223,202,0.05)', border: '1px solid rgba(150,134,34,0.2)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2.5rem' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.olivo, marginBottom: '1.2rem' }}>
                Progreso por aspecto
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {data.aspectos.map(asp => (
                  <div key={asp.nombre}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{asp.nombre}</span>
                      <span style={{ fontSize: '0.72rem', color: 'rgba(231,223,202,0.6)' }}>
                        {asp.stats.cumplidas}/{asp.stats.total} · <strong style={{ color: pctColor(asp.pct) }}>{asp.pct}%</strong>
                      </span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(231,223,202,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${asp.pct}%`, background: pctColor(asp.pct), borderRadius: '3px', transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── FILTRO DE ESTADO ── */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              {[{ value: 'todos', label: 'Todos' }, ...ESTADOS].map(e => (
                <button
                  key={e.value}
                  onClick={() => setFiltroEstado(e.value)}
                  style={{
                    fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                    padding: '0.35rem 0.9rem', borderRadius: '20px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    background: filtroEstado === e.value ? C.olivo : 'rgba(231,223,202,0.08)',
                    color: filtroEstado === e.value ? C.vino : 'rgba(231,223,202,0.6)',
                    transition: 'all 0.2s',
                  }}
                >
                  {e.label}
                </button>
              ))}
            </div>

            {/* ── MATRIZ DE OBLIGACIONES ── */}
            {data.aspectos.map(asp => {
              // Filtrar grupos/obligaciones según el filtro activo
              const gruposFiltrados = asp.grupos.map(grp => ({
                ...grp,
                obligaciones: grp.obligaciones.map(obl => ({
                  ...obl,
                  subs: filtroEstado === 'todos' ? obl.subs : obl.subs.filter(s => s.estado === filtroEstado),
                })).filter(obl => obl.subs.length > 0),
              })).filter(grp => grp.obligaciones.length > 0)

              if (gruposFiltrados.length === 0) return null

              const isOpen = !!aspectoOpen[asp.nombre]

              return (
                <div key={asp.nombre} style={{ marginBottom: '1rem', border: '1px solid rgba(150,134,34,0.25)', borderRadius: '12px', overflow: 'hidden' }}>
                  {/* Header aspecto */}
                  <button
                    onClick={() => toggleAspecto(asp.nombre)}
                    style={{ width: '100%', background: 'rgba(150,134,34,0.1)', border: 'none', cursor: 'pointer', padding: '1.1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: C.marfil, fontFamily: 'inherit' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.olivo }}>
                        {asp.nombre}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'rgba(231,223,202,0.45)' }}>
                        {asp.stats.total} obligaciones
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: pctColor(asp.pct) }}>{asp.pct}%</span>
                      <span style={{ color: 'rgba(231,223,202,0.5)', fontSize: '0.8rem', transform: isOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }}>▼</span>
                    </div>
                  </button>

                  {/* Grupos */}
                  {isOpen && gruposFiltrados.map(grp => {
                    const gKey   = `${asp.nombre}::${grp.nombre}`
                    const gOpen  = !!grupoOpen[gKey]

                    return (
                      <div key={grp.nombre} style={{ borderTop: '1px solid rgba(150,134,34,0.12)' }}>
                        {/* Header grupo */}
                        <button
                          onClick={() => toggleGrupo(gKey)}
                          style={{ width: '100%', background: 'rgba(231,223,202,0.03)', border: 'none', cursor: 'pointer', padding: '0.9rem 1.5rem 0.9rem 2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: C.marfil, fontFamily: 'inherit' }}
                        >
                          <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{grp.nombre}</span>
                          <span style={{ color: 'rgba(231,223,202,0.4)', fontSize: '0.75rem', transform: gOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }}>▼</span>
                        </button>

                        {/* Obligaciones */}
                        {gOpen && grp.obligaciones.map(obl => {
                          const oKey  = `${gKey}::${obl.nombre}`
                          const oOpen = !!oblOpen[oKey]

                          return (
                            <div key={obl.nombre} style={{ borderTop: '1px solid rgba(231,223,202,0.06)', background: 'rgba(0,0,0,0.15)' }}>
                              {/* Header obligación */}
                              <button
                                onClick={() => toggleObl(oKey)}
                                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0.8rem 1.5rem 0.8rem 3.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', color: C.marfil, fontFamily: 'inherit', textAlign: 'left', gap: '1rem' }}
                              >
                                <div>
                                  <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: obl.descripcion ? '0.25rem' : 0 }}>
                                    {obl.nombre}
                                  </div>
                                  {obl.descripcion && (
                                    <div style={{ fontSize: '0.75rem', fontWeight: 300, color: 'rgba(231,223,202,0.55)', lineHeight: 1.5 }}>
                                      {obl.descripcion}
                                    </div>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                  <span style={{ fontSize: '0.65rem', color: 'rgba(231,223,202,0.4)' }}>{obl.subs.length} sub</span>
                                  <span style={{ color: 'rgba(231,223,202,0.4)', fontSize: '0.75rem', transform: oOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }}>▼</span>
                                </div>
                              </button>

                              {/* Subobligaciones */}
                              {oOpen && (
                                <div style={{ padding: '0.5rem 1.5rem 1rem 4.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                  {obl.subs.map(sub => {
                                    const cfg = ESTADO_CONFIG[sub.estado] ?? ESTADO_CONFIG.pendiente
                                    return (
                                      <div key={sub.obl_id} style={{ background: 'rgba(231,223,202,0.04)', border: `1px solid ${cfg.dot}22`, borderLeft: `3px solid ${cfg.dot}`, borderRadius: '8px', padding: '0.9rem 1rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                                        {/* Info */}
                                        <div style={{ flex: 1 }}>
                                          <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', lineHeight: 1.4 }}>
                                            {sub.sub_titulo}
                                          </div>
                                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'rgba(150,134,34,0.15)', color: C.olivo, padding: '0.2rem 0.6rem', borderRadius: '10px' }}>
                                              {sub.periodicidad}
                                            </span>
                                            <span style={{ fontSize: '0.68rem', background: cfg.bg, color: cfg.color, padding: '0.2rem 0.6rem', borderRadius: '10px', fontWeight: 600 }}>
                                              ● {cfg.label}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Selector de estado */}
                                        <select
                                          value={sub.estado}
                                          disabled={saving === sub.obl_id}
                                          onChange={e => cambiarEstado(sub.obl_id, e.target.value)}
                                          style={{
                                            background: cfg.bg,
                                            border: `1px solid ${cfg.dot}44`,
                                            borderRadius: '8px',
                                            padding: '0.4rem 0.7rem',
                                            color: cfg.color,
                                            fontSize: '0.72rem',
                                            fontWeight: 700,
                                            fontFamily: 'inherit',
                                            cursor: 'pointer',
                                            flexShrink: 0,
                                          }}
                                        >
                                          {ESTADOS.map(e => (
                                            <option key={e.value} value={e.value}>{e.label}</option>
                                          ))}
                                        </select>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </>
        )}

        {!data && !loading && clienteId && (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(231,223,202,0.3)' }}>
            No se encontraron obligaciones para este cliente.
          </div>
        )}
      </main>
    </div>
  )
}

// ─── Helpers de UI ────────────────────────────────────────────────────────────

function pctColor(pct: number): string {
  if (pct >= 80) return '#16a34a'
  if (pct >= 50) return '#968622'
  return '#dc2626'
}

function StatCard({ label, value, color, big }: { label: string; value: any; color: string; big?: boolean }) {
  return (
    <div style={{ background: 'rgba(231,223,202,0.05)', border: '1px solid rgba(150,134,34,0.2)', borderRadius: '12px', padding: '1.2rem 1.5rem' }}>
      <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.5)', marginBottom: '0.5rem' }}>
        {label}
      </div>
      <div style={{ fontSize: big ? '2.2rem' : '1.8rem', fontWeight: 700, color, fontFamily: "'Playfair Display', serif" }}>
        {value}
      </div>
    </div>
  )
}
