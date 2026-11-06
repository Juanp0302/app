/**
 * lib/cadencias.ts
 * Secuencias de seguimiento (cadencias) de la campaña de la radiografía regulatoria. Cada prospecto sigue una:
 *  - webinar-asistente: asistió al webinar "Que el MinTIC no sancione tu ISP" (21 oct 2026, con Inerxia AI y Nicolás Almeyda), 5 pasos;
 *  - webinar-inscrito: se inscribió y no asistió, 3 pasos;
 *  - cold-mailing: los del cold mailing (y las bases cargadas) que no están en el webinar, 5 pasos.
 * El vendedor marca cada paso como enviado y el sistema programa el siguiente en días hábiles. Si responde, la cadencia se
 * detiene y toca agendar la reunión; para esa parte están los mensajes de CUANDO_RESPONDE.
 *
 * Todo va en "tú", WhatsApp y llamadas. El primer mensaje lleva la página de servicios de Owl; en todos se habla de reuniones
 * de 15 minutos y se manda el enlace al calendario público. Dos versiones del texto: con radiografía (el prospecto ya tiene su
 * PDF cargado: el paso 1 es el mensaje de lib/radiografia.ts) y sin radiografía.
 */
import { ENLACES, MINUTOS_REUNION } from './ventas'
import { estadoWebinar, isPara, mensajeRadiografia, nombreParaSaludar, puntoConcreto, sinDobles, type EstadoWebinar } from './radiografia'

export const WEBINAR = {
  titulo: '“Que el MinTIC no sancione tu ISP”',
  ponente: 'Nicolás Almeyda',
}

export type CadenciaId = 'webinar-asistente' | 'webinar-inscrito' | 'cold-mailing'
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
  /** El ISP, o "tu ISP" cuando lo escrito no es un nombre. */
  empresa: string
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
const WEB = ENLACES.servicios
const MIN = MINUTOS_REUNION

/** "Juan, te escribo…" con nombre; "Te escribo…" sin él. */
const con = (n: string | null, minuscula: string) => (n ? `${n}, ${minuscula}` : minuscula.charAt(0).toUpperCase() + minuscula.slice(1))

/** Primer mensaje cuando el prospecto todavía no tiene radiografía: se presenta, hace una pregunta y manda la página de servicios. */
function primerSinRadiografia(c: Ctx): string {
  const saludo = `¡Hola${c.n ? `, ${c.n}` : ''}! 👋 Soy ${c.yo}, de Owl Compliance.`
  const servicios = `Aquí puedes conocer nuestros servicios: ${WEB}`
  if (c.webinar === 'asistio') {
    const cuerpo = c.minutos > 0 && c.minutos < 30
      ? `Gracias por conectarte al webinar ${WEBINAR.titulo}; sé que a esa hora no siempre se puede quedar hasta el final.\n\n` +
        `¿Qué te llevó a inscribirte? ¿Algún requerimiento, los reportes o las visitas del MinTIC en ${c.empresa}?`
      : `Gracias por acompañarnos en el webinar ${WEBINAR.titulo} con ${WEBINAR.ponente}.\n\n` +
        `Te quería hacer una pregunta: de lo que se habló, ¿qué es lo que más te preocupa hoy en ${c.empresa}?`
    return `${saludo} ${cuerpo}\n\n${servicios}`
  }
  if (c.webinar === 'inscrito') {
    return `${saludo} Te inscribiste al webinar ${WEBINAR.titulo} y vi que no alcanzaste a conectarte.\n\n` +
      `Si te sirve, te cuento en ${MIN} minutos lo más importante, aplicado a ${c.empresa}.\n\n${servicios}\n\n` +
      `Elige el horario que mejor te quede: ${CAL}`
  }
  return `${saludo} Acompañamos a los ISP en el cumplimiento ante la CRC, el MinTIC y la SIC.\n\n` +
    `¿Me dejas hacerte una pregunta? ¿Cómo manejan hoy los reportes y las fechas de vencimiento en ${c.empresa}?\n\n${servicios}`
}

