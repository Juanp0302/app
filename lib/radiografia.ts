/**
 * lib/radiografia.ts
 * Mensaje con la radiografía regulatoria (PDF de una página que Owl prepara para cada ISP) y sus variables:
 * a quién saludar, quién firma, qué dice del webinar y "el punto concreto" que se le recomienda mirar.
 * Sin acceso a BD. El calendario es el mismo que usa el generador de las radiografías
 * (Marketing/Cold Mailing/Tercera campaña/radiografia_generador/calendario_isp.json): actualizar los dos juntos.
 */
import calendario from './calendario-isp.json'
import { ENLACES, MINUTOS_REUNION } from './ventas'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

interface Obligacion { fecha: string; codigo: string; nombre: string; periodo: string; financiero?: boolean }

/** "2026-10-30" → "30 de octubre". */
export function fechaLarga(iso: string) {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} de ${MESES[m - 1]}`
}

/** Primer reporte (no pago) que vence hoy o después; el mismo criterio con el que el generador arma la radiografía. */
export function proximoVencimiento(hoy: string): Obligacion | null {
  const futuras = (calendario.obligaciones as Obligacion[]).filter(o => o.fecha >= hoy && !o.financiero)
  futuras.sort((a, b) => a.fecha.localeCompare(b.fecha))
  return futuras[0] ?? null
}

/** Cómo salió el ISP en la radiografía: lo decide la prioridad del prospecto (A = investigación abierta, B = sanción registrada). */
export function situacionRegulatoria(p: { prioridad?: string | null; revisar_a_mano?: number | null; whatsapp_1?: string | null }) {
  const prioridad = p.prioridad ?? ''
  if (prioridad.startsWith('A')) return { tipo: 'investigacion' as const }
  if (prioridad.startsWith('B')) {
    // Igual que el generador: el año sale del primer mensaje, salvo que el dato esté marcado "revisar a mano".
    const anio = p.revisar_a_mano ? null : p.whatsapp_1?.match(/\((\d{4})\)/)?.[1] ?? null
    return { tipo: 'sancion' as const, anio }
  }
  return { tipo: 'ninguna' as const }
}

/** "el punto concreto" del mensaje: lo más importante de esa radiografía para esa empresa. */
export function puntoConcreto(p: Parameters<typeof situacionRegulatoria>[0], hoy: string): string {
  const s = situacionRegulatoria(p)
  if (s.tipo === 'investigacion') return 'el punto 1, donde figura la investigación abierta en el MinTIC'
  if (s.tipo === 'sancion') return `el punto 1, donde figura la sanción registrada${s.anio ? ` (${s.anio})` : ''}`
  const v = proximoVencimiento(hoy)
  return v ? `el punto 2: el reporte ${v.codigo} ${v.nombre}, que vence el ${fechaLarga(v.fecha)}` : 'el punto 2, con sus próximos vencimientos'
}

export type EstadoWebinar = 'asistio' | 'inscrito' | null

export const estadoWebinar = (p: { webinar_asistio?: number | null; en_webinar?: number | null; campana?: string | null }): EstadoWebinar =>
  p.webinar_asistio ? 'asistio' : p.en_webinar || p.campana === 'webinar' ? 'inscrito' : null

/** Primer nombre listo para saludar; null si no sirve ("Sin dato", un punto, una cédula, un correo). */
export function nombreParaSaludar(nombre?: string | null): string | null {
  const t = (nombre ?? '').trim().split(/\s+/)[0] ?? ''
  if (t.length < 3 || /[\d.@_]/.test(t) || /^(sin|dato|n\/a|nn|na|no|estudiante|independiente)$/i.test(t)) return null
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
}

/** Nombre del ISP para el mensaje; "su ISP" cuando lo escrito no es un nombre ("Na", ".", una cédula). */
export function isPara(empresa?: string | null): string {
  const e = (empresa ?? '').trim()
  return e.length < 3 || /^(na|n\/a|x|nn|\.|[\d\s.\-]+)$/i.test(e) ? 'su ISP' : e
}

export interface DatosMensaje {
  /** Quien se inscribió al webinar o, si no hay, el representante legal. */
  nombre?: string | null
  empresa?: string | null
  /** Quién contacta (Adriana, David, Juan Pablo). */
  remitente?: string | null
  webinar: EstadoWebinar
  /** Resultado de `puntoConcreto`. */
  punto: string
}

const FRASE_WEBINAR: Record<'asistio' | 'inscrito', string> = {
  asistio: 'Gracias por acompañarnos en el webinar del 21 de octubre con Nicolás Almeyda.',
  inscrito: 'Vi que se inscribió al webinar del 21 de octubre con Nicolás Almeyda y no alcanzó a conectarse.',
}

/** El mensaje aprobado el 4 de noviembre de 2026: se copia y se pega tal cual. */
export function mensajeRadiografia(d: DatosMensaje): string {
  const n = nombreParaSaludar(d.nombre)
  const yo = d.remitente || '[SU NOMBRE]'
  const presentacion = `Hola${n ? `, ${n}` : ''}. Soy ${yo} de Owl Compliance, firma especializada en cumplimiento regulatorio para operadores de internet en Colombia.` +
    (d.webinar ? ` ${FRASE_WEBINAR[d.webinar]}` : '')
  const radiografia = `${d.webinar ? 'Después del webinar preparamos' : 'Preparamos'} para ${isPara(d.empresa)} una radiografía regulatoria de una página: ` +
    `en dos minutos verá lo que hoy ve el MinTIC de su empresa, sus pagos regulatorios y sus próximos vencimientos. Le recomiendo mirar ${d.punto}.`
  const reunion = `Si le parece, la revisamos en una videollamada de ${MINUTOS_REUNION} minutos y hacemos juntos el autodiagnóstico de cumplimiento, ` +
    `para que sepa exactamente en qué está bien y qué le falta. Puede elegir el horario que le quede mejor aquí: ${ENLACES.calendario}`
  return [presentacion, radiografia, reunion].join('\n\n')
}
