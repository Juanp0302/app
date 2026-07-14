import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne, execute } from '@/lib/db'
import { crearSuscripcion } from '@/lib/mercadopago'
import { migrateSuscripcion, PLANES, PlanKey } from '@/lib/suscripcion'

const BASE_URL = process.env.NEXTAUTH_URL?.replace('localhost:3000', 'owlcompliance.onrender.com') ?? 'https://owlcompliance.onrender.com'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'cliente') {
    return NextResponse.json({ error: 'Solo los clientes pueden suscribirse' }, { status: 403 })
  }

  const body = await req.json()
  const planKey = body.plan as PlanKey

  if (!planKey || !PLANES[planKey]) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }

  await migrateSuscripcion()

  // Obtener cliente
  const cliente = await queryOne(
    `SELECT c.id, c.mp_subscription_id, c.suscripcion_estado, u.email
     FROM clientes c JOIN users u ON u.id = c.user_id
     WHERE c.user_id = ?`,
    [user.id]
  ) as any

  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  // Si ya tiene suscripción activa con MP, no crear otra
  if (cliente.mp_subscription_id && cliente.suscripcion_estado === 'activa') {
    return NextResponse.json({ error: 'Ya tienes una suscripción activa', estado: 'activa' }, { status: 409 })
  }

  // Crear la suscripción en Mercado Pago
  let suscripcion
  try {
    suscripcion = await crearSuscripcion({
      planKey,
      clienteId:  cliente.id,
      payerEmail: user.email ?? cliente.email,
      backUrl:    `${BASE_URL}/dashboard/suscripcion?mp=ok`,
    })
  } catch (err: any) {
    const detalle = err?.message ?? String(err)
    console.error('[mp/suscribir] Error MP:', detalle)
    return NextResponse.json(
      { error: `Error Mercado Pago: ${detalle}` },
      { status: 502 }
    )
  }

  // Guardar ID de MP y plan elegido (aún no activo, esperamos webhook)
  await execute(
    `UPDATE clientes SET mp_subscription_id = ?, plan = ?, suscripcion_estado = 'trial' WHERE id = ?`,
    [suscripcion.id, planKey, cliente.id]
  )

  return NextResponse.json({ init_point: suscripcion.init_point })
}
