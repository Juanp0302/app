/** WhatsApp, fase 3 (lib/whatsapp-api.ts y lib/whatsapp-ventas.ts) contra una base de prueba; Meta y el SMTP son simulacros. */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'owl-whatsapp-'))
process.env.DB_PATH = path.join(tmp, 'test.db')
delete process.env.TURSO_DATABASE_URL
delete process.env.TURSO_AUTH_TOKEN
process.env.WHATSAPP_TOKEN = 'token-de-prueba'
process.env.WHATSAPP_PHONE_ID = '1459027670626993'

const correos: any[] = []
vi.mock('@/lib/smtp', () => ({
  cuentaCorreo: () => 'contacto@owlcompliance.com',
  enviarSmtp: vi.fn(async (c: any) => { correos.push(c); return { ok: true, messageId: '<x@owl>' } }),
}))

const aMeta: any[] = []
let salientes = 0
let metaFalla = false
const fetchOriginal = globalThis.fetch
globalThis.fetch = vi.fn(async (url: any, init: any) => {
  if (!String(url).startsWith('https://graph.facebook.com/')) return fetchOriginal(url, init)
  aMeta.push({ url: String(url), body: JSON.parse(init.body), auth: init.headers.Authorization })
  if (metaFalla) return new Response(JSON.stringify({ error: { code: 131047, message: 'Re-engagement message' } }), { status: 400 })
  return new Response(JSON.stringify({ messages: [{ id: `wamid.SAL${++salientes}` }] }), { status: 200 })
}) as any

import { firmaWebhookValida, leerWebhook, ventanaAbierta } from './whatsapp-api'

let wv: typeof import('@/lib/whatsapp-ventas')
let q: <T = any>(sql: string, args?: any[]) => Promise<T | undefined>
const prospecto = (id: string) => q<any>(`SELECT * FROM prospectos_isp WHERE id = ?`, [id])
const AHORA = new Date('2026-11-25T15:00:00Z')
const msj = (wamid: string, de: string, texto: string, fecha = AHORA, nombre: string | null = 'Rodrigo Vargas') =>
  ({ wamid, de, nombre, tipo: 'text', texto, fecha })

const webhook = (mensajes: any[], estados: any[] = [], phoneId = '1459027670626993') => ({
  object: 'whatsapp_business_account',
  entry: [{ id: '2586269871867852', changes: [{ field: 'messages', value: {
    messaging_product: 'whatsapp', metadata: { phone_number_id: phoneId, display_phone_number: '573012388989' },
    contacts: [{ wa_id: '573001112233', profile: { name: 'Rodrigo' } }], messages: mensajes, statuses: estados } }] }],
})

