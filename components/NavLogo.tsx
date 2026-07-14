import Image from 'next/image'

/**
 * Logo de Owl Compliance para barras de navegación.
 * Reemplaza el texto "Owl Compliance" en todos los navs del dashboard.
 */
export default function NavLogo({ href = '/dashboard' }: { href?: string }) {
  return (
    <a href={href} style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
      <Image src="/logo.png" alt="Owl Compliance" width={130} height={46} style={{ objectFit: 'contain' }} priority />
    </a>
  )
}
