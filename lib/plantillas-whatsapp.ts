/**
 * lib/plantillas-whatsapp.ts
 * Plantillas de WhatsApp (Meta exige plantillas aprobadas para escribirle primero a alguien o fuera de las 24 h).
 * Se usan en la cadencia automática por WhatsApp de los inscritos al webinar y en el seguimiento después de la reunión.
 * Los textos salen de los mensajes aprobados de lib/cadencias.ts, sin firma personal (los envía el número de Owl).
 * Textos aprobados por el superadmin el 2026-11-26: cualquier cambio se vuelve a aprobar (y Meta lo vuelve a revisar).
 * Cada plantilla de marketing entregada cuesta (~US$0,0125 en Colombia desde octubre de 2026).
 * Sin acceso a BD.
 */
import crypto from 'crypto'
import { CADENCIAS, type CadenciaId, type DatosLead } from './cadencias'
import { nombreParaSaludar, isPara } from './radiografia'
import { ENLACES, MINUTOS_REUNION } from './ventas'
import { URL_APP } from './baja'

const CAL = ENLACES.calendario
const MIN = MINUTOS_REUNION
/** Pie de todas las de marketing: la salida fácil que pide Meta. Responder "BAJA" da de baja (lib/whatsapp-ventas.ts). */
export const PIE_BAJA = 'Si no quieres recibir más mensajes, responde BAJA.'

export interface DefinicionPlantilla {
  nombre: string
  categoria: 'MARKETING' | 'UTILITY'
  titulo: string
  /** Cuerpo con {{1}}, {{2}}… */
  cuerpo: string
  ejemplos: string[]
  pie?: string
  /** Botón con enlace variable: la URL base termina en {{1}}. */
  boton?: { texto: string; url: string; ejemplo: string }
}

/** Frases del webinar. Empiezan por "Te escribimos desde el WhatsApp de Owl": sirven igual si alguien del equipo ya le
 *  había escrito desde su celular (en la app no quedó registrado a quién). Aprobadas por el superadmin el 2026-11-26. */
const WEBINAR_ASISTIO = 'Te escribimos desde el WhatsApp de Owl Compliance. Hace un mes nos vimos en el webinar del 21 de octubre, “Que el MinTIC no sancione tu ISP”, con Nicolás Almeyda: gracias por acompañarnos.'
const WEBINAR_INSCRITO = 'Te escribimos desde el WhatsApp de Owl Compliance. Te inscribiste al webinar del 21 de octubre, “Que el MinTIC no sancione tu ISP”, con Nicolás Almeyda, y vimos que no alcanzaste a conectarte.'
const RADIOGRAFIA = 'una radiografía regulatoria de una página: en dos minutos verás lo que hoy ve el MinTIC de tu empresa, tus pagos regulatorios y tus próximos vencimientos. Te recomendamos mirar {{3}}.'
const REVISAR_RADIOGRAFIA = `Si te parece, la revisamos en una videollamada de ${MIN} minutos y hacemos juntos el autodiagnóstico de cumplimiento. Elige el horario que te quede mejor: ${CAL}`
const BOTON_RADIOGRAFIA = { texto: 'Ver la radiografía', url: 'https://app.owlcompliance.com/r/{{1}}', ejemplo: 'https://app.owlcompliance.com/r/ejemplo.firma' }
const EJEMPLO_PUNTO = 'el punto 2: el reporte T.1.1 de suscriptores, que vence el 15 de enero'

