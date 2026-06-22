/**
 * GET /api/superadmin/exportar?tipo=clientes|admins
 * Descarga un CSV con estadísticas de clientes o de administradores.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryAll } from '@/lib/db'

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function toRow(cols: any[]): string {
  return cols.map(escapeCsv).join(',')
}

export async function GET(req: NextRequest) {
  const session = await auth()
  const user = session?.user as any
  if (!user?.is_superadmin)
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const tipo = req.nextUrl.searchParams.get('tipo') ?? 'clientes'

  let csv = ''
  let filename = ''

  if (tipo === 'admins') {
    // ── Estadísticas por administrador ──────────────────────────────────────
    filename = `estadisticas_admins_${new Date().toISOString().slice(0, 10)}.csv`

    const admins = await queryAll(
      `SELECT id, nombre, email FROM users WHERE rol = 'admin' AND activo = 1 ORDER BY nombre`
    ) as any[]

    const ticketStats = await queryAll(
      `SELECT t.admin_id,
              COUNT(*)                                                  AS total,
              SUM(CASE WHEN t.estado='abierto'     THEN 1 ELSE 0 END)  AS abiertos,
              SUM(CASE WHEN t.estado='en_progreso' THEN 1 ELSE 0 END)  AS en_progreso,
              SUM(CASE WHEN t.estado='resuelto'    THEN 1 ELSE 0 END)  AS resueltos,
              SUM(CASE WHEN t.estado='cerrado'     THEN 1 ELSE 0 END)  AS cerrados,
              SUM(CASE WHEN t.prioridad='urgente'  THEN 1 ELSE 0 END)  AS urgentes
       FROM tickets t GROUP BY t.admin_id`
    ) as any[]

    const chatStats = await queryAll(
      `SELECT c.admin_id,
              COUNT(*)                                                 AS total,
              SUM(CASE WHEN c.estado='activa'  THEN 1 ELSE 0 END)     AS activas,
              SUM(CASE WHEN c.estado='cerrada' THEN 1 ELSE 0 END)     AS cerradas
       FROM conversaciones c GROUP BY c.admin_id`
    ) as any[]

    const tMap: Record<string, any> = {}
    for (const r of ticketStats) tMap[r.admin_id ?? ''] = r
    const cMap: Record<string, any> = {}
    for (const r of chatStats) cMap[r.admin_id ?? ''] = r

    const header = [
      'Nombre', 'Email',
      'Tickets total', 'Tickets abiertos', 'Tickets en progreso',
      'Tickets resueltos', 'Tickets cerrados', 'Tickets urgentes',
      'Chats total', 'Chats activos', 'Chats cerrados',
    ]
    const rows = [header.join(',')]

    for (const a of admins) {
      const t = tMap[a.id] ?? { total:0, abiertos:0, en_progreso:0, resueltos:0, cerrados:0, urgentes:0 }
      const c = cMap[a.id] ?? { total:0, activas:0, cerradas:0 }
      rows.push(toRow([
        a.nombre, a.email,
        t.total, t.abiertos, t.en_progreso, t.resueltos, t.cerrados, t.urgentes,
        c.total, c.activas, c.cerradas,
      ]))
    }
    csv = rows.join('\r\n')

  } else {
    // ── Estadísticas por cliente ─────────────────────────────────────────────
    filename = `estadisticas_clientes_${new Date().toISOString().slice(0, 10)}.csv`

    const clientes = await queryAll(
      `SELECT c.id, c.razon_social, c.nit, c.contacto, c.email, c.telefono,
              u.email AS user_email, u.nombre AS user_nombre,
              COUNT(DISTINCT cs.servicio) AS num_servicios,
              COUNT(co.id)               AS total_obl,
              SUM(CASE WHEN co.estado='cumplida'    THEN 1 ELSE 0 END) AS cumplidas,
              SUM(CASE WHEN co.estado='en_progreso' THEN 1 ELSE 0 END) AS en_progreso,
              SUM(CASE WHEN co.estado='vencida'     THEN 1 ELSE 0 END) AS vencidas,
              SUM(CASE WHEN co.estado='pendiente'   THEN 1 ELSE 0 END) AS pendientes
       FROM clientes c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN cliente_servicios cs ON cs.cliente_id = c.id AND cs.activo = 1
       LEFT JOIN cliente_obligaciones co ON co.cliente_id = c.id
       WHERE c.activo = 1
       GROUP BY c.id
       ORDER BY c.razon_social`
    ) as any[]

    const header = [
      'Razón social', 'NIT', 'Contacto', 'Email empresa', 'Teléfono',
      'Email usuario', 'Nombre usuario', 'Servicios',
      'Total obligaciones', 'Cumplidas', 'En progreso', 'Vencidas', 'Pendientes',
      '% Cumplimiento',
    ]
    const rows = [header.join(',')]

    for (const c of clientes) {
      const pct = c.total_obl > 0
        ? Math.round((c.cumplidas / c.total_obl) * 100)
        : 0
      rows.push(toRow([
        c.razon_social, c.nit, c.contacto, c.email, c.telefono,
        c.user_email, c.user_nombre, c.num_servicios,
        c.total_obl, c.cumplidas, c.en_progreso, c.vencidas, c.pendientes,
        `${pct}%`,
      ]))
    }
    csv = rows.join('\r\n')
  }

  // BOM UTF-8 para que Excel abra correctamente los caracteres españoles
  const bom = '﻿'
  return new NextResponse(bom + csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
