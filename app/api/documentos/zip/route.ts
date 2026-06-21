/**
 * GET /api/documentos/zip?clienteId=xxx&anio=2026&trimestre=1&oblIds=a,b,c
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { documentosParaZip } from '@/lib/documentos'
import { getProvider, isCloudRef, localAbsPath } from '@/lib/storage'
import JSZip from 'jszip'
import fs from 'fs'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const user = session.user as any

  let clienteId = req.nextUrl.searchParams.get('clienteId')
  const anio    = parseInt(req.nextUrl.searchParams.get('anio') ?? String(new Date().getFullYear()))
  const trimStr = req.nextUrl.searchParams.get('trimestre')
  const trimestre = trimStr ? parseInt(trimStr) : null

  if (user.role === 'cliente') {
    const c = await queryOne('SELECT id FROM clientes WHERE user_id = ?', [user.id])
    if (!c) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    clienteId = (c as any).id
  }
  if (!clienteId) return NextResponse.json({ error: 'clienteId requerido' }, { status: 400 })

  const cliente = await queryOne('SELECT razon_social FROM clientes WHERE id = ?', [clienteId])
  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const oblIdsParam = req.nextUrl.searchParams.get('oblIds')
  const oblIdsFiltro = oblIdsParam ? new Set(oblIdsParam.split(',').map(s => s.trim()).filter(Boolean)) : null

  let docs = await documentosParaZip(clienteId, anio, trimestre)
  if (oblIdsFiltro && oblIdsFiltro.size > 0)
    docs = docs.filter(d => d.cliente_obl_id && oblIdsFiltro.has(d.cliente_obl_id))

  console.log(`[ZIP] cliente=${clienteId} anio=${anio} trimestre=${trimestre} docs=${docs.length}`)
  if (docs.length === 0)
    return NextResponse.json({ error: 'No hay documentos para este período.' }, { status: 404 })

  const slug      = (cliente as any).razon_social.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)
  const periodo   = trimestre ? `${anio}_Q${trimestre}` : String(anio)
  const nombreZip = `${slug}_${periodo}.zip`
  const carpeta   = `${slug}_${periodo}`

  const provider = getProvider(clienteId)
  const zip = new JSZip()

  for (const doc of docs) {
    try {
      let buffer: Buffer
      if (isCloudRef(doc.ruta)) {
        buffer = await provider.download(doc.ruta)
      } else {
        const fullPath = localAbsPath(clienteId!, doc.ruta)
        if (!fs.existsSync(fullPath)) continue
        buffer = fs.readFileSync(fullPath)
      }
      const rutaZip = [
        carpeta,
        doc.aspecto.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').trim(),
        doc.obligacion.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '').trim().slice(0, 50),
        doc.nombre_archivo,
      ].join('/')
      zip.file(rutaZip, buffer)
    } catch (e) { console.error(`[ZIP] Error incluyendo ${doc.nombre_archivo}:`, e) }
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })

  return new NextResponse(zipBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type':        'application/zip',
      'Content-Disposition': `attachment; filename="${nombreZip}"`,
      'Content-Length':      String(zipBuffer.length),
    },
  })
}
