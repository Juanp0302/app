/**
 * lib/leads-db.ts
 * Tabla de leads con UTMs. Usada por /api/leads (recepción desde N8N)
 * y por el dashboard de leads de superadmin.
 */

import { db, execute, queryAll, queryOne } from './db'

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
}

export async function insertarLead(data: LeadData): Promise<number> {
  const r = await db.execute({
    sql: `INSERT INTO leads
            (nombre, empresa, correo, asunto, mensaje,
             utm_source, utm_medium, utm_campaign, utm_term, utm_content,
             landing_page, referrer)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
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
  const [total, porSource, porMedium, porCampaign, porDia] = await Promise.all([
    queryOne(`SELECT COUNT(*) as cnt FROM leads`) as Promise<any>,
    queryAll(`SELECT COALESCE(utm_source,'(sin fuente)') as label, COUNT(*) as cnt
              FROM leads GROUP BY utm_source ORDER BY cnt DESC LIMIT 10`) as Promise<any[]>,
    queryAll(`SELECT COALESCE(utm_medium,'(sin medio)') as label, COUNT(*) as cnt
              FROM leads GROUP BY utm_medium ORDER BY cnt DESC LIMIT 10`) as Promise<any[]>,
    queryAll(`SELECT COALESCE(utm_campaign,'(sin campaña)') as label, COUNT(*) as cnt
              FROM leads GROUP BY utm_campaign ORDER BY cnt DESC LIMIT 10`) as Promise<any[]>,
    queryAll(`SELECT DATE(created_at) as dia, COUNT(*) as cnt
              FROM leads GROUP BY DATE(created_at) ORDER BY dia DESC LIMIT 30`) as Promise<any[]>,
  ])
  return { total: total?.cnt ?? 0, porSource, porMedium, porCampaign, porDia: porDia.reverse() }
}
