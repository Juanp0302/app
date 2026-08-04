/**
 * lib/wompi.ts
 * Integración con Wompi (Colombia) — Plan B de pasarela de pago mientras se
 * resuelve la integración de Trazo. Ver docs/trazo-integracion.md para el
 * contexto de por qué existe este plan B.
 *
 * A propósito NO usa suscripciones/planes recurrentes de Wompi (esa API es
 * más lenta de integrar bien). Usa el Web Checkout hospedado por Wompi: un
 * simple enlace firmado, sin necesidad de tokenizar tarjetas ni de llamar a
 * ningún endpoint de la API para crear la transacción — Wompi aloja toda la
 * página de pago. Esto es intencional para ser lo más rápido de poner en
 * marcha posible.
 *
 * Variables de entorno requeridas:
 *   WOMPI_PUBLIC_KEY     — llave pública (pub_test_... / pub_prod_...)
 *   WOMPI_INTEGRITY_KEY  — llave de integridad, para firmar cada enlace
 *   WOMPI_EVENTS_KEY     — llave de eventos, para verificar los webhooks
 *   WOMPI_CHECKOUT_URL   — opcional, por defecto https://checkout.wompi.co/p/
 *
 * Nada de este archivo modifica ni depende de lib/trazo.ts.
 */

import crypto from 'crypto'

export function wompiConfigurado(): boolean {
  return Boolean(
    process.env.WOMPI_PUBLIC_KEY &&
    process.env.WOMPI_INTEGRITY_KEY &&
    process.env.WOMPI_EVENTS_KEY
  )
}

function checkoutBaseUrl(): string {
  return (process.env.WOMPI_CHECKOUT_URL ?? 'https://checkout.wompi.co/p/').replace(/\/$/, '') + '/'
}

/**
 * Firma de integridad exigida por Wompi para el Web Checkout:
 * SHA256(reference + amountInCents + currency + integritySecret)
 */
export function firmarIntegridad(reference: string, amountInCents: number, currency = 'COP'): string {
  const secret = process.env.WOMPI_INTEGRITY_KEY
  if (!secret) throw new Error('WOMPI_INTEGRITY_KEY no está configurada')
  const cadena = `${reference}${amountInCents}${currency}${secret}`
  return crypto.createHash('sha256').update(cadena).digest('hex')
}

export interface DatosEnlaceCheckout {
  reference:       string
  amountInCents:   number
  currency?:       string
  redirectUrl?:    string
  expirationTime?: string   // ISO8601
  customerEmail?:  string
  customerFullName?: string
  customerLegalId?:     string
  customerLegalIdType?: 'CC' | 'CE' | 'NIT' | 'PP' | 'TI' | 'DNI' | 'RG' | 'OTHER'
}

/**
 * Construye el enlace del Web Checkout hospedado por Wompi. No requiere
 * ninguna llamada a la API — el usuario simplemente visita este enlace.
 */
export function construirEnlaceCheckout(d: DatosEnlaceCheckout): string {
  const publicKey = process.env.WOMPI_PUBLIC_KEY
  if (!publicKey) throw new Error('WOMPI_PUBLIC_KEY no está configurada')

  const currency  = d.currency ?? 'COP'
  const signature = firmarIntegridad(d.reference, d.amountInCents, currency)

  const params = new URLSearchParams()
  params.set('public-key', publicKey)
  params.set('currency', currency)
  params.set('amount-in-cents', String(d.amountInCents))
  params.set('reference', d.reference)
  params.set('signature:integrity', signature)
  if (d.redirectUrl)          params.set('redirect-url', d.redirectUrl)
  if (d.expirationTime)       params.set('expiration-time', d.expirationTime)
  if (d.customerEmail)        params.set('customer-data:email', d.customerEmail)
  if (d.customerFullName)     params.set('customer-data:full-name', d.customerFullName)
  if (d.customerLegalId)      params.set('customer-data:legal-id', d.customerLegalId)
  if (d.customerLegalIdType)  params.set('customer-data:legal-id-type', d.customerLegalIdType)

  return `${checkoutBaseUrl()}?${params.toString()}`
}

// ── Verificación de webhooks (eventos) ────────────────────────────────────────

export interface WompiEventoWebhook {
  event: string   // 'transaction.updated' | 'nequi_token.updated' | 'bancolombia_transfer_token.updated'
  data: {
    transaction?: {
      id: string
      amount_in_cents: number
      reference: string
      customer_email?: string
      currency: string
      status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR'
      status_message?: string | null
      payment_method_type?: string
    }
  }
  environment: 'test' | 'prod'
  signature: {
    properties: string[]   // ej. ['transaction.id', 'transaction.status', 'transaction.amount_in_cents']
    checksum: string
  }
  timestamp: number
  sent_at: string
}

/** Lee de forma segura una propiedad anidada tipo "transaction.status" del payload. */
function leerPropiedadAnidada(obj: any, ruta: string): unknown {
  return ruta.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj)
}

/**
 * Verifica el checksum SHA256 de un evento de Wompi:
 * SHA256(valores de signature.properties concatenados + timestamp + WOMPI_EVENTS_KEY)
 */
export function verificarFirmaEvento(payload: WompiEventoWebhook): boolean {
  const secret = process.env.WOMPI_EVENTS_KEY
  if (!secret) return false

  const valores = payload.signature.properties
    .map(prop => leerPropiedadAnidada(payload.data, prop))
    .map(v => String(v ?? ''))
    .join('')

  const cadena   = `${valores}${payload.timestamp}${secret}`
  const esperado = crypto.createHash('sha256').update(cadena).digest('hex')

  const a = Buffer.from(esperado)
  const b = Buffer.from(payload.signature.checksum || '')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
