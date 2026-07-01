/**
 * Genera un PDF con todos los documentos de compliance.
 * Uso: node scripts/gen-compliance-pdf.mjs
 */

import puppeteer from 'puppeteer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const COMPLIANCE_DIR = path.join(ROOT, '.compliance')
const OUT = path.join(ROOT, 'compliance-ley1581-owl-compliance.pdf')

// Orden de los documentos
const DOCS = [
  { file: 'RESUMEN.md',                        title: 'Resumen ejecutivo' },
  { file: 'docs/1581-rat.md',                  title: 'Registro de Actividades de Tratamiento (RAT)' },
  { file: 'docs/1581-politica-privacidad.md',  title: 'Política de Privacidad' },
  { file: 'docs/1581-aviso-privacidad.md',     title: 'Aviso de Privacidad' },
  { file: 'docs/1581-autorizacion-tratamiento.md', title: 'Mecanismo de Autorización' },
  { file: 'docs/1581-canal-habeas-data.md',    title: 'Canal de Habeas Data' },
  { file: 'docs/1581-clausula-encargados.md',  title: 'Cláusula de Encargados' },
  { file: 'docs/1581-plan-respuesta-brechas.md', title: 'Plan de Respuesta a Brechas' },
  { file: 'docs/1581-registro-incidentes.md',  title: 'Registro de Incidentes' },
  { file: 'docs/1581-procedimiento-rnbd.md',   title: 'Procedimiento RNBD' },
  { file: 'docs/1581-eipd.md',                 title: 'Evaluación de Impacto (EIPD)' },
  { file: 'INSTRUCTIVO.md',                    title: 'Instructivo Operativo' },
]

