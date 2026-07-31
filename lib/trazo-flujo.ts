/**
 * lib/trazo-flujo.ts
 * Flujo de negocio de la pasarela Trazo para Owl Compliance.
 *
 * Modelo elegido (decisiones del 2026-07-30, ver docs/trazo-integracion.md):
 *  - Un Plan de Trazo POR CLIENTE, con billing_day = día del mes en que firmó
 *    (tope 30), initial_charge activado y total_charges = 12.
 *  - Al llegar el webhook 'activated' se crea la cuenta completa del cliente
 *    (contraseña temporal + cambio obligatorio + elección de servicios).
 *  - Al llegar 'fulfilled' (se agotaron los 12 cobros) se renueva
 *    automáticamente: nuevo Plan + Suscripción y correo al cliente con el
 *    enlace para re-vincular su medio de pago.
 *
 * Variables de entorno: TRAZO_BASE_URL, TRAZO_AUTH_KEY (ver lib/trazo.ts)
 * y TRAZO_MERCHANT_ID (documento del cobrador, exigido por Generar Plan).
 */

import { crearPlan, crearSuscripcion, type TrazoIdType } from './trazo'
import { PLANES, type PlanKey } from './suscripcion'
import { guardarSuscripcionTrazo, buscarSuscripcionTrazo, actualizarSuscripcionTrazo } from './trazo-db'
import { queryOne, execute } from './db'

const APP_URL = process.env.NEXTAUTH_URL ?? 'https://owlcompliance.onrender.com'

/** true si las credenciales de Trazo están configuradas en el entorno. */
export function trazoConfigurado(): boolean {
  return Boolean(process.env.TRAZO_BASE_URL && process.env.TRAZO_AUTH_KEY && process.env.TRAZO_MERCHANT_ID)
}

function mapIdType(tipo: string): TrazoIdType {
  const t = (tipo || '').toUpperCase()
  if (t === 'PASAPORTE') return 'PASAPORTE'
  if (t === 'CE') return 'CE'
  if (t === 'NIT') return 'NIT'
  return 'CC'
}

export interface DatosContratoParaTrazo {
  plan:                 PlanKey
  nombreCliente:        string
  tipoIdentificacion:   string
  numeroIdentificacion: string
  email:                string
  contratoDatos?:       object   // formulario completo, para trazabilidad
  renovacionDe?:        string   // subscription_id anterior (renovaciones)
}

/**
 * Crea en Trazo el Plan individual del cliente + su Suscripción, y guarda el
 * seguimiento local en estado 'pendiente'. Devuelve el enlace de vinculación
 * del medio de pago para redirigir/enviar al cliente.
 */
export async function crearSuscripcionTrazoParaContrato(datos: DatosContratoParaTrazo): Promise<{
  subscriptionId: string
  subscriptionUrl: string
}> {
  const planInfo = PLANES[datos.plan]
  if (!planInfo) throw new Error(`Plan inválido: ${datos.plan}`)

  const hoy = new Date()
  const billingDay = Math.min(hoy.getDate(), 30)
  // La API exige expires_at aunque la doc lo marque opcional: límite para que
  // el cliente complete la vinculación del medio de pago (no la vigencia del plan).
  const expiraVinculacion = new Date(hoy)
  expiraVinculacion.setDate(expiraVinculacion.getDate() + 30)

  const plan = await crearPlan({
    merchant_id_number: process.env.TRAZO_MERCHANT_ID!,
    name: `Owl ${planInfo.label} — ${datos.nombreCliente}`,
    plan_details: {
      currency:      'COP',
      amount:        planInfo.precio,
      description:   `Owl Compliance Plan ${planInfo.label} — cobro {{charge_number}} ({{month}})`,
      frequency:     'monthly',
      billing_day:   billingDay,
      total_charges: 12,
      initial_charge: true,
      trial_days:    0,
      expires_at:    expiraVinculacion.toISOString().slice(0, 10),
      retry: { max_attempts: 3, interval_days: 2, final_status: 'OVERDUE' },
    },
    return_url: `${APP_URL}/pago-exitoso`,
  })

  const sus = await crearSuscripcion({
    plan_id: plan.plan_id,
    customer: {
      name:      datos.nombreCliente,
      id_type:   mapIdType(datos.tipoIdentificacion),
      id_number: datos.numeroIdentificacion,
      email:     datos.email,
    },
  })

  await guardarSuscripcionTrazo({
    subscription_id:  sus.subscription_id,
    plan_id_trazo:    plan.plan_id,
    plan:             datos.plan,
    subscription_url: sus.subscription_url,
    cliente_email:    datos.email,
    cliente_nombre:   datos.nombreCliente,
    contrato_datos:   datos.contratoDatos ?? null,
    renovacion_de:    datos.renovacionDe ?? null,
  })

  return { subscriptionId: sus.subscription_id, subscriptionUrl: sus.subscription_url }
}

