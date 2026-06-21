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

  // Admins activos (excluye al propio superadmin si se filtra por is_superadmin=0)
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

  // Chats/conversaciones agrupados por admin
  const chatStats = await queryAll(
    `SELECT c.admin_id,
            COUNT(*) AS total,
            SUM(CASE WHEN c.estado='activa'  THEN 1 ELSE 0 END) AS activas,
            SUM(CASE WHEN c.estado='cerrada' THEN 1 ELSE 0 END) AS cerradas
     FROM conversaciones c
     GROUP BY c.admin_id`
  ) as any[]

  // Tickets sin asignar
  const sinAsignar = await queryAll(
    `SELECT t.id, t.numero, t.asunto, t.tipo, t.prioridad, t.estado, t.created_at, c.razon_social
     FROM tickets t JOIN clientes c ON c.id = t.cliente_id
     WHERE t.admin_id IS NULL AND t.estado != 'cerrado'
     ORDER BY CASE t.prioridad WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 ELSE 2 END`
  ) as any[]

  // Últimos 5 tickets urgentes abiertos (cualquier admin)
  const urgentes = await queryAll(
    `SELECT t.id, t.numero, t.asunto, t.tipo, t.estado, t.created_at, t.updated_at,
            c.razon_social, u.nombre AS admin_nombre
     FROM tickets t JOIN clientes c ON c.id = t.cliente_id
     LEFT JOIN users u ON u.id = t.admin_id
     WHERE t.prioridad = 'urgente' AND t.estado != 'cerrado'
     ORDER BY t.created_at DESC LIMIT 10`
  ) as any[]

  // Construir mapa de estadísticas por admin
  const tMap: Record<string, any> = {}
  for (const r of ticketStats) tMap[r.admin_id ?? '__none__'] = r
  const cMap: Record<string, any> = {}
  for (const r of chatStats) cMap[r.admin_id ?? '__none__'] = r

  const porAdmin = admins.map(a => ({
    ...a,
    tickets: tMap[a.id] ?? { total:0, abiertos:0, en_progreso:0, resueltos:0, cerrados:0, urgentes:0 },
    chats:   cMap[a.id] ?? { total:0, activas:0, cerradas:0 },
  }))

  return NextResponse.json({ porAdmin, sinAsignar, urgentes })
}
