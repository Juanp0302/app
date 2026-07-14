/**
 * POST /api/leads  — recibe un lead desde N8N (webhook)
 * GET  /api/leads  — devuelve lista + estadísticas (solo superadmin)
 *
 * Seguridad POST: N8N debe enviar el header Authorization: Bearer <LEADS_WEBHOOK_SECRET>
 * Si LEADS_WEBHOOK_SECRET no está configurado, se acepta cualquier petición
 * (útil durante desarrollo, pero configure el secreto en producción).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { migrateLeads, insertarLead, obtenerLeads, statsLeads } from '@/lib/leads-db'

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

  const [stats, leads] = await Promise.all([statsLeads(), obtenerLeads()])
  return NextResponse.json({ stats, leads })
}
