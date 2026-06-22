import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne, queryAll, execute } from '@/lib/db'
import { notificarAsignacion, notificarSinAsignar } from '@/lib/notificaciones'
import { adminParaAsignacion } from '@/lib/asignacion'
import crypto from 'crypto'

const TIPOS       = ['financiera','tecnica','juridica','transversal']
const PRIORIDADES = ['baja','normal','alta','urgente']
// 'cerrado' solo se asigna automáticamente; el admin puede cambiar a cualquier otro estado
const ESTADOS_MANUALES = ['abierto','en_progreso','resuelto']

async function getSession() {
  const session = await auth()
  if (!session?.user) return null
  return session.user as any
}

async function resolveClienteId(user: any, param: string | null) {
  if (user.role === 'cliente') {
    const c = await queryOne('SELECT id FROM clientes WHERE user_id = ?', [user.id])
    return c ? (c as any).id : null
  }
  return param
}

/** @deprecated — reemplazado por adminParaAsignacion de lib/asignacion */
async function adminParaTipo(tipo: string) {
  return adminParaAsignacion(tipo, 'ticket')
}

/** Cierra automáticamente tickets sin actividad por más de 2 días */
async function autoCerrarInactivos() {
  await execute(
    `UPDATE tickets
     SET estado = 'cerrado', updated_at = datetime('now')
     WHERE estado != 'cerrado'
       AND updated_at < datetime('now', '-2 days')`
  )
}

// GET /api/tickets             → lista tickets
// GET /api/tickets?id=xxx      → detalle + respuestas
export async function GET(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Cierre automático por inactividad antes de responder
  await autoCerrarInactivos()

  const ticketId  = req.nextUrl.searchParams.get('id')
  const clienteId = await resolveClienteId(user, req.nextUrl.searchParams.get('clienteId'))

  if (ticketId) {
    const ticket = await queryOne(
      `SELECT t.*, c.razon_social, u.nombre AS admin_nombre
       FROM tickets t JOIN clientes c ON c.id = t.cliente_id
       LEFT JOIN users u ON u.id = t.admin_id
       WHERE t.id = ?`, [ticketId]
    ) as any
    if (!ticket) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const respuestas = await queryAll(
      `SELECT r.*, u.nombre AS autor_nombre, u.rol AS autor_rol
       FROM ticket_respuestas r JOIN users u ON u.id = r.user_id
       WHERE r.ticket_id = ? ORDER BY r.created_at ASC`,
      [ticketId]
    )
    const historial = await queryAll(
      `SELECT r.*, u.nombre AS de_nombre, u2.nombre AS a_nombre
       FROM reasignaciones r
       LEFT JOIN users u  ON u.id  = r.de_admin_id
       LEFT JOIN users u2 ON u2.id = r.a_admin_id
       WHERE r.entidad='ticket' AND r.entidad_id=? ORDER BY r.created_at ASC`,
      [ticketId]
    )
    return NextResponse.json({ ticket, respuestas, historial })
  }

  let rows
  if (user.is_superadmin) {
    // Superadmin ve TODOS los tickets de todos los admins
    rows = await queryAll(
      `SELECT t.*, c.razon_social, u.nombre AS admin_nombre
       FROM tickets t JOIN clientes c ON c.id = t.cliente_id
       LEFT JOIN users u ON u.id = t.admin_id
       ORDER BY CASE t.prioridad WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
                t.updated_at DESC`
    )
  } else if (user.role === 'admin') {
    rows = await queryAll(
      `SELECT t.*, c.razon_social, u.nombre AS admin_nombre
       FROM tickets t JOIN clientes c ON c.id = t.cliente_id
       LEFT JOIN users u ON u.id = t.admin_id
       WHERE t.admin_id = ? OR t.admin_id IS NULL
       ORDER BY CASE t.prioridad WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
                t.updated_at DESC`,
      [user.id]
    )
  } else {
    if (!clienteId) return NextResponse.json({ error: 'clienteId requerido' }, { status: 400 })
    rows = await queryAll(
      `SELECT t.*, u.nombre AS admin_nombre
       FROM tickets t LEFT JOIN users u ON u.id = t.admin_id
       WHERE t.cliente_id = ? ORDER BY t.updated_at DESC`,
      [clienteId]
    )
  }
  return NextResponse.json(rows)
}

