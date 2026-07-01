/**
 * GET /api/mp/checkout?plan=basico|pro|premium
 * Endpoint PÚBLICO — no requiere login.
 * Crea una suscripción en MP y redirige al checkout.
 */
import { NextRequest, NextResponse } from 'next/server'
import { crearSuscripcion } from '@/lib/mercadopago'
import { PLANES, PlanKey } from '@/lib/suscripcion'

const BASE_URL = 'https://owlcompliance.onrender.com'

export async function GET(req: NextRequest) {
  const planKey = req.nextUrl.searchParams.get('plan') as PlanKey | null

  if (!planKey || !PLANES[planKey]) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }

  try {
    const suscripcion = await crearSuscripcion({
      planKey,
      clienteId: `new:${planKey}`,
      backUrl:   `${BASE_URL}/pago-exitoso`,
    })

    return NextResponse.redirect(suscripcion.init_point)
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    console.error('[mp/checkout] ERROR:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
