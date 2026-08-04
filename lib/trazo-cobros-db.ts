/**
 * lib/trazo-cobros-db.ts
 * Tabla de seguimiento de Cobros de Trazo (pago único, sin suscripción).
 *
 * Una fila por Cobro generado (uno al firmar el contrato, y uno por cada
 * mensualidad posterior). El webhook de pagos de Trazo la mueve de
 * 'pendiente' a 'pagada' | 'rechazada'.
 */
import { queryOne, execute } from './db'
import crypto from 'crypto'

let _migrated = false
export async function migrateTrazoCobros() {
  if (_migrated) return
  _migrated = true
  await execute(`
    CREATE TABLE IF NOT EXISTS trazo_cobros (
      id                 TEXT PRIMARY KEY,
      external_reference TEXT NOT NULL UNIQUE,  -- external_reference devuelto por Trazo al crear el cobro
      process_id         TEXT,
      plan               TEXT NOT NULL,          -- basico | pro | premium
      monto              INTEGER NOT NULL,
      link               TEXT,
      cliente_email      TEXT NOT NULL,
      cliente_nombre     TEXT NOT NULL,          -- razón social
      contrato_datos     TEXT,                   -- JSON del formulario del contrato firmado (solo en el primer cobro)
      estado             TEXT NOT NULL DEFAULT 'pendiente'
                         CHECK(estado IN ('pendiente','pagada','rechazada')),
      cliente_id         TEXT,                   -- se llena cuando el webhook aprueba el primer cobro
      created_at         TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

export interface TrazoCobroRow {
  id: string
  external_reference: string
  process_id: string | null
  plan: string
  monto: number
  link: string | null
  cliente_email: string
  cliente_nombre: string
  contrato_datos: string | null
  estado: string
  cliente_id: string | null
  created_at: string
  updated_at: string
}

export async function guardarCobroTrazo(row: {
  external_reference: string
  process_id?: string | null
  plan: string
  monto: number
  link: string
  cliente_email: string
  cliente_nombre: string
  contrato_datos?: object | null
  cliente_id?: string | null
}): Promise<void> {
  await migrateTrazoCobros()
  await execute(
    `INSERT INTO trazo_cobros
       (id, external_reference, process_id, plan, monto, link, cliente_email, cliente_nombre, contrato_datos, cliente_id)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      crypto.randomUUID(),
      row.external_reference,
      row.process_id ?? null,
      row.plan,
      row.monto,
      row.link,
      row.cliente_email,
      row.cliente_nombre,
      row.contrato_datos ? JSON.stringify(row.contrato_datos) : null,
      row.cliente_id ?? null,
    ]
  )
}

export async function buscarCobroTrazo(externalReference: string): Promise<TrazoCobroRow | undefined> {
  await migrateTrazoCobros()
  return queryOne<TrazoCobroRow>(`SELECT * FROM trazo_cobros WHERE external_reference = ?`, [externalReference])
}

/**
 * Lista los cobros más recientes, para la pantalla de confirmación manual
 * mientras el webhook de Trazo no está registrado (ver lib/trazo-cobros-flujo.ts
 * → confirmarCobroManual). Por defecto solo los pendientes.
 */
export async function listarCobrosTrazo(soloPendientes = true): Promise<TrazoCobroRow[]> {
  await migrateTrazoCobros()
  const { queryAll } = await import('./db')
  return queryAll<TrazoCobroRow>(
    soloPendientes
      ? `SELECT * FROM trazo_cobros WHERE estado = 'pendiente' ORDER BY created_at DESC`
      : `SELECT * FROM trazo_cobros ORDER BY created_at DESC LIMIT 100`
  )
}

/**
 * Quita un cobro del seguimiento local (ej. duplicado, prueba, o uno que ya
 * no se va a cobrar). No cancela nada del lado de Trazo — solo deja de
 * aparecer en la pantalla de confirmación manual del superadmin.
 */
export async function eliminarCobroTrazo(externalReference: string): Promise<void> {
  await migrateTrazoCobros()
  await execute(`DELETE FROM trazo_cobros WHERE external_reference = ?`, [externalReference])
}

export async function actualizarCobroTrazo(
  externalReference: string,
  campos: { estado?: string; cliente_id?: string },
): Promise<void> {
  const sets: string[] = [`updated_at = datetime('now')`]
  const vals: any[] = []
  if (campos.estado)     { sets.push('estado = ?');     vals.push(campos.estado) }
  if (campos.cliente_id) { sets.push('cliente_id = ?'); vals.push(campos.cliente_id) }
  await execute(
    `UPDATE trazo_cobros SET ${sets.join(', ')} WHERE external_reference = ?`,
    [...vals, externalReference]
  )
}