export const PLANTILLAS: DefinicionPlantilla[] = [
  {
    nombre: 'owl_webinar_asistio_radiografia', categoria: 'MARKETING', titulo: 'Webinar · asistió · primer contacto con la radiografía',
    cuerpo: `Hola, {{1}}. ${WEBINAR_ASISTIO}\n\nDespués del webinar preparamos para {{2}} ${RADIOGRAFIA}\n\n${REVISAR_RADIOGRAFIA}`,
    ejemplos: ['Andrés', 'Conexiones del Llano SAS', EJEMPLO_PUNTO], pie: PIE_BAJA, boton: BOTON_RADIOGRAFIA,
  },
  {
    nombre: 'owl_webinar_inscrito_radiografia', categoria: 'MARKETING', titulo: 'Webinar · inscrito · primer contacto con la radiografía',
    cuerpo: `Hola, {{1}}. ${WEBINAR_INSCRITO}\n\nPreparamos para {{2}} ${RADIOGRAFIA}\n\n${REVISAR_RADIOGRAFIA}`,
    ejemplos: ['Andrés', 'Conexiones del Llano SAS', EJEMPLO_PUNTO], pie: PIE_BAJA, boton: BOTON_RADIOGRAFIA,
  },
  {
    nombre: 'owl_webinar_asistio', categoria: 'MARKETING', titulo: 'Webinar · asistió · primer contacto (sin radiografía)',
    cuerpo: `Hola, {{1}}. ${WEBINAR_ASISTIO}\n\nNos gustaría aterrizar lo que se habló al caso de {{2}}: en una videollamada de ${MIN} minutos revisamos qué obligaciones le aplican y cuáles están en riesgo de sanción. ` +
      `Elige el horario que te quede mejor: ${CAL}\n\nConoce nuestros servicios: ${ENLACES.servicios}`,
    ejemplos: ['Andrés', 'Conexiones del Llano SAS'], pie: PIE_BAJA,
  },
  {
    nombre: 'owl_webinar_inscrito', categoria: 'MARKETING', titulo: 'Webinar · inscrito · primer contacto (sin radiografía)',
    cuerpo: `Hola, {{1}}. ${WEBINAR_INSCRITO}\n\nSi te sirve, te contamos en ${MIN} minutos lo más importante, aplicado a {{2}}. Elige el horario que te quede mejor: ${CAL}\n\n` +
      `Conoce nuestros servicios: ${ENLACES.servicios}`,
    ejemplos: ['Andrés', 'Conexiones del Llano SAS'], pie: PIE_BAJA,
  },
  {
    nombre: 'owl_propuesta_webinar', categoria: 'MARKETING', titulo: 'Webinar · asistió · propuesta de reunión',
    cuerpo: `Hola, {{1}}. Te proponemos algo concreto: ${MIN} minutos para revisar qué obligaciones aplican a {{2}} y cuáles están en riesgo de sanción, ` +
      `aterrizando lo que vimos en el webinar. Elige el horario que mejor te quede: ${CAL}`,
    ejemplos: ['Andrés', 'Conexiones del Llano SAS'], pie: PIE_BAJA,
  },
  {
    nombre: 'owl_radiografia', categoria: 'MARKETING', titulo: 'Primer contacto con la radiografía',
    cuerpo: 'Hola, {{1}}. Te escribimos de Owl Compliance. Preparamos para {{2}} una radiografía regulatoria de una página: en dos minutos ' +
      'verás lo que hoy ve el MinTIC de tu empresa, tus pagos regulatorios y tus próximos vencimientos. Te recomendamos mirar {{3}}.\n\n' +
      `Si te parece, la revisamos en una videollamada de ${MIN} minutos y hacemos juntos el autodiagnóstico de cumplimiento. Elige el horario que te quede mejor: ${CAL}`,
    ejemplos: ['Andrés', 'Conexiones del Llano SAS', 'el punto 2: el reporte T.1.1 de suscriptores, que vence el 15 de enero'], pie: PIE_BAJA,
    boton: { texto: 'Ver la radiografía', url: 'https://app.owlcompliance.com/r/{{1}}', ejemplo: 'https://app.owlcompliance.com/r/ejemplo.firma' },
  },
  {
    nombre: 'owl_propuesta_reunion', categoria: 'MARKETING', titulo: 'Propuesta de reunión',
    cuerpo: `Hola, {{1}}. Te proponemos algo concreto: ${MIN} minutos para revisar qué obligaciones aplican a {{2}} y cuáles están en riesgo de sanción. ` +
      `Elige el horario que mejor te quede: ${CAL}`,
    ejemplos: ['Andrés', 'Conexiones del Llano SAS'], pie: PIE_BAJA,
  },
  {
    nombre: 'owl_autodiagnostico', categoria: 'MARKETING', titulo: 'Autodiagnóstico gratuito',
    cuerpo: 'Hola, {{1}}. Si ahora no tienes tiempo para una videollamada, te dejamos el autodiagnóstico gratuito: son 5 minutos y te da tu porcentaje de cumplimiento preliminar.\n\n' +
      `${ENLACES.autodiagnostico}\n\nCuando lo tengas, lo revisamos juntos en ${MIN} minutos: ${CAL}`,
    ejemplos: ['Andrés'], pie: PIE_BAJA,
  },
  {
    nombre: 'owl_cierre', categoria: 'MARKETING', titulo: 'Cierre amable',
    cuerpo: `Hola, {{1}}. No te queremos llenar el WhatsApp. ¿Lo dejamos para más adelante o prefieres elegir un horario ahora? ${CAL}\n\nCon un “más adelante” nos basta.`,
    ejemplos: ['Andrés'], pie: PIE_BAJA,
  },
  {
    nombre: 'owl_seguimiento_propuesta', categoria: 'MARKETING', titulo: 'Después de la reunión · ¿revisó la propuesta?',
    cuerpo: `Hola, {{1}}. ¿Pudiste revisar la propuesta que te enviamos para {{2}}? Si tienes alguna duda, la resolvemos en ${MIN} minutos. Elige el horario que te quede mejor: ${CAL}`,
    ejemplos: ['Andrés', 'Conexiones del Llano SAS'], pie: PIE_BAJA,
  },
  {
    nombre: 'owl_recordatorio_propuesta', categoria: 'MARKETING', titulo: 'Después de la reunión · recordatorio',
    cuerpo: `Hola, {{1}}. Te escribimos de nuevo por la propuesta para {{2}}. ¿Quieres que la revisemos juntos? Son ${MIN} minutos y eliges el horario aquí: ${CAL}`,
    ejemplos: ['Andrés', 'Conexiones del Llano SAS'], pie: PIE_BAJA,
  },
  {
    nombre: 'owl_resumen_reunion', categoria: 'UTILITY', titulo: 'Resumen de la reunión',
    cuerpo: 'Hola, {{1}}. Gracias por tu tiempo en la reunión con Owl Compliance. Para dejarlo por escrito: {{2}}\n\nCualquier duda, escríbenos por aquí.',
    ejemplos: ['Andrés', 'revisamos los reportes de 2026 y quedamos en enviarte la propuesta de la suscripción Pro el viernes.'],
  },
]

