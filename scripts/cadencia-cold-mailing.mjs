/**
 * Activa la cadencia "cold-mailing" (lib/cadencias.ts) para los prospectos del cold mailing que todavía no tienen una:
 * les pone el paso 1 y la fecha en que toca, para que aparezcan en "Para hoy". Los 11 que ya siguen la del webinar no se tocan.
 *
 * Uso: node scripts/cadencia-cold-mailing.mjs [--dry] [--prod] [--inicio AAAA-MM-DD] [--por-dia 25]
 *   Sin --prod usa SOLO la BD local (DB_PATH o data/owl.db). Con --prod usa Turso (.env.local). Recomendado: --dry --prod primero.
 *
 * - Solo escribe cadencia, paso, estado de la cadencia y fecha; no cambia el estado del prospecto, el responsable ni nada más.
 * - Orden de trabajo: primero los de investigación abierta (A), luego sanción registrada (B), luego los demás por su puesto.
 * - Escalonado: de a --por-dia por responsable, empezando el día hábil siguiente a --inicio (por defecto, hoy), para no mandar
 *   cientos de WhatsApp el mismo día desde un mismo número.
 * Es seguro repetirlo: solo toca los que no tienen cadencia.
 */
import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, existsSync } from 'fs'
import { fechasDeInicio } from '../lib/reparto.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const opcion = (nombre, porDefecto) => { const i = args.indexOf(nombre); return i >= 0 ? args[i + 1] : porDefecto }
const dry = args.includes('--dry')
const prod = args.includes('--prod')
const hoyBogota = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
const inicio = opcion('--inicio', hoyBogota)
const porDia = Math.max(1, Number(opcion('--por-dia', 25)))

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

const RANGO = { A: 0, B: 1, C1: 2, C2: 3 }
const filas = (await db.execute(`SELECT p.id, p.puesto, p.prioridad, p.estado, p.responsable_id, u.nombre AS responsable
  FROM prospectos_isp p LEFT JOIN users u ON u.id = p.responsable_id
  WHERE COALESCE(p.campana, 'cold-mailing') = 'cold-mailing' AND p.cadencia IS NULL AND p.estado IN ('Pendiente', 'WA1 enviado')`)).rows
  .sort((a, b) => (RANGO[a.prioridad] ?? 9) - (RANGO[b.prioridad] ?? 9) || Number(a.puesto) - Number(b.puesto))

const fechas = fechasDeInicio(filas.map(f => ({ clave: f.id, asistio: false, responsable: f.responsable_id ?? 'sin' })), inicio, porDia)
console.log(`Prospectos del cold mailing sin cadencia: ${filas.length} · de a ${porDia} por responsable por día desde el día hábil siguiente a ${inicio}`)

const porResp = {}, porFecha = {}
for (const f of filas) {
  const nombre = f.responsable ?? 'Sin asignar'
  porResp[nombre] = (porResp[nombre] ?? 0) + 1
  const d = fechas.get(f.id); porFecha[d] = (porFecha[d] ?? 0) + 1
}
console.log('Por responsable:', Object.entries(porResp).map(([n, c]) => `${n} ${c}`).join(' · '))
console.log('Primer mensaje por día:', Object.entries(porFecha).sort().map(([d, c]) => `${d}: ${c}`).join(' · '))
console.log('Ya con "WA1 enviado" (la invitación al webinar):', filas.filter(f => f.estado === 'WA1 enviado').length)

if (!dry && filas.length) {
  const stmts = filas.map(f => ({
    sql: `UPDATE prospectos_isp SET cadencia = 'cold-mailing', paso_cadencia = 0, cadencia_estado = 'activa', proxima_fecha = ?, updated_at = datetime('now')
          WHERE id = ? AND cadencia IS NULL`,
    args: [fechas.get(f.id), f.id],
  }))
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100), 'write')
  console.log(`✓ Cadencia activada en ${filas.length} prospectos.`)
}
