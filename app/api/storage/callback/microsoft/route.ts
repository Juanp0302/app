/**
 * GET /api/storage/callback/microsoft
 * Recibe el código OAuth de Microsoft, intercambia por tokens y los guarda.
 * Cubre tanto OneDrive como SharePoint (se distingue por el state.provider).
 */

import { NextRequest, NextResponse } from 'next/server'
import { execute } from '@/lib/db'
import { encryptStorageConfig } from '@/lib/storage-crypto'

export async function GET(req: NextRequest) {
  const code      = req.nextUrl.searchParams.get('code')
  const stateB64  = req.nextUrl.searchParams.get('state')
  const error     = req.nextUrl.searchParams.get('error')

  const baseUrl   = (process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const redirectErr = `${baseUrl}/dashboard/clientes?storage=error`

  if (error || !code || !stateB64) return NextResponse.redirect(redirectErr)

  let clienteId: string, provider: string, siteUrl: string, returnPath: string
  try {
    const state = JSON.parse(Buffer.from(stateB64, 'base64url').toString())
    clienteId   = state.clienteId
    provider    = state.provider
    siteUrl     = state.siteUrl ?? ''
    returnPath  = state.returnPath ?? '/dashboard/clientes'
  } catch {
    return NextResponse.redirect(redirectErr)
  }

  const storageType = provider === 'microsoft-sharepoint' ? 'sharepoint' : 'onedrive'
  const redirectOk  = `${baseUrl}${returnPath}?storage=ok&provider=${storageType}`

  // Intercambiar código por tokens
  const callbackUrl = `${baseUrl}/api/storage/callback/microsoft`
  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      redirect_uri:  callbackUrl,
      grant_type:    'authorization_code',
      scope:         storageType === 'sharepoint'
        ? 'Files.ReadWrite Sites.ReadWrite.All offline_access'
        : 'Files.ReadWrite offline_access',
    }),
  })

  if (!res.ok) return NextResponse.redirect(redirectErr)
  const tokens = await res.json()

  const rawConfig: Record<string, any> = {
    type:          storageType,
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expiry:  Date.now() + (tokens.expires_in ?? 3600) * 1000,
  }
  if (storageType === 'sharepoint' && siteUrl) rawConfig.site_url = siteUrl

  const config = encryptStorageConfig(rawConfig)
  await execute(`UPDATE clientes SET storage_type=?, storage_config=? WHERE id=?`, [storageType, JSON.stringify(config), clienteId])

  return NextResponse.redirect(redirectOk)
}
