/**
 * lib/proyectos-regulatorios-db.ts
 * Proyectos regulatorios en trámite ante entidades sectoriales (CRC, MinTIC, SIC)
 * y participación de clientes: interés y comentarios/preocupaciones.
 */

import { execute, queryAll, queryOne } from './db'
import crypto from 'crypto'

let _migrated = false

export async function migrateProyectosRegulatorios() {
  if (_migrated) return
  _migrated = true

  await execute(`
    CREATE TABLE IF NOT EXISTS proyectos_regulatorios (
      id             TEXT PRIMARY KEY,
      entidad        TEXT NOT NULL,
      titulo         TEXT NOT NULL,
      descripcion    TEXT NOT NULL,
      estado         TEXT NOT NULL DEFAULT 'en_tramite',
      fecha_limite   TEXT,
      enlace         TEXT,
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS proyecto_participaciones (
      id           TEXT PRIMARY KEY,
      proyecto_id  TEXT NOT NULL REFERENCES proyectos_regulatorios(id),
      cliente_id   TEXT NOT NULL REFERENCES clientes(id),
      interesado   INTEGER NOT NULL DEFAULT 0,
      comentario   TEXT,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL,
      UNIQUE(proyecto_id, cliente_id)
    )
  `)
}

export interface ProyectoData {
  entidad:      string
  titulo:       string
  descripcion:  string
  estado:       string
  fechaLimite?: string | null
  enlace?:      string | null
}

export async function listarProyectos() {
  await migrateProyectosRegulatorios()
  return queryAll(`
    SELECT p.*, (SELECT COUNT(*) FROM proyecto_participaciones pp WHERE pp.proyecto_id = p.id AND pp.interesado = 1) AS total_interesados
    FROM proyectos_regulatorios p
    ORDER BY (p.fecha_limite IS NULL), p.fecha_limite ASC, p.created_at DESC
  `)
}

export async function obtenerProyecto(id: string) {
  await migrateProyectosRegulatorios()
  return queryOne(`SELECT * FROM proyectos_regulatorios WHERE id = ?`, [id])
}

export async function crearProyecto(d: ProyectoData) {
  await migrateProyectosRegulatorios()
  const id    = crypto.randomUUID()
  const ahora = new Date().toISOString()
  await execute(
    `INSERT INTO proyectos_regulatorios (id, entidad, titulo, descripcion, estado, fecha_limite, enlace, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, d.entidad, d.titulo, d.descripcion, d.estado, d.fechaLimite ?? null, d.enlace ?? null, ahora, ahora]
  )
  return id
}

export async function actualizarProyecto(id: string, d: ProyectoData) {
  await migrateProyectosRegulatorios()
  await execute(
    `UPDATE proyectos_regulatorios
     SET entidad = ?, titulo = ?, descripcion = ?, estado = ?, fecha_limite = ?, enlace = ?, updated_at = ?
     WHERE id = ?`,
    [d.entidad, d.titulo, d.descripcion, d.estado, d.fechaLimite ?? null, d.enlace ?? null, new Date().toISOString(), id]
  )
}

export async function eliminarProyecto(id: string) {
  await migrateProyectosRegulatorios()
  await execute(`DELETE FROM proyecto_participaciones WHERE proyecto_id = ?`, [id])
  await execute(`DELETE FROM proyectos_regulatorios WHERE id = ?`, [id])
}

/** Participaciones de un cliente en todos los proyectos (para su historial). */
export async function participacionesDeCliente(clienteId: string) {
  await migrateProyectosRegulatorios()
  return queryAll(
    `SELECT * FROM proyecto_participaciones WHERE cliente_id = ?`,
    [clienteId]
  )
}

/** Participaciones de un proyecto (para la vista admin). */
export async function participacionesDeProyecto(proyectoId: string) {
  await migrateProyectosRegulatorios()
  return queryAll(
    `SELECT pp.*, c.razon_social
     FROM proyecto_participaciones pp
     JOIN clientes c ON c.id = pp.cliente_id
     WHERE pp.proyecto_id = ?
     ORDER BY pp.updated_at DESC`,
    [proyectoId]
  )
}

/** Upsert de interés/comentario de un cliente en un proyecto. */
export async function participar(opts: {
  proyectoId: string
  clienteId:  string
  interesado: boolean
  comentario?: string | null
}) {
  await migrateProyectosRegulatorios()
  const existente = await queryOne(
    `SELECT id FROM proyecto_participaciones WHERE proyecto_id = ? AND cliente_id = ?`,
    [opts.proyectoId, opts.clienteId]
  ) as any

  const ahora = new Date().toISOString()
  if (existente) {
    await execute(
      `UPDATE proyecto_participaciones SET interesado = ?, comentario = ?, updated_at = ? WHERE id = ?`,
      [opts.interesado ? 1 : 0, opts.comentario ?? null, ahora, existente.id]
    )
    return existente.id
  }

  const id = crypto.randomUUID()
  await execute(
    `INSERT INTO proyecto_participaciones (id, proyecto_id, cliente_id, interesado, comentario, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?)`,
    [id, opts.proyectoId, opts.clienteId, opts.interesado ? 1 : 0, opts.comentario ?? null, ahora, ahora]
  )
  return id
}
