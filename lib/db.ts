/**
 * lib/db.ts
 * Conexión única a la base de datos SQLite.
 * Importar este módulo desde cualquier parte de la app para consultar datos.
 */

import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'data', 'owl.db')

// En desarrollo reutilizamos la conexión entre hot-reloads de Next.js
const globalDb = global as typeof globalThis & { __db?: Database.Database }

function getDb(): Database.Database {
  if (!globalDb.__db) {
    globalDb.__db = new Database(DB_PATH)
    globalDb.__db.pragma('journal_mode = WAL')
    globalDb.__db.pragma('foreign_keys = ON')
  }
  return globalDb.__db
}

export const db = getDb()
