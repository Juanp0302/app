'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import NavLogo from '@/components/NavLogo'
import { celularParaWhatsApp, enlaceWhatsApp, primerNombreDe } from '@/lib/whatsapp'
import { temperaturaProspecto, TEMPERATURA, type NivelTemperatura } from '@/lib/temperatura'
import { CADENCIAS, pasoActual, textoDelPaso, type CadenciaId } from '@/lib/cadencias'
import { hoyBogota } from '@/lib/ventas'
import CargarBase from './CargarBase'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

const ESTADOS = [
  'Pendiente', 'WA1 enviado', 'Respondió', 'Llamada sin contacto', 'Conversación',
  'Reunión agendada', 'Propuesta enviada', 'Cliente', 'No interesado', 'No contactar',
]

const ESTADO_COLOR: Record<string, string> = {
  'Pendiente': '#6b7280',
  'WA1 enviado': '#3b82f6',
  'Respondió': '#8b5cf6',
  'Llamada sin contacto': '#f59e0b',
  'Conversación': '#0ea5e9',
  'Reunión agendada': '#6366f1',
  'Propuesta enviada': '#d97706',
  'Cliente': '#16a34a',
  'No interesado': '#dc2626',
  'No contactar': '#374151',
}

const PRIORIDAD_LABEL: Record<string, string> = {
  A: 'A — Investigación en marcha', B: 'B — Multa impuesta',
  C1: 'C1 — Sin investigación (top 50)', C2: 'C2 — Sin investigación', W: 'W — Webinar', O: 'O — Otra base cargada',
}
const PRIORIDAD_COLOR: Record<string, string> = { A: '#dc2626', B: '#f59e0b', C1: '#16a34a', C2: '#6b7280', W: '#6d28d9', O: '#0f766e' }

/** De qué campaña viene, en corto: "Cold mailing", "Webinar · asistió 112 min", "Expo ISP 2026", "Cold mailing + webinar (inscrito)". */
function campanaTexto(p: any) {
  const web = p.webinar_asistio ? `asistió${p.webinar_minutos ? ` ${p.webinar_minutos} min` : ''}` : 'inscrito'
  if (p.campana === 'webinar') return `Webinar · ${web}`
  const base = !p.campana || p.campana === 'cold-mailing' ? 'Cold mailing' : p.campana   // bases cargadas desde Excel
  return p.en_webinar ? `${base} + webinar (${web})` : base
}
/** Valor del filtro de campaña: "cold", "webinar-asistio", "webinar-inscrito" o "base:<nombre>" para las cargadas desde Excel. */
const segmentoCampana = (p: any) => {
  if (p.campana === 'webinar' || p.en_webinar) return p.webinar_asistio ? 'webinar-asistio' : 'webinar-inscrito'
  return !p.campana || p.campana === 'cold-mailing' ? 'cold' : `base:${p.campana}`
}
const tocaHoy = (p: any) => !!pasoActual(p) && !!p.proxima_fecha && p.proxima_fecha <= hoyBogota()

function ChipTemperatura({ nivel }: { nivel: NivelTemperatura }) {
  const t = TEMPERATURA[nivel]
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: `${t.color}18`, color: t.color, whiteSpace: 'nowrap' }}>
      {t.emoji} {t.label}
    </span>
  )
}

function fmtMoney(n: number | null | undefined) {
  if (!n && n !== 0) return '—'
  return '$' + Number(n).toLocaleString('es-CO')
}

async function copiar(texto: string, onDone: () => void) {
  try { await navigator.clipboard.writeText(texto); onDone() } catch { /* noop */ }
}


