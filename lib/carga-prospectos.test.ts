/** Carga de bases de contactos desde Excel/CSV a Prospectos (superadmin). */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'
import JSZip from 'jszip'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'owl-carga-'))
process.env.DB_PATH = path.join(tmp, 'test.db')
delete process.env.TURSO_DATABASE_URL
delete process.env.TURSO_AUTH_TOKEN

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

let route: typeof import('@/app/api/superadmin/prospectos-importar/route')
let auth: any

/** .xlsx mínimo de verdad (zip con XML), con textos compartidos y uno en línea, y la hoja en un archivo con otro nombre. */
async function xlsx(filas: (string | number)[][]) {
  const compartidos: string[] = []
  const celda = (v: string | number, ref: string) => {
    if (typeof v === 'number') return `<c r="${ref}"><v>${v}</v></c>`
    if (v.startsWith('~')) return `<c r="${ref}" t="inlineStr"><is><t>${v.slice(1)}</t></is></c>`
    compartidos.push(v)
    return `<c r="${ref}" t="s"><v>${compartidos.length - 1}</v></c>`
  }
  const hoja = filas.map((f, i) => `<row r="${i + 1}">${f.map((v, j) => (v === '' ? '' : celda(v, String.fromCharCode(65 + j) + (i + 1)))).join('')}</row>`).join('')
  const zip = new JSZip()
  zip.file('xl/workbook.xml', `<workbook xmlns:r="r"><sheets><sheet name="Base" sheetId="1" r:id="rId7"/></sheets></workbook>`)
  zip.file('xl/_rels/workbook.xml.rels', `<Relationships><Relationship Id="rId7" Target="worksheets/hojaX.xml"/></Relationships>`)
  zip.file('xl/worksheets/hojaX.xml', `<worksheet><sheetData>${hoja}</sheetData></worksheet>`)
  zip.file('xl/sharedStrings.xml', `<sst>${compartidos.map(s => `<si><t>${s.replace(/&/g, '&amp;')}</t></si>`).join('')}</sst>`)
  return zip.generateAsync({ type: 'arraybuffer' })
}

const enviar = (archivo: File, campos: Record<string, string>) => {
  const fd = new FormData()
  fd.append('archivo', archivo)
  for (const [k, v] of Object.entries(campos)) fd.append(k, v)
  return route.POST(new Request('http://localhost/api/superadmin/prospectos-importar', { method: 'POST', body: fd }))
}

