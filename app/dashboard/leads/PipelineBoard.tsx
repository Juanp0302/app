'use client'

import { useMemo, useState } from 'react'
import {
  ETAPAS, ETAPAS_ACTIVAS, ETAPA_LABEL, ETAPA_COLOR, PLANES, PLAN_LABEL, CRITERIOS,
  puntaje, temperaturaDe, TEMPERATURA_LABEL, TEMPERATURA_COLOR, hoyBogota, type Etapa,
} from '@/lib/pipeline'
import { guionesPara } from '@/lib/guiones-ventas'
import { celularParaWhatsApp, enlaceWhatsApp } from '@/lib/whatsapp'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622' }
const Q_LABEL = ['Sin info', 'Parcial', 'Confirmado']
const ORIGEN_CORTO: Record<string, string> = { webinar: 'Webinar', autodiagnostico: 'Autodiag.', contacto: 'Contacto' }

function Tarjeta({ l, onAbrir }: { l: any; onAbrir: () => void }) {
  const t = temperaturaDe(l)
  const atrasada = l.proxima_fecha && l.proxima_fecha < hoyBogota() && !['ganado', 'perdido'].includes(l.etapa)
  return (
    <div onClick={onAbrir} style={{ background: '#fff', border: '1px solid #e5e7eb', borderLeft: `4px solid ${TEMPERATURA_COLOR[t]}`,
      borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontSize: 12.5 }}>
      <div style={{ fontWeight: 700, color: C.vino }}>{l.empresa || l.nombre || '(sin nombre)'}</div>
      {l.empresa && l.nombre && <div style={{ color: '#666' }}>{l.nombre}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, color: '#888', fontSize: 11 }}>
        <span title={TEMPERATURA_LABEL[t]}>{TEMPERATURA_LABEL[t]}</span>
        <span title="Dolor + Presupuesto + Decisión (máx. 6)">{puntaje(l)}/6</span>
      </div>
      {Number(l.formularios) > 1 && (
        <div style={{ marginTop: 3, fontSize: 10.5, color: '#6d28d9' }} title="Formularios que ha llenado este contacto">
          {Number(l.formularios)} formularios · {(l.origenes ?? '').split(',').map((o: string) => ORIGEN_CORTO[o] ?? o).join(', ')}
        </div>
      )}
      {l.proxima_accion && (
        <div style={{ marginTop: 4, fontSize: 11, color: atrasada ? '#dc2626' : '#555', fontWeight: atrasada ? 700 : 400 }}>
          {atrasada ? '⚠ ' : '→ '}{l.proxima_accion}{l.proxima_fecha ? ` (${l.proxima_fecha})` : ''}
        </div>
      )}
    </div>
  )
}

/** Fecha AAAA-MM-DD en Bogotá dentro de `dias` días. */
const enDias = (dias: number) => hoyBogota(new Date(Date.now() + dias * 86400_000))

