/**
 * lib/drive-upload.ts
 * Sube archivos a Google Drive usando la API REST directamente
 * con una cuenta de servicio (sin googleapis npm package).
 */

import crypto from 'crypto'

const DRIVE_FOLDER_ID = '1ydORMtBFxWmzsr-LXJgOdpSFCox6Wa5I'
const SCOPES          = 'https://www.googleapis.com/auth/drive'

interface ServiceAccount {
  client_email: string
  private_key:  string
}

function parseServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    console.error('[drive-upload] GOOGLE_SERVICE_ACCOUNT_JSON inválido')
    return null
  }
}

/** Genera un JWT firmado y lo intercambia por un access token */
async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now  = Math.floor(Date.now() / 1000)
  const exp  = now + 3600

  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss:   sa.client_email,
    scope: SCOPES,
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp,
  })).toString('base64url')

  const unsigned  = `${header}.${payload}`
  const sign      = crypto.createSign('RSA-SHA256')
  sign.update(unsigned)
  const signature = sign.sign(sa.private_key, 'base64url')
  const jwt       = `${unsigned}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[drive-upload] Token error: ${err}`)
  }

  const json = await res.json()
  return json.access_token as string
}

/** Busca o crea una subcarpeta dentro de parentId */
async function obtenerOCrearCarpeta(nombre: string, parentId: string, token: string): Promise<string> {
  // Buscar primero
  const q    = encodeURIComponent(`name='${nombre}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`)
  const list = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const listJson = await list.json()
  if (listJson.files?.length > 0) return listJson.files[0].id as string

  // Crear
  const create = await fetch('https://www.googleapis.com/drive/v3/files', {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      name:     nombre,
      mimeType: 'application/vnd.google-apps.folder',
      parents:  [parentId],
    }),
  })
  const createJson = await create.json()
  return createJson.id as string
}

/** Sube un PDF a una carpeta de Drive usando multipart upload */
async function uploadFile(nombre: string, buffer: Buffer, folderId: string, token: string): Promise<string> {
  const metadata = JSON.stringify({ name: nombre, parents: [folderId] })
  const boundary = '-------owl_boundary_xyz'

  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
    Buffer.from(metadata),
    Buffer.from(`\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ])

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`,
    },
    body,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[drive-upload] Upload error: ${err}`)
  }

  const json = await res.json()
  return json.id as string
}

/**
 * Sube uno o más PDFs a la carpeta del cliente en Drive.
 * Si GOOGLE_SERVICE_ACCOUNT_JSON no está configurado, no hace nada.
 */
export async function subirContratoADrive(params: {
  nombreCliente: string
  adjuntos:      Array<{ filename: string; content: Buffer }>
}): Promise<void> {
  const sa = parseServiceAccount()
  if (!sa) {
    console.warn('[drive-upload] GOOGLE_SERVICE_ACCOUNT_JSON no configurado — omitiendo Drive')
    return
  }

  try {
    const token     = await getAccessToken(sa)
    // Nombre de subcarpeta: solo caracteres alfanuméricos y espacios
    const subfolder = params.nombreCliente.replace(/[^a-zA-Z0-9\sáéíóúÁÉÍÓÚñÑ]/g, '').trim()
    const folderId  = await obtenerOCrearCarpeta(subfolder, DRIVE_FOLDER_ID, token)

    await Promise.all(
      params.adjuntos.map(adj => uploadFile(adj.filename, adj.content, folderId, token))
    )

    console.log(`[drive-upload] ${params.adjuntos.length} archivo(s) subidos a Drive → ${subfolder}`)
  } catch (e) {
    console.error('[drive-upload] Error subiendo a Drive:', e)
  }
}
