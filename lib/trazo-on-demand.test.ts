/** Enlaces de pago on demand: se cobran por Trazo pero nunca crean cuenta ni tocan la suscripción. BD temporal. */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'
import { NextRequest } from 'next/server'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'owl-ondemand-'))
process.env.DB_PATH = path.join(tmp, 'test.db')
delete process.env.TURSO_DATABASE_URL
delete process.env.TURSO_AUTH_TOKEN
process.env.TRAZO_BASE_URL = 'https://trazo.test'
process.env.TRAZO_AUTH_KEY = 'k'
process.env.TRAZO_MERCHANT_ID = '900'

let refN = 0
vi.mock('@/lib/trazo', () => ({
  crearCobro: vi.fn(async (input: any) => ({
    external_reference: `REF-${++refN}`, link: `https://pay.trazo.test/${refN}`, process_id: 'p', channel: 'EMAIL', created_at: '', _input: input,
  })),
}))
vi.mock('@/lib/clientes', () => ({ crearCuentaClienteAutomatica: vi.fn(async () => ({ clienteId: 'cli-nuevo' })) }))
vi.mock('@/lib/revision', () => ({ conAvisoDeRevision: vi.fn(async (_id: string, fn: () => any) => fn()) }))
vi.mock('@/lib/email', () => ({ enviarEmail: vi.fn(async () => true) }))
vi.mock('@/lib/notificaciones', () => ({ notificarSuscripcion: vi.fn(async () => {}) }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

let route: typeof import('@/app/api/superadmin/pagos-on-demand/route')
let publica: typeof import('@/app/api/on-demand/[token]/route')
let flujo: typeof import('./trazo-cobros-flujo')
let trazo: any, clientes: any, email: any, notif: any, auth: any, execute: any, queryOne: any

const base = {
  concepto: 'Acompañamiento visita MinTIC', monto: 500000, nombre: 'ISP Uno SAS',
  tipo_identificacion: 'NIT', numero_identificacion: '900123456', email: 'pagos@isp.co',
}
const crear = (body: any) => route.POST(new Request('http://x/api/superadmin/pagos-on-demand', { method: 'POST', body: JSON.stringify(body) }))
const patch = (body: any) => route.PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify(body) }))
const tokenDe = (enlace: string) => enlace.split('/pago/')[1]
const llenar = (token: string, body: any) => publica.POST(
  new NextRequest(`http://x/api/on-demand/${token}`, { method: 'POST', body: JSON.stringify(body) }),
  { params: Promise.resolve({ token }) })
const solicitante = {
  nombre: 'Ana Pérez', empresa: 'ISP Uno SAS', tipo_id: 'NIT', numero_id: '900123456', telefono: '300 123 4567',
  correo: 'ana@isp.co', objeto: 'Acompañamiento en la visita del MinTIC del 5 de diciembre', autorizacion: true,
}
const servicioPorId = async (id: number) => (await (await route.GET()).json() as any).servicios.find((s: any) => s.id === id)
const pago = (ref: string, status: string, amount: number) =>
  flujo.procesarWebhookCobroTrazo({ event: { type: 'payment', status }, external_reference: ref, detail: { amount: String(amount) } })

