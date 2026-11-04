/** Buscar el NIT de un prospecto en el listado RUTIC. */
import { describe, it, expect } from 'vitest'
import { indexarRutic, decidirNit } from './rutic.mjs'
import { leerXlsx } from './excel'
import JSZip from 'jszip'

const ENC = ['No. Expediente', 'No. Identificación', 'Razón Social', 'Correo Electrónico', 'Dirección de Notificación', 'Municipio', 'Departamento', 'Estado',
  'Fecha RTIC', 'Nombre del representante legal', 'Tipo de identificación', 'NUI  del representante legal', 'Teléfono  del representante legal', 'Correo  del representante legal']
const fila = (nit: string, razon: string, correo = '', estado = 'Vigente', correoRep = '') =>
  ['1', nit, razon, correo, '', '', '', estado, '', '', '', '', '', correoRep]

const idx = indexarRutic([ENC,
  fila('901420524', 'CONEXION DIGITAL COLOMBIA S.A.S.', 'info@condigital.co'),
  fila('901776374', 'CONEXION DIGITAL-TECNOLOGIAS Y SERVICIOS S.A.S.'),
  fila('900356400', 'SERVICIOS PROFESIONALES WICOM S.A.S', 'admin@wicomsas.com', 'Vigente', 'rep@wicom.co'),
  fila('901586432', 'TELFLY S.A.S.', 'telfly@hotmail.com'),
  fila('900932336', 'G&A GRUPO EMPRESARIAL S.A.S', 'telfly@hotmail.com'),
  fila('901111111', 'REDES DEL SUR SAS', '', 'Cancelado'),
  fila('902222222', 'REDES DEL SUR S.A.S.', '', 'Vigente'),
  fila('903333333', 'ORION TELECOMUNICACIONES.COM SAS', 'ocagua@gmail.com'),
  fila('904444444', 'FIBRA S.A.S', ''),
  fila('905555555', 'INTERSECTOR S.A.S', ''),
])

describe('decidirNit', () => {
  it('por nombre, ignorando mayúsculas, puntos y S.A.S.', () => {
    expect(decidirNit({ empresa: 'Intersector' }, idx)).toMatchObject({ tipo: 'nombre', nit: '905555555', razon: 'INTERSECTOR S.A.S' })
  })
  it('por nombre y correo cuando los dos coinciden', () => {
    expect(decidirNit({ empresa: 'Servicios Profesionales WICOM SAS', correo: 'ADMIN@wicomsas.com ' }, idx)).toMatchObject({ tipo: 'nombre+correo', nit: '900356400' })
    // También con el correo del representante legal y con el de quien se inscribió al webinar.
    expect(decidirNit({ empresa: 'WICOM SAS', webinar_correo: 'rep@wicom.co' }, idx)).toMatchObject({ tipo: 'correo', nit: '900356400' })
  })
  it('un correo de otra empresa no se impone al nombre: conflicto, sin NIT', () => {
    // Ese correo figura en dos empresas, así que no sirve para decidir: manda el nombre.
    expect(decidirNit({ empresa: 'Telfly', correo: 'telfly@hotmail.com' }, idx)).toMatchObject({ tipo: 'nombre', nit: '901586432' })
    const c = decidirNit({ empresa: 'Telfly SAS', correo: 'ocagua@gmail.com' }, idx)
    expect(c.tipo).toBe('conflicto')
    expect(c.nit).toBeUndefined()
  })
  it('un correo que está en dos empresas distintas es ambiguo y no se escoge', () => {
    const d = decidirNit({ empresa: 'Nombre que no existe', correo: 'telfly@hotmail.com' }, idx)
    expect(d.tipo).toBe('ambiguo')
    expect(d.nit).toBeUndefined()
  })
  it('dos empresas con el mismo nombre: solo se escoge si una sola está vigente', () => {
    expect(decidirNit({ empresa: 'Redes del Sur' }, idx)).toMatchObject({ tipo: 'nombre', nit: '902222222' })
  })
  it('un nombre genérico o corto no vale por sí solo; con el correo sí', () => {
    expect(decidirNit({ empresa: 'Fibra' }, idx).tipo).toBe('ninguno')
    expect(decidirNit({ empresa: 'Fibra', correo: 'ocagua@gmail.com' }, idx)).toMatchObject({ tipo: 'correo', nit: '903333333' })
    expect(decidirNit({ empresa: 'Na' }, idx).tipo).toBe('ninguno')
  })
  it('sin coincidencia propone nombres parecidos pero nunca los aplica', () => {
    const d = decidirNit({ empresa: 'Conexion Digital' }, idx)
    expect(d.tipo).toBe('ninguno')
    expect(d.sugerencias.map((s: any) => s.nit).sort()).toEqual(['901420524', '901776374'])
    expect(d.nit).toBeUndefined()
  })
})

describe('leer el archivo del RUTIC', () => {
  it('reconoce los encabezados reales y se salta filas sin NIT', () => {
    const i = indexarRutic([ENC, fila('', 'SIN NIT'), fila('900.316.360', 'ASOCIACION COMUNITARIA DE TELEVIDENTES')])
    expect(i.total).toBe(1)
    expect(i.porNombre.get('asociacioncomunitariadetelevidentes')[0].nit).toBe('900316360')
    expect(() => indexarRutic([['a', 'b'], ['1', '2']])).toThrow(/No\. Identificación/)
  })

  it('lee un .xlsx con la hoja del RUTIC', async () => {
    const zip = new JSZip()
    zip.file('xl/sharedStrings.xml', '<sst><si><t>No. Identificación</t></si><si><t>Razón Social</t></si><si><t>REDES &amp; CÍA SAS</t></si></sst>')
    zip.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
      '<row r="2"><c r="A2" t="inlineStr"><is><t>901000731</t></is></c><c r="B2" t="s"><v>2</v></c></row></sheetData></worksheet>')
    const filas = await leerXlsx(await zip.generateAsync({ type: 'arraybuffer' }))
    expect(decidirNit({ empresa: 'Redes & Cía S.A.S' }, indexarRutic(filas))).toMatchObject({ tipo: 'nombre', nit: '901000731' })
  })
})
