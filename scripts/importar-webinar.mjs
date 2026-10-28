/**
 * Importa la base del webinar (inscritos + asistentes) a la tabla leads y cruza con prospectos_isp.
 *
 * Uso: node scripts/importar-webinar.mjs <archivo.csv> [--dry] [--prod]
 *   Sin --prod escribe SOLO en la BD local (DB_PATH o data/owl.db). Con --prod usa Turso (.env.local).
 *   Recomendado: correr primero con --dry --prod para ver cuántos filas entran sin escribir nada.
 *   CSV en UTF-8, separado por coma o punto y coma, con encabezados (en cualquier orden, con o sin tildes):
 *   nombre, empresa, correo (o email), telefono, nit, asistio (si/no/1/0).
 *   Si tienes un Excel: ábrelo y "Guardar como CSV UTF-8".
 *
 * - Si el correo ya existe en leads: se marca asistio_webinar (no se duplica).
 * - Si no existe: se inserta con origen "webinar" (asistio_webinar según la columna).
 * - Prospectos del cold mailing que coincidan (NIT, correo o nombre de empresa) quedan con en_webinar = 1.
 */
import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, existsSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const prod = process.argv.includes('--prod')
const envPath = path.join(__dirname, '..', '.env.local')
if (prod && existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
}

const archivo = process.argv[2]
const dry = process.argv.includes('--dry')
if (!archivo || !existsSync(archivo)) { console.error('Uso: node scripts/importar-webinar.mjs <archivo.csv> [--dry]'); process.exit(1) }

const { createClient } = await import('@libsql/client')
console.log(`Destino: ${prod ? 'PRODUCCIÓN (Turso)' : 'BD local'}${dry ? ' · simulación' : ''}`)
const dbUrl = process.env.DB_PATH
  ? `file:${process.env.DB_PATH.replace(/\\/g, '/')}`
  : `file:${path.join(__dirname, '..', 'data', 'owl.db').replace(/\\/g, '/')}`
const db = prod && process.env.TURSO_DATABASE_URL
  ? createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })
  : createClient({ url: dbUrl })

const sinTildes = s => (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
const normEmpresa = s => sinTildes(s).replace(/\b(s\.?a\.?s\.?|ltda\.?|s\.?a\.?|e\.?u\.?)\b/g, '').replace(/[^a-z0-9]/g, '')
const digitos = s => (s ?? '').toString().replace(/\D/g, '')

/** CSV mínimo con comillas. */
function parseCsv(texto) {
  const primera = texto.split('\n')[0]
  const sep = (primera.match(/;/g) ?? []).length > (primera.match(/,/g) ?? []).length ? ';' : ','
  const filas = []; let fila = [], campo = '', q = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (q) { if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++ } else q = false } else campo += c }
    else if (c === '"') q = true
    else if (c === sep) { fila.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      fila.push(campo); campo = ''
      if (fila.some(x => x.trim())) filas.push(fila)
      fila = []
    } else campo += c
  }
  fila.push(campo); if (fila.some(x => x.trim())) filas.push(fila)
  return filas
}

const filas = parseCsv(readFileSync(archivo, 'utf8').replace(/^﻿/, ''))
const enc = filas[0].map(sinTildes)
const col = (...nombres) => enc.findIndex(h => nombres.some(n => h.includes(n)))
const idx = {
  nombre: col('nombre'), empresa: col('empresa', 'razon', 'compan'), correo: col('correo', 'email', 'e-mail'),
  telefono: col('telefono', 'celular', 'whatsapp', 'phone'), nit: col('nit'), asistio: col('asist'),
}
if (idx.correo < 0 && idx.empresa < 0) { console.error('No encuentro columnas de correo ni empresa. Encabezados:', filas[0]); process.exit(1) }
const val = (f, k) => (idx[k] >= 0 ? (f[idx[k]] ?? '').trim() : '')
const asistio = v => /^(si|s|1|true|x|yes)$/.test(sinTildes(v)) || sinTildes(v).startsWith('asist')

