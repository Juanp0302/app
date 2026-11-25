/**
 * GET /api/prospectos/retomar?id=xxx → lo necesario para retomar la conversación (lib/retomar.ts). Su responsable o el superadmin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { buscarProspecto } from '@/lib/prospectos-db'
import { paraRetomar } from '@/lib/retomar'

export async function GET(req: NextRequest) {
  const session = await auth()
  const user = session?.user as any
  if (!user || (user.role !== 'admin' && !user.is_superadmin)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })
  const p = await buscarProspecto(id)
  if (!p) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (!user.is_superadmin && p.responsable_id !== user.id) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  return NextResponse.json(await paraRetomar(p))
}
