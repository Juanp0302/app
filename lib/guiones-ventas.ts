/**
 * lib/guiones-ventas.ts
 * Guiones del playbook (docs/playbook-ventas.md) listos para usar con cada lead del pipeline:
 * se eligen según la temperatura y la etapa, y se llenan con sus datos. Trato de "usted", una sola
 * pregunta por mensaje y siempre dos opciones de horario para la reunión.
 *
 * Para cambiar un texto, se edita aquí; el tablero lo toma solo.
 */
import { temperaturaDe, ENLACES, type Etapa } from './pipeline'

export { ENLACES }

export interface Guion {
  id: string
  titulo: string
  canal: 'whatsapp' | 'llamada'
  cuando: string          // en qué momento usarlo
  texto: string
}

interface DatosGuion {
  nombre?: string | null
  empresa?: string | null
  etapa?: string | null
  proxima_fecha?: string | null
  dolor_nota?: string | null
  origen?: string | null
  origenes?: string | null
  asistio_webinar?: number | null
  asistio_max?: number | null
}

const primerNombre = (n?: string | null) => (n ?? '').trim().split(/\s+/)[0] || ''

/** Tema del webinar a partir del asunto ("Webinar: Visitas del MinTIC" → "Visitas del MinTIC"). */
export function temaWebinar(envios: { asunto?: string | null }[]): string | null {
  for (const e of envios) {
    const m = (e.asunto ?? '').match(/^webinar\s*[:\-–]\s*(.+)$/i)
    if (m && !/importado/i.test(m[1])) return m[1].trim()
  }
  return null
}

/** % de cumplimiento del autodiagnóstico, si el lead lo hizo. */
export function pctAutodiagnostico(envios: { datos?: string | null }[]): string | null {
  for (const e of envios) {
    try {
      const v = JSON.parse(e.datos ?? '{}').pct_cumplimiento
      if (v != null && v !== '') return String(v).includes('%') ? String(v) : `${v}%`
    } catch { /* datos que no son JSON */ }
  }
  return null
}

function fechaLarga(iso?: string | null) {
  if (!iso) return null
  const d = new Date(`${iso}T12:00:00`)
  return isNaN(d.getTime()) ? null : d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
}

/**
 * Guiones para este lead, en el orden en que se usan. `vendedor` firma los mensajes; si no se sabe,
 * queda "[SU NOMBRE]" para completarlo.
 */
