import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidad — Owl Compliance',
  description: 'Política de tratamiento de datos personales de Owl Compliance, conforme a la Ley 1581 de 2012.',
}

export default function PoliticaPrivacidadPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f2eb',
      fontFamily: "'Josefin Sans', Arial, sans-serif",
      color: '#270205',
    }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Josefin+Sans:wght@300;400;600;700&display=swap"
        rel="stylesheet"
      />

      {/* Header */}
      <div style={{
        background: '#270205',
        padding: '2.5rem 2rem',
      }}>
        <div style={{ maxWidth: '780px', margin: '0 auto' }}>
          <div style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase' as const,
            color: '#968622',
            marginBottom: '0.5rem',
          }}>
            Documento legal · Colombia · Ley 1581 de 2012
          </div>
          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            fontWeight: 700,
            color: '#e7dfca',
            margin: '0 0 0.5rem',
            lineHeight: 1.2,
          }}>
            Política de Tratamiento de Datos Personales
          </h1>
          <div style={{
            fontSize: '0.78rem',
            color: 'rgba(231,223,202,0.55)',
          }}>
            Owl Compliance · Versión 1.0 · Vigente desde el 1 de julio de 2026
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{
        maxWidth: '780px',
        margin: '0 auto',
        padding: '3rem 2rem 5rem',
      }}>
        <Section title="1. Responsable del tratamiento">
          <p>
            <strong>Juan Pablo Osorio Marín</strong>, CC 1.053.824.988, que actúa bajo la marca comercial{' '}
            <strong>Owl Compliance</strong>, domiciliado en Bogotá, Cundinamarca, Colombia.
          </p>
          <p style={{ marginTop: '0.5rem' }}>
            Correo electrónico para asuntos de protección de datos:{' '}
            <a href="mailto:contacto@owlcompliance.co" style={{ color: '#712529' }}>
              contacto@owlcompliance.co
            </a>
          </p>
        </Section>

        <Section title="2. Marco legal">
          <p>
            Esta política se rige por la <strong>Ley 1581 de 2012</strong> (Habeas Data comercial) y el{' '}
            <strong>Decreto 1377 de 2013</strong> (compilado en Decreto 1074 de 2015), aplicables al tratamiento de
            datos personales de personas naturales en Colombia. Entidad fiscalizadora:{' '}
            <strong>Superintendencia de Industria y Comercio (SIC)</strong>.
          </p>
        </Section>

        <Section title="3. Ámbito de aplicación">
          <p>
            Esta política aplica a todos los datos personales de personas naturales que Owl Compliance recopile,
            almacene, use o transmita en el desarrollo de su plataforma de gestión de cumplimiento regulatorio para
            proveedores de servicios de telecomunicaciones (ISPs), así como a los datos recopilados a través del
            formulario de autodiagnóstico disponible en el sitio web.
          </p>
          <p style={{ marginTop: '0.5rem' }}>
            <strong>No aplica</strong> a los datos de personas jurídicas como tales, ni a los datos de los clientes
            finales de los ISPs usuarios de la plataforma (cuyo tratamiento es responsabilidad de cada ISP).
          </p>
        </Section>

        <Section title="4. Datos personales que tratamos">
          <Table
            headers={['Categoría', 'Datos', 'Titulares']}
            rows={[
              ['Identificación y contacto', 'Nombre, correo electrónico, teléfono', 'Administradores; representantes de clientes ISP; prospectos del autodiagnóstico'],
              ['Acceso a la plataforma', 'Correo electrónico, contraseña (almacenada como hash), rol', 'Todos los usuarios registrados'],
              ['Información de la empresa', 'Razón social, NIT, RUTIC, persona de contacto, cargo', 'Representantes de clientes ISP; prospectos del autodiagnóstico'],
              ['Comunicaciones', 'Contenido de mensajes en el chat interno', 'Usuarios de la plataforma'],
              ['Auditoría y seguridad', 'Registro de acciones (usuario, acción, IP, timestamp)', 'Usuarios de la plataforma'],
            ]}
          />
          <p style={{ marginTop: '0.75rem' }}>
            <strong>No tratamos datos sensibles</strong> (Art. 6 Ley 1581). No recopilamos datos de salud,
            biométricos, origen racial, opiniones políticas, convicciones religiosas ni datos procesales penales.
          </p>
          <p style={{ marginTop: '0.5rem' }}>
            <strong>No atendemos usuarios menores de edad.</strong> La plataforma está dirigida exclusivamente a
            personas mayores de edad.
          </p>
        </Section>

        <Section title="5. Finalidades del tratamiento">
          <ol style={{ paddingLeft: '1.4rem', lineHeight: 1.8 }}>
            <li><strong>Autenticación y acceso:</strong> verificar su identidad y gestionar el acceso a la plataforma.</li>
            <li><strong>Prestación del servicio:</strong> gestionar las obligaciones de cumplimiento regulatorio de su empresa ISP.</li>
            <li><strong>Comunicaciones del servicio:</strong> enviar recordatorios de vencimiento de obligaciones y notificaciones operativas.</li>
            <li><strong>Soporte y atención:</strong> gestionar sus consultas y solicitudes a través del chat y sistema de tickets.</li>
            <li><strong>Seguimiento comercial:</strong> contactar a los prospectos que completen el autodiagnóstico gratuito para ofrecerles información sobre nuestros servicios.</li>
            <li><strong>Seguridad y auditoría:</strong> registrar acciones para detectar accesos no autorizados y garantizar la trazabilidad.</li>
            <li><strong>Cumplimiento legal:</strong> cumplir con obligaciones legales aplicables a Owl Compliance.</li>
          </ol>
        </Section>

        <Section title="6. Base de licitud del tratamiento">
          <ul style={{ paddingLeft: '1.4rem', lineHeight: 1.8 }}>
            <li><strong>Autorización previa, expresa e informada del titular</strong> (Art. 9 Ley 1581) — obtenida al momento del registro o del envío del formulario de autodiagnóstico.</li>
            <li><strong>Ejecución del contrato de servicios</strong> suscrito con la empresa cliente.</li>
            <li><strong>Obligación legal</strong> para el mantenimiento de registros de auditoría y seguridad (Art. 17 lit. i Ley 1581).</li>
          </ul>
        </Section>

        <Section title="7. Derechos del titular (Habeas Data)">
          <p style={{ marginBottom: '0.75rem' }}>Como titular de datos personales, usted tiene derecho a:</p>
          <Table
            headers={['Derecho', 'Descripción', 'Plazo de respuesta']}
            rows={[
              ['Consulta (acceso)', 'Conocer qué datos tenemos sobre usted y para qué los usamos', '10 días hábiles (prorrogable 5 días hábiles más)'],
              ['Rectificación / Actualización', 'Corregir datos inexactos o desactualizados', '15 días hábiles (prorrogable 8 días hábiles más)'],
              ['Supresión', 'Solicitar la eliminación de sus datos cuando no haya obligación legal de conservarlos', '15 días hábiles'],
              ['Revocación de autorización', 'Retirar el consentimiento para el tratamiento', '15 días hábiles'],
              ['Queja ante la SIC', 'Acudir a la SIC si considera que sus derechos han sido vulnerados (solo después de presentar reclamo ante Owl Compliance)', '—'],
            ]}
          />
          <p style={{ marginTop: '0.75rem' }}>
            Para ejercer estos derechos, envíe un correo a{' '}
            <a href="mailto:contacto@owlcompliance.co" style={{ color: '#712529' }}>
              contacto@owlcompliance.co
            </a>{' '}
            con el asunto <strong>&ldquo;Solicitud Habeas Data&rdquo;</strong>.
          </p>
        </Section>

        <Section title="8. Encargados del tratamiento y transmisiones internacionales">
          <p style={{ marginBottom: '0.75rem' }}>
            Owl Compliance trabaja con los siguientes encargados del tratamiento, ubicados en países con nivel
            adecuado de protección reconocido por la SIC (Circular Única — Título V, numeral 3.2):
          </p>
          <Table
            headers={['Proveedor', 'País', 'Función']}
            rows={[
              ['Turso Inc.', 'Estados Unidos', 'Base de datos en la nube'],
              ['Resend', 'Estados Unidos', 'Envío de correos de recordatorio'],
              ['Google LLC', 'Estados Unidos', 'Almacenamiento de documentos (Google Drive) y registro de leads del autodiagnóstico (Google Sheets)'],
              ['Microsoft Corporation', 'Estados Unidos', 'Almacenamiento opcional de documentos (SharePoint/OneDrive)'],
              ['EmailJS', 'Estados Unidos', 'Notificación interna del equipo al recibir un autodiagnóstico'],
            ]}
          />
          <p style={{ marginTop: '0.75rem' }}>
            Estas son transmisiones a encargados, no transferencias a responsables. No realizamos transferencias de
            datos a responsables en países sin nivel adecuado.
          </p>
        </Section>

        <Section title="9. Seguridad de la información">
          <ul style={{ paddingLeft: '1.4rem', lineHeight: 1.8 }}>
            <li>Cifrado de contraseñas mediante bcrypt (función de hashing de alto costo).</li>
            <li>Cifrado de tokens de acceso a terceros con AES-256-GCM.</li>
            <li>Control de acceso basado en roles (admin / cliente / superadmin).</li>
            <li>Registro de auditoría de todas las acciones relevantes.</li>
            <li>Segregación de datos por cliente (multi-tenant).</li>
            <li>Comunicaciones cifradas mediante TLS/HTTPS.</li>
          </ul>
          <p style={{ marginTop: '0.75rem' }}>
            En caso de un incidente de seguridad que afecte sus datos, le notificaremos dentro del plazo legal y
            reportaremos a la SIC según corresponda (máximo 15 días hábiles desde la detección).
          </p>
        </Section>

        <Section title="10. Plazos de conservación">
          <ul style={{ paddingLeft: '1.4rem', lineHeight: 1.8 }}>
            <li><strong>Datos de usuarios y clientes:</strong> durante la vigencia de la relación contractual y 5 años después de su terminación.</li>
            <li><strong>Registros de auditoría:</strong> 5 años desde la fecha del registro.</li>
            <li><strong>Mensajes y conversaciones:</strong> 2 años desde el cierre de la conversación.</li>
            <li><strong>Leads del autodiagnóstico:</strong> 12 meses desde la captación, o hasta que el titular solicite su supresión.</li>
          </ul>
        </Section>

        <Section title="11. Modificaciones a esta política">
          <p>
            Notificaremos cambios materiales a esta política con al menos 10 días hábiles de anticipación, a través
            del correo electrónico registrado o mediante aviso en nuestro sitio web.
          </p>
        </Section>

        <Section title="12. Vigencia">
          <p>Esta política rige a partir del <strong>1 de julio de 2026</strong>.</p>
        </Section>

        {/* Footer */}
        <div style={{
          marginTop: '3rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid rgba(39,2,5,0.15)',
          fontSize: '0.75rem',
          color: 'rgba(39,2,5,0.5)',
          lineHeight: 1.7,
        }}>
          <strong style={{ color: '#270205' }}>Juan Pablo Osorio Marín</strong> · CC 1.053.824.988 ·
          Marca comercial: <strong style={{ color: '#270205' }}>Owl Compliance</strong> ·
          Bogotá, Colombia ·{' '}
          <a href="mailto:contacto@owlcompliance.co" style={{ color: '#712529' }}>
            contacto@owlcompliance.co
          </a>
          <br />
          <em>Versión 1.0 — 1 de julio de 2026. Este documento no constituye asesoría legal.</em>
        </div>
      </div>
    </div>
  )
}

/* ── Componentes auxiliares ── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2 style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: '1rem',
        fontWeight: 700,
        color: '#270205',
        borderBottom: '2px solid #968622',
        paddingBottom: '0.4rem',
        marginBottom: '0.9rem',
      }}>
        {title}
      </h2>
      <div style={{ fontSize: '0.88rem', lineHeight: 1.8, color: '#270205' }}>
        {children}
      </div>
    </section>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: 'auto' as const }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse' as const,
        fontSize: '0.82rem',
        marginTop: '0.5rem',
      }}>
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} style={{
                background: '#270205',
                color: '#e7dfca',
                padding: '0.6rem 0.8rem',
                textAlign: 'left' as const,
                fontWeight: 700,
                fontSize: '0.75rem',
                letterSpacing: '0.04em',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#faf7f0' : 'white' }}>
              {row.map((cell, j) => (
                <td key={j} style={{
                  padding: '0.6rem 0.8rem',
                  borderBottom: '1px solid #e8e0d0',
                  verticalAlign: 'top' as const,
                }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
