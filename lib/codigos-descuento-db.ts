/**
 * lib/codigos-descuento-db.ts
 * Tabla de códigos de descuento aplicables al pago del contrato (cualquier
 * pasarela — Trazo Suscripciones, Trazo Cobros o Wompi, ver
 * docs/trazo-integracion.md). El superadmin los crea desde el dashboard
 * (app/dashboard/superadmin/SuperadminClient.tsx); se aplican en
 * app/api/contrato/publico/route.ts antes de generar el enlace de pago.
 */
import { queryOne, queryAll, execute } from './db'
import crypto from 'crypto'

let _migrated = false
export async function migrateCodigosDescuento() {
  if (_migrated) return
  _migrated = true
  await execute(`
    CREATE TABLE IF NOT EXISTS codigos_descuento (
      id             TEXT PRIMARY KEY,
      codigo         TEXT NOT NULL UNIQUE,     -- siempre en mayúsculas
      tipo           TEXT NOT NULL CHECK(tipo IN ('porcentaje','fijo')),
      valor          INTEGER NOT NULL,          -- 1-100 si es porcentaje, o pesos COP si es fijo
      plan           TEXT,                      -- 'basico'|'pro'|'premium' — NULL = aplica a todos los planes
      usos_maximos   INTEGER,                   -- NULL = sin límite de usos
      usos_actuales  INTEGER NOT NULL DEFAULT 0,
      vigente_hasta  TEXT,                      -- fecha ISO (YYYY-MM-DD) — NULL = sin vencimiento
      activo         INTEGER NOT NULL DEFAULT 1,
      creado_por     TEXT,                      -- email del superadmin que lo creó
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

export interface CodigoDescuentoRow {
  id: string
  codigo: string
  tipo: 'porcentaje' | 'fijo'
  valor: number
  plan: string | null
  usos_maximos: number | null
  usos_actuales: number
  vigente_hasta: string | null
  activo: number
  creado_por: string | null
  created_at: string
  updated_at: string
}

export async function crearCodigoDescuentoRow(row: {
  codigo: string
  tipo: 'porcentaje' | 'fijo'
  valor: number
  plan?: string | null
  usos_maximos?: number | null
  vigente_hasta?: string | null
  creado_por?: string | null
}): Promise<CodigoDescuentoRow> {
  await migrateCodigosDescuento()
  const id = crypto.randomUUID()
  const codigo = row.codigo.trim().toUpperCase()

  const existente = await queryOne(`SELECT id FROM codigos_descuento WHERE codigo = ?`, [codigo])
  if (existente) throw new Error(`Ya existe un código "${codigo}"`)

  await execute(
    `INSERT INTO codigos_descuento (id, codigo, tipo, valor, plan, usos_maximos, vigente_hasta, creado_por)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id, codigo, row.tipo, row.valor, row.plan ?? null, row.usos_maximos ?? null, row.vigente_hasta ?? null, row.creado_por ?? null]
  )
  return (await queryOne<CodigoDescuentoRow>(`SELECT * FROM codigos_descuento WHERE id = ?`, [id]))!
}

export async function listarCodigosDescuentoRows(): Promise<CodigoDescuentoRow[]> {
  await migrateCodigosDescuento()
  return queryAll<CodigoDescuentoRow>(`SELECT * FROM codigos_descuento ORDER BY created_at DESC`)
}

export async function buscarCodigoDescuentoRow(codigo: string): Promise<CodigoDescuentoRow | undefined> {
  await migrateCodigosDescuento()
  return queryOne<CodigoDescuentoRow>(`SELECT * FROM codigos_descuento WHERE codigo = ?`, [codigo.trim().toUpperCase()])
}

export async function actualizarCodigoDescuentoRow(id: string, campos: { activo?: boolean }): Promise<void> {
  await migrateCodigosDescuento()
  const sets: string[] = [`updated_at = datetime('now')`]
  const vals: any[] = []
  if (campos.activo !== undefined) { sets.push('activo = ?'); vals.push(campos.activo ? 1 : 0) }
  await execute(`UPDATE codigos_descuento SET ${sets.join(', ')} WHERE id = ?`, [...vals, id])
}

export async function incrementarUsoCodigoDescuento(codigo: string): Promise<void> {
  await migrateCodigosDescuento()
  await execute(
    `UPDATE codigos_descuento SET usos_actuales = usos_actuales + 1, updated_at = datetime('now') WHERE codigo = ?`,
    [codigo.trim().toUpperCase()]
  )
}

export async function eliminarCodigoDescuentoRow(id: string): Promise<void> {
  await migrateCodigosDescuento()
  await execute(`DELETE FROM codigos_descuento WHERE id = ?`, [id])
}