export function guionesPara(lead: DatosGuion, envios: { asunto?: string | null; datos?: string | null; origen?: string | null }[], vendedor?: string | null): Guion[] {
  const n = primerNombre(lead.nombre)
  const hola = n ? `Hola ${n}` : 'Hola'
  const buenas = n ? `Buenos días, ${n}` : 'Buenos días'
  const yo = vendedor || '[SU NOMBRE]'
  const empresa = lead.empresa?.trim() || 'su empresa'
  const tema = temaWebinar(envios)
  const delWebinar = tema ? `el webinar sobre ${tema}` : 'nuestro webinar'
  const pct = pctAutodiagnostico(envios)
  const t = temperaturaDe(lead)
  const etapa = (lead.etapa ?? 'nuevo') as Etapa
  const out: Guion[] = []

  const cierreCita = 'Le propongo 20 minutos: revisamos su caso y le digo con claridad qué obligaciones le aplican y cuáles tiene en riesgo. ¿Le sirve el [DÍA 1, HORA] o el [DÍA 2, HORA]?'

  if (etapa === 'nuevo' || etapa === 'contactado') {
    if (t === 1) {
      out.push({ id: 'wa-asistente', titulo: 'WhatsApp · asistió al webinar', canal: 'whatsapp', cuando: 'En las primeras 48 horas',
        texto: `${hola}, le escribe ${yo} de OWL Compliance. Gracias por acompañarnos en ${delWebinar}.\n\n` +
          `Una pregunta rápida: de lo que vimos, ¿hay algo que en ${empresa} todavía no tengan del todo cubierto?` })
      out.push({ id: 'llamada-asistente', titulo: 'Llamada · asistió al webinar', canal: 'llamada', cuando: 'Si no responde el WhatsApp en 1 día',
        texto: `1. ${buenas}. Habla ${yo} de OWL Compliance. Usted estuvo en ${delWebinar}. ¿Tiene dos minutos?\n` +
          `2. Quería preguntarle algo que salió en el webinar: ¿en ${empresa} ya tienen cubiertos los reportes y las visitas del MinTIC?\n` +
          `3. ¿Qué tan tranquilo está con los reportes y las fechas de este año?\n` +
          `4. ${cierreCita}\n` +
          `Si pide "envíeme información": "Con gusto. Para enviarle lo que le sirve, ¿puedo hacerle dos preguntas?" y volver al paso 3.` })
    } else if (t === 2) {
      out.push({ id: 'wa-inscrito', titulo: 'WhatsApp · inscrito que no asistió', canal: 'whatsapp', cuando: 'Primer mensaje',
        texto: `${hola}, le escribe ${yo} de OWL Compliance. Vi que se inscribió a ${delWebinar} y no alcanzó a conectarse.\n\n` +
          `Si le sirve, le cuento en 20 minutos lo más importante, aplicado a ${empresa}. ¿Le queda mejor el [DÍA 1, HORA] o el [DÍA 2, HORA]?` })
    } else if (pct) {
      out.push({ id: 'wa-autodiag', titulo: 'WhatsApp · hizo el autodiagnóstico', canal: 'whatsapp', cuando: 'El mismo día',
        texto: `${hola}, le escribe ${yo} de OWL Compliance. Vi que hizo el autodiagnóstico y le dio ${pct} de cumplimiento preliminar.\n\n` +
          `Ese número tiene detrás obligaciones concretas. ${cierreCita}` })
      out.push({ id: 'llamada-autodiag', titulo: 'Llamada · hizo el autodiagnóstico', canal: 'llamada', cuando: 'Si no responde en el día',
        texto: `1. ${buenas}. Habla ${yo} de OWL Compliance. Lo llamo por el autodiagnóstico que hizo: le dio ${pct}. ¿Tiene dos minutos?\n` +
          `2. ¿Qué fue lo que más le preocupó de las preguntas?\n` +
          `3. ¿Han recibido algún requerimiento de la SIC o el MinTIC?\n` +
          `4. ${cierreCita}` })
    } else if (t === 3) {
      out.push({ id: 'wa-contacto', titulo: 'WhatsApp · nos escribió', canal: 'whatsapp', cuando: 'El mismo día',
        texto: `${hola}, le escribe ${yo} de OWL Compliance. Recibimos su mensaje y quería atenderlo personalmente.\n\n${cierreCita}` })
    } else {
      out.push({ id: 'wa-frio', titulo: 'WhatsApp · primer contacto', canal: 'whatsapp', cuando: 'Primer mensaje',
        texto: `${hola}, le escribe ${yo} de OWL Compliance; acompañamos a ISP en el cumplimiento ante la CRC, el MinTIC y la SIC.\n\n` +
          `¿Le puedo hacer una pregunta sobre cómo manejan hoy los reportes en ${empresa}?` })
    }
    if (t === 1 || t === 2 || t === 4) {
      out.push({ id: 'wa-autodiag-invitacion', titulo: 'WhatsApp · invitar al autodiagnóstico', canal: 'whatsapp', cuando: 'Si responde pero no quiere reunión todavía',
        texto: `Entiendo. Le dejo el autodiagnóstico gratuito: son 5 minutos y le da su porcentaje de cumplimiento preliminar: ${ENLACES.autodiagnostico}\n\n` +
          `Cuando lo tenga, ¿le parece si lo revisamos juntos en 20 minutos?` })
    }
    out.push({ id: 'wa-seguimiento', titulo: 'WhatsApp · seguimiento sin respuesta', canal: 'whatsapp', cuando: '3 días después, si no respondió',
      texto: `${hola}, ¿pudo ver mi mensaje? Sé que el día a día de un ISP no da tregua. Si le sirve, le guardo un espacio de 20 minutos esta semana. ¿El [DÍA 1] o el [DÍA 2]?` })
  }

  if (etapa === 'reunion_agendada') {
    const f = fechaLarga(lead.proxima_fecha) ?? '[FECHA]'
    out.push({ id: 'wa-confirmacion', titulo: 'WhatsApp · confirmar la reunión', canal: 'whatsapp', cuando: 'Apenas se agenda',
      texto: `${hola}, quedó agendada nuestra reunión para el ${f} a las [HORA]. Le envío el enlace: [ENLACE].\n\n` +
        `Para aprovechar los 20 minutos, ¿hay algún tema puntual que quiera que revisemos?` })
    out.push({ id: 'wa-recordatorio', titulo: 'WhatsApp · recordatorio', canal: 'whatsapp', cuando: '24 horas antes',
      texto: `${hola}, le recuerdo nuestra reunión de mañana a las [HORA]. Este es el enlace: [ENLACE]. ¿Sigue en pie?` })
    out.push({ id: 'wa-no-asistio', titulo: 'WhatsApp · no se conectó', canal: 'whatsapp', cuando: 'Si no llega a la reunión',
      texto: `${hola}, lo estuve esperando en la reunión; imagino que se le cruzó algo. ¿Le queda mejor el [DÍA 1] o el [DÍA 2] a la misma hora?` })
  }

  if (etapa === 'reunion_realizada') {
    const dolor = lead.dolor_nota?.trim()
    out.push({ id: 'wa-resumen', titulo: 'WhatsApp · resumen después de la reunión', canal: 'whatsapp', cuando: 'El mismo día de la reunión',
      texto: `${hola}, gracias por su tiempo hoy. Para dejarlo por escrito: ${dolor ? dolor : '[LO QUE ENCONTRAMOS]'}.\n\n` +
        `Le envío la propuesta a más tardar el [FECHA] y la revisamos juntos el [DÍA]. ¿Le parece?` })
  }

  if (etapa === 'propuesta') {
    out.push({ id: 'wa-propuesta', titulo: 'WhatsApp · seguimiento de la propuesta', canal: 'whatsapp', cuando: '2 días después de enviarla',
      texto: `${hola}, ¿pudo revisar la propuesta? Si tiene alguna duda, la resolvemos en 10 minutos. ¿Le queda bien hablar el [DÍA] a las [HORA]?` })
  }

  return out
}
