/**
 * POST /api/superadmin/prospectos-reasignar
 * Reasigna uno o varios prospectos ISP a otro administrador responsable.
 * Body: { ids: string[], responsableId: string }
 * Solo superadmin — individual (ids de longitud 1) o en lote.
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { reasignarProspectos } from '@/lib/prospectos'
import { queryOne } from '@/lib/db'

async function requireSuperadmin() {
  const session = await auth()
  const user = session?.user as any
  return user?.is_superadmin ? user : null
}

export async function POST(req: Request) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const { ids, responsableId } = body ?? {}
  if (!Array.isArray(ids) || ids.length === 0 || !responsableId) {
    return NextResponse.json({ error: 'Faltan campos requeridos: ids (array), responsableId' }, { status: 400 })
  }

  const admin = await queryOne(`SELECT id FROM users WHERE id = ? AND rol = 'admin'`, [responsableId])
  if (!admin) return NextResponse.json({ error: 'responsableId no corresponde a un administrador válido' }, { status: 400 })

  const resultado = await reasignarProspectos(ids, responsableId, user.id)
  return NextResponse.json({ ok: true, ...resultado })
}
