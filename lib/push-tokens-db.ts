/**
 * lib/push-tokens-db.ts
 * Tokens de dispositivo (Firebase Cloud Messaging) para notificaciones
 * push de la app móvil de administradores.
 */
import { execute, queryAll } from './db'
import crypto from 'crypto'

let _migrated = false

export async function migratePushTokens() {
  if (_migrated) return
  _migrated = true
  await execute(`
    CREATE TABLE IF NOT EXISTS push_tokens (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id),
      token      TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    )
  `)
}

export async function registrarPushToken(userId: string, token: string) {
  await migratePushTokens()
  await execute(
    `INSERT INTO push_tokens (id, user_id, token, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id`,
    [crypto.randomUUID(), userId, token, new Date().toISOString()]
  )
}

export async function eliminarPushToken(token: string) {
  await migratePushTokens()
  await execute(`DELETE FROM push_tokens WHERE token = ?`, [token])
}

/** Tokens de dispositivo registrados para un usuario (puede tener varios celulares). */
export async function tokensDeUsuario(userId: string): Promise<string[]> {
  await migratePushTokens()
  const rows = await queryAll(`SELECT token FROM push_tokens WHERE user_id = ?`, [userId]) as any[]
  return rows.map(r => r.token)
}
