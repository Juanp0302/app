/**
 * POST /api/mfa/send
 * Body: { email, password }
 *
 * 1. Verifica que las credenciales sean correctas.
 * 2. Si el usuario es admin o superadmin, genera un OTP de 6 dígitos,
 *    lo guarda en mfa_tokens (TTL 10 min) y lo envía por email.
 *    Devuelve { needsMfa: true }.
 * 3. Si el usuario es cliente, devuelve { needsMfa: false } — los clientes
 *    no requieren segundo factor.
 */
import { NextRequest, NextResponse } from 'next/server'
import { queryOne, execute } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { enviarEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password)
    return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })

  const user = await queryOne(
    'SELECT id, email, nombre, rol, is_superadmin, password FROM users WHERE lower(email) = lower(?) AND activo = 1',
    [email]
  ) as any

  if (!user)
    return NextResponse.json({ needsMfa: false, ok: false }, { status: 200 })

  const { ok } = await verifyPassword(password, user.password)
  if (!ok)
    return NextResponse.json({ needsMfa: false, ok: false }, { status: 200 })

  const esAdmin = user.rol === 'admin' || user.is_superadmin === 1
  if (!esAdmin)
    return NextResponse.json({ needsMfa: false, ok: true }, { status: 200 })

  // Generar OTP de 6 dígitos
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  // Invalidar OTPs anteriores para este email
  await execute(
    `UPDATE mfa_tokens SET used = 1 WHERE email = lower(?) AND used = 0`,
    [email]
  )

  // Guardar nuevo OTP
  await execute(
    `INSERT INTO mfa_tokens (id, email, code, expires_at)
     VALUES (lower(hex(randomblob(16))), lower(?), ?, ?)`,
    [email, code, expiresAt]
  )

  // Enviar por email
  await enviarEmail({
    to: user.email,
    subject: 'Tu código de verificación — Owl Compliance',
    html: templateMfa({ nombre: user.nombre, code }),
  })

  return NextResponse.json({ needsMfa: true, ok: true })
}

function templateMfa({ nombre, code }: { nombre: string; code: string }) {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f0e6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#270205;border-radius:12px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.25);">
    <div style="background:#712529;padding:24px 32px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.6);margin-bottom:6px;">Owl Compliance · Verificación</div>
      <div style="font-size:18px;font-weight:700;color:#ffffff;">Código de acceso</div>
    </div>
    <div style="padding:32px;">
      <p style="font-size:14px;color:rgba(231,223,202,0.75);margin:0 0 24px;">Hola ${nombre}, usa este código para completar tu inicio de sesión:</p>
      <div style="background:rgba(150,134,34,0.15);border:1px solid rgba(150,134,34,0.4);border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
        <div style="font-size:36px;font-weight:700;letter-spacing:0.35em;color:#e7dfca;font-family:monospace;">${code}</div>
        <div style="font-size:11px;color:rgba(231,223,202,0.4);margin-top:8px;">Válido por 10 minutos</div>
      </div>
      <p style="font-size:12px;color:rgba(231,223,202,0.4);margin:0;line-height:1.6;">Si no solicitaste este código, ignora este mensaje. Tu cuenta sigue protegida.</p>
    </div>
    <div style="padding:16px 32px;background:rgba(0,0,0,0.3);text-align:center;">
      <div style="font-size:10px;color:rgba(231,223,202,0.3);">Owl Compliance · contacto@owlcompliance.co</div>
    </div>
  </div>
</body>
</html>`
}
