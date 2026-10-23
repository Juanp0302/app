'use client'

import { useEffect, useState, useCallback } from 'react'
import NavLogo from '@/components/NavLogo'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

type Fila = {
  id: string; razon_social: string; email: string | null
  plan: string | null; suscripcion_estado: string | null; es_cortesia: number
  diagnostico_estado: 'solicitado' | 'activo' | 'cerrado'
  diagnostico_solicitado_at: string | null; diagnostico_activado_at: string | null; diagnostico_cerrado_at: string | null
  docs_total: number; docs_pendientes: number
}

const ESTADO: Record<string, { label: string; color: string }> = {
  solicitado: { label: 'Solicitado', color: '#f59e0b' },
  activo:     { label: 'Activo',     color: '#16a34a' },
  cerrado:    { label: 'Cerrado',    color: '#6b7280' },
}

const fecha = (s: string | null) => s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString('es-CO') : '—'

export default function DiagnosticosClient() {
  const [filas, setFilas]       = useState<Fila[]>([])
  const [esSuper, setEsSuper]   = useState(false)
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado]   = useState<string | null>(null)
  const [msg, setMsg]           = useState<{ ok: boolean; texto: string } | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res  = await fetch('/api/diagnostico')
      const json = await res.json()
      setFilas(json.diagnosticos ?? [])
      setEsSuper(!!json.esSuperadmin)
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function accion(f: Fila, tipo: 'activar' | 'cerrar') {
    if (tipo === 'activar' && !confirm(`¿Activar el diagnóstico de ${f.razon_social}?\n\nSus ${f.docs_pendientes} documentos sin revisar entrarán a la cola de revisión y se avisará a los administradores con un correo resumen.`)) return
    if (tipo === 'cerrar' && !confirm(`¿Cerrar el diagnóstico de ${f.razon_social}? Confirma que ya entregaste el Mapa de Madurez.\n\nLos ${f.docs_pendientes} documentos que sigan sin revisar saldrán de la cola de revisión (el cliente no tiene revisión por plan).`)) return
    setOcupado(f.id); setMsg(null)
    try {
      const res  = await fetch('/api/diagnostico', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: tipo, clienteId: f.id }) })
      const json = await res.json()
      if (!res.ok) { setMsg({ ok: false, texto: json.error ?? 'No se pudo completar la acción' }); return }
      setMsg({ ok: true, texto: tipo === 'activar'
        ? `Diagnóstico activado. ${json.documentosEnRevision ?? 0} documento(s) entraron a revisión.`
        : `Diagnóstico cerrado. ${json.pendientesQueSalen ?? 0} documento(s) pendiente(s) salieron de la cola.` })
      await cargar()
    } catch { setMsg({ ok: false, texto: 'No se pudo completar la acción' }) }
    finally { setOcupado(null) }
  }

  const btn = (color: string, ghost = false): React.CSSProperties => ({
    fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'inherit',
    padding: '0.4rem 0.9rem', borderRadius: 6, cursor: 'pointer',
    background: ghost ? 'transparent' : color, color: ghost ? color : '#fff', border: `1px solid ${color}`,
  })

  return (
    <div style={{ minHeight: '100vh', background: C.vino, color: C.marfil, fontFamily: "'Josefin Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />
      <nav style={{ background: C.vino, borderBottom: '1px solid rgba(150,134,34,0.2)', padding: '0.9rem 2rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <NavLogo />
        <span style={{ color: 'rgba(231,223,202,0.3)' }}>›</span>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.olivo }}>Diagnósticos integrales</span>
        <a href="/dashboard" style={{ marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.5)', textDecoration: 'none' }}>← Volver</a>
      </nav>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem' }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.7rem', fontWeight: 700, marginBottom: '0.4rem' }}>Diagnósticos integrales</div>
        <p style={{ fontSize: '0.8rem', color: 'rgba(231,223,202,0.6)', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
          Servicio on-demand para clientes sin revisión por plan. Mientras está activo, sus documentos pasan por un asesor como en Pro/Premium.
          {' '}{esSuper ? 'Tú puedes activarlos; cualquier administrador puede cerrarlos al entregar el Mapa de Madurez.' : 'Solo el superadmin los activa; tú puedes cerrarlos al entregar el Mapa de Madurez.'}
        </p>

        {msg && (
          <div style={{ marginBottom: '1rem', padding: '0.7rem 1rem', borderRadius: 8, fontSize: '0.82rem',
            background: msg.ok ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)', color: msg.ok ? '#86efac' : '#fca5a5' }}>{msg.texto}</div>
        )}

        {cargando ? (
          <div style={{ color: 'rgba(231,223,202,0.5)' }}>Cargando…</div>
        ) : filas.length === 0 ? (
          <div style={{ color: 'rgba(231,223,202,0.5)', fontSize: '0.9rem' }}>Todavía no hay solicitudes de diagnóstico.</div>
        ) : filas.map(f => {
          const e = ESTADO[f.diagnostico_estado] ?? ESTADO.cerrado
          return (
            <div key={f.id} style={{ background: 'rgba(231,223,202,0.05)', border: '1px solid rgba(150,134,34,0.2)', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '0.7rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{f.razon_social}</div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(231,223,202,0.55)', marginTop: 2 }}>
                  {f.email ?? 'sin correo'} · plan {f.es_cortesia ? 'cortesía' : (f.plan ?? 'sin plan')}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(231,223,202,0.45)', marginTop: 4 }}>
                  Solicitado {fecha(f.diagnostico_solicitado_at)} · Activado {fecha(f.diagnostico_activado_at)} · Cerrado {fecha(f.diagnostico_cerrado_at)}
                </div>
              </div>
              <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 10px', borderRadius: 10, background: `${e.color}33`, color: e.color }}>{e.label}</span>
              <div style={{ fontSize: '0.75rem', color: 'rgba(231,223,202,0.7)', textAlign: 'right' }}>
                {f.docs_total} doc{f.docs_total !== 1 ? 's' : ''}<br />{f.docs_pendientes} sin revisar
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {f.diagnostico_estado === 'solicitado' && esSuper && (
                  <button disabled={ocupado === f.id} onClick={() => accion(f, 'activar')} style={btn('#16a34a')}>{ocupado === f.id ? '…' : 'Activar'}</button>
                )}
                {f.diagnostico_estado === 'activo' && (
                  <button disabled={ocupado === f.id} onClick={() => accion(f, 'cerrar')} style={btn(C.olivo, true)}>{ocupado === f.id ? '…' : 'Cerrar (entregado)'}</button>
                )}
                <a href={`/dashboard/documentos?clienteId=${f.id}`} style={{ ...btn(C.olivo, true), textDecoration: 'none', display: 'inline-block' }}>Documentos</a>
              </div>
            </div>
          )
        })}
      </main>
    </div>
  )
}