// POST /api/tickets
export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()

  // ── Crear ticket ────────────────────────────────────────────────────────────
  if (body.accion === 'crear') {
    const { tipo, asunto, descripcion, prioridad = 'normal', clienteId: cIdParam } = body
    if (!TIPOS.includes(tipo) || !asunto || !descripcion)
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    const clienteId = await resolveClienteId(user, cIdParam)
    if (!clienteId) return NextResponse.json({ error: 'clienteId requerido' }, { status: 400 })

    const adminId = await adminParaTipo(tipo)
    const id = crypto.randomUUID()

    await execute(
      `INSERT INTO tickets (id, cliente_id, admin_id, tipo, asunto, descripcion, prioridad, numero)
       VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(numero), 0) + 1 FROM tickets))`,
      [id, clienteId, adminId, tipo, asunto, descripcion, prioridad]
    )

    const cliente   = await queryOne('SELECT razon_social FROM clientes WHERE id = ?', [clienteId])
    const razonSocial = (cliente as any)?.razon_social ?? ''
    const fecha = new Date().toLocaleString('es-CO')
    if (adminId) {
      const adminInfo = await queryOne('SELECT nombre, email FROM users WHERE id = ?', [adminId]) as any
      notificarAsignacion({
        id, tipo_entidad: 'ticket', especialidad: tipo, asunto,
        cliente: razonSocial, admin_nombre: adminInfo?.nombre,
        admin_email: adminInfo?.email, estado: 'abierto', fecha,
      })
    } else {
      notificarSinAsignar({ tipo: 'ticket', id, asunto, cliente: razonSocial, especialidad: tipo, fecha })
    }

    return NextResponse.json({ ok: true, id, adminId }, { status: 201 })
  }

  // ── Responder ───────────────────────────────────────────────────────────────
  if (body.accion === 'responder') {
    const { ticketId, contenido } = body
    if (!ticketId || !contenido?.trim()) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    const id = crypto.randomUUID()
    await execute(`INSERT INTO ticket_respuestas (id,ticket_id,user_id,contenido) VALUES (?,?,?,?)`,
      [id, ticketId, user.id, contenido.trim()])
    await execute(`UPDATE tickets SET updated_at=datetime('now') WHERE id=?`, [ticketId])
    return NextResponse.json({ ok: true })
  }

  // ── Cambiar estado o prioridad ──────────────────────────────────────────────
  // 'cerrado' no puede asignarse manualmente — es exclusivo del cierre automático.
  if (body.accion === 'actualizar') {
    const { ticketId, estado, prioridad } = body
    if (estado) {
      if (!ESTADOS_MANUALES.includes(estado))
        return NextResponse.json({ error: `Estado inválido. Opciones: ${ESTADOS_MANUALES.join(', ')}` }, { status: 400 })
      const t = await queryOne('SELECT estado FROM tickets WHERE id = ?', [ticketId]) as any
      if (t?.estado === 'cerrado')
        return NextResponse.json({ error: 'El ticket está cerrado automáticamente y no puede modificarse.' }, { status: 400 })
      await execute(`UPDATE tickets SET estado=?, updated_at=datetime('now') WHERE id=?`, [estado, ticketId])
    }
    if (prioridad) {
      if (!PRIORIDADES.includes(prioridad)) return NextResponse.json({ error: 'Prioridad inválida' }, { status: 400 })
      await execute(`UPDATE tickets SET prioridad=?, updated_at=datetime('now') WHERE id=?`, [prioridad, ticketId])
    }
    return NextResponse.json({ ok: true })
  }

  // ── Reasignar ───────────────────────────────────────────────────────────────
  if (body.accion === 'reasignar') {
    const { ticketId, adminId, motivo } = body
    const ticket = await queryOne('SELECT * FROM tickets WHERE id = ?', [ticketId]) as any
    if (!ticket) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    await execute(`UPDATE tickets SET admin_id=?, updated_at=datetime('now') WHERE id=?`, [adminId, ticketId])
    await execute(`INSERT INTO reasignaciones (id,entidad,entidad_id,de_admin_id,a_admin_id,motivo,user_id) VALUES (?,?,?,?,?,?,?)`,
      [crypto.randomUUID(), 'ticket', ticketId, ticket.admin_id, adminId, motivo ?? null, user.id])

    const cliente   = await queryOne('SELECT razon_social FROM clientes WHERE id = ?', [ticket.cliente_id])
    const adminInfo = await queryOne('SELECT nombre, email FROM users WHERE id = ?', [adminId])
    notificarAsignacion({
      id: ticketId, tipo_entidad: 'ticket', especialidad: ticket.tipo, asunto: ticket.asunto,
      cliente:      (cliente as any)?.razon_social ?? '',
      admin_nombre: (adminInfo as any)?.nombre,
      admin_email:  (adminInfo as any)?.email,
      estado: 'reasignado',
      fecha: new Date().toLocaleString('es-CO'),
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })
}
