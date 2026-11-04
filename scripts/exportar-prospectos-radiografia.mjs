/**
 * Exporta a un JSON los prospectos para los que hay que generar radiografía y que NO están en el Excel de los 200
 * (Prospectos_ISP_Abordaje_v2.xlsx): los del webinar y los de bases cargadas desde Excel. Lo lee el generador:
 *   python generar.py --json <archivo.json> --salida "<carpeta>"
 * Los 200 del cold mailing se generan con `python generar.py --todas`, que sí trae su situación ante el MinTIC.
 *
 * Uso: node scripts/exportar-prospectos-radiografia.mjs --salida <archivo.json> [--prod]
 *   Sin --prod usa la BD local. Solo lee: no escribe en la base de datos.
 *
 * - Una empresa con varios contactos sale una sola vez (con su NIT, si alguna fila lo tiene).
 * - Se dejan afuera, y se listan, las filas marcadas "¿ISP?" (estudiantes, independientes, sin nombre de empresa):
 *   no tiene sentido una radiografía de "Na". Si resultan ser ISP, se generan aparte con --manual.
 * - No se afirma nada sobre sanciones (verificado = false): de estas empresas no tenemos esa información.
 * - Los nombres escritos todo en minúscula se pasan a mayúscula inicial ("interexplor" → "Interexplor").
 */
import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { normEmpresa } from '../lib/reparto.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const prod = args.includes('--prod')
const iSalida = args.indexOf('--salida')
const salida = iSalida >= 0 ? args[iSalida + 1] : null
if (!salida) { console.error('Uso: node scripts/exportar-prospectos-radiografia.mjs --salida <archivo.json> [--prod]'); process.exit(1) }

const envPath = path.join(__dirname, '..', '.env.local')
if (prod && existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
}
const { createClient } = await import('@libsql/client')
console.log(`Origen: ${prod ? 'PRODUCCIÓN (Turso)' : 'BD local'} (solo lectura)`)
const dbUrl = process.env.DB_PATH
  ? `file:${process.env.DB_PATH.replace(/\\/g, '/')}`
  : `file:${path.join(__dirname, '..', 'data', 'owl.db').replace(/\\/g, '/')}`
const db = prod && process.env.TURSO_DATABASE_URL
  ? createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })
  : createClient({ url: dbUrl })

const SIGLAS = new Set(['sas', 'ltda', 'sa', 'eu', 'bic', 'zomac', 'tv', 'isp', 'ftth', 'esp', 'ips', 'tic', 'tics'])
/** "interexplor" → "Interexplor"; "redes tv sas" → "Redes TV SAS". Lo que ya viene en mayúsculas o mixto se deja igual. */
function arreglarNombre(s) {
  const t = String(s ?? '').trim().replace(/\s+/g, ' ')
  if (t !== t.toLowerCase()) return t
  return t.split(' ').map(w => (SIGLAS.has(w.replace(/\./g, '')) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ')
}

const filas = (await db.execute(`SELECT empresa, nit, prioridad, campana, revisar_icp, responsable_id
  FROM prospectos_isp WHERE prioridad IN ('W', 'O') ORDER BY puesto`)).rows
const digitos = s => String(s ?? '').replace(/\D/g, '')

const empresas = new Map()   // clave de empresa → registro
const excluidas = []
for (const f of filas) {
  const llave = normEmpresa(f.empresa)
  if (f.revisar_icp || llave.length < 3) { excluidas.push(f.empresa || '(sin nombre)'); continue }
  const previo = empresas.get(llave)
  if (previo) { if (!previo.nit && digitos(f.nit)) previo.nit = digitos(f.nit); previo.filas++; continue }
  empresas.set(llave, { empresa: arreglarNombre(f.empresa), nit: digitos(f.nit) || '', prioridad: f.prioridad, verificado: false, filas: 1 })
}
const lista = [...empresas.values()].map(({ filas: _f, ...e }) => e)
writeFileSync(salida, JSON.stringify(lista, null, 1), 'utf8')

console.log(`Prospectos fuera del Excel de los 200: ${filas.length}`)
console.log(`Empresas distintas a generar: ${lista.length} (con NIT: ${lista.filter(e => e.nit).length} · sin NIT: ${lista.filter(e => !e.nit).length})`)
console.log(`Contactos de una misma empresa que salen una sola vez: ${filas.length - excluidas.length - lista.length}`)
console.log(`Excluidos por no parecer un ISP (${excluidas.length}): ${excluidas.join(' | ')}`)
console.log(`Guardado en ${salida}`)