// Misma migración que lib/leads-db.ts, por si el script corre antes que la app.
await db.execute(`CREATE TABLE IF NOT EXISTS leads (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, empresa TEXT, correo TEXT, asunto TEXT, mensaje TEXT,
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_term TEXT, utm_content TEXT, landing_page TEXT, referrer TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`)
for (const sql of [
  `ALTER TABLE leads ADD COLUMN origen TEXT`, `ALTER TABLE leads ADD COLUMN telefono TEXT`, `ALTER TABLE leads ADD COLUMN reunion TEXT`,
  `ALTER TABLE leads ADD COLUMN datos TEXT`, `ALTER TABLE leads ADD COLUMN etapa TEXT NOT NULL DEFAULT 'nuevo'`,
  `ALTER TABLE leads ADD COLUMN etapa_updated_at TEXT`, `ALTER TABLE leads ADD COLUMN asistio_webinar INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE leads ADD COLUMN nit TEXT`, `ALTER TABLE leads ADD COLUMN q_dolor INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE leads ADD COLUMN q_presupuesto INTEGER NOT NULL DEFAULT 0`, `ALTER TABLE leads ADD COLUMN q_decision INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE leads ADD COLUMN dolor_nota TEXT`, `ALTER TABLE leads ADD COLUMN plan_objetivo TEXT`, `ALTER TABLE leads ADD COLUMN proxima_accion TEXT`,
  `ALTER TABLE leads ADD COLUMN proxima_fecha TEXT`, `ALTER TABLE leads ADD COLUMN motivo_descarte TEXT`,
  `ALTER TABLE leads ADD COLUMN principal_id INTEGER`,
]) { try { await db.execute(sql) } catch { /* ya existe */ } }
try { await db.execute(`ALTER TABLE prospectos_isp ADD COLUMN en_webinar INTEGER NOT NULL DEFAULT 0`) } catch { /* ya existe o no hay tabla */ }

let insertados = 0, marcados = 0, saltados = 0
const delArchivo = []
for (const f of filas.slice(1)) {
  const correo = val(f, 'correo').toLowerCase(), empresa = val(f, 'empresa'), nombre = val(f, 'nombre')
  if (!correo && !empresa && !nombre) { saltados++; continue }
  const vino = idx.asistio >= 0 ? asistio(val(f, 'asistio')) : false
  const nit = digitos(val(f, 'nit'))
  delArchivo.push({ correo, empresa, nit })
  // Mismo correo = misma persona: se actualiza su fila. Mismo NIT con otro correo = otra persona de la misma
  // empresa: entra como envío enlazado al lead principal (un solo lead por empresa en el pipeline).
  const ya = correo ? (await db.execute({ sql: `SELECT id FROM leads WHERE lower(trim(correo)) = ? ORDER BY id LIMIT 1`, args: [correo] })).rows[0] : null
  const deEmpresa = !ya && nit
    ? (await db.execute({ sql: `SELECT COALESCE(principal_id, id) AS pid FROM leads WHERE nit = ? ORDER BY id LIMIT 1`, args: [nit] })).rows[0]
    : null
  if (dry) { ya ? marcados++ : insertados++; continue }
  if (ya) {
    await db.execute({
      sql: `UPDATE leads SET asistio_webinar = MAX(asistio_webinar, ?), nit = COALESCE(nit, ?), telefono = COALESCE(telefono, ?) WHERE id = ?`,
      args: [vino ? 1 : 0, nit || null, val(f, 'telefono') || null, ya.id],
    })
    marcados++
  } else {
    await db.execute({
      sql: `INSERT INTO leads (nombre, empresa, correo, telefono, asunto, origen, nit, asistio_webinar, landing_page, principal_id) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      args: [nombre || null, empresa || null, correo || null, val(f, 'telefono') || null, 'Webinar (importado)', 'webinar', nit || null, vino ? 1 : 0, '/webinar.html', deEmpresa?.pid ?? null],
    })
    insertados++
  }
}

// Cruce con el cold mailing: gana la base del webinar.
let cruzados = 0
try {
  const pros = (await db.execute(`SELECT id, empresa, nit, correo FROM prospectos_isp`)).rows
  const porNit = new Set(delArchivo.map(l => l.nit).filter(Boolean))
  const porCorreo = new Set(delArchivo.map(l => l.correo).filter(Boolean))
  const porEmpresa = new Set(delArchivo.map(l => normEmpresa(l.empresa)).filter(Boolean))
  for (const p of pros) {
    const coincide = (digitos(p.nit) && porNit.has(digitos(p.nit))) ||
      (p.correo && porCorreo.has(String(p.correo).toLowerCase())) ||
      (normEmpresa(p.empresa) && porEmpresa.has(normEmpresa(p.empresa)))
    if (coincide) { cruzados++; if (!dry) await db.execute({ sql: `UPDATE prospectos_isp SET en_webinar = 1 WHERE id = ?`, args: [p.id] }) }
  }
} catch (e) { console.warn('Sin tabla prospectos_isp, no se cruzó:', e.message) }

console.log(`${dry ? '[SIMULACIÓN] ' : ''}Filas: ${filas.length - 1} · nuevos: ${insertados} · ya existían (actualizados): ${marcados} · vacíos: ${saltados} · prospectos cruzados con el webinar: ${cruzados}`)
