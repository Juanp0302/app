/**
 * GET  /api/documentos/scan?clienteId=xxx          → escanear y retornar vista previa
 * POST /api/documentos/scan                         → confirmar importación
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne, queryAll, execute } from '@/lib/db'
import { getStorageConfig, saveStorageConfig } from '@/lib/storage'
import type { StorageConfig } from '@/lib/storage/types'
import { slugify } from '@/lib/documentos'
import { escanearLocal, escanearGoogleDrive, escanearMicrosoft } from '@/lib/storage/scanner'
import path from 'path'
import crypto from 'crypto'

/** Refresca el token de Google si está próximo a expirar y lo guarda. */
async function refreshGoogleToken(config: StorageConfig, clienteId: string): Promise<string> {
  const expiry = config.token_expiry ?? 0
  if (Date.now() < expiry - 60_000) return config.access_token!

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: config.refresh_token!,
      grant_type:    'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`)

  const data = await res.json()
  await saveStorageConfig(clienteId, {
    access_token: data.access_token,
    token_expiry: Date.now() + data.expires_in * 1000,
  })
  return data.access_token as string
}

async function getSession() {
  const session = await auth()
  if (!session?.user) return null
  return session.user as any
}

/** Parsea una ruta relativa y retorna los segmentos semánticos. */
function parsearRuta(ruta: string): {
  aspectoSlug: string
  obligacionSlug: string
  anio: number
  trimestre: number | null
  nombre: string
} | null {
  // Esperamos al menos 4 segmentos: aspecto/obligacion/anio/periodo/nombre
  const partes = ruta.split('/').filter(Boolean)
  if (partes.length < 4) return null

  // El nombre es el último segmento
  const nombre         = partes[partes.length - 1]
  const periodoStr     = partes[partes.length - 2]
  const anioStr        = partes[partes.length - 3]
  const obligacionSlug = partes[partes.length - 4]
  const aspectoSlug    = partes.slice(0, partes.length - 4).join('/')

  if (!aspectoSlug) return null

  const anio = parseInt(anioStr)
  if (isNaN(anio) || anio < 2000 || anio > 2100) return null

  let trimestre: number | null = null
  const matchQ = periodoStr.toUpperCase().match(/^Q(\d)$/)
  if (matchQ) {
    trimestre = parseInt(matchQ[1])
  } else if (periodoStr.toLowerCase() !== 'permanente') {
    return null
  }

  return { aspectoSlug, obligacionSlug, anio, trimestre, nombre }
}

