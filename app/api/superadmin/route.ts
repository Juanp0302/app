/**
 * GET   /api/superadmin          → resumen de tickets, chats y docs por admin
 * PATCH /api/superadmin          → reasignar ticket, chat o documento a un admin
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryAll, queryOne, execute } from '@/lib/db'
import { notificarAsignacion } from '@/lib/notificaciones'

async function requireSuperadmin() {
  const session = await auth()
  const user = session?.user as any
  return user?.is_superadmin ? user : null
}

export async function GET() {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

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

  // Documentos por admin revisor
  const docStats = await queryAll(
    `SELECT d.revisado_por AS admin_id,
            COUNT(*) AS revisados,
            SUM(CASE WHEN d.estado_revision = 'aprobado'  THEN 1 ELSE 0 END) AS aprobados,
            SUM(CASE WHEN d.estado_revision = 'rechazado' THEN 1 ELSE 0 END) AS rechazados
     FROM documentos d
     WHERE d.revisado_por IS NOT NULL
     GROUP BY d.revisado_por`
  ) as any[]

  // Documentos pendientes asignados a cada admin (revisor del cliente)
  let docPendientes: any[] = []
  try {
    docPendientes = await queryAll(
      `SELECT c.admin_revision_id AS admin_id, COUNT(*) AS pendientes
       FROM documentos d
       JOIN clientes c ON c.id = d.cliente_id
       WHERE (d.estado_revision = 'pendiente' OR d.estado_revision IS NULL)
         AND c.admin_revision_id IS NOT NULL
       GROUP BY c.admin_revision_id`
    ) as any[]
  } catch { docPendientes = [] }

  // Tickets activos por admin (para reasignación)
  const ticketsActivos = await queryAll(
    `SELECT t.id, t.numero, t.asunto, t.tipo, t.prioridad, t.estado, t.created_at,
            t.admin_id, c.razon_social
     FROM tickets t JOIN clientes c ON c.id = t.cliente_id
     WHERE t.admin_id IS NOT NULL AND t.estado NOT IN ('cerrado','resuelto')
     ORDER BY CASE t.prioridad WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 ELSE 2 END, t.created_at ASC`
  ) as any[]

  // Chats activos por admin
  const chatsActivos = await queryAll(
    `SELECT cv.id, cv.tipo, cv.asunto, cv.estado, cv.created_at,
            cv.admin_id, c.razon_social
     FROM conversaciones cv JOIN clientes c ON c.id = cv.cliente_id
     WHERE cv.admin_id IS NOT NULL AND cv.estado = 'activa'
     ORDER BY cv.created_at ASC`
  ) as any[]

  // Tickets sin asignar
  const sinAsignar = await queryAll(
    `SELECT t.id, t.numero, t.asunto, t.tipo, t.prioridad, t.estado, t.created_at, c.razon_social, c.id AS cliente_id
     FROM tickets t JOIN clientes c ON c.id = t.cliente_id
     WHERE t.admin_id IS NULL AND t.estado != 'cerrado'
     ORDER BY CASE t.prioridad WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 ELSE 2 END`
  ) as any[]

  // Chats sin asignar
  const chatsSinAsignar = await queryAll(
    `SELECT cv.id, cv.tipo, cv.estado, cv.created_at, c.razon_social, c.id AS cliente_id
     FROM conversaciones cv JOIN clientes c ON c.id = cv.cliente_id
     WHERE cv.admin_id IS NULL AND cv.estado != 'cerrada'
     ORDER BY cv.created_at ASC`
  ) as any[]

  // Documentos sin asignar (pendientes y sin revisor asignado al cliente)
  // Usamos LEFT JOIN con subquery para no fallar si admin_revision_id no existe aún
  let docsSinAsignar: any[] = []
  try {
    docsSinAsignar = await queryAll(
      `SELECT d.id, d.nombre_archivo, d.aspecto, d.obligacion, d.uploaded_at,
              c.razon_social, c.id AS cliente_id
       FROM documentos d
       JOIN clientes c ON c.id = d.cliente_id
       WHERE (d.estado_revision = 'pendiente' OR d.estado_revision IS NULL)
         AND (c.admin_revision_id IS NULL OR c.admin_revision_id = '')
       ORDER BY d.uploaded_at ASC`
    ) as any[]
  } catch { docsSinAsignar = [] }

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
  const dMap:  Record<string, any> = {}
  for (const r of docStats)       dMap[r.admin_id  ?? '']        = r
  const dpMap: Record<string, number> = {}
  for (const r of docPendientes)  dpMap[r.admin_id ?? '']        = r.pendientes
  const ttMap: Record<string, number | null> = {}
  for (const r of ticketTiempoResp) ttMap[r.admin_id ?? ''] = r.avg_horas
  const ctMap: Record<string, number | null> = {}
  for (const r of chatTiempoResp)   ctMap[r.admin_id ?? ''] = r.avg_horas

  const taMap: Record<string, any[]> = {}
  for (const t of ticketsActivos) { if (!taMap[t.admin_id]) taMap[t.admin_id] = []; taMap[t.admin_id].push(t) }
  const caMap: Record<string, any[]> = {}
  for (const c of chatsActivos)   { if (!caMap[c.admin_id]) caMap[c.admin_id] = []; caMap[c.admin_id].push(c) }

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
    documentos: {
      pendientes: dpMap[a.id] ?? 0,
      revisados:  (dMap[a.id]?.revisados  ?? 0),
      aprobados:  (dMap[a.id]?.aprobados  ?? 0),
      rechazados: (dMap[a.id]?.rechazados ?? 0),
    },
    ticketsActivos: taMap[a.id] ?? [],
    chatsActivos:   caMap[a.id] ?? [],
  }))

  return NextResponse.json({ porAdmin, sinAsignar, chatsSinAsignar, docsSinAsignar, urgentes })
}

/**
 * PATCH /api/superadmin
 * body: { tipo: 'ticket'|'chat'|'documento', id, adminId }
 * Reasigna cualquier entidad a un admin específico.
 */
