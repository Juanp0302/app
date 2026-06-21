/**
 * GET /api/storage/auth/[provider]?clienteId=xxx&siteUrl=xxx
 *
 * Redirige al flujo OAuth del proveedor:
 *   provider = google | microsoft-onedrive | microsoft-sharepoint
 *
 * El siteUrl solo es necesario para sharepoint.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'admin') return NextResponse.json({ error: 'Solo admin' }, { status: 403 })

  const { provider } = await params
  const clienteId = req.nextUrl.searchParams.get('clienteId')
  const siteUrl   = req.nextUrl.searchParams.get('siteUrl') ?? ''
  if (!clienteId) return NextResponse.json({ error: 'clienteId requerido' }, { status: 400 })

  const baseUrl  = (process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const state    = Buffer.from(JSON.stringify({ clienteId, provider, siteUrl })).toString('base64url')

  if (provider === 'google') {
    const callbackUrl = `${baseUrl}/api/storage/callback/google`
    const params = new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      redirect_uri:  callbackUrl,
      response_type: 'code',
      scope:         'https://www.googleapis.com/auth/drive.file',
      access_type:   'offline',
      prompt:        'consent',
      state,
    })
    return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  }

  if (provider.startsWith('microsoft')) {
    const callbackUrl = `${baseUrl}/api/storage/callback/microsoft`
    const scopes = provider === 'microsoft-sharepoint'
      ? 'Files.ReadWrite Sites.ReadWrite.All offline_access'
      : 'Files.ReadWrite offline_access'

    const params = new URLSearchParams({
      client_id:     process.env.MICROSOFT_CLIENT_ID!,
      redirect_uri:  callbackUrl,
      response_type: 'code',
      scope:         scopes,
      state,
    })
    return NextResponse.redirect(
      `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`
    )
  }

  return NextResponse.json({ error: `Proveedor desconocido: ${provider}` }, { status: 400 })
}
