'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ETAPAS, ETAPAS_ACTIVAS, ETAPA_LABEL, ETAPA_COLOR, PLANES, PLAN_LABEL, CRITERIOS,
  puntaje, temperaturaDe, TEMPERATURA_LABEL, TEMPERATURA_COLOR, hoyBogota, type Etapa,
} from '@/lib/pipeline'
import { guionesPara } from '@/lib/guiones-ventas'
import { CADENCIAS, pasoActual, textoDelPaso, type CadenciaId } from '@/lib/cadencias'
import { celularParaWhatsApp, enlaceWhatsApp } from '@/lib/whatsapp'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622' }
const Q_LABEL = ['Sin info', 'Parcial', 'Confirmado']
const ORIGEN_CORTO: Record<string, string> = { webinar: 'Webinar', autodiagnostico: 'Autodiag.', contacto: 'Contacto' }

const datosDe = (l: any): Record<string, any> => { try { return JSON.parse(l?.datos ?? '{}') ?? {} } catch { return {} } }
const activo = (l: any) => !['ganado', 'perdido'].includes(l.etapa)
const paraHoy = (l: any) => activo(l) && !!l.proxima_fecha && l.proxima_fecha <= hoyBogota()

/** De dónde viene, en una línea: "Webinar · asistió 112 min", "Webinar · inscrito", "Autodiag. + Contacto". */
function origenTexto(l: any) {
  const origenes = String(l.origenes ?? l.origen ?? 'contacto').split(',')
  if (Number(l.asistio_max ?? l.asistio_webinar)) return `Webinar · asistió${l.minutos_webinar ? ` ${l.minutos_webinar} min` : ''}`
  if (origenes.includes('webinar')) return 'Webinar · inscrito, no asistió'
  return origenes.map(o => ORIGEN_CORTO[o] ?? o).join(' + ')
}

/** Lo que toca ahora: el paso de la cadencia si está activa, si no la próxima acción. */
function siguienteTexto(l: any) {
  const p = pasoActual(l)
  if (p) return `Paso ${p.indice + 1}/${p.total} · ${p.paso.titulo}`
  return l.proxima_accion ?? ''
}

function Tarjeta({ l, onAbrir, verResponsable }: { l: any; onAbrir: () => void; verResponsable: boolean }) {
  const t = temperaturaDe(l)
  const atrasada = activo(l) && l.proxima_fecha && l.proxima_fecha < hoyBogota()
  const sig = siguienteTexto(l)
  return (
    <div onClick={onAbrir} style={{ background: '#fff', border: '1px solid #e5e7eb', borderLeft: `4px solid ${TEMPERATURA_COLOR[t]}`,
      borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontSize: 12.5 }}>
      <div style={{ fontWeight: 700, color: C.vino }}>{l.empresa || l.nombre || '(sin nombre)'}</div>
      {l.empresa && l.nombre && <div style={{ color: '#666' }}>{l.nombre}</div>}
      <div style={{ marginTop: 3, fontSize: 11, color: '#6d28d9', fontWeight: 600 }} title={TEMPERATURA_LABEL[t]}>{origenTexto(l)}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, color: '#888', fontSize: 11 }}>
        <span>{verResponsable ? (l.responsable_nombre ?? 'Sin asignar') : ''}</span>
        <span title="Dolor + Presupuesto + Decisión (máx. 6)">{puntaje(l)}/6</span>
      </div>
      {datosDe(l).revisar_icp && <div style={{ fontSize: 10.5, color: '#b45309', marginTop: 2 }}>⚠ Revisar si es un ISP</div>}
      {sig && (
        <div style={{ marginTop: 4, fontSize: 11, color: atrasada ? '#dc2626' : '#555', fontWeight: atrasada ? 700 : 400 }}>
          {atrasada ? '⚠ ' : '→ '}{sig}{l.proxima_fecha ? ` (${l.proxima_fecha})` : ''}
        </div>
      )}
    </div>
  )
}

function useCopiar() {
  const [copiado, setCopiado] = useState<string | null>(null)
  const copiar = (id: string, texto: string) =>
    navigator.clipboard?.writeText(texto).then(() => { setCopiado(id); setTimeout(() => setCopiado(null), 1500) }).catch(() => {})
  return { copiado, copiar }
}