export default function ProspectosClient({ userId, userName, isSuperadmin }: { userId: string; userName: string; isSuperadmin: boolean }) {
  const miNombre = primerNombreDe(userName)
  /** Reemplaza [NOMBRE] por el nombre de quien envía, para que el mensaje salga listo para pegar. */
  const llenar = (t: string | null | undefined) => (t ? (miNombre ? t.split('[NOMBRE]').join(miNombre) : t) : '')
  const [prospectos, setProspectos] = useState<any[]>([])
  const [resumen, setResumen]       = useState<Record<string, number>>({})
  const [admins, setAdmins]         = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [activo, setActivo]         = useState<any | null>(null)

  const [busqueda, setBusqueda]           = useState('')
  const [filtroEstado, setFiltroEstado]   = useState('todos')
  const [filtroPrioridad, setFiltroPrioridad] = useState('todas')
  const [filtroResponsable, setFiltroResponsable] = useState('todos')
  const [filtroTemp, setFiltroTemp]       = useState<'todas' | NivelTemperatura>('todas')
  const [filtroCampana, setFiltroCampana] = useState('todas')
  const [soloHoy, setSoloHoy]             = useState(false)
  const [cargando, setCargando]           = useState(false)

  const [modoSeleccion, setModoSeleccion] = useState(false)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [reasignarA, setReasignarA]       = useState('')
  const [reasignando, setReasignando]     = useState(false)

  const [guardando, setGuardando]   = useState(false)
  const [copiado, setCopiado]       = useState<string | null>(null)
  const [historial, setHistorial]   = useState<any[]>([])
  const [tabDetalle, setTabDetalle] = useState<'seguimiento' | 'mensajes' | 'historial'>('seguimiento')

  const [form, setForm] = useState({ estado: '', fecha_contacto: '', proximo_paso: '', notas: '' })

  const cargar = useCallback(async (): Promise<any[]> => {
    try {
      const r = await fetch('/api/prospectos')
      const d = await r.json()
      const lista = Array.isArray(d.prospectos) ? d.prospectos : []
      setProspectos(lista)
      setResumen(d.resumen ?? {})
      return lista
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => {
    if (isSuperadmin) fetch('/api/admins').then(r => r.json()).then(setAdmins).catch(() => {})
  }, [isSuperadmin])

  function abrir(p: any) {
    setActivo(p)
    setForm({
      estado: p.estado ?? 'Pendiente',
      fecha_contacto: p.fecha_contacto ?? '',
      proximo_paso: p.proximo_paso ?? '',
      notas: p.notas ?? '',
    })
    setTabDetalle('seguimiento')
    fetch(`/api/prospectos/historial?id=${p.id}`).then(r => r.json()).then(d => setHistorial(d.historial ?? [])).catch(() => setHistorial([]))
  }

  async function guardar() {
    if (!activo) return
    setGuardando(true)
    try {
      const r = await fetch('/api/prospectos', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activo.id, ...form }),
      })
      if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error ?? 'Error guardando'); return }
      await cargar()
      const actualizado = { ...activo, ...form }
      setActivo(actualizado)
      fetch(`/api/prospectos/historial?id=${activo.id}`).then(r => r.json()).then(d => setHistorial(d.historial ?? []))
    } finally {
      setGuardando(false)
    }
  }

  /** Paso de la cadencia enviado, o "respondió": el servidor programa el siguiente y ajusta el estado. */
  async function accionCadencia(accion: 'paso_enviado' | 'respondio') {
    if (!activo) return
    setGuardando(true)
    try {
      const r = await fetch('/api/prospectos', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activo.id, accion }),
      })
      if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error ?? 'Error guardando'); return }
      const lista = await cargar()
      const actualizado = lista.find(x => x.id === activo.id)
      if (actualizado) abrir(actualizado)
    } finally {
      setGuardando(false)
    }
  }

  function toggleSeleccion(id: string) {
    setSeleccionados(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function reasignarSeleccionados() {
    if (!reasignarA || seleccionados.size === 0) return
    if (!window.confirm(`¿Reasignar ${seleccionados.size} prospecto(s) al administrador seleccionado?`)) return
    setReasignando(true)
    try {
      const r = await fetch('/api/superadmin/prospectos-reasignar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...seleccionados], responsableId: reasignarA }),
      })
      if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error ?? 'Error reasignando'); return }
      setSeleccionados(new Set())
      setModoSeleccion(false)
      setReasignarA('')
      await cargar()
    } finally {
      setReasignando(false)
    }
  }

  async function reasignarUno(p: any, responsableId: string) {
    if (!responsableId) return
    const r = await fetch('/api/superadmin/prospectos-reasignar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [p.id], responsableId }),
    })
    if (r.ok) {
      await cargar()
      if (activo?.id === p.id) {
        const admin = admins.find(a => a.id === responsableId)
        setActivo((a: any) => ({ ...a, responsable_id: responsableId, responsable_nombre: admin?.nombre }))
      }
    }
  }

  const hoy = hoyBogota()
  const temperaturas = useMemo(() => new Map(prospectos.map(p => [p.id, temperaturaProspecto(p, hoy)])), [prospectos, hoy])
  const nivelDe = useCallback((p: any): NivelTemperatura => temperaturas.get(p.id)?.nivel ?? 'frio', [temperaturas])
  const cuantosHoy = useMemo(() => prospectos.filter(tocaHoy).length, [prospectos])

  const filtrados = useMemo(() => {
    const lista = prospectos.filter(p => {
      if (soloHoy && !tocaHoy(p)) return false
      if (filtroTemp !== 'todas' && nivelDe(p) !== filtroTemp) return false
      if (filtroCampana !== 'todas' && segmentoCampana(p) !== filtroCampana) return false
      if (filtroEstado !== 'todos' && p.estado !== filtroEstado) return false
      if (filtroPrioridad !== 'todas' && p.prioridad !== filtroPrioridad) return false
      if (isSuperadmin && filtroResponsable !== 'todos' && p.responsable_id !== filtroResponsable) return false
      if (busqueda) {
        const q = busqueda.toLowerCase()
        if (!p.empresa?.toLowerCase().includes(q) && !String(p.nit ?? '').includes(q) && !p.representante?.toLowerCase().includes(q)) return false
      }
      return true
    })
    // En "Para hoy": primero lo atrasado, luego lo más caliente y, entre asistentes, quien más tiempo estuvo.
    if (soloHoy) lista.sort((a, b) => (a.proxima_fecha ?? '').localeCompare(b.proxima_fecha ?? '') ||
      TEMPERATURA[nivelDe(a)].orden - TEMPERATURA[nivelDe(b)].orden || Number(b.webinar_minutos ?? 0) - Number(a.webinar_minutos ?? 0))
    return lista
  }, [prospectos, filtroEstado, filtroPrioridad, filtroResponsable, busqueda, isSuperadmin, soloHoy, filtroTemp, filtroCampana, nivelDe])

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box' }
  const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#888', marginBottom: 4, display: 'block' }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.vino, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(231,223,202,0.4)', fontFamily: "'Josefin Sans', sans-serif" }}>
      Cargando prospectos…
    </div>
  )

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f5f3ee', fontFamily: "'Josefin Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      {/* Nav */}
      <nav style={{ flexShrink: 0, background: C.vino, padding: '0.9rem 2rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <NavLogo />
        <span style={{ color: 'rgba(231,223,202,0.3)' }}>›</span>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.olivo }}>
          Prospectos ISP {isSuperadmin ? `— Vista global (${prospectos.length})` : `— Mis prospectos (${prospectos.length})`}
        </span>
        <a href="/dashboard" style={{ marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.5)', textDecoration: 'none' }}>
          ← Volver
        </a>
      </nav>

      {/* Resumen tipo Tablero */}
      <div style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0.7rem 1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', overflowX: 'auto' }}>
        {ESTADOS.map(e => (
          <button key={e} onClick={() => setFiltroEstado(f => f === e ? 'todos' : e)}
            style={{
              fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
              border: `1px solid ${(ESTADO_COLOR[e] ?? '#888')}50`,
              background: filtroEstado === e ? ESTADO_COLOR[e] : `${ESTADO_COLOR[e] ?? '#888'}15`,
              color: filtroEstado === e ? '#fff' : (ESTADO_COLOR[e] ?? '#888'), whiteSpace: 'nowrap',
            }}>
            {e} ({resumen[e] ?? 0})
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', flex: 1, overflow: 'hidden' }}>

        {/* ── Lista ── */}
        <div style={{ background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '0.85rem', borderBottom: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input placeholder="Buscar empresa, NIT o representante…" value={busqueda} onChange={e => setBusqueda(e.target.value)} style={inp} />
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              <button onClick={() => setSoloHoy(v => !v)} title="Mensajes de la cadencia que tocan hoy o están atrasados"
                style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 14, cursor: 'pointer', border: `1px solid ${C.vino}`,
                  background: soloHoy ? C.vino : '#fff', color: soloHoy ? '#fff' : C.vino }}>
                Para hoy ({cuantosHoy})
              </button>
              {(['caliente', 'tibio', 'frio'] as const).map(n => (
                <button key={n} onClick={() => setFiltroTemp(f => (f === n ? 'todas' : n))}
                  style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 14, cursor: 'pointer', border: `1px solid ${TEMPERATURA[n].color}`,
                    background: filtroTemp === n ? TEMPERATURA[n].color : '#fff', color: filtroTemp === n ? '#fff' : TEMPERATURA[n].color }}>
                  {TEMPERATURA[n].emoji} {TEMPERATURA[n].label} ({prospectos.filter(p => nivelDe(p) === n).length})
                </button>
              ))}
            </div>
            <select value={filtroCampana} onChange={e => setFiltroCampana(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
              <option value="todas">Todas las campañas</option>
              <option value="cold">Cold mailing</option>
              <option value="webinar-asistio">Webinar · asistieron</option>
              <option value="webinar-inscrito">Webinar · inscritos que no asistieron</option>
              {[...new Set(prospectos.map(segmentoCampana).filter(s => s.startsWith('base:')))].sort().map(s => (
                <option key={s} value={s}>{s.slice(5)}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <select value={filtroPrioridad} onChange={e => setFiltroPrioridad(e.target.value)} style={{ ...inp, flex: 1, cursor: 'pointer' }}>
                <option value="todas">Toda prioridad</option>
                {Object.entries(PRIORIDAD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              {isSuperadmin && (
                <select value={filtroResponsable} onChange={e => setFiltroResponsable(e.target.value)} style={{ ...inp, flex: 1, cursor: 'pointer' }}>
                  <option value="todos">Todo responsable</option>
                  {admins.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              )}
            </div>
            {isSuperadmin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button onClick={() => { setModoSeleccion(s => !s); setSeleccionados(new Set()) }}
                  style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                    background: modoSeleccion ? C.olivo : '#eee', color: modoSeleccion ? '#fff' : '#555', border: 'none' }}>
                  {modoSeleccion ? '✓ Reasignación en lote activa' : 'Reasignar en lote'}
                </button>
                <button onClick={() => setCargando(true)} title="Subir un Excel o CSV con una base de contactos y repartirla"
                  style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 6, cursor: 'pointer', background: C.vino, color: '#fff', border: 'none' }}>
                  ⬆ Cargar base
                </button>
                {modoSeleccion && <span style={{ fontSize: 11, color: '#888' }}>{seleccionados.size} seleccionados</span>}
              </div>
            )}
            {modoSeleccion && seleccionados.size > 0 && (
              <div style={{ display: 'flex', gap: '0.4rem', background: '#f8f6f1', padding: '0.5rem', borderRadius: 6 }}>
                <select value={reasignarA} onChange={e => setReasignarA(e.target.value)} style={{ ...inp, flex: 1, cursor: 'pointer' }}>
                  <option value="">Reasignar a…</option>
                  {admins.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
                <button onClick={reasignarSeleccionados} disabled={!reasignarA || reasignando}
                  style={{ fontSize: 11, fontWeight: 700, padding: '0 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: reasignarA ? C.bordo : '#ccc', color: '#fff' }}>
                  {reasignando ? '…' : 'Confirmar'}
                </button>
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtrados.map(p => (
              <div key={p.id} onClick={() => !modoSeleccion && abrir(p)}
                style={{
                  padding: '0.7rem 0.9rem', borderBottom: '1px solid #f0f0f0', cursor: 'pointer',
                  background: activo?.id === p.id ? '#f8f6f1' : '#fff', display: 'flex', gap: '0.6rem', alignItems: 'flex-start',
                }}>
                {modoSeleccion && (
                  <input type="checkbox" checked={seleccionados.has(p.id)} onChange={() => toggleSeleccion(p.id)}
                    style={{ marginTop: 3, cursor: 'pointer' }} onClick={e => e.stopPropagation()} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: PRIORIDAD_COLOR[p.prioridad] }}>#{p.puesto}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.vino, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.empresa}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                    {[p.nit && `NIT ${p.nit}`, p.municipio, p.campana === 'webinar' && p.representante, campanaTexto(p)].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <ChipTemperatura nivel={nivelDe(p)} />
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: `${ESTADO_COLOR[p.estado] ?? '#888'}20`, color: ESTADO_COLOR[p.estado] ?? '#888' }}>{p.estado}</span>
                    {tocaHoy(p) && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: p.proxima_fecha < hoy ? '#dc2626' : '#15803d' }}>
                        {p.proxima_fecha < hoy ? '⚠ Atrasado' : '● Hoy'}: {pasoActual(p)?.paso.titulo}
                      </span>
                    )}
                    {!!p.revisar_icp && <span title="Lo que escribió en ISP no parece un operador" style={{ fontSize: 10, color: '#b45309' }}>⚠ ¿ISP?</span>}
                    {isSuperadmin && <span style={{ fontSize: 10, color: '#aaa' }}>{p.responsable_nombre ?? 'Sin asignar'}</span>}
                  </div>
                </div>
              </div>
            ))}
            {filtrados.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#aaa', fontSize: 13 }}>Sin resultados con estos filtros.</div>
            )}
          </div>
        </div>

        {/* ── Detalle ── */}
        <div style={{ overflowY: 'auto', padding: activo ? '1.5rem 2rem' : 0 }}>
          {!activo ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 14 }}>
              Selecciona un prospecto de la lista.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: PRIORIDAD_COLOR[activo.prioridad], marginBottom: 4 }}>
                    #{activo.puesto} · {PRIORIDAD_LABEL[activo.prioridad] ?? activo.prioridad}
                  </div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: C.vino }}>{activo.empresa}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>NIT {activo.nit} · {activo.municipio}, {activo.departamento}</div>
                </div>
                {isSuperadmin && (
                  <div>
                    <label style={label}>Responsable</label>
                    <select value={activo.responsable_id ?? ''} onChange={e => reasignarUno(activo, e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                      <option value="">Sin asignar</option>
                      {admins.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <FichaTemperatura p={activo} t={temperaturas.get(activo.id) ?? temperaturaProspecto(activo, hoy)} />
              <CajaCadencia p={activo} vendedor={miNombre} ocupado={guardando} accion={accionCadencia} />

              {/* Datos de contacto */}
              <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '1rem 1.2rem', marginBottom: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem 1.5rem' }}>
                <Campo k="Representante legal" v={activo.representante} />
                <Campo k="Teléfono" v={activo.telefono} />
                <Campo k="Correo" v={activo.correo} />
                <Campo k="Ingresos semestre" v={fmtMoney(activo.ingresos_semestre)} />
                <Campo k="Expediente BDI" v={activo.expediente_bdi} />
                <Campo k="Canal sugerido" v={activo.canal_sugerido} />
                <Campo k="Tema detectado" v={activo.tema_detectado} full />
                {activo.webinar_nombre && (
                  <Campo k="Quién se inscribió al webinar" full
                    v={[activo.webinar_nombre, activo.webinar_telefono, activo.webinar_correo].filter(Boolean).join(' · ')} />
                )}
                {!!activo.revisar_a_mano && (
                  <div style={{ gridColumn: '1 / -1', fontSize: 11, fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '4px 8px', borderRadius: 6, width: 'fit-content' }}>
                    ⚠ Revisar a mano antes de contactar — el expediente puede tener ruido de formato
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb' }}>
                {(['seguimiento', 'mensajes', 'historial'] as const).map(t => (
                  <button key={t} onClick={() => setTabDetalle(t)}
                    style={{ padding: '0.5rem 1rem', fontSize: 12, fontWeight: 700, textTransform: 'capitalize', background: 'none', border: 'none', cursor: 'pointer',
                      color: tabDetalle === t ? C.bordo : '#aaa', borderBottom: tabDetalle === t ? `2px solid ${C.bordo}` : '2px solid transparent' }}>
                    {t}
                  </button>
                ))}
              </div>

              {tabDetalle === 'seguimiento' && (
                <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  <div>
                    <label style={label}>Estado</label>
                    <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>
                      {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={label}>Fecha de contacto</label>
                    <input type="date" value={form.fecha_contacto?.slice(0, 10) ?? ''} onChange={e => setForm(f => ({ ...f, fecha_contacto: e.target.value }))} style={inp} />
                  </div>
                  <div>
                    <label style={label}>Próximo paso</label>
                    <input value={form.proximo_paso} onChange={e => setForm(f => ({ ...f, proximo_paso: e.target.value }))} style={inp} placeholder="Ej: reintentar llamada jueves en la tarde" />
                  </div>
                  <div>
                    <label style={label}>Notas</label>
                    <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={4} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
                  </div>
                  <button onClick={guardar} disabled={guardando}
                    style={{ alignSelf: 'flex-start', background: C.olivo, color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}>
                    {guardando ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              )}

              {tabDetalle === 'mensajes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  {activo.cadencia && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#6d28d9', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, padding: '0.6rem 0.9rem' }}>
                      Esta empresa sigue la cadencia del webinar (arriba). Los mensajes del cold mailing de abajo quedan solo como referencia: no los envíe.
                    </div>
                  )}
                  {/* Estrategia actual: invitación al webinar + Comunidad ISPs Colombia */}
                  <div style={{ fontSize: 12, color: '#555', background: '#f8f6f1', border: '1px solid #e7dfca', borderRadius: 8, padding: '0.7rem 0.9rem', lineHeight: 1.6 }}>
                    <strong style={{ color: C.vino }}>Estrategia: invitar, no vender.</strong> Webinar “Que el MinTIC no sancione tu ISP” (con Inerxia) · miércoles 21 de octubre, 6:00 p. m. · y la Comunidad ISPs Colombia. Quien recibe cada mensaje ya vio el anterior: no repita la presentación.
                    {miNombre === null && <div style={{ marginTop: 4, color: '#b45309' }}>Los mensajes llevan <b>[NOMBRE]</b>: reemplácelo por su nombre antes de enviar.</div>}
                  </div>

                  {/\bno aplica\b/i.test(activo.canal_sugerido ?? '') && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '0.5rem 0.8rem', borderRadius: 8 }}>
                      📞 Este prospecto tiene teléfono fijo: la invitación va por llamada (use la apertura de abajo). Si consigue su celular, ahí sí use el WhatsApp.
                    </div>
                  )}

                  {celularParaWhatsApp(activo.telefono) ? (
                    <div style={{ fontSize: 12, color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '0.5rem 0.8rem' }}>
                      💬 Celular para WhatsApp: <b>+{celularParaWhatsApp(activo.telefono)}</b>. El botón verde abre el chat con el mensaje ya escrito; usted solo debe oprimir enviar y después cambiar el estado a mano.
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#7c2d12', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '0.5rem 0.8rem' }}>
                      Sin celular reconocible (teléfono registrado: <b>{activo.telefono || '—'}</b>). No hay botón de WhatsApp: llame y pida el celular.
                    </div>
                  )}

                  <MensajeBox titulo="1 · Invitación por WhatsApp — enviar 15-16 oct" texto={llenar(activo.invitacion_whatsapp)} copiado={copiado} setCopiado={setCopiado}
                    waLink={enlaceWhatsApp(activo.telefono, llenar(activo.invitacion_whatsapp))} />
                  <MensajeBox titulo="2 · Apertura de llamada — 1-2 días después del WhatsApp (en “usted”)" texto={llenar(activo.llamada_apertura)} copiado={copiado} setCopiado={setCopiado} />
                  <MensajeBox titulo="3 · Recordatorio por WhatsApp — lunes 19 oct" texto={llenar(activo.recordatorio_whatsapp)} copiado={copiado} setCopiado={setCopiado}
                    waLink={enlaceWhatsApp(activo.telefono, llenar(activo.recordatorio_whatsapp))} />
                  <MensajeBox titulo="4 · Aviso del día — miércoles 21 oct, mediodía" texto={llenar(activo.aviso_dia_whatsapp)} copiado={copiado} setCopiado={setCopiado}
                    waLink={enlaceWhatsApp(activo.telefono, llenar(activo.aviso_dia_whatsapp))} />

                  {/* Guías anteriores, que se mantienen para después del webinar */}
                  <details style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '0.8rem 1.1rem' }}>
                    <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, color: C.bordo, letterSpacing: '0.04em' }}>
                      Guías para después del webinar (enfoque de servicio) — {`${(activo.whatsapp_1 || activo.guion_llamada) ? 'disponibles' : 'sin datos'}`}
                    </summary>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginTop: '0.9rem' }}>
                      <div style={{ fontSize: 12, color: '#777', lineHeight: 1.6 }}>
                        Estos textos se escribieron antes del cambio de estrategia. Úselos solo después del webinar, y recuerde que ya hubo un primer contacto con la invitación: adapte el saludo (“como le comenté…”).
                      </div>
                      <MensajeBox titulo="Apertura de servicio (anterior)" texto={llenar(activo.whatsapp_1)} copiado={copiado} setCopiado={setCopiado} />
                      <MensajeBox titulo="Dato de valor (anterior)" texto={llenar(activo.whatsapp_2)} copiado={copiado} setCopiado={setCopiado} />
                      <MensajeBox titulo="Cierre amable (anterior)" texto={llenar(activo.whatsapp_3)} copiado={copiado} setCopiado={setCopiado} />
                      {activo.llamada_servicio && <MensajeBox titulo="Apertura de llamada de servicio (anterior)" texto={llenar(activo.llamada_servicio)} copiado={copiado} setCopiado={setCopiado} />}
                      {activo.guion_llamada && <MensajeBox titulo="Guion de llamada completo" texto={llenar(activo.guion_llamada)} copiado={copiado} setCopiado={setCopiado} pre />}
                      {activo.investigacion_1 && <MensajeBox titulo="Investigación 1" texto={activo.investigacion_1} copiado={copiado} setCopiado={setCopiado} />}
                      {activo.investigacion_2 && <MensajeBox titulo="Investigación 2" texto={activo.investigacion_2} copiado={copiado} setCopiado={setCopiado} />}
                      {activo.investigacion_3 && <MensajeBox titulo="Investigación 3" texto={activo.investigacion_3} copiado={copiado} setCopiado={setCopiado} />}
                    </div>
                  </details>

                  {!activo.invitacion_whatsapp && !activo.whatsapp_1 && !activo.guion_llamada && (
                    <div style={{ color: '#aaa', fontSize: 13 }}>No hay mensajes personalizados cargados para este prospecto.</div>
                  )}
                </div>
              )}

              {tabDetalle === 'historial' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {historial.length === 0 && <div style={{ color: '#aaa', fontSize: 13 }}>Sin cambios registrados todavía.</div>}
                  {historial.map((h: any) => (
                    <div key={h.id} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: '0.7rem 1rem', fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, color: C.vino }}>
                          {h.estado_anterior && h.estado_anterior !== h.estado_nuevo ? `${h.estado_anterior} → ${h.estado_nuevo}` : h.estado_nuevo}
                        </span>
                        <span style={{ color: '#aaa' }}>{new Date(h.created_at).toLocaleString('es-CO')}</span>
                      </div>
                      <div style={{ color: '#888', marginTop: 2 }}>{h.user_nombre ?? 'Sistema'}{h.nota ? ` — ${h.nota}` : ''}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {cargando && <CargarBase admins={admins} onCerrar={() => setCargando(false)} onCargado={() => { cargar() }} />}
    </div>
  )
}

