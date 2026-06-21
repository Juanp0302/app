/**
 * lib/storage/scanner.ts
 * Recorre la carpeta del proveedor y retorna todos los archivos encontrados
 * con su ruta relativa dentro de la carpeta "Owl Compliance".
 */

import type { StorageConfig } from './types'
import fs from 'fs'
import path from 'path'

export interface ArchivoEscaneado {
  ref:      string   // referencia para descargar (gdrive:ID, onedrive:..., ruta relativa)
  ruta:     string   // ruta relativa: aspecto/obligacion/anio/trimestre/nombre
  nombre:   string   // nombre del archivo
}

// ── Local ─────────────────────────────────────────────────────────────────────

export function escanearLocal(basePath: string): ArchivoEscaneado[] {
  const resultado: ArchivoEscaneado[] = []

  function recorrer(dir: string, relativo: string) {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rutaAbs = path.join(dir, entry.name)
      const rutaRel = relativo ? `${relativo}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        recorrer(rutaAbs, rutaRel)
      } else {
        resultado.push({ ref: rutaRel, ruta: rutaRel, nombre: entry.name })
      }
    }
  }

  recorrer(basePath, '')
  return resultado
}

// ── Google Drive ──────────────────────────────────────────────────────────────

export async function escanearGoogleDrive(config: StorageConfig, accessToken: string): Promise<ArchivoEscaneado[]> {
  const DRIVE_API = 'https://www.googleapis.com/drive/v3'
  const auth = { Authorization: `Bearer ${accessToken}` }
  const resultado: ArchivoEscaneado[] = []

  async function listarCarpeta(folderId: string, rutaActual: string) {
    let pageToken: string | undefined
    do {
      const params = new URLSearchParams({
        q:        `'${folderId}' in parents and trashed=false`,
        fields:   'nextPageToken,files(id,name,mimeType)',
        pageSize: '1000',
        ...(pageToken ? { pageToken } : {}),
      })
      const res   = await fetch(`${DRIVE_API}/files?${params}`, { headers: auth })
      const data  = await res.json()
      pageToken   = data.nextPageToken

      for (const f of data.files ?? []) {
        const ruta = rutaActual ? `${rutaActual}/${f.name}` : f.name
        if (f.mimeType === 'application/vnd.google-apps.folder') {
          await listarCarpeta(f.id, ruta)
        } else {
          resultado.push({ ref: `gdrive:${f.id}`, ruta, nombre: f.name })
        }
      }
    } while (pageToken)
  }

  // Buscar carpeta raíz "Owl Compliance"
  const q   = encodeURIComponent(`name='Owl Compliance' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`)
  const res = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id)`, { headers: auth })
  const { files } = await res.json()

  const rootId = config.root_folder_id ?? files?.[0]?.id
  if (!rootId) return []

  await listarCarpeta(rootId, '')
  return resultado
}

// ── Microsoft (OneDrive / SharePoint) ────────────────────────────────────────

export async function escanearMicrosoft(config: StorageConfig, accessToken: string): Promise<ArchivoEscaneado[]> {
  const GRAPH = 'https://graph.microsoft.com/v1.0'
  const auth  = { Authorization: `Bearer ${accessToken}` }
  const resultado: ArchivoEscaneado[] = []

  const driveBase = config.type === 'sharepoint' && config.drive_id
    ? `${GRAPH}/drives/${config.drive_id}`
    : `${GRAPH}/me/drive`

  async function listarCarpeta(itemId: string, rutaActual: string) {
    let url: string | null = `${driveBase}/items/${itemId}/children?$top=1000&$select=id,name,file,folder`
    while (url) {
      const res: Response  = await fetch(url, { headers: auth })
      const data: any = await res.json()
      url        = data['@odata.nextLink'] ?? null

      for (const item of data.value ?? []) {
        const ruta = rutaActual ? `${rutaActual}/${item.name}` : item.name
        if (item.folder) {
          await listarCarpeta(item.id, ruta)
        } else if (item.file) {
          const driveId = config.drive_id ?? 'me'
          resultado.push({ ref: `onedrive:${driveId}:${item.id}`, ruta, nombre: item.name })
        }
      }
    }
  }

  // Buscar carpeta "Owl Compliance" en la raíz
  const rootRes: Response  = await fetch(`${driveBase}/root/children?$filter=name eq 'Owl Compliance'&$select=id,name,folder`, { headers: auth })
  const rootData: any = await rootRes.json()
  const owlFolder = rootData.value?.[0]

  if (!owlFolder) return []
  await listarCarpeta(owlFolder.id, '')
  return resultado
}
