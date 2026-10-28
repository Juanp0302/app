/**
 * Importa la base del webinar (inscritos + asistentes) a la tabla leads, la reparte entre responsables,
 * arranca la cadencia de seguimiento de cada uno (lib/cadencias.ts) y la cruza con prospectos_isp.
 *
 * Uso: node scripts/importar-webinar.mjs <archivo.csv> [--dry] [--prod] [--inicio AAAA-MM-DD] [--por-dia 25]
 *                                        [--responsables superadmin,correo1,correo2]
 *   Sin --prod escribe SOLO en la BD local (DB_PATH o data/owl.db). Con --prod usa Turso (.env.local).
 *   Recomendado: correr primero con --dry --prod para ver el reparto sin escribir nada.
 *
 * CSV en UTF-8, separado por coma o punto y coma, con encabezados (en cualquier orden, con o sin tildes):
 *   nombre, empresa (o isp), correo (o email), telefono (o celular), nit, asistio (si/no), minutos.
 *
 * - Si el correo ya existe en leads: se actualiza esa fila (asistencia, minutos, teléfono); no se duplica.
 * - Reparto: partes iguales entre --responsables (por defecto el superadmin, Adriana y David), parejo en
 *   asistentes e inscritos, y los contactos de una misma empresa quedan con la misma persona. Los leads que
 *   ya tienen responsable no se tocan.
 * - Cadencia: asistentes → "webinar-asistente", el día --inicio. Inscritos → "webinar-inscrito", de a
 *   --por-dia por responsable desde el día hábil siguiente. Solo para leads en etapa Nuevo sin cadencia.
 * - Prospectos del cold mailing que coincidan (NIT, correo o nombre de empresa) quedan con en_webinar = 1, y ese
 *   lead del webinar queda con quien ya tenía la empresa en el cold mailing.
 * Es seguro repetirlo.
 */
import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, existsSync } from 'fs'
import { sinTildes, revisarIcp, corregirNitEnEmpresa, coincideConProspecto, repartir, fechasDeInicio, sumarDiasHabiles } from './reparto-webinar.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const opcion = (nombre, porDefecto) => { const i = args.indexOf(nombre); return i >= 0 ? args[i + 1] : porDefecto }
const archivo = args[0]
const dry = args.includes('--dry')
const prod = args.includes('--prod')
const hoyBogota = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
const inicio = sumarDiasHabiles(opcion('--inicio', hoyBogota), 0)
const porDia = Math.max(1, Number(opcion('--por-dia', 25)))
// Responsables: "superadmin" = el usuario con is_superadmin = 1; los demás por correo (los mismos de import-prospectos.mjs).
const RESPONSABLES = opcion('--responsables', 'superadmin,adrisli86@hotmail.com,davidosogiraldo@gmail.com').split(',').map(s => s.trim()).filter(Boolean)

if (!archivo || !existsSync(archivo)) {
  console.error('Uso: node scripts/importar-webinar.mjs <archivo.csv> [--dry] [--prod] [--inicio AAAA-MM-DD] [--por-dia 25] [--responsables ...]')
  process.exit(1)
}

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

const digitos = s => (s ?? '').toString().replace(/\D/g, '')

/** CSV mínimo con comillas. */
function parseCsv(texto) {
  const primera = texto.split('\n')[0]
  const sep = (primera.match(/;/g) ?? []).length > (primera.match(/,/g) ?? []).length ? ';' : ','
  const filas = []; let fila = [], campo = '', comillas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (comillas) { if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++ } else comillas = false } else campo += c }
    else if (c === '"') comillas = true
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
const col = (...nombres) => enc.findIndex(h => nombres.some(n => h === n || h.includes(n)))
const idx = {
  nombre: col('nombre'), empresa: col('empresa', 'isp', 'razon', 'compan'), correo: col('correo', 'email', 'e-mail'),
  telefono: col('telefono', 'celular', 'whatsapp', 'phone'), nit: col('nit'), asistio: col('asist'), minutos: col('minuto'),
}
if (idx.correo < 0 && idx.empresa < 0) { console.error('No encuentro columnas de correo ni empresa. Encabezados:', filas[0]); process.exit(1) }
console.log('Columnas:', Object.entries(idx).map(([k, i]) => `${k}=${i >= 0 ? filas[0][i] : '—'}`).join(' · '))
const val = (f, k) => (idx[k] >= 0 ? (f[idx[k]] ?? '').trim() : '')
const asistio = v => /^(si|s|1|true|x|yes)$/.test(sinTildes(v)) || sinTildes(v).startsWith('asist')

