/**
 * lib/radiografias.ts
 * Radiografías regulatorias (PDF de una página por ISP) guardadas en la base de datos, una por prospecto, para
 * que quien contacta la descargue desde la ficha y la adjunte en WhatsApp. Se guardan en la BD (y no en disco)
 * para que sobrevivan a los despliegues. Las sube el superadmin en lote: cada PDF se empareja con su prospecto
 * por el NIT del nombre del archivo o, si no lo trae, por el nombre de la empresa.
 */
import { queryAll, queryOne, execute } from './db'
import { migrateProspectos, migrateRadiografiasTabla } from './prospectos-db'
import { normEmpresa } from './reparto.mjs'

export const MAX_BYTES_PDF = 3 * 1024 * 1024
/** El generador recorta a 50 caracteres el nombre del archivo (generar.py: nom[:50]). */
const LARGO_RECORTE = 50

export const migrateRadiografias = migrateRadiografiasTabla

/** Lo que dice el nombre de un PDF: "Radiografia_900860597_WINETS_S_A_S_.pdf" o "Radiografia_WINETS_S_A_S_.pdf". */
export function leerNombreArchivo(archivo: string) {
  const sin = archivo.replace(/\.pdf$/i, '').replace(/^.*[\\/]/, '').replace(/^radiograf[ií]a[\s_-]*/i, '')
  const nit = sin.match(/^(\d{8,10})(?:[\s_-]+|$)/)?.[1] ?? null
  const nombre = nit ? sin.slice(nit.length).replace(/^[\s_-]+/, '') : sin
  return { nit, nombre, clave: normEmpresa(nombre.replace(/_/g, ' ')), recortado: nombre.length >= LARGO_RECORTE }
}

/** El generador reemplaza todo lo que no sea A-Z, a-z o 0-9 por "_": "NARIÑO" queda "NARI_O". */
const comoLoEscribeElGenerador = (empresa: string) => normEmpresa(empresa.replace(/[^A-Za-z0-9]+/g, ' '))

interface Candidato { id: string; empresa: string; nit: string | null }
const digitos = (s?: string | null) => (s ?? '').replace(/\D/g, '')

export interface Pareja {
  archivo: string
  /** Prospectos a los que se asocia (una empresa puede tener varias filas: una por contacto). */
  ids: string[]
  por: 'nit' | 'nombre' | null
  nit: string | null
}

/** Empareja cada archivo con los prospectos de su empresa. Sin pareja → ids vacío. */
export function emparejar(archivos: string[], prospectos: Candidato[]): Pareja[] {
  const claves = prospectos.map(p => ({ p, a: normEmpresa(p.empresa), b: comoLoEscribeElGenerador(p.empresa), nit: digitos(p.nit) }))
  return archivos.map(archivo => {
    const f = leerNombreArchivo(archivo)
    // Un nombre igual sirve aunque sea corto (Ixp, VCC, ERT son empresas reales); un nombre recortado por el generador
    // solo se compara por el principio y exige 4 letras para no confundir empresas.
    const mismo = (k: string) => (f.recortado ? f.clave.length >= 4 && k.startsWith(f.clave) : k === f.clave)
    const porNombre = f.clave.length >= 2
      // Si el archivo trae NIT, una fila con otro NIT es otra empresa aunque se llame parecido.
      ? claves.filter(c => (mismo(c.a) || mismo(c.b)) && (!f.nit || !c.nit || c.nit === f.nit))
      : []
    if (f.nit) {
      const porNit = claves.filter(c => c.nit && c.nit === f.nit)
      if (porNit.length) {
        // La misma empresa puede tener otra fila todavía sin NIT (otro contacto): esa también recibe su radiografía.
        const ids = [...new Set([...porNit, ...porNombre.filter(c => !c.nit)].map(c => c.p.id))]
        return { archivo, ids, por: 'nit' as const, nit: f.nit }
      }
    }
    const ids = porNombre.map(c => c.p.id)
    return { archivo, ids, por: ids.length ? 'nombre' as const : null, nit: f.nit }
  })
}

export async function candidatos(): Promise<Candidato[]> {
  await migrateProspectos()
  return queryAll<Candidato>(`SELECT id, empresa, nit FROM prospectos_isp`)
}

/** Guarda (o reemplaza) la radiografía de un prospecto. */
export async function guardarRadiografia(prospectoId: string, archivo: string, contenido: Uint8Array, userId: string | null) {
  await migrateRadiografias()
  await execute(
    `INSERT INTO radiografias (prospecto_id, archivo, contenido, bytes, subido_por) VALUES (?,?,?,?,?)
     ON CONFLICT(prospecto_id) DO UPDATE SET archivo = excluded.archivo, contenido = excluded.contenido,
       bytes = excluded.bytes, subido_en = datetime('now'), subido_por = excluded.subido_por`,
    [prospectoId, archivo, contenido, contenido.byteLength, userId])
}

export async function obtenerRadiografia(prospectoId: string): Promise<{ archivo: string; contenido: Uint8Array; subido_en: string } | null> {
  await migrateRadiografias()
  const r: any = await queryOne(`SELECT archivo, contenido, subido_en FROM radiografias WHERE prospecto_id = ?`, [prospectoId])
  if (!r) return null
  return { archivo: r.archivo, contenido: new Uint8Array(r.contenido as ArrayBuffer), subido_en: r.subido_en }
}

/** ¿Es un PDF de verdad? (empieza con %PDF) */
export const esPdf = (b: Uint8Array) => b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46
