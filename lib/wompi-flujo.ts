/**
 * lib/wompi-flujo.ts
 * Flujo de negocio de Wompi para Owl Compliance — Plan B mientras se resuelve
 * la integración de Trazo (ver docs/trazo-integracion.md).
 *
 * Modelo (2026-08-03): SIN suscripciones/cobro recurrente automático. Cada
 * pago (el inicial del contrato, y cada mensualidad posterior) es un enlace
 * de Web Checkout independiente, firmado con la llave de integridad. Cuando
 * el webhook confirma 'APPROVED' se activa la cuenta del cliente (mismo
 * helper que usa el flujo de Trazo) o, si el cliente ya existe, se marca la
 * suscripción como activa. Los cobros mensuales siguientes se generan
 * manualmente (o desde un cron simple más adelante) llamando de nuevo a
 * crearPagoWompi() — no depende de nada de este archivo estar "recurrente".
 *
 * Este archivo NO modifica ni importa nada de lib/trazo.ts / lib/trazo-flujo.ts.
 *
 * Variables de entorno: ver lib/wompi.ts (WOMPI_PUBLIC_KEY, WOMPI_INTEGRITY_KEY,
 * WOMPI_EVENTS_KEY).
 */

import crypto from 'crypto'
import { wompiConfigurado, construirEnlaceCheckout, verificarFirmaEvento, type WompiEventoWebhook } from './wompi'
import { PLANES, type PlanKey } from './suscripcion'
import { guardarPagoWompi, buscarPagoWompi, actualizarPagoWompi } from './wompi-db'
import { queryOne, execute } from './db'

export { wompiConfigurado }

const APP_URL = (process.env.NEXTAUTH_URL ?? 'https://app.owlcompliance.com').replace(/\/$/, '')

export interface DatosContratoParaWompi {
  plan:                 PlanKey
  nombreCliente:        string
  numeroIdentificacion: string
  tipoIdentificacion:   string
  email:                string
  contratoDatos?:       object   // formulario completo, para trazabilidad
  montoOverride?:       number   // monto ya con descuento aplicado (ver lib/codigos-descuento.ts) — si falta, se usa el precio de lista del plan
}

function mapLegalIdType(tipo: string): 'CC' | 'CE' | 'NIT' | 'PP' {
  const t = (tipo || '').toUpperCase()
  if (t === 'CE') return 'CE'
  if (t === 'NIT') return 'NIT'
  if (t === 'PASAPORTE') return 'PP'
  return 'CC'
}

/**
 * Genera un enlace de pago único (Web Checkout de Wompi) para el primer pago
 * del contrato y lo guarda en seguimiento local en estado 'pendiente'.
 */
export async function crearPagoWompiParaContrato(datos: DatosContratoParaWompi): Promise<{
  reference:   string
  checkoutUrl: string
}> {
  const planInfo = PLANES[datos.plan]
  if (!planInfo) throw new Error(`Plan inválido: ${datos.plan}`)

  const reference = `OWL-${datos.plan}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
  const monto      = datos.montoOverride ?? planInfo.precio

  const checkoutUrl = construirEnlaceCheckout({
    reference,
    amountInCents: monto * 100,
    redirectUrl:   `${APP_URL}/pago-exitoso`,
    customerEmail: datos.email,
    customerFullName: datos.nombreCliente,
    customerLegalId: datos.numeroIdentificacion,
    customerLegalIdType: mapLegalIdType(datos.tipoIdentificacion),
  })

  await guardarPagoWompi({
    reference,
    plan: datos.plan,
    monto,
    checkout_url: checkoutUrl,
    cliente_email: datos.email,
    cliente_nombre: datos.nombreCliente,
    contrato_datos: datos.contratoDatos ?? null,
  })

  return { reference, checkoutUrl }
}

/**
 * Genera el enlace de un cobro mensual posterior (renovación) para un
 * cliente que ya tiene cuenta. Pensado para llamarse manualmente o desde un
 * cron sencillo más adelante — no hay automatización de recurrencia todavía.
 */
export async function crearPagoWompiRenovacion(datos: {
  clienteId: string
  plan: PlanKey
  nombreCliente: string
  email: string
}): Promise<{ reference: string; checkoutUrl: string }> {
  const planInfo = PLANES[datos.plan]
  if (!planInfo) throw new Error(`Plan inválido: ${datos.plan}`)

  const reference   = `OWL-${datos.plan}-RENOV-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
  const monto       = planInfo.precio
  const checkoutUrl = construirEnlaceCheckout({
    reference,
    amountInCents: monto * 100,
    redirectUrl:   `${APP_URL}/pago-exitoso`,
    customerEmail: datos.email,
    customerFullName: datos.nombreCliente,
  })

  await guardarPagoWompi({
    reference,
    plan: datos.plan,
    monto,
    checkout_url: checkoutUrl,
    cliente_email: datos.email,
    cliente_nombre: datos.nombreCliente,
    cliente_id: datos.clienteId,
  })

  return { reference, checkoutUrl }
}

