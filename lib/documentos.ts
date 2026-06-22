/**
 * lib/documentos.ts
 * Lógica de almacenamiento de documentos de acreditación.
 */

import crypto from 'crypto'
import { queryOne, queryAll, execute } from './db'
import { getProvider, isCloudRef, localAbsPath } from './storage'

export function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60)
}

export function logicalPath(aspecto: string, obligacion: string, anio: number, trimestre: number | null): string {
  return [slugify(aspecto), slugify(obligacion), String(anio), trimestre ? `Q${trimestre}` : 'permanente'].join('/')
}

export interface GuardarParams {
  clienteId: string; clienteOblId: string | null; aspecto: string; obligacion: string
  anio: number; trimestre: number | null; nombreArchivo: string; buffer: Buffer
  mimeType: string; userId: string; userEmail: string
}

/** Agrega columnas de revisión si aún no existen (migración segura). */
async function ensureRevisionColumns(): Promise<void> {
  const cols = ['estado_revision', 'revision_comentario', 'revisado_por', 'revisado_at']
  for (const col of cols) {
    try {
      let defaultVal = ''
      if (col === 'estado_revision') defaultVal = `DEFAULT 'pendiente'`
      await execute(`ALTER TABLE documentos ADD COLUMN ${col} TEXT ${defaultVal}`)
    } catch {
      // La columna ya existe — ignorar
    }
  }
}

let _migrationDone = false
async function migrateOnce(): Promise<void> {
  if (_migrationDone) return
  await ensureRevisionColumns()
  _migrationDone = true
}

export async function guardarDocumento(p: GuardarParams): Promise<string> {
  await migrateOnce()
  const provider    = getProvider(p.clienteId)
  const lPath       = logicalPath(p.aspecto, p.obligacion, p.anio, p.trimestre)
  const storageFile = await provider.upload(lPath, p.nombreArchivo, p.buffer, p.mimeType)
  const docId       = crypto.randomUUID()

  await execute(
    `INSERT INTO documentos (id, cliente_id, cliente_obl_id, nombre_archivo, ruta, anio, trimestre, uploaded_by, estado_revision)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
    [docId, p.clienteId, p.clienteOblId ?? null, p.nombreArchivo, storageFile.ref, p.anio, p.trimestre ?? null, p.userId]
  )
  await execute(
    `INSERT INTO audit_log (id, user_id, user_email, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, 'documento_subido', 'documento', ?, ?)`,
    [crypto.randomUUID(), p.userId, p.userEmail, docId, JSON.stringify({ archivo: p.nombreArchivo, ref: storageFile.ref, anio: p.anio, trimestre: p.trimestre })]
  )
  return docId
}

export async function eliminarDocumento(docId: string, userId: string, userEmail: string): Promise<void> {
  const doc = await queryOne('SELECT * FROM documentos WHERE id = ?', [docId])
  if (!doc) throw new Error('Documento no encontrado')
  try {
    const provider = getProvider((doc as any).cliente_id)
    await provider.delete((doc as any).ruta)
  } catch (e) { console.error('Error eliminando archivo del proveedor:', e) }
  await execute('DELETE FROM documentos WHERE id = ?', [docId])
  await execute(
    `INSERT INTO audit_log (id, user_id, user_email, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, 'documento_eliminado', 'documento', ?, ?)`,
    [crypto.randomUUID(), userId, userEmail, docId, JSON.stringify({ archivo: (doc as any).nombre_archivo, ref: (doc as any).ruta })]
  )
}

export async function listarDocumentos(clienteId: string) {
  await migrateOnce()
  return queryAll(`
    SELECT d.*,
           u.nombre  AS subido_por_nombre,
           u.email   AS subido_por_email,
           rv.nombre AS revisado_por_nombre,
           oc.aspecto, oc.obligacion, oc.sub_titulo, oc.periodicidad, oc.servicio
    FROM documentos d
    JOIN users u ON u.id = d.uploaded_by
    LEFT JOIN users rv ON rv.id = d.revisado_por
    LEFT JOIN cliente_obligaciones co ON co.id = d.cliente_obl_id
    LEFT JOIN obligaciones_catalogo oc ON oc.sub_id = co.catalogo_id
    WHERE d.cliente_id = ?
    ORDER BY oc.servicio, oc.aspecto, oc.obligacion, d.anio DESC, d.trimestre DESC
  `, [clienteId])
}

/** Lista documentos pendientes de revisión (para la cola del admin). */
export async function listarPendientesRevision(clienteId?: string) {
  await migrateOnce()
  const where = clienteId
    ? `WHERE (d.estado_revision = 'pendiente' OR d.estado_revision IS NULL) AND d.cliente_id = ?`
    : `WHERE (d.estado_revision = 'pendiente' OR d.estado_revision IS NULL)`
  const args = clienteId ? [clienteId] : []
  return queryAll(`
    SELECT d.*,
           u.nombre        AS subido_por_nombre,
           u.email         AS subido_por_email,
           c.razon_social,
           oc.aspecto, oc.obligacion, oc.sub_titulo, oc.periodicidad, oc.servicio
    FROM documentos d
    JOIN users u ON u.id = d.uploaded_by
    JOIN clientes c ON c.id = d.cliente_id
    LEFT JOIN cliente_obligaciones co ON co.id = d.cliente_obl_id
    LEFT JOIN obligaciones_catalogo oc ON oc.sub_id = co.catalogo_id
    ${where}
    ORDER BY d.uploaded_at ASC
  `, args)
}

/** Aprueba o rechaza un documento. Si se aprueba y tiene obligación vinculada, la marca como cumplida. */
export async function revisarDocumento(
  docId: string,
  adminId: string,
  adminEmail: string,
  aprobado: boolean,
  comentario: string
): Promise<void> {
  await migrateOnce()
  const doc = await queryOne('SELECT * FROM documentos WHERE id = ?', [docId])
  if (!doc) throw new Error('Documento no encontrado')

  const estado = aprobado ? 'aprobado' : 'rechazado'
  await execute(
    `UPDATE documentos
     SET estado_revision = ?, revision_comentario = ?, revisado_por = ?, revisado_at = datetime('now')
     WHERE id = ?`,
    [estado, comentario || null, adminId, docId]
  )

  // Si se aprueba y hay obligación vinculada → marcarla como cumplida
  if (aprobado && (doc as any).cliente_obl_id) {
    await execute(
      `UPDATE cliente_obligaciones SET estado = 'cumplida', updated_by = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [adminId, (doc as any).cliente_obl_id]
    )
  }

  await execute(
    `INSERT INTO audit_log (id, user_id, user_email, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, ?, 'documento', ?, ?)`,
    [crypto.randomUUID(), adminId, adminEmail,
      aprobado ? 'documento_aprobado' : 'documento_rechazado',
      docId,
      JSON.stringify({ estado, comentario: comentario || null })]
  )
}

