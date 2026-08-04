/**
 * lib/trazo-cobros-flujo.ts
 * Flujo de negocio del módulo de Cobros de Trazo — pago único, sin
 * suscripción (ver docs/trazo-integracion.md, sección 5bis/5ter).
 *
 * Modelo (2026-08-03): cada pago (el del contrato y cada mensualidad
 * posterior) es un Cobro independiente (`POST /transaction`), no una
 * suscripción recurrente. El cliente entra cada mes al enlace de pago que se
 * le envía. Cuando el webhook de pagos confirma 'success' se activa la
 * cuenta (mismo helper que usan Trazo-suscripciones y Wompi) o, si el
 * cliente ya existe, se marca la suscripción como activa.
 *
 * Este archivo NO modifica nada de lib/trazo-flujo.ts (Suscripciones) ni de
 * lib/wompi-flujo.ts — son tres caminos independientes que conviven.
 *
 * Validación de firma del webhook: soporte de Trazo confirmó (2026-08-03)
 * que X-Trazo-Signature es una validación adicional y que podemos arrancar
 * sin exigirla. Por eso `verificarFirmaCobro()` existe y se calcula, pero
 * NO bloquea el procesamiento salvo que se active explícitamente con
 * TRAZO_COBROS_EXIGIR_FIRMA=true — subir ese interruptor en cuanto se
 * confirme el algoritmo en un caso real.
 */

import crypto from 'crypto'
import { crearCobro, type CrearCobroInput, type TrazoIdType } from './trazo'
import { PLANES, type PlanKey } from './suscripcion'
import { guardarCobroTrazo, buscarCobroTrazo, actualizarCobroTrazo, listarCobrosTrazo, type TrazoCobroRow } from './trazo-cobros-db'
import { queryOne, execute } from './db'

export { listarCobrosTrazo }

const APP_URL = (process.env.NEXTAUTH_URL ?? 'https://owlcompliance.onrender.com').replace(/\/$/, '')

export function trazoCobrosConfigurado(): boolean {
  return Boolean(process.env.TRAZO_BASE_URL && process.env.TRAZO_AUTH_KEY && process.env.TRAZO_MERCHANT_ID)
}

function mapIdType(tipo: string): TrazoIdType {
  const t = (tipo || '').toUpperCase()
  if (t === 'PASAPORTE') return 'PASAPORTE'
  if (t === 'CE') return 'CE'
  if (t === 'NIT') return 'NIT'
  return 'CC'
}

export interface DatosContratoParaCobro {
  plan:                 PlanKey
  nombreCliente:        string
  tipoIdentificacion:   string
  numeroIdentificacion: string
  email:                string
  contratoDatos?:       object
}

async function generarCobro(opts: {
  plan: PlanKey
  monto: number
  descripcion: string
  nombreCliente: string
  tipoIdentificacion: string
  numeroIdentificacion: string
  email: string
  contratoDatos?: object | null
  clienteId?: string | null
}): Promise<{ externalReference: string; link: string }> {
  const hoy = new Date()
  const limite = new Date(hoy)
  limite.setDate(limite.getDate() + 10)   // 10 días para pagar el enlace

  const input: CrearCobroInput = {
    status:       'PENDING',
    currency:     'COP',
    amount:       opts.monto,
    description:  opts.descripcion,
    merchant_id_number: process.env.TRAZO_MERCHANT_ID!,
    // Soporte de Trazo pidió (2026-08-03) usar channel: EMAIL en vez de LINK
    // para este flujo. Seguimos con user_notification: false porque el
    // correo con el enlace de pago ya lo enviamos nosotros mismos.
    channel:      'EMAIL',
    user_notification: false,   // el correo ya lo enviamos nosotros
    return_url:   `${APP_URL}/pago-exitoso`,
    // A diferencia de Suscripciones (que usa el webhook global del comercio),
    // soporte de Trazo indicó (2026-08-03) que cada Cobro debe llevar su
    // propio custom_webhook para que el evento de pago llegue.
    custom_webhook: `${APP_URL}/api/webhooks/trazo-cobros`,
    limit_date:   limite.toISOString().slice(0, 10),
    payer: {
      first_name:     opts.nombreCliente,
      user_id_type:   mapIdType(opts.tipoIdentificacion),
      user_id_number: opts.numeroIdentificacion,
      email:          opts.email,
    },
  }

  const cobro = await crearCobro(input)

  await guardarCobroTrazo({
    external_reference: cobro.external_reference,
    process_id: cobro.process_id,
    plan: opts.plan,
    monto: opts.monto,
    link: cobro.link,
    cliente_email: opts.email,
    cliente_nombre: opts.nombreCliente,
    contrato_datos: opts.contratoDatos ?? null,
    cliente_id: opts.clienteId ?? null,
  })

  return { externalReference: cobro.external_reference, link: cobro.link }
}