// ── Esquema (mismas columnas que lib/leads-db.ts, por si el script corre antes que la app) ──────────
if (!dry) {
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
    `ALTER TABLE leads ADD COLUMN principal_id INTEGER`, `ALTER TABLE leads ADD COLUMN responsable_id TEXT`,
    `ALTER TABLE leads ADD COLUMN cadencia TEXT`, `ALTER TABLE leads ADD COLUMN paso_cadencia INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE leads ADD COLUMN cadencia_estado TEXT`, `ALTER TABLE leads ADD COLUMN minutos_webinar INTEGER`,
  ]) { try { await db.execute(sql) } catch { /* ya existe */ } }
  try { await db.execute(`ALTER TABLE prospectos_isp ADD COLUMN en_webinar INTEGER NOT NULL DEFAULT 0`) } catch { /* ya existe o no hay tabla */ }
}
const columnas = new Set((await q(`PRAGMA table_info(leads)`)).map(r => r.name))
const tiene = c => columnas.has(c)

// ── Responsables ───────────────────────────────────────────────────────────────
const responsables = []
for (const r of RESPONSABLES) {
  const u = r === 'superadmin'
    ? (await q(`SELECT id, nombre, email FROM users WHERE is_superadmin = 1 ORDER BY created_at LIMIT 1`))[0]
    : (await q(`SELECT id, nombre, email FROM users WHERE lower(email) = lower(?)`, [r]))[0]
  if (!u) { console.error(`No existe el usuario "${r}". Revise --responsables.`); process.exit(1) }
  responsables.push(u)
}
console.log('Responsables:', responsables.map(u => `${u.nombre} <${u.email}>`).join(' · '))

// ── Leer y cruzar con lo que ya hay ───────────────────────────────────────────
const registros = []
let vacios = 0
for (const [n, f] of filas.slice(1).entries()) {
  const correo = val(f, 'correo').toLowerCase(), nombre = val(f, 'nombre')
  const corregido = corregirNitEnEmpresa(val(f, 'empresa'), nombre)
  const empresa = corregido.empresa
  if (!correo && !empresa && !nombre) { vacios++; continue }
  const r = {
    clave: `f${n}`, correo, empresa, nombre, nit: digitos(val(f, 'nit')) || corregido.nit, telefono: val(f, 'telefono'),
    asistio: idx.asistio >= 0 ? asistio(val(f, 'asistio')) : false,
    minutos: Number(digitos(val(f, 'minutos'))) || null,
  }
  r.icp = revisarIcp(empresa, nombre)
  const ya = correo && tiene('correo')
    ? (await q(`SELECT id, ${tiene('principal_id') ? 'COALESCE(principal_id, id)' : 'id'} AS pid FROM leads WHERE lower(trim(correo)) = ? ORDER BY id LIMIT 1`, [correo]))[0]
    : null
  r.existente = ya ? { id: Number(ya.id), pid: Number(ya.pid) } : null
  if (r.existente && tiene('etapa')) {
    // En simulación contra una BD sin migrar, las columnas nuevas pueden no existir todavía.
    const p = (await q(`SELECT etapa, ${tiene('responsable_id') ? 'responsable_id' : 'NULL AS responsable_id'},
                          ${tiene('cadencia') ? 'cadencia' : 'NULL AS cadencia'} FROM leads WHERE id = ?`, [r.existente.pid]))[0]
    r.principal = p ?? null
  }
  registros.push(r)
}

// Cruce con el cold mailing: si la empresa ya estaba en prospectos_isp, el lead del webinar queda con
// quien ya la venía contactando, para que no le escriban dos personas distintas de Owl.
let prospectos = []
try {
  prospectos = await q(`SELECT p.id, p.empresa, p.nit, p.correo, p.estado, p.responsable_id, u.nombre AS responsable
                        FROM prospectos_isp p LEFT JOIN users u ON u.id = p.responsable_id`)
} catch (e) { console.warn('Sin tabla prospectos_isp, no se cruzó:', e.message) }
for (const r of registros) r.prospecto = prospectos.find(p => coincideConProspecto(r, p)) ?? null
const duenoPrevio = r => r.principal?.responsable_id ?? r.prospecto?.responsable_id ?? null

// Reparto parejo solo para los que no tienen dueño (ni en leads ni en el cold mailing); los que sí, cuentan en el total.
const porAsignar = registros.filter(r => !duenoPrevio(r))
const previos = {}
for (const r of registros) {
  const resp = duenoPrevio(r)
  if (!resp) continue
  previos[resp] ??= { asistio: 0, inscrito: 0 }
  previos[resp][r.asistio ? 'asistio' : 'inscrito']++
}
const reparto = repartir(porAsignar, responsables.map(u => u.id), previos)
for (const r of registros) r.responsable = duenoPrevio(r) ?? reparto.get(r.clave)