const btn = (color: string, lleno = false): React.CSSProperties => ({
  fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit',
  textDecoration: 'none', border: `1px solid ${color}`, background: lleno ? color : '#fff', color: lleno ? '#fff' : color,
})

function MensajeCaja({ id, titulo, cuando, texto, wa, destacado, children }: {
  id: string; titulo: string; cuando?: string; texto: string; wa: string | null; destacado?: boolean; children?: React.ReactNode
}) {
  const { copiado, copiar } = useCopiar()
  return (
    <div style={{ border: `1px solid ${destacado ? '#16a34a' : '#eee'}`, background: destacado ? '#f0fdf4' : '#fff', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.olivo }}>{titulo}</span>
        <div style={{ display: 'flex', gap: 5 }}>
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" style={btn('#16a34a', true)}>💬 Abrir en WhatsApp</a>}
          <button onClick={() => copiar(id, texto)} style={btn(C.olivo)}>{copiado === id ? '✓ Copiado' : 'Copiar'}</button>
        </div>
      </div>
      {cuando && <div style={{ fontSize: 11, color: '#999', margin: '2px 0 4px' }}>{cuando}</div>}
      <div style={{ fontSize: 12.5, color: '#333', lineHeight: 1.55, whiteSpace: 'pre-wrap', marginTop: cuando ? 0 : 4 }}>{texto}</div>
      {children}
    </div>
  )
}

/** Paso actual de la cadencia con sus botones: "Enviado" programa el siguiente; "Respondió" detiene la cadencia. */
function Cadencia({ lead, telefono, vendedor, ocupado, accion }: {
  lead: any; telefono: string | null; vendedor: string | null; ocupado: boolean; accion: (a: 'paso_enviado' | 'respondio') => void
}) {
  const c = lead.cadencia ? CADENCIAS[lead.cadencia as CadenciaId] : null
  if (!c) return null
  const p = pasoActual(lead)
  const estado = lead.cadencia_estado
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.vino }}>Cadencia: {c.nombre}</div>
      <div style={{ display: 'flex', gap: 4, margin: '6px 0' }}>
        {c.pasos.map((s, i) => (
          <div key={i} title={s.titulo} style={{ flex: 1, height: 6, borderRadius: 3,
            background: i < Number(lead.paso_cadencia ?? 0) ? '#16a34a' : p && i === p.indice ? '#86efac' : '#e5e7eb' }} />
        ))}
      </div>
      {estado === 'respondio' && <div style={{ fontSize: 12.5, color: '#15803d', fontWeight: 600 }}>✓ Respondió: la cadencia se detuvo. Ahora toca agendar la reunión (guiones abajo).</div>}
      {estado === 'terminada' && <div style={{ fontSize: 12.5, color: '#b45309' }}>Se enviaron todos los pasos sin respuesta. Márquelo Perdido (motivo "no responde") o déjelo para más adelante.</div>}
      {p && (() => {
        const texto = textoDelPaso(p.paso, lead, vendedor)
        const wa = p.paso.canal === 'whatsapp' ? enlaceWhatsApp(telefono, texto) : null
        return (
          <MensajeCaja id="cadencia" destacado texto={texto} wa={wa}
            titulo={`Paso ${p.indice + 1} de ${p.total} · ${p.paso.titulo}`}
            cuando={lead.proxima_fecha ? `Programado para ${lead.proxima_fecha}` : undefined}>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button disabled={ocupado} onClick={() => accion('paso_enviado')} style={{ ...btn('#16a34a', true), flex: 1, padding: '6px 0' }}>
                {p.paso.canal === 'llamada' ? '✓ Ya llamé (no contestó o no hubo cita)' : '✓ Ya lo envié'}
              </button>
              <button disabled={ocupado} onClick={() => accion('respondio')} style={{ ...btn(C.vino), flex: 1, padding: '6px 0' }}>
                Respondió
              </button>
            </div>
          </MensajeCaja>
        )
      })()}
    </div>
  )
}

