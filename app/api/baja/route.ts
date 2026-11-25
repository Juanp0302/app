/**
 * POST /api/baja?p=<prospecto>&t=<firma>
 * La usan el botón de la página /baja (formulario) y Gmail u Outlook con la cabecera List-Unsubscribe (baja en un clic,
 * RFC 8058). Pública: la firma del enlace es la autorización.
 */
import { NextRequest, NextResponse } from 'next/server'
import { darDeBaja } from '@/lib/baja-db'

export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  let p = url.searchParams.get('p') ?? ''
  let t = url.searchParams.get('t') ?? ''
  const tipo = req.headers.get('content-type') ?? ''
  if ((!p || !t) && (tipo.includes('form') || tipo.includes('urlencoded'))) {
    const f = await req.formData()
    p ||= String(f.get('p') ?? '')
    t ||= String(f.get('t') ?? '')
  }
  const r = await darDeBaja(p, t)
  // Desde el botón de la página se vuelve a ella; desde el correo (un clic) basta con la respuesta.
  if (req.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL(`/baja?resultado=${r}`, req.url), 303)
  }
  return NextResponse.json({ ok: r !== 'invalido', resultado: r }, { status: r === 'invalido' ? 400 : 200 })
}
