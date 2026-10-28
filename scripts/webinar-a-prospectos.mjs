/**
 * Pasa la base del webinar del 21 oct a Prospectos, que es donde trabaja el equipo (Leads queda solo
 * para estadísticas). Parte de lo que scripts/importar-webinar.mjs ya cargó en `leads`, así conserva
 * el responsable asignado y la fecha de arranque de la cadencia de cada contacto.
 *
 * - Si la empresa ya estaba en el cold mailing (NIT, correo o nombre), se suma a esa fila: queda marcada
 *   como del webinar, con asistencia, minutos y el contacto que se inscribió (webinar_nombre/telefono/correo,
 *   que puede no ser el representante legal), y arranca la cadencia del webinar. Conserva su estado,
 *   historial y responsable. Si se inscribió más de una persona de esa empresa, las demás quedan en las notas.
 * - Si no, entra como prospecto nuevo: campaña "webinar", prioridad W, estado Pendiente.
 * Es seguro repetirlo: no duplica ni reinicia cadencias ya empezadas.
 *
 * Uso: node scripts/webinar-a-prospectos.mjs [--dry] [--prod]
 *   Sin --prod usa la BD local (DB_PATH o data/owl.db). Con --prod usa Turso (.env.local).
 */
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { readFileSync, existsSync } from 'fs'
import { coincideConProspecto } from './reparto-webinar.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dry = process.argv.includes('--dry')
const prod = process.argv.includes('--prod')

const envPath = path.join(__dirname, '..', '.env.local')
if (prod && existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
}
const { createClient } = await import('@libsql/client')
console.log(`Destino: ${prod ? 'PRODUCCIÓN (Turso)' : 'BD local'}${dry ? ' · simulación, no escribe nada' : ''}`)
const dbUrl = process.env.DB_PATH
  ? `file:${process.env.DB_PATH.replace(/\\/g, '/')}`
  : `file:${path.join(__dirname, '..', 'data', 'owl.db').replace(/\\/g, '/')}`
const db = prod && process.env.TURSO_DATABASE_URL
  ? createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })
  : createClient({ url: dbUrl })
const q = async (sql, a = []) => (await db.execute({ sql, args: a })).rows
const run = async (sql, a = []) => { if (!dry) await db.execute({ sql, args: a }) }

// Mismas columnas que lib/prospectos-db.ts.
if (!dry) {
  for (const sql of [
    `ALTER TABLE prospectos_isp ADD COLUMN en_webinar INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE prospectos_isp ADD COLUMN campana TEXT NOT NULL DEFAULT 'cold-mailing'`,
    `ALTER TABLE prospectos_isp ADD COLUMN webinar_asistio INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE prospectos_isp ADD COLUMN webinar_minutos INTEGER`,
    `ALTER TABLE prospectos_isp ADD COLUMN revisar_icp INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE prospectos_isp ADD COLUMN cadencia TEXT`,
    `ALTER TABLE prospectos_isp ADD COLUMN paso_cadencia INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE prospectos_isp ADD COLUMN cadencia_estado TEXT`,
    `ALTER TABLE prospectos_isp ADD COLUMN proxima_fecha TEXT`,
    `ALTER TABLE prospectos_isp ADD COLUMN webinar_nombre TEXT`,
    `ALTER TABLE prospectos_isp ADD COLUMN webinar_telefono TEXT`,
    `ALTER TABLE prospectos_isp ADD COLUMN webinar_correo TEXT`,
  ]) { try { await db.execute(sql) } catch { /* ya existe */ } }
}
const cols = new Set((await q(`PRAGMA table_info(prospectos_isp)`)).map(r => r.name))
const opcional = (c, alias = c) => (cols.has(c) ? `p.${c}` : `NULL AS ${alias}`)

const leads = await q(`
  SELECT l.*, u.nombre AS responsable_nombre FROM leads l LEFT JOIN users u ON u.id = l.responsable_id
  WHERE l.asunto = 'Webinar (importado)' AND l.principal_id IS NULL
  ORDER BY l.asistio_webinar DESC, COALESCE(l.minutos_webinar, 0) DESC, l.id`)
const prospectos = await q(`SELECT p.id, p.empresa, p.nit, p.correo, p.estado, p.notas, ${opcional('campana')}, ${opcional('cadencia')},
                              ${opcional('webinar_correo')},
                              u.nombre AS responsable_nombre
                            FROM prospectos_isp p LEFT JOIN users u ON u.id = p.responsable_id`)
