/**
 * lib/carga-prospectos.ts
 * Carga de una base de contactos (Excel o CSV) a Prospectos desde el superadmin: reconoce las columnas,
 * descarta los que ya están en Prospectos, reparte el resto en partes iguales entre los responsables
 * elegidos (los de una misma empresa con la misma persona) y los crea en estado Pendiente con su campaña.
 * La vista previa y la carga hacen el mismo cálculo, así que lo que se ve es lo que se carga.
 */
import crypto from 'crypto'
import { db, queryAll, queryOne } from './db'
import { migrateProspectos } from './prospectos-db'
import { repartir, revisarIcp, corregirNitEnEmpresa, coincideConProspecto, sinTildes } from './reparto.mjs'

export const MAX_FILAS = 5000

/** Encabezados que se reconocen para cada campo (sin tildes, en minúscula; basta con que el encabezado los contenga). */
const COLUMNAS: Record<string, string[]> = {
  empresa:      ['empresa', 'isp', 'razon social', 'razon', 'operador', 'compan'],
  // Sin "responsable": en estas bases suele ser el vendedor de Owl, no el contacto.
  nombre:       ['nombre', 'contacto', 'representante'],
  correo:       ['correo', 'email', 'e-mail', 'mail'],
  telefono:     ['celular', 'telefono', 'whatsapp', 'movil', 'phone', 'tel'],
  nit:          ['nit'],
  municipio:    ['municipio', 'ciudad'],
  departamento: ['departamento', 'depto'],
  notas:        ['nota', 'observacion', 'comentario'],
}
export type Campo = keyof typeof COLUMNAS

export const CAMPAÑAS_RESERVADAS = ['cold-mailing', 'webinar']

/** Índice de la columna de cada campo en la fila de encabezados (-1 si no está). */
export function detectarColumnas(encabezados: string[]): Record<Campo, number> {
  const enc = encabezados.map(sinTildes)
  const usados = new Set<number>()
  const out = {} as Record<Campo, number>
  // "empresa" antes que "nombre": "nombre de la empresa" es empresa, no contacto.
  for (const campo of Object.keys(COLUMNAS) as Campo[]) {
    const i = enc.findIndex((h, j) => !usados.has(j) && COLUMNAS[campo].some(k => h === k || h.includes(k)))
    out[campo] = i
    if (i >= 0) usados.add(i)
  }
  return out
}

export interface Registro {
  clave: string; fila: number
  nombre: string; empresa: string; correo: string; telefono: string; nit: string
  municipio: string; departamento: string; notas: string
  icp: boolean
  // Para el reparto (lib/reparto.mjs): todos cuentan igual.
  asistio: false; minutos: null
}

/** Convierte las filas del archivo en registros limpios. Descarta vacías y correos repetidos dentro del archivo. */
export function leerRegistros(filas: string[][]) {
  if (!filas.length) throw new Error('El archivo está vacío')
  const columnas = detectarColumnas(filas[0])
  if (columnas.empresa < 0 && columnas.nombre < 0) throw new Error('No encuentro una columna de empresa ni de nombre. Revise los encabezados de la primera fila.')
  if (columnas.correo < 0 && columnas.telefono < 0) throw new Error('No encuentro una columna de correo ni de teléfono/celular.')
  if (filas.length - 1 > MAX_FILAS) throw new Error(`El archivo tiene ${filas.length - 1} filas; el máximo por carga es ${MAX_FILAS}.`)

  const val = (f: string[], c: Campo) => (columnas[c] >= 0 ? (f[columnas[c]] ?? '').trim() : '')
  const registros: Registro[] = []
  const correos = new Set<string>()
  let vacias = 0, repetidas = 0
  filas.slice(1).forEach((f, n) => {
    const nombre = val(f, 'nombre'), correo = val(f, 'correo').toLowerCase()
    const corregido = corregirNitEnEmpresa(val(f, 'empresa'), nombre)
    const empresa = corregido.empresa || ''
    if (!empresa && !nombre && !correo && !val(f, 'telefono')) { vacias++; return }
    if (correo && correos.has(correo)) { repetidas++; return }
    if (correo) correos.add(correo)
    registros.push({
      clave: `f${n + 2}`, fila: n + 2, nombre, empresa, correo, telefono: val(f, 'telefono'),
      nit: val(f, 'nit').replace(/\D/g, '') || corregido.nit, municipio: val(f, 'municipio'),
      departamento: val(f, 'departamento'), notas: val(f, 'notas'),
      icp: revisarIcp(empresa, nombre), asistio: false, minutos: null,
    })
  })
  return { columnas, registros, vacias, repetidas }
}

