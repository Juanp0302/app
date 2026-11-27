/** Reloj de las ventas automáticas: un solo ciclo por hora, lo dispare quien lo dispare. */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'owl-reloj-'))
process.env.DB_PATH = path.join(tmp, 'test.db')
delete process.env.TURSO_DATABASE_URL
delete process.env.TURSO_AUTH_TOKEN
delete process.env.GMAIL_USER
delete process.env.GMAIL_APP_PASSWORD

vi.mock('@/lib/smtp', () => ({ cuentaCorreo: () => 'contacto@owlcompliance.com', enviarSmtp: vi.fn(async () => ({ ok: true, messageId: '<x@owl>' })) }))

let reloj: typeof import('@/lib/reloj-ventas')

beforeAll(async () => {
  const db = await import('@/lib/db')
  await db.execute(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, nombre TEXT, email TEXT, is_superadmin INTEGER, created_at TEXT)`)
  reloj = await import('@/lib/reloj-ventas')
})

describe('reloj', () => {
  it('corre una sola vez por hora aunque lo llamen varios a la vez', async () => {
    const ahora = new Date('2026-11-27T15:10:00Z')   // 10:10 a. m. en Bogotá, viernes hábil
    const [a, b, c] = await Promise.all([reloj.cicloSiToca(ahora), reloj.cicloSiToca(ahora), reloj.cicloSiToca(new Date('2026-11-27T15:40:00Z'))])
    expect([a, b, c].filter(r => r.corrio)).toHaveLength(1)
    expect([a, b, c].filter(r => !r.corrio).map(r => !r.corrio && r.motivo)).toEqual(['ya corrió esta hora', 'ya corrió esta hora'])
    expect((await reloj.cicloSiToca(new Date('2026-11-27T16:05:00Z'))).corrio).toBe(true)     // la hora siguiente sí
  })

  it('fuera de 7 a. m. a 8 p. m. no corre', async () => {
    expect(await reloj.cicloSiToca(new Date('2026-11-27T11:30:00Z'))).toEqual({ corrio: false, motivo: 'fuera de horario' })   // 6:30 a. m.
    expect(await reloj.cicloSiToca(new Date('2026-11-28T02:10:00Z'))).toEqual({ corrio: false, motivo: 'fuera de horario' })   // 9:10 p. m.
  })
})
