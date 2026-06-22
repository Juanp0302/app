import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne, queryAll, execute } from '@/lib/db'
import { notificarAsignacion, notificarSinAsignar } from '@/lib/notificaciones'
import { adminParaAsignacion } from '@/lib/asignacion'
import crypto from 'crypto'

const TIPOS = ['financiera','tecnica','juridica','transversal']

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
  return adminParaAsignacion(tipo, 'chat')
}

// GET /api/chat?clienteId=xxx  → lista conversaciones
// GET /api/chat?id=xxx         → mensajes de una conversación
export async function GET(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const convId    = req.nextUrl.searchParams.get('id')
  const clienteId = await resolveClienteId(user, req.nextUrl.searchParams.get('clienteId'))

  if (convId) {
    // Verificar acceso
    const conv = await queryOne('SELECT * FROM conversaciones WHERE id = ?', [convId]) as any
    if (!conv) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    if (user.role === 'cliente') {
      const c = await queryOne('SELECT id FROM clientes WHERE user_id = ?', [user.id]) as any
      if (!c || c.id !== conv.cliente_id) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
    } else if (user.role === 'admin') {
      if (conv.admin_id && conv.admin_id !== user.id)
        return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
    }
    // superadmin: acceso total
    const mensajes = await queryAll(
      `SELECT m.*, u.nombre AS autor_nombre, u.rol AS autor_rol
       FROM mensajes m JOIN users u ON u.id = m.user_id
       WHERE m.conversacion_id = ? ORDER BY m.created_at ASC`,
      [convId]
    )
    const adminInfo = conv.admin_id ? await queryOne('SELECT nombre, email FROM users WHERE id = ?', [conv.admin_id]) : null
    return NextResponse.json({ conv, mensajes, adminInfo })
  }

  // Lista conversaciones
  let rows
  if (user.role === 'admin') {
    rows = await queryAll(
      `SELECT v.*, c.razon_social, u.nombre AS admin_nombre
       FROM conversaciones v
       JOIN clientes c ON c.id = v.cliente_id
       LEFT JOIN users u ON u.id = v.admin_id
       WHERE v.admin_id = ? OR v.admin_id IS NULL
       ORDER BY v.updated_at DESC`,
      [user.id]
    )
  } else {
    if (!clienteId) return NextResponse.json({ error: 'clienteId requerido' }, { status: 400 })
    rows = await queryAll(
      `SELECT v.*, u.nombre AS admin_nombre
       FROM conversaciones v
       LEFT JOIN users u ON u.id = v.admin_id
       WHERE v.cliente_id = ? ORDER BY v.updated_at DESC`,
      [clienteId]
    )
  }
  return NextResponse.json(rows)
}

// POST /api/chat → crear conversación o enviar mensaje
export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()

  // Crear conversación
  if (body.accion === 'crear_conversacion') {
    const { tipo, asunto, clienteId: cIdParam } = body
    if (!TIPOS.includes(tipo) || !asunto) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    const clienteId = await resolveClienteId(user, cIdParam)
    if (!clienteId) return NextResponse.json({ error: 'clienteId requerido' }, { status: 400 })

    const adminId = await adminParaTipo(tipo)
    const id = crypto.randomUUID()
    await execute(
      `INSERT INTO conversaciones (id, cliente_id, admin_id, tipo, asunto) VALUES (?,?,?,?,?)`,
      [id, clienteId, adminId, tipo, asunto]
    )

    const cliente = await queryOne('SELECT razon_social FROM clientes WHERE id = ?', [clienteId])
    const razonSocial = (cliente as any)?.razon_social ?? ''
    const fecha = new Date().toLocaleString('es-CO')
    if (adminId) {
      const adminInfo = await queryOne('SELECT nombre, email FROM users WHERE id = ?', [adminId]) as any
      notificarAsignacion({
        id, tipo_entidad: 'chat', especialidad: tipo, asunto,
        cliente: razonSocial, admin_nombre: adminInfo?.nombre,
        admin_email: adminInfo?.email, estado: 'activa', fecha,
      })
    } else {
      notificarSinAsignar({ tipo: 'chat', id, asunto, cliente: razonSocial, especialidad: tipo, fecha })
    }

    return NextResponse.json({ ok: true, id, adminId })
  }

  // Enviar mensaje
  if (body.accion === 'mensaje') {
    const { conversacionId, contenido } = body
    if (!conversacionId || !contenido?.trim()) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

    const conv = await queryOne('SELECT * FROM conversaciones WHERE id = ?', [conversacionId]) as any
    if (!conv) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const id = crypto.randomUUID()
    await execute(`INSERT INTO mensajes (id, conversacion_id, user_id, contenido) VALUES (?,?,?,?)`,
      [id, conversacionId, user.id, contenido.trim()])
    await execute(`UPDATE conversaciones SET updated_at = datetime('now') WHERE id = ?`, [conversacionId])
    return NextResponse.json({ ok: true, id })
  }

  // Cerrar conversación
  if (body.accion === 'cerrar') {
    await execute(`UPDATE conversaciones SET estado='cerrada', updated_at=datetime('now') WHERE id=?`, [body.conversacionId])
    return NextResponse.json({ ok: true })
  }

  // Reasignar
  if (body.accion === 'reasignar') {
    const { conversacionId, adminId, motivo } = body
    const conv = await queryOne('SELECT * FROM conversaciones WHERE id = ?', [conversacionId]) as any
    if (!conv) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    await execute(`UPDATE conversaciones SET admin_id=?, updated_at=datetime('now') WHERE id=?`, [adminId, conversacionId])
    await execute(`INSERT INTO reasignaciones (id,entidad,entidad_id,de_admin_id,a_admin_id,motivo,user_id) VALUES (?,?,?,?,?,?,?)`,
      [crypto.randomUUID(), 'conversacion', conversacionId, conv.admin_id, adminId, motivo ?? null, user.id])

    const cliente = await queryOne('SELECT razon_social FROM clientes WHERE id = ?', [conv.cliente_id])
    const adminInfo = await queryOne('SELECT nombre, email FROM users WHERE id = ?', [adminId])
    notificarAsignacion({
      id: conversacionId, tipo_entidad: 'chat', especialidad: conv.tipo, asunto: conv.asunto,
      cliente: (cliente as any)?.razon_social ?? '',
      admin_nombre: (adminInfo as any)?.nombre,
      admin_email:  (adminInfo as any)?.email,
      estado: 'reasignada',
      fecha: new Date().toLocaleString('es-CO'),
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })
}
