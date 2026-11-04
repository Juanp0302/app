/**
 * lib/ventas.ts
 * Utilidades compartidas por Prospectos, las cadencias y los leads. Sin acceso a BD.
 */

/** Enlaces que van en los mensajes de venta. */
export const ENLACES = {
  autodiagnostico: 'https://www.owlcompliance.com/autodiagnostico',
  /** Calendario público de Owl: la persona elige su horario (los espacios son de 30 min; en los mensajes se habla de 15). */
  calendario: 'https://calendar.app.google/3rizAH6m6afFaFkJ8',
}

/** Duración que se menciona en todos los mensajes. */
export const MINUTOS_REUNION = 15

export const soloDigitos = (s?: string | null) => (s ?? '').replace(/\D/g, '')

/** Fecha de hoy (AAAA-MM-DD) en Bogotá: desde las 7 p.m. la fecha UTC ya es mañana. */
export const hoyBogota = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d)
