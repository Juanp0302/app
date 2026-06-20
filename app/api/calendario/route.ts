/**
 * GET /api/calendario?clienteId=xxx&anio=2026
 *
 * Devuelve todos los vencimientos del año para un cliente,
 * agrupados por mes, con el estado actual de cada obligación.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { generarVencimientos } from '@/lib/fechas'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const user      = session.user as any
  const anio      = parseInt(req.nextUrl.searchParams.get('anio') ?? String(new Date().getFullYear()))
  let clienteId   = req.nextUrl.searchParams.get('clienteId')

  // Cliente solo puede ver sus propios datos
  if (user.role === 'cliente') {
    const c = db.prepare('SELECT id FROM clientes WHERE user_id = ?').get(user.id) as any
    if (!c) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    clienteId = c.id
  }

  if (!clienteId) return NextResponse.json({ error: 'clienteId requerido' }, { status: 400 })

  // Todas las obligaciones del cliente con periodicidad
  const obligaciones = db.prepare(`
    SELECT
      co.id        AS obl_id,
      co.estado,
      oc.sub_titulo,
      oc.obligacion,
      oc.aspecto,
      oc.grupo,
      oc.servicio,
      oc.periodicidad
    FROM cliente_obligaciones co
    JOIN obligaciones_catalogo oc ON oc.sub_id = co.catalogo_id
    WHERE co.cliente_id = ?
    ORDER BY oc.aspecto, oc.obligacion
  `).all(clienteId) as any[]

  // Información del cliente
  const cliente = db.prepare('SELECT razon_social, nit FROM clientes WHERE id = ?').get(clienteId) as any

  // Generar vencimientos: una entrada por cada fecha que tiene cada obligación en el año
  const eventos: any[] = []

  for (const obl of obligaciones) {
    const fechas = generarVencimientos(obl.periodicidad, anio)
    for (const v of fechas) {
      eventos.push({
        obl_id:       obl.obl_id,
        fecha:        v.fecha,
        label:        v.label,
        urgencia:     v.urgencia,
        estado:       obl.estado,
        sub_titulo:   obl.sub_titulo,
        obligacion:   obl.obligacion,
        aspecto:      obl.aspecto,
        grupo:        obl.grupo,
        servicio:     obl.servicio,
        periodicidad: obl.periodicidad,
      })
    }
  }

  // Agrupar por mes
  const porMes: Record<string, any[]> = {}
  for (const ev of eventos) {
    const mes = ev.fecha.slice(0, 7)   // YYYY-MM
    if (!porMes[mes]) porMes[mes] = []
    porMes[mes].push(ev)
  }

  // Estadísticas por mes
  const resumen = Object.entries(porMes).map(([mes, evs]) => ({
    mes,
    total:      evs.length,
    cumplidas:  evs.filter(e => e.estado === 'cumplida').length,
    vencidas:   evs.filter(e => e.estado === 'vencida').length,
    pendientes: evs.filter(e => e.estado === 'pendiente' || e.estado === 'en_progreso').length,
    criticas:   evs.filter(e => e.urgencia === 'critica').length,
  }))

  // Próximos 5 vencimientos desde hoy
  const hoy = new Date().toISOString().slice(0, 10)
  const proximos = eventos
    .filter(e => e.fecha >= hoy && e.estado !== 'cumplida')
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, 8)

  return NextResponse.json({ cliente, anio, porMes, resumen, proximos })
}
