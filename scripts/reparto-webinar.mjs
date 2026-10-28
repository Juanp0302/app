/**
 * Lógica pura del importador del webinar (scripts/importar-webinar.mjs), separada para poder probarla.
 * Sin acceso a BD.
 */

export const sinTildes = s => (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** Nombre de empresa comparable: sin tildes, sin S.A.S./Ltda./BIC/ZOMAC, solo letras y números. */
export const normEmpresa = s => sinTildes(s)
  .replace(/\b(s\.?\s?a\.?\s?s\.?|ltda\.?|s\.?\s?a\.?|e\.?\s?s\.?\s?p\.?|e\.?\s?u\.?|bic|zomac)\b/g, '')
  .replace(/[^a-z0-9]/g, '')

/** Lo que escribieron en "ISP" no parece un operador (estudiante, independiente, una cédula…): revisar en el primer contacto. */
export function revisarIcp(empresa, nombre) {
  const e = sinTildes(empresa)
  if (!e || /^[\d\s.\-]+$/.test(e)) return true
  if (/^(estudiante|sena|independiente|personal|na|n\/a|x|nn|\.|soy tecnico|asesoria contable|gmail|suministro|sin nombre)$/.test(e)) return true
  if (/quiero aprender/.test(e)) return true
  // Escribió su propio nombre como empresa ("Wilson Bermudez"). Si lo repetido parece una empresa
  // ("REDES CABLE VISION", "R&H Telecomunicaciones SAS", "REDMA"), es un ISP que llenó mal el nombre.
  return !!nombre && normEmpresa(empresa) === normEmpresa(nombre) && pareceNombreDePersona(nombre)
}

const PALABRAS_DE_EMPRESA = /\b(s\.?a\.?s?|ltda|telecom\w*|comunicacion\w*|redes?|net\w*|cable\w*|tv|fibra\w*|internet|wifi|wisp|isp|sistem\w*|soluciones|ingenier\w*|group|digital)\b|net\b/i

/** "Wilson Bermudez" sí; "REDMA", "REDES CABLE VISION" o "TELFLY S.A.S" no. */
export function pareceNombreDePersona(s) {
  const t = (s ?? '').trim()
  return t.split(/\s+/).length >= 2 && /^[\p{L}\s.'-]+$/u.test(t) && !PALABRAS_DE_EMPRESA.test(sinTildes(t))
}

/**
 * Algunos escribieron el NIT en el campo de la empresa ("900232917") y la empresa en el nombre.
 * Devuelve { empresa, nit } corregidos.
 */
export function corregirNitEnEmpresa(empresa, nombre) {
  const d = (empresa ?? '').replace(/[\s.\-]/g, '')
  if (/^[89]\d{8,9}$/.test(d) && nombre && !pareceNombreDePersona(nombre)) return { empresa: nombre.trim(), nit: d.slice(0, 9) }
  return { empresa, nit: '' }
}

/**
 * ¿Este registro del webinar es la misma empresa que un prospecto del cold mailing?
 * Por NIT, por correo o por nombre de empresa (si el nombre no es demasiado corto).
 */
export function coincideConProspecto(r, p) {
  const d = s => (s ?? '').toString().replace(/\D/g, '')
  if (d(p.nit) && r.nit && d(p.nit) === d(r.nit)) return true
  if (p.correo && r.correo && String(p.correo).trim().toLowerCase() === r.correo) return true
  const ep = normEmpresa(p.empresa)
  return ep.length >= 5 && ep === normEmpresa(r.empresa)
}

/** Nombres tan genéricos que no sirven para saber si dos personas son de la misma empresa. */
const GENERICOS = new Set(['fibra', 'internet', 'redes', 'global', 'ftth', 'isp', 'teleco', 'intercom', 'innova', 'conectar', 'w', 'vi', 'bala', 'ccc', 'ixp', 'sw', 'fibramas'])

/** Clave para mantener juntos a los contactos de la misma empresa (o la propia fila si no se puede saber). */
export function claveGrupo(fila) {
  const e = normEmpresa(fila.empresa)
  if (e.length < 4 || GENERICOS.has(e) || revisarIcp(fila.empresa, fila.nombre)) return `fila:${fila.clave}`
  return `empresa:${e}`
}

/**
 * Reparte filas entre responsables en partes iguales y parejas en calidad: primero los asistentes de
 * más minutos, luego los inscritos; cada grupo (misma empresa) va completo a quien tenga menos de ese
 * segmento y, en empate, menos en total. `previos` = cuántos tiene ya cada uno por segmento.
 * filas: [{ clave, empresa, nombre, asistio, minutos }]. Devuelve Map clave → responsable.
 */
export function repartir(filas, responsables, previos = {}) {
  if (!responsables.length) throw new Error('No hay responsables para repartir')
  const cuenta = Object.fromEntries(responsables.map(r => [r, { asistio: 0, inscrito: 0, ...(previos[r] ?? {}) }]))
  const ordenadas = [...filas].sort((a, b) =>
    Number(b.asistio) - Number(a.asistio) || Number(b.minutos ?? 0) - Number(a.minutos ?? 0))
  const grupos = new Map()
  for (const f of ordenadas) {
    const k = claveGrupo(f)
    if (!grupos.has(k)) grupos.set(k, [])
    grupos.get(k).push(f)
  }
  const asignado = new Map()
  for (const miembros of grupos.values()) {
    const seg = miembros[0].asistio ? 'asistio' : 'inscrito'
    const total = r => cuenta[r].asistio + cuenta[r].inscrito
    const elegido = [...responsables].sort((a, b) => cuenta[a][seg] - cuenta[b][seg] || total(a) - total(b))[0]
    for (const m of miembros) {
      asignado.set(m.clave, elegido)
      cuenta[elegido][m.asistio ? 'asistio' : 'inscrito']++
    }
  }
  return asignado
}

// ── Días hábiles: misma regla y festivos que lib/cadencias.ts (mantener las dos listas iguales) ─────
export const FESTIVOS = new Set(['2026-11-02', '2026-11-16', '2026-12-08', '2026-12-25', '2027-01-01', '2027-01-11'])

export function sumarDiasHabiles(fecha, n) {
  const d = new Date(`${fecha}T12:00:00Z`)
  const esHabil = () => d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !FESTIVOS.has(d.toISOString().slice(0, 10))
  while (!esHabil()) d.setUTCDate(d.getUTCDate() + 1)
  for (let i = 0; i < n; i++) {
    d.setUTCDate(d.getUTCDate() + 1)
    while (!esHabil()) d.setUTCDate(d.getUTCDate() + 1)
  }
  return d.toISOString().slice(0, 10)
}

/**
 * Fecha de arranque de la cadencia: los asistentes, todos el primer día; los inscritos, de a `porDia`
 * por responsable desde el día hábil siguiente, para no mandar cientos de WhatsApp el mismo día
 * desde un mismo número. filas: [{ clave, asistio, responsable }] en orden de prioridad.
 */
export function fechasDeInicio(filas, inicio, porDia) {
  const fechas = new Map(), usados = {}
  for (const f of filas) {
    if (f.asistio) { fechas.set(f.clave, sumarDiasHabiles(inicio, 0)); continue }
    const n = usados[f.responsable] = (usados[f.responsable] ?? 0) + 1
    fechas.set(f.clave, sumarDiasHabiles(inicio, 1 + Math.floor((n - 1) / porDia)))
  }
  return fechas
}
