/**
 * POST /api/interno/ventas-automaticas — un ciclo de las ventas automáticas (lib/ventas-auto.ts): lee el buzón y, en días
 * hábiles (sin festivos de Colombia) de 9 a. m. a 5 p. m., envía los correos y WhatsApp de cadencia que tocan. Lo llama GitHub Actions cada hora (.github/workflows/ventas-automaticas.yml).
 * GET — estado (modo, último ciclo, prospectos en automático), para revisar que el ciclo esté corriendo.
 * Auth: Authorization: Bearer INTERNAL_SECRET
 */
import { NextRequest, NextResponse } from 'next/server'
import { alertar, cicloVentasAutomaticas, estadoVentasAuto } from '@/lib/ventas-auto'

const autorizado = (req: NextRequest) => {
  const secret = process.env.INTERNAL_SECRET
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try {
    const r = await cicloVentasAutomaticas()
    const cuenta = (xs: string[]) => xs.reduce<Record<string, number>>((a, v) => { a[v] = (a[v] ?? 0) + 1; return a }, {})
    return NextResponse.json({
      ok: r.errores.length === 0, modo: r.modo, hoy: r.hoy, hora: r.hora,
      envios: cuenta(r.envios.map(e => e.resultado)), entrantes: cuenta(r.entrantes.map(e => e.tipo)), errores: r.errores,
    })
  } catch (e: any) {
    await alertar('el ciclo de ventas automáticas falló', String(e?.message ?? e)).catch(() => null)
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  return NextResponse.json(await estadoVentasAuto())
}
