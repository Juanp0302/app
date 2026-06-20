/**
 * lib/storage/local.ts
 * Proveedor local: guarda archivos en una carpeta del PC del cliente.
 * Compatible con la estructura existente uploads/{clienteId}/...
 */

import fs   from 'fs'
import path from 'path'
import type { IStorageProvider, StorageFile } from './types'

export class LocalProvider implements IStorageProvider {
  private basePath: string

  constructor(basePath: string) {
    this.basePath = basePath
  }

  async upload(logicalPath: string, filename: string, buffer: Buffer, mimeType: string): Promise<StorageFile> {
    const dir      = path.join(this.basePath, logicalPath)
    fs.mkdirSync(dir, { recursive: true })

    const safe = filename.replace(/[<>:"/\\|?*]/g, '_')
    const full = path.join(dir, safe)
    fs.writeFileSync(full, buffer)

    // Ref: ruta relativa desde basePath, con separadores /
    const ref = path.join(logicalPath, safe).replace(/\\/g, '/')

    return { ref, name: filename, size: buffer.length, mimeType }
  }

  async download(ref: string): Promise<Buffer> {
    const full = path.join(this.basePath, ref)
    if (!fs.existsSync(full)) throw new Error(`Archivo no encontrado: ${full}`)
    return fs.readFileSync(full)
  }

  async getDownloadUrl(_ref: string): Promise<string | null> {
    return null  // Se sirve directamente desde la API
  }

  async delete(ref: string): Promise<void> {
    const full = path.join(this.basePath, ref)
    if (fs.existsSync(full)) fs.unlinkSync(full)
  }

  /** Ruta absoluta (para el servidor local) */
  fullPath(ref: string): string {
    return path.join(this.basePath, ref)
  }
}
