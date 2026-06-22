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

/**
 * Parsea una ruta relativa. Soporta tres formatos según número de segmentos de prefijo
 * (todo lo que precede a [año, periodo, nombre]):
 *
 *   Legado   (5 seg, prefijo=2): aspecto / obligacion / año / periodo / nombre
 *            → empareja con todas las sub-obligaciones de esa obligación
 *
 *   Servicio (6 seg, prefijo=3): servicio / aspecto / obligacion / año / periodo / nombre
 *            → empareja con todas las subs de ese servicio
 *
 *   Preciso  (7 seg, prefijo=4): servicio / aspecto / obligacion / sub_titulo / año / periodo / nombre
 *            → empareja con UNA sub-obligación exacta (relación 1-a-1)
 */
function parsearRuta(ruta: string) {
  const partes = ruta.split('/').filter(Boolean)
  if (partes.length < 5) return null

  const nombre     = partes[partes.length - 1]
  const periodoStr = partes[partes.length - 2]
  const anioStr    = partes[partes.length - 3]

  const anio = parseInt(anioStr)
  if (isNaN(anio) || anio < 2000 || anio > 2100) return null

  let trimestre: number | null = null
  const matchQ = periodoStr.toUpperCase().match(/^Q(\d)$/)
  if (matchQ) {
    trimestre = parseInt(matchQ[1])
  } else if (periodoStr.toLowerCase() !== 'permanente') {
    return null
  }

  // Prefijo: todo lo que queda antes de [año, periodo, nombre]
  const prefijo = partes.slice(0, partes.length - 3)
  if (prefijo.length < 2) return null

  let servicioSlug:   string | null = null
  let aspectoSlug:    string
  let obligacionSlug: string
  let subTituloSlug:  string | null = null

  if (prefijo.length >= 4) {
    // Formato preciso: [servicio, aspecto, obligacion, sub_titulo]
    servicioSlug   = prefijo[0]
    aspectoSlug    = prefijo[1]
    obligacionSlug = prefijo[2]
    subTituloSlug  = prefijo.slice(3).join('/')   // sub_titulo puede tener varios segmentos
  } else if (prefijo.length === 3) {
    // Formato servicio: [servicio, aspecto, obligacion]
    servicioSlug   = prefijo[0]
    aspectoSlug    = prefijo[1]
    obligacionSlug = prefijo[2]
  } else {
    // Formato legado: [aspecto, obligacion]
    aspectoSlug    = prefijo[0]
    obligacionSlug = prefijo[1]
  }

  if (!aspectoSlug || !obligacionSlug) return null
  return { aspectoSlug, obligacionSlug, servicioSlug, subTituloSlug, anio, trimestre, nombre }
}