export const plantillaPorNombre = (nombre: string) => PLANTILLAS.find(p => p.nombre === nombre)

/** Meta no acepta saltos de línea, tabuladores ni más de 4 espacios seguidos dentro de una variable. */
export const limpiarVariable = (s: string) => s.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, 900)

/** El texto como lo verá la persona (para la ficha, el historial y la simulación). */
export function textoDePlantilla(nombre: string, parametros: string[]): string {
  const d = plantillaPorNombre(nombre)
  if (!d) return ''
  const cuerpo = d.cuerpo.replace(/\{\{(\d+)\}\}/g, (_, i) => parametros[Number(i) - 1] ?? '')
  return d.pie ? `${cuerpo}\n\n${d.pie}` : cuerpo
}

// ── Enlace público a la radiografía (botón de la plantilla owl_radiografia) ─────────────────────────────────

const secreto = () => process.env.INTERNAL_SECRET || process.env.NEXTAUTH_SECRET || 'desarrollo'
export const firmaRadiografia = (prospectoId: string) =>
  crypto.createHmac('sha256', secreto()).update(`radiografia:${prospectoId}`).digest('base64url').slice(0, 22)
/** Lo que va al final de https://app.owlcompliance.com/r/… */
export const tokenRadiografia = (prospectoId: string) => `${prospectoId}.${firmaRadiografia(prospectoId)}`
export function prospectoDelToken(token: string): string | null {
  const i = token.lastIndexOf('.')
  if (i <= 0) return null
  const id = token.slice(0, i), firma = Buffer.from(token.slice(i + 1)), esperada = Buffer.from(firmaRadiografia(id))
  return firma.length === esperada.length && crypto.timingSafeEqual(firma, esperada) ? id : null
}
export const enlaceRadiografia = (prospectoId: string) => `${URL_APP()}/r/${tokenRadiografia(prospectoId)}`

// ── Qué plantilla le toca a cada paso de cadencia ───────────────────────────────────────────────────────────

export interface EnvioPlantilla {
  nombre: string
  parametros: string[]
  /** Lo que va en el {{1}} del botón, si la plantilla tiene botón. */
  boton?: string
}

/**
 * La plantilla del paso `indice` de la cadencia, o null si ese paso no se hace por plantilla (la llamada, las respuestas a
 * quien escribió por la web, o el primer contacto de quien no viene del webinar ni tiene radiografía).
 */
export function plantillaDelPaso(cadencia: CadenciaId, indice: number, d: DatosLead, prospectoId: string): EnvioPlantilla | null {
  const paso = CADENCIAS[cadencia]?.pasos[indice]
  if (!paso) return null
  const nombre = limpiarVariable(nombreParaSaludar(d.nombre) ?? '') || 'equipo'
  const empresa = limpiarVariable(isPara(d.empresa))
  const asistio = cadencia === 'webinar-asistente', inscrito = cadencia === 'webinar-inscrito'
  switch (paso.id) {
    case 'primer':
      if (d.punto) {
        const pl = asistio ? 'owl_webinar_asistio_radiografia' : inscrito ? 'owl_webinar_inscrito_radiografia' : 'owl_radiografia'
        return { nombre: pl, parametros: [nombre, empresa, limpiarVariable(d.punto)], boton: tokenRadiografia(prospectoId) }
      }
      return asistio ? { nombre: 'owl_webinar_asistio', parametros: [nombre, empresa] }
        : inscrito ? { nombre: 'owl_webinar_inscrito', parametros: [nombre, empresa] } : null
    case 'propuesta': return { nombre: asistio ? 'owl_propuesta_webinar' : 'owl_propuesta_reunion', parametros: [nombre, empresa] }
    case 'autodiagnostico': return { nombre: 'owl_autodiagnostico', parametros: [nombre] }
    case 'cierre': return { nombre: 'owl_cierre', parametros: [nombre] }
    case 'seguimiento-propuesta': return { nombre: 'owl_seguimiento_propuesta', parametros: [nombre, empresa] }
    case 'recordatorio-propuesta': return { nombre: 'owl_recordatorio_propuesta', parametros: [nombre, empresa] }
    default: return null
  }
}

/** Cómo se registra en Meta (POST /{WABA}/message_templates). */
export function cuerpoRegistro(d: DefinicionPlantilla) {
  const components: any[] = [{ type: 'BODY', text: d.cuerpo, example: { body_text: [d.ejemplos] } }]
  if (d.pie) components.push({ type: 'FOOTER', text: d.pie })
  if (d.boton) components.push({ type: 'BUTTONS', buttons: [{ type: 'URL', text: d.boton.texto, url: d.boton.url, example: [d.boton.ejemplo] }] })
  return { name: d.nombre, language: 'es', category: d.categoria, components }
}
