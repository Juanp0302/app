/**
 * Cambio de estrategia de contacto: en lugar de ofrecer un servicio de entrada,
 * se invita al webinar "Que el MinTIC no sancione tu ISP" (miércoles 21 de
 * octubre de 2026, 6:00 p. m., con Inerxia) y a la Comunidad ISPs Colombia.
 *
 * Qué hace, por cada fila de prospectos_isp:
 *   - Agrega columnas: invitacion_whatsapp, recordatorio_whatsapp,
 *     aviso_dia_whatsapp y llamada_servicio.
 *   - Escribe los 3 mensajes nuevos de WhatsApp (en "tú").
 *   - Guarda la apertura de llamada anterior en llamada_servicio (solo la
 *     primera vez) y la reemplaza por una apertura nueva (en "usted") que
 *     reconoce el contacto previo.
 *   - Corrige las 4 filas con representante "Sin dato", cuyos mensajes
 *     anteriores saludaban literalmente "Sin".
 * NO toca los mensajes anteriores (whatsapp_1/2/3), el guion completo ni las
 * investigaciones: quedan como guía para después del webinar.
 *
 * Uso:
 *   node scripts/aplicar-estrategia-comunidad.mjs            (prueba: no escribe)
 *   node scripts/aplicar-estrategia-comunidad.mjs --aplicar  (escribe en la BD)
 * Es idempotente: puede correrse varias veces.
 */
import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, existsSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
}
const APLICAR = process.argv.includes('--aplicar')

const { createClient } = await import('@libsql/client')
const db = process.env.TURSO_DATABASE_URL
  ? createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })
  : createClient({ url: `file:${path.join(__dirname, '..', 'data', 'owl.db').replace(/\\/g, '/')}` })

const LINK = 'https://www.inerxia.ai/webinar-escala-tu-isp'
const WEBINAR = '“Que el MinTIC no sancione tu ISP”'

// ── Nombre de pila a partir del representante legal ──────────────────────────
const ACENTOS = {
  JOSE: 'José', ANDRES: 'Andrés', JULIAN: 'Julián', ALVARO: 'Álvaro', VICTOR: 'Víctor',
  JESUS: 'Jesús', MARIA: 'María', SEBASTIAN: 'Sebastián', FABIAN: 'Fabián', ADRIAN: 'Adrián',
  HERNAN: 'Hernán', RUBEN: 'Rubén', OSCAR: 'Óscar', NESTOR: 'Néstor', CESAR: 'César',
  MARTIN: 'Martín', HECTOR: 'Héctor', SIMON: 'Simón', JOAQUIN: 'Joaquín', ANGEL: 'Ángel',
  JHON: 'Jhon', EDGAR: 'Édgar', ORLANDO: 'Orlando', NICOLAS: 'Nicolás', DAMIAN: 'Damián',
}
function primerNombre(representante) {
  const tok = (representante || '').trim().split(/\s+/)[0] || ''
  if (!tok || /^sin$/i.test(tok) || tok.length < 3 || /[\d.\-/&]/.test(tok)) return null
  const up = tok.toUpperCase()
  if (ACENTOS[up]) return ACENTOS[up]
  return tok.charAt(0).toUpperCase() + tok.slice(1).toLowerCase()
}

// ── Mensajes nuevos ──────────────────────────────────────────────────────────
function mensajes(nombre, esFijo) {
  const saludoExc = nombre ? `¡Hola, ${nombre}!` : '¡Hola!'
  const saludoSimple = nombre ? `Hola, ${nombre}.` : 'Hola.'

  const invitacion =
`${saludoExc} 👋 Soy [NOMBRE], de Owl Compliance.

Junto con Inerxia AI, te invitamos al webinar gratuito ${WEBINAR}, con Nicolás Almeyda, exasesor de la CRC y el MinTIC.

📅 Miércoles 21 de octubre | 6:00 p. m.

🎁 Al registrarte, podrás acceder a nuestra Comunidad ISPs Colombia, donde encontrarás información regulatoria, recursos para tu ISP, un directorio de operadores y oportunidades de conseguir entradas para Expo ISP.

👇 Inscríbete gratis aquí y aprende a prevenir sanciones en tu ISP.

${LINK}`

  const recordatorio =
`${saludoExc} 👋 Te escribí hace unos días: este miércoles 21 de octubre a las 6:00 p. m. es el webinar gratuito ${WEBINAR}, con Nicolás Almeyda, exasesor de la CRC y el MinTIC.

Al registrarte también accedes a la Comunidad ISPs Colombia.

👇 Todavía alcanzas a inscribirte gratis:

${LINK}`

  const avisoDia =
`${saludoSimple} Hoy a las 6:00 p. m. es el webinar ${WEBINAR}. 📅

Si ya te inscribiste, revisa tu WhatsApp o correo: Inerxia te envió el enlace de acceso. Si aún no, todavía puedes hacerlo aquí:

${LINK}`

  // Llamadas: en "usted". Primer contacto ya hecho por WhatsApp (o por teléfono si es fijo).
  const n = nombre ? `${nombre}, le` : 'Le'
  const aperturaLlamada = esFijo
    ? `"${n} habla [NOMBRE], abogado(a) de Owl Compliance. ¿Tiene 30 segundos?" → "Lo llamo para invitarlo al webinar gratuito ${WEBINAR}, el miércoles 21 de octubre a las 6:00 p. m., con Nicolás Almeyda, exasesor de la CRC y el MinTIC, junto con Inerxia. Además estamos armando la Comunidad ISPs Colombia en WhatsApp. ¿Me regala su celular para enviarle el enlace de inscripción?"`
    : `"${n} habla [NOMBRE], abogado(a) de Owl Compliance; le escribí por WhatsApp invitándolo al webinar gratuito ${WEBINAR} del miércoles 21 de octubre y a la Comunidad ISPs Colombia. ¿Alcanzó a ver el mensaje?" → "Es con Nicolás Almeyda, exasesor de la CRC y el MinTIC, junto con Inerxia. Dura una hora y es gratis; quería asegurarme de que le llegara la invitación. ¿Le ayudo con la inscripción?"`

  return { invitacion, recordatorio, avisoDia, aperturaLlamada }
}

