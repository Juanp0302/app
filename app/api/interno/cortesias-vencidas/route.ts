/**
 * POST /api/interno/cortesias-vencidas
 * Pensado para llamarse una vez al día desde N8N (mismo patrón que
 * /api/superadmin/auto-cuentas-cobro). Suspende las cortesías vencidas y
 * notifica a cada cliente con el correo genérico de suspensión.
 * Auth: Authorization: Bearer INTERNAL_SECRET
 */
import { NextRequest, NextResponse } from 'next/server'
import { procesarCortesiasVencidas } from '@/lib/cortesias'

export async function POST(req: NextRequest) {
  const secret = process.env.INTERNAL_SECRET
  const auth   = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const resultado = await procesarCortesiasVencidas()
  return NextResponse.json({ ok: true, total: resultado.length, resultado })
}