// ── Procesamiento del webhook ─────────────────────────────────────────────────

export interface ResultadoWebhookWompi { accion: string; detalle?: string }

/**
 * Verifica la firma y procesa un evento 'transaction.updated' de Wompi.
 * Devuelve { accion: 'ignorado' } para cualquier evento que no debamos
 * procesar (evento distinto, firma inválida, o reference desconocida).
 */
export async function procesarWebhookWompi(payload: WompiEventoWebhook): Promise<ResultadoWebhookWompi> {
  if (!verificarFirmaEvento(payload)) {
    return { accion: 'ignorado', detalle: 'firma inválida' }
  }

  if (payload.event !== 'transaction.updated') {
    return { accion: 'ignorado', detalle: `evento ${payload.event} no manejado` }
  }

  const tx = payload.data.transaction
  if (!tx?.reference) return { accion: 'ignorado', detalle: 'evento sin reference' }

  const seguimiento = await buscarPagoWompi(tx.reference)
  if (!seguimiento) {
    console.warn(`[wompi-flujo] Webhook para reference desconocida: ${tx.reference}`)
    return { accion: 'ignorado', detalle: `reference ${tx.reference} no registrada localmente` }
  }

  const status = tx.status

  if (status === 'APPROVED') {
    let clienteId = seguimiento.cliente_id

    if (!clienteId) {
      const userExistente = await queryOne(
        `SELECT c.id AS cliente_id FROM users u JOIN clientes c ON c.user_id = u.id WHERE lower(u.email) = lower(?)`,
        [seguimiento.cliente_email]
      ) as any

      if (userExistente) {
        clienteId = userExistente.cliente_id as string
        await execute(
          `UPDATE clientes SET plan = ?, suscripcion_estado = 'activa', suscripcion_externa_id = ?, updated_at = datetime('now') WHERE id = ?`,
          [seguimiento.plan, tx.id, clienteId]
        )
      } else {
        const contrato = seguimiento.contrato_datos ? JSON.parse(seguimiento.contrato_datos) : {}
        const { crearCuentaClienteAutomatica } = await import('./clientes')
        const cuenta = await crearCuentaClienteAutomatica({
          razon_social: seguimiento.cliente_nombre,
          nit:          contrato.numeroIdentificacion ?? undefined,
          contacto:     contrato.nombreRepresentante ?? undefined,
          email:        seguimiento.cliente_email,
          user_email:   seguimiento.cliente_email,
          user_nombre:  contrato.nombreRepresentante ?? seguimiento.cliente_nombre,
          plan:         seguimiento.plan,
          suscripcion_externa_id: tx.id,
        })
        clienteId = cuenta.clienteId
      }
    } else {
      await execute(
        `UPDATE clientes SET suscripcion_estado = 'activa', updated_at = datetime('now') WHERE id = ?`,
        [clienteId]
      )
    }

    await actualizarPagoWompi(tx.reference, { estado: 'aprobada', transaction_id: tx.id, cliente_id: clienteId! })

    const { notificarSuscripcion } = await import('./notificaciones')
    notificarSuscripcion({
      clienteId: clienteId!, cliente: seguimiento.cliente_nombre, clienteEmail: seguimiento.cliente_email,
      plan: seguimiento.plan, estado: 'activa', fecha: new Date().toISOString(),
    }).catch(e => console.error('[wompi-flujo] Error notificando activación:', e))

    return { accion: 'aprobada', detalle: `cliente ${clienteId}` }
  }

  if (status === 'DECLINED' || status === 'ERROR' || status === 'VOIDED') {
    await actualizarPagoWompi(tx.reference, { estado: 'rechazada', transaction_id: tx.id })
    return { accion: 'rechazada', detalle: tx.status_message ?? status }
  }

  // PENDING u otro estado transitorio: no hacemos nada, esperamos el próximo evento.
  return { accion: 'ignorado', detalle: `estado transitorio: ${status}` }
}
