/**
 * POST /api/mp/checkout
 * Endpoint PÚBLICO — no requiere login.
 * Recibe { plan, email, nombre }, crea suscripción en MP y devuelve init_point.
 */
import { NextRequest, NextResponse } from 'next/server'
import { crearSuscripcion } from '@/lib/mercadopago'
import { PLANES, PlanKey } from '@/lib/suscripcion'

const BASE_URL = 'https://owlcompliance.onrender.com'

export async function POST(req: NextRequest) {
  const body    = await req.json()
  const planKey = body.plan   as PlanKey | null
  const email   = body.email  as string  | null
  const nombre  = body.nombre as string  | null

  if (!planKey || !PLANES[planKey]) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }
  if (!email) {
    return NextResponse.json({ error: 'El correo es requerido' }, { status: 400 })
  }

  try {
    const suscripcion = await crearSuscripcion({
      planKey,
      clienteId:  `new:${planKey}:${email}`,
      payerEmail: email,
      backUrl:    `${BASE_URL}/pago-exitoso`,
    })

    return NextResponse.json({ init_point: suscripcion.init_point })
  } catch (err: any) {
    console.error('[mp/checkout]', err?.message ?? err)
    return NextResponse.json({ error: 'Error al conectar con Mercado Pago. Intenta nuevamente.' }, { status: 500 })
  }
}
