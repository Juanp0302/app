/**
 * Webhook de la API oficial de WhatsApp (Meta). Fase 3 de docs/automatizacion-ventas.md.
 * GET  — verificación que hace Meta al configurar el webhook (hub.verify_token = WHATSAPP_VERIFY_TOKEN).
 * POST — mensajes que llegan al WhatsApp de Owl y estados de los que enviamos. Solo se acepta con la firma de Meta
 *        (X-Hub-Signature-256 con WHATSAPP_APP_SECRET). Siempre responde 200 a lo que viene de Meta, aunque algo falle por
 *        dentro: si no, Meta reintenta durante horas; el fallo se avisa al superadmin.
 *        Con IA_VENTAS encendida, la IA (lib/ia-ventas.ts) contesta después de responderle a Meta.
 */
import { NextRequest, NextResponse, after } from 'next/server'
import { firmaWebhookValida, leerWebhook, numerosDelWebhook } from '@/lib/whatsapp-api'
import { procesarMensajeWhatsApp, procesarEstadoWhatsApp } from '@/lib/whatsapp-ventas'
import { alertar } from '@/lib/ventas-auto'
import { atenderConIA } from '@/lib/ia-ventas'

/** La IA espera unos segundos (por si llegan varios mensajes seguidos) y luego llama a Claude: hasta ~1 min por webhook. */
export const maxDuration = 120

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const esperado = process.env.WHATSAPP_VERIFY_TOKEN
  if (q.get('hub.mode') === 'subscribe' && esperado && q.get('hub.verify_token') === esperado) {
    return new NextResponse(q.get('hub.challenge') ?? '', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }
  return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  const cuerpo = await req.text()
  const secreto = process.env.WHATSAPP_APP_SECRET
  if (!secreto) {
    await alertar('falta WHATSAPP_APP_SECRET', 'Llegó un webhook de WhatsApp y no se puede comprobar que venga de Meta. Los mensajes de WhatsApp no se están guardando.').catch(() => null)
    return NextResponse.json({ error: 'Webhook sin configurar' }, { status: 503 })
  }
  const firma = req.headers.get('x-hub-signature-256')
  if (!firmaWebhookValida(cuerpo, firma, secreto)) {
    console.warn(`[whatsapp] webhook rechazado: ${firma ? 'firma que no coincide' : 'sin firma'}`)
    // Si viene firmado y no coincide, casi siempre es WHATSAPP_APP_SECRET mal copiado: avisar (una vez al día).
    if (firma) await alertar('los mensajes de WhatsApp llegan con una firma que no coincide',
      'Meta está enviando mensajes, pero la firma no coincide con WHATSAPP_APP_SECRET. Revisa en Render que sea la "Clave secreta" de la app Owl Compliance Ventas (developers.facebook.com → Configuración de la app → Básica). Mientras tanto, los WhatsApp no se están guardando.').catch(() => null)
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  }

  let payload: any
  try { payload = JSON.parse(cuerpo) } catch { return NextResponse.json({ ok: true }) }
  const phoneId = process.env.WHATSAPP_PHONE_ID
  const otros = numerosDelWebhook(payload).filter(id => id !== phoneId)
  if (otros.length) {
    console.warn(`[whatsapp] webhook de otro número: ${otros.join(', ')} (WHATSAPP_PHONE_ID=${phoneId ?? 'sin definir'})`)
    await alertar('llegan WhatsApp de un número que no es el configurado',
      `Llegó un webhook del número con ID ${otros.join(', ')}, pero WHATSAPP_PHONE_ID en Render es ${phoneId ?? '(sin definir)'}. Si ese es el número de Owl (+57 301 238 8989), corrige WHATSAPP_PHONE_ID. Mientras tanto, esos mensajes se ignoran.`).catch(() => null)
  }
  const { mensajes, estados } = leerWebhook(payload, phoneId)
  if (mensajes.length || estados.length) console.log(`[whatsapp] ${mensajes.length} mensaje(s), ${estados.length} estado(s)`)
  const errores: string[] = []
  const paraIA: string[] = []
  for (const m of mensajes) {
    try {
      const r = await procesarMensajeWhatsApp(m)
      if (r.paraIA) paraIA.push(m.wamid)
    } catch (e: any) { errores.push(`${m.wamid}: ${e?.message ?? e}`) }
  }
  for (const s of estados) {
    try { await procesarEstadoWhatsApp(s) } catch (e: any) { errores.push(`${s.wamid}: ${e?.message ?? e}`) }
  }
  if (errores.length) {
    await alertar('no se pudo procesar un mensaje de WhatsApp', errores.join('\n')).catch(() => null)
  }
  // La IA responde después de contestarle a Meta (Meta espera un 200 rápido).
  if (paraIA.length) {
    after(async () => {
      for (const wamid of paraIA) {
        await atenderConIA(wamid).catch(e => alertar('la IA no pudo atender un WhatsApp', String(e?.message ?? e)).catch(() => null))
      }
    })
  }
  return NextResponse.json({ ok: true })
}
