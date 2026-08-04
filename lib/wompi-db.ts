/**
 * lib/wompi-db.ts
 * Tabla de seguimiento de pagos de Wompi (Plan B, sin suscripciones).
 *
 * Una fila por enlace de checkout generado (una por contrato firmado, y una
 * por cada cobro mensual posterior que se genere manualmente). El webhook de
 * Wompi la mueve de 'pendiente' a 'aprobada' | 'rechazada'.
 */
import { queryOne, execute } from './db'
import crypto from 'crypto'

let _migrated = false
export async function migrateWompi() {
  if (_migrated) return
  _migrated = true
  await execute(`
    CREATE TABLE IF NOT EXISTS wompi_pagos (
      id             TEXT PRIMARY KEY,
      reference      TEXT NOT NULL UNIQUE,   -- reference único enviado a Wompi
      plan           TEXT NOT NULL,          -- basico | pro | premium
      monto          INTEGER NOT NULL,       -- COP, valor entero (no centavos)
      checkout_url   TEXT,
      cliente_email  TEXT NOT NULL,
      cliente_nombre TEXT NOT NULL,          -- razón social
      contrato_datos TEXT,                   -- JSON del formulario del contrato firmado (solo en el primer pago)
      estado         TEXT NOT NULL DEFAULT 'pendiente'
                     CHECK(estado IN ('pendiente','aprobada','rechazada','error')),
      transaction_id TEXT,                   -- id de la transacción en Wompi, una vez notificada
      cliente_id     TEXT,                   -- se llena cuando el webhook aprueba el primer pago
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

export interface WompiPagoRow {
  id: string
  reference: string
  plan: string
  monto: number
  checkout_url: string | null
  cliente_email: string
  cliente_nombre: string
  contrato_datos: string | null
  estado: string
  transaction_id: string | null
  cliente_id: string | null
  created_at: string
  updated_at: string
}

export async function guardarPagoWompi(row: {
  reference: string
  plan: string
  monto: number
  checkout_url: string
  cliente_email: string
  cliente_nombre: string
  contrato_datos?: object | null
  cliente_id?: string | null
}): Promise<void> {
  await migrateWompi()
  await execute(
    `INSERT INTO wompi_pagos
       (id, reference, plan, monto, checkout_url, cliente_email, cliente_nombre, contrato_datos, cliente_id)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      crypto.randomUUID(),
      row.reference,
      row.plan,
      row.monto,
      row.checkout_url,
      row.cliente_email,
      row.cliente_nombre,
      row.contrato_datos ? JSON.stringify(row.contrato_datos) : null,
      row.cliente_id ?? null,
    ]
  )
}

export async function buscarPagoWompi(reference: string): Promise<WompiPagoRow | undefined> {
  await migrateWompi()
  return queryOne<WompiPagoRow>(`SELECT * FROM wompi_pagos WHERE reference = ?`, [reference])
}

export async function actualizarPagoWompi(
  reference: string,
  campos: { estado?: string; transaction_id?: string; cliente_id?: string },
): Promise<void> {
  const sets: string[] = [`updated_at = datetime('now')`]
  const vals: any[] = []
  if (campos.estado)         { sets.push('estado = ?');         vals.push(campos.estado) }
  if (campos.transaction_id) { sets.push('transaction_id = ?'); vals.push(campos.transaction_id) }
  if (campos.cliente_id)     { sets.push('cliente_id = ?');     vals.push(campos.cliente_id) }
  await execute(
    `UPDATE wompi_pagos SET ${sets.join(', ')} WHERE reference = ?`,
    [...vals, reference]
  )
}