/** Genera el primer Cobro (el del contrato) y guarda el seguimiento local. */
export async function crearCobroTrazoParaContrato(datos: DatosContratoParaCobro): Promise<{
  externalReference: string
  link: string
}> {
  const planInfo = PLANES[datos.plan]
  if (!planInfo) throw new Error(`Plan inválido: ${datos.plan}`)

  return generarCobro({
    plan: datos.plan,
    monto: planInfo.precio,
    descripcion: `Owl Compliance — Plan ${planInfo.label}`,
    nombreCliente: datos.nombreCliente,
    tipoIdentificacion: datos.tipoIdentificacion,
    numeroIdentificacion: datos.numeroIdentificacion,
    email: datos.email,
    contratoDatos: datos.contratoDatos,
  })
}

/**
 * Genera el Cobro de una mensualidad posterior para un cliente que ya tiene
 * cuenta. Pensado para llamarse manualmente o desde un cron sencillo más
 * adelante — no hay recurrencia automática todavía.
 */
export async function crearCobroTrazoRenovacion(datos: {
  clienteId: string
  plan: PlanKey
  nombreCliente: string
  tipoIdentificacion: string
  numeroIdentificacion: string
  email: string
}): Promise<{ externalReference: string; link: string }> {
  const planInfo = PLANES[datos.plan]
  if (!planInfo) throw new Error(`Plan inválido: ${datos.plan}`)

  const mesLabel = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  return generarCobro({
    plan: datos.plan,
    monto: planInfo.precio,
    descripcion: `Owl Compliance — Plan ${planInfo.label} (${mesLabel})`,
    nombreCliente: datos.nombreCliente,
    tipoIdentificacion: datos.tipoIdentificacion,
    numeroIdentificacion: datos.numeroIdentificacion,
    email: datos.email,
    clienteId: datos.clienteId,
  })
}

// ── Verificación de firma del webhook (calculada, no exigida por defecto) ────

/**
 * Header esperado: "timestamp=<unix>,signature=<hex>"
 * Firma: HMAC-SHA256("{timestamp}.{cuerpo crudo}", TRAZO_AUTH_KEY)
 * Devuelve false también si faltan datos — quien llame decide si eso bloquea
 * el procesamiento (ver TRAZO_COBROS_EXIGIR_FIRMA).
 */
export function verificarFirmaCobro(rawBody: string, header: string | null): boolean {
  if (!header) return false
  const authKey = process.env.TRAZO_AUTH_KEY
  if (!authKey) return false

  const partes: Record<string, string> = {}
  for (const par of header.split(',')) {
    const [k, v] = par.split('=')
    if (k && v) partes[k.trim()] = v.trim()
  }
  const timestamp = partes.timestamp
  const firmaRecibida = partes.signature
  if (!timestamp || !firmaRecibida) return false

  const antiguedadMs = Date.now() - Number(timestamp) * 1000
  if (!Number.isFinite(antiguedadMs) || antiguedadMs > 5 * 60 * 1000 || antiguedadMs < -60 * 1000) return false

  const esperado = crypto.createHmac('sha256', authKey).update(`${timestamp}.${rawBody}`).digest('hex')

  const a = Buffer.from(esperado)
  const b = Buffer.from(firmaRecibida)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

// ── Procesamiento del webhook de pagos ────────────────────────────────────────

export interface WebhookCobroTrazo {
  event_id?: string
  event: { type: string; status: string }
  created_at?: string
  external_reference?: string
  detail?: {
    amount?: string | number   // Trazo lo envía como string, ej. "29900"
    currency?: string
    description?: string
    process_id?: string
    payment_method?: string
    payer?: { email?: string; first_name?: string; last_name?: string }
    merchant?: { name?: string; id_number?: string }
  }
}

export interface ResultadoWebhookCobro { accion: string; detalle?: string }

/**
 * Activa (o reactiva) la cuenta del cliente asociado a un cobro ya
 * confirmado como pagado — sea por webhook o por confirmación manual desde
 * el panel de superadmin (ver confirmarCobroManual). Devuelve el clienteId.
 */
async function activarCuentaPorCobro(seguimiento: TrazoCobroRow): Promise<string> {
  let clienteId = seguimiento.cliente_id

  if (!clienteId) {
    const userExistente = await queryOne(
      `SELECT c.id AS cliente_id FROM users u JOIN clientes c ON c.user_id = u.id WHERE lower(u.email) = lower(?)`,
      [seguimiento.cliente_email]
    ) as any

    if (userExistente) {
      clienteId = userExistente.cliente_id as string
      await execute(
        `UPDATE clientes SET plan = ?, suscripcion_estado = 'activa', updated_at = datetime('now') WHERE id = ?`,
        [seguimiento.plan, clienteId]
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
      })
      clienteId = cuenta.clienteId
    }
  } else {
    await execute(
      `UPDATE clientes SET suscripcion_estado = 'activa', updated_at = datetime('now') WHERE id = ?`,
      [clienteId]
    )
  }

  await actualizarCobroTrazo(seguimiento.external_reference, { estado: 'pagada', cliente_id: clienteId! })

  const { notificarSuscripcion } = await import('./notificaciones')
  notificarSuscripcion({
    clienteId: clienteId!, cliente: seguimiento.cliente_nombre, clienteEmail: seguimiento.cliente_email,
    plan: seguimiento.plan, estado: 'activa', fecha: new Date().toISOString(),
  }).catch(e => console.error('[trazo-cobros-flujo] Error notificando activación:', e))

  return clienteId!
}