const primerContacto: PasoCadencia = {
  esperaDias: 0, canal: 'whatsapp', titulo: 'WhatsApp 1 · primer contacto',
  texto: c => (c.punto
    ? mensajeRadiografia({ nombre: c.nombre, empresa: c.empresaRaw, remitente: c.remitente, webinar: c.webinar, punto: c.punto })
    : primerSinRadiografia(c)),
}

const llamada: PasoCadencia = {
  esperaDias: 1, canal: 'llamada', titulo: 'Llamada · si no respondió',
  texto: c => {
    const porQue = c.punto
      ? `Te llamo porque te escribí por WhatsApp con la radiografía regulatoria de ${c.empresa}. ¿Alcanzaste a verla?`
      : c.webinar === 'asistio'
        ? `Te llamo porque estuviste en el webinar ${WEBINAR.titulo} y te escribí por WhatsApp. ¿Alcanzaste a verlo?`
        : `Te llamo porque te escribí por WhatsApp sobre el cumplimiento regulatorio de ${c.empresa}. ¿Alcanzaste a verlo?`
    const propuesta = c.punto
      ? 'revisamos la radiografía y hacemos juntos el autodiagnóstico'
      : `revisamos qué obligaciones aplican a ${c.empresa} y cuáles están en riesgo`
    return [
      `1. "Hola${c.n ? `, ${c.n}` : ''}. Habla ${c.yo}, abogado(a) de Owl Compliance. ¿Tienes un minuto?"`,
      `2. "${porQue}"`,
      '3. "¿Qué tan tranquilo estás con los reportes y las visitas del MinTIC este año?"',
      `4. "Te propongo ${MIN} minutos: ${propuesta}. Te envío por WhatsApp el enlace para que elijas el horario que mejor te quede."`,
      'Si te dice "envíame información": "Con gusto. Para enviarte lo que te sirve, ¿puedo hacerte dos preguntas?" y volver al 3.',
    ].join('\n')
  },
}

const propuestaDeReunion: PasoCadencia = {
  esperaDias: 2, canal: 'whatsapp', titulo: 'WhatsApp 2 · propuesta de reunión',
  texto: c => (c.punto
    ? `${con(c.n, `te escribo de nuevo por la radiografía regulatoria de ${c.empresa}: ¿pudiste verla? `)}` +
      `Si te parece, la revisamos en una videollamada de ${MIN} minutos y hacemos juntos el autodiagnóstico. Elige el horario que te quede mejor: ${CAL}`
    : `${con(c.n, 'te propongo algo concreto: ')}${MIN} minutos para revisar qué obligaciones aplican a ${c.empresa} y cuáles están en riesgo de sanción` +
      `${c.webinar === 'asistio' ? ', aterrizando lo que vimos en el webinar' : ''}. Elige el horario que mejor te quede: ${CAL}`),
}

const autodiagnostico: PasoCadencia = {
  esperaDias: 3, canal: 'whatsapp', titulo: 'WhatsApp · autodiagnóstico',
  texto: c => `${con(c.n, 'si ahora no tienes tiempo para una videollamada, te dejo el autodiagnóstico gratuito: ')}` +
    `son 5 minutos y te da tu porcentaje de cumplimiento preliminar.\n\n${ENLACES.autodiagnostico}\n\n` +
    `Cuando lo tengas, lo revisamos juntos en ${MIN} minutos: ${CAL}`,
}

const cierre: PasoCadencia = {
  esperaDias: 4, canal: 'whatsapp', titulo: 'WhatsApp · cierre amable',
  texto: c => `${con(c.n, 'no te quiero llenar el WhatsApp. ')}¿Lo dejamos para más adelante o prefieres elegir un horario ahora (${CAL})? Con un "más adelante" me basta.`,
}

