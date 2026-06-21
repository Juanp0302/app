'use client'

import { useEffect, useState, useCallback } from 'react'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

interface Admin {
  id:         string
  email:      string
  nombre:     string
  activo:     number
  created_at: string
}

const FORM_INIT = { email: '', nombre: '', password: '', confirmar: '' }

export default function AdminsClient({ currentUserId }: { currentUserId: string }) {
  const [admins,     setAdmins]     = useState<Admin[]>([])
  const [loading,    setLoading]    = useState(true)
  const [modalNuevo, setModalNuevo] = useState(false)
  const [form,       setForm]       = useState(FORM_INIT)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admins')
      setAdmins(await res.json())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirmar) { setError('Las contraseñas no coinciden'); return }
    if (form.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, nombre: form.nombre, password: form.password }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al crear'); return }
      setModalNuevo(false)
      setForm(FORM_INIT)
      cargar()
    } finally { setSaving(false) }
  }

  async function toggleActivo(admin: Admin) {
    await fetch(`/api/admins?id=${admin.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !admin.activo }),
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
    padding: '10px 20px', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 14, fontWeight: 600,
  })

  return (
    <div style={{ padding: '2rem', maxWidth: 800, margin: '0 auto' }}>

      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, color: C.vino, fontSize: 24, fontWeight: 700 }}>Administradores</h1>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: 14 }}>
            Gestiona los perfiles con acceso total a la plataforma
          </p>
        </div>
        <button style={btn(C.bordo)} onClick={() => { setModalNuevo(true); setError(''); setForm(FORM_INIT) }}>
          + Nuevo administrador
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <p style={{ color: '#888' }}>Cargando...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {admins.map(a => (
            <div key={a.id} style={{
              background: '#fff', border: `1px solid ${C.bordo}25`,
              borderRadius: 12, padding: '1rem 1.25rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              opacity: a.activo ? 1 : 0.5,
            }}>
              <div>
                <div style={{ fontWeight: 600, color: C.vino, fontSize: 15 }}>{a.nombre}</div>
                <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{a.email}</div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                  Creado {new Date(a.created_at).toLocaleDateString('es-CO')}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
                  background: a.activo ? '#dcfce7' : '#fee2e2',
                  color: a.activo ? '#16a34a' : '#dc2626',
                }}>
                  {a.activo ? 'Activo' : 'Inactivo'}
                </span>
                {a.id !== currentUserId && (
                  <button
                    onClick={() => toggleActivo(a)}
                    style={btn(a.activo ? '#fee2e2' : '#dcfce7', a.activo ? '#dc2626' : '#16a34a')}
                  >
                    {a.activo ? 'Desactivar' : 'Activar'}
                  </button>
                )}
                {a.id === currentUserId && (
                  <span style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>Tu cuenta</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal nuevo admin */}
      {modalNuevo && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: '2rem',
            width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <h2 style={{ margin: '0 0 1.5rem', color: C.vino, fontSize: 20 }}>Nuevo administrador</h2>
            <form onSubmit={crear} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.vino, display: 'block', marginBottom: 4 }}>Nombre completo</label>
                <input style={inp} required value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.vino, display: 'block', marginBottom: 4 }}>Email</label>
                <input style={inp} type="email" required value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.vino, display: 'block', marginBottom: 4 }}>Contraseña</label>
                <input style={inp} type="password" required value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.vino, display: 'block', marginBottom: 4 }}>Confirmar contraseña</label>
                <input style={inp} type="password" required value={form.confirmar}
                  onChange={e => setForm(f => ({ ...f, confirmar: e.target.value }))} />
              </div>
              {error && <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" style={btn('#f0f0f0', '#333')}
                  onClick={() => setModalNuevo(false)}>Cancelar</button>
                <button type="submit" style={btn(C.bordo)} disabled={saving}>
                  {saving ? 'Creando...' : 'Crear administrador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