export async function GET(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let clienteId = req.nextUrl.searchParams.get('clienteId')
  if (user.role === 'cliente') {
    const c = await queryOne('SELECT id FROM clientes WHERE user_id = ?', [user.id])
    if (!c) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    clienteId = (c as any).id
  }
  if (!clienteId) return NextResponse.json({ error: 'clienteId requerido' }, { status: 400 })

  // Obtener config del proveedor
  const config = await getStorageConfig(clienteId)

  // Obtener acceso a archivos según proveedor
  let archivos
  let infoProveedor: string
  try {
    if (config.type === 'local') {
      const basePath = config.basePath ?? path.join(process.cwd(), 'uploads', clienteId)
      infoProveedor = `local:${basePath}`
      archivos = escanearLocal(basePath)
    } else if (config.type === 'googledrive') {
      if (!config.access_token && !config.refresh_token)
        return NextResponse.json({ error: 'Google Drive no autorizado' }, { status: 401 })
      infoProveedor = `googledrive:${config.root_folder_id ?? 'buscando carpeta Owl Compliance...'}`
      const token = await refreshGoogleToken(config, clienteId)
      archivos = await escanearGoogleDrive(config, token)
    } else {
      if (!config.access_token) return NextResponse.json({ error: 'Microsoft no autorizado' }, { status: 401 })
      infoProveedor = `${config.type}:${config.drive_id ?? 'me'}`
      archivos = await escanearMicrosoft(config, config.access_token)
    }
  } catch (e: any) {
    return NextResponse.json({ error: `Error escaneando: ${e.message}` }, { status: 500 })
  }

  // Obtener catálogo de obligaciones del cliente
  const obligaciones = await queryAll(`
    SELECT co.id AS cliente_obl_id, co.catalogo_id,
           oc.aspecto, oc.obligacion, oc.sub_titulo, oc.periodicidad
    FROM cliente_obligaciones co
    JOIN obligaciones_catalogo oc ON oc.sub_id = co.catalogo_id
    WHERE co.cliente_id = ?
  `, [clienteId]) as any[]

  // Obtener documentos ya registrados para evitar duplicados
  const docRegistrados = await queryAll(`SELECT ruta FROM documentos WHERE cliente_id = ?`, [clienteId]) as any[]
  const refsRegistradas = new Set(docRegistrados.map((d: any) => d.ruta))

  // Construir índice de búsqueda: aspectoSlug/obligacionSlug → obligacion
  const indice = new Map<string, any>()
  for (const obl of obligaciones) {
    const key = `${slugify(obl.aspecto)}/${slugify(obl.obligacion)}`
    indice.set(key, obl)
  }

  // Clasificar archivos
  const reconocidos: any[]    = []
  const noReconocidos: any[] = []

  for (const archivo of archivos) {
    // Saltar si ya está en BD
    if (refsRegistradas.has(archivo.ref)) continue

    const parsed = parsearRuta(archivo.ruta)
    if (!parsed) {
      noReconocidos.push({ ref: archivo.ref, ruta: archivo.ruta, nombre: archivo.nombre })
      continue
    }

    const { aspectoSlug, obligacionSlug, anio, trimestre, nombre } = parsed
    const key = `${aspectoSlug}/${obligacionSlug}`
    const obl = indice.get(key)

    if (!obl) {
      noReconocidos.push({
        ref: archivo.ref, ruta: archivo.ruta, nombre,
        razon: `No se encontró obligación: ${key}`,
      })
      continue
    }

    reconocidos.push({
      ref:            archivo.ref,
      ruta:           archivo.ruta,
      nombre,
      anio,
      trimestre,
      aspecto:        obl.aspecto,
      obligacion:     obl.obligacion,
      sub_titulo:     obl.sub_titulo,
      periodicidad:   obl.periodicidad,
      cliente_obl_id: obl.cliente_obl_id,
    })
  }

  return NextResponse.json({
    total:           archivos.length,
    ya_registrados:  refsRegistradas.size,
    sin_obligaciones: obligaciones.length === 0,
    reconocidos,
    no_reconocidos:  noReconocidos,
    _debug: { proveedor: infoProveedor!, obligaciones_configuradas: obligaciones.length },
  })
}

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { clienteId: cIdParam, archivos } = body as { clienteId: string; archivos: any[] }

  let clienteId = cIdParam
  if (user.role === 'cliente') {
    const c = await queryOne('SELECT id FROM clientes WHERE user_id = ?', [user.id])
    if (!c) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    clienteId = (c as any).id
  }
  if (!clienteId || !Array.isArray(archivos) || archivos.length === 0)
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

  let importados = 0
  const errores: any[] = []

  for (const a of archivos) {
    // Verificar no duplicado
    const existe = await queryOne('SELECT id FROM documentos WHERE cliente_id = ? AND ruta = ?', [clienteId, a.ref])
    if (existe) continue

    try {
      const docId = crypto.randomUUID()
      await execute(
        `INSERT INTO documentos (id, cliente_id, cliente_obl_id, nombre_archivo, ruta, anio, trimestre, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [docId, clienteId, a.cliente_obl_id ?? null, a.nombre, a.ref, a.anio, a.trimestre ?? null, user.id]
      )
      await execute(
        `INSERT INTO audit_log (id, user_id, user_email, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, 'documento_escaneado', 'documento', ?, ?)`,
        [crypto.randomUUID(), user.id, user.email ?? '', docId, JSON.stringify({ archivo: a.nombre, ref: a.ref, via: 'scanner' })]
      )
      importados++
    } catch (e: any) {
      errores.push({ ref: a.ref, error: e.message })
    }
  }

  return NextResponse.json({ ok: true, importados, errores })
}