function mdToHtml(md) {
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // headings
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // bold/italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // code blocks
    .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // blockquote
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
    // horizontal rule
    .replace(/^---+$/gm, '<hr>')
    // checkboxes
    .replace(/- \[x\] /g, '- ✅ ')
    .replace(/- \[ \] /g, '- ☐ ')
    // unordered list items
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, s => `<ul>${s}</ul>`)
    // tables — convert | rows to HTML
    .replace(/((?:^\|.+\|\n?)+)/gm, table => {
      const rows = table.trim().split('\n').filter(r => !/^\|[-| :]+\|/.test(r))
      const html = rows.map((row, i) => {
        const cells = row.split('|').slice(1, -1).map(c => c.trim())
        const tag = i === 0 ? 'th' : 'td'
        return '<tr>' + cells.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>'
      }).join('\n')
      return `<table>${html}</table>`
    })
    // paragraphs (lines not already wrapped)
    .replace(/^(?!<[htupbc]|<\/|$)(.+)$/gm, '<p>$1</p>')
    // line breaks
    .replace(/\n{2,}/g, '\n')
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; line-height: 1.6; }
  .cover { background: #270205; color: #e7dfca; padding: 80px 60px; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
  .cover .label { font-size: 9pt; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #968622; margin-bottom: 12px; }
  .cover h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 36pt; font-weight: 700; color: #e7dfca; line-height: 1.2; margin-bottom: 20px; }
  .cover .sub { font-size: 13pt; color: rgba(231,223,202,0.7); margin-bottom: 40px; }
  .cover .meta { font-size: 9pt; color: rgba(231,223,202,0.5); line-height: 2; margin-top: auto; padding-top: 40px; border-top: 1px solid rgba(150,134,34,0.3); }
  .cover .meta strong { color: #968622; }
  .score-bar { margin: 24px 0; }
  .score-bar .bar { height: 8px; background: rgba(150,134,34,0.2); border-radius: 4px; overflow: hidden; margin-top: 6px; }
  .score-bar .fill { height: 100%; background: #968622; border-radius: 4px; }
  .section { padding: 40px 60px; page-break-before: always; }
  .section-header { background: #270205; color: #e7dfca; padding: 20px 30px; margin: -40px -60px 30px; }
  .section-header .num { font-size: 9pt; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #968622; margin-bottom: 4px; }
  .section-header h2 { font-family: 'Playfair Display', Georgia, serif; font-size: 18pt; font-weight: 700; color: #e7dfca; }
  h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 18pt; color: #270205; margin: 24px 0 12px; }
  h2 { font-size: 13pt; font-weight: 700; color: #270205; margin: 20px 0 8px; border-bottom: 2px solid #968622; padding-bottom: 4px; }
  h3 { font-size: 11pt; font-weight: 700; color: #712529; margin: 16px 0 6px; }
  h4 { font-size: 10pt; font-weight: 700; color: #270205; margin: 12px 0 4px; }
  p { margin: 8px 0; }
  ul { margin: 8px 0 8px 20px; }
  li { margin: 3px 0; }
  code { background: #f0ede4; color: #270205; padding: 1px 5px; border-radius: 3px; font-family: 'JetBrains Mono', monospace; font-size: 9pt; }
  pre { background: #1a1a1a; color: #e7dfca; padding: 16px; border-radius: 6px; overflow-x: auto; margin: 12px 0; font-size: 8.5pt; line-height: 1.5; }
  pre code { background: none; color: inherit; padding: 0; }
  blockquote { border-left: 3px solid #968622; padding: 8px 16px; margin: 12px 0; background: #f7f3ea; color: #555; font-style: italic; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 9pt; }
  th { background: #270205; color: #e7dfca; padding: 8px 10px; text-align: left; font-weight: 700; }
  td { padding: 7px 10px; border-bottom: 1px solid #e8e0d0; vertical-align: top; }
  tr:nth-child(even) td { background: #faf7f0; }
  hr { border: none; border-top: 1px solid #e0d8c8; margin: 16px 0; }
  strong { font-weight: 700; color: #270205; }
  .disclaimer { background: #faf7f0; border: 1px solid #968622; border-radius: 6px; padding: 12px 16px; font-size: 9pt; color: #555; margin-bottom: 20px; }
  @page { margin: 0; size: A4; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`

async function main() {
  // Build HTML
  const sections = DOCS.map((d, i) => {
    const filePath = path.join(COMPLIANCE_DIR, d.file)
    if (!fs.existsSync(filePath)) return ''
    const md = fs.readFileSync(filePath, 'utf-8')
    const body = mdToHtml(md)
    return `
      <div class="section">
        <div class="section-header">
          <div class="num">Documento ${String(i + 1).padStart(2, '0')} / ${DOCS.length}</div>
          <h2>${d.title}</h2>
        </div>
        ${body}
      </div>`
  }).join('\n')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>${CSS}</style>
</head>
<body>
  <div class="cover">
    <div class="label">Auditoría de Cumplimiento · Colombia</div>
    <h1>Ley 1581 de 2012<br>Protección de Datos Personales</h1>
    <div class="sub">Owl Compliance · Bogotá, Colombia</div>
    <div class="score-bar">
      <div style="font-size:9pt;color:#968622;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Score de cumplimiento</div>
      <div style="font-size:28pt;font-weight:700;color:#e7dfca;margin:4px 0;">33%</div>
      <div class="bar"><div class="fill" style="width:33%"></div></div>
    </div>
    <div class="meta">
      <strong>Responsable de tratamiento:</strong> Nicolás Almeyda Orozco<br>
      <strong>NIT:</strong> [por confirmar]<br>
      <strong>Domicilio:</strong> Bogotá, Cundinamarca, Colombia<br>
      <strong>Fecha de auditoría:</strong> 22 de junio de 2026<br>
      <strong>Commit auditado:</strong> 1468c74<br>
      <strong>RNBD:</strong> No obligada (microempresa, activos ≤ 100.000 UVT)<br>
      <br>
      <em>Este documento es un borrador de cumplimiento fundado en la normativa colombiana.<br>
      No constituye asesoría legal.</em>
    </div>
  </div>
  ${sections}
</body>
</html>`

  // Launch puppeteer and generate PDF
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  await page.pdf({
    path: OUT,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  })
  await browser.close()
  console.log('PDF generado:', OUT)
}

main().catch(e => { console.error(e); process.exit(1) })
