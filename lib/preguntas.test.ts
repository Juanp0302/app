/** Preguntas del público (ExpoISP): ruta pública, anti-spam, Leads y vista del superadmin. BD temporal. */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'
import { NextRequest } from 'next/server'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'owl-preguntas-'))
process.env.DB_PATH = path.join(tmp, 'test.db')
delete process.env.TURSO_DATABASE_URL
delete process.env.TURSO_AUTH_TOKEN

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

let route: typeof import('@/app/api/preguntas/route')
let auth: any
let queryAll: any

const SITIO = 'https://owlcompliance.com'
const base = {
  nombre: 'Ana Pérez', empresa: 'ISP Uno', celular: '+57 300 123 4567', correo: 'ana@isp.co',
  pregunta: '¿Cada cuánto se reporta el formato T.1.1?', autorizacion: true,
  utm_source: 'expoisp', utm_medium: 'qr', utm_campaign: 'expoisp2026',
}

function enviar(body: any, { ip = '10.0.0.1', origin = SITIO } = {}) {
  return route.POST(new NextRequest('https://app.owlcompliance.com/api/preguntas', {
    method: 'POST', body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', origin, 'x-forwarded-for': `${ip}, 172.16.0.1` },
  }))
}
const comoSuper = () => auth.mockResolvedValue({ user: { id: 's', role: 'admin', is_superadmin: true } })
const comoAdmin = () => auth.mockResolvedValue({ user: { id: 'a', role: 'admin', is_superadmin: false } })

beforeAll(async () => {
  route = await import('@/app/api/preguntas/route')
  ;({ auth } = await import('@/lib/auth') as any)
  ;({ queryAll } = await import('./db') as any)
})

describe('POST público', () => {
  it('guarda la pregunta con autorización + fecha, UTM, estado "nueva" y publicada = falso', async () => {
    const res = await enviar(base)
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe(SITIO)
    const [p] = await queryAll(`SELECT * FROM preguntas`)
    expect(p.nombre).toBe('Ana Pérez')
    expect(p.autorizacion).toBe(1)
    expect(p.autorizacion_fecha).toBeTruthy()
    expect([p.utm_source, p.utm_medium, p.utm_campaign]).toEqual(['expoisp', 'qr', 'expoisp2026'])
    expect(p.estado).toBe('nueva')
    expect(p.respuesta).toBe('')
    expect(p.publicada).toBe(0)
    expect(p.ip_hash).not.toContain('10.0.0.1')          // la IP no se guarda en claro
  })

  it('también la registra en Leads con origen "preguntas expoisp"', async () => {
    const [l] = await queryAll(`SELECT * FROM leads`)
    expect(l.origen).toBe('preguntas expoisp')
    expect(l.mensaje).toBe(base.pregunta)
    expect(l.telefono).toBe(base.celular)
    expect(l.utm_campaign).toBe('expoisp2026')
  })

  it('sin UTM en la URL guarda vacío (no null)', async () => {
    await enviar({ ...base, utm_source: undefined, utm_medium: undefined, utm_campaign: undefined, correo: 'b@isp.co' })
    const [p] = await queryAll(`SELECT * FROM preguntas WHERE correo = 'b@isp.co'`)
    expect([p.utm_source, p.utm_medium, p.utm_campaign]).toEqual(['', '', ''])
  })

  it('honeypot lleno: responde ok pero no guarda nada', async () => {
    const antes = (await queryAll(`SELECT id FROM preguntas`)).length
    const res = await enviar({ ...base, _honey: 'http://spam' })
    expect(res.status).toBe(200)
    expect((await queryAll(`SELECT id FROM preguntas`)).length).toBe(antes)
  })

  it.each([
    ['correo', { correo: 'no-es-correo' }],
    ['celular', { celular: '123' }],
    ['nombre', { nombre: '' }],
    ['empresa', { empresa: ' ' }],
    ['pregunta', { pregunta: 'hola' }],
    ['autorizacion', { autorizacion: false }],
  ])('rechaza %s inválido con 400 y dice qué campo', async (campo, cambio) => {
    const res = await enviar({ ...base, ...cambio })
    expect(res.status).toBe(400)
    expect((await res.json() as any).campos).toContain(campo)
  })

  it('límite por IP: el envío 31 en 10 minutos desde la misma conexión da 429; otra conexión sigue pudiendo', async () => {
    for (let i = 0; i < 30; i++) expect((await enviar(base, { ip: '200.1.1.1' })).status).toBe(200)
    expect((await enviar(base, { ip: '200.1.1.1' })).status).toBe(429)
    expect((await enviar(base, { ip: '200.1.1.2' })).status).toBe(200)
  })

  it('CORS: el preflight del sitio responde 204 con permisos; un dominio ajeno no recibe permiso', async () => {
    const pre = await route.OPTIONS(new NextRequest('https://app.owlcompliance.com/api/preguntas', { method: 'OPTIONS', headers: { origin: SITIO } }))
    expect(pre.status).toBe(204)
    expect(pre.headers.get('access-control-allow-methods')).toContain('POST')
    const ajeno = await enviar(base, { ip: '9.9.9.9', origin: 'https://otro-sitio.com' })
    expect(ajeno.headers.get('access-control-allow-origin')).toBeNull()
  })
})

