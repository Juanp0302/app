/**
 * Completa el NIT de los prospectos que no lo tienen, con el listado RUTIC del MinTIC.
 *
 * Uso: node scripts/nit-desde-rutic.mjs "<ISP RUTIC - fecha.xlsx>" [--dry] [--prod]
 *   Sin --prod usa SOLO la BD local (DB_PATH o data/owl.db). Con --prod usa Turso (.env.local).
 *   Recomendado: correr primero con --dry --prod y revisar el resultado.
 *
 * Solo toca prospectos con el NIT vacío, y solo escribe el NIT (nada más). Reglas (lib/rutic.mjs):
 *  - por nombre de empresa, si coincide con una sola razón social del RUTIC;
 * Regla: si no estamos seguros, no se escribe nada. Un NIT equivocado haría que la radiografía muestre las sanciones de otra empresa.
 *  - Se aplica solo cuando el nombre coincide con una sola razón social del RUTIC (o con una sola vigente).
 *  - Si únicamente coincide el correo (el del prospecto o el de quien se inscribió al webinar) NO se aplica: se lista para revisarlo a mano.
 *  - Lo dudoso (varias empresas, nombre y correo que no coinciden) tampoco se aplica y se lista aparte.
 * También avisa cuando, ya con NIT, una empresa aparece en varias filas con distinto responsable, para no contactarla dos veces.
 * Es seguro repetirlo.
 */
import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, existsSync } from 'fs'
import { leerXlsx } from '../lib/excel.ts'
import { indexarRutic, decidirNit } from '../lib/rutic.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const archivo = args.find(a => !a.startsWith('--'))
const dry = args.includes('--dry')
const prod = args.includes('--prod')
if (!archivo || !existsSync(archivo)) { console.error('Uso: node scripts/nit-desde-rutic.mjs "<archivo RUTIC.xlsx>" [--dry] [--prod]'); process.exit(1) }

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

const rutic = indexarRutic(await leerXlsx(readFileSync(archivo)))
console.log(`RUTIC: ${rutic.total} empresas con NIT`)

const columnas = new Set((await q(`PRAGMA table_info(prospectos_isp)`)).map(r => r.name))
const opcional = c => (columnas.has(c) ? `p.${c}` : `NULL AS ${c}`)
const todos = await q(`SELECT p.id, p.empresa, p.nit, p.correo, p.responsable_id, ${opcional('webinar_correo')}, ${opcional('campana')}, u.nombre AS responsable
                       FROM prospectos_isp p LEFT JOIN users u ON u.id = p.responsable_id`)
const vacio = p => !String(p.nit ?? '').replace(/\D/g, '')
const sinNit = todos.filter(vacio)
console.log(`Prospectos: ${todos.length} · sin NIT: ${sinNit.length}\n`)

const resultado = sinNit.map(p => ({ p, d: decidirNit(p, rutic) }))
const por = tipo => resultado.filter(r => r.d.tipo === tipo)
const aplicar = resultado.filter(r => r.d.nit && r.d.tipo !== 'correo')   // solo por correo: nunca se escribe

// ── Resumen ──────────────────────────────────────────────────────────────────
console.log(`Se completarían: ${aplicar.length}`)
console.log(`  por nombre: ${por('nombre').length} · por nombre y correo: ${por('nombre+correo').length}`)
console.log(`No se aplican: solo por correo ${por('correo').length} (revisar a mano) · ambiguos ${por('ambiguo').length} · conflictos ${por('conflicto').length} · sin coincidencia ${por('ninguno').length}\n`)

const linea = ({ p, d }) => `  ${p.empresa}  →  ${d.razon} (${d.nit})${d.tipo === 'correo' ? '  [solo por correo]' : ''}`
const solosCorreo = por('correo')
if (solosCorreo.length) { console.log('Solo por correo (el nombre no coincide; NO se aplican: revisar a mano si es la misma empresa):'); solosCorreo.forEach(r => console.log(linea(r))); console.log() }
const dudas = [...por('ambiguo'), ...por('conflicto')]
if (dudas.length) {
  console.log('Con dudas (no se aplican):')
  for (const { p, d } of dudas) console.log(`  ${p.empresa} [${d.tipo}]: ${[...new Map(d.candidatos.map(c => [c.nit, c])).values()].slice(0, 4).map(c => `${c.razon} (${c.nit})`).join(' | ')}`)
  console.log()
}
const sin = por('ninguno')
console.log(`Sin coincidencia (${sin.length}); con nombre parecido en el RUTIC, para revisar a mano:`)
for (const { p, d } of sin.filter(r => r.d.sugerencias.length)) console.log(`  ${p.empresa}  ≈  ${d.sugerencias.map(s => `${s.razon} (${s.nit})`).join(' | ')}`)
console.log(`  …y ${sin.filter(r => !r.d.sugerencias.length).length} sin nada parecido (nombres como "Na", "Independiente", un nombre de persona, o que no están en el RUTIC).\n`)

// ── Misma empresa en varias filas con distinto responsable (ya con los NIT nuevos) ───────────
const porNit = new Map()
const nitFinal = new Map(aplicar.map(r => [r.p.id, r.d.nit]))
for (const p of todos) {
  const nit = nitFinal.get(p.id) ?? String(p.nit ?? '').replace(/\D/g, '')
  if (!nit) continue
  if (!porNit.has(nit)) porNit.set(nit, [])
  porNit.get(nit).push(p)
}
const repetidas = [...porNit.entries()].filter(([, filas]) => filas.length > 1 && filas.some(f => nitFinal.has(f.id)) && new Set(filas.map(f => f.responsable_id)).size > 1)
if (repetidas.length) {
  console.log(`Empresas con varias filas y distinto responsable (se podría contactar dos veces; no se cambia nada): ${repetidas.length}`)
  for (const [nit, filas] of repetidas) console.log(`  NIT ${nit}: ` + filas.map(f => `${f.empresa} (${f.campana ?? 'cold-mailing'}, ${f.responsable ?? 'sin asignar'})`).join('  +  '))
  console.log()
}

// ── Escribir ─────────────────────────────────────────────────────────────────
if (!dry && aplicar.length) {
  const stmts = aplicar.map(({ p, d }) => ({ sql: `UPDATE prospectos_isp SET nit = ?, updated_at = datetime('now') WHERE id = ? AND (nit IS NULL OR trim(nit) = '')`, args: [d.nit, p.id] }))
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100), 'write')
  console.log(`✓ NIT completado en ${aplicar.length} prospectos.`)
}
