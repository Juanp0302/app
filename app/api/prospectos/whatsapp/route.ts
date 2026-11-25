/**
 * GET  /api/prospectos/whatsapp?id=xxx  → conversación de WhatsApp del prospecto y si se le puede responder (ventana de 24 h)
 * POST  /api/prospectos/whatsapp         { id, texto, usoBorrador? } → le responde por WhatsApp (lib/whatsapp-ventas.ts)
 * PATCH /api/prospectos/whatsapp         { id, ia: boolean } → la IA vuelve a responderle, o deja de hacerlo
 * Solo su responsable o el superadmin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { buscarProspecto } from '@/lib/prospectos-db'
import { conversacionDelProspecto, responderDesdeLaFicha } from '@/lib/whatsapp-ventas'
import { whatsappConfigurado } from '@/lib/whatsapp-api'
import { cambiarIAdelProspecto } from '@/lib/ia-ventas'

async function prospectoPermitido(id: string | null | undefined) {
  const session = await auth()
  const user = session?.user as any
  if (!user || (user.role !== 'admin' && !user.is_superadmin)) return { error: 'No autorizado', status: 403 } as const
  if (!id) return { error: 'Falta id', status: 400 } as const
  const p = await buscarProspecto(id)
  if (!p) return { error: 'No encontrado', status: 404 } as const
  if (!user.is_superadmin && p.responsable_id !== user.id) return { error: 'Sin acceso', status: 403 } as const
  return { user, p } as const
}

export async function GET(req: NextRequest) {
  const r = await prospectoPermitido(req.nextUrl.searchParams.get('id'))
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
  const c = await conversacionDelProspecto(r.p)
  return NextResponse.json({ ...c, configurado: whatsappConfigurado() })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const r = await prospectoPermitido(body?.id)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
  const res = await responderDesdeLaFicha(r.p, String(body?.texto ?? ''), r.user.id, new Date(), !!body?.usoBorrador)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const r = await prospectoPermitido(body?.id)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
  await cambiarIAdelProspecto(r.p.id, !!body?.ia, r.user.id)
  return NextResponse.json({ ok: true })
}