const datosDe = l => { try { return JSON.parse(l.datos ?? '{}') ?? {} } catch { return {} } }
let puesto = Number((await q(`SELECT COALESCE(MAX(puesto), 0) AS m FROM prospectos_isp`))[0].m)

let nuevos = 0, sumados = 0, yaEstaban = 0
const resumen = {}
const cuenta = (nombre, campo) => { resumen[nombre] ??= { nuevos: 0, sumados: 0 }; resumen[nombre][campo]++ }
for (const l of leads) {
  const r = { empresa: l.empresa, correo: (l.correo ?? '').trim().toLowerCase(), nit: l.nit }
  const cadencia = l.asistio_webinar ? 'webinar-asistente' : 'webinar-inscrito'
  const cold = prospectos.find(p => p.campana !== 'webinar' && coincideConProspecto(r, p))
  if (cold) {
    if (cold.cadencia) {
      // Otra persona de la misma empresa: la fila ya tiene la cadencia, se deja el contacto en las notas.
      const contacto = [l.nombre, l.telefono, l.correo].filter(Boolean).join(' · ')
      const yaAnotado = r.correo && (String(cold.webinar_correo ?? '').toLowerCase() === r.correo || String(cold.notas ?? '').toLowerCase().includes(r.correo))
      if (r.correo && !yaAnotado) {
        const nota = `Otro contacto del webinar (${l.asistio_webinar ? `asistió ${l.minutos_webinar ?? '?'} min` : 'inscrito'}): ${contacto}`
        cold.notas = cold.notas ? `${cold.notas}
${nota}` : nota
        await run(`UPDATE prospectos_isp SET notas = ? WHERE id = ?`, [cold.notas, cold.id])
      }
      yaEstaban++; continue
    }
    // Quien fue al webinar puede no ser el representante legal: los mensajes de la cadencia van a esa persona.
    await run(`UPDATE prospectos_isp SET en_webinar = 1, webinar_asistio = MAX(webinar_asistio, ?), webinar_minutos = ?,
                 webinar_nombre = ?, webinar_telefono = ?, webinar_correo = ?,
                 cadencia = ?, paso_cadencia = 0, cadencia_estado = 'activa', proxima_fecha = ?, updated_at = datetime('now')
               WHERE id = ? AND cadencia IS NULL`,
      [l.asistio_webinar ? 1 : 0, l.minutos_webinar, l.nombre, l.telefono, l.correo, cadencia, l.proxima_fecha, cold.id])
    cold.cadencia = cadencia
    cold.webinar_correo = l.correo
    sumados++; cuenta(cold.responsable_nombre ?? 'Sin asignar', 'sumados')
    continue
  }
  const yaWebinar = r.correo && prospectos.find(p => p.campana === 'webinar' && (p.correo ?? '').trim().toLowerCase() === r.correo)
  if (yaWebinar) { yaEstaban++; continue }
  puesto++
  const id = crypto.randomUUID()
  await run(`INSERT INTO prospectos_isp (id, puesto, prioridad, empresa, nit, representante, telefono, correo, estado, responsable_id,
               campana, en_webinar, webinar_asistio, webinar_minutos, revisar_icp, cadencia, paso_cadencia, cadencia_estado, proxima_fecha)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, puesto, 'W', l.empresa || l.nombre || l.correo || '(sin empresa)', l.nit, l.nombre, l.telefono, l.correo, 'Pendiente',
      l.responsable_id, 'webinar', 1, l.asistio_webinar ? 1 : 0, l.minutos_webinar, datosDe(l).revisar_icp ? 1 : 0,
      cadencia, 0, 'activa', l.proxima_fecha])
  prospectos.push({ id, empresa: l.empresa, correo: l.correo, campana: 'webinar', cadencia })
  nuevos++; cuenta(l.responsable_nombre ?? 'Sin asignar', 'nuevos')
}

console.log(`\n${dry ? '[SIMULACIÓN] ' : ''}Contactos del webinar en Leads: ${leads.length}`)
console.log(`  Nuevos en Prospectos: ${nuevos} · sumados a su fila del cold mailing: ${sumados} · ya estaban: ${yaEstaban}`)
console.log('\nPor responsable (nuevos / sumados al cold mailing):')
for (const [n, c] of Object.entries(resumen)) console.log(`  ${n.padEnd(28)} ${String(c.nuevos).padStart(4)} / ${String(c.sumados).padStart(3)}`)
