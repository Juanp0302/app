/**
 * POST /api/codigos-descuento/validar
 * Endpoint PÚBLICO — sin autenticación. Usado por SuscribirseContratoClient
 * para previsualizar el descuento antes de firmar el contrato. Solo valida y
 * calcula: NO incrementa el contador de usos (eso ocurre en
 * app/api/contrato/publico, al aplicarse realmente el código al generar el
 * cobro/enlace de pago).
 */
import { NextRequest, NextResponse } from 'next/server'
import { validarCodigoDescuento } from '@/lib/codigos-descuento'
import { PLANES, type PlanKey } from '@/lib/suscripcion'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const { codigo, plan } = body ?? {}

  if (!codigo?.trim()) return NextResponse.json({ error: 'Falta el código' }, { status: 400 })
  if (!plan || !PLANES[plan as PlanKey]) return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })

  const resultado = await validarCodigoDescuento(codigo, plan as PlanKey)
  return NextResponse.json(resultado)
}
