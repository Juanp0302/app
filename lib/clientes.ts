/**
 * lib/clientes.ts
 * Funciones para crear y gestionar clientes.
 * Cada función es independiente y fácil de modificar.
 */

import { db } from './db'
import crypto from 'crypto'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ClienteInput {
  razon_social: string
  nit?:         string
  contacto?:    string
  email?:       string
  telefono?:    string
  servicios:    string[]   // slugs: ['isp_(sva)', 'iptv_(sva)']
  // Credenciales de acceso del cliente
  user_email:   string
  user_nombre:  string
  user_password: string
}

// ─── Crear cliente ────────────────────────────────────────────────────────────

export function crearCliente(input: ClienteInput) {
  const userId    = crypto.randomUUID()
  const clienteId = crypto.randomUUID()

  function hashPassword(pwd: string) {
    return crypto.createHash('sha256').update(pwd + 'owl_salt_2026').digest('hex')
  }

  // Transacción: todo o nada
  const crearTodo = db.transaction(() => {
    // 1. Crear usuario
    db.prepare(`
      INSERT INTO users (id, email, password, nombre, rol)
      VALUES (?, ?, ?, ?, 'cliente')
    `).run(userId, input.user_email, hashPassword(input.user_password), input.user_nombre)

    // 2. Crear empresa cliente
    db.prepare(`
      INSERT INTO clientes (id, user_id, razon_social, nit, contacto, email, telefono)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(clienteId, userId, input.razon_social, input.nit ?? null,
           input.contacto ?? null, input.email ?? null, input.telefono ?? null)

    // 3. Asignar servicios y generar obligaciones
    for (const slug of input.servicios) {
      asignarServicio(clienteId, slug)
    }

    return { userId, clienteId }
  })

  return crearTodo()
}

// ─── Asignar servicio (y sus obligaciones) a un cliente ──────────────────────

export function asignarServicio(clienteId: string, servicioSlug: string) {
  const servicioId = crypto.randomUUID()

  // Registrar el servicio
  db.prepare(`
    INSERT OR IGNORE INTO cliente_servicios (id, cliente_id, servicio)
    VALUES (?, ?, ?)
  `).run(servicioId, clienteId, servicioSlug)

  // Buscar todas las subobligaciones del catálogo para ese servicio
  const subobligaciones = db.prepare(`
    SELECT sub_id FROM obligaciones_catalogo
    WHERE servicio_slug = ?
  `).all(servicioSlug) as { sub_id: number }[]

  // Crear una entrada de estado por cada subobligación (si no existe ya)
  const insertObl = db.prepare(`
    INSERT OR IGNORE INTO cliente_obligaciones (id, cliente_id, catalogo_id, estado)
    VALUES (?, ?, ?, 'pendiente')
  `)

  for (const { sub_id } of subobligaciones) {
    insertObl.run(crypto.randomUUID(), clienteId, sub_id)
  }

  return subobligaciones.length
}

// ─── Obtener clientes (para panel admin) ─────────────────────────────────────

export function listarClientes() {
  return db.prepare(`
    SELECT
      c.id,
      c.razon_social,
      c.nit,
      c.contacto,
      c.email,
      c.activo,
      u.email AS user_email,
      COUNT(co.id)                                          AS total_obligaciones,
      SUM(CASE WHEN co.estado = 'cumplida'  THEN 1 ELSE 0 END) AS cumplidas,
      SUM(CASE WHEN co.estado = 'vencida'   THEN 1 ELSE 0 END) AS vencidas,
      SUM(CASE WHEN co.estado = 'pendiente' THEN 1 ELSE 0 END) AS pendientes
    FROM clientes c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN cliente_obligaciones co ON co.cliente_id = c.id
    GROUP BY c.id
    ORDER BY c.razon_social
  `).all()
}

// ─── Obtener detalle de un cliente ───────────────────────────────────────────

export function obtenerCliente(clienteId: string) {
  const cliente = db.prepare(`
    SELECT c.*, u.email AS user_email, u.nombre AS user_nombre
    FROM clientes c
    JOIN users u ON u.id = c.user_id
    WHERE c.id = ?
  `).get(clienteId) as any

  if (!cliente) return null

  // Servicios asignados
  cliente.servicios = db.prepare(`
    SELECT servicio FROM cliente_servicios WHERE cliente_id = ? AND activo = 1
  `).all(clienteId).map((r: any) => r.servicio)

  // Obligaciones agrupadas por aspecto
  cliente.obligaciones = db.prepare(`
    SELECT
      co.id,
      co.estado,
      co.fecha_limite,
      co.updated_at,
      oc.aspecto,
      oc.grupo,
      oc.obligacion,
      oc.sub_titulo,
      oc.periodicidad,
      oc.servicio,
      oc.sub_id
    FROM cliente_obligaciones co
    JOIN obligaciones_catalogo oc ON oc.sub_id = co.catalogo_id
    WHERE co.cliente_id = ?
    ORDER BY oc.aspecto, oc.grupo, oc.obligacion
  `).all(clienteId)

  return cliente
}

// ─── Actualizar estado de una obligación ─────────────────────────────────────

export function actualizarEstado(
  oblId:      string,
  estado:     string,
  userId:     string,
  userEmail:  string,
) {
  // Obtener estado anterior para el log
  const anterior = db.prepare(
    'SELECT estado FROM cliente_obligaciones WHERE id = ?'
  ).get(oblId) as any

  db.prepare(`
    UPDATE cliente_obligaciones
    SET estado = ?, updated_by = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(estado, userId, oblId)

  // Registrar en bitácora
  db.prepare(`
    INSERT INTO audit_log (id, user_id, user_email, accion, entidad, entidad_id, detalle)
    VALUES (?, ?, ?, 'estado_cambiado', 'obligacion', ?, ?)
  `).run(
    crypto.randomUUID(),
    userId,
    userEmail,
    oblId,
    JSON.stringify({ antes: anterior?.estado, despues: estado })
  )
}
