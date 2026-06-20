/**
 * migrate-to-turso.mjs
 *
 * Migra la BD local SQLite a Turso.
 * Uso: node scripts/migrate-to-turso.mjs
 *
 * Requiere variables de entorno:
 *   TURSO_DATABASE_URL=libsql://...
 *   TURSO_AUTH_TOKEN=...
 *   DB_PATH=./data/owl.db  (opcional, por defecto ./data/owl.db)
 */

import { createClient } from '@libsql/client'
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const require  = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Cargar .env.local manualmente
import { readFileSync, existsSync } from 'fs'
const envPath = path.join(__dirname, '..', '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
}

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error('Falta TURSO_DATABASE_URL o TURSO_AUTH_TOKEN en .env.local')
  process.exit(1)
}

// Cargar better-sqlite3 para leer la BD local
let Database
try {
  Database = require('better-sqlite3')
} catch {
  console.error('Instala better-sqlite3: npm install better-sqlite3')
  process.exit(1)
}

const dbPath = process.env.DB_PATH ?? path.join(__dirname, '..', 'data', 'owl.db')
console.log('Leyendo BD local:', dbPath)
const local = new Database(dbPath, { readonly: true })

// Conectar a Turso
const turso = createClient({
  url:       process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

// Tablas a migrar (en orden para respetar FK)
const TABLAS = [
  'users',
  'clientes',
  'obligaciones_catalogo',
  'cliente_servicios',
  'cliente_obligaciones',
  'documentos',
  'recordatorio_config',
  'audit_log',
]

async function migrar() {
  console.log('\n=== MIGRANDO ESQUEMA ===')

  // Obtener el DDL de cada tabla y recrearla en Turso
  for (const tabla of TABLAS) {
    const ddl = local.prepare(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name=?`
    ).get(tabla)

    if (!ddl) {
      console.log(`  ⚠ Tabla ${tabla} no existe localmente, omitiendo`)
      continue
    }

    try {
      await turso.execute({ sql: `DROP TABLE IF EXISTS ${tabla}`, args: [] })
      await turso.execute({ sql: ddl.sql, args: [] })
      console.log(`  ✓ Tabla ${tabla} creada`)
    } catch (e) {
      console.error(`  ✗ Error creando ${tabla}:`, e.message)
    }
  }

  // Migrar índices
  console.log('\n=== MIGRANDO ÍNDICES ===')
  const indices = local.prepare(
    `SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL`
  ).all()
  for (const idx of indices) {
    try {
      await turso.execute({ sql: idx.sql, args: [] })
      console.log(`  ✓ Índice creado`)
    } catch (e) {
      // Ignorar duplicados
    }
  }

  console.log('\n=== MIGRANDO DATOS ===')
  for (const tabla of TABLAS) {
    let filas
    try {
      filas = local.prepare(`SELECT * FROM ${tabla}`).all()
    } catch {
      console.log(`  - ${tabla}: tabla no existe localmente, omitiendo datos`)
      continue
    }
    if (filas.length === 0) {
      console.log(`  - ${tabla}: 0 filas`)
      continue
    }

    const cols = Object.keys(filas[0])
    const placeholders = cols.map(() => '?').join(', ')
    const sql = `INSERT OR REPLACE INTO ${tabla} (${cols.join(', ')}) VALUES (${placeholders})`

    // Insertar en batches de 50
    const BATCH = 50
    let insertados = 0
    for (let i = 0; i < filas.length; i += BATCH) {
      const chunk = filas.slice(i, i + BATCH)
      const stmts = chunk.map(row => ({ sql, args: cols.map(c => row[c] ?? null) }))
      await turso.batch(stmts, 'write')
      insertados += chunk.length
    }
    console.log(`  ✓ ${tabla}: ${insertados} filas migradas`)
  }

  console.log('\n=== MIGRACIÓN COMPLETA ===')
  local.close()
}

migrar().catch(e => {
  console.error('Error fatal:', e)
  process.exit(1)
})
