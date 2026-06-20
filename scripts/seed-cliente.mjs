/**
 * seed-cliente.mjs
 * Crea un cliente de prueba con servicios ISP + IPTV para desarrollo.
 * Uso: node scripts/seed-cliente.mjs
 */

import Database from 'better-sqlite3'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const db = new Database(path.join(__dirname, '../data/owl.db'))
db.pragma('foreign_keys = ON')

function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd + 'owl_salt_2026').digest('hex')
}

function uuid() { return crypto.randomUUID() }

const exists = db.prepare("SELECT id FROM users WHERE email = 'cliente@isp-demo.co'").get()
if (exists) {
  console.log('Cliente de prueba ya existe. Saltando.')
  db.close(); process.exit(0)
}

const userId    = uuid()
const clienteId = uuid()

const crear = db.transaction(() => {
  // Usuario
  db.prepare(`INSERT INTO users (id, email, password, nombre, rol) VALUES (?,?,?,?,'cliente')`)
    .run(userId, 'cliente@isp-demo.co', hashPassword('demo123'), 'Contacto Demo')

  // Empresa
  db.prepare(`INSERT INTO clientes (id, user_id, razon_social, nit, contacto, email, telefono)
              VALUES (?,?,?,?,?,?,?)`)
    .run(clienteId, userId, 'Internet Regional S.A.S.', '900123456-7',
         'Contacto Demo', 'cliente@isp-demo.co', '3001234567')

  // Servicios: ISP + IPTV
  for (const slug of ['isp_sva', 'iptv_sva']) {
    db.prepare(`INSERT OR IGNORE INTO cliente_servicios (id, cliente_id, servicio) VALUES (?,?,?)`)
      .run(uuid(), clienteId, slug)

    const subs = db.prepare(
      `SELECT sub_id FROM obligaciones_catalogo WHERE servicio_slug = ?`
    ).all(slug)

    for (const { sub_id } of subs) {
      db.prepare(`INSERT OR IGNORE INTO cliente_obligaciones (id, cliente_id, catalogo_id, estado)
                  VALUES (?,?,?,'pendiente')`)
        .run(uuid(), clienteId, sub_id)
    }
  }
})

crear()

const total = db.prepare(`SELECT COUNT(*) as n FROM cliente_obligaciones WHERE cliente_id = ?`)
  .get(clienteId).n

console.log('✓ Cliente de prueba creado:')
console.log('  Empresa:      Internet Regional S.A.S.')
console.log('  Email:        cliente@isp-demo.co')
console.log('  Contraseña:   demo123')
console.log('  Servicios:    ISP (SVA) + IPTV (SVA)')
console.log(`  Obligaciones: ${total} subobligaciones asignadas`)

db.close()
