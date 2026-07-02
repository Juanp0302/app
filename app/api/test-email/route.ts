import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get('to')
  if (!to) return NextResponse.json({ error: 'Falta ?to=correo' }, { status: 400 })

  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '')

  if (!user || !pass) {
    return NextResponse.json({ error: 'Variables no configuradas', user, pass: !!pass })
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user, pass },
    })
    await transporter.verify()
    const info = await transporter.sendMail({
      from: `"Owl Compliance" <${user}>`,
      to,
      subject: 'Prueba de email — Owl Compliance',
      html: '<p>Si recibes este correo, el sistema funciona.</p>',
    })
    return NextResponse.json({ ok: true, messageId: info.messageId })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) })
  }
}
