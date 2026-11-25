/**
 * lib/ia-ventas.ts
 * Fase 4 de docs/automatizacion-ventas.md: la IA (Claude, de Anthropic) contesta los WhatsApp de los prospectos.
 *
 * Interruptor IA_VENTAS:
 *   - "activa":   la IA responde sola (dentro de la ventana de 24 h de Meta).
 *   - "borrador": la IA escribe la respuesta, pero la envía una persona desde la ficha (pestaña WhatsApp).
 *   - cualquier otro valor o sin definir: apagada (queda la respuesta automática fija de la fase 3).
 * Otras variables: ANTHROPIC_API_KEY (con límite de gasto mensual en console.anthropic.com), IA_MODELO (opcional).
 *
 * Seguridad:
 *   - Si la IA decide pasar a una persona, o alguien del equipo responde desde la ficha, la IA se calla con ese prospecto
 *     (ia_pausada = 1) hasta que alguien la devuelva desde la ficha.
 *   - Máximo IA_MAX_RESPUESTAS_DIA respuestas por prospecto al día (por defecto 6) y IA_MAX_LLAMADAS_DIA llamadas en total
 *     (por defecto 300): si se pasa, la conversación queda para el equipo.
 *   - Si llegan varios mensajes seguidos, responde una sola vez, al último (espera unos segundos a que termine de escribir).
 *   - Cualquier error, negativa del modelo o respuesta incompleta = pasa a una persona. Nunca se envía algo a medias.
 */
import crypto from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { queryAll, queryOne, execute } from './db'
import { registrarHistorial, type ProspectoRow } from './prospectos-db'
import { INSTRUCCIONES_IA, ESQUEMA_RESPUESTA_IA, PRECIOS_REFERENCIA } from './ia-conocimiento'
import { enviarTextoWhatsApp, ventanaAbierta } from './whatsapp-api'
import { hoyBogota } from './ventas'
import { avisar, escHtml, SELECT_PROSPECTO } from './ventas-auto'
import type { FilaWhatsApp } from './whatsapp-ventas'

export type ModoIA = 'activa' | 'borrador' | 'apagada'
export const modoIA = (): ModoIA => {
  const v = process.env.IA_VENTAS
  return v === 'activa' || v === 'borrador' ? v : 'apagada'
}
export const iaConfigurada = () => !!process.env.ANTHROPIC_API_KEY

/** Claude Sonnet 5.5: el punto medio entre calidad y costo que eligió el superadmin. */
export const modeloIA = () => process.env.IA_MODELO || 'claude-sonnet-5-5'
const maxRespuestasDia = () => Number(process.env.IA_MAX_RESPUESTAS_DIA) || 6
const maxLlamadasDia = () => Number(process.env.IA_MAX_LLAMADAS_DIA) || 300
/** Segundos que se espera antes de contestar, por si la persona manda varios mensajes seguidos. */
export const ESPERA_SEGUNDOS = 15

let _migrado = false
export async function migrateIA() {
  if (_migrado) return
  _migrado = true
  for (const sql of [`ALTER TABLE prospectos_isp ADD COLUMN ia_pausada INTEGER NOT NULL DEFAULT 0`]) {
    try { await execute(sql) } catch { /* ya existe */ }
  }
  await execute(`
    CREATE TABLE IF NOT EXISTS ia_respuestas (
      id            TEXT PRIMARY KEY,
      prospecto_id  TEXT NOT NULL,
      responde_a    TEXT NOT NULL,       -- wamid del mensaje del prospecto
      modo          TEXT NOT NULL,       -- activa | borrador
      accion        TEXT NOT NULL,       -- responder | pasar_a_humano | no_responder | error
      texto         TEXT,
      motivo        TEXT,
      estado        TEXT NOT NULL,       -- enviada | pendiente (borrador) | usada | descartada | no-enviada
      modelo        TEXT,
      tokens_entrada INTEGER, tokens_salida INTEGER, tokens_cache INTEGER,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )`)
  await execute(`CREATE INDEX IF NOT EXISTS idx_ia_prospecto ON ia_respuestas(prospecto_id, created_at)`)
}

export interface DecisionIA {
  accion: 'responder' | 'pasar_a_humano' | 'no_responder'
  mensaje: string
  motivo: string
  uso?: { entrada: number; salida: number; cache: number }
}

