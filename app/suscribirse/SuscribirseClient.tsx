'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

const PLANES_INFO: Record<string, { label: string; precio: string; precioNum: number; tickets: number; chats: number }> = {
  basico:  { label: 'Básico',  precio: '$199.000/mes',    precioNum: 199000,  tickets: 3,  chats: 6  },
  pro:     { label: 'Pro',     precio: '$890.000/mes',    precioNum: 890000,  tickets: 6,  chats: 12 },
  premium: { label: 'Premium', precio: '$2.490.000/mes',  precioNum: 2490000, tickets: 10, chats: 20 },
}

const TYC_ITEMS = [
  { titulo: 'Canales de atención', texto: 'El ticket es el canal principal para solicitudes que generen entregables o trazabilidad. El chat para consultas rápidas; si requiere análisis se convierte en ticket. El correo contacto@owlcompliance.com atiende comunicaciones contractuales y contingencias.' },
  { titulo: 'Tiempos de respuesta', texto: 'Crítica: 4h/2h/1h. Alta: 1 día/8h/4h. Normal: 2 días/1 día/8h. Baja: 5/3/2 días hábiles (Básico/Pro/Premium). Los tiempos corren desde que la solicitud está completa y dentro del horario hábil (L–V 8am–6pm).' },
  { titulo: 'Cuota mensual de consultas', texto: 'Básico: 3/mes. Pro: 6/mes. Premium: 10/mes. No descuentan cuota las alertas, actualizaciones de calendario ni comunicaciones administrativas. Al agotar cuota, solicitudes adicionales se atienden como servicio on-demand.' },
  { titulo: 'Exclusiones del plan', texto: 'No incluye: representación formal, recursos, demandas, audiencias, radicaciones con mandato, visitas presenciales no previstas, viáticos, dictámenes periciales, pago de tasas o servicios de terceros.' },
  { titulo: 'Entregables y revisiones', texto: 'Hasta dos rondas de revisión sin costo si las observaciones se reciben dentro de 5 días hábiles. Los entregables reflejan el marco normativo vigente a la fecha de elaboración.' },
  { titulo: 'Propiedad intelectual', texto: 'Los métodos, plantillas, vademécum y herramientas del PRESTADOR son de su propiedad. El CLIENTE recibe licencia de uso limitada, no exclusiva e intransferible sobre los entregables generados para él.' },
  { titulo: 'Confidencialidad y datos personales', texto: 'Las partes guardan reserva por 2 años post-terminación. Los datos se tratan conforme a la Ley 1581 de 2012. El PRESTADOR no usará información del CLIENTE para fines propios no autorizados.' },
  { titulo: 'Duración y terminación', texto: 'Mensual con renovación automática. Cualquiera de las partes puede terminar con 15 días de aviso escrito.' },
  { titulo: 'Responsabilidad', texto: 'La responsabilidad máxima del PRESTADOR no excede tres mensualidades. No responde por decisiones de autoridades ni por información incompleta del CLIENTE.' },
  { titulo: 'Firma electrónica', texto: 'La aceptación electrónica con registro de fecha, IP y correo tiene plena validez jurídica conforme al artículo 14 de la Ley 527 de 1999.' },
]

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: 'rgba(231,223,202,0.5)', marginBottom: '0.35rem',
}
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(231,223,202,0.06)', border: '1px solid rgba(150,134,34,0.3)',
  borderRadius: '8px', padding: '0.65rem 0.9rem', fontSize: '0.85rem', color: C.marfil,
  fontFamily: "'Josefin Sans', sans-serif", outline: 'none', boxSizing: 'border-box',
}
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer', appearance: 'none' }

