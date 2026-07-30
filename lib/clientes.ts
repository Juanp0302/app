/**
 * lib/clientes.ts
 * Funciones para crear y gestionar clientes.
 */

import { db, queryOne, queryAll, execute } from './db'
import crypto from 'crypto'
import { hashPassword } from './password'
import { limitesPeriodoActual } from './fechas'

/** Periodicidades que se repiten y por tanto deben reiniciarse cada periodo nuevo. */
const PERIODICIDADES_RECURRENTES = ['TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'MENSUAL', 'PERIÓDICO']

/**
 * Revisa las obligaciones periódicas de UN cliente marcadas 'cumplida' o 'vencida'
 * cuya última actualización quedó antes del inicio del periodo actual (ej. una
 * TRIMESTRAL resuelta en Q1 y ya estamos en Q2) y las regresa a 'pendiente' para
 * que el mapa de cumplimiento vuelva a pedirlas en el nuevo periodo.
 * No toca 'no_aplica' (esa es una decisión permanente, no ligada a un periodo).
 * Se llama de forma perezosa cada vez que se carga el mapa de cumplimiento de ese cliente.
 */
export async function reiniciarObligacionesPeriodicas(clienteId: string): Promise<number> {
  const hoy = new Date()

  const candidatas = await queryAll(`
    SELECT co.id AS obl_id, co.estado, co.updated_at, oc.periodicidad
    FROM cliente_obligaciones co
    JOIN obligaciones_catalogo oc ON oc.sub_id = co.catalogo_id
    WHERE co.cliente_id = ?
      AND co.estado IN ('cumplida','vencida')
      AND oc.periodicidad IN (${PERIODICIDADES_RECURRENTES.map(() => '?').join(',')})
  `, [clienteId, ...PERIODICIDADES_RECURRENTES])

  let reiniciadas = 0
  for (const c of candidatas as any[]) {
    const limites = limitesPeriodoActual(c.periodicidad, hoy)
    if (!limites) continue

    const actualizadoStr = String(c.updated_at).slice(0, 10)
    if (actualizadoStr >= limites.inicio) continue // ya se actualizó dentro del periodo actual

    await execute(
      `UPDATE cliente_obligaciones SET estado = 'pendiente', updated_at = datetime('now') WHERE id = ?`,
      [c.obl_id]
    )
    await execute(
      `INSERT INTO audit_log (id, user_id, user_email, accion, entidad, entidad_id, detalle)
       VALUES (?, 'system', 'sistema@owlcompliance.co', 'periodo_reiniciado', 'obligacion', ?, ?)`,
      [crypto.randomUUID(), c.obl_id, JSON.stringify({ estadoAnterior: c.estado, periodicidad: c.periodicidad, inicioPeriodo: limites.inicio })]
    )
    reiniciadas++
  }
  return reiniciadas
}

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

export interface CuentaAutomaticaInput {
  razon_social: string
  nit?:          string
  contacto?:     string
  email?:        string
  telefono?:     string
  user_email:    string
  user_nombre:   string
  plan:          string      // basico | pro | premium | trial
  suscripcion_vencimiento?: string | null
  suscripcion_externa_id?:  string | null   // subscription_id de Trazo, si aplica
}

/**
 * Crea la cuenta completa de un cliente con el flujo de onboarding automático:
 * contraseña temporal (parte del correo antes de la @), cambio obligatorio en
 * el primer login, sin servicios (los elige el cliente al entrar) y correo de
 * bienvenida con las credenciales. Usada por POST /api/clientes (creación
 * manual del admin) y por el webhook de Trazo (activación de suscripción).
 *
 * Lanza Error si el email ya está registrado.
 */
export async function crearCuentaClienteAutomatica(input: CuentaAutomaticaInput) {
  const existe = await queryOne('SELECT id FROM users WHERE email = ?', [input.user_email])
  if (existe) throw new Error('El email ya está registrado')

  const { migrateMustChangePassword } = await import('./password')
  await migrateMustChangePassword()

  const passwordTemporal = String(input.user_email).split('@')[0]
  const userId    = crypto.randomUUID()
  const clienteId = crypto.randomUUID()

  await db.batch([
    { sql: `INSERT INTO users (id, email, password, nombre, rol, must_change_password) VALUES (?,?,?,?,'cliente',1)`,
      args: [userId, input.user_email, await hashPassword(passwordTemporal), input.user_nombre] },
    { sql: `INSERT INTO clientes (id, user_id, razon_social, nit, contacto, email, telefono, plan, suscripcion_estado, suscripcion_inicio, suscripcion_vencimiento, suscripcion_externa_id)
            VALUES (?,?,?,?,?,?,?,?,'activa',datetime('now'),?,?)`,
      args: [clienteId, userId, input.razon_social, input.nit ?? null, input.contacto ?? null,
             input.email ?? null, input.telefono ?? null, input.plan,
             input.suscripcion_vencimiento ?? null, input.suscripcion_externa_id ?? null] },
  ], 'write')

  const { notificarBienvenida } = await import('./notificaciones')
  notificarBienvenida({
    clienteEmail:  input.user_email,
    clienteNombre: input.user_nombre,
    password:      passwordTemporal,
    plan:          input.plan,
    fecha:         new Date().toISOString(),
  }).catch(e => console.error('[crearCuentaClienteAutomatica] Error enviando bienvenida:', e))

  return { userId, clienteId, passwordTemporal }
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
