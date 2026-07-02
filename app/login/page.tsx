'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

type Paso = 'credenciales' | 'mfa'

export default function LoginPage() {
  const router = useRouter()
  const [paso,         setPaso]        = useState<Paso>('credenciales')
  const [email,        setEmail]       = useState('')
  const [password,     setPassword]    = useState('')
  const [mfaCode,      setMfaCode]     = useState('')
  const [error,        setError]       = useState('')
  const [loading,      setLoading]     = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  /* ── Paso 1: verificar credenciales y detectar si necesita MFA ── */
  async function handleCredenciales(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // /api/mfa/verify solo verifica contraseña — responde en ~300ms
      const res = await fetch('/api/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (!data.ok) {
        setError('Email o contraseña incorrectos.')
        setLoading(false)
        return
      }

      if (data.needsMfa) {
        // Mostrar pantalla MFA inmediatamente
        setPaso('mfa')
        setLoading(false)
        // Disparar envío de código en paralelo SIN esperar (puede tardar)
        fetch('/api/mfa/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        }).catch(() => {})
        return
      }

      // Cliente (sin MFA) → iniciar sesión directamente
      const result = await signIn('credentials', { email, password, mfaCode: '', redirect: false })
      if (result?.error) {
        setError('Email o contraseña incorrectos.')
      } else {
        router.push('/dashboard')
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  /* ── Paso 2: verificar código MFA e iniciar sesión ── */
  async function handleMfa(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email,
      password,
      mfaCode: mfaCode.trim(),
      redirect: false,
    })

    if (result?.error) {
      setError('Código incorrecto o expirado. Solicita uno nuevo.')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  function reenviarCodigo() {
    setError('Enviando nuevo código...')
    setMfaCode('')
    fetch('/api/mfa/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
      .then(() => setError('Nuevo código enviado. Puede tardar unos segundos.'))
      .catch(() => setError('Error enviando código. Intenta de nuevo.'))
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #270205 0%, #712529 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Josefin Sans', sans-serif",
      padding: '2rem',
    }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Josefin+Sans:wght@300;400;600;700&display=swap"
        rel="stylesheet"
      />

      <div style={{
        background: '#e7dfca',
        borderRadius: '16px',
        padding: '3rem',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '1.6rem',
            fontWeight: 700,
            color: '#270205',
            letterSpacing: '0.02em',
          }}>
            Owl Compliance
          </div>
          <div style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#968622',
            marginTop: '0.3rem',
          }}>
            Centro de Cumplimiento Regulatorio
          </div>
        </div>

        {/* ── PASO 1: Email + Contraseña ── */}
        {paso === 'credenciales' && (
          <form onSubmit={handleCredenciales}>
            <div style={{ marginBottom: '1.2rem' }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ ...inputStyle, paddingRight: '2.8rem', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    color: 'rgba(39,2,5,0.45)', fontSize: '1rem', lineHeight: 1,
                  }}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && <ErrorBox>{error}</ErrorBox>}

            <button type="submit" disabled={loading} style={btnStyle(loading)}>
              {loading ? 'Verificando...' : 'Continuar'}
            </button>
          </form>
        )}

        {/* ── PASO 2: Código MFA ── */}
        {paso === 'mfa' && (
          <form onSubmit={handleMfa}>
            <div style={{
              background: 'rgba(150,134,34,0.12)',
              border: '1px solid rgba(150,134,34,0.35)',
              borderRadius: '8px',
              padding: '0.9rem 1rem',
              marginBottom: '1.5rem',
              fontSize: '0.78rem',
              color: '#270205',
              lineHeight: 1.6,
            }}>
              Enviamos un código de 6 dígitos a <strong>{email}</strong>. Revisa tu correo e ingrésalo a continuación.
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>Código de verificación</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={mfaCode}
                onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                required
                autoFocus
                style={{
                  ...inputStyle,
                  textAlign: 'center',
                  fontSize: '1.4rem',
                  letterSpacing: '0.4em',
                  fontWeight: 700,
                }}
              />
            </div>

            {error && <ErrorBox>{error}</ErrorBox>}

            <button type="submit" disabled={loading || mfaCode.length < 6} style={btnStyle(loading || mfaCode.length < 6)}>
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => { setPaso('credenciales'); setError(''); setMfaCode('') }}
                style={linkBtn}
              >
                Volver
              </button>
              <button type="button" onClick={reenviarCodigo} style={linkBtn}>
                Reenviar código
              </button>
            </div>
          </form>
        )}

        <div style={{
          textAlign: 'center',
          marginTop: '1.5rem',
          fontSize: '0.7rem',
          color: 'rgba(39,2,5,0.4)',
          letterSpacing: '0.05em',
        }}>
          Plataforma restringida — solo usuarios autorizados
        </div>

        <div style={{
          textAlign: 'center',
          marginTop: '1rem',
          fontSize: '0.68rem',
          color: 'rgba(39,2,5,0.4)',
          lineHeight: 1.6,
        }}>
          Al ingresar, acepta el tratamiento de sus datos conforme a nuestra{' '}
          <a
            href="/privacidad"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#712529', textDecoration: 'underline' }}
          >
            Política de Privacidad
          </a>
          . Consultas: contacto@owlcompliance.co
        </div>
      </div>
    </div>
  )
}

/* ── Estilos compartidos ── */

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.72rem',
  fontWeight: 700,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  color: '#270205',
  marginBottom: '0.5rem',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.8rem 1rem',
  border: '1.5px solid rgba(39,2,5,0.2)',
  borderRadius: '8px',
  background: 'white',
  fontSize: '0.9rem',
  color: '#270205',
  outline: 'none',
  fontFamily: 'inherit',
}

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '0.9rem',
    background: disabled ? '#968622aa' : '#968622',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.78rem',
    fontWeight: 700,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.2s',
  }
}

const linkBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '0.72rem',
  color: 'rgba(39,2,5,0.5)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  textDecoration: 'underline',
  padding: 0,
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(113,37,41,0.1)',
      border: '1px solid rgba(113,37,41,0.3)',
      borderRadius: '8px',
      padding: '0.75rem 1rem',
      fontSize: '0.82rem',
      color: '#712529',
      marginBottom: '1.2rem',
    }}>
      {children}
    </div>
  )
}
