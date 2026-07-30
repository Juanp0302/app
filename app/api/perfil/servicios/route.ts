/**
 * POST /api/perfil/servicios
 * El cliente elige, una única vez, qué servicios presta. Carga automáticamente
 * las obligaciones correspondientes. Si ya tiene servicios cargados, rechaza
 * el cambio — a partir de ahí solo un admin puede modificarlos.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne, queryAll } from '@/lib/db'
import { asignarServicio } from '@/lib/clientes'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'cliente') return NextResponse.json({ error: 'Solo clientes pueden usar este endpoint' }, { status: 403 })

  const { servicios } = await req.json()
  if (!Array.isArray(servicios) || servicios.length === 0) {
    return NextResponse.json({ error: 'Selecciona al menos un servicio' }, { status: 400 })
  }

  const cliente = await queryOne('SELECT id FROM clientes WHERE user_id = ?', [user.id]) as any
  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const yaTiene = await queryAll('SELECT id FROM cliente_servicios WHERE cliente_id = ?', [cliente.id])
  if (yaTiene.length > 0) {
    return NextResponse.json({ error: 'Ya elegiste tus servicios. Para modificarlos, contacta a un administrador.' }, { status: 409 })
  }

  // Validar que los slugs existan en el catálogo
  const validos = await queryAll('SELECT DISTINCT servicio_slug FROM obligaciones_catalogo WHERE servicio_slug IN (' + servicios.map(() => '?').join(',') + ')', servicios) as any[]
  const slugsValidos = new Set(validos.map(v => v.servicio_slug))
  const desconocidos = servicios.filter((s: string) => !slugsValidos.has(s))
  if (desconocidos.length > 0) {
    return NextResponse.json({ error: `Servicio(s) no reconocido(s): ${desconocidos.join(', ')}` }, { status: 400 })
  }

  let totalObl = 0
  for (const slug of servicios) {
    totalObl += await asignarServicio(cliente.id, slug)
  }

  return NextResponse.json({ ok: true, totalObl })
}
