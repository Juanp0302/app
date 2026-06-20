'use client'

import { useEffect, useState, useCallback } from 'react'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

const CATEGORIAS_SERVICIO: Record<string, string> = {
  'SERVICIOS DE VALOR AGREGADO Y TELEMÁTICOS (SVA)': 'SVA',
  'SERVICIOS DE TELEFONÍA MÓVIL': 'Móvil',
  'SERVICIOS DE TELEFONÍA FIJA':  'Fija',
  'OTROS SERVICIOS DE TELECOMUNICACIONES': 'Otros',
}

// Agrupar servicios por categoría según prefijos conocidos
function categorizarServicio(nombre: string): string {
  const n = nombre.toLowerCase()
  if (n.includes('sva') || n.includes('iptv') || n.includes('isp')) return 'SVA'
  if (n.includes('móvil') || n.includes('movil') || n.includes('celular') || n.includes('pcs')) return 'Móvil'
  if (n.includes('tpbc') || n.includes('fijo') || n.includes('comunitario')) return 'Fija'
  return 'Otros'
}

function pctColor(pct: number) {
  if (pct >= 80) return '#16a34a'
  if (pct >= 50) return '#968622'
  return '#dc2626'
}

interface Cliente {
  id:           string
  razon_social: string
  nit:          string
  contacto:     string
  email:        string
  telefono:     string
  user_email:   string
  user_nombre:  string
  activo:       number
  servicios:    string[]
  total_obl:    number
  cumplidas:    number
  vencidas:     number
  pendientes:   number
  pct:          number
  created_at:   string
}

const SERVICIO_FORM_INIT = {
  razon_social: '', nit: '', contacto: '', email: '', telefono: '',
  user_email: '', user_nombre: '', user_password: '',
  servicios: [] as string[],
}

