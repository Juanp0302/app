/**
 * POST /api/mfa/send
 * Body: { email, password }
 *
 * Verifica credenciales rápido, luego genera y envía OTP en paralelo.
 * Devuelve { needsMfa, ok } inmediatamente sin esperar el email.
 */
import { NextRequest, NextResponse } from 'next/server'
import { queryOne, execute } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { enviarEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password)
    return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })

  // 1. Verificar usuario y contraseña (rápido)
  const user = await queryOne(
    'SELECT * FROM users WHERE lower(email) = lower(?) AND activo = 1',
    [email]
  ) as any

  if (!user)
    return NextResponse.json({ needsMfa: false, ok: false })

  const { ok } = await verifyPassword(password, user.password)
  if (!ok)
    return NextResponse.json({ needsMfa: false, ok: false })

  const esAdmin = Number(user.is_superadmin) === 1 || String(user.rol) === 'admin'
  if (!esAdmin)
    return NextResponse.json({ needsMfa: false, ok: true })

  // 2. Generar OTP y guardarlo en DB
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  await execute(
    `UPDATE mfa_tokens SET used = 1 WHERE lower(email) = lower(?) AND used = 0`,
    [email]
  )
  await execute(
    `INSERT INTO mfa_tokens (id, email, code, expires_at)
     VALUES (lower(hex(randomblob(16))), lower(?), ?, ?)`,
    [email, code, expiresAt]
  )

  // 3. Responder al cliente YA — el email se envía sin bloquear
  const response = NextResponse.json({ needsMfa: true, ok: true })

  // Envío en segundo plano (no bloquea la respuesta)
  enviarEmail({
    to: user.email,
    subject: `${code} — Tu código de acceso a Owl Compliance`,
    html: templateMfa({ nombre: user.nombre, code }),
  }).catch(e => console.error('[MFA] Error enviando email:', e))

  return response
}

function templateMfa({ nombre, code }: { nombre: string; code: string }) {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f0e6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#270205;border-radius:12px;overflow:hidden;">
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
      <p style="font-size:12px;color:rgba(231,223,202,0.4);margin:0;line-height:1.6;">Si no solicitaste este código, ignora este mensaje.</p>
    </div>
    <div style="padding:16px 32px;background:rgba(0,0,0,0.3);text-align:center;">
      <div style="font-size:10px;color:rgba(231,223,202,0.3);">Owl Compliance · contacto@owlcompliance.co</div>
    </div>
  </div>
</body>
</html>`
}
