'use client'

import { useEffect, useState, useCallback } from 'react'
import NavLogo from '@/components/NavLogo'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

// ── Mini barra CSS ──────────────────────────────────────────────────────────

function BarraHorizontal({ items, color }: {
  items: { label: string; cnt: number }[]
  color: string
}) {
  if (!items.length) return <p style={{ color: '#aaa', fontSize: 13 }}>Sin datos aún</p>
  const max = Math.max(...items.map(i => Number(i.cnt)))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map(item => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 130, fontSize: 12, color: '#555', textAlign: 'right',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {item.label}
          </div>
          <div style={{ flex: 1, background: '#f0ede6', borderRadius: 4, height: 18, position: 'relative' }}>
            <div style={{
              width: `${max > 0 ? (Number(item.cnt) / max) * 100 : 0}%`,
              background: color, borderRadius: 4, height: '100%',
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ width: 28, fontSize: 12, fontWeight: 700, color: '#333', flexShrink: 0 }}>
            {item.cnt}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Gráfico de línea temporal (CSS) ────────────────────────────────────────

function LineaTemporal({ dias }: { dias: { dia: string; cnt: number }[] }) {
  if (!dias.length) return <p style={{ color: '#aaa', fontSize: 13 }}>Sin datos aún</p>
  const max = Math.max(...dias.map(d => Number(d.cnt)), 1)
  const H   = 80
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: H + 30, minWidth: dias.length * 24 }}>
        {dias.map(d => {
          const h = Math.max(4, Math.round((Number(d.cnt) / max) * H))
          const fecha = new Date(d.dia + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' })
          return (
            <div key={d.dia} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div title={`${d.dia}: ${d.cnt} lead(s)`} style={{
                width: 18, height: h, background: C.olivo, borderRadius: '3px 3px 0 0',
                cursor: 'default', transition: 'opacity 0.2s',
              }} />
              <div style={{ fontSize: 9, color: '#aaa', writingMode: 'vertical-rl',
                transform: 'rotate(180deg)', height: 28, lineHeight: '18px' }}>{fecha}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Tarjeta de stat ─────────────────────────────────────────────────────────

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
      padding: '1rem 1.25rem', minWidth: 120 }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: C.vino, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: '#888', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Tabla leads ─────────────────────────────────────────────────────────────

function TablaLeads({ leads }: { leads: any[] }) {
  const [busq, setBusq] = useState('')
  const filtrados = leads.filter(l => {
    if (!busq) return true
    const q = busq.toLowerCase()
    return [l.nombre, l.empresa, l.correo, l.asunto, l.utm_source, l.utm_campaign]
      .some(v => v?.toLowerCase().includes(q))
  })

  const th: React.CSSProperties = {
    padding: '8px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
    textTransform: 'uppercase', color: '#888', textAlign: 'left',
    borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap',
  }
  const td: React.CSSProperties = {
    padding: '8px 12px', fontSize: 13, color: '#333',
    borderBottom: '1px solid #f5f5f5', verticalAlign: 'top',
  }

  return (
    <div>
      <input value={busq} onChange={e => setBusq(e.target.value)}
        placeholder="Buscar por nombre, empresa, correo, fuente…"
        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd',
          fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12 }} />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#fafafa' }}>
              <th style={th}>Fecha</th>
              <th style={th}>Nombre</th>
              <th style={th}>Empresa</th>
              <th style={th}>Correo</th>
              <th style={th}>Asunto</th>
              <th style={th}>Fuente</th>
              <th style={th}>Medio</th>
              <th style={th}>Campaña</th>
              <th style={th}>Landing</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr><td colSpan={9} style={{ ...td, color: '#aaa', textAlign: 'center', padding: '2rem' }}>
                Sin resultados
              </td></tr>
            ) : filtrados.map((l: any) => (
              <tr key={l.id}>
                <td style={{ ...td, whiteSpace: 'nowrap', color: '#aaa', fontSize: 11 }}>
                  {new Date(l.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </td>
                <td style={td}>{l.nombre ?? '—'}</td>
                <td style={{ ...td, fontWeight: 600 }}>{l.empresa ?? '—'}</td>
                <td style={{ ...td, color: C.bordo }}>{l.correo ?? '—'}</td>
                <td style={{ ...td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.asunto ?? '—'}
                </td>
                <td style={{ ...td, fontWeight: 600, color: '#6d28d9' }}>{l.utm_source ?? '—'}</td>
                <td style={td}>{l.utm_medium ?? '—'}</td>
                <td style={td}>{l.utm_campaign ?? '—'}</td>
                <td style={{ ...td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontSize: 11, color: '#aaa' }}>
                  {l.landing_page ? new URL(l.landing_page).pathname : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtrados.length > 0 && (
        <div style={{ fontSize: 12, color: '#aaa', marginTop: 8, textAlign: 'right' }}>
          {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

// ── Principal ───────────────────────────────────────────────────────────────

export default function LeadsClient() {
  const [data,    setData]    = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/leads')
      if (r.ok) setData(await r.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.25rem 1.5rem',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f3ee', fontFamily: "'Josefin Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      <nav style={{ background: C.vino, padding: '0.9rem 2rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <NavLogo />
        <span style={{ color: 'rgba(231,223,202,0.3)' }}>›</span>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.15em',
          textTransform: 'uppercase', color: C.olivo }}>
          Dashboard de Leads
        </span>
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={cargar} style={{ background: 'transparent', border: '1px solid rgba(150,134,34,0.4)',
            borderRadius: 8, padding: '0.4rem 0.9rem', fontSize: '0.7rem', fontWeight: 600,
            color: C.olivo, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.08em' }}>
            Actualizar
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {loading && (
          <p style={{ color: '#888', fontSize: 14, textAlign: 'center', padding: '3rem' }}>Cargando datos…</p>
        )}

        {!loading && data && (
          <>
            {/* Tarjetas resumen */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Stat label="Total leads" value={data.stats.total} />
              <Stat label="Fuentes únicas"
                value={data.stats.porSource.filter((s: any) => s.label !== '(sin fuente)').length} />
              <Stat label="Campañas únicas"
                value={data.stats.porCampaign.filter((s: any) => s.label !== '(sin campaña)').length} />
              <Stat label="Último mes"
                value={data.stats.porDia.reduce((a: number, d: any) => a + Number(d.cnt), 0)}
                sub="últimos 30 días" />
            </div>

            {/* Tendencia diaria */}
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.vino, marginBottom: 12,
                textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Leads por día (últimos 30 días)
              </div>
              <LineaTemporal dias={data.stats.porDia} />
            </div>

            {/* Barras por dimensión UTM */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.vino, marginBottom: 12,
                  textTransform: 'uppercase', letterSpacing: '0.07em' }}>Por fuente (utm_source)</div>
                <BarraHorizontal items={data.stats.porSource} color="#6d28d9" />
              </div>
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.vino, marginBottom: 12,
                  textTransform: 'uppercase', letterSpacing: '0.07em' }}>Por medio (utm_medium)</div>
                <BarraHorizontal items={data.stats.porMedium} color={C.olivo} />
              </div>
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.vino, marginBottom: 12,
                  textTransform: 'uppercase', letterSpacing: '0.07em' }}>Por campaña (utm_campaign)</div>
                <BarraHorizontal items={data.stats.porCampaign} color={C.bordo} />
              </div>
            </div>

            {/* Tabla */}
            <div style={{ ...card, padding: '1.25rem' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.vino, marginBottom: 14,
                textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Todos los leads
              </div>
              <TablaLeads leads={data.leads} />
            </div>
          </>
        )}

        {!loading && !data && (
          <div style={{ ...card, textAlign: 'center', padding: '3rem', color: '#aaa' }}>
            No se pudieron cargar los datos. Intenta actualizar.
          </div>
        )}
      </div>
    </div>
  )
}
