/**
 * lib/contrato-db.ts
 * Operaciones de base de datos para contratos y cuentas de cobro.
 */

import { db, execute, queryOne, queryAll } from './db'

// ── Migración ─────────────────────────────────────────────────────────────────

let _migrated = false

export async function migrateContrato() {
  if (_migrated) return
  _migrated = true

  const colsClientes = [
    `ALTER TABLE clientes ADD COLUMN contrato_aceptado_at TEXT`,
    `ALTER TABLE clientes ADD COLUMN contrato_ip TEXT`,
    `ALTER TABLE clientes ADD COLUMN contrato_datos TEXT`,
    `ALTER TABLE clientes ADD COLUMN cuenta_cobro_solicitada INTEGER DEFAULT 0`,
  ]
  for (const sql of colsClientes) {
    try { await execute(sql) } catch { /* columna ya existe */ }
  }

  await execute(`
    CREATE TABLE IF NOT EXISTS cuentas_cobro (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      numero           TEXT    NOT NULL UNIQUE,
      cliente_id       TEXT    NOT NULL,
      plan             TEXT    NOT NULL,
      monto            INTEGER NOT NULL,
      concepto         TEXT    NOT NULL,
      mes              TEXT    NOT NULL,
      fecha_emision    TEXT    NOT NULL,
      drive_url        TEXT,
      enviada_at       TEXT
    )
  `)
}

// ── Cuentas de cobro ──────────────────────────────────────────────────────────

export interface CuentaCobroData {
  clienteId:    string
  plan:         string
  monto:        number
  concepto:     string
  mes:          string     // YYYY-MM
  fechaEmision: string     // ISO date
  driveUrl?:    string
}

/**
 * Inserta una cuenta de cobro y devuelve el número consecutivo real
 * basado en el AUTOINCREMENT id de la fila, garantizando unicidad
 * incluso con solicitudes concurrentes.
 * Formato: OWL-{AA}-{000001}
 */
export async function crearCuentaCobro(data: CuentaCobroData): Promise<string> {
  const anio   = new Date(data.fechaEmision).getFullYear()
  const prefijo = `OWL-${String(anio).slice(-2)}-`

  // 1. Insertar con número provisional
  const result = await db.execute({
    sql:  `INSERT INTO cuentas_cobro (numero, cliente_id, plan, monto, concepto, mes, fecha_emision, drive_url, enviada_at)
           VALUES ('PENDING', ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [data.clienteId, data.plan, data.monto, data.concepto,
           data.mes, data.fechaEmision, data.driveUrl ?? null, new Date().toISOString()],
  })

  const id     = Number(result.lastInsertRowid)
  const numero = `${prefijo}${String(id).padStart(6, '0')}`

  // 2. Actualizar con el número definitivo
  await db.execute({
    sql:  `UPDATE cuentas_cobro SET numero = ? WHERE id = ?`,
    args: [numero, id],
  })

  return numero
}

// ── Contrato ──────────────────────────────────────────────────────────────────

export interface ContratoAceptacion {
  clienteId:            string
  ip:                   string
  datos: {
    nombreCliente:       string
    tipoPersona:         string
    tipoIdentificacion:  string
    numeroIdentificacion:string
    ciudadCliente:       string
    nombreRepresentante: string
    ccRepresentante:     string
    plan:                string
    cuentaCobroSolicitada: boolean
  }
}

export async function guardarAceptacionContrato(a: ContratoAceptacion) {
  await execute(
    `UPDATE clientes
     SET contrato_aceptado_at      = ?,
         contrato_ip               = ?,
         contrato_datos            = ?,
         cuenta_cobro_solicitada   = ?
     WHERE id = ?`,
    [
      new Date().toISOString(),
      a.ip,
      JSON.stringify(a.datos),
      a.datos.cuentaCobroSolicitada ? 1 : 0,
      a.clienteId,
    ]
  )
}

/** Devuelve true si el cliente ya tiene contrato firmado */
export async function tieneContratoFirmado(clienteId: string): Promise<boolean> {
  const row = await queryOne(
    `SELECT contrato_aceptado_at FROM clientes WHERE id = ?`,
    [clienteId]
  ) as any
  return !!row?.contrato_aceptado_at
}

/** Clientes con cuenta de cobro que vencen en X días (para rutina mensual) */
export async function clientesProximaRenovacion(diasAntes: number) {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + diasAntes)
  const fechaISO = fecha.toISOString().slice(0, 10)
  return queryAll(
    `SELECT c.id, c.nombre, c.plan, c.suscripcion_vencimiento, c.cuenta_cobro_solicitada, u.email
     FROM clientes c
     JOIN users u ON u.id = c.user_id
     WHERE c.cuenta_cobro_solicitada = 1
       AND DATE(c.suscripcion_vencimiento) = ?
       AND c.suscripcion_estado = 'activa'`,
    [fechaISO]
  )
}
