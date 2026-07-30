'use client'

import { useState } from 'react'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

// Agrupar servicios por categoría según prefijos conocidos
function categorizarServicio(nombre: string): string {
  const n = nombre.toLowerCase()
  if (n.includes('sva') || n.includes('iptv') || n.includes('isp')) return 'SVA'
  if (n.includes('móvil') || n.includes('movil') || n.includes('celular') || n.includes('pcs')) return 'Móvil'
  if (n.includes('tpbc') || n.includes('fijo') || n.includes('comunitario')) return 'Fija'
  return 'Otros'
}

export default function SeleccionarServiciosClient({
  serviciosDisponibles,
}: {
  serviciosDisponibles: { servicio: string; servicio_slug: string }[]
}) {
  const [seleccionados, setSeleccionados] = useState<string[]>([])
  const [error, setError]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [done, setDone]       = useState(false)

  function toggle(slug: string) {
    setSeleccionados(s => s.includes(slug) ? s.filter(x => x !== slug) : [...s, slug])
  }

  const serviciosPorCat = serviciosDisponibles.reduce((acc, s) => {
    const cat = categorizarServicio(s.servicio)
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(s)
    return acc
  }, {} as Record<string, typeof serviciosDisponibles>)

  async function confirmar() {
    if (seleccionados.length === 0) { setError('Selecciona al menos un servicio'); return }
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/perfil/servicios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servicios: seleccionados }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al guardar'); return }
      setDone(true)
      // El JWT no se refresca solo — hay que volver a iniciar sesión para que
      // desaparezca el gate de "elegir servicios".
      setTimeout(() => { window.location.href = '/signout' }, 1600)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.vino, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: "'Josefin Sans', sans-serif" }}>
      <div style={{ maxWidth: 620, width: '100%', background: '#fff', borderRadius: 16, padding: '2rem', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <h1 style={{ margin: '0 0 0.4rem', color: C.vino, fontSize: 20, fontWeight: 700 }}>¿Qué servicios presta tu empresa?</h1>
        <p style={{ fontSize: 13, color: '#666', margin: '0 0 1.2rem' }}>
          Selecciona todos los que apliquen. Con esto cargamos automáticamente las obligaciones regulatorias que te corresponden.
          Una vez confirmes, solo un administrador podrá modificar esta selección.
        </p>

        {done ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.8rem' }}>✅</div>
            <p style={{ color: '#16a34a', fontWeight: 600, margin: 0 }}>Servicios guardados</p>
            <p style={{ color: '#666', fontSize: 13, marginTop: 8 }}>Vuelve a iniciar sesión para ver tu mapa de cumplimiento…</p>
          </div>
        ) : (
          <>
            <div style={{ maxHeight: '50vh', overflowY: 'auto', padding: '4px 2px' }}>
              {Object.entries(serviciosPorCat).map(([cat, servs]) => (
                <div key={cat} style={{ marginBottom: '1.2rem' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.olivo, marginBottom: 8 }}>{cat}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                    {servs.map(s => {
                      const activo = seleccionados.includes(s.servicio_slug)
                      return (
                        <label key={s.servicio_slug} style={{
                          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                          border: `1.5px solid ${activo ? C.bordo : '#e5e5e5'}`, borderRadius: 8,
                          padding: '0.6rem 0.8rem', background: activo ? '#fdf2f2' : '#fff',
                        }}>
                          <input type="checkbox" checked={activo} onChange={() => toggle(s.servicio_slug)}
                            style={{ accentColor: C.bordo, width: 16, height: 16, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: C.vino, fontWeight: activo ? 700 : 500 }}>{s.servicio}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {error && <p style={{ color: '#dc2626', fontSize: 13, margin: '1rem 0 0' }}>{error}</p>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button onClick={confirmar} disabled={saving} style={{
                background: C.bordo, color: '#fff', border: 'none', borderRadius: 8,
                padding: '12px 24px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
              }}>
                {saving ? 'Guardando…' : `Confirmar (${seleccionados.length} seleccionado${seleccionados.length === 1 ? '' : 's'})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
