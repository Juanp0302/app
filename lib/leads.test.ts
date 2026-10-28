/** Leads de todos los formularios: origen, datos propios y estadísticas (BD temporal). */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'
import { NextRequest } from 'next/server'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'owl-leads-'))
process.env.DB_PATH = path.join(tmp, 'test.db')
delete process.env.TURSO_DATABASE_URL
delete process.env.TURSO_AUTH_TOKEN
delete process.env.LEADS_WEBHOOK_SECRET

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

let route: typeof import('@/app/api/leads/route')
let auth: any

const enviar = (body: any) =>
  route.POST(new NextRequest('http://localhost/api/leads', { method: 'POST', body: JSON.stringify(body) }))

beforeAll(async () => {
  // El tablero muestra el nombre del responsable (JOIN con users).
  const { execute } = await import('@/lib/db')
  await execute(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, nombre TEXT, email TEXT, is_superadmin INTEGER, created_at TEXT)`)
  await execute(`INSERT INTO users (id, nombre, email, is_superadmin) VALUES ('s', 'Juan Pablo', 's@owl.co', 1), ('adri', 'Adriana Linares', 'a@owl.co', 0)`)
  route = await import('@/app/api/leads/route')
  ;({ auth } = await import('@/lib/auth') as any)
})

describe('/api/leads', () => {
  it('autodiagnóstico: guarda origen, teléfono y datos propios (NIT, cargo, %…)', async () => {
    const r = await enviar({
      origen: 'autodiagnostico', nombre: 'Ana', empresa: 'ISP Uno', correo: 'ana@isp.co', telefono: '3001112233',
      asunto: 'Autodiagnóstico: 62% de cumplimiento', utm_source: 'mailing', landing_page: '/autodiagnostico.html',
      datos: JSON.stringify({ nit: '900123', cargo: 'Gerente', pct_cumplimiento: '62%' }),
    })
    expect(r.status).toBe(200)
  })

  it('flujos viejos sin origen: deduce webinar por el asunto y contacto por defecto', async () => {
    await enviar({ nombre: 'Luis', empresa: 'ISP Dos', email: 'luis@isp.co', asunto: 'Webinar: Visitas del MinTIC', reunion: 'Sí', telefono: '300' })
    await enviar({ nombre: 'Eva', empresa: 'ISP Tres', email: 'eva@isp.co', asunto: 'Otro', mensaje: 'hola' })
  })

  it('un formulario nuevo cualquiera entra con su propio nombre de origen', async () => {
    await enviar({ origen: 'Taller-Habeas', nombre: 'Zoe', correo: 'z@isp.co', datos: { asistentes: 3 } })
  })

  it('datos que no son JSON no rompen nada: se guardan como texto', async () => {
    await enviar({ origen: 'contacto', nombre: 'Raro', datos: 'texto suelto' })
  })

  it('el superadmin los ve todos, con origen y datos; las estadísticas cuentan por formulario', async () => {
    auth.mockResolvedValue({ user: { id: 's', role: 'admin', is_superadmin: true } })
    const res = await route.GET(new NextRequest('http://localhost/api/leads'))
    const j: any = await res.json()
    expect(j.leads).toHaveLength(5)
    const por = Object.fromEntries(j.leads.map((l: any) => [l.nombre, l]))
    expect(por.Ana.origen).toBe('autodiagnostico')
    expect(por.Ana.telefono).toBe('3001112233')
    expect(JSON.parse(por.Ana.datos).nit).toBe('900123')
    expect(por.Luis.origen).toBe('webinar')
    expect(por.Luis.reunion).toBe('Sí')
    expect(por.Eva.origen).toBe('contacto')
    expect(por.Zoe.origen).toBe('taller-habeas')
    expect(JSON.parse(por.Zoe.datos).asistentes).toBe(3)
    expect(JSON.parse(por.Raro.datos).texto).toBe('texto suelto')
    const cont = Object.fromEntries(j.stats.porOrigen.map((o: any) => [o.label, Number(o.cnt)]))
    expect(cont).toEqual({ contacto: 2, autodiagnostico: 1, webinar: 1, 'taller-habeas': 1 })
  })

  it('un admin sin leads asignados no ve los de nadie ni el análisis; un cliente no entra', async () => {
    auth.mockResolvedValue({ user: { id: 'a', role: 'admin', is_superadmin: false } })
    const j: any = await (await route.GET(new NextRequest('http://localhost/api/leads'))).json()
    expect(j.pipeline.leads).toEqual([])
    expect(j.leads).toEqual([])
    expect(j.stats).toBeUndefined()
    auth.mockResolvedValue({ user: { id: 'c', role: 'cliente', is_superadmin: false } })
    expect((await route.GET(new NextRequest('http://localhost/api/leads'))).status).toBe(403)
  })

  it('con LEADS_WEBHOOK_SECRET configurado, un POST sin la clave se rechaza', async () => {
    process.env.LEADS_WEBHOOK_SECRET = 'clave'
    expect((await enviar({ nombre: 'Intruso' })).status).toBe(401)
    delete process.env.LEADS_WEBHOOK_SECRET
  })

  describe('pipeline de ventas', () => {
    const patch = (body: any) =>
      route.PATCH(new NextRequest('http://localhost/api/leads', { method: 'PATCH', body: JSON.stringify(body) }))
    const leads = async () => (await (await route.GET(new NextRequest('http://localhost/api/leads'))).json()) as any

    it('solo el superadmin mueve etapas', async () => {
      auth.mockResolvedValue({ user: { id: 'a', is_superadmin: false } })
      expect((await patch({ id: 1, etapa: 'contactado' })).status).toBe(403)
    })

    it('exige fecha para agendar y respeta los requisitos de propuesta', async () => {
      auth.mockResolvedValue({ user: { id: 's', is_superadmin: true } })
      const id = (await leads()).leads.find((l: any) => l.nombre === 'Ana').id
      expect((await patch({ id, etapa: 'reunion_agendada' })).status).toBe(400)
      expect((await patch({ id, etapa: 'reunion_agendada', proxima_fecha: '2030-01-10' })).status).toBe(200)
      expect((await patch({ id, etapa: 'propuesta', q_dolor: 2, q_presupuesto: 1 })).status).toBe(400) // falta decisión
      expect((await patch({ id, etapa: 'propuesta', q_dolor: 2, q_presupuesto: 1, q_decision: 2 })).status).toBe(400) // falta plan
      expect((await patch({ id, etapa: 'propuesta', plan_objetivo: 'pro', q_dolor: 2, q_presupuesto: 1, q_decision: 2 })).status).toBe(200)
      const j = await leads()
      expect(j.leads.find((l: any) => l.id === id).etapa).toBe('propuesta')
      expect(j.pipeline.porEtapa.propuesta).toBe(1)
      expect(j.pipeline.embudo.find((e: any) => e.etapa === 'reunion_agendada').cnt).toBe(1) // propuesta cuenta como "pasó por reunión"
    })

    it('para marcar perdido hay que anotar el motivo', async () => {
      const id = (await leads()).leads.find((l: any) => l.nombre === 'Eva').id
      expect((await patch({ id, etapa: 'perdido' })).status).toBe(400)
      expect((await patch({ id, etapa: 'perdido', motivo_descarte: 'Sin dolor' })).status).toBe(200)
    })

    it('un lead perdido después de la reunión sigue contando en el embudo', async () => {
      const id = (await leads()).leads.find((l: any) => l.nombre === 'Luis').id
      await patch({ id, etapa: 'reunion_realizada', q_dolor: 1 })
      await patch({ id, etapa: 'perdido', motivo_descarte: 'Sin presupuesto' })
      const { pipeline } = await leads()
      const emb = Object.fromEntries(pipeline.embudo.map((e: any) => [e.etapa, e.cnt]))
      expect(emb.reunion_realizada).toBe(2)   // Ana (llegó a propuesta) + Luis (perdido tras la reunión)
      expect(emb.reunion_agendada).toBe(2)    // Luis saltó "agendada" y aun así cuenta
      expect(pipeline.reunionesRealizadasPorSemana.reduce((a: number, r: any) => a + r.cnt, 0)).toBe(2)
    })

    it('el mismo contacto en otro formulario no crea otra tarjeta: suma al lead y hereda la temperatura', async () => {
      await enviar({ origen: 'webinar', nombre: 'Ana', correo: ' ANA@isp.co ', asunto: 'Webinar: visitas' })
      await enviar({ origen: 'contacto', nombre: 'Pedro', correo: 'pedro@isp.co', datos: { nit: '900.123' } }) // mismo NIT que Ana
      const j = await leads()
      const ana = j.leads.find((l: any) => l.nombre === 'Ana' && !l.principal_id)
      const tarjetas = j.pipeline.leads.filter((l: any) => l.id === ana.id || l.principal_id === ana.id)
      expect(tarjetas).toHaveLength(1)
      expect(Number(tarjetas[0].formularios)).toBe(3)
      expect(tarjetas[0].origenes.split(',').sort()).toEqual(['autodiagnostico', 'contacto', 'webinar'])
      expect(tarjetas[0].etapa).toBe('propuesta')   // el avance queda en el principal
      expect(j.pipeline.leads.some((l: any) => l.nombre === 'Pedro')).toBe(false)
      expect(j.leads.filter((l: any) => l.principal_id === ana.id)).toHaveLength(2) // los envíos siguen en análisis
    })

    it('editar un envío secundario actúa sobre el lead principal', async () => {
      const j = await leads()
      const pedro = j.leads.find((l: any) => l.nombre === 'Pedro')
      expect((await patch({ id: pedro.id, proxima_accion: 'Llamar a Pedro' })).status).toBe(200)
      const ana = (await leads()).pipeline.leads.find((l: any) => l.id === pedro.principal_id)
      expect(ana.proxima_accion).toBe('Llamar a Pedro')
    })

    it('rechaza fechas mal escritas', async () => {
      const id = (await leads()).pipeline.leads[0].id
      expect((await patch({ id, proxima_fecha: 'mañana' })).status).toBe(400)
    })
  })

  describe('responsables y cadencia', () => {
    const patch = (body: any) =>
      route.PATCH(new NextRequest('http://localhost/api/leads', { method: 'PATCH', body: JSON.stringify(body) }))
    const get = async () => (await (await route.GET(new NextRequest('http://localhost/api/leads'))).json()) as any
    const como = (u: any) => auth.mockResolvedValue({ user: u })
    const SUPER = { id: 's', is_superadmin: true, role: 'admin' }
    const ADRIANA = { id: 'adri', is_superadmin: false, role: 'admin' }
    let idZoe: number, idRaro: number

    it('el superadmin asigna; un admin ve solo sus leads y sin el análisis de fuentes', async () => {
      como(SUPER)
      const j = await get()
      idZoe = j.pipeline.leads.find((l: any) => l.nombre === 'Zoe').id
      idRaro = j.pipeline.leads.find((l: any) => l.nombre === 'Raro').id
      expect((await patch({ id: idZoe, responsable_id: 'adri' })).status).toBe(200)
      como(ADRIANA)
      const a = await get()
      expect(a.pipeline.leads.map((l: any) => l.nombre)).toEqual(['Zoe'])
      expect(a.stats).toBeUndefined()
      expect(a.leads.every((l: any) => l.id === idZoe || l.principal_id === idZoe)).toBe(true)
    })

    it('un admin no edita leads ajenos ni reasigna', async () => {
      como(ADRIANA)
      expect((await patch({ id: idRaro, proxima_accion: 'x' })).status).toBe(403)
      expect((await patch({ id: idZoe, responsable_id: 'adri' })).status).toBe(403)
      como({ id: 'c', role: 'cliente' })
      expect((await route.GET(new NextRequest('http://localhost/api/leads'))).status).toBe(403)
    })

    it('marcar enviado avanza la cadencia en días hábiles; "respondió" la detiene', async () => {
      const { execute } = await import('@/lib/db')
      await execute(`UPDATE leads SET cadencia = 'webinar-inscrito', paso_cadencia = 0, cadencia_estado = 'activa', etapa = 'nuevo' WHERE id = ?`, [idZoe])
      como(ADRIANA)
      expect((await patch({ id: idZoe, accion: 'paso_enviado' })).status).toBe(200)
      let zoe = (await get()).pipeline.leads[0]
      expect(zoe.paso_cadencia).toBe(1)
      expect(zoe.etapa).toBe('contactado')
      expect(zoe.proxima_accion).toBe('WhatsApp · autodiagnóstico')
      const { sumarDiasHabiles } = await import('@/lib/cadencias')
      const { hoyBogota } = await import('@/lib/pipeline')
      expect(zoe.proxima_fecha).toBe(sumarDiasHabiles(hoyBogota(), 3))

      expect((await patch({ id: idZoe, accion: 'respondio' })).status).toBe(200)
      zoe = (await get()).pipeline.leads[0]
      expect(zoe.cadencia_estado).toBe('respondio')
      expect(zoe.proxima_fecha).toBe(hoyBogota())
      expect((await patch({ id: idZoe, accion: 'paso_enviado' })).status).toBe(400)   // ya no hay paso pendiente
    })

    it('al último paso sin respuesta la cadencia queda terminada', async () => {
      const { execute } = await import('@/lib/db')
      await execute(`UPDATE leads SET cadencia = 'webinar-inscrito', paso_cadencia = 2, cadencia_estado = 'activa' WHERE id = ?`, [idZoe])
      como(ADRIANA)
      await patch({ id: idZoe, accion: 'paso_enviado' })
      const zoe = (await get()).pipeline.leads[0]
      expect(zoe.cadencia_estado).toBe('terminada')
      expect(zoe.proxima_accion).toMatch(/Cadencia terminada/)
    })
  })

  describe('hoyBogota', () => {
    it('a las 8 p.m. de Bogotá sigue siendo el mismo día aunque en UTC ya sea mañana', async () => {
      const { hoyBogota } = await import('@/lib/pipeline')
      expect(hoyBogota(new Date('2026-10-28T01:00:00Z'))).toBe('2026-10-27')
      expect(hoyBogota(new Date('2026-10-28T06:00:00Z'))).toBe('2026-10-28')
    })
  })
})
