/**
 * POST /api/superadmin/cortesias
 * Crea una cuenta de cliente nueva en modalidad de cortesía (sin pasar por
 * Trazo/Wompi): misma activación y correo de bienvenida que un cliente que
 * paga, marcada como cortesía y con vencimiento a los N meses. Al vencer,
 * el cron de /api/interno/cortesias-vencidas la suspende automáticamente.
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { crearCortesia } from '@/lib/cortesias'
import type { PlanKey } from '@/lib/suscripcion'

async function requireSuperadmin() {
  const session = await auth()
  const user = session?.user as any
  return user?.is_superadmin ? user : null
}

export async function POST(req: Request) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const { razon_social, email, nit, contacto, plan, meses } = body ?? {}

  if (!razon_social?.trim() || !email?.trim() || !plan || !meses) {
    return NextResponse.json({ error: 'Faltan campos requeridos: razon_social, email, plan, meses' }, { status: 400 })
  }

  try {
    const resultado = await crearCortesia({
      razon_social: razon_social.trim(),
      email:        email.trim(),
      nit:          nit?.trim() || undefined,
      contacto:     contacto?.trim() || undefined,
      plan:         plan as PlanKey,
      meses:        Number(meses),
    })
    return NextResponse.json({ ok: true, ...resultado })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Error creando la cortesía' }, { status: 400 })
  }
}
