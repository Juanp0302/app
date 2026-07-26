/**
 * /api/pqr
 * Repositorio de PQR — lectura para cualquier usuario autenticado
 * (cliente, admin, superadmin). Escritura (crear/actualizar/eliminar)
 * reservada a administradores, que curan el contenido compartido.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listarPqr, obtenerPqr, crearPqr, actualizarPqr, eliminarPqr, PqrData } from '@/lib/pqr-db'

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

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (user.role !== 'admin') return NextResponse.json({ error: 'Solo un administrador puede editar el repositorio' }, { status: 403 })

  const body = await req.json()

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
