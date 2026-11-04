/**
 * lib/rutic.mjs
 * Busca el NIT de un prospecto en el listado RUTIC del MinTIC ("ISP RUTIC - <fecha>.xlsx"): primero por el nombre de la
 * empresa y, si el nombre no sirve o no aparece, por el correo. Solo da un NIT cuando es único; si hay dudas lo dice
 * (ambiguo, conflicto) y no escoge. Lógica pura: la usa scripts/nit-desde-rutic.mjs.
 */
import { normEmpresa, claveGrupo, sinTildes } from './reparto.mjs'

const digitos = s => (s ?? '').toString().replace(/\D/g, '')

/** Indexa las filas del RUTIC (la primera fila son los encabezados) por nombre de empresa y por correo. */
export function indexarRutic(filas) {
  const enc = filas[0].map(sinTildes)
  const col = f => enc.findIndex(f)
  const iNit = col(h => h.startsWith('no. identificacion'))
  const iRazon = col(h => h.includes('razon social'))
  const iCorreo = col(h => h === 'correo electronico')
  const iCorreoRep = col(h => h.includes('correo') && h.includes('representante'))
  const iEstado = col(h => h === 'estado')
  if (iNit < 0 || iRazon < 0) throw new Error('No encuentro las columnas "No. Identificación" y "Razón Social" en el archivo del RUTIC')

  const porNombre = new Map(), porCorreo = new Map(), nombres = []
  const guardar = (mapa, k, e) => { if (!k) return; if (!mapa.has(k)) mapa.set(k, []); mapa.get(k).push(e) }
  for (const f of filas.slice(1)) {
    const nit = digitos(f[iNit])
    if (!nit || !f[iRazon]) continue
    const e = { nit, razon: String(f[iRazon]).trim(), estado: sinTildes(f[iEstado]) }
    const llave = normEmpresa(e.razon)
    guardar(porNombre, llave, e)
    nombres.push({ llave, e })
    for (const c of [iCorreo, iCorreoRep]) guardar(porCorreo, String(f[c] ?? '').trim().toLowerCase(), e)
  }
  return { porNombre, porCorreo, nombres, total: nombres.length }
}

/** El NIT de una lista de coincidencias, si es uno solo (o si solo uno de ellos está vigente). */
function nitUnico(lista) {
  const nits = [...new Set(lista.map(e => e.nit))]
  if (nits.length === 1) return nits[0]
  const vigentes = [...new Set(lista.filter(e => e.estado === 'vigente').map(e => e.nit))]
  return vigentes.length === 1 ? vigentes[0] : null
}

/**
 * p: { empresa, correo, webinar_correo }.
 * Devuelve { tipo, nit?, razon?, candidatos?, sugerencias? }; solo 'nombre', 'nombre+correo' y 'correo' traen NIT para aplicar.
 */
export function decidirNit(p, idx) {
  const llave = normEmpresa(p.empresa)
  // Un nombre genérico ("Fibra", "Internet") o muy corto puede ser de cualquiera: ahí solo vale el correo.
  const confiable = llave.length >= 6 && !claveGrupo({ empresa: p.empresa, nombre: '', clave: 'x' }).startsWith('fila:')
  const porNombre = confiable ? idx.porNombre.get(llave) ?? [] : []
  const correos = [p.correo, p.webinar_correo].map(c => (c ?? '').trim().toLowerCase()).filter(Boolean)
  const porCorreo = correos.flatMap(c => idx.porCorreo.get(c) ?? [])
  const nitNombre = porNombre.length ? nitUnico(porNombre) : null
  const nitCorreo = porCorreo.length ? nitUnico(porCorreo) : null

  if (porNombre.length && !nitNombre) return { tipo: 'ambiguo', candidatos: porNombre }
  if (nitNombre && nitCorreo && nitNombre !== nitCorreo) return { tipo: 'conflicto', candidatos: [...porNombre, ...porCorreo] }
  if (nitNombre) return { tipo: nitCorreo ? 'nombre+correo' : 'nombre', nit: nitNombre, razon: porNombre[0].razon }
  if (porCorreo.length && !nitCorreo) return { tipo: 'ambiguo', candidatos: porCorreo }
  if (nitCorreo) return { tipo: 'correo', nit: nitCorreo, razon: porCorreo[0].razon }

  // Sin coincidencia: nombres parecidos, solo como sugerencia para revisar a mano (nunca se aplican).
  const sugerencias = llave.length < 8 ? [] : idx.nombres
    .filter(n => n.llave.length >= 8 && (n.llave.startsWith(llave) || llave.startsWith(n.llave)))
    .slice(0, 3).map(n => n.e)
  return { tipo: 'ninguno', sugerencias }
}
