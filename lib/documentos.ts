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

export async function guardarDocumento(p: GuardarParams): Promise<string> {
  const provider    = getProvider(p.clienteId)
  const lPath       = logicalPath(p.aspecto, p.obligacion, p.anio, p.trimestre)
  const storageFile = await provider.upload(lPath, p.nombreArchivo, p.buffer, p.mimeType)
  const docId       = crypto.randomUUID()

  await execute(
    `INSERT INTO documentos (id, cliente_id, cliente_obl_id, nombre_archivo, ruta, anio, trimestre, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
  return queryAll(`
    SELECT d.*, u.nombre AS subido_por_nombre, u.email AS subido_por_email,
           oc.aspecto, oc.obligacion, oc.sub_titulo, oc.periodicidad
    FROM documentos d
    JOIN users u ON u.id = d.uploaded_by
    LEFT JOIN cliente_obligaciones co ON co.id = d.cliente_obl_id
    LEFT JOIN obligaciones_catalogo oc ON oc.sub_id = co.catalogo_id
    WHERE d.cliente_id = ?
    ORDER BY d.anio DESC, d.trimestre DESC, d.uploaded_at DESC
  `, [clienteId])
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
  const cond   = trimestre != null ? 'AND d.trimestre = ?' : 'AND d.trimestre IS NULL'
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
