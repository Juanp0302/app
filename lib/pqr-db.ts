/**
 * lib/pqr-db.ts
 * Repositorio de PQR: tipologías, normativa, plantillas de respuesta
 * y guía de aplicación. Contenido compartido (global) para todos los clientes.
 */

import { execute, queryAll, queryOne } from './db'
import { PQR_SEED } from './pqr-seed'
import crypto from 'crypto'

let _migrated = false

export async function migratePqr() {
  if (_migrated) return
  _migrated = true

  await execute(`
    CREATE TABLE IF NOT EXISTS pqr_tipologias (
      id           TEXT PRIMARY KEY,
      servicio     TEXT NOT NULL,
      codigo       TEXT NOT NULL UNIQUE,
      nombre       TEXT NOT NULL,
      incidencia   TEXT,
      severidad    TEXT,
      norma        TEXT,
      normativa    TEXT NOT NULL,
      plantilla_si TEXT NOT NULL,
      plantilla_no TEXT NOT NULL,
      guia         TEXT NOT NULL,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    )
  `)

  // Inserta cualquier tipología de PQR_SEED que aún no exista en la tabla
  // (por código). Esto permite agregar nuevas tipologías al seed y que
  // lleguen a bases de datos ya migradas, sin duplicar las existentes.
  const ahora = new Date().toISOString()
  for (const t of PQR_SEED) {
    const existente = await queryOne(`SELECT id FROM pqr_tipologias WHERE codigo = ?`, [t.codigo])
    if (existente) continue
    await execute(
      `INSERT INTO pqr_tipologias
         (id, servicio, codigo, nombre, incidencia, severidad, norma, normativa, plantilla_si, plantilla_no, guia, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [crypto.randomUUID(), t.servicio, t.codigo, t.nombre, t.incidencia, t.severidad, t.norma,
       t.normativa, t.plantillaSi, t.plantillaNo, t.guia, ahora, ahora]
    )
  }
}

export interface PqrData {
  servicio:    string
  codigo:      string
  nombre:      string
  incidencia?: string
  severidad?:  string
  norma?:      string
  normativa:   string
  plantillaSi: string
  plantillaNo: string
  guia:        string
}

export async function listarPqr() {
  await migratePqr()
  return queryAll(`SELECT * FROM pqr_tipologias ORDER BY servicio, codigo`)
}

export async function obtenerPqr(id: string) {
  await migratePqr()
  return queryOne(`SELECT * FROM pqr_tipologias WHERE id = ?`, [id])
}

export async function crearPqr(d: PqrData) {
  await migratePqr()
  const id    = crypto.randomUUID()
  const ahora = new Date().toISOString()
  await execute(
    `INSERT INTO pqr_tipologias
       (id, servicio, codigo, nombre, incidencia, severidad, norma, normativa, plantilla_si, plantilla_no, guia, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, d.servicio, d.codigo, d.nombre, d.incidencia ?? null, d.severidad ?? null, d.norma ?? null,
     d.normativa, d.plantillaSi, d.plantillaNo, d.guia, ahora, ahora]
  )
  return id
}

export async function actualizarPqr(id: string, d: PqrData) {
  await migratePqr()
  await execute(
    `UPDATE pqr_tipologias
     SET servicio = ?, codigo = ?, nombre = ?, incidencia = ?, severidad = ?, norma = ?,
         normativa = ?, plantilla_si = ?, plantilla_no = ?, guia = ?, updated_at = ?
     WHERE id = ?`,
    [d.servicio, d.codigo, d.nombre, d.incidencia ?? null, d.severidad ?? null, d.norma ?? null,
     d.normativa, d.plantillaSi, d.plantillaNo, d.guia, new Date().toISOString(), id]
  )
}

export async function eliminarPqr(id: string) {
  await migratePqr()
  await execute(`DELETE FROM pqr_tipologias WHERE id = ?`, [id])
}