// ── Procesamiento de webhooks ─────────────────────────────────────────────────

export interface WebhookTrazo {
  event: { type: string; status: string }
  created_at?: string
  external_reference?: string
  detail?: {
    plan_id?: string
    subscription_id?: string
    status?: string
    customer?: { id_number?: string; email?: string; phone?: string; name?: string }
    terms?: { amount?: number; total_charges?: number }
    billing?: { charges_executed?: number; charges_remaining?: number; next_charge_date?: string }
    canceled_at?: string | null
    reason?: string
  }
}

export interface ResultadoWebhook { accion: string; detalle?: string }

/**
 * Procesa un evento de webhook de Trazo ya autenticado.
 * Los eventos de cobros se registran y aceptan sin acción (la gestión de
 * estado vive en los eventos de suscripción). Devuelve siempre qué hizo,
 * para el log del receptor.
 */
export async function procesarWebhookTrazo(payload: WebhookTrazo): Promise<ResultadoWebhook> {
  if (payload.event?.type !== 'subscription') {
    return { accion: 'ignorado', detalle: `evento ${payload.event?.type ?? 'desconocido'}/${payload.event?.status ?? '?'} — solo se actúa sobre suscripciones` }
  }

  const subscriptionId = payload.detail?.subscription_id ?? payload.external_reference
  if (!subscriptionId) return { accion: 'ignorado', detalle: 'evento de suscripción sin subscription_id' }

  const seguimiento = await buscarSuscripcionTrazo(subscriptionId)
  if (!seguimiento) {
    console.warn(`[trazo-flujo] Webhook para suscripción desconocida: ${subscriptionId}`)
    return { accion: 'ignorado', detalle: `suscripción ${subscriptionId} no registrada localmente` }
  }

  const status = (payload.event.status || '').toLowerCase()
  const { notificarSuscripcion } = await import('./notificaciones')

  switch (status) {
    case 'activated': {
      let clienteId = seguimiento.cliente_id

      if (!clienteId) {
        // ¿Ya existe una cuenta con ese correo? (renovación o cliente previo)
        const userExistente = await queryOne(
          `SELECT c.id AS cliente_id FROM users u JOIN clientes c ON c.user_id = u.id WHERE lower(u.email) = lower(?)`,
          [seguimiento.cliente_email]
        ) as any

        if (userExistente) {
          clienteId = userExistente.cliente_id as string
          await execute(
            `UPDATE clientes SET plan = ?, suscripcion_estado = 'activa', suscripcion_externa_id = ?,
               suscripcion_vencimiento = ?, updated_at = datetime('now') WHERE id = ?`,
            [seguimiento.plan, subscriptionId, payload.detail?.billing?.next_charge_date ?? null, clienteId]
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
            suscripcion_vencimiento: payload.detail?.billing?.next_charge_date ?? null,
            suscripcion_externa_id:  subscriptionId,
          })
          clienteId = cuenta.clienteId
        }
      } else {
        await execute(
          `UPDATE clientes SET suscripcion_estado = 'activa', suscripcion_vencimiento = ?, updated_at = datetime('now') WHERE id = ?`,
          [payload.detail?.billing?.next_charge_date ?? null, clienteId]
        )
      }

      await actualizarSuscripcionTrazo(subscriptionId, { estado: 'activa', cliente_id: clienteId! })
      notificarSuscripcion({
        clienteId: clienteId!, cliente: seguimiento.cliente_nombre, clienteEmail: seguimiento.cliente_email,
        plan: seguimiento.plan, estado: 'activa', fecha: new Date().toISOString(),
      }).catch(e => console.error('[trazo-flujo] Error notificando activación:', e))
      return { accion: 'activada', detalle: `cliente ${clienteId}` }
    }

    case 'overdue': {
      if (seguimiento.cliente_id) {
        await execute(`UPDATE clientes SET suscripcion_estado = 'suspendida', updated_at = datetime('now') WHERE id = ?`, [seguimiento.cliente_id])
      }
      await actualizarSuscripcionTrazo(subscriptionId, { estado: 'vencida' })
      notificarSuscripcion({
        clienteId: seguimiento.cliente_id ?? subscriptionId, cliente: seguimiento.cliente_nombre,
        clienteEmail: seguimiento.cliente_email, plan: seguimiento.plan, estado: 'suspendida',
        fecha: new Date().toISOString(),
      }).catch(e => console.error('[trazo-flujo] Error notificando suspensión:', e))
      return { accion: 'suspendida' }
    }

    case 'canceled': {
      if (seguimiento.cliente_id) {
        await execute(`UPDATE clientes SET suscripcion_estado = 'cancelada', updated_at = datetime('now') WHERE id = ?`, [seguimiento.cliente_id])
      }
      await actualizarSuscripcionTrazo(subscriptionId, { estado: 'cancelada' })
      notificarSuscripcion({
        clienteId: seguimiento.cliente_id ?? subscriptionId, cliente: seguimiento.cliente_nombre,
        clienteEmail: seguimiento.cliente_email, plan: seguimiento.plan, estado: 'cancelada',
        fecha: new Date().toISOString(),
      }).catch(e => console.error('[trazo-flujo] Error notificando cancelación:', e))
      return { accion: 'cancelada', detalle: payload.detail?.reason }
    }

    case 'fulfilled': {
      await actualizarSuscripcionTrazo(subscriptionId, { estado: 'completada' })

      // Renovación automática: nuevo Plan + Suscripción con los mismos términos.
      const contrato = seguimiento.contrato_datos ? JSON.parse(seguimiento.contrato_datos) : {}
      const renovacion = await crearSuscripcionTrazoParaContrato({
        plan:                 seguimiento.plan as PlanKey,
        nombreCliente:        seguimiento.cliente_nombre,
        tipoIdentificacion:   contrato.tipoIdentificacion ?? 'NIT',
        numeroIdentificacion: contrato.numeroIdentificacion ?? payload.detail?.customer?.id_number ?? '',
        email:                seguimiento.cliente_email,
        contratoDatos:        contrato,
        renovacionDe:         subscriptionId,
      })
      if (seguimiento.cliente_id) {
        await actualizarSuscripcionTrazo(renovacion.subscriptionId, { cliente_id: seguimiento.cliente_id })
      }

      const { enviarEmail } = await import('./email')
      const planLabel = PLANES[seguimiento.plan as PlanKey]?.label ?? seguimiento.plan
      enviarEmail({
        to: seguimiento.cliente_email,
        subject: `Renueva tu suscripción a Owl Compliance — Plan ${planLabel}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;color:#1a1a1a;">
            <h2 style="color:#712529;">Tu suscripción completó su ciclo anual</h2>
            <p>Hola <strong>${seguimiento.cliente_nombre}</strong>,</p>
            <p>Tu suscripción al <strong>Plan ${planLabel}</strong> completó sus 12 cobros. Para continuar sin interrupciones,
            vincula nuevamente tu medio de pago en el siguiente enlace:</p>
            <p style="margin:24px 0;"><a href="${renovacion.subscriptionUrl}" style="background:#712529;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Renovar suscripción</a></p>
            <p style="font-size:13px;color:#555;">Si no deseas renovar, simplemente ignora este correo. Puedes escribirnos a contacto@owlcompliance.com para cualquier duda.</p>
          </div>`,
      }).catch(e => console.error('[trazo-flujo] Error enviando correo de renovación:', e))

      const superadmin = process.env.SUPERADMIN_EMAIL ?? 'contacto@owlcompliance.com'
      enviarEmail({
        to: superadmin,
        subject: `[RENOVACIÓN] ${seguimiento.cliente_nombre} — Plan ${planLabel} completó 12 cobros`,
        html: `<p>La suscripción ${subscriptionId} de <strong>${seguimiento.cliente_nombre}</strong> completó su ciclo. Se creó la renovación ${renovacion.subscriptionId} y se le envió el enlace de vinculación al cliente.</p>`,
      }).catch(e => console.error('[trazo-flujo] Error notificando renovación al superadmin:', e))

      return { accion: 'renovada', detalle: `nueva suscripción ${renovacion.subscriptionId}` }
    }

    default:
      return { accion: 'ignorado', detalle: `estado de suscripción no manejado: ${status}` }
  }
}