/**
 * Confirmación manual desde el panel de superadmin, mientras el webhook de
 * Trazo Cobros no esté registrado/confirmado (ver docs/trazo-integracion.md,
 * sección 5ter). El admin ya verificó el pago por fuera (dashboard de Trazo,
 * extracto bancario, etc.) — por eso aquí no se valida monto ni firma, a
 * diferencia del webhook automático.
 */
export async function confirmarCobroManual(externalReference: string): Promise<{ clienteId: string }> {
  const seguimiento = await buscarCobroTrazo(externalReference)
  if (!seguimiento) throw new Error(`Cobro ${externalReference} no encontrado`)
  if (seguimiento.estado === 'pagada') throw new Error(`El cobro ${externalReference} ya estaba marcado como pagado`)

  const clienteId = await activarCuentaPorCobro(seguimiento)
  return { clienteId }
}

const eventosProcesados = new Set<string>()   // deduplicación básica en memoria (ver nota abajo)

export async function procesarWebhookCobroTrazo(payload: WebhookCobroTrazo): Promise<ResultadoWebhookCobro> {
  if (payload.event?.type !== 'payment') {
    return { accion: 'ignorado', detalle: `evento ${payload.event?.type ?? 'desconocido'} — solo se actúa sobre pagos` }
  }

  // Deduplicación básica por event_id (en memoria — se reinicia si el proceso
  // se reinicia; suficiente mientras el volumen es bajo. Si esto crece,
  // mover a una tabla en vez de un Set en memoria).
  if (payload.event_id) {
    if (eventosProcesados.has(payload.event_id)) {
      return { accion: 'ignorado', detalle: 'evento ya procesado (event_id duplicado)' }
    }
    eventosProcesados.add(payload.event_id)
  }

  const externalReference = payload.external_reference
  if (!externalReference) return { accion: 'ignorado', detalle: 'evento sin external_reference' }

  const seguimiento = await buscarCobroTrazo(externalReference)
  if (!seguimiento) {
    console.warn(`[trazo-cobros-flujo] Webhook para cobro desconocido: ${externalReference}`)
    return { accion: 'ignorado', detalle: `cobro ${externalReference} no registrado localmente` }
  }

  const status = (payload.event.status || '').toLowerCase()

  if (status === 'success' || status === 'accepted') {
    // Verificación de monto: mientras no se exija la firma del webhook
    // (ver verificarFirmaCobro), este es un control barato contra un evento
    // falso que adivine un external_reference válido — si el monto pagado
    // no coincide con el que registramos al generar el cobro, no activamos
    // nada y se deja para revisión manual.
    const montoPagado = Number(payload.detail?.amount)
    if (Number.isFinite(montoPagado) && montoPagado !== seguimiento.monto) {
      console.warn(`[trazo-cobros-flujo] Monto no coincide para ${externalReference}: pagado=${montoPagado}, esperado=${seguimiento.monto} — no se activa la cuenta, requiere revisión manual`)
      return { accion: 'ignorado', detalle: `monto no coincide (pagado ${montoPagado}, esperado ${seguimiento.monto})` }
    }

    const clienteId = await activarCuentaPorCobro(seguimiento)
    return { accion: 'pagada', detalle: `cliente ${clienteId}` }
  }

  if (status === 'failed' || status === 'overdue' || status === 'blocked' || status === 'cancel') {
    await actualizarCobroTrazo(externalReference, { estado: 'rechazada' })
    if (seguimiento.cliente_id) {
      await execute(`UPDATE clientes SET suscripcion_estado = 'suspendida', updated_at = datetime('now') WHERE id = ?`, [seguimiento.cliente_id])
      const { notificarSuscripcion } = await import('./notificaciones')
      notificarSuscripcion({
        clienteId: seguimiento.cliente_id, cliente: seguimiento.cliente_nombre, clienteEmail: seguimiento.cliente_email,
        plan: seguimiento.plan, estado: 'suspendida', fecha: new Date().toISOString(),
      }).catch(e => console.error('[trazo-cobros-flujo] Error notificando suspensión:', e))
    }
    return { accion: 'rechazada', detalle: status }
  }

  // review / ret_pending / ret_review / ret_success / external / credit / edit:
  // no hay acción automática definida todavía, solo se registra.
  return { accion: 'ignorado', detalle: `estado no manejado: ${status}` }
}
