/**
 * lib/leads-db.ts
 * Tabla de leads con UTMs. Usada por /api/leads (recepción desde N8N)
 * y por el dashboard de leads de superadmin.
 */

import { db, execute, queryAll, queryOne } from './db'
import { ETAPAS, ETAPAS_ACTIVAS, bloqueoDeAvance, soloDigitos, hoyBogota, type Etapa } from './pipeline'

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

// ── Pipeline ──────────────────────────────────────────────────────────────────

/**
 * Leads del tablero: solo los principales, sin límite, con lo agregado de todos sus formularios
 * (orígenes, si asistió al webinar, si pidió reunión, cuántos envíos).
 */
export async function obtenerPipeline() {
  return queryAll(`
    SELECT p.*,
      (SELECT group_concat(DISTINCT COALESCE(s.origen,'contacto')) FROM leads s WHERE s.id = p.id OR s.principal_id = p.id) AS origenes,
      (SELECT MAX(s.asistio_webinar) FROM leads s WHERE s.id = p.id OR s.principal_id = p.id) AS asistio_max,
      (SELECT MAX(s.reunion = 'Sí') FROM leads s WHERE s.id = p.id OR s.principal_id = p.id) AS pidio_reunion,
      (SELECT COUNT(*) FROM leads s WHERE s.id = p.id OR s.principal_id = p.id)              AS formularios,
      (SELECT MAX(s.created_at) FROM leads s WHERE s.id = p.id OR s.principal_id = p.id)     AS ultimo_formulario
    FROM leads p
    WHERE p.principal_id IS NULL
    ORDER BY p.created_at DESC`)
}

export interface CambiosPipeline {
  etapa?: Etapa
  q_dolor?: number; q_presupuesto?: number; q_decision?: number
  dolor_nota?: string; plan_objetivo?: string | null
  proxima_accion?: string; proxima_fecha?: string | null
  motivo_descarte?: string
}

const CAMPOS_PIPELINE = [
  'q_dolor', 'q_presupuesto', 'q_decision', 'dolor_nota', 'plan_objetivo',
  'proxima_accion', 'proxima_fecha', 'motivo_descarte',
] as const

const clampQ = (n: unknown) => Math.min(2, Math.max(0, Math.trunc(Number(n) || 0)))
const textoCorto = (v: unknown) => (v == null || v === '' ? null : String(v).slice(0, 2000))

/**
 * Aplica calificación / próxima acción y, si cambia la etapa, valida los requisitos de avance
 * (lib/pipeline.ts) y deja registro en leads_etapas. Si el id es un envío secundario, actúa sobre su principal.
 */
