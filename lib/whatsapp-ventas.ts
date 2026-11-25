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
import { enviarTextoWhatsApp, ventanaAbierta, type MensajeWhatsApp, type EstadoWhatsApp, type EnvioWhatsApp } from './whatsapp-api'
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
  await execute(`
    CREATE TABLE IF NOT EXISTS mensajes_whatsapp (
      id           TEXT PRIMARY KEY,         -- wamid de Meta
      prospecto_id TEXT,
      direccion    TEXT NOT NULL,            -- entrante | saliente
      telefono     TEXT NOT NULL,            -- 57XXXXXXXXXX
      nombre       TEXT,
      tipo         TEXT,
      texto        TEXT NOT NULL,
      estado       TEXT,                     -- recibido | automatico | sent | delivered | read | failed
      error        TEXT,
      user_id      TEXT,                     -- quién respondió (null = sistema)
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    )`)
  await execute(`CREATE INDEX IF NOT EXISTS idx_wa_prospecto ON mensajes_whatsapp(prospecto_id, created_at)`)
  await execute(`CREATE INDEX IF NOT EXISTS idx_wa_telefono ON mensajes_whatsapp(telefono, created_at)`)
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

export interface ResultadoEntranteWA {
  wamid: string
  accion: 'duplicado' | 'existente' | 'creado' | 'conversacion'
  tipo: 'baja' | 'no-interesado' | 'respuesta'
  prospectoId: string
  respuestaAutomatica?: 'enviada' | 'simulada' | 'error'
  /** La IA (fase 4) debe atender este mensaje: la ruta del webhook la llama después de responderle a Meta. */
  paraIA?: boolean
}

/** Procesa un mensaje que llegó por WhatsApp. Es idempotente: Meta puede mandar el mismo webhook más de una vez. */
export async function procesarMensajeWhatsApp(m: MensajeWhatsApp, ahora = new Date()): Promise<ResultadoEntranteWA> {
  await migrateWhatsApp()
  const tipo = pideBaja(m.texto) ? 'baja' : noInteresado(m.texto) ? 'no-interesado' : 'respuesta'
  const previo = await queryOne<{ prospecto_id: string }>(`SELECT prospecto_id FROM mensajes_whatsapp WHERE id = ?`, [m.wamid])
  if (previo) return { wamid: m.wamid, accion: 'duplicado', tipo, prospectoId: previo.prospecto_id }

  const hoy = hoyBogota(ahora)
  const ultimo = await queryOne<{ created_at: string }>(
    `SELECT created_at FROM mensajes_whatsapp WHERE telefono = ? AND direccion = 'entrante' ORDER BY created_at DESC LIMIT 1`, [m.de])
  const conversacionNueva = !ultimo
    || ahora.getTime() - new Date(ultimo.created_at.replace(' ', 'T') + 'Z').getTime() > HORAS_CONVERSACION_NUEVA * 3600 * 1000

  let p = await prospectoDelTelefono(m.de)
  let accion: ResultadoEntranteWA['accion']
  if (!p) {
    p = await crearProspectoDesdeWhatsApp(m, hoy)
    accion = 'creado'
  } else {
    accion = conversacionNueva || tipo !== 'respuesta' ? 'existente' : 'conversacion'
  }

  await execute(
    `INSERT INTO mensajes_whatsapp (id, prospecto_id, direccion, telefono, nombre, tipo, texto, estado, created_at)
     VALUES (?, ?, 'entrante', ?, ?, ?, ?, 'recibido', ?)`,
    [m.wamid, p.id, m.de, m.nombre, m.tipo, m.texto, fechaSql(m.fecha)])

  if (accion === 'existente') {
    // Igual que una respuesta por correo: estado, cadencia, historial y aviso al responsable.
    await actuarSobreProspecto(p, tipo, { de: `+${m.de}${m.nombre ? ` (${m.nombre})` : ''}`, asunto: '', texto: m.texto, cabeceras: {}, responde: [] },
      hoy, 'whatsapp')
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

async function crearProspectoDesdeWhatsApp(m: MensajeWhatsApp, hoy: string): Promise<ProspectoRow> {
  const responsable = await elegirResponsable()
  const puesto = Number((await queryOne<{ m: number }>(`SELECT COALESCE(MAX(puesto), 0) AS m FROM prospectos_isp`))?.m ?? 0) + 1
  const id = crypto.randomUUID()
  const empresa = m.nombre?.trim() || `+${m.de}`
  await execute(
    `INSERT INTO prospectos_isp (id, puesto, prioridad, empresa, representante, telefono, estado, proximo_paso, notas,
       responsable_id, campana, automatico, origen_lead, fecha_contacto)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, puesto, 'E', empresa, m.nombre ?? null, `+${m.de}`, 'Respondió', 'Responder por WhatsApp y confirmar la empresa', null,
     responsable, 'whatsapp', 0, 'whatsapp', hoy])
  await registrarHistorial({ prospecto_id: id, estado_anterior: null, estado_nuevo: 'Respondió', user_id: null,
    nota: `Escribió al WhatsApp de Owl: «${m.texto.slice(0, 300)}»` })
  const p = (await queryOne<ProspectoRow>(`${SELECT_PROSPECTO} WHERE p.id = ?`, [id]))!
  await avisar(p.responsable_email, `🆕 Nuevo contacto por WhatsApp: ${empresa}`, [
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
  if (s.estado === 'sent' && (fila.estado === 'automatico' || fila.estado === 'ia')) return   // ya dice quién lo envió
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
    `SELECT w.*, u.nombre AS user_nombre FROM mensajes_whatsapp w LEFT JOIN users u ON u.id = w.user_id
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
export async function responderDesdeLaFicha(p: ProspectoRow, texto: string, userId: string, ahora = new Date(), usoBorrador = false):
  Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const limpio = texto.trim()
  if (!limpio) return { ok: false, error: 'El mensaje está vacío', status: 400 }
  if (limpio.length > 4000) return { ok: false, error: 'El mensaje es demasiado largo (máximo 4.000 caracteres)', status: 400 }
  const c = await conversacionDelProspecto(p, ahora)
  if (!c.ventanaAbierta || !c.telefono) {
    return { ok: false, status: 409, error: 'Pasaron más de 24 horas desde su último mensaje: WhatsApp solo deja responder cuando vuelva a escribir. Escríbele por correo.' }
  }
  const r = await enviarTextoWhatsApp(c.telefono, limpio)
  await guardarSaliente(p.id, c.telefono, limpio, r, userId, 'equipo')
  if (!r.ok) return { ok: false, status: 502, error: `WhatsApp no aceptó el mensaje: ${r.error}` }
  await equipoRespondio(p.id, usoBorrador)   // mensaje propio: la conversación la lleva el equipo y la IA se calla
  await execute(`UPDATE prospectos_isp SET updated_at = datetime('now') WHERE id = ?`, [p.id])
  return { ok: true }
}
