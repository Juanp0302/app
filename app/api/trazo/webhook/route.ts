/**
 * POST /api/trazo/webhook
 * Receptor de eventos de Trazo (suscripciones y cobros).
 *
 * Autenticación: Trazo envía Authorization: Bearer {auth_key} — el mismo
 * TRAZO_AUTH_KEY de las credenciales (confirmado por soporte 2026-07-30;
 * el esquema client_id/client_secret de la doc es legado).
 *
 * Esta URL hay que compartírsela a soporte de Trazo para que la registren
 * como webhook global del comercio, junto con los eventos a activar
 * (suscripciones: activated/overdue/canceled/fulfilled).
 */
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { procesarWebhookTrazo, type WebhookTrazo } from '@/lib/trazo-flujo'

function autorizado(req: NextRequest): boolean {
  const authKey = process.env.TRAZO_AUTH_KEY?.trim()
  if (!authKey) return false

  const header = (req.headers.get('authorization') ?? '').trim()

  // DIAGNÓSTICO TEMPORAL — quitar una vez se resuelva el 401 con Trazo.
  // No se expone el secreto completo, solo lo necesario para diagnosticar.
  console.warn(`[trazo/webhook][diag] header presente: ${header.length > 0}, longitud: ${header.length}, primeros 15: ${JSON.stringify(header.slice(0, 15))}, empieza con "Bearer ": ${/^bearer\s/i.test(header)}`)

  // Aceptar "Bearer {key}" sin importar mayúsculas/minúsculas en "Bearer" ni
  // espacios extra — variaciones vistas en la práctica entre proveedores.
  const match = header.match(/^bearer\s+(.+)$/i)
  const recibido = (match?.[1] ?? header).trim()

  const a = Buffer.from(recibido)
  const b = Buffer.from(authKey)
  if (a.length !== b.length) {
    console.warn(`[trazo/webhook] Token con longitud distinta a la esperada (recibido: ${a.length}, esperado: ${b.length})`)
    return false
  }
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
