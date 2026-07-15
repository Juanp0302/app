/**
 * POST /api/mp/checkout
 * Endpoint PÚBLICO — no requiere login.
 * Recibe { plan, email, nombre }, crea suscripción en MP y devuelve init_point.
 */
import { NextRequest, NextResponse } from 'next/server'
import { PLANES, PlanKey } from '@/lib/suscripcion'

const BASE_URL = 'https://owlcompliance.onrender.com'

export async function POST(req: NextRequest) {
  const body    = await req.json()
  const planKey = body.plan   as PlanKey | null
  const email   = body.email  as string  | null

  if (!planKey || !PLANES[planKey]) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }
  if (!email) {
    return NextResponse.json({ error: 'El correo es requerido' }, { status: 400 })
  }

  const plan = PLANES[planKey]

  // Redirige directo al checkout del plan en MP.
  // MP cobra y notifica por webhook — no necesitamos crear el preapproval desde el servidor.
  const params = new URLSearchParams({
    preapproval_plan_id: plan.mp_plan_id,
    payer_email:         email,
    back_url:            `${BASE_URL}/pago-exitoso`,
    external_reference:  `${planKey}:${email}`,
  })

  const init_point = `https://www.mercadopago.com.co/subscriptions/checkout?${params.toString()}`

  return NextResponse.json({ init_point })
}
