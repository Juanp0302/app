/**
 * lib/clientes.ts
 * Funciones para crear y gestionar clientes.
 */

import { db, queryOne, queryAll, execute } from './db'
import crypto from 'crypto'
import { hashPassword } from './password'

export interface ClienteInput {
  razon_social: string
  nit?:         string
  contacto?:    string
  email?:       string
  telefono?:    string
  servicios:    string[]
  user_email:   string
  user_nombre:  string
  user_password: string
}

export async function crearCliente(input: ClienteInput) {
  const userId    = crypto.randomUUID()
  const clienteId = crypto.randomUUID()

  const stmts: { sql: string; args: any[] }[] = [
    { sql: `INSERT INTO users (id, email, password, nombre, rol) VALUES (?, ?, ?, ?, 'cliente')`,
      args: [userId, input.user_email, await hashPassword(input.user_password), input.user_nombre] },
    { sql: `INSERT INTO clientes (id, user_id, razon_social, nit, contacto, email, telefono) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [clienteId, userId, input.razon_social, input.nit ?? null, input.contacto ?? null, input.email ?? null, input.telefono ?? null] },
  ]

  for (const slug of input.servicios) {
    stmts.push({ sql: `INSERT OR IGNORE INTO cliente_servicios (id, cliente_id, servicio) VALUES (?, ?, ?)`,
      args: [crypto.randomUUID(), clienteId, slug] })
    const subs = await queryAll('SELECT sub_id FROM obligaciones_catalogo WHERE servicio_slug = ?', [slug])
    for (const s of subs as any[]) {
      stmts.push({ sql: `INSERT OR IGNORE INTO cliente_obligaciones (id, cliente_id, catalogo_id, estado) VALUES (?, ?, ?, 'pendiente')`,
        args: [crypto.randomUUID(), clienteId, s.sub_id] })
    }
  }

  await db.batch(stmts, 'write')
  return { userId, clienteId }
}

export async function asignarServicio(clienteId: string, servicioSlug: string) {
  const stmts: { sql: string; args: any[] }[] = [
    { sql: `INSERT OR IGNORE INTO cliente_servicios (id, cliente_id, servicio) VALUES (?, ?, ?)`,
      args: [crypto.randomUUID(), clienteId, servicioSlug] },
  ]
  const subs = await queryAll('SELECT sub_id FROM obligaciones_catalogo WHERE servicio_slug = ?', [servicioSlug])
  for (const s of subs as any[]) {
    stmts.push({ sql: `INSERT OR IGNORE INTO cliente_obligaciones (id, cliente_id, catalogo_id, estado) VALUES (?, ?, ?, 'pendiente')`,
      args: [crypto.randomUUID(), clienteId, s.sub_id] })
  }
  await db.batch(stmts, 'write')
  return subs.length
}

export async function listarClientes() {
  return queryAll(`
    SELECT c.id, c.razon_social, c.nit, c.contacto, c.email, c.activo,
           u.email AS user_email,
           COUNT(co.id)                                              AS total_obligaciones,
           SUM(CASE WHEN co.estado = 'cumplida'  THEN 1 ELSE 0 END) AS cumplidas,
           SUM(CASE WHEN co.estado = 'vencida'   THEN 1 ELSE 0 END) AS vencidas,
           SUM(CASE WHEN co.estado = 'pendiente' THEN 1 ELSE 0 END) AS pendientes
    FROM clientes c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN cliente_obligaciones co ON co.cliente_id = c.id
    GROUP BY c.id ORDER BY c.razon_social
  `)
}

export async function obtenerCliente(clienteId: string) {
  const cliente = await queryOne(`
    SELECT c.*, u.email AS user_email, u.nombre AS user_nombre
    FROM clientes c JOIN users u ON u.id = c.user_id WHERE c.id = ?
  `, [clienteId]) as any
  if (!cliente) return null

  cliente.servicios = (await queryAll('SELECT servicio FROM cliente_servicios WHERE cliente_id = ? AND activo = 1', [clienteId])).map((r: any) => r.servicio)
  cliente.obligaciones = await queryAll(`
    SELECT co.id, co.estado, co.fecha_limite, co.updated_at,
           oc.aspecto, oc.grupo, oc.obligacion, oc.sub_titulo, oc.periodicidad, oc.servicio, oc.sub_id
    FROM cliente_obligaciones co
    JOIN obligaciones_catalogo oc ON oc.sub_id = co.catalogo_id
    WHERE co.cliente_id = ? ORDER BY oc.aspecto, oc.grupo, oc.obligacion
  `, [clienteId])
  return cliente
}

export async function actualizarEstado(oblId: string, estado: string, userId: string, userEmail: string) {
  const anterior = await queryOne('SELECT estado FROM cliente_obligaciones WHERE id = ?', [oblId]) as any
  await execute(`UPDATE cliente_obligaciones SET estado = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?`, [estado, userId, oblId])
  await execute(`INSERT INTO audit_log (id, user_id, user_email, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, 'estado_cambiado', 'obligacion', ?, ?)`,
    [crypto.randomUUID(), userId, userEmail, oblId, JSON.stringify({ antes: anterior?.estado, despues: estado })])
}
