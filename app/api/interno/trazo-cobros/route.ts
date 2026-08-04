/**
 * GET  /api/interno/trazo-cobros            → lista cobros pendientes (opcional ?email=)
 * POST /api/interno/trazo-cobros            → confirma un cobro pagado y activa la cuenta
 *
 * Endpoint interno, NO expuesto en ninguna pantalla del producto. Existe
 * para que Claude (o quien tenga el INTERNAL_SECRET) confirme manualmente un
 * pago de Trazo Cobros mientras el webhook de ese módulo no esté registrado
 * (ver docs/trazo-integracion.md, sección 5ter). El webhook automático
 * (/api/webhooks/trazo-cobros) sigue funcionando igual — esto es solo un
 * atajo mientras tanto, no un reemplazo.
 *
 * Auth: Authorization: Bearer INTERNAL_SECRET (mismo secreto que ya usa
 * /api/superadmin/auto-cuentas-cobro).
 */
import { NextRequest, NextResponse } from 'next/server'
import { listarCobrosTrazo, confirmarCobroManual } from '@/lib/trazo-cobros-flujo'

function autorizado(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_SECRET
  const auth   = req.headers.get('authorization')
  return Boolean(secret) && auth === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const email = req.nextUrl.searchParams.get('email')?.toLowerCase().trim()
  const cobros = await listarCobrosTrazo(true)
  const filtrados = email ? cobros.filter(c => c.cliente_email.toLowerCase() === email) : cobros

  return NextResponse.json({ cobros: filtrados })
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const reference = body?.reference
  if (!reference) return NextResponse.json({ error: 'Falta reference' }, { status: 400 })

  try {
    const resultado = await confirmarCobroManual(reference)
    return NextResponse.json({ ok: true, ...resultado })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Error confirmando el cobro' }, { status: 400 })
  }
}
