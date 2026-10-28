/**
 * POST /api/leads  — recibe un lead desde N8N (webhook)
 * GET  /api/leads  — devuelve lista + estadísticas + embudo (solo superadmin)
 * PATCH /api/leads — { id, etapa?, q_dolor?, q_presupuesto?, q_decision?, plan_objetivo?, proxima_accion?,
 *                      proxima_fecha?, dolor_nota?, motivo_descarte? } (solo superadmin; valida requisitos de etapa)
 *
 * Seguridad POST: N8N debe enviar el header Authorization: Bearer <LEADS_WEBHOOK_SECRET>
 * Si LEADS_WEBHOOK_SECRET no está configurado, se acepta cualquier petición
 * (útil durante desarrollo, pero configure el secreto en producción).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { migrateLeads, insertarLead, obtenerLeads, statsLeads, actualizarPipeline, statsPipeline, obtenerPipeline } from '@/lib/leads-db'

async function requireSuperadmin() {
  const session = await auth()
  const user = session?.user as any
  return user?.is_superadmin ? user : null
}

function verifyWebhookSecret(req: NextRequest): boolean {
  const secret = process.env.LEADS_WEBHOOK_SECRET
  if (!secret) return true   // sin secreto configurado → abierto (solo para dev)
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

/** `datos` puede llegar como objeto o como texto JSON (n8n lo manda como texto). Siempre se guarda como JSON. */
function normalizarDatos(v: unknown): string | undefined {
  if (v == null || v === '') return undefined
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 8000)
  const t = String(v)
  try { JSON.parse(t); return t.slice(0, 8000) } catch { return JSON.stringify({ texto: t.slice(0, 2000) }) }
}

// ── POST: N8N envía el lead ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!verifyWebhookSecret(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  await migrateLeads()

  const id = await insertarLead({
    nombre:       body.nombre       ?? body.name,
    empresa:      body.empresa      ?? body.company,
    correo:       body.correo       ?? body.email,
    asunto:       body.asunto       ?? body.subject,
    mensaje:      body.mensaje      ?? body.message,
    utm_source:   body.utm_source,
    utm_medium:   body.utm_medium,
    utm_campaign: body.utm_campaign,
    utm_term:     body.utm_term,
    utm_content:  body.utm_content,
    landing_page: body.landing_page ?? body.landingPage,
    referrer:     body.referrer,
    origen:       body.origen,
    telefono:     body.telefono ?? body.phone,
    reunion:      body.reunion,
    datos:        normalizarDatos(body.datos),
  })

  return NextResponse.json({ ok: true, id })
}

// ── GET: dashboard superadmin ─────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  await migrateLeads()

  const { searchParams } = new URL(req.url)
  const solo = searchParams.get('solo')

  if (solo === 'stats') {
    const stats = await statsLeads()
    return NextResponse.json(stats)
  }

  // `leads` = cada envío de formulario (análisis, últimos 500); `pipeline.leads` = un lead por contacto, todos.
  const [stats, leads, resumen, principales] = await Promise.all([statsLeads(), obtenerLeads(), statsPipeline(), obtenerPipeline()])
  return NextResponse.json({ stats, leads, pipeline: { ...resumen, leads: principales } })
}

// ── PATCH: mover etapa / calificar (Dolor, Presupuesto, Decisión) ────────────

export async function PATCH(req: NextRequest) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const id = Number(body.id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id inválido' }, { status: 400 })

  await migrateLeads()
  const { id: _omit, ...cambios } = body
  const r = await actualizarPipeline(id, cambios, user.id)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ ok: true })
}
