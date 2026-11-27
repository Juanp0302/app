/**
 * lib/whatsapp-ventas.ts
 * Fase 3 de docs/automatizacion-ventas.md: los mensajes que llegan al WhatsApp de Owl (+57 301 238 8989, API oficial de Meta).
 *  - Cada mensaje queda guardado y se ve en la ficha del prospecto (pestaña WhatsApp), donde el equipo responde.
 *  - Si quien escribe ya es prospecto, cuenta como respuesta: se detiene su cadencia y se avisa al responsable.
 *    Si no, se crea el prospecto (prioridad E, campaña "whatsapp") con responsable.
 *  - "No me escriban más" lo da de baja; "no me interesa" cierra la cadencia.
 *  - Con VENTAS_AUTOMATICAS=activo, el primer mensaje de una conversación recibe una respuesta automática con el calendario
 *    (respuestaAutomatica, texto aprobado el 2026-11-25). En la fase 4 esto lo hará la IA.
 * Meta solo deja responder con texto libre durante las 24 h siguientes al último mensaje del prospecto; fuera de eso
 * exige plantillas (que se cobran), así que aquí nunca se le escribe primero a nadie.
 */
import crypto from 'crypto'
import { queryAll, queryOne, execute } from './db'
import { registrarHistorial, type ProspectoRow } from './prospectos-db'
import { pideBaja, noInteresado } from './correo-ventas'
import { celularParaWhatsApp } from './whatsapp'
import { enviarTextoWhatsApp, enviarPlantillaWhatsApp, descargarMedio, ventanaAbierta, type MensajeWhatsApp, type EstadoWhatsApp, type EnvioWhatsApp } from './whatsapp-api'
import { limpiarVariable, textoDePlantilla } from './plantillas-whatsapp'
import { nombreParaSaludar, isPara } from './radiografia'
import { ENLACES, MINUTOS_REUNION, hoyBogota } from './ventas'
import { modoIA, iaConfigurada, migrateIA, borradorPendiente, equipoRespondio } from './ia-ventas'
import {
  migrateVentasAuto, modoVentasAuto, actuarSobreProspecto, elegirResponsable, avisar, escHtml, SELECT_PROSPECTO,
} from './ventas-auto'

/** Un mensaje que llega después de este silencio abre una conversación nueva: se avisa al responsable otra vez. */
const HORAS_CONVERSACION_NUEVA = 6

let _migrado = false
export async function migrateWhatsApp() {
  await migrateVentasAuto()
  if (_migrado) return
  _migrado = true
}

export interface FilaWhatsApp {
  id: string
  prospecto_id: string | null
  direccion: 'entrante' | 'saliente'
  telefono: string
  nombre: string | null
  tipo: string | null
  texto: string
  estado: string | null
  error: string | null
  user_id: string | null
  user_nombre?: string | null
  /** Lo que decidió la IA con este mensaje del prospecto (si lo atendió). */
  ia_accion?: string | null
  ia_motivo?: string | null
  ia_estado?: string | null
  /** Tipo del archivo guardado (audio, imagen…), si el mensaje trae uno. */
  medio_mime?: string | null
  created_at: string
}

const fechaSql = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ')

/** El prospecto cuyo teléfono (o el del webinar) es ese celular. Compara normalizando, como los enlaces wa.me. */
export async function prospectoDelTelefono(numero: string): Promise<ProspectoRow | undefined> {
  const cola = numero.slice(-4)
  if (cola.length < 4) return undefined
  const candidatos = await queryAll<ProspectoRow>(
    `${SELECT_PROSPECTO} WHERE p.telefono LIKE ? OR p.webinar_telefono LIKE ? ORDER BY p.updated_at DESC`, [`%${cola}%`, `%${cola}%`])
  return candidatos.find(p => celularParaWhatsApp(p.telefono) === numero || celularParaWhatsApp(p.webinar_telefono) === numero)
}

/**
 * Cierre amable cuando dice que no le interesa (idea del superadmin, 2026-11-26). Sale siempre, sin importar el modo de la IA:
 * es una respuesta dentro de las 24 horas, no un mensaje nuevo.
 */
