'use client'

/**
 * Servicios on demand (superadmin): crear el enlace que se le envía al cliente
 * y hacer seguimiento — si ya llenó sus datos, si pagó y cómo va el trabajo.
 * Ver app/api/superadmin/pagos-on-demand/route.ts.
 */
import { useEffect, useState } from 'react'
import NavLogo from '@/components/NavLogo'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

type Avance = 'por_iniciar' | 'en_curso' | 'entregado' | 'cancelado'
type EstadoPago = 'esperando_datos' | 'pendiente' | 'pagada' | 'rechazada'

const PAGO: Record<EstadoPago, { label: string; color: string }> = {
  esperando_datos: { label: 'Esperando datos', color: '#6b7280' },
  pendiente:       { label: 'Pago pendiente',  color: '#d97706' },
  pagada:          { label: 'Pagado',          color: '#16a34a' },
  rechazada:       { label: 'Pago rechazado',  color: '#dc2626' },
}
const AVANCE: Record<Avance, { label: string; color: string }> = {
  por_iniciar: { label: 'Por iniciar', color: '#2563eb' },
  en_curso:    { label: 'En curso',    color: '#d97706' },
  entregado:   { label: 'Entregado',   color: '#16a34a' },
  cancelado:   { label: 'Cancelado',   color: '#6b7280' },
}

const fecha = (s?: string | null) => s
  ? new Date(s.replace(' ', 'T') + 'Z').toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : ''
const soloDigitos = (s: string) => s.replace(/\D/g, '')
const whatsapp = (tel: string) => { const d = soloDigitos(tel); return `https://wa.me/${d.length === 10 ? '57' + d : d}` }

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#777', marginBottom: 4,
}
const inputStyle = (error = false): React.CSSProperties => ({
  width: '100%', boxSizing: 'border-box', minHeight: 40, padding: '0 10px', borderRadius: 8, fontSize: 14,
  border: `1px solid ${error ? '#dc2626' : '#ccc'}`, fontFamily: 'inherit', background: '#fff',
})

