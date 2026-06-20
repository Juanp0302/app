'use client'

import { useEffect, useState } from 'react'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

const UMBRALES = [
  { dias: 10, label: '10 días antes',  color: '#3b82f6' },
  { dias: 5,  label: '5 días antes',   color: '#f59e0b' },
  { dias: 2,  label: '2 días antes',   color: '#f97316' },
  { dias: 0,  label: 'El mismo día',   color: '#dc2626' },
  { dias: -1, label: '1 día después',  color: '#7c3aed' },
]

function formatFecha(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('es-CO', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

export default function RecordatoriosPage() {
  const [data,      setData]      = useState<any>(null)
  const [loading,   setLoading]   = useState(true)
  const [ejecutando, setEjecutando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)

  async function cargar() {
    setLoading(true)
    try {
      const res = await fetch('/api/recordatorios')
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  async function ejecutarAhora() {
    setEjecutando(true)
    setResultado(null)
    try {
      const res  = await fetch('/api/recordatorios', { method: 'POST' })
      const json = await res.json()
      setResultado(json.resultado)
      cargar()
    } finally {
      setEjecutando(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:C.vino, fontFamily:"'Josefin Sans', sans-serif", color:C.marfil }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      {/* NAV */}
      <nav style={{ background:'rgba(39,2,5,0.97)', borderBottom:'1px solid rgba(150,134,34,0.2)', padding:'0.9rem 2rem', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'1.5rem' }}>
          <a href="/dashboard" style={{ fontFamily:"'Playfair Display', serif", fontSize:'1.1rem', fontWeight:700, color:C.marfil, textDecoration:'none' }}>Owl Compliance</a>
          <span style={{ color:'rgba(231,223,202,0.3)' }}>›</span>
          <span style={{ fontSize:'0.72rem', fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase', color:C.olivo }}>Recordatorios</span>
        </div>
        <a href="/api/auth/signout" style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:'rgba(231,223,202,0.5)', textDecoration:'none' }}>Salir</a>
      </nav>

      <main style={{ maxWidth:'1000px', margin:'0 auto', padding:'2rem' }}>

        {/* ── CONFIGURACIÓN ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem', marginBottom:'2rem' }}>

          {/* Umbrales */}
          <div style={{ background:'rgba(231,223,202,0.05)', border:'1px solid rgba(150,134,34,0.2)', borderRadius:'12px', padding:'1.5rem' }}>
            <div style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase', color:C.olivo, marginBottom:'1rem' }}>
              Cuándo se envían los recordatorios
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
              {UMBRALES.map(u => (
                <div key={u.dias} style={{ display:'flex', alignItems:'center', gap:'0.8rem' }}>
                  <span style={{ width:'10px', height:'10px', borderRadius:'50%', background:u.color, flexShrink:0 }} />
                  <span style={{ fontSize:'0.82rem' }}>{u.label}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop:'1rem', fontSize:'0.7rem', color:'rgba(231,223,202,0.45)', lineHeight:1.6 }}>
              Se envía un email a ti y al cliente en cada uno de estos momentos, por cada obligación que tenga vencimiento próximo.
            </div>
          </div>

          {/* Configuración email + botón ejecutar */}
          <div style={{ background:'rgba(231,223,202,0.05)', border:'1px solid rgba(150,134,34,0.2)', borderRadius:'12px', padding:'1.5rem' }}>
            <div style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase', color:C.olivo, marginBottom:'1rem' }}>
              Configuración de email
            </div>

            <div style={{ marginBottom:'0.8rem' }}>
              <div style={labelStyle}>Hora de envío diario</div>
              <div style={{ fontSize:'1rem', fontWeight:700 }}>8:00 AM</div>
            </div>

            <div style={{ marginBottom:'1.5rem' }}>
              <div style={labelStyle}>Para activar el envío real</div>
              <div style={{ fontSize:'0.78rem', lineHeight:1.7, color:'rgba(231,223,202,0.7)' }}>
                1. Crea cuenta gratuita en{' '}
                <a href="https://resend.com" target="_blank" style={{ color:C.olivo }}>resend.com</a><br/>
                2. Obtén tu API key<br/>
                3. Agrégala en <code style={{ background:'rgba(0,0,0,0.3)', padding:'0.1rem 0.4rem', borderRadius:'4px', fontSize:'0.75rem' }}>.env.local</code> como:<br/>
                <code style={{ background:'rgba(0,0,0,0.3)', padding:'0.3rem 0.6rem', borderRadius:'4px', fontSize:'0.72rem', display:'block', marginTop:'0.4rem' }}>
                  RESEND_API_KEY=re_xxxxxx<br/>
                  ADMIN_EMAIL=jposoriomarin@gmail.com<br/>
                  EMAIL_FROM=recordatorios@owlcompliance.co
                </code>
              </div>
            </div>

            <button onClick={ejecutarAhora} disabled={ejecutando}
              style={{ width:'100%', background: ejecutando ? 'rgba(150,134,34,0.4)' : C.olivo, color:C.vino, border:'none', borderRadius:'8px', padding:'0.8rem', fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', cursor: ejecutando ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
              {ejecutando ? 'Revisando vencimientos…' : 'Ejecutar recordatorios ahora'}
            </button>

            {resultado && (
              <div style={{ marginTop:'1rem', background:'rgba(0,0,0,0.2)', borderRadius:'8px', padding:'1rem' }}>
                <div style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:C.olivo, marginBottom:'0.6rem' }}>
                  Resultado
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.5rem', marginBottom:'0.8rem' }}>
                  {[
                    { label:'Enviados', val: resultado.enviados, color:'#16a34a' },
                    { label:'Omitidos', val: resultado.omitidos, color:C.olivo },
                    { label:'Errores',  val: resultado.errores,  color:'#dc2626' },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign:'center' }}>
                      <div style={{ fontSize:'1.4rem', fontWeight:700, color:s.color, fontFamily:"'Playfair Display', serif" }}>{s.val}</div>
                      <div style={{ fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(231,223,202,0.4)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {resultado.detalles?.length > 0 && (
                  <div style={{ fontSize:'0.72rem', color:'rgba(231,223,202,0.6)', lineHeight:1.7 }}>
                    {resultado.detalles.map((d: string, i: number) => <div key={i}>{d}</div>)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── HISTORIAL ── */}
        <div style={{ background:'rgba(231,223,202,0.05)', border:'1px solid rgba(150,134,34,0.2)', borderRadius:'12px', padding:'1.5rem' }}>
          <div style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase', color:C.olivo, marginBottom:'1rem' }}>
            Historial de recordatorios enviados (últimos 100)
          </div>

          {loading ? (
            <div style={{ textAlign:'center', padding:'2rem', color:'rgba(231,223,202,0.4)', fontSize:'0.85rem' }}>Cargando…</div>
          ) : !data?.historial?.length ? (
            <div style={{ textAlign:'center', padding:'2rem', color:'rgba(231,223,202,0.3)', fontSize:'0.85rem' }}>
              Aún no se han enviado recordatorios. Usa el botón de arriba para probar.
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid rgba(150,134,34,0.2)' }}>
                    {['Fecha envío','Cliente','Obligación','Aspecto','Días'].map(h => (
                      <th key={h} style={{ padding:'0.5rem 0.8rem', textAlign:'left', fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(231,223,202,0.45)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.historial.map((r: any) => {
                    const detalle = r.detalle ? JSON.parse(r.detalle) : {}
                    return (
                      <tr key={r.id} style={{ borderBottom:'1px solid rgba(231,223,202,0.05)' }}>
                        <td style={{ padding:'0.6rem 0.8rem', fontSize:'0.75rem', color:'rgba(231,223,202,0.6)', whiteSpace:'nowrap' }}>{formatFecha(r.created_at)}</td>
                        <td style={{ padding:'0.6rem 0.8rem', fontSize:'0.78rem', fontWeight:600 }}>{r.razon_social ?? '—'}</td>
                        <td style={{ padding:'0.6rem 0.8rem', fontSize:'0.75rem', color:'rgba(231,223,202,0.7)' }}>{r.obligacion ?? '—'}</td>
                        <td style={{ padding:'0.6rem 0.8rem', fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:C.olivo }}>{r.aspecto ?? '—'}</td>
                        <td style={{ padding:'0.6rem 0.8rem' }}>
                          {detalle.diasAntes !== undefined && (
                            <span style={{
                              fontSize:'0.65rem', fontWeight:700,
                              background: detalle.diasAntes <= 0 ? 'rgba(220,38,38,0.15)' : 'rgba(150,134,34,0.15)',
                              color:      detalle.diasAntes <= 0 ? '#dc2626' : C.olivo,
                              padding:'0.15rem 0.5rem', borderRadius:'8px',
                            }}>
                              {detalle.diasAntes === 0 ? 'El día' : detalle.diasAntes > 0 ? `${detalle.diasAntes}d antes` : `${Math.abs(detalle.diasAntes)}d después`}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.12em',
  textTransform:'uppercase', color:'rgba(231,223,202,0.45)', marginBottom:'0.3rem',
}