export function cierreNoInteresado(nombre: string | null, empresa: string | null): string {
  const primer = (nombre ?? '').trim().split(/\s+/)[0]
  const saludo = primer && /^[\p{L}]{2,}$/u.test(primer) ? `Entendido, ${primer}.` : 'Entendido.'
  return `${saludo} Gracias por tu tiempo. Quedamos atentos para acompañar a ${isPara(empresa)} cuando lo necesites.`
}

/** Confirmación de la baja (pedida por el superadmin, 2026-11-26): una sola vez, y después nada más. */
export function confirmacionBaja(nombre: string | null, empresa: string | null): string {
  const primer = (nombre ?? '').trim().split(/\s+/)[0]
  const saludo = primer && /^[\p{L}]{2,}$/u.test(primer) ? `Listo, ${primer}.` : 'Listo.'
  return `${saludo} No te volveremos a escribir. Si en algún momento necesitas apoyo con el cumplimiento de ${isPara(empresa)}, escríbenos por aquí.`
}

/**
 * Respuesta automática al primer mensaje de una conversación (solo con VENTAS_AUTOMATICAS=activo).
 * Texto aprobado el 2026-11-25: no cambiarlo sin aprobación.
 */
export function respuestaAutomatica(nombre: string | null): string {
  const primer = (nombre ?? '').trim().split(/\s+/)[0]
  const saludo = primer && /^[\p{L}]{2,}$/u.test(primer) ? `Hola, ${primer}.` : 'Hola.'
  return [
    `${saludo} Gracias por escribirle a Owl Compliance. Ya le avisamos a tu asesor y te responde por aquí en el transcurso del día hábil.`,
    `Si prefieres, agenda de una vez una conversación de ${MINUTOS_REUNION} minutos en el horario que te sirva: ${ENLACES.calendario}`,
    `Y aquí puedes ver lo que hacemos: ${ENLACES.servicios}`,
  ].join('\n\n')
}

/**
 * El mensaje de bienvenida o de "no estamos disponibles" que tienen muchos ISP en su WhatsApp de empresa. Llega segundos
 * después de nuestra plantilla, pero no lo escribió una persona: no cuenta como respuesta, no detiene los seguimientos y la
 * IA no lo contesta (visto el 2026-11-27 con Jigartel y Villanet). Solo frases que una persona no escribe al responder.
 */
