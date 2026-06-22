import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, queryOne, queryAll, execute } from '@/lib/db'
import crypto from 'crypto'

function hashPassword(pwd: string) { return crypto.createHash('sha256').update(pwd + 'owl_salt_2026').digest('hex') }
function uuid() { return crypto.randomUUID() }

async function requireAdmin() {
  const session = await auth()
  if (!session?.user) return null
  const user = session.user as any
  return user.role === 'admin' ? user : null
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const clientes = await queryAll(`
    SELECT c.id, c.razon_social, c.nit, c.contacto, c.email, c.telefono, c.activo, c.created_at,
           u.email AS user_email, u.nombre AS user_nombre, u.activo AS user_activo,
           GROUP_CONCAT(cs.servicio, ',') AS servicios,
           COUNT(co.id)                                              AS total_obl,
           SUM(CASE WHEN co.estado = 'cumplida'    THEN 1 ELSE 0 END) AS cumplidas,
           SUM(CASE WHEN co.estado = 'vencida'     THEN 1 ELSE 0 END) AS vencidas,
           SUM(CASE WHEN co.estado = 'pendiente'   THEN 1 ELSE 0 END) AS pendientes,
           SUM(CASE WHEN co.estado = 'en_progreso' THEN 1 ELSE 0 END) AS en_progreso
    FROM clientes c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN cliente_servicios cs ON cs.cliente_id = c.id AND cs.activo = 1
    LEFT JOIN cliente_obligaciones co ON co.cliente_id = c.id
    GROUP BY c.id ORDER BY c.razon_social
  `)

  // Tiempo promedio de respuesta en tickets por cliente (horas hasta primera respuesta de admin)
  const ticketTiempos = await queryAll(`
    SELECT t.cliente_id,
           AVG((JULIANDAY(pr.created_at) - JULIANDAY(t.created_at)) * 24) AS avg_horas
    FROM tickets t
    JOIN (
      SELECT r.ticket_id, MIN(r.created_at) AS created_at
      FROM ticket_respuestas r
      JOIN users u ON u.id = r.user_id AND u.rol = 'admin'
      GROUP BY r.ticket_id
    ) pr ON pr.ticket_id = t.id
    GROUP BY t.cliente_id
  `)

  // Tiempo promedio de respuesta en chats por cliente
  const chatTiempos = await queryAll(`
    SELECT cv.cliente_id,
           AVG((JULIANDAY(pm.created_at) - JULIANDAY(cv.created_at)) * 24) AS avg_horas
    FROM conversaciones cv
    JOIN (
      SELECT m.conversacion_id, MIN(m.created_at) AS created_at
      FROM mensajes m
      JOIN users u ON u.id = m.user_id AND u.rol = 'admin'
      GROUP BY m.conversacion_id
    ) pm ON pm.conversacion_id = cv.id
    GROUP BY cv.cliente_id
  `)

  const ttMap: Record<string, number | null> = {}
  for (const r of ticketTiempos as any[]) ttMap[(r as any).cliente_id] = (r as any).avg_horas
  const ctMap: Record<string, number | null> = {}
  for (const r of chatTiempos as any[])  ctMap[(r as any).cliente_id] = (r as any).avg_horas

  const result = (clientes as any[]).map(c => ({
    ...c,
    servicios: c.servicios ? c.servicios.split(',') : [],
    pct: c.total_obl ? Math.round((c.cumplidas / c.total_obl) * 100) : 0,
    avg_horas_ticket: ttMap[c.id] ?? null,
    avg_horas_chat:   ctMap[c.id] ?? null,
  }))
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { razon_social, nit, contacto, email, telefono, user_email, user_nombre, user_password, servicios } = body

  if (!razon_social || !user_email || !user_nombre || !user_password || !servicios?.length) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const existe = await queryOne('SELECT id FROM users WHERE email = ?', [user_email])
  if (existe) return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 })

  const userId    = uuid()
  const clienteId = uuid()

  // Construir el batch de inserts
  const stmts: { sql: string; args: any[] }[] = [
    { sql: `INSERT INTO users (id, email, password, nombre, rol) VALUES (?,?,?,?,'cliente')`, args: [userId, user_email, hashPassword(user_password), user_nombre] },
    { sql: `INSERT INTO clientes (id, user_id, razon_social, nit, contacto, email, telefono) VALUES (?,?,?,?,?,?,?)`, args: [clienteId, userId, razon_social, nit ?? null, contacto ?? null, email ?? null, telefono ?? null] },
  ]

  let totalObl = 0
  for (const slug of servicios) {
    stmts.push({ sql: `INSERT OR IGNORE INTO cliente_servicios (id, cliente_id, servicio) VALUES (?,?,?)`, args: [uuid(), clienteId, slug] })
    const subs = await queryAll('SELECT sub_id FROM obligaciones_catalogo WHERE servicio_slug = ?', [slug])
    for (const s of subs as any[]) {
      stmts.push({ sql: `INSERT OR IGNORE INTO cliente_obligaciones (id, cliente_id, catalogo_id, estado) VALUES (?,?,?,'pendiente')`, args: [uuid(), clienteId, s.sub_id] })
      totalObl++
    }
  }

  await db.batch(stmts, 'write')
  return NextResponse.json({ ok: true, clienteId, totalObl }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const clienteId = req.nextUrl.searchParams.get('id')
  if (!clienteId) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const body = await req.json()

  if (body.datos) {
    const { razon_social, nit, contacto, email, telefono, user_nombre, user_email, user_password } = body.datos
    await execute(`UPDATE clientes SET razon_social=?, nit=?, contacto=?, email=?, telefono=?, updated_at=datetime('now') WHERE id=?`,
      [razon_social, nit ?? null, contacto ?? null, email ?? null, telefono ?? null, clienteId])

    // Actualizar datos del usuario asociado si se proporcionan
    if (user_nombre || user_email || user_password) {
      const cliente = await queryOne('SELECT user_id FROM clientes WHERE id = ?', [clienteId])
      if (cliente) {
        const userId = (cliente as any).user_id
        if (user_email) {
          const ocupado = await queryOne('SELECT id FROM users WHERE email = ? AND id != ?', [user_email, userId])
          if (ocupado) return NextResponse.json({ error: 'Ese email de usuario ya está registrado' }, { status: 409 })
        }
        if (user_password && user_password.length < 8)
          return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })

        const sets: string[] = []
        const vals: any[]    = []
        if (user_nombre)   { sets.push('nombre = ?');   vals.push(user_nombre) }
        if (user_email)    { sets.push('email = ?');    vals.push(user_email) }
        if (user_password) { sets.push('password = ?'); vals.push(hashPassword(user_password)) }
        if (sets.length)
          await execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...vals, userId])
      }
    }
  }

  if (body.nuevo_servicio) {
    const slug    = body.nuevo_servicio
    const yaExiste = await queryOne('SELECT id FROM cliente_servicios WHERE cliente_id=? AND servicio=? AND activo=1', [clienteId, slug])
    if (yaExiste) return NextResponse.json({ error: 'El cliente ya tiene ese servicio' }, { status: 409 })

    const subs   = await queryAll('SELECT sub_id FROM obligaciones_catalogo WHERE servicio_slug = ?', [slug])
    const stmts: { sql: string; args: any[] }[] = [
      { sql: `INSERT INTO cliente_servicios (id, cliente_id, servicio) VALUES (?,?,?)`, args: [uuid(), clienteId, slug] },
      ...((subs as any[]).map(s => ({ sql: `INSERT OR IGNORE INTO cliente_obligaciones (id, cliente_id, catalogo_id, estado) VALUES (?,?,?,'pendiente')`, args: [uuid(), clienteId, s.sub_id] }))),
    ]
    await db.batch(stmts, 'write')
    return NextResponse.json({ ok: true, nuevasObligaciones: subs.length })
  }

  return NextResponse.json({ ok: true })
}