let _cliente: Anthropic | null = null
const cliente = () => (_cliente ??= new Anthropic({ timeout: 60000, maxRetries: 2 }))
/** Para las pruebas. */
export function _usarCliente(c: any) { _cliente = c }

const fechaCorta = (s: string) => new Date(s.replace(' ', 'T') + 'Z').toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' })
/** El texto del prospecto va entre etiquetas: que no pueda cerrarlas para colar instrucciones. */
const limpio = (s: string) => s.replace(/<\/?conversacion>/gi, '').slice(0, 3000)

/** Lo que recibe la IA en cada llamada: datos del prospecto y la conversación (lo que cambia; las reglas van en caché). */
export function armarPedido(p: ProspectoRow, mensajes: FilaWhatsApp[]): string {
  const datos = [
    `Empresa (según nuestro sistema; si llegó por WhatsApp puede ser solo el nombre de su perfil): ${p.empresa}`,
    p.webinar_nombre || p.representante ? `Contacto: ${p.webinar_nombre || p.representante}` : null,
    `Estado en el embudo de Owl: ${p.estado}`,
    p.campana === 'webinar' ? 'Se inscribió al webinar de Owl sobre cumplimiento regulatorio.' : null,
    p.campana === 'web' ? 'Llegó por un formulario de la web de Owl.' : null,
    (p as any).radiografia_en ? 'Ya recibió su radiografía regulatoria.' : null,
    p.estado === 'Cliente' ? 'Ya es cliente de Owl.' : null,
  ].filter(Boolean).join('\n')
  const conversacion = mensajes.slice(-30).map(m =>
    `[${fechaCorta(m.created_at)}] ${m.direccion === 'entrante' ? 'Prospecto' : 'Owl'}: ${limpio(m.texto)}`).join('\n')
  return `Datos del prospecto:\n${datos}\n\nConversación por WhatsApp, de la más antigua a la más reciente:\n<conversacion>\n${conversacion}\n</conversacion>\n\n` +
    'Decide qué hacer con lo que el prospecto escribió desde la última respuesta de Owl (puede ser más de un mensaje) y, si corresponde, escribe una sola respuesta que conteste todo.'
}

/** Le pide a Claude la siguiente respuesta. Nunca lanza: ante cualquier problema, decide pasar a una persona. */
export async function pedirRespuestaIA(p: ProspectoRow, mensajes: FilaWhatsApp[]): Promise<DecisionIA> {
  const humano = (motivo: string): DecisionIA => ({ accion: 'pasar_a_humano', mensaje: '', motivo })
  try {
    const r: any = await (cliente().beta.messages.create as any)({
      model: modeloIA(),
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: INSTRUCCIONES_IA, cache_control: { type: 'ephemeral' } }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA_RESPUESTA_IA } },
      messages: [{ role: 'user', content: armarPedido(p, mensajes) }],
    })
    const uso = { entrada: r.usage?.input_tokens ?? 0, salida: r.usage?.output_tokens ?? 0, cache: r.usage?.cache_read_input_tokens ?? 0 }
    if (r.stop_reason === 'refusal') return { ...humano('El modelo no quiso responder este mensaje'), uso }
    if (r.stop_reason === 'max_tokens') return { ...humano('La respuesta del modelo quedó incompleta'), uso }
    const texto = (r.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
    let d: any
    try { d = JSON.parse(texto) } catch { return { ...humano('La respuesta del modelo no se pudo leer'), uso } }
    if (!['responder', 'pasar_a_humano', 'no_responder'].includes(d?.accion)) return { ...humano('Decisión desconocida del modelo'), uso }
    const mensaje = String(d.mensaje ?? '').trim()
    if (d.accion === 'responder' && !mensaje) return { ...humano('El modelo decidió responder pero no escribió nada'), uso }
    return { accion: d.accion, mensaje, motivo: String(d.motivo ?? '').trim(), uso }
  } catch (e: any) {
    return humano(`Error al llamar a la IA: ${e?.message ?? e}`)
  }
}

