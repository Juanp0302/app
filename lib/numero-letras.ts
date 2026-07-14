/**
 * lib/numero-letras.ts
 * Convierte un monto numérico a su representación en letras (pesos colombianos).
 */

const UNIDADES = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve']
const DECENAS  = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

function centenas(n: number): string {
  if (n === 100) return 'cien'
  const c     = Math.floor(n / 100)
  const resto = n % 100
  const parteC = CENTENAS[c] ?? ''
  if (resto === 0) return parteC
  if (resto < 20) return [parteC, UNIDADES[resto]].filter(Boolean).join(' ')
  const d = Math.floor(resto / 10)
  const u = resto % 10
  const parteD = u === 0 ? DECENAS[d] : `${DECENAS[d]} y ${UNIDADES[u]}`
  return [parteC, parteD].filter(Boolean).join(' ')
}

function enLetras(n: number): string {
  if (n === 0) return 'cero'
  const millones = Math.floor(n / 1_000_000)
  const resto1   = n % 1_000_000
  const mils     = Math.floor(resto1 / 1000)
  const resto2   = resto1 % 1000
  const partes: string[] = []
  if (millones > 0) partes.push(millones === 1 ? 'un millón' : `${centenas(millones)} millones`)
  if (mils     > 0) partes.push(mils === 1 ? 'mil' : `${centenas(mils)} mil`)
  if (resto2   > 0) partes.push(centenas(resto2))
  return partes.join(' ')
}

/** Devuelve la representación en letras de un monto en pesos colombianos. */
export function montoCOP(n: number): string {
  return `${enLetras(Math.floor(n))} pesos colombianos (${n.toLocaleString('es-CO')} COP)`
}
