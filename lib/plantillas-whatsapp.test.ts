/** Plantillas de WhatsApp, cadencia automática por WhatsApp, seguimiento después de la reunión y perfil para la IA. */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'owl-plantillas-'))
process.env.DB_PATH = path.join(tmp, 'test.db')
delete process.env.TURSO_DATABASE_URL
delete process.env.TURSO_AUTH_TOKEN
process.env.WHATSAPP_TOKEN = 'token-de-prueba'
process.env.WHATSAPP_PHONE_ID = '1459027670626993'
process.env.INTERNAL_SECRET = 'secreto-de-prueba'
process.env.ANTHROPIC_API_KEY = 'clave-de-prueba'

const correos: any[] = []
vi.mock('@/lib/smtp', () => ({
  cuentaCorreo: () => 'contacto@owlcompliance.com',
  enviarSmtp: vi.fn(async (c: any) => { correos.push(c); return { ok: true, messageId: `<m${correos.length}@owl>` } }),
}))

/** Simulacro de Meta: envíos y lista de plantillas aprobadas. */
const aMeta: any[] = []
let aprobadas = ['owl_webinar_contacto', 'owl_propuesta_reunion', 'owl_autodiagnostico', 'owl_cierre', 'owl_seguimiento_propuesta', 'owl_recordatorio_propuesta', 'owl_resumen_reunion', 'owl_radiografia']
let n = 0
const fetchOriginal = globalThis.fetch
globalThis.fetch = vi.fn(async (url: any, init: any) => {
  const u = String(url)
  if (!u.startsWith('https://graph.facebook.com/')) return fetchOriginal(url, init)
  if (u.includes('/message_templates')) return new Response(JSON.stringify({ data: aprobadas.map(name => ({ name, status: 'APPROVED', language: 'es' })) }), { status: 200 })
  aMeta.push(JSON.parse(init.body))
  return new Response(JSON.stringify({ messages: [{ id: `wamid.P${++n}` }] }), { status: 200 })
}) as any

import { plantillaDelPaso, tokenRadiografia, prospectoDelToken, textoDePlantilla, cuerpoRegistro, PLANTILLAS, limpiarVariable } from './plantillas-whatsapp'

let va: typeof import('@/lib/ventas-auto')
let q: <T = any>(sql: string, args?: any[]) => Promise<T | undefined>
const prospecto = (id: string) => q<any>(`SELECT * FROM prospectos_isp WHERE id = ?`, [id])
const HOY = '2026-11-26'   // jueves hábil

