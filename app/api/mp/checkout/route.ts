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
      // external_reference con prefijo "new:" indica que aún no hay cuenta creada
      clienteId:  `new:${planKey}`,
      // MP pedirá el email al pagador durante el checkout
      payerEmail: `nuevocliente+${planKey}@owlcompliance.co`,
      backUrl:    `${BASE_URL}/pago-exitoso`,
    })

    return NextResponse.redirect(suscripcion.init_point)
  } catch (err: any) {
    console.error('[mp/checkout]', err?.message ?? err)
    return NextResponse.redirect(`${BASE_URL}/pago-exitoso?error=1`)
  }
}
