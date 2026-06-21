'use client'

import { useEffect, useState, useCallback } from 'react'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

const TIPOS = [
  { key: 'financiera',    label: 'Financiera',    color: '#3b82f6' },
  { key: 'tecnica',       label: 'Técnica',       color: '#10b981' },
  { key: 'juridica',      label: 'Jurídica',      color: '#f59e0b' },
  { key: 'transversal',   label: 'Transversal',   color: '#8b5cf6' },
]

interface Admin {
  id:         string
  email:      string
  nombre:     string
  activo:     number
  created_at: string
}

const FORM_INIT = { email: '', nombre: '', password: '', confirmar: '' }

export default function AdminsClient({ currentUserId }: { currentUserId: string }) {
  const [admins,        setAdmins]        = useState<Admin[]>([])
  const [especialidades, setEspecialidades] = useState<{ user_id: string; tipo: string }[]>([])
  const [loading,       setLoading]       = useState(true)
  const [modalNuevo,    setModalNuevo]    = useState(false)
  const [form,          setForm]          = useState(FORM_INIT)
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [ra, re] = await Promise.all([
        fetch('/api/admins').then(r => r.json()),
        fetch('/api/admins/especialidades').then(r => r.json()),
      ])
      setAdmins(ra)
      setEspecialidades(re)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirmar) { setError('Las contraseñas no coinciden'); return }
    if (form.password.length < 8) { setError('Mínimo 8 caracteres'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admins', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, nombre: form.nombre, password: form.password }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al crear'); return }
      setModalNuevo(false); setForm(FORM_INIT); cargar()
    } finally { setSaving(false) }
  }

  async function toggleActivo(admin: Admin) {
    await fetch(`/api/admins?id=${admin.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !admin.activo }),
    })
    cargar()
  }

  async function toggleEspecialidad(adminId: string, tipo: string) {
    const tiene = especialidades.some(e => e.user_id === adminId && e.tipo === tipo)
    await fetch('/api/admins/especialidades', {
      method: tiene ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId, tipo }),
    })
    cargar()
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: `1px solid ${C.bordo}40`, background: '#fff',
    fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box',
  }
  const btn = (bg: string, color = '#fff'): React.CSSProperties => ({
    background: bg, color, border: 'none', borderRadius: 8,
    padding: '10px 20px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
  })

  return (
    <div style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, color: C.vino, fontSize: 24, fontWeight: 700 }}>Administradores</h1>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: 14 }}>Gestiona perfiles y especialidades por tipo de obligación</p>
        </div>
        <button style={btn(C.bordo)} onClick={() => { setModalNuevo(true); setError(''); setForm(FORM_INIT) }}>
          + Nuevo administrador
        </button>
      </div>

      {loading ? <p style={{ color: '#888' }}>Cargando...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {admins.map(a => {
            const espAdmin = especialidades.filter(e => e.user_id === a.id).map(e => e.tipo)
            return (
              <div key={a.id} style={{
                background: '#fff', border: `1px solid ${C.bordo}25`, borderRadius: 12,
                padding: '1.25rem 1.5rem', opacity: a.activo ? 1 : 0.55,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: C.vino, fontSize: 15 }}>
                      {a.nombre}
                      {a.id === currentUserId && <span style={{ marginLeft: 8, fontSize: 11, color: '#999', fontWeight: 400 }}>Tu cuenta</span>}
                    </div>
                    <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{a.email}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: a.activo ? '#dcfce7' : '#fee2e2', color: a.activo ? '#16a34a' : '#dc2626' }}>
                      {a.activo ? 'Activo' : 'Inactivo'}
                    </span>
                    {a.id !== currentUserId && (
                      <button onClick={() => toggleActivo(a)} style={btn(a.activo ? '#fee2e2' : '#dcfce7', a.activo ? '#dc2626' : '#16a34a')}>
                        {a.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Especialidades */}
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#999', marginBottom: 8 }}>Especialidades</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {TIPOS.map(t => {
                      const activo = espAdmin.includes(t.key)
                      return (
                        <button key={t.key} onClick={() => toggleEspecialidad(a.id, t.key)}
                          style={{
                            border: `2px solid ${t.color}`, borderRadius: 20, padding: '5px 14px',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            background: activo ? t.color : 'transparent',
                            color: activo ? '#fff' : t.color,
                            transition: 'all 0.15s',
                          }}>
                          {t.label}
                        </button>
                      )
                    })}
                  </div>
                  {espAdmin.length === 0 && (
                    <p style={{ fontSize: 12, color: '#aaa', margin: '6px 0 0', fontStyle: 'italic' }}>Sin especialidades asignadas — los chats/tickets de cualquier tipo no tendrán responsable automático</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nuevo */}
      {modalNuevo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '2rem', width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ margin: '0 0 1.5rem', color: C.vino, fontSize: 20 }}>Nuevo administrador</h2>
            <form onSubmit={crear} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[['Nombre completo','nombre','text'],['Email','email','email'],['Contraseña','password','password'],['Confirmar contraseña','confirmar','password']].map(([label, key, type]) => (
                <div key={key}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: C.vino, display: 'block', marginBottom: 4 }}>{label}</label>
                  <input style={inp} type={type} required value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
              {error && <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" style={btn('#f0f0f0', '#333')} onClick={() => setModalNuevo(false)}>Cancelar</button>
                <button type="submit" style={btn(C.bordo)} disabled={saving}>{saving ? 'Creando...' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
