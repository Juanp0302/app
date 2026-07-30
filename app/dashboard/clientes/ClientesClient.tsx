'use client'

import { useEffect, useState, useCallback } from 'react'
import NavLogo from '@/components/NavLogo'
import DonutChart from '@/components/DonutChart'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

const CATEGORIAS_SERVICIO: Record<string, string> = {
  'SERVICIOS DE VALOR AGREGADO Y TELEMÁTICOS (SVA)': 'SVA',
  'SERVICIOS DE TELEFONÍA MÓVIL': 'Móvil',
  'SERVICIOS DE TELEFONÍA FIJA':  'Fija',
  'OTROS SERVICIOS DE TELECOMUNICACIONES': 'Otros',
}

function pctColor(pct: number) {
  if (pct >= 80) return '#16a34a'
  if (pct >= 50) return '#968622'
  return '#dc2626'
}

interface AdminSimple {
  id:     string
  nombre: string
  email:  string
}

interface Cliente {
  id:                     string
  razon_social:           string
  nit:                    string
  contacto:               string
  email:                  string
  telefono:               string
  user_email:             string
  user_nombre:            string
  activo:                 number
  servicios:              string[]
  total_obl:              number
  cumplidas:              number
  en_progreso:            number
  vencidas:               number
  pendientes:             number
  pct:                    number
  created_at:             string
  avg_horas_ticket:       number | null
  avg_horas_chat:         number | null
  admin_revision_id:      string | null
  admin_revision_nombre:  string | null
  admin_revision_email:   string | null
  plan:                   string | null
  suscripcion_estado:     string | null
  suscripcion_vencimiento:string | null
  suscripcion_externa_id: string | null
}

function formatHoras(h: number | null | undefined): string {
  if (h === null || h === undefined || isNaN(Number(h))) return '—'
  const n = Number(h)
  if (n < 1/60) return '< 1 min'
  if (n < 1)    return `${Math.round(n * 60)} min`
  if (n < 24)   return `${Math.round(n)} h`
  return `${(n / 24).toFixed(1)} días`
}

