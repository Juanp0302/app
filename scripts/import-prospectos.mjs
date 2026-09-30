/**
 * Importa las 200 empresas de scripts/prospectos-seed.json (generado a partir
 * de Prospectos_ISP_Abordaje_v2.xlsx) a la tabla prospectos_isp, asignando
 * cada una a su administrador responsable real según su email.
 *
 * Uso: node scripts/import-prospectos.mjs
 * (lee TURSO_DATABASE_URL / TURSO_AUTH_TOKEN de .env.local si existen; si no,
 *  usa la BD sqlite local de desarrollo vía DB_PATH / data/owl.db)
 */
import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, existsSync } from 'fs'
import crypto from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
}

const { createClient } = await import('@libsql/client')
const db = process.env.TURSO_DATABASE_URL
  ? createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })
  : createClient({ url: `file:${path.join(__dirname, '..', 'data', 'owl.db').replace(/\\/g, '/')}` })

// Nombre (columna "Responsable" del Excel) → correo real del administrador.
// "Juan Pablo" se resuelve aparte, contra el usuario marcado is_superadmin=1.
const NOMBRE_A_EMAIL = {
  'Adriana':     'adrisli86@hotmail.com',
  'David':       'davidosogiraldo@gmail.com',
  'Juan Manuel': 'jumahega@gmail.com',
  'Liliana':     'liliana.giral@gmail.com',
}

async function run() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS prospectos_isp (
      id                    TEXT PRIMARY KEY,
      puesto                INTEGER,
      prioridad             TEXT NOT NULL,
      empresa               TEXT NOT NULL,
      nit                   TEXT,
      representante         TEXT,
      telefono              TEXT,
      correo                TEXT,
      municipio             TEXT,
      departamento          TEXT,
      ingresos_semestre     INTEGER,
      expediente_bdi        TEXT,
      tema_detectado        TEXT,
      revisar_a_mano        INTEGER NOT NULL DEFAULT 0,
      canal_sugerido        TEXT,
      whatsapp_1            TEXT,
      whatsapp_2            TEXT,
      whatsapp_3            TEXT,
      llamada_apertura      TEXT,
      guion_llamada         TEXT,
      investigacion_1       TEXT,
      investigacion_2       TEXT,
      investigacion_3       TEXT,
      estado                TEXT NOT NULL DEFAULT 'Pendiente',
      fecha_contacto        TEXT,
      proximo_paso          TEXT,
      notas                 TEXT,
      responsable_id        TEXT REFERENCES users(id),
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_prospectos_responsable ON prospectos_isp(responsable_id)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_prospectos_estado ON prospectos_isp(estado)`)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS prospectos_isp_historial (
      id             TEXT PRIMARY KEY,
      prospecto_id   TEXT NOT NULL REFERENCES prospectos_isp(id),
      estado_anterior TEXT,
      estado_nuevo   TEXT NOT NULL,
      user_id        TEXT REFERENCES users(id),
      nota           TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  console.log('✓ Tablas listas')

  // Ya hay datos importados: no duplicar si se corre dos veces.
  const yaImportado = await db.execute('SELECT COUNT(*) AS n FROM prospectos_isp')
  if (Number(yaImportado.rows[0].n) > 0) {
    console.error(`ABORTADO: ya hay ${yaImportado.rows[0].n} filas en prospectos_isp. Si quieres re-importar, vacía la tabla primero (DELETE FROM prospectos_isp; DELETE FROM prospectos_isp_historial;).`)
    process.exit(1)
  }

  // Resolver Juan Pablo → superadmin real
  const superadminRes = await db.execute('SELECT id, email FROM users WHERE is_superadmin = 1 LIMIT 1')
  if (superadminRes.rows.length > 0) {
    NOMBRE_A_EMAIL['Juan Pablo'] = superadminRes.rows[0].email
    console.log(`  'Juan Pablo' -> superadmin real: ${superadminRes.rows[0].email}`)
  } else {
    console.warn(`  ADVERTENCIA: no se encontró ningún usuario con is_superadmin=1. Las filas de 'Juan Pablo' quedarán sin responsable.`)
  }

  // Resolver cada email a un id de usuario admin real
  const emailAId = {}
  for (const [nombre, email] of Object.entries(NOMBRE_A_EMAIL)) {
    const r = await db.execute('SELECT id, nombre FROM users WHERE lower(email) = lower(?)', [email])
    if (r.rows.length === 0) {
      console.warn(`  ADVERTENCIA: no existe ningún usuario con el correo ${email} (responsable "${nombre}"). Sus prospectos quedarán SIN ASIGNAR.`)
    } else {
      emailAId[nombre] = r.rows[0].id
      console.log(`  '${nombre}' -> ${r.rows[0].nombre} (${email}) [${r.rows[0].id}]`)
    }
  }

  const prospectosPath = path.join(__dirname, 'prospectos-seed.json')
  const prospectos = JSON.parse(readFileSync(prospectosPath, 'utf8'))
  console.log(`\n${prospectos.length} prospectos a importar…`)

  let insertados = 0
  let sinAsignar = 0
  for (const p of prospectos) {
    const responsableId = emailAId[p.responsable_nombre] ?? null
    if (!responsableId) sinAsignar++
    const id = crypto.randomUUID()
    await db.execute({
      sql: `INSERT INTO prospectos_isp
              (id, puesto, prioridad, empresa, nit, representante, telefono, correo, municipio, departamento,
               ingresos_semestre, expediente_bdi, tema_detectado, revisar_a_mano, canal_sugerido,
               whatsapp_1, whatsapp_2, whatsapp_3, llamada_apertura, guion_llamada,
               investigacion_1, investigacion_2, investigacion_3,
               estado, fecha_contacto, proximo_paso, notas, responsable_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        id, p.puesto, p.prioridad, p.empresa, p.nit, p.representante, p.telefono, p.correo,
        p.municipio, p.departamento, p.ingresos_semestre, p.expediente_bdi, p.tema_detectado,
        p.revisar_a_mano ? 1 : 0, p.canal_sugerido ?? null,
        p.whatsapp_1 ?? null, p.whatsapp_2 ?? null, p.whatsapp_3 ?? null, p.llamada_apertura ?? null, p.guion_llamada ?? null,
        p.investigacion_1 ?? null, p.investigacion_2 ?? null, p.investigacion_3 ?? null,
        p.estado, p.fecha_contacto, p.proximo_paso, p.notas, responsableId,
      ],
    })
    insertados++
  }

  console.log(`\n✓ ${insertados} prospectos importados (${sinAsignar} sin responsable asignado).`)
  process.exit(0)
}

run().catch(e => { console.error(e); process.exit(1) })
