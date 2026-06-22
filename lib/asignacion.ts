/**
 * lib/asignacion.ts
 * Lógica de asignación automática de tickets y chats a administradores.
 *
 * Modos:
 *   'unico'       → siempre al primero de la lista (él redistribuye)
 *   'consecutivo' → round-robin en el orden configurado
 */

import { queryOne, queryAll, execute } from '@/lib/db'

export const ESPECIALIDADES = ['financiera', 'tecnica', 'juridica', 'transversal'] as const
export type Especialidad = typeof ESPECIALIDADES[number]
export type TipoEntidad  = 'ticket' | 'chat'

/** Crea la tabla si no existe (se llama desde las rutas API). */
export async function ensureAsignacionTable(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS asignacion_config (
      tipo         TEXT NOT NULL,
      especialidad TEXT NOT NULL,
      modo         TEXT NOT NULL DEFAULT 'consecutivo',
      admin_ids    TEXT NOT NULL DEFAULT '[]',
      contador     INTEGER NOT NULL DEFAULT 0,
      updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (tipo, especialidad)
    )
  `)
}

/**
 * Devuelve el user_id del admin al que se debe asignar un nuevo ticket/chat.
 * Si no hay config guardada, cae al primer admin activo con esa especialidad.
 */
export async function adminParaAsignacion(
  especialidad: string,
  tipo: TipoEntidad
): Promise<string | null> {
  await ensureAsignacionTable()

  const cfg = await queryOne(
    'SELECT * FROM asignacion_config WHERE tipo = ? AND especialidad = ?',
    [tipo, especialidad]
  ) as any

  let adminIds: string[] = []
  let modo = 'consecutivo'
  let contador = 0

  if (cfg) {
    try { adminIds = JSON.parse(cfg.admin_ids) } catch {}
    modo    = cfg.modo    ?? 'consecutivo'
    contador = Number(cfg.contador ?? 0)
  }

  // Filtrar solo los que siguen activos
  if (adminIds.length > 0) {
    const ph     = adminIds.map(() => '?').join(',')
    const activos = await queryAll(
      `SELECT id FROM users WHERE id IN (${ph}) AND activo = 1 AND rol = 'admin'`,
      adminIds
    ) as any[]
    const activoSet = new Set(activos.map((a: any) => a.id))
    adminIds = adminIds.filter(id => activoSet.has(id))
  }

  // Fallback: primer admin activo con esta especialidad
  if (adminIds.length === 0) {
    const row = await queryOne(
      `SELECT ae.user_id FROM admin_especialidades ae
       JOIN users u ON u.id = ae.user_id
       WHERE ae.tipo = ? AND u.activo = 1 LIMIT 1`,
      [especialidad]
    ) as any
    return row?.user_id ?? null
  }

  if (modo === 'unico') {
    return adminIds[0]
  }

  // Round-robin
  const idx     = contador % adminIds.length
  const adminId = adminIds[idx]

  await execute(
    `UPDATE asignacion_config
     SET contador = contador + 1, updated_at = datetime('now')
     WHERE tipo = ? AND especialidad = ?`,
    [tipo, especialidad]
  )

  return adminId
}

/** Guarda (upsert) la configuración para un tipo+especialidad. Resetea el contador. */
export async function guardarAsignacionConfig(
  tipo: TipoEntidad,
  especialidad: string,
  modo: 'unico' | 'consecutivo',
  adminIds: string[]
): Promise<void> {
  await ensureAsignacionTable()
  await execute(
    `INSERT INTO asignacion_config (tipo, especialidad, modo, admin_ids, contador)
     VALUES (?, ?, ?, ?, 0)
     ON CONFLICT(tipo, especialidad) DO UPDATE
     SET modo = excluded.modo,
         admin_ids = excluded.admin_ids,
         contador  = 0,
         updated_at = datetime('now')`,
    [tipo, especialidad, modo, JSON.stringify(adminIds)]
  )
}

/** Lee todas las configuraciones actuales. */
export async function listarAsignacionConfig(): Promise<any[]> {
  await ensureAsignacionTable()
  return queryAll('SELECT * FROM asignacion_config ORDER BY tipo, especialidad')
}
