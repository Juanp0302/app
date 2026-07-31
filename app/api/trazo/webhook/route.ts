/**
 * POST /api/trazo/webhook
 * Receptor de eventos de Trazo (suscripciones y cobros).
 *
 * Autenticación: header personalizado `owl-token` (acordado con soporte de
 * Trazo el 2026-07-31, tras varios intentos fallidos con el esquema
 * Authorization: Bearer {auth_key} que la doc describía — en la práctica el
 * valor que llegaba en el webhook no coincidía con el auth_key de la API).
 * El valor esperado vive en la variable de entorno TRAZO_WEBHOOK_TOKEN.
 *
 * Esta URL hay que compartírsela a soporte de Trazo para que la registren
 * como webhook global del comercio, junto con los eventos a activar
 * (suscripciones: activated/overdue/canceled/fulfilled).
 */
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { procesarWebhookTrazo, type WebhookTrazo } from '@/lib/trazo-flujo'

function autorizado(req: NextRequest): boolean {
  const esperado = process.env.TRAZO_WEBHOOK_TOKEN?.trim()
  if (!esperado) return false

  const recibido = (req.headers.get('owl-token') ?? '').trim()

  const a = Buffer.from(recibido)
  const b = Buffer.from(esperado)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) {
    console.warn('[trazo/webhook] Petición con autenticación inválida')
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let payload: WebhookTrazo
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  console.log(`[trazo/webhook] Evento recibido: ${payload.event?.type}/${payload.event?.status} — ref ${payload.external_reference ?? payload.detail?.subscription_id ?? '?'}`)

  try {
    const resultado = await procesarWebhookTrazo(payload)
    console.log(`[trazo/webhook] Resultado: ${resultado.accion}${resultado.detalle ? ' — ' + resultado.detalle : ''}`)
    return NextResponse.json({ ok: true, ...resultado })
  } catch (e: any) {
    console.error('[trazo/webhook] Error procesando evento:', e)
    return NextResponse.json({ error: 'Error procesando el evento' }, { status: 500 })
  }
}
