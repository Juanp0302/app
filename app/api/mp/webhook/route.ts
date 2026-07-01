/**
 * POST /api/mp/webhook
 * Recibe notificaciones de Mercado Pago para suscripciones.
 * URL en panel MP: https://owlcompliance.onrender.com/api/mp/webhook
 */
import { NextRequest, NextResponse } from 'next/server'
import { queryOne, execute } from '@/lib/db'
import { obtenerSuscripcion, obtenerPago } from '@/lib/mercadopago'
import { migrateSuscripcion, PLANES, PlanKey } from '@/lib/suscripcion'
import { notificarSuscripcion, notificarBienvenida } from '@/lib/notificaciones'
import crypto from 'crypto'

function addDays(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function hashPassword(pwd: string) {
  return crypto.createHash('sha256').update(pwd + 'owl_salt_2026').digest('hex')
}

function uuid() { return crypto.randomUUID() }

/** Genera una contraseña temporal legible */
function generarPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pwd = 'Owl'
  for (let i = 0; i < 5; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
  pwd += '!'
  return pwd
}

/**
 * Crea una cuenta nueva para un cliente que pagó desde el sitio web.
 * Retorna el clienteId creado.
 */
async function crearCuentaNueva(opts: {
  email:     string
  nombre:    string
  planKey:   PlanKey
  mpSubId:   string
}): Promise<string> {
  // Verificar si ya existe
  const existe = await queryOne('SELECT id FROM users WHERE email = ?', [opts.email])
  if (existe) {
    // Ya tiene cuenta — solo actualizar plan si es cliente
    const cliente = await queryOne(
      `SELECT c.id FROM clientes c JOIN users u ON u.id = c.user_id WHERE u.email = ?`,
      [opts.email]
    ) as any
    if (cliente) {
      await execute(
        `UPDATE clientes SET plan = ?, suscripcion_estado = 'activa',
         mp_subscription_id = ?, suscripcion_vencimiento = ?,
         tickets_mes = 0, chats_mes = 0, conteo_reset_at = strftime('%Y-%m','now')
         WHERE id = ?`,
        [opts.planKey, opts.mpSubId, addDays(30), cliente.id]
      )
      return cliente.id
    }
    return ''
  }

  const password   = generarPassword()
  const userId     = uuid()
  const clienteId  = uuid()
  const fecha      = new Date().toLocaleString('es-CO')

  const stmts = [
    {
      sql:  `INSERT INTO users (id, email, password, nombre, rol) VALUES (?,?,?,?,'cliente')`,
      args: [userId, opts.email, hashPassword(password), opts.nombre],
    },
    {
      sql:  `INSERT INTO clientes (id, user_id, razon_social, plan, suscripcion_estado,
             mp_subscription_id, suscripcion_vencimiento, suscripcion_inicio,
             tickets_mes, chats_mes, conteo_reset_at)
             VALUES (?,?,?,?,        'activa',
             ?,                      ?,                    datetime('now'),
             0,          0,         strftime('%Y-%m','now'))`,
      args: [clienteId, userId, opts.nombre, opts.planKey, opts.mpSubId, addDays(30)],
    },
  ]

  // Usar db.batch para la transacción
  const { db } = await import('@/lib/db')
  await db.batch(stmts, 'write')

  // Enviar email de bienvenida con credenciales
  try {
    await notificarBienvenida({
      clienteEmail:  opts.email,
      clienteNombre: opts.nombre,
      password,
      plan:          opts.planKey,
      fecha,
    })
  } catch (e) {
    console.error('[webhook] Error enviando bienvenida:', e)
  }

  return clienteId
}

async function getCliente(clienteId: string) {
  return queryOne(
    `SELECT c.id, c.plan, c.razon_social, u.email
     FROM clientes c JOIN users u ON u.id = c.user_id
     WHERE c.id = ?`,
    [clienteId]
  ) as Promise<any>
}

async function handlePreapproval(mpId: string) {
  await migrateSuscripcion()
  const sub = await obtenerSuscripcion(mpId)

  const ref = sub.external_reference as string | undefined
  if (!ref) return

  const ESTADO: Record<string, string> = {
    authorized: 'activa',
    pending:    'trial',
    paused:     'suspendida',
    cancelled:  'cancelada',
  }
  const nuevoEstado = ESTADO[sub.status as string] ?? 'suspendida'
  const fecha       = new Date().toLocaleString('es-CO')

  // ── Nuevo cliente desde el sitio web (external_reference = "new:basico") ──
  if (ref.startsWith('new:') && nuevoEstado === 'activa') {
    const planKey   = ref.replace('new:', '') as PlanKey
    if (!PLANES[planKey]) return

    const payerEmail = (sub.payer_email ?? sub.payer?.email ?? '') as string
    if (!payerEmail) return

    const nombre = [sub.payer?.first_name, sub.payer?.last_name]
      .filter(Boolean).join(' ') || payerEmail.split('@')[0]

    await crearCuentaNueva({ email: payerEmail, nombre, planKey, mpSubId: mpId })
    return
  }

  // ── Cliente existente (external_reference = clienteId UUID) ──
  const cliente = await getCliente(ref)
  if (!cliente) return

  if (nuevoEstado === 'activa') {
    await execute(
      `UPDATE clientes
       SET mp_subscription_id      = ?,
           suscripcion_estado       = 'activa',
           suscripcion_inicio       = datetime('now'),
           suscripcion_vencimiento  = ?,
           tickets_mes              = 0,
           chats_mes                = 0,
           conteo_reset_at          = strftime('%Y-%m', 'now')
       WHERE id = ?`,
      [mpId, addDays(30), ref]
    )
  } else {
    await execute(
      `UPDATE clientes SET suscripcion_estado = ? WHERE id = ?`,
      [nuevoEstado, ref]
    )
  }

  try {
    await notificarSuscripcion({
      clienteId:    ref,
      cliente:      cliente.razon_social,
      clienteEmail: cliente.email,
      plan:         cliente.plan ?? '—',
      estado:       nuevoEstado,
      fecha,
    })
  } catch {}
}

async function handlePayment(paymentId: string) {
  await migrateSuscripcion()
  const pago = await obtenerPago(paymentId)

  if (pago.status !== 'approved') return
  const ref = pago.external_reference as string | undefined
  if (!ref || ref.startsWith('new:')) return   // nuevo cliente ya se maneja en preapproval

  const cliente = await getCliente(ref)
  if (!cliente) return

  await execute(
    `UPDATE clientes
     SET suscripcion_estado      = 'activa',
         suscripcion_vencimiento = ?,
         tickets_mes             = 0,
         chats_mes               = 0,
         conteo_reset_at         = strftime('%Y-%m', 'now')
     WHERE id = ?`,
    [addDays(30), ref]
  )

  try {
    await notificarSuscripcion({
      clienteId:    ref,
      cliente:      cliente.razon_social,
      clienteEmail: cliente.email,
      plan:         cliente.plan ?? '—',
      estado:       'activa',
      fecha:        new Date().toLocaleString('es-CO'),
    })
  } catch {}
}

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()
    const tipo   = body.type     as string | undefined
    const dataId = body.data?.id as string | undefined

    if (!tipo || !dataId) return NextResponse.json({ ok: true })

    if (tipo === 'subscription_preapproval') {
      await handlePreapproval(dataId)
    } else if (tipo === 'payment' || tipo === 'subscription_authorized_payment') {
      await handlePayment(dataId)
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[mp/webhook]', err?.message ?? err)
    return NextResponse.json({ ok: true })
  }
}
