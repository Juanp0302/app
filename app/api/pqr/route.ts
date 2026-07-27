/**
 * /api/pqr
 * Repositorio de PQR — lectura para cualquier usuario autenticado
 * (cliente, admin, superadmin). Escritura de contenido (crear/actualizar/
 * eliminar tipologías) reservada a administradores. La acción "proponer"
 * la usa el cliente para sugerir una nueva respuesta tipo: se registra
 * como ticket asignado directamente al superadmin, sin consumir el
 * cupo mensual de tickets de su plan.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne, execute } from '@/lib/db'
import { notificarAsignacion, notificarSinAsignar } from '@/lib/notificaciones'
import { listarPqr, obtenerPqr, crearPqr, actualizarPqr, eliminarPqr, PqrData } from '@/lib/pqr-db'
import crypto from 'crypto'

async function getSession() {
  const session = await auth()
  if (!session?.user) return null
  return session.user as any
}

export async function GET(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const item = await obtenerPqr(id)
    if (!item) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ item })
  }

  const items = await listarPqr()
  return NextResponse.json({ items })
}

function validar(body: any): body is PqrData {
  return !!(body.servicio && body.codigo && body.nombre && body.normativa && body.plantillaSi && body.plantillaNo && body.guia)
}

/** Crea un ticket con la propuesta, asignado al superadmin, sin descontar cupo del plan. */
async function proponerRespuestaTipo(user: any, body: any) {
  if (user.role !== 'cliente') {
    return NextResponse.json({ error: 'Solo un cliente puede proponer respuestas tipo' }, { status: 403 })
  }

  const { tipologiaCodigo, tipologiaNombre, tipologiaServicio, propuesta } = body
  if (!tipologiaCodigo || !tipologiaNombre || !propuesta?.toString().trim()) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const cliente = await queryOne(
    `SELECT c.id, c.razon_social FROM clientes c WHERE c.user_id = ?`,
    [user.id]
  ) as any
  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const superadmin = await queryOne(
    `SELECT id, nombre, email FROM users WHERE rol = 'admin' AND is_superadmin = 1 AND activo = 1 LIMIT 1`
  ) as any

  const id      = crypto.randomUUID()
  const asunto  = `Propuesta de plantilla PQR — ${tipologiaCodigo} ${tipologiaNombre}`
  const descripcion =
    `Propuesta de nueva respuesta tipo para el Repositorio de PQR.\n\n` +
    `Tipología: ${tipologiaCodigo} — ${tipologiaNombre} (${tipologiaServicio ?? ''})\n\n` +
    `Propuesta del cliente:\n${propuesta.toString().trim()}`

  // No pasa por puedeCrearTicket/incrementarContador: no descuenta cupo del plan.
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

  return NextResponse.json({ ok: true, id }, { status: 201 })
}

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()

  if (body.accion === 'proponer') {
    return proponerRespuestaTipo(user, body)
  }

  if (user.role !== 'admin') return NextResponse.json({ error: 'Solo un administrador puede editar el repositorio' }, { status: 403 })

  if (body.accion === 'crear') {
    if (!validar(body.datos)) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    const id = await crearPqr(body.datos)
    return NextResponse.json({ ok: true, id }, { status: 201 })
  }

  if (body.accion === 'actualizar') {
    if (!body.id || !validar(body.datos)) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    await actualizarPqr(body.id, body.datos)
    return NextResponse.json({ ok: true })
  }

  if (body.accion === 'eliminar') {
    if (!body.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    await eliminarPqr(body.id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
}
