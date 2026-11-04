/** Radiografías en PDF: emparejar archivos con prospectos, cargarlas (superadmin) y descargarlas con permisos. */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'
import { NextRequest } from 'next/server'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'owl-radiografias-'))
process.env.DB_PATH = path.join(tmp, 'test.db')
delete process.env.TURSO_DATABASE_URL
delete process.env.TURSO_AUTH_TOKEN

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))


// Importa después de apuntar a la BD temporal: un import estático se ejecutaría antes y usaría data/owl.db.
const { leerNombreArchivo, emparejar } = await import('./radiografias')

const SUPER = { id: 'jp', role: 'admin', is_superadmin: true }
const ADRI = { id: 'adri', role: 'admin', is_superadmin: false }
const DAVID = { id: 'david', role: 'admin', is_superadmin: false }

const pdf = (texto: string) => new TextEncoder().encode(`%PDF-1.4\n${texto}\n%%EOF`)
const archivo = (nombre: string, bytes: Uint8Array = pdf(nombre)) => new File([bytes as unknown as BlobPart], nombre, { type: 'application/pdf' })

describe('nombre del archivo', () => {
  it('lee el NIT cuando lo trae y el nombre de la empresa', () => {
    expect(leerNombreArchivo('Radiografia_900860597_WINETS_S_A_S_.pdf')).toMatchObject({ nit: '900860597', nombre: 'WINETS_S_A_S_', recortado: false })
    expect(leerNombreArchivo('Radiografia_WINETS_S_A_S_.pdf')).toMatchObject({ nit: null, nombre: 'WINETS_S_A_S_' })
    expect(leerNombreArchivo('C:\\Descargas\\Radiografia_3_SISTEMAS_SAS.pdf').nit).toBeNull()   // un 3 al inicio no es un NIT
    expect(leerNombreArchivo('Radiografia_' + 'A'.repeat(50) + '.pdf').recortado).toBe(true)
  })
})

describe('emparejar archivos con prospectos', () => {
  const prospectos = [
    { id: 'p1', empresa: 'WINETS S.A.S.', nit: '900860597' },
    { id: 'p2', empresa: 'COMUNICACIONES DEL NARIÑO SAS', nit: null },
    { id: 'p3', empresa: 'Santelellano sas', nit: null },
    { id: 'p4', empresa: 'SANTELELLANO S.A.S.', nit: null },
    { id: 'p5', empresa: 'INGENIERIA ESPECIALIZADA EN COMUNICACIONES Y SERVICIOS DE TELECOMUNICACIONES S.A.S', nit: '800111222' },
    { id: 'p6', empresa: 'Red', nit: null },
  ]
  const una = (nombre: string) => emparejar([nombre], prospectos)[0]

  it('por NIT, aunque el nombre no se parezca', () => {
    expect(una('Radiografia_900860597_OTRO_NOMBRE.pdf')).toMatchObject({ ids: ['p1'], por: 'nit' })
  })
  it('por nombre, ignorando mayúsculas, puntos y S.A.S.', () => {
    expect(una('Radiografia_WINETS_S_A_S_.pdf')).toMatchObject({ ids: ['p1'], por: 'nombre' })
  })
  it('con la Ñ como la escribe el generador ("NARI_O")', () => {
    expect(una('Radiografia_COMUNICACIONES_DEL_NARI_O_SAS.pdf').ids).toEqual(['p2'])
  })
  it('una empresa con varias filas (una por contacto) las recibe todas', () => {
    expect(una('Radiografia_SANTELELLANO_SAS.pdf').ids.sort()).toEqual(['p3', 'p4'])
  })
  it('nombres largos que el generador recortó a 50 caracteres', () => {
    const nombre = 'INGENIERIA_ESPECIALIZADA_EN_COMUNICACIONES_Y_SERVICIOS_DE_TELECOMUNICACIONES_S_A_S'.slice(0, 50)
    expect(una(`Radiografia_${nombre}.pdf`).ids).toEqual(['p5'])
  })
  it('sin pareja cuando no hay empresa parecida', () => {
    expect(una('Radiografia_EMPRESA_QUE_NO_EXISTE.pdf')).toMatchObject({ ids: [], por: null })
    expect(una('Radiografia_X.pdf').ids).toEqual([])   // una sola letra no identifica a nadie
  })
  it('nombres cortos que son la empresa completa (Red, Ixp, VCC) sí se emparejan, pero un nombre recortado necesita 4 letras', () => {
    expect(una('Radiografia_RED.pdf').ids).toEqual(['p6'])
    expect(emparejar(['Radiografia_Ixp.pdf', 'Radiografia_900111222_VCC.pdf'], [{ id: 'a', empresa: 'Ixp', nit: null }, { id: 'b', empresa: 'VCC', nit: null }]).map(p => p.ids))
      .toEqual([['a'], ['b']])
    const largo = 'AB' + 'X'.repeat(48)
    expect(emparejar([`Radiografia_${largo}.pdf`], [{ id: 'c', empresa: 'AB', nit: null }])[0].ids).toEqual([])
  })
  it('la misma empresa con una fila con NIT y otra sin NIT: las dos reciben la radiografía; una con otro NIT no', () => {
    const filas = [
      { id: 't1', empresa: 'TELFLY S.A.S', nit: '901586432' },
      { id: 't2', empresa: 'TELFLY', nit: null },
      { id: 't3', empresa: 'Telfly', nit: '900932336' },   // otra empresa con el mismo nombre
    ]
    expect(emparejar(['Radiografia_901586432_TELFLY_S_A_S.pdf'], filas)[0]).toMatchObject({ por: 'nit', ids: ['t1', 't2'] })
    // Sin fila con ese NIT, el nombre decide, pero no se le da a una fila de otro NIT.
    expect(emparejar(['Radiografia_555555555_TELFLY.pdf'], filas)[0].ids).toEqual(['t2'])
  })
})

