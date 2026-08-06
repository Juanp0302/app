/**
 * lib/adjuntos.ts
 * Adjuntos de archivo para chats y tickets. Reutiliza el mismo proveedor de
 * almacenamiento configurable por cliente (local / Google Drive / OneDrive /
 * SharePoint) que ya usa el módulo de Documentos — ver lib/storage.
 */
import { execute } from './db'
import { getProvider } from './storage'

let _migrated = false
export async function migrateAdjuntos() {
  if (_migrated) return
  _migrated = true
  const cols = [
    `ALTER TABLE mensajes ADD COLUMN archivo_ref TEXT`,
    `ALTER TABLE mensajes ADD COLUMN archivo_nombre TEXT`,
    `ALTER TABLE mensajes ADD COLUMN archivo_mime TEXT`,
    `ALTER TABLE mensajes ADD COLUMN archivo_tamano INTEGER`,
    `ALTER TABLE ticket_respuestas ADD COLUMN archivo_ref TEXT`,
    `ALTER TABLE ticket_respuestas ADD COLUMN archivo_nombre TEXT`,
    `ALTER TABLE ticket_respuestas ADD COLUMN archivo_mime TEXT`,
    `ALTER TABLE ticket_respuestas ADD COLUMN archivo_tamano INTEGER`,
    `ALTER TABLE tickets ADD COLUMN archivo_ref TEXT`,
    `ALTER TABLE tickets ADD COLUMN archivo_nombre TEXT`,
    `ALTER TABLE tickets ADD COLUMN archivo_mime TEXT`,
    `ALTER TABLE tickets ADD COLUMN archivo_tamano INTEGER`,
  ]
  for (const sql of cols) {
    try { await execute(sql) } catch { /* columna ya existe */ }
  }
}

// Mismas reglas que lib/documentos.ts / app/api/documentos (PDF, Word, Excel, imágenes, 20MB)
const TIPOS_PERMITIDOS = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword', 'application/vnd.ms-excel',
  'image/jpeg', 'image/png', 'image/gif',
  'application/octet-stream', '',
]
const EXTENSIONES_PERMITIDAS: Record<string, string> = {
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
}
const TAMANO_MAXIMO = 20 * 1024 * 1024 // 20 MB

function extension(nombre: string): string {
  return nombre.split('.').pop()?.toLowerCase() ?? ''
}

/** Devuelve un mensaje de error si el archivo no es válido, o null si está bien. */
export function validarArchivoAdjunto(archivo: File): string | null {
  const ext = extension(archivo.name)
  if (!TIPOS_PERMITIDOS.includes(archivo.type) && !EXTENSIONES_PERMITIDAS[ext]) {
    return 'Tipo de archivo no permitido. Use PDF, Word, Excel o imágenes.'
  }
  if (archivo.size > TAMANO_MAXIMO) return 'El archivo no puede superar 20 MB.'
  return null
}

function mimeEfectivo(archivo: File): string {
  const ext = extension(archivo.name)
  return (archivo.type && archivo.type !== 'application/octet-stream')
    ? archivo.type
    : EXTENSIONES_PERMITIDAS[ext] ?? archivo.type
}

/**
 * Sube un adjunto al proveedor de almacenamiento del cliente (el mismo que
 * usa Documentos: local por defecto, o Google Drive/OneDrive si el cliente
 * lo configuró) y devuelve lo necesario para guardar en la fila del mensaje
 * o la respuesta.
 */
export async function subirAdjunto(opts: {
  clienteId: string
  carpeta: string   // ej. "chat/<conversacionId>" o "tickets/<ticketId>"
  archivo: File
}): Promise<{ ref: string; nombre: string; mime: string; tamano: number }> {
  await migrateAdjuntos()
  const mime   = mimeEfectivo(opts.archivo)
  const buffer = Buffer.from(await opts.archivo.arrayBuffer())
  const provider = getProvider(opts.clienteId)
  const storageFile = await provider.upload(opts.carpeta, opts.archivo.name, buffer, mime)
  return { ref: storageFile.ref, nombre: opts.archivo.name, mime, tamano: opts.archivo.size }
}

export async function descargarAdjunto(clienteId: string, ref: string): Promise<Buffer> {
  const provider = getProvider(clienteId)
  return provider.download(ref)
}
