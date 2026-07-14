/**
 * lib/numero-letras.ts
 * Convierte un número entero a texto en español (para cuentas de cobro).
 */

const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve']
const ESPECIALES = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis',
  'diecisiete', 'dieciocho', 'diecinueve']
const DECENAS = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

function menosDeMil(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cien'
  if (n < 10) return UNIDADES[n]
  if (n < 20) return ESPECIALES[n - 10]
  if (n < 100) {
    const d = Math.floor(n / 10)
    const u = n % 10
    return u === 0 ? DECENAS[d] : `${DECENAS[d]} y ${UNIDADES[u]}`
  }
  const c = Math.floor(n / 100)
  const resto = n % 100
  const centena = CENTENAS[c]
  return resto === 0 ? centena : `${centena} ${menosDeMil(resto)}`
}

export function numeroALetras(n: number): string {
  if (n === 0) return 'cero'
  if (n < 0) return `menos ${numeroALetras(-n)}`

  const millones = Math.floor(n / 1_000_000)
  const miles = Math.floor((n % 1_000_000) / 1_000)
  const resto = n % 1_000

  const partes: string[] = []

  if (millones > 0) {
    partes.push(millones === 1 ? 'un millón' : `${menosDeMil(millones)} millones`)
  }
  if (miles > 0) {
    partes.push(miles === 1 ? 'mil' : `${menosDeMil(miles)} mil`)
  }
  if (resto > 0) {
    partes.push(menosDeMil(resto))
  }

  return partes.join(' ')
}

/** Devuelve el monto en letras para cuenta de cobro colombiana */
export function montoCOP(n: number): string {
  const letras = numeroALetras(n)
  // Capitalizar primera letra
  return letras.charAt(0).toUpperCase() + letras.slice(1) + ' pesos m/cte.'
}
