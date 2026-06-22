/**
 * lib/storage/googledrive.ts
 * Proveedor Google Drive — usa la REST API v3 directamente (sin npm extra).
 *
 * Estructura de carpetas en Drive:
 *   Owl Compliance/
 *     {logicalPath}/
 *       {filename}
 */

import type { IStorageProvider, StorageConfig, StorageFile } from './types'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const TOKEN_URL  = 'https://oauth2.googleapis.com/token'

type SaveConfigFn = (config: Partial<StorageConfig>) => Promise<void>

export class GoogleDriveProvider implements IStorageProvider {
  private config: StorageConfig
  private saveConfig: SaveConfigFn

  constructor(config: StorageConfig, saveConfig: SaveConfigFn) {
    this.config     = config
    this.saveConfig = saveConfig
  }

  // ── Token management ───────────────────────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    const expiry = this.config.token_expiry ?? 0
    if (Date.now() < expiry - 60_000) return this.config.access_token!

    // Refresh
    const res = await fetch(TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: this.config.refresh_token!,
        grant_type:    'refresh_token',
      }),
    })
    if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`)

    const data = await res.json()
    const updated: Partial<StorageConfig> = {
      access_token: data.access_token,
      token_expiry: Date.now() + data.expires_in * 1000,
    }
    this.config = { ...this.config, ...updated }
    await this.saveConfig(updated)
    return data.access_token as string
  }

  private async authHeader() {
    return { Authorization: `Bearer ${await this.getAccessToken()}` }
  }

  // ── Folder management ──────────────────────────────────────────────────────

  /** Busca o crea una carpeta con `name` dentro de `parentId`. */
  private async findOrCreateFolder(name: string, parentId: string): Promise<string> {
    const auth = await this.authHeader()
    const q    = encodeURIComponent(
      `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    )
    const search = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id)`, { headers: auth })
    const { files } = await search.json()
    if (files?.length) return files[0].id as string

    const create = await fetch(`${DRIVE_API}/files`, {
      method:  'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents:  [parentId],
      }),
    })
    const folder = await create.json()
    return folder.id as string
  }

  /** Resuelve (y crea si hace falta) la cadena de carpetas para un logicalPath. */
  private async resolveFolderPath(logicalPath: string): Promise<string> {
    const token = await this.getAccessToken()

    // Asegurarse de que existe la carpeta raíz
    let rootId = this.config.root_folder_id
    if (!rootId) {
      const auth = await this.authHeader()
      const q    = encodeURIComponent(`name='Owl Compliance' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`)
      const search = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id)`, { headers: { Authorization: `Bearer ${token}` } })
      const { files } = await search.json()
      if (files?.length) {
        rootId = files[0].id as string
      } else {
        const create = await fetch(`${DRIVE_API}/files`, {
          method:  'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Owl Compliance', mimeType: 'application/vnd.google-apps.folder' }),
        })
        const f = await create.json()
        rootId  = f.id as string
      }
      this.config.root_folder_id = rootId
      await this.saveConfig({ root_folder_id: rootId })
    }

    // Recorrer partes del logicalPath
    let currentId = rootId!
    for (const part of logicalPath.split('/').filter(Boolean)) {
      currentId = await this.findOrCreateFolder(part, currentId)
    }
    return currentId
  }

  // ── IStorageProvider ───────────────────────────────────────────────────────

  async upload(logicalPath: string, filename: string, buffer: Buffer, mimeType: string): Promise<StorageFile> {
    const folderId = await this.resolveFolderPath(logicalPath)
    const auth     = await this.authHeader()

    const meta     = JSON.stringify({ name: filename, parents: [folderId] })
    const boundary = '-------owl_boundary'
    const body     = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
      Buffer.from(meta),
      Buffer.from(`\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
      buffer,
      Buffer.from(`\r\n--${boundary}--`),
    ])

    const res = await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id,name,size,webViewLink`, {
      method:  'POST',
      headers: { ...auth, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    })
    if (!res.ok) throw new Error(`Google Drive upload failed: ${await res.text()}`)

    const file = await res.json()
    return {
      ref:     `gdrive:${file.id}`,
      name:    filename,
      size:    buffer.length,
      mimeType,
      webUrl:  file.webViewLink,
    }
  }

  async download(ref: string): Promise<Buffer> {
    const fileId = ref.replace('gdrive:', '')
    const auth   = await this.authHeader()
    const res    = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, { headers: auth })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Google Drive download failed (${res.status}): ${body.slice(0, 200)}`)
    }
    // Verificar que la respuesta sea el archivo y no un redirect a una página de confirmación
    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('text/html')) {
      // Google a veces redirige a una página de "descarga de archivo grande con virus scan"
      // En ese caso hay que seguir la URL de exportación manualmente
      throw new Error('Google Drive devolvió una página HTML en lugar del archivo. El archivo puede requerir confirmación de descarga.')
    }
    return Buffer.from(await res.arrayBuffer())
  }

  async getDownloadUrl(ref: string): Promise<string | null> {
    const fileId = ref.replace('gdrive:', '')
    const auth   = await this.authHeader()
    const res    = await fetch(`${DRIVE_API}/files/${fileId}?fields=webContentLink`, { headers: auth })
    if (!res.ok) return null
    const { webContentLink } = await res.json()
    return webContentLink ?? null
  }

  async delete(ref: string): Promise<void> {
    const fileId = ref.replace('gdrive:', '')
    const auth   = await this.authHeader()
    await fetch(`${DRIVE_API}/files/${fileId}`, { method: 'DELETE', headers: auth })
  }
}
