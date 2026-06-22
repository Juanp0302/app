/**
 * GET /api/superadmin
 * Vista global para el super administrador: resumen de tickets y chats por admin.
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryAll } from '@/lib/db'

export async function GET() {
  const session = await auth()
  const user = session?.user as any
  if (!user || !user.is_superadmin)
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  // Admins activos
  const admins = await queryAll(
    `SELECT id, nombre, email FROM users WHERE rol = 'admin' AND activo = 1 ORDER BY nombre`
  ) as any[]

  // Tickets agrupados por admin
  const ticketStats = await queryAll(
    `SELECT t.admin_id,
            COUNT(*) AS total,
            SUM(CASE WHEN t.estado='abierto'     THEN 1 ELSE 0 END) AS abiertos,
            SUM(CASE WHEN t.estado='en_progreso' THEN 1 ELSE 0 END) AS en_progreso,
            SUM(CASE WHEN t.estado='resuelto'    THEN 1 ELSE 0 END) AS resueltos,
            SUM(CASE WHEN t.estado='cerrado'     THEN 1 ELSE 0 END) AS cerrados,
            SUM(CASE WHEN t.prioridad='urgente'  THEN 1 ELSE 0 END) AS urgentes
     FROM tickets t
     GROUP BY t.admin_id`
  ) as any[]

  // Tiempo promedio de primera respuesta en tickets (horas) por admin
  const ticketTiempoResp = await queryAll(
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

  // Chats/conversaciones agrupados por admin
  const chatStats = await queryAll(
    `SELECT c.admin_id,
            COUNT(*) AS total,
            SUM(CASE WHEN c.estado='activa'  THEN 1 ELSE 0 END) AS activas,
            SUM(CASE WHEN c.estado='cerrada' THEN 1 ELSE 0 END) AS cerradas
     FROM conversaciones c
     GROUP BY c.admin_id`
  ) as any[]

  // Tiempo promedio de primera respuesta en chats (horas) por admin
  const chatTiempoResp = await queryAll(
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

  // Tickets sin asignar
  const sinAsignar = await queryAll(
    `SELECT t.id, t.numero, t.asunto, t.tipo, t.prioridad, t.estado, t.created_at, c.razon_social
     FROM tickets t JOIN clientes c ON c.id = t.cliente_id
     WHERE t.admin_id IS NULL AND t.estado != 'cerrado'
     ORDER BY CASE t.prioridad WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 ELSE 2 END`
  ) as any[]

  // Últimos tickets urgentes abiertos
  const urgentes = await queryAll(
    `SELECT t.id, t.numero, t.asunto, t.tipo, t.estado, t.created_at, t.updated_at,
            c.razon_social, u.nombre AS admin_nombre
     FROM tickets t JOIN clientes c ON c.id = t.cliente_id
     LEFT JOIN users u ON u.id = t.admin_id
     WHERE t.prioridad = 'urgente' AND t.estado != 'cerrado'
     ORDER BY t.created_at DESC LIMIT 10`
  ) as any[]

  // Construir mapas
  const tMap:  Record<string, any> = {}
  for (const r of ticketStats)    tMap[r.admin_id  ?? '__none__'] = r
  const cMap:  Record<string, any> = {}
  for (const r of chatStats)      cMap[r.admin_id  ?? '__none__'] = r
  const ttMap: Record<string, number | null> = {}
  for (const r of ticketTiempoResp) ttMap[r.admin_id ?? ''] = r.avg_horas
  const ctMap: Record<string, number | null> = {}
  for (const r of chatTiempoResp)   ctMap[r.admin_id ?? ''] = r.avg_horas

  const porAdmin = admins.map(a => ({
    ...a,
    tickets: {
      ...(tMap[a.id] ?? { total:0, abiertos:0, en_progreso:0, resueltos:0, cerrados:0, urgentes:0 }),
      avg_horas_respuesta: ttMap[a.id] ?? null,
    },
    chats: {
      ...(cMap[a.id] ?? { total:0, activas:0, cerradas:0 }),
      avg_horas_respuesta: ctMap[a.id] ?? null,
    },
  }))

  return NextResponse.json({ porAdmin, sinAsignar, urgentes })
}