/** Revisión de forma antes de enviar: lo que nunca debe salir aunque el modelo lo escriba. */
export function problemaDelTexto(texto: string, opciones: { avisoDePaso?: boolean } = {}): string | null {
  if (texto.length > 1200) return 'demasiado largo'
  // Los ISP venden "planes" de internet a sus usuarios; lo que no se dice es "plan" para la suscripción de Owl.
  if (/\bplan(es)?\s+(b[aá]sic|pro\b|premium|mensual|de owl)|\bnuestros planes\b|\bnuestro plan\b/i.test(texto)) return 'dice "plan" (debe ser "suscripción")'
  // Precios: solo los de referencia, escritos tal cual; nada de descuentos ni porcentajes.
  const permitidosPrecio = new Set<string>(Object.values(PRECIOS_REFERENCIA))
  const montos = texto.match(/\$\s?\d[\d.,]*\d|\$\s?\d/g) ?? []
  if (montos.some(m => !permitidosPrecio.has(m.replace(/\s/g, '')))) return 'menciona un precio que no es de referencia'
  if (/\d[\d.,]*\s?(millones|mill[oó]n|mil pesos|mil\b|cop\b|pesos)/i.test(texto)) return 'menciona un precio que no es de referencia'
  // En el aviso de que lo atiende una persona puede decir que los descuentos los ve el equipo; nunca un porcentaje.
  if ((!opciones.avisoDePaso && /descuento/i.test(texto)) || /\d\s?%|por ciento/i.test(texto)) return 'menciona un descuento'
  if (/\b(30|45|60)\s*minutos/i.test(texto)) return 'la reunión no es de 15 minutos'
  const enlaces = texto.match(/https?:\/\/[^\s)]+/g) ?? []
  const permitidos = ['https://www.owlcompliance.com', 'https://calendar.app.google/']
  if (enlaces.some(u => !permitidos.some(b => u.startsWith(b)))) return 'incluye un enlace que no es de Owl'
  return null
}

export interface ResultadoIA {
  resultado: 'enviada' | 'borrador' | 'humano' | 'sin-respuesta' | 'omitida'
  motivo?: string
}

/**
 * Se llama unos segundos después de que llega un mensaje (`wamid`). Si para entonces llegó otro más nuevo del mismo número,
 * no hace nada (el más nuevo se encarga). `esperar` se puede poner en 0 en las pruebas.
 */
