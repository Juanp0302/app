/**
 * lib/storage/microsoft.ts
 * Proveedor Microsoft — cubre OneDrive y SharePoint usando Microsoft Graph API.
 *
 * OneDrive:   sube a /me/drive (o /drives/{driveId})
 * SharePoint: sube a /sites/{siteId}/drive
 *
 * Ambos usan el path-based upload de Graph:
 *   PUT /drives/{driveId}/root:/{logicalPath}/{filename}:/content
 * Graph crea automáticamente las carpetas intermedias.
 */

import type { IStorageProvider, StorageConfig, StorageFile } from './types'

const GRAPH      = 'https://graph.microsoft.com/v1.0'
const TOKEN_URL  = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'

type SaveConfigFn = (config: Partial<StorageConfig>) => Promise<void>

export class MicrosoftProvider implements IStorageProvider {
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

    const res = await fetch(TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        refresh_token: this.config.refresh_token!,
        grant_type:    'refresh_token',
        scope:         'Files.ReadWrite offline_access Sites.ReadWrite.All',
      }),
    })
    if (!res.ok) throw new Error(`Microsoft token refresh failed: ${await res.text()}`)

    const data = await res.json()
    const updated: Partial<StorageConfig> = {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? this.config.refresh_token,
      token_expiry:  Date.now() + (data.expires_in ?? 3600) * 1000,
    }
    this.config = { ...this.config, ...updated }
    await this.saveConfig(updated)
    return data.access_token as string
  }

  private async authHeader() {
    return { Authorization: `Bearer ${await this.getAccessToken()}` }
  }

  // ── Drive root ─────────────────────────────────────────────────────────────

  /** Devuelve el drive_id una sola vez, guardándolo en config. */
  private async getDriveId(): Promise<string> {
    if (this.config.drive_id) return this.config.drive_id

    const auth = await this.authHeader()

    if (this.config.type === 'sharepoint') {
      // Resolver site_id desde site_url si hace falta
      let siteId = this.config.site_id
      if (!siteId && this.config.site_url) {
        const url    = new URL(this.config.site_url)
        const host   = url.hostname
        const sitePath = url.pathname.replace(/^\/+|\/+$/g, '')
        const res = await fetch(`${GRAPH}/sites/${host}:/${sitePath}?$select=id`, { headers: auth })
        if (!res.ok) throw new Error(`No se pudo resolver el sitio SharePoint: ${await res.text()}`)
        const site = await res.json()
        siteId = site.id as string
        this.config.site_id = siteId
        await this.saveConfig({ site_id: siteId })
      }
      // Obtener el drive del sitio
      const res = await fetch(`${GRAPH}/sites/${siteId}/drive?$select=id`, { headers: auth })
      const drive = await res.json()
      this.config.drive_id = drive.id as string
    } else {
      // OneDrive
      const res   = await fetch(`${GRAPH}/me/drive?$select=id`, { headers: auth })
      const drive = await res.json()
      this.config.drive_id = drive.id as string
    }

    await this.saveConfig({ drive_id: this.config.drive_id })
    return this.config.drive_id!
  }

  // ── IStorageProvider ───────────────────────────────────────────────────────

  async upload(logicalPath: string, filename: string, buffer: Buffer, mimeType: string): Promise<StorageFile> {
    const driveId  = await this.getDriveId()
    const auth     = await this.authHeader()
    const safeName = filename.replace(/[<>:"/\\|?*]/g, '_')
    const remotePath = `Owl Compliance/${logicalPath}/${safeName}`

    const res = await fetch(
      `${GRAPH}/drives/${driveId}/root:/${encodeURIComponent(remotePath)}:/content`,
      {
        method:  'PUT',
        headers: { ...auth, 'Content-Type': mimeType },
        body:    buffer as unknown as BodyInit,
      }
    )
    if (!res.ok) throw new Error(`Microsoft upload failed: ${await res.text()}`)

    const file = await res.json()
    const provider = this.config.type === 'sharepoint' ? 'sharepoint' : 'onedrive'

    return {
      ref:     `${provider}:${driveId}:${file.id}`,
      name:    filename,
      size:    buffer.length,
      mimeType,
      webUrl:  file.webUrl,
    }
  }

  async download(ref: string): Promise<Buffer> {
    const parts   = ref.split(':')          // [provider, driveId, itemId]
    const driveId = parts[1]
    const itemId  = parts[2]
    const auth    = await this.authHeader()
    const res     = await fetch(`${GRAPH}/drives/${driveId}/items/${itemId}/content`, { headers: auth })
    if (!res.ok) throw new Error(`Microsoft download failed: ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  }

  async getDownloadUrl(ref: string): Promise<string | null> {
    const parts   = ref.split(':')
    const driveId = parts[1]
    const itemId  = parts[2]
    const auth    = await this.authHeader()
    const res     = await fetch(`${GRAPH}/drives/${driveId}/items/${itemId}?$select=@microsoft.graph.downloadUrl`, { headers: auth })
    if (!res.ok) return null
    const data    = await res.json()
    return data['@microsoft.graph.downloadUrl'] ?? null
  }

  async delete(ref: string): Promise<void> {
    const parts   = ref.split(':')
    const driveId = parts[1]
    const itemId  = parts[2]
    const auth    = await this.authHeader()
    await fetch(`${GRAPH}/drives/${driveId}/items/${itemId}`, { method: 'DELETE', headers: auth })
  }
}