export const CADENCIAS: Record<CadenciaId, { nombre: string; pasos: PasoCadencia[] }> = {
  'webinar-asistente': { nombre: 'Webinar · asistió', pasos: [primerContacto, llamada, propuestaDeReunion, autodiagnostico, cierre] },
  'webinar-inscrito': { nombre: 'Webinar · inscrito, no asistió', pasos: [primerContacto, autodiagnostico, cierre] },
  'cold-mailing': { nombre: 'Cold mailing · radiografía', pasos: [primerContacto, llamada, propuestaDeReunion, autodiagnostico, cierre] },
}

/** La cadencia que le toca a un prospecto: la que ya tiene o, si no, según si asistió, se inscribió o viene del cold mailing. */
export function cadenciaDe(p: { cadencia?: string | null; webinar_asistio?: number | null; en_webinar?: number | null; campana?: string | null }): CadenciaId {
  if (p.cadencia && p.cadencia in CADENCIAS) return p.cadencia as CadenciaId
  const w = estadoWebinar(p)
  return w === 'asistio' ? 'webinar-asistente' : w === 'inscrito' ? 'webinar-inscrito' : 'cold-mailing'
}

/** Paso que toca hacer (índice `paso_cadencia`, empieza en 0), o null si ya no hay más. */
export function pasoActual(l: { cadencia?: string | null; paso_cadencia?: number | null; cadencia_estado?: string | null }) {
  const c = l.cadencia ? CADENCIAS[l.cadencia as CadenciaId] : null
  if (!c || l.cadencia_estado !== 'activa') return null
  const i = Number(l.paso_cadencia ?? 0)
  return i < c.pasos.length ? { indice: i, total: c.pasos.length, paso: c.pasos[i] } : null
}

function contexto(l: DatosLead, vendedor: string | null | undefined, cadencia: CadenciaId): Ctx {
  return {
    n: nombreParaSaludar(l.nombre),
    yo: vendedor || '[SU NOMBRE]',
    remitente: vendedor || null,
    empresa: isPara(l.empresa),
    minutos: Number(l.minutos_webinar ?? 0),
    nombre: l.nombre ?? null,
    empresaRaw: l.empresa ?? null,
    punto: l.punto ?? null,
    webinar: cadencia === 'webinar-asistente' ? 'asistio' : cadencia === 'webinar-inscrito' ? 'inscrito' : null,
  }
}

/** Texto del paso, ya llenado con los datos del contacto. `cadencia` dice si asistió, se inscribió o viene del cold mailing. */
export function textoDelPaso(paso: PasoCadencia, l: DatosLead, vendedor?: string | null, cadencia: CadenciaId = 'webinar-asistente') {
  return sinDobles(paso.texto(contexto(l, vendedor, cadencia)))
}

// ── Todos los pasos de un prospecto, para la pestaña Mensajes ─────────────────────────────────────────────────

export interface PasoVisible {
  indice: number
  titulo: string
  canal: 'whatsapp' | 'llamada'
  /** "Primer contacto" o "1 día hábil después del paso anterior". */
  cuando: string
  estado: 'hecho' | 'toca' | 'pendiente'
  texto: string
}