function FichaTemperatura({ p, t }: { p: any; t: { nivel: NivelTemperatura; puntos: number; razones: string[] } }) {
  const info = TEMPERATURA[t.nivel]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: `${info.color}10`, border: `1px solid ${info.color}40`,
      borderRadius: 10, padding: '0.7rem 1rem', marginBottom: '1rem' }}>
      <div style={{ fontSize: 22 }}>{info.emoji}</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: info.color }}>
          {info.label}{t.nivel !== 'cliente' && t.nivel !== 'descartado' ? ` · ${t.puntos} pts` : ''}
        </div>
        <div style={{ fontSize: 12, color: '#555' }}>{campanaTexto(p)} · {t.razones.join(' · ')}</div>
      </div>
    </div>
  )
}

/** Paso actual de la cadencia del webinar con sus botones: "Ya lo envié" programa el siguiente; "Respondió" la detiene. */
function CajaCadencia({ p, vendedor, ocupado, accion }: {
  p: any; vendedor: string | null; ocupado: boolean; accion: (a: 'paso_enviado' | 'respondio') => void
}) {
  const [copiado, setCopiado] = useState<string | null>(null)
  const c = p.cadencia ? CADENCIAS[p.cadencia as CadenciaId] : null
  if (!c) return null
  const actual = pasoActual(p)
  // Los mensajes van a quien se inscribió; en filas del cold mailing puede no ser el representante legal.
  const contacto = { nombre: p.webinar_nombre || p.representante, empresa: p.empresa, minutos_webinar: p.webinar_minutos }
  const telefono = p.webinar_telefono || p.telefono
  return (
    <div style={{ background: '#fff', border: '1px solid #bbf7d0', borderRadius: 10, padding: '0.9rem 1.1rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.vino }}>Cadencia: {c.nombre}</span>
        <span style={{ fontSize: 11, color: '#888' }}>{p.proxima_fecha && actual ? `Toca el ${p.proxima_fecha}` : ''}</span>
      </div>
      <div style={{ display: 'flex', gap: 4, margin: '6px 0 8px' }}>
        {c.pasos.map((s, i) => (
          <div key={i} title={s.titulo} style={{ flex: 1, height: 6, borderRadius: 3,
            background: i < Number(p.paso_cadencia ?? 0) ? '#16a34a' : actual && i === actual.indice ? '#86efac' : '#e5e7eb' }} />
        ))}
      </div>
      {p.cadencia_estado === 'respondio' && <div style={{ fontSize: 12.5, color: '#15803d', fontWeight: 600 }}>✓ Respondió: la cadencia se detuvo. Ahora toca agendar la reunión.</div>}
      {p.cadencia_estado === 'terminada' && <div style={{ fontSize: 12.5, color: '#b45309' }}>Se enviaron todos los pasos sin respuesta. Márquelo &quot;No interesado&quot; o déjelo para más adelante.</div>}
      {actual && (() => {
        const texto = textoDelPaso(actual.paso, contacto, vendedor)
        const wa = actual.paso.canal === 'whatsapp' ? enlaceWhatsApp(telefono, texto) : null
        return (
          <>
            <MensajeBox titulo={`Paso ${actual.indice + 1} de ${actual.total} · ${actual.paso.titulo}`} texto={texto} waLink={wa}
              copiado={copiado} setCopiado={setCopiado} pre={actual.paso.canal === 'llamada'} />
            {actual.paso.canal === 'whatsapp' && !celularParaWhatsApp(telefono) && (
              <div style={{ fontSize: 11.5, color: '#b45309', marginTop: 4 }}>
                Sin celular reconocible ({telefono || 'sin teléfono'}): copie el mensaje y envíelo por correo ({p.webinar_correo || p.correo || 'sin correo'}).
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button disabled={ocupado} onClick={() => accion('paso_enviado')}
                style={{ flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 700, borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer' }}>
                {actual.paso.canal === 'llamada' ? '✓ Ya llamé (no contestó o no hubo cita)' : '✓ Ya lo envié'}
              </button>
              <button disabled={ocupado} onClick={() => accion('respondio')}
                style={{ flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 700, borderRadius: 6, border: `1px solid ${C.vino}`, background: '#fff', color: C.vino, cursor: 'pointer' }}>
                Respondió
              </button>
            </div>
          </>
        )
      })()}
    </div>
  )
}

function Campo({ k, v, full }: { k: string; v: any; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : undefined }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#aaa' }}>{k}</div>
      <div style={{ fontSize: 13, color: C.vino }}>{v || '—'}</div>
    </div>
  )
}

function MensajeBox({ titulo, texto, copiado, setCopiado, pre, waLink }: { titulo: string; texto: string; copiado: string | null; setCopiado: (v: string | null) => void; pre?: boolean; waLink?: string | null }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '1rem 1.2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.olivo }}>{titulo}</span>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {waLink && (
            <a href={waLink} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, fontWeight: 700, background: '#16a34a', border: '1px solid #16a34a', color: '#fff', borderRadius: 6, padding: '3px 10px', textDecoration: 'none' }}>
              💬 Abrir en WhatsApp
            </a>
          )}
          <button onClick={() => copiar(texto, () => { setCopiado(titulo); setTimeout(() => setCopiado(null), 1500) })}
            style={{ fontSize: 11, fontWeight: 700, background: 'none', border: `1px solid ${C.olivo}`, color: C.olivo, borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
            {copiado === titulo ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
      </div>
      <div style={{ fontSize: pre ? 11 : 13, color: '#333', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: pre ? 'monospace' : 'inherit' }}>{texto}</div>
    </div>
  )
}
