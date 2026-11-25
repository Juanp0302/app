/** Ventas automáticas (lib/ventas-auto.ts) contra una base de prueba; el SMTP es un simulacro que guarda lo que se enviaría. */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'owl-ventas-auto-'))
process.env.DB_PATH = path.join(tmp, 'test.db')
delete process.env.TURSO_DATABASE_URL
delete process.env.TURSO_AUTH_TOKEN
delete process.env.GMAIL_USER
delete process.env.GMAIL_APP_PASSWORD
process.env.INTERNAL_SECRET = 'secreto-de-prueba'

const enviados: any[] = []
let fallar = false
vi.mock('@/lib/smtp', () => ({
  cuentaCorreo: () => 'contacto@owlcompliance.com',
  enviarSmtp: vi.fn(async (c: any) => {
    if (fallar && !c.asunto.startsWith('⚠')) return { ok: false, error: 'SMTP caído' }
    enviados.push(c)
    return { ok: true, messageId: `<m${enviados.length}@owl>` }
  }),
}))

let va: typeof import('@/lib/ventas-auto')
let q: <T = any>(sql: string, args?: any[]) => Promise<T | undefined>
const prospecto = (id: string) => q<any>(`SELECT * FROM prospectos_isp WHERE id = ?`, [id])
const historial = async (id: string) => {
  const { queryAll } = await import('@/lib/db')
  return (await queryAll<any>(`SELECT nota, estado_nuevo FROM prospectos_isp_historial WHERE prospecto_id = ? ORDER BY created_at`, [id]))
}
const correosA = (para: string) => enviados.filter(e => e.para === para)
const HOY = '2026-11-12'   // jueves hábil

