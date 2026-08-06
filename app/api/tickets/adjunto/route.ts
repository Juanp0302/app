/**
 * POST /api/tickets/adjunto  (multipart/form-data)
 *   accion=crear:     tipo, asunto, descripcion, prioridad, clienteId?, archivo
 *   accion=responder: ticketId, contenido?, archivo
 * GET /api/tickets/adjunto?ticketId=xxx      → adjunto del ticket (descripción inicial)
 * GET /api/tickets/adjunto?respuestaId=xxx   → adjunto de una respuesta
 */
import { NextRequest, NextResponse } from 'next/server'
import { queryOne, execute } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth-any'
import { notificarAsignacion, notificarSinAsignar } from '@/lib/notificaciones'
import { notificarPush } from '@/lib/push-notify'
import { adminParaAsignacion } from '@/lib/asignacion'
import { puedeCrearTicket, incrementarContador } from '@/lib/suscripcion'
import { validarArchivoAdjunto, subirAdjunto, descargarAdjunto } from '@/lib/adjuntos'
import crypto from 'crypto'
import path from 'path'

const TIPOS = ['financiera', 'tecnica', 'juridica', 'transversal']

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.doc': 'application/msword',
  '.xls': 'application/vnd.ms-excel', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
}

async function resolveClienteId(user: any, param: string | null) {
  if (user.role === 'cliente') {
    const c = await queryOne('SELECT id FROM clientes WHERE user_id = ?', [user.id])
    return c ? (c as any).id : null
  }
  return param
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const form   = await req.formData()
  const accion = form.get('accion') as string
  const archivo = form.get('archivo') as File | null
  if (!archivo) return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 })
  const errorValidacion = validarArchivoAdjunto(archivo)
  if (errorValidacion) return NextResponse.json({ error: errorValidacion }, { status: 400 })

  // ── Crear ticket con adjunto ────────────────────────────────────────────────
  if (accion === 'crear') {
    const tipo        = form.get('tipo') as string
    const asunto       = form.get('asunto') as string
    const descripcion  = form.get('descripcion') as string
    const prioridad    = (form.get('prioridad') as string) || 'normal'
    const clienteId    = await resolveClienteId(user, form.get('clienteId') as string | null)

    if (!TIPOS.includes(tipo) || !asunto || !descripcion || !clienteId)
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

    if (user.role === 'cliente') {
      const permiso = await puedeCrearTicket(clienteId)
      if (!permiso.ok) {
        if (permiso.razon === 'suscripcion_suspendida')
          return NextResponse.json({ error: 'Tu suscripción está suspendida. Renueva tu plan para continuar.', codigo: 'SUSCRIPCION_SUSPENDIDA' }, { status: 403 })
        if (permiso.razon === 'limite_alcanzado') {
          const p = permiso as any
          return NextResponse.json({
            error: `Alcanzaste el límite de ${p.limite} ticket${p.limite !== 1 ? 's' : ''} de tu plan ${p.plan}. Actualiza tu plan para continuar.`,
            codigo: 'LIMITE_TICKETS', limite: p.limite, usado: p.usado, plan: p.plan,
          }, { status: 403 })
        }
      }
    }

    const id = crypto.randomUUID()
    const subido = await subirAdjunto({ clienteId, carpeta: `tickets/${id}`, archivo })
    const adminId = await adminParaAsignacion(tipo, 'ticket')

    await execute(
      `INSERT INTO tickets (id, cliente_id, admin_id, tipo, asunto, descripcion, prioridad, numero, archivo_ref, archivo_nombre, archivo_mime, archivo_tamano)
       VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(numero), 0) + 1 FROM tickets), ?, ?, ?, ?)`,
      [id, clienteId, adminId, tipo, asunto, descripcion, prioridad, subido.ref, subido.nombre, subido.mime, subido.tamano]
    )
    if (user.role === 'cliente') await incrementarContador(clienteId, 'ticket')

    const cliente = await queryOne('SELECT razon_social FROM clientes WHERE id = ?', [clienteId])
    const razonSocial = (cliente as any)?.razon_social ?? ''
    const fecha = new Date().toLocaleString('es-CO')
    if (adminId) {
      const adminInfo = await queryOne('SELECT nombre, email FROM users WHERE id = ?', [adminId]) as any
      notificarAsignacion({
        id, tipo_entidad: 'ticket', especialidad: tipo, asunto,
        cliente: razonSocial, admin_nombre: adminInfo?.nombre,
        admin_email: adminInfo?.email, admin_id: adminId, estado: 'abierto', fecha,
      })
    } else {
      notificarSinAsignar({ tipo: 'ticket', id, asunto, cliente: razonSocial, especialidad: tipo, fecha })
    }

    return NextResponse.json({ ok: true, id, adminId }, { status: 201 })
  }

  // ── Responder con adjunto ───────────────────────────────────────────────────
  if (accion === 'responder') {
    const ticketId = form.get('ticketId') as string
    const contenido = (form.get('contenido') as string | null) ?? ''
    if (!ticketId) return NextResponse.json({ error: 'ticketId requerido' }, { status: 400 })

    const ticket = await queryOne(
      `SELECT t.*, c.razon_social FROM tickets t JOIN clientes c ON c.id = t.cliente_id WHERE t.id = ?`,
      [ticketId]
    ) as any
    if (!ticket) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    if (user.role === 'cliente') {
      const c = await queryOne('SELECT id FROM clientes WHERE user_id = ?', [user.id]) as any
      if (!c || c.id !== ticket.cliente_id) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
    }

    const subido = await subirAdjunto({ clienteId: ticket.cliente_id, carpeta: `tickets/${ticketId}`, archivo })
    const id = crypto.randomUUID()
    await execute(
      `INSERT INTO ticket_respuestas (id, ticket_id, user_id, contenido, archivo_ref, archivo_nombre, archivo_mime, archivo_tamano)
       VALUES (?,?,?,?,?,?,?,?)`,
      [id, ticketId, user.id, contenido.trim() || `📎 ${subido.nombre}`, subido.ref, subido.nombre, subido.mime, subido.tamano]
    )
    await execute(`UPDATE tickets SET updated_at = datetime('now') WHERE id = ?`, [ticketId])

    if (user.role === 'cliente' && ticket.admin_id) {
      notificarPush(ticket.admin_id, {
        titulo: `Nuevo adjunto de ${ticket.razon_social}`,
        cuerpo: subido.nombre,
        data: { tipo_entidad: 'ticket', id: ticketId },
      })
    }

    return NextResponse.json({ ok: true, id })
  }

  return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const ticketId    = req.nextUrl.searchParams.get('ticketId')
  const respuestaId = req.nextUrl.searchParams.get('respuestaId')

  let clienteId: string, adminId: string | null, archivoRef: string | null, archivoNombre: string | null, archivoMime: string | null

  if (respuestaId) {
    const r = await queryOne(
      `SELECT r.*, t.cliente_id, t.admin_id FROM ticket_respuestas r JOIN tickets t ON t.id = r.ticket_id WHERE r.id = ?`,
      [respuestaId]
    ) as any
    if (!r || !r.archivo_ref) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    clienteId = r.cliente_id; adminId = r.admin_id; archivoRef = r.archivo_ref; archivoNombre = r.archivo_nombre; archivoMime = r.archivo_mime
  } else if (ticketId) {
    const t = await queryOne(`SELECT * FROM tickets WHERE id = ?`, [ticketId]) as any
    if (!t || !t.archivo_ref) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    clienteId = t.cliente_id; adminId = t.admin_id; archivoRef = t.archivo_ref; archivoNombre = t.archivo_nombre; archivoMime = t.archivo_mime
  } else {
    return NextResponse.json({ error: 'ticketId o respuestaId requerido' }, { status: 400 })
  }

  if (user.role === 'cliente') {
    const c = await queryOne('SELECT id FROM clientes WHERE user_id = ?', [user.id]) as any
    if (!c || c.id !== clienteId) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  } else if (user.role === 'admin' && !user.is_superadmin) {
    if (adminId && adminId !== user.id) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  const buffer = await descargarAdjunto(clienteId, archivoRef!)
  const ext = path.extname(archivoNombre!).toLowerCase()
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': MIME[ext] ?? archivoMime ?? 'application/octet-stream',
      'Content-Disposition': `inline; filename="${archivoNombre}"`,
    },
  })
}