export async function atenderConIA(wamid: string, opciones: { esperar?: number; ahora?: () => Date } = {}): Promise<ResultadoIA> {
  const modo = modoIA()
  if (modo === 'apagada' || !iaConfigurada()) return { resultado: 'omitida', motivo: 'IA apagada' }
  await migrateIA()
  const esperar = opciones.esperar ?? ESPERA_SEGUNDOS * 1000
  if (esperar > 0) await new Promise(r => setTimeout(r, esperar))
  const ahora = opciones.ahora ?? (() => new Date())

  const m = await queryOne<FilaWhatsApp>(`SELECT * FROM mensajes_whatsapp WHERE id = ?`, [wamid])
  if (!m?.prospecto_id) return { resultado: 'omitida', motivo: 'mensaje sin prospecto' }
  const masNuevo = await queryOne<{ id: string }>(
    `SELECT id FROM mensajes_whatsapp WHERE prospecto_id = ? AND direccion = 'entrante' ORDER BY created_at DESC, rowid DESC LIMIT 1`, [m.prospecto_id])
  if (masNuevo?.id !== wamid) return { resultado: 'omitida', motivo: 'llegó un mensaje más nuevo' }
  if (await queryOne(`SELECT 1 FROM ia_respuestas WHERE responde_a = ?`, [wamid])) return { resultado: 'omitida', motivo: 'ya se atendió' }

  const p = await queryOne<ProspectoRow & { ia_pausada?: number }>(`${SELECT_PROSPECTO} WHERE p.id = ?`, [m.prospecto_id])
  if (!p) return { resultado: 'omitida', motivo: 'prospecto no existe' }
  if (p.baja || ['No contactar', 'No interesado'].includes(p.estado)) return { resultado: 'omitida', motivo: 'no se le escribe' }
  if (p.ia_pausada) return { resultado: 'omitida', motivo: 'la conversación la lleva el equipo' }
  if (!ventanaAbierta(m.created_at, ahora())) return { resultado: 'omitida', motivo: 'ventana cerrada' }

  const hoy = hoyBogota(ahora())
  const delDia = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM ia_respuestas WHERE prospecto_id = ? AND accion = 'responder' AND date(created_at, '-5 hours') = ?`, [p.id, hoy])
  const total = await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM ia_respuestas WHERE date(created_at, '-5 hours') = ?`, [hoy])
  if (Number(delDia?.n ?? 0) >= maxRespuestasDia() || Number(total?.n ?? 0) >= maxLlamadasDia()) {
    await pasarAHumano(p, wamid, modo, { accion: 'pasar_a_humano', mensaje: '', motivo: 'Se alcanzó el máximo de respuestas automáticas de hoy' })
    return { resultado: 'humano', motivo: 'tope diario' }
  }

  const mensajes = await queryAll<FilaWhatsApp>(
    `SELECT * FROM mensajes_whatsapp WHERE prospecto_id = ? AND estado <> 'failed' ORDER BY created_at, rowid`, [p.id])
  const d = await pedirRespuestaIA(p, mensajes)

  if (d.accion === 'no_responder') {
    await guardarRespuesta(p.id, wamid, modo, d, 'no-enviada')
    return { resultado: 'sin-respuesta', motivo: d.motivo }
  }
  if (d.accion === 'responder') {
    const problema = problemaDelTexto(d.mensaje)
    if (problema) {
      await pasarAHumano(p, wamid, modo, { ...d, accion: 'pasar_a_humano', mensaje: '', motivo: `La IA escribió algo que no se puede enviar (${problema}): «${d.mensaje.slice(0, 300)}»` })
      return { resultado: 'humano', motivo: problema }
    }
    if (modo === 'borrador') {
      await guardarRespuesta(p.id, wamid, modo, d, 'pendiente')
      return { resultado: 'borrador' }
    }
    const r = await enviarTextoWhatsApp(m.telefono, d.mensaje)
    if (!r.ok) {
      await pasarAHumano(p, wamid, modo, { ...d, accion: 'pasar_a_humano', motivo: `WhatsApp no aceptó la respuesta de la IA: ${r.error}` })
      return { resultado: 'humano', motivo: r.error }
    }
    await execute(
      `INSERT INTO mensajes_whatsapp (id, prospecto_id, direccion, telefono, tipo, texto, estado) VALUES (?, ?, 'saliente', ?, 'text', ?, 'ia')`,
      [r.wamid, p.id, m.telefono, d.mensaje])
    await guardarRespuesta(p.id, wamid, modo, d, 'enviada')
    return { resultado: 'enviada' }
  }
  await pasarAHumano(p, wamid, modo, d)
  return { resultado: 'humano', motivo: d.motivo }
}

