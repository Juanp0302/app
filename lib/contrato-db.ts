/**
 * lib/contrato-db.ts
 * Operaciones de base de datos para contratos y cuentas de cobro.
 */

import { execute, queryOne, queryAll } from './db'

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

/** Genera el siguiente número de cuenta de cobro para el año dado (ej. 2026 → "OWL-26-00001") */
export async function siguienteNumeroCuenta(anio: number): Promise<string> {
  const prefijo = `OWL-${String(anio).slice(-2)}-`
  const row = await queryOne(
    `SELECT COUNT(*) as cnt FROM cuentas_cobro WHERE numero LIKE ?`,
    [`${prefijo}%`]
  ) as any
  const siguiente = (row?.cnt ?? 0) + 1
  return `${prefijo}${String(siguiente).padStart(6, '0')}`
}

export interface CuentaCobroData {
  numero:       string
  clienteId:    string
  plan:         string
  monto:        number
  concepto:     string
  mes:          string     // YYYY-MM
  fechaEmision: string     // ISO date
  driveUrl?:    string
}

export async function crearCuentaCobro(data: CuentaCobroData) {
  await execute(
    `INSERT INTO cuentas_cobro (numero, cliente_id, plan, monto, concepto, mes, fecha_emision, drive_url, enviada_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.numero, data.clienteId, data.plan, data.monto, data.concepto,
     data.mes, data.fechaEmision, data.driveUrl ?? null, new Date().toISOString()]
  )
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
