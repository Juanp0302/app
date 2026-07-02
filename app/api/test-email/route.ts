import { NextRequest, NextResponse } from 'next/server'
import { enviarEmail } from '@/lib/email'

export async function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get('to')
  if (!to) return NextResponse.json({ error: 'Falta ?to=correo' }, { status: 400 })

  const gmailUser = process.env.GMAIL_USER ?? '(no configurado)'
  const gmailPass = process.env.GMAIL_APP_PASSWORD ? '✓ configurado' : '✗ NO configurado'

  const ok = await enviarEmail({
    to,
    subject: 'Prueba de email — Owl Compliance',
    html: '<p>Si recibes este correo, el sistema de email funciona correctamente.</p>',
  })

  return NextResponse.json({ ok, gmailUser, gmailPass })
}
