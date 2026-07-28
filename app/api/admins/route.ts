import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUserFromRequest } from '@/lib/auth-any'
import { queryOne, queryAll, execute, db } from '@/lib/db'
import crypto from 'crypto'
import { hashPassword } from '@/lib/password'

async function requireAdmin() {
  const session = await auth()
  if (!session?.user) return null
  return (session.user as any).role === 'admin' ? (session.user as any) : null
}

async function requireSuperadmin() {
  const session = await auth()
  const user = session?.user as any
  return user?.is_superadmin ? user : null
}

// GET admite sesión web o token móvil (para el selector de reasignación en la app).
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admins = await queryAll(
    `SELECT id, email, nombre, activo, created_at FROM users WHERE rol = 'admin' ORDER BY created_at`
  )
  return NextResponse.json(admins)
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { email, nombre, password } = await req.json()
  if (!email || !nombre || !password)
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })

  const existe = await queryOne('SELECT id FROM users WHERE email = ?', [email])
  if (existe) return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 })

  const id = crypto.randomUUID()
  await execute(
    `INSERT INTO users (id, email, password, nombre, rol) VALUES (?, ?, ?, ?, 'admin')`,
    [id, email, await hashPassword(password), nombre]
  )
  return NextResponse.json({ ok: true, id }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  // No permitir desactivarse a sí mismo
  if (id === user.id) return NextResponse.json({ error: 'No puedes modificar tu propia cuenta' }, { status: 400 })

  const body = await req.json()

  // Toggle activo
  if (typeof body.activo !== 'undefined') {
    await execute(`UPDATE users SET activo = ? WHERE id = ? AND rol = 'admin'`, [body.activo ? 1 : 0, id])
    return NextResponse.json({ ok: true })
  }

  // Editar datos del administrador
  const { nombre, email, password } = body
  if (!nombre || !email)
    return NextResponse.json({ error: 'Nombre y email son requeridos' }, { status: 400 })

  // Verificar que el email no esté en uso por otro usuario
  const ocupado = await queryOne('SELECT id FROM users WHERE email = ? AND id != ?', [email, id])
  if (ocupado) return NextResponse.json({ error: 'Ese email ya está registrado por otro usuario' }, { status: 409 })

  if (password) {
    if (password.length < 8)
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
    await execute(
      `UPDATE users SET nombre = ?, email = ?, password = ? WHERE id = ? AND rol = 'admin'`,
      [nombre, email, await hashPassword(password), id]
    )
  } else {
    await execute(
      `UPDATE users SET nombre = ?, email = ? WHERE id = ? AND rol = 'admin'`,
      [nombre, email, id]
    )
  }
  return NextResponse.json({ ok: true })
}

/**
 * DELETE /api/admins?id=...
 * Solo superadmin. Bloquea el borrado si el admin tiene contenido que
 * autoró de verdad (documentos, mensajes, respuestas de ticket) — ahí
 * la recomendación es desactivarlo, no borrarlo, para no perder historial.
 */
export async function DELETE(req: NextRequest) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'Solo superadmin puede eliminar administradores' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  if (id === user.id) return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 400 })

  const admin = await queryOne(`SELECT id FROM users WHERE id = ? AND rol = 'admin'`, [id])
  if (!admin) return NextResponse.json({ error: 'Administrador no encontrado' }, { status: 404 })

  const [docs, mensajes, respuestas] = await Promise.all([
    queryOne('SELECT id FROM documentos WHERE uploaded_by = ?', [id]),
    queryOne('SELECT id FROM mensajes WHERE user_id = ?', [id]),
    queryOne('SELECT id FROM ticket_respuestas WHERE user_id = ?', [id]),
  ])
  if (docs || mensajes || respuestas) {
    return NextResponse.json({
      error: 'Este administrador tiene documentos, mensajes o respuestas registradas. No se puede eliminar sin perder ese historial — desactívalo en su lugar.',
    }, { status: 409 })
  }

  try {
    await db.batch([
      { sql: `UPDATE tickets SET admin_id = NULL WHERE admin_id = ?`, args: [id] },
      { sql: `UPDATE conversaciones SET admin_id = NULL WHERE admin_id = ?`, args: [id] },
      { sql: `DELETE FROM admin_especialidades WHERE user_id = ?`, args: [id] },
      { sql: `DELETE FROM push_tokens WHERE user_id = ?`, args: [id] },
      { sql: `DELETE FROM reasignaciones WHERE user_id = ? OR de_admin_id = ? OR a_admin_id = ?`, args: [id, id, id] },
      { sql: `DELETE FROM users WHERE id = ?`, args: [id] },
    ], 'write')

    // Sacarlo de las reglas de asignación automática (admin_ids es un JSON array en texto)
    const reglas = await queryAll('SELECT tipo, especialidad, admin_ids FROM asignacion_config') as any[]
    for (const r of reglas) {
      const ids = JSON.parse(r.admin_ids || '[]') as string[]
      if (ids.includes(id)) {
        await execute(
          `UPDATE asignacion_config SET admin_ids = ? WHERE tipo = ? AND especialidad = ?`,
          [JSON.stringify(ids.filter(x => x !== id)), r.tipo, r.especialidad]
        )
      }
    }
  } catch (e: any) {
    console.error('[DELETE /api/admins] Error:', e)
    return NextResponse.json({ error: 'Error al eliminar: ' + (e?.message ?? 'ver logs del servidor') }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
