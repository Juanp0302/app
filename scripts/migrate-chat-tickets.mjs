/**
 * Agrega las tablas de chat y tickets a la BD (local y Turso).
 * Uso: node scripts/migrate-chat-tickets.mjs
 */

import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, existsSync } from 'fs'

const require   = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Cargar .env.local
const envPath = path.join(__dirname, '..', '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
}

const { createClient } = await import('@libsql/client')

const db = createClient({
  url:       process.env.TURSO_DATABASE_URL ?? `file:${path.join(__dirname, '..', 'data', 'owl.db').replace(/\\/g, '/')}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const stmts = [
  // Especialidades de admins
  `CREATE TABLE IF NOT EXISTS admin_especialidades (
    id      TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    tipo    TEXT NOT NULL CHECK(tipo IN ('financiera','tecnica','juridica','transversal')),
    UNIQUE(user_id, tipo)
  )`,

  // Conversaciones de chat
  `CREATE TABLE IF NOT EXISTS conversaciones (
    id         TEXT PRIMARY KEY,
    cliente_id TEXT NOT NULL REFERENCES clientes(id),
    admin_id   TEXT REFERENCES users(id),
    tipo       TEXT NOT NULL CHECK(tipo IN ('financiera','tecnica','juridica','transversal')),
    asunto     TEXT NOT NULL,
    estado     TEXT NOT NULL DEFAULT 'activa' CHECK(estado IN ('activa','cerrada')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // Mensajes de chat
  `CREATE TABLE IF NOT EXISTS mensajes (
    id               TEXT PRIMARY KEY,
    conversacion_id  TEXT NOT NULL REFERENCES conversaciones(id),
    user_id          TEXT NOT NULL REFERENCES users(id),
    contenido        TEXT NOT NULL,
    origen           TEXT NOT NULL DEFAULT 'humano' CHECK(origen IN ('humano','ia')),
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // Tickets
  `CREATE TABLE IF NOT EXISTS tickets (
    id          TEXT PRIMARY KEY,
    cliente_id  TEXT NOT NULL REFERENCES clientes(id),
    admin_id    TEXT REFERENCES users(id),
    tipo        TEXT NOT NULL CHECK(tipo IN ('financiera','tecnica','juridica','transversal')),
    asunto      TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    prioridad   TEXT NOT NULL DEFAULT 'normal' CHECK(prioridad IN ('baja','normal','alta','urgente')),
    estado      TEXT NOT NULL DEFAULT 'abierto' CHECK(estado IN ('abierto','en_progreso','resuelto','cerrado')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // Respuestas a tickets
  `CREATE TABLE IF NOT EXISTS ticket_respuestas (
    id         TEXT PRIMARY KEY,
    ticket_id  TEXT NOT NULL REFERENCES tickets(id),
    user_id    TEXT NOT NULL REFERENCES users(id),
    contenido  TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // Historial de reasignaciones (chat y tickets)
  `CREATE TABLE IF NOT EXISTS reasignaciones (
    id           TEXT PRIMARY KEY,
    entidad      TEXT NOT NULL CHECK(entidad IN ('conversacion','ticket')),
    entidad_id   TEXT NOT NULL,
    de_admin_id  TEXT REFERENCES users(id),
    a_admin_id   TEXT NOT NULL REFERENCES users(id),
    motivo       TEXT,
    user_id      TEXT NOT NULL REFERENCES users(id),
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
]

console.log('Creando tablas...')
for (const sql of stmts) {
  await db.execute({ sql, args: [] })
  const tabla = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1]
  console.log(`  ✓ ${tabla}`)
}
console.log('Listo.')
