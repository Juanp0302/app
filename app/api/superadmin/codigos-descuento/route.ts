/**
 * GET    /api/superadmin/codigos-descuento        → lista todos los códigos
 * POST   /api/superadmin/codigos-descuento        → crea un código nuevo
 * PATCH  /api/superadmin/codigos-descuento        → activa/desactiva un código { id, activo }
 * DELETE /api/superadmin/codigos-descuento?id=xxx → elimina un código
 *
 * Solo superadmin. Ver docs/trazo-integracion.md para el contexto de la
 * pasarela de pagos — el descuento se aplica sobre el precio del plan antes
 * de generar el enlace/cobro, sin importar cuál pasarela esté activa.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  crearCodigoDescuento,
  listarCodigosDescuento,
  toggleCodigoDescuento,
  eliminarCodigoDescuento,
} from '@/lib/codigos-descuento'

async function requireSuperadmin() {
  const session = await auth()
  const user = session?.user as any
  return user?.is_superadmin ? user : null
}

export async function GET() {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const codigos = await listarCodigosDescuento()
  return NextResponse.json({ codigos })
}

export async function POST(req: NextRequest) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const { codigo, tipo, valor, plan, usosMaximos, vigenteHasta } = body ?? {}

  if (!codigo || !tipo || valor === undefined || valor === null) {
    return NextResponse.json({ error: 'Faltan campos requeridos: codigo, tipo, valor' }, { status: 400 })
  }

  try {
    const creado = await crearCodigoDescuento({
      codigo,
      tipo,
      valor: Number(valor),
      plan: plan || null,
      usosMaximos: usosMaximos ? Number(usosMaximos) : null,
      vigenteHasta: vigenteHasta || null,
      creadoPor: user.email ?? null,
    })
    return NextResponse.json({ ok: true, codigo: creado }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Error creando el código' }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const { id, activo } = body ?? {}
  if (!id || activo === undefined) {
    return NextResponse.json({ error: 'Faltan campos requeridos: id, activo' }, { status: 400 })
  }

  await toggleCodigoDescuento(id, Boolean(activo))
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  await eliminarCodigoDescuento(id)
  return NextResponse.json({ ok: true })
}
