import puppeteer from 'puppeteer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const SRC  = path.join(ROOT, '.compliance', 'docs', '1581-politica-privacidad.md')
const OUT  = path.join(ROOT, 'politica-privacidad-owl-compliance.pdf')

function mdToHtml(md) {
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^---+$/gm, '<hr>')
    .replace(/((?:^\|.+\|\n?)+)/gm, table => {
      const rows = table.trim().split('\n').filter(r => !/^\|[-| :]+\|/.test(r))
      return '<table>' + rows.map((row, i) => {
        const cells = row.split('|').slice(1, -1).map(c => c.trim())
        const tag = i === 0 ? 'th' : 'td'
        return '<tr>' + cells.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>'
      }).join('') + '</table>'
    })
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, s => `<ul>${s}</ul>`)
    .replace(/^(?!<[htupbc\/]|$)(.+)$/gm, '<p>$1</p>')
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; line-height: 1.7; }

  .header {
    background: #270205;
    padding: 36px 56px 28px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .header-left .label {
    font-size: 8pt; font-weight: 700; letter-spacing: 0.2em;
    text-transform: uppercase; color: #968622; margin-bottom: 6px;
  }
  .header-left h1 {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 20pt; font-weight: 700; color: #e7dfca; line-height: 1.2;
  }
  .header-right {
    text-align: right; font-size: 8.5pt; color: rgba(231,223,202,0.55); line-height: 1.9;
  }
  .header-right strong { color: #968622; }

  .body { padding: 40px 56px 56px; }

  h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 16pt; color: #270205; margin: 28px 0 10px; }
  h2 { font-size: 12pt; font-weight: 700; color: #270205; margin: 24px 0 8px;
       border-bottom: 2px solid #968622; padding-bottom: 5px; }
  h3 { font-size: 10.5pt; font-weight: 700; color: #712529; margin: 18px 0 6px; }
  h4 { font-size: 10pt; font-weight: 700; color: #270205; margin: 14px 0 4px; }
  p  { margin: 7px 0; }
  ul { margin: 8px 0 8px 22px; }
  li { margin: 3px 0; }
  strong { font-weight: 700; color: #270205; }
  em { font-style: italic; color: #555; }
  blockquote {
    border-left: 3px solid #968622; padding: 8px 16px; margin: 12px 0;
    background: #faf7f0; color: #666; font-style: italic; font-size: 10pt;
  }
  hr { border: none; border-top: 1px solid #e0d8c8; margin: 20px 0; }
  table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 9.5pt; }
  th { background: #270205; color: #e7dfca; padding: 9px 12px; text-align: left; font-weight: 700; }
  td { padding: 8px 12px; border-bottom: 1px solid #e8e0d0; vertical-align: top; }
  tr:nth-child(even) td { background: #faf7f0; }

  .footer {
    position: fixed; bottom: 0; left: 0; right: 0;
    padding: 10px 56px; border-top: 1px solid #e0d8c8;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 8pt; color: #aaa; background: white;
  }
  .footer .brand { color: #968622; font-weight: 700; }

  @page { margin: 0 0 36px 0; size: A4; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`

const md   = fs.readFileSync(SRC, 'utf-8')
const body = mdToHtml(md)

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>${CSS}</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="label">Documento legal · Colombia · Ley 1581 de 2012</div>
      <h1>Política de Tratamiento<br>de Datos Personales</h1>
    </div>
    <div class="header-right">
      <strong>Owl Compliance</strong><br>
      Bogotá, Cundinamarca<br>
      Versión 1.0 · Junio 2026<br>
      NIT: [por confirmar]
    </div>
  </div>

  <div class="body">
    ${body}
  </div>

  <div class="footer">
    <span class="brand">Owl Compliance</span>
    <span>Política de Tratamiento de Datos Personales · Ley 1581 de 2012 · v1.0</span>
    <span>Borrador — no constituye asesoría legal</span>
  </div>
</body>
</html>`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page    = await browser.newPage()
await page.setContent(html, { waitUntil: 'networkidle0' })
await page.pdf({
  path: OUT,
  format: 'A4',
  printBackground: true,
  margin: { top: '0', right: '0', bottom: '40px', left: '0' },
})
await browser.close()
console.log('PDF generado:', OUT)
