'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

const PROVIDERS = [
  {
    id:    'googledrive',
    label: 'Google Drive',
    icon:  '🟡',
    desc:  'Almacena los documentos en una carpeta de tu Google Drive. Necesitas autorizar el acceso con tu cuenta de Google.',
    authProvider: 'google',
  },
  {
    id:    'onedrive',
    label: 'OneDrive',
    icon:  '🔵',
    desc:  'Almacena los documentos en tu OneDrive personal o de empresa (Microsoft 365).',
    authProvider: 'microsoft-onedrive',
  },
  {
    id:    'sharepoint',
    label: 'SharePoint',
    icon:  '🟢',
    desc:  'Almacena los documentos en un sitio de SharePoint de tu organización. Necesitarás la URL del sitio.',
    authProvider: 'microsoft-sharepoint',
    needsSiteUrl: true,
  },
]

export default function AlmacenamientoClient() {
  const searchParams  = useSearchParams()
  const [cfg,     setCfg]     = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [siteUrl, setSiteUrl] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState<{ text: string; ok: boolean } | null>(null)

  async function cargar() {
    setLoading(true)
    const r = await fetch('/api/storage/config')
    if (r.ok) setCfg(await r.json())
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  // Mostrar resultado OAuth al volver del callback
  useEffect(() => {
    const status   = searchParams.get('storage')
    const provider = searchParams.get('provider')
    if (status === 'ok')    { setMsg({ text: `${provider ?? 'Servicio'} conectado correctamente.`, ok: true });  cargar() }
    if (status === 'error') { setMsg({ text: 'Error al conectar. Intenta de nuevo.', ok: false }) }
  }, [searchParams])

  async function desconectar() {
    setSaving(true)
    await fetch('/api/storage/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'disconnect' }),
    })
    await cargar()
    setMsg({ text: 'Almacenamiento desconectado.', ok: true })
    setSaving(false)
  }

  function conectar(prov: typeof PROVIDERS[0]) {
    let url = `/api/storage/auth/${prov.authProvider}`
    if (prov.needsSiteUrl) {
      if (!siteUrl.trim()) { setMsg({ text: 'Ingresa la URL del sitio SharePoint.', ok: false }); return }
      url += `?siteUrl=${encodeURIComponent(siteUrl.trim())}`
    }
    window.location.href = url
  }

  const tipoActual   = cfg?.type ?? 'local'
  const conectado    = cfg?.connected && tipoActual !== 'local'
  const provActual   = PROVIDERS.find(p => p.id === tipoActual)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.vino, display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: 'rgba(231,223,202,0.4)', fontFamily: "'Josefin Sans', sans-serif" }}>
      Cargando…
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.vino, fontFamily: "'Josefin Sans', sans-serif", color: C.marfil }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      {/* Nav */}
      <nav style={{ background: 'rgba(39,2,5,0.97)', borderBottom: '1px solid rgba(150,134,34,0.2)',
        padding: '0.9rem 2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <a href="/dashboard" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem',
          fontWeight: 700, color: C.marfil, textDecoration: 'none' }}>Owl Compliance</a>
        <span style={{ color: 'rgba(231,223,202,0.3)' }}>›</span>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.15em',
          textTransform: 'uppercase', color: C.olivo }}>Almacenamiento de documentos</span>
        <a href="/signout" style={{ marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 700,
          letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.5)', textDecoration: 'none' }}>
          Salir
        </a>
      </nav>

      <main style={{ maxWidth: 700, margin: '0 auto', padding: '2.5rem 1.5rem' }}>

        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.7rem', fontWeight: 700, marginBottom: '0.4rem' }}>
          Almacenamiento de documentos
        </div>
        <p style={{ fontSize: '0.82rem', color: 'rgba(231,223,202,0.55)', marginBottom: '2rem', lineHeight: 1.7 }}>
          Elige dónde quieres que Owl Compliance guarde los documentos que subes para acreditar el cumplimiento de tus obligaciones.
          Al conectar un servicio, autorizas a la plataforma a almacenar archivos en tu cuenta.
        </p>

        {/* Mensaje de resultado */}
        {msg && (
          <div style={{ marginBottom: '1.5rem', padding: '0.85rem 1.2rem', borderRadius: 10,
            background: msg.ok ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
            border: `1px solid ${msg.ok ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}`,
            color: msg.ok ? '#34d399' : '#f87171', fontSize: '0.82rem', display: 'flex',
            alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{msg.text}</span>
            <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none',
              color: 'inherit', cursor: 'pointer', fontSize: '1rem', opacity: 0.6 }}>✕</button>
          </div>
        )}

        {/* Estado actual */}
        <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '2rem',
          border: '1px solid rgba(150,134,34,0.2)' }}>
          <div style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
            color: 'rgba(231,223,202,0.4)', marginBottom: '0.75rem' }}>Estado actual</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.8rem' }}>{provActual?.icon ?? '💾'}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                {conectado ? provActual?.label : 'Almacenamiento local del servidor'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(231,223,202,0.45)', marginTop: 2 }}>
                {conectado
                  ? 'Conectado — los documentos se guardan en tu cuenta'
                  : 'Los documentos se guardan en el servidor de Owl Compliance'}
              </div>
            </div>
            {conectado && (
              <button onClick={desconectar} disabled={saving}
                style={{ marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: '#f87171', background: 'rgba(220,38,38,0.1)',
                  border: '1px solid rgba(220,38,38,0.25)', borderRadius: 7, padding: '0.4rem 0.9rem',
                  cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? '…' : 'Desconectar'}
              </button>
            )}
          </div>
        </div>

        {/* Opciones de proveedor */}
        <div style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
          color: 'rgba(231,223,202,0.4)', marginBottom: '1rem' }}>
          Conectar un servicio de almacenamiento
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {PROVIDERS.map(prov => {
            const esActual = tipoActual === prov.id && conectado
            return (
              <div key={prov.id} style={{ background: esActual ? 'rgba(150,134,34,0.08)' : 'rgba(0,0,0,0.2)',
                border: esActual ? '1px solid rgba(150,134,34,0.35)' : '1px solid rgba(231,223,202,0.08)',
                borderRadius: 12, padding: '1.2rem 1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>{prov.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      {prov.label}
                      {esActual && (
                        <span style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.12em',
                          textTransform: 'uppercase', background: 'rgba(22,163,74,0.15)', color: '#34d399',
                          padding: '2px 8px', borderRadius: 10 }}>✓ Activo</span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'rgba(231,223,202,0.5)', margin: '0 0 1rem', lineHeight: 1.6 }}>
                      {prov.desc}
                    </p>

                    {prov.needsSiteUrl && !esActual && (
                      <input
                        type="url"
                        placeholder="https://tuempresa.sharepoint.com/sites/nombre"
                        value={siteUrl}
                        onChange={e => setSiteUrl(e.target.value)}
                        style={{ width: '100%', background: 'rgba(231,223,202,0.06)',
                          border: '1px solid rgba(150,134,34,0.3)', borderRadius: 7,
                          padding: '0.5rem 0.75rem', color: C.marfil, fontSize: '0.8rem',
                          fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: '0.75rem' }}
                      />
                    )}

                    {!esActual && (
                      <button onClick={() => conectar(prov)}
                        style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em',
                          textTransform: 'uppercase', background: 'rgba(150,134,34,0.15)', color: C.olivo,
                          border: '1px solid rgba(150,134,34,0.35)', borderRadius: 7,
                          padding: '0.5rem 1.2rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                        Autorizar acceso a {prov.label}
                      </button>
                    )}

                    {esActual && (
                      <button onClick={() => conectar(prov)}
                        style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em',
                          textTransform: 'uppercase', background: 'transparent', color: 'rgba(231,223,202,0.4)',
                          border: '1px solid rgba(231,223,202,0.15)', borderRadius: 7,
                          padding: '0.5rem 1.2rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                        Reconectar / actualizar permisos
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <p style={{ marginTop: '2rem', fontSize: '0.72rem', color: 'rgba(231,223,202,0.3)', lineHeight: 1.7, textAlign: 'center' }}>
          Solo se solicitan permisos para leer y escribir archivos en la carpeta de Owl Compliance.<br/>
          Puedes revocar el acceso en cualquier momento desde tu cuenta del proveedor.
        </p>
      </main>
    </div>
  )
}
