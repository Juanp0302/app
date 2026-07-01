/**
 * scripts/migrate-mfa.mjs
 * Crea la tabla mfa_tokens para el segundo factor de autenticación.
 * Ejecutar: node scripts/migrate-mfa.mjs
 */
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, existsSync } from 'fs'

const require   = createRequire(import.meta.url)
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
  url:       process.env.TURSO_DATABASE_URL ?? `file:${path.join(__dirname, '..', 'data', 'owl.db').replace(/\\/g, '/')}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

await db.execute({
  sql: `CREATE TABLE IF NOT EXISTS mfa_tokens (
    id         TEXT PRIMARY KEY,
    email      TEXT NOT NULL,
    code       TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used       INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  args: [],
})

await db.execute({
  sql: `CREATE INDEX IF NOT EXISTS idx_mfa_tokens_email ON mfa_tokens(email)`,
  args: [],
})

console.log('✓ Tabla mfa_tokens creada')
process.exit(0)
