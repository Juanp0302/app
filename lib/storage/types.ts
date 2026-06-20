/**
 * lib/storage/types.ts
 * Interfaces compartidas por todos los proveedores de almacenamiento.
 */

export type StorageType = 'local' | 'googledrive' | 'onedrive' | 'sharepoint'

export interface StorageConfig {
  type: StorageType
  // ── local ──────────────────────────────────────
  basePath?: string          // ruta absoluta en el PC del cliente

  // ── oauth (todos los proveedores cloud) ────────
  access_token?: string
  refresh_token?: string
  token_expiry?: number      // unix ms

  // ── google drive ───────────────────────────────
  root_folder_id?: string    // ID de la carpeta raíz en Drive

  // ── microsoft (onedrive + sharepoint) ──────────
  drive_id?: string          // ID del drive
  site_url?: string          // SharePoint: https://company.sharepoint.com/sites/xxx
  site_id?: string           // SharePoint: resuelto automáticamente desde site_url
}

/** Referencia a un archivo subido. Se serializa en documentos.ruta */
export interface StorageFile {
  /** Almacenado en BD como:
   *  - local:      ruta relativa  (e.g. "1/financiero/obl/2026/Q1/doc.pdf")
   *  - googledrive: "gdrive:{fileId}"
   *  - onedrive:   "onedrive:{driveId}:{itemId}"
   *  - sharepoint: "sharepoint:{driveId}:{itemId}"
   */
  ref: string
  name: string
  size: number
  mimeType: string
  webUrl?: string
}

export interface IStorageProvider {
  /** Sube un archivo. logicalPath es el prefijo de carpetas, e.g. "Financiero/obl_123/2026/Q1" */
  upload(logicalPath: string, filename: string, buffer: Buffer, mimeType: string): Promise<StorageFile>
  /** Descarga el contenido de un archivo a partir de su ref */
  download(ref: string): Promise<Buffer>
  /** URL directa de descarga (para redirect). Null si el proveedor no lo soporta */
  getDownloadUrl(ref: string): Promise<string | null>
  /** Elimina el archivo del proveedor */
  delete(ref: string): Promise<void>
}
