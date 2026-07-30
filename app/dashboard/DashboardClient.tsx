'use client'
import Image from 'next/image'

const C = { vino: '#270205', olivo: '#968622', marfil: '#e7dfca' }

export default function DashboardClient({
  userName,
  userRole,
  isSuperadmin,
  suscripcion,
}: {
  userName:     string
  userRole:     string
  isSuperadmin?: boolean
  suscripcion?: any
}) {
  const isAdmin = userRole === 'admin'

  const cards = isSuperadmin ? [
    { titulo: 'Vista Global',     desc: 'Tickets y chats asignados a cada administrador',   href: '/dashboard/superadmin',  icono: '🔭' },
    { titulo: 'Chat',             desc: 'Conversaciones con clientes y administradores',     href: '/dashboard/chat',        icono: '💬' },
    { titulo: 'Tickets',          desc: 'Todos los tickets del sistema',                     href: '/dashboard/tickets',     icono: '🎫' },
    { titulo: 'Clientes',         desc: 'Ver y gestionar todos los clientes',                href: '/dashboard/clientes',    icono: '👥' },
    { titulo: 'Administradores',  desc: 'Gestionar perfiles de administrador',               href: '/dashboard/admins',      icono: '🛡️' },
    { titulo: 'Leads',            desc: 'Métricas de contactos web y atribución UTM',        href: '/dashboard/leads',       icono: '📊' },
    { titulo: 'Habeas Data',      desc: 'Consultar y suprimir datos personales (Ley 1581)', href: '/dashboard/habeas-data', icono: '🔐' },
    { titulo: 'Repositorio PQR',  desc: 'Normativa, plantillas de respuesta y guías por tipología de PQR', href: '/dashboard/pqr', icono: '📨' },
    { titulo: 'Proyectos Regulatorios', desc: 'Seguimiento y participación en proyectos de la CRC, el MinTIC y la SIC', href: '/dashboard/proyectos-regulatorios', icono: '🏛️' },
  ] : [
    ...(isAdmin ? [
      { titulo: 'Clientes',         desc: 'Ver y gestionar todos los clientes y su nivel de cumplimiento', href: '/dashboard/clientes',      icono: '👥' },
      { titulo: 'Recordatorios',    desc: 'Configurar y ejecutar alertas de vencimientos por email',       href: '/dashboard/recordatorios', icono: '🔔' },
      { titulo: 'Administradores',  desc: 'Gestionar perfiles con acceso total a la plataforma',           href: '/dashboard/admins',        icono: '🛡️' },
    ] : []),
    { titulo: 'Mapa de Cumplimiento', desc: 'Matriz de obligaciones regulatorias y estados de cumplimiento', href: '/dashboard/mapa',       icono: '📋' },
    { titulo: 'Calendario',           desc: 'Vencimientos del mes y próximos recordatorios',               href: '/dashboard/calendario', icono: '📅' },
    { titulo: 'Documentos',       desc: 'Acreditación de cumplimiento ante el Ministerio',          href: '/dashboard/documentos',      icono: '📁' },
    { titulo: 'Repositorio PQR',  desc: isAdmin ? 'Normativa, plantillas de respuesta y guías por tipología de PQR' : 'Consulta normativa, plantillas de respuesta y guías, y propón nuevas respuestas tipo', href: '/dashboard/pqr', icono: '📨' },
    { titulo: 'Proyectos Regulatorios', desc: isAdmin ? 'Gestionar proyectos regulatorios en trámite y ver clientes interesados' : 'Entérese de los proyectos regulatorios en trámite y participe en su nombre', href: '/dashboard/proyectos-regulatorios', icono: '🏛️' },
    ...(!isAdmin ? [{ titulo: 'Almacenamiento', desc: 'Conecta Google Drive, OneDrive o SharePoint para guardar tus documentos', href: '/dashboard/almacenamiento', icono: '☁️' }] : []),
    ...(isAdmin ? [{ titulo: 'Revisiones', desc: 'Revisar y aprobar documentos subidos por los clientes', href: '/dashboard/revisiones', icono: '🔍' }] : []),
    ...(isAdmin ? [{ titulo: 'Mensajería interna', desc: 'Canal general y mensajes directos entre administradores', href: '/dashboard/mensajeria', icono: '🗨️' }] : []),
    { titulo: 'Chat',    desc: isAdmin ? 'Conversaciones con clientes por tipo de obligación' : 'Conversaciones con tu equipo de cumplimiento', href: '/dashboard/chat',    icono: '💬' },
    { titulo: 'Tickets', desc: isAdmin ? 'Gestión de solicitudes y soporte regulatorio'       : 'Solicitudes de soporte y consultas regulatorias', href: '/dashboard/tickets', icono: '🎫' },
    ...(!isAdmin ? [{ titulo: 'Mi suscripción', desc: 'Consulta tu plan actual, uso del mes y opciones de upgrade', href: '/dashboard/suscripcion', icono: '📦' }] : []),
  ]

  return (
    <div style={{ minHeight: '100vh', background: C.vino, fontFamily: "'Josefin Sans', sans-serif", color: C.marfil }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      {/* Nav */}
      <nav style={{ background: 'rgba(39,2,5,0.97)', borderBottom: '1px solid rgba(150,134,34,0.2)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Image src="/logo.png" alt="Owl Compliance" width={160} height={57} style={{ objectFit: 'contain' }} priority />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'rgba(231,223,202,0.6)' }}>
            {userName} · {isAdmin ? 'Administrador' : 'Cliente'}
          </span>
          <a href="/dashboard/cambiar-password" style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.6)', textDecoration: 'none' }}>
            Cambiar contraseña
          </a>
          <a href="/signout" style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.olivo, textDecoration: 'none' }}>
            Salir
          </a>
        </div>
      </nav>

      {/* Contenido */}
      <main style={{ padding: '3rem 2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 700, marginBottom: '0.5rem' }}>
          Bienvenido, {userName.split(' ')[0]}
        </div>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.olivo, marginBottom: suscripcion ? '1.5rem' : '3rem' }}>
          Centro de Cumplimiento Regulatorio
        </div>

        {/* Banner de suscripción para clientes */}
        {suscripcion && !isAdmin && (
          <SuscripcionBanner suscripcion={suscripcion} />
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
          {cards.map(card => (
            <NavCard key={card.href} {...card} />
          ))}
        </div>
      </main>
    </div>
  )
}

function SuscripcionBanner({ suscripcion }: { suscripcion: any }) {
  const { planLabel, estado, tickets, chats } = suscripcion
  if (!planLabel) return null

  const ticketsPct = tickets.limite ? Math.round((tickets.usado / tickets.limite) * 100) : 0
  const chatsPct   = chats.limite   ? Math.round((chats.usado   / chats.limite)   * 100) : 0
  const alerta     = ticketsPct >= 80 || chatsPct >= 80

  return (
    <div style={{
      background: alerta ? 'rgba(245,158,11,0.08)' : 'rgba(231,223,202,0.04)',
      border: `1px solid ${alerta ? 'rgba(245,158,11,0.3)' : 'rgba(150,134,34,0.2)'}`,
      borderRadius: '10px', padding: '1rem 1.4rem', marginBottom: '2rem',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(231,223,202,0.4)' }}>Plan </span>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: C.olivo }}>{planLabel}</span>
        </div>
        <MiniBar label="Tickets" usado={tickets.usado} limite={tickets.limite} />
        <MiniBar label="Chats"   usado={chats.usado}   limite={chats.limite}   />
      </div>
      <a href="/dashboard/suscripcion" style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.olivo, textDecoration: 'none', border: '1px solid rgba(150,134,34,0.35)', padding: '0.35rem 0.85rem', borderRadius: '6px' }}>
        Ver plan
      </a>
    </div>
  )
}

function MiniBar({ label, usado, limite }: { label: string; usado: number; limite: number | null }) {
  if (!limite) return null
  const pct   = Math.min(100, Math.round((usado / limite) * 100))
  const color = pct >= 100 ? '#dc2626' : pct >= 80 ? '#f59e0b' : '#16a34a'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.68rem', color: 'rgba(231,223,202,0.5)' }}>{label}:</span>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, color }}>{usado}/{limite}</span>
      <div style={{ width: '48px', height: '4px', background: 'rgba(231,223,202,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px' }} />
      </div>
    </div>
  )
}

function NavCard({ titulo, desc, href, icono }: { titulo: string; desc: string; href: string; icono: string }) {
  return (
    <a href={href} style={{ textDecoration: 'none' }}>
      <div
        style={{ background: 'rgba(231,223,202,0.06)', border: '1px solid rgba(150,134,34,0.25)', borderRadius: '12px', padding: '1.8rem', cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s' }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLDivElement
          el.style.background = 'rgba(231,223,202,0.1)'
          el.style.borderColor = 'rgba(150,134,34,0.5)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLDivElement
          el.style.background = 'rgba(231,223,202,0.06)'
          el.style.borderColor = 'rgba(150,134,34,0.25)'
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>{icono}</div>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#968622', marginBottom: '0.5rem' }}>
          {titulo}
        </div>
        <div style={{ fontSize: '0.85rem', fontWeight: 300, color: 'rgba(231,223,202,0.7)', lineHeight: 1.6 }}>
          {desc}
        </div>
      </div>
    </a>
  )
}
