/**
 * Servicio de Diagnóstico Integral (ver lib/revision.ts).
 *
 * GET  /api/diagnostico
 *        cliente → su estado (requiere revisión, plan, estado del diagnóstico)
 *        admin   → lista de clientes con diagnóstico solicitado/activo/cerrado
 * POST /api/diagnostico  { accion: 'solicitar' }                    → solo clientes
 * POST /api/diagnostico  { accion: 'activar', clienteId }           → solo superadmin
 * POST /api/diagnostico  { accion: 'cerrar',  clienteId }           → cualquier administrador
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import {
  infoRevisionCliente, listarDiagnosticos,
  solicitarDiagnostico, activarDiagnostico, cerrarDiagnostico,
} from '@/lib/revision'

async function sesion() {
  const session = await auth()
  return (session?.user as any) ?? null
}

export async function GET() {
  const user = await sesion()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  if (user.role === 'cliente') {
    const c = await queryOne('SELECT id FROM clientes WHERE user_id = ?', [user.id]) as any
    if (!c) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ revision: await infoRevisionCliente(c.id) })
  }

  if (user.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  return NextResponse.json({ diagnosticos: await listarDiagnosticos(), esSuperadmin: !!user.is_superadmin })
}

export async function POST(req: Request) {
  const user = await sesion()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const accion = body?.accion
  const actor = { id: user.id ?? '', email: user.email ?? '' }

  if (accion === 'solicitar') {
    if (user.role !== 'cliente') return NextResponse.json({ error: 'Solo los clientes pueden solicitar el diagnóstico' }, { status: 403 })
    const c = await queryOne('SELECT id FROM clientes WHERE user_id = ?', [user.id]) as any
    if (!c) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    const r = await solicitarDiagnostico(c.id, actor)
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status })
  }

  if (accion === 'activar') {
    if (!user.is_superadmin) return NextResponse.json({ error: 'Solo el superadmin puede activar el diagnóstico' }, { status: 403 })
    if (!body?.clienteId) return NextResponse.json({ error: 'Falta clienteId' }, { status: 400 })
    const r = await activarDiagnostico(body.clienteId, actor)
    return r.ok
      ? NextResponse.json({ ok: true, documentosEnRevision: r.documentosEnRevision ?? 0 })
      : NextResponse.json({ error: r.error }, { status: r.status })
  }

  if (accion === 'cerrar') {
    if (user.role !== 'admin') return NextResponse.json({ error: 'Solo los administradores pueden cerrar el diagnóstico' }, { status: 403 })
    if (!body?.clienteId) return NextResponse.json({ error: 'Falta clienteId' }, { status: 400 })
    const r = await cerrarDiagnostico(body.clienteId, actor)
    return r.ok
      ? NextResponse.json({ ok: true, pendientesQueSalen: r.pendientesQueSalen ?? 0 })
      : NextResponse.json({ error: r.error }, { status: r.status })
  }

  return NextResponse.json({ error: 'accion inválida (solicitar | activar | cerrar)' }, { status: 400 })
}