/** Cruza una lista de {ruta, nombre} contra las obligaciones del cliente. */
async function clasificarArchivos(
  clienteId: string,
  entradas: { ruta: string; nombre: string; ref?: string }[]
) {
  const obligaciones = await queryAll(`
    SELECT co.id AS cliente_obl_id, co.catalogo_id,
           oc.aspecto, oc.obligacion, oc.sub_titulo, oc.periodicidad, oc.servicio
    FROM cliente_obligaciones co
    JOIN obligaciones_catalogo oc ON oc.sub_id = co.catalogo_id
    WHERE co.cliente_id = ?
  `, [clienteId]) as any[]

  const docRegistrados = await queryAll(`SELECT ruta FROM documentos WHERE cliente_id = ?`, [clienteId]) as any[]
  const refsRegistradas = new Set(docRegistrados.map((d: any) => d.ruta))

  // Claves de índice siguen el orden de la ruta: servicio/aspecto/obligacion[/sub_titulo]
  // Índice preciso: servicio/aspecto/obligacion/sub_titulo → UNA sub-obligación exacta
  const indicePreciso     = new Map<string, any>()
  // Índice por servicio: servicio/aspecto/obligacion → subs de ese servicio (fallback)
  const indicePorServicio = new Map<string, any[]>()
  // Índice legado: aspecto/obligacion → todas las subs (fallback sin servicio)
  const indiceSinServicio = new Map<string, any[]>()

  for (const obl of obligaciones) {
    const baseLegado = `${slugify(obl.aspecto)}/${slugify(obl.obligacion)}`

    if (!indiceSinServicio.has(baseLegado)) indiceSinServicio.set(baseLegado, [])
    indiceSinServicio.get(baseLegado)!.push(obl)

    if (obl.servicio) {
      // Nuevo orden: servicio primero
      const keyServ = `${slugify(obl.servicio)}/${slugify(obl.aspecto)}/${slugify(obl.obligacion)}`
      if (!indicePorServicio.has(keyServ)) indicePorServicio.set(keyServ, [])
      indicePorServicio.get(keyServ)!.push(obl)

      if (obl.sub_titulo) {
        const keyPreciso = `${keyServ}/${slugify(obl.sub_titulo)}`
        indicePreciso.set(keyPreciso, obl)
      }
    }
  }

  const reconocidos:   any[] = []
  const noReconocidos: any[] = []

  for (const entrada of entradas) {
    const ref = entrada.ref ?? entrada.ruta
    if (refsRegistradas.has(ref)) continue

    const parsed = parsearRuta(entrada.ruta)
    if (!parsed) {
      noReconocidos.push({ ref, ruta: entrada.ruta, nombre: entrada.nombre, razon: 'Ruta fuera de estructura esperada' })
      continue
    }

    const { aspectoSlug, obligacionSlug, servicioSlug, subTituloSlug, anio, trimestre, nombre } = parsed
    const baseKey = `${aspectoSlug}/${obligacionSlug}`

    let matchedObls: any[]

    if (servicioSlug && subTituloSlug) {
      // Formato preciso: servicio/aspecto/obligacion/sub_titulo → 1 sub-obligación exacta
      const keyPreciso = `${servicioSlug}/${aspectoSlug}/${obligacionSlug}/${subTituloSlug}`
      const obl = indicePreciso.get(keyPreciso)
      matchedObls = obl ? [obl] : []
    } else if (servicioSlug) {
      // Formato servicio: servicio/aspecto/obligacion → todas las subs de ese servicio
      const keyServ = `${servicioSlug}/${aspectoSlug}/${obligacionSlug}`
      matchedObls = indicePorServicio.get(keyServ) ?? []
      if (matchedObls.length === 0) matchedObls = indiceSinServicio.get(baseKey) ?? []
    } else {
      // Formato legado: aspecto/obligacion → todas las sub-obligaciones
      matchedObls = indiceSinServicio.get(baseKey) ?? []
    }

    if (matchedObls.length === 0) {
      noReconocidos.push({ ref, ruta: entrada.ruta, nombre, razon: `Sub-obligación no encontrada: ${servicioSlug ? servicioSlug + '/' : ''}${aspectoSlug}/${obligacionSlug}${subTituloSlug ? '/' + subTituloSlug : ''}` })
      continue
    }

    const first = matchedObls[0]
    reconocidos.push({
      ref, ruta: entrada.ruta, nombre, anio, trimestre,
      aspecto:        first.aspecto,
      obligacion:     first.obligacion,
      sub_titulo:     first.sub_titulo,
      periodicidad:   first.periodicidad,
      servicio:       first.servicio,
      cliente_obl_id: first.cliente_obl_id,
      matches: matchedObls.map(o => ({
        cliente_obl_id: o.cliente_obl_id,
        sub_titulo:     o.sub_titulo,
        servicio:       o.servicio,
      })),
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
      // Determinar a qué sub-obligaciones enlazar: usa matches[] si está disponible
      const targets: { cliente_obl_id: string | null }[] =
        Array.isArray(a.matches) && a.matches.length > 0
          ? a.matches
          : [{ cliente_obl_id: a.cliente_obl_id ?? null }]

      for (const target of targets) {
        const existe = await queryOne(
          'SELECT id FROM documentos WHERE cliente_id = ? AND ruta = ? AND (cliente_obl_id = ? OR (cliente_obl_id IS NULL AND ? IS NULL))',
          [clienteId, a.ref, target.cliente_obl_id, target.cliente_obl_id]
        )
        if (existe) continue
        try {
          const docId = crypto.randomUUID()
          await execute(
            `INSERT INTO documentos (id, cliente_id, cliente_obl_id, nombre_archivo, ruta, anio, trimestre, uploaded_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [docId, clienteId, target.cliente_obl_id ?? null, a.nombre, a.ref, a.anio, a.trimestre ?? null, user.id]
          )
          await execute(
            `INSERT INTO audit_log (id, user_id, user_email, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, 'documento_escaneado', 'documento', ?, ?)`,
            [crypto.randomUUID(), user.id, user.email ?? '', docId, JSON.stringify({ archivo: a.nombre, ref: a.ref, sub_obl: target.cliente_obl_id, via: 'scanner' })]
          )
          importados++
        } catch (e: any) {
          errores.push({ ref: a.ref, error: e.message })
        }
      }
    }

    return NextResponse.json({ ok: true, importados, errores })
  }

  return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })
}
