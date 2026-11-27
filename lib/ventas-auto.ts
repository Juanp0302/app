/**
 * lib/ventas-auto.ts
 * Ventas automáticas, fase 1 (docs/automatizacion-ventas.md):
 *  - quien escribe por la web queda como prospecto, con responsable y la cadencia "entrante", y recibe respuesta de inmediato;
 *  - los prospectos en modo automático reciben su cadencia por correo (el primero con la radiografía adjunta), en días
 *    hábiles (lunes a viernes, sin festivos de Colombia) de 9 a. m. a 5 p. m.;
 *  - el buzón se lee cada ciclo: una respuesta detiene la cadencia y avisa al responsable; los rebotes, las bajas y los
 *    "no me interesa" se registran solos;
 *  - el superadmin recibe un resumen diario y una alerta cuando algo falla.
 *
 * Interruptor: VENTAS_AUTOMATICAS=activo envía de verdad. Con cualquier otro valor (o sin él) todo corre en simulación:
 * no se envía nada, no se avanza ninguna cadencia y el superadmin recibe, una vez al día, lo que se habría enviado.
 * El buzón sí se lee en simulación (no cambia nada en Gmail: no marca leídos).
 */
import crypto from 'crypto'
import { queryAll, queryOne, execute } from './db'
import { migrateProspectos, migrateRadiografiasTabla, registrarHistorial, type ProspectoRow } from './prospectos-db'
import { obtenerRadiografia } from './radiografias'
import { CADENCIAS, datosDelProspecto, sumarDiasHabiles, cadenciaDe, type CadenciaId } from './cadencias'
import { armarCorreo, asuntoInicial, clasificarEntrante, correosEn, despuesDeEnviar, destinatario, pasoCorreoDesde, primerCorreo, textoNuevo, type TipoEntrante } from './correo-ventas'
import { enlaceBaja, enlaceBajaDirecta, URL_APP } from './baja'
import { enviarSmtp, cuentaCorreo } from './smtp'
import { hoyBogota, soloDigitos } from './ventas'
import { nombreRemitente, celularParaWhatsApp } from './whatsapp'
import { enviarPlantillaWhatsApp, listarPlantillasMeta } from './whatsapp-api'
import { plantillaDelPaso, textoDePlantilla } from './plantillas-whatsapp'

export type ModoVentas = 'activo' | 'simulacion'
export const modoVentasAuto = (): ModoVentas => (process.env.VENTAS_AUTOMATICAS === 'activo' ? 'activo' : 'simulacion')

/** Máximo de correos de cadencia por ciclo (el ciclo corre cada hora): cuida el límite diario de Gmail y la reputación. */
export const MAX_ENVIOS_POR_CICLO = 30
/** Máximo de correos de cadencia por día: enviar cientos de correos fríos en un día desde el dominio lo manda a spam.
 *  Las respuestas inmediatas a quien escribe por la web no cuentan. */
export const MAX_ENVIOS_POR_DIA = 100
const HORA_INICIO_ENVIOS_CONST = 9
const HORA_FIN_ENVIOS_CONST = 17
/** WhatsApp por plantillas: Meta deja escribirle primero a 250 personas distintas al día (sin verificación del negocio). */
/** El superadmin pidió 50 contactos por WhatsApp al día (2026-11-26); se puede cambiar con WHATSAPP_MAX_POR_DIA en Render.
 *  Se reparten en los 8 ciclos del horario (9 a. m. a 4 p. m.) para que las respuestas no lleguen todas a la vez. */
export const MAX_WHATSAPP_POR_DIA = Math.max(0, Number(process.env.WHATSAPP_MAX_POR_DIA ?? 50) || 0)
export const MAX_WHATSAPP_POR_CICLO = Math.ceil(MAX_WHATSAPP_POR_DIA / (HORA_FIN_ENVIOS_CONST - HORA_INICIO_ENVIOS_CONST))
/** Después de tres fallos en el mismo paso, el prospecto vuelve a manual y se avisa. */
const MAX_FALLOS = 3

export const horaBogota = (d = new Date()) =>
  Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hourCycle: 'h23' }).format(d))

export const esDiaHabil = (fecha: string) => sumarDiasHabiles(fecha, 0) === fecha

/** Ventana de envío de los mensajes automáticos (hora de Bogotá): desde las 9:00 hasta antes de las 17:00. */
export const HORA_INICIO_ENVIOS = HORA_INICIO_ENVIOS_CONST
export const HORA_FIN_ENVIOS = HORA_FIN_ENVIOS_CONST
export const enHorarioDeEnvio = (fecha: string, hora: number) => esDiaHabil(fecha) && hora >= HORA_INICIO_ENVIOS && hora < HORA_FIN_ENVIOS

// ── Tablas ──────────────────────────────────────────────────────────────────────────────────────────────────

let _migrado = false
export async function migrateVentasAuto() {
  if (_migrado) return
  _migrado = true
  await migrateProspectos()
  await migrateRadiografiasTabla()
  await execute(`
    CREATE TABLE IF NOT EXISTS envios_correo (
      id           TEXT PRIMARY KEY,
      prospecto_id TEXT NOT NULL,
      cadencia     TEXT NOT NULL,
      paso         INTEGER NOT NULL,
      para         TEXT NOT NULL,
      asunto       TEXT NOT NULL,
      message_id   TEXT,
      estado       TEXT NOT NULL,          -- enviado | error
      error        TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    )`)
  await execute(`CREATE INDEX IF NOT EXISTS idx_envios_prospecto ON envios_correo(prospecto_id)`)
  await execute(`CREATE INDEX IF NOT EXISTS idx_envios_message ON envios_correo(message_id)`)
  // Conversaciones de WhatsApp (lib/whatsapp-ventas.ts); el ciclo también escribe aquí las plantillas que envía.
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
  // Audios, fotos y documentos que llegan por WhatsApp (se guardan para escucharlos en la ficha y reenviarlos al equipo).
  await execute(`
    CREATE TABLE IF NOT EXISTS medios_whatsapp (
      wamid      TEXT PRIMARY KEY,
      mime       TEXT,
      nombre     TEXT,
      contenido  BLOB,
      error      TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`)
  await execute(`
    CREATE TABLE IF NOT EXISTS ventas_auto_estado (
      clave      TEXT PRIMARY KEY,
      valor      TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`)
}

