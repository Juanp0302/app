/**
 * GET   /api/prospectos          → lista los prospectos visibles (admin: los suyos; superadmin: los 200)
 * PATCH /api/prospectos          → actualiza estado/fecha de contacto/próximo paso/notas de un prospecto
 *
 * Ver docs/prospectos-isp.md — estrategia de contacto uno a uno para 200 ISPs.
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prospectosVisiblesPara, resumenPorEstado, actualizarProspectoComoUsuario } from '@/lib/prospectos'

async function requireAdminOrSuperadmin() {
  const session = await auth()
  const user = session?.user as any
  if (!user) return null
  if (user.role !== 'admin' && !user.is_superadmin) return null
  return user
}

export async function GET() {
  const user = await requireAdminOrSuperadmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const [prospectos, resumen] = await Promise.all([
    prospectosVisiblesPara(user),
    resumenPorEstado(user),
  ])
  return NextResponse.json({ prospectos, resumen })
}

export async function PATCH(req: Request) {
  const user = await requireAdminOrSuperadmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const { id, estado, fecha_contacto, proximo_paso, notas } = body ?? {}
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const resultado = await actualizarProspectoComoUsuario(user, id, { estado, fecha_contacto, proximo_paso, notas })
  if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: resultado.status })

  return NextResponse.json({ ok: true })
}