export default function SuscribirseClient() {
  const params = useSearchParams()
  const plan   = params.get('plan') ?? 'basico'
  const info   = PLANES_INFO[plan] ?? PLANES_INFO.basico

  const [paso,      setPaso]      = useState<1 | 2 | 3>(1)
  const [tab,       setTab]       = useState<'contrato' | 'tyc'>('contrato')
  const [cargando,  setCargando]  = useState(false)
  const [error,     setError]     = useState('')
  const [aceptado,  setAceptado]  = useState(false)

  const [form, setForm] = useState({
    email:                '',
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

  function paso1Valido() {
    return (
      form.email.trim() &&
      form.nombreCliente.trim() &&
      form.numeroIdentificacion.trim() &&
      form.ciudadCliente.trim() &&
      form.nombreRepresentante.trim() &&
      form.ccRepresentante.trim()
    )
  }

  async function finalizar() {
    if (!aceptado) return
    setCargando(true)
    setError('')
    try {
      // 1. Registrar contrato y generar PDFs
      const resContrato = await fetch('/api/contrato/publico', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...form, plan }),
      })
      const dataContrato = await resContrato.json()
      if (!resContrato.ok) {
        setError(dataContrato.error ?? 'Error al procesar el contrato.')
        setCargando(false)
        return
      }

      // 2. Crear suscripción en Mercado Pago
      const resMP = await fetch('/api/mp/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ plan, email: form.email, nombre: form.nombreCliente }),
      })
      const dataMP = await resMP.json()
      if (!resMP.ok || !dataMP.init_point) {
        setError(dataMP.error ?? 'Error al conectar con Mercado Pago.')
        setCargando(false)
        return
      }

      window.location.href = dataMP.init_point
    } catch {
      setError('Error de conexión. Intenta nuevamente.')
      setCargando(false)
    }
  }

  const tipoPersonaLabel = form.tipoPersona === 'natural' ? 'persona natural' : 'persona jurídica'

  return (
    <div style={{
      minHeight: '100vh', background: C.vino, display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontFamily: "'Josefin Sans', sans-serif", color: C.marfil,
      padding: '2rem',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      <div style={{
        maxWidth: paso === 2 ? 640 : 500, width: '100%',
        background: 'rgba(231,223,202,0.04)', border: '1px solid rgba(150,134,34,0.25)',
        borderRadius: '16px', overflow: 'hidden',
        transition: 'max-width 0.3s ease',
      }}>
        {/* Cabecera */}
        <div style={{ padding: '1.8rem 2rem 1.2rem', borderBottom: '1px solid rgba(150,134,34,0.15)' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Owl Compliance
          </div>
          <div style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.olivo }}>
            Plan {info.label} · {info.precio}
          </div>
        </div>

        {/* Indicador de pasos */}
        <div style={{ display: 'flex', padding: '0.9rem 2rem 0', gap: '0.5rem' }}>
          {['Tus datos', 'Contrato', 'Confirmar'].map((lbl, i) => (
            <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: paso === i + 1 ? 1 : 0.4 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                background: paso > i ? C.olivo : 'rgba(150,134,34,0.15)',
                border: `1px solid ${C.olivo}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.58rem', fontWeight: 700, color: C.vino, flexShrink: 0,
              }}>
                {paso > i ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: '0.63rem', fontWeight: 600, letterSpacing: '0.08em', color: C.marfil, whiteSpace: 'nowrap' }}>{lbl}</span>
              {i < 2 && <div style={{ width: 16, height: 1, background: 'rgba(150,134,34,0.3)', flexShrink: 0 }} />}
            </div>
          ))}
        </div>

        {/* Contenido */}
        <div style={{ padding: '1.4rem 2rem', maxHeight: paso === 2 ? '60vh' : 'none', overflowY: paso === 2 ? 'auto' : 'visible' }}>

          {/* ── PASO 1: Datos ── */}
          {paso === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <p style={{ fontSize: '0.76rem', color: 'rgba(231,223,202,0.5)', margin: 0, lineHeight: 1.6 }}>
                Estos datos aparecerán en el contrato de prestación de servicios.
              </p>

              <div>
                <label style={labelStyle}>Nombre o razón social *</label>
                <input value={form.nombreCliente} onChange={e => setF('nombreCliente', e.target.value)}
                  placeholder="Nombre de la empresa" style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Correo electrónico *</label>
                <input type="email" value={form.email} onChange={e => setF('email', e.target.value)}
                  placeholder="correo@empresa.com" style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
                <div>
                  <label style={labelStyle}>Tipo de persona *</label>
                  <select value={form.tipoPersona} onChange={e => setF('tipoPersona', e.target.value)} style={selectStyle}>
                    <option value="juridica">Persona jurídica</option>
                    <option value="natural">Persona natural</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Tipo de identificación *</label>
                  <select value={form.tipoIdentificacion} onChange={e => setF('tipoIdentificacion', e.target.value)} style={selectStyle}>
                    <option value="NIT">NIT</option>
                    <option value="CC">Cédula</option>
                    <option value="CE">Cédula extranjería</option>
                    <option value="Pasaporte">Pasaporte</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
                <div>
                  <label style={labelStyle}>Número de identificación *</label>
                  <input value={form.numeroIdentificacion} onChange={e => setF('numeroIdentificacion', e.target.value)}
                    placeholder="900123456-7" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Ciudad *</label>
                  <input value={form.ciudadCliente} onChange={e => setF('ciudadCliente', e.target.value)}
                    placeholder="Bogotá" style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Nombre del representante legal *</label>
                <input value={form.nombreRepresentante} onChange={e => setF('nombreRepresentante', e.target.value)}
                  placeholder="Nombre completo" style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Cédula del representante legal *</label>
                <input value={form.ccRepresentante} onChange={e => setF('ccRepresentante', e.target.value)}
                  placeholder="1234567890" style={inputStyle} />
              </div>

              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.7rem', cursor: 'pointer',
                padding: '0.8rem', background: 'rgba(150,134,34,0.05)',
                border: '1px solid rgba(150,134,34,0.2)', borderRadius: '8px',
              }}>
                <input type="checkbox" checked={form.cuentaCobroSolicitada}
                  onChange={e => setF('cuentaCobroSolicitada', e.target.checked)}
                  style={{ marginTop: '2px', accentColor: C.olivo, width: 15, height: 15, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: C.marfil, marginBottom: '0.2rem' }}>Solicitar cuenta de cobro</div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(231,223,202,0.5)', lineHeight: 1.5 }}>
                    Recibirás una cuenta de cobro con los datos bancarios para el pago, adjunta al contrato y mensualmente antes de cada renovación.
                  </div>
                </div>
              </label>
            </div>
          )}

          {/* ── PASO 2: Revisión del contrato ── */}
          {paso === 2 && (
            <div>
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(150,134,34,0.2)', marginBottom: '1rem' }}>
                {(['contrato', 'tyc'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)} style={{
                    background: 'none', border: 'none', padding: '0.5rem 1rem',
                    fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                    cursor: 'pointer', color: tab === t ? C.olivo : 'rgba(231,223,202,0.35)',
                    borderBottom: tab === t ? `2px solid ${C.olivo}` : '2px solid transparent',
                    marginBottom: '-1px', fontFamily: "'Josefin Sans', sans-serif",
                  }}>
                    {t === 'contrato' ? 'Contrato' : 'Términos y condiciones'}
                  </button>
                ))}
              </div>

              <div style={{ fontSize: '0.77rem', color: 'rgba(231,223,202,0.8)', lineHeight: 1.7 }}>
                {tab === 'contrato' && (
                  <div>
                    <p style={{ fontWeight: 700, color: C.marfil, marginBottom: '0.4rem' }}>
                      Contrato de Prestación de Servicios — Plan {info.label}
                    </p>
                    <p style={{ color: 'rgba(231,223,202,0.55)', fontSize: '0.73rem', marginBottom: '1rem' }}>
                      Entre <strong style={{ color: C.marfil }}>Juan Pablo Osorio Marín (Owl Compliance)</strong> como PRESTADOR
                      y <strong style={{ color: C.marfil }}>{form.nombreCliente}</strong>, {form.tipoIdentificacion} {form.numeroIdentificacion},
                      {tipoPersonaLabel}, representado por {form.nombreRepresentante}, como CLIENTE.
                    </p>
                    {[
                      ['Objeto', 'El PRESTADOR presta servicios de gestión regulatoria, monitoreo, consultoría jurídica y técnico-regulatoria para PRST en Colombia según el plan contratado. La representación formal ante autoridades requiere orden de servicio independiente.'],
                      ['Precio', `$${info.precioNum.toLocaleString('es-CO')} COP/mes + IVA si aplica. Pago mensual anticipado dentro de los primeros cinco días hábiles de cada mes.`],
                      ['Duración', 'Mensual con renovación automática mientras el plan esté activo. Cualquiera de las partes puede terminar con 15 días de aviso escrito.'],
                      ['Obligaciones del PRESTADOR', 'Prestar los servicios con diligencia profesional, criterio jurídico y actualización regulatoria. Mantener seguimiento a MinTIC, CRC, SIC y demás autoridades aplicables. Guardar confidencialidad sobre la información del CLIENTE.'],
                      ['Obligaciones del CLIENTE', 'Pagar oportunamente. Suministrar información completa, veraz y oportuna. Designar un contacto interno autorizado. Validar documentos antes de presentarlos ante autoridades. No compartir credenciales ni revender entregables.'],
                      ['Propiedad intelectual', 'Los métodos y materiales del PRESTADOR son de su propiedad. El CLIENTE recibe licencia de uso limitada, no exclusiva e intransferible sobre los entregables generados para él.'],
                      ['Responsabilidad', 'La responsabilidad máxima del PRESTADOR no excede tres mensualidades del plan contratado.'],
                      ['Ley aplicable', 'Ley colombiana. Disputas: conciliación en Bogotá y, si fracasa, jueces ordinarios de Bogotá.'],
                      ['Firma electrónica', 'La aceptación con registro de fecha, IP y correo tiene plena validez jurídica conforme al artículo 14 de la Ley 527 de 1999 (Comercio Electrónico).'],
                    ].map(([t, p]) => (
                      <div key={t} style={{ marginBottom: '0.75rem' }}>
                        <div style={{ fontWeight: 700, color: C.olivo, fontSize: '0.71rem', marginBottom: '0.15rem' }}>{t}</div>
                        <div style={{ color: 'rgba(231,223,202,0.72)' }}>{p}</div>
                      </div>
                    ))}
                  </div>
                )}
                {tab === 'tyc' && (
                  <div>
                    <p style={{ fontWeight: 700, color: C.marfil, marginBottom: '0.8rem' }}>Términos y Condiciones — Anexo 1</p>
                    {TYC_ITEMS.map(s => (
                      <div key={s.titulo} style={{ marginBottom: '0.75rem' }}>
                        <div style={{ fontWeight: 700, color: C.olivo, fontSize: '0.71rem', marginBottom: '0.15rem' }}>{s.titulo}</div>
                        <div style={{ color: 'rgba(231,223,202,0.72)' }}>{s.texto}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PASO 3: Confirmación ── */}
          {paso === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                background: 'rgba(150,134,34,0.08)', border: '1px solid rgba(150,134,34,0.25)',
                borderRadius: '10px', padding: '1rem 1.2rem', fontSize: '0.78rem',
                color: 'rgba(231,223,202,0.8)', lineHeight: 1.7,
              }}>
                Al hacer clic en <strong style={{ color: C.marfil }}>Aceptar y pagar</strong> estás firmando
                electrónicamente el contrato de prestación de servicios y los términos y condiciones de Owl Compliance.
                Esta firma tiene plena validez jurídica conforme al artículo 14 de la Ley 527 de 1999.
              </div>

              <div style={{ fontSize: '0.74rem', color: 'rgba(231,223,202,0.55)', lineHeight: 1.8 }}>
                <div>Firmante: <strong style={{ color: C.marfil }}>{form.nombreRepresentante} — {form.nombreCliente}</strong></div>
                <div>Plan: <strong style={{ color: C.marfil }}>Plan {info.label} — {info.precio}</strong></div>
                <div>Correo: <strong style={{ color: C.marfil }}>{form.email}</strong></div>
                {form.cuentaCobroSolicitada && <div style={{ color: C.olivo }}>Incluye cuenta de cobro mensual</div>}
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.7rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={aceptado} onChange={e => setAceptado(e.target.checked)}
                  style={{ marginTop: '3px', accentColor: C.olivo, width: 15, height: 15, flexShrink: 0 }} />
                <span style={{ fontSize: '0.78rem', color: 'rgba(231,223,202,0.8)', lineHeight: 1.5 }}>
                  He leído y acepto el contrato de prestación de servicios y los términos y condiciones de Owl Compliance.
                </span>
              </label>

              {error && (
                <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '8px', padding: '0.7rem 1rem', fontSize: '0.78rem', color: '#f87171' }}>
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Botones de navegación */}
        <div style={{
          padding: '1rem 2rem 1.5rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderTop: '1px solid rgba(150,134,34,0.12)',
        }}>
          {paso > 1 ? (
            <button
              onClick={() => { setPaso((p) => (p - 1) as 1 | 2 | 3); setError('') }}
              disabled={cargando}
              style={{ background: 'transparent', color: 'rgba(231,223,202,0.45)', border: '1px solid rgba(231,223,202,0.15)', borderRadius: '8px', padding: '0.5rem 1rem', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'Josefin Sans', sans-serif" }}>
              Atrás
            </button>
          ) : (
            <div />
          )}

          {paso < 3 ? (
            <button
              onClick={() => {
                if (paso === 1 && !paso1Valido()) { setError('Completa todos los campos requeridos.'); return }
                setError('')
                setPaso((p) => (p + 1) as 1 | 2 | 3)
              }}
              style={{
                background: C.olivo, color: C.vino, border: 'none', borderRadius: '8px',
                padding: '0.7rem 1.6rem', fontWeight: 700, fontSize: '0.75rem',
                letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer',
                fontFamily: "'Josefin Sans', sans-serif",
              }}>
              {paso === 1 ? 'Ver contrato →' : 'Continuar →'}
            </button>
          ) : (
            <button
              onClick={finalizar}
              disabled={!aceptado || cargando}
              style={{
                background: aceptado && !cargando ? C.olivo : 'rgba(150,134,34,0.2)',
                color: aceptado && !cargando ? C.vino : C.olivo,
                border: `1px solid ${C.olivo}`, borderRadius: '8px',
                padding: '0.7rem 1.6rem', fontWeight: 700, fontSize: '0.75rem',
                letterSpacing: '0.1em', textTransform: 'uppercase',
                cursor: aceptado && !cargando ? 'pointer' : 'not-allowed',
                fontFamily: "'Josefin Sans', sans-serif", transition: 'all 0.2s',
              }}>
              {cargando ? 'Procesando…' : 'Aceptar y pagar →'}
            </button>
          )}
        </div>

        {/* Error paso 1 inline */}
        {error && paso === 1 && (
          <div style={{ padding: '0 2rem 1rem', fontSize: '0.75rem', color: '#f87171' }}>{error}</div>
        )}

        <div style={{ padding: '0 2rem 1.2rem', fontSize: '0.68rem', color: 'rgba(231,223,202,0.25)', lineHeight: 1.6 }}>
          Tras aceptar serás redirigido a Mercado Pago para completar el pago de forma segura. Recibirás el contrato firmado y tus credenciales de acceso por correo.
        </div>
      </div>
    </div>
  )
}
