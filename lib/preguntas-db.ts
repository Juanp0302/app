/**
 * lib/preguntas-db.ts
 * Preguntas del público en charlas y eventos (ej. ExpoISP 2026). Las recibe
 * /api/preguntas desde la página pública owlcompliance.com/preguntas y las ve
 * el superadmin en /dashboard/preguntas.
 */
import crypto from 'crypto'
import { db, execute, queryAll, queryOne } from './db'

export const ESTADOS_PREGUNTA = ['nueva', 'seleccionada', 'respondida'] as const
export type EstadoPregunta = typeof ESTADOS_PREGUNTA[number]

/** Envíos permitidos por IP en la ventana. Holgado a propósito: en un evento muchos comparten el wifi (misma IP). */
export const LIMITE_POR_IP     = 30
export const VENTANA_MINUTOS   = 10

let _migrated = false
export async function migratePreguntas() {
  if (_migrated) return
  await execute(`
    CREATE TABLE IF NOT EXISTS preguntas (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      nombre              TEXT NOT NULL,
      empresa             TEXT NOT NULL,
      celular             TEXT NOT NULL,
      correo              TEXT NOT NULL,
      pregunta            TEXT NOT NULL,
      autorizacion        INTEGER NOT NULL DEFAULT 0,
      autorizacion_fecha  TEXT,
      utm_source          TEXT NOT NULL DEFAULT '',
      utm_medium          TEXT NOT NULL DEFAULT '',
      utm_campaign        TEXT NOT NULL DEFAULT '',
      estado              TEXT NOT NULL DEFAULT 'nueva',
      respuesta           TEXT NOT NULL DEFAULT '',
      publicada           INTEGER NOT NULL DEFAULT 0,
      ip_hash             TEXT
    )
  `)
  await execute(`CREATE INDEX IF NOT EXISTS idx_preguntas_ip ON preguntas(ip_hash, fecha)`)
  _migrated = true
}

/** La IP no se guarda en claro: solo un hash, que basta para el límite de envíos. */
export function hashIp(ip: string): string {
  const sal = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? 'owl'
  return crypto.createHash('sha256').update(`${sal}:${ip}`).digest('hex').slice(0, 32)
}

export async function enviosRecientes(ipHash: string): Promise<number> {
  const desde = new Date(Date.now() - VENTANA_MINUTOS * 60_000).toISOString()
  const r = await queryOne(`SELECT COUNT(*) AS n FROM preguntas WHERE ip_hash = ? AND fecha >= ?`, [ipHash, desde]) as any
  return Number(r?.n ?? 0)
}

export interface NuevaPregunta {
  nombre: string; empresa: string; celular: string; correo: string; pregunta: string
  utm_source: string; utm_medium: string; utm_campaign: string
  ipHash: string
}

export async function insertarPregunta(p: NuevaPregunta): Promise<number> {
  const ahora = new Date().toISOString()
  const r = await db.execute({
    sql: `INSERT INTO preguntas
            (fecha, nombre, empresa, celular, correo, pregunta, autorizacion, autorizacion_fecha,
             utm_source, utm_medium, utm_campaign, ip_hash)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
    args: [ahora, p.nombre, p.empresa, p.celular, p.correo, p.pregunta, ahora,
           p.utm_source, p.utm_medium, p.utm_campaign, p.ipHash],
  })
  return Number(r.lastInsertRowid)
}

/** Para el superadmin. Nunca devuelve el hash de IP. */
export async function listarPreguntas(campana?: string) {
  const where = campana ? `WHERE utm_campaign = ?` : ''
  return queryAll(
    `SELECT id, fecha, nombre, empresa, celular, correo, pregunta, autorizacion, autorizacion_fecha,
            utm_source, utm_medium, utm_campaign, estado, respuesta, publicada
     FROM preguntas ${where} ORDER BY fecha DESC, id DESC`,
    campana ? [campana] : []
  )
}

export async function campanasPreguntas(): Promise<string[]> {
  const rows = await queryAll(`SELECT DISTINCT utm_campaign AS c FROM preguntas ORDER BY c`) as any[]
  return rows.map(r => r.c ?? '')
}

export async function cambiarEstadoPregunta(id: number, estado: EstadoPregunta): Promise<boolean> {
  const r = await db.execute({ sql: `UPDATE preguntas SET estado = ? WHERE id = ?`, args: [estado, id] })
  return r.rowsAffected > 0
}

/** CSV con separador ; y BOM, para que Excel en español lo abra con tildes y columnas bien. */
export function preguntasACsv(filas: any[]): string {
  const cols = ['id', 'fecha', 'nombre', 'empresa', 'celular', 'correo', 'pregunta', 'autorizacion', 'autorizacion_fecha',
                'utm_source', 'utm_medium', 'utm_campaign', 'estado', 'respuesta', 'publicada']
  const celda = (v: unknown) => {
    let t = v == null ? '' : String(v)
    if (/^[=+\-@]/.test(t)) t = `'${t}`              // evita que Excel lo interprete como fórmula
    return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  return '﻿' + [cols.join(';'), ...filas.map(f => cols.map(c => celda(f[c])).join(';'))].join('\r\n')
}
