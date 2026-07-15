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

  // Crea el preapproval vía API para obtener un init_point válido en test y producción
  const mpToken = process.env.MP_ACCESS_TOKEN
  if (!mpToken) return NextResponse.json({ error: 'MP no configurado' }, { status: 500 })

  const body: Record<string, any> = {
    preapproval_plan_id: plan.mp_plan_id,
    reason:              `Owl Compliance — Plan ${plan.label}`,
    external_reference:  `${planKey}:${email}`,
    back_url:            `${BASE_URL}/pago-exitoso`,
    payer_email:         email,
  }

  const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${mpToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!mpRes.ok) {
    const err = await mpRes.text()
    console.error('[mp/checkout] Error MP:', err)
    return NextResponse.json({ error: 'Error creando suscripción: ' + err }, { status: 500 })
  }

  const data       = await mpRes.json()
  const init_point = data.init_point

  return NextResponse.json({ init_point })
}