beforeAll(async () => {
  const db = await import('@/lib/db')
  q = db.queryOne
  await db.execute(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, nombre TEXT, email TEXT, is_superadmin INTEGER, created_at TEXT)`)
  await db.execute(`INSERT INTO users (id, nombre, email, is_superadmin, created_at) VALUES
    ('super', 'Super Administrador', 'contacto@owlcompliance.com', 1, '2026-01-01'),
    ('adri', 'Adriana Linares', 'a@owl.co', 0, '2026-01-02'), ('david', 'David Osorio', 'd@owl.co', 0, '2026-01-03')`)
  va = await import('@/lib/ventas-auto')
  await va.migrateVentasAuto()
  await db.execute(`INSERT INTO prospectos_isp (id, puesto, prioridad, empresa, correo, representante, estado, responsable_id, campana,
                      cadencia, paso_cadencia, cadencia_estado, proxima_fecha, automatico)
                    VALUES ('fria', 1, 'A', 'Meganetwork SAS', 'gerencia@mega.co', 'Rodrigo Vargas', 'Pendiente', 'adri', 'cold-mailing', 'cold-mailing', 0, 'activa', '2026-11-10', 1),
                           ('manual', 2, 'C2', 'Redes SAS', 'info@redes.co', 'Ana', 'WA1 enviado', 'david', 'cold-mailing', 'cold-mailing', 1, 'activa', '2026-11-12', 0),
                           ('rebota', 3, 'C2', 'Fantasma SAS', 'nadie@fantasma.co', 'Luis', 'Pendiente', 'david', 'cold-mailing', 'cold-mailing', 0, 'activa', '2026-11-12', 1),
                           ('futuro', 4, 'C2', 'Mañana SAS', 'm@manana.co', 'Eva', 'Pendiente', 'super', 'cold-mailing', 'cold-mailing', 0, 'activa', '2026-11-20', 1)`)
  const { guardarRadiografia } = await import('@/lib/radiografias')
  await guardarRadiografia('fria', 'Radiografia_900_MEGA.pdf', new TextEncoder().encode('%PDF-1.4 prueba'), null)
})

beforeEach(() => { enviados.length = 0; fallar = false; delete process.env.VENTAS_AUTOMATICAS })

describe('envío de la cadencia por correo', () => {
  it('en simulación no envía ni avanza nada', async () => {
    const r = await va.procesarEnvios(HOY, 'simulacion')
    expect(r.map(x => [x.prospecto, x.resultado])).toEqual([['fria', 'simulado'], ['rebota', 'simulado']])   // 'manual' no va en automático; 'futuro' no toca
    expect(enviados).toHaveLength(0)
    expect((await prospecto('fria')).paso_cadencia).toBe(0)
  })

  it('en activo: el primero sale con la radiografía, la baja en la cabecera, y la cadencia salta la llamada', async () => {
    const r = await va.procesarEnvios(HOY, 'activo')
    expect(r.map(x => x.resultado)).toEqual(['enviado', 'enviado'])
    const [c] = correosA('gerencia@mega.co')
    expect(c.asunto).toBe('Radiografía regulatoria de Meganetwork SAS')
    expect(c.nombreRemitente).toBe('Adriana · Owl Compliance')
    expect(c.adjuntos).toHaveLength(1)
    expect(c.adjuntos[0].filename).toBe('Radiografía regulatoria - Meganetwork SAS.pdf')
    expect(c.cabeceras['List-Unsubscribe']).toMatch(/\/api\/baja\?p=fria&t=/)
    expect(c.texto).toMatch(/^Hola, Rodrigo\. Soy Adriana de Owl Compliance/)
    const p = await prospecto('fria')
    // Paso 0 enviado; la llamada (1) se salta: sigue el 2, a 1 + 2 = 3 días hábiles (jueves 12 → miércoles 18: el lunes 16 es festivo).
    expect(p).toMatchObject({ paso_cadencia: 2, proxima_fecha: '2026-11-18', estado: 'WA1 enviado', cadencia_estado: 'activa' })
    expect((await historial('fria')).at(-1).nota).toContain('Correo automático enviado a gerencia@mega.co')
  })

  it('el siguiente va en el mismo hilo ("Re:" e In-Reply-To del primero) y sin adjunto', async () => {
    await va.procesarEnvios('2026-11-18', 'activo')
    const [c] = correosA('gerencia@mega.co')
    expect(c.asunto).toBe('Re: Radiografía regulatoria de Meganetwork SAS')
    expect(c.enRespuestaA).toBe('<m1@owl>')
    expect(c.adjuntos).toHaveLength(0)
    expect((await prospecto('fria')).paso_cadencia).toBe(3)
  })

  it('si el SMTP falla, no avanza; a la tercera, el prospecto vuelve a manual', async () => {
    const { execute } = await import('@/lib/db')
    await execute(`INSERT INTO prospectos_isp (id, puesto, prioridad, empresa, correo, estado, responsable_id, campana, cadencia, paso_cadencia, cadencia_estado, proxima_fecha, automatico)
                   VALUES ('falla', 9, 'C2', 'Falla SAS', 'f@falla.co', 'Pendiente', 'david', 'cold-mailing', 'cold-mailing', 0, 'activa', '2026-11-12', 1)`)
    fallar = true
    for (let i = 0; i < 3; i++) {
      const [r] = (await va.procesarEnvios('2026-11-12', 'activo')).filter(x => x.prospecto === 'falla')
      expect(r.resultado).toBe('error')
    }
    expect(await prospecto('falla')).toMatchObject({ automatico: 0, paso_cadencia: 0 })
  })
})

describe('lo que llega al buzón', () => {
  it('una respuesta en el hilo detiene la cadencia, sale de automático y avisa a la responsable', async () => {
    const r = await va.procesarEntrante({ de: 'otra.persona@mega.co', asunto: 'Re: Radiografía', texto: 'Sí, hablemos el martes.\n\n> cita', cabeceras: {}, responde: ['<m1@owl>'] }, HOY)
    expect(r).toMatchObject({ tipo: 'respuesta', empresa: 'Meganetwork SAS' })
    expect(await prospecto('fria')).toMatchObject({ cadencia_estado: 'respondio', estado: 'Respondió', automatico: 0, proximo_paso: 'Agendar la reunión' })
    expect((await historial('fria')).at(-1).nota).toBe('Respondió por correo: «Sí, hablemos el martes.»')
    expect(enviados.map(e => e.para)).toEqual(['a@owl.co'])
    expect(enviados[0].asunto).toBe('💬 Respondió: Meganetwork SAS')
  })

  it('un prospecto manual que responde por correo también se detiene', async () => {
    await va.procesarEntrante({ de: 'Ana <INFO@redes.co>', asunto: 'Re: hola', texto: 'Me interesa', cabeceras: {}, responde: [] }, HOY)
    expect(await prospecto('manual')).toMatchObject({ cadencia_estado: 'respondio', estado: 'Respondió' })
  })

  it('un rebote marca el correo inválido y lo saca de automático; la respuesta automática no hace nada', async () => {
    expect((await va.procesarEntrante({ de: 'mailer-daemon@googlemail.com', asunto: 'Delivery Status Notification (Failure)',
      texto: 'Your message wasn\'t delivered to nadie@fantasma.co because the address couldn\'t be found.', cabeceras: {}, responde: [] })).tipo).toBe('rebote')
    expect(await prospecto('rebota')).toMatchObject({ correo_invalido: 1, automatico: 0 })
    expect((await va.procesarEntrante({ de: 'm@manana.co', asunto: 'Respuesta automática: vacaciones', texto: 'Vuelvo el lunes', cabeceras: {}, responde: [] })).tipo).toBe('automatica')
    expect((await prospecto('futuro')).automatico).toBe(1)
  })

  it('"darme de baja" la da de baja; un correo de alguien desconocido no hace nada', async () => {
    expect((await va.procesarEntrante({ de: 'm@manana.co', asunto: 'Re: x', texto: 'Por favor darme de baja', cabeceras: {}, responde: [] })).tipo).toBe('baja')
    expect(await prospecto('futuro')).toMatchObject({ baja: 1, estado: 'No contactar', cadencia_estado: 'terminada', automatico: 0 })
    expect((await va.procesarEntrante({ de: 'quien@sea.co', asunto: 'Hola', texto: 'Hola', cabeceras: {}, responde: [] })).tipo).toBe('sin-prospecto')
  })
})

describe('leads de la web', () => {
  it('en simulación: crea el prospecto con responsable y la cadencia entrante, sin enviarle nada, y avisa', async () => {
    const r = await va.prospectoDesdeLead({ id: 50, origen: 'autodiagnostico', nombre: 'Marta Gómez', empresa: 'Fibra Norte', correo: 'Marta@FibraNorte.co', mensaje: 'Quiero saber más', nit: '900.123.456-1' }, new Date('2026-11-12T15:00:00Z'))
    expect(r.accion).toBe('creado')
    const p = await prospecto(r.prospectoId!)
    expect(p).toMatchObject({ prioridad: 'E', campana: 'web', cadencia: 'entrante', cadencia_estado: 'activa', paso_cadencia: 0, automatico: 1,
      correo: 'marta@fibranorte.co', nit: '9001234561', estado: 'Respondió', origen_lead: 'autodiagnostico', lead_id: 50, notas: 'Quiero saber más' })
    expect(p.responsable_id).toBe('super')   // el que tiene menos prospectos de la web (empate: el más antiguo)
    expect(enviados.map(e => e.asunto)).toEqual(['🆕 Nuevo prospecto desde la web: Fibra Norte'])
  })

  it('en activo: le responde de inmediato y reparte al siguiente responsable', async () => {
    process.env.VENTAS_AUTOMATICAS = 'activo'
    const r = await va.prospectoDesdeLead({ id: 51, origen: 'contacto', nombre: 'Pedro', empresa: 'Conecta SAS', correo: 'pedro@conecta.co', mensaje: '¿Cuánto cuesta?' }, new Date('2026-11-12T15:00:00Z'))
    expect(r.envio?.resultado).toBe('enviado')
    const [c] = correosA('pedro@conecta.co')
    expect(c.asunto).toBe('Recibimos tu mensaje · Owl Compliance')
    expect(c.texto).toMatch(/^¡Hola, Pedro! Soy Adriana, de Owl Compliance\. Gracias por escribirnos/)
    expect(await prospecto(r.prospectoId!)).toMatchObject({ responsable_id: 'adri', paso_cadencia: 1, proxima_fecha: '2026-11-17' })
  })

  it('si ya es prospecto, no lo duplica: cuenta como respuesta; sin correo ni teléfono, o del webinar, no hace nada', async () => {
    const r = await va.prospectoDesdeLead({ id: 52, origen: 'contacto', correo: 'f@falla.co', mensaje: 'Hola de nuevo' })
    expect(r).toMatchObject({ accion: 'existente', prospectoId: 'falla' })
    expect((await prospecto('falla')).estado).toBe('Respondió')
    expect((await va.prospectoDesdeLead({ id: 53, origen: 'contacto', nombre: 'X' })).accion).toBe('omitido')
    expect((await va.prospectoDesdeLead({ id: 54, origen: 'webinar', correo: 'w@w.co' })).accion).toBe('omitido')
  })
})

describe('baja y ciclo', () => {
  it('el enlace de baja firmado da de baja; uno alterado no', async () => {
    const { darDeBaja } = await import('@/lib/baja-db')
    const { firmaBaja } = await import('@/lib/baja')
    expect(await darDeBaja('rebota', 'falsa')).toBe('invalido')
    expect(await darDeBaja('rebota', firmaBaja('rebota'))).toBe('ok')
    expect(await darDeBaja('rebota', firmaBaja('rebota'))).toBe('ya')
    expect(await prospecto('rebota')).toMatchObject({ baja: 1, estado: 'No contactar' })
  })

  it('el ciclo sin acceso al buzón alerta al superadmin una sola vez al día y registra el último ciclo', async () => {
    const ahora = new Date('2026-11-12T15:00:00Z')   // 10 a. m. en Bogotá
    const r1 = await va.cicloVentasAutomaticas(ahora)
    const r2 = await va.cicloVentasAutomaticas(ahora)
    expect(r1.errores[0]).toMatch(/^Buzón: GMAIL_USER/)
    expect(r2.errores).toHaveLength(1)
    expect(enviados.filter(e => e.asunto.startsWith('⚠ Ventas automáticas: no se pudo leer el buzón'))).toHaveLength(1)
    expect(enviados.filter(e => e.asunto.startsWith('🧪 Simulación'))).toHaveLength(1)   // el reporte de simulación, una vez al día
    expect((await va.estadoVentasAuto()).ultimoCiclo).toBe(ahora.toISOString())
  })

  it('la ruta pide el secreto interno', async () => {
    const route = await import('@/app/api/interno/ventas-automaticas/route')
    const sin = await route.GET(new Request('http://x/api/interno/ventas-automaticas') as any)
    expect(sin.status).toBe(401)
    const con = await route.GET(new Request('http://x/api/interno/ventas-automaticas', { headers: { authorization: 'Bearer secreto-de-prueba' } }) as any)
    expect(await con.json()).toMatchObject({ modo: 'simulacion' })
  })
})
