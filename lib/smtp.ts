/**
 * lib/smtp.ts
 * Envío directo por el SMTP de Gmail (GMAIL_USER + GMAIL_APP_PASSWORD, la contraseña de aplicación que ya usa el contrato).
 * Se usa para los correos de venta porque permite adjuntos, hilos (In-Reply-To) y la cabecera de baja, cosas que el
 * webhook de n8n no maneja. Sin las variables, no envía y lo dice.
 */
import nodemailer from 'nodemailer'

let transporte: nodemailer.Transporter | null = null

export const cuentaCorreo = () => process.env.GMAIL_USER ?? null

function obtenerTransporte() {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '')
  if (!user || !pass) return null
  transporte ??= nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass } })
  return transporte
}

export interface CorreoSmtp {
  para: string
  asunto: string
  html: string
  texto?: string
  /** Nombre que ve el destinatario ("Adriana · Owl Compliance"); la dirección es siempre GMAIL_USER. */
  nombreRemitente?: string
  responderA?: string
  enRespuestaA?: string | null
  cabeceras?: Record<string, string>
  adjuntos?: { filename: string; content: Buffer; contentType?: string }[]
}

export async function enviarSmtp(c: CorreoSmtp): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const t = obtenerTransporte()
  if (!t) return { ok: false, error: 'GMAIL_USER o GMAIL_APP_PASSWORD no configurados' }
  try {
    const info = await t.sendMail({
      from: { name: c.nombreRemitente ?? 'Owl Compliance', address: process.env.GMAIL_USER! },
      to: c.para,
      subject: c.asunto,
      html: c.html,
      text: c.texto,
      replyTo: c.responderA,
      inReplyTo: c.enRespuestaA ?? undefined,
      references: c.enRespuestaA ?? undefined,
      headers: c.cabeceras,
      attachments: c.adjuntos,
    })
    return { ok: true, messageId: info.messageId }
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e).slice(0, 500) }
  }
}
