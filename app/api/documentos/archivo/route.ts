/**
 * GET /api/documentos/archivo?docId=xxx
 * Sirve un archivo para previsualización o descarga directa.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { rutaCompleta } from '@/lib/documentos'
import fs from 'fs'
import path from 'path'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const user  = session.user as any
  const docId = req.nextUrl.searchParams.get('docId')
  if (!docId) return NextResponse.json({ error: 'docId requerido' }, { status: 400 })

  const doc = db.prepare(`
    SELECT d.*, c.user_id FROM documentos d JOIN clientes c ON c.id = d.cliente_id WHERE d.id = ?
  `).get(docId) as any
  if (!doc) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (user.role === 'cliente' && doc.user_id !== user.id) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  const ruta = rutaCompleta(doc.ruta)
  if (!fs.existsSync(ruta)) return NextResponse.json({ error: 'Archivo no encontrado en disco' }, { status: 404 })

  const buffer = fs.readFileSync(ruta)
  const ext    = path.extname(doc.nombre_archivo).toLowerCase()
  const mime: Record<string, string> = {
    '.pdf':  'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png':  'image/png',
  }

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':        mime[ext] ?? 'application/octet-stream',
      'Content-Disposition': `inline; filename="${doc.nombre_archivo}"`,
    },
  })
}