beforeAll(async () => {
  route = await import('@/app/api/superadmin/pagos-on-demand/route')
  publica = await import('@/app/api/on-demand/[token]/route')
  flujo = await import('./trazo-cobros-flujo')
  trazo = await import('@/lib/trazo'); clientes = await import('@/lib/clientes')
  email = await import('@/lib/email'); notif = await import('@/lib/notificaciones')
  ;({ auth } = await import('@/lib/auth') as any)
  ;({ execute, queryOne } = await import('./db') as any)
  await execute(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT)`)
  await execute(`CREATE TABLE clientes (id TEXT PRIMARY KEY, user_id TEXT, plan TEXT, suscripcion_estado TEXT, es_cortesia INTEGER, updated_at TEXT, razon_social TEXT, nit TEXT, contacto TEXT, email TEXT)`)
  await execute(`INSERT INTO users VALUES ('u1', 'cliente@isp.co')`)
  await execute(`INSERT INTO clientes VALUES ('c1', 'u1', 'pro', 'activa', 0, '', 'Cliente Uno SAS', '901000111', 'Luis', '')`)
})

beforeEach(() => {
  vi.clearAllMocks()
  auth.mockResolvedValue({ user: { id: 's', is_superadmin: true } })
})

describe('superadmin crea el servicio', () => {
  it('solo el superadmin', async () => {
    auth.mockResolvedValue({ user: { id: 'a', is_superadmin: false } })
    expect((await crear({ concepto: 'Asesoría', monto: 500000 })).status).toBe(403)
    expect((await route.GET()).status).toBe(403)
    expect((await patch({ id: 1, avance: 'en_curso' })).status).toBe(403)
  })

  it('valida concepto, valor y correo de envío', async () => {
    const res = await crear({ concepto: 'x', monto: 5, enviar_a: 'malo' })
    expect(res.status).toBe(400)
    expect((await res.json() as any).campos).toEqual(['concepto', 'monto', 'enviar_a'])
  })

  it('crea el enlace propio /pago/<token> sin llamar a Trazo todavía, y lo envía por correo si se pide', async () => {
    const res = await crear({ concepto: 'Acompañamiento visita MinTIC', monto: 500000, enviar_a: 'ana@isp.co' })
    const j: any = await res.json()
    expect(res.status).toBe(200)
    expect(j.enlace).toMatch(/\/pago\/[\w-]{20,}$/)
    expect(j.correoEnviado).toBe(true)
    expect(email.enviarEmail.mock.calls[0][0].html).toContain(j.enlace)
    expect(trazo.crearCobro).not.toHaveBeenCalled()
    const s = await servicioPorId(j.id)
    expect([s.estado_pago, s.avance]).toEqual(['esperando_datos', 'por_iniciar'])
  })

  it('con cliente existente precarga sus datos en el formulario', async () => {
    const j: any = await (await crear({ concepto: 'Revisión de reportes', monto: 300000, cliente_id: 'c1' })).json()
    const s = await servicioPorId(j.id)
    expect([s.empresa, s.numero_id, s.correo, s.nombre]).toEqual(['Cliente Uno SAS', '901000111', 'cliente@isp.co', 'Luis'])
  })
})

describe('el cliente llena el formulario', () => {
  let id: number, token: string
  beforeAll(async () => {
    auth.mockResolvedValue({ user: { id: 's', is_superadmin: true, email: 'super@owl.co' } })
    const j: any = await (await crear({ concepto: 'Acompañamiento visita MinTIC', monto: 500000 })).json()
    id = j.id; token = tokenDe(j.enlace)
  })

  it('enlace inexistente: 404', async () => {
    expect((await llenar('no-existe', solicitante)).status).toBe(404)
  })

  it('valida datos de contacto, objeto y autorización', async () => {
    const res = await llenar(token, { ...solicitante, telefono: '12', objeto: 'corto', autorizacion: false, correo: 'x' })
    expect(res.status).toBe(400)
    expect((await res.json() as any).campos).toEqual(expect.arrayContaining(['telefono', 'objeto', 'autorizacion', 'correo']))
    expect(trazo.crearCobro).not.toHaveBeenCalled()
  })

  it('guarda los datos, crea el cobro a nombre de la empresa, registra el lead, avisa y devuelve el pago', async () => {
    const res = await llenar(token, solicitante)
    const j: any = await res.json()
    expect(res.status).toBe(200)
    expect(j.link).toMatch(/^https:\/\/pay\.trazo\.test\//)
    const input = trazo.crearCobro.mock.calls[0][0]
    expect(input.amount).toBe(500000)
    expect(input.payer).toMatchObject({ first_name: 'ISP Uno SAS', user_id_type: 'NIT', user_id_number: '900123456', email: 'ana@isp.co' })
    expect(input.return_url).toContain('/pago-exitoso?tipo=servicio')

    const s = await servicioPorId(id)
    expect([s.nombre, s.telefono, s.objeto, s.estado_pago]).toEqual(['Ana Pérez', '300 123 4567', solicitante.objeto, 'pendiente'])
    expect(s.autorizacion_fecha).toBeTruthy()

    const lead = await queryOne(`SELECT * FROM leads ORDER BY id DESC LIMIT 1`)
    expect([lead.origen, lead.telefono, lead.mensaje]).toEqual(['on demand', '300 123 4567', solicitante.objeto])
    expect(email.enviarEmail.mock.calls[0][0].subject).toContain('[ON DEMAND]')
  })

  it('si vuelve a enviar con el pago pendiente, recibe el mismo enlace y no se crea otro cobro', async () => {
    const primero = (await servicioPorId(id)).link_pago
    const j: any = await (await llenar(token, solicitante)).json()
    expect(j.link).toBe(primero)
    expect(trazo.crearCobro).not.toHaveBeenCalled()
  })

  it('al pagar: el seguimiento muestra Pagado y no se crea ninguna cuenta', async () => {
    const s = await servicioPorId(id)
    await pago(s.external_reference, 'success', 500000)
    expect((await servicioPorId(id)).estado_pago).toBe('pagada')
    expect(clientes.crearCuentaClienteAutomatica).not.toHaveBeenCalled()
    expect((await llenar(token, solicitante)).status).toBe(409)
  })

  it('seguimiento: cambia avance y notas; rechaza avances inventados; no deja eliminar uno pagado', async () => {
    expect((await patch({ id, avance: 'en_curso', notas: 'Llamé, visita confirmada' })).status).toBe(200)
    const s = await servicioPorId(id)
    expect([s.avance, s.notas]).toEqual(['en_curso', 'Llamé, visita confirmada'])
    expect((await patch({ id, avance: 'volando' })).status).toBe(400)
    expect((await patch({ id: 99999, avance: 'en_curso' })).status).toBe(404)
    expect((await route.DELETE(new NextRequest(`http://x/?id=${id}`, { method: 'DELETE' }))).status).toBe(400)
  })

  it('marcar pagado a mano: solo si el cliente ya llenó datos, y sin crear cuenta', async () => {
    const j: any = await (await crear({ concepto: 'Asesoría puntual', monto: 200000 })).json()
    expect((await patch({ id: j.id, marcar_pagado: true })).status).toBe(400)
    await llenar(tokenDe(j.enlace), solicitante)
    expect((await patch({ id: j.id, marcar_pagado: true })).status).toBe(200)
    expect((await servicioPorId(j.id)).estado_pago).toBe('pagada')
    expect(clientes.crearCuentaClienteAutomatica).not.toHaveBeenCalled()
  })

  it('un servicio cancelado ya no recibe datos; uno sin pagar se puede eliminar', async () => {
    const j: any = await (await crear({ concepto: 'Asesoría cancelada', monto: 200000 })).json()
    await patch({ id: j.id, avance: 'cancelado' })
    expect((await llenar(tokenDe(j.enlace), solicitante)).status).toBe(404)
    expect((await route.DELETE(new NextRequest(`http://x/?id=${j.id}`, { method: 'DELETE' }))).status).toBe(200)
    expect(await servicioPorId(j.id)).toBeUndefined()
  })
})