// ── Corrección de los mensajes anteriores de las filas "Sin dato" ─────────────
function arreglaSin(texto) {
  if (!texto) return texto
  const mayus = s => s.charAt(0).toUpperCase() + s.slice(1)
  return texto
    .replace(/^(Buenos días|Buenas tardes|Buenas noches|Hola),\s*Sin\./, '$1.')
    .replace(/^"Sin,\s+/, m => '"')            // apertura de llamada: "Sin, le habla…
    .replace(/^Sin,\s+/, '')
    .replace(/^("?)([a-záéíóúñ])/, (m, q, c) => q + c.toUpperCase())   // vuelve a poner mayúscula inicial
}

async function run() {
  for (const sql of [
    'ALTER TABLE prospectos_isp ADD COLUMN invitacion_whatsapp TEXT',
    'ALTER TABLE prospectos_isp ADD COLUMN recordatorio_whatsapp TEXT',
    'ALTER TABLE prospectos_isp ADD COLUMN aviso_dia_whatsapp TEXT',
    'ALTER TABLE prospectos_isp ADD COLUMN llamada_servicio TEXT',
  ]) {
    if (!APLICAR) break
    try { await db.execute(sql) } catch (e) { if (!/duplicate column/i.test(e.message)) throw e }
  }

  const cols = await db.execute('PRAGMA table_info(prospectos_isp)')
  const nombresCol = cols.rows.map(r => r.name)
  const yaTieneColumnas = nombresCol.includes('llamada_servicio')

  const filas = await db.execute(
    `SELECT id, puesto, empresa, representante, canal_sugerido, llamada_apertura, whatsapp_1, whatsapp_2, whatsapp_3${yaTieneColumnas ? ', llamada_servicio' : ''}
     FROM prospectos_isp ORDER BY puesto`
  )

  let n = 0, sinNombre = 0, fijos = 0, arreglados = 0
  const muestras = []
  for (const f of filas.rows) {
    const nombre = primerNombre(f.representante)
    const esFijo = /no aplica/i.test(f.canal_sugerido || '')
    if (!nombre) sinNombre++
    if (esFijo) fijos++
    const m = mensajes(nombre, esFijo)

    // La apertura de llamada anterior se guarda una sola vez, para no pisarla al re-correr.
    const llamadaServicio = (yaTieneColumnas && f.llamada_servicio) ? f.llamada_servicio : f.llamada_apertura
    const esSinDato = /^sin/i.test((f.representante || '').trim())
    const wa1 = esSinDato ? arreglaSin(f.whatsapp_1) : f.whatsapp_1
    const wa2 = esSinDato ? arreglaSin(f.whatsapp_2) : f.whatsapp_2
    const wa3 = esSinDato ? arreglaSin(f.whatsapp_3) : f.whatsapp_3
    const llamadaServicioOk = esSinDato ? arreglaSin(llamadaServicio) : llamadaServicio
    if (esSinDato && (wa1 !== f.whatsapp_1 || wa2 !== f.whatsapp_2 || wa3 !== f.whatsapp_3)) arreglados++

    const muestraSinDato = esSinDato && !muestras.some(x => !x.nombre)
    const muestraFijo = esFijo && !muestras.some(x => x.esFijo)
    if (muestras.length < 2 || muestraSinDato || muestraFijo) {
      muestras.push({ puesto: f.puesto, empresa: f.empresa, nombre, esFijo, ...m })
    }

    if (APLICAR) {
      await db.execute({
        sql: `UPDATE prospectos_isp SET
                invitacion_whatsapp = ?, recordatorio_whatsapp = ?, aviso_dia_whatsapp = ?,
                llamada_apertura = ?, llamada_servicio = ?,
                whatsapp_1 = ?, whatsapp_2 = ?, whatsapp_3 = ?,
                updated_at = datetime('now')
              WHERE id = ?`,
        args: [m.invitacion, m.recordatorio, m.avisoDia, m.aperturaLlamada, llamadaServicioOk, wa1, wa2, wa3, f.id],
      })
    }
    n++
  }

  console.log(`${APLICAR ? 'APLICADO' : 'PRUEBA (no se escribió nada)'}: ${n} filas`)
  console.log(`  sin nombre de pila: ${sinNombre} · teléfono fijo: ${fijos} · filas "Sin dato" corregidas: ${arreglados}`)
  for (const s of muestras) {
    console.log(`\n--- #${s.puesto} ${s.empresa} (nombre: ${s.nombre ?? '—'}${s.esFijo ? ', FIJO' : ''}) ---`)
    console.log('[INVITACIÓN]\n' + s.invitacion)
    console.log('\n[APERTURA DE LLAMADA]\n' + s.aperturaLlamada)
  }
  process.exit(0)
}
run().catch(e => { console.error(e); process.exit(1) })
