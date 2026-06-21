'use client'

import { useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'

export default function SignOutPage() {
  const [done, setDone] = useState(false)

  useEffect(() => {
    // Ejecuta el signout y luego redirige al login
    signOut({ redirect: false }).then(() => {
      setDone(true)
      setTimeout(() => { window.location.href = '/login' }, 1800)
    })
  }, [])

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
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.5rem',
      }}>
        {/* Logo */}
        <div>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '1.8rem',
            fontWeight: 700,
            color: '#e7dfca',
            letterSpacing: '0.02em',
          }}>
            Owl Compliance
          </div>
          <div style={{
            fontSize: '0.65rem',
            fontWeight: 600,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: '#968622',
            marginTop: '0.3rem',
          }}>
            Centro de Cumplimiento Regulatorio
          </div>
        </div>

        {/* Separador */}
        <div style={{ width: 40, height: 1, background: 'rgba(150,134,34,0.4)' }} />

        {/* Mensaje */}
        <div>
          {!done ? (
            <>
              <div style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'rgba(231,223,202,0.5)',
              }}>
                Cerrando sesión…
              </div>
              <div style={{ marginTop: '1.2rem', display: 'flex', gap: 6, justifyContent: 'center' }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#968622',
                    opacity: 0.5,
                    animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '1.2rem',
                color: '#e7dfca',
                marginBottom: '0.5rem',
              }}>
                Sesión cerrada
              </div>
              <div style={{
                fontSize: '0.7rem',
                fontWeight: 400,
                letterSpacing: '0.1em',
                color: 'rgba(231,223,202,0.45)',
              }}>
                Redirigiendo al inicio…
              </div>
            </>
          )}
        </div>

        {/* Enlace manual por si la redirección falla */}
        {done && (
          <a href="/login" style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#968622',
            textDecoration: 'none',
            border: '1px solid rgba(150,134,34,0.4)',
            borderRadius: 6,
            padding: '0.45rem 1rem',
          }}>
            Ir al inicio de sesión
          </a>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}
