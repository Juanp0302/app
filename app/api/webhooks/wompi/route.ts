/**
 * POST /api/webhooks/wompi
 * Receptor de eventos de Wompi (Plan B de pasarela, ver lib/wompi-flujo.ts).
 *
 * Autenticación: la firma SHA256 va DENTRO del cuerpo del evento
 * (payload.signature.checksum), no en un header — se verifica en
 * verificarFirmaEvento() antes de actuar sobre el evento.
 *
 * Esta URL hay que configurarla en el panel de comercios de Wompi
 * (comercios.wompi.co) como webhook del comercio.
 */
import { NextRequest, NextResponse } from 'next/server'
import { procesarWebhookWompi } from '@/lib/wompi-flujo'
import type { WompiEventoWebhook } from '@/lib/wompi'

export async function POST(req: NextRequest) {
  let payload: WompiEventoWebhook
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  console.log(`[wompi/webhook] Evento recibido: ${payload.event} — ref ${payload.data?.transaction?.reference ?? '?'}`)

  try {
    const resultado = await procesarWebhookWompi(payload)
    console.log(`[wompi/webhook] Resultado: ${resultado.accion}${resultado.detalle ? ' — ' + resultado.detalle : ''}`)
    // Wompi solo exige un 200; el cuerpo de la respuesta no se evalúa.
    return NextResponse.json({ ok: true, ...resultado })
  } catch (e: any) {
    console.error('[wompi/webhook] Error procesando evento:', e)
    return NextResponse.json({ error: 'Error procesando el evento' }, { status: 500 })
  }
}
