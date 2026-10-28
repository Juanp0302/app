/** Leads duplicados que ya existían antes de principal_id: la migración los enlaza al más antiguo. */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'
import { NextRequest } from 'next/server'
import { createClient } from '@libsql/client'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'owl-leads-unif-'))
process.env.DB_PATH = path.join(tmp, 'test.db')
delete process.env.TURSO_DATABASE_URL
delete process.env.TURSO_AUTH_TOKEN

vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => ({ user: { id: 's', is_superadmin: true } })) }))

beforeAll(async () => {
  // Esquema viejo (sin pipeline) con duplicados: misma persona por correo y misma empresa por NIT en datos.
  const db = createClient({ url: `file:${process.env.DB_PATH!.replace(/\\/g, '/')}` })
  await db.execute(`CREATE TABLE leads (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, empresa TEXT, correo TEXT, asunto TEXT,
    mensaje TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_term TEXT, utm_content TEXT, landing_page TEXT,
    referrer TEXT, origen TEXT, telefono TEXT, reunion TEXT, datos TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`)
  await db.execute(`INSERT INTO leads (nombre, correo, origen, datos) VALUES
    ('Ana', 'ana@isp.co', 'webinar', NULL),
    ('Ana', 'Ana@ISP.co', 'autodiagnostico', NULL),
    ('Otro', 'otro@x.co', 'contacto', NULL)`)
  await db.execute(`CREATE TABLE users (id TEXT PRIMARY KEY, nombre TEXT, email TEXT, is_superadmin INTEGER, created_at TEXT)`)
  db.close()
})

describe('unificar duplicados existentes', () => {
  it('deja un lead por contacto en el pipeline y conserva todos los envíos', async () => {
    const route = await import('@/app/api/leads/route')
    const j: any = await (await route.GET(new NextRequest('http://localhost/api/leads'))).json()
    expect(j.leads).toHaveLength(3)
    expect(j.pipeline.leads).toHaveLength(2)
    const ana = j.pipeline.leads.find((l: any) => l.nombre === 'Ana')
    expect(ana.id).toBe(1)
    expect(Number(ana.formularios)).toBe(2)
    // Repetir la migración no cambia nada.
    const j2: any = await (await route.GET(new NextRequest('http://localhost/api/leads'))).json()
    expect(j2.pipeline.leads).toHaveLength(2)
  })
})
