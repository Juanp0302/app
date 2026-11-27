/**
 * lib/festivos.mjs
 * Festivos de Colombia de cualquier año, calculados (no hay que actualizar una lista cada año). Lo usan las cadencias
 * (lib/cadencias.ts), el reparto de prospectos (lib/reparto.mjs) y los envíos automáticos (lib/ventas-auto.ts).
 *
 * Reglas (Ley 51 de 1983, "Ley Emiliani", y el calendario litúrgico):
 *  - Fijos, el día que caigan: 1 de enero, 1 de mayo, 20 de julio, 7 de agosto, 8 y 25 de diciembre.
 *  - Se pasan al lunes siguiente si no caen en lunes: 6 de enero (Reyes), 19 de marzo (San José), 29 de junio
 *    (San Pedro y San Pablo), 15 de agosto (Asunción), 12 de octubre (Diversidad Étnica y Cultural), 1 de noviembre
 *    (Todos los Santos), 11 de noviembre (Independencia de Cartagena).
 *  - Según la Pascua: Jueves y Viernes Santo (el día), y Ascensión (+39 días), Corpus Christi (+60) y Sagrado Corazón (+68),
 *    los tres pasados al lunes siguiente.
 */

/** Domingo de Pascua (algoritmo de Gauss/Butcher, calendario gregoriano). */
function pascua(anio) {
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(anio, mes - 1, dia))
}

const iso = d => d.toISOString().slice(0, 10)
const mas = (d, dias) => new Date(d.getTime() + dias * 86400000)
/** El mismo día si es lunes; si no, el lunes siguiente. */
const aLunes = d => mas(d, (8 - d.getUTCDay()) % 7)
const fecha = (anio, mes, dia) => new Date(Date.UTC(anio, mes - 1, dia))

const cache = new Map()

/** Los festivos de ese año, como fechas AAAA-MM-DD ordenadas. */
export function festivosColombia(anio) {
  if (cache.has(anio)) return cache.get(anio)
  const p = pascua(anio)
  const dias = [
    fecha(anio, 1, 1), fecha(anio, 5, 1), fecha(anio, 7, 20), fecha(anio, 8, 7), fecha(anio, 12, 8), fecha(anio, 12, 25),
    ...[[1, 6], [3, 19], [6, 29], [8, 15], [10, 12], [11, 1], [11, 11]].map(([m, d]) => aLunes(fecha(anio, m, d))),
    mas(p, -3), mas(p, -2), aLunes(mas(p, 39)), aLunes(mas(p, 60)), aLunes(mas(p, 68)),
  ]
  const lista = [...new Set(dias.map(iso))].sort()
  cache.set(anio, lista)
  return lista
}

/** ¿Es festivo en Colombia la fecha AAAA-MM-DD? */
export function esFestivo(fechaIso) {
  return festivosColombia(Number(fechaIso.slice(0, 4))).includes(fechaIso)
}

/** ¿Es día hábil (lunes a viernes, no festivo)? */
export function esDiaHabilColombia(fechaIso) {
  const dia = new Date(`${fechaIso}T12:00:00Z`).getUTCDay()
  return dia !== 0 && dia !== 6 && !esFestivo(fechaIso)
}
