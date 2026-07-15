/**
 * POST /api/mp/webhook
 * Recibe notificaciones de Mercado Pago para suscripciones.
 * URL en panel MP: https://owlcompliance.onrender.com/api/mp/webhook
 */
import { NextRequest, NextResponse } from 'next/server'
import { db, queryOne, execute } from '@/lib/db'
import { obtenerSuscripcion, obtenerPago } from '@/lib/mercadopago'
import { migrateSuscripcion, PLANES, PlanKey } from '@/lib/suscripcion'
import { notificarSuscripcion, notificarBienvenida } from '@/lib/notificaciones'
import crypto from 'crypto'

function addDays(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Añade 1 mes exacto preservando el día del ciclo.
 *  Si el vencimiento actual es futuro, extiende desde ahí.
 *  Si es pasado o null, extiende desde hoy.
 */
function siguienteVencimiento(vencimientoActual: string | null): string {
  const base = vencimientoActual && new Date(vencimientoActual) > new Date()
    ? new Date(vencimientoActual)
    : new Date()
  base.setMonth(base.getMonth() + 1)
  return base.toISOString().slice(0, 10)
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
    `SELECT c.id, c.plan, c.razon_social, c.suscripcion_vencimiento, u.email
     FROM clientes c JOIN users u ON u.id = c.user_id
     WHERE c.id = ?`,
    [clienteId]
  ) as Promise<any>
}

async function handlePreapproval(mpId: string) {
  await migrateSuscripcion()
  const sub = await obtenerSuscripcion(mpId)

  console.log('[mp/webhook] preapproval status=%s ref=%s payer=%s raw=%s',
    sub.status, sub.external_reference, sub.payer_email ?? sub.payer?.email, JSON.stringify(sub))

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

  // ── Nuevo cliente desde el sitio web (external_reference = "new:basico:email") ──
  if (ref.startsWith('new:') && nuevoEstado === 'activa') {
    const partes  = ref.split(':')           // ['new', 'basico', 'correo@...']
    const planKey = partes[1] as PlanKey
    const email   = partes.slice(2).join(':') // reconstruir email (tiene ":")
    if (!PLANES[planKey]) return

    const payerEmail = email || (sub.payer_email ?? sub.payer?.email ?? '') as string
    if (!payerEmail) return

    const nombre = [sub.payer?.first_name, sub.payer?.last_name]
      .filter(Boolean).join(' ') || payerEmail.split('@')[0]

    await crearCuentaNueva({ email: payerEmail, nombre, planKey, mpSubId: mpId })
    return
  }

  // ── Cliente existente por email (external_reference = "planKey:email") ──
  // Formato usado por el checkout público cuando el cliente ya existe (firmó contrato)
  if (ref.includes(':') && !ref.startsWith('new:')) {
    const colonIdx = ref.indexOf(':')
    const planKey  = ref.slice(0, colonIdx) as PlanKey
    const email    = ref.slice(colonIdx + 1)
    if (PLANES[planKey] && email) {
      const clientePorEmail = await queryOne(
        `SELECT c.id, c.suscripcion_vencimiento, c.razon_social, u.email
         FROM clientes c JOIN users u ON u.id = c.user_id
         WHERE u.email = ?`,
        [email]
      ) as any
      if (clientePorEmail && nuevoEstado === 'activa') {
        const nuevoVenc = siguienteVencimiento(clientePorEmail.suscripcion_vencimiento)
        await execute(
          `UPDATE clientes
           SET mp_subscription_id     = ?,
               suscripcion_estado      = 'activa',
               plan                   = ?,
               suscripcion_vencimiento = ?,
               tickets_mes             = 0,
               chats_mes               = 0,
               conteo_reset_at         = strftime('%Y-%m', 'now')
           WHERE id = ?`,
          [mpId, planKey, nuevoVenc, clientePorEmail.id]
        )
      }
      return
    }
  }

  // ── Cliente existente (external_reference = clienteId UUID) ──
  const cliente = await getCliente(ref)
  if (!cliente) return

  if (nuevoEstado === 'activa') {
    const nuevoVenc = siguienteVencimiento(cliente.suscripcion_vencimiento ?? null)
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
      [mpId, nuevoVenc, ref]
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

  console.log('[mp/webhook] pago status=%s status_detail=%s ref=%s raw=%s',
    pago.status, pago.status_detail, pago.external_reference, JSON.stringify(pago))

  if (pago.status !== 'approved') return
  const ref = pago.external_reference as string | undefined
  if (!ref || ref.startsWith('new:')) return   // nuevo cliente ya se maneja en preapproval

  const cliente = await getCliente(ref)
  if (!cliente) return

  const nuevoVenc = siguienteVencimiento(cliente.suscripcion_vencimiento ?? null)

  await execute(
    `UPDATE clientes
     SET suscripcion_estado      = 'activa',
         suscripcion_vencimiento = ?,
         tickets_mes             = 0,
         chats_mes               = 0,
         conteo_reset_at         = strftime('%Y-%m', 'now')
     WHERE id = ?`,
    [nuevoVenc, ref]
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

    // Log completo para diagnóstico en Render
    console.log('[mp/webhook] RECIBIDO tipo=%s dataId=%s body=%s', tipo, dataId, JSON.stringify(body))

    if (!tipo || !dataId) {
      console.log('[mp/webhook] Ignorado — sin tipo o dataId')
      return NextResponse.json({ ok: true })
    }

    if (tipo === 'subscription_preapproval') {
      console.log('[mp/webhook] Procesando preapproval id=%s', dataId)
      await handlePreapproval(dataId)
    } else if (tipo === 'payment' || tipo === 'subscription_authorized_payment') {
      console.log('[mp/webhook] Procesando pago id=%s', dataId)
      await handlePayment(dataId)
    } else {
      console.log('[mp/webhook] Tipo no manejado: %s', tipo)
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[mp/webhook] ERROR', err?.message ?? err)
    return NextResponse.json({ ok: true })
  }
}
