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

function fmtHoras(h: number | null | undefined): string {
  if (h === null || h === undefined || isNaN(Number(h))) return '—'
  const n = Number(h)
  if (n < 1)  return `${Math.round(n * 60)} min`
  if (n < 24) return `${Math.round(n)} h`
  return `${(n / 24).toFixed(1)} días`
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

    const ticketTiempos = await queryAll(
      `SELECT t.admin_id,
              AVG((JULIANDAY(pr.created_at) - JULIANDAY(t.created_at)) * 24) AS avg_horas
       FROM tickets t
       JOIN (
         SELECT r.ticket_id, MIN(r.created_at) AS created_at
         FROM ticket_respuestas r
         JOIN users u ON u.id = r.user_id AND u.rol = 'admin'
         GROUP BY r.ticket_id
       ) pr ON pr.ticket_id = t.id
       WHERE t.admin_id IS NOT NULL
       GROUP BY t.admin_id`
    ) as any[]

    const chatStats = await queryAll(
      `SELECT c.admin_id,
              COUNT(*)                                                 AS total,
              SUM(CASE WHEN c.estado='activa'  THEN 1 ELSE 0 END)     AS activas,
              SUM(CASE WHEN c.estado='cerrada' THEN 1 ELSE 0 END)     AS cerradas
       FROM conversaciones c GROUP BY c.admin_id`
    ) as any[]

    const chatTiempos = await queryAll(
      `SELECT c.admin_id,
              AVG((JULIANDAY(pm.created_at) - JULIANDAY(c.created_at)) * 24) AS avg_horas
       FROM conversaciones c
       JOIN (
         SELECT m.conversacion_id, MIN(m.created_at) AS created_at
         FROM mensajes m
         JOIN users u ON u.id = m.user_id AND u.rol = 'admin'
         GROUP BY m.conversacion_id
       ) pm ON pm.conversacion_id = c.id
       WHERE c.admin_id IS NOT NULL
       GROUP BY c.admin_id`
    ) as any[]

    const tMap:  Record<string, any> = {}
    for (const r of ticketStats)   tMap[r.admin_id ?? '']  = r
    const cMap:  Record<string, any> = {}
    for (const r of chatStats)     cMap[r.admin_id ?? '']  = r
    const ttMap: Record<string, number | null> = {}
    for (const r of ticketTiempos) ttMap[r.admin_id ?? ''] = r.avg_horas
    const ctMap: Record<string, number | null> = {}
    for (const r of chatTiempos)   ctMap[r.admin_id ?? ''] = r.avg_horas

    const header = [
      'Nombre', 'Email',
      'Tickets total', 'Tickets abiertos', 'Tickets en progreso',
      'Tickets resueltos', 'Tickets cerrados', 'Tickets urgentes',
      'Tiempo resp. tickets (promedio)',
      'Chats total', 'Chats activos', 'Chats cerrados',
      'Tiempo resp. chats (promedio)',
    ]
    const rows = [header.join(',')]

    for (const a of admins) {
      const t = tMap[a.id] ?? { total:0, abiertos:0, en_progreso:0, resueltos:0, cerrados:0, urgentes:0 }
      const c = cMap[a.id] ?? { total:0, activas:0, cerradas:0 }
      rows.push(toRow([
        a.nombre, a.email,
        t.total, t.abiertos, t.en_progreso, t.resueltos, t.cerrados, t.urgentes,
        fmtHoras(ttMap[a.id]),
        c.total, c.activas, c.cerradas,
        fmtHoras(ctMap[a.id]),
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

    const ticketTiempos = await queryAll(
      `SELECT t.cliente_id,
              AVG((JULIANDAY(pr.created_at) - JULIANDAY(t.created_at)) * 24) AS avg_horas
       FROM tickets t
       JOIN (
         SELECT r.ticket_id, MIN(r.created_at) AS created_at
         FROM ticket_respuestas r
         JOIN users u ON u.id = r.user_id AND u.rol = 'admin'
         GROUP BY r.ticket_id
       ) pr ON pr.ticket_id = t.id
       GROUP BY t.cliente_id`
    ) as any[]

    const chatTiempos = await queryAll(
      `SELECT cv.cliente_id,
              AVG((JULIANDAY(pm.created_at) - JULIANDAY(cv.created_at)) * 24) AS avg_horas
       FROM conversaciones cv
       JOIN (
         SELECT m.conversacion_id, MIN(m.created_at) AS created_at
         FROM mensajes m
         JOIN users u ON u.id = m.user_id AND u.rol = 'admin'
         GROUP BY m.conversacion_id
       ) pm ON pm.conversacion_id = cv.id
       GROUP BY cv.cliente_id`
    ) as any[]

    const ttMap: Record<string, number | null> = {}
    for (const r of ticketTiempos as any[]) ttMap[(r as any).cliente_id] = (r as any).avg_horas
    const ctMap: Record<string, number | null> = {}
    for (const r of chatTiempos as any[])   ctMap[(r as any).cliente_id] = (r as any).avg_horas

    const header = [
      'Razón social', 'NIT', 'Contacto', 'Email empresa', 'Teléfono',
      'Email usuario', 'Nombre usuario', 'Servicios',
      'Total obligaciones', 'Cumplidas', 'En progreso', 'Vencidas', 'Pendientes',
      '% Cumplimiento',
      'Tiempo resp. tickets (promedio)', 'Tiempo resp. chats (promedio)',
    ]
    const rows = [header.join(',')]

    for (const c of clientes) {
      const pct = c.total_obl > 0 ? Math.round((c.cumplidas / c.total_obl) * 100) : 0
      rows.push(toRow([
        c.razon_social, c.nit, c.contacto, c.email, c.telefono,
        c.user_email, c.user_nombre, c.num_servicios,
        c.total_obl, c.cumplidas, c.en_progreso, c.vencidas, c.pendientes,
        `${pct}%`,
        fmtHoras(ttMap[c.id]),
        fmtHoras(ctMap[c.id]),
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
