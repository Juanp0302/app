/**
 * lib/correo-ventas.ts
 * Correos automáticos de las cadencias (modo automático, lib/ventas-auto.ts): arma el asunto, el cuerpo en HTML y en texto,
 * la firma y el enlace de baja a partir de los mismos textos de lib/cadencias.ts. También lee los correos que llegan al buzón:
 * respuestas automáticas, rebotes, pedidos de baja y "no me interesa". Sin acceso a BD.
 */
import { CADENCIAS, textoDelPaso, type CadenciaId, type DatosLead } from './cadencias'
import { isPara } from './radiografia'

export interface CorreoArmado {
  asunto: string
  texto: string
  html: string
  /** true en el primer correo de un prospecto con radiografía: va el PDF adjunto. */
  adjuntarRadiografia: boolean
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Párrafos separados por línea en blanco; los enlaces quedan clicables. */
export function aHtml(texto: string): string {
  return texto.split(/\n{2,}/).map(par => {
    const conEnlaces = esc(par).replace(/https?:\/\/[^\s<]+[^\s<.,;:)]/g, u => `<a href="${u}" style="color:#712529;">${u}</a>`)
    return `<p style="margin:0 0 14px;">${conEnlaces.replace(/\n/g, '<br>')}</p>`
  }).join('')
}

/** Asunto del primer correo; los siguientes van como respuesta en el mismo hilo ("Re: …"). */
export function asuntoInicial(cadencia: CadenciaId, d: DatosLead): string {
  const isp = isPara(d.empresa)
  if (cadencia === 'post-reunion') return isp === 'tu ISP' ? 'Propuesta de Owl Compliance' : `Propuesta de Owl Compliance para ${isp}`
  if (cadencia === 'entrante') {
    return /autodiagn/i.test(d.origen ?? '') ? 'Tu autodiagnóstico de cumplimiento: revisémoslo juntos' : 'Recibimos tu mensaje · Owl Compliance'
  }
  if (d.punto) return isp === 'tu ISP' ? 'Tu radiografía regulatoria' : `Radiografía regulatoria de ${isp}`
  return isp === 'tu ISP' ? 'Cumplimiento regulatorio de tu ISP' : `Cumplimiento regulatorio de ${isp}`
}

/**
 * Correo del paso `indice` de la cadencia. null si ese paso no se manda por correo (la llamada).
 * `enlaceBaja` es la URL firmada de lib/baja.ts.
 */
export function armarCorreo(opts: {
  cadencia: CadenciaId
  indice: number
  datos: DatosLead
  remitente: string
  enlaceBaja: string
}): CorreoArmado | null {
  const paso = CADENCIAS[opts.cadencia].pasos[opts.indice]
  if (!paso || paso.canal === 'llamada') return null
  const cuerpo = textoDelPaso(paso, opts.datos, opts.remitente, opts.cadencia, 'correo')
  const firma = `${opts.remitente}\nOwl Compliance · www.owlcompliance.com`
  const pie = `Si no quieres recibir más correos de Owl Compliance, puedes darte de baja aquí: ${opts.enlaceBaja}`
  const inicial = asuntoInicial(opts.cadencia, opts.datos)
  const texto = `${cuerpo}\n\n${firma}\n\n—\n${pie}`
  const html =
    `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;max-width:600px;">` +
    aHtml(cuerpo) +
    `<p style="margin:22px 0 0;">${esc(opts.remitente)}<br><strong>Owl Compliance</strong> · <a href="https://www.owlcompliance.com" style="color:#712529;">www.owlcompliance.com</a></p>` +
    `<p style="margin:28px 0 0;font-size:12px;color:#888;">Si no quieres recibir más correos de Owl Compliance, ` +
    `<a href="${esc(opts.enlaceBaja)}" style="color:#888;">date de baja aquí</a>.</p></div>`
  return {
    asunto: opts.indice === 0 ? inicial : `Re: ${inicial}`,
    texto, html,
    adjuntarRadiografia: opts.indice === 0 && !!opts.datos.punto,
  }
}

// ── Correos que llegan al buzón ─────────────────────────────────────────────────────────────────────────────

/** Primer correo válido de un campo que puede traer varios ("a@x.co; b@y.co") o basura. */
export function primerCorreo(s?: string | null): string | null {
  const m = (s ?? '').match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
  return m ? m[0].toLowerCase() : null
}

/** Todos los correos que aparecen en un texto (para leer a quién no se le pudo entregar un rebote). */
export const correosEn = (s?: string | null) =>
  [...new Set(((s ?? '').match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []).map(c => c.toLowerCase()))]

