'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import DonutChart from '@/components/DonutChart'

// ─── Colores ─────────────────────────────────────────────────────────────────
const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

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
  obl_id:       string
  sub_titulo:   string
  periodicidad: string
  estado:       string
  fecha_limite: string | null
  normatividad: string[]
}
interface Obligacion { nombre: string; descripcion: string; servicio: string; subs: Sub[] }
interface Grupo      { nombre: string; obligaciones: Obligacion[] }
interface Aspecto    { nombre: string; grupos: Grupo[]; stats: { total: number; cumplidas: number; vencidas: number; pendientes: number }; pct: number }
interface MapaData   { cliente: { id: string; razon_social: string; nit: string }; servicios: string[]; aspectos: Aspecto[]; stats: { total: number; cumplidas: number; vencidas: number; pendientes: number; pct: number } }

interface DocInfo { id: string; nombre_archivo: string; uploaded_at: string; subido_por: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function pctColor(pct: number) { return pct >= 80 ? '#16a34a' : pct >= 50 ? '#968622' : '#dc2626' }

function necesitaTrimestre(periodicidad: string) {
  const p = periodicidad?.toUpperCase() ?? ''
  return p === 'TRIMESTRAL' || p === 'SEMESTRAL' || p === 'MENSUAL' || p === 'PERIÓDICO'
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function MapaClient({
  userRole, clienteId: initialClienteId, clientes,
}: {
  userRole: string; clienteId: string | null; clientes: any[]
}) {
  const [clienteId,    setClienteId]    = useState(initialClienteId ?? clientes[0]?.id ?? null)
  const [data,         setData]         = useState<MapaData | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [aspectoOpen,  setAspectoOpen]  = useState<Record<string, boolean>>({})
  const [grupoOpen,    setGrupoOpen]    = useState<Record<string, boolean>>({})
  const [oblOpen,      setOblOpen]      = useState<Record<string, boolean>>({})
  const [saving,       setSaving]       = useState<string | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')

  // ── Documentos por subobligación ──────────────────────────────────────────
  const [docs, setDocs] = useState<Record<string, DocInfo[]>>({})

  // ── Panel de subida ───────────────────────────────────────────────────────
  const [uploadPanel, setUploadPanel] = useState<{
    oblId: string; aspecto: string; obligacion: string; periodicidad: string
  } | null>(null)
  const [uploadAnio,      setUploadAnio]      = useState(new Date().getFullYear())
  const [uploadTrimestre, setUploadTrimestre] = useState<number | string>('')
  const [uploading,       setUploading]       = useState(false)
  const [uploadError,     setUploadError]     = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Panel de descarga ─────────────────────────────────────────────────────
  const [descPanel,       setDescPanel]       = useState(false)
  const [descAnio,        setDescAnio]        = useState(new Date().getFullYear())
  const [descTrimestre,   setDescTrimestre]   = useState<number | string>(1)
  const [descModo,        setDescModo]        = useState<'todo' | 'seleccionar'>('todo')
  const [seleccion,       setSeleccion]       = useState<Set<string>>(new Set())
  const [descargando,     setDescargando]     = useState(false)

  // ── Carga de datos ────────────────────────────────────────────────────────
  const cargarDocs = useCallback(async (cid: string) => {
    try {
      const res  = await fetch(`/api/documentos?clienteId=${cid}`)
      const json = await res.json()
      const idx: Record<string, DocInfo[]> = {}
      for (const grupo of (json.grupos ?? [])) {
        for (const arch of (grupo.archivos ?? [])) {
          if (!arch.cliente_obl_id) continue
          if (!idx[arch.cliente_obl_id]) idx[arch.cliente_obl_id] = []
          idx[arch.cliente_obl_id].push(arch)
        }
      }
      setDocs(idx)
    } catch {}
  }, [])

  const cargar = useCallback(async (cid: string) => {
    setLoading(true)
    setDocs({})
    try {
      const res  = await fetch(`/api/obligaciones?clienteId=${cid}`)
      const json = await res.json()
      setData(json)
      if (json.aspectos?.length > 0) setAspectoOpen({ [json.aspectos[0].nombre]: true })
    } finally {
      setLoading(false)
    }
    cargarDocs(cid)
  }, [cargarDocs])

  useEffect(() => { if (clienteId) cargar(clienteId) }, [clienteId, cargar])

  // ── Cambiar estado ────────────────────────────────────────────────────────
  async function cambiarEstado(oblId: string, nuevoEstado: string) {
    setSaving(oblId)
    try {
      const res = await fetch('/api/obligaciones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oblId, estado: nuevoEstado }),
      })
      if (res.ok) {
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
                  subs: obl.subs.map(s => s.obl_id === oblId ? { ...s, estado: nuevoEstado } : s),
                })),
              })),
            })),
          }
        })
      }
    } finally { setSaving(null) }
  }

  // ── Subir documento ───────────────────────────────────────────────────────
  async function subirDocumento(file: File) {
    if (!uploadPanel || !clienteId) return
    setUploading(true); setUploadError('')
    try {
      const form = new FormData()
      form.append('clienteId',   clienteId)
      form.append('clienteOblId', uploadPanel.oblId)
      form.append('aspecto',     uploadPanel.aspecto)
      form.append('obligacion',  uploadPanel.obligacion)
      form.append('anio',        String(uploadAnio))
      if (uploadTrimestre) form.append('trimestre', String(uploadTrimestre))
      form.append('archivo', file)

      const res = await fetch('/api/documentos', { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json()
        setUploadError(err.error ?? 'Error al subir el archivo')
        return
      }
      // Recargar docs y cerrar panel
      await cargarDocs(clienteId)
      setUploadPanel(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } finally { setUploading(false) }
  }

  // ── Descargar ZIP ─────────────────────────────────────────────────────────
  async function descargar() {
    if (!clienteId) return
    setDescargando(true)
    try {
      let url = `/api/documentos/zip?clienteId=${clienteId}&anio=${descAnio}`
      if (descTrimestre) url += `&trimestre=${descTrimestre}`

      if (descModo === 'seleccionar' && seleccion.size > 0) {
        const ids = Array.from(seleccion).join(',')
        url += `&oblIds=${encodeURIComponent(ids)}`
      }

      const res = await fetch(url)
      if (!res.ok) { alert((await res.json()).error ?? 'Sin documentos para este período'); return }
      const blob = await res.blob()
      const a    = document.createElement('a')
      a.href     = URL.createObjectURL(blob)
      a.download = res.headers.get('Content-Disposition')?.split('filename="')[1]?.replace('"','') ?? 'documentos.zip'
      a.click()
    } finally { setDescargando(false) }
  }

  function toggleSeleccion(oblId: string) {
    setSeleccion(prev => {
      const next = new Set(prev)
      next.has(oblId) ? next.delete(oblId) : next.add(oblId)
      return next
    })
  }

  // ── Stats en vivo ─────────────────────────────────────────────────────────
  const liveStats = useMemo(() => {
    if (!data) return null
    let total = 0, cumplidas = 0, en_progreso = 0, vencidas = 0, pendientes = 0

    const aspectosConStats = data.aspectos.map(asp => {
      let aTotal = 0, aCumplidas = 0, aEnProgreso = 0, aVencidas = 0, aPendientes = 0
      asp.grupos.forEach(grp => grp.obligaciones.forEach(obl => obl.subs.forEach(s => {
        aTotal++
        if      (s.estado === 'cumplida')    { aCumplidas++;   cumplidas++   }
        else if (s.estado === 'en_progreso') { aEnProgreso++;  en_progreso++ }
        else if (s.estado === 'vencida')     { aVencidas++;    vencidas++    }
        else if (s.estado === 'pendiente')   { aPendientes++;  pendientes++  }
      })))
      total += aTotal
      const aPct = aTotal > 0 ? Math.round((aCumplidas / aTotal) * 100) : 0
      return { nombre: asp.nombre, pct: aPct, stats: { total: aTotal, cumplidas: aCumplidas, en_progreso: aEnProgreso, vencidas: aVencidas, pendientes: aPendientes }, grupos: asp.grupos }
    })

    const pct = total > 0 ? Math.round((cumplidas / total) * 100) : 0
    return { pct, total, cumplidas, en_progreso, vencidas, pendientes, aspectosConStats }
  }, [data])

  const toggleAspecto = (n: string) => setAspectoOpen(p => ({ ...p, [n]: !p[n] }))
  const toggleGrupo   = (k: string) => setGrupoOpen(p  => ({ ...p, [k]: !p[k] }))
  const toggleObl     = (k: string) => setOblOpen(p    => ({ ...p, [k]: !p[k] }))

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: C.vino, fontFamily: "'Josefin Sans', sans-serif", color: C.marfil }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      {/* ── NAV ── */}
      <nav style={{ background: 'rgba(39,2,5,0.97)', borderBottom: '1px solid rgba(150,134,34,0.2)', padding: '0.9rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <a href="/dashboard" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', fontWeight: 700, color: C.marfil, textDecoration: 'none' }}>Owl Compliance</a>
          <span style={{ color: 'rgba(231,223,202,0.3)' }}>›</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.olivo }}>Mapa de Cumplimiento</span>
        </div>
        <a href="/api/auth/signout" style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.5)', textDecoration: 'none' }}>Salir</a>
      </nav>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>

        {/* ── SELECTOR CLIENTE (admin) ── */}
        {userRole === 'admin' && clientes.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.olivo, marginBottom: '0.5rem' }}>Cliente</label>
            <select value={clienteId ?? ''} onChange={e => setClienteId(e.target.value)}
              style={{ background: 'rgba(231,223,202,0.08)', border: '1px solid rgba(150,134,34,0.35)', borderRadius: '8px', padding: '0.7rem 1rem', color: C.marfil, fontSize: '0.9rem', fontFamily: 'inherit', width: '100%', maxWidth: '480px', cursor: 'pointer' }}>
              <option value="" disabled>Selecciona un cliente…</option>
              {clientes.map((c: any) => (
                <option key={c.id} value={c.id} style={{ background: C.vino }}>
                  {c.razon_social}{c.nit ? ` · NIT ${c.nit}` : ''} — {c.total ? Math.round((c.cumplidas/c.total)*100) : 0}%
                </option>
              ))}
            </select>
          </div>
        )}

        {loading && <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(231,223,202,0.4)', fontSize: '0.85rem', letterSpacing: '0.1em' }}>Cargando obligaciones…</div>}

        {data && !loading && (
          <>
            {/* ── HEADER CLIENTE ── */}
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(1.4rem,2.5vw,2rem)', fontWeight: 700, marginBottom: '0.3rem' }}>{data.cliente.razon_social}</div>
              {data.cliente.nit && <div style={{ fontSize: '0.72rem', color: 'rgba(231,223,202,0.5)', letterSpacing: '0.1em' }}>NIT {data.cliente.nit}</div>}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.8rem' }}>
                {data.servicios.map(s => (
                  <span key={s} style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'rgba(150,134,34,0.15)', border: '1px solid rgba(150,134,34,0.3)', color: C.olivo, padding: '0.25rem 0.7rem', borderRadius: '20px' }}>
                    {s.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>

            {/* ── RESUMEN DONA ── */}
            {liveStats && (
              <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap', background: 'rgba(231,223,202,0.04)', border: '1px solid rgba(150,134,34,0.2)', borderRadius: '14px', padding: '1.5rem 2rem', marginBottom: '2.5rem' }}>
                <DonutChart cumplidas={liveStats.cumplidas} en_progreso={liveStats.en_progreso} pendientes={liveStats.pendientes} vencidas={liveStats.vencidas} size={140} strokeWidth={16} showCenter showLegend />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: '0.8rem', flex: 1, minWidth: 0 }}>
                  <StatCard label="Total obligaciones" value={liveStats.total}       color="rgba(231,223,202,0.6)" />
                  <StatCard label="Cumplidas"          value={liveStats.cumplidas}   color="#16a34a" />
                  <StatCard label="En progreso"        value={liveStats.en_progreso} color="#3b82f6" />
                  <StatCard label="Pendientes"         value={liveStats.pendientes}  color="#968622" />
                  <StatCard label="Vencidas"           value={liveStats.vencidas}    color="#dc2626" />
                </div>
              </div>
            )}

            {/* ── BARRAS POR ASPECTO ── */}
            {liveStats && (
              <div style={{ background: 'rgba(231,223,202,0.05)', border: '1px solid rgba(150,134,34,0.2)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.olivo, marginBottom: '1.2rem' }}>Progreso por aspecto</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {liveStats.aspectosConStats.map(asp => (
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
            )}

            {/* ── PANEL DESCARGA ── */}
            <div style={{ border: '1px solid rgba(150,134,34,0.25)', borderRadius: '12px', marginBottom: '2rem', overflow: 'hidden' }}>
              <button onClick={() => setDescPanel(p => !p)}
                style={{ width: '100%', background: 'rgba(150,134,34,0.08)', border: 'none', cursor: 'pointer', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: C.marfil, fontFamily: 'inherit' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.olivo }}>Descargar documentos</span>
                <span style={{ color: 'rgba(231,223,202,0.5)', fontSize: '0.8rem', transform: descPanel ? 'rotate(180deg)' : 'none', transition: '0.2s' }}>▼</span>
              </button>

              {descPanel && (
                <div style={{ padding: '1.2rem 1.5rem', borderTop: '1px solid rgba(150,134,34,0.15)' }}>
                  {/* Selectores año/trimestre */}
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'flex-end' }}>
                    <div>
                      <div style={miniLabel}>Año</div>
                      <select value={descAnio} onChange={e => setDescAnio(Number(e.target.value))}
                        style={selectSm}>
                        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y} style={{ background: C.vino }}>{y}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={miniLabel}>Trimestre</div>
                      <select value={descTrimestre} onChange={e => setDescTrimestre(e.target.value === '' ? '' : Number(e.target.value))}
                        style={selectSm}>
                        <option value="" style={{ background: C.vino }}>Todo el año</option>
                        <option value={1} style={{ background: C.vino }}>Q1 · Ene–Mar</option>
                        <option value={2} style={{ background: C.vino }}>Q2 · Abr–Jun</option>
                        <option value={3} style={{ background: C.vino }}>Q3 · Jul–Sep</option>
                        <option value={4} style={{ background: C.vino }}>Q4 · Oct–Dic</option>
                      </select>
                    </div>
                    {/* Modo */}
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {(['todo', 'seleccionar'] as const).map(m => (
                        <button key={m} onClick={() => { setDescModo(m); setSeleccion(new Set()) }}
                          style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.5rem 0.9rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: descModo === m ? C.olivo : 'rgba(231,223,202,0.1)', color: descModo === m ? C.vino : 'rgba(231,223,202,0.6)', transition: 'all 0.2s' }}>
                          {m === 'todo' ? 'Todo el período' : 'Seleccionar obligaciones'}
                        </button>
                      ))}
                    </div>
                    {/* Botón descargar */}
                    <button onClick={descargar} disabled={descargando || (descModo === 'seleccionar' && seleccion.size === 0)}
                      style={{ marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', cursor: descargando || (descModo === 'seleccionar' && seleccion.size === 0) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', background: '#16a34a', color: '#fff', opacity: descModo === 'seleccionar' && seleccion.size === 0 ? 0.5 : 1 }}>
                      {descargando ? 'Generando ZIP…' : descModo === 'seleccionar' ? `Descargar (${seleccion.size} sel.)` : 'Descargar ZIP'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── AVISO MODO SELECCIÓN ── */}
            {descPanel && descModo === 'seleccionar' && (
              <div style={{ background: 'rgba(150,134,34,0.12)', border: '1px solid rgba(150,134,34,0.4)', borderRadius: '10px', padding: '0.8rem 1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                  <span style={{ fontSize: '1rem' }}>☑</span>
                  <span style={{ fontSize: '0.78rem', color: C.olivo, fontWeight: 600 }}>
                    Modo selección activo — expande las obligaciones y marca las que quieres descargar
                  </span>
                </div>
                {seleccion.size > 0 && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, background: C.olivo, color: C.vino, padding: '0.25rem 0.75rem', borderRadius: '20px', whiteSpace: 'nowrap' }}>
                    {seleccion.size} seleccionada{seleccion.size !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}

            {/* ── FILTRO ESTADO ── */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              {[{ value: 'todos', label: 'Todos' }, ...ESTADOS].map(e => (
                <button key={e.value} onClick={() => setFiltroEstado(e.value)}
                  style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '0.35rem 0.9rem', borderRadius: '20px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: filtroEstado === e.value ? C.olivo : 'rgba(231,223,202,0.08)', color: filtroEstado === e.value ? C.vino : 'rgba(231,223,202,0.6)', transition: 'all 0.2s' }}>
                  {e.label}
                </button>
              ))}
            </div>

            {/* ── MATRIZ ── */}
            {(liveStats?.aspectosConStats ?? data.aspectos).map(asp => {
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
                  <button onClick={() => toggleAspecto(asp.nombre)}
                    style={{ width: '100%', background: 'rgba(150,134,34,0.1)', border: 'none', cursor: 'pointer', padding: '1.1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: C.marfil, fontFamily: 'inherit' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.olivo }}>{asp.nombre}</span>
                      <span style={{ fontSize: '0.7rem', color: 'rgba(231,223,202,0.45)' }}>{asp.stats.total} obligaciones</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: pctColor(asp.pct) }}>{asp.pct}%</span>
                      <span style={{ color: 'rgba(231,223,202,0.5)', fontSize: '0.8rem', transform: isOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }}>▼</span>
                    </div>
                  </button>

                  {isOpen && gruposFiltrados.map(grp => {
                    const gKey  = `${asp.nombre}::${grp.nombre}`
                    const gOpen = !!grupoOpen[gKey]
                    return (
                      <div key={grp.nombre} style={{ borderTop: '1px solid rgba(150,134,34,0.12)' }}>
                        <button onClick={() => toggleGrupo(gKey)}
                          style={{ width: '100%', background: 'rgba(231,223,202,0.03)', border: 'none', cursor: 'pointer', padding: '0.9rem 1.5rem 0.9rem 2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: C.marfil, fontFamily: 'inherit' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{grp.nombre}</span>
                          <span style={{ color: 'rgba(231,223,202,0.4)', fontSize: '0.75rem', transform: gOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }}>▼</span>
                        </button>

                        {gOpen && grp.obligaciones.map(obl => {
                          const oKey  = `${gKey}::${obl.nombre}`
                          const oOpen = !!oblOpen[oKey]
                          return (
                            <div key={obl.nombre} style={{ borderTop: '1px solid rgba(231,223,202,0.06)', background: 'rgba(0,0,0,0.15)' }}>
                              <button onClick={() => toggleObl(oKey)}
                                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0.8rem 1.5rem 0.8rem 3.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', color: C.marfil, fontFamily: 'inherit', textAlign: 'left', gap: '1rem' }}>
                                <div>
                                  <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: obl.descripcion ? '0.25rem' : 0 }}>{obl.nombre}</div>
                                  {obl.descripcion && <div style={{ fontSize: '0.75rem', fontWeight: 300, color: 'rgba(231,223,202,0.55)', lineHeight: 1.5 }}>{obl.descripcion}</div>}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                  <span style={{ fontSize: '0.65rem', color: 'rgba(231,223,202,0.4)' }}>{obl.subs.length} sub</span>
                                  <span style={{ color: 'rgba(231,223,202,0.4)', fontSize: '0.75rem', transform: oOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }}>▼</span>
                                </div>
                              </button>

                              {oOpen && (
                                <div style={{ padding: '0.5rem 1.5rem 1rem 4.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                  {obl.subs.map(sub => {
                                    const cfg      = ESTADO_CONFIG[sub.estado] ?? ESTADO_CONFIG.pendiente
                                    const subDocs  = docs[sub.obl_id] ?? []
                                    const selected = seleccion.has(sub.obl_id)
                                    const isUploadActive = uploadPanel?.oblId === sub.obl_id

                                    return (
                                      <div key={sub.obl_id} style={{ background: 'rgba(231,223,202,0.04)', border: `1px solid ${selected ? C.olivo : cfg.dot}22`, borderLeft: `3px solid ${selected ? C.olivo : cfg.dot}`, borderRadius: '8px', padding: '0.9rem 1rem', transition: 'border-color 0.2s' }}>

                                        {/* Fila principal */}
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                                          {/* Checkbox selección */}
                                          {descModo === 'seleccionar' && descPanel && (
                                            <input type="checkbox" checked={selected} onChange={() => toggleSeleccion(sub.obl_id)}
                                              style={{ marginTop: '3px', accentColor: C.olivo, cursor: 'pointer', flexShrink: 0, width: '15px', height: '15px' }} />
                                          )}

                                          {/* Info */}
                                          <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', lineHeight: 1.4 }}>{sub.sub_titulo}</div>
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                              <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'rgba(150,134,34,0.15)', color: C.olivo, padding: '0.2rem 0.6rem', borderRadius: '10px' }}>{sub.periodicidad}</span>
                                              <span style={{ fontSize: '0.68rem', background: cfg.bg, color: cfg.color, padding: '0.2rem 0.6rem', borderRadius: '10px', fontWeight: 600 }}>● {cfg.label}</span>
                                              {sub.fecha_limite && <span style={{ fontSize: '0.65rem', color: 'rgba(231,223,202,0.4)' }}>Vence: {new Date(sub.fecha_limite + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                                            </div>
                                          </div>

                                          {/* Acciones derecha */}
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem', flexShrink: 0 }}>
                                            {/* Selector estado */}
                                            <select value={sub.estado} disabled={saving === sub.obl_id}
                                              onChange={e => cambiarEstado(sub.obl_id, e.target.value)}
                                              style={{ background: cfg.bg, border: `1px solid ${cfg.dot}44`, borderRadius: '8px', padding: '0.4rem 0.7rem', color: cfg.color, fontSize: '0.72rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                                              {ESTADOS.map(e => <option key={e.value} value={e.value} style={{ background: C.vino }}>{e.label}</option>)}
                                            </select>
                                            {/* Botón subir */}
                                            <button
                                              onClick={() => {
                                                setUploadPanel(isUploadActive ? null : { oblId: sub.obl_id, aspecto: asp.nombre, obligacion: obl.nombre, periodicidad: sub.periodicidad })
                                                setUploadError('')
                                              }}
                                              style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.3rem 0.7rem', borderRadius: '6px', border: `1px solid ${isUploadActive ? C.olivo : 'rgba(231,223,202,0.2)'}`, cursor: 'pointer', fontFamily: 'inherit', background: isUploadActive ? 'rgba(150,134,34,0.15)' : 'transparent', color: isUploadActive ? C.olivo : 'rgba(231,223,202,0.55)', transition: 'all 0.2s' }}>
                                              {isUploadActive ? '✕ Cancelar' : '↑ Subir doc'}
                                            </button>
                                          </div>
                                        </div>

                                        {/* Documentos existentes */}
                                        {subDocs.length > 0 && (
                                          <div style={{ marginTop: '0.7rem', paddingTop: '0.7rem', borderTop: '1px solid rgba(231,223,202,0.08)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                            {subDocs.map(d => (
                                              <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                                <a href={`/api/documentos/archivo?docId=${d.id}`} target="_blank" rel="noopener noreferrer"
                                                  style={{ fontSize: '0.72rem', color: '#60a5fa', textDecoration: 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                  📄 {d.nombre_archivo}
                                                </a>
                                                <span style={{ fontSize: '0.62rem', color: 'rgba(231,223,202,0.35)', flexShrink: 0 }}>
                                                  {new Date(d.uploaded_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        )}

                                        {/* Panel de subida inline */}
                                        {isUploadActive && (
                                          <div style={{ marginTop: '0.8rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(150,134,34,0.2)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                              <div>
                                                <div style={miniLabel}>Año</div>
                                                <select value={uploadAnio} onChange={e => setUploadAnio(Number(e.target.value))} style={selectSm}>
                                                  {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y} style={{ background: C.vino }}>{y}</option>)}
                                                </select>
                                              </div>
                                              {necesitaTrimestre(sub.periodicidad) && (
                                                <div>
                                                  <div style={miniLabel}>Trimestre</div>
                                                  <select value={uploadTrimestre} onChange={e => setUploadTrimestre(e.target.value === '' ? '' : Number(e.target.value))} style={selectSm}>
                                                    <option value="" style={{ background: C.vino }}>— selecciona —</option>
                                                    <option value={1} style={{ background: C.vino }}>Q1 · Ene–Mar</option>
                                                    <option value={2} style={{ background: C.vino }}>Q2 · Abr–Jun</option>
                                                    <option value={3} style={{ background: C.vino }}>Q3 · Jul–Sep</option>
                                                    <option value={4} style={{ background: C.vino }}>Q4 · Oct–Dic</option>
                                                  </select>
                                                </div>
                                              )}
                                              <label style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.45rem 0.9rem', borderRadius: '8px', border: '1px solid rgba(150,134,34,0.4)', cursor: 'pointer', color: C.olivo, background: 'rgba(150,134,34,0.08)', whiteSpace: 'nowrap' }}>
                                                {uploading ? 'Subiendo…' : 'Elegir archivo'}
                                                <input ref={fileInputRef} type="file" style={{ display: 'none' }} disabled={uploading}
                                                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                                                  onChange={e => { const f = e.target.files?.[0]; if (f) subirDocumento(f) }} />
                                              </label>
                                            </div>
                                            {uploadError && <div style={{ fontSize: '0.72rem', color: '#f87171' }}>{uploadError}</div>}
                                            <div style={{ fontSize: '0.65rem', color: 'rgba(231,223,202,0.35)' }}>PDF, Word, Excel o imagen · máx. 20 MB</div>
                                          </div>
                                        )}
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
          <div style={{ textAlign: 'center', padding: '4rem', color: 'rgba(231,223,202,0.3)' }}>No se encontraron obligaciones.</div>
        )}
      </main>

      {/* ── Input oculto global para evitar duplicados en DOM ── */}
      <input ref={fileInputRef} type="file" style={{ display: 'none' }} />
    </div>
  )
}

// ─── Estilos compartidos ──────────────────────────────────────────────────────
const miniLabel: React.CSSProperties = {
  fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em',
  textTransform: 'uppercase', color: 'rgba(231,223,202,0.45)', marginBottom: '0.25rem',
}

const selectSm: React.CSSProperties = {
  background: 'rgba(231,223,202,0.08)', border: '1px solid rgba(150,134,34,0.3)',
  borderRadius: '6px', padding: '0.45rem 0.7rem', color: '#e7dfca',
  fontSize: '0.8rem', fontFamily: "'Josefin Sans', sans-serif", cursor: 'pointer',
}

// ─── Componentes ─────────────────────────────────────────────────────────────
function StatCard({ label, value, color, big }: { label: string; value: any; color: string; big?: boolean }) {
  return (
    <div style={{ background: 'rgba(231,223,202,0.05)', border: '1px solid rgba(150,134,34,0.2)', borderRadius: '12px', padding: '1.2rem 1.5rem' }}>
      <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.5)', marginBottom: '0.5rem' }}>{label}</div>
      <div style={{ fontSize: big ? '2.2rem' : '1.8rem', fontWeight: 700, color, fontFamily: "'Playfair Display', serif" }}>{value}</div>
    </div>
  )
}
