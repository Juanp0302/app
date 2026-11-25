/**
 * GET /r/<token> — la radiografía regulatoria de un prospecto, para el botón "Ver la radiografía" de la plantilla de
 * WhatsApp owl_radiografia (lib/plantillas-whatsapp.ts). Público, pero el token va firmado: no se puede adivinar el de otro.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prospectoDelToken } from '@/lib/plantillas-whatsapp'
import { obtenerRadiografia } from '@/lib/radiografias'
import { buscarProspecto } from '@/lib/prospectos-db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const id = prospectoDelToken(decodeURIComponent(token))
  if (!id) return new NextResponse('Enlace no válido', { status: 404 })
  const [r, p] = await Promise.all([obtenerRadiografia(id), buscarProspecto(id)])
  if (!r) return new NextResponse('Esta radiografía ya no está disponible. Escríbenos por WhatsApp y te la enviamos.', { status: 404 })
  const nombre = `Radiografía regulatoria - ${p?.empresa ?? 'Owl Compliance'}.pdf`.replace(/[\/:*?"<>|]/g, '')
  return new NextResponse(r.contenido as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  })
}