describe('carga y descarga', () => {
  let cargar: typeof import('@/app/api/superadmin/radiografias/route')
  let descargar: typeof import('@/app/api/prospectos/radiografia/route')
  let lista: typeof import('@/app/api/prospectos/route')
  let auth: any

  const previa = (archivos: string[]) => cargar.POST(new Request('http://localhost/api/superadmin/radiografias', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archivos }) }))
  const subir = (...fs: File[]) => { const fd = new FormData(); fs.forEach(f => fd.append('archivos', f))
    return cargar.POST(new Request('http://localhost/api/superadmin/radiografias', { method: 'POST', body: fd })) }
  const bajar = (id: string) => descargar.GET(new NextRequest(`http://localhost/api/prospectos/radiografia?id=${id}`))

  beforeAll(async () => {
    const { execute } = await import('@/lib/db')
    await execute(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, nombre TEXT, email TEXT, is_superadmin INTEGER, created_at TEXT)`)
    await execute(`INSERT INTO users (id, nombre, email) VALUES ('adri', 'Adriana Linares', 'a@owl.co'), ('david', 'David Osorio', 'd@owl.co')`)
    const { migrateProspectos } = await import('@/lib/prospectos-db')
    await migrateProspectos()
    await execute(`INSERT INTO prospectos_isp (id, puesto, prioridad, empresa, nit, estado, responsable_id) VALUES
      ('w1', 1, 'C1', 'WINETS S.A.S.', '900860597', 'Pendiente', 'adri'),
      ('m1', 2, 'W', 'Meganetwork SAS', NULL, 'Pendiente', 'adri'),
      ('m2', 3, 'W', 'MEGANETWORK S.A.S.', NULL, 'Pendiente', 'david'),
      ('s1', 4, 'W', 'Sisteco SAS', NULL, 'Pendiente', 'david')`)
    cargar = await import('@/app/api/superadmin/radiografias/route')
    descargar = await import('@/app/api/prospectos/radiografia/route')
    lista = await import('@/app/api/prospectos/route')
    ;({ auth } = await import('@/lib/auth') as any)
    auth.mockResolvedValue({ user: SUPER })
  })

  it('solo el superadmin carga', async () => {
    auth.mockResolvedValueOnce({ user: ADRI })
    expect((await previa(['Radiografia_WINETS_S_A_S_.pdf'])).status).toBe(403)
    auth.mockResolvedValueOnce({ user: ADRI })
    expect((await subir(archivo('Radiografia_WINETS_S_A_S_.pdf'))).status).toBe(403)
  })

  it('la vista previa muestra qué archivo va a qué empresa y no guarda nada', async () => {
    const d: any = await (await previa(['Radiografia_WINETS_S_A_S_.pdf', 'Radiografia_MEGANETWORK_SAS.pdf', 'Radiografia_NADIE.pdf'])).json()
    expect(d).toMatchObject({ previa: true, conPareja: 2, sinPareja: ['Radiografia_NADIE.pdf'], variasFilas: 1 })
    expect(d.parejas[1].empresas.sort()).toEqual(['MEGANETWORK S.A.S.', 'Meganetwork SAS'])
    expect(((await (await lista.GET()).json()) as any).prospectos.every((p: any) => !p.radiografia_en)).toBe(true)
  })

  it('guarda cada PDF en todas las filas de su empresa, rechaza lo que no es PDF y avisa lo que no tiene pareja', async () => {
    const malo = archivo('Radiografia_SISTECO_SAS.pdf', new TextEncoder().encode('esto no es un pdf'))
    const d: any = await (await subir(archivo('Radiografia_900860597_WINETS.pdf'), archivo('Radiografia_MEGANETWORK_SAS.pdf'), archivo('Radiografia_NADIE.pdf'), malo)).json()
    expect(d).toMatchObject({ ok: true, guardados: 2, sinPareja: ['Radiografia_NADIE.pdf'], rechazados: [{ archivo: 'Radiografia_SISTECO_SAS.pdf', motivo: 'No es un PDF' }] })
    const ps = ((await (await lista.GET()).json()) as any).prospectos
    expect(ps.filter((p: any) => p.radiografia_en).map((p: any) => p.id).sort()).toEqual(['m1', 'm2', 'w1'])
  })

  it('un PDF muy pesado se rechaza y no más de 12 por envío', async () => {
    const grande = archivo('Radiografia_SISTECO_SAS.pdf', new Uint8Array(3 * 1024 * 1024 + 10).fill(0x20).map((v, i) => (i < 4 ? [0x25, 0x50, 0x44, 0x46][i] : v)))
    expect(((await (await subir(grande)).json()) as any).rechazados[0].motivo).toBe('Pesa más de 3 MB')
    expect((await subir(...Array.from({ length: 13 }, (_, i) => archivo(`Radiografia_X${i}.pdf`)))).status).toBe(400)
  })

  it('el NIT del nombre del archivo se le deja a la fila que no lo tenía', async () => {
    const { queryOne } = await import('@/lib/db')
    await subir(archivo('Radiografia_800123456_MEGANETWORK_SAS.pdf'))   // sin pareja por NIT: cae al nombre y completa el NIT
    expect((await queryOne<any>(`SELECT nit FROM prospectos_isp WHERE id = 'm1'`))!.nit).toBe('800123456')
  })

  it('cada admin descarga solo la radiografía de sus prospectos; el superadmin, todas', async () => {
    auth.mockResolvedValue({ user: ADRI })
    const ok = await bajar('w1')
    expect(ok.status).toBe(200)
    expect(ok.headers.get('Content-Type')).toBe('application/pdf')
    expect(ok.headers.get('Content-Disposition')).toBe('attachment; filename="Radiografia_WINETS_S_A_S_.pdf"')
    expect(new TextDecoder().decode(new Uint8Array(await ok.arrayBuffer()))).toContain('%PDF-1.4')
    expect((await bajar('m2')).status).toBe(403)          // es de David
    auth.mockResolvedValue({ user: DAVID })
    expect((await bajar('m2')).status).toBe(200)
    auth.mockResolvedValue({ user: SUPER })
    expect((await bajar('m1')).status).toBe(200)
    expect((await bajar('s1')).status).toBe(404)          // existe, pero sin radiografía
    auth.mockResolvedValue({ user: { id: 'c', role: 'cliente' } })
    expect((await bajar('w1')).status).toBe(403)
    auth.mockResolvedValue({ user: SUPER })
  })

  it('volver a cargar reemplaza la radiografía y actualiza la fecha', async () => {
    const { queryOne } = await import('@/lib/db')
    await subir(archivo('Radiografia_900860597_WINETS.pdf', pdf('VERSION NUEVA')))
    const r = await bajar('w1')
    expect(new TextDecoder().decode(new Uint8Array(await r.arrayBuffer()))).toContain('VERSION NUEVA')
    expect(Number((await queryOne<any>(`SELECT COUNT(*) n FROM radiografias WHERE prospecto_id = 'w1'`))!.n)).toBe(1)
  })
})
