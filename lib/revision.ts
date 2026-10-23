/**
 * lib/revision.ts
 * Lógica con base de datos alrededor de la regla de revisión de documentos
 * (ver lib/revision-regla.ts) y del servicio de Diagnóstico Integral.
 *
 * Diagnóstico integral: servicio on-demand que un cliente SIN revisión por plan
 * (Básico, cortesía, trial, sin plan) puede contratar. Mientras está activo, sus
 * documentos pasan por un asesor como en Pro/Premium.
 *   NULL → 'solicitado' (lo pide el cliente) → 'activo' (lo activa el superadmin)
 *        → 'cerrado' (cualquier administrador, al entregar el Mapa de Madurez).
 * Desde 'cerrado' el cliente puede volver a solicitarlo.
 */
import crypto from 'crypto'
import { queryOne, queryAll, execute } from './db'
import { migrateSuscripcion } from './suscripcion'
import { listarPendientesRevision } from './documentos'
import { adminParaAsignacion, aspectoAEspecialidad } from './asignacion'
import { notificarDiagnostico, notificarDocumentosEnRevision } from './notificaciones'
import { requiereRevision, incluyeRevisionPorPlan } from './revision-regla'

export { requiereRevision, incluyeRevisionPorPlan, sqlRequiereRevision, PLANES_CON_REVISION } from './revision-regla'

export interface InfoRevision {
  plan:                      string | null
  es_cortesia:               number
  suscripcion_estado:        string | null
  diagnostico_estado:        string | null
  diagnostico_solicitado_at: string | null
  diagnostico_activado_at:   string | null
  diagnostico_cerrado_at:    string | null
  /** Los documentos de este cliente pasan por un administrador. */
  requiere:                  boolean
  /** La revisión viene incluida en su plan (no depende del diagnóstico). */
  porPlan:                   boolean
}

export async function infoRevisionCliente(clienteId: string): Promise<InfoRevision | null> {
  await migrateSuscripcion()
  const c = await queryOne(
    `SELECT plan, COALESCE(es_cortesia,0) AS es_cortesia, suscripcion_estado, diagnostico_estado,
            diagnostico_solicitado_at, diagnostico_activado_at, diagnostico_cerrado_at
     FROM clientes WHERE id = ?`,
    [clienteId]
  ) as any
  if (!c) return null
  return { ...c, requiere: requiereRevision(c), porPlan: incluyeRevisionPorPlan(c) }
}

/** false si el cliente no existe. */
export async function clienteRequiereRevision(clienteId: string): Promise<boolean> {
  const info = await infoRevisionCliente(clienteId)
  return info ? info.requiere : false
}

// ── Aviso cuando los documentos pasan a revisión de golpe ─────────────────────

/**
 * Llamar DESPUÉS de cambiar el plan/estado de un cliente (o de activar su
 * diagnóstico), pasando lo que devolvía clienteRequiereRevision() ANTES del
 * cambio. Si el cliente pasó de "sin revisión" a "con revisión", envía UN correo
 * resumen por administrador con cuántos documentos entraron a la cola.
 * Nunca lanza error: un fallo de correo no debe romper el cambio de plan.
 * Devuelve cuántos documentos entraron a revisión.
 */