/** Los pasos de la cadencia del prospecto con su texto completo y en qué va (hecho, le toca, pendiente). */
export function secuenciaDelProspecto(
  p: {
    cadencia?: string | null; paso_cadencia?: number | null; cadencia_estado?: string | null
    webinar_asistio?: number | null; en_webinar?: number | null; campana?: string | null
    webinar_nombre?: string | null; representante?: string | null; empresa?: string | null; webinar_minutos?: number | null
    radiografia_en?: string | null; prioridad?: string | null; revisar_a_mano?: number | null; whatsapp_1?: string | null
  },
  vendedor: string | null,
  hoy: string,
) {
  const id = cadenciaDe(p)
  const lead: DatosLead = {
    nombre: p.webinar_nombre || p.representante, empresa: p.empresa, minutos_webinar: p.webinar_minutos,
    punto: p.radiografia_en ? puntoConcreto(p, hoy) : null,
  }
  const hechos = Number(p.paso_cadencia ?? 0)
  const pasos: PasoVisible[] = CADENCIAS[id].pasos.map((paso, i) => ({
    indice: i,
    titulo: paso.titulo,
    canal: paso.canal,
    cuando: i === 0 ? 'Primer contacto' : `${paso.esperaDias} ${paso.esperaDias === 1 ? 'día hábil' : 'días hábiles'} después del paso anterior`,
    estado: i < hechos ? 'hecho' : i === hechos && p.cadencia === id && p.cadencia_estado === 'activa' ? 'toca' : 'pendiente',
    texto: textoDelPaso(paso, lead, vendedor, id),
  }))
  return { id, nombre: CADENCIAS[id].nombre, pasos }
}

// ── Cuando el prospecto responde ──────────────────────────────────────────────────────────────────────────────

export interface RespuestaTipo {
  id: string
  titulo: string
  cuando: string
  texto: (c: { n: string | null }) => string
}

/** Mensajes para después de que responde. Lo que va entre [CORCHETES] se completa a mano antes de enviar. */
export const CUANDO_RESPONDE: RespuestaTipo[] = [
  {
    id: 'pide-informacion', titulo: 'Si pide más información', cuando: 'Cuando escribe "envíame información"',
    texto: c => `${con(c.n, 'con gusto. ')}Aquí puedes ver todo lo que hacemos: ${WEB}\n\n` +
      `Para que no sea algo genérico, te propongo revisar tu radiografía juntos en ${MIN} minutos: ${CAL}`,
  },
  {
    id: 'confirmar-reunion', titulo: 'Confirmar la reunión', cuando: 'Apenas se agenda',
    texto: c => `${con(c.n, `quedó agendada nuestra videollamada de ${MIN} minutos para el [DÍA] a las [HORA]. `)}Te envío el enlace: [ENLACE].\n\n` +
      'Para aprovechar el tiempo, ¿hay algún tema puntual que quieras que revisemos?',
  },
  {
    id: 'recordatorio', titulo: 'Recordatorio de la reunión', cuando: 'Un día antes',
    texto: c => `${con(c.n, 'te recuerdo nuestra videollamada de mañana a las [HORA]. ')}Este es el enlace: [ENLACE]. ¿Sigue en pie?`,
  },
  {
    id: 'no-se-conecto', titulo: 'Si no se conectó', cuando: 'Cuando no llega a la reunión',
    texto: c => `${con(c.n, 'te estuve esperando en la videollamada; imagino que se te cruzó algo. ')}Puedes elegir otro horario aquí: ${CAL}`,
  },
  {
    id: 'resumen', titulo: 'Resumen después de la reunión', cuando: 'El mismo día de la reunión',
    texto: c => `${con(c.n, 'gracias por tu tiempo hoy. ')}Para dejarlo por escrito: [LO QUE ENCONTRAMOS].\n\n` +
      'Te envío la propuesta a más tardar el [FECHA] y la revisamos juntos el [DÍA]. ¿Te parece?',
  },
  {
    id: 'seguimiento-propuesta', titulo: 'Seguimiento de la propuesta', cuando: '2 días después de enviarla',
    texto: c => `${con(c.n, '¿pudiste revisar la propuesta? ')}Si tienes alguna duda, la resolvemos en ${MIN} minutos. ¿Te queda bien hablar el [DÍA] a las [HORA]?`,
  },
]

/** Los mensajes de CUANDO_RESPONDE ya con el nombre del contacto. */
export function mensajesCuandoResponde(nombre?: string | null) {
  const n = nombreParaSaludar(nombre)
  return CUANDO_RESPONDE.map(r => ({ id: r.id, titulo: r.titulo, cuando: r.cuando, texto: sinDobles(r.texto({ n })) }))
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
