'use client'

import { useState } from 'react'
import NavLogo from '@/components/NavLogo'
import { useSearchParams } from 'next/navigation'

// ── Texto de Términos y Condiciones para mostrar en el modal ──────────────────
const TYC_RESUMEN = [
  { titulo: '1. Canales de atención', texto: 'El ticket es el canal principal para solicitudes que generen entregables, seguimiento o trazabilidad. El chat se usa para consultas rápidas; si requiere análisis, se convierte en ticket. El correo contacto@owlcompliance.com atiende comunicaciones contractuales y contingencias.' },
  { titulo: '2. Tiempos de primera respuesta', texto: 'Crítica: 4h/2h/1h. Alta: 1 día/8h/4h. Normal: 2 días/1 día/8h. Baja: 5/3/2 días. (Básico/Pro/Premium respectivamente.) Los tiempos corren desde que la solicitud está completa y dentro del horario hábil.' },
  { titulo: '3. Cuota de consultas', texto: 'Básico: 3/mes. Pro: 6/mes. Premium: 10/mes. No descuentan cuota: alertas, actualizaciones de calendario, comunicaciones administrativas. Al agotar cuota, nuevas solicitudes se atienden como servicio on-demand.' },
  { titulo: '4. Exclusiones del plan', texto: 'No incluye: representación formal, recursos, demandas, audiencias, radicaciones con mandato, visitas presenciales no previstas, viáticos, emisión de dictámenes periciales, pago de tasas o servicios de terceros.' },
  { titulo: '5. Entregables y revisiones', texto: 'Hasta dos rondas de revisión sin costo adicional si las observaciones se reciben en 5 días hábiles. Los entregables reflejan el marco normativo vigente a la fecha de elaboración.' },
  { titulo: '6. Propiedad intelectual', texto: 'Los métodos, plantillas, vademécum y herramientas del PRESTADOR son de su propiedad exclusiva. El CLIENTE recibe licencia de uso limitada, no exclusiva, intransferible sobre los entregables generados específicamente para él.' },
  { titulo: '7. Confidencialidad y datos personales', texto: 'Las partes mantienen reserva por 2 años post-terminación. Los datos personales se tratan conforme a la Ley 1581 de 2012. El PRESTADOR no usará información del CLIENTE para fines propios no autorizados.' },
  { titulo: '8. Modificación de términos', texto: 'El PRESTADOR puede modificar estos T&C con 30 días de aviso. Si el CLIENTE no se opone en ese plazo, se entiende que acepta. Si se opone, puede terminar el contrato sin penalidad.' },
]

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
  if (limite === 0) {
    return <div style={{ fontSize: '0.75rem', color: 'rgba(231,223,202,0.4)', fontStyle: 'italic' }}>No incluido en tu plan</div>
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
  const planParam   = params.get('plan') ?? null   // viene del sitio web

  const [cargando,        setCargando]        = useState<string | null>(null)
  const [errorPago,       setErrorPago]       = useState<string | null>(null)
  const [solicitudEnviada, setSolicitudEnviada] = useState(false)
  const [cancelando,    setCancelando]    = useState(false)
  const [cancelError,   setCancelError]   = useState<string | null>(null)
  const [cancelOk,      setCancelOk]      = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  // ── Modal de contrato ──────────────────────────────────────────────────────
  const [modalPlan,       setModalPlan]       = useState<string | null>(null)
  const [modalPaso,       setModalPaso]       = useState<1 | 2 | 3>(1)
  const [modalTab,        setModalTab]        = useState<'contrato' | 'tyc'>('contrato')
  const [modalError,      setModalError]      = useState<string | null>(null)
  const [modalEnviando,   setModalEnviando]   = useState(false)
  const [aceptoFinal,     setAceptoFinal]     = useState(false)

  const [form, setForm] = useState({
    nombreCliente:        '',
    tipoPersona:          'juridica',
    tipoIdentificacion:   'NIT',
    numeroIdentificacion: '',
    ciudadCliente:        'Bogotá',
    nombreRepresentante:  '',
    ccRepresentante:      '',
    cuentaCobroSolicitada: false,
  })

  function setF(k: keyof typeof form, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function abrirModal(planKey: string) {
    setModalPlan(planKey)
    setModalPaso(1)
    setModalTab('contrato')
    setModalError(null)
    setAceptoFinal(false)
  }

  function cerrarModal() {
    setModalPlan(null)
    setModalEnviando(false)
    setModalError(null)
  }

  function paso1Valido() {
    return (
      form.nombreCliente.trim() &&
      form.numeroIdentificacion.trim() &&
      form.ciudadCliente.trim() &&
      form.nombreRepresentante.trim() &&
      form.ccRepresentante.trim()
    )
  }

  async function confirmarContrato() {
    if (!modalPlan || !aceptoFinal) return
    setModalEnviando(true)
    setModalError(null)
    try {
      const res  = await fetch('/api/contrato/aceptar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...form, plan: modalPlan }),
      })
      const data = await res.json()
      if (!res.ok) {
        setModalError(data.error ?? 'Error al registrar la firma del contrato.')
        setModalEnviando(false)
        return
      }
      // Contrato firmado → ir a pagar
      cerrarModal()
      await irAPagar(modalPlan)
    } catch {
      setModalError('Error de conexión. Intenta nuevamente.')
      setModalEnviando(false)
    }
  }

  async function irAPagar(planKey: string) {
    setErrorPago(null)
    setCargando(planKey)
    try {
      const res  = await fetch('/api/suscripcion/solicitar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan: planKey }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorPago(data.error ?? 'Error al registrar la solicitud')
        setCargando(null)
        return
      }
      setSolicitudEnviada(true)
      setCargando(null)
    } catch {
      setErrorPago('Error de conexión. Intenta nuevamente.')
      setCargando(null)
    }
  }

  const estado      = resumen?.estado ?? 'trial'
  const estadoColor = ESTADO_COLOR[estado] ?? C.olivo
  const planActual  = resumen?.plan ?? null
  const suspendida  = estado === 'suspendida' || estado === 'cancelada'

  const planesOrden = ['basico', 'pro', 'premium'] as const

  async function cancelarSuscripcion() {
    setCancelando(true); setCancelError(null)
    try {
      const res  = await fetch('/api/suscripcion/cancelar', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setCancelError(data.error ?? 'Error al cancelar'); return }
      setCancelOk(true)
      setConfirmCancel(false)
      // Recargar para reflejar estado
      setTimeout(() => window.location.reload(), 2000)
    } catch {
      setCancelError('Error de conexión. Intenta nuevamente.')
    } finally {
      setCancelando(false)
    }
  }

  function suscribirme(planKey: string) {
    // Los nuevos clientes deben firmar el contrato primero
    // resumen?.contrato_aceptado_at vendría del servidor si ya firmaron
    if (resumen?.contratoFirmado) {
      irAPagar(planKey)
    } else {
      abrirModal(planKey)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.vino, fontFamily: "'Josefin Sans', sans-serif", color: C.marfil }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      <nav style={{ background: 'rgba(39,2,5,0.97)', borderBottom: '1px solid rgba(150,134,34,0.2)', padding: '0.9rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <NavLogo />
          <span style={{ color: 'rgba(231,223,202,0.3)' }}>›</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.olivo }}>Mi Suscripción</span>
        </div>
        <a href="/signout" style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.5)', textDecoration: 'none' }}>Salir</a>
      </nav>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '2.5rem 2rem' }}>

        {/* Confirmación de solicitud enviada */}
        {solicitudEnviada && (
          <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.35)', borderRadius: '12px', padding: '1.2rem 1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ fontSize: '1.3rem' }}>✅</span>
            <div>
              <div style={{ fontWeight: 700, color: '#4ade80', marginBottom: '0.2rem' }}>Solicitud registrada</div>
              <div style={{ fontSize: '0.82rem', color: 'rgba(231,223,202,0.7)' }}>
                Nuestro equipo se pondrá en contacto contigo para coordinar el pago y activar tu plan.
              </div>
            </div>
          </div>
        )}

        {/* Alerta suspendida */}
        {suspendida && !solicitudEnviada && (
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

        {/* Cancelación exitosa */}
        {cancelOk && (
          <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.35)', borderRadius: '12px', padding: '1.2rem 1.5rem', marginBottom: '2rem', fontSize: '0.84rem', color: '#4ade80' }}>
            Suscripción cancelada. Tu acceso continúa hasta el fin del período pagado. Recargando…
          </div>
        )}

        {/* Error cancelación */}
        {cancelError && (
          <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '10px', padding: '0.9rem 1.2rem', marginBottom: '1.5rem', fontSize: '0.82rem', color: '#f87171' }}>
            {cancelError}
          </div>
        )}

        {/* Botón cancelar (solo si está activa) */}
        {estado === 'activa' && !cancelOk && (
          <div style={{ marginBottom: '2rem', textAlign: 'right' }}>
            {!confirmCancel ? (
              <button
                onClick={() => setConfirmCancel(true)}
                style={{ background: 'transparent', color: 'rgba(231,223,202,0.4)', border: '1px solid rgba(231,223,202,0.15)', borderRadius: '8px', padding: '0.5rem 1.1rem', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: "'Josefin Sans', sans-serif" }}>
                Cancelar suscripción
              </button>
            ) : (
              <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: '12px', padding: '1.2rem 1.5rem', textAlign: 'left' }}>
                <div style={{ fontWeight: 700, color: '#f87171', marginBottom: '0.4rem', fontSize: '0.9rem' }}>¿Confirmas la cancelación?</div>
                <div style={{ fontSize: '0.82rem', color: 'rgba(231,223,202,0.65)', marginBottom: '1rem', lineHeight: 1.6 }}>
                  Tu suscripción se cancelará y no se realizará ningún cobro adicional. Mantendrás el acceso hasta el final del período ya pagado.
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={cancelarSuscripcion}
                    disabled={cancelando}
                    style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.6rem 1.2rem', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: cancelando ? 'not-allowed' : 'pointer', fontFamily: "'Josefin Sans', sans-serif", opacity: cancelando ? 0.7 : 1 }}>
                    {cancelando ? 'Cancelando…' : 'Sí, cancelar'}
                  </button>
                  <button
                    onClick={() => { setConfirmCancel(false); setCancelError(null) }}
                    style={{ background: 'transparent', color: C.marfil, border: '1px solid rgba(231,223,202,0.2)', borderRadius: '8px', padding: '0.6rem 1.2rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'Josefin Sans', sans-serif" }}>
                    Volver
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

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
                    { label: p.tickets === 0 ? 'Sin tickets' : `${p.tickets} ticket${p.tickets !== 1 ? 's' : ''}/mes`, icon: '🎫' },
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
          Los contadores de tickets y chats se reinician automáticamente con cada pago mensual. Para dudas sobre tu suscripción o el proceso de pago, contacta a tu asesor de Owl Compliance.
        </div>
      </main>

      {/* ── Modal de contrato ──────────────────────────────────────────── */}
      {modalPlan && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem',
        }}>
          <div style={{
            background: '#1a0505', border: '1px solid rgba(150,134,34,0.3)',
            borderRadius: '16px', width: '100%', maxWidth: '680px',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            fontFamily: "'Josefin Sans', sans-serif",
          }}>
            {/* Cabecera del modal */}
            <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid rgba(150,134,34,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.olivo, marginBottom: '0.2rem' }}>
                  Plan {planes[modalPlan as keyof typeof planes]?.label}
                </div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: C.marfil }}>
                  {modalPaso === 1 && 'Datos del contrato'}
                  {modalPaso === 2 && 'Revisa los documentos'}
                  {modalPaso === 3 && 'Confirmar firma electrónica'}
                </div>
              </div>
              <button onClick={cerrarModal} style={{ background: 'none', border: 'none', color: 'rgba(231,223,202,0.4)', fontSize: '1.3rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            {/* Indicador de pasos */}
            <div style={{ display: 'flex', padding: '0.8rem 1.5rem 0', gap: '0.5rem', flexShrink: 0 }}>
              {(['Datos', 'Revisión', 'Confirmar'] as const).map((lbl, i) => (
                <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: modalPaso === i + 1 ? 1 : 0.4 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: modalPaso > i ? C.olivo : 'rgba(150,134,34,0.2)', border: `1px solid ${C.olivo}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: C.vino }}>
                    {modalPaso > i ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', color: C.marfil }}>{lbl}</span>
                  {i < 2 && <div style={{ width: 20, height: 1, background: 'rgba(150,134,34,0.3)' }} />}
                </div>
              ))}
            </div>

            {/* Contenido del modal (scrollable) */}
            <div style={{ flex: 1, overflow: 'auto', padding: '1.2rem 1.5rem' }}>

              {/* ── Paso 1: Datos ── */}
              {modalPaso === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  <p style={{ fontSize: '0.78rem', color: 'rgba(231,223,202,0.6)', lineHeight: 1.6, margin: 0 }}>
                    Ingresa los datos que aparecerán en el contrato de prestación de servicios.
                  </p>

                  {/* Nombre */}
                  <div>
                    <label style={labelStyle}>Nombre o razón social *</label>
                    <input
                      value={form.nombreCliente}
                      onChange={e => setF('nombreCliente', e.target.value)}
                      placeholder="Nombre de la empresa o persona"
                      style={inputStyle}
                    />
                  </div>

                  {/* Tipo persona + tipo ID */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
                    <div>
                      <label style={labelStyle}>Tipo de persona *</label>
                      <select value={form.tipoPersona} onChange={e => setF('tipoPersona', e.target.value)} style={inputStyle}>
                        <option value="juridica">Persona jurídica</option>
                        <option value="natural">Persona natural</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Tipo de identificación *</label>
                      <select value={form.tipoIdentificacion} onChange={e => setF('tipoIdentificacion', e.target.value)} style={inputStyle}>
                        <option value="NIT">NIT</option>
                        <option value="CC">Cédula de ciudadanía</option>
                        <option value="CE">Cédula de extranjería</option>
                        <option value="Pasaporte">Pasaporte</option>
                      </select>
                    </div>
                  </div>

                  {/* Número ID + Ciudad */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
                    <div>
                      <label style={labelStyle}>Número de identificación *</label>
                      <input
                        value={form.numeroIdentificacion}
                        onChange={e => setF('numeroIdentificacion', e.target.value)}
                        placeholder="900123456-7"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Ciudad *</label>
                      <input
                        value={form.ciudadCliente}
                        onChange={e => setF('ciudadCliente', e.target.value)}
                        placeholder="Bogotá"
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  {/* Representante */}
                  <div>
                    <label style={labelStyle}>Nombre del representante legal *</label>
                    <input
                      value={form.nombreRepresentante}
                      onChange={e => setF('nombreRepresentante', e.target.value)}
                      placeholder="Nombre completo"
                      style={inputStyle}
                    />
                  </div>

                  {/* CC representante */}
                  <div>
                    <label style={labelStyle}>Cédula del representante legal *</label>
                    <input
                      value={form.ccRepresentante}
                      onChange={e => setF('ccRepresentante', e.target.value)}
                      placeholder="1234567890"
                      style={inputStyle}
                    />
                  </div>

                  {/* Cuenta de cobro */}
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.7rem', cursor: 'pointer', padding: '0.8rem', background: 'rgba(150,134,34,0.05)', border: '1px solid rgba(150,134,34,0.2)', borderRadius: '8px' }}>
                    <input
                      type="checkbox"
                      checked={form.cuentaCobroSolicitada}
                      onChange={e => setF('cuentaCobroSolicitada', e.target.checked)}
                      style={{ marginTop: '2px', accentColor: C.olivo, width: 15, height: 15, flexShrink: 0 }}
                    />
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: C.marfil, marginBottom: '0.2rem' }}>Solicitar cuenta de cobro</div>
                      <div style={{ fontSize: '0.72rem', color: 'rgba(231,223,202,0.55)', lineHeight: 1.5 }}>
                        Recibirás una cuenta de cobro con los datos de pago bancario, enviada junto con el contrato y con diez días de anticipación cada renovación mensual.
                      </div>
                    </div>
                  </label>
                </div>
              )}

              {/* ── Paso 2: Revisión ── */}
              {modalPaso === 2 && (
                <div>
                  {/* Tabs */}
                  <div style={{ display: 'flex', gap: 0, marginBottom: '1rem', borderBottom: '1px solid rgba(150,134,34,0.2)' }}>
                    {(['contrato', 'tyc'] as const).map(tab => (
                      <button key={tab} onClick={() => setModalTab(tab)} style={{
                        background: 'none', border: 'none', padding: '0.5rem 1rem',
                        fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em',
                        textTransform: 'uppercase', cursor: 'pointer',
                        color: modalTab === tab ? C.olivo : 'rgba(231,223,202,0.4)',
                        borderBottom: modalTab === tab ? `2px solid ${C.olivo}` : '2px solid transparent',
                        marginBottom: '-1px', fontFamily: "'Josefin Sans', sans-serif",
                      }}>
                        {tab === 'contrato' ? 'Contrato' : 'Términos y condiciones'}
                      </button>
                    ))}
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'rgba(231,223,202,0.85)', lineHeight: 1.7 }}>
                    {modalTab === 'contrato' && (
                      <div>
                        <p style={{ fontWeight: 700, color: C.marfil, marginBottom: '0.5rem' }}>Contrato de Prestación de Servicios — Plan {planes[modalPlan as keyof typeof planes]?.label}</p>
                        <p style={{ color: 'rgba(231,223,202,0.6)', marginBottom: '1rem', fontSize: '0.73rem' }}>
                          Las partes son: <strong>Juan Pablo Osorio Marín (Owl Compliance)</strong> como PRESTADOR, y{' '}
                          <strong>{form.nombreCliente}</strong>, {form.tipoIdentificacion} {form.numeroIdentificacion}, representado por {form.nombreRepresentante}, como CLIENTE.
                        </p>
                        {[
                          ['Objeto', 'El PRESTADOR presta servicios de gestión regulatoria, monitoreo, consultoría jurídica y técnico-regulatoria para PRST en Colombia según el plan contratado. La representación formal ante autoridades requiere orden de servicio independiente.'],
                          ['Precio', `$${planes[modalPlan as keyof typeof planes]?.precio?.toLocaleString('es-CO')} COP/mes, más IVA si aplica. Pago mensual anticipado dentro de los primeros cinco días hábiles de cada mes.`],
                          ['Duración', 'Mensual con renovación automática. Cualquiera de las partes puede terminar con 15 días de aviso.'],
                          ['Propiedad intelectual', 'Los materiales del PRESTADOR son de su propiedad. El CLIENTE recibe licencia de uso limitada sobre los entregables generados para él, sin posibilidad de reventa o cesión.'],
                          ['Responsabilidad', 'La responsabilidad máxima del PRESTADOR no excede tres mensualidades del plan contratado.'],
                          ['Ley aplicable', 'Ley colombiana. Disputas: conciliación en Bogotá y, si fracasa, jueces ordinarios de Bogotá.'],
                          ['Firma electrónica', 'La aceptación electrónica con registro de fecha, IP y correo es válida conforme al artículo 14 de la Ley 527 de 1999.'],
                        ].map(([t, p]) => (
                          <div key={t} style={{ marginBottom: '0.8rem' }}>
                            <div style={{ fontWeight: 700, color: C.olivo, fontSize: '0.73rem', marginBottom: '0.2rem' }}>{t}</div>
                            <div style={{ color: 'rgba(231,223,202,0.75)' }}>{p}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {modalTab === 'tyc' && (
                      <div>
                        <p style={{ fontWeight: 700, color: C.marfil, marginBottom: '0.8rem' }}>Términos y Condiciones — Anexo 1</p>
                        {TYC_RESUMEN.map(s => (
                          <div key={s.titulo} style={{ marginBottom: '0.8rem' }}>
                            <div style={{ fontWeight: 700, color: C.olivo, fontSize: '0.73rem', marginBottom: '0.2rem' }}>{s.titulo}</div>
                            <div style={{ color: 'rgba(231,223,202,0.75)' }}>{s.texto}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Paso 3: Confirmar ── */}
              {modalPaso === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ background: 'rgba(150,134,34,0.08)', border: '1px solid rgba(150,134,34,0.25)', borderRadius: '10px', padding: '1rem 1.2rem', fontSize: '0.78rem', color: 'rgba(231,223,202,0.8)', lineHeight: 1.7 }}>
                    Al hacer clic en <strong style={{ color: C.marfil }}>Aceptar y continuar</strong>, estás firmando electrónicamente el contrato de prestación de servicios y los términos y condiciones de Owl Compliance. Esta firma tiene plena validez jurídica conforme al artículo 14 de la Ley 527 de 1999 (Ley de Comercio Electrónico).
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'rgba(231,223,202,0.55)', lineHeight: 1.6 }}>
                    <div>Firmante: <span style={{ color: C.marfil }}>{form.nombreRepresentante} — {form.nombreCliente}</span></div>
                    <div>Plan: <span style={{ color: C.marfil }}>Plan {planes[modalPlan as keyof typeof planes]?.label} — ${planes[modalPlan as keyof typeof planes]?.precio?.toLocaleString('es-CO')} COP/mes</span></div>
                    {form.cuentaCobroSolicitada && <div style={{ color: C.olivo }}>Incluye cuenta de cobro mensual</div>}
                  </div>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.7rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={aceptoFinal}
                      onChange={e => setAceptoFinal(e.target.checked)}
                      style={{ marginTop: '3px', accentColor: C.olivo, width: 15, height: 15, flexShrink: 0 }}
                    />
                    <span style={{ fontSize: '0.78rem', color: 'rgba(231,223,202,0.8)', lineHeight: 1.5 }}>
                      He leído y acepto el contrato de prestación de servicios y los términos y condiciones de Owl Compliance.
                    </span>
                  </label>

                  {modalError && (
                    <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '8px', padding: '0.7rem 1rem', fontSize: '0.78rem', color: '#f87171' }}>
                      {modalError}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Botones del modal */}
            <div style={{ padding: '0.9rem 1.5rem', borderTop: '1px solid rgba(150,134,34,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              {modalPaso > 1 ? (
                <button
                  onClick={() => setModalPaso((p) => (p - 1) as 1 | 2 | 3)}
                  style={{ background: 'transparent', color: 'rgba(231,223,202,0.5)', border: '1px solid rgba(231,223,202,0.15)', borderRadius: '8px', padding: '0.5rem 1rem', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'Josefin Sans', sans-serif" }}>
                  Atrás
                </button>
              ) : (
                <button onClick={cerrarModal} style={{ background: 'transparent', color: 'rgba(231,223,202,0.4)', border: 'none', fontSize: '0.72rem', cursor: 'pointer', fontFamily: "'Josefin Sans', sans-serif" }}>Cancelar</button>
              )}

              {modalPaso < 3 ? (
                <button
                  onClick={() => {
                    if (modalPaso === 1 && !paso1Valido()) {
                      setModalError('Por favor completa todos los campos.')
                      return
                    }
                    setModalError(null)
                    setModalPaso((p) => (p + 1) as 1 | 2 | 3)
                  }}
                  style={{ background: C.olivo, color: C.vino, border: 'none', borderRadius: '8px', padding: '0.55rem 1.4rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: "'Josefin Sans', sans-serif" }}>
                  {modalPaso === 1 ? 'Ver contrato' : 'Continuar'}
                </button>
              ) : (
                <button
                  onClick={confirmarContrato}
                  disabled={!aceptoFinal || modalEnviando}
                  style={{ background: aceptoFinal && !modalEnviando ? C.olivo : 'rgba(150,134,34,0.2)', color: aceptoFinal && !modalEnviando ? C.vino : C.olivo, border: `1px solid ${C.olivo}`, borderRadius: '8px', padding: '0.55rem 1.4rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: aceptoFinal && !modalEnviando ? 'pointer' : 'not-allowed', fontFamily: "'Josefin Sans', sans-serif", transition: 'all 0.2s' }}>
                  {modalEnviando ? 'Firmando…' : 'Aceptar y continuar'}
                </button>
              )}
            </div>

            {/* Error paso 1 (inline) */}
            {modalError && modalPaso === 1 && (
              <div style={{ padding: '0 1.5rem 0.8rem', fontSize: '0.75rem', color: '#f87171' }}>{modalError}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Estilos de inputs del modal ────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.65rem',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'rgba(231,223,202,0.5)',
  marginBottom: '0.35rem',
}
const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(231,223,202,0.05)',
  border: '1px solid rgba(150,134,34,0.25)',
  borderRadius: '7px',
  padding: '0.55rem 0.8rem',
  fontSize: '0.82rem',
  color: '#e7dfca',
  fontFamily: "'Josefin Sans', sans-serif",
  outline: 'none',
  boxSizing: 'border-box',
}
