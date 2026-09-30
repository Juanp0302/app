/**
 * GET /api/prospectos/historial?id=xxx → historial de cambios de estado de un prospecto
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { buscarProspecto } from '@/lib/prospectos-db'
import { listarHistorial } from '@/lib/prospectos'

export async function GET(req: NextRequest) {
  const session = await auth()
  const user = session?.user as any
  if (!user || (user.role !== 'admin' && !user.is_superadmin)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const prospecto = await buscarProspecto(id)
  if (!prospecto) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (!user.is_superadmin && prospecto.responsable_id !== user.id) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  const historial = await listarHistorial(id)
  return NextResponse.json({ historial })
}
