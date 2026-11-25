/**
 * Pasa prospectos existentes a modo automático (lib/ventas-auto.ts): desde ahí el sistema les envía su cadencia por correo,
 * lee las respuestas y los saca de "Para hoy" del equipo. Es lo mismo que el botón "🤖 Pasar a automático" de la ficha, en lote.
 *
 * Uso: node scripts/pasar-a-automatico.mjs [--dry] [--prod] [--campana cold-mailing|webinar|<base>] [--responsable <texto>] [--limite N]
 *   Sin --prod usa SOLO la BD local. Con --prod usa Turso (.env.local). Siempre --dry --prod primero.
 *   Correr DESPUÉS de desplegar el código de ventas automáticas (crea sus columnas la primera vez que se usa).
 *
 * Solo toma los que: tienen la cadencia activa, un correo válido, no se dieron de baja, su correo no rebotó y no están en
 * "No contactar", "No interesado" ni "Cliente". Sigue desde el paso en que van (la llamada se salta). No envía nada:
 * los correos salen en los ciclos de n8n, con los topes por hora y por día, y solo si VENTAS_AUTOMATICAS=activo.
 * Es seguro repetirlo: no toca a los que ya están en automático.
 */
import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, existsSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const opcion = (nombre, porDefecto) => { const i = args.indexOf(nombre); return i >= 0 ? args[i + 1] : porDefecto }
const dry = args.includes('--dry')
const prod = args.includes('--prod')
const campana = opcion('--campana', null)
const responsable = opcion('--responsable', null)
const limite = Number(opcion('--limite', 100000))
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())

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

const columnas = (await db.execute(`PRAGMA table_info(prospectos_isp)`)).rows.map(r => r.name)
if (!columnas.includes('automatico')) {
  console.error('La tabla todavía no tiene las columnas del modo automático: despliega el código y abre Prospectos una vez antes de correr esto.')
  process.exit(1)
}

// Igual que destinatario() de lib/correo-ventas.ts: quien se inscribió al webinar o, si no, el correo de la empresa.
const primerCorreo = s => (String(s ?? '').match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0] ?? '').toLowerCase() || null
const destinatario = f => primerCorreo(f.webinar_correo) ?? primerCorreo(f.correo)

const filas = (await db.execute(
  `SELECT p.id, p.empresa, p.campana, p.cadencia, p.paso_cadencia, p.proxima_fecha, p.correo, p.webinar_correo, u.nombre AS responsable
   FROM prospectos_isp p LEFT JOIN users u ON u.id = p.responsable_id
   WHERE p.automatico = 0 AND p.baja = 0 AND p.correo_invalido = 0 AND p.cadencia_estado = 'activa'
     AND p.estado NOT IN ('No contactar', 'No interesado', 'Cliente')
     ${campana ? 'AND COALESCE(p.campana, \'cold-mailing\') = ?' : ''}
   ORDER BY p.proxima_fecha, p.puesto`, campana ? [campana] : [])).rows
  .filter(f => !responsable || String(f.responsable ?? '').toLowerCase().includes(responsable.toLowerCase()))

const conCorreo = filas.filter(destinatario).slice(0, limite)
console.log(`Con cadencia activa${campana ? ` (campaña ${campana})` : ''}${responsable ? ` de "${responsable}"` : ''}: ${filas.length} · con correo válido: ${filas.filter(destinatario).length} · se pasan: ${conCorreo.length}`)
const cuenta = clave => Object.entries(conCorreo.reduce((a, f) => { const k = clave(f); a[k] = (a[k] ?? 0) + 1; return a }, {}))
  .sort().map(([k, n]) => `${k} ${n}`).join(' · ')
console.log('Por responsable:', cuenta(f => f.responsable ?? 'Sin asignar'))
console.log('Por campaña:', cuenta(f => f.campana ?? 'cold-mailing'))
console.log('Por paso en que van (0 = primer contacto):', cuenta(f => `${f.cadencia} paso ${f.paso_cadencia}`))
const atrasados = conCorreo.filter(f => !f.proxima_fecha || f.proxima_fecha <= hoy).length
console.log(`Les toca correo ya (hoy o atrasados): ${atrasados}. Con el tope de 100 por día, se ponen al día en ~${Math.ceil(atrasados / 100)} día(s) hábil(es).`)

if (dry) { console.log('Simulación: no se escribió nada.'); process.exit(0) }
for (const f of conCorreo) {
  await db.execute(`UPDATE prospectos_isp SET automatico = 1, proxima_fecha = COALESCE(proxima_fecha, ?), updated_at = datetime('now') WHERE id = ?`, [hoy, f.id])
  await db.execute(`INSERT INTO prospectos_isp_historial (id, prospecto_id, estado_anterior, estado_nuevo, user_id, nota)
    SELECT lower(hex(randomblob(16))), id, estado, estado, NULL, ? FROM prospectos_isp WHERE id = ?`,
    [`Pasa a modo automático (en lote): el sistema le envía la cadencia por correo a ${destinatario(f)}`, f.id])
}
console.log(`✓ ${conCorreo.length} prospectos en modo automático.`)