export function esAutorespuestaWhatsApp(texto: string): boolean {
  const t = (texto ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return [
    /gracias por (comunicarte|comunicarse|contactarnos|contactarte|contactarse|escribirnos|preferirnos|elegirnos) (con|a)\b/,
    /gracias por (comunicarte|comunicarse|contactarnos|escribirnos)\b[\s\S]*\b(atenderte|atenderle|atenderlo|asesor|en breve|pronto|horario)/,
    /bienvenid[oa]s? a\b/,
    /terminos y condiciones/, /tratamiento de (sus |tus )?datos/, /politica de (privacidad|tratamiento)/,
    /(selecciona|elige|escoge|digita|marca|escribe) (una|la) opcion/, /(responde|escribe|digita) (con )?el numero/, /\bmenu (principal|de opciones)\b/,
    /en (este|estos) momentos? no (podemos|estamos|nos es posible)/, /no (podemos|es posible) (responder|atender)(te|le)? en este momento/,
    /fuera de(l| nuestro)? horario/, /nuestro horario de atencion/, /horario de atencion (es|:)/,
    /(asistente|agente) virtual/, /(mensaje|respuesta) automatic[oa]/,
    /para atender(te|le|lo) (de manera|mejor|de forma)/,
    /\b(te|le) (responderemos|contactaremos|atenderemos|escribiremos)\b/, /lo haremos lo antes posible/,
  ].some(r => r.test(t))
}

export interface ResultadoEntranteWA {
  wamid: string
  accion: 'duplicado' | 'existente' | 'creado' | 'conversacion' | 'autorespuesta'
  tipo: 'baja' | 'no-interesado' | 'respuesta'
  prospectoId: string
  respuestaAutomatica?: 'enviada' | 'simulada' | 'error'
  /** La IA (fase 4) debe atender este mensaje: la ruta del webhook la llama después de responderle a Meta. */
  paraIA?: boolean
}

/** Procesa un mensaje que llegó por WhatsApp. Es idempotente: Meta puede mandar el mismo webhook más de una vez. */
export async function procesarMensajeWhatsApp(m: MensajeWhatsApp, ahora = new Date()): Promise<ResultadoEntranteWA> {
  await migrateWhatsApp()
  // "BAJA" a secas es lo que piden las plantillas para no recibir más mensajes.
  const tipo = pideBaja(m.texto) || /^\s*baja\s*[.!]*\s*$/i.test(m.texto) ? 'baja' : noInteresado(m.texto) ? 'no-interesado' : 'respuesta'
  const previo = await queryOne<{ prospecto_id: string }>(`SELECT prospecto_id FROM mensajes_whatsapp WHERE id = ?`, [m.wamid])
  if (previo) return { wamid: m.wamid, accion: 'duplicado', tipo, prospectoId: previo.prospecto_id }

  const hoy = hoyBogota(ahora)
  const ultimo = await queryOne<{ created_at: string }>(
    `SELECT created_at FROM mensajes_whatsapp WHERE telefono = ? AND direccion = 'entrante' AND estado <> 'autorespuesta' ORDER BY created_at DESC LIMIT 1`, [m.de])
  const conversacionNueva = !ultimo
    || ahora.getTime() - new Date(ultimo.created_at.replace(' ', 'T') + 'Z').getTime() > HORAS_CONVERSACION_NUEVA * 3600 * 1000

  let p = await prospectoDelTelefono(m.de)
  // El WhatsApp de su empresa contestó solo: queda guardado y anotado, pero nada más cambia.
  if (p && tipo === 'respuesta' && !m.medio && esAutorespuestaWhatsApp(m.texto)) {
    await execute(
      `INSERT INTO mensajes_whatsapp (id, prospecto_id, direccion, telefono, nombre, tipo, texto, estado, created_at)
       VALUES (?, ?, 'entrante', ?, ?, ?, ?, 'autorespuesta', ?)`,
      [m.wamid, p.id, m.de, m.nombre, m.tipo, m.texto, fechaSql(m.fecha)])
    const cita = m.texto.replace(/\s+/g, ' ').trim()
    await registrarHistorial({ prospecto_id: p.id, estado_anterior: p.estado, estado_nuevo: p.estado, user_id: null,
      nota: `Su WhatsApp respondió con un mensaje automático (no cuenta como respuesta; los seguimientos siguen): «${cita.length > 200 ? cita.slice(0, 200) + '…' : cita}»` })
    return { wamid: m.wamid, accion: 'autorespuesta', tipo, prospectoId: p.id }
  }
  let accion: ResultadoEntranteWA['accion']
  if (!p) {
    p = await crearProspectoDesdeWhatsApp(m, hoy)
    accion = 'creado'
  } else {
    accion = conversacionNueva || tipo !== 'respuesta' ? 'existente' : 'conversacion'
    // Nos escribió por WhatsApp: se le puede responder y hacer seguimiento por ahí.
    if (!p.whatsapp_ok && tipo === 'respuesta') await execute(`UPDATE prospectos_isp SET whatsapp_ok = 1 WHERE id = ?`, [p.id])
  }

  await execute(
    `INSERT INTO mensajes_whatsapp (id, prospecto_id, direccion, telefono, nombre, tipo, texto, estado, created_at)
     VALUES (?, ?, 'entrante', ?, ?, ?, ?, 'recibido', ?)`,
    [m.wamid, p.id, m.de, m.nombre, m.tipo, m.texto, fechaSql(m.fecha)])

  if (accion === 'existente') {
    // Igual que una respuesta por correo: estado, cadencia, historial y aviso al responsable (el de un audio o archivo
    // sale aparte, con el archivo adjunto).
    await actuarSobreProspecto(p, tipo, { de: `+${m.de}${m.nombre ? ` (${m.nombre})` : ''}`, asunto: '', texto: m.texto, cabeceras: {}, responde: [] },
      hoy, 'whatsapp', !m.medio)
  }

  // "No me interesa" (queda en No interesado) o la baja (queda en No contactar): se le contesta una sola vez, y nada más.
  if ((tipo === 'no-interesado' && !p.baja) || tipo === 'baja') {
    const clase = tipo === 'baja' ? 'baja' : 'cierre'
    const yaRespondido = await queryOne(`SELECT 1 AS x FROM mensajes_whatsapp WHERE prospecto_id = ? AND direccion = 'saliente' AND tipo = ?`, [p.id, clase])
    if (!yaRespondido) {
      const nombre = m.nombre ?? p.webinar_nombre ?? p.representante
      const texto = tipo === 'baja' ? confirmacionBaja(nombre, p.empresa) : cierreNoInteresado(nombre, p.empresa)
      const r = await enviarTextoWhatsApp(m.de, texto)
      await execute(`INSERT INTO mensajes_whatsapp (id, prospecto_id, direccion, telefono, tipo, texto, estado, error) VALUES (?, ?, 'saliente', ?, ?, ?, ?, ?)`,
        [r.ok ? r.wamid : `error-${crypto.randomUUID()}`, p.id, m.de, clase, texto, r.ok ? 'automatico' : 'failed', r.ok ? null : r.error])
    }
    return { wamid: m.wamid, accion, tipo, prospectoId: p.id }
  }

  // Audios, fotos y documentos: la IA no los procesa. Se reenvían al responsable y la conversación pasa al equipo.
  if (m.medio && !p.baja) {
    await entregarArchivoAlEquipo(p, m, accion === 'creado')
    return { wamid: m.wamid, accion, tipo, prospectoId: p.id }
  }

  // Con la IA encendida, ella contesta (lib/ia-ventas.ts) y no sale la respuesta fija.
  const conIA = modoIA() !== 'apagada' && iaConfigurada()
  if (conIA && tipo === 'respuesta' && !p.baja) return { wamid: m.wamid, accion, tipo, prospectoId: p.id, paraIA: true }

  // Respuesta automática: solo al abrir conversación, nunca a quien pide la baja o dice que no le interesa.
  let respuesta: ResultadoEntranteWA['respuestaAutomatica']
  if (conversacionNueva && tipo === 'respuesta' && !p.baja) {
    const texto = respuestaAutomatica(m.nombre ?? p.webinar_nombre ?? p.representante)
    if (modoVentasAuto() === 'activo') {
      const r = await enviarTextoWhatsApp(m.de, texto)
      await guardarSaliente(p.id, m.de, texto, r, null, 'automatico')
      respuesta = r.ok ? 'enviada' : 'error'
    } else {
      respuesta = 'simulada'
    }
  }
  return { wamid: m.wamid, accion, tipo, prospectoId: p.id, respuestaAutomatica: respuesta }
}

const ETIQUETA_ARCHIVO: Record<string, string> = { audio: 'una nota de voz', voice: 'una nota de voz', image: 'una foto', video: 'un video', document: 'un documento' }
const EXTENSION: Record<string, string> = { 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/amr': 'amr',
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'application/pdf': 'pdf' }

/** Guarda el audio o archivo, se lo manda adjunto al responsable y deja la conversación en manos del equipo. */
async function entregarArchivoAlEquipo(p: ProspectoRow, m: MensajeWhatsApp, esNuevo: boolean) {
  const que = ETIQUETA_ARCHIVO[m.tipo] ?? 'un archivo'
  const d = await descargarMedio(m.medio!.id)
  const mime = (d.ok ? d.mime : m.medio!.mime) ?? 'application/octet-stream'
  await execute(`INSERT OR REPLACE INTO medios_whatsapp (wamid, mime, nombre, contenido, error) VALUES (?, ?, ?, ?, ?)`,
    [m.wamid, mime, m.medio!.nombre, d.ok ? d.contenido : null, d.ok ? null : d.error])
  const base = (m.medio!.nombre ?? `${que.replace(/^una? /, '').replace(/ /g, '-')}-${p.empresa}`).replace(/[\\/:*?"<>|]/g, '').slice(0, 80)
  const archivo = /\.[a-z0-9]{2,4}$/i.test(base) ? base : `${base}.${EXTENSION[mime.split(';')[0]] ?? 'bin'}`

  // En modo activo, un acuse corto (la ventana de 24 h está abierta: acaba de escribir). Solo la primera vez de la conversación.
  const yaLoTiene = !!(p as any).ia_pausada
  if (modoIA() === 'activa' && iaConfigurada() && !yaLoTiene) {
    const tuyo = que.replace(/^una /, 'tu ').replace(/^un /, 'tu ')
    const texto = `¡Gracias! Recibimos ${tuyo} y ${que.startsWith('un ') ? 'se lo' : 'se la'} pasamos a una persona del equipo, que te responde pronto por aquí.`
    const r = await enviarTextoWhatsApp(m.de, texto)
    await guardarSaliente(p.id, m.de, texto, r, null, 'automatico')
  }
  if (modoIA() !== 'apagada') await execute(`UPDATE prospectos_isp SET ia_pausada = 1, updated_at = datetime('now') WHERE id = ?`, [p.id])
  await registrarHistorial({ prospecto_id: p.id, estado_anterior: p.estado, estado_nuevo: p.estado, user_id: null,
    nota: `Envió ${que} por WhatsApp${d.ok ? '' : ' (no se pudo descargar: ' + d.error + ')'}: se le reenvió al responsable${modoIA() !== 'apagada' ? ' y la conversación pasa al equipo' : ''}` })
  await avisar(p.responsable_email, `${m.tipo === 'audio' || m.tipo === 'voice' ? '🎤' : '📎'} ${esNuevo ? 'Nuevo contacto por WhatsApp' : 'WhatsApp'}: ${p.empresa} envió ${que}`, [
    `<strong>${escHtml(p.empresa)}</strong> · +${escHtml(m.de)}${esNuevo ? ' · <em>nuevo prospecto a tu nombre (el nombre es el de su perfil de WhatsApp: confirma la empresa)</em>' : ''}`,
    d.ok ? `Va adjunto${m.texto && !/^\[/.test(m.texto) ? `, con el texto: «${escHtml(m.texto.slice(0, 300))}»` : ''}.` : `No se pudo descargar (${escHtml(d.error)}). Escúchalo o ábrelo desde WhatsApp Manager.`,
    'La IA no procesa audios ni archivos: respóndele tú desde su ficha en Prospectos (pestaña WhatsApp), dentro de las 24 horas siguientes a su mensaje.',
  ], d.ok ? [{ filename: archivo, content: d.contenido, contentType: mime }] : undefined)
}

/** Para la ficha: el archivo de un mensaje (audio, foto, documento). */
export async function medioDelMensaje(wamid: string) {
  await migrateWhatsApp()
  return queryOne<{ wamid: string; mime: string | null; nombre: string | null; contenido: ArrayBuffer | null; prospecto_id: string | null }>(
    `SELECT m.wamid, m.mime, m.nombre, m.contenido, w.prospecto_id FROM medios_whatsapp m JOIN mensajes_whatsapp w ON w.id = m.wamid WHERE m.wamid = ?`, [wamid])
}

async function crearProspectoDesdeWhatsApp(m: MensajeWhatsApp, hoy: string): Promise<ProspectoRow> {
  const responsable = await elegirResponsable()
  const puesto = Number((await queryOne<{ m: number }>(`SELECT COALESCE(MAX(puesto), 0) AS m FROM prospectos_isp`))?.m ?? 0) + 1
  const id = crypto.randomUUID()
  const empresa = m.nombre?.trim() || `+${m.de}`
  await execute(
    `INSERT INTO prospectos_isp (id, puesto, prioridad, empresa, representante, telefono, estado, proximo_paso, notas,
       responsable_id, campana, automatico, origen_lead, fecha_contacto, whatsapp_ok)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
    [id, puesto, 'E', empresa, m.nombre ?? null, `+${m.de}`, 'Respondió', 'Responder por WhatsApp y confirmar la empresa', null,
     responsable, 'whatsapp', 0, 'whatsapp', hoy])
  await registrarHistorial({ prospecto_id: id, estado_anterior: null, estado_nuevo: 'Respondió', user_id: null,
    nota: `Escribió al WhatsApp de Owl: «${m.texto.slice(0, 300)}»` })
  const p = (await queryOne<ProspectoRow>(`${SELECT_PROSPECTO} WHERE p.id = ?`, [id]))!
  // Si llegó con un audio o archivo, el aviso sale aparte con el adjunto (entregarArchivoAlEquipo).
  if (!m.medio) await avisar(p.responsable_email, `🆕 Nuevo contacto por WhatsApp: ${empresa}`, [
    `<strong>${escHtml(empresa)}</strong> · +${escHtml(m.de)}`,
    `«${escHtml(m.texto.slice(0, 600))}»`,
    'Quedó como prospecto a tu nombre. El nombre es el de su perfil de WhatsApp: confirma la empresa al responderle.',
    'Respóndele desde su ficha en Prospectos (pestaña WhatsApp): tienes 24 horas desde su último mensaje.',
  ])
  return p
}

async function guardarSaliente(prospectoId: string, telefono: string, texto: string, r: EnvioWhatsApp, userId: string | null, origen: 'automatico' | 'equipo') {
  await execute(
    `INSERT INTO mensajes_whatsapp (id, prospecto_id, direccion, telefono, tipo, texto, estado, error, user_id)
     VALUES (?, ?, 'saliente', ?, 'text', ?, ?, ?, ?)`,
    [r.ok ? r.wamid : `error-${crypto.randomUUID()}`, prospectoId, telefono, texto, r.ok ? (origen === 'automatico' ? 'automatico' : 'sent') : 'failed',
     r.ok ? null : r.error, userId])
}

/** Actualiza el estado (entregado, leído, fallido) de lo que enviamos. */
export async function procesarEstadoWhatsApp(s: EstadoWhatsApp) {
  await migrateWhatsApp()
  const orden = ['sent', 'delivered', 'read']
  const fila = await queryOne<{ estado: string | null }>(`SELECT estado FROM mensajes_whatsapp WHERE id = ? AND direccion = 'saliente'`, [s.wamid])
  if (!fila) return
  // Los webhooks pueden llegar en desorden: "leído" no vuelve a "entregado".
  if (s.estado !== 'failed' && orden.indexOf(s.estado) <= orden.indexOf(fila.estado ?? '')) return
  if (s.estado === 'sent' && ['automatico', 'ia', 'plantilla'].includes(fila.estado ?? '')) return   // ya dice quién lo envió
  await execute(`UPDATE mensajes_whatsapp SET estado = ?, error = COALESCE(?, error) WHERE id = ?`, [s.estado, s.error, s.wamid])
}

// ── Lo que usa la ficha ─────────────────────────────────────────────────────────────────────────────────────

export interface ConversacionWA {
  telefono: string | null
  mensajes: FilaWhatsApp[]
  ventanaAbierta: boolean
  /** Hasta cuándo se puede responder (ISO), si la ventana está abierta. */
  ventanaHasta: string | null
  ia: { modo: 'activa' | 'borrador' | 'apagada'; pausada: boolean; borrador: { id: string; texto: string; motivo: string | null } | null }
}

export async function conversacionDelProspecto(p: ProspectoRow, ahora = new Date()): Promise<ConversacionWA> {
  await migrateWhatsApp()
  await migrateIA()
  const mensajes = await queryAll<FilaWhatsApp>(
    `SELECT w.*, u.nombre AS user_nombre,
       (SELECT r.accion FROM ia_respuestas r WHERE r.responde_a = w.id ORDER BY r.created_at DESC LIMIT 1) AS ia_accion,
       (SELECT r.motivo FROM ia_respuestas r WHERE r.responde_a = w.id ORDER BY r.created_at DESC LIMIT 1) AS ia_motivo,
       (SELECT r.estado FROM ia_respuestas r WHERE r.responde_a = w.id ORDER BY r.created_at DESC LIMIT 1) AS ia_estado,
       (SELECT md.mime FROM medios_whatsapp md WHERE md.wamid = w.id AND md.contenido IS NOT NULL) AS medio_mime
     FROM mensajes_whatsapp w LEFT JOIN users u ON u.id = w.user_id
     WHERE w.prospecto_id = ? ORDER BY w.created_at, w.rowid`, [p.id])
  const ultimoEntrante = [...mensajes].reverse().find(m => m.direccion === 'entrante')
  const abierta = ventanaAbierta(ultimoEntrante?.created_at, ahora)
  const telefono = ultimoEntrante?.telefono ?? celularParaWhatsApp(p.telefono) ?? celularParaWhatsApp(p.webinar_telefono)
  const pausada = !!(await queryOne<{ ia_pausada: number }>(`SELECT ia_pausada FROM prospectos_isp WHERE id = ?`, [p.id]))?.ia_pausada
  const b = abierta ? await borradorPendiente(p.id) : undefined
  return {
    ia: { modo: modoIA(), pausada, borrador: b ? { id: b.id, texto: b.texto, motivo: b.motivo } : null },
    telefono, mensajes, ventanaAbierta: abierta,
    ventanaHasta: abierta && ultimoEntrante ? new Date(new Date(ultimoEntrante.created_at.replace(' ', 'T') + 'Z').getTime() + 24 * 3600 * 1000).toISOString() : null,
  }
}

/** Respuesta escrita por alguien del equipo desde la ficha. */
export async function responderDesdeLaFicha(p: ProspectoRow, texto: string, userId: string, ahora = new Date(), usoBorrador = false, comoResumen = false):
  Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const limpio = texto.trim()
  if (!limpio) return { ok: false, error: 'El mensaje está vacío', status: 400 }
  if (limpio.length > 4000) return { ok: false, error: 'El mensaje es demasiado largo (máximo 4.000 caracteres)', status: 400 }
  const c = await conversacionDelProspecto(p, ahora)
  // El resumen de la reunión sale aunque la ventana esté cerrada: como plantilla (owl_resumen_reunion).
  if (comoResumen && !c.ventanaAbierta) {
    const tel = c.telefono
    if (!tel) return { ok: false, status: 400, error: 'No tiene un celular válido para WhatsApp.' }
    if (!p.whatsapp_ok) return { ok: false, status: 400, error: 'No aceptó mensajes de Owl por WhatsApp: márcalo en la ficha si lo aceptó en la reunión, o envíale el resumen por correo.' }
    const parametros = [limpiarVariable(nombreParaSaludar(p.webinar_nombre || p.representante) ?? '') || 'equipo', limpiarVariable(limpio)]
    const r = await enviarPlantillaWhatsApp(tel, 'owl_resumen_reunion', parametros)
    if (!r.ok) return { ok: false, status: 502, error: `WhatsApp no aceptó el resumen: ${r.error}` }
    await execute(`INSERT INTO mensajes_whatsapp (id, prospecto_id, direccion, telefono, tipo, texto, estado, user_id) VALUES (?, ?, 'saliente', ?, 'template', ?, 'sent', ?)`,
      [r.wamid, p.id, tel, textoDePlantilla('owl_resumen_reunion', parametros), userId])
    await registrarHistorial({ prospecto_id: p.id, estado_anterior: p.estado, estado_nuevo: p.estado, user_id: userId, nota: 'Resumen de la reunión enviado por WhatsApp' })
    return { ok: true }
  }
  // Con la ventana abierta, el resumen sale como texto, con el mismo saludo y cierre de la plantilla.
  const aEnviar = comoResumen
    ? textoDePlantilla('owl_resumen_reunion', [nombreParaSaludar(p.webinar_nombre || p.representante) ?? 'equipo', limpio]).trim()
    : limpio
  if (!c.ventanaAbierta || !c.telefono) {
    return { ok: false, status: 409, error: 'Pasaron más de 24 horas desde su último mensaje: WhatsApp solo deja responder cuando vuelva a escribir. Escríbele por correo.' }
  }
  const r = await enviarTextoWhatsApp(c.telefono, aEnviar)
  await guardarSaliente(p.id, c.telefono, aEnviar, r, userId, 'equipo')
  if (!r.ok) return { ok: false, status: 502, error: `WhatsApp no aceptó el mensaje: ${r.error}` }
  await equipoRespondio(p.id, usoBorrador || comoResumen)   // mensaje propio: la conversación la lleva el equipo y la IA se calla
  await execute(`UPDATE prospectos_isp SET updated_at = datetime('now') WHERE id = ?`, [p.id])
  return { ok: true }
}
