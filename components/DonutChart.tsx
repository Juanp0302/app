'use client'

/**
 * components/DonutChart.tsx
 * Gráfica de dona SVG — sin dependencias externas.
 * Muestra cumplidas, en progreso, pendientes y vencidas.
 */

interface DonutProps {
  cumplidas:   number
  en_progreso: number
  pendientes:  number
  vencidas:    number
  size?:       number   // px, default 120
  strokeWidth?: number  // default 14
  showLegend?: boolean
  showCenter?: boolean
}

const COLORES = {
  cumplida:    '#16a34a',
  en_progreso: '#3b82f6',
  pendiente:   '#968622',
  vencida:     '#dc2626',
  vacio:       'rgba(231,223,202,0.08)',
}

export default function DonutChart({
  cumplidas, en_progreso, pendientes, vencidas,
  size = 120, strokeWidth = 14, showLegend = false, showCenter = true,
}: DonutProps) {
  const total  = cumplidas + en_progreso + pendientes + vencidas
  const pct    = total ? Math.round((cumplidas / total) * 100) : 0
  const radius = (size - strokeWidth) / 2
  const circum = 2 * Math.PI * radius
  const cx     = size / 2
  const cy     = size / 2

  // Calcular arcos: cada segmento es una fracción de la circunferencia
  const segmentos = [
    { val: cumplidas,   color: COLORES.cumplida   },
    { val: en_progreso, color: COLORES.en_progreso },
    { val: pendientes,  color: COLORES.pendiente   },
    { val: vencidas,    color: COLORES.vencida     },
  ].filter(s => s.val > 0)

  // Color del porcentaje central
  const colorCentro = pct >= 80 ? COLORES.cumplida
    : pct >= 50 ? COLORES.pendiente
    : COLORES.vencida

  // Construir arcos SVG
  let offsetAcum = 0  // offset acumulado en la circunferencia
  const arcos = segmentos.map(seg => {
    const largo  = (seg.val / total) * circum
    const arco   = { color: seg.color, largo, offset: -offsetAcum }
    offsetAcum += largo
    return arco
  })

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Fondo */}
          {total === 0 ? (
            <circle cx={cx} cy={cy} r={radius} fill="none"
              stroke={COLORES.vacio} strokeWidth={strokeWidth} />
          ) : arcos.map((arco, i) => (
            <circle key={i} cx={cx} cy={cy} r={radius} fill="none"
              stroke={arco.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arco.largo} ${circum - arco.largo}`}
              strokeDashoffset={arco.offset}
              strokeLinecap="butt"
              style={{ transition: 'stroke-dasharray 0.5s ease' }}
            />
          ))}
        </svg>

        {/* Centro: porcentaje */}
        {showCenter && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontSize: size < 90 ? '1rem' : '1.3rem',
              fontWeight: 700, color: colorCentro,
              fontFamily: "'Playfair Display', serif",
              lineHeight: 1,
            }}>{pct}%</span>
            {size >= 100 && (
              <span style={{ fontSize: '0.55rem', color: 'rgba(231,223,202,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '0.2rem' }}>
                cumplimiento
              </span>
            )}
          </div>
        )}
      </div>

      {/* Leyenda opcional */}
      {showLegend && total > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: '120px' }}>
          {[
            { label: 'Cumplidas',   val: cumplidas,   color: COLORES.cumplida   },
            { label: 'En progreso', val: en_progreso,  color: COLORES.en_progreso },
            { label: 'Pendientes',  val: pendientes,  color: COLORES.pendiente   },
            { label: 'Vencidas',    val: vencidas,    color: COLORES.vencida     },
          ].filter(s => s.val > 0).map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: '0.65rem', color: 'rgba(231,223,202,0.65)' }}>
                {s.label}: <strong style={{ color: s.color }}>{s.val}</strong>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
