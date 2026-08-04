/**
 * GET  /api/superadmin/trazo-cobros   → lista los cobros pendientes de Trazo
 * POST /api/superadmin/trazo-cobros   → confirma manualmente un cobro como
 *                                        pagado y activa la cuenta del cliente
 *
 * Existe porque el webhook de Trazo Cobros todavía no está confirmado
 * (ver docs/trazo-integracion.md, sección 5ter) — mientras tanto, el
 * superadmin verifica el pago por fuera (dashboard de Trazo, banco) y lo
 * confirma aquí para que se envíen usuario/contraseña como de costumbre.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listarCobrosTrazo, confirmarCobroManual, eliminarCobroTrazo } from '@/lib/trazo-cobros-flujo'

async function requireSuperadmin() {
  const session = await auth()
  const user = session?.user as any
  return user?.is_superadmin ? user : null
}

export async function GET() {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const cobros = await listarCobrosTrazo(true)
  return NextResponse.json({ cobros })
}

export async function POST(req: Request) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

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

export async function DELETE(req: NextRequest) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const reference = req.nextUrl.searchParams.get('reference')
  if (!reference) return NextResponse.json({ error: 'Falta reference' }, { status: 400 })

  await eliminarCobroTrazo(reference)
  return NextResponse.json({ ok: true })
}