beforeAll(async () => {
  const { execute } = await import('@/lib/db')
  await execute(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, nombre TEXT, email TEXT, rol TEXT, is_superadmin INTEGER, created_at TEXT)`)
  await execute(`INSERT INTO users (id, nombre, rol, is_superadmin) VALUES ('jp', 'Super Administrador', 'admin', 1),
                 ('adri', 'Adriana Linares', 'admin', 0), ('david', 'David Osorio', 'admin', 0), ('cli', 'Cliente', 'cliente', 0)`)
  const { migrateProspectos } = await import('@/lib/prospectos-db')
  await migrateProspectos()
  await execute(`INSERT INTO prospectos_isp (id, puesto, prioridad, empresa, nit, correo, estado, responsable_id)
                 VALUES ('ya', 7, 'A', 'STARNET.NET S.A.S.', '901000731', NULL, 'WA1 enviado', 'adri')`)
  route = await import('@/app/api/superadmin/prospectos-importar/route')
  ;({ auth } = await import('@/lib/auth') as any)
  auth.mockResolvedValue({ user: { id: 'jp', is_superadmin: true } })
})

describe('lectura de archivos', () => {
  it('lee un .xlsx con la hoja en cualquier archivo, textos compartidos, en línea, números y celdas vacías', async () => {
    const { leerXlsx } = await import('@/lib/excel')
    const filas = await leerXlsx(await xlsx([['Empresa', 'Celular', 'Nota'], ['A & B Redes', 3001234567, ''], ['~Inline SAS', '', 'hola']]))
    expect(filas).toEqual([['Empresa', 'Celular', 'Nota'], ['A & B Redes', '3001234567'], ['Inline SAS', '', 'hola']])
  })

  it('reconoce los encabezados aunque cambien de nombre y de orden', async () => {
    const { detectarColumnas } = await import('@/lib/carga-prospectos')
    const c = detectarColumnas(['Nombre de la empresa', 'Contacto', 'E-mail', 'WhatsApp', 'Ciudad', 'Responsable Owl'])
    expect(c).toMatchObject({ empresa: 0, nombre: 1, correo: 2, telefono: 3, municipio: 4, nit: -1 })
  })
})

describe('/api/superadmin/prospectos-importar', () => {
  const base = async () => new File([await xlsx([
    ['ISP', 'Nombre', 'Correo', 'Celular', 'NIT'],
    ['Starnet.net SAS', 'Pedro', 'p@starnet.co', '3001112233', ''],          // ya está en Prospectos (por nombre)
    ['Redes del Sur', 'Ana', 'ana@sur.co', '3002223344', ''],
    ['Redes del Sur SAS', 'Luis', 'luis@sur.co', '3003334455', ''],          // misma empresa que Ana
    ['Fibra Norte', 'Eva', 'eva@norte.co', '3004445566', ''],
    ['Estudiante', 'Juan', 'juan@u.edu.co', '3005556677', ''],               // no parece ISP
    ['Otra Red', 'Repetido', 'ana@sur.co', '', ''],                          // correo repetido en el archivo
    ['', '', '', '', ''],
  ])], 'base.xlsx')

  it('solo el superadmin', async () => {
    auth.mockResolvedValueOnce({ user: { id: 'adri', is_superadmin: false } })
    expect((await enviar(await base(), { campana: 'Expo ISP 2026', responsables: 'adri' })).status).toBe(403)
  })

  it('valida campaña y responsables', async () => {
    expect((await enviar(await base(), { campana: 'x', responsables: 'adri' })).status).toBe(400)
    expect((await enviar(await base(), { campana: 'webinar', responsables: 'adri' })).status).toBe(400)
    expect((await enviar(await base(), { campana: 'Expo ISP 2026', responsables: 'cli' })).status).toBe(400)
    expect((await enviar(new File(['x'], 'base.xls'), { campana: 'Expo ISP 2026', responsables: 'adri' })).status).toBe(400)
  })

  it('la vista previa no escribe; muestra columnas, reparto, existentes y los que revisar', async () => {
    const r = await enviar(await base(), { campana: 'Expo ISP 2026', responsables: 'jp,adri,david' })
    const d: any = await r.json()
    expect(d.previa).toBe(true)
    expect(d.nuevos).toBe(4)
    expect(d.repetidas).toBe(1)
    expect(d.existentes).toEqual([expect.objectContaining({ empresa: 'STARNET.NET S.A.S.', responsable: 'Adriana Linares', estado: 'WA1 enviado' })])
    expect(d.revisarIcp).toBe(1)
    expect(d.porResponsable.map((p: any) => p.cantidad).reduce((a: number, b: number) => a + b)).toBe(4)
    expect(Math.max(...d.porResponsable.map((p: any) => p.cantidad))).toBe(2)   // Redes del Sur (2) a una sola persona
    const { queryOne } = await import('@/lib/db')
    expect(Number((await queryOne<any>(`SELECT COUNT(*) n FROM prospectos_isp`))!.n)).toBe(1)
  })

  it('al confirmar crea los prospectos con su campaña, responsable e historial', async () => {
    const d: any = await (await enviar(await base(), { campana: 'Expo ISP 2026', responsables: 'jp,adri,david', confirmar: '1' })).json()
    expect(d.cargados).toBe(4)
    const { queryAll } = await import('@/lib/db')
    const ps = await queryAll<any>(`SELECT * FROM prospectos_isp WHERE campana = 'Expo ISP 2026' ORDER BY puesto`)
    expect(ps.map(p => p.puesto)).toEqual([8, 9, 10, 11])
    expect(ps.every(p => p.estado === 'Pendiente' && p.prioridad === 'O' && p.responsable_id)).toBe(true)
    const sur = ps.filter(p => p.empresa.startsWith('Redes del Sur'))
    expect(new Set(sur.map(p => p.responsable_id)).size).toBe(1)
    expect(ps.find(p => p.empresa === 'Estudiante').revisar_icp).toBe(1)
    const h = await queryAll<any>(`SELECT nota FROM prospectos_isp_historial WHERE prospecto_id = ?`, [ps[0].id])
    expect(h[0].nota).toBe('Cargado desde "base.xlsx" (campaña Expo ISP 2026)')
  })

  it('volver a subir el mismo archivo no duplica nada', async () => {
    const d: any = await (await enviar(await base(), { campana: 'Expo ISP 2026', responsables: 'jp,adri,david', confirmar: '1' })).json()
    expect(d.cargados).toBe(0)
    expect(d.existentes).toHaveLength(5)
  })

  it('también acepta CSV', async () => {
    const csv = new File(['empresa;nombre;telefono\nNueva Red;Zoe;3009998877\n'], 'otra.csv')
    const d: any = await (await enviar(csv, { campana: 'Base CSV', responsables: 'david' })).json()
    expect(d.nuevos).toBe(1)
    expect(d.porResponsable).toEqual([{ id: 'david', nombre: 'David Osorio', cantidad: 1 }])
  })
})
