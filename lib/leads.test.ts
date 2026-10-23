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

  it('solo el superadmin puede consultarlos', async () => {
    auth.mockResolvedValue({ user: { id: 'a', role: 'admin', is_superadmin: false } })
    expect((await route.GET(new NextRequest('http://localhost/api/leads'))).status).toBe(403)
  })

  it('con LEADS_WEBHOOK_SECRET configurado, un POST sin la clave se rechaza', async () => {
    process.env.LEADS_WEBHOOK_SECRET = 'clave'
    expect((await enviar({ nombre: 'Intruso' })).status).toBe(401)
    delete process.env.LEADS_WEBHOOK_SECRET
  })
})
