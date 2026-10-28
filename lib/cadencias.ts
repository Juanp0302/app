/**
 * lib/cadencias.ts
 * Secuencias de seguimiento (cadencias) para la base del webinar "Que el MinTIC no sancione tu ISP"
 * (21 oct 2026, con Inerxia AI y Nicolás Almeyda). Cada lead importado del webinar arranca una cadencia
 * según si asistió o no; el vendedor marca cada paso como enviado y el sistema programa el siguiente
 * en días hábiles. Si responde, la cadencia se detiene y pasa a agendar la reunión.
 *
 * Convención de Owl (ver scripts/aplicar-estrategia-comunidad.mjs): WhatsApp en "tú", llamadas en "usted",
 * quien llama se presenta como abogado(a) de Owl Compliance.
 */
import { ENLACES } from './pipeline'

export const WEBINAR = {
  titulo: '“Que el MinTIC no sancione tu ISP”',
  ponente: 'Nicolás Almeyda',
}

export type CadenciaId = 'webinar-asistente' | 'webinar-inscrito'
export type EstadoCadencia = 'activa' | 'respondio' | 'terminada'

export interface DatosLead {
  nombre?: string | null
  empresa?: string | null
  minutos_webinar?: number | null
}

export interface PasoCadencia {
  /** Días hábiles desde el paso anterior. */
  esperaDias: number
  canal: 'whatsapp' | 'llamada'
  titulo: string
  texto: (d: { n: string | null; yo: string; empresa: string; minutos: number }) => string
}

const cita = '¿Te sirve el [DÍA 1, HORA] o el [DÍA 2, HORA]?'
const citaUsted = '¿Le sirve el [DÍA 1, HORA] o el [DÍA 2, HORA]?'

/** Pasos compartidos al final de las dos cadencias. */
const autodiagnostico: PasoCadencia = {
  esperaDias: 3, canal: 'whatsapp', titulo: 'WhatsApp · autodiagnóstico',
  texto: ({ n }) => `${n ? `${n}, s` : 'S'}i ahora no tienes tiempo para una reunión, te dejo el autodiagnóstico gratuito: ` +
    `son 5 minutos y te da tu porcentaje de cumplimiento preliminar.\n\n${ENLACES.autodiagnostico}\n\n` +
    'Cuando lo tengas, lo revisamos juntos.',
}
const cierre: PasoCadencia = {
  esperaDias: 4, canal: 'whatsapp', titulo: 'WhatsApp · cierre amable',
  texto: ({ n }) => `${n ? `${n}, n` : 'N'}o te quiero llenar el WhatsApp. ¿Lo dejamos para más adelante o te guardo un espacio esta semana? ` +
    'Con un "más adelante" me basta.',
}