describe('webhook de Trazo', () => {
  it('pago on demand aprobado: queda pagado y avisa al superadmin, sin crear cuenta ni tocar clientes', async () => {
    const { externalReference } = await flujo.crearCobroOnDemand({ ...base, nombreCliente: 'Nadie Registrado', tipoIdentificacion: 'NIT', numeroIdentificacion: '1', email: 'nuevo@x.co' })
    vi.clearAllMocks()
    const r = await pago(externalReference, 'success', 500000)
    expect(r.accion).toBe('pagada')
    expect(clientes.crearCuentaClienteAutomatica).not.toHaveBeenCalled()
    expect(notif.notificarSuscripcion).not.toHaveBeenCalled()
    expect((await queryOne(`SELECT estado FROM trazo_cobros WHERE external_reference = ?`, [externalReference])).estado).toBe('pagada')
    expect(email.enviarEmail.mock.calls[0][0].subject).toContain('[PAGO ON DEMAND]')
  })

  it('pago on demand de un cliente existente que paga: su plan y suscripción no cambian', async () => {
    await execute(`UPDATE clientes SET plan = 'basico', suscripcion_estado = 'vencida', es_cortesia = 1 WHERE id = 'c1'`)
    const { externalReference } = await flujo.crearCobroOnDemand({ ...base, nombreCliente: 'ISP', tipoIdentificacion: 'NIT', numeroIdentificacion: '1', email: 'cliente@isp.co', clienteId: 'c1' })
    await pago(externalReference, 'success', 500000)
    const c = await queryOne(`SELECT plan, suscripcion_estado, es_cortesia FROM clientes WHERE id = 'c1'`)
    expect([c.plan, c.suscripcion_estado, c.es_cortesia]).toEqual(['basico', 'vencida', 1])
  })

  it('pago on demand rechazado: no suspende la suscripción del cliente', async () => {
    await execute(`UPDATE clientes SET suscripcion_estado = 'activa' WHERE id = 'c1'`)
    const { externalReference } = await flujo.crearCobroOnDemand({ ...base, nombreCliente: 'ISP', tipoIdentificacion: 'NIT', numeroIdentificacion: '1', email: 'cliente@isp.co', clienteId: 'c1' })
    expect((await pago(externalReference, 'failed', 500000)).accion).toBe('rechazada')
    expect((await queryOne(`SELECT suscripcion_estado FROM clientes WHERE id = 'c1'`)).suscripcion_estado).toBe('activa')
  })

  it('monto distinto: no se marca pagado', async () => {
    const { externalReference } = await flujo.crearCobroOnDemand({ ...base, nombreCliente: 'ISP', tipoIdentificacion: 'NIT', numeroIdentificacion: '1', email: 'x@isp.co' })
    expect((await pago(externalReference, 'success', 1000)).accion).toBe('ignorado')
    expect((await queryOne(`SELECT estado FROM trazo_cobros WHERE external_reference = ?`, [externalReference])).estado).toBe('pendiente')
  })

  it('control: un cobro de suscripción sí sigue creando la cuenta', async () => {
    const { externalReference } = await flujo.crearCobroTrazoParaContrato({
      plan: 'basico', nombreCliente: 'ISP Nuevo', tipoIdentificacion: 'NIT', numeroIdentificacion: '2', email: 'nuevo-plan@x.co', montoOverride: 199000,
    })
    await pago(externalReference, 'success', 199000)
    expect(clientes.crearCuentaClienteAutomatica).toHaveBeenCalledOnce()
  })
})