async function leerEstado(clave: string): Promise<string | null> {
  const r = await queryOne<{ valor: string | null }>(`SELECT valor FROM ventas_auto_estado WHERE clave = ?`, [clave])
  return r?.valor ?? null
}
async function guardarEstado(clave: string, valor: string) {
  await execute(
    `INSERT INTO ventas_auto_estado (clave, valor, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, updated_at = excluded.updated_at`, [clave, valor])
}

export const SELECT_PROSPECTO = `
  SELECT p.*, u.nombre AS responsable_nombre, u.email AS responsable_email, u.is_superadmin AS responsable_superadmin,
    (SELECT r.subido_en FROM radiografias r WHERE r.prospecto_id = p.id) AS radiografia_en
  FROM prospectos_isp p LEFT JOIN users u ON u.id = p.responsable_id`

const firmaDe = (p: ProspectoRow) =>
  (p.responsable_nombre ? nombreRemitente(p.responsable_nombre, !!p.responsable_superadmin) : null) ?? 'Juan Pablo'

async function correoSuperadmin(): Promise<string> {
  const r = await queryOne<{ email: string }>(`SELECT email FROM users WHERE is_superadmin = 1 ORDER BY created_at LIMIT 1`)
  return r?.email ?? 'contacto@owlcompliance.com'
}

export const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Aviso al responsable (o al superadmin si no tiene). Nunca lanza: un aviso que falla no detiene el ciclo. */
export async function avisar(para: string | null | undefined, asunto: string, lineas: string[], adjuntos?: { filename: string; content: Buffer; contentType?: string }[]) {
  const destino = para || (await correoSuperadmin())
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;">` +
    lineas.map(l => `<p style="margin:0 0 10px;">${l}</p>`).join('') +
    `<p style="margin:18px 0 0;"><a href="${URL_APP()}/dashboard/prospectos" style="color:#712529;">Abrir Prospectos</a></p></div>`
  await enviarSmtp({ para: destino, asunto, html, nombreRemitente: 'Owl Compliance · Ventas', adjuntos }).catch(() => null)
}

/** Alerta al superadmin, una sola vez al día por el mismo problema. */
export async function alertar(problema: string, detalle: string) {
  await migrateVentasAuto()
  const clave = `alerta:${crypto.createHash('sha1').update(problema).digest('hex').slice(0, 16)}`
  const hoy = hoyBogota()
  if ((await leerEstado(clave)) === hoy) return
  await guardarEstado(clave, hoy)
  await avisar(await correoSuperadmin(), `⚠ Ventas automáticas: ${problema}`, [
    `<strong>${escHtml(problema)}</strong>`, escHtml(detalle),
    'Mientras no se corrija, lo que dependa de esto no se está haciendo. Esta alerta no se repite hoy.',
  ])
}

// ── Envío de la cadencia por correo ─────────────────────────────────────────────────────────────────────────

export interface EnvioResultado {
  prospecto: string
  empresa: string
  para: string | null
  paso: string
  asunto: string | null
  resultado: 'enviado' | 'simulado' | 'error' | 'sin-correo' | 'sin-whatsapp' | 'sin-plantilla' | 'terminada'
  error?: string
  canal?: 'correo' | 'whatsapp'
}

