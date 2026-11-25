/**
 * GET  /api/superadmin/whatsapp-plantillas → las plantillas de lib/plantillas-whatsapp.ts con su texto y su estado en Meta
 * POST /api/superadmin/whatsapp-plantillas { nombres?: string[] } → registra en Meta las que falten (Meta las revisa)
 * Solo superadmin.
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { PLANTILLAS, cuerpoRegistro, textoDePlantilla } from '@/lib/plantillas-whatsapp'
import { listarPlantillasMeta, registrarPlantillaMeta, whatsappConfigurado } from '@/lib/whatsapp-api'

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
