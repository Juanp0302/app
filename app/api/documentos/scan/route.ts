/**
 * GET  /api/documentos/scan?clienteId=xxx
 *   → Escanea el proveedor de almacenamiento configurado (Drive, OneDrive).
 *     Para almacenamiento local en servidores cloud usa el POST con accion=previsualizar.
 *
 * POST /api/documentos/scan
 *   accion=previsualizar → recibe lista de {ruta, nombre} desde el browser, cruza con obligaciones
 *   accion=importar      → registra en BD archivos ya subidos al proveedor (cloud scan)
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

async function getSession() {
  const session = await auth()
  if (!session?.user) return null
  return session.user as any
}

async function resolveClienteId(user: any, param: string | null): Promise<string | null> {
  if (user.role === 'cliente') {
    const c = await queryOne('SELECT id FROM clientes WHERE user_id = ?', [user.id])
    return c ? (c as any).id : null
  }
  return param
}

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

/** Parsea una ruta relativa: aspecto/obligacion/anio/Q{n}|permanente/nombre */
function parsearRuta(ruta: string) {
  const partes = ruta.split('/').filter(Boolean)
  if (partes.length < 5) return null   // necesita al menos 5 segmentos

  const nombre         = partes[partes.length - 1]
  const periodoStr     = partes[partes.length - 2]
  const anioStr        = partes[partes.length - 3]
  const obligacionSlug = partes[partes.length - 4]
  const aspectoSlug    = partes.slice(0, partes.length - 4).join('/')

  if (!aspectoSlug || !obligacionSlug) return null

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

/** Cruza una lista de {ruta, nombre} contra las obligaciones del cliente. */
async function clasificarArchivos(
  clienteId: string,
  entradas: { ruta: string; nombre: string; ref?: string }[]
) {
  const obligaciones = await queryAll(`
    SELECT co.id AS cliente_obl_id, co.catalogo_id,
           oc.aspecto, oc.obligacion, oc.sub_titulo, oc.periodicidad
    FROM cliente_obligaciones co
    JOIN obligaciones_catalogo oc ON oc.sub_id = co.catalogo_id
    WHERE co.cliente_id = ?
  `, [clienteId]) as any[]

  const docRegistrados = await queryAll(`SELECT ruta FROM documentos WHERE cliente_id = ?`, [clienteId]) as any[]
  const refsRegistradas = new Set(docRegistrados.map((d: any) => d.ruta))

  const indice = new Map<string, any>()
  for (const obl of obligaciones) {
    const key = `${slugify(obl.aspecto)}/${slugify(obl.obligacion)}`
    indice.set(key, obl)
  }

  const reconocidos:    any[] = []
  const noReconocidos:  any[] = []

  for (const entrada of entradas) {
    const ref = entrada.ref ?? entrada.ruta
    if (refsRegistradas.has(ref)) continue

    const parsed = parsearRuta(entrada.ruta)
    if (!parsed) {
      noReconocidos.push({ ref, ruta: entrada.ruta, nombre: entrada.nombre, razon: 'Ruta fuera de estructura esperada' })
      continue
    }

    const { aspectoSlug, obligacionSlug, anio, trimestre, nombre } = parsed
    const key = `${aspectoSlug}/${obligacionSlug}`
    const obl = indice.get(key)

    if (!obl) {
      noReconocidos.push({ ref, ruta: entrada.ruta, nombre, razon: `Obligación no encontrada: ${key}` })
      continue
    }

    reconocidos.push({
      ref, ruta: entrada.ruta, nombre, anio, trimestre,
      aspecto:        obl.aspecto,
      obligacion:     obl.obligacion,
      sub_titulo:     obl.sub_titulo,
      periodicidad:   obl.periodicidad,
      cliente_obl_id: obl.cliente_obl_id,
    })
  }

  return { obligaciones, reconocidos, noReconocidos, refsRegistradas }
}

// ── GET: escaneo server-side (Drive / OneDrive / local en mismo servidor) ──────

export async function GET(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const clienteId = await resolveClienteId(user, req.nextUrl.searchParams.get('clienteId'))
  if (!clienteId) return NextResponse.json({ error: 'clienteId requerido' }, { status: 400 })

  const config = await getStorageConfig(clienteId)
  let archivos: { ref: string; ruta: string; nombre: string }[]
  let infoProveedor: string

  try {
    if (config.type === 'local') {
      const basePath = config.basePath ?? path.join(process.cwd(), 'uploads', clienteId)
      infoProveedor = `local:${basePath}`
      archivos = escanearLocal(basePath)
    } else if (config.type === 'googledrive') {
      if (!config.access_token && !config.refresh_token)
        return NextResponse.json({ error: 'Google Drive no autorizado' }, { status: 401 })
      infoProveedor = `googledrive:${config.root_folder_id ?? 'raíz'}`
      const token = await refreshGoogleToken(config, clienteId)
      archivos = await escanearGoogleDrive(config, token)
    } else {
      if (!config.access_token)
        return NextResponse.json({ error: 'Microsoft no autorizado' }, { status: 401 })
      infoProveedor = `${config.type}:${config.drive_id ?? 'me'}`
      archivos = await escanearMicrosoft(config, config.access_token)
    }
  } catch (e: any) {
    return NextResponse.json({ error: `Error escaneando: ${e.message}` }, { status: 500 })
  }

  const { obligaciones, reconocidos, noReconocidos, refsRegistradas } =
    await clasificarArchivos(clienteId, archivos)

  return NextResponse.json({
    total:            archivos.length,
    ya_registrados:   refsRegistradas.size,
    sin_obligaciones: obligaciones.length === 0,
    reconocidos,
    no_reconocidos:   noReconocidos,
    _debug: { proveedor: infoProveedor!, obligaciones_configuradas: obligaciones.length },
  })
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const clienteId = await resolveClienteId(user, body.clienteId ?? null)
  if (!clienteId) return NextResponse.json({ error: 'clienteId requerido' }, { status: 400 })

  // ── accion: previsualizar ──────────────────────────────────────────────────
  // Recibe [{ruta, nombre}] desde el browser (folder picker), devuelve preview.
  if (body.accion === 'previsualizar') {
    const entradas: { ruta: string; nombre: string }[] = body.archivos ?? []
    if (!Array.isArray(entradas) || entradas.length === 0)
      return NextResponse.json({ error: 'Sin archivos' }, { status: 400 })

    const { obligaciones, reconocidos, noReconocidos, refsRegistradas } =
      await clasificarArchivos(clienteId, entradas)

    return NextResponse.json({
      total:            entradas.length,
      ya_registrados:   refsRegistradas.size,
      sin_obligaciones: obligaciones.length === 0,
      reconocidos,
      no_reconocidos:   noReconocidos,
    })
  }

  // ── accion: importar ───────────────────────────────────────────────────────
  // Registra en BD archivos que ya están en el proveedor cloud (resultado del GET).
  if (body.accion === 'importar') {
    const archivos: any[] = body.archivos ?? []
    if (!Array.isArray(archivos) || archivos.length === 0)
      return NextResponse.json({ error: 'Sin archivos' }, { status: 400 })

    let importados = 0
    const errores: any[] = []

    for (const a of archivos) {
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

  return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })
}
