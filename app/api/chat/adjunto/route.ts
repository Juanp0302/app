/**
 * POST /api/chat/adjunto  (multipart/form-data: conversacionId, contenido?, archivo)
 *   → sube un archivo adjunto como mensaje del chat
 * GET  /api/chat/adjunto?mensajeId=xxx
 *   → descarga el adjunto de un mensaje
 */
import { NextRequest, NextResponse } from 'next/server'
import { queryOne, execute } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth-any'
import { notificarPush } from '@/lib/push-notify'
import { validarArchivoAdjunto, subirAdjunto, descargarAdjunto } from '@/lib/adjuntos'
import crypto from 'crypto'
import path from 'path'

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.doc': 'application/msword',
  '.xls': 'application/vnd.ms-excel', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const form = await req.formData()
  const conversacionId = form.get('conversacionId') as string
  const contenido       = (form.get('contenido') as string | null) ?? ''
  const archivo          = form.get('archivo') as File | null

  if (!conversacionId || !archivo) return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })

  const conv = await queryOne('SELECT * FROM conversaciones WHERE id = ?', [conversacionId]) as any
  if (!conv) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  if (user.role === 'cliente') {
    const c = await queryOne('SELECT id FROM clientes WHERE user_id = ?', [user.id]) as any
    if (!c || c.id !== conv.cliente_id) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  } else if (user.role === 'admin' && !user.is_superadmin) {
    if (conv.admin_id && conv.admin_id !== user.id) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  const errorValidacion = validarArchivoAdjunto(archivo)
  if (errorValidacion) return NextResponse.json({ error: errorValidacion }, { status: 400 })

  const subido = await subirAdjunto({ clienteId: conv.cliente_id, carpeta: `chat/${conversacionId}`, archivo })

  const id = crypto.randomUUID()
  await execute(
    `INSERT INTO mensajes (id, conversacion_id, user_id, contenido, archivo_ref, archivo_nombre, archivo_mime, archivo_tamano)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id, conversacionId, user.id, contenido.trim() || `📎 ${subido.nombre}`, subido.ref, subido.nombre, subido.mime, subido.tamano]
  )
  await execute(`UPDATE conversaciones SET updated_at = datetime('now') WHERE id = ?`, [conversacionId])

  if (user.role === 'cliente' && conv.admin_id) {
    const cliente = await queryOne('SELECT razon_social FROM clientes WHERE id = ?', [conv.cliente_id]) as any
    notificarPush(conv.admin_id, {
      titulo: `Nuevo adjunto de ${cliente?.razon_social ?? 'un cliente'}`,
      cuerpo: subido.nombre,
      data: { tipo_entidad: 'chat', id: conversacionId },
    })
  }

  return NextResponse.json({ ok: true, id })
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const mensajeId = req.nextUrl.searchParams.get('mensajeId')
  if (!mensajeId) return NextResponse.json({ error: 'mensajeId requerido' }, { status: 400 })

  const msg = await queryOne(
    `SELECT m.*, c.cliente_id, c.admin_id FROM mensajes m JOIN conversaciones c ON c.id = m.conversacion_id WHERE m.id = ?`,
    [mensajeId]
  ) as any
  if (!msg || !msg.archivo_ref) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  if (user.role === 'cliente') {
    const c = await queryOne('SELECT id FROM clientes WHERE user_id = ?', [user.id]) as any
    if (!c || c.id !== msg.cliente_id) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  } else if (user.role === 'admin' && !user.is_superadmin) {
    if (msg.admin_id && msg.admin_id !== user.id) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  const buffer = await descargarAdjunto(msg.cliente_id, msg.archivo_ref)
  const ext = path.extname(msg.archivo_nombre).toLowerCase()
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': MIME[ext] ?? msg.archivo_mime ?? 'application/octet-stream',
      'Content-Disposition': `inline; filename="${msg.archivo_nombre}"`,
    },
  })
}
