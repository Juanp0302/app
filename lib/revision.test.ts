/**
 * Pruebas de la regla "¿requiere revisión?" y del Diagnóstico Integral.
 * Usan una base de datos SQLite TEMPORAL (nunca la de producción) y las rutas
 * de API reales, con la sesión y las notificaciones simuladas.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'
import { NextRequest } from 'next/server'

// ── Entorno: ANTES de importar cualquier módulo que abra la base de datos ────────
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'owl-revision-'))
process.env.DB_PATH = path.join(tmp, 'test.db')
process.env.UPLOADS_DIR = path.join(tmp, 'uploads')
delete process.env.TURSO_DATABASE_URL
delete process.env.TURSO_AUTH_TOKEN

// ── Simulaciones ────────────────────────────────────────────────────────────────
const notif = vi.hoisted(() => ({
  documentoSubido: [] as any[], sinAsignar: [] as any[], diagnostico: [] as any[], enRevision: [] as any[],
}))

vi.mock('@/lib/notificaciones', () => ({
  notificarDocumentoSubido:       async (p: any) => { notif.documentoSubido.push(p) },
  notificarSinAsignar:            async (p: any) => { notif.sinAsignar.push(p) },
  notificarRevisionDocumento:     async () => {},
  notificarDiagnostico:           async (p: any) => { notif.diagnostico.push(p) },
  notificarDocumentosEnRevision:  async (p: any) => { notif.enRevision.push(p) },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

let db: any, execute: any, queryAll: any, queryOne: any
let auth: any
let rule: typeof import('./revision-regla')
let rev: typeof import('./revision')
let docs: typeof import('./documentos')
let docRoute: typeof import('@/app/api/documentos/route')
let diagRoute: typeof import('@/app/api/diagnostico/route')
let subsRoute: typeof import('@/app/api/suscripcion/route')

const ADMIN_ID = 'u-admin', SUPER_ID = 'u-super'
const ids: Record<string, string> = {}   // nombre → cliente_id

async function crearCliente(nombre: string, f: { plan: string | null; estado: string; cortesia?: number; diag?: string | null }) {
  const uid = `u-${nombre}`, cid = `c-${nombre}`
  await execute(`INSERT INTO users (id, email, password, nombre, rol, activo) VALUES (?,?,?,?,?,1)`, [uid, `${nombre}@x.co`, 'x', nombre, 'cliente'])
  await execute(
    `INSERT INTO clientes (id, user_id, razon_social, plan, suscripcion_estado, es_cortesia, diagnostico_estado) VALUES (?,?,?,?,?,?,?)`,
    [cid, uid, `Empresa ${nombre}`, f.plan, f.estado, f.cortesia ?? 0, f.diag ?? null]
  )
  ids[nombre] = cid
}

const sesionCliente = (nombre: string) => ({ user: { id: `u-${nombre}`, email: `${nombre}@x.co`, role: 'cliente' } })
const sesionAdmin   = () => ({ user: { id: ADMIN_ID, email: 'admin@owl.co', role: 'admin', is_superadmin: false } })
const sesionSuper   = () => ({ user: { id: SUPER_ID, email: 'super@owl.co', role: 'admin', is_superadmin: true } })

async function subir(nombre: string, archivo = 'soporte.pdf') {
  auth.mockResolvedValue(sesionCliente(nombre))
  const fd = new FormData()
  fd.append('aspecto', 'FINANCIERO'); fd.append('obligacion', 'Pago de contraprestaciones'); fd.append('anio', '2026')
  fd.append('archivo', new File([new Uint8Array([37, 80, 68, 70])], archivo, { type: 'application/pdf' }))
  const res = await docRoute.POST(new NextRequest('http://localhost/api/documentos', { method: 'POST', body: fd }))
  return { status: res.status, json: await res.json() as any }
}

async function post(route: any, usuario: any, body: any, url = 'http://localhost/api/diagnostico') {
  auth.mockResolvedValue(usuario)
  const res = await route.POST(new NextRequest(url, { method: 'POST', body: JSON.stringify(body) }))
  return { status: res.status, json: await res.json() as any }
}
async function patch(route: any, usuario: any, body: any) {
  auth.mockResolvedValue(usuario)
  const res = await route.PATCH(new NextRequest('http://localhost/api/suscripcion', { method: 'PATCH', body: JSON.stringify(body) }))
  return { status: res.status, json: await res.json() as any }
}

const enCola = async (nombre?: string) =>
  (await docs.listarPendientesRevision(nombre ? ids[nombre] : undefined) as any[]).filter(d => !nombre || d.cliente_id === ids[nombre])

beforeAll(async () => {
  ;({ db, execute, queryAll, queryOne } = await import('./db') as any)
  rule     = await import('./revision-regla')
  rev      = await import('./revision')
  docs     = await import('./documentos')
  ;({ auth } = await import('@/lib/auth') as any)
  docRoute  = await import('@/app/api/documentos/route')
  diagRoute = await import('@/app/api/diagnostico/route')
  subsRoute = await import('@/app/api/suscripcion/route')

  const ddl = [
    `CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, password TEXT, nombre TEXT, rol TEXT, activo INTEGER NOT NULL DEFAULT 1)`,
    `CREATE TABLE clientes (id TEXT PRIMARY KEY, user_id TEXT, razon_social TEXT, nit TEXT, contacto TEXT, email TEXT, telefono TEXT,
       activo INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), admin_revision_id TEXT, storage_type TEXT, storage_config TEXT)`,
    `CREATE TABLE obligaciones_catalogo (sub_id INTEGER PRIMARY KEY, aspecto TEXT, obligacion TEXT, sub_titulo TEXT, periodicidad TEXT, servicio TEXT, grupo TEXT)`,
    `CREATE TABLE cliente_obligaciones (id TEXT PRIMARY KEY, cliente_id TEXT, catalogo_id INTEGER, estado TEXT DEFAULT 'pendiente', updated_by TEXT, updated_at TEXT)`,
    `CREATE TABLE documentos (id TEXT PRIMARY KEY, cliente_id TEXT, cliente_obl_id TEXT, nombre_archivo TEXT, ruta TEXT, anio INTEGER, trimestre INTEGER,
       uploaded_by TEXT, uploaded_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE admin_especialidades (user_id TEXT, tipo TEXT)`,
    `CREATE TABLE audit_log (id TEXT PRIMARY KEY, user_id TEXT, user_email TEXT, accion TEXT, entidad TEXT, entidad_id TEXT, detalle TEXT, ip TEXT, created_at TEXT DEFAULT (datetime('now')))`,
  ]
  for (const s of ddl) await execute(s)
  await (await import('./suscripcion')).migrateSuscripcion()   // agrega plan, suscripcion_estado, es_cortesia, diagnostico_*…

  await execute(`INSERT INTO users (id, email, password, nombre, rol, activo) VALUES (?,?,?,?,?,1)`, [ADMIN_ID, 'admin@owl.co', 'x', 'Admin', 'admin'])
  await execute(`INSERT INTO users (id, email, password, nombre, rol, activo) VALUES (?,?,?,?,?,1)`, [SUPER_ID, 'super@owl.co', 'x', 'Super', 'admin'])

  await crearCliente('basico',      { plan: 'basico',  estado: 'trial'  })
  await crearCliente('basicoAct',   { plan: 'basico',  estado: 'activa' })
  await crearCliente('pro',         { plan: 'pro',     estado: 'activa' })
  await crearCliente('premium',     { plan: 'premium', estado: 'activa' })
  await crearCliente('proTrial',    { plan: 'pro',     estado: 'trial'  })
  await crearCliente('proSusp',     { plan: 'pro',     estado: 'suspendida' })
  await crearCliente('cortesiaPro', { plan: 'pro',     estado: 'activa', cortesia: 1 })
  await crearCliente('sinPlan',     { plan: null,      estado: 'trial'  })
  await crearCliente('planTrial',   { plan: 'trial',   estado: 'activa' })
  await crearCliente('diagActivo',  { plan: 'basico',  estado: 'activa', diag: 'activo' })
})

beforeEach(() => { for (const k of Object.keys(notif) as (keyof typeof notif)[]) notif[k].length = 0 })

// ─────────────────────────────────────────────────────────────────────────────
describe('regla: quién requiere revisión', () => {
  const esperado: Record<string, boolean> = {
    basico: false, basicoAct: false, pro: true, premium: true, proTrial: false, proSusp: false,
    cortesiaPro: false, sinPlan: false, planTrial: false, diagActivo: true,
  }

  it('la función cumple la tabla de casos acordada (Pro/Premium activo y diagnóstico activo; todo lo demás no)', async () => {
    for (const [nombre, req] of Object.entries(esperado)) {
      const info = await rev.infoRevisionCliente(ids[nombre])
      expect(info?.requiere, nombre).toBe(req)
    }
  })

  it('el fragmento SQL da EXACTAMENTE el mismo resultado que la función, cliente por cliente', async () => {
    const filas = await queryAll(`SELECT c.id FROM clientes c WHERE ${rule.sqlRequiereRevision('c')}`) as any[]
    const sql = new Set(filas.map(f => f.id))
    for (const [nombre, req] of Object.entries(esperado)) expect(sql.has(ids[nombre]), nombre).toBe(req)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('subida de documentos (ruta real)', () => {
  it('plan Básico: se guarda, NO se notifica a ningún administrador y NO entra a la cola', async () => {
    const r = await subir('basico')
    expect(r.status).toBe(200)
    expect(r.json.requiereRevision).toBe(false)
    expect(notif.documentoSubido).toHaveLength(0)
    expect(notif.sinAsignar).toHaveLength(0)
    expect((await queryAll(`SELECT id FROM documentos WHERE cliente_id = ?`, [ids.basico]) as any[])).toHaveLength(1)
    expect(await enCola('basico')).toHaveLength(0)
  })

  it.each(['basicoAct', 'proTrial', 'cortesiaPro', 'sinPlan', 'planTrial'])('%s: tampoco notifica ni entra a la cola', async (n) => {
    const r = await subir(n)
    expect(r.json.requiereRevision).toBe(false)
    expect(notif.documentoSubido).toHaveLength(0)
    expect(await enCola(n)).toHaveLength(0)
  })

  it.each(['pro', 'premium'])('%s: SÍ notifica al administrador y entra a la cola', async (n) => {
    const r = await subir(n)
    expect(r.json.requiereRevision).toBe(true)
    expect(notif.documentoSubido).toHaveLength(1)
    expect(notif.documentoSubido[0].adminEmails.length).toBeGreaterThan(0)
    expect(await enCola(n)).toHaveLength(1)
  })

  it('un Básico con diagnóstico activo se comporta como Pro: notifica y entra a la cola', async () => {
    const r = await subir('diagActivo')
    expect(r.json.requiereRevision).toBe(true)
    expect(notif.documentoSubido).toHaveLength(1)
    expect(await enCola('diagActivo')).toHaveLength(1)
  })

  it('la pantalla del cliente ve "no_requiere" (no "pendiente de revisión") y conserva aprobado/rechazado', async () => {
    const ap = await queryOne(`SELECT id FROM documentos WHERE cliente_id = ?`, [ids.basico]) as any
    await execute(`INSERT INTO documentos (id, cliente_id, nombre_archivo, ruta, anio, uploaded_by, estado_revision) VALUES ('d-apro', ?, 'a.pdf', 'r', 2026, ?, 'aprobado')`, [ids.basico, 'u-basico'])
    auth.mockResolvedValue(sesionCliente('basico'))
    const res = await docRoute.GET(new NextRequest('http://localhost/api/documentos'))
    const json: any = await res.json()
    const estados = json.grupos.flatMap((g: any) => g.archivos.map((a: any) => a.estado_revision)).sort()
    expect(estados).toEqual(['aprobado', 'no_requiere'])
    expect(json.revision.requiere).toBe(false)
    expect(json.revision.porPlan).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('upgrade y downgrade', () => {
  it('Básico → Pro (por la ruta del superadmin): todos los documentos ya cargados entran a revisión y se envía UN correo resumen', async () => {
    await crearCliente('sube', { plan: 'basico', estado: 'activa' })
    for (let i = 0; i < 3; i++) await subir('sube', `d${i}.pdf`)
    expect(await enCola('sube')).toHaveLength(0)
    expect(notif.documentoSubido).toHaveLength(0)

    const r = await patch(subsRoute, sesionSuper(), { clienteId: ids.sube, plan: 'pro' })
    expect(r.status).toBe(200)

    expect(await enCola('sube')).toHaveLength(3)
    expect(notif.enRevision).toHaveLength(1)                      // UN solo resumen, no uno por documento
    expect(notif.enRevision[0].porAdmin.every((a: any) => a.cantidad === 3)).toBe(true)
    expect(notif.enRevision[0].motivo).toBe('upgrade')
  })

  it('Pro con estado "trial" que se activa: sus documentos entran a revisión en ese momento', async () => {
    for (let i = 0; i < 2; i++) await subir('proTrial', `t${i}.pdf`)
    const antes = (await enCola('proTrial')).length
    await patch(subsRoute, sesionSuper(), { clienteId: ids.proTrial, estado: 'activa' })
    expect((await enCola('proTrial')).length).toBe(antes + 3)     // 1 de la prueba anterior + 2 nuevos
    expect(notif.enRevision).toHaveLength(1)
  })

  it('una cortesía que paga (conAvisoDeRevision + es_cortesia = 0) pasa a revisión', async () => {
    const antes = (await enCola('cortesiaPro')).length
    await rev.conAvisoDeRevision(ids.cortesiaPro, () =>
      execute(`UPDATE clientes SET plan = 'pro', suscripcion_estado = 'activa', es_cortesia = 0 WHERE id = ?`, [ids.cortesiaPro]))
    expect((await enCola('cortesiaPro')).length).toBeGreaterThan(antes)
    expect(notif.enRevision).toHaveLength(1)
  })

  it('NO hay resumen si el cliente ya requería revisión antes del cambio (Pro → Premium)', async () => {
    await patch(subsRoute, sesionSuper(), { clienteId: ids.pro, plan: 'premium' })
    expect(notif.enRevision).toHaveLength(0)
  })

  it('Pro → Básico: los pendientes salen de la cola (nadie los revisará) y no se envía ningún correo', async () => {
    expect((await enCola('premium')).length).toBeGreaterThan(0)
    await patch(subsRoute, sesionSuper(), { clienteId: ids.premium, plan: 'basico' })
    expect(await enCola('premium')).toHaveLength(0)
    expect(notif.enRevision).toHaveLength(0)
  })

  it('los documentos ya aprobados o rechazados NO se tocan al subir de plan', async () => {
    await crearCliente('hist', { plan: 'basico', estado: 'activa' })
    await execute(`INSERT INTO documentos (id, cliente_id, nombre_archivo, ruta, anio, uploaded_by, estado_revision) VALUES ('h-ok', ?, 'a.pdf', 'r', 2026, 'u-hist', 'aprobado')`, [ids.hist])
    await execute(`INSERT INTO documentos (id, cliente_id, nombre_archivo, ruta, anio, uploaded_by, estado_revision) VALUES ('h-no', ?, 'b.pdf', 'r', 2026, 'u-hist', 'rechazado')`, [ids.hist])
    await subir('hist', 'nuevo.pdf')
    await patch(subsRoute, sesionSuper(), { clienteId: ids.hist, plan: 'pro' })
    const cola = await enCola('hist')
    expect(cola).toHaveLength(1)                                   // solo el que estaba sin revisar
    expect((await queryOne(`SELECT estado_revision e FROM documentos WHERE id = 'h-ok'`) as any).e).toBe('aprobado')
    expect((await queryOne(`SELECT estado_revision e FROM documentos WHERE id = 'h-no'`) as any).e).toBe('rechazado')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('diagnóstico integral (rutas reales)', () => {
  beforeAll(async () => {
    await crearCliente('diag', { plan: 'basico', estado: 'activa' })
    for (let i = 0; i < 4; i++) await subir('diag', `g${i}.pdf`)
  })
  beforeEach(() => { for (const k of Object.keys(notif) as (keyof typeof notif)[]) notif[k].length = 0 })

  it('un cliente Pro NO puede solicitarlo (su plan ya incluye la revisión)', async () => {
    const r = await post(diagRoute, sesionCliente('pro'), { accion: 'solicitar' })
    expect(r.status).toBe(400)
  })

  it('un administrador o el superadmin no pueden "solicitar" (solo clientes)', async () => {
    expect((await post(diagRoute, sesionAdmin(), { accion: 'solicitar' })).status).toBe(403)
  })

  it('el cliente Básico lo solicita → estado "solicitado" y se avisa al superadmin; NO cambia la cola todavía', async () => {
    const r = await post(diagRoute, sesionCliente('diag'), { accion: 'solicitar' })
    expect(r.status).toBe(200)
    expect((await rev.infoRevisionCliente(ids.diag))?.diagnostico_estado).toBe('solicitado')
    expect(notif.diagnostico.map(n => n.evento)).toEqual(['solicitado'])
    expect(await enCola('diag')).toHaveLength(0)
  })

  it('solicitarlo dos veces seguidas da 409', async () => {
    expect((await post(diagRoute, sesionCliente('diag'), { accion: 'solicitar' })).status).toBe(409)
  })

  it('un administrador común NO puede activarlo (solo superadmin)', async () => {
    const r = await post(diagRoute, sesionAdmin(), { accion: 'activar', clienteId: ids.diag })
    expect(r.status).toBe(403)
    expect(await enCola('diag')).toHaveLength(0)
  })

  it('el superadmin lo activa → los 4 documentos ya cargados entran a revisión y se envía UN resumen', async () => {
    const r = await post(diagRoute, sesionSuper(), { accion: 'activar', clienteId: ids.diag })
    expect(r.status).toBe(200)
    expect(r.json.documentosEnRevision).toBe(4)
    expect(await enCola('diag')).toHaveLength(4)
    expect(notif.enRevision).toHaveLength(1)
    expect(notif.enRevision[0].motivo).toBe('diagnostico')
  })

  it('con el diagnóstico activo, un documento nuevo SÍ notifica (flujo como Pro/Premium)', async () => {
    const r = await subir('diag', 'nuevo-en-diagnostico.pdf')
    expect(r.json.requiereRevision).toBe(true)
    expect(notif.documentoSubido).toHaveLength(1)
  })

  it('cualquier administrador (no solo el superadmin) puede cerrarlo; avisa cuántos pendientes salen de la cola', async () => {
    const r = await post(diagRoute, sesionAdmin(), { accion: 'cerrar', clienteId: ids.diag })
    expect(r.status).toBe(200)
    expect(r.json.pendientesQueSalen).toBe(5)
    expect(await enCola('diag')).toHaveLength(0)
    expect(notif.diagnostico.map(n => n.evento)).toEqual(['cerrado'])
  })

  it('cerrarlo otra vez da 409, y un cliente no puede cerrar', async () => {
    expect((await post(diagRoute, sesionAdmin(), { accion: 'cerrar', clienteId: ids.diag })).status).toBe(409)
    expect((await post(diagRoute, sesionCliente('diag'), { accion: 'cerrar', clienteId: ids.diag })).status).toBe(403)
  })

  it('después de cerrado, los documentos nuevos vuelven a NO notificar', async () => {
    const r = await subir('diag', 'despues-de-cerrar.pdf')
    expect(r.json.requiereRevision).toBe(false)
    expect(notif.documentoSubido).toHaveLength(0)
  })

  it('desde "cerrado" el cliente puede solicitarlo de nuevo', async () => {
    expect((await post(diagRoute, sesionCliente('diag'), { accion: 'solicitar' })).status).toBe(200)
  })

  it('el listado de administradores trae los clientes con diagnóstico y sus pendientes', async () => {
    auth.mockResolvedValue(sesionAdmin())
    const res = await diagRoute.GET()
    const json: any = await res.json()
    const fila = json.diagnosticos.find((d: any) => d.id === ids.diag)
    expect(fila.diagnostico_estado).toBe('solicitado')
    expect(json.esSuperadmin).toBe(false)
  })

  it('quedó registro en la bitácora de cada paso', async () => {
    const acciones = (await queryAll(`SELECT accion FROM audit_log WHERE entidad = 'cliente' AND entidad_id = ? ORDER BY created_at, rowid`, [ids.diag]) as any[]).map(a => a.accion)
    expect(acciones).toEqual(['diagnostico_solicitado', 'diagnostico_activado', 'diagnostico_cerrado', 'diagnostico_solicitado'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('consultas del superadmin con la regla aplicada (sintaxis y resultado)', () => {
  it('las dos consultas modificadas de /api/superadmin se ejecutan y solo cuentan clientes con revisión', async () => {
    const pend = await queryAll(
      `SELECT c.admin_revision_id AS admin_id, COUNT(*) AS pendientes
       FROM documentos d JOIN clientes c ON c.id = d.cliente_id
       WHERE (d.estado_revision = 'pendiente' OR d.estado_revision IS NULL) AND ${rule.sqlRequiereRevision('c')}
         AND c.admin_revision_id IS NOT NULL GROUP BY c.admin_revision_id`) as any[]
    expect(Array.isArray(pend)).toBe(true)

    const sinAsignar = await queryAll(
      `SELECT d.id, c.razon_social FROM documentos d JOIN clientes c ON c.id = d.cliente_id
       WHERE (d.estado_revision = 'pendiente' OR d.estado_revision IS NULL) AND ${rule.sqlRequiereRevision('c')}
         AND (c.admin_revision_id IS NULL OR c.admin_revision_id = '')`) as any[]
    const razones = new Set(sinAsignar.map(r => r.razon_social))
    expect(razones.has('Empresa basico')).toBe(false)      // Básico: nunca
    expect(razones.has('Empresa sinPlan')).toBe(false)     // sin plan: nunca
  })
})