describe('vista del superadmin', () => {
  it('nadie más puede leerlas: sin sesión y un administrador común reciben 403', async () => {
    auth.mockResolvedValue(null)
    expect((await route.GET(new NextRequest('https://app.owlcompliance.com/api/preguntas'))).status).toBe(403)
    comoAdmin()
    expect((await route.GET(new NextRequest('https://app.owlcompliance.com/api/preguntas'))).status).toBe(403)
    expect((await route.PATCH(new NextRequest('https://app.owlcompliance.com/api/preguntas', { method: 'PATCH', body: '{"id":1,"estado":"respondida"}' }))).status).toBe(403)
  })

  it('el superadmin las ve de la más reciente a la más antigua, sin el hash de IP, y con las campañas para filtrar', async () => {
    comoSuper()
    const j: any = await (await route.GET(new NextRequest('https://app.owlcompliance.com/api/preguntas'))).json()
    const ids = j.preguntas.map((p: any) => p.id)
    expect(ids).toEqual([...ids].sort((a: number, b: number) => b - a))
    expect(j.preguntas[0].ip_hash).toBeUndefined()
    expect(j.campanas).toEqual(expect.arrayContaining(['', 'expoisp2026']))
  })

  it('filtra por campaña', async () => {
    comoSuper()
    const j: any = await (await route.GET(new NextRequest('https://app.owlcompliance.com/api/preguntas?campana=expoisp2026'))).json()
    expect(j.preguntas.length).toBeGreaterThan(0)
    expect(j.preguntas.every((p: any) => p.utm_campaign === 'expoisp2026')).toBe(true)
  })

  it('marca como seleccionada / respondida y rechaza estados inventados', async () => {
    comoSuper()
    const patch = (body: any) => route.PATCH(new NextRequest('https://app.owlcompliance.com/api/preguntas', { method: 'PATCH', body: JSON.stringify(body) }))
    expect((await patch({ id: 1, estado: 'seleccionada' })).status).toBe(200)
    expect((await patch({ id: 1, estado: 'respondida' })).status).toBe(200)
    expect((await patch({ id: 1, estado: 'borrada' })).status).toBe(400)
    expect((await patch({ id: 99999, estado: 'nueva' })).status).toBe(404)
    const [p] = await queryAll(`SELECT estado FROM preguntas WHERE id = 1`)
    expect(p.estado).toBe('respondida')
  })

  it('CSV: abre bien en Excel (BOM, separador ;) y neutraliza fórmulas', async () => {
    await enviar({ ...base, nombre: '=HYPERLINK("x")', correo: 'f@isp.co' }, { ip: '7.7.7.7' })
    comoSuper()
    const res = await route.GET(new NextRequest('https://app.owlcompliance.com/api/preguntas?formato=csv'))
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(res.headers.get('content-disposition')).toContain('preguntas-todas-')
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xEF, 0xBB, 0xBF])     // BOM UTF-8 (text() lo quitaría al leer)
    const csv = new TextDecoder().decode(bytes)
    expect(csv.split('\r\n')[0]).toContain('id;fecha;nombre;empresa;celular;correo;pregunta')
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(csv).not.toContain('ip_hash')
  })
})
