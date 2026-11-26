/**
 * lib/on-demand-db.ts
 * Servicios on demand (2026-11-26): el superadmin crea el servicio (concepto +
 * valor) y comparte un enlace /pago/<token>. Quien paga llena ahí sus datos de
 * contacto y el objeto del servicio; al enviar se genera el Cobro de Trazo
 * (tipo 'on_demand', ver lib/trazo-cobros-flujo.ts) y se le redirige a pagar.
 *
 * El estado del pago se lee de trazo_cobros (por external_reference); aquí
 * solo vive el avance del trabajo, que mueve el equipo a mano.
 */
import crypto from 'crypto'
import { queryAll, queryOne, execute } from './db'
import { migrateTrazoCobros } from './trazo-cobros-db'

export const AVANCES = ['por_iniciar', 'en_curso', 'entregado', 'cancelado'] as const
export type Avance = typeof AVANCES[number]

/** esperando_datos → (el cliente llena el formulario) → pendiente → pagada | rechazada */
export type EstadoPago = 'esperando_datos' | 'pendiente' | 'pagada' | 'rechazada'

let _migrated = false
export async function migrateOnDemand() {
  if (_migrated) return
  _migrated = true
  await migrateTrazoCobros()
  await execute(`
    CREATE TABLE IF NOT EXISTS servicios_on_demand (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      token              TEXT NOT NULL UNIQUE,     -- va en la URL pública /pago/<token>
      concepto           TEXT NOT NULL,
      monto              INTEGER NOT NULL,
      cliente_id         TEXT,                     -- si es de un cliente existente
      nombre             TEXT NOT NULL DEFAULT '', -- datos que llena quien paga
      empresa            TEXT NOT NULL DEFAULT '',
      tipo_id            TEXT NOT NULL DEFAULT 'NIT',
      numero_id          TEXT NOT NULL DEFAULT '',
      telefono           TEXT NOT NULL DEFAULT '',
      correo             TEXT NOT NULL DEFAULT '',
      objeto             TEXT NOT NULL DEFAULT '',
      autorizacion_fecha TEXT,
      datos_at           TEXT,                     -- cuándo llenó el formulario
      external_reference TEXT,                     -- cobro de Trazo (trazo_cobros)
      link_pago          TEXT,
      avance             TEXT NOT NULL DEFAULT 'por_iniciar'
                         CHECK(avance IN ('por_iniciar','en_curso','entregado','cancelado')),
      notas              TEXT NOT NULL DEFAULT '',
      creado_por         TEXT,
      created_at         TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

export interface ServicioOnDemand {
  id: number; token: string; concepto: string; monto: number; cliente_id: string | null
  nombre: string; empresa: string; tipo_id: string; numero_id: string; telefono: string; correo: string; objeto: string
  autorizacion_fecha: string | null; datos_at: string | null
  external_reference: string | null; link_pago: string | null
  avance: Avance; notas: string; creado_por: string | null; created_at: string; updated_at: string
  estado_pago: EstadoPago
}

const SELECT = `
  SELECT s.*,
         CASE WHEN s.external_reference IS NULL THEN 'esperando_datos' ELSE COALESCE(t.estado, 'pendiente') END AS estado_pago
  FROM servicios_on_demand s
  LEFT JOIN trazo_cobros t ON t.external_reference = s.external_reference`

export async function crearServicio(d: {
  concepto: string; monto: number; clienteId?: string | null; creadoPor?: string
  empresa?: string; numeroId?: string; correo?: string; nombre?: string
}): Promise<ServicioOnDemand> {
  await migrateOnDemand()
  const token = crypto.randomBytes(16).toString('base64url')
  await execute(
    `INSERT INTO servicios_on_demand (token, concepto, monto, cliente_id, creado_por, empresa, numero_id, correo, nombre)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [token, d.concepto, d.monto, d.clienteId ?? null, d.creadoPor ?? null,
     d.empresa ?? '', d.numeroId ?? '', d.correo ?? '', d.nombre ?? '']
  )
  return (await buscarServicioPorToken(token))!
}

export async function buscarServicioPorToken(token: string): Promise<ServicioOnDemand | undefined> {
  await migrateOnDemand()
  return queryOne<ServicioOnDemand>(`${SELECT} WHERE s.token = ?`, [token])
}

export async function buscarServicio(id: number): Promise<ServicioOnDemand | undefined> {
  await migrateOnDemand()
  return queryOne<ServicioOnDemand>(`${SELECT} WHERE s.id = ?`, [id])
}

export async function listarServicios(): Promise<ServicioOnDemand[]> {
  await migrateOnDemand()
  return queryAll<ServicioOnDemand>(`${SELECT} ORDER BY s.created_at DESC, s.id DESC LIMIT 300`)
}

export async function guardarDatosSolicitante(id: number, d: {
  nombre: string; empresa: string; tipoId: string; numeroId: string; telefono: string; correo: string; objeto: string
  externalReference: string; linkPago: string
}): Promise<void> {
  await execute(
    `UPDATE servicios_on_demand
        SET nombre = ?, empresa = ?, tipo_id = ?, numero_id = ?, telefono = ?, correo = ?, objeto = ?,
            autorizacion_fecha = datetime('now'), datos_at = datetime('now'),
            external_reference = ?, link_pago = ?, updated_at = datetime('now')
      WHERE id = ?`,
    [d.nombre, d.empresa, d.tipoId, d.numeroId, d.telefono, d.correo, d.objeto, d.externalReference, d.linkPago, id]
  )
}

export async function actualizarSeguimiento(id: number, campos: { avance?: Avance; notas?: string }): Promise<boolean> {
  if (!await buscarServicio(id)) return false
  const sets: string[] = [`updated_at = datetime('now')`]
  const vals: any[] = []
  if (campos.avance !== undefined) { sets.push('avance = ?'); vals.push(campos.avance) }
  if (campos.notas  !== undefined) { sets.push('notas = ?');  vals.push(campos.notas) }
  await execute(`UPDATE servicios_on_demand SET ${sets.join(', ')} WHERE id = ?`, [...vals, id])
  return true
}

export async function eliminarServicio(id: number): Promise<void> {
  await migrateOnDemand()
  await execute(`DELETE FROM servicios_on_demand WHERE id = ?`, [id])
}
