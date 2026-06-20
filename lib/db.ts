/**
 * lib/db.ts
 * Cliente de base de datos — usa @libsql/client.
 * - Desarrollo local: file:./data/owl.db
 * - Producción:       libsql://<turso-url> con TURSO_AUTH_TOKEN
 */

import { createClient, type Client } from '@libsql/client'
import path from 'path'

function getUrl(): string {
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL
  const filePath = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'owl.db')
  return `file:${filePath.replace(/\\/g, '/')}`
}

const globalDb = global as typeof globalThis & { __db?: Client }

if (!globalDb.__db) {
  globalDb.__db = createClient({
    url:       getUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN,
  })
}

export const db = globalDb.__db

// ── Helpers de conveniencia ───────────────────────────────────────────────────

/** Devuelve la primera fila o undefined */
export async function queryOne<T = any>(sql: string, args: any[] = []): Promise<T | undefined> {
  const r = await db.execute({ sql, args })
  return r.rows[0] as T | undefined
}

/** Devuelve todas las filas */
export async function queryAll<T = any>(sql: string, args: any[] = []): Promise<T[]> {
  const r = await db.execute({ sql, args })
  return r.rows as T[]
}

/** Ejecuta INSERT / UPDATE / DELETE */
export async function execute(sql: string, args: any[] = []): Promise<void> {
  await db.execute({ sql, args })
}
