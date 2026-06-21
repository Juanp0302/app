'use client'

import { useEffect, useState, useCallback } from 'react'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const DIAS_SEMANA = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

const ASPECTO_COLOR: Record<string, string> = {
  FINANCIERO:   '#f59e0b',
  JURÍDICO:     '#8b5cf6',
  TÉCNICO:      '#3b82f6',
  TRANSVERSAL:  '#10b981',
  ADMINISTRATIVO: '#ec4899',
}

const URGENCIA_COLOR: Record<string, string> = {
  critica: '#dc2626',
  proxima: '#f59e0b',
  normal:  '#968622',
}

const ESTADO_COLOR: Record<string, string> = {
  pendiente:   '#968622',
  en_progreso: '#3b82f6',
  cumplida:    '#16a34a',
  vencida:     '#dc2626',
  no_aplica:   '#6b7280',
}

interface Evento {
  obl_id:       string
  fecha:        string
  label:        string
  urgencia:     string
  estado:       string
  sub_titulo:   string
  obligacion:   string
  aspecto:      string
  grupo:        string
  servicio:     string
  periodicidad: string
}

export default function CalendarioClient({
  userRole, clienteId: initialId, clientes,
}: {
  userRole:  string
  clienteId: string | null
  clientes:  any[]
}) {
  const hoy     = new Date()
  const [clienteId,  setClienteId]  = useState(initialId)
  const [anio,       setAnio]       = useState(hoy.getFullYear())
  const [mesActual,  setMesActual]  = useState(hoy.getMonth())   // 0-11
  const [data,       setData]       = useState<any>(null)
  const [loading,    setLoading]    = useState(false)
  const [diaSelec,   setDiaSelec]   = useState<string | null>(null)  // YYYY-MM-DD

  const cargar = useCallback(async (cid: string, yr: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/calendario?clienteId=${cid}&anio=${yr}`)
      setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (clienteId) cargar(clienteId, anio)
  }, [clienteId, anio, cargar])

  // Eventos del mes visible
  const clavesMes    = data ? Object.keys(data.porMes).sort() : []
  const claveMes     = `${anio}-${String(mesActual + 1).padStart(2, '0')}`
  const eventosMes   = (data?.porMes?.[claveMes] ?? []) as Evento[]
  const eventosDia   = diaSelec ? eventosMes.filter(e => e.fecha === diaSelec) : []

  // Construir grilla del mes
  function buildGrid(anio: number, mes: number) {
    const primerDia = new Date(anio, mes, 1).getDay()
    const dias      = new Date(anio, mes + 1, 0).getDate()
    const grid: (number | null)[] = Array(primerDia).fill(null)
    for (let d = 1; d <= dias; d++) grid.push(d)
    while (grid.length % 7 !== 0) grid.push(null)
    return grid
  }

  const grid = buildGrid(anio, mesActual)

  // Índice de eventos por día para la grilla
  const eventosPorDia: Record<string, Evento[]> = {}
  for (const ev of eventosMes) {
    if (!eventosPorDia[ev.fecha]) eventosPorDia[ev.fecha] = []
    eventosPorDia[ev.fecha].push(ev)
  }

  function diaStr(d: number) {
    return `${anio}-${String(mesActual + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }

  function navMes(dir: 1 | -1) {
    let m = mesActual + dir
    let y = anio
    if (m < 0)  { m = 11; y-- }
    if (m > 11) { m = 0;  y++ }
    setMesActual(m)
    setAnio(y)
    setDiaSelec(null)
  }

  return (
    <div style={{ minHeight:'100vh', background: C.vino, fontFamily:"'Josefin Sans', sans-serif", color: C.marfil }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      {/* NAV */}
      <nav style={{ background:'rgba(39,2,5,0.97)', borderBottom:'1px solid rgba(150,134,34,0.2)', padding:'0.9rem 2rem', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'1.5rem' }}>
          <a href="/dashboard" style={{ fontFamily:"'Playfair Display', serif", fontSize:'1.1rem', fontWeight:700, color:C.marfil, textDecoration:'none' }}>Owl Compliance</a>
          <span style={{ color:'rgba(231,223,202,0.3)' }}>›</span>
          <span style={{ fontSize:'0.72rem', fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase', color:C.olivo }}>Calendario de Obligaciones</span>
        </div>
        <a href="/signout" style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:'rgba(231,223,202,0.5)', textDecoration:'none' }}>Salir</a>
      </nav>

      <main style={{ maxWidth:'1300px', margin:'0 auto', padding:'2rem', display:'grid', gridTemplateColumns:'1fr 360px', gap:'2rem', alignItems:'start' }}>

        {/* ── COLUMNA IZQUIERDA: Calendario ── */}
        <div>
          {/* Selector de cliente (admin) */}
          {userRole === 'admin' && clientes.length > 0 && (
            <div style={{ marginBottom:'1.5rem' }}>
              <select
                value={clienteId ?? ''}
                onChange={e => setClienteId(e.target.value)}
                style={{ background:'rgba(231,223,202,0.08)', border:'1px solid rgba(150,134,34,0.35)', borderRadius:'8px', padding:'0.7rem 1rem', color:C.marfil, fontSize:'0.9rem', fontFamily:'inherit', width:'100%', maxWidth:'420px', cursor:'pointer' }}
              >
                <option value="" disabled>Selecciona un cliente…</option>
                {clientes.map((c:any) => (
                  <option key={c.id} value={c.id} style={{ background:C.vino }}>{c.razon_social}</option>
                ))}
              </select>
            </div>
          )}

          {/* Header mes */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.5rem' }}>
            <button onClick={() => navMes(-1)} style={{ background:'rgba(231,223,202,0.08)', border:'1px solid rgba(150,134,34,0.25)', borderRadius:'8px', padding:'0.5rem 1rem', color:C.marfil, cursor:'pointer', fontFamily:'inherit', fontSize:'1rem' }}>‹</button>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:"'Playfair Display', serif", fontSize:'1.6rem', fontWeight:700 }}>{MESES[mesActual]}</div>
              <div style={{ fontSize:'0.72rem', color:'rgba(231,223,202,0.5)', letterSpacing:'0.15em' }}>{anio}</div>
            </div>
            <button onClick={() => navMes(1)} style={{ background:'rgba(231,223,202,0.08)', border:'1px solid rgba(150,134,34,0.25)', borderRadius:'8px', padding:'0.5rem 1rem', color:C.marfil, cursor:'pointer', fontFamily:'inherit', fontSize:'1rem' }}>›</button>
          </div>

          {/* Grilla del calendario */}
          <div style={{ border:'1px solid rgba(150,134,34,0.2)', borderRadius:'12px', overflow:'hidden' }}>
            {/* Encabezados días */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', background:'rgba(150,134,34,0.1)' }}>
              {DIAS_SEMANA.map(d => (
                <div key={d} style={{ padding:'0.6rem', textAlign:'center', fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(231,223,202,0.5)' }}>{d}</div>
              ))}
            </div>

            {/* Días */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
              {grid.map((dia, idx) => {
                if (dia === null) {
                  return <div key={`empty-${idx}`} style={{ minHeight:'80px', borderTop:'1px solid rgba(231,223,202,0.05)', borderRight:'1px solid rgba(231,223,202,0.05)' }} />
                }

                const fecha     = diaStr(dia)
                const evs       = eventosPorDia[fecha] ?? []
                const esHoy     = fecha === hoy.toISOString().slice(0,10)
                const esSel     = fecha === diaSelec
                const tieneCrit = evs.some(e => e.urgencia === 'critica' && e.estado !== 'cumplida')
                const tieneProx = evs.some(e => e.urgencia === 'proxima' && e.estado !== 'cumplida')

                return (
                  <div
                    key={fecha}
                    onClick={() => evs.length > 0 && setDiaSelec(esSel ? null : fecha)}
                    style={{
                      minHeight:'80px', padding:'0.4rem', borderTop:'1px solid rgba(231,223,202,0.05)', borderRight:'1px solid rgba(231,223,202,0.05)',
                      background: esSel ? 'rgba(150,134,34,0.18)' : esHoy ? 'rgba(150,134,34,0.08)' : 'transparent',
                      cursor: evs.length > 0 ? 'pointer' : 'default',
                      transition:'background 0.15s',
                    }}
                  >
                    {/* Número del día */}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.3rem' }}>
                      <span style={{
                        fontSize:'0.82rem', fontWeight: esHoy ? 700 : 400,
                        color: esHoy ? C.olivo : 'rgba(231,223,202,0.7)',
                        background: esHoy ? 'rgba(150,134,34,0.2)' : 'transparent',
                        borderRadius:'50%', width:'24px', height:'24px', display:'flex', alignItems:'center', justifyContent:'center',
                      }}>{dia}</span>
                      {tieneCrit && <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#dc2626', flexShrink:0 }} />}
                      {!tieneCrit && tieneProx && <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#f59e0b', flexShrink:0 }} />}
                    </div>

                    {/* Etiquetas de eventos (máx 3 visibles) */}
                    {evs.slice(0, 3).map((ev, i) => (
                      <div key={i} style={{
                        fontSize:'0.58rem', fontWeight:600, letterSpacing:'0.06em',
                        background: ev.estado === 'cumplida' ? 'rgba(22,163,74,0.15)' : `${ASPECTO_COLOR[ev.aspecto] ?? C.olivo}22`,
                        color: ev.estado === 'cumplida' ? '#16a34a' : (ASPECTO_COLOR[ev.aspecto] ?? C.olivo),
                        padding:'0.15rem 0.4rem', borderRadius:'3px', marginBottom:'0.15rem',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                        textDecoration: ev.estado === 'cumplida' ? 'line-through' : 'none',
                      }}>
                        {ev.obligacion.length > 18 ? ev.obligacion.slice(0,18)+'…' : ev.obligacion}
                      </div>
                    ))}
                    {evs.length > 3 && (
                      <div style={{ fontSize:'0.58rem', color:'rgba(231,223,202,0.4)', paddingLeft:'0.4rem' }}>+{evs.length - 3} más</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Leyenda */}
          <div style={{ display:'flex', gap:'1.5rem', flexWrap:'wrap', marginTop:'1rem', padding:'0 0.5rem' }}>
            {Object.entries(ASPECTO_COLOR).map(([asp, color]) => (
              <div key={asp} style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
                <span style={{ width:'10px', height:'10px', borderRadius:'2px', background: color, opacity:0.8 }} />
                <span style={{ fontSize:'0.62rem', color:'rgba(231,223,202,0.5)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{asp}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── COLUMNA DERECHA: Panel lateral ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>

          {/* Próximos vencimientos */}
          {data?.proximos?.length > 0 && (
            <div style={{ background:'rgba(231,223,202,0.05)', border:'1px solid rgba(150,134,34,0.2)', borderRadius:'12px', padding:'1.4rem' }}>
              <div style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase', color:C.olivo, marginBottom:'1rem' }}>
                Próximos vencimientos
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.7rem' }}>
                {data.proximos.map((ev: Evento, i: number) => (
                  <div key={i} style={{ borderLeft:`3px solid ${URGENCIA_COLOR[ev.urgencia]}`, paddingLeft:'0.8rem' }}>
                    <div style={{ fontSize:'0.72rem', fontWeight:700, color:URGENCIA_COLOR[ev.urgencia], marginBottom:'0.2rem' }}>
                      {formatFecha(ev.fecha)}
                    </div>
                    <div style={{ fontSize:'0.78rem', fontWeight:600, lineHeight:1.4, marginBottom:'0.2rem' }}>
                      {ev.obligacion}
                    </div>
                    <div style={{ fontSize:'0.65rem', color:'rgba(231,223,202,0.5)' }}>
                      {ev.aspecto} · {ev.periodicidad}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Eventos del día seleccionado */}
          {diaSelec && eventosDia.length > 0 && (
            <div style={{ background:'rgba(231,223,202,0.05)', border:'1px solid rgba(150,134,34,0.3)', borderRadius:'12px', padding:'1.4rem' }}>
              <div style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase', color:C.olivo, marginBottom:'0.3rem' }}>
                {formatFecha(diaSelec)}
              </div>
              <div style={{ fontSize:'1rem', fontFamily:"'Playfair Display', serif", fontWeight:700, marginBottom:'1rem' }}>
                {eventosDia.length} obligación{eventosDia.length > 1 ? 'es' : ''}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.8rem', maxHeight:'420px', overflowY:'auto' }}>
                {eventosDia.map((ev, i) => {
                  const aspColor = ASPECTO_COLOR[ev.aspecto] ?? C.olivo
                  const estColor = ESTADO_COLOR[ev.estado] ?? C.olivo
                  return (
                    <div key={i} style={{ background:'rgba(0,0,0,0.2)', borderRadius:'8px', padding:'0.9rem', borderLeft:`3px solid ${aspColor}` }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'0.5rem', marginBottom:'0.4rem' }}>
                        <div style={{ fontSize:'0.75rem', fontWeight:700, lineHeight:1.4, flex:1 }}>{ev.obligacion}</div>
                        <span style={{ fontSize:'0.62rem', fontWeight:700, background:`${estColor}22`, color:estColor, padding:'0.15rem 0.5rem', borderRadius:'8px', flexShrink:0 }}>
                          {ev.estado.replace('_',' ')}
                        </span>
                      </div>
                      <div style={{ fontSize:'0.68rem', color:'rgba(231,223,202,0.5)', marginBottom:'0.3rem' }}>
                        {ev.sub_titulo}
                      </div>
                      <div style={{ display:'flex', gap:'0.5rem' }}>
                        <span style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', background:`${aspColor}22`, color:aspColor, padding:'0.15rem 0.5rem', borderRadius:'8px' }}>{ev.aspecto}</span>
                        <span style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', background:'rgba(150,134,34,0.12)', color:C.olivo, padding:'0.15rem 0.5rem', borderRadius:'8px' }}>{ev.periodicidad}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Resumen del mes */}
          {data && (
            <div style={{ background:'rgba(231,223,202,0.05)', border:'1px solid rgba(150,134,34,0.2)', borderRadius:'12px', padding:'1.4rem' }}>
              <div style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase', color:C.olivo, marginBottom:'1rem' }}>
                Resumen — {MESES[mesActual]}
              </div>
              {(() => {
                const r = data.resumen?.find((m: any) => m.mes === claveMes)
                if (!r) return <div style={{ fontSize:'0.8rem', color:'rgba(231,223,202,0.4)' }}>Sin obligaciones este mes</div>
                return (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.8rem' }}>
                    {[
                      { label:'Total',      val: r.total,      color:'rgba(231,223,202,0.7)' },
                      { label:'Cumplidas',  val: r.cumplidas,  color:'#16a34a' },
                      { label:'Pendientes', val: r.pendientes, color:C.olivo },
                      { label:'Vencidas',   val: r.vencidas,   color:'#dc2626' },
                    ].map(item => (
                      <div key={item.label} style={{ textAlign:'center' }}>
                        <div style={{ fontSize:'1.6rem', fontWeight:700, color:item.color, fontFamily:"'Playfair Display', serif" }}>{item.val}</div>
                        <div style={{ fontSize:'0.62rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(231,223,202,0.45)' }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          )}

          {/* Vista anual compacta */}
          {data?.resumen?.length > 0 && (
            <div style={{ background:'rgba(231,223,202,0.05)', border:'1px solid rgba(150,134,34,0.2)', borderRadius:'12px', padding:'1.4rem' }}>
              <div style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase', color:C.olivo, marginBottom:'1rem' }}>
                Vista anual {anio}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                {MESES.map((m, i) => {
                  const clave = `${anio}-${String(i+1).padStart(2,'0')}`
                  const r     = data.resumen?.find((mr: any) => mr.mes === clave)
                  const total = r?.total ?? 0
                  const cum   = r?.cumplidas ?? 0
                  const pct   = total ? Math.round((cum/total)*100) : 0
                  const esAct = i === mesActual
                  return (
                    <div
                      key={m}
                      onClick={() => { setMesActual(i); setAnio(anio); setDiaSelec(null) }}
                      style={{ display:'flex', alignItems:'center', gap:'0.8rem', cursor:'pointer', padding:'0.3rem 0.4rem', borderRadius:'6px', background: esAct ? 'rgba(150,134,34,0.15)' : 'transparent' }}
                    >
                      <span style={{ fontSize:'0.7rem', fontWeight: esAct ? 700 : 400, color: esAct ? C.olivo : 'rgba(231,223,202,0.6)', width:'70px', flexShrink:0 }}>{m}</span>
                      <div style={{ flex:1, height:'5px', background:'rgba(231,223,202,0.1)', borderRadius:'3px', overflow:'hidden' }}>
                        {total > 0 && <div style={{ height:'100%', width:`${pct}%`, background: pct >= 80 ? '#16a34a' : pct >= 50 ? C.olivo : '#dc2626', borderRadius:'3px' }} />}
                      </div>
                      <span style={{ fontSize:'0.65rem', color:'rgba(231,223,202,0.4)', width:'28px', textAlign:'right', flexShrink:0 }}>
                        {total > 0 ? `${pct}%` : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${parseInt(d)} ${meses[parseInt(m)-1]} ${y}`
}
