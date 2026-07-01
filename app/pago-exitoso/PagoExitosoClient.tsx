'use client'

import { useSearchParams } from 'next/navigation'

const C = { vino: '#270205', olivo: '#968622', marfil: '#e7dfca' }

export default function PagoExitosoClient() {
  const params = useSearchParams()
  const error  = params.get('error') === '1'

  return (
    <div style={{
      minHeight: '100vh', background: C.vino, display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontFamily: "'Josefin Sans', sans-serif", color: C.marfil,
      padding: '2rem',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      <div style={{
        maxWidth: 520, width: '100%', textAlign: 'center',
        background: 'rgba(231,223,202,0.04)', border: `1px solid rgba(150,134,34,0.25)`,
        borderRadius: '16px', padding: '3rem 2.5rem',
      }}>
        {error ? (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>⚠️</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', fontWeight: 700, marginBottom: '1rem' }}>
              Algo salió mal
            </div>
            <p style={{ fontSize: '0.9rem', color: 'rgba(231,223,202,0.65)', lineHeight: 1.7, marginBottom: '2rem' }}>
              No pudimos iniciar el proceso de pago. Por favor intenta nuevamente o contáctanos.
            </p>
            <a href="https://owlcompliance.co/servicios.html"
              style={{ display: 'inline-block', padding: '0.75rem 2rem', background: C.olivo,
                color: C.vino, borderRadius: '8px', fontWeight: 700, fontSize: '0.8rem',
                letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none' }}>
              Volver a los planes
            </a>
          </>
        ) : (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>✅</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', fontWeight: 700, marginBottom: '1rem' }}>
              ¡Pago procesado!
            </div>
            <p style={{ fontSize: '0.9rem', color: 'rgba(231,223,202,0.65)', lineHeight: 1.7, marginBottom: '0.75rem' }}>
              Tu suscripción a Owl Compliance está siendo activada.
            </p>
            <p style={{ fontSize: '0.9rem', color: 'rgba(231,223,202,0.65)', lineHeight: 1.7, marginBottom: '2rem' }}>
              En los próximos minutos recibirás un correo con tu <strong style={{ color: C.olivo }}>usuario y contraseña</strong> para acceder a la plataforma.
            </p>
            <div style={{ fontSize: '0.75rem', color: 'rgba(231,223,202,0.35)', marginBottom: '2rem' }}>
              Si no ves el correo, revisa tu carpeta de spam.
            </div>
            <a href="https://owlcompliance.onrender.com/login"
              style={{ display: 'inline-block', padding: '0.75rem 2rem', background: C.olivo,
                color: C.vino, borderRadius: '8px', fontWeight: 700, fontSize: '0.8rem',
                letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none' }}>
              Ir al login
            </a>
          </>
        )}
      </div>
    </div>
  )
}
