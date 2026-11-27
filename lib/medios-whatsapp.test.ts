/** Audios y archivos que llegan por WhatsApp: se guardan, se reenvían al responsable y la conversación pasa al equipo. */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'owl-medios-'))
process.env.DB_PATH = path.join(tmp, 'test.db')
delete process.env.TURSO_DATABASE_URL
delete process.env.TURSO_AUTH_TOKEN
process.env.WHATSAPP_TOKEN = 'token-de-prueba'
process.env.WHATSAPP_PHONE_ID = '1459027670626993'
process.env.ANTHROPIC_API_KEY = 'clave-de-prueba'

const correos: any[] = []
vi.mock('@/lib/smtp', () => ({
  cuentaCorreo: () => 'contacto@owlcompliance.com',
  enviarSmtp: vi.fn(async (c: any) => { correos.push(c); return { ok: true, messageId: '<x@owl>' } }),
}))

const enviados: any[] = []
let n = 0
const fetchOriginal = globalThis.fetch
globalThis.fetch = vi.fn(async (url: any, init: any) => {
  const u = String(url)
  if (u.endsWith('/MEDIA1')) return new Response(JSON.stringify({ url: 'https://lookaside.fbsbx.com/audio1', mime_type: 'audio/ogg; codecs=opus', file_size: 2048 }), { status: 200 })
  if (u === 'https://lookaside.fbsbx.com/audio1') return new Response(new Uint8Array([79, 103, 103, 83, 1, 2, 3]), { status: 200, headers: { 'content-type': 'audio/ogg' } })
  if (u.startsWith('https://graph.facebook.com/') && init?.method === 'POST') {
    enviados.push(JSON.parse(init.body))
    return new Response(JSON.stringify({ messages: [{ id: `wamid.S${++n}` }] }), { status: 200 })
  }
  return fetchOriginal(url, init)
}) as any

import { leerWebhook } from './whatsapp-api'

let wv: typeof import('@/lib/whatsapp-ventas')
let q: <T = any>(sql: string, args?: any[]) => Promise<T | undefined>
const AHORA = new Date()

beforeAll(async () => {
  const db = await import('@/lib/db')
  q = db.queryOne
  await db.execute(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, nombre TEXT, email TEXT, is_superadmin INTEGER, created_at TEXT)`)
  await db.execute(`INSERT INTO users (id, nombre, email, is_superadmin, created_at) VALUES ('adri', 'Adriana Linares', 'a@owl.co', 0, '2026-01-02')`)
  wv = await import('@/lib/whatsapp-ventas')
  await wv.migrateWhatsApp()
  const ia = await import('@/lib/ia-ventas')
  await ia.migrateIA()
  await db.execute(`INSERT INTO prospectos_isp (id, puesto, prioridad, empresa, telefono, estado, responsable_id, campana) VALUES ('p1', 1, 'A', 'Llano SAS', '3105551234', 'WA1 enviado', 'adri', 'cold-mailing')`)
})

beforeEach(() => { correos.length = 0; enviados.length = 0 })

describe('audios y archivos', () => {
  it('el webhook trae el id del archivo para descargarlo', () => {
    const r = leerWebhook({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: {
      metadata: { phone_number_id: '1459027670626993' }, contacts: [{ wa_id: '573105551234', profile: { name: 'Andrés' } }],
      messages: [{ from: '573105551234', id: 'wamid.A1', timestamp: '1764082800', type: 'audio', audio: { id: 'MEDIA1', mime_type: 'audio/ogg; codecs=opus', voice: true } }] } }] }] })
    expect(r.mensajes[0]).toMatchObject({ tipo: 'audio', texto: '[audio]', medio: { id: 'MEDIA1', mime: 'audio/ogg; codecs=opus' } })
  })

  it('una nota de voz se guarda, llega adjunta al responsable, la IA no la procesa y en modo activo se le avisa que lo atiende una persona', async () => {
    process.env.IA_VENTAS = 'activa'
    const r = await wv.procesarMensajeWhatsApp({ wamid: 'wamid.A1', de: '573105551234', nombre: 'Andrés', tipo: 'audio', texto: '[audio]',
      fecha: AHORA, medio: { id: 'MEDIA1', mime: 'audio/ogg; codecs=opus', nombre: null } }, AHORA)
    expect(r.paraIA).toBeUndefined()
    const guardado = await wv.medioDelMensaje('wamid.A1')
    expect(guardado?.prospecto_id).toBe('p1')
    expect(new Uint8Array(guardado!.contenido as ArrayBuffer).slice(0, 4)).toEqual(new Uint8Array([79, 103, 103, 83]))
    // Un solo correo al responsable (no además el de "Respondió"), con el audio adjunto.
    expect(correos).toHaveLength(1)
    expect(correos[0]).toMatchObject({ para: 'a@owl.co' })
    expect(correos[0].asunto).toContain('🎤')
    expect(correos[0].adjuntos[0].filename).toMatch(/\.ogg$/)
    expect(enviados.map(e => e.text?.body)).toEqual(['¡Gracias! Recibimos tu nota de voz y se la pasamos a una persona del equipo, que te responde pronto por aquí.'])
    expect((await q<any>(`SELECT ia_pausada, estado FROM prospectos_isp WHERE id = 'p1'`))).toMatchObject({ ia_pausada: 1, estado: 'Respondió' })
    const c = await wv.conversacionDelProspecto((await q<any>(`SELECT * FROM prospectos_isp WHERE id = 'p1'`))!, AHORA)
    expect(c.mensajes.find(m => m.id === 'wamid.A1')?.medio_mime).toContain('audio/ogg')
  })

  it('el segundo audio de la misma conversación no repite el acuse', async () => {
    await wv.procesarMensajeWhatsApp({ wamid: 'wamid.A2', de: '573105551234', nombre: 'Andrés', tipo: 'audio', texto: '[audio]',
      fecha: new Date(AHORA.getTime() + 60000), medio: { id: 'MEDIA1', mime: 'audio/ogg', nombre: null } }, new Date(AHORA.getTime() + 60000))
    expect(enviados).toHaveLength(0)
    expect(correos).toHaveLength(1)
    delete process.env.IA_VENTAS
  })
})
