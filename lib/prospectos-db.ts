/**
 * lib/prospectos-db.ts
 * Tabla de prospectos ISP para la estrategia de contacto uno a uno (200
 * empresas priorizadas, ver docs/prospectos-isp.md). Cada fila corresponde a
 * una empresa del archivo "Prospectos_ISP_Abordaje_v2.xlsx", con los mismos
 * campos que las hojas "Abordaje v2 (2)" (seguimiento), "Abordaje Copiav2"
 * (mensajes de contacto personalizados) y "Original" (guion de llamada
 * completo + detalle de investigaciones).
 */
import { queryOne, queryAll, execute } from './db'
import crypto from 'crypto'

let _migrated = false
export async function migrateProspectos() {
  if (_migrated) return
  _migrated = true

  await execute(`
    CREATE TABLE IF NOT EXISTS prospectos_isp (
      id                    TEXT PRIMARY KEY,
      puesto                INTEGER,
      prioridad             TEXT NOT NULL,   -- 'A','B','C1','C2' (ver PRIORIDAD_LABEL en lib/prospectos.ts)
      empresa               TEXT NOT NULL,
      nit                   TEXT,
      representante         TEXT,
      telefono              TEXT,
      correo                TEXT,
      municipio             TEXT,
      departamento          TEXT,
      ingresos_semestre     INTEGER,
      expediente_bdi        TEXT,
      tema_detectado        TEXT,
      revisar_a_mano        INTEGER NOT NULL DEFAULT 0,
      canal_sugerido        TEXT,
      whatsapp_1            TEXT,            -- apertura (día 0)
      whatsapp_2            TEXT,            -- valor (día 6)
      whatsapp_3            TEXT,            -- cierre (día 12)
      llamada_apertura      TEXT,            -- primeras frases de la llamada (día 1-2)
      guion_llamada         TEXT,            -- guion completo paso a paso (hoja "Original")
      investigacion_1       TEXT,
      investigacion_2       TEXT,
      investigacion_3       TEXT,
      estado                TEXT NOT NULL DEFAULT 'Pendiente',
      fecha_contacto        TEXT,
      proximo_paso          TEXT,
      notas                 TEXT,
      responsable_id        TEXT REFERENCES users(id),
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  await execute(`CREATE INDEX IF NOT EXISTS idx_prospectos_responsable ON prospectos_isp(responsable_id)`)
  await execute(`CREATE INDEX IF NOT EXISTS idx_prospectos_estado ON prospectos_isp(estado)`)

  await execute(`
    CREATE TABLE IF NOT EXISTS prospectos_isp_historial (
      id             TEXT PRIMARY KEY,
      prospecto_id   TEXT NOT NULL REFERENCES prospectos_isp(id),
      estado_anterior TEXT,
      estado_nuevo   TEXT NOT NULL,
      user_id        TEXT REFERENCES users(id),
      nota           TEXT,        -- opcional: qué cambió además del estado (ej. reasignación)
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  await execute(`CREATE INDEX IF NOT EXISTS idx_prospectos_historial_prospecto ON prospectos_isp_historial(prospecto_id)`)
}

export interface ProspectoRow {
  id: string
  puesto: number | null
  prioridad: string
  empresa: string
  nit: string | null
  representante: string | null
  telefono: string | null
  correo: string | null
  municipio: string | null
  departamento: string | null
  ingresos_semestre: number | null
  expediente_bdi: string | null
  tema_detectado: string | null
  revisar_a_mano: number
  canal_sugerido: string | null
  whatsapp_1: string | null
  whatsapp_2: string | null
  whatsapp_3: string | null
  llamada_apertura: string | null
  guion_llamada: string | null
  investigacion_1: string | null
  investigacion_2: string | null
  investigacion_3: string | null
  estado: string
  fecha_contacto: string | null
  proximo_paso: string | null
  notas: string | null
  responsable_id: string | null
  created_at: string
  updated_at: string
  // Se agregan con JOIN, no son columnas propias:
  responsable_nombre?: string | null
  responsable_email?: string | null
}

export async function insertProspecto(row: Omit<ProspectoRow, 'id' | 'created_at' | 'updated_at' | 'responsable_nombre' | 'responsable_email'>): Promise<string> {
  await migrateProspectos()
  const id = crypto.randomUUID()
  await execute(
    `INSERT INTO prospectos_isp
       (id, puesto, prioridad, empresa, nit, representante, telefono, correo, municipio, departamento,
        ingresos_semestre, expediente_bdi, tema_detectado, revisar_a_mano, canal_sugerido,
        whatsapp_1, whatsapp_2, whatsapp_3, llamada_apertura, guion_llamada,
        investigacion_1, investigacion_2, investigacion_3,
        estado, fecha_contacto, proximo_paso, notas, responsable_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, row.puesto, row.prioridad, row.empresa, row.nit, row.representante, row.telefono, row.correo,
      row.municipio, row.departamento, row.ingresos_semestre, row.expediente_bdi, row.tema_detectado,
      row.revisar_a_mano ? 1 : 0, row.canal_sugerido,
      row.whatsapp_1, row.whatsapp_2, row.whatsapp_3, row.llamada_apertura, row.guion_llamada,
      row.investigacion_1, row.investigacion_2, row.investigacion_3,
      row.estado, row.fecha_contacto, row.proximo_paso, row.notas, row.responsable_id,
    ]
  )
  return id
}

export async function listarProspectos(responsableId: string | null): Promise<ProspectoRow[]> {
  await migrateProspectos()
  const sql = `
    SELECT p.*, u.nombre AS responsable_nombre, u.email AS responsable_email
    FROM prospectos_isp p
    LEFT JOIN users u ON u.id = p.responsable_id
    ${responsableId ? 'WHERE p.responsable_id = ?' : ''}
    ORDER BY p.puesto ASC`
  return queryAll<ProspectoRow>(sql, responsableId ? [responsableId] : [])
}

export async function buscarProspecto(id: string): Promise<ProspectoRow | undefined> {
  await migrateProspectos()
  return queryOne<ProspectoRow>(
    `SELECT p.*, u.nombre AS responsable_nombre, u.email AS responsable_email
     FROM prospectos_isp p LEFT JOIN users u ON u.id = p.responsable_id
     WHERE p.id = ?`,
    [id]
  )
}

export async function actualizarProspecto(id: string, campos: {
  estado?: string
  fecha_contacto?: string | null
  proximo_paso?: string | null
  notas?: string | null
  responsable_id?: string | null
}): Promise<void> {
  await migrateProspectos()
  const sets: string[] = [`updated_at = datetime('now')`]
  const vals: any[] = []
  if (campos.estado !== undefined)         { sets.push('estado = ?');         vals.push(campos.estado) }
  if (campos.fecha_contacto !== undefined) { sets.push('fecha_contacto = ?'); vals.push(campos.fecha_contacto) }
  if (campos.proximo_paso !== undefined)   { sets.push('proximo_paso = ?');   vals.push(campos.proximo_paso) }
  if (campos.notas !== undefined)          { sets.push('notas = ?');          vals.push(campos.notas) }
  if (campos.responsable_id !== undefined) { sets.push('responsable_id = ?'); vals.push(campos.responsable_id) }
  await execute(`UPDATE prospectos_isp SET ${sets.join(', ')} WHERE id = ?`, [...vals, id])
}

export async function registrarHistorial(entry: {
  prospecto_id: string
  estado_anterior: string | null
  estado_nuevo: string
  user_id: string | null
  nota?: string | null
}): Promise<void> {
  await migrateProspectos()
  await execute(
    `INSERT INTO prospectos_isp_historial (id, prospecto_id, estado_anterior, estado_nuevo, user_id, nota)
     VALUES (?,?,?,?,?,?)`,
    [crypto.randomUUID(), entry.prospecto_id, entry.estado_anterior, entry.estado_nuevo, entry.user_id, entry.nota ?? null]
  )
}

export async function listarHistorial(prospectoId: string) {
  await migrateProspectos()
  return queryAll(
    `SELECT h.*, u.nombre AS user_nombre
     FROM prospectos_isp_historial h LEFT JOIN users u ON u.id = h.user_id
     WHERE h.prospecto_id = ? ORDER BY h.created_at DESC`,
    [prospectoId]
  )
}

export async function contarPorEstado(responsableId: string | null): Promise<Record<string, number>> {
  await migrateProspectos()
  const rows = await queryAll<{ estado: string; n: number }>(
    `SELECT estado, COUNT(*) AS n FROM prospectos_isp ${responsableId ? 'WHERE responsable_id = ?' : ''} GROUP BY estado`,
    responsableId ? [responsableId] : []
  )
  const out: Record<string, number> = {}
  for (const r of rows) out[r.estado] = r.n
  return out
}
