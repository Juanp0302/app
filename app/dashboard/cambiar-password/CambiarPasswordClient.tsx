'use client'

import { useState } from 'react'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

export default function CambiarPasswordClient({ obligatorio }: { obligatorio: boolean }) {
  const [form, setForm]       = useState({ actual: '', nueva: '', confirmar: '' })
  const [error, setError]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [done, setDone]       = useState(false)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.nueva.length < 8) { setError('La nueva contraseña debe tener al menos 8 caracteres'); return }
    if (form.nueva !== form.confirmar) { setError('Las contraseñas nuevas no coinciden'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/perfil/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passwordActual: form.actual, passwordNueva: form.nueva }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al cambiar la contraseña'); return }

      setDone(true)
      // El JWT no se refresca solo — hay que volver a iniciar sesión para que
      // desaparezca el bloqueo de "debes cambiar tu contraseña".
      setTimeout(() => { window.location.href = '/signout' }, 1800)
    } finally {
      setSaving(false)
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: `1px solid ${C.bordo}40`, background: '#fff',
    fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: C.vino, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: "'Josefin Sans', sans-serif" }}>
      <div style={{ maxWidth: 440, width: '100%', background: '#fff', borderRadius: 16, padding: '2rem', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <h1 style={{ margin: '0 0 0.4rem', color: C.vino, fontSize: 20, fontWeight: 700 }}>Cambiar contraseña</h1>

        {obligatorio && !done && (
          <p style={{ fontSize: 13, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '0.7rem 0.9rem', margin: '0.8rem 0 1.2rem' }}>
            Por seguridad, debes cambiar tu contraseña temporal antes de continuar.
          </p>
        )}

        {done ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.8rem' }}>✅</div>
            <p style={{ color: '#16a34a', fontWeight: 600, margin: 0 }}>Contraseña actualizada</p>
            <p style={{ color: '#666', fontSize: 13, marginTop: 8 }}>Vuelve a iniciar sesión con tu nueva contraseña…</p>
          </div>
        ) : (
          <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: '1rem' }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.vino, display: 'block', marginBottom: 4 }}>
                Contraseña actual {obligatorio && <span style={{ fontWeight: 400, color: '#999' }}>(la temporal que recibiste por correo)</span>}
              </label>
              <input style={inp} type="password" required value={form.actual}
                onChange={e => setForm(f => ({ ...f, actual: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.vino, display: 'block', marginBottom: 4 }}>Nueva contraseña</label>
              <input style={inp} type="password" required minLength={8} value={form.nueva}
                onChange={e => setForm(f => ({ ...f, nueva: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.vino, display: 'block', marginBottom: 4 }}>Confirmar nueva contraseña</label>
              <input style={inp} type="password" required minLength={8} value={form.confirmar}
                onChange={e => setForm(f => ({ ...f, confirmar: e.target.value }))} />
            </div>
            {error && <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{error}</p>}
            <button type="submit" disabled={saving} style={{
              background: C.bordo, color: '#fff', border: 'none', borderRadius: 8,
              padding: '12px 20px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
            }}>
              {saving ? 'Guardando…' : 'Cambiar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
