/**
 * lib/cadencias.ts
 * Secuencias de seguimiento (cadencias) para la base del webinar "Que el MinTIC no sancione tu ISP"
 * (21 oct 2026, con Inerxia AI y Nicolás Almeyda). Cada contacto del webinar arranca una cadencia
 * según si asistió o no; el vendedor marca cada paso como enviado y el sistema programa el siguiente
 * en días hábiles. Si responde, la cadencia se detiene y pasa a agendar la reunión.
 *
 * Dos versiones de los textos:
 *  - Con radiografía (el prospecto ya tiene su PDF cargado): el paso 1 es el mensaje aprobado el 4 nov 2026
 *    (lib/radiografia.ts) y todo el resto va en "usted", igual que ese mensaje.
 *  - Sin radiografía: los textos originales (WhatsApp en "tú", llamadas en "usted").
 * En todos se habla de reuniones de 15 minutos y se manda el enlace al calendario público de Owl.
 */
import { ENLACES, MINUTOS_REUNION } from './ventas'
import { isPara, mensajeRadiografia, nombreParaSaludar, type EstadoWebinar } from './radiografia'

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
  /** Resultado de `puntoConcreto` (lib/radiografia.ts). Solo viene si el prospecto ya tiene su radiografía cargada. */
  punto?: string | null
}

/** Lo que ve cada texto: nombre ya listo para saludar, quién firma y si hay radiografía. */
interface Ctx {
  n: string | null
  yo: string
  remitente: string | null
  /** Para textos en "tú": "tu ISP" cuando lo escrito no es un nombre. */
  empresa: string
  /** Para textos en "usted": "su ISP" cuando lo escrito no es un nombre. */
  isp: string
  minutos: number
  nombre: string | null
  empresaRaw: string | null
  punto: string | null
  webinar: EstadoWebinar
}

export interface PasoCadencia {
  /** Días hábiles desde el paso anterior. */
  esperaDias: number
  canal: 'whatsapp' | 'llamada'
  titulo: string
  texto: (c: Ctx) => string
}

const CAL = ENLACES.calendario
const MIN = MINUTOS_REUNION

/** "Juan, le" / "Le": abre una frase con el nombre pegado a la primera palabra. */
const con = (n: string | null, minuscula: string) => (n ? `${n}, ${minuscula}` : minuscula.charAt(0).toUpperCase() + minuscula.slice(1))

/** Pasos compartidos al final de las dos cadencias. */
const autodiagnostico: PasoCadencia = {
  esperaDias: 3, canal: 'whatsapp', titulo: 'WhatsApp · autodiagnóstico',
  texto: c => c.punto
    ? `${con(c.n, 'si ahora no tiene tiempo para una videollamada, le dejo el autodiagnóstico gratuito: ')}` +
      `son 5 minutos y le da su porcentaje de cumplimiento preliminar.\n\n${ENLACES.autodiagnostico}\n\n` +
      `Cuando lo tenga, lo revisamos juntos en ${MIN} minutos: ${CAL}`
    : `${con(c.n, 'si ahora no tienes tiempo para una reunión, te dejo el autodiagnóstico gratuito: ')}` +
      `son 5 minutos y te da tu porcentaje de cumplimiento preliminar.\n\n${ENLACES.autodiagnostico}\n\n` +
      `Cuando lo tengas, lo revisamos juntos en ${MIN} minutos: ${CAL}`,
}
const cierre: PasoCadencia = {
  esperaDias: 4, canal: 'whatsapp', titulo: 'WhatsApp · cierre amable',
  texto: c => c.punto
    ? `${con(c.n, 'no quiero llenarle el WhatsApp. ')}¿Lo dejamos para más adelante o prefiere elegir un horario ahora (${CAL})? Con un "más adelante" me basta.`
    : `${con(c.n, 'no te quiero llenar el WhatsApp. ')}¿Lo dejamos para más adelante o prefieres elegir un horario ahora (${CAL})? Con un "más adelante" me basta.`,
}

