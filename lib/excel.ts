/**
 * lib/excel.ts
 * Lee la primera hoja de un .xlsx (o un .csv) como filas de texto, sin librerías aparte de jszip:
 * un .xlsx es un .zip con la hoja en XML y los textos en sharedStrings.xml.
 */
import JSZip from 'jszip'

const desescapar = (s: string) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&')

/** Texto de un <si> o <is>: puede venir partido en varios <t> (texto con formato). */
const textoDe = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => desescapar(m[1])).join('')

/** "B12" → 1 (columna B, base 0). */
function indiceColumna(ref: string) {
  const letras = ref.match(/^[A-Z]+/)?.[0] ?? 'A'
  let n = 0
  for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

export async function leerXlsx(datos: ArrayBuffer | Uint8Array): Promise<string[][]> {
  const zip = await JSZip.loadAsync(datos)
  const compartidos = [...((await zip.file('xl/sharedStrings.xml')?.async('string')) ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map(m => textoDe(m[1]))

  // Primera hoja según el orden del libro (no necesariamente sheet1.xml).
  let ruta = 'xl/worksheets/sheet1.xml'
  const libro = await zip.file('xl/workbook.xml')?.async('string')
  const rels = await zip.file('xl/_rels/workbook.xml.rels')?.async('string')
  const rid = libro?.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1]
  const destino = rid && rels ? rels.match(new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`))?.[1]
    ?? rels.match(new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`))?.[1] : null
  if (destino) ruta = destino.startsWith('/') ? destino.slice(1) : `xl/${destino.replace(/^\.\//, '')}`
  const hoja = await zip.file(ruta)?.async('string')
  if (!hoja) throw new Error('El archivo no tiene una hoja de cálculo legible')

  const filas: string[][] = []
  for (const f of hoja.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const fila: string[] = []
    for (const c of f[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1], cuerpo = c[2] ?? ''
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1]
      const tipo = attrs.match(/\bt="([^"]+)"/)?.[1]
      const v = cuerpo.match(/<v>([\s\S]*?)<\/v>/)?.[1]
      let valor = ''
      if (tipo === 's') valor = compartidos[Number(v)] ?? ''
      else if (tipo === 'inlineStr') valor = textoDe(cuerpo)
      else if (tipo === 'b') valor = v === '1' ? 'VERDADERO' : 'FALSO'
      else if (v != null) valor = desescapar(v)
      fila[ref ? indiceColumna(ref) : fila.length] = valor.trim()
    }
    filas.push(Array.from(fila, x => x ?? ''))
  }
  return filas.filter(f => f.some(x => x))
}

/** CSV con comillas, separado por coma o punto y coma (lo que tenga más la primera línea). */
export function leerCsv(texto: string): string[][] {
  texto = texto.replace(/^﻿/, '')
  const primera = texto.split('\n')[0]
  const sep = (primera.match(/;/g) ?? []).length > (primera.match(/,/g) ?? []).length ? ';' : ','
  const filas: string[][] = []
  let fila: string[] = [], campo = '', comillas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (comillas) { if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++ } else comillas = false } else campo += c }
    else if (c === '"') comillas = true
    else if (c === sep) { fila.push(campo.trim()); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      fila.push(campo.trim()); campo = ''
      if (fila.some(x => x)) filas.push(fila)
      fila = []
    } else campo += c
  }
  fila.push(campo.trim()); if (fila.some(x => x)) filas.push(fila)
  return filas
}

export async function leerTabla(nombreArchivo: string, datos: ArrayBuffer): Promise<string[][]> {
  if (/\.xlsx$/i.test(nombreArchivo)) return leerXlsx(datos)
  if (/\.(csv|txt)$/i.test(nombreArchivo)) return leerCsv(new TextDecoder('utf-8').decode(datos))
  throw new Error('Formato no soportado: suba un .xlsx o un .csv (si es .xls antiguo, ábralo y guárdelo como .xlsx)')
}