export async function PATCH(req: NextRequest) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { tipo, id, adminId } = await req.json()
  if (!tipo || !id || !adminId)
    return NextResponse.json({ error: 'tipo, id y adminId requeridos' }, { status: 400 })

  const admin = await queryOne('SELECT id, nombre, email FROM users WHERE id = ? AND rol = ? AND activo = 1',
    [adminId, 'admin']) as any
  if (!admin) return NextResponse.json({ error: 'Admin no encontrado' }, { status: 404 })

  const fecha = new Date().toLocaleString('es-CO')

  if (tipo === 'ticket') {
    const t = await queryOne(
      `SELECT t.*, c.razon_social FROM tickets t JOIN clientes c ON c.id = t.cliente_id WHERE t.id = ?`, [id]
    ) as any
    if (!t) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })
    await execute(`UPDATE tickets SET admin_id = ?, updated_at = datetime('now') WHERE id = ?`, [adminId, id])
    notificarAsignacion({
      id, tipo_entidad: 'ticket', especialidad: t.tipo,
      asunto: t.asunto, cliente: t.razon_social,
      admin_nombre: admin.nombre, admin_email: admin.email,
      estado: t.estado, fecha,
    })
  } else if (tipo === 'chat') {
    const cv = await queryOne(
      `SELECT cv.*, c.razon_social FROM conversaciones cv JOIN clientes c ON c.id = cv.cliente_id WHERE cv.id = ?`, [id]
    ) as any
    if (!cv) return NextResponse.json({ error: 'Chat no encontrado' }, { status: 404 })
    await execute(`UPDATE conversaciones SET admin_id = ?, updated_at = datetime('now') WHERE id = ?`, [adminId, id])
    notificarAsignacion({
      id, tipo_entidad: 'chat', especialidad: cv.tipo,
      asunto: `Chat ${cv.tipo}`, cliente: cv.razon_social,
      admin_nombre: admin.nombre, admin_email: admin.email,
      estado: cv.estado, fecha,
    })
  } else if (tipo === 'documento') {
    // Para documentos: asignar el admin como revisor del cliente
    const d = await queryOne(
      `SELECT d.*, c.razon_social, c.id AS cliente_id FROM documentos d JOIN clientes c ON c.id = d.cliente_id WHERE d.id = ?`, [id]
    ) as any
    if (!d) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    await execute(`UPDATE clientes SET admin_revision_id = ? WHERE id = ?`, [adminId, d.cliente_id])
  } else {
    return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
