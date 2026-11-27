/**
 * GET /api/prospectos/whatsapp/medio?id=<wamid> → el audio, foto o documento que llegó por WhatsApp (para la ficha).
 * Solo el responsable del prospecto o el superadmin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { buscarProspecto } from '@/lib/prospectos-db'
import { medioDelMensaje } from '@/lib/whatsapp-ventas'

export async function GET(req: NextRequest) {
  const session = await auth()
  const user = session?.user as any
  if (!user || (user.role !== 'admin' && !user.is_superadmin)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })
  const m = await medioDelMensaje(id)
  if (!m?.contenido || !m.prospecto_id) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const p = await buscarProspecto(m.prospecto_id)
  if (!p || (!user.is_superadmin && p.responsable_id !== user.id)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  const nombre = (m.nombre ?? 'archivo').replace(/[\/:*?"<>|]/g, '')
  return new NextResponse(new Uint8Array(m.contenido as ArrayBuffer) as unknown as BodyInit, {
    headers: { 'Content-Type': m.mime ?? 'application/octet-stream', 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(nombre)}`, 'Cache-Control': 'private, max-age=3600' },
  })
}
