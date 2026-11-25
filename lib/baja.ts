/**
 * lib/baja.ts
 * Enlace de baja firmado de los correos de venta: /baja?p=<prospecto>&t=<firma>. La firma evita que alguien dé de baja
 * a otro cambiando el id. Sin acceso a BD.
 */
import crypto from 'crypto'

const secreto = () => process.env.INTERNAL_SECRET || process.env.NEXTAUTH_SECRET || 'desarrollo'

export const URL_APP = () => (process.env.NEXTAUTH_URL || 'https://app.owlcompliance.com').replace(/\/$/, '')

export function firmaBaja(prospectoId: string): string {
  return crypto.createHmac('sha256', secreto()).update(`baja:${prospectoId}`).digest('base64url').slice(0, 24)
}

export function firmaBajaValida(prospectoId: string, firma: string): boolean {
  const esperada = Buffer.from(firmaBaja(prospectoId))
  const dada = Buffer.from(String(firma ?? ''))
  return dada.length === esperada.length && crypto.timingSafeEqual(dada, esperada)
}

/** Página donde la persona confirma la baja (un clic de un filtro de correo no la da de baja: hace falta el botón). */
export const enlaceBaja = (prospectoId: string) =>
  `${URL_APP()}/baja?p=${encodeURIComponent(prospectoId)}&t=${firmaBaja(prospectoId)}`

/** Para la cabecera List-Unsubscribe: baja en un clic desde Gmail u Outlook (RFC 8058, por POST). */
export const enlaceBajaDirecta = (prospectoId: string) =>
  `${URL_APP()}/api/baja?p=${encodeURIComponent(prospectoId)}&t=${firmaBaja(prospectoId)}`
