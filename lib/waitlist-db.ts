/**
 * lib/waitlist-db.ts
 * Lista de espera de clientes interesados en suscribirse mientras
 * la pasarela de pago (Trazo) no está activa en autoservicio.
 */

import { db, queryAll } from './db'

let _migrated = false

export async function migrateWaitlist() {
  if (_migrated) return
  _migrated = true

  await db.execute(`
    CREATE TABLE IF NOT EXISTS lista_espera (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre     TEXT    NOT NULL,
      email      TEXT    NOT NULL,
      telefono   TEXT,
      empresa    TEXT,
      plan       TEXT,
      creado_at  TEXT    NOT NULL
    )
  `)
}

export interface WaitlistEntrada {
  nombre:   string
  email:    string
  telefono?: string
  empresa?:  string
  plan?:     string
}

export async function crearWaitlistEntrada(e: WaitlistEntrada) {
  await db.execute({
    sql: `INSERT INTO lista_espera (nombre, email, telefono, empresa, plan, creado_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [e.nombre, e.email, e.telefono ?? null, e.empresa ?? null, e.plan ?? null, new Date().toISOString()],
  })
}

export async function listarWaitlist() {
  await migrateWaitlist()
  return queryAll(`SELECT * FROM lista_espera ORDER BY creado_at DESC`)
}
