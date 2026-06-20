import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne, queryAll, execute } from '@/lib/db'
import crypto from 'crypto'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const user = session.user as any

  let resolvedClienteId = req.nextUrl.searchParams.get('clienteId')
  if (user.role === 'cliente') {
    const c = await queryOne('SELECT id FROM clientes WHERE user_id = ?', [user.id])
    if (!c) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    resolvedClienteId = (c as any).id
  }
  if (!resolvedClienteId) return NextResponse.json({ error: 'clienteId requerido' }, { status: 400 })

  const cliente  = await queryOne('SELECT id, razon_social, nit FROM clientes WHERE id = ?', [resolvedClienteId])
  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const serviciosRows = await queryAll('SELECT servicio FROM cliente_servicios WHERE cliente_id = ? AND activo = 1', [resolvedClienteId])
  const servicios = serviciosRows.map((r: any) => r.servicio)

  const filas = await queryAll(`
    SELECT co.id AS obl_id, co.estado, co.fecha_limite, co.updated_at,
           oc.sub_id, oc.id AS cat_obl_id, oc.aspecto, oc.grupo, oc.obligacion,
           oc.descripcion, oc.sub_titulo, oc.periodicidad, oc.servicio, oc.normatividad
    FROM cliente_obligaciones co
    JOIN obligaciones_catalogo oc ON oc.sub_id = co.catalogo_id
    WHERE co.cliente_id = ?
    ORDER BY oc.aspecto, oc.grupo, oc.obligacion, oc.sub_id
  `, [resolvedClienteId])

  const aspectoMap: Record<string, any> = {}
  for (const fila of filas as any[]) {
    if (!aspectoMap[fila.aspecto]) aspectoMap[fila.aspecto] = { nombre: fila.aspecto, grupos: {}, stats: { total: 0, cumplidas: 0, vencidas: 0, pendientes: 0 } }
    const asp = aspectoMap[fila.aspecto]
    if (!asp.grupos[fila.grupo]) asp.grupos[fila.grupo] = { nombre: fila.grupo, obligaciones: {} }
    const grp = asp.grupos[fila.grupo]
    if (!grp.obligaciones[fila.obligacion]) grp.obligaciones[fila.obligacion] = { nombre: fila.obligacion, descripcion: fila.descripcion, servicio: fila.servicio, subs: [] }
    grp.obligaciones[fila.obligacion].subs.push({ obl_id: fila.obl_id, sub_titulo: fila.sub_titulo, periodicidad: fila.periodicidad, estado: fila.estado, fecha_limite: fila.fecha_limite, updated_at: fila.updated_at, normatividad: JSON.parse(fila.normatividad || '[]') })
    asp.stats.total++
    if (fila.estado === 'cumplida')  asp.stats.cumplidas++
    if (fila.estado === 'vencida')   asp.stats.vencidas++
    if (fila.estado === 'pendiente' || fila.estado === 'en_progreso') asp.stats.pendientes++
  }

  const aspectos = Object.values(aspectoMap).map((asp: any) => ({
    ...asp,
    pct: asp.stats.total ? Math.round((asp.stats.cumplidas / asp.stats.total) * 100) : 0,
    grupos: Object.values(asp.grupos).map((grp: any) => ({ ...grp, obligaciones: Object.values(grp.obligaciones) })),
  }))

  const totalStats = (filas as any[]).reduce((acc, f) => {
    acc.total++
    if (f.estado === 'cumplida')  acc.cumplidas++
    if (f.estado === 'vencida')   acc.vencidas++
    if (f.estado === 'pendiente' || f.estado === 'en_progreso') acc.pendientes++
    return acc
  }, { total: 0, cumplidas: 0, vencidas: 0, pendientes: 0 })

  return NextResponse.json({ cliente, servicios, aspectos, stats: { ...totalStats, pct: totalStats.total ? Math.round((totalStats.cumplidas / totalStats.total) * 100) : 0 } })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const user = session.user as any
  const { oblId, estado } = await req.json()

  const estadosValidos = ['pendiente', 'en_progreso', 'cumplida', 'vencida', 'no_aplica']
  if (!estadosValidos.includes(estado)) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })

  const obl = await queryOne('SELECT co.*, c.user_id FROM cliente_obligaciones co JOIN clientes c ON c.id = co.cliente_id WHERE co.id = ?', [oblId])
  if (!obl) return NextResponse.json({ error: 'Obligación no encontrada' }, { status: 404 })
  if (user.role === 'cliente' && (obl as any).user_id !== user.id) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  await execute(`UPDATE cliente_obligaciones SET estado = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?`, [estado, user.id, oblId])
  await execute(`INSERT INTO audit_log (id, user_id, user_email, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, 'estado_cambiado', 'obligacion', ?, ?)`,
    [crypto.randomUUID(), user.id, user.email ?? '', oblId, JSON.stringify({ antes: (obl as any).estado, despues: estado })])

  return NextResponse.json({ ok: true, estado })
}