export type BorradoScope = 'todo' | 'servicio' | 'aspecto' | 'obligacion'

export async function eliminarDocumentosMasivo(
  clienteId: string,
  scope: BorradoScope,
  filtros: { servicio?: string; aspecto?: string; obligacion?: string },
  userId: string,
  userEmail: string
): Promise<number> {
  // Obtener IDs de los documentos que coinciden con el scope
  let docs: any[]
  if (scope === 'todo') {
    docs = await queryAll(
      'SELECT id FROM documentos WHERE cliente_id = ?',
      [clienteId]
    ) as any[]
  } else if (scope === 'servicio') {
    docs = await queryAll(`
      SELECT d.id FROM documentos d
      LEFT JOIN cliente_obligaciones co ON co.id = d.cliente_obl_id
      LEFT JOIN obligaciones_catalogo oc ON oc.sub_id = co.catalogo_id
      WHERE d.cliente_id = ? AND oc.servicio = ?
    `, [clienteId, filtros.servicio]) as any[]
  } else if (scope === 'aspecto') {
    docs = await queryAll(`
      SELECT d.id FROM documentos d
      LEFT JOIN cliente_obligaciones co ON co.id = d.cliente_obl_id
      LEFT JOIN obligaciones_catalogo oc ON oc.sub_id = co.catalogo_id
      WHERE d.cliente_id = ? AND oc.aspecto = ?
    `, [clienteId, filtros.aspecto]) as any[]
  } else {
    // scope === 'obligacion'
    docs = await queryAll(`
      SELECT d.id FROM documentos d
      LEFT JOIN cliente_obligaciones co ON co.id = d.cliente_obl_id
      LEFT JOIN obligaciones_catalogo oc ON oc.sub_id = co.catalogo_id
      WHERE d.cliente_id = ? AND oc.aspecto = ? AND oc.obligacion = ?
    `, [clienteId, filtros.aspecto, filtros.obligacion]) as any[]
  }

  for (const doc of docs) {
    await eliminarDocumento((doc as any).id, userId, userEmail)
  }
  return docs.length
}

export async function descargarDocumento(docId: string): Promise<{ buffer: Buffer; nombre: string } | null> {
  const doc = await queryOne('SELECT * FROM documentos WHERE id = ?', [docId])
  if (!doc) return null
  const provider = getProvider((doc as any).cliente_id)
  const buffer   = await provider.download((doc as any).ruta)
  return { buffer, nombre: (doc as any).nombre_archivo }
}

export async function getDownloadUrl(docId: string): Promise<string | null> {
  const doc = await queryOne('SELECT * FROM documentos WHERE id = ?', [docId])
  if (!doc) return null
  const provider = getProvider((doc as any).cliente_id)
  return provider.getDownloadUrl((doc as any).ruta)
}

export function rutaCompletaLocal(clienteId: string, ref: string): string | null {
  if (isCloudRef(ref)) return null
  return localAbsPath(clienteId, ref)
}

export async function documentosParaZip(clienteId: string, anio: number, trimestre: number | null) {
  // Si se pide un trimestre: incluir ese trimestre + permanentes (trimestre IS NULL)
  // Si se pide el año completo: incluir todos (todos los trimestres + permanentes)
  const cond   = trimestre != null ? 'AND (d.trimestre = ? OR d.trimestre IS NULL)' : ''
  const params = trimestre != null ? [clienteId, anio, trimestre] : [clienteId, anio]
  return queryAll(`
    SELECT d.id, d.nombre_archivo, d.ruta, d.anio, d.trimestre, d.cliente_id, d.cliente_obl_id,
           COALESCE(oc.aspecto, 'General') AS aspecto, COALESCE(oc.obligacion, 'General') AS obligacion
    FROM documentos d
    LEFT JOIN cliente_obligaciones co ON co.id = d.cliente_obl_id
    LEFT JOIN obligaciones_catalogo oc ON oc.sub_id = co.catalogo_id
    WHERE d.cliente_id = ? AND d.anio = ? ${cond}
    ORDER BY oc.aspecto, oc.obligacion, d.nombre_archivo
  `, params)
}