export async function actualizarPipeline(id: number, cambios: CambiosPipeline, userId?: string | null):
  Promise<{ ok: true } | { error: string; status: number }> {
  let lead: any = await queryOne(`SELECT * FROM leads WHERE id = ?`, [id])
  if (lead?.principal_id) lead = await queryOne(`SELECT * FROM leads WHERE id = ?`, [lead.principal_id])
  if (!lead) return { error: 'Lead no encontrado', status: 404 }
  if (cambios.etapa && !(ETAPAS as readonly string[]).includes(cambios.etapa))
    return { error: 'Etapa inválida', status: 400 }
  if (cambios.proxima_fecha && !/^\d{4}-\d{2}-\d{2}$/.test(String(cambios.proxima_fecha)))
    return { error: 'Fecha inválida (AAAA-MM-DD)', status: 400 }

  const nuevo: Record<string, any> = {}
  for (const k of CAMPOS_PIPELINE) {
    const v = (cambios as any)[k]
    if (v === undefined) continue
    nuevo[k] = k.startsWith('q_') ? clampQ(v) : textoCorto(v)
  }
  const fusion = { ...lead, ...nuevo }

  const cambiaEtapa = cambios.etapa && cambios.etapa !== lead.etapa
  if (cambiaEtapa) {
    const motivo = bloqueoDeAvance(cambios.etapa!, fusion)
    if (motivo) return { error: motivo, status: 400 }
    nuevo.etapa = cambios.etapa
    nuevo.etapa_updated_at = new Date().toISOString()
  }

  const cols = Object.keys(nuevo)
  if (cols.length) {
    await execute(`UPDATE leads SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...cols.map(c => nuevo[c]), lead.id])
  }
  if (cambiaEtapa) {
    await execute(`INSERT INTO leads_etapas (lead_id, etapa_anterior, etapa_nueva, user_id) VALUES (?,?,?,?)`,
      [lead.id, lead.etapa, cambios.etapa!, userId ?? null])
  }
  return { ok: true }
}

/** Año-semana (semanas desde el lunes) en hora de Bogotá, para una marca de tiempo UTC. */
function semanaBogota(iso: string) {
  const d = new Date(new Date(iso).getTime() - 5 * 3600_000)   // Colombia no tiene horario de verano
  const enero1 = Date.UTC(d.getUTCFullYear(), 0, 1)
  const offsetLunes = (new Date(enero1).getUTCDay() + 6) % 7
  const semana = Math.floor(((d.getTime() - enero1) / 86400_000 + offsetLunes) / 7)
  return `${d.getUTCFullYear()}-${String(semana).padStart(2, '0')}`
}

/**
 * Embudo: cuántos leads llegaron a cada etapa (la más alta que alcanzaron según el historial, aunque
 * después se perdieran o se saltaran etapas), reuniones realizadas y agendadas por semana y atrasados.
 */
export async function statsPipeline() {
  const [principales, historial, atrasados] = await Promise.all([
    queryAll<any>(`SELECT id, etapa FROM leads WHERE principal_id IS NULL`),
    queryAll<any>(`SELECT lead_id, etapa_nueva, created_at FROM leads_etapas ORDER BY created_at`),
    queryOne<any>(`SELECT COUNT(*) as cnt FROM leads
              WHERE principal_id IS NULL AND etapa NOT IN ('ganado','perdido')
                AND proxima_fecha IS NOT NULL AND proxima_fecha < ?`, [hoyBogota()]),
  ])
  const idx = (e: string) => ETAPAS_ACTIVAS.indexOf(e as Etapa)   // perdido = -1: no es avance
  const maxIdx = new Map<number, number>()
  for (const p of principales) maxIdx.set(Number(p.id), Math.max(0, idx(p.etapa)))
  const IDX_AGENDADA = idx('reunion_agendada'), IDX_REALIZADA = idx('reunion_realizada')
  const primeraAgendada = new Map<number, string>(), primeraRealizada = new Map<number, string>()
  for (const h of historial) {
    const id = Number(h.lead_id), i = idx(h.etapa_nueva)
    if (!maxIdx.has(id)) continue
    maxIdx.set(id, Math.max(maxIdx.get(id)!, i))
    // Saltar etapas cuenta: llegar a propuesta sin pasar por "realizada" también es una reunión hecha.
    if (i >= IDX_AGENDADA && !primeraAgendada.has(id)) primeraAgendada.set(id, h.created_at)
    if (i >= IDX_REALIZADA && !primeraRealizada.has(id)) primeraRealizada.set(id, h.created_at)
  }
  const porEtapa: Record<string, number> = {}
  for (const p of principales) porEtapa[p.etapa] = (porEtapa[p.etapa] ?? 0) + 1
  const alcanzados = [...maxIdx.values()]
  const porSemana = (m: Map<number, string>) => {
    const out: Record<string, number> = {}
    for (const f of m.values()) { const s = semanaBogota(f); out[s] = (out[s] ?? 0) + 1 }
    return Object.entries(out).sort().slice(-8).map(([semana, cnt]) => ({ semana, cnt }))
  }
  return {
    porEtapa,
    embudo: ETAPAS_ACTIVAS.map((e, i) => ({ etapa: e, cnt: alcanzados.filter(v => v >= i).length })),
    reunionesRealizadasPorSemana: porSemana(primeraRealizada),
    reunionesAgendadasPorSemana: porSemana(primeraAgendada),
    atrasados: Number(atrasados?.cnt ?? 0),
  }
}