export async function avisarSiPasoARevision(
  clienteId: string,
  requeriaAntes: boolean,
  motivo: 'upgrade' | 'diagnostico' = 'upgrade'
): Promise<number> {
  try {
    if (requeriaAntes) return 0
    if (!(await clienteRequiereRevision(clienteId))) return 0

    const docs = await listarPendientesRevision(clienteId) as any[]
    if (docs.length === 0) return 0

    const cliente = await queryOne(
      `SELECT c.razon_social, u.email AS revisor_email
       FROM clientes c LEFT JOIN users u ON u.id = c.admin_revision_id AND u.activo = 1
       WHERE c.id = ?`,
      [clienteId]
    ) as any

    // Destinatarios: el revisor manual del cliente, o el administrador de cada especialidad.
    const porEmail = new Map<string, number>()
    const sumar = (email: string | null | undefined, n: number) => {
      if (email) porEmail.set(email, (porEmail.get(email) ?? 0) + n)
    }

    if (cliente?.revisor_email) {
      sumar(cliente.revisor_email, docs.length)
    } else {
      const porEspecialidad = new Map<string, number>()
      for (const d of docs) {
        const esp = aspectoAEspecialidad(d.aspecto ?? '')
        porEspecialidad.set(esp, (porEspecialidad.get(esp) ?? 0) + 1)
      }
      for (const [esp, n] of porEspecialidad) {
        const adminId = await adminParaAsignacion(esp, 'documento')
        const row = adminId ? await queryOne('SELECT email FROM users WHERE id = ?', [adminId]) as any : null
        if (row?.email) sumar(row.email, n)
        else {
          // Sin administrador para esa especialidad: se avisa a todos los activos.
          const todos = await queryAll(`SELECT email FROM users WHERE rol = 'admin' AND activo = 1`) as any[]
          for (const a of todos) sumar(a.email, n)
        }
      }
    }
    if (porEmail.size === 0) sumar(process.env.SUPERADMIN_EMAIL ?? 'owlcompliance2026@gmail.com', docs.length)

    await notificarDocumentosEnRevision({
      clienteId,
      cliente: cliente?.razon_social ?? '',
      motivo,
      porAdmin: [...porEmail].map(([email, cantidad]) => ({ email, cantidad })),
      fecha: new Date().toLocaleString('es-CO'),
    })
    return docs.length
  } catch (e) {
    console.error('[revision] No se pudo enviar el resumen de documentos en revisión (no crítico):', e)
    return 0
  }
}

// ── Diagnóstico integral ──────────────────────────────────────────────────────

type Resultado = { ok: true } | { ok: false; error: string; status: number }
type Actor = { id: string; email: string }

async function auditar(actor: Actor, accion: string, clienteId: string, detalle: object = {}) {
  try {
    await execute(
      `INSERT INTO audit_log (id, user_id, user_email, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, ?, 'cliente', ?, ?)`,
      [crypto.randomUUID(), actor.id, actor.email, accion, clienteId, JSON.stringify(detalle)]
    )
  } catch (e) { console.error('[revision] audit_log falló (no crítico):', e) }
}

async function datosParaAviso(clienteId: string) {
  return await queryOne(
    `SELECT c.razon_social, u.email AS email FROM clientes c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?`,
    [clienteId]
  ) as any
}

/** El cliente pide el servicio. Solo aplica si su plan NO incluye ya la revisión. */
export async function solicitarDiagnostico(clienteId: string, actor: Actor): Promise<Resultado> {
  const info = await infoRevisionCliente(clienteId)
  if (!info) return { ok: false, error: 'Cliente no encontrado', status: 404 }
  if (info.porPlan) return { ok: false, error: 'Tu plan ya incluye la revisión de documentos por un asesor.', status: 400 }
  if (info.diagnostico_estado === 'solicitado') return { ok: false, error: 'Ya enviaste la solicitud; un asesor se comunicará contigo.', status: 409 }
  if (info.diagnostico_estado === 'activo')     return { ok: false, error: 'Tu diagnóstico integral ya está activo.', status: 409 }

  await execute(
    `UPDATE clientes SET diagnostico_estado = 'solicitado', diagnostico_solicitado_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    [clienteId]
  )
  await auditar(actor, 'diagnostico_solicitado', clienteId)

  const d = await datosParaAviso(clienteId)
  notificarDiagnostico({
    clienteId, cliente: d?.razon_social ?? '', clienteEmail: d?.email ?? actor.email,
    evento: 'solicitado', fecha: new Date().toISOString(),
  }).catch(e => console.error('[revision] Error avisando la solicitud de diagnóstico:', e))

  return { ok: true }
}

/** Activa el diagnóstico (solo superadmin; se valida en la ruta). Puede activarse aunque el cliente no lo haya solicitado. */
export async function activarDiagnostico(clienteId: string, actor: Actor): Promise<Resultado & { documentosEnRevision?: number }> {
  const info = await infoRevisionCliente(clienteId)
  if (!info) return { ok: false, error: 'Cliente no encontrado', status: 404 }
  if (info.diagnostico_estado === 'activo') return { ok: false, error: 'El diagnóstico ya está activo', status: 409 }

  const antes = info.requiere
  await execute(
    `UPDATE clientes SET diagnostico_estado = 'activo', diagnostico_activado_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    [clienteId]
  )
  await auditar(actor, 'diagnostico_activado', clienteId)

  const documentosEnRevision = await avisarSiPasoARevision(clienteId, antes, 'diagnostico')
  return { ok: true, documentosEnRevision }
}

