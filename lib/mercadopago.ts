/**
 * lib/mercadopago.ts
 * Cliente liviano para la API de Mercado Pago (subscripciones / preapproval).
 * NO usa el SDK oficial para evitar dependencias innecesarias.
 */

import { PLANES, PlanKey } from './suscripcion'

const BASE = 'https://api.mercadopago.com'

function token() {
  const t = process.env.MP_ACCESS_TOKEN
  if (!t) throw new Error('MP_ACCESS_TOKEN no configurado')
  return t
}

async function mpFetch<T = any>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: object
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`MP API ${method} ${path} → ${res.status}: ${txt}`)
  }
  return res.json()
}

// ── Preapproval (suscripción recurrente) ──────────────────────────────────────

export interface PreapprovalCreado {
  id: string
  init_point: string
  status: string
}

/**
 * Crea una nueva suscripción mensual para un cliente.
 * El cliente es redirigido a init_point para autorizar el cobro recurrente.
 */
export async function crearSuscripcion(opts: {
  planKey:     PlanKey
  clienteId:   string
  payerEmail?: string
  backUrl:     string
}): Promise<PreapprovalCreado> {
  const plan = PLANES[opts.planKey]
  const body: Record<string, any> = {
    preapproval_plan_id: plan.mp_plan_id,
    reason:              `Owl Compliance — Plan ${plan.label}`,
    external_reference:  opts.clienteId,
    back_url:            opts.backUrl,
  }
  if (opts.payerEmail) body.payer_email = opts.payerEmail
  const data = await mpFetch('POST', '/preapproval', body)
  return {
    id:         data.id,
    init_point: data.init_point,
    status:     data.status,
  }
}

/** Obtiene el estado actual de una suscripción por su ID de MP */
export async function obtenerSuscripcion(mpId: string) {
  return mpFetch('GET', `/preapproval/${mpId}`)
}

/** Cancela una suscripción en MP (no se vuelve a cobrar al vencimiento) */
export async function cancelarSuscripcion(mpId: string) {
  return mpFetch('PATCH', `/preapproval/${mpId}`, { status: 'cancelled' })
}

/** Obtiene el estado de un pago por su ID de MP */
export async function obtenerPago(paymentId: string) {
  return mpFetch('GET', `/v1/payments/${paymentId}`)
}
