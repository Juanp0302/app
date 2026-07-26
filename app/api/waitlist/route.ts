/**
 * POST /api/waitlist
 * Endpoint PÚBLICO — registra un interesado en la lista de espera
 * mientras la pasarela de pago (Trazo) no está activa en autoservicio.
 */
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { migrateWaitlist, crearWaitlistEntrada } from '@/lib/waitlist-db'

async function notificarEquipo(opts: { nombre: string; email: string; telefono: string; empresa: string; plan: string }) {
  const gmailUser = process.env.GMAIL_USER
  const gmailPass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '')
  if (!gmailUser || !gmailPass) return

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: gmailUser, pass: gmailPass },
  })

  const superadmin = process.env.SUPERADMIN_EMAIL ?? 'contacto@owlcompliance.com'

  await transporter.sendMail({
    from:    `"Owl Compliance Sistema" <${gmailUser}>`,
    to:      superadmin,
    subject: `[LISTA DE ESPERA] ${opts.nombre} — Plan ${opts.plan || 'sin especificar'}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;">
        <h3 style="color:#712529;">Nuevo interesado en lista de espera</h3>
        <p><strong>Nombre:</strong> ${opts.nombre}</p>
        <p><strong>Correo:</strong> ${opts.email}</p>
        <p><strong>Teléfono:</strong> ${opts.telefono || '—'}</p>
        <p><strong>Empresa:</strong> ${opts.empresa || '—'}</p>
        <p><strong>Plan de interés:</strong> ${opts.plan || '—'}</p>
      </div>`,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const nombre   = (body.nombre   ?? '').toString().trim()
  const email    = (body.email    ?? '').toString().trim()
  const telefono = (body.telefono ?? '').toString().trim()
  const empresa  = (body.empresa  ?? '').toString().trim()
  const plan     = (body.plan     ?? '').toString().trim()

  if (!nombre || !email) {
    return NextResponse.json({ error: 'Nombre y correo son requeridos' }, { status: 400 })
  }

  await migrateWaitlist()
  await crearWaitlistEntrada({ nombre, email, telefono, empresa, plan })

  try {
    await notificarEquipo({ nombre, email, telefono, empresa, plan })
  } catch (e) {
    console.error('[waitlist] Error notificando al equipo:', e)
  }

  return NextResponse.json({ ok: true })
}
