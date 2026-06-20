/**
 * GET  /api/obligaciones?clienteId=xxx
 *   Devuelve las obligaciones de un cliente agrupadas por aspecto.
 *
 * PATCH /api/obligaciones
 *   Body: { oblId, estado }
 *   Actualiza el estado de una subobligación y registra en auditoría.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import crypto from 'crypto'

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const user      = session.user as any
  const clienteId = req.nextUrl.searchParams.get('clienteId')

  // Si es cliente, solo puede ver sus propias obligaciones
  let resolvedClienteId = clienteId
  if (user.role === 'cliente') {
    const cliente = db.prepare('SELECT id FROM clientes WHERE user_id = ?').get(user.id) as any
    if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    resolvedClienteId = cliente.id
  }

  if (!resolvedClienteId) {
    return NextResponse.json({ error: 'clienteId requerido' }, { status: 400 })
  }

  // Datos del cliente
  const cliente = db.prepare(`
    SELECT c.id, c.razon_social, c.nit
    FROM clientes c WHERE c.id = ?
  `).get(resolvedClienteId) as any

  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  // Servicios del cliente
  const servicios = (db.prepare(
    'SELECT servicio FROM cliente_servicios WHERE cliente_id = ? AND activo = 1'
  ).all(resolvedClienteId) as any[]).map(r => r.servicio)

  // Todas sus obligaciones con info del catálogo
  const filas = db.prepare(`
    SELECT
      co.id          AS obl_id,
      co.estado,
      co.fecha_limite,
      co.updated_at,
      oc.sub_id,
      oc.id          AS cat_obl_id,
      oc.aspecto,
      oc.grupo,
      oc.obligacion,
      oc.descripcion,
      oc.sub_titulo,
      oc.periodicidad,
      oc.servicio,
      oc.normatividad
    FROM cliente_obligaciones co
    JOIN obligaciones_catalogo oc ON oc.sub_id = co.catalogo_id
    WHERE co.cliente_id = ?
    ORDER BY oc.aspecto, oc.grupo, oc.obligacion, oc.sub_id
  `).all(resolvedClienteId) as any[]

  // ── Agrupar por aspecto → grupo → obligación → subobligaciones ──────────────
  const aspectoMap: Record<string, any> = {}

  for (const fila of filas) {
    // Aspecto
    if (!aspectoMap[fila.aspecto]) {
      aspectoMap[fila.aspecto] = { nombre: fila.aspecto, grupos: {}, stats: { total: 0, cumplidas: 0, vencidas: 0, pendientes: 0 } }
    }
    const asp = aspectoMap[fila.aspecto]

    // Grupo
    if (!asp.grupos[fila.grupo]) {
      asp.grupos[fila.grupo] = { nombre: fila.grupo, obligaciones: {} }
    }
    const grp = asp.grupos[fila.grupo]

    // Obligación
    if (!grp.obligaciones[fila.obligacion]) {
      grp.obligaciones[fila.obligacion] = {
        nombre:      fila.obligacion,
        descripcion: fila.descripcion,
        servicio:    fila.servicio,
        subs:        [],
      }
    }

    // Subobligación
    grp.obligaciones[fila.obligacion].subs.push({
      obl_id:      fila.obl_id,
      sub_titulo:  fila.sub_titulo,
      periodicidad: fila.periodicidad,
      estado:      fila.estado,
      fecha_limite: fila.fecha_limite,
      updated_at:  fila.updated_at,
      normatividad: JSON.parse(fila.normatividad || '[]'),
    })

    // Estadísticas por aspecto
    asp.stats.total++
    if (fila.estado === 'cumplida')  asp.stats.cumplidas++
    if (fila.estado === 'vencida')   asp.stats.vencidas++
    if (fila.estado === 'pendiente' || fila.estado === 'en_progreso') asp.stats.pendientes++
  }

  // Convertir mapas a arrays
  const aspectos = Object.values(aspectoMap).map((asp: any) => ({
    ...asp,
    pct: asp.stats.total ? Math.round((asp.stats.cumplidas / asp.stats.total) * 100) : 0,
    grupos: Object.values(asp.grupos).map((grp: any) => ({
      ...grp,
      obligaciones: Object.values(grp.obligaciones),
    })),
  }))

  // Totales generales
  const totalStats = filas.reduce((acc, f) => {
    acc.total++
    if (f.estado === 'cumplida')  acc.cumplidas++
    if (f.estado === 'vencida')   acc.vencidas++
    if (f.estado === 'pendiente' || f.estado === 'en_progreso') acc.pendientes++
    return acc
  }, { total: 0, cumplidas: 0, vencidas: 0, pendientes: 0 })

  return NextResponse.json({
    cliente,
    servicios,
    aspectos,
    stats: {
      ...totalStats,
      pct: totalStats.total ? Math.round((totalStats.cumplidas / totalStats.total) * 100) : 0,
    },
  })
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const user = session.user as any
  const { oblId, estado } = await req.json()

  const estadosValidos = ['pendiente', 'en_progreso', 'cumplida', 'vencida', 'no_aplica']
  if (!estadosValidos.includes(estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  // Verificar que la obligación exista y el usuario tenga acceso
  const obl = db.prepare(`
    SELECT co.*, c.user_id
    FROM cliente_obligaciones co
    JOIN clientes c ON c.id = co.cliente_id
    WHERE co.id = ?
  `).get(oblId) as any

  if (!obl) return NextResponse.json({ error: 'Obligación no encontrada' }, { status: 404 })
  if (user.role === 'cliente' && obl.user_id !== user.id) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  const estadoAnterior = obl.estado

  // Actualizar
  db.prepare(`
    UPDATE cliente_obligaciones
    SET estado = ?, updated_by = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(estado, user.id, oblId)

  // Bitácora
  db.prepare(`
    INSERT INTO audit_log (id, user_id, user_email, accion, entidad, entidad_id, detalle)
    VALUES (?, ?, ?, 'estado_cambiado', 'obligacion', ?, ?)
  `).run(
    crypto.randomUUID(),
    user.id,
    user.email ?? '',
    oblId,
    JSON.stringify({ antes: estadoAnterior, despues: estado })
  )

  return NextResponse.json({ ok: true, estado })
}
