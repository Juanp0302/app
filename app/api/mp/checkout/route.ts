/**
 * POST /api/mp/checkout
 * Endpoint PÚBLICO — no requiere login.
 * Recibe { plan, email }, devuelve init_point de checkout de suscripción MP.
 */
import { NextRequest, NextResponse } from 'next/server'
import { PLANES, PlanKey } from '@/lib/suscripcion'

const BASE_URL = 'https://owlcompliance.onrender.com'

export async function POST(req: NextRequest) {
  const body    = await req.json()
  const planKey = body.plan  as PlanKey | null
  const email   = body.email as string  | null

  if (!planKey || !PLANES[planKey]) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }
  if (!email) {
    return NextResponse.json({ error: 'El correo es requerido' }, { status: 400 })
  }

  const plan    = PLANES[planKey]
  const isTest  = process.env.MP_ACCESS_TOKEN?.startsWith('TEST-') ?? false

  // En producción se pasa payer_email para pre-llenar el checkout.
  // En modo prueba se omite para evitar el error "una de las partes es de prueba"
  // cuando el email del cliente no es una cuenta de prueba de MP.
  const params = new URLSearchParams({
    preapproval_plan_id: plan.mp_plan_id,
    back_url:            `${BASE_URL}/pago-exitoso`,
    external_reference:  `${planKey}:${email}`,
  })

  if (!isTest) {
    params.set('payer_email', email)
  }

  const init_point = `https://www.mercadopago.com.co/subscriptions/checkout?${params.toString()}`

  return NextResponse.json({ init_point })
}
