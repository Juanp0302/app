/**
 * GET  /api/superadmin/whatsapp-plantillas → las plantillas de lib/plantillas-whatsapp.ts con su texto y su estado en Meta
 * POST /api/superadmin/whatsapp-plantillas { nombres?: string[] } → registra en Meta las que falten (Meta las revisa)
 * POST /api/superadmin/whatsapp-plantillas { accion: 'probar', nombre, telefono } → envía esa plantilla, con los datos de
 *      ejemplo, a un celular de prueba (no toca ningún prospecto ni la cadencia; se cobra como cualquier plantilla)
 * Solo superadmin.
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { PLANTILLAS, cuerpoRegistro, textoDePlantilla } from '@/lib/plantillas-whatsapp'
import { listarPlantillasMeta, registrarPlantillaMeta, whatsappConfigurado, enviarPlantillaWhatsApp } from '@/lib/whatsapp-api'
import { celularParaWhatsApp } from '@/lib/whatsapp'

async function requireSuperadmin() {
  const session = await auth()
  const user = session?.user as any
  return user?.is_superadmin ? user : null
}

export async function GET() {
  if (!(await requireSuperadmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const meta = whatsappConfigurado() ? await listarPlantillasMeta() : { ok: false as const, error: 'WhatsApp no está configurado' }
  const estados = new Map(meta.ok ? meta.plantillas.map(t => [t.nombre, t]) : [])
  return NextResponse.json({
    error: meta.ok ? null : meta.error,
    plantillas: PLANTILLAS.map(d => ({
      nombre: d.nombre, titulo: d.titulo, categoria: d.categoria,
      ejemplo: textoDePlantilla(d.nombre, d.ejemplos), boton: d.boton?.texto ?? null,
      estado: estados.get(d.nombre)?.estado ?? 'SIN REGISTRAR', motivo: estados.get(d.nombre)?.motivo ?? null,
    })),
  })
}

export async function POST(req: Request) {
  if (!(await requireSuperadmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  if (body?.accion === 'probar') {
    const d = PLANTILLAS.find(p => p.nombre === body.nombre)
    if (!d) return NextResponse.json({ error: 'Plantilla desconocida' }, { status: 400 })
    const tel = celularParaWhatsApp(String(body.telefono ?? ''))
    if (!tel) return NextResponse.json({ error: 'Escribe un celular colombiano válido (10 dígitos, empieza por 3)' }, { status: 400 })
    // El botón de la radiografía lleva un enlace de ejemplo (abre "Enlace no válido"): la prueba es del mensaje.
    const r = await enviarPlantillaWhatsApp(tel, d.nombre, d.ejemplos, d.boton ? 'prueba.ejemplo' : undefined)
    return r.ok ? NextResponse.json({ ok: true, para: `+${tel}` }) : NextResponse.json({ error: `Meta no aceptó el envío: ${r.error}` }, { status: 502 })
  }
  const meta = await listarPlantillasMeta()
  if (!meta.ok) return NextResponse.json({ error: meta.error }, { status: 502 })
  const ya = new Set(meta.plantillas.map(t => t.nombre))
  const pedidas: string[] | null = Array.isArray(body?.nombres) ? body.nombres : null
  const resultados = []
  for (const d of PLANTILLAS) {
    if (pedidas && !pedidas.includes(d.nombre)) continue
    if (ya.has(d.nombre)) { resultados.push({ nombre: d.nombre, resultado: 'ya estaba' }); continue }
    const r = await registrarPlantillaMeta(cuerpoRegistro(d))
    resultados.push({ nombre: d.nombre, resultado: r.ok ? r.estado : `error: ${r.error}` })
  }
  return NextResponse.json({ resultados })
}
