/**
 * GET /api/documentos/zip?clienteId=xxx&anio=2026&trimestre=1
 *
 * Genera y descarga un ZIP con los documentos de acreditación.
 * Estructura interna del ZIP:
 *   {RazonSocial}_{Año}_Q{Trimestre}/
 *     {ASPECTO}/
 *       {Obligacion}/
 *         archivo.pdf
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { documentosParaZip, rutaCompleta } from '@/lib/documentos'
import * as archiver from 'archiver'
import fs from 'fs'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const user = session.user as any

  let clienteId = req.nextUrl.searchParams.get('clienteId')
  const anio    = parseInt(req.nextUrl.searchParams.get('anio') ?? String(new Date().getFullYear()))
  const trimStr = req.nextUrl.searchParams.get('trimestre')
  const trimestre = trimStr ? parseInt(trimStr) : null

  // Cliente solo puede descargar sus propios docs
  if (user.role === 'cliente') {
    const c = db.prepare('SELECT id FROM clientes WHERE user_id = ?').get(user.id) as any
    if (!c) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    clienteId = c.id
  }
  if (!clienteId) return NextResponse.json({ error: 'clienteId requerido' }, { status: 400 })

  const cliente = db.prepare('SELECT razon_social FROM clientes WHERE id = ?').get(clienteId) as any
  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const docs = documentosParaZip(clienteId, anio, trimestre)
  if (docs.length === 0) {
    return NextResponse.json({ error: 'No hay documentos para este período.' }, { status: 404 })
  }

  // Nombre de la carpeta raíz dentro del ZIP
  const slug      = cliente.razon_social.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)
  const periodo   = trimestre ? `${anio}_Q${trimestre}` : String(anio)
  const nombreZip = `${slug}_${periodo}.zip`
  const carpetaRaiz = `${slug}_${periodo}`

  // Construir ZIP en memoria
  const chunks: Buffer[] = []

  await new Promise<void>((resolve, reject) => {
    const archive = (archiver as any).default
      ? (archiver as any).default('zip', { zlib: { level: 6 } })
      : (archiver as any)('zip', { zlib: { level: 6 } })

    archive.on('data',  (chunk: Buffer) => chunks.push(chunk))
    archive.on('end',   resolve)
    archive.on('error', reject)

    for (const doc of docs) {
      const rutaFull = rutaCompleta(doc.ruta)
      if (!fs.existsSync(rutaFull)) continue

      // Ruta dentro del ZIP: CarpetaRaiz/ASPECTO/Obligacion/archivo.pdf
      const rutaZip = [
        carpetaRaiz,
        doc.aspecto.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').trim(),
        doc.obligacion.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').trim().slice(0, 50),
        doc.nombre_archivo,
      ].join('/')

      archive.file(rutaFull, { name: rutaZip })
    }

    archive.finalize()
  })

  const zipBuffer = Buffer.concat(chunks)

  return new NextResponse(zipBuffer, {
    status: 200,
    headers: {
      'Content-Type':        'application/zip',
      'Content-Disposition': `attachment; filename="${nombreZip}"`,
      'Content-Length':      String(zipBuffer.length),
    },
  })
}
