/**
 * GET /api/documentos/archivo?docId=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { isCloudRef } from '@/lib/storage'
import { descargarDocumento } from '@/lib/documentos'
import path from 'path'

const MIME: Record<string, string> = {
  '.pdf':  'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.doc':  'application/msword',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const user  = session.user as any
  const docId = req.nextUrl.searchParams.get('docId')
  if (!docId) return NextResponse.json({ error: 'docId requerido' }, { status: 400 })

  const doc = await queryOne('SELECT d.*, c.user_id FROM documentos d JOIN clientes c ON c.id = d.cliente_id WHERE d.id = ?', [docId])
  if (!doc) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (user.role === 'cliente' && (doc as any).user_id !== user.id)
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  if (isCloudRef((doc as any).ruta)) {
    // Siempre descargamos server-side usando el token OAuth del servidor.
    let result: { buffer: Buffer; nombre: string } | null = null
    try {
      result = await descargarDocumento(docId)
    } catch (e: any) {
      console.error('[archivo] Error descargando de proveedor cloud:', e?.message)
      return NextResponse.json({ error: `Error al descargar del proveedor: ${e?.message}` }, { status: 502 })
    }
    if (!result) return NextResponse.json({ error: 'No se pudo obtener el archivo' }, { status: 500 })

    // Validar que el buffer no sea una respuesta de error de Google (HTML/JSON)
    const inicio = result.buffer.slice(0, 5).toString('utf8')
    if (inicio === '<' || inicio.startsWith('{')) {
      const preview = result.buffer.slice(0, 300).toString('utf8')
      console.error('[archivo] Proveedor devolvió contenido no válido:', preview)
      return NextResponse.json({ error: 'El proveedor devolvió un error. El token puede haber expirado — reconecta Google Drive desde Configuración.' }, { status: 502 })
    }

    const ext = path.extname(result.nombre).toLowerCase()
    return new NextResponse(result.buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':        MIME[ext] ?? 'application/octet-stream',
        'Content-Disposition': `inline; filename="${result.nombre}"`,
        'Cache-Control':       'private, max-age=300',
      },
    })
  }

  const result = await descargarDocumento(docId)
  if (!result) return NextResponse.json({ error: 'Archivo no encontrado en disco' }, { status: 404 })
  const ext = path.extname(result.nombre).toLowerCase()
  return new NextResponse(result.buffer as unknown as BodyInit, {
    status: 200,
    headers: { 'Content-Type': MIME[ext] ?? 'application/octet-stream', 'Content-Disposition': `inline; filename="${result.nombre}"` },
  })
}
