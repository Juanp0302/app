/**
 * GET /api/prospectos/radiografia?id=<prospecto> → descarga la radiografía regulatoria (PDF) de ese prospecto.
 * Un admin solo descarga las de sus prospectos; el superadmin, todas.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { buscarProspecto } from '@/lib/prospectos-db'
import { obtenerRadiografia } from '@/lib/radiografias'

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

  const r = await obtenerRadiografia(id)
  if (!r) return NextResponse.json({ error: 'Este prospecto no tiene radiografía cargada' }, { status: 404 })

  const nombre = `Radiografia_${(prospecto.empresa || 'ISP').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 50)}.pdf`
  return new NextResponse(r.contenido as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
