/**
 * POST /api/webhooks/trazo-cobros
 * Receptor de eventos de pagos (Cobros) de Trazo — separado del webhook de
 * Suscripciones (/api/trazo/webhook), que sigue intacto.
 *
 * Autenticación: header `X-Trazo-Signature: timestamp=...,signature=...`.
 * Soporte de Trazo confirmó (2026-08-03) que es una validación adicional y
 * que se puede arrancar sin exigirla — por defecto NO se rechaza el evento
 * si la firma no calza, solo se deja un warning en el log. Para exigirla
 * en cuanto se confirme el algoritmo en un caso real, poner
 * TRAZO_COBROS_EXIGIR_FIRMA=true en el entorno.
 *
 * Esta URL hay que compartírsela a soporte de Trazo para que la registren
 * como webhook de eventos de pagos del comercio.
 */
import { NextRequest, NextResponse } from 'next/server'
import { procesarWebhookCobroTrazo, verificarFirmaCobro, type WebhookCobroTrazo } from '@/lib/trazo-cobros-flujo'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  const firmaValida = verificarFirmaCobro(rawBody, req.headers.get('x-trazo-signature'))
  if (!firmaValida) {
    console.warn('[trazo-cobros/webhook] Firma X-Trazo-Signature inválida o ausente — procesando de todas formas (validación no exigida aún, ver TRAZO_COBROS_EXIGIR_FIRMA)')
    if (process.env.TRAZO_COBROS_EXIGIR_FIRMA === 'true') {
      return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
    }
  }

  let payload: WebhookCobroTrazo
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  console.log(`[trazo-cobros/webhook] Evento recibido: ${payload.event?.type}/${payload.event?.status} — ref ${payload.external_reference ?? '?'}`)

  try {
    const resultado = await procesarWebhookCobroTrazo(payload)
    console.log(`[trazo-cobros/webhook] Resultado: ${resultado.accion}${resultado.detalle ? ' — ' + resultado.detalle : ''}`)
    return NextResponse.json({ ok: true, ...resultado })
  } catch (e: any) {
    console.error('[trazo-cobros/webhook] Error procesando evento:', e)
    return NextResponse.json({ error: 'Error procesando el evento' }, { status: 500 })
  }
}