export const CADENCIAS: Record<CadenciaId, { nombre: string; pasos: PasoCadencia[] }> = {
  'webinar-asistente': {
    nombre: 'Webinar · asistió',
    pasos: [
      {
        esperaDias: 0, canal: 'whatsapp', titulo: 'WhatsApp 1 · gracias y una pregunta',
        texto: ({ n, yo, empresa, minutos }) => minutos > 0 && minutos < 30
          ? `¡Hola${n ? `, ${n}` : ''}! 👋 Soy ${yo}, de Owl Compliance. Gracias por conectarte al webinar ${WEBINAR.titulo}; ` +
            'sé que a esa hora no siempre se puede quedar hasta el final.\n\n' +
            `¿Qué te llevó a inscribirte? ¿Algún requerimiento, los reportes o las visitas del MinTIC en ${empresa}?`
          : `¡Hola${n ? `, ${n}` : ''}! 👋 Soy ${yo}, de Owl Compliance. Gracias por acompañarnos en el webinar ${WEBINAR.titulo} con ${WEBINAR.ponente}.\n\n` +
            `Te quería hacer una pregunta: de lo que se habló, ¿qué es lo que más te preocupa hoy en ${empresa}?`,
      },
      {
        esperaDias: 1, canal: 'llamada', titulo: 'Llamada · si no respondió',
        texto: ({ n, yo, empresa }) =>
          `1. "${n ? `${n}, le` : 'Le'} habla ${yo}, abogado(a) de Owl Compliance. ¿Tiene un minuto?"\n` +
          `2. "Lo llamo porque usted estuvo en el webinar ${WEBINAR.titulo} y le escribí por WhatsApp. ¿Alcanzó a verlo?"\n` +
          `3. "¿Qué tan tranquilo está con los reportes y las visitas del MinTIC este año en ${empresa}?"\n` +
          `4. "Le propongo 20 minutos: revisamos qué obligaciones le aplican y cuáles tiene en riesgo. ${citaUsted}"\n` +
          'Si pide "envíeme información": "Con gusto. Para enviarle lo que le sirve, ¿puedo hacerle dos preguntas?" y volver al 3.',
      },
      {
        esperaDias: 2, canal: 'whatsapp', titulo: 'WhatsApp 2 · propuesta de reunión',
        texto: ({ n, empresa }) =>
          `${n ? `${n}, t` : 'T'}e propongo algo concreto: 20 minutos para revisar qué obligaciones le aplican a ${empresa} ` +
          `y cuáles tienes en riesgo de sanción, aterrizando lo que vimos en el webinar. ${cita}`,
      },
      autodiagnostico,
      cierre,
    ],
  },
  'webinar-inscrito': {
    nombre: 'Webinar · inscrito, no asistió',
    pasos: [
      {
        esperaDias: 0, canal: 'whatsapp', titulo: 'WhatsApp 1 · no alcanzó a conectarse',
        texto: ({ n, yo, empresa }) =>
          `¡Hola${n ? `, ${n}` : ''}! 👋 Soy ${yo}, de Owl Compliance. Te inscribiste al webinar ${WEBINAR.titulo} y vi que no alcanzaste a conectarte.\n\n` +
          `Si te sirve, te cuento en 20 minutos lo más importante, aplicado a ${empresa}. ${cita}`,
      },
      autodiagnostico,
      cierre,
    ],
  },
}

/** Paso que toca hacer (índice `paso_cadencia`, empieza en 0), o null si ya no hay más. */
export function pasoActual(l: { cadencia?: string | null; paso_cadencia?: number | null; cadencia_estado?: string | null }) {
  const c = l.cadencia ? CADENCIAS[l.cadencia as CadenciaId] : null
  if (!c || l.cadencia_estado !== 'activa') return null
  const i = Number(l.paso_cadencia ?? 0)
  return i < c.pasos.length ? { indice: i, total: c.pasos.length, paso: c.pasos[i] } : null
}

const primerNombre = (nombre?: string | null) => {
  const t = (nombre ?? '').trim().split(/\s+/)[0] ?? ''
  if (t.length < 3 || /[\d.@]/.test(t)) return null
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
}

/** Texto del paso, ya llenado con los datos del lead. */
export function textoDelPaso(paso: PasoCadencia, l: DatosLead, vendedor?: string | null) {
  return paso.texto({
    n: primerNombre(l.nombre),
    yo: vendedor || '[SU NOMBRE]',
    empresa: l.empresa?.trim() && !/^(na|n\/a|x|nn|\.)$/i.test(l.empresa.trim()) ? l.empresa.trim() : 'tu ISP',
    minutos: Number(l.minutos_webinar ?? 0),
  })
}

// ── Días hábiles (Colombia) ───────────────────────────────────────────────────

/** Festivos de Colombia que caen mientras corre esta campaña. Agregar los del año siguiente cuando haga falta. */
export const FESTIVOS = new Set([
  '2026-11-02', '2026-11-16', '2026-12-08', '2026-12-25', '2027-01-01', '2027-01-11',
])

/** Suma `n` días hábiles (sin sábados, domingos ni festivos) a una fecha AAAA-MM-DD. Con n = 0 devuelve el mismo día si es hábil, o el siguiente hábil. */
export function sumarDiasHabiles(fecha: string, n: number): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  const esHabil = () => d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !FESTIVOS.has(d.toISOString().slice(0, 10))
  while (!esHabil()) d.setUTCDate(d.getUTCDate() + 1)
  for (let i = 0; i < n; i++) {
    d.setUTCDate(d.getUTCDate() + 1)
    while (!esHabil()) d.setUTCDate(d.getUTCDate() + 1)
  }
  return d.toISOString().slice(0, 10)
}
