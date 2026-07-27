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

  // Migración aditiva: separa la etapa de madurez del proyecto (definición del
  // problema / definición de alternativas / propuesta regulatoria / publicado)
  // de si está abierto para comentarios, y agrega el resumen de la etapa actual.
  const cols = [
    `ALTER TABLE proyectos_regulatorios ADD COLUMN etapa TEXT NOT NULL DEFAULT 'definicion_problema'`,
    `ALTER TABLE proyectos_regulatorios ADD COLUMN abierto_comentarios INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE proyectos_regulatorios ADD COLUMN resumen_etapa TEXT`,
    `ALTER TABLE proyectos_regulatorios ADD COLUMN fecha TEXT`,
  ]
  for (const sql of cols) {
    try { await execute(sql) } catch { /* columna ya existe */ }
  }
}

export const ETAPAS = ['definicion_problema', 'definicion_alternativas', 'propuesta_regulatoria', 'publicado'] as const
export type Etapa = typeof ETAPAS[number]

export interface ProyectoData {
  entidad:            string
  titulo:             string
  descripcion:         string
  etapa:              string
  resumenEtapa?:       string | null
  abiertoComentarios:  boolean
  fechaLimite?:        string | null
  fecha?:              string | null
  enlace?:             string | null
}

export async function listarProyectos() {
  await migrateProyectosRegulatorios()
  return queryAll(`
    SELECT p.*, (SELECT COUNT(*) FROM proyecto_participaciones pp WHERE pp.proyecto_id = p.id AND pp.interesado = 1) AS total_interesados
    FROM proyectos_regulatorios p
    ORDER BY COALESCE(p.fecha, p.created_at) DESC
  `)
}

export async function obtenerProyecto(id: string) {
  await migrateProyectosRegulatorios()
  return queryOne(`SELECT * FROM proyectos_regulatorios WHERE id = ?`, [id])
}

/** La fecha límite de comentarios solo tiene sentido si el proyecto está abierto para comentarios. */
function fechaLimiteEfectiva(d: ProyectoData): string | null {
  return d.abiertoComentarios ? (d.fechaLimite ?? null) : null
}

export async function crearProyecto(d: ProyectoData) {
  await migrateProyectosRegulatorios()
  const id    = crypto.randomUUID()
  const ahora = new Date().toISOString()
  await execute(
    `INSERT INTO proyectos_regulatorios
       (id, entidad, titulo, descripcion, etapa, resumen_etapa, abierto_comentarios, fecha_limite, fecha, enlace, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, d.entidad, d.titulo, d.descripcion, d.etapa, d.resumenEtapa ?? null,
     d.abiertoComentarios ? 1 : 0, fechaLimiteEfectiva(d), d.fecha ?? ahora.slice(0, 10), d.enlace ?? null, ahora, ahora]
  )
  return id
}

export async function actualizarProyecto(id: string, d: ProyectoData) {
  await migrateProyectosRegulatorios()
  await execute(
    `UPDATE proyectos_regulatorios
     SET entidad = ?, titulo = ?, descripcion = ?, etapa = ?, resumen_etapa = ?,
         abierto_comentarios = ?, fecha_limite = ?, fecha = ?, enlace = ?, updated_at = ?
     WHERE id = ?`,
    [d.entidad, d.titulo, d.descripcion, d.etapa, d.resumenEtapa ?? null,
     d.abiertoComentarios ? 1 : 0, fechaLimiteEfectiva(d), d.fecha ?? new Date().toISOString().slice(0, 10), d.enlace ?? null, new Date().toISOString(), id]
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

/** Listado consolidado de todas las manifestaciones de interés, por proyecto (vista admin). */
export async function todosLosInteresados() {
  await migrateProyectosRegulatorios()
  const proyectos = await queryAll(`
    SELECT p.*, (SELECT COUNT(*) FROM proyecto_participaciones pp WHERE pp.proyecto_id = p.id AND pp.interesado = 1) AS total_interesados
    FROM proyectos_regulatorios p
    ORDER BY COALESCE(p.fecha, p.created_at) DESC
  `)
  const participaciones = await queryAll(`
    SELECT pp.*, c.razon_social, c.plan
    FROM proyecto_participaciones pp
    JOIN clientes c ON c.id = pp.cliente_id
    WHERE pp.interesado = 1
    ORDER BY pp.updated_at DESC
  `)
  return { proyectos, participaciones }
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
