/**
 * lib/pipeline.ts
 * Sistema de ventas de OWL (ver docs/playbook-ventas.md): etapas, requisitos de avance,
 * calificación Dolor / Presupuesto / Decisión y temperatura del lead. Sin acceso a BD.
 */

/** Enlaces que van en los mensajes de venta. */
export const ENLACES = {
  autodiagnostico: 'https://www.owlcompliance.com/autodiagnostico',
}

export const ETAPAS = [
  'nuevo', 'contactado', 'reunion_agendada', 'reunion_realizada', 'propuesta', 'ganado', 'perdido',
] as const
export type Etapa = typeof ETAPAS[number]

export const ETAPA_LABEL: Record<Etapa, string> = {
  nuevo:             'Nuevo',
  contactado:        'Contactado',
  reunion_agendada:  'Reunión agendada',
  reunion_realizada: 'Reunión realizada',
  propuesta:         'Propuesta',
  ganado:            'Ganado',
  perdido:           'Perdido',
}

export const ETAPA_COLOR: Record<Etapa, string> = {
  nuevo: '#64748b', contactado: '#0ea5e9', reunion_agendada: '#8b5cf6',
  reunion_realizada: '#d97706', propuesta: '#968622', ganado: '#16a34a', perdido: '#dc2626',
}

/** Etapas del tablero (perdido se muestra aparte). */
export const ETAPAS_ACTIVAS: Etapa[] = ['nuevo', 'contactado', 'reunion_agendada', 'reunion_realizada', 'propuesta', 'ganado']

export const PLANES = ['basica', 'pro', 'premium', 'diagnostico'] as const
export type Plan = typeof PLANES[number]
export const PLAN_LABEL: Record<Plan, string> = {
  basica: 'Básica ($199.000/mes)', pro: 'Pro ($890.000/mes)', premium: 'Premium ($2.490.000/mes)',
  diagnostico: 'Diagnóstico ($4.500.000)',
}

/** Cada criterio de calificación vale 0 (sin info), 1 (parcial) o 2 (confirmado en reunión). */
export interface Calificacion { q_dolor: number; q_presupuesto: number; q_decision: number }

export const CRITERIOS = [
  { campo: 'q_dolor' as const,       nombre: 'Dolor',
    pista: '¿Multa, requerimiento o reporte vencido? ¿Qué le cuesta hoy?' },
  { campo: 'q_presupuesto' as const, nombre: 'Presupuesto',
    pista: '¿Puede y quiere pagar un plan mensual? ¿Cuál encaja?' },
  { campo: 'q_decision' as const,    nombre: 'Decisión',
    pista: '¿Habló con el dueño o gerente que firma?' },
]

export const puntaje = (c: Partial<Calificacion>) =>
  (c.q_dolor ?? 0) + (c.q_presupuesto ?? 0) + (c.q_decision ?? 0)

/** Dolor y decisión confirmados y presupuesto al menos parcial: ya se puede enviar propuesta. */
export const estaCalificado = (c: Partial<Calificacion>) =>
  (c.q_dolor ?? 0) >= 2 && (c.q_decision ?? 0) >= 2 && (c.q_presupuesto ?? 0) >= 1

/**
 * Requisitos para entrar a una etapa. Devuelve el motivo por el que NO puede avanzar, o null.
 * `datos` es el lead con los cambios ya aplicados.
 */
export function bloqueoDeAvance(destino: Etapa, l: {
  proxima_fecha?: string | null; plan_objetivo?: string | null; motivo_descarte?: string | null
} & Partial<Calificacion>): string | null {
  switch (destino) {
    case 'reunion_agendada':
      return l.proxima_fecha ? null : 'Para marcar la reunión agendada indica la fecha en "Próxima acción".'
    case 'reunion_realizada':
      return (l.q_dolor ?? 0) >= 1 ? null : 'Tras la reunión registra al menos el Dolor que encontraste.'
    case 'propuesta':
      if (!estaCalificado(l)) return 'Para enviar propuesta: Dolor y Decisión confirmados (2) y Presupuesto al menos parcial (1).'
      return l.plan_objetivo ? null : 'Elige el plan objetivo antes de enviar la propuesta.'
    case 'perdido':
      return (l.motivo_descarte ?? '').trim() ? null : 'Anota el motivo: un "no" temprano también sirve.'
    default:
      return null
  }
}

/** Temperatura: 1 = más caliente. Webinar asistente > inscrito > pidió algo (autodiagnóstico/contacto) > frío. */
export type Temperatura = 1 | 2 | 3 | 4
export const TEMPERATURA_LABEL: Record<Temperatura, string> = {
  1: 'Asistió al webinar', 2: 'Inscrito al webinar', 3: 'Pidió contacto / autodiagnóstico', 4: 'Frío',
}
export const TEMPERATURA_COLOR: Record<Temperatura, string> = { 1: '#dc2626', 2: '#ea580c', 3: '#d97706', 4: '#64748b' }

/** Usa lo agregado de todos los formularios del lead (`origenes`, `asistio_max`) cuando viene del pipeline. */
export function temperaturaDe(l: {
  origen?: string | null; origenes?: string | null; asistio_webinar?: number | null; asistio_max?: number | null
}): Temperatura {
  if (Number(l.asistio_max ?? l.asistio_webinar ?? 0)) return 1
  const origenes = (l.origenes ?? l.origen ?? 'contacto').split(',')
  if (origenes.includes('webinar')) return 2
  if (origenes.some(o => o === 'autodiagnostico' || o === 'contacto')) return 3
  return 4
}

/** Fecha de hoy (AAAA-MM-DD) en Bogotá: desde las 7 p.m. la fecha UTC ya es mañana. */
export const hoyBogota = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d)

export const normalizar = (s?: string | null) =>
  (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(s\.?a\.?s\.?|ltda\.?|s\.?a\.?|e\.?u\.?)\b/g, '').replace(/[^a-z0-9]/g, '')

export const soloDigitos = (s?: string | null) => (s ?? '').replace(/\D/g, '')

/** Recetario: cuántos contactos hacen falta por reunión según la conversión que se vaya midiendo. */
export function recetario(reunionesPorSemana: number, tasaContactoReunion = 0.1) {
  const contactos = Math.ceil(reunionesPorSemana / Math.max(tasaContactoReunion, 0.01))
  return { contactosSemana: contactos, contactosDia: Math.ceil(contactos / 5) }
}
