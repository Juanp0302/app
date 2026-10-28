/**
 * lib/temperatura.ts
 * Temperatura de cada prospecto (Caliente / Tibio / Frío, más Cliente y Descartado), calculada sola a
 * partir de de dónde viene, su prioridad, su estado y cuántos días lleva quieto. Sube cuando responde
 * o asistió al webinar y se enfría sola si pasan días sin respuesta. Sin acceso a BD.
 */

export type NivelTemperatura = 'caliente' | 'tibio' | 'frio' | 'cliente' | 'descartado'

export const TEMPERATURA: Record<NivelTemperatura, { label: string; emoji: string; color: string; orden: number }> = {
  caliente:   { label: 'Caliente',   emoji: '🔥', color: '#dc2626', orden: 0 },
  tibio:      { label: 'Tibio',      emoji: '🌤', color: '#d97706', orden: 1 },
  frio:       { label: 'Frío',       emoji: '❄', color: '#0284c7', orden: 2 },
  cliente:    { label: 'Cliente',    emoji: '✓', color: '#16a34a', orden: 3 },
  descartado: { label: 'Descartado', emoji: '—', color: '#6b7280', orden: 4 },
}

export const UMBRAL_CALIENTE = 55
export const UMBRAL_TIBIO = 25

export interface DatosTemperatura {
  estado?: string | null
  prioridad?: string | null
  en_webinar?: number | null
  webinar_asistio?: number | null
  webinar_minutos?: number | null
  cadencia_estado?: string | null
  /** Fecha (ISO o AAAA-MM-DD) del último cambio de estado; si no hay, cuándo se creó. */
  ultimo_cambio?: string | null
  created_at?: string | null
}

const diasEntre = (desde: string, hasta: string) =>
  Math.floor((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde.slice(0, 10)}T12:00:00Z`)) / 86400_000)

export function temperaturaProspecto(p: DatosTemperatura, hoy: string): { nivel: NivelTemperatura; puntos: number; razones: string[] } {
  const estado = p.estado ?? 'Pendiente'
  if (estado === 'Cliente') return { nivel: 'cliente', puntos: 100, razones: ['Ya es cliente'] }
  if (estado === 'No interesado' || estado === 'No contactar') return { nivel: 'descartado', puntos: 0, razones: [estado] }

  let puntos = 0
  const razones: string[] = []
  const suma = (n: number, razon: string) => { puntos += n; razones.push(razon) }

  const minutos = Number(p.webinar_minutos ?? 0)
  if (Number(p.webinar_asistio)) {
    suma(45, `Asistió al webinar${minutos ? ` ${minutos} min` : ''}`)
    if (minutos >= 60) puntos += 15
  } else if (Number(p.en_webinar)) {
    suma(25, 'Se inscribió al webinar')
  }
  if (p.prioridad === 'A') suma(15, 'Investigación en marcha')
  else if (p.prioridad === 'B') suma(10, 'Multa impuesta')

  if (estado === 'Respondió') suma(30, 'Respondió')
  else if (estado === 'Conversación') suma(40, 'En conversación')
  else if (estado === 'Reunión agendada') suma(60, 'Reunión agendada')
  else if (estado === 'Propuesta enviada') suma(60, 'Propuesta enviada')

  const desde = p.ultimo_cambio ?? p.created_at
  const dias = desde ? diasEntre(desde, hoy) : 0
  if (estado === 'WA1 enviado' || estado === 'Llamada sin contacto') {
    if (dias >= 14) suma(-20, `Sin respuesta hace ${dias} días`)
    else if (dias >= 7) suma(-10, `Sin respuesta hace ${dias} días`)
  } else if ((estado === 'Respondió' || estado === 'Conversación') && dias >= 10) {
    suma(-20, `Conversación quieta hace ${dias} días`)
  }
  if (p.cadencia_estado === 'terminada') suma(-20, 'Terminó la cadencia sin respuesta')

  if (!razones.length) razones.push('Cold mailing, sin respuesta todavía')
  const nivel: NivelTemperatura = puntos >= UMBRAL_CALIENTE ? 'caliente' : puntos >= UMBRAL_TIBIO ? 'tibio' : 'frio'
  return { nivel, puntos, razones }
}