export interface PlanCarga {
  columnas: Record<Campo, number>
  encabezados: string[]
  nuevos: (Registro & { responsable: string })[]
  existentes: { registro: Registro; empresa: string; responsable: string | null; estado: string }[]
  vacias: number
  repetidas: number
  porResponsable: { id: string; nombre: string; cantidad: number }[]
}

/** Calcula qué se cargaría y a quién, sin escribir nada. */
export async function planificarCarga(filas: string[][], responsables: string[]): Promise<PlanCarga> {
  await migrateProspectos()
  if (!responsables.length) throw new Error('Elija al menos un responsable')
  const usuarios = await queryAll<{ id: string; nombre: string }>(
    `SELECT id, nombre FROM users WHERE id IN (${responsables.map(() => '?').join(',')}) AND (rol = 'admin' OR is_superadmin = 1)`,
    responsables)
  if (usuarios.length !== new Set(responsables).size) throw new Error('Alguno de los responsables no es un administrador válido')

  const { columnas, registros, vacias, repetidas } = leerRegistros(filas)
  const actuales = await queryAll<any>(`
    SELECT p.id, p.empresa, p.nit, p.correo, p.webinar_correo, p.estado, u.nombre AS responsable
    FROM prospectos_isp p LEFT JOIN users u ON u.id = p.responsable_id`)
  const existentes: PlanCarga['existentes'] = []
  const porCargar: Registro[] = []
  for (const r of registros) {
    const p = actuales.find(a => coincideConProspecto(r, a) || (r.correo && String(a.webinar_correo ?? '').toLowerCase() === r.correo))
    if (p) existentes.push({ registro: r, empresa: p.empresa, responsable: p.responsable ?? null, estado: p.estado })
    else porCargar.push(r)
  }
  const reparto: Map<string, string> = repartir(porCargar, responsables)
  const nuevos = porCargar.map(r => ({ ...r, responsable: reparto.get(r.clave)! }))
  const porResponsable = usuarios.map(u => ({ id: u.id, nombre: u.nombre, cantidad: nuevos.filter(n => n.responsable === u.id).length }))
  return { columnas, encabezados: filas[0], nuevos, existentes, vacias, repetidas, porResponsable }
}

export function validarCampana(nombre: unknown): string {
  const c = String(nombre ?? '').trim().replace(/\s+/g, ' ')
  if (c.length < 3 || c.length > 60) throw new Error('Ponga un nombre de campaña de 3 a 60 caracteres (ej.: "Expo ISP 2026")')
  if (CAMPAÑAS_RESERVADAS.includes(sinTildes(c))) throw new Error(`"${c}" es un nombre reservado; use otro`)
  return c
}

/** Crea los prospectos del plan en estado Pendiente y deja constancia en su historial. */
export async function ejecutarCarga(plan: PlanCarga, opciones: { campana: string; archivo: string; userId: string }) {
  if (!plan.nuevos.length) return { cargados: 0 }
  const base = Number((await queryOne<any>(`SELECT COALESCE(MAX(puesto), 0) AS m FROM prospectos_isp`))?.m ?? 0)
  const nota = `Cargado desde "${opciones.archivo}" (campaña ${opciones.campana})`
  const stmts = plan.nuevos.flatMap((r, i) => {
    const id = crypto.randomUUID()
    return [
      {
        sql: `INSERT INTO prospectos_isp (id, puesto, prioridad, empresa, nit, representante, telefono, correo, municipio, departamento,
                notas, estado, responsable_id, campana, revisar_icp)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [id, base + i + 1, 'O', r.empresa || r.nombre || r.correo || r.telefono, r.nit || null, r.nombre || null,
          r.telefono || null, r.correo || null, r.municipio || null, r.departamento || null, r.notas || null,
          'Pendiente', r.responsable, opciones.campana, r.icp ? 1 : 0],
      },
      {
        sql: `INSERT INTO prospectos_isp_historial (id, prospecto_id, estado_anterior, estado_nuevo, user_id, nota) VALUES (?,?,?,?,?,?)`,
        args: [crypto.randomUUID(), id, null, 'Pendiente', opciones.userId, nota],
      },
    ]
  })
  // De a 200 sentencias por lote: cada lote se escribe completo o no se escribe.
  for (let i = 0; i < stmts.length; i += 200) await db.batch(stmts.slice(i, i + 200), 'write')
  return { cargados: plan.nuevos.length }
}