// Cadencia: solo leads en Nuevo sin cadencia. Orden de prioridad: asistentes por minutos, luego inscritos.
const conCadencia = registros
  .filter(r => !r.principal || (r.principal.etapa === 'nuevo' && !r.principal.cadencia))
  .sort((a, b) => Number(b.asistio) - Number(a.asistio) || Number(b.minutos ?? 0) - Number(a.minutos ?? 0))
const inicioDe = fechasDeInicio(conCadencia, inicio, porDia)

// ── Escribir ───────────────────────────────────────────────────────────────────
let insertados = 0, actualizados = 0
for (const r of registros) {
  const datos = JSON.stringify({
    ...(r.nit ? { nit: r.nit } : {}), ...(r.minutos ? { minutos_conectado: r.minutos } : {}),
    ...(r.icp ? { revisar_icp: true } : {}), fuente: 'Base de inscritos del webinar 21 oct (Inerxia)',
  })
  let pid
  if (r.existente) {
    await run(`UPDATE leads SET asistio_webinar = MAX(asistio_webinar, ?), minutos_webinar = MAX(COALESCE(minutos_webinar, 0), ?),
                 nit = COALESCE(nit, ?), telefono = COALESCE(telefono, ?) WHERE id = ?`,
      [r.asistio ? 1 : 0, r.minutos ?? 0, r.nit || null, r.telefono || null, r.existente.id])
    pid = r.existente.pid
    actualizados++
  } else {
    if (!dry) {
      const ins = await db.execute({
        sql: `INSERT INTO leads (nombre, empresa, correo, telefono, asunto, origen, nit, asistio_webinar, minutos_webinar, landing_page, datos)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        args: [r.nombre || null, r.empresa || null, r.correo || null, r.telefono || null, 'Webinar (importado)', 'webinar',
          r.nit || null, r.asistio ? 1 : 0, r.minutos, '/webinar.html', datos],
      })
      pid = Number(ins.lastInsertRowid)
    }
    insertados++
  }
  if (pid == null) continue
  if (!r.principal?.responsable_id && r.responsable) await run(`UPDATE leads SET responsable_id = ? WHERE id = ?`, [r.responsable, pid])
  if (inicioDe.has(r.clave)) {
    await run(`UPDATE leads SET cadencia = ?, paso_cadencia = 0, cadencia_estado = 'activa', proxima_fecha = ?,
                 proxima_accion = 'Cadencia del webinar: primer mensaje' WHERE id = ? AND cadencia IS NULL AND etapa = 'nuevo'`,
      [r.asistio ? 'webinar-asistente' : 'webinar-inscrito', inicioDe.get(r.clave), pid])
  }
}

// ── Marcar en el cold mailing: gana la base del webinar ──────────────────────
const cruzados = [...new Map(registros.filter(r => r.prospecto).map(r => [r.prospecto.id, r])).values()]
for (const r of cruzados) await run(`UPDATE prospectos_isp SET en_webinar = 1 WHERE id = ?`, [r.prospecto.id])

// ── Resumen ────────────────────────────────────────────────────────────────────
const nombreDe = id => responsables.find(u => u.id === id)?.nombre ?? `(otro: ${id})`
console.log(`\n${dry ? '[SIMULACIÓN] ' : ''}Filas: ${filas.length - 1} · nuevos: ${insertados} · ya existían: ${actualizados} · vacías: ${vacios}`)
console.log(`Asistentes: ${registros.filter(r => r.asistio).length} · inscritos sin asistir: ${registros.filter(r => !r.asistio).length} · a revisar si son ISP: ${registros.filter(r => r.icp).length}`)
console.log('\nReparto (asistentes / inscritos / total):')
for (const id of new Set(registros.map(r => r.responsable))) {
  const de = registros.filter(r => r.responsable === id)
  console.log(`  ${nombreDe(id).padEnd(28)} ${String(de.filter(r => r.asistio).length).padStart(4)} / ${String(de.filter(r => !r.asistio).length).padStart(4)} / ${String(de.length).padStart(4)}`)
}
const porFecha = {}
for (const r of conCadencia) { const k = `${inicioDe.get(r.clave)}`; porFecha[k] = (porFecha[k] ?? 0) + 1 }
console.log(`\nPrimer mensaje de la cadencia (${conCadencia.length} leads), por día (todos los responsables):`)
for (const [d, n] of Object.entries(porFecha).sort()) console.log(`  ${d}: ${n}`)
console.log(`\nProspectos del cold mailing que también están en el webinar: ${cruzados.length}`)
for (const r of cruzados) console.log(`  ${r.prospecto.empresa} · estado "${r.prospecto.estado}" · cold mailing a cargo de ${r.prospecto.responsable ?? 'sin asignar'}` +
  ` → webinar (${r.asistio ? 'asistió' : 'inscrito'}: ${r.nombre}) a cargo de ${nombreDe(r.responsable)}`)
