/**
 * GET  /api/documentos?clienteId=xxx
 * POST /api/documentos  (multipart/form-data)
 * DELETE /api/documentos?docId=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { guardarDocumento, eliminarDocumento, listarDocumentos } from '@/lib/documentos'

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
    const asp = d.aspecto ?? 'Sin categoría'
    const obl = d.obligacion ?? 'General'
    const key = `${asp}||${obl}||${d.anio}||${d.trimestre ?? 0}`
    if (!arbol[key]) arbol[key] = { aspecto: asp, obligacion: obl, anio: d.anio, trimestre: d.trimestre, archivos: [] }
    arbol[key].archivos.push({
      id: d.id, nombre_archivo: d.nombre_archivo, ruta: d.ruta,
      cliente_obl_id: d.cliente_obl_id, uploaded_at: d.uploaded_at,
      subido_por: d.subido_por_nombre, subido_por_email: d.subido_por_email, periodicidad: d.periodicidad,
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

  return NextResponse.json({ ok: true, docId })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const user = session.user as any

  const docId = req.nextUrl.searchParams.get('docId')
  if (!docId) return NextResponse.json({ error: 'docId requerido' }, { status: 400 })

  const doc = await queryOne('SELECT d.*, c.user_id FROM documentos d JOIN clientes c ON c.id = d.cliente_id WHERE d.id = ?', [docId])
  if (!doc) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (user.role === 'cliente' && (doc as any).user_id !== user.id)
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  await eliminarDocumento(docId, user.id ?? '', user.email ?? '')
  return NextResponse.json({ ok: true })
}