/** Arma y (en modo activo) envía el paso que le toca al prospecto; luego programa el siguiente. */
export async function enviarPasoDelProspecto(p: ProspectoRow, hoy: string, modo: ModoVentas, plantillasAprobadas?: Set<string>): Promise<EnvioResultado> {
  if (p.canal_auto === 'whatsapp') return enviarPasoPorWhatsApp(p, hoy, modo, plantillasAprobadas)
  const cadencia = cadenciaDe(p)
  const base = { prospecto: p.id, empresa: p.empresa }
  const para = destinatario(p)
  const indice = pasoCorreoDesde(cadencia, Number(p.paso_cadencia ?? 0))

  if (indice === null) {
    if (modo === 'activo') await execute(`UPDATE prospectos_isp SET cadencia_estado = 'terminada', proxima_fecha = NULL, updated_at = datetime('now') WHERE id = ?`, [p.id])
    return { ...base, para, paso: '—', asunto: null, resultado: 'terminada' }
  }
  const titulo = CADENCIAS[cadencia].pasos[indice].titulo
  if (!para) {
    if (modo === 'activo') {
      await execute(`UPDATE prospectos_isp SET automatico = 0, updated_at = datetime('now') WHERE id = ?`, [p.id])
      await registrarHistorial({ prospecto_id: p.id, estado_anterior: p.estado, estado_nuevo: p.estado, user_id: null,
        nota: 'Sin correo válido: sale del modo automático y vuelve al trabajo manual' })
    }
    return { ...base, para: null, paso: titulo, asunto: null, resultado: 'sin-correo' }
  }

  const datos = datosDelProspecto(p, hoy)
  const correo = armarCorreo({ cadencia, indice, datos, remitente: firmaDe(p), enlaceBaja: enlaceBaja(p.id) })!
  // Los correos siguientes van en el mismo hilo que el primero; si el primero no salió de aquí, el asunto no lleva "Re:".
  const primero = await queryOne<{ message_id: string | null }>(
    `SELECT message_id FROM envios_correo WHERE prospecto_id = ? AND cadencia = ? AND estado = 'enviado' ORDER BY created_at LIMIT 1`, [p.id, cadencia])
  const asunto = indice > 0 && !primero ? asuntoInicial(cadencia, datos) : correo.asunto

  if (modo === 'simulacion') return { ...base, para, paso: titulo, asunto, resultado: 'simulado' }

  // Nunca el mismo paso dos veces (por ejemplo, si un ciclo se cortó después de enviar y antes de avanzar).
  const yaEnviado = await queryOne(`SELECT 1 AS x FROM envios_correo WHERE prospecto_id = ? AND cadencia = ? AND paso = ? AND estado = 'enviado'`, [p.id, cadencia, indice])
  if (!yaEnviado) {
    const adjuntos = []
    if (correo.adjuntarRadiografia) {
      const r = await obtenerRadiografia(p.id)
      if (r) adjuntos.push({ filename: `Radiografía regulatoria - ${datos.empresa ?? 'Owl Compliance'}.pdf`.replace(/[\\/:*?"<>|]/g, ''), content: Buffer.from(r.contenido), contentType: 'application/pdf' })
    }
    const r = await enviarSmtp({
      para, asunto, html: correo.html, texto: correo.texto,
      nombreRemitente: `${firmaDe(p)} · Owl Compliance`,
      enRespuestaA: primero?.message_id ?? null,
      cabeceras: { 'List-Unsubscribe': `<${enlaceBajaDirecta(p.id)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      adjuntos,
    })
    await execute(
      `INSERT INTO envios_correo (id, prospecto_id, cadencia, paso, para, asunto, message_id, estado, error) VALUES (?,?,?,?,?,?,?,?,?)`,
      [crypto.randomUUID(), p.id, cadencia, indice, para, asunto, r.ok ? r.messageId : null, r.ok ? 'enviado' : 'error', r.ok ? null : r.error])
    if (!r.ok) {
      const fallos = await queryOne<{ n: number }>(
        `SELECT COUNT(*) AS n FROM envios_correo WHERE prospecto_id = ? AND cadencia = ? AND paso = ? AND estado = 'error'`, [p.id, cadencia, indice])
      if (Number(fallos?.n ?? 0) >= MAX_FALLOS) {
        await execute(`UPDATE prospectos_isp SET automatico = 0, updated_at = datetime('now') WHERE id = ?`, [p.id])
        await registrarHistorial({ prospecto_id: p.id, estado_anterior: p.estado, estado_nuevo: p.estado, user_id: null,
          nota: `El correo automático falló ${MAX_FALLOS} veces (${r.error}): vuelve al trabajo manual` })
      }
      return { ...base, para, paso: titulo, asunto, resultado: 'error', error: r.error }
    }
  }

  const { siguiente, esperaDias } = despuesDeEnviar(cadencia, indice)
  const estado = ['Pendiente'].includes(p.estado) ? 'WA1 enviado' : p.estado
  await execute(
    `UPDATE prospectos_isp SET paso_cadencia = ?, proxima_fecha = ?, cadencia_estado = ?, estado = ?,
       fecha_contacto = COALESCE(fecha_contacto, ?), updated_at = datetime('now') WHERE id = ?`,
    [siguiente ?? CADENCIAS[cadencia].pasos.length, siguiente === null ? null : sumarDiasHabiles(hoy, esperaDias),
     siguiente === null ? 'terminada' : 'activa', estado, hoy, p.id])
  await registrarHistorial({ prospecto_id: p.id, estado_anterior: p.estado, estado_nuevo: estado, user_id: null,
    nota: `Correo automático enviado a ${para}: ${titulo}${correo.adjuntarRadiografia ? ' (con la radiografía)' : ''}` })
  return { ...base, para, paso: titulo, asunto, resultado: 'enviado' }
}

// ── Envío de la cadencia por WhatsApp (plantillas) ──────────────────────────────────────────────────────────

/** Celular al que se le escribe: el del webinar o, si no, el del prospecto. */
export const celularDe = (p: ProspectoRow) => celularParaWhatsApp(p.webinar_telefono) ?? celularParaWhatsApp(p.telefono)

/** Igual que el correo, pero con la plantilla de WhatsApp del paso. Solo a quien aceptó mensajes de Owl por WhatsApp. */
async function enviarPasoPorWhatsApp(p: ProspectoRow, hoy: string, modo: ModoVentas, aprobadas?: Set<string>): Promise<EnvioResultado> {
  const cadencia = cadenciaDe(p)
  const para = celularDe(p)
  const base = { prospecto: p.id, empresa: p.empresa, para: para ? `+${para}` : null, canal: 'whatsapp' as const }
  const indice = pasoCorreoDesde(cadencia, Number(p.paso_cadencia ?? 0))
  if (indice === null) {
    if (modo === 'activo') await execute(`UPDATE prospectos_isp SET cadencia_estado = 'terminada', proxima_fecha = NULL, updated_at = datetime('now') WHERE id = ?`, [p.id])
    return { ...base, paso: '—', asunto: null, resultado: 'terminada' }
  }
  const titulo = CADENCIAS[cadencia].pasos[indice].titulo
  const salir = async (resultado: 'sin-whatsapp' | 'sin-plantilla', nota: string): Promise<EnvioResultado> => {
    if (modo === 'activo') {
      await execute(`UPDATE prospectos_isp SET automatico = 0, updated_at = datetime('now') WHERE id = ?`, [p.id])
      await registrarHistorial({ prospecto_id: p.id, estado_anterior: p.estado, estado_nuevo: p.estado, user_id: null, nota })
    }
    return { ...base, paso: titulo, asunto: null, resultado }
  }
  if (!para) return salir('sin-whatsapp', 'Sin celular válido: sale del modo automático por WhatsApp y vuelve al trabajo manual')
  if (!p.whatsapp_ok) return salir('sin-whatsapp', 'No aceptó mensajes de Owl por WhatsApp: sale del modo automático y vuelve al trabajo manual')
  const pl = plantillaDelPaso(cadencia, indice, datosDelProspecto(p, hoy), p.id)
  if (!pl) return salir('sin-plantilla', `El paso "${titulo}" no tiene plantilla de WhatsApp: vuelve al trabajo manual`)
  // Mientras Meta no apruebe la plantilla, el paso espera (no cuenta como fallo).
  if (aprobadas && !aprobadas.has(pl.nombre)) return { ...base, paso: titulo, asunto: pl.nombre, resultado: 'sin-plantilla', error: `La plantilla ${pl.nombre} no está aprobada en Meta` }
  if (modo === 'simulacion') return { ...base, paso: titulo, asunto: pl.nombre, resultado: 'simulado' }

  const yaEnviado = await queryOne(`SELECT 1 AS x FROM envios_correo WHERE prospecto_id = ? AND cadencia = ? AND paso = ? AND estado = 'enviado'`, [p.id, cadencia, indice])
  const texto = textoDePlantilla(pl.nombre, pl.parametros)
  if (!yaEnviado) {
    const r = await enviarPlantillaWhatsApp(para, pl.nombre, pl.parametros, pl.boton)
    await execute(
      `INSERT INTO envios_correo (id, prospecto_id, cadencia, paso, para, asunto, message_id, estado, error) VALUES (?,?,?,?,?,?,?,?,?)`,
      [crypto.randomUUID(), p.id, cadencia, indice, `+${para}`, pl.nombre, r.ok ? r.wamid : null, r.ok ? 'enviado' : 'error', r.ok ? null : r.error])
    if (!r.ok) {
      const fallos = await queryOne<{ n: number }>(
        `SELECT COUNT(*) AS n FROM envios_correo WHERE prospecto_id = ? AND cadencia = ? AND paso = ? AND estado = 'error'`, [p.id, cadencia, indice])
      if (Number(fallos?.n ?? 0) >= MAX_FALLOS) {
        await execute(`UPDATE prospectos_isp SET automatico = 0, updated_at = datetime('now') WHERE id = ?`, [p.id])
        await registrarHistorial({ prospecto_id: p.id, estado_anterior: p.estado, estado_nuevo: p.estado, user_id: null,
          nota: `El WhatsApp automático falló ${MAX_FALLOS} veces (${r.error}): vuelve al trabajo manual` })
      }
      return { ...base, paso: titulo, asunto: pl.nombre, resultado: 'error', error: r.error }
    }
    // Queda en la conversación de la ficha (y la IA lo ve si la persona responde).
    await execute(
      `INSERT OR IGNORE INTO mensajes_whatsapp (id, prospecto_id, direccion, telefono, tipo, texto, estado) VALUES (?, ?, 'saliente', ?, 'template', ?, 'plantilla')`,
      [r.wamid, p.id, para, texto])
  }
  const { siguiente, esperaDias } = despuesDeEnviar(cadencia, indice)
  const estado = ['Pendiente'].includes(p.estado) ? 'WA1 enviado' : p.estado
  await execute(
    `UPDATE prospectos_isp SET paso_cadencia = ?, proxima_fecha = ?, cadencia_estado = ?, estado = ?,
       fecha_contacto = COALESCE(fecha_contacto, ?), updated_at = datetime('now') WHERE id = ?`,
    [siguiente ?? CADENCIAS[cadencia].pasos.length, siguiente === null ? null : sumarDiasHabiles(hoy, esperaDias),
     siguiente === null ? 'terminada' : 'activa', estado, hoy, p.id])
  await registrarHistorial({ prospecto_id: p.id, estado_anterior: p.estado, estado_nuevo: estado, user_id: null,
    nota: `WhatsApp automático enviado a +${para}: ${titulo} (plantilla ${pl.nombre})` })
  return { ...base, paso: titulo, asunto: pl.nombre, resultado: 'enviado' }
}

/** Los prospectos en modo automático a los que hoy les toca un mensaje por ese canal. */
export async function pendientesDeEnvio(hoy: string, limite = MAX_ENVIOS_POR_CICLO, canal: 'correo' | 'whatsapp' = 'correo'): Promise<ProspectoRow[]> {
  await migrateVentasAuto()
  return queryAll<ProspectoRow>(
    `${SELECT_PROSPECTO}
     WHERE p.automatico = 1 AND p.cadencia_estado = 'activa' AND p.baja = 0
       AND COALESCE(p.canal_auto, 'correo') = ? ${canal === 'correo' ? 'AND p.correo_invalido = 0' : ''}
       AND p.proxima_fecha IS NOT NULL AND p.proxima_fecha <= ?
       AND p.estado NOT IN ('No contactar', 'No interesado', 'Cliente')
     ORDER BY p.proxima_fecha, p.puesto LIMIT ?`, [canal, hoy, limite])
}

const pausa = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Envía lo que toca hoy: `limite` correos y `limiteWhatsApp` plantillas de WhatsApp. */
export async function procesarEnvios(hoy: string, modo: ModoVentas, limite = MAX_ENVIOS_POR_CICLO, limiteWhatsApp = MAX_WHATSAPP_POR_CICLO): Promise<EnvioResultado[]> {
  const out: EnvioResultado[] = []
  for (const p of limite > 0 ? await pendientesDeEnvio(hoy, limite, 'correo') : []) {
    out.push({ ...(await enviarPasoDelProspecto(p, hoy, modo)), canal: 'correo' })
    if (modo === 'activo') await pausa(1500)
  }
  const porWhatsApp = limiteWhatsApp > 0 ? await pendientesDeEnvio(hoy, limiteWhatsApp, 'whatsapp') : []
  if (porWhatsApp.length) {
    // Una sola consulta a Meta por ciclo: qué plantillas están aprobadas.
    const lista = await listarPlantillasMeta()
    const aprobadas = new Set(lista.ok ? lista.plantillas.filter(t => t.estado === 'APPROVED').map(t => t.nombre) : [])
    if (!lista.ok) await alertar('no se pudo consultar las plantillas de WhatsApp', lista.error)
    for (const p of porWhatsApp) {
      out.push(await enviarPasoDelProspecto(p, hoy, modo, aprobadas))
      if (modo === 'activo') await pausa(500)
    }
  }
  return out
}

// ── Lo que llega al buzón ───────────────────────────────────────────────────────────────────────────────────

export interface Entrante {
  de: string
  asunto: string
  texto: string
  cabeceras: Record<string, string | undefined>
  /** Message-ID a los que responde (In-Reply-To y References). */
  responde: string[]
}

export interface EntranteResultado { tipo: TipoEntrante | 'sin-prospecto'; empresa?: string; de: string }

async function prospectoDelCorreo(e: Entrante): Promise<ProspectoRow | undefined> {
  for (const mid of e.responde) {
    const r = await queryOne<{ prospecto_id: string }>(`SELECT prospecto_id FROM envios_correo WHERE message_id = ? LIMIT 1`, [mid])
    if (r) return queryOne<ProspectoRow>(`${SELECT_PROSPECTO} WHERE p.id = ?`, [r.prospecto_id])
  }
  const de = primerCorreo(e.de)
  if (!de || de === cuentaCorreo()?.toLowerCase()) return undefined
  return queryOne<ProspectoRow>(
    `${SELECT_PROSPECTO} WHERE instr(lower(COALESCE(p.webinar_correo, '')), ?) > 0 OR instr(lower(COALESCE(p.correo, '')), ?) > 0
     ORDER BY p.updated_at DESC LIMIT 1`, [de, de])
}

/** Registra un correo que llegó y actúa según lo que es. */
export async function procesarEntrante(e: Entrante, hoy = hoyBogota()): Promise<EntranteResultado> {
  await migrateVentasAuto()
  const tipo = clasificarEntrante(e)

  if (tipo === 'rebote') {
    // A quién no se le pudo entregar: un correo del aviso al que le hayamos escrito.
    const candidatos = correosEn(`${e.cabeceras['x-failed-recipients'] ?? ''}\n${e.texto}`)
    for (const c of candidatos) {
      const env = await queryOne<{ prospecto_id: string }>(`SELECT prospecto_id FROM envios_correo WHERE lower(para) = ? ORDER BY created_at DESC LIMIT 1`, [c])
      if (!env) continue
      const p = await queryOne<ProspectoRow>(`${SELECT_PROSPECTO} WHERE p.id = ?`, [env.prospecto_id])
      if (!p || p.correo_invalido) continue
      await execute(`UPDATE prospectos_isp SET correo_invalido = 1, automatico = 0, updated_at = datetime('now') WHERE id = ?`, [p.id])
      await registrarHistorial({ prospecto_id: p.id, estado_anterior: p.estado, estado_nuevo: p.estado, user_id: null,
        nota: `El correo ${c} rebotó: sale del modo automático` })
      await avisar(p.responsable_email, `Correo inválido: ${p.empresa}`, [
        `El correo <strong>${escHtml(c)}</strong> de <strong>${escHtml(p.empresa)}</strong> no existe o no recibe mensajes.`,
        'El prospecto salió del modo automático. Si tiene WhatsApp, su cadencia sigue en "Para hoy".'])
      return { tipo, empresa: p.empresa, de: e.de }
    }
    return { tipo: 'sin-prospecto', de: e.de }
  }
  if (tipo === 'automatica') return { tipo, de: e.de }

  const p = await prospectoDelCorreo(e)
  if (!p) return { tipo: 'sin-prospecto', de: e.de }
  await actuarSobreProspecto(p, tipo, e, hoy)
  return { tipo, empresa: p.empresa, de: e.de }
}

/** Respuesta, baja o "no me interesa" de un prospecto ya identificado: estado, cadencia, historial y aviso al responsable. */
export async function actuarSobreProspecto(p: ProspectoRow, tipo: 'baja' | 'no-interesado' | 'respuesta', e: Entrante, hoy: string,
  canal: 'correo' | 'whatsapp' = 'correo', avisarAlResponsable = true) {
  const propio = textoNuevo(e.texto).slice(0, 600)
  const cita = propio ? `«${propio.length > 300 ? propio.slice(0, 300) + '…' : propio}»` : '(sin texto)'
  let estado = p.estado
  const sets = [`automatico = 0`, `updated_at = datetime('now')`]
  const args: any[] = []
  if (tipo === 'baja') {
    estado = 'No contactar'
    sets.push(`baja = 1`, `baja_en = datetime('now')`, `cadencia_estado = CASE WHEN cadencia IS NULL THEN NULL ELSE 'terminada' END`, `proxima_fecha = NULL`)
  } else if (tipo === 'no-interesado') {
    estado = 'No interesado'
    sets.push(`cadencia_estado = CASE WHEN cadencia IS NULL THEN NULL ELSE 'terminada' END`, `proxima_fecha = NULL`)
  } else {
    if (['Pendiente', 'WA1 enviado', 'Llamada sin contacto'].includes(p.estado)) estado = 'Respondió'
    sets.push(`cadencia_estado = CASE WHEN cadencia_estado = 'activa' THEN 'respondio' ELSE cadencia_estado END`,
      `proxima_fecha = ?`, `proximo_paso = COALESCE(NULLIF(proximo_paso, ''), 'Agendar la reunión')`, `fecha_contacto = COALESCE(fecha_contacto, ?)`)
    args.push(hoy, hoy)
  }
  sets.push(`estado = ?`)
  args.push(estado)
  await execute(`UPDATE prospectos_isp SET ${sets.join(', ')} WHERE id = ?`, [...args, p.id])
  const medio = canal === 'whatsapp' ? 'WhatsApp' : 'correo'
  const que = tipo === 'baja' ? `Pidió la baja por ${medio}` : tipo === 'no-interesado' ? 'Respondió que no le interesa' : `Respondió por ${medio}`
  await registrarHistorial({ prospecto_id: p.id, estado_anterior: p.estado, estado_nuevo: estado, user_id: null, nota: `${que}: ${cita}` })
  if (avisarAlResponsable) await avisar(p.responsable_email, `${tipo === 'respuesta' ? '💬 Respondió' : que}: ${p.empresa}`, [
    `<strong>${escHtml(p.empresa)}</strong> · ${escHtml(e.de)}`,
    canal === 'correo' ? `Asunto: ${escHtml(e.asunto)}` : '',
    escHtml(cita).replace(/\n/g, '<br>'),
    tipo === 'respuesta'
      ? canal === 'whatsapp'
        ? 'La cadencia automática se detuvo. Respóndele desde su ficha en Prospectos (pestaña WhatsApp): tienes 24 horas desde su último mensaje.'
        : 'La cadencia automática se detuvo. Respóndele desde el buzón de Owl (en el mismo hilo) y agenda la reunión.'
      : tipo === 'baja' ? 'Quedó en "No contactar" y no recibirá más mensajes.' : 'Quedó en "No interesado" y la cadencia terminó.',
  ].filter(Boolean))
}

/** Lee del buzón (IMAP de Gmail) los correos que llegaron desde el último ciclo. No marca nada como leído. */
export async function procesarBuzon(hoy = hoyBogota(), maximo = 200): Promise<EntranteResultado[]> {
  await migrateVentasAuto()
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '')
  if (!user || !pass) throw new Error('GMAIL_USER o GMAIL_APP_PASSWORD no configurados: no se pueden leer las respuestas')
  const { ImapFlow } = await import('imapflow')
  const { simpleParser } = await import('mailparser')
  const cliente = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user, pass }, logger: false })
  await cliente.connect()
  const out: EntranteResultado[] = []
  const lock = await cliente.getMailboxLock('INBOX')
  try {
    const buzon = cliente.mailbox as { uidValidity: bigint; uidNext: number }
    const validez = String(buzon.uidValidity)
    let ultimo = Number(await leerEstado('imap_uid'))
    // La primera vez (o si Gmail renumeró el buzón) se empieza desde ahora: no se procesa el correo viejo.
    if (!ultimo || (await leerEstado('imap_validez')) !== validez) {
      await guardarEstado('imap_validez', validez)
      await guardarEstado('imap_uid', String(buzon.uidNext - 1))
      return out
    }
    let mayor = ultimo
    for await (const m of cliente.fetch(`${ultimo + 1}:*`, { uid: true, source: true }, { uid: true })) {
      if (m.uid <= ultimo || !m.source) continue
      if (out.length >= maximo) break
      const c = await simpleParser(m.source)
      const cab: Record<string, string | undefined> = {}
      for (const [k, v] of c.headers) cab[k.toLowerCase()] = typeof v === 'string' ? v : Array.isArray(v) ? v.join(', ') : (v as any)?.text ?? (v as any)?.value ?? String(v)
      const refs = Array.isArray(c.references) ? c.references : c.references ? [c.references] : []
      out.push(await procesarEntrante({
        de: c.from?.value?.[0]?.address ?? c.from?.text ?? '',
        asunto: c.subject ?? '',
        texto: c.text ?? '',
        cabeceras: cab,
        responde: [c.inReplyTo, ...refs].filter((x): x is string => !!x),
      }, hoy))
      mayor = Math.max(mayor, m.uid)
    }
    await guardarEstado('imap_uid', String(mayor))
  } finally {
    lock.release()
    await cliente.logout().catch(() => null)
  }
  return out
}

// ── Leads de la web ─────────────────────────────────────────────────────────────────────────────────────────

/** El responsable con menos prospectos que llegaron por la web (reparto parejo entre quienes ya tienen prospectos). */
export async function elegirResponsable(): Promise<string | null> {
  const r = await queryOne<{ id: string }>(
    `SELECT u.id FROM users u
     WHERE u.id IN (SELECT DISTINCT responsable_id FROM prospectos_isp WHERE responsable_id IS NOT NULL)
     ORDER BY (SELECT COUNT(*) FROM prospectos_isp p WHERE p.responsable_id = u.id AND p.campana IN ('web', 'whatsapp')), u.created_at
     LIMIT 1`)
  return r?.id ?? null
}

export interface LeadEntrante {
  id: number
  origen: string
  nombre?: string | null
  empresa?: string | null
  correo?: string | null
  telefono?: string | null
  mensaje?: string | null
  nit?: string | null
}

/**
 * Un lead que llegó por un formulario de la web. Si ya es prospecto, se anota y, si estaba en cadencia, cuenta como respuesta.
 * Si no, se crea con responsable y la cadencia "entrante", y en modo activo recibe la respuesta de inmediato.
 */
export async function prospectoDesdeLead(l: LeadEntrante, ahora = new Date()): Promise<{ accion: 'creado' | 'existente' | 'omitido'; prospectoId?: string; envio?: EnvioResultado }> {
  await migrateVentasAuto()
  const correo = primerCorreo(l.correo)
  const nit = soloDigitos(l.nit)
  if (/^webinar/.test(l.origen) || (!correo && !soloDigitos(l.telefono))) return { accion: 'omitido' }
  const hoy = hoyBogota(ahora)

  const existente = await queryOne<ProspectoRow>(
    `${SELECT_PROSPECTO}
     WHERE (? <> '' AND (instr(lower(COALESCE(p.correo, '')), ?) > 0 OR instr(lower(COALESCE(p.webinar_correo, '')), ?) > 0))
        OR (? <> '' AND p.nit = ?)
     ORDER BY p.updated_at DESC LIMIT 1`, [correo ?? '', correo ?? '', correo ?? '', nit, nit])
  const mensaje = (l.mensaje ?? '').trim()
  if (existente) {
    // Escribir por la web cuenta como respuesta (salvo que pida la baja o diga que no le interesa).
    const e: Entrante = { de: correo ?? l.telefono ?? '', asunto: `Formulario "${l.origen}" de la web`,
      texto: mensaje || `Escribió por el formulario "${l.origen}" de la web.`, cabeceras: {}, responde: [] }
    const tipo = clasificarEntrante(e)
    await actuarSobreProspecto(existente, tipo === 'baja' || tipo === 'no-interesado' ? tipo : 'respuesta', e, hoy)
    return { accion: 'existente', prospectoId: existente.id }
  }

  const responsable = await elegirResponsable()
  const puesto = Number((await queryOne<{ m: number }>(`SELECT COALESCE(MAX(puesto), 0) AS m FROM prospectos_isp`))?.m ?? 0) + 1
  const id = crypto.randomUUID()
  const empresa = (l.empresa ?? '').trim() || (l.nombre ?? '').trim() || correo || 'Sin nombre'
  await execute(
    `INSERT INTO prospectos_isp (id, puesto, prioridad, empresa, nit, representante, telefono, correo, estado, proximo_paso, notas,
       responsable_id, campana, cadencia, paso_cadencia, cadencia_estado, proxima_fecha, automatico, origen_lead, lead_id, fecha_contacto)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, puesto, 'E', empresa, nit || null, l.nombre ?? null, l.telefono ?? null, correo, 'Respondió', 'Agendar la reunión', mensaje || null,
     responsable, 'web', 'entrante', 0, 'activa', hoy, correo ? 1 : 0, l.origen, l.id, hoy])
  await registrarHistorial({ prospecto_id: id, estado_anterior: null, estado_nuevo: 'Respondió', user_id: null,
    nota: `Llegó por el formulario "${l.origen}" de la web${mensaje ? `: «${mensaje.slice(0, 300)}»` : ''}` })

  const p = (await queryOne<ProspectoRow>(`${SELECT_PROSPECTO} WHERE p.id = ?`, [id]))!
  let envio: EnvioResultado | undefined
  if (correo && modoVentasAuto() === 'activo') envio = await enviarPasoDelProspecto(p, hoy, 'activo')
  await avisar(p.responsable_email, `🆕 Nuevo prospecto desde la web: ${empresa}`, [
    `<strong>${escHtml(empresa)}</strong>${l.nombre ? ` · ${escHtml(l.nombre)}` : ''}${correo ? ` · ${escHtml(correo)}` : ''}${l.telefono ? ` · ${escHtml(l.telefono)}` : ''}`,
    `Formulario: ${escHtml(l.origen)}`,
    mensaje ? `«${escHtml(mensaje.slice(0, 600))}»` : '',
    envio?.resultado === 'enviado' ? 'Ya recibió la respuesta automática con el enlace para agendar.'
      : correo ? 'La respuesta automática está en simulación: escríbele tú.' : 'No dejó correo: contáctalo por teléfono o WhatsApp.',
  ].filter(Boolean))
  return { accion: 'creado', prospectoId: id, envio }
}

// ── El ciclo (cada hora, desde GitHub Actions) ─────────────────────────────────────────────────────────────────────────

export interface ResumenCiclo {
  modo: ModoVentas
  hoy: string
  hora: number
  envios: EnvioResultado[]
  entrantes: EntranteResultado[]
  errores: string[]
}

export async function cicloVentasAutomaticas(ahora = new Date()): Promise<ResumenCiclo> {
  await migrateVentasAuto()
  const modo = modoVentasAuto()
  const hoy = hoyBogota(ahora), hora = horaBogota(ahora)
  const r: ResumenCiclo = { modo, hoy, hora, envios: [], entrantes: [], errores: [] }

  try { r.entrantes = await procesarBuzon(hoy) } catch (e: any) {
    r.errores.push(`Buzón: ${e?.message ?? e}`)
    await alertar('no se pudo leer el buzón', `${e?.message ?? e}. Sin esto, las respuestas no detienen la cadencia. Revisa que IMAP esté activo en Gmail y que GMAIL_APP_PASSWORD siga vigente.`)
  }

  if (enHorarioDeEnvio(hoy, hora)) {
    // En simulación, el reporte del día sale una sola vez: no se recalcula cada hora.
    const simuladoHoy = modo === 'simulacion' && (await leerEstado('simulacion_reportada')) === hoy
    if (!simuladoHoy) {
      const dia = JSON.parse((await leerEstado(`dia:${hoy}`)) ?? '{}')
      const yaHoy = Number(dia['envio:enviado'] ?? 0), yaHoyWA = Number(dia['wa:enviado'] ?? 0)
      const cupo = modo === 'simulacion' ? MAX_ENVIOS_POR_DIA : Math.min(MAX_ENVIOS_POR_CICLO, MAX_ENVIOS_POR_DIA - yaHoy)
      const cupoWA = modo === 'simulacion' ? MAX_WHATSAPP_POR_DIA : Math.min(MAX_WHATSAPP_POR_CICLO, MAX_WHATSAPP_POR_DIA - yaHoyWA)
      try { if (cupo > 0 || cupoWA > 0) r.envios = await procesarEnvios(hoy, modo, cupo, cupoWA) } catch (e: any) {
        r.errores.push(`Envíos: ${e?.message ?? e}`)
        await alertar('falló el envío de la cadencia', String(e?.message ?? e))
      }
      const fallidos = r.envios.filter(x => x.resultado === 'error')
      if (fallidos.length) await alertar(`${fallidos.length} mensaje(s) automáticos no salieron`, fallidos.slice(0, 5).map(f => `${f.empresa}: ${f.error}`).join(' · '))
      const sinPlantilla = r.envios.filter(x => x.resultado === 'sin-plantilla' && x.error)
      if (sinPlantilla.length) await alertar('hay WhatsApp esperando plantillas sin aprobar', `${sinPlantilla.length} prospecto(s) esperan: ${[...new Set(sinPlantilla.map(x => x.asunto))].join(', ')}. Revisa las plantillas en Prospectos.`)
      if (modo === 'simulacion') {
        await guardarEstado('simulacion_reportada', hoy)
        await reporteSimulacion(r)
      }
    }
  }

  await acumularDia(r)
  if (hora >= 17 && (await leerEstado('resumen_enviado')) !== hoy && esDiaHabil(hoy)) {
    await guardarEstado('resumen_enviado', hoy)
    await resumenDiario(hoy)
  }
  await guardarEstado('ultimo_ciclo', ahora.toISOString())
  return r
}

async function acumularDia(r: ResumenCiclo) {
  const clave = `dia:${r.hoy}`
  const d = JSON.parse((await leerEstado(clave)) ?? '{}') as Record<string, number>
  for (const e of r.envios) if (r.modo === 'activo') {
    const k = `${e.canal === 'whatsapp' ? 'wa' : 'envio'}:${e.resultado}`
    d[k] = (d[k] ?? 0) + 1
  }
  for (const e of r.entrantes) d[`entrante:${e.tipo}`] = (d[`entrante:${e.tipo}`] ?? 0) + 1
  d.ciclos = (d.ciclos ?? 0) + 1
  await guardarEstado(clave, JSON.stringify(d))
}

async function reporteSimulacion(r: ResumenCiclo) {
  const filas = r.envios.slice(0, 40).map(e =>
    `<tr><td>${escHtml(e.empresa)}</td><td>${e.canal === 'whatsapp' ? 'WhatsApp' : 'Correo'}</td><td>${escHtml(e.para ?? '— sin destino')}</td><td>${escHtml(e.paso)}</td><td>${escHtml(e.asunto ?? '')}${e.resultado === 'sin-plantilla' ? ' (plantilla sin aprobar)' : ''}</td></tr>`).join('')
  await avisar(await correoSuperadmin(), `🧪 Simulación de ventas automáticas: hoy se enviarían ${r.envios.filter(e => e.resultado === 'simulado').length} mensajes`, [
    'Las ventas automáticas están en <strong>simulación</strong>: no se envió nada. Esto es lo que saldría hoy.',
    r.envios.length ? `<table cellpadding="4" style="border-collapse:collapse;font-size:12px;"><tr><th align="left">Empresa</th><th align="left">Canal</th><th align="left">Para</th><th align="left">Paso</th><th align="left">Asunto / plantilla</th></tr>${filas}</table>` +
      (r.envios.length > 40 ? `<p>… y ${r.envios.length - 40} más.</p>` : '') : 'Hoy no le toca mensaje a ningún prospecto en modo automático.',
    'Para que salgan de verdad, se pone VENTAS_AUTOMATICAS=activo en Render.',
  ])
}

async function resumenDiario(hoy: string) {
  const d = JSON.parse((await leerEstado(`dia:${hoy}`)) ?? '{}') as Record<string, number>
  const activos = await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM prospectos_isp WHERE automatico = 1 AND cadencia_estado = 'activa'`)
  const n = (k: string) => d[k] ?? 0
  await avisar(await correoSuperadmin(), `📊 Ventas automáticas · ${hoy}`, [
    `Modo: <strong>${modoVentasAuto() === 'activo' ? 'activo' : 'simulación'}</strong> · ${n('ciclos')} ciclos corrieron hoy.`,
    `Correos enviados: <strong>${n('envio:enviado')}</strong>${n('envio:error') ? ` · con error: ${n('envio:error')}` : ''}${n('envio:sin-correo') ? ` · sin correo: ${n('envio:sin-correo')}` : ''}`,
    `WhatsApp enviados (plantillas): <strong>${n('wa:enviado')}</strong>${n('wa:error') ? ` · con error: ${n('wa:error')}` : ''} · costo aproximado US$${(n('wa:enviado') * 0.0125).toFixed(2)}`,
    `Respuestas: <strong>${n('entrante:respuesta')}</strong> · bajas: ${n('entrante:baja')} · no interesados: ${n('entrante:no-interesado')} · rebotes: ${n('entrante:rebote')} · respuestas automáticas ignoradas: ${n('entrante:automatica')}`,
    `Prospectos en modo automático con cadencia activa: ${Number(activos?.n ?? 0)}.`,
  ])
}

/** Estado para mostrar en la app: modo, último ciclo y cuántos prospectos van en automático. */
export async function estadoVentasAuto() {
  await migrateVentasAuto()
  const activos = await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM prospectos_isp WHERE automatico = 1 AND cadencia_estado = 'activa'`)
  return { modo: modoVentasAuto(), ultimoCiclo: await leerEstado('ultimo_ciclo'), automaticos: Number(activos?.n ?? 0) }
}