beforeAll(async () => {
  const db = await import('@/lib/db')
  q = db.queryOne
  await db.execute(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, nombre TEXT, email TEXT, is_superadmin INTEGER, created_at TEXT, role TEXT)`)
  await db.execute(`INSERT INTO users (id, nombre, email, is_superadmin, created_at) VALUES
    ('super', 'Super Administrador', 'contacto@owlcompliance.com', 1, '2026-01-01'), ('adri', 'Adriana Linares', 'a@owl.co', 0, '2026-01-02')`)
  va = await import('@/lib/ventas-auto')
  await va.migrateVentasAuto()
  await db.execute(`INSERT INTO prospectos_isp (id, puesto, prioridad, empresa, telefono, webinar_telefono, correo, representante, webinar_nombre, estado, responsable_id,
                      campana, cadencia, paso_cadencia, cadencia_estado, proxima_fecha, automatico, canal_auto, whatsapp_ok)
    VALUES ('web1', 1, 'W', 'Conexiones del Llano SAS', null, '310 555 1234', 'g@llano.co', null, 'Andrés Rojas', 'Pendiente', 'adri',
            'webinar', 'webinar-inscrito', 0, 'activa', '2026-11-20', 1, 'whatsapp', 1),
           ('web2', 2, 'W', 'Sin Permiso SAS', '3205550000', null, 'x@sp.co', 'Luis', null, 'Pendiente', 'adri',
            'webinar', 'webinar-inscrito', 0, 'activa', '2026-11-20', 1, 'whatsapp', 0),
           ('reu', 3, 'C2', 'Reunida SAS', '3001234567', null, 'r@reunida.co', 'Marta Gil', null, 'Reunión agendada', 'adri',
            'cold-mailing', 'cold-mailing', 4, 'respondio', null, 0, 'correo', 1),
           ('reu2', 4, 'C2', 'Solo Correo SAS', '6044445566', null, 'c@solo.co', 'Pedro', null, 'Reunión agendada', 'adri',
            'cold-mailing', 'cold-mailing', 4, 'respondio', null, 0, 'correo', 0)`)
})

beforeEach(() => { correos.length = 0; aMeta.length = 0 })

describe('plantillas', () => {
  it('cada paso usa su plantilla; la llamada y el primer contacto en frío sin radiografía no', () => {
    const d = { nombre: 'Andrés Rojas', empresa: 'Conexiones del Llano SAS', punto: null }
    expect(plantillaDelPaso('webinar-asistente', 0, d, 'x')).toEqual({ nombre: 'owl_webinar_contacto', parametros: ['Andrés', 'Conexiones del Llano SAS'] })
    expect(plantillaDelPaso('webinar-asistente', 1, d, 'x')).toBeNull()                       // la llamada
    expect(plantillaDelPaso('webinar-asistente', 2, d, 'x')?.nombre).toBe('owl_propuesta_reunion')
    expect(plantillaDelPaso('webinar-inscrito', 1, d, 'x')).toEqual({ nombre: 'owl_autodiagnostico', parametros: ['Andrés'] })
    expect(plantillaDelPaso('cold-mailing', 0, d, 'x')).toBeNull()
    expect(plantillaDelPaso('post-reunion', 0, d, 'x')?.nombre).toBe('owl_seguimiento_propuesta')
    expect(plantillaDelPaso('post-reunion', 2, d, 'x')?.nombre).toBe('owl_cierre')
    const conRadio = plantillaDelPaso('cold-mailing', 0, { ...d, punto: 'el punto 2' }, 'p1')!
    expect(conRadio.nombre).toBe('owl_radiografia')
    expect(prospectoDelToken(conRadio.boton!)).toBe('p1')
  })

  it('el enlace de la radiografía va firmado', () => {
    expect(prospectoDelToken(tokenRadiografia('abc'))).toBe('abc')
    expect(prospectoDelToken('abc.falsa')).toBeNull()
    expect(prospectoDelToken(tokenRadiografia('abc').replace('abc', 'otro'))).toBeNull()
  })

  it('textos: 15 minutos, sin "plan", con la salida BAJA en las de marketing, y formato de registro de Meta', () => {
    for (const p of PLANTILLAS) {
      const t = textoDePlantilla(p.nombre, p.ejemplos)
      expect(t).not.toMatch(/\{\{/)
      expect(t).not.toMatch(/\bplan(es)?\b/i)
      if (/minutos/.test(t)) expect(t).toMatch(/15 minutos/)
      if (p.categoria === 'MARKETING') expect(t).toContain('responde BAJA')
      expect(p.cuerpo.length).toBeLessThan(1024)
      expect(p.cuerpo).not.toMatch(/^\{\{|\}\}$/)          // Meta no acepta variables al principio ni al final
    }
    const r = cuerpoRegistro(PLANTILLAS.find(p => p.nombre === 'owl_radiografia')!)
    expect(r).toMatchObject({ name: 'owl_radiografia', language: 'es', category: 'MARKETING' })
    expect(r.components.map((c: any) => c.type)).toEqual(['BODY', 'FOOTER', 'BUTTONS'])
    expect(limpiarVariable('uno\n\ndos\t  tres')).toBe('uno dos tres')
  })
})

describe('cadencia automática por WhatsApp', () => {
  it('en simulación no envía nada', async () => {
    const r = await va.procesarEnvios(HOY, 'simulacion', 0)
    expect(r.map(x => [x.prospecto, x.resultado, x.asunto])).toEqual([['web1', 'simulado', 'owl_webinar_contacto'], ['web2', 'sin-whatsapp', null]])
    expect(aMeta).toHaveLength(0)
  })

  it('en activo envía la plantilla, la deja en la conversación y avanza; sin permiso, vuelve a manual', async () => {
    const r = await va.procesarEnvios(HOY, 'activo', 0)
    expect(r.find(x => x.prospecto === 'web1')).toMatchObject({ resultado: 'enviado', canal: 'whatsapp', para: '+573105551234' })
    expect(aMeta[0]).toMatchObject({ to: '573105551234', type: 'template', template: { name: 'owl_webinar_contacto', language: { code: 'es' } } })
    expect(aMeta[0].template.components[0].parameters.map((p: any) => p.text)).toEqual(['Andrés', 'Conexiones del Llano SAS'])
    const p = await prospecto('web1')
    expect(p).toMatchObject({ paso_cadencia: 1, estado: 'WA1 enviado', cadencia_estado: 'activa' })
    const m = await q<any>(`SELECT estado, texto FROM mensajes_whatsapp WHERE prospecto_id = 'web1'`)
    expect(m.estado).toBe('plantilla')
    expect(m.texto).toContain('Hola, Andrés.')
    expect((await prospecto('web2')).automatico).toBe(0)
  })

  it('si la plantilla no está aprobada, el paso espera sin contar como fallo', async () => {
    await q(`UPDATE prospectos_isp SET proxima_fecha = ? WHERE id = 'web1'`, [HOY])
    aprobadas = aprobadas.filter(x => x !== 'owl_autodiagnostico')
    const r = await va.procesarEnvios(HOY, 'activo', 0)
    expect(r.find(x => x.prospecto === 'web1')).toMatchObject({ resultado: 'sin-plantilla', asunto: 'owl_autodiagnostico' })
    expect(aMeta).toHaveLength(0)
    expect(await prospecto('web1')).toMatchObject({ paso_cadencia: 1, automatico: 1 })
    aprobadas.push('owl_autodiagnostico')
  })

  it('si responde por WhatsApp, la cadencia se detiene; "BAJA" lo da de baja', async () => {
    const wv = await import('@/lib/whatsapp-ventas')
    process.env.IA_VENTAS = 'apagada'
    await wv.procesarMensajeWhatsApp({ wamid: 'wamid.R1', de: '573105551234', nombre: 'Andrés', tipo: 'text', texto: 'BAJA', fecha: new Date('2026-11-26T15:00:00Z') }, new Date('2026-11-26T15:00:00Z'))
    expect(await prospecto('web1')).toMatchObject({ baja: 1, estado: 'No contactar', automatico: 0 })
  })
})

describe('después de la reunión', () => {
  it('al pasar a "Propuesta enviada" arranca el seguimiento por WhatsApp si aceptó, si no por correo', async () => {
    process.env.VENTAS_AUTOMATICAS = 'activo'
    const { actualizarProspectoComoUsuario } = await import('@/lib/prospectos')
    await actualizarProspectoComoUsuario({ id: 'super', is_superadmin: true }, 'reu', { estado: 'Propuesta enviada' })
    await actualizarProspectoComoUsuario({ id: 'super', is_superadmin: true }, 'reu2', { estado: 'Propuesta enviada' })
    expect(await prospecto('reu')).toMatchObject({ cadencia: 'post-reunion', paso_cadencia: 0, cadencia_estado: 'activa', automatico: 1, canal_auto: 'whatsapp' })
    expect(await prospecto('reu2')).toMatchObject({ cadencia: 'post-reunion', automatico: 1, canal_auto: 'correo' })
    const fecha = (await prospecto('reu')).proxima_fecha
    expect(fecha > HOY).toBe(true)
    // Llegado el día, sale la plantilla de seguimiento y el correo con asunto de propuesta.
    const r = await va.procesarEnvios(fecha, 'activo')
    expect(r.find(x => x.prospecto === 'reu')).toMatchObject({ resultado: 'enviado', asunto: 'owl_seguimiento_propuesta' })
    expect(r.find(x => x.prospecto === 'reu2')).toMatchObject({ resultado: 'enviado', asunto: 'Propuesta de Owl Compliance para Solo Correo SAS' })
    expect(aMeta[0].template.components[0].parameters.map((p: any) => p.text)).toEqual(['Marta', 'Reunida SAS'])
    delete process.env.VENTAS_AUTOMATICAS
  })
})

describe('la IA conoce el perfil', () => {
  it('ve notas, estado, historial y lo enviado; y a un cliente lo pasa al equipo sin llamar a Claude', async () => {
    const ia = await import('@/lib/ia-ventas')
    const t = ia.armarPedido({ empresa: 'Reunida SAS', estado: 'Propuesta enviada', notas: 'Reunión 20/11: le preocupa el reporte de PQR. Le enviamos Pro.', proximo_paso: 'Revisar propuesta', prioridad: 'A' } as any, [],
      { hoy: HOY, historial: [{ nota: 'Reunión realizada', estado_nuevo: 'Propuesta enviada', created_at: '2026-11-20 15:00:00' }], enviados: [{ asunto: 'owl_seguimiento_propuesta', para: '+573001234567', created_at: '2026-11-24 14:00:00' }] })
    expect(t).toContain('Notas internas del equipo:\nReunión 20/11')
    expect(t).toContain('Estado en el embudo de Owl: Propuesta enviada')
    expect(t).toContain('investigación abierta')
    expect(t).toContain('owl_seguimiento_propuesta')
    expect(t).toContain('Reunión realizada')

    const claude = { beta: { messages: { create: vi.fn() } } }
    ia._usarCliente(claude)
    process.env.IA_VENTAS = 'activa'
    await q(`UPDATE prospectos_isp SET estado = 'Cliente' WHERE id = 'reu'`)
    const wv = await import('@/lib/whatsapp-ventas')
    const ahora = new Date('2026-11-27T15:00:00Z')
    const r = await wv.procesarMensajeWhatsApp({ wamid: 'wamid.C1', de: '573001234567', nombre: 'Marta', tipo: 'text', texto: 'Hola, una consulta', fecha: ahora }, ahora)
    expect(r.paraIA).toBe(true)
    expect(await ia.atenderConIA('wamid.C1', { esperar: 0, ahora: () => ahora })).toMatchObject({ resultado: 'humano', motivo: 'Ya es cliente: lo atiende el equipo' })
    expect(claude.beta.messages.create).not.toHaveBeenCalled()
  })
})
