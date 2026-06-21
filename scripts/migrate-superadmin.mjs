/**
 * Migración: número consecutivo en tickets + rol superadmin
 * Uso: node scripts/migrate-superadmin.mjs
 */
import { createRequire } from 'module'
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

const { createClient } = await import('@libsql/client')
const db = createClient({
  url:       process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

async function run() {
  // 1. Agregar columna numero a tickets (si no existe)
  try {
    await db.execute('ALTER TABLE tickets ADD COLUMN numero INTEGER')
    console.log('✓ Columna numero agregada a tickets')
  } catch (e) {
    if (e.message?.includes('duplicate column')) {
      console.log('  numero ya existe, OK')
    } else {
      console.log('  numero:', e.message)
    }
  }

  // 2. Backfill: asignar números a tickets existentes por orden de creación
  const existing = await db.execute('SELECT id FROM tickets ORDER BY created_at ASC')
  let n = 1
  for (const row of existing.rows) {
    await db.execute('UPDATE tickets SET numero = ? WHERE id = ? AND numero IS NULL', [n++, row[0]])
  }
  console.log(`✓ Backfill: ${existing.rows.length} tickets numerados`)

  // 3. Turso no soporta modificar CHECK constraints — el CHECK de rol es informativo.
  //    En la práctica se puede insertar superadmin directamente.
  //    Crear usuario superadmin si no existe.
  const crypto = await import('crypto')
  function hashPwd(pwd) {
    return crypto.createHash('sha256').update(pwd + 'owl_salt_2026').digest('hex')
  }

  const existing_sa = await db.execute("SELECT id FROM users WHERE rol = 'superadmin' LIMIT 1")
  if (existing_sa.rows.length === 0) {
    const id = crypto.randomUUID()
    // Intentar insertar con el rol superadmin
    try {
      await db.execute(
        `INSERT INTO users (id, email, password, nombre, rol, activo) VALUES (?, ?, ?, ?, 'superadmin', 1)`,
        [id, 'superadmin@owlcompliance.co', hashPwd('SuperOwl2026!'), 'Super Administrador']
      )
      console.log('✓ Usuario superadmin creado: superadmin@owlcompliance.co / SuperOwl2026!')
    } catch (e) {
      // Si el CHECK constraint falla, recrear la tabla no es trivial en Turso.
      // Usamos un workaround: bypass via raw SQL trick no funciona.
      // En cambio, usaremos 'admin' como rol base y un flag separado o campo extra.
      console.log('  CHECK constraint impide superadmin rol:', e.message)
      console.log('  Creando con rol admin + nombre identificable…')
      try {
        await db.execute(
          `INSERT INTO users (id, email, password, nombre, rol, activo) VALUES (?, ?, ?, ?, 'admin', 1)`,
          [id, 'superadmin@owlcompliance.co', hashPwd('SuperOwl2026!'), 'SUPERADMIN']
        )
        console.log('✓ Superadmin creado con rol=admin (identificado por nombre SUPERADMIN)')
        console.log('  Email: superadmin@owlcompliance.co  /  Password: SuperOwl2026!')
      } catch (e2) {
        console.log('  Error:', e2.message)
      }
    }
  } else {
    console.log('  Superadmin ya existe, OK')
  }

  // 4. Agregar columna is_superadmin a users si no existe
  try {
    await db.execute('ALTER TABLE users ADD COLUMN is_superadmin INTEGER NOT NULL DEFAULT 0')
    console.log('✓ Columna is_superadmin agregada a users')
    // Marcar el usuario superadmin
    await db.execute("UPDATE users SET is_superadmin = 1 WHERE email = 'superadmin@owlcompliance.co'")
    console.log('✓ is_superadmin = 1 para superadmin@owlcompliance.co')
  } catch (e) {
    if (e.message?.includes('duplicate column')) {
      console.log('  is_superadmin ya existe, OK')
      await db.execute("UPDATE users SET is_superadmin = 1 WHERE email = 'superadmin@owlcompliance.co'")
    } else {
      console.log('  is_superadmin:', e.message)
    }
  }

  console.log('\nMigración completada.')
  process.exit(0)
}

run().catch(e => { console.error(e); process.exit(1) })