export const CADENCIAS: Record<CadenciaId, { nombre: string; pasos: PasoCadencia[] }> = {
  'webinar-asistente': {
    nombre: 'Webinar · asistió',
    pasos: [
      {
        esperaDias: 0, canal: 'whatsapp', titulo: 'WhatsApp 1 · gracias y una pregunta',
        texto: c => c.punto
          ? mensajeRadiografia({ nombre: c.nombre, empresa: c.empresaRaw, remitente: c.remitente, webinar: 'asistio', punto: c.punto })
          : c.minutos > 0 && c.minutos < 30
            ? `¡Hola${c.n ? `, ${c.n}` : ''}! 👋 Soy ${c.yo}, de Owl Compliance. Gracias por conectarte al webinar ${WEBINAR.titulo}; ` +
              'sé que a esa hora no siempre se puede quedar hasta el final.\n\n' +
              `¿Qué te llevó a inscribirte? ¿Algún requerimiento, los reportes o las visitas del MinTIC en ${c.empresa}?`
            : `¡Hola${c.n ? `, ${c.n}` : ''}! 👋 Soy ${c.yo}, de Owl Compliance. Gracias por acompañarnos en el webinar ${WEBINAR.titulo} con ${WEBINAR.ponente}.\n\n` +
              `Te quería hacer una pregunta: de lo que se habló, ¿qué es lo que más te preocupa hoy en ${c.empresa}?`,
      },
      {
        esperaDias: 1, canal: 'llamada', titulo: 'Llamada · si no respondió',
        texto: c => c.punto
          ? `1. "${con(c.n, 'le habla ')}${c.yo}, abogado(a) de Owl Compliance. ¿Tiene un minuto?"\n` +
            `2. "Lo llamo porque le escribí por WhatsApp con la radiografía regulatoria de ${c.isp}. ¿Alcanzó a verla?"\n` +
            `3. "¿Qué tan tranquilo está con los reportes y las visitas del MinTIC este año?"\n` +
            `4. "Le propongo ${MIN} minutos: revisamos la radiografía y hacemos juntos el autodiagnóstico. Le envío por WhatsApp el enlace para que elija el horario que le quede mejor."\n` +
            'Si pide "envíeme información": "Con gusto. Para enviarle lo que le sirve, ¿puedo hacerle dos preguntas?" y volver al 3.'
          : `1. "${con(c.n, 'le habla ')}${c.yo}, abogado(a) de Owl Compliance. ¿Tiene un minuto?"\n` +
            `2. "Lo llamo porque usted estuvo en el webinar ${WEBINAR.titulo} y le escribí por WhatsApp. ¿Alcanzó a verlo?"\n` +
            `3. "¿Qué tan tranquilo está con los reportes y las visitas del MinTIC este año en ${c.empresa}?"\n` +
            `4. "Le propongo ${MIN} minutos: revisamos qué obligaciones le aplican y cuáles tiene en riesgo. Le envío por WhatsApp el enlace para que elija el horario."\n` +
            'Si pide "envíeme información": "Con gusto. Para enviarle lo que le sirve, ¿puedo hacerle dos preguntas?" y volver al 3.',
      },
      {
        esperaDias: 2, canal: 'whatsapp', titulo: 'WhatsApp 2 · propuesta de reunión',
        texto: c => c.punto
          ? `${con(c.n, 'le escribo de nuevo por la radiografía regulatoria de ' + c.isp + ': ¿pudo verla? ')}` +
            `Si le parece, la revisamos en una videollamada de ${MIN} minutos y hacemos juntos el autodiagnóstico. Elija el horario que le quede mejor: ${CAL}`
          : `${con(c.n, 'te propongo algo concreto: ')}${MIN} minutos para revisar qué obligaciones le aplican a ${c.empresa} ` +
            `y cuáles tiene en riesgo de sanción, aterrizando lo que vimos en el webinar. Elige el horario que mejor te quede: ${CAL}`,
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
        texto: c => c.punto
          ? mensajeRadiografia({ nombre: c.nombre, empresa: c.empresaRaw, remitente: c.remitente, webinar: 'inscrito', punto: c.punto })
          : `¡Hola${c.n ? `, ${c.n}` : ''}! 👋 Soy ${c.yo}, de Owl Compliance. Te inscribiste al webinar ${WEBINAR.titulo} y vi que no alcanzaste a conectarte.\n\n` +
            `Si te sirve, te cuento en ${MIN} minutos lo más importante, aplicado a ${c.empresa}. Elige el horario que mejor te quede: ${CAL}`,
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

/**
 * Texto del paso, ya llenado con los datos del contacto.
 * `cadencia` dice si asistió o no (lo usa el mensaje con radiografía); sin ella se toma la del paso 1 de asistentes.
 */
export function textoDelPaso(paso: PasoCadencia, l: DatosLead, vendedor?: string | null, cadencia: CadenciaId = 'webinar-asistente') {
  const isp = isPara(l.empresa)
  return paso.texto({
    n: nombreParaSaludar(l.nombre),
    yo: vendedor || '[SU NOMBRE]',
    remitente: vendedor || null,
    empresa: isp === 'su ISP' ? 'tu ISP' : isp,
    isp,
    minutos: Number(l.minutos_webinar ?? 0),
    nombre: l.nombre ?? null,
    empresaRaw: l.empresa ?? null,
    punto: l.punto ?? null,
    webinar: cadencia === 'webinar-asistente' ? 'asistio' : 'inscrito',
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
