/**
 * GET  /api/recordatorios  — Historial de recordatorios enviados
 * POST /api/recordatorios  — Ejecutar recordatorios manualmente (admin o cron)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryAll } from '@/lib/db'
import { ejecutarRecordatorios } from '@/lib/recordatorios'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'admin') return NextResponse.json({ error: 'Solo admins' }, { status: 403 })

  const historial = await queryAll(`
    SELECT al.id, al.created_at, al.entidad_id, al.detalle, al.user_email,
           co.estado, oc.obligacion, oc.aspecto, oc.periodicidad, c.razon_social
    FROM audit_log al
    LEFT JOIN cliente_obligaciones co ON co.id = al.entidad_id
    LEFT JOIN obligaciones_catalogo oc ON oc.sub_id = co.catalogo_id
    LEFT JOIN clientes c ON c.id = co.cliente_id
    WHERE al.accion = 'recordatorio_enviado'
    ORDER BY al.created_at DESC LIMIT 100
  `)

  const proximos = await queryAll(`
    SELECT co.id, co.estado, oc.obligacion, oc.aspecto, oc.periodicidad, c.razon_social, c.email AS cliente_email
    FROM cliente_obligaciones co
    JOIN obligaciones_catalogo oc ON oc.sub_id = co.catalogo_id
    JOIN clientes c ON c.id = co.cliente_id
    WHERE co.estado IN ('pendiente','en_progreso')
      AND c.activo = 1
      AND oc.periodicidad NOT IN ('PERMANENTE','EVENTUAL','CUANDO APLIQUE')
    ORDER BY c.razon_social, oc.aspecto LIMIT 200
  `)

  return NextResponse.json({ historial, proximos })
}

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret')
  if (cronSecret && cronSecret === process.env.CRON_SECRET) {
    // Llamada automática del cron
  } else {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const user = session.user as any
    if (user.role !== 'admin') return NextResponse.json({ error: 'Solo admins' }, { status: 403 })
  }

  try {
    const resultado = await ejecutarRecordatorios()
    return NextResponse.json({ ok: true, resultado })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