function Guiones({ lead, envios, telefono, vendedor }: { lead: any; envios: any[]; telefono: string | null; vendedor: string | null }) {
  // Mientras la cadencia esté activa, sus pasos reemplazan los guiones de primer contacto.
  const enCadencia = !!pasoActual(lead) && ['nuevo', 'contactado'].includes(lead.etapa)
  const guiones = enCadencia ? [] : guionesPara(lead, envios, vendedor)
  if (!guiones.length) return null
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.vino }}>Qué decirle</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
        {guiones.map(g => (
          <MensajeCaja key={g.id} id={g.id} titulo={g.titulo} cuando={g.cuando} texto={g.texto}
            wa={g.canal === 'whatsapp' ? enlaceWhatsApp(telefono, g.texto) : null} />
        ))}
      </div>
    </div>
  )
}

function Detalle({ lead, envios, vendedor, esSuperadmin, admins, onCerrar, onGuardado }: {
  lead: any; envios: any[]; vendedor: string | null; esSuperadmin: boolean; admins: any[]; onCerrar: () => void; onGuardado: () => void
}) {
  const [f, setF] = useState({
    etapa: lead.etapa as Etapa,
    q_dolor: lead.q_dolor ?? 0, q_presupuesto: lead.q_presupuesto ?? 0, q_decision: lead.q_decision ?? 0,
    dolor_nota: lead.dolor_nota ?? '', plan_objetivo: lead.plan_objetivo ?? '',
    proxima_accion: lead.proxima_accion ?? '', proxima_fecha: lead.proxima_fecha ?? '',
    motivo_descarte: lead.motivo_descarte ?? '',
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }))
  const inp: React.CSSProperties = { width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #ddd',
    fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block' }
  // El celular puede estar en cualquiera de sus formularios.
  const telefono = [lead.telefono, ...envios.map(e => e.telefono)].find(t => celularParaWhatsApp(t)) ?? null
  const datos = datosDe(lead)

  async function enviar(cuerpo: Record<string, any>) {
    setGuardando(true); setError('')
    try {
      const r = await fetch('/api/leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.id, ...cuerpo }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setError(j.error ?? 'No se pudo guardar'); return }
      onGuardado(); onCerrar()
    } finally { setGuardando(false) }
  }
  const guardar = () => enviar({ ...f, plan_objetivo: f.plan_objetivo || null, proxima_fecha: f.proxima_fecha || null })

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 440, maxWidth: '100%', background: '#fff', padding: '1.25rem', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.vino }}>{lead.empresa || lead.nombre}</div>
            <div style={{ fontSize: 12, color: '#666' }}>{[lead.nombre, lead.correo].filter(Boolean).join(' · ')}</div>
          </div>
          <button onClick={onCerrar} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ marginTop: 10, background: '#f5f3ff', borderRadius: 8, padding: '8px 10px', fontSize: 12.5 }}>
          <div style={{ fontWeight: 700, color: '#6d28d9' }}>De dónde viene: {origenTexto(lead)}</div>
          <div style={{ color: telefono ? '#15803d' : '#b45309', marginTop: 2 }}>
            {telefono ? <>💬 WhatsApp +{celularParaWhatsApp(telefono)}. El botón abre el chat con el mensaje escrito; usted solo oprime enviar.</>
              : 'Sin celular reconocible: copie el mensaje y envíelo por correo.'}
          </div>
          {datos.revisar_icp && <div style={{ color: '#b45309', marginTop: 2 }}>⚠ Por lo que escribió en "ISP" puede no ser un operador. Confírmelo en el primer contacto.</div>}
          {envios.length > 1 && envios.map(e => (
            <div key={e.id} style={{ marginTop: 4, color: '#555' }}>
              • {ORIGEN_CORTO[e.origen ?? 'contacto'] ?? e.origen} · {new Date(e.created_at).toLocaleDateString('es-CO')}
              {e.asunto ? ` · ${e.asunto}` : ''}{e.reunion === 'Sí' ? ' · pidió reunión' : ''}
            </div>
          ))}
          {envios.length <= 1 && lead.mensaje && <div style={{ marginTop: 4, color: '#555' }}>{lead.mensaje}</div>}
        </div>

        {esSuperadmin && (
          <div style={{ marginTop: 10 }}>
            <label style={lbl}>Responsable</label>
            <select defaultValue={lead.responsable_id ?? ''} disabled={guardando}
              onChange={e => enviar({ responsable_id: e.target.value || null })} style={inp}>
              <option value="">Sin asignar</option>
              {admins.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
        )}

        <Cadencia lead={lead} telefono={telefono} vendedor={vendedor} ocupado={guardando} accion={a => enviar({ accion: a })} />
        <Guiones lead={lead} envios={envios} telefono={telefono} vendedor={vendedor} />

        {lead.etapa === 'nuevo' && !pasoActual(lead) && (
          <button onClick={() => enviar({ etapa: 'contactado', proxima_accion: f.proxima_accion || 'Seguimiento si no responde',
            proxima_fecha: hoyBogota(new Date(Date.now() + 3 * 86400_000)) })}
            disabled={guardando} title="Pasa a Contactado y deja seguimiento en 3 días"
            style={{ ...btn('#16a34a'), marginTop: 10, width: '100%', padding: '7px 0', fontSize: 12.5 }}>
            ✓ Ya le escribí: marcar contactado y seguimiento en 3 días
          </button>
        )}

        <label style={{ ...lbl, marginTop: 14 }}>Etapa</label>
        <select value={f.etapa} onChange={e => set('etapa', e.target.value)} style={inp}>
          {ETAPAS.map(e => <option key={e} value={e}>{ETAPA_LABEL[e]}</option>)}
        </select>

        <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: C.vino }}>Calificación (puntaje {puntaje(f)}/6)</div>
        {CRITERIOS.map(c => (
          <div key={c.campo} style={{ marginTop: 8 }}>
            <label style={lbl}>{c.nombre} <span style={{ fontWeight: 400, textTransform: 'none' }}>— {c.pista}</span></label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[0, 1, 2].map(n => (
                <button key={n} onClick={() => set(c.campo, n)} style={{ flex: 1, padding: '5px 0', fontSize: 12, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                  border: `1px solid ${f[c.campo] === n ? C.olivo : '#ddd'}`, background: f[c.campo] === n ? C.olivo : '#fff',
                  color: f[c.campo] === n ? '#fff' : '#555', fontWeight: 600 }}>{Q_LABEL[n]}</button>
              ))}
            </div>
          </div>
        ))}

        <label style={{ ...lbl, marginTop: 12 }}>Dolor en sus palabras</label>
        <textarea value={f.dolor_nota} onChange={e => set('dolor_nota', e.target.value)} rows={3} style={inp}
          placeholder="Ej.: le llegó un requerimiento de la SIC y no sabe qué responder" />

        <label style={{ ...lbl, marginTop: 12 }}>Plan objetivo</label>
        <select value={f.plan_objetivo} onChange={e => set('plan_objetivo', e.target.value)} style={inp}>
          <option value="">— sin definir —</option>
          {PLANES.map(p => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}
        </select>

        <label style={{ ...lbl, marginTop: 12 }}>Próxima acción</label>
        <input value={f.proxima_accion} onChange={e => set('proxima_accion', e.target.value)} style={inp} placeholder="Ej.: llamar para agendar reunión" />
        <label style={{ ...lbl, marginTop: 8 }}>Fecha</label>
        <input type="date" value={f.proxima_fecha} onChange={e => set('proxima_fecha', e.target.value)} style={inp} />

        {f.etapa === 'perdido' && (<>
          <label style={{ ...lbl, marginTop: 12 }}>Motivo del descarte</label>
          <input value={f.motivo_descarte} onChange={e => set('motivo_descarte', e.target.value)} style={inp} placeholder="Sin dolor / sin presupuesto / no decide / no responde" />
        </>)}

        {error && <div style={{ marginTop: 12, color: '#b91c1c', fontSize: 12.5, background: '#fef2f2', padding: 8, borderRadius: 6 }}>{error}</div>}
        <button onClick={guardar} disabled={guardando} style={{ marginTop: 16, width: '100%', padding: '9px 0', background: C.vino, color: '#fff',
          border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

/** Orden de trabajo: atrasados primero, luego más calientes y, entre asistentes, quien más tiempo estuvo conectado. */
const prioridad = (a: any, b: any) =>
  (a.proxima_fecha ?? '9999').localeCompare(b.proxima_fecha ?? '9999') ||
  temperaturaDe(a) - temperaturaDe(b) || Number(b.minutos_webinar ?? 0) - Number(a.minutos_webinar ?? 0) || puntaje(b) - puntaje(a)

/** `envios` = cada formulario recibido (para mostrar el historial del contacto); el tablero usa `pipeline.leads`. */
export default function PipelineBoard({ envios, pipeline, vendedor, esSuperadmin = false, onCambio }: {
  envios: any[]; pipeline: any; vendedor: string | null; esSuperadmin?: boolean; onCambio: () => void
}) {
  const leads: any[] = pipeline?.leads ?? []
  const [abierto, setAbierto] = useState<any>(null)
  const [vista, setVista] = useState<'hoy' | 'tablero'>('hoy')
  const [responsable, setResponsable] = useState('todos')
  const [segmento, setSegmento] = useState<'todos' | 'asistio' | 'inscrito'>('todos')
  const [verPerdidos, setVerPerdidos] = useState(false)
  const [admins, setAdmins] = useState<any[]>([])

  useEffect(() => {
    if (!esSuperadmin) return
    fetch('/api/admins').then(r => (r.ok ? r.json() : [])).then(a => setAdmins(Array.isArray(a) ? a : [])).catch(() => {})
  }, [esSuperadmin])

  const filtrados = useMemo(() => leads.filter(l => {
    if (responsable === 'sin' ? l.responsable_id : responsable !== 'todos' && l.responsable_id !== responsable) return false
    if (segmento === 'asistio' && temperaturaDe(l) !== 1) return false
    if (segmento === 'inscrito' && !(temperaturaDe(l) === 2 && String(l.origenes ?? l.origen).includes('webinar'))) return false
    return true
  }), [leads, responsable, segmento])

  const hoy = useMemo(() => filtrados.filter(paraHoy).sort(prioridad), [filtrados])

  const columnas = useMemo(() => {
    const out: Record<string, any[]> = {}
    for (const e of ETAPAS) out[e] = []
    for (const l of filtrados) (out[l.etapa] ?? out.nuevo).push(l)
    for (const e of ETAPAS) out[e].sort(prioridad)
    return out
  }, [filtrados])

  const responsables = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of leads) if (l.responsable_id) m.set(l.responsable_id, l.responsable_nombre ?? l.responsable_id)
    return [...m.entries()]
  }, [leads])

  const embudo: { etapa: Etapa; cnt: number }[] = pipeline?.embudo ?? []
  const base = embudo[0]?.cnt || 0
  const chip = (on: boolean): React.CSSProperties => ({ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 14, cursor: 'pointer',
    fontFamily: 'inherit', border: `1px solid ${C.vino}`, background: on ? C.vino : 'transparent', color: on ? '#fff' : C.vino })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem 1.25rem' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.vino, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Embudo (llegaron a cada etapa){!esSuperadmin && ' · sus leads'}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {embudo.map((e, i) => {
            const prev = i > 0 ? embudo[i - 1].cnt : 0
            return (
              <div key={e.etapa} style={{ flex: '1 1 130px', borderTop: `4px solid ${ETAPA_COLOR[e.etapa]}`, background: '#faf8f3', borderRadius: 6, padding: '8px 10px' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: C.vino }}>{e.cnt}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>{ETAPA_LABEL[e.etapa]}</div>
                <div style={{ fontSize: 11, color: '#aaa' }}>
                  {i === 0 ? 'base' : prev ? `${Math.round((e.cnt / prev) * 100)}% de la anterior` : '—'}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: '#666', display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <span><b>Reuniones realizadas por semana:</b> {(pipeline?.reunionesRealizadasPorSemana ?? []).map((r: any) => `sem ${r.semana.slice(5)}: ${r.cnt}`).join(' · ') || 'aún sin datos'}</span>
          <span>Agendadas: {(pipeline?.reunionesAgendadasPorSemana ?? []).map((r: any) => `sem ${r.semana.slice(5)}: ${r.cnt}`).join(' · ') || '—'}</span>
          <span style={{ color: pipeline?.atrasados ? '#dc2626' : '#666', fontWeight: pipeline?.atrasados ? 700 : 400 }}>
            Seguimientos atrasados: {pipeline?.atrasados ?? 0}
          </span>
          {base > 0 && <span>Conversión total a ganado: {Math.round(((embudo.at(-1)?.cnt ?? 0) / base) * 100)}%</span>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5 }}>
        <button onClick={() => setVista('hoy')} style={chip(vista === 'hoy')}>Para hoy ({hoy.length})</button>
        <button onClick={() => setVista('tablero')} style={chip(vista === 'tablero')}>Tablero</button>
        <span style={{ width: 12 }} />
        {([['todos', 'Todos'], ['asistio', 'Asistieron al webinar'], ['inscrito', 'Inscritos, no asistieron']] as const).map(([k, t]) => (
          <button key={k} onClick={() => setSegmento(k)} style={{ ...chip(segmento === k), borderColor: '#6d28d9',
            background: segmento === k ? '#6d28d9' : 'transparent', color: segmento === k ? '#fff' : '#6d28d9' }}>{t}</button>
        ))}
        {esSuperadmin && (
          <select value={responsable} onChange={e => setResponsable(e.target.value)}
            style={{ marginLeft: 6, padding: '4px 8px', borderRadius: 8, border: '1px solid #ddd', fontFamily: 'inherit', fontSize: 12 }}>
            <option value="todos">Todos los responsables</option>
            {responsables.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            <option value="sin">Sin asignar</option>
          </select>
        )}
        {vista === 'tablero' && (
          <label style={{ marginLeft: 6 }}><input type="checkbox" checked={verPerdidos} onChange={e => setVerPerdidos(e.target.checked)} /> Mostrar perdidos ({columnas.perdido.length})</label>
        )}
      </div>

      {vista === 'hoy' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '0.5rem 0' }}>
          {hoy.length === 0 && <p style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: '2rem' }}>No hay nada pendiente para hoy.</p>}
          {hoy.map(l => {
            const atrasada = l.proxima_fecha < hoyBogota()
            return (
              <div key={l.id} onClick={() => setAbierto(l)} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 14px',
                borderBottom: '1px solid #f3f3f3', cursor: 'pointer', borderLeft: `4px solid ${TEMPERATURA_COLOR[temperaturaDe(l)]}` }}>
                <div style={{ flex: '1 1 40%', minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: C.vino, fontSize: 13 }}>{l.empresa || l.nombre}</div>
                  <div style={{ fontSize: 11.5, color: '#666' }}>{l.nombre} · <span style={{ color: '#6d28d9' }}>{origenTexto(l)}</span></div>
                </div>
                <div style={{ flex: '1 1 45%', fontSize: 12, color: atrasada ? '#dc2626' : '#333', fontWeight: atrasada ? 700 : 400 }}>
                  {atrasada ? `⚠ Atrasado (${l.proxima_fecha}) · ` : ''}{siguienteTexto(l)}
                </div>
                {esSuperadmin && <div style={{ fontSize: 11, color: '#888', width: 110, textAlign: 'right' }}>{l.responsable_nombre ?? 'Sin asignar'}</div>}
              </div>
            )
          })}
        </div>
      )}

      {vista === 'tablero' && (
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', alignItems: 'flex-start', paddingBottom: 8 }}>
          {[...ETAPAS_ACTIVAS, ...(verPerdidos ? (['perdido'] as Etapa[]) : [])].map(e => (
            <div key={e} style={{ minWidth: 230, flex: '0 0 230px', background: '#efece4', borderRadius: 10, padding: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: ETAPA_COLOR[e], textTransform: 'uppercase', marginBottom: 8 }}>
                {ETAPA_LABEL[e]} ({columnas[e].length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '60vh', overflowY: 'auto' }}>
                {columnas[e].map(l => <Tarjeta key={l.id} l={l} verResponsable={esSuperadmin} onAbrir={() => setAbierto(l)} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {abierto && <Detalle lead={abierto} esSuperadmin={esSuperadmin}
        admins={[...admins, ...responsables.filter(([id]) => !admins.some(a => a.id === id)).map(([id, nombre]) => ({ id, nombre }))]}
        envios={envios.filter(e => e.id === abierto.id || e.principal_id === abierto.id).length
          ? envios.filter(e => e.id === abierto.id || e.principal_id === abierto.id) : [abierto]}
        vendedor={vendedor} onCerrar={() => setAbierto(null)} onGuardado={onCambio} />}
    </div>
  )
}
