/**
 * parse-obligaciones.mjs
 *
 * Lee el archivo HTML de obligaciones TIC y extrae toda la estructura
 * jerárquica: Categoría > Servicio > Aspecto > Grupo > Obligación > Subobligación
 *
 * Genera: data/obligaciones.json
 *
 * Uso: node scripts/parse-obligaciones.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HTML_PATH = path.join(__dirname, '../../Obligaciones_TIC_Final (1).html')
const OUT_PATH  = path.join(__dirname, '../data/obligaciones.json')

// ─── Helpers ────────────────────────────────────────────────────────────────

function stripTags(str) {
  return str.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function extractBadgeCount(str) {
  const m = str.match(/<span class="badge">(\d+)<\/span>/)
  return m ? parseInt(m[1]) : 0
}

// ─── Main parser ─────────────────────────────────────────────────────────────

const html = fs.readFileSync(HTML_PATH, 'utf-8')

// Split by categoria blocks
const categoriaBlocks = html.split('<div class="categoria">')
  .slice(1) // drop content before first categoria

const result = {
  metadata: {
    generado: new Date().toISOString(),
    total_servicios: 0,
    total_obligaciones: 0,
    total_subobligaciones: 0,
  },
  categorias: []
}

let oblId = 1
let subId = 1

for (const catBlock of categoriaBlocks) {
  // Extract categoria name
  const catHeaderMatch = catBlock.match(/class="categoria-header"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/)
  if (!catHeaderMatch) continue
  const catName = stripTags(catHeaderMatch[1])

  const categoria = { nombre: catName, servicios: [] }

  // Split by servicio blocks
  const servicioBlocks = catBlock.split('<div class="servicio">')
    .slice(1)

  for (const servBlock of servicioBlocks) {
    const servHeaderMatch = servBlock.match(/class="servicio-header"[^>]*>[\s\S]*?<span>([\s\S]*?)(?:<span|<\/span>)/)
    if (!servHeaderMatch) continue
    const servName = stripTags(servHeaderMatch[1])

    const servicio = {
      nombre: servName,
      slug: servName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
      aspectos: []
    }

    // Split by aspecto blocks
    const aspectoBlocks = servBlock.split('<div class="aspecto">')
      .slice(1)

    for (const aspBlock of aspectoBlocks) {
      const aspHeaderMatch = aspBlock.match(/class="aspecto-header"[^>]*>[\s\S]*?<span>►\s*([\s\S]*?)(?:<span|<\/span>)/)
      if (!aspHeaderMatch) continue
      const aspName = stripTags(aspHeaderMatch[1])

      const aspecto = { nombre: aspName, grupos: [] }

      // Split by grupo blocks
      const grupoBlocks = aspBlock.split('<div class="grupo">')
        .slice(1)

      for (const grpBlock of grupoBlocks) {
        const grpHeaderMatch = grpBlock.match(/class="grupo-header"[^>]*>[\s\S]*?<span>•\s*([\s\S]*?)(?:<span|<\/span>)/)
        if (!grpHeaderMatch) continue
        const grpName = stripTags(grpHeaderMatch[1])

        const grupo = { nombre: grpName, obligaciones: [] }

        // Split by obligacion blocks
        const oblBlocks = grpBlock.split('<div class="obligacion">')
          .slice(1)

        for (const oblBlock of oblBlocks) {
          const oblTitleMatch = oblBlock.match(/class="obligacion-title"[^>]*>[\s\S]*?<span>([\s\S]*?)(?:<span|<\/span>)/)
          const oblDescMatch  = oblBlock.match(/class="obligacion-desc">([\s\S]*?)<\/div>/)
          if (!oblTitleMatch) continue

          const oblNombre = stripTags(oblTitleMatch[1])
          const oblDesc   = oblDescMatch ? stripTags(oblDescMatch[1]).replace(/^📄\s*/, '') : ''

          const obligacion = {
            id: oblId++,
            nombre: oblNombre,
            descripcion: oblDesc,
            subobligaciones: []
          }

          // Split by subobligacion blocks
          const subBlocks = oblBlock.split('<div class="subobligacion">')
            .slice(1)

          for (const subBlock of subBlocks) {
            const subTitleMatch = subBlock.match(/class="subobligacion-title">([\s\S]*?)<\/div>/)
            const periodMatch   = subBlock.match(/class="periodicidad">⏱\s*([\s\S]*?)<\/div>/)
            const normMatch     = subBlock.match(/class="normatividad"><strong>📋 Normatividad:<\/strong><br>([\s\S]*?)<\/div>/)

            if (!subTitleMatch) continue

            const periodicidad = periodMatch ? stripTags(periodMatch[1]) : 'PERMANENTE'
            const normatividad = normMatch
              ? stripTags(normMatch[1]).split('•').map(s => s.trim()).filter(Boolean)
              : []

            obligacion.subobligaciones.push({
              id: subId++,
              titulo: stripTags(subTitleMatch[1]),
              periodicidad,
              normatividad,
            })
          }

          grupo.obligaciones.push(obligacion)
        }

        if (grupo.obligaciones.length > 0) aspecto.grupos.push(grupo)
      }

      if (aspecto.grupos.length > 0) servicio.aspectos.push(aspecto)
    }

    if (servicio.aspectos.length > 0) categoria.servicios.push(servicio)
  }

  if (categoria.servicios.length > 0) result.categorias.push(categoria)
}

// Update metadata counts
result.metadata.total_servicios     = result.categorias.reduce((a, c) => a + c.servicios.length, 0)
result.metadata.total_obligaciones  = oblId - 1
result.metadata.total_subobligaciones = subId - 1

fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2), 'utf-8')

console.log('✓ Obligaciones extraídas:')
console.log(`  Categorías:      ${result.categorias.length}`)
console.log(`  Servicios:       ${result.metadata.total_servicios}`)
console.log(`  Obligaciones:    ${result.metadata.total_obligaciones}`)
console.log(`  Subobligaciones: ${result.metadata.total_subobligaciones}`)
console.log(`  Archivo:         ${OUT_PATH}`)

// Preview ISP obligations
const svacat = result.categorias.find(c => c.nombre.includes('VALOR AGREGADO'))
const isp = svacat?.servicios.find(s => s.slug === 'isp_(sva)')
if (isp) {
  console.log(`\n  ISP (SVA) - Aspectos:`)
  for (const asp of isp.aspectos) {
    const total = asp.grupos.reduce((a, g) => a + g.obligaciones.length, 0)
    console.log(`    ${asp.nombre}: ${total} obligaciones`)
  }
}