function Guiones({ lead, envios, vendedor }: { lead: any; envios: any[]; vendedor: string | null }) {
  const [copiado, setCopiado] = useState<string | null>(null)
  // El teléfono puede estar en cualquiera de sus formularios.
  const telefono = [lead.telefono, ...envios.map(e => e.telefono)].find(t => celularParaWhatsApp(t)) ?? null
  const guiones = guionesPara(lead, envios, vendedor)
  if (!guiones.length) return null

  function copiar(id: string, texto: string) {
    navigator.clipboard?.writeText(texto).then(() => { setCopiado(id); setTimeout(() => setCopiado(null), 1500) }).catch(() => {})
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.vino }}>Qué decirle</div>
      <div style={{ fontSize: 11.5, color: telefono ? '#15803d' : '#b45309', margin: '3px 0 6px' }}>
        {telefono
          ? <>💬 WhatsApp: <b>+{celularParaWhatsApp(telefono)}</b>. El botón abre el chat con el mensaje escrito; usted solo oprime enviar.</>
          : 'No tiene un celular reconocible: copie el mensaje y envíelo por correo, o llame.'}
        {' '}Complete lo que está [ENTRE CORCHETES] antes de enviar.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {guiones.map(g => {
          const wa = g.canal === 'whatsapp' ? enlaceWhatsApp(telefono, g.texto) : null
          return (
            <div key={g.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.olivo }}>{g.titulo}</span>
                <div style={{ display: 'flex', gap: 5 }}>
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 700, background: '#16a34a',
                      color: '#fff', borderRadius: 6, padding: '3px 9px', textDecoration: 'none' }}>💬 Abrir en WhatsApp</a>
                  )}
                  <button onClick={() => copiar(g.id, g.texto)} style={{ fontSize: 11, fontWeight: 700, background: 'none', border: `1px solid ${C.olivo}`,
                    color: C.olivo, borderRadius: 6, padding: '3px 9px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {copiado === g.id ? '✓ Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#999', margin: '2px 0 4px' }}>{g.cuando}</div>
              <div style={{ fontSize: 12.5, color: '#333', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{g.texto}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Detalle({ lead, envios, vendedor, onCerrar, onGuardado }: {
  lead: any; envios: any[]; vendedor: string | null; onCerrar: () => void; onGuardado: () => void
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

  async function guardar(extra: Partial<typeof f> = {}) {
    setGuardando(true); setError('')
    const datos = { ...f, ...extra }
    try {
      const r = await fetch('/api/leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.id, ...datos, plan_objetivo: datos.plan_objetivo || null, proxima_fecha: datos.proxima_fecha || null }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setError(j.error ?? 'No se pudo guardar'); return }
      onGuardado(); onCerrar()
    } finally { setGuardando(false) }
  }

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 420, maxWidth: '100%', background: '#fff', padding: '1.25rem', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.vino }}>{lead.empresa || lead.nombre}</div>
            <div style={{ fontSize: 12, color: '#666' }}>{[lead.nombre, lead.correo, lead.telefono].filter(Boolean).join(' · ')}</div>
          </div>
          <button onClick={onCerrar} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {envios.map(e => (
            <div key={e.id} style={{ fontSize: 12, background: '#faf8f3', padding: 8, borderRadius: 6 }}>
              <div style={{ fontWeight: 700, color: '#6d28d9' }}>
                {ORIGEN_CORTO[e.origen ?? 'contacto'] ?? e.origen} · {new Date(e.created_at).toLocaleDateString('es-CO')}
                {e.asistio_webinar ? ' · asistió' : ''}{e.reunion === 'Sí' ? ' · pidió reunión' : ''}
              </div>
              {e.asunto && <div>{e.asunto}</div>}
              {e.mensaje && <div style={{ color: '#555' }}>{e.mensaje}</div>}
            </div>
          ))}
        </div>

        <Guiones lead={lead} envios={envios} vendedor={vendedor} />

        {lead.etapa === 'nuevo' && (
          <button onClick={() => guardar({ etapa: 'contactado', proxima_accion: f.proxima_accion || 'Seguimiento si no responde', proxima_fecha: enDias(3) })}
            disabled={guardando} title="Pasa a Contactado y deja seguimiento en 3 días"
            style={{ marginTop: 10, width: '100%', padding: '7px 0', background: '#fff', color: '#15803d', border: '1px solid #16a34a',
              borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5 }}>
            ✓ Ya le escribí: marcar contactado y seguimiento en 3 días
          </button>
        )}

        <label style={{ ...lbl, marginTop: 12 }}>Etapa</label>
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
        <button onClick={() => guardar()} disabled={guardando} style={{ marginTop: 16, width: '100%', padding: '9px 0', background: C.vino, color: '#fff',
          border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

/** `envios` = cada formulario recibido (para mostrar el historial del contacto); el tablero usa `pipeline.leads`. */
export default function PipelineBoard({ envios, pipeline, vendedor, onCambio }: {
  envios: any[]; pipeline: any; vendedor: string | null; onCambio: () => void
}) {
  const leads: any[] = pipeline?.leads ?? []
  const [abierto, setAbierto] = useState<any>(null)
  const [soloCalientes, setSoloCalientes] = useState(false)
  const [verPerdidos, setVerPerdidos] = useState(false)

  const columnas = useMemo(() => {
    const out: Record<string, any[]> = {}
    for (const e of ETAPAS) out[e] = []
    for (const l of leads) {
      if (soloCalientes && temperaturaDe(l) > 2) continue
      ;(out[l.etapa] ?? out.nuevo).push(l)
    }
    for (const e of ETAPAS) out[e].sort((a, b) => temperaturaDe(a) - temperaturaDe(b) || puntaje(b) - puntaje(a))
    return out
  }, [leads, soloCalientes])

  const embudo: { etapa: Etapa; cnt: number }[] = pipeline?.embudo ?? []
  const base = embudo[0]?.cnt || 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem 1.25rem' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.vino, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Embudo (llegaron a cada etapa)
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

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12.5 }}>
        <label><input type="checkbox" checked={soloCalientes} onChange={e => setSoloCalientes(e.target.checked)} /> Solo webinar (asistentes e inscritos)</label>
        <label><input type="checkbox" checked={verPerdidos} onChange={e => setVerPerdidos(e.target.checked)} /> Mostrar perdidos ({columnas.perdido.length})</label>
      </div>

      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', alignItems: 'flex-start', paddingBottom: 8 }}>
        {[...ETAPAS_ACTIVAS, ...(verPerdidos ? (['perdido'] as Etapa[]) : [])].map(e => (
          <div key={e} style={{ minWidth: 230, flex: '0 0 230px', background: '#efece4', borderRadius: 10, padding: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: ETAPA_COLOR[e], textTransform: 'uppercase', marginBottom: 8 }}>
              {ETAPA_LABEL[e]} ({columnas[e].length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '60vh', overflowY: 'auto' }}>
              {columnas[e].map(l => <Tarjeta key={l.id} l={l} onAbrir={() => setAbierto(l)} />)}
            </div>
          </div>
        ))}
      </div>

      {abierto && <Detalle lead={abierto}
        envios={envios.filter(e => e.id === abierto.id || e.principal_id === abierto.id).length
          ? envios.filter(e => e.id === abierto.id || e.principal_id === abierto.id) : [abierto]}
        vendedor={vendedor} onCerrar={() => setAbierto(null)} onGuardado={onCambio} />}
    </div>
  )
}
