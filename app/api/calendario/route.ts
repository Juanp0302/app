import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne, queryAll } from '@/lib/db'
import { generarVencimientos } from '@/lib/fechas'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const user    = session.user as any
  const anio    = parseInt(req.nextUrl.searchParams.get('anio') ?? String(new Date().getFullYear()))
  let clienteId = req.nextUrl.searchParams.get('clienteId')

  if (user.role === 'cliente') {
    const c = await queryOne('SELECT id FROM clientes WHERE user_id = ?', [user.id])
    if (!c) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    clienteId = (c as any).id
  }
  if (!clienteId) return NextResponse.json({ error: 'clienteId requerido' }, { status: 400 })

  const eventos: any[] = []
  let cliente: any = null

  // ── Vista general: agrega todas las obligaciones de todos los clientes ──
  if (clienteId === 'general') {
    const obligaciones = await queryAll(`
      SELECT oc.sub_id AS obl_id, oc.sub_titulo, oc.obligacion, oc.aspecto, oc.grupo, oc.servicio, oc.periodicidad,
             COUNT(co.id)                                                   AS num_clientes,
             SUM(CASE WHEN co.estado = 'cumplida'    THEN 1 ELSE 0 END)    AS cumplidas_count,
             SUM(CASE WHEN co.estado = 'vencida'     THEN 1 ELSE 0 END)    AS vencidas_count
      FROM obligaciones_catalogo oc
      JOIN cliente_obligaciones co ON co.catalogo_id = oc.sub_id
      WHERE co.estado != 'no_aplica'
      GROUP BY oc.sub_id
      ORDER BY oc.aspecto, oc.obligacion
    `) as any[]

    for (const obl of obligaciones) {
      // Estado sintético: cumplida solo si TODOS la tienen cumplida
      const estado = obl.cumplidas_count >= obl.num_clientes
        ? 'cumplida'
        : obl.vencidas_count > 0 ? 'vencida' : 'pendiente'

      for (const v of generarVencimientos(obl.periodicidad, anio)) {
        eventos.push({
          obl_id: obl.obl_id, fecha: v.fecha, label: v.label, urgencia: v.urgencia,
          estado, sub_titulo: obl.sub_titulo, obligacion: obl.obligacion,
          aspecto: obl.aspecto, grupo: obl.grupo, servicio: obl.servicio, periodicidad: obl.periodicidad,
          num_clientes: obl.num_clientes, cumplidas_count: obl.cumplidas_count,
        })
      }
    }
  } else {
  // ── Vista por cliente específico ──────────────────────────────────────
  const obligaciones = await queryAll(`
    SELECT co.id AS obl_id, co.estado, oc.sub_titulo, oc.obligacion, oc.aspecto, oc.grupo, oc.servicio, oc.periodicidad
    FROM cliente_obligaciones co JOIN obligaciones_catalogo oc ON oc.sub_id = co.catalogo_id
    WHERE co.cliente_id = ? ORDER BY oc.aspecto, oc.obligacion
  `, [clienteId])

  cliente = await queryOne('SELECT razon_social, nit FROM clientes WHERE id = ?', [clienteId])

  for (const obl of obligaciones as any[]) {
    for (const v of generarVencimientos(obl.periodicidad, anio)) {
      eventos.push({ obl_id: obl.obl_id, fecha: v.fecha, label: v.label, urgencia: v.urgencia, estado: obl.estado, sub_titulo: obl.sub_titulo, obligacion: obl.obligacion, aspecto: obl.aspecto, grupo: obl.grupo, servicio: obl.servicio, periodicidad: obl.periodicidad })
    }
  }
  }

  const porMes: Record<string, any[]> = {}
  for (const ev of eventos) {
    const mes = ev.fecha.slice(0, 7)
    if (!porMes[mes]) porMes[mes] = []
    porMes[mes].push(ev)
  }

  const resumen = Object.entries(porMes).map(([mes, evs]) => ({ mes, total: evs.length, cumplidas: evs.filter(e => e.estado === 'cumplida').length, vencidas: evs.filter(e => e.estado === 'vencida').length, pendientes: evs.filter(e => e.estado === 'pendiente' || e.estado === 'en_progreso').length, criticas: evs.filter(e => e.urgencia === 'critica').length }))

  const hoy     = new Date().toISOString().slice(0, 10)
  const proximos = eventos.filter(e => e.fecha >= hoy && e.estado !== 'cumplida').sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 8)

  return NextResponse.json({ cliente, anio, porMes, resumen, proximos })
}
