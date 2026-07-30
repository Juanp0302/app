/**
 * lib/trazo-db.ts
 * Tabla de seguimiento de suscripciones de Trazo.
 *
 * Una fila por Suscripción creada en Trazo. Nace en estado 'pendiente' cuando
 * el prospecto firma el contrato (aún no existe su cuenta), y el webhook de
 * Trazo la va moviendo: activa → (vencida | cancelada | completada).
 * Al activarse se crea la cuenta del cliente y se guarda cliente_id.
 */
import { db, queryOne, execute } from './db'
import crypto from 'crypto'

let _migrated = false
export async function migrateTrazo() {
  if (_migrated) return
  _migrated = true
  await execute(`
    CREATE TABLE IF NOT EXISTS trazo_suscripciones (
      id               TEXT PRIMARY KEY,
      subscription_id  TEXT NOT NULL UNIQUE,   -- id de la suscripción en Trazo
      plan_id_trazo    TEXT NOT NULL,          -- id del Plan en Trazo (uno por cliente)
      plan             TEXT NOT NULL,          -- basico | pro | premium
      subscription_url TEXT,                   -- enlace de vinculación del medio de pago
      cliente_email    TEXT NOT NULL,
      cliente_nombre   TEXT NOT NULL,          -- razón social
      contrato_datos   TEXT,                   -- JSON del formulario del contrato firmado
      estado           TEXT NOT NULL DEFAULT 'pendiente'
                       CHECK(estado IN ('pendiente','activa','vencida','cancelada','completada')),
      cliente_id       TEXT,                   -- se llena cuando el webhook 'activated' crea la cuenta
      renovacion_de    TEXT,                   -- subscription_id anterior si esta fila es una renovación
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

export interface TrazoSuscripcionRow {
  id: string
  subscription_id: string
  plan_id_trazo: string
  plan: string
  subscription_url: string | null
  cliente_email: string
  cliente_nombre: string
  contrato_datos: string | null
  estado: string
  cliente_id: string | null
  renovacion_de: string | null
  created_at: string
  updated_at: string
}

export async function guardarSuscripcionTrazo(row: {
  subscription_id: string
  plan_id_trazo: string
  plan: string
  subscription_url: string | null
  cliente_email: string
  cliente_nombre: string
  contrato_datos?: object | null
  cliente_id?: string | null
  renovacion_de?: string | null
}): Promise<void> {
  await migrateTrazo()
  await db.execute({
    sql: `INSERT INTO trazo_suscripciones
            (id, subscription_id, plan_id_trazo, plan, subscription_url,
             cliente_email, cliente_nombre, contrato_datos, cliente_id, renovacion_de)
          VALUES (?,?,?,?,?,?,?,?,?,?)`,
    args: [
      crypto.randomUUID(),
      row.subscription_id,
      row.plan_id_trazo,
      row.plan,
      row.subscription_url ?? null,
      row.cliente_email,
      row.cliente_nombre,
      row.contrato_datos ? JSON.stringify(row.contrato_datos) : null,
      row.cliente_id ?? null,
      row.renovacion_de ?? null,
    ],
  })
}

export async function buscarSuscripcionTrazo(subscriptionId: string): Promise<TrazoSuscripcionRow | undefined> {
  await migrateTrazo()
  return queryOne<TrazoSuscripcionRow>(
    `SELECT * FROM trazo_suscripciones WHERE subscription_id = ?`,
    [subscriptionId]
  )
}

export async function actualizarSuscripcionTrazo(
  subscriptionId: string,
  campos: { estado?: string; cliente_id?: string },
): Promise<void> {
  const sets: string[] = [`updated_at = datetime('now')`]
  const vals: any[] = []
  if (campos.estado)     { sets.push('estado = ?');     vals.push(campos.estado) }
  if (campos.cliente_id) { sets.push('cliente_id = ?'); vals.push(campos.cliente_id) }
  await execute(
    `UPDATE trazo_suscripciones SET ${sets.join(', ')} WHERE subscription_id = ?`,
    [...vals, subscriptionId]
  )
}
