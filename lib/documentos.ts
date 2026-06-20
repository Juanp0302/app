/**
 * lib/documentos.ts
 * Lógica de almacenamiento de documentos de acreditación.
 *
 * Estructura en disco:
 *   uploads/{clienteId}/{aspecto}/{obligacion_slug}/{anio}/Q{trimestre}/{archivo}
 *
 * Fácil de migrar a Google Drive / OneDrive en el futuro:
 * solo se reemplaza este módulo y las APIs siguen funcionando igual.
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { db } from './db'

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60)
}

export function rutaDirectorio(
  clienteId: string,
  aspecto:   string,
  obligacion: string,
  anio:      number,
  trimestre: number | null,
): string {
  const partes = [
    UPLOADS_DIR,
    clienteId,
    slugify(aspecto),
    slugify(obligacion),
    String(anio),
    trimestre ? `Q${trimestre}` : 'permanente',
  ]
  return path.join(...partes)
}

// ─── Guardar archivo ──────────────────────────────────────────────────────────

export interface GuardarParams {
  clienteId:     string
  clienteOblId:  string | null
  aspecto:       string
  obligacion:    string
  anio:          number
  trimestre:     number | null
  nombreArchivo: string
  buffer:        Buffer
  userId:        string
  userEmail:     string
}

export function guardarDocumento(p: GuardarParams): string {
  const dir = rutaDirectorio(p.clienteId, p.aspecto, p.obligacion, p.anio, p.trimestre)
  fs.mkdirSync(dir, { recursive: true })

  // Evitar colisiones de nombre
  const ext      = path.extname(p.nombreArchivo)
  const base     = path.basename(p.nombreArchivo, ext)
  const archivo  = `${slugify(base)}${ext}`
  const rutaFull = path.join(dir, archivo)

  fs.writeFileSync(rutaFull, p.buffer)

  // Ruta relativa para guardar en BD
  const rutaRel = path.relative(UPLOADS_DIR, rutaFull).replace(/\\/g, '/')

  const docId = crypto.randomUUID()

  db.prepare(`
    INSERT INTO documentos
      (id, cliente_id, cliente_obl_id, nombre_archivo, ruta, anio, trimestre, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(docId, p.clienteId, p.clienteOblId ?? null,
         p.nombreArchivo, rutaRel, p.anio, p.trimestre ?? null, p.userId)

  // Bitácora
  db.prepare(`
    INSERT INTO audit_log (id, user_id, user_email, accion, entidad, entidad_id, detalle)
    VALUES (?, ?, ?, 'documento_subido', 'documento', ?, ?)
  `).run(
    crypto.randomUUID(), p.userId, p.userEmail, docId,
    JSON.stringify({ archivo: p.nombreArchivo, ruta: rutaRel, anio: p.anio, trimestre: p.trimestre })
  )

  return docId
}

// ─── Eliminar archivo ─────────────────────────────────────────────────────────

export function eliminarDocumento(docId: string, userId: string, userEmail: string) {
  const doc = db.prepare('SELECT * FROM documentos WHERE id = ?').get(docId) as any
  if (!doc) throw new Error('Documento no encontrado')

  const rutaFull = path.join(UPLOADS_DIR, doc.ruta)
  if (fs.existsSync(rutaFull)) fs.unlinkSync(rutaFull)

  db.prepare('DELETE FROM documentos WHERE id = ?').run(docId)

  db.prepare(`
    INSERT INTO audit_log (id, user_id, user_email, accion, entidad, entidad_id, detalle)
    VALUES (?, ?, ?, 'documento_eliminado', 'documento', ?, ?)
  `).run(
    crypto.randomUUID(), userId, userEmail, docId,
    JSON.stringify({ archivo: doc.nombre_archivo, ruta: doc.ruta })
  )
}

// ─── Listar documentos de un cliente ─────────────────────────────────────────

export function listarDocumentos(clienteId: string) {
  return db.prepare(`
    SELECT
      d.*,
      u.nombre  AS subido_por_nombre,
      u.email   AS subido_por_email,
      oc.aspecto,
      oc.obligacion,
      oc.sub_titulo,
      oc.periodicidad
    FROM documentos d
    JOIN users u ON u.id = d.uploaded_by
    LEFT JOIN cliente_obligaciones co ON co.id = d.cliente_obl_id
    LEFT JOIN obligaciones_catalogo oc ON oc.sub_id = co.catalogo_id
    WHERE d.cliente_id = ?
    ORDER BY d.anio DESC, d.trimestre DESC, d.uploaded_at DESC
  `).all(clienteId) as any[]
}

// ─── Obtener ruta completa de un doc (para descarga) ─────────────────────────

export function rutaCompleta(ruta: string): string {
  return path.join(UPLOADS_DIR, ruta)
}

// ─── Documentos para ZIP: agrupados por obligación y trimestre ───────────────

export function documentosParaZip(
  clienteId: string,
  anio:      number,
  trimestre: number | null,
) {
  const cond = trimestre != null
    ? 'AND d.trimestre = ?'
    : 'AND d.trimestre IS NULL'

  const params: any[] = trimestre != null
    ? [clienteId, anio, trimestre]
    : [clienteId, anio]

  return db.prepare(`
    SELECT
      d.id, d.nombre_archivo, d.ruta, d.anio, d.trimestre,
      COALESCE(oc.aspecto, 'General')    AS aspecto,
      COALESCE(oc.obligacion, 'General') AS obligacion
    FROM documentos d
    LEFT JOIN cliente_obligaciones co ON co.id = d.cliente_obl_id
    LEFT JOIN obligaciones_catalogo oc ON oc.sub_id = co.catalogo_id
    WHERE d.cliente_id = ? AND d.anio = ? ${cond}
    ORDER BY oc.aspecto, oc.obligacion, d.nombre_archivo
  `).all(...params) as any[]
}
