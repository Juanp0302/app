/**
 * GET /api/documentos/revisiones
 * Lista documentos pendientes de revisión.
 * - Admin: todos los pendientes de todos los clientes
 * - Superadmin: ídem
 * - Cliente: solo los suyos (pendientes + rechazados para que pueda re-subir)
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { listarPendientesRevision } from '@/lib/documentos'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const user = session.user as any

  if (user.role === 'cliente') {
    const c = await queryOne('SELECT id FROM clientes WHERE user_id = ?', [user.id])
    if (!c) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    const docs = await listarPendientesRevision((c as any).id)
    return NextResponse.json(docs)
  }

  // Admin / superadmin: todos los pendientes
  const docs = await listarPendientesRevision()
  return NextResponse.json(docs)
}