const SERVICIO_FORM_INIT = {
  razon_social: '', nit: '', contacto: '', email: '', telefono: '',
  user_email: '', user_nombre: '',
  plan: 'trial' as string,
  suscripcion_vencimiento: '',
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
  const [storageCfg,  setStorageCfg]  = useState<{ type: string; basePath: string | null; site_url: string | null; connected: boolean } | null>(null)
  const [storageEdit, setStorageEdit] = useState({ basePath: '', siteUrl: '' })
  const [storageSaving, setStorageSaving] = useState(false)
  const [editCliente, setEditCliente] = useState<Cliente | null>(null)
  const [editForm,    setEditForm]    = useState({ razon_social:'', nit:'', contacto:'', email:'', telefono:'', user_nombre:'', user_email:'', user_password:'' })
  const [editSaving,  setEditSaving]  = useState(false)
  const [editError,   setEditError]   = useState('')
  const [admins,      setAdmins]      = useState<AdminSimple[]>([])
  const [asignandoRev, setAsignandoRev] = useState(false)
  const [showEditPwd, setShowEditPwd] = useState(false)

  // ── Suscripción ──────────────────────────────────────────────────────────────
  const [suscPlan,      setSuscPlan]      = useState('')
  const [suscEstado,    setSuscEstado]    = useState('')
  const [suscVenc,      setSuscVenc]      = useState('')
  const [suscSaving,    setSuscSaving]    = useState(false)
  // Cuenta de cobro inline form
  const [ccForm,        setCcForm]        = useState({ nit: '', representanteLegal: '' })
  const [ccShow,        setCcShow]        = useState(false)
  const [ccSending,     setCcSending]     = useState(false)
  // Config global
  const [autoCobranza,  setAutoCobranza]  = useState(false)
  const [settingsLoaded,setSettingsLoaded]= useState(false)
  const [settingsSaving,setSettingsSaving]= useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [resClientes, resAdmins] = await Promise.all([
        fetch('/api/clientes'),
        fetch('/api/admins'),
      ])
      setClientes(await resClientes.json())
      const adminsData = await resAdmins.json()
      setAdmins((adminsData as any[]).filter(a => a.activo).map((a: any) => ({ id: a.id, nombre: a.nombre, email: a.email })))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Cargar config de almacenamiento al abrir modal
  useEffect(() => {
    if (!modalDetalle) { setStorageCfg(null); return }
    fetch(`/api/storage/config?clienteId=${modalDetalle.id}`)
      .then(r => r.json())
      .then(d => {
        setStorageCfg(d)
        setStorageEdit({ basePath: d.basePath ?? '', siteUrl: d.site_url ?? '' })
      })
      .catch(() => setStorageCfg(null))
  }, [modalDetalle])

  // Cargar settings globales
  useEffect(() => {
    fetch('/api/superadmin/settings')
      .then(r => r.json())
      .then(d => { setAutoCobranza(!!d.auto_cuenta_cobro); setSettingsLoaded(true) })
      .catch(() => setSettingsLoaded(true))
  }, [])

  // Inicializar campos suscripción cuando se abre modal
  useEffect(() => {
    if (!modalDetalle) { setCcShow(false); setCcForm({ nit: '', representanteLegal: '' }); return }
    setSuscPlan(modalDetalle.plan ?? 'trial')
    setSuscEstado(modalDetalle.suscripcion_estado ?? 'trial')
    setSuscVenc(modalDetalle.suscripcion_vencimiento ?? '')
  }, [modalDetalle])

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

  async function quitarServicio(slug: string, nombre: string) {
    if (!modalDetalle) return
    if (!window.confirm(`¿Quitar "${nombre}"? Se eliminarán también las obligaciones y documentos asociados a ese servicio.`)) return
    try {
      const res = await fetch(`/api/clientes?id=${modalDetalle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quitar_servicio: slug }),
      })
      const json = await res.json()
      if (!res.ok) { alert(json.error ?? 'Error'); return }
      cargar()
      setModalDetalle(null)
    } catch { alert('Error al quitar el servicio') }
  }

  async function guardarLocalPath() {
    if (!modalDetalle) return
    setStorageSaving(true)
    try {
      await fetch('/api/storage/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: modalDetalle.id, type: 'local', basePath: storageEdit.basePath || null }),
      })
      setStorageCfg(c => c ? { ...c, type: 'local', basePath: storageEdit.basePath || null, connected: true } : c)
    } finally {
      setStorageSaving(false)
    }
  }

  async function guardarSharePointUrl() {
    if (!modalDetalle) return
    setStorageSaving(true)
    try {
      await fetch('/api/storage/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: modalDetalle.id, type: 'sharepoint', site_url: storageEdit.siteUrl }),
      })
    } finally {
      setStorageSaving(false)
    }
  }

  async function desconectarStorage() {
    if (!modalDetalle) return
    setStorageSaving(true)
    try {
      await fetch('/api/storage/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: modalDetalle.id, type: 'disconnect' }),
      })
      setStorageCfg(c => c ? { ...c, type: 'local', connected: true } : c)
    } finally {
      setStorageSaving(false)
    }
  }

  function abrirEditarCliente(c: Cliente) {
    setEditCliente(c)
    setEditForm({
      razon_social: c.razon_social ?? '',
      nit:          c.nit         ?? '',
      contacto:     c.contacto    ?? '',
      email:        c.email       ?? '',
      telefono:     c.telefono    ?? '',
      user_nombre:  c.user_nombre ?? '',
      user_email:   c.user_email  ?? '',
      user_password: '',
    })
    setEditError('')
  }

  async function asignarAdminRevision(clienteId: string, adminId: string | null) {
    setAsignandoRev(true)
    try {
      await fetch(`/api/clientes?id=${clienteId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_revision_id: adminId }),
      })
      await cargar()
      // Actualizar modal si está abierto
      setModalDetalle(prev => {
        if (!prev || prev.id !== clienteId) return prev
        const admin = admins.find(a => a.id === adminId)
        return { ...prev, admin_revision_id: adminId, admin_revision_nombre: admin?.nombre ?? null, admin_revision_email: admin?.email ?? null }
      })
    } finally {
      setAsignandoRev(false)
    }
  }

  // ── Suscripción ──────────────────────────────────────────────────────────────
  async function guardarPlan() {
    if (!modalDetalle) return
    setSuscSaving(true)
    try {
      await fetch(`/api/clientes?id=${modalDetalle.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: suscPlan }),
      })
      cargar()
      setModalDetalle(prev => prev ? { ...prev, plan: suscPlan } : prev)
    } finally { setSuscSaving(false) }
  }

  async function guardarEstado() {
    if (!modalDetalle) return
    setSuscSaving(true)
    try {
      await fetch(`/api/clientes?id=${modalDetalle.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suscripcion_estado: suscEstado }),
      })
      cargar()
      setModalDetalle(prev => prev ? { ...prev, suscripcion_estado: suscEstado } : prev)
    } finally { setSuscSaving(false) }
  }

  async function guardarVencimiento() {
    if (!modalDetalle) return
    setSuscSaving(true)
    try {
      await fetch(`/api/clientes?id=${modalDetalle.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suscripcion_vencimiento: suscVenc || null }),
      })
      cargar()
      setModalDetalle(prev => prev ? { ...prev, suscripcion_vencimiento: suscVenc || null } : prev)
    } finally { setSuscSaving(false) }
  }

  async function cancelarSuscripcionCliente() {
    if (!modalDetalle) return
    if (!window.confirm(`¿Cancelar la suscripción de ${modalDetalle.razon_social}? Esta acción no se puede deshacer.`)) return
    setSuscSaving(true)
    try {
      const res = await fetch(`/api/clientes?id=${modalDetalle.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelar_suscripcion: true }),
      })
      const json = await res.json()
      if (!res.ok) { alert(json.error ?? 'Error'); return }
      cargar()
      setModalDetalle(prev => prev ? { ...prev, suscripcion_estado: 'cancelada' } : prev)
      setSuscEstado('cancelada')
    } finally { setSuscSaving(false) }
  }

  async function enviarCuentaCobro() {
    if (!modalDetalle) return
    const { nit, representanteLegal } = ccForm
    if (!nit || !representanteLegal) { alert('Completa NIT y representante legal'); return }
    setCcSending(true)
    try {
      const res = await fetch('/api/superadmin/cuenta-cobro', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: modalDetalle.id,
          plan: suscPlan || modalDetalle.plan || 'basico',
          nombreEmpresa: modalDetalle.razon_social,
          nit,
          representanteLegal,
        }),
      })
      const json = await res.json()
      if (!res.ok) { alert(json.error ?? 'Error'); return }
      alert(`✓ Cuenta de cobro ${json.numero} enviada`)
      setCcShow(false)
      setCcForm({ nit: '', representanteLegal: '' })
    } finally { setCcSending(false) }
  }

  async function eliminarCliente() {
    if (!modalDetalle) return
    if (!window.confirm(`¿Eliminar permanentemente a ${modalDetalle.razon_social}? Esta acción no se puede deshacer.`)) return
    try {
      const res = await fetch(`/api/clientes?id=${modalDetalle.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) { alert(json.error ?? 'Error al eliminar'); return }
      setModalDetalle(null)
      cargar()
    } catch { alert('Error al eliminar') }
  }

  async function toggleAutoCobranza(val: boolean) {
    setAutoCobranza(val)
    setSettingsSaving(true)
    try {
      await fetch('/api/superadmin/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_cuenta_cobro: val }),
      })
    } finally { setSettingsSaving(false) }
  }

  async function guardarEdicionCliente(e: React.FormEvent) {
    e.preventDefault()
    if (!editCliente) return
    setEditError('')
    if (editForm.user_password && editForm.user_password.length < 8) { setEditError('La contraseña debe tener al menos 8 caracteres'); return }
    setEditSaving(true)
    try {
      const datos: any = {
        razon_social: editForm.razon_social,
        nit:          editForm.nit      || null,
        contacto:     editForm.contacto || null,
        email:        editForm.email    || null,
        telefono:     editForm.telefono || null,
        user_nombre:  editForm.user_nombre  || undefined,
        user_email:   editForm.user_email   || undefined,
        user_password: editForm.user_password || undefined,
      }
      const res = await fetch(`/api/clientes?id=${editCliente.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datos }),
      })
      const json = await res.json()
      if (!res.ok) { setEditError(json.error ?? 'Error al guardar'); return }
      setEditCliente(null)
      cargar()
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:C.vino, fontFamily:"'Josefin Sans', sans-serif", color:C.marfil }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      {/* NAV */}
      <nav style={{ background:'rgba(39,2,5,0.97)', borderBottom:'1px solid rgba(150,134,34,0.2)', padding:'0.9rem 2rem', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'1.5rem' }}>
          <NavLogo />
          <span style={{ color:'rgba(231,223,202,0.3)' }}>›</span>
          <span style={{ fontSize:'0.72rem', fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase', color:C.olivo }}>Panel de Clientes</span>
        </div>
        <a href="/signout" style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:'rgba(231,223,202,0.5)', textDecoration:'none' }}>Salir</a>
      </nav>

      <main style={{ maxWidth:'1200px', margin:'0 auto', padding:'2rem' }}>

        {/* ── ESTADÍSTICAS GLOBALES ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'1rem', marginBottom:'2.5rem' }}>
          {[
            { label:'Clientes activos',     val: stats.total,        color: C.marfil },
            { label:'Cumplimiento global',  val: `${pctGlobal}%`,    color: pctColor(pctGlobal), big: true },
            { label:'Obligaciones totales', val: stats.total_obl,    color: 'rgba(231,223,202,0.7)' },
            { label:'Cumplidas',            val: stats.cumplidas,    color: '#16a34a' },
            { label:'Vencidas',             val: stats.vencidas,     color: '#dc2626' },
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
                  <div style={{ display:'flex', alignItems:'center', gap:'0.8rem', marginBottom:'0.3rem' }}>
                    <span style={{ fontSize:'0.95rem', fontWeight:700 }}>{c.razon_social}</span>
                    {!c.activo && <span style={{ fontSize:'0.6rem', fontWeight:700, background:'rgba(220,38,38,0.15)', color:'#dc2626', padding:'0.15rem 0.5rem', borderRadius:'8px' }}>INACTIVO</span>}
                  </div>
                  {c.nit && <div style={{ fontSize:'0.72rem', color:'rgba(231,223,202,0.45)' }}>NIT {c.nit}</div>}
                  <div style={{ display:'flex', gap:'1.5rem', flexWrap:'wrap', marginTop:'0.4rem' }}>
                    {c.email && <span style={{ fontSize:'0.72rem', color:'rgba(231,223,202,0.5)' }}>{c.email}</span>}
                    {c.contacto && <span style={{ fontSize:'0.72rem', color:'rgba(231,223,202,0.5)' }}>{c.contacto}</span>}
                  </div>
                </div>

                {/* Gráfica de cumplimiento */}
                <div style={{ flexShrink: 0 }}>
                  <DonutChart
                    cumplidas={c.cumplidas ?? 0}
                    en_progreso={c.en_progreso ?? 0}
                    pendientes={c.pendientes ?? 0}
                    vencidas={c.vencidas ?? 0}
                    size={110}
                    strokeWidth={13}
                    showCenter
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        {/* ── CONFIGURACIÓN GLOBAL ── */}
        {settingsLoaded && (
          <div style={{ marginTop:'2.5rem', background:'rgba(231,223,202,0.04)', border:'1px solid rgba(150,134,34,0.2)', borderRadius:'12px', padding:'1.2rem 1.5rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' }}>
            <div>
              <div style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:C.olivo, marginBottom:'0.3rem' }}>Configuración global</div>
              <div style={{ fontSize:'0.82rem', color:'rgba(231,223,202,0.7)' }}>Generar cuenta de cobro automáticamente al vencimiento</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
              {settingsSaving && <span style={{ fontSize:'0.68rem', color:'rgba(231,223,202,0.45)' }}>Guardando…</span>}
              <button onClick={() => toggleAutoCobranza(!autoCobranza)} disabled={settingsSaving}
                style={{
                  width:52, height:28, borderRadius:14, border:'none', cursor: settingsSaving ? 'not-allowed' : 'pointer',
                  background: autoCobranza ? C.olivo : 'rgba(231,223,202,0.15)',
                  position:'relative', transition:'background 0.2s', flexShrink:0,
                }}>
                <span style={{
                  position:'absolute', top:3, left: autoCobranza ? 27 : 3, width:22, height:22,
                  borderRadius:'50%', background: autoCobranza ? C.vino : 'rgba(231,223,202,0.6)',
                  transition:'left 0.2s',
                }} />
              </button>
              <span style={{ fontSize:'0.72rem', color: autoCobranza ? C.olivo : 'rgba(231,223,202,0.4)', fontWeight:600 }}>
                {autoCobranza ? 'Activado' : 'Desactivado'}
              </span>
            </div>
          </div>
        )}
      </main>

      {/* ── MODAL DETALLE CLIENTE ── */}
      {modalDetalle && (
        <Modal onClose={() => { setModalDetalle(null); setNuevoServ('') }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'1rem', marginBottom:'0.3rem' }}>
            <div style={{ fontFamily:"'Playfair Display', serif", fontSize:'1.4rem', fontWeight:700 }}>
              {modalDetalle.razon_social}
            </div>
            <button onClick={() => abrirEditarCliente(modalDetalle)}
              style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', background:'rgba(150,134,34,0.12)', color:C.olivo, padding:'0.4rem 0.9rem', borderRadius:'8px', border:'1px solid rgba(150,134,34,0.3)', cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
              Editar datos
            </button>
          </div>
          {modalDetalle.nit && <div style={{ fontSize:'0.72rem', color:'rgba(231,223,202,0.5)', marginBottom:'1.5rem' }}>NIT {modalDetalle.nit}</div>}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1.25rem' }}>
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

          {/* Tiempos de respuesta */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem', marginBottom:'1.5rem' }}>
            {[
              { label:'Tiempo respuesta tickets', val: formatHoras(modalDetalle.avg_horas_ticket), color: modalDetalle.avg_horas_ticket === null ? 'rgba(231,223,202,0.3)' : modalDetalle.avg_horas_ticket < 4 ? '#16a34a' : modalDetalle.avg_horas_ticket < 24 ? '#f59e0b' : '#dc2626' },
              { label:'Tiempo respuesta chats',   val: formatHoras(modalDetalle.avg_horas_chat),   color: modalDetalle.avg_horas_chat   === null ? 'rgba(231,223,202,0.3)' : modalDetalle.avg_horas_chat   < 4 ? '#16a34a' : modalDetalle.avg_horas_chat   < 24 ? '#f59e0b' : '#dc2626' },
            ].map(r => (
              <div key={r.label} style={{ background:'rgba(0,0,0,0.2)', borderRadius:10, padding:'0.75rem 1rem' }}>
                <div style={{ fontSize:'0.58rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(231,223,202,0.4)', marginBottom:'0.3rem' }}>{r.label}</div>
                <div style={{ fontSize:'1.2rem', fontWeight:700, color: r.color }}>{r.val}</div>
                <div style={{ fontSize:'0.62rem', color:'rgba(231,223,202,0.35)', marginTop:'0.15rem' }}>Promedio primera respuesta del equipo Owl</div>
              </div>
            ))}
          </div>

          {/* Admin revisor de documentos */}
          <div style={{ background:'rgba(0,0,0,0.2)', borderRadius:10, padding:'1rem 1.2rem', marginBottom:'1.5rem' }}>
            <div style={{ fontSize:'0.58rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(231,223,202,0.4)', marginBottom:'0.7rem' }}>
              Revisor de documentos
            </div>
            {modalDetalle.admin_revision_nombre ? (
              <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.65rem' }}>
                <div style={{ width:34, height:34, borderRadius:'50%', background:'rgba(150,134,34,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', flexShrink:0 }}>🛡️</div>
                <div>
                  <div style={{ fontSize:'0.85rem', fontWeight:600, color:C.marfil }}>{modalDetalle.admin_revision_nombre}</div>
                  <div style={{ fontSize:'0.65rem', color:'rgba(231,223,202,0.4)' }}>{modalDetalle.admin_revision_email}</div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize:'0.78rem', color:'rgba(231,223,202,0.35)', marginBottom:'0.65rem', fontStyle:'italic' }}>
                Sin revisor asignado — se notifica a todos los admins
              </div>
            )}
            <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
              <select
                defaultValue={modalDetalle.admin_revision_id ?? ''}
                onChange={e => asignarAdminRevision(modalDetalle.id, e.target.value || null)}
                disabled={asignandoRev}
                style={{ flex:1, background:'rgba(231,223,202,0.07)', border:'1px solid rgba(150,134,34,0.3)', borderRadius:7, padding:'0.45rem 0.75rem', color:C.marfil, fontSize:'0.8rem', fontFamily:'inherit', outline:'none', cursor:'pointer' }}
              >
                <option value=''>— Sin revisor específico —</option>
                {admins.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre} ({a.email})</option>
                ))}
              </select>
              {asignandoRev && <span style={{ fontSize:'0.7rem', color:C.olivo }}>Guardando…</span>}
            </div>
          </div>

          {/* ── SUSCRIPCIÓN ── */}
          <div style={{ borderTop:'1px solid rgba(150,134,34,0.15)', paddingTop:'1.3rem', marginBottom:'1.5rem' }}>
            <div style={labelStyle}>Suscripción</div>

            {/* Badges informativos */}
            <div style={{ display:'flex', gap:'0.6rem', flexWrap:'wrap', margin:'0.75rem 0' }}>
              {/* Plan badge */}
              {(() => {
                const p = modalDetalle.plan
                const colors: Record<string, { bg: string; color: string }> = {
                  trial:   { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' },
                  basico:  { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
                  pro:     { bg: 'rgba(150,134,34,0.15)',  color: '#968622' },
                  premium: { bg: 'rgba(39,2,5,0.4)',       color: '#e7dfca' },
                }
                const c = colors[p ?? 'trial'] ?? colors.trial
                return (
                  <span style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', padding:'0.25rem 0.75rem', borderRadius:'20px', border:'1px solid', background:c.bg, color:c.color, borderColor:c.color }}>
                    Plan: {p ?? 'trial'}
                  </span>
                )
              })()}
              {/* Estado badge */}
              {(() => {
                const e = modalDetalle.suscripcion_estado
                const colors: Record<string, { bg: string; color: string }> = {
                  activa:    { bg: 'rgba(22,163,74,0.15)',   color: '#16a34a' },
                  suspendida:{ bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
                  cancelada: { bg: 'rgba(220,38,38,0.15)',   color: '#dc2626' },
                  trial:     { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' },
                }
                const c = colors[e ?? 'trial'] ?? colors.trial
                return (
                  <span style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', padding:'0.25rem 0.75rem', borderRadius:'20px', border:'1px solid', background:c.bg, color:c.color, borderColor:c.color }}>
                    {e ?? 'trial'}
                  </span>
                )
              })()}
              {modalDetalle.suscripcion_vencimiento && (
                <span style={{ fontSize:'0.62rem', color:'rgba(231,223,202,0.5)' }}>
                  Vence: {new Date(modalDetalle.suscripcion_vencimiento).toLocaleDateString('es-CO')}
                </span>
              )}
              {modalDetalle.suscripcion_externa_id && (
                <span style={{ fontSize:'0.62rem', color:'rgba(231,223,202,0.35)', fontStyle:'italic' }}>
                  Ref: {modalDetalle.suscripcion_externa_id.slice(0, 16)}…
                </span>
              )}
            </div>

            {/* Cambiar plan */}
            <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', marginBottom:'0.65rem' }}>
              <select value={suscPlan} onChange={e => setSuscPlan(e.target.value)} disabled={suscSaving}
                style={{ ...inputStyle, flex:1 }}>
                <option value="trial">Trial</option>
                <option value="basico">Básico</option>
                <option value="pro">Pro</option>
                <option value="premium">Premium</option>
              </select>
              <button onClick={guardarPlan} disabled={suscSaving}
                style={{ ...btnStyle, background: suscSaving ? 'rgba(150,134,34,0.4)' : C.olivo, flexShrink:0 }}>
                Guardar plan
              </button>
            </div>

            {/* Cambiar estado */}
            <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', marginBottom:'0.65rem' }}>
              <select value={suscEstado} onChange={e => setSuscEstado(e.target.value)} disabled={suscSaving}
                style={{ ...inputStyle, flex:1 }}>
                <option value="activa">Activa</option>
                <option value="trial">Trial</option>
                <option value="suspendida">Suspendida</option>
                <option value="cancelada">Cancelada</option>
              </select>
              <button onClick={guardarEstado} disabled={suscSaving}
                style={{ ...btnStyle, background: suscSaving ? 'rgba(150,134,34,0.4)' : C.olivo, flexShrink:0 }}>
                Guardar estado
              </button>
            </div>

            {/* Vencimiento */}
            <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', marginBottom:'0.65rem' }}>
              <input type="date" value={suscVenc} onChange={e => setSuscVenc(e.target.value)} disabled={suscSaving}
                style={{ ...inputStyle, flex:1, boxSizing:'border-box' as const }} />
              <button onClick={guardarVencimiento} disabled={suscSaving}
                style={{ ...btnStyle, background: suscSaving ? 'rgba(150,134,34,0.4)' : C.olivo, flexShrink:0 }}>
                Guardar fecha
              </button>
            </div>

            {/* Cancelar suscripción */}
            {modalDetalle.suscripcion_estado !== 'cancelada' && (
              <button onClick={cancelarSuscripcionCliente} disabled={suscSaving}
                style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', background:'rgba(220,38,38,0.12)', color:'#f87171', border:'1px solid rgba(220,38,38,0.3)', borderRadius:'8px', padding:'0.5rem 1rem', cursor: suscSaving ? 'not-allowed' : 'pointer', fontFamily:'inherit', marginBottom:'0.65rem', display:'block' }}>
                Cancelar suscripción
              </button>
            )}

            {/* Cuenta de cobro */}
            {!ccShow ? (
              <button onClick={() => setCcShow(true)}
                style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', background:'rgba(150,134,34,0.12)', color:C.olivo, border:'1px solid rgba(150,134,34,0.3)', borderRadius:'8px', padding:'0.5rem 1rem', cursor:'pointer', fontFamily:'inherit' }}>
                Enviar cuenta de cobro
              </button>
            ) : (
              <div style={{ background:'rgba(0,0,0,0.2)', borderRadius:'10px', padding:'1rem', marginTop:'0.5rem' }}>
                <div style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(231,223,202,0.45)', marginBottom:'0.6rem' }}>Datos para cuenta de cobro</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.6rem', marginBottom:'0.6rem' }}>
                  <div>
                    <label style={labelStyle}>NIT *</label>
                    <input value={ccForm.nit} onChange={e => setCcForm(f => ({ ...f, nit: e.target.value }))}
                      style={{ ...inputStyle, width:'100%', boxSizing:'border-box' as const }} placeholder="900.123.456-7" />
                  </div>
                  <div>
                    <label style={labelStyle}>Representante legal *</label>
                    <input value={ccForm.representanteLegal} onChange={e => setCcForm(f => ({ ...f, representanteLegal: e.target.value }))}
                      style={{ ...inputStyle, width:'100%', boxSizing:'border-box' as const }} placeholder="Nombre completo" />
                  </div>
                </div>
                <div style={{ display:'flex', gap:'0.5rem' }}>
                  <button onClick={enviarCuentaCobro} disabled={ccSending}
                    style={{ ...btnStyle, background: ccSending ? 'rgba(150,134,34,0.4)' : C.olivo }}>
                    {ccSending ? 'Enviando…' : 'Enviar PDF'}
                  </button>
                  <button onClick={() => { setCcShow(false); setCcForm({ nit: '', representanteLegal: '' }) }}
                    style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', background:'rgba(231,223,202,0.08)', color:'rgba(231,223,202,0.6)', border:'1px solid rgba(231,223,202,0.15)', borderRadius:'8px', padding:'0.5rem 1rem', cursor:'pointer', fontFamily:'inherit' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Gráfica de cumplimiento */}
          <div style={{ background:'rgba(0,0,0,0.2)', borderRadius:'10px', padding:'1.2rem', marginBottom:'1.5rem', display:'flex', alignItems:'center', gap:'2rem' }}>
            <DonutChart
              cumplidas={modalDetalle.cumplidas ?? 0}
              en_progreso={modalDetalle.en_progreso ?? 0}
              pendientes={modalDetalle.pendientes ?? 0}
              vencidas={modalDetalle.vencidas ?? 0}
              size={130}
              strokeWidth={15}
              showCenter
              showLegend
            />
            <div style={{ flex:1 }}>
              {[
                { label:'Total obligaciones', val: modalDetalle.total_obl, color:'rgba(231,223,202,0.7)' },
                { label:'Cumplidas',          val: modalDetalle.cumplidas,  color:'#16a34a' },
                { label:'En progreso',        val: modalDetalle.en_progreso ?? 0, color:'#3b82f6' },
                { label:'Pendientes',         val: modalDetalle.pendientes, color:'#968622' },
                { label:'Vencidas',           val: modalDetalle.vencidas,   color:'#dc2626' },
              ].map(s => (
                <div key={s.label} style={{ display:'flex', justifyContent:'space-between', padding:'0.25rem 0', borderBottom:'1px solid rgba(231,223,202,0.06)' }}>
                  <span style={{ fontSize:'0.75rem', color:'rgba(231,223,202,0.6)' }}>{s.label}</span>
                  <span style={{ fontSize:'0.82rem', fontWeight:700, color:s.color }}>{s.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Servicios actuales */}
          <div style={{ borderTop:'1px solid rgba(150,134,34,0.15)', paddingTop:'1.3rem', marginBottom:'1.5rem' }}>
            <div style={labelStyle}>Servicios actuales</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'0.5rem', marginTop:'0.5rem' }}>
              {modalDetalle.servicios.length === 0 && (
                <span style={{ fontSize:'0.75rem', color:'rgba(231,223,202,0.4)', fontStyle:'italic' }}>El cliente aún no ha elegido ningún servicio.</span>
              )}
              {modalDetalle.servicios.map(slug => {
                const info = serviciosDisponibles.find(s => s.servicio_slug === slug)
                return (
                  <span key={slug} style={{
                    display:'flex', alignItems:'center', gap:'0.4rem', fontSize:'0.7rem', fontWeight:600,
                    padding:'0.3rem 0.4rem 0.3rem 0.8rem', borderRadius:'20px',
                    background:'rgba(150,134,34,0.15)', color:C.olivo, border:'1px solid rgba(150,134,34,0.3)',
                  }}>
                    {info?.servicio ?? slug}
                    <button onClick={() => quitarServicio(slug, info?.servicio ?? slug)}
                      title="Quitar servicio"
                      style={{ background:'rgba(220,38,38,0.2)', color:'#f87171', border:'none', borderRadius:'50%', width:'18px', height:'18px', cursor:'pointer', fontSize:'0.7rem', lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      ×
                    </button>
                  </span>
                )
              })}
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

          {/* ── ALMACENAMIENTO (solo lectura para admin) ── */}
          <div style={{ borderTop:'1px solid rgba(150,134,34,0.15)', paddingTop:'1.3rem', marginBottom:'1.5rem' }}>
            <div style={labelStyle}>Almacenamiento de documentos</div>
            <div style={{ marginTop:'0.75rem', display:'flex', alignItems:'center', gap:'0.75rem', flexWrap:'wrap' }}>
              {storageCfg ? (
                <>
                  <span style={{
                    fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase',
                    padding:'0.25rem 0.75rem', borderRadius:'20px', border:'1px solid',
                    ...(storageCfg.type === 'local'
                      ? { background:'rgba(107,114,128,0.15)', color:'#9ca3af', borderColor:'rgba(107,114,128,0.3)' }
                      : storageCfg.type === 'googledrive'
                      ? { background:'rgba(59,130,246,0.15)', color:'#60a5fa', borderColor:'rgba(59,130,246,0.3)' }
                      : storageCfg.type === 'onedrive'
                      ? { background:'rgba(37,99,235,0.15)', color:'#818cf8', borderColor:'rgba(37,99,235,0.3)' }
                      : { background:'rgba(16,185,129,0.15)', color:'#34d399', borderColor:'rgba(16,185,129,0.3)' }),
                  }}>
                    {storageCfg.type === 'local' ? 'Servidor local'
                      : storageCfg.type === 'googledrive' ? '🟡 Google Drive'
                      : storageCfg.type === 'onedrive' ? '🔵 OneDrive'
                      : '🟢 SharePoint'}
                  </span>
                  {storageCfg.connected && storageCfg.type !== 'local'
                    ? <span style={{ fontSize:'0.7rem', color:'#34d399' }}>● Conectado</span>
                    : storageCfg.type !== 'local'
                    ? <span style={{ fontSize:'0.7rem', color:'#f87171' }}>● Sin autorización</span>
                    : null}
                  <span style={{ fontSize:'0.68rem', color:'rgba(231,223,202,0.35)', fontStyle:'italic' }}>
                    El cliente configura su almacenamiento desde su cuenta
                  </span>
                </>
              ) : (
                <span style={{ fontSize:'0.78rem', color:'rgba(231,223,202,0.4)' }}>Cargando…</span>
              )}
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

          {/* Eliminar cliente */}
          <div style={{ borderTop:'1px solid rgba(220,38,38,0.2)', paddingTop:'1.3rem', marginTop:'1.5rem' }}>
            <button onClick={eliminarCliente}
              style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', background:'rgba(220,38,38,0.08)', color:'#f87171', border:'1px solid rgba(220,38,38,0.25)', borderRadius:'8px', padding:'0.6rem 1.2rem', cursor:'pointer', fontFamily:'inherit', width:'100%' }}>
              Eliminar cliente permanentemente
            </button>
          </div>
        </Modal>
      )}

      {/* ── MODAL EDITAR CLIENTE ── */}
      {editCliente && (
        <Modal onClose={() => setEditCliente(null)} wide>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:'1.4rem', fontWeight:700, marginBottom:'1.5rem' }}>
            Editar cliente
          </div>
          <form onSubmit={guardarEdicionCliente}>
            <div style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:C.olivo, marginBottom:'0.8rem' }}>Datos de la empresa</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1.5rem' }}>
              <Field label="Razón social *" required value={editForm.razon_social} onChange={v => setEditForm(f => ({...f, razon_social:v}))} />
              <Field label="NIT"            value={editForm.nit}       onChange={v => setEditForm(f => ({...f, nit:v}))} />
              <Field label="Contacto"       value={editForm.contacto}  onChange={v => setEditForm(f => ({...f, contacto:v}))} />
              <Field label="Email empresa"  type="email" value={editForm.email}  onChange={v => setEditForm(f => ({...f, email:v}))} />
              <Field label="Teléfono"       value={editForm.telefono}  onChange={v => setEditForm(f => ({...f, telefono:v}))} />
            </div>

            <div style={{ borderTop:'1px solid rgba(150,134,34,0.15)', paddingTop:'1.2rem', marginBottom:'1.5rem' }}>
              <div style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:C.olivo, marginBottom:'0.8rem' }}>Acceso del cliente</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                <Field label="Nombre completo" value={editForm.user_nombre} onChange={v => setEditForm(f => ({...f, user_nombre:v}))} />
                <Field label="Email de acceso" type="email" value={editForm.user_email} onChange={v => setEditForm(f => ({...f, user_email:v}))} />
                <div>
                  <label style={labelStyle}>Nueva contraseña <span style={{ fontWeight:400, color:'rgba(231,223,202,0.35)' }}>(vacío = sin cambio)</span></label>
                  <div style={{ position:'relative' }}>
                    <input type={showEditPwd ? 'text' : 'password'} value={editForm.user_password}
                      onChange={e => setEditForm(f => ({...f, user_password:e.target.value}))}
                      style={{ ...inputStyle, width:'100%', paddingRight:'2.5rem', boxSizing:'border-box' }} />
                    <button type="button" onClick={() => setShowEditPwd(v => !v)}
                      style={{ position:'absolute', right:'0.7rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:0, color:'rgba(231,223,202,0.4)', fontSize:'1rem' }}>
                      {showEditPwd ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {editError && (
              <div style={{ background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.3)', borderRadius:'8px', padding:'0.7rem 1rem', fontSize:'0.8rem', color:'#f87171', marginBottom:'1rem' }}>
                {editError}
              </div>
            )}

            <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
              <button type="button" onClick={() => setEditCliente(null)}
                style={{ background:'rgba(231,223,202,0.08)', color:C.marfil, border:'1px solid rgba(231,223,202,0.15)', borderRadius:'8px', padding:'0.7rem 1.3rem', fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', cursor:'pointer', fontFamily:'inherit' }}>
                Cancelar
              </button>
              <button type="submit" disabled={editSaving}
                style={{ background: editSaving ? 'rgba(150,134,34,0.5)' : C.olivo, color:C.vino, border:'none', borderRadius:'8px', padding:'0.7rem 1.5rem', fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', cursor: editSaving ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
                {editSaving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </form>
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
              </div>
              <p style={{ fontSize:'0.75rem', color:'rgba(231,223,202,0.5)', marginTop:'0.6rem' }}>
                La contraseña temporal se genera automáticamente (la parte del correo antes de la @) y se le envía al cliente por correo.
              </p>
            </div>

            {/* Plan y vigencia */}
            <div style={{ borderTop:'1px solid rgba(150,134,34,0.15)', paddingTop:'1.2rem', marginBottom:'1.5rem' }}>
              <div style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:C.olivo, marginBottom:'1rem' }}>
                Acceso y suscripción
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                <div>
                  <label style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(231,223,202,0.5)', display:'block', marginBottom:'0.4rem' }}>Plan</label>
                  <select value={form.plan} onChange={e => setForm(f => ({...f, plan:e.target.value}))}
                    style={{ ...inputStyle, width:'100%' }}>
                    <option value="trial">Prueba (sin cobro)</option>
                    <option value="basico">Básico</option>
                    <option value="pro">Pro</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(231,223,202,0.5)', display:'block', marginBottom:'0.4rem' }}>
                    Vigencia hasta <span style={{ fontWeight:400, color:'rgba(231,223,202,0.35)' }}>(vacío = sin límite)</span>
                  </label>
                  <input type="date" value={form.suscripcion_vencimiento}
                    onChange={e => setForm(f => ({...f, suscripcion_vencimiento:e.target.value}))}
                    style={{ ...inputStyle, width:'100%', boxSizing:'border-box' }} />
                </div>
              </div>
            </div>

            <p style={{ fontSize:'0.75rem', color:'rgba(231,223,202,0.5)', marginBottom:'1.5rem', lineHeight:1.5 }}>
              El cliente elegirá qué servicios presta la primera vez que inicie sesión, y con eso se le cargarán automáticamente sus obligaciones. Podrás agregar o quitar servicios después desde su ficha.
            </p>

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
      <div style={{ background:'#1a0204', border:'1px solid rgba(150,134,34,0.3)', borderRadius:'16px', padding:'2rem', width:'100%', maxWidth: wide ? '820px' : '720px', maxHeight:'92vh', overflowY:'auto', position:'relative' }}>
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

const btnStyle: React.CSSProperties = {
  background:'#968622', color:'#270205', border:'none', borderRadius:'8px',
  padding:'0.65rem 1.1rem', fontSize:'0.7rem', fontWeight:700,
  letterSpacing:'0.12em', textTransform:'uppercase', cursor:'pointer', fontFamily:'inherit',
}
