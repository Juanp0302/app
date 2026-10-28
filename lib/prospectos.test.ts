/** Prospectos: cadencia del webinar (botones "Ya lo envié" / "Respondió"), permisos y datos para la temperatura. */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'owl-prospectos-'))
process.env.DB_PATH = path.join(tmp, 'test.db')
delete process.env.TURSO_DATABASE_URL
delete process.env.TURSO_AUTH_TOKEN

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

let route: typeof import('@/app/api/prospectos/route')
let auth: any
const ADRI = { id: 'adri', role: 'admin', is_superadmin: false }

const patch = (body: any) =>
  route.PATCH(new Request('http://localhost/api/prospectos', { method: 'PATCH', body: JSON.stringify(body) }))
const lista = async () => ((await (await route.GET()).json()) as any).prospectos as any[]
const uno = async (id: string) => (await lista()).find(p => p.id === id)

beforeAll(async () => {
  const { execute } = await import('@/lib/db')
  await execute(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, nombre TEXT, email TEXT, is_superadmin INTEGER, created_at TEXT)`)
  await execute(`INSERT INTO users (id, nombre, email) VALUES ('adri', 'Adriana Linares', 'a@owl.co'), ('david', 'David Osorio', 'd@owl.co')`)
  const { migrateProspectos } = await import('@/lib/prospectos-db')
  await migrateProspectos()
  await execute(`INSERT INTO prospectos_isp (id, puesto, prioridad, empresa, estado, responsable_id, campana, en_webinar, webinar_asistio,
                   webinar_minutos, cadencia, paso_cadencia, cadencia_estado, proxima_fecha)
                 VALUES ('asis', 201, 'W', 'Meganetwork SAS', 'Pendiente', 'adri', 'webinar', 1, 1, 208, 'webinar-asistente', 0, 'activa', '2026-10-28'),
                        ('insc', 202, 'W', 'Novacom', 'Pendiente', 'adri', 'webinar', 1, 0, NULL, 'webinar-inscrito', 2, 'activa', '2026-10-28'),
                        ('cold', 1, 'A', 'Starnet', 'Pendiente', 'david', 'cold-mailing', 0, 0, NULL, NULL, 0, NULL, NULL)`)
  route = await import('@/app/api/prospectos/route')
  ;({ auth } = await import('@/lib/auth') as any)
  auth.mockResolvedValue({ user: ADRI })
})

describe('/api/prospectos · cadencia', () => {
  it('un admin ve solo los suyos, con los datos de campaña y cadencia', async () => {
    const ps = await lista()
    expect(ps.map(p => p.id).sort()).toEqual(['asis', 'insc'])
    expect(ps.find(p => p.id === 'asis')).toMatchObject({ campana: 'webinar', webinar_minutos: 208, cadencia: 'webinar-asistente' })
  })

  it('"Ya lo envié" avanza el paso, pasa a WA1 enviado y programa el siguiente en días hábiles', async () => {
    expect((await patch({ id: 'asis', accion: 'paso_enviado' })).status).toBe(200)
    const p = await uno('asis')
    const { sumarDiasHabiles } = await import('@/lib/cadencias')
    const { hoyBogota } = await import('@/lib/ventas')
    expect(p).toMatchObject({ paso_cadencia: 1, estado: 'WA1 enviado', proxima_fecha: sumarDiasHabiles(hoyBogota(), 1) })
    expect(p.ultimo_cambio).toBeTruthy()   // el cambio de estado queda en el historial (lo usa la temperatura)
  })

  it('el paso de llamada deja "Llamada sin contacto" si no hubo respuesta', async () => {
    await patch({ id: 'asis', accion: 'paso_enviado' })
    expect((await uno('asis')).estado).toBe('Llamada sin contacto')
  })

  it('"Respondió" detiene la cadencia, cambia el estado y deja el próximo paso', async () => {
    await patch({ id: 'asis', accion: 'respondio' })
    const p = await uno('asis')
    expect(p).toMatchObject({ cadencia_estado: 'respondio', estado: 'Respondió', proximo_paso: 'Agendar la reunión' })
    expect((await patch({ id: 'asis', accion: 'paso_enviado' })).status).toBe(400)
  })

  it('al último paso sin respuesta la cadencia queda terminada', async () => {
    await patch({ id: 'insc', accion: 'paso_enviado' })
    expect(await uno('insc')).toMatchObject({ cadencia_estado: 'terminada', proxima_fecha: null, paso_cadencia: 3 })
  })

  it('no se puede tocar la cadencia de un prospecto ajeno', async () => {
    expect((await patch({ id: 'cold', accion: 'paso_enviado' })).status).toBe(403)
  })
})
