/**
 * GET  /api/documentos?clienteId=xxx
 * POST /api/documentos  (multipart/form-data)
 * DELETE /api/documentos?docId=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { guardarDocumento, eliminarDocumento, eliminarDocumentosMasivo, listarDocumentos, revisarDocumento, type BorradoScope } from '@/lib/documentos'
import { notificarDocumentoSubido, notificarRevisionDocumento } from '@/lib/notificaciones'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const user = session.user as any

  let clienteId = req.nextUrl.searchParams.get('clienteId')
  if (user.role === 'cliente') {
    const c = await queryOne('SELECT id FROM clientes WHERE user_id = ?', [user.id])
    if (!c) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    clienteId = (c as any).id
  }
  if (!clienteId) return NextResponse.json({ error: 'clienteId requerido' }, { status: 400 })

  const docs = await listarDocumentos(clienteId)

  const arbol: Record<string, any> = {}
  for (const d of docs) {
    const serv = (d as any).servicio ?? ''
    const asp  = (d as any).aspecto  ?? 'Sin categoría'
    const obl  = (d as any).obligacion ?? 'General'
    const key  = `${serv}||${asp}||${obl}||${d.anio}||${(d as any).trimestre ?? 0}`
    if (!arbol[key]) arbol[key] = {
      servicio: serv, aspecto: asp, obligacion: obl,
      anio: d.anio, trimestre: (d as any).trimestre, archivos: [],
    }
    arbol[key].archivos.push({
      id: d.id, nombre_archivo: (d as any).nombre_archivo, ruta: (d as any).ruta,
      cliente_obl_id: (d as any).cliente_obl_id, uploaded_at: (d as any).uploaded_at,
      subido_por: (d as any).subido_por_nombre, subido_por_email: (d as any).subido_por_email,
      periodicidad: (d as any).periodicidad,
      estado_revision:      (d as any).estado_revision      ?? 'pendiente',
      revision_comentario:  (d as any).revision_comentario  ?? null,
      revisado_por_nombre:  (d as any).revisado_por_nombre  ?? null,
      revisado_at:          (d as any).revisado_at          ?? null,
    })
  }

  return NextResponse.json({ total: docs.length, grupos: Object.values(arbol) })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const user = session.user as any

  const form = await req.formData()
  let clienteId      = form.get('clienteId') as string
  const clienteOblId = form.get('clienteOblId') as string | null
  const aspecto      = form.get('aspecto') as string
  const obligacion   = form.get('obligacion') as string
  const anio         = parseInt(form.get('anio') as string)
  const trimestre    = form.get('trimestre') ? parseInt(form.get('trimestre') as string) : null
  const archivo      = form.get('archivo') as File

  if (user.role === 'cliente') {
    const c = await queryOne('SELECT id FROM clientes WHERE user_id = ?', [user.id])
    if (!c) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    clienteId = (c as any).id
  }

  if (!clienteId || !aspecto || !obligacion || !anio || !archivo)
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })

  const tiposPermitidos = ['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/msword','image/jpeg','image/png','application/octet-stream','']
  const extensionesPermitidas: Record<string, string> = {
    pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  }
  const ext = archivo.name.split('.').pop()?.toLowerCase() ?? ''
  const mimeEfectivo = (archivo.type && archivo.type !== 'application/octet-stream')
    ? archivo.type
    : extensionesPermitidas[ext] ?? archivo.type
  if (!tiposPermitidos.includes(archivo.type) && !extensionesPermitidas[ext])
    return NextResponse.json({ error: 'Tipo de archivo no permitido. Use PDF, Word, Excel o imágenes.' }, { status: 400 })
  if (archivo.size > 20 * 1024 * 1024)
    return NextResponse.json({ error: 'El archivo no puede superar 20 MB.' }, { status: 400 })

  const buffer = Buffer.from(await archivo.arrayBuffer())
  const docId = await guardarDocumento({ clienteId, clienteOblId: clienteOblId || null, aspecto, obligacion, anio, trimestre, nombreArchivo: archivo.name, mimeType: mimeEfectivo, buffer, userId: user.id ?? '', userEmail: user.email ?? '' })

  // Notificar a todos los admins activos
  const clienteRow = await queryOne('SELECT razon_social FROM clientes WHERE id = ?', [clienteId])
  const admins = await query('SELECT email FROM users WHERE rol = ? AND activo = 1', ['admin'])
  notificarDocumentoSubido({
    docId,
    cliente:       (clienteRow as any)?.razon_social ?? '',
    aspecto,
    obligacion,
    nombreArchivo: archivo.name,
    adminEmails:   (admins as any[]).map(a => a.email).filter(Boolean),
    fecha:         new Date().toLocaleString('es-CO'),
  })

  return NextResponse.json({ ok: true, docId })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const user = session.user as any

  const params   = req.nextUrl.searchParams
  const docId    = params.get('docId')
  const scope    = params.get('scope') as BorradoScope | null
  let   clienteId = params.get('clienteId')

  // ── Eliminación individual ──────────────────────────────────────────────────
  if (docId) {
    const doc = await queryOne('SELECT d.*, c.user_id FROM documentos d JOIN clientes c ON c.id = d.cliente_id WHERE d.id = ?', [docId])
    if (!doc) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    if (user.role === 'cliente' && (doc as any).user_id !== user.id)
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
    await eliminarDocumento(docId, user.id ?? '', user.email ?? '')
    return NextResponse.json({ ok: true })
  }

  // ── Eliminación masiva ──────────────────────────────────────────────────────
  if (!scope) return NextResponse.json({ error: 'docId o scope requerido' }, { status: 400 })

  if (user.role === 'cliente') {
    const c = await queryOne('SELECT id FROM clientes WHERE user_id = ?', [user.id])
    if (!c) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    clienteId = (c as any).id
  }
  if (!clienteId) return NextResponse.json({ error: 'clienteId requerido' }, { status: 400 })

  const filtros = {
    servicio:   params.get('servicio')   ?? undefined,
    aspecto:    params.get('aspecto')    ?? undefined,
    obligacion: params.get('obligacion') ?? undefined,
  }

  const eliminados = await eliminarDocumentosMasivo(
    clienteId, scope, filtros, user.id ?? '', user.email ?? ''
  )
  return NextResponse.json({ ok: true, eliminados })
}

/**
 * PATCH /api/documentos
 * body: { docId, aprobado: boolean, comentario?: string }
 * Solo admins y superadmin pueden revisar.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const user = session.user as any
  if (user.role === 'cliente') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const { docId, aprobado, comentario } = await req.json()
  if (!docId || typeof aprobado !== 'boolean')
    return NextResponse.json({ error: 'docId y aprobado requeridos' }, { status: 400 })
  if (!aprobado && !comentario?.trim())
    return NextResponse.json({ error: 'El motivo de rechazo es obligatorio' }, { status: 400 })

  await revisarDocumento(docId, user.id ?? '', user.email ?? '', aprobado, comentario ?? '')

  // Notificar al cliente
  const doc = await queryOne(`
    SELECT d.nombre_archivo, d.aspecto, d.obligacion,
           c.razon_social, u.email AS cliente_email, u.nombre AS admin_nombre
    FROM documentos d
    JOIN clientes c ON c.id = d.cliente_id
    JOIN users cu ON cu.id = c.user_id
    LEFT JOIN users u ON u.id = d.revisado_por
    WHERE d.id = ?
  `, [docId]) as any
  if (doc?.cliente_email) {
    notificarRevisionDocumento({
      docId,
      cliente:       doc.razon_social  ?? '',
      cliente_email: doc.cliente_email,
      aspecto:       doc.aspecto       ?? '',
      obligacion:    doc.obligacion    ?? '',
      nombreArchivo: doc.nombre_archivo ?? '',
      aprobado,
      comentario:    comentario ?? '',
      adminNombre:   user.email ?? '',
      fecha:         new Date().toLocaleString('es-CO'),
    })
  }

  return NextResponse.json({ ok: true })
}
