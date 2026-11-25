/** "Para retomar" (lib/retomar.ts) y el resumen del caso que mantiene la IA. */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'owl-retomar-'))
process.env.DB_PATH = path.join(tmp, 'test.db')
delete process.env.TURSO_DATABASE_URL
delete process.env.TURSO_AUTH_TOKEN
process.env.WHATSAPP_TOKEN = 'token-de-prueba'
process.env.WHATSAPP_PHONE_ID = '1459027670626993'
process.env.ANTHROPIC_API_KEY = 'clave-de-prueba'

vi.mock('@/lib/smtp', () => ({ cuentaCorreo: () => 'contacto@owlcompliance.com', enviarSmtp: vi.fn(async () => ({ ok: true, messageId: '<x@owl>' })) }))
const fetchOriginal = globalThis.fetch
let n = 0
globalThis.fetch = vi.fn(async (url: any, init: any) => String(url).startsWith('https://graph.facebook.com/')
  ? new Response(JSON.stringify({ messages: [{ id: `wamid.S${++n}` }] }), { status: 200 }) : fetchOriginal(url, init)) as any

let db: typeof import('@/lib/db')
const AHORA = new Date('2026-11-26T15:00:00Z')

beforeAll(async () => {
  db = await import('@/lib/db')
  await db.execute(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, nombre TEXT, email TEXT, is_superadmin INTEGER, created_at TEXT)`)
  await db.execute(`INSERT INTO users (id, nombre, email, is_superadmin, created_at) VALUES ('adri', 'Adriana Linares', 'a@owl.co', 0, '2026-01-02')`)
  const va = await import('@/lib/ventas-auto')
  await va.migrateVentasAuto()
  const ia = await import('@/lib/ia-ventas')
  await ia.migrateIA()
  await db.execute(`INSERT INTO prospectos_isp (id, puesto, prioridad, empresa, telefono, estado, responsable_id, campana, cadencia, paso_cadencia, cadencia_estado, proxima_fecha, automatico, canal_auto, whatsapp_ok)
    VALUES ('p1', 1, 'W', 'Llano SAS', '3105551234', 'WA1 enviado', 'adri', 'webinar', 'webinar-asistente', 2, 'activa', '2026-11-28', 1, 'whatsapp', 1),
           ('p2', 2, 'C2', 'Nadie SAS', null, 'Pendiente', 'adri', 'cold-mailing', 'cold-mailing', 0, 'activa', '2026-11-27', 0, 'correo', 0)`)
  await db.execute(`INSERT INTO envios_correo (id, prospecto_id, cadencia, paso, para, asunto, message_id, estado, created_at) VALUES
    ('e1', 'p1', 'webinar-asistente', 0, '+573105551234', 'owl_webinar_asistio_radiografia', 'wamid.T1', 'enviado', '2026-11-18 14:00:00'),
    ('e2', 'p1', 'webinar-asistente', 2, 'g@llano.co', 'Re: Radiografía', '<c1@owl>', 'enviado', '2026-11-19 14:00:00')`)
  await db.execute(`INSERT INTO mensajes_whatsapp (id, prospecto_id, direccion, telefono, tipo, texto, estado, user_id, created_at) VALUES
    ('wamid.T1', 'p1', 'saliente', '573105551234', 'template', 'Hola, Andrés…', 'plantilla', null, '2026-11-18 14:00:00'),
    ('wamid.E1', 'p1', 'entrante', '573105551234', 'text', 'Me preocupa el oficio de la CRC', 'recibido', null, '2026-11-18 16:00:00'),
    ('wamid.S0', 'p1', 'saliente', '573105551234', 'text', 'Hola Andrés, te cuento…', 'ia', null, '2026-11-18 16:01:00'),
    ('wamid.S9', 'p1', 'saliente', '573105551234', 'text', 'Te escribo yo, Andrés', 'read', 'adri', '2026-11-20 13:00:00')`)
  await db.execute(`INSERT INTO ia_respuestas (id, prospecto_id, responde_a, modo, accion, texto, motivo, estado) VALUES ('r1', 'p1', 'wamid.E1', 'activa', 'responder', 'Hola Andrés…', 'Pregunta por el oficio', 'enviada')`)
})

describe('para retomar', () => {
  it('cuenta contactos por canal, la última respuesta, los días sin responder y la cadencia', async () => {
    const { paraRetomar } = await import('@/lib/retomar')
    const { buscarProspecto } = await import('@/lib/prospectos-db')
    const r = await paraRetomar((await buscarProspecto('p1'))!, AHORA)
    expect(r.contactos).toEqual({ correos: 1, whatsappAutomaticos: 1, whatsappIA: 1, whatsappEquipo: 1, total: 4 })
    expect(r.respuestas).toEqual({ whatsapp: 1, correo: 0 })
    expect(r.ultimaRespuesta).toMatchObject({ canal: 'whatsapp', texto: 'Me preocupa el oficio de la CRC' })
    expect(r.ultimoContacto).toMatchObject({ canal: 'whatsapp', fecha: '2026-11-20 13:00:00' })
    expect(r.diasSinResponder).toBe(6)
    expect(r.cadencia).toMatchObject({ nombre: 'Webinar · asistió', paso: 2, total: 5, estado: 'activa', automatico: true, canal: 'whatsapp' })
    expect(r.permisoWhatsApp).toBe(true)

    const vacio = await paraRetomar((await buscarProspecto('p2'))!, AHORA)
    expect(vacio.contactos.total).toBe(0)
    expect(vacio.ultimaRespuesta).toBeNull()
    expect(vacio.diasSinResponder).toBeNull()
  })

  it('la conversación trae lo que decidió la IA con cada mensaje', async () => {
    const wv = await import('@/lib/whatsapp-ventas')
    const { buscarProspecto } = await import('@/lib/prospectos-db')
    const c = await wv.conversacionDelProspecto((await buscarProspecto('p1'))!, AHORA)
    expect(c.mensajes.find(m => m.id === 'wamid.E1')).toMatchObject({ ia_accion: 'responder', ia_motivo: 'Pregunta por el oficio', ia_estado: 'enviada' })
  })

  it('la IA guarda y actualiza el resumen del caso, y lo recibe en la siguiente llamada', async () => {
    const ia = await import('@/lib/ia-ventas')
    const pedidos: any[] = []
    ia._usarCliente({ beta: { messages: { create: async (req: any) => {
      pedidos.push(req)
      return { stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text: JSON.stringify({ accion: 'responder', mensaje: 'Hola, te cuento: agenda 15 minutos aquí https://calendar.app.google/x',
        motivo: 'Pregunta general', resumen_caso: 'ISP del Llano; le preocupa un oficio de la CRC; pidió saber qué incluye la suscripción.' }) }] }
    } } } })
    process.env.IA_VENTAS = 'activa'
    await db.execute(`UPDATE prospectos_isp SET ia_pausada = 0 WHERE id = 'p1'`)
    const wv = await import('@/lib/whatsapp-ventas')
    const ahora = new Date('2026-11-26T15:00:00Z')
    await wv.procesarMensajeWhatsApp({ wamid: 'wamid.E2', de: '573105551234', nombre: 'Andrés', tipo: 'text', texto: '¿Qué incluye la suscripción?', fecha: ahora }, ahora)
    expect(await ia.atenderConIA('wamid.E2', { esperar: 0, ahora: () => ahora })).toEqual({ resultado: 'enviada' })
    const p = await db.queryOne<any>(`SELECT resumen_ia, resumen_ia_en FROM prospectos_isp WHERE id = 'p1'`)
    expect(p.resumen_ia).toContain('oficio de la CRC')
    expect(p.resumen_ia_en).toBeTruthy()
    expect(pedidos[0].messages[0].content).toContain('Resumen del caso hasta ahora: (todavía no hay)')
    expect(pedidos[0].output_config.format.schema.required).toContain('resumen_caso')
  })
})
