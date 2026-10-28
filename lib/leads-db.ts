/**
 * lib/leads-db.ts
 * Tabla de leads con UTMs. Usada por /api/leads (recepción desde N8N)
 * y por el dashboard de leads de superadmin.
 */

import { db, execute, queryAll, queryOne } from './db'
import { soloDigitos } from './ventas'

let _migrated = false

export async function migrateLeads() {
  if (_migrated) return
  _migrated = true
  await execute(`
    CREATE TABLE IF NOT EXISTS leads (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre        TEXT,
      empresa       TEXT,
      correo        TEXT,
      asunto        TEXT,
      mensaje       TEXT,
      utm_source    TEXT,
      utm_medium    TEXT,
      utm_campaign  TEXT,
      utm_term      TEXT,
      utm_content   TEXT,
      landing_page  TEXT,
      referrer      TEXT,
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `)
  // Columnas agregadas después: de qué formulario viene el lead y sus datos propios.
  for (const sql of [
    `ALTER TABLE leads ADD COLUMN origen TEXT`,      // contacto | autodiagnostico | webinar | <otro formulario>
    `ALTER TABLE leads ADD COLUMN telefono TEXT`,
    `ALTER TABLE leads ADD COLUMN reunion TEXT`,     // 'Sí' | 'No'
    `ALTER TABLE leads ADD COLUMN datos TEXT`,       // JSON con los campos propios del formulario (NIT, % cumplimiento…)
    // Pipeline de ventas (lib/pipeline.ts, docs/playbook-ventas.md)
    `ALTER TABLE leads ADD COLUMN etapa TEXT NOT NULL DEFAULT 'nuevo'`,
    `ALTER TABLE leads ADD COLUMN etapa_updated_at TEXT`,
    `ALTER TABLE leads ADD COLUMN asistio_webinar INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE leads ADD COLUMN nit TEXT`,
    `ALTER TABLE leads ADD COLUMN q_dolor INTEGER NOT NULL DEFAULT 0`,        // 0 sin info · 1 parcial · 2 confirmado
    `ALTER TABLE leads ADD COLUMN q_presupuesto INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE leads ADD COLUMN q_decision INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE leads ADD COLUMN dolor_nota TEXT`,
    `ALTER TABLE leads ADD COLUMN plan_objetivo TEXT`,
    `ALTER TABLE leads ADD COLUMN proxima_accion TEXT`,
    `ALTER TABLE leads ADD COLUMN proxima_fecha TEXT`,
    `ALTER TABLE leads ADD COLUMN motivo_descarte TEXT`,
    // Misma persona/empresa que llena otro formulario: la fila queda como envío y apunta al lead principal,
    // que es el único que vive en el pipeline (NULL = es principal).
    `ALTER TABLE leads ADD COLUMN principal_id INTEGER`,
    // Quién trabaja el lead (users.id). Los admins solo ven los suyos; el superadmin ve todos.
    `ALTER TABLE leads ADD COLUMN responsable_id TEXT`,
    // Cadencia de seguimiento (lib/cadencias.ts): cuál, qué paso toca (0 = el primero) y si sigue activa.
    `ALTER TABLE leads ADD COLUMN cadencia TEXT`,
    `ALTER TABLE leads ADD COLUMN paso_cadencia INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE leads ADD COLUMN cadencia_estado TEXT`,              // activa | respondio | terminada
    `ALTER TABLE leads ADD COLUMN minutos_webinar INTEGER`,           // minutos conectado al webinar (si asistió)
  ]) {
    try { await execute(sql) } catch { /* la columna ya existe */ }
  }
  await execute(`
    CREATE TABLE IF NOT EXISTS leads_etapas (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id        INTEGER NOT NULL,
      etapa_anterior TEXT,
      etapa_nueva    TEXT NOT NULL,
      user_id        TEXT,
      created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `)
  await execute(`CREATE INDEX IF NOT EXISTS idx_leads_etapas_lead ON leads_etapas(lead_id)`)
  await execute(`CREATE INDEX IF NOT EXISTS idx_leads_principal ON leads(principal_id)`)
  await unificarDuplicados()
}

/** Claves de contacto: correo en minúsculas y NIT solo dígitos. */
const claves = (l: { correo?: string | null; nit?: string | null }) =>
  [l.correo?.trim() ? `c:${l.correo.trim().toLowerCase()}` : '', soloDigitos(l.nit) ? `n:${soloDigitos(l.nit)}` : '']
    .filter(Boolean)

/**
 * Enlaza a su lead principal (el más antiguo con el mismo correo o NIT) las filas que entraron
 * antes de existir principal_id. Idempotente: solo escribe las filas que cambian.
 */
