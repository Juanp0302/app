/**
 * lib/suscripcion.ts
 * Lógica de planes, límites mensuales y estado de suscripción.
 */
import { queryOne, execute } from './db'

// ── Definición de planes ──────────────────────────────────────────────────────

export const PLANES = {
  basico:  { label: 'Básico',  tickets: 3,  chats: 6,  precio: 199000  },
  pro:     { label: 'Pro',     tickets: 6,  chats: 12, precio: 890000  },
  premium: { label: 'Premium', tickets: 10, chats: 20, precio: 2490000 },
} as const

export type PlanKey = keyof typeof PLANES

export type EstadoSuscripcion = 'activa' | 'suspendida' | 'trial' | 'cancelada'

// ── Migración lazy ────────────────────────────────────────────────────────────

let _migrated = false
export async function migrateSuscripcion() {
  if (_migrated) return
  _migrated = true
  const cols = [
    `ALTER TABLE clientes ADD COLUMN plan TEXT`,
    `ALTER TABLE clientes ADD COLUMN suscripcion_estado TEXT DEFAULT 'trial'`,
    `ALTER TABLE clientes ADD COLUMN suscripcion_inicio TEXT`,
    `ALTER TABLE clientes ADD COLUMN suscripcion_vencimiento TEXT`,
    `ALTER TABLE clientes ADD COLUMN mp_subscription_id TEXT`,
    `ALTER TABLE clientes ADD COLUMN tickets_mes INTEGER DEFAULT 0`,
    `ALTER TABLE clientes ADD COLUMN chats_mes INTEGER DEFAULT 0`,
    `ALTER TABLE clientes ADD COLUMN conteo_reset_at TEXT`,
  ]
  for (const sql of cols) {
    try { await execute(sql) } catch { /* columna ya existe */ }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Devuelve YYYY-MM del mes actual */
function mesActual() {
  return new Date().toISOString().slice(0, 7)
}

/**
 * Verifica si el cliente puede abrir un nuevo ticket.
 * Resetea contadores si cambió el mes.
 * Retorna { ok, limite, usado, plan } o { ok: false, ... }
 */
export async function puedeCrearTicket(clienteId: string) {
  await migrateSuscripcion()
  return puedeCrear(clienteId, 'ticket')
}

export async function puedeCrearChat(clienteId: string) {
  await migrateSuscripcion()
  return puedeCrear(clienteId, 'chat')
}

async function puedeCrear(clienteId: string, tipo: 'ticket' | 'chat') {
  const c = await queryOne(
    `SELECT plan, suscripcion_estado, tickets_mes, chats_mes, conteo_reset_at FROM clientes WHERE id = ?`,
    [clienteId]
  ) as any

  if (!c) return { ok: false, razon: 'cliente_no_encontrado' }

  // Sin plan asignado → acceso libre (superadmin/trial sin restricción de conteo)
  if (!c.plan) return { ok: true, limite: null, usado: 0, plan: null }

  const plan = PLANES[c.plan as PlanKey]
  if (!plan) return { ok: true, limite: null, usado: 0, plan: null }

  // Suscripción suspendida → bloquear todo
  if (c.suscripcion_estado === 'suspendida' || c.suscripcion_estado === 'cancelada') {
    return { ok: false, razon: 'suscripcion_suspendida', plan: c.plan }
  }

  // Resetear contadores si cambió el mes
  const mes = mesActual()
  if (!c.conteo_reset_at || c.conteo_reset_at < mes) {
    await execute(
      `UPDATE clientes SET tickets_mes = 0, chats_mes = 0, conteo_reset_at = ? WHERE id = ?`,
      [mes, clienteId]
    )
    c.tickets_mes = 0
    c.chats_mes   = 0
  }

  const usado  = tipo === 'ticket' ? (c.tickets_mes ?? 0) : (c.chats_mes ?? 0)
  const limite = tipo === 'ticket' ? plan.tickets         : plan.chats

  if (usado >= limite) {
    return { ok: false, razon: 'limite_alcanzado', limite, usado, plan: c.plan }
  }

  return { ok: true, limite, usado, plan: c.plan }
}

/** Incrementa el contador correspondiente tras crear exitosamente */
export async function incrementarContador(clienteId: string, tipo: 'ticket' | 'chat') {
  const col = tipo === 'ticket' ? 'tickets_mes' : 'chats_mes'
  await execute(`UPDATE clientes SET ${col} = COALESCE(${col}, 0) + 1 WHERE id = ?`, [clienteId])
}

/** Resumen de uso para mostrar en el cliente */
export async function resumenUso(clienteId: string) {
  await migrateSuscripcion()
  const c = await queryOne(
    `SELECT plan, suscripcion_estado, suscripcion_vencimiento, tickets_mes, chats_mes, conteo_reset_at FROM clientes WHERE id = ?`,
    [clienteId]
  ) as any
  if (!c) return null

  const mes = mesActual()
  const ticketsUsados = (!c.conteo_reset_at || c.conteo_reset_at < mes) ? 0 : (c.tickets_mes ?? 0)
  const chatsUsados   = (!c.conteo_reset_at || c.conteo_reset_at < mes) ? 0 : (c.chats_mes   ?? 0)

  const plan = c.plan ? PLANES[c.plan as PlanKey] ?? null : null

  return {
    plan:                  c.plan ?? null,
    planLabel:             plan?.label ?? null,
    estado:                c.suscripcion_estado ?? 'trial',
    vencimiento:           c.suscripcion_vencimiento ?? null,
    tickets: { usado: ticketsUsados, limite: plan?.tickets ?? null },
    chats:   { usado: chatsUsados,   limite: plan?.chats   ?? null },
  }
}
