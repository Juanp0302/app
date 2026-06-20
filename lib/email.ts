/**
 * lib/email.ts
 * Módulo de envío de emails.
 *
 * Usa Resend (resend.com) — free tier: 3.000 emails/mes.
 * Para activar: pon RESEND_API_KEY en .env.local
 *
 * Sin clave configurada, los emails se loguean en consola (modo desarrollo).
 */

export interface EmailParams {
  to:      string | string[]
  subject: string
  html:    string
}

export async function enviarEmail(params: EmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY

  // Sin API key → solo loguear (útil en desarrollo local)
  if (!apiKey || apiKey === 'RE_TEST') {
    console.log('\n📧 EMAIL (modo desarrollo — no enviado):')
    console.log('  Para:   ', Array.isArray(params.to) ? params.to.join(', ') : params.to)
    console.log('  Asunto: ', params.subject)
    console.log('  ─────────────────────────────────')
    return true
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    process.env.EMAIL_FROM ?? 'Owl Compliance <recordatorios@owlcompliance.co>',
        to:      Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        html:    params.html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Error Resend:', err)
      return false
    }
    return true
  } catch (e) {
    console.error('Error enviando email:', e)
    return false
  }
}

// ─── Template de recordatorio ─────────────────────────────────────────────────

export function templateRecordatorio(params: {
  clienteNombre: string
  obligaciones:  { nombre?: string; obligacion?: string; fecha: string; diasRestantes: number; aspecto: string }[]
  diasAntes:     number
  appUrl:        string
}): string {
  const { clienteNombre, obligaciones, diasAntes, appUrl } = params

  const urgenciaTexto = diasAntes === 0
    ? '¡Vence HOY!'
    : diasAntes < 0
    ? `Venció hace ${Math.abs(diasAntes)} día${Math.abs(diasAntes) > 1 ? 's' : ''}`
    : `Vence en ${diasAntes} día${diasAntes > 1 ? 's' : ''}`

  const colorHeader = diasAntes <= 0 ? '#b91c1c' : diasAntes <= 2 ? '#c2410c' : '#92400e'

  const filasObligaciones = obligaciones.map(o => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f0e8d4;font-size:13px;color:#270205;">${o.obligacion ?? o.nombre}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0e8d4;font-size:12px;color:#712529;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">${o.aspecto}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0e8d4;font-size:13px;color:#270205;white-space:nowrap;">${formatFechaEmail(o.fecha)}</td>
    </tr>
  `).join('')

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f0e6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#270205;border-radius:12px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.25);">

    <!-- Header -->
    <div style="background:${colorHeader};padding:28px 32px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.7);margin-bottom:8px;">
        Owl Compliance · Recordatorio de Cumplimiento
      </div>
      <div style="font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
        ${urgenciaTexto}
      </div>
      <div style="font-size:14px;color:rgba(255,255,255,0.8);margin-top:6px;">
        ${obligaciones.length} obligación${obligaciones.length > 1 ? 'es' : ''} requiere${obligaciones.length === 1 ? '' : 'n'} atención
      </div>
    </div>

    <!-- Cliente -->
    <div style="padding:20px 32px;background:rgba(231,223,202,0.06);border-bottom:1px solid rgba(150,134,34,0.2);">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#968622;margin-bottom:4px;">Cliente</div>
      <div style="font-size:16px;font-weight:700;color:#e7dfca;">${clienteNombre}</div>
    </div>

    <!-- Tabla obligaciones -->
    <div style="padding:24px 32px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#968622;margin-bottom:12px;">
        Obligaciones pendientes
      </div>
      <table width="100%" style="border-collapse:collapse;background:#e7dfca;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#968622;">
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#270205;">Obligación</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#270205;">Aspecto</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#270205;">Vencimiento</th>
          </tr>
        </thead>
        <tbody>${filasObligaciones}</tbody>
      </table>
    </div>

    <!-- CTA -->
    <div style="padding:8px 32px 32px;text-align:center;">
      <a href="${appUrl}/dashboard/mapa"
        style="display:inline-block;background:#968622;color:#270205;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:12px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;">
        Ver mapa de cumplimiento
      </a>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;background:rgba(0,0,0,0.3);text-align:center;">
      <div style="font-size:11px;color:rgba(231,223,202,0.4);line-height:1.6;">
        Owl Compliance · Gestión Regulatoria para ISPs en Colombia<br>
        Este es un mensaje automático. No responda a este correo.
      </div>
    </div>
  </div>
</body>
</html>`
}

function formatFechaEmail(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${parseInt(d)} ${meses[parseInt(m)-1]} ${y}`
}