export default function OnDemandClient() {
  const [servicios, setServicios] = useState<any[]>([])
  const [clientes, setClientes]   = useState<any[]>([])
  const [cargando, setCargando]   = useState(true)
  const [filtro, setFiltro]       = useState<'activos' | 'todos' | Avance>('activos')
  const [abierto, setAbierto]     = useState(false)
  const [form, setForm]           = useState({ concepto: '', monto: '', cliente_id: '', enviar_a: '' })
  const [campos, setCampos]       = useState<string[]>([])
  const [error, setError]         = useState('')
  const [creando, setCreando]     = useState(false)
  const [creado, setCreado]       = useState<{ enlace: string; correoEnviado: boolean } | null>(null)
  const [copiado, setCopiado]     = useState<string | null>(null)
  const [ocupado, setOcupado]     = useState<number | null>(null)
  const [notas, setNotas]         = useState<Record<number, string>>({})

  async function cargar() {
    try {
      const r = await fetch('/api/superadmin/pagos-on-demand', { cache: 'no-store' })
      if (r.ok) setServicios((await r.json()).servicios ?? [])
    } finally {
      setCargando(false)
    }
  }
  useEffect(() => {
    cargar()
    fetch('/api/clientes').then(r => r.ok ? r.json() : []).then(cl => setClientes(Array.isArray(cl) ? cl : [])).catch(() => {})
  }, [])

  function elegirCliente(id: string) {
    const c = clientes.find(x => x.id === id)
    setForm(f => ({ ...f, cliente_id: id, enviar_a: c ? (c.email || c.user_email || '') : f.enviar_a }))
  }

  async function crear() {
    setCreando(true); setError(''); setCampos([]); setCreado(null)
    try {
      const r = await fetch('/api/superadmin/pagos-on-demand', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, monto: Number(soloDigitos(form.monto)) }),
      })
      const j = await r.json()
      if (!r.ok) { setError(j.error ?? 'No se pudo crear'); setCampos(j.campos ?? []); return }
      setCreado({ enlace: j.enlace, correoEnviado: j.correoEnviado })
      setForm({ concepto: '', monto: '', cliente_id: '', enviar_a: '' })
      cargar()
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setCreando(false)
    }
  }

  async function copiar(texto: string) {
    try { await navigator.clipboard.writeText(texto); setCopiado(texto); setTimeout(() => setCopiado(null), 2000) } catch {}
  }

  async function guardar(id: number, cambios: object, confirmar?: string) {
    if (confirmar && !window.confirm(confirmar)) return
    setOcupado(id)
    try {
      const r = await fetch('/api/superadmin/pagos-on-demand', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...cambios }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { alert(j.error ?? 'No se pudo guardar'); return }
      setServicios(ss => ss.map(s => s.id === id ? { ...s, ...j.servicio } : s))
      setNotas(n => { const x = { ...n }; delete x[id]; return x })
    } finally {
      setOcupado(null)
    }
  }

  async function eliminar(s: any) {
    if (!window.confirm(`¿Eliminar "${s.concepto}"? El enlace dejará de funcionar. No se puede deshacer.`)) return
    setOcupado(s.id)
    const r = await fetch(`/api/superadmin/pagos-on-demand?id=${s.id}`, { method: 'DELETE' })
    if (!r.ok) alert((await r.json().catch(() => ({}))).error ?? 'No se pudo eliminar')
    await cargar(); setOcupado(null)
  }

  const visibles = servicios.filter(s =>
    filtro === 'todos' ? true : filtro === 'activos' ? s.avance === 'por_iniciar' || s.avance === 'en_curso' : s.avance === filtro)
  const cuenta = (f: typeof filtro) => servicios.filter(s =>
    f === 'todos' ? true : f === 'activos' ? s.avance === 'por_iniciar' || s.avance === 'en_curso' : s.avance === f).length
  const porCobrar = servicios.filter(s => s.estado_pago === 'pendiente' || s.estado_pago === 'esperando_datos')
    .filter(s => s.avance !== 'cancelado').reduce((t, s) => t + s.monto, 0)
  const cobrado = servicios.filter(s => s.estado_pago === 'pagada').reduce((t, s) => t + s.monto, 0)

  const chip = (activo: boolean, color: string): React.CSSProperties => ({
    fontSize: 13, fontWeight: 600, padding: '6px 12px', borderRadius: 16, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
    border: `1px solid ${color}`, background: activo ? color : '#fff', color: activo ? '#fff' : color,
  })
  const boton = (color: string, lleno = false): React.CSSProperties => ({
    fontSize: 12, fontWeight: 700, padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
    border: `1.5px solid ${color}`, background: lleno ? color : '#fff', color: lleno ? '#fff' : color, textDecoration: 'none',
    display: 'inline-flex', alignItems: 'center',
  })
  const badge = (b: { label: string; color: string }) => (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: b.color + '1f', color: b.color }}>{b.label}</span>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f3ee', fontFamily: "'Josefin Sans', sans-serif", color: '#222' }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      <nav style={{ position: 'sticky', top: 0, zIndex: 5, background: C.vino, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <NavLogo />
        <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.olivo }}>Servicios on demand</span>
        <a href="/dashboard" style={{ marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.6)', textDecoration: 'none' }}>← Volver</a>
      </nav>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: '#555' }}>
            Cobrado: <strong style={{ color: '#16a34a' }}>${cobrado.toLocaleString('es-CO')}</strong>
            {' · '}Por cobrar: <strong style={{ color: '#d97706' }}>${porCobrar.toLocaleString('es-CO')}</strong>
          </div>
          <button onClick={() => { setAbierto(a => !a); setCreado(null) }} style={{ ...boton(C.vino, true), marginLeft: 'auto' }}>
            {abierto ? 'Cerrar' : '+ Nuevo servicio'}
          </button>
        </div>

        {abierto && (
          <div style={{ background: '#fff', borderRadius: 12, padding: '1rem', marginBottom: 14, border: '1px solid #e5e7eb' }}>
            <p style={{ fontSize: 13, color: '#666', margin: '0 0 12px', lineHeight: 1.5 }}>
              Se crea un enlace para enviarle al cliente. Allí él escribe sus datos de contacto y el objeto del servicio,
              y luego paga en Trazo. <strong>No crea cuenta ni cambia su suscripción.</strong>
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Servicio *</label>
                <input value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))}
                  placeholder="Ej. Acompañamiento visita MinTIC" style={inputStyle(campos.includes('concepto'))} />
              </div>
              <div>
                <label style={labelStyle}>Valor (COP) *</label>
                <input inputMode="numeric" value={form.monto} placeholder="500.000" style={inputStyle(campos.includes('monto'))}
                  onChange={e => { const n = soloDigitos(e.target.value); setForm(f => ({ ...f, monto: n ? Number(n).toLocaleString('es-CO') : '' })) }} />
              </div>
              <div>
                <label style={labelStyle}>Cliente existente (opcional)</label>
                <select value={form.cliente_id} onChange={e => elegirCliente(e.target.value)} style={inputStyle()}>
                  <option value="">— Nuevo / no es cliente —</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Enviar el enlace a este correo (opcional)</label>
                <input type="email" value={form.enviar_a} onChange={e => setForm(f => ({ ...f, enviar_a: e.target.value }))}
                  placeholder="Vacío = solo copiar el enlace" style={inputStyle(campos.includes('enviar_a'))} />
              </div>
            </div>
            {error && <div style={{ color: '#b91c1c', fontSize: 13, marginTop: 10 }}>{error}</div>}
            <button onClick={crear} disabled={creando} style={{ ...boton(C.olivo, true), marginTop: 12, opacity: creando ? 0.6 : 1 }}>
              {creando ? 'Creando…' : 'Crear enlace'}
            </button>
            {creado && (
              <div style={{ marginTop: 12, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 13, marginBottom: 6 }}>✓ Listo{creado.correoEnviado ? ': se envió por correo.' : '. Copia el enlace y envíaselo al cliente.'}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input readOnly value={creado.enlace} onFocus={e => e.target.select()} style={inputStyle()} />
                  <button onClick={() => copiar(creado.enlace)} style={boton(C.vino, true)}>{copiado === creado.enlace ? 'Copiado' : 'Copiar'}</button>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 10 }}>
          <button onClick={() => setFiltro('activos')} style={chip(filtro === 'activos', C.vino)}>Activos ({cuenta('activos')})</button>
          {(Object.keys(AVANCE) as Avance[]).map(a => (
            <button key={a} onClick={() => setFiltro(a)} style={chip(filtro === a, AVANCE[a].color)}>{AVANCE[a].label} ({cuenta(a)})</button>
          ))}
          <button onClick={() => setFiltro('todos')} style={chip(filtro === 'todos', '#555')}>Todos ({servicios.length})</button>
        </div>

        {!cargando && visibles.length === 0 && (
          <div style={{ background: '#fff', borderRadius: 12, padding: '2rem 1rem', textAlign: 'center', color: '#999', fontSize: 14 }}>
            {servicios.length === 0 ? 'Todavía no hay servicios on demand. Crea el primero con "+ Nuevo servicio".' : 'No hay servicios con este filtro.'}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visibles.map(s => {
            const pago = PAGO[s.estado_pago as EstadoPago] ?? PAGO.pendiente
            const nota = notas[s.id] ?? s.notas
            const conDatos = !!s.datos_at
            return (
              <article key={s.id} style={{ background: '#fff', borderRadius: 12, padding: '0.9rem 1rem', border: '1px solid #e5e7eb',
                borderLeft: `5px solid ${(AVANCE[s.avance as Avance] ?? AVANCE.por_iniciar).color}`, opacity: s.avance === 'cancelado' ? 0.65 : 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                  <strong style={{ fontSize: 16, color: C.vino, flex: '1 1 220px' }}>{s.concepto}</strong>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>${Number(s.monto).toLocaleString('es-CO')}</span>
                  {badge(pago)}
                </div>

                {conDatos ? (
                  <>
                    <div style={{ fontSize: 14, marginBottom: 4 }}>
                      <strong>{s.nombre}</strong> · {s.empresa} <span style={{ color: '#888', fontSize: 12 }}>({s.tipo_id} {s.numero_id})</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      <a href={`tel:${soloDigitos(s.telefono)}`} style={boton('#2563eb')}>📞 {s.telefono}</a>
                      <a href={whatsapp(s.telefono)} target="_blank" rel="noopener" style={boton('#16a34a')}>WhatsApp</a>
                      <a href={`mailto:${s.correo}`} style={boton('#555')}>✉ {s.correo}</a>
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.5, background: '#faf8f3', borderRadius: 8, padding: '8px 10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 8 }}>
                      <span style={{ ...labelStyle, display: 'block' }}>Objeto del servicio</span>{s.objeto}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>
                    El cliente aún no ha abierto el enlace ni llenado sus datos{s.empresa ? ` (precargado: ${s.empresa})` : ''}.
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 12, color: '#666' }}>Avance:</label>
                  <select value={s.avance} disabled={ocupado === s.id} onChange={e => guardar(s.id, { avance: e.target.value })}
                    style={{ ...inputStyle(), width: 'auto', minHeight: 34 }}>
                    {(Object.keys(AVANCE) as Avance[]).map(a => <option key={a} value={a}>{AVANCE[a].label}</option>)}
                  </select>
                  <button onClick={() => copiar(s.enlace)} style={boton(C.vino)}>{copiado === s.enlace ? 'Copiado' : 'Copiar enlace'}</button>
                  {s.estado_pago === 'pendiente' && (
                    <button disabled={ocupado === s.id} style={boton('#16a34a')}
                      onClick={() => guardar(s.id, { marcar_pagado: true }, '¿Marcar como pagado? Hazlo solo después de verificar el pago en Trazo.')}>
                      Marcar pagado
                    </button>
                  )}
                  {s.estado_pago !== 'pagada' && (
                    <button disabled={ocupado === s.id} onClick={() => eliminar(s)} style={boton('#dc2626')}>Eliminar</button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <textarea rows={2} value={nota} placeholder="Notas de seguimiento (llamadas, acuerdos, entregables…)"
                    onChange={e => setNotas(n => ({ ...n, [s.id]: e.target.value }))}
                    style={{ ...inputStyle(), minHeight: 44, padding: 8, resize: 'vertical', flex: 1 }} />
                  {notas[s.id] !== undefined && notas[s.id] !== s.notas && (
                    <button disabled={ocupado === s.id} onClick={() => guardar(s.id, { notas: notas[s.id] })} style={boton(C.olivo, true)}>Guardar</button>
                  )}
                </div>

                <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>
                  Creado {fecha(s.created_at)}{s.creado_por ? ` por ${s.creado_por}` : ''}
                  {s.datos_at ? ` · datos recibidos ${fecha(s.datos_at)}` : ''}
                </div>
              </article>
            )
          })}
        </div>
      </main>
    </div>
  )
}
