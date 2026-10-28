/**
 * /api/preguntas
 *   POST    — público. Lo llama la página estática owlcompliance.com/preguntas (otro dominio → CORS).
 *             Guarda la pregunta del lado del servidor y la registra también en Leads.
 *   OPTIONS — preflight de CORS.
 *   GET     — solo superadmin. Lista (JSON) o descarga (?formato=csv). Filtro opcional ?campana=
 *   PATCH   — solo superadmin. { id, estado: 'nueva' | 'seleccionada' | 'respondida' }
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  migratePreguntas, insertarPregunta, listarPreguntas, campanasPreguntas, cambiarEstadoPregunta,
  enviosRecientes, hashIp, preguntasACsv, ESTADOS_PREGUNTA, LIMITE_POR_IP, type EstadoPregunta,
} from '@/lib/preguntas-db'
import { migrateLeads, insertarLead } from '@/lib/leads-db'

/** Origen con el que estas preguntas aparecen en el menú Leads. */
const ORIGEN_LEAD = 'preguntas expoisp'

const ORIGENES_PERMITIDOS = ['https://owlcompliance.com', 'https://www.owlcompliance.com']

function cors(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  const permitido = ORIGENES_PERMITIDOS.includes(origin)
    || /^https:\/\/[a-z0-9-]+--owlcompliance\.netlify\.app$/.test(origin)   // vistas previas de Netlify
    || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)             // pruebas locales de la página
  return permitido
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }
    : { Vary: 'Origin' }
}

function ipDe(req: NextRequest): string {
  return req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'desconocida'
}

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '').slice(0, max)
const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req) })
}

export async function POST(req: NextRequest) {
  const headers = cors(req)
  const responder = (body: object, status = 200) => NextResponse.json(body, { status, headers })

  let b: any
  try { b = await req.json() } catch { return responder({ error: 'Solicitud inválida' }, 400) }

  // Honeypot: los bots llenan el campo oculto. Se responde "ok" para no darles pistas, pero no se guarda.
  if (typeof b._honey === 'string' && b._honey.trim() !== '') return responder({ ok: true })

  const nombre   = texto(b.nombre, 120)
  const empresa  = texto(b.empresa, 160)
  const correo   = texto(b.correo, 160).toLowerCase()
  const celular  = texto(b.celular, 30)
  const pregunta = typeof b.pregunta === 'string' ? b.pregunta.trim().slice(0, 2000) : ''
  const digitos  = celular.replace(/\D/g, '')

  const errores: string[] = []
  if (nombre.length < 2)                         errores.push('nombre')
  if (empresa.length < 2)                        errores.push('empresa')
  if (!CORREO_RE.test(correo))                   errores.push('correo')
  if (digitos.length < 7 || digitos.length > 15) errores.push('celular')
  if (pregunta.length < 5)                       errores.push('pregunta')
  if (b.autorizacion !== true)                   errores.push('autorizacion')
  if (errores.length) return responder({ error: 'Revise los campos marcados', campos: errores }, 400)

  await migratePreguntas()
  const ipHash = hashIp(ipDe(req))
  if (await enviosRecientes(ipHash) >= LIMITE_POR_IP) {
    return responder({ error: 'Se recibieron demasiadas preguntas desde esta conexión. Intente de nuevo en unos minutos.' }, 429)
  }

  const utm = {
    utm_source:   texto(b.utm_source, 100),
    utm_medium:   texto(b.utm_medium, 100),
    utm_campaign: texto(b.utm_campaign, 100),
  }
  const id = await insertarPregunta({ nombre, empresa, celular, correo, pregunta, ...utm, ipHash })

  // También queda como lead (estadística). Si esto falla, la pregunta ya quedó guardada.
  try {
    await migrateLeads()
    await insertarLead({
      origen: ORIGEN_LEAD, nombre, empresa, correo, telefono: celular,
      asunto: 'Pregunta en charla ExpoISP 2026', mensaje: pregunta, ...utm,
      landing_page: '/preguntas', datos: JSON.stringify({ pregunta_id: id }),
    })
  } catch (e) {
    console.error('[preguntas] No se pudo registrar el lead (la pregunta sí se guardó):', e)
  }

  return responder({ ok: true, id })
}

async function esSuperadmin() {
  const session = await auth()
  return !!(session?.user as any)?.is_superadmin
}

export async function GET(req: NextRequest) {
  if (!(await esSuperadmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  await migratePreguntas()

  const { searchParams } = new URL(req.url)
  const campana = searchParams.get('campana') || undefined
  const preguntas = await listarPreguntas(campana)

  if (searchParams.get('formato') === 'csv') {
    const fecha = new Date().toISOString().slice(0, 10)
    return new NextResponse(preguntasACsv(preguntas as any[]), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="preguntas-${campana ?? 'todas'}-${fecha}.csv"`,
      },
    })
  }
  return NextResponse.json({ preguntas, campanas: await campanasPreguntas() })
}

export async function PATCH(req: NextRequest) {
  if (!(await esSuperadmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  let b: any
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 }) }
  const id = Number(b.id)
  if (!Number.isInteger(id) || !ESTADOS_PREGUNTA.includes(b.estado)) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }
  await migratePreguntas()
  const ok = await cambiarEstadoPregunta(id, b.estado as EstadoPregunta)
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Pregunta no encontrada' }, { status: 404 })
}
