/**
 * GET  /api/mensajeria?canalId=xxx   → mensajes de un canal
 * GET  /api/mensajeria               → lista de canales del admin
 * POST /api/mensajeria               → crear DM o enviar mensaje
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryAll, queryOne, execute } from '@/lib/db'
import crypto from 'crypto'

async function migrate() {
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS chat_admin_canales (
        id         TEXT PRIMARY KEY,
        tipo       TEXT NOT NULL DEFAULT 'directo',
        nombre     TEXT,
        admin_a_id TEXT,
        admin_b_id TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `)
    await execute(`
      CREATE TABLE IF NOT EXISTS chat_admin_mensajes (
        id        TEXT PRIMARY KEY,
        canal_id  TEXT NOT NULL,
        user_id   TEXT NOT NULL,
        contenido TEXT NOT NULL,
        leido_por TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now'))
      )
    `)
    // Canal general: exactamente uno
    const gen = await queryOne(`SELECT id FROM chat_admin_canales WHERE tipo = 'general'`)
    if (!gen) {
      await execute(
        `INSERT INTO chat_admin_canales (id, tipo, nombre) VALUES (?, 'general', 'General')`,
        [crypto.randomUUID()]
      )
    }
  } catch { /* ya existen */ }
}

async function getAdmin() {
  const session = await auth()
  const user = session?.user as any
  if (!user || (user.role !== 'admin' && !user.is_superadmin))
    return null
  return user
}

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  await migrate()

  const canalId = req.nextUrl.searchParams.get('canalId')

  // Mensajes de un canal
  if (canalId) {
    const canal = await queryOne(`SELECT * FROM chat_admin_canales WHERE id = ?`, [canalId]) as any
    if (!canal) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    // Solo puede acceder si es participante del canal (o es general)
    if (canal.tipo === 'directo' && canal.admin_a_id !== user.id && canal.admin_b_id !== user.id)
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

    const mensajes = await queryAll(`
      SELECT m.*, u.nombre AS autor_nombre, u.email AS autor_email
      FROM chat_admin_mensajes m
      JOIN users u ON u.id = m.user_id
      WHERE m.canal_id = ?
      ORDER BY m.created_at ASC
    `, [canalId])

    // Marcar como leídos (guardar userId en leido_por JSON)
    for (const m of mensajes as any[]) {
      try {
        const leidos: string[] = JSON.parse(m.leido_por ?? '[]')
        if (!leidos.includes(user.id)) {
          leidos.push(user.id)
          await execute(`UPDATE chat_admin_mensajes SET leido_por = ? WHERE id = ?`,
            [JSON.stringify(leidos), m.id])
        }
      } catch { /* ignore */ }
    }

    return NextResponse.json({ canal, mensajes })
  }

  // Lista de canales
  const general = await queryOne(`SELECT * FROM chat_admin_canales WHERE tipo = 'general'`) as any

  const directos = await queryAll(`
    SELECT c.*,
           ua.nombre AS nombre_a, ua.email AS email_a,
           ub.nombre AS nombre_b, ub.email AS email_b,
           (SELECT COUNT(*) FROM chat_admin_mensajes m
            WHERE m.canal_id = c.id
              AND m.user_id != ?
              AND (m.leido_por IS NULL OR m.leido_por NOT LIKE ?)
           ) AS no_leidos
    FROM chat_admin_canales c
    LEFT JOIN users ua ON ua.id = c.admin_a_id
    LEFT JOIN users ub ON ub.id = c.admin_b_id
    WHERE c.tipo = 'directo'
      AND (c.admin_a_id = ? OR c.admin_b_id = ?)
    ORDER BY c.updated_at DESC
  `, [user.id, `%${user.id}%`, user.id, user.id]) as any[]

  // Mensajes no leídos del general
  const noLeidosGen = await queryOne(`
    SELECT COUNT(*) AS cnt FROM chat_admin_mensajes
    WHERE canal_id = ? AND user_id != ?
      AND (leido_por IS NULL OR leido_por NOT LIKE ?)
  `, [general?.id, user.id, `%${user.id}%`]) as any

  return NextResponse.json({
    general: general ? { ...general, no_leidos: noLeidosGen?.cnt ?? 0 } : null,
    directos,
  })
}

// ── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  await migrate()

  const body = await req.json()

  // Crear o abrir DM con otro admin
  if (body.accion === 'abrir_dm') {
    const { adminId } = body
    if (!adminId || adminId === user.id)
      return NextResponse.json({ error: 'adminId inválido' }, { status: 400 })

    const destino = await queryOne(`SELECT id, nombre FROM users WHERE id = ? AND activo = 1`, [adminId]) as any
    if (!destino) return NextResponse.json({ error: 'Admin no encontrado' }, { status: 404 })

    // Buscar DM existente en ambas direcciones
    let canal = await queryOne(`
      SELECT * FROM chat_admin_canales
      WHERE tipo = 'directo'
        AND ((admin_a_id = ? AND admin_b_id = ?) OR (admin_a_id = ? AND admin_b_id = ?))
    `, [user.id, adminId, adminId, user.id]) as any

    if (!canal) {
      const id = crypto.randomUUID()
      await execute(`
        INSERT INTO chat_admin_canales (id, tipo, admin_a_id, admin_b_id)
        VALUES (?, 'directo', ?, ?)
      `, [id, user.id, adminId])
      canal = { id, tipo: 'directo', admin_a_id: user.id, admin_b_id: adminId }
    }

    return NextResponse.json({ canalId: canal.id })
  }

  // Enviar mensaje
  if (body.accion === 'mensaje') {
    const { canalId, contenido } = body
    if (!canalId || !contenido?.trim())
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })

    const canal = await queryOne(`SELECT * FROM chat_admin_canales WHERE id = ?`, [canalId]) as any
    if (!canal) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

    if (canal.tipo === 'directo' && canal.admin_a_id !== user.id && canal.admin_b_id !== user.id)
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

    const id = crypto.randomUUID()
    await execute(`
      INSERT INTO chat_admin_mensajes (id, canal_id, user_id, contenido, leido_por)
      VALUES (?, ?, ?, ?, ?)
    `, [id, canalId, user.id, contenido.trim(), JSON.stringify([user.id])])

    await execute(`UPDATE chat_admin_canales SET updated_at = datetime('now') WHERE id = ?`, [canalId])

    return NextResponse.json({ ok: true, id })
  }

  return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })
}
