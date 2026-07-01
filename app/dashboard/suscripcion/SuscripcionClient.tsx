'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

const ESTADO_COLOR: Record<string, string> = {
  activa:     '#16a34a',
  trial:      '#3b82f6',
  suspendida: '#dc2626',
  cancelada:  '#6b7280',
}
const ESTADO_LABEL: Record<string, string> = {
  activa:     'Activa',
  trial:      'Período de prueba',
  suspendida: 'Suspendida',
  cancelada:  'Cancelada',
}

function BarraUso({ usado, limite, color }: { usado: number; limite: number | null; color: string }) {
  if (limite === null) {
    return <div style={{ fontSize: '0.75rem', color: 'rgba(231,223,202,0.5)' }}>Sin límite</div>
  }
  const pct = Math.min(100, Math.round((usado / limite) * 100))
  const barColor = pct >= 100 ? '#dc2626' : pct >= 75 ? '#f59e0b' : color
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'rgba(231,223,202,0.6)' }}>{usado} de {limite} usados</span>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: barColor }}>{pct}%</span>
      </div>
      <div style={{ height: '6px', background: 'rgba(231,223,202,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '3px', transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

export default function SuscripcionClient({ resumen, planes }: { resumen: any; planes: any }) {
  const params      = useSearchParams()
  const mpOk        = params.get('mp') === 'ok'
  const planParam   = params.get('plan') ?? null   // viene del sitio web

  const [cargando,   setCargando]   = useState<string | null>(null)
  const [errorPago,  setErrorPago]  = useState<string | null>(null)

  const estado      = resumen?.estado ?? 'trial'
  const estadoColor = ESTADO_COLOR[estado] ?? C.olivo
  const planActual  = resumen?.plan ?? null
  const suspendida  = estado === 'suspendida' || estado === 'cancelada'

  const planesOrden = ['basico', 'pro', 'premium'] as const

  async function suscribirme(planKey: string) {
    setErrorPago(null)
    setCargando(planKey)
    try {
      const res  = await fetch('/api/mp/suscribir', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan: planKey }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorPago(data.error ?? 'Error al iniciar el pago')
        setCargando(null)
        return
      }
      // Redirigir al checkout de Mercado Pago
      window.location.href = data.init_point
    } catch {
      setErrorPago('Error de conexión. Intenta nuevamente.')
      setCargando(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.vino, fontFamily: "'Josefin Sans', sans-serif", color: C.marfil }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      <nav style={{ background: 'rgba(39,2,5,0.97)', borderBottom: '1px solid rgba(150,134,34,0.2)', padding: '0.9rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <a href="/dashboard" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', fontWeight: 700, color: C.marfil, textDecoration: 'none' }}>Owl Compliance</a>
          <span style={{ color: 'rgba(231,223,202,0.3)' }}>›</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.olivo }}>Mi Suscripción</span>
        </div>
        <a href="/signout" style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.5)', textDecoration: 'none' }}>Salir</a>
      </nav>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '2.5rem 2rem' }}>

        {/* Confirmación de pago exitoso */}
        {mpOk && (
          <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.35)', borderRadius: '12px', padding: '1.2rem 1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ fontSize: '1.3rem' }}>✅</span>
            <div>
              <div style={{ fontWeight: 700, color: '#4ade80', marginBottom: '0.2rem' }}>Pago procesado correctamente</div>
              <div style={{ fontSize: '0.82rem', color: 'rgba(231,223,202,0.7)' }}>
                Tu suscripción se activará en segundos. Si el estado no cambia en un minuto, recarga la página.
              </div>
            </div>
          </div>
        )}

        {/* Alerta suspendida */}
        {suspendida && !mpOk && (
          <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.35)', borderRadius: '12px', padding: '1.2rem 1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, color: '#f87171', marginBottom: '0.3rem' }}>Suscripción {ESTADO_LABEL[estado].toLowerCase()}</div>
              <div style={{ fontSize: '0.82rem', color: 'rgba(231,223,202,0.7)', lineHeight: 1.6 }}>
                Tu acceso a la plataforma está limitado. Elige un plan abajo para reactivar tu suscripción.
              </div>
            </div>
          </div>
        )}

        {/* Error de pago */}
        {errorPago && (
          <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '10px', padding: '0.9rem 1.2rem', marginBottom: '1.5rem', fontSize: '0.82rem', color: '#f87171' }}>
            {errorPago}
          </div>
        )}

        {/* Estado actual */}
        <div style={{ background: 'rgba(231,223,202,0.04)', border: '1px solid rgba(150,134,34,0.2)', borderRadius: '14px', padding: '1.8rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.4)', marginBottom: '0.4rem' }}>Plan actual</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 700 }}>
                {resumen?.planLabel ?? 'Sin plan asignado'}
              </div>
              {resumen?.plan && (
                <div style={{ fontSize: '1rem', color: C.olivo, fontWeight: 600, marginTop: '0.2rem' }}>
                  ${planes[resumen.plan]?.precio?.toLocaleString('es-CO')} COP/mes
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', background: `${estadoColor}20`, color: estadoColor, border: `1px solid ${estadoColor}40`, padding: '0.35rem 0.9rem', borderRadius: '20px' }}>
                {ESTADO_LABEL[estado] ?? estado}
              </span>
              {resumen?.vencimiento && (
                <div style={{ fontSize: '0.7rem', color: 'rgba(231,223,202,0.4)', marginTop: '0.5rem' }}>
                  Renueva el {new Date(resumen.vencimiento).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
              )}
            </div>
          </div>

          {/* Uso del mes */}
          {resumen?.plan && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.45)', marginBottom: '0.6rem' }}>Tickets este mes</div>
                <BarraUso usado={resumen.tickets.usado} limite={resumen.tickets.limite} color={C.olivo} />
              </div>
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.45)', marginBottom: '0.6rem' }}>Chats este mes</div>
                <BarraUso usado={resumen.chats.usado} limite={resumen.chats.limite} color='#3b82f6' />
              </div>
            </div>
          )}

          {!resumen?.plan && (
            <div style={{ fontSize: '0.82rem', color: 'rgba(231,223,202,0.45)', fontStyle: 'italic' }}>
              Elige un plan abajo para comenzar.
            </div>
          )}
        </div>

        {/* Comparativa de planes */}
        <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.4)', marginBottom: '1.2rem' }}>
          {planActual && estado === 'activa' ? 'Tu plan · opciones de cambio' : 'Elige tu plan'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {planesOrden.map(key => {
            const p        = planes[key]
            const esActual = planActual === key && estado === 'activa'
            const loading  = cargando === key
            const destacado = planParam === key && !esActual
            return (
              <div key={key} style={{
                background: esActual ? 'rgba(150,134,34,0.12)' : destacado ? 'rgba(150,134,34,0.07)' : 'rgba(231,223,202,0.03)',
                border: esActual ? `2px solid ${C.olivo}` : destacado ? `2px solid rgba(150,134,34,0.6)` : '1px solid rgba(150,134,34,0.2)',
                borderRadius: '12px', padding: '1.4rem', position: 'relative',
                display: 'flex', flexDirection: 'column',
              }}>
                {esActual && (
                  <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', background: C.olivo, color: C.vino, fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '0.2rem 0.8rem', borderRadius: '10px' }}>
                    Plan actual
                  </div>
                )}
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.3rem' }}>{p.label}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: C.olivo, marginBottom: '1rem' }}>
                  ${p.precio.toLocaleString('es-CO')}<span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'rgba(231,223,202,0.5)' }}>/mes</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                  {[
                    { label: `${p.tickets} ticket${p.tickets !== 1 ? 's' : ''}/mes`, icon: '🎫' },
                    { label: `${p.chats} chat${p.chats !== 1 ? 's' : ''}/mes`,        icon: '💬' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'rgba(231,223,202,0.7)' }}>
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>

                {/* Botón de suscripción */}
                <div style={{ marginTop: '1.4rem' }}>
                  {esActual ? (
                    <div style={{ fontSize: '0.7rem', color: C.olivo, fontWeight: 600, textAlign: 'center' }}>
                      ✓ Plan activo
                    </div>
                  ) : (
                    <button
                      onClick={() => suscribirme(key)}
                      disabled={!!cargando}
                      style={{
                        width: '100%',
                        padding: '0.65rem',
                        background: loading ? 'rgba(150,134,34,0.2)' : C.olivo,
                        color: loading ? C.olivo : C.vino,
                        border: `1px solid ${C.olivo}`,
                        borderRadius: '8px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        cursor: cargando ? 'not-allowed' : 'pointer',
                        fontFamily: "'Josefin Sans', sans-serif",
                        transition: 'opacity 0.2s',
                        opacity: cargando && !loading ? 0.5 : 1,
                      }}
                    >
                      {loading ? 'Redirigiendo...' : planActual ? 'Cambiar a este plan' : 'Suscribirme'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: '2.5rem', padding: '1.2rem 1.5rem', background: 'rgba(231,223,202,0.03)', border: '1px solid rgba(150,134,34,0.15)', borderRadius: '10px', fontSize: '0.78rem', color: 'rgba(231,223,202,0.45)', lineHeight: 1.7 }}>
          Los contadores de tickets y chats se reinician automáticamente con cada pago mensual. El cobro se gestiona de forma segura a través de Mercado Pago — no almacenamos datos de tarjetas. Para dudas sobre tu suscripción, contacta a tu asesor de Owl Compliance.
        </div>
      </main>
    </div>
  )
}