/** Cierra el diagnóstico (cualquier administrador, al entregar el Mapa de Madurez). */
export async function cerrarDiagnostico(clienteId: string, actor: Actor): Promise<Resultado & { pendientesQueSalen?: number }> {
  const info = await infoRevisionCliente(clienteId)
  if (!info) return { ok: false, error: 'Cliente no encontrado', status: 404 }
  if (info.diagnostico_estado !== 'activo') return { ok: false, error: 'Este cliente no tiene un diagnóstico activo', status: 409 }

  // Documentos aún sin revisar que dejarán de estar en la cola si el cliente no tiene revisión por plan.
  const pendientesQueSalen = info.porPlan ? 0 : (await listarPendientesRevision(clienteId) as any[]).length

  await execute(
    `UPDATE clientes SET diagnostico_estado = 'cerrado', diagnostico_cerrado_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    [clienteId]
  )
  await auditar(actor, 'diagnostico_cerrado', clienteId, { pendientesQueSalen })

  const d = await datosParaAviso(clienteId)
  notificarDiagnostico({
    clienteId, cliente: d?.razon_social ?? '', clienteEmail: d?.email ?? '',
    evento: 'cerrado', fecha: new Date().toISOString(),
  }).catch(e => console.error('[revision] Error avisando el cierre de diagnóstico:', e))

  return { ok: true, pendientesQueSalen }
}

/** Clientes con algún diagnóstico (solicitado, activo o ya cerrado), para la pantalla de administradores. */
export async function listarDiagnosticos() {
  await migrateSuscripcion()
  return queryAll(
    `SELECT c.id, c.razon_social, c.plan, c.suscripcion_estado, COALESCE(c.es_cortesia,0) AS es_cortesia,
            c.diagnostico_estado, c.diagnostico_solicitado_at, c.diagnostico_activado_at, c.diagnostico_cerrado_at,
            u.email,
            (SELECT COUNT(*) FROM documentos d WHERE d.cliente_id = c.id) AS docs_total,
            (SELECT COUNT(*) FROM documentos d WHERE d.cliente_id = c.id
               AND (d.estado_revision = 'pendiente' OR d.estado_revision IS NULL)) AS docs_pendientes
     FROM clientes c LEFT JOIN users u ON u.id = c.user_id
     WHERE c.diagnostico_estado IS NOT NULL
     ORDER BY CASE c.diagnostico_estado WHEN 'solicitado' THEN 0 WHEN 'activo' THEN 1 ELSE 2 END,
              COALESCE(c.diagnostico_activado_at, c.diagnostico_solicitado_at) DESC`
  )
}

/**
 * Ejecuta `cambio()` (un UPDATE que activa o cambia la suscripción de un
 * cliente) y, si por ese cambio el cliente pasó de "sin revisión" a "con
 * revisión", envía el correo resumen a los administradores.
 */
export async function conAvisoDeRevision(
  clienteId: string,
  cambio: () => Promise<unknown>,
  motivo: 'upgrade' | 'diagnostico' = 'upgrade'
): Promise<void> {
  const antes = await clienteRequiereRevision(clienteId)
  await cambio()
  await avisarSiPasoARevision(clienteId, antes, motivo)
}
