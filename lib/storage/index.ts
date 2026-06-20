import path from 'path'
import { queryOne, execute } from '@/lib/db'
import { LocalProvider }      from './local'
import { GoogleDriveProvider } from './googledrive'
import { MicrosoftProvider }   from './microsoft'
import type { StorageConfig, IStorageProvider } from './types'

export * from './types'

const DEFAULT_BASE = process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'uploads')

export async function getStorageConfig(clienteId: string): Promise<StorageConfig> {
  const row = await queryOne('SELECT storage_type, storage_config FROM clientes WHERE id = ?', [clienteId])
  if (!row) throw new Error(`Cliente ${clienteId} no encontrado`)
  const type   = ((row as any).storage_type ?? 'local') as StorageConfig['type']
  let parsed: Partial<StorageConfig> = {}
  try { parsed = JSON.parse((row as any).storage_config ?? '{}') } catch {}
  return { type, ...parsed }
}

export async function saveStorageConfig(clienteId: string, partial: Partial<StorageConfig>): Promise<void> {
  const current = await getStorageConfig(clienteId)
  const updated = { ...current, ...partial }
  await execute(`UPDATE clientes SET storage_config = ? WHERE id = ?`, [JSON.stringify(updated), clienteId])
}

/** Devuelve el proveedor activo para un cliente. */
export function getProvider(clienteId: string): IStorageProvider {
  // getProvider is called synchronously in some places — return a lazy proxy
  return new LazyProvider(clienteId)
}

/** Proxy que resuelve el proveedor real en la primera operación */
class LazyProvider implements IStorageProvider {
  private clienteId: string
  private _provider: IStorageProvider | null = null

  constructor(clienteId: string) { this.clienteId = clienteId }

  private async resolve(): Promise<IStorageProvider> {
    if (this._provider) return this._provider
    const config  = await getStorageConfig(this.clienteId)
    const saveFn  = (partial: Partial<StorageConfig>) => saveStorageConfig(this.clienteId, partial)
    switch (config.type) {
      case 'googledrive': this._provider = new GoogleDriveProvider(config, saveFn); break
      case 'onedrive':
      case 'sharepoint':  this._provider = new MicrosoftProvider(config, saveFn);   break
      default: {
        const basePath = config.basePath ?? path.join(DEFAULT_BASE, this.clienteId)
        this._provider = new LocalProvider(basePath)
      }
    }
    return this._provider
  }

  async upload(lp: string, fn: string, buf: Buffer, mime: string) { return (await this.resolve()).upload(lp, fn, buf, mime) }
  async download(ref: string)       { return (await this.resolve()).download(ref) }
  async getDownloadUrl(ref: string) { return (await this.resolve()).getDownloadUrl(ref) }
  async delete(ref: string)         { return (await this.resolve()).delete(ref) }
}

export function isCloudRef(ref: string): boolean {
  return ref.startsWith('gdrive:') || ref.startsWith('onedrive:') || ref.startsWith('sharepoint:')
}

export function localAbsPath(clienteId: string, ref: string): string {
  const basePath = path.join(DEFAULT_BASE, clienteId)
  return path.join(basePath, ref)
}