beforeAll(async () => {
  const db = await import('@/lib/db')
  q = db.queryOne
  await db.execute(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, nombre TEXT, email TEXT, is_superadmin INTEGER, created_at TEXT)`)
  await db.execute(`INSERT INTO users (id, nombre, email, is_superadmin, created_at) VALUES
    ('super', 'Super Administrador', 'contacto@owlcompliance.com', 1, '2026-01-01'),
    ('adri', 'Adriana Linares', 'a@owl.co', 0, '2026-01-02'), ('david', 'David Osorio', 'd@owl.co', 0, '2026-01-03')`)
  wv = await import('@/lib/whatsapp-ventas')
  await wv.migrateWhatsApp()
  await db.execute(`INSERT INTO prospectos_isp (id, puesto, prioridad, empresa, telefono, correo, representante, estado, responsable_id, campana,
                      cadencia, paso_cadencia, cadencia_estado, proxima_fecha, automatico)
                    VALUES ('mega', 1, 'A', 'Meganetwork SAS', '300 111 2233', 'g@mega.co', 'Rodrigo Vargas', 'WA1 enviado', 'adri', 'cold-mailing', 'cold-mailing', 2, 'activa', '2026-11-27', 1),
                           ('redes', 2, 'C2', 'Redes SAS', '(310) 444-5566', 'info@redes.co', 'Ana', 'Pendiente', 'david', 'cold-mailing', 'cold-mailing', 0, 'activa', '2026-11-26', 1),
                           ('fijo', 3, 'C2', 'Fijo SAS', '604 444 5566', null, 'Luis', 'Pendiente', 'david', 'cold-mailing', 'cold-mailing', 0, 'activa', '2026-11-26', 0)`)
})

beforeEach(() => { correos.length = 0; aMeta.length = 0; metaFalla = false; delete process.env.VENTAS_AUTOMATICAS })

describe('webhook de Meta', () => {
  it('acepta solo la firma de Meta', () => {
    const cuerpo = JSON.stringify({ hola: 1 })
    const firma = 'sha256=' + crypto.createHmac('sha256', 'clave').update(cuerpo).digest('hex')
    expect(firmaWebhookValida(cuerpo, firma, 'clave')).toBe(true)
    expect(firmaWebhookValida(cuerpo + ' ', firma, 'clave')).toBe(false)
    expect(firmaWebhookValida(cuerpo, firma, 'otra')).toBe(false)
    expect(firmaWebhookValida(cuerpo, null, 'clave')).toBe(false)
    expect(firmaWebhookValida(cuerpo, firma, undefined)).toBe(false)
  })

  it('lee mensajes y estados, e ignora otro número', () => {
    const p = webhook(
      [{ from: '573001112233', id: 'wamid.A', timestamp: '1764082800', type: 'text', text: { body: 'Hola' } },
       { from: '573001112233', id: 'wamid.B', timestamp: '1764082801', type: 'image', image: { caption: 'factura' } }],
      [{ id: 'wamid.SAL1', status: 'read' }, { id: 'wamid.SAL2', status: 'failed', errors: [{ code: 131047, title: 'Re-engagement message' }] }])
    const r = leerWebhook(p, '1459027670626993')
    expect(r.mensajes.map(m => [m.wamid, m.de, m.nombre, m.texto])).toEqual([
      ['wamid.A', '573001112233', 'Rodrigo', 'Hola'], ['wamid.B', '573001112233', 'Rodrigo', '[imagen] factura']])
    expect(r.estados).toEqual([{ wamid: 'wamid.SAL1', estado: 'read', error: null }, { wamid: 'wamid.SAL2', estado: 'failed', error: '131047 Re-engagement message' }])
    expect(leerWebhook(p, '999').mensajes).toHaveLength(0)
    expect(leerWebhook({ object: 'page' }).mensajes).toHaveLength(0)
  })

  it('ventana de 24 horas', () => {
    expect(ventanaAbierta('2026-11-24 16:00:00', AHORA)).toBe(true)
    expect(ventanaAbierta('2026-11-24 14:59:00', AHORA)).toBe(false)
    expect(ventanaAbierta(null, AHORA)).toBe(false)
  })
})

describe('mensajes que llegan', () => {
  it('de un prospecto: cuenta como respuesta, detiene la cadencia y avisa; en simulación no responde', async () => {
    const r = await wv.procesarMensajeWhatsApp(msj('wamid.1', '573001112233', 'Hola, me interesa saber más'), AHORA)
    expect(r).toMatchObject({ accion: 'existente', tipo: 'respuesta', prospectoId: 'mega', respuestaAutomatica: 'simulada' })
    const p = await prospecto('mega')
    expect(p.estado).toBe('Respondió')
    expect(p.automatico).toBe(0)
    expect(p.cadencia_estado).toBe('respondio')
    expect(aMeta).toHaveLength(0)
    expect(correos.map(c => [c.para, c.asunto])).toEqual([['a@owl.co', '💬 Respondió: Meganetwork SAS']])
    expect(correos[0].html).toContain('pestaña WhatsApp')
  })

  it('el mismo webhook dos veces no duplica nada', async () => {
    const r = await wv.procesarMensajeWhatsApp(msj('wamid.1', '573001112233', 'Hola, me interesa saber más'), AHORA)
    expect(r.accion).toBe('duplicado')
    expect(correos).toHaveLength(0)
  })

  it('los siguientes mensajes de la misma conversación solo se guardan (sin avisos repetidos)', async () => {
    const r = await wv.procesarMensajeWhatsApp(msj('wamid.2', '573001112233', '¿Cuánto cuesta?', new Date(AHORA.getTime() + 60000)), new Date(AHORA.getTime() + 60000))
    expect(r.accion).toBe('conversacion')
    expect(r.respuestaAutomatica).toBeUndefined()
    expect(correos).toHaveLength(0)
  })

  it('reconoce el teléfono con otro formato y, en activo, responde una sola vez con el calendario', async () => {
    process.env.VENTAS_AUTOMATICAS = 'activo'
    const r = await wv.procesarMensajeWhatsApp(msj('wamid.3', '573104445566', 'Buenas', AHORA, 'Ana María'), AHORA)
    expect(r).toMatchObject({ prospectoId: 'redes', respuestaAutomatica: 'enviada' })
    expect(aMeta).toHaveLength(1)
    expect(aMeta[0].url).toBe('https://graph.facebook.com/v23.0/1459027670626993/messages')
    expect(aMeta[0].auth).toBe('Bearer token-de-prueba')
    expect(aMeta[0].body).toMatchObject({ messaging_product: 'whatsapp', to: '573104445566', type: 'text' })
    expect(aMeta[0].body.text.body).toMatch(/^Hola, Ana\./)
    expect(aMeta[0].body.text.body).toContain('15 minutos')
    expect(aMeta[0].body.text.body).toContain('https://calendar.app.google/')
    const r2 = await wv.procesarMensajeWhatsApp(msj('wamid.4', '573104445566', 'Gracias', new Date(AHORA.getTime() + 120000)), new Date(AHORA.getTime() + 120000))
    expect(r2.respuestaAutomatica).toBeUndefined()
    expect(aMeta).toHaveLength(1)
  })

  it('"no me escriban más" lo da de baja y no se le responde', async () => {
    process.env.VENTAS_AUTOMATICAS = 'activo'
    await q(`UPDATE prospectos_isp SET telefono = '3205556677' WHERE id = 'fijo'`)
    const r = await wv.procesarMensajeWhatsApp(msj('wamid.5', '573205556677', 'Por favor no me vuelvan a escribir'), AHORA)
    expect(r).toMatchObject({ tipo: 'baja', prospectoId: 'fijo' })
    expect(r.respuestaAutomatica).toBeUndefined()
    const p = await prospecto('fijo')
    expect(p.baja).toBe(1)
    expect(p.estado).toBe('No contactar')
    expect(aMeta).toHaveLength(0)
  })

  it('un número desconocido se vuelve prospecto E de la campaña whatsapp, con responsable', async () => {
    const r = await wv.procesarMensajeWhatsApp(msj('wamid.6', '573157778899', 'Hola, tengo un ISP en Boyacá', AHORA, 'Carlos Ruiz'), AHORA)
    expect(r.accion).toBe('creado')
    const p = await prospecto(r.prospectoId)
    expect(p).toMatchObject({ prioridad: 'E', campana: 'whatsapp', empresa: 'Carlos Ruiz', telefono: '+573157778899', estado: 'Respondió', automatico: 0 })
    expect(p.responsable_id).toBeTruthy()
    expect(correos.some(c => c.asunto === '🆕 Nuevo contacto por WhatsApp: Carlos Ruiz')).toBe(true)
  })
})

describe('la ficha', () => {
  it('muestra la conversación en orden y deja responder dentro de las 24 h', async () => {
    const p = (await q<any>(`SELECT * FROM prospectos_isp WHERE id = 'mega'`))!
    const c = await wv.conversacionDelProspecto(p, new Date(AHORA.getTime() + 3600000))
    expect(c.mensajes.map(m => m.texto)).toEqual(['Hola, me interesa saber más', '¿Cuánto cuesta?'])
    expect(c.ventanaAbierta).toBe(true)
    expect(c.telefono).toBe('573001112233')
    const r = await wv.responderDesdeLaFicha(p, 'Hola Rodrigo, te cuento…', 'adri', new Date(AHORA.getTime() + 3600000))
    expect(r.ok).toBe(true)
    const despues = await wv.conversacionDelProspecto(p, new Date(AHORA.getTime() + 3600000))
    expect(despues.mensajes.at(-1)).toMatchObject({ direccion: 'saliente', texto: 'Hola Rodrigo, te cuento…', estado: 'sent', user_nombre: 'Adriana Linares' })
  })

  it('los estados de Meta actualizan lo enviado sin retroceder', async () => {
    const ultimo = (await q<any>(`SELECT id FROM mensajes_whatsapp WHERE direccion = 'saliente' AND prospecto_id = 'mega' ORDER BY created_at DESC, rowid DESC LIMIT 1`))!
    await wv.procesarEstadoWhatsApp({ wamid: ultimo.id, estado: 'read', error: null })
    await wv.procesarEstadoWhatsApp({ wamid: ultimo.id, estado: 'delivered', error: null })
    expect((await q<any>(`SELECT estado FROM mensajes_whatsapp WHERE id = ?`, [ultimo.id])).estado).toBe('read')
  })

  it('pasadas las 24 h no deja responder', async () => {
    const p = (await q<any>(`SELECT * FROM prospectos_isp WHERE id = 'mega'`))!
    const r = await wv.responderDesdeLaFicha(p, 'Hola', 'adri', new Date(AHORA.getTime() + 25 * 3600000))
    expect(r).toMatchObject({ ok: false, status: 409 })
  })

  it('si Meta rechaza el envío, queda registrado como fallido', async () => {
    metaFalla = true
    const p = (await q<any>(`SELECT * FROM prospectos_isp WHERE id = 'redes'`))!
    const r = await wv.responderDesdeLaFicha(p, 'Hola Ana', 'david', new Date(AHORA.getTime() + 600000))
    expect(r).toMatchObject({ ok: false, status: 502 })
    const f = await q<any>(`SELECT estado, error FROM mensajes_whatsapp WHERE texto = 'Hola Ana'`)
    expect(f).toMatchObject({ estado: 'failed', error: 'Re-engagement message' })
  })
})
