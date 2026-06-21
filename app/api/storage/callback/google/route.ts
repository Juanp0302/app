/**
 * GET /api/storage/callback/google
 * Recibe el código OAuth de Google, intercambia por tokens y los guarda.
 */

import { NextRequest, NextResponse } from 'next/server'
import { execute } from '@/lib/db'

export async function GET(req: NextRequest) {
  const code      = req.nextUrl.searchParams.get('code')
  const stateB64  = req.nextUrl.searchParams.get('state')
  const error     = req.nextUrl.searchParams.get('error')

  const baseUrl   = (process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const redirectOk  = `${baseUrl}/dashboard/clientes?storage=ok&provider=googledrive`
  const redirectErr = `${baseUrl}/dashboard/clientes?storage=error`

  if (error || !code || !stateB64) return NextResponse.redirect(redirectErr)

  let clienteId: string
  try {
    const state = JSON.parse(Buffer.from(stateB64, 'base64url').toString())
    clienteId   = state.clienteId
  } catch {
    return NextResponse.redirect(redirectErr)
  }

  // Intercambiar código por tokens
  const callbackUrl = `${baseUrl}/api/storage/callback/google`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  callbackUrl,
      grant_type:    'authorization_code',
    }),
  })

  if (!res.ok) return NextResponse.redirect(redirectErr)
  const tokens = await res.json()

  const config = JSON.stringify({
    type:          'googledrive',
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expiry:  Date.now() + (tokens.expires_in ?? 3600) * 1000,
  })

  await execute(`UPDATE clientes SET storage_type='googledrive', storage_config=? WHERE id=?`, [config, clienteId])

  return NextResponse.redirect(redirectOk)
}