async function unificarDuplicados() {
  const filas = await queryAll<any>(`SELECT id, correo, nit, principal_id FROM leads ORDER BY id`)
  const duenoDe = new Map<string, number>()
  for (const f of filas) {
    const ks = claves(f)
    const principal = ks.map(k => duenoDe.get(k)).find(v => v !== undefined) ?? Number(f.id)
    for (const k of ks) if (!duenoDe.has(k)) duenoDe.set(k, principal)
    const deseado = principal === Number(f.id) ? null : principal
    if ((f.principal_id == null ? null : Number(f.principal_id)) !== deseado)
      await execute(`UPDATE leads SET principal_id = ? WHERE id = ?`, [deseado, f.id])
  }
}

async function buscarPrincipal(correo?: string | null, nit?: string | null): Promise<number | null> {
  const c = (correo ?? '').trim().toLowerCase(), n = soloDigitos(nit)
  if (!c && !n) return null
  const r: any = await queryOne(
    `SELECT COALESCE(principal_id, id) AS pid FROM leads
     WHERE (? <> '' AND lower(trim(correo)) = ?) OR (? <> '' AND nit = ?)
     ORDER BY id LIMIT 1`, [c, c, n, n])
  return r ? Number(r.pid) : null
}

/** Deduce el formulario de origen cuando el flujo no lo informa (flujos viejos de n8n). */
export function inferirOrigen(d: { origen?: string; asunto?: string; landing_page?: string }): string {
  const o = (d.origen ?? '').trim().toLowerCase()
  if (o) return o.slice(0, 40)
  if (/^webinar/i.test(d.asunto ?? '') || /webinar/i.test(d.landing_page ?? '')) return 'webinar'
  if (/autodiagn/i.test(d.asunto ?? '') || /autodiagn/i.test(d.landing_page ?? '')) return 'autodiagnostico'
  return 'contacto'
}

export interface LeadData {
  nombre?:       string
  empresa?:      string
  correo?:       string
  asunto?:       string
  mensaje?:      string
  utm_source?:   string
  utm_medium?:   string
  utm_campaign?: string
  utm_term?:     string
  utm_content?:  string
  landing_page?: string
  referrer?:     string
  origen?:       string
  telefono?:     string
  reunion?:      string
  datos?:        string   // JSON
}

function nitDeDatos(datos?: string): string | null {
  try { const n = soloDigitos(JSON.parse(datos ?? '{}').nit); return n || null } catch { return null }
}

export async function insertarLead(data: LeadData): Promise<number> {
  const nit = nitDeDatos(data.datos)
  const principal = await buscarPrincipal(data.correo, nit)
  const r = await db.execute({
    sql: `INSERT INTO leads
            (nombre, empresa, correo, asunto, mensaje,
             utm_source, utm_medium, utm_campaign, utm_term, utm_content,
             landing_page, referrer, origen, telefono, reunion, datos, nit, principal_id)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      data.nombre       ?? null,
      data.empresa      ?? null,
      data.correo       ?? null,
      data.asunto       ?? null,
      data.mensaje      ?? null,
      data.utm_source   ?? null,
      data.utm_medium   ?? null,
      data.utm_campaign ?? null,
      data.utm_term     ?? null,
      data.utm_content  ?? null,
      data.landing_page ?? null,
      data.referrer     ?? null,
      inferirOrigen(data),
      data.telefono     ?? null,
      data.reunion      ?? null,
      data.datos        ?? null,
      nit,
      principal,
    ],
  })
  return Number(r.lastInsertRowid)
}

export async function obtenerLeads(limite = 500) {
  return queryAll(
    `SELECT * FROM leads ORDER BY created_at DESC LIMIT ?`,
    [limite]
  )
}

export async function statsLeads() {
  const [total, porSource, porMedium, porCampaign, porDia, porOrigen] = await Promise.all([
    queryOne(`SELECT COUNT(*) as cnt FROM leads`) as Promise<any>,
    queryAll(`SELECT COALESCE(utm_source,'(sin fuente)') as label, COUNT(*) as cnt
              FROM leads GROUP BY utm_source ORDER BY cnt DESC LIMIT 10`) as Promise<any[]>,
    queryAll(`SELECT COALESCE(utm_medium,'(sin medio)') as label, COUNT(*) as cnt
              FROM leads GROUP BY utm_medium ORDER BY cnt DESC LIMIT 10`) as Promise<any[]>,
    queryAll(`SELECT COALESCE(utm_campaign,'(sin campaña)') as label, COUNT(*) as cnt
              FROM leads GROUP BY utm_campaign ORDER BY cnt DESC LIMIT 10`) as Promise<any[]>,
    queryAll(`SELECT DATE(created_at) as dia, COUNT(*) as cnt
              FROM leads GROUP BY DATE(created_at) ORDER BY dia DESC LIMIT 30`) as Promise<any[]>,
    queryAll(`SELECT COALESCE(origen,'contacto') as label, COUNT(*) as cnt
              FROM leads GROUP BY COALESCE(origen,'contacto') ORDER BY cnt DESC`) as Promise<any[]>,
  ])
  return { total: total?.cnt ?? 0, porSource, porMedium, porCampaign, porDia: porDia.reverse(), porOrigen }
}