async function guardarRespuesta(prospectoId: string, wamid: string, modo: ModoIA, d: DecisionIA, estado: string) {
  await execute(
    `INSERT INTO ia_respuestas (id, prospecto_id, responde_a, modo, accion, texto, motivo, estado, modelo, tokens_entrada, tokens_salida, tokens_cache)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [crypto.randomUUID(), prospectoId, wamid, modo, d.accion, d.mensaje || null, d.motivo || null, estado, modeloIA(),
     d.uso?.entrada ?? null, d.uso?.salida ?? null, d.uso?.cache ?? null])
}

/** La IA deja la conversación: se calla con este prospecto, se anota y se avisa al responsable. En modo activo, le dice
 *  al prospecto que una persona le escribe (si la IA escribió ese mensaje y pasa la revisión). */
async function pasarAHumano(p: ProspectoRow, wamid: string, modo: ModoIA, d: DecisionIA) {
  let aviso = 'no-enviada'
  if (modo === 'activa' && d.mensaje && !problemaDelTexto(d.mensaje, { avisoDePaso: true })) {
    const m = await queryOne<{ telefono: string }>(`SELECT telefono FROM mensajes_whatsapp WHERE id = ?`, [wamid])
    const r = m ? await enviarTextoWhatsApp(m.telefono, d.mensaje) : null
    if (r?.ok) {
      await execute(`INSERT INTO mensajes_whatsapp (id, prospecto_id, direccion, telefono, tipo, texto, estado) VALUES (?, ?, 'saliente', ?, 'text', ?, 'ia')`,
        [r.wamid, p.id, m!.telefono, d.mensaje])
      aviso = 'enviada'
    }
  }
  await guardarRespuesta(p.id, wamid, modo, d, aviso)
  await execute(`UPDATE prospectos_isp SET ia_pausada = 1, proximo_paso = 'Responder por WhatsApp (la IA lo pasó al equipo)', updated_at = datetime('now') WHERE id = ?`, [p.id])
  await registrarHistorial({ prospecto_id: p.id, estado_anterior: p.estado, estado_nuevo: p.estado, user_id: null,
    nota: `La IA pasó la conversación de WhatsApp al equipo: ${d.motivo}` })
  await avisar(p.responsable_email, `🙋 WhatsApp para ti: ${p.empresa}`, [
    `<strong>${escHtml(p.empresa)}</strong> necesita que alguien del equipo le responda por WhatsApp.`,
    `Por qué: ${escHtml(d.motivo)}`,
    aviso === 'enviada' ? 'La IA ya le dijo que una persona le escribe pronto.' : '',
    'Respóndele desde su ficha en Prospectos (pestaña WhatsApp): tienes 24 horas desde su último mensaje. La IA no le vuelve a escribir hasta que la reactives ahí.',
  ].filter(Boolean))
}

// ── Lo que usa la ficha ─────────────────────────────────────────────────────────────────────────────────────

/** El borrador pendiente más reciente (modo borrador), para mostrarlo en la ficha. */
export async function borradorPendiente(prospectoId: string) {
  await migrateIA()
  return queryOne<{ id: string; texto: string; motivo: string | null; created_at: string }>(
    `SELECT id, texto, motivo, created_at FROM ia_respuestas WHERE prospecto_id = ? AND estado = 'pendiente' ORDER BY created_at DESC LIMIT 1`, [prospectoId])
}

/**
 * Alguien del equipo respondió desde la ficha y los borradores pendientes quedan resueltos. Si envió el borrador de la IA
 * (modo borrador), la IA sigue atendiendo; si escribió su propio mensaje, la conversación es suya y la IA se calla.
 */
export async function equipoRespondio(prospectoId: string, usoBorrador: boolean) {
  await migrateIA()
  await execute(`UPDATE ia_respuestas SET estado = ? WHERE prospecto_id = ? AND estado = 'pendiente'`, [usoBorrador ? 'usada' : 'descartada', prospectoId])
  if (!usoBorrador) await execute(`UPDATE prospectos_isp SET ia_pausada = 1 WHERE id = ?`, [prospectoId])
}

/** Desde la ficha: la IA vuelve a atender (o deja de hacerlo) a este prospecto. */
export async function cambiarIAdelProspecto(prospectoId: string, activa: boolean, userId: string) {
  await migrateIA()
  const p = await queryOne<ProspectoRow>(`SELECT * FROM prospectos_isp WHERE id = ?`, [prospectoId])
  if (!p) return
  await execute(`UPDATE prospectos_isp SET ia_pausada = ? WHERE id = ?`, [activa ? 0 : 1, prospectoId])
  await registrarHistorial({ prospecto_id: prospectoId, estado_anterior: p.estado, estado_nuevo: p.estado, user_id: userId,
    nota: activa ? 'La IA vuelve a responderle por WhatsApp' : 'La IA deja de responderle por WhatsApp: lo atiende el equipo' })
}

/** Cuánto se ha gastado (tokens) en el mes, para el resumen. Precio aproximado de Sonnet 5.5: US$2 / US$10 por millón. */
export async function usoDelMes(mes = hoyBogota().slice(0, 7)) {
  await migrateIA()
  const r = await queryOne<{ n: number; e: number; s: number; c: number }>(
    `SELECT COUNT(*) AS n, COALESCE(SUM(tokens_entrada),0) AS e, COALESCE(SUM(tokens_salida),0) AS s, COALESCE(SUM(tokens_cache),0) AS c
     FROM ia_respuestas WHERE substr(date(created_at, '-5 hours'), 1, 7) = ?`, [mes])
  const n = Number(r?.n ?? 0), e = Number(r?.e ?? 0), s = Number(r?.s ?? 0), c = Number(r?.c ?? 0)
  return { llamadas: n, tokensEntrada: e, tokensSalida: s, tokensCache: c, dolaresAprox: Math.round(((e * 2 + c * 0.1 + s * 10) / 1e6) * 100) / 100 }
}