/** "Respuesta automática", "fuera de la oficina"…: no es una respuesta de verdad y no detiene la cadencia. */
export function esRespuestaAutomatica(asunto: string, cabeceras: Record<string, string | undefined>): boolean {
  const auto = (cabeceras['auto-submitted'] ?? '').toLowerCase()
  if (auto && auto !== 'no') return true
  if (cabeceras['x-autoreply'] || cabeceras['x-autorespond'] || cabeceras['x-autoresponder']) return true
  if (/^(auto_reply|bulk|junk)$/i.test(cabeceras['precedence'] ?? '')) return true
  return /(respuesta autom[aá]tica|automatic reply|auto[- ]?reply|autoreply|fuera de (la )?oficina|out of (the )?office|estoy ausente|ausencia|de vacaciones)/i.test(asunto)
}

/** Aviso de "no se pudo entregar" del servidor de correo. */
export const esRebote = (remitente: string, asunto: string) =>
  /mailer-daemon|postmaster/i.test(remitente) ||
  /(undeliverable|delivery status notification|delivery (has )?failed|mail delivery failed|returned mail|no se (ha podido|pudo) entregar|entrega fallida|address not found)/i.test(asunto)

/** Lo que escribió la persona, sin el correo citado debajo (para no leer nuestras propias palabras). */
export function textoNuevo(texto: string): string {
  const lineas = texto.replace(/\r/g, '').split('\n')
  const out: string[] = []
  for (const l of lineas) {
    if (/^\s*>/.test(l)) break
    if (/^\s*(El .{3,120} escribió:|On .{3,120} wrote:|-{2,} ?(Original Message|Mensaje original) ?-{2,}|De: .+|From: .+|Enviado desde mi )/i.test(l)) break
    out.push(l)
  }
  return out.join('\n').trim()
}

/** Pide que no le escribamos más: se da de baja y queda en "No contactar". */
export const pideBaja = (texto: string) =>
  /(dar(me|nos)? de baja|no (me|nos) (vuelvan a |sigan |)escrib|eliminar(me|nos)? de (su|sus|la|esta) (lista|base)|retirar(me|nos)? de|remover(me|nos)?|unsubscribe|no (deseo|deseamos|quiero|queremos) recibir|dejen de (escribir|enviar)|no (me|nos) env[ií]en)/i.test(texto)

/** "No me interesa": la cadencia termina y el prospecto queda en "No interesado" (sin darlo de baja). */
export const noInteresado = (texto: string) =>
  /(no (me|nos) interesa|no estamos interesados|no estoy interesad|no necesitamos|ya (tenemos|contamos con) (un |una )?(asesor|abogad|firma|proveedor))/i.test(texto)

export type TipoEntrante = 'rebote' | 'automatica' | 'baja' | 'no-interesado' | 'respuesta'

/** Qué es un correo que llegó al buzón, en este orden: rebote, respuesta automática, baja, "no me interesa" o respuesta. */
export function clasificarEntrante(c: { de: string; asunto: string; texto: string; cabeceras: Record<string, string | undefined> }): TipoEntrante {
  if (esRebote(c.de, c.asunto)) return 'rebote'
  if (esRespuestaAutomatica(c.asunto, c.cabeceras)) return 'automatica'
  const propio = textoNuevo(c.texto)
  if (pideBaja(propio)) return 'baja'
  if (noInteresado(propio)) return 'no-interesado'
  return 'respuesta'
}

// ── Qué paso se manda y cuándo el siguiente ─────────────────────────────────────────────────────────────────

/** El primer paso desde `indice` que se manda por correo (se salta la llamada); null si ya no queda ninguno. */
export function pasoCorreoDesde(cadencia: CadenciaId, indice: number): number | null {
  const pasos = CADENCIAS[cadencia].pasos
  for (let i = Math.max(0, indice); i < pasos.length; i++) if (pasos[i].canal !== 'llamada') return i
  return null
}

/**
 * Después de enviar el paso `indice`: cuál sigue y cuántos días hábiles esperar (los de la llamada saltada se suman,
 * para que el ritmo sea el mismo de la cadencia). Sin siguiente, la cadencia termina.
 */
export function despuesDeEnviar(cadencia: CadenciaId, indice: number): { siguiente: number | null; esperaDias: number } {
  const pasos = CADENCIAS[cadencia].pasos
  const siguiente = pasoCorreoDesde(cadencia, indice + 1)
  if (siguiente === null) return { siguiente: null, esperaDias: 0 }
  let espera = 0
  for (let i = indice + 1; i <= siguiente; i++) espera += pasos[i].esperaDias
  return { siguiente, esperaDias: espera }
}

/** A quién se le escribe: quien se inscribió al webinar si lo hay (es a quien se saluda), si no el correo de la empresa. */
export const destinatario = (p: { webinar_correo?: string | null; correo?: string | null }) =>
  primerCorreo(p.webinar_correo) ?? primerCorreo(p.correo)
