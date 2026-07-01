'use client'

import { useState } from 'react'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

type Estado = 'idle' | 'cargando' | 'encontrado' | 'no_encontrado' | 'error'
type AccionSupresion = 'idle' | 'confirmando' | 'procesando' | 'done' | 'error'

export default function HabeasDataClient() {
  const [email,      setEmail]      = useState('')
  const [estado,     setEstado]     = useState<Estado>('idle')
  const [datos,      setDatos]      = useState<any>(null)
  const [errorMsg,   setErrorMsg]   = useState('')
  const [supresion,  setSupresion]  = useState<AccionSupresion>('idle')
  const [supResult,  setSupResult]  = useState<any>(null)
  const [tab,        setTab]        = useState<'resumen' | 'usuario' | 'mensajes' | 'audit'>('resumen')

  async function consultar() {
    if (!email.trim()) return
    setEstado('cargando')
    setDatos(null)
    setSupresion('idle')
    setSupResult(null)
    try {
      const res = await fetch(`/api/habeas-data?email=${encodeURIComponent(email.trim())}`)
      const json = await res.json()
      if (!res.ok) { setEstado('error'); setErrorMsg(json.error ?? 'Error desconocido'); return }
      if (!json.encontrado) { setEstado('no_encontrado'); return }
      setDatos(json)
      setEstado('encontrado')
      setTab('resumen')
    } catch (e: any) {
      setEstado('error')
      setErrorMsg(e.message)
    }
  }

  async function ejecutarSupresion() {
    setSupresion('procesando')
    try {
      const res = await fetch(`/api/habeas-data?email=${encodeURIComponent(email.trim())}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) { setSupresion('error'); setErrorMsg(json.error ?? 'Error'); return }
      setSupResult(json)
      setSupresion('done')
      setEstado('idle')
      setDatos(null)
    } catch (e: any) {
      setSupresion('error')
      setErrorMsg(e.message)
    }
  }

  function exportarJSON() {
    if (!datos) return
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `habeas-data-${email.trim()}-${new Date().toISOString().slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>

      {/* Cabecera */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{
          fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.2em',
          textTransform: 'uppercase', color: C.olivo, marginBottom: '0.3rem',
        }}>
          Protección de datos · Ley 1581 de 2012
        </div>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: '1.4rem', fontWeight: 700, color: C.marfil, margin: 0,
        }}>
          Canal de Habeas Data
        </h1>
        <p style={{ fontSize: '0.78rem', color: 'rgba(231,223,202,0.5)', marginTop: '0.4rem', lineHeight: 1.6 }}>
          Consulta y supresión de datos personales. Plazo legal: 10 días hábiles para consulta,
          15 días para supresión (Arts. 14-16 Ley 1581). Registra la solicitud en{' '}
          <strong style={{ color: C.olivo }}>contacto@owlcompliance.co</strong> antes de ejecutar.
        </p>
      </div>

      {/* Buscador */}
      <div style={{
        background: 'rgba(231,223,202,0.05)',
        border: '1px solid rgba(150,134,34,0.25)',
        borderRadius: 10,
        padding: '1.2rem 1.4rem',
        marginBottom: '1.5rem',
      }}>
        <label style={{
          display: 'block', fontSize: '0.68rem', fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase', color: C.olivo,
          marginBottom: '0.5rem',
        }}>
          Email del titular
        </label>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && consultar()}
            placeholder="titular@empresa.co"
            style={{
              flex: 1, minWidth: 220,
              padding: '0.65rem 0.9rem',
              background: 'rgba(231,223,202,0.08)',
              border: '1.5px solid rgba(231,223,202,0.15)',
              borderRadius: 6,
              color: C.marfil,
              fontSize: '0.88rem',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <button
            onClick={consultar}
            disabled={estado === 'cargando' || !email.trim()}
            style={btnStyle(C.olivo, estado === 'cargando' || !email.trim())}
          >
            {estado === 'cargando' ? 'Consultando...' : 'Consultar datos'}
          </button>
        </div>
      </div>

      {/* No encontrado */}
      {estado === 'no_encontrado' && (
        <Notice color="#6b7280">
          No se encontraron datos personales para <strong>{email}</strong> en la plataforma.
        </Notice>
      )}

      {/* Error */}
      {estado === 'error' && (
        <Notice color={C.bordo}>Error: {errorMsg}</Notice>
      )}

      {/* Resultado de supresión */}
      {supresion === 'done' && supResult && (
        <div style={{
          background: 'rgba(45,122,58,0.1)', border: '1px solid rgba(45,122,58,0.35)',
          borderRadius: 10, padding: '1.2rem 1.4rem', marginBottom: '1.5rem',
        }}>
          <div style={{ fontWeight: 700, color: '#6fcf97', marginBottom: '0.5rem' }}>
            Supresión completada — {supResult.ejecutado_en?.slice(0,10)}
          </div>
          <ul style={{ fontSize: '0.8rem', color: 'rgba(231,223,202,0.7)', paddingLeft: '1.2rem', lineHeight: 1.8 }}>
            {supResult.acciones?.map((a: string, i: number) => <li key={i}>{a}</li>)}
          </ul>
          <div style={{ fontSize: '0.75rem', color: 'rgba(231,223,202,0.4)', marginTop: '0.5rem' }}>
            {supResult.nota}
          </div>
        </div>
      )}

      {/* Datos encontrados */}
      {estado === 'encontrado' && datos && (
        <div>
          {/* Barra de acciones */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.2rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={exportarJSON} style={btnStyle('rgba(150,134,34,0.3)')}>
              Exportar JSON
            </button>
            {supresion === 'idle' && (
              <button onClick={() => setSupresion('confirmando')} style={btnStyle(C.bordo)}>
                Suprimir datos
              </button>
            )}
            {supresion === 'confirmando' && (
              <>
                <span style={{ fontSize: '0.78rem', color: '#eb5757', fontWeight: 600 }}>
                  ¿Confirmar supresión de datos de <em>{email}</em>? Esta acción no se puede deshacer.
                </span>
                <button onClick={ejecutarSupresion} style={btnStyle('#dc2626')}>Confirmar supresión</button>
                <button onClick={() => setSupresion('idle')} style={btnStyle('rgba(231,223,202,0.15)')}>Cancelar</button>
              </>
            )}
            {supresion === 'procesando' && (
              <span style={{ fontSize: '0.78rem', color: C.olivo }}>Procesando supresión...</span>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', borderBottom: '1px solid rgba(231,223,202,0.1)', paddingBottom: '0.5rem' }}>
            {(['resumen', 'usuario', 'mensajes', 'audit'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                background: tab === t ? C.olivo : 'transparent',
                border: `1px solid ${tab === t ? C.olivo : 'rgba(231,223,202,0.15)'}`,
                borderRadius: 5, padding: '0.35rem 0.8rem',
                fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: tab === t ? C.vino : 'rgba(231,223,202,0.5)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {t === 'resumen' ? 'Resumen' : t === 'usuario' ? 'Usuario' : t === 'mensajes' ? `Mensajes (${datos.datos.mensajes_chat.length + datos.datos.respuestas_tickets.length})` : `Auditoría (${datos.datos.audit_log.length})`}
              </button>
            ))}
          </div>

          {/* Tab: Resumen */}
          {tab === 'resumen' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem' }}>
              {[
                { label: 'Clientes ISP', val: datos.resumen.clientes },
                { label: 'Mensajes chat', val: datos.resumen.mensajes_chat },
                { label: 'Resp. tickets', val: datos.resumen.respuestas_tickets },
                { label: 'Recordatorios', val: datos.resumen.recordatorios },
                { label: 'Reg. auditoría', val: datos.resumen.registros_auditoria },
              ].map(({ label, val }) => (
                <div key={label} style={{
                  background: 'rgba(231,223,202,0.05)',
                  border: '1px solid rgba(150,134,34,0.2)',
                  borderRadius: 8, padding: '0.9rem 1rem', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: C.olivo }}>{val}</div>
                  <div style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.4)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Tab: Usuario */}
          {tab === 'usuario' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Card titulo="Cuenta de usuario">
                <KV label="ID" val={datos.datos.usuario.id} />
                <KV label="Email" val={datos.datos.usuario.email} />
                <KV label="Nombre" val={datos.datos.usuario.nombre} />
                <KV label="Rol" val={datos.datos.usuario.rol} />
                <KV label="Activo" val={datos.datos.usuario.activo ? 'Sí' : 'No'} />
                <KV label="Creado" val={datos.datos.usuario.created_at?.slice(0,10)} />
              </Card>
              {datos.datos.clientes.map((cl: any) => (
                <Card key={cl.id} titulo={`Cliente: ${cl.razon_social}`}>
                  <KV label="NIT" val={cl.nit} />
                  <KV label="Contacto" val={cl.contacto} />
                  <KV label="Email empresa" val={cl.email} />
                  <KV label="Teléfono" val={cl.telefono} />
                  <KV label="Creado" val={cl.created_at?.slice(0,10)} />
                </Card>
              ))}
              {datos.datos.recordatorios.length > 0 && (
                <Card titulo="Recordatorios de email">
                  {datos.datos.recordatorios.map((r: any) => (
                    <KV key={r.id} label={r.email_destino} val={`${r.dias_antes} días de anticipación · ${r.activo ? 'Activo' : 'Inactivo'}`} />
                  ))}
                </Card>
              )}
            </div>
          )}

          {/* Tab: Mensajes */}
          {tab === 'mensajes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {datos.datos.mensajes_chat.length === 0 && datos.datos.respuestas_tickets.length === 0 && (
                <p style={{ color: 'rgba(231,223,202,0.4)', fontSize: '0.82rem' }}>Sin mensajes registrados.</p>
              )}
              {datos.datos.mensajes_chat.map((m: any) => (
                <div key={m.id} style={msgStyle}>
                  <span style={{ fontSize: '0.65rem', color: 'rgba(231,223,202,0.35)' }}>Chat · {m.created_at?.slice(0,16)}</span>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'rgba(231,223,202,0.8)' }}>{m.contenido}</p>
                </div>
              ))}
              {datos.datos.respuestas_tickets.map((r: any) => (
                <div key={r.id} style={msgStyle}>
                  <span style={{ fontSize: '0.65rem', color: 'rgba(231,223,202,0.35)' }}>Ticket #{r.ticket_id?.slice(0,8)} · {r.created_at?.slice(0,16)}</span>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'rgba(231,223,202,0.8)' }}>{r.contenido}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tab: Auditoría */}
          {tab === 'audit' && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr>
                    {['Fecha', 'Acción', 'Entidad', 'IP'].map(h => (
                      <th key={h} style={{ background: 'rgba(231,223,202,0.08)', color: C.olivo, padding: '0.5rem 0.8rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {datos.datos.audit_log.map((a: any) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid rgba(231,223,202,0.06)' }}>
                      <td style={tdStyle}>{a.created_at?.slice(0, 16)}</td>
                      <td style={tdStyle}>{a.accion}</td>
                      <td style={tdStyle}>{a.entidad}</td>
                      <td style={{ ...tdStyle, color: 'rgba(231,223,202,0.35)' }}>{a.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Componentes auxiliares ── */

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(231,223,202,0.04)', border: '1px solid rgba(231,223,202,0.1)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ background: 'rgba(150,134,34,0.12)', padding: '0.5rem 1rem', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#968622' }}>{titulo}</div>
      <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>{children}</div>
    </div>
  )
}

function KV({ label, val }: { label: string; val: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.82rem' }}>
      <span style={{ color: 'rgba(231,223,202,0.4)', minWidth: 120, flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#e7dfca' }}>{val ?? '—'}</span>
    </div>
  )
}

function Notice({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: `${color}18`, border: `1px solid ${color}55`,
      borderRadius: 8, padding: '0.9rem 1.1rem',
      fontSize: '0.82rem', color: '#e7dfca', marginBottom: '1rem',
    }}>
      {children}
    </div>
  )
}

function btnStyle(bg: string, disabled = false): React.CSSProperties {
  return {
    background: disabled ? 'rgba(231,223,202,0.05)' : bg,
    border: 'none', borderRadius: 6,
    padding: '0.6rem 1.1rem',
    fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: disabled ? 'rgba(231,223,202,0.3)' : '#e7dfca',
    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
  }
}

const msgStyle: React.CSSProperties = {
  background: 'rgba(231,223,202,0.04)',
  border: '1px solid rgba(231,223,202,0.08)',
  borderRadius: 6, padding: '0.6rem 0.9rem',
}

const tdStyle: React.CSSProperties = {
  padding: '0.5rem 0.8rem', color: 'rgba(231,223,202,0.75)', verticalAlign: 'top',
}
