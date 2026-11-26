/**
 * Servicios on demand (solo superadmin) — ver lib/on-demand-db.ts.
 *
 * GET    → lista de servicios con estado de pago y avance
 * POST   → crea un servicio { concepto, monto, cliente_id?, enviar_a? } y devuelve
 *          el enlace /pago/<token> para que el cliente llene sus datos y pague
 * PATCH  → { id, avance?, notas?, marcar_pagado? } seguimiento del servicio
 * DELETE ?id= → elimina un servicio que no esté pagado
 *
 * Ningún pago on demand crea ni activa cuentas (ver crearCobroOnDemand).
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import {
  crearServicio, listarServicios, buscarServicio, actualizarSeguimiento, eliminarServicio, AVANCES, type Avance,
} from '@/lib/on-demand-db'
import { confirmarCobroManual } from '@/lib/trazo-cobros-flujo'

const CORREO_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/
const appUrl = () => (process.env.NEXTAUTH_URL ?? 'https://app.owlcompliance.com').replace(/\/$/, '')
const enlace = (token: string) => `${appUrl()}/pago/${token}`

async function requireSuperadmin() {
  const session = await auth()
  const user = session?.user as any
  return user?.is_superadmin ? user : null
}
const noAutorizado = () => NextResponse.json({ error: 'No autorizado' }, { status: 403 })

export async function GET() {
  if (!await requireSuperadmin()) return noAutorizado()
  const servicios = (await listarServicios()).map(s => ({ ...s, enlace: enlace(s.token) }))
  return NextResponse.json({ servicios })
}

export async function POST(req: Request) {
  const user = await requireSuperadmin()
  if (!user) return noAutorizado()

  const b = await req.json().catch(() => null) ?? {}
  const concepto = String(b.concepto ?? '').trim().slice(0, 200)
  const monto    = Math.round(Number(b.monto))
  const enviarA  = String(b.enviar_a ?? '').trim()

  const errores: string[] = []
  if (concepto.length < 3)                     errores.push('concepto')
  if (!Number.isFinite(monto) || monto < 1000) errores.push('monto')
  if (enviarA && !CORREO_RE.test(enviarA))     errores.push('enviar_a')
  if (errores.length) return NextResponse.json({ error: 'Revisa los campos marcados', campos: errores }, { status: 400 })

  // Cliente existente: se precargan sus datos en el formulario (el cliente puede corregirlos)
  let pre: { empresa?: string; numeroId?: string; correo?: string; nombre?: string } = {}
  if (b.cliente_id) {
    const c = await queryOne<any>(
      `SELECT c.razon_social, c.nit, c.contacto, c.email, u.email AS user_email
         FROM clientes c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?`, [b.cliente_id])
    if (!c) return NextResponse.json({ error: 'Cliente no encontrado', campos: ['cliente_id'] }, { status: 400 })
    pre = { empresa: c.razon_social ?? '', numeroId: c.nit ?? '', correo: c.email || c.user_email || '', nombre: c.contacto ?? '' }
  }

  const servicio = await crearServicio({ concepto, monto, clienteId: b.cliente_id || null, creadoPor: user.email, ...pre })
  const url = enlace(servicio.token)

  let correoEnviado = false
  if (enviarA) {
    const { enviarEmail } = await import('@/lib/email')
    correoEnviado = await enviarEmail({
      to: enviarA,
      subject: `${concepto} — Owl Compliance`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;color:#1a1a1a;">
          <h2 style="color:#712529;">${concepto.replace(/</g, '&lt;')}</h2>
          <p>Para iniciar el servicio, por favor complete sus datos y cuéntenos qué necesita.
          Al terminar podrá pagar en línea (<strong>$${monto.toLocaleString('es-CO')} COP</strong>).</p>
          <p style="margin:24px 0;"><a href="${url}" style="background:#712529;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Completar datos y pagar</a></p>
          <p style="font-size:13px;color:#555;">Si tiene alguna duda, escríbanos a contacto@owlcompliance.com.</p>
        </div>`,
    })
  }

  return NextResponse.json({ ok: true, id: servicio.id, enlace: url, correoEnviado })
}

export async function PATCH(req: Request) {
  if (!await requireSuperadmin()) return noAutorizado()
  const b = await req.json().catch(() => null) ?? {}
  const id = Number(b.id)
  const servicio = Number.isInteger(id) ? await buscarServicio(id) : undefined
  if (!servicio) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })

  if (b.marcar_pagado) {
    if (!servicio.external_reference) return NextResponse.json({ error: 'El cliente aún no ha llenado sus datos: no hay pago que confirmar' }, { status: 400 })
    if (servicio.estado_pago === 'pagada') return NextResponse.json({ error: 'Ya estaba pagado' }, { status: 400 })
    await confirmarCobroManual(servicio.external_reference)
  }

  const campos: { avance?: Avance; notas?: string } = {}
  if (b.avance !== undefined) {
    if (!AVANCES.includes(b.avance)) return NextResponse.json({ error: 'Avance inválido' }, { status: 400 })
    campos.avance = b.avance
  }
  if (typeof b.notas === 'string') campos.notas = b.notas.slice(0, 5000)
  if (campos.avance !== undefined || campos.notas !== undefined) await actualizarSeguimiento(id, campos)

  return NextResponse.json({ ok: true, servicio: await buscarServicio(id) })
}

export async function DELETE(req: NextRequest) {
  if (!await requireSuperadmin()) return noAutorizado()
  const id = Number(req.nextUrl.searchParams.get('id'))
  const servicio = Number.isInteger(id) ? await buscarServicio(id) : undefined
  if (!servicio) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })
  if (servicio.estado_pago === 'pagada') return NextResponse.json({ error: 'Un servicio pagado no se puede eliminar; márcalo como cancelado' }, { status: 400 })
  await eliminarServicio(id)
  return NextResponse.json({ ok: true })
}
