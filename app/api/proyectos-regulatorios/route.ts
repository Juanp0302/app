/**
 * /api/proyectos-regulatorios
 * Seguimiento y participación en proyectos regulatorios de entidades
 * sectoriales (CRC, MinTIC, SIC). Lectura para cualquier usuario
 * autenticado. Gestión de contenido (crear/actualizar/eliminar
 * proyectos) reservada a administradores.
 *
 * Participación de clientes:
 *  - "Estoy interesado" (todos los planes): solo registra interés.
 *  - Comentario de preocupaciones/cambios sugeridos (planes Pro y
 *    Premium): además de registrarse, genera una notificación al
 *    superadmin en forma de ticket, sin descontar cupo del plan.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne, execute } from '@/lib/db'
import { notificarAsignacion, notificarSinAsignar } from '@/lib/notificaciones'
import {
  listarProyectos, obtenerProyecto, crearProyecto, actualizarProyecto, eliminarProyecto,
  participacionesDeCliente, participacionesDeProyecto, participar, ProyectoData,
} from '@/lib/proyectos-regulatorios-db'
import crypto from 'crypto'

async function getSession() {
  const session = await auth()
  if (!session?.user) return null
  return session.user as any
}

async function clienteDe(userId: string) {
  return queryOne(`SELECT id, razon_social, plan FROM clientes WHERE user_id = ?`, [userId]) as Promise<any>
}

export async function GET(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const id           = req.nextUrl.searchParams.get('id')
  const participantes = req.nextUrl.searchParams.get('participantes')

  if (id && participantes) {
    if (user.role !== 'admin') return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
    const items = await participacionesDeProyecto(id)
    return NextResponse.json({ items })
  }

  if (id) {
    const item = await obtenerProyecto(id)
    if (!item) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ item })
  }

  const items = await listarProyectos()

  let misParticipaciones: Record<string, any> = {}
  if (user.role === 'cliente') {
    const cliente = await clienteDe(user.id)
    if (cliente) {
      const propias = await participacionesDeCliente(cliente.id)
      misParticipaciones = Object.fromEntries(propias.map((p: any) => [p.proyecto_id, p]))
    }
  }

  return NextResponse.json({ items, misParticipaciones })
}

function validarProyecto(body: any): body is ProyectoData {
  return !!(body.entidad && body.titulo && body.descripcion && body.estado)
}

/** Registra interés y/o comentario de un cliente en un proyecto. */
async function participarEnProyecto(user: any, body: any) {
  if (user.role !== 'cliente') {
    return NextResponse.json({ error: 'Solo un cliente puede participar' }, { status: 403 })
  }

  const { proyectoId, interesado, comentario } = body
  if (!proyectoId) return NextResponse.json({ error: 'proyectoId requerido' }, { status: 400 })

  const cliente = await clienteDe(user.id)
  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const proyecto = await obtenerProyecto(proyectoId) as any
  if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  const comentarioTexto = (comentario ?? '').toString().trim()

  // El comentario con preocupaciones/cambios sugeridos es exclusivo de Pro y Premium.
  if (comentarioTexto && cliente.plan === 'basico') {
    return NextResponse.json({ error: 'Comentar propuestas está disponible en los planes Pro y Premium.' }, { status: 403 })
  }

  await participar({
    proyectoId,
    clienteId: cliente.id,
    interesado: !!interesado,
    comentario: comentarioTexto || null,
  })

  // El comentario notifica al superadmin como ticket, sin descontar cupo del plan.
  if (comentarioTexto) {
    const superadmin = await queryOne(
      `SELECT id, nombre, email FROM users WHERE rol = 'admin' AND is_superadmin = 1 AND activo = 1 LIMIT 1`
    ) as any

    const id     = crypto.randomUUID()
    const asunto = `Comentario a proyecto regulatorio — ${proyecto.titulo}`
    const descripcion =
      `Comentario de participación en proyecto regulatorio.\n\n` +
      `Proyecto: ${proyecto.titulo} (${proyecto.entidad})\n\n` +
      `Comentario del cliente:\n${comentarioTexto}`

    await execute(
      `INSERT INTO tickets (id, cliente_id, admin_id, tipo, asunto, descripcion, prioridad, numero)
       VALUES (?, ?, ?, 'juridica', ?, ?, 'normal', (SELECT COALESCE(MAX(numero), 0) + 1 FROM tickets))`,
      [id, cliente.id, superadmin?.id ?? null, asunto, descripcion]
    )

    const fecha = new Date().toLocaleString('es-CO')
    if (superadmin) {
      notificarAsignacion({
        id, tipo_entidad: 'ticket', especialidad: 'juridica', asunto,
        cliente: cliente.razon_social, admin_nombre: superadmin.nombre,
        admin_email: superadmin.email, estado: 'abierto', fecha,
      })
    } else {
      notificarSinAsignar({ tipo: 'ticket', id, asunto, cliente: cliente.razon_social, especialidad: 'juridica', fecha })
    }
  }

  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()

  if (body.accion === 'participar') {
    return participarEnProyecto(user, body)
  }

  if (user.role !== 'admin') return NextResponse.json({ error: 'Solo un administrador puede editar proyectos regulatorios' }, { status: 403 })

  if (body.accion === 'crear') {
    if (!validarProyecto(body.datos)) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    const id = await crearProyecto(body.datos)
    return NextResponse.json({ ok: true, id }, { status: 201 })
  }

  if (body.accion === 'actualizar') {
    if (!body.id || !validarProyecto(body.datos)) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    await actualizarProyecto(body.id, body.datos)
    return NextResponse.json({ ok: true })
  }

  if (body.accion === 'eliminar') {
    if (!body.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    await eliminarProyecto(body.id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
}
