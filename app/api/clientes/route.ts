/**
 * GET  /api/clientes          — Lista todos los clientes con estadísticas
 * POST /api/clientes          — Crea un cliente nuevo
 * PATCH /api/clientes?id=xxx  — Actualiza datos o agrega servicio
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import crypto from 'crypto'

function hashPassword(pwd: string) {
  return crypto.createHash('sha256').update(pwd + 'owl_salt_2026').digest('hex')
}

function uuid() { return crypto.randomUUID() }

// Solo admin puede usar estas rutas
async function requireAdmin() {
  const session = await auth()
  if (!session?.user) return null
  const user = session.user as any
  if (user.role !== 'admin') return null
  return user
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const clientes = db.prepare(`
    SELECT
      c.id, c.razon_social, c.nit, c.contacto, c.email, c.telefono, c.activo, c.created_at,
      u.email      AS user_email,
      u.nombre     AS user_nombre,
      u.activo     AS user_activo,
      GROUP_CONCAT(cs.servicio, ',') AS servicios,
      COUNT(co.id)                                             AS total_obl,
      SUM(CASE WHEN co.estado = 'cumplida'    THEN 1 ELSE 0 END) AS cumplidas,
      SUM(CASE WHEN co.estado = 'vencida'     THEN 1 ELSE 0 END) AS vencidas,
      SUM(CASE WHEN co.estado = 'pendiente'   THEN 1 ELSE 0 END) AS pendientes,
      SUM(CASE WHEN co.estado = 'en_progreso' THEN 1 ELSE 0 END) AS en_progreso
    FROM clientes c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN cliente_servicios cs ON cs.cliente_id = c.id AND cs.activo = 1
    LEFT JOIN cliente_obligaciones co ON co.cliente_id = c.id
    GROUP BY c.id
    ORDER BY c.razon_social
  `).all() as any[]

  // Parsear servicios y calcular %
  const result = clientes.map(c => ({
    ...c,
    servicios: c.servicios ? c.servicios.split(',') : [],
    pct: c.total_obl ? Math.round((c.cumplidas / c.total_obl) * 100) : 0,
  }))

  return NextResponse.json(result)
}

// ─── POST — Crear cliente ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const {
    razon_social, nit, contacto, email, telefono,
    user_email, user_nombre, user_password,
    servicios,   // array de slugs
  } = body

  if (!razon_social || !user_email || !user_nombre || !user_password || !servicios?.length) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // Verificar email único
  const existe = db.prepare('SELECT id FROM users WHERE email = ?').get(user_email)
  if (existe) return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 })

  const userId    = uuid()
  const clienteId = uuid()

  const crear = db.transaction(() => {
    // Usuario
    db.prepare(`INSERT INTO users (id, email, password, nombre, rol) VALUES (?,?,?,?,'cliente')`)
      .run(userId, user_email, hashPassword(user_password), user_nombre)

    // Empresa
    db.prepare(`
      INSERT INTO clientes (id, user_id, razon_social, nit, contacto, email, telefono)
      VALUES (?,?,?,?,?,?,?)
    `).run(clienteId, userId, razon_social, nit ?? null,
           contacto ?? null, email ?? null, telefono ?? null)

    // Servicios y obligaciones
    let totalObl = 0
    for (const slug of servicios) {
      db.prepare(`INSERT OR IGNORE INTO cliente_servicios (id, cliente_id, servicio) VALUES (?,?,?)`)
        .run(uuid(), clienteId, slug)

      const subs = db.prepare(
        'SELECT sub_id FROM obligaciones_catalogo WHERE servicio_slug = ?'
      ).all(slug) as { sub_id: number }[]

      for (const { sub_id } of subs) {
        db.prepare(`
          INSERT OR IGNORE INTO cliente_obligaciones (id, cliente_id, catalogo_id, estado)
          VALUES (?,?,?,'pendiente')
        `).run(uuid(), clienteId, sub_id)
      }
      totalObl += subs.length
    }

    return { clienteId, totalObl }
  })

  const { totalObl } = crear()

  return NextResponse.json({ ok: true, clienteId, totalObl }, { status: 201 })
}

// ─── PATCH — Agregar servicio a cliente existente ─────────────────────────────

export async function PATCH(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const clienteId = req.nextUrl.searchParams.get('id')
  if (!clienteId) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const body = await req.json()

  // Actualizar datos básicos
  if (body.datos) {
    const { razon_social, nit, contacto, email, telefono } = body.datos
    db.prepare(`
      UPDATE clientes SET razon_social=?, nit=?, contacto=?, email=?, telefono=?, updated_at=datetime('now')
      WHERE id=?
    `).run(razon_social, nit ?? null, contacto ?? null, email ?? null, telefono ?? null, clienteId)
  }

  // Agregar nuevo servicio
  if (body.nuevo_servicio) {
    const slug = body.nuevo_servicio
    const yaExiste = db.prepare(
      'SELECT id FROM cliente_servicios WHERE cliente_id=? AND servicio=? AND activo=1'
    ).get(clienteId, slug)
    if (yaExiste) return NextResponse.json({ error: 'El cliente ya tiene ese servicio' }, { status: 409 })

    db.prepare(`INSERT INTO cliente_servicios (id, cliente_id, servicio) VALUES (?,?,?)`)
      .run(uuid(), clienteId, slug)

    const subs = db.prepare(
      'SELECT sub_id FROM obligaciones_catalogo WHERE servicio_slug = ?'
    ).all(slug) as { sub_id: number }[]

    for (const { sub_id } of subs) {
      db.prepare(`
        INSERT OR IGNORE INTO cliente_obligaciones (id, cliente_id, catalogo_id, estado)
        VALUES (?,?,?,'pendiente')
      `).run(uuid(), clienteId, sub_id)
    }

    return NextResponse.json({ ok: true, nuevasObligaciones: subs.length })
  }

  return NextResponse.json({ ok: true })
}