export default function ClientesClient({
  serviciosDisponibles,
}: {
  serviciosDisponibles: { servicio: string; servicio_slug: string }[]
}) {
  const [clientes,    setClientes]    = useState<Cliente[]>([])
  const [loading,     setLoading]     = useState(true)
  const [modalNuevo,  setModalNuevo]  = useState(false)
  const [modalDetalle, setModalDetalle] = useState<Cliente | null>(null)
  const [form,        setForm]        = useState(SERVICIO_FORM_INIT)
  const [saving,      setSaving]      = useState(false)
  const [formError,   setFormError]   = useState('')
  const [busqueda,    setBusqueda]    = useState('')
  const [nuevoServ,   setNuevoServ]   = useState('')
  const [addingServ,  setAddingServ]  = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/clientes')
      setClientes(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const clientesFiltrados = clientes.filter(c =>
    c.razon_social.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.nit ?? '').includes(busqueda) ||
    (c.email ?? '').toLowerCase().includes(busqueda.toLowerCase())
  )

  // Estadísticas globales
  const stats = clientes.reduce((acc, c) => ({
    total:     acc.total + 1,
    cumplidas: acc.cumplidas + c.cumplidas,
    vencidas:  acc.vencidas  + c.vencidas,
    total_obl: acc.total_obl + c.total_obl,
  }), { total: 0, cumplidas: 0, vencidas: 0, total_obl: 0 })

  const pctGlobal = stats.total_obl
    ? Math.round((stats.cumplidas / stats.total_obl) * 100)
    : 0

  async function crearCliente(e: React.FormEvent) {
    e.preventDefault()
    if (!form.servicios.length) { setFormError('Selecciona al menos un servicio'); return }
    setSaving(true); setFormError('')
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) { setFormError(json.error ?? 'Error al crear'); return }
      setModalNuevo(false)
      setForm(SERVICIO_FORM_INIT)
      cargar()
    } finally {
      setSaving(false)
    }
  }

  async function agregarServicio() {
    if (!modalDetalle || !nuevoServ) return
    setAddingServ(true)
    try {
      const res = await fetch(`/api/clientes?id=${modalDetalle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nuevo_servicio: nuevoServ }),
      })
      const json = await res.json()
      if (!res.ok) { alert(json.error ?? 'Error'); return }
      alert(`✓ Servicio agregado. ${json.nuevasObligaciones} nuevas obligaciones asignadas.`)
      setNuevoServ('')
      cargar()
      setModalDetalle(null)
    } finally {
      setAddingServ(false)
    }
  }

  function toggleServicio(slug: string) {
    setForm(f => ({
      ...f,
      servicios: f.servicios.includes(slug)
        ? f.servicios.filter(s => s !== slug)
        : [...f.servicios, slug],
    }))
  }

  // Agrupar servicios disponibles por categoría
  const serviciosPorCat = serviciosDisponibles.reduce((acc, s) => {
    const cat = categorizarServicio(s.servicio)
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(s)
    return acc
  }, {} as Record<string, typeof serviciosDisponibles>)

  return (
    <div style={{ minHeight:'100vh', background:C.vino, fontFamily:"'Josefin Sans', sans-serif", color:C.marfil }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      {/* NAV */}
      <nav style={{ background:'rgba(39,2,5,0.97)', borderBottom:'1px solid rgba(150,134,34,0.2)', padding:'0.9rem 2rem', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'1.5rem' }}>
          <a href="/dashboard" style={{ fontFamily:"'Playfair Display', serif", fontSize:'1.1rem', fontWeight:700, color:C.marfil, textDecoration:'none' }}>Owl Compliance</a>
          <span style={{ color:'rgba(231,223,202,0.3)' }}>›</span>
          <span style={{ fontSize:'0.72rem', fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase', color:C.olivo }}>Panel de Clientes</span>
        </div>
        <a href="/api/auth/signout" style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:'rgba(231,223,202,0.5)', textDecoration:'none' }}>Salir</a>
      </nav>

      <main style={{ maxWidth:'1200px', margin:'0 auto', padding:'2rem' }}>

        {/* ── ESTADÍSTICAS GLOBALES ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'1rem', marginBottom:'2.5rem' }}>
          {[
            { label:'Clientes activos', val: stats.total,     color:C.marfil },
            { label:'Cumplimiento global', val:`${pctGlobal}%`, color: pctColor(pctGlobal), big:true },
            { label:'Obligaciones totales', val: stats.total_obl, color:'rgba(231,223,202,0.7)' },
            { label:'Cumplidas',  val: stats.cumplidas, color:'#16a34a' },
            { label:'Vencidas',   val: stats.vencidas,  color:'#dc2626' },
          ].map(s => (
            <div key={s.label} style={{ background:'rgba(231,223,202,0.05)', border:'1px solid rgba(150,134,34,0.2)', borderRadius:'12px', padding:'1.2rem 1.4rem' }}>
              <div style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:'rgba(231,223,202,0.45)', marginBottom:'0.4rem' }}>{s.label}</div>
              <div style={{ fontSize: s.big ? '2rem' : '1.7rem', fontWeight:700, color:s.color, fontFamily:"'Playfair Display', serif" }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* ── CABECERA + BUSCAR + NUEVO ── */}
        <div style={{ display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap', marginBottom:'1.5rem' }}>
          <input
            placeholder="Buscar por nombre, NIT o email…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ flex:1, minWidth:'220px', background:'rgba(231,223,202,0.07)', border:'1px solid rgba(150,134,34,0.25)', borderRadius:'8px', padding:'0.7rem 1rem', color:C.marfil, fontSize:'0.88rem', fontFamily:'inherit', outline:'none' }}
          />
          <button onClick={() => { setModalNuevo(true); setFormError('') }}
            style={{ background:C.olivo, color:C.vino, border:'none', borderRadius:'8px', padding:'0.7rem 1.4rem', fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
            + Nuevo cliente
          </button>
        </div>

        {/* ── TABLA DE CLIENTES ── */}
        {loading ? (
          <div style={{ textAlign:'center', padding:'4rem', color:'rgba(231,223,202,0.4)', fontSize:'0.85rem' }}>Cargando clientes…</div>
        ) : clientesFiltrados.length === 0 ? (
          <div style={{ textAlign:'center', padding:'4rem', color:'rgba(231,223,202,0.3)', fontSize:'0.85rem' }}>
            {busqueda ? 'No hay resultados para esa búsqueda.' : 'Aún no hay clientes. Crea el primero.'}
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
            {clientesFiltrados.map(c => (
              <div key={c.id}
                onClick={() => setModalDetalle(c)}
                style={{ background:'rgba(231,223,202,0.05)', border:'1px solid rgba(150,134,34,0.2)', borderRadius:'12px', padding:'1.2rem 1.5rem', cursor:'pointer', transition:'border-color 0.15s, background 0.15s', display:'grid', gridTemplateColumns:'1fr auto', gap:'1rem', alignItems:'center' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(150,134,34,0.5)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(231,223,202,0.08)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(150,134,34,0.2)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(231,223,202,0.05)' }}
              >
                {/* Info principal */}
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.8rem', marginBottom:'0.4rem' }}>
                    <span style={{ fontSize:'0.95rem', fontWeight:700 }}>{c.razon_social}</span>
                    {c.nit && <span style={{ fontSize:'0.65rem', color:'rgba(231,223,202,0.45)' }}>NIT {c.nit}</span>}
                    {!c.activo && <span style={{ fontSize:'0.6rem', fontWeight:700, background:'rgba(220,38,38,0.15)', color:'#dc2626', padding:'0.15rem 0.5rem', borderRadius:'8px' }}>INACTIVO</span>}
                  </div>
                  <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginBottom:'0.5rem' }}>
                    {c.servicios.map(s => (
                      <span key={s} style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', background:'rgba(150,134,34,0.12)', color:C.olivo, padding:'0.15rem 0.5rem', borderRadius:'8px' }}>
                        {s.replace(/_/g,' ')}
                      </span>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:'1.5rem', flexWrap:'wrap' }}>
                    {c.email && <span style={{ fontSize:'0.72rem', color:'rgba(231,223,202,0.5)' }}>{c.email}</span>}
                    {c.contacto && <span style={{ fontSize:'0.72rem', color:'rgba(231,223,202,0.5)' }}>{c.contacto}</span>}
                  </div>
                </div>

                {/* Cumplimiento */}
                <div style={{ textAlign:'center', minWidth:'120px' }}>
                  <div style={{ fontSize:'2rem', fontWeight:700, color: pctColor(c.pct), fontFamily:"'Playfair Display', serif", lineHeight:1 }}>
                    {c.pct}%
                  </div>
                  <div style={{ height:'4px', background:'rgba(231,223,202,0.1)', borderRadius:'2px', margin:'0.4rem 0', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${c.pct}%`, background: pctColor(c.pct), borderRadius:'2px', transition:'width 0.5s' }} />
                  </div>
                  <div style={{ fontSize:'0.62rem', color:'rgba(231,223,202,0.4)' }}>
                    {c.cumplidas}/{c.total_obl} · {c.vencidas > 0 && <span style={{ color:'#dc2626' }}>{c.vencidas} vencida{c.vencidas > 1 ? 's' : ''}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── MODAL DETALLE CLIENTE ── */}
      {modalDetalle && (
        <Modal onClose={() => { setModalDetalle(null); setNuevoServ('') }}>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:'1.4rem', fontWeight:700, marginBottom:'0.3rem' }}>
            {modalDetalle.razon_social}
          </div>
          {modalDetalle.nit && <div style={{ fontSize:'0.72rem', color:'rgba(231,223,202,0.5)', marginBottom:'1.5rem' }}>NIT {modalDetalle.nit}</div>}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1.5rem' }}>
            {[
              { label:'Contacto',   val: modalDetalle.contacto ?? '—' },
              { label:'Email',      val: modalDetalle.email ?? '—' },
              { label:'Teléfono',   val: modalDetalle.telefono ?? '—' },
              { label:'Usuario',    val: modalDetalle.user_email },
            ].map(r => (
              <div key={r.label}>
                <div style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(231,223,202,0.45)', marginBottom:'0.2rem' }}>{r.label}</div>
                <div style={{ fontSize:'0.85rem' }}>{r.val}</div>
              </div>
            ))}
          </div>

          {/* Cumplimiento */}
          <div style={{ background:'rgba(0,0,0,0.2)', borderRadius:'10px', padding:'1.1rem', marginBottom:'1.5rem' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.5rem', textAlign:'center' }}>
              {[
                { label:'Cumplimiento', val:`${modalDetalle.pct}%`, color: pctColor(modalDetalle.pct) },
                { label:'Cumplidas',   val: modalDetalle.cumplidas,  color:'#16a34a' },
                { label:'Pendientes',  val: modalDetalle.pendientes, color:C.olivo },
                { label:'Vencidas',    val: modalDetalle.vencidas,   color:'#dc2626' },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontSize:'1.4rem', fontWeight:700, color:s.color, fontFamily:"'Playfair Display', serif" }}>{s.val}</div>
                  <div style={{ fontSize:'0.58rem', textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(231,223,202,0.4)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Servicios actuales */}
          <div style={{ marginBottom:'1.5rem' }}>
            <div style={labelStyle}>Servicios activos</div>
            <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginTop:'0.4rem' }}>
              {modalDetalle.servicios.map(s => (
                <span key={s} style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', background:'rgba(150,134,34,0.15)', color:C.olivo, padding:'0.25rem 0.7rem', borderRadius:'20px', border:'1px solid rgba(150,134,34,0.3)' }}>
                  {s.replace(/_/g,' ')}
                </span>
              ))}
            </div>
          </div>

          {/* Agregar servicio */}
          <div style={{ borderTop:'1px solid rgba(150,134,34,0.15)', paddingTop:'1.3rem', marginBottom:'1.5rem' }}>
            <div style={labelStyle}>Agregar nuevo servicio</div>
            <div style={{ display:'flex', gap:'0.75rem', marginTop:'0.5rem' }}>
              <select value={nuevoServ} onChange={e => setNuevoServ(e.target.value)}
                style={{ ...inputStyle, flex:1 }}>
                <option value="">Selecciona un servicio…</option>
                {serviciosDisponibles
                  .filter(s => !modalDetalle.servicios.includes(s.servicio_slug))
                  .map(s => <option key={s.servicio_slug} value={s.servicio_slug} style={{ background:C.vino }}>{s.servicio}</option>)
                }
              </select>
              <button onClick={agregarServicio} disabled={!nuevoServ || addingServ}
                style={{ background: !nuevoServ || addingServ ? 'rgba(150,134,34,0.4)' : C.olivo, color:C.vino, border:'none', borderRadius:'8px', padding:'0.65rem 1.1rem', fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', cursor: !nuevoServ || addingServ ? 'not-allowed' : 'pointer', fontFamily:'inherit', flexShrink:0 }}>
                {addingServ ? 'Agregando…' : 'Agregar'}
              </button>
            </div>
          </div>

          {/* Accesos rápidos */}
          <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
            {[
              { label:'Ver mapa',       href:`/dashboard/mapa?clienteId=${modalDetalle.id}` },
              { label:'Ver calendario', href:`/dashboard/calendario?clienteId=${modalDetalle.id}` },
              { label:'Ver documentos', href:`/dashboard/documentos?clienteId=${modalDetalle.id}` },
            ].map(btn => (
              <a key={btn.label} href={btn.href}
                style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', background:'rgba(150,134,34,0.12)', color:C.olivo, padding:'0.5rem 1rem', borderRadius:'8px', textDecoration:'none', border:'1px solid rgba(150,134,34,0.25)' }}>
                {btn.label}
              </a>
            ))}
          </div>
        </Modal>
      )}

      {/* ── MODAL NUEVO CLIENTE ── */}
      {modalNuevo && (
        <Modal onClose={() => { setModalNuevo(false); setForm(SERVICIO_FORM_INIT); setFormError('') }} wide>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:'1.4rem', fontWeight:700, marginBottom:'1.5rem' }}>
            Nuevo cliente
          </div>
          <form onSubmit={crearCliente}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1rem' }}>
              <Field label="Razón social *" required value={form.razon_social} onChange={v => setForm(f => ({...f, razon_social:v}))} />
              <Field label="NIT"            value={form.nit}          onChange={v => setForm(f => ({...f, nit:v}))} />
              <Field label="Contacto"       value={form.contacto}     onChange={v => setForm(f => ({...f, contacto:v}))} />
              <Field label="Email empresa"  type="email" value={form.email}    onChange={v => setForm(f => ({...f, email:v}))} />
              <Field label="Teléfono"       value={form.telefono}     onChange={v => setForm(f => ({...f, telefono:v}))} />
            </div>

            <div style={{ borderTop:'1px solid rgba(150,134,34,0.15)', paddingTop:'1.2rem', marginBottom:'1rem' }}>
              <div style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:C.olivo, marginBottom:'1rem' }}>Acceso del cliente</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                <Field label="Nombre completo *" required value={form.user_nombre}   onChange={v => setForm(f => ({...f, user_nombre:v}))} />
                <Field label="Email de acceso *" required type="email" value={form.user_email} onChange={v => setForm(f => ({...f, user_email:v}))} />
                <Field label="Contraseña *" required type="password" value={form.user_password} onChange={v => setForm(f => ({...f, user_password:v}))} />
              </div>
            </div>

            <div style={{ borderTop:'1px solid rgba(150,134,34,0.15)', paddingTop:'1.2rem', marginBottom:'1.5rem' }}>
              <div style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:C.olivo, marginBottom:'1rem' }}>
                Servicios que presta *
              </div>
              {Object.entries(serviciosPorCat).map(([cat, servs]) => (
                <div key={cat} style={{ marginBottom:'1rem' }}>
                  <div style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.1em', color:'rgba(231,223,202,0.5)', textTransform:'uppercase', marginBottom:'0.5rem' }}>{cat}</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'0.5rem' }}>
                    {servs.map(s => {
                      const sel = form.servicios.includes(s.servicio_slug)
                      return (
                        <button type="button" key={s.servicio_slug} onClick={() => toggleServicio(s.servicio_slug)}
                          style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', padding:'0.3rem 0.8rem', borderRadius:'20px', border:`1px solid ${sel ? C.olivo : 'rgba(150,134,34,0.2)'}`, background: sel ? 'rgba(150,134,34,0.2)' : 'transparent', color: sel ? C.olivo : 'rgba(231,223,202,0.5)', cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}>
                          {sel ? '✓ ' : ''}{s.servicio}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {formError && (
              <div style={{ background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.3)', borderRadius:'8px', padding:'0.7rem 1rem', fontSize:'0.8rem', color:'#f87171', marginBottom:'1rem' }}>
                {formError}
              </div>
            )}

            <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
              <button type="button" onClick={() => { setModalNuevo(false); setForm(SERVICIO_FORM_INIT) }}
                style={{ background:'rgba(231,223,202,0.08)', color:C.marfil, border:'1px solid rgba(231,223,202,0.15)', borderRadius:'8px', padding:'0.7rem 1.3rem', fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', cursor:'pointer', fontFamily:'inherit' }}>
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                style={{ background: saving ? 'rgba(150,134,34,0.5)' : C.olivo, color:C.vino, border:'none', borderRadius:'8px', padding:'0.7rem 1.5rem', fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', cursor: saving ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
                {saving ? 'Creando…' : 'Crear cliente'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ── Componentes pequeños ─────────────────────────────────────────────────────

function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:'#1a0204', border:'1px solid rgba(150,134,34,0.3)', borderRadius:'16px', padding:'2rem', width:'100%', maxWidth: wide ? '680px' : '500px', maxHeight:'92vh', overflowY:'auto', position:'relative' }}>
        <button onClick={onClose}
          style={{ position:'absolute', top:'1rem', right:'1rem', background:'rgba(231,223,202,0.08)', border:'none', color:'rgba(231,223,202,0.5)', borderRadius:'6px', padding:'0.3rem 0.6rem', cursor:'pointer', fontSize:'0.9rem', fontFamily:'inherit' }}>
          ✕
        </button>
        {children}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} required={required}
        onChange={e => onChange(e.target.value)}
        style={{ ...inputStyle, width:'100%' }} />
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display:'block', fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.12em',
  textTransform:'uppercase', color:'rgba(231,223,202,0.5)', marginBottom:'0.35rem',
}

const inputStyle: React.CSSProperties = {
  background:'rgba(231,223,202,0.06)', border:'1px solid rgba(150,134,34,0.3)',
  borderRadius:'8px', padding:'0.65rem 0.9rem', color:'#e7dfca',
  fontSize:'0.88rem', fontFamily:'inherit', outline:'none',
}
