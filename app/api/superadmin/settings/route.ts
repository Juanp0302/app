/**
 * GET  /api/superadmin/settings  → { auto_cuenta_cobro: boolean }
 * PATCH /api/superadmin/settings → body { auto_cuenta_cobro: boolean }
 * Solo superadmin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { execute, queryOne } from '@/lib/db'

async function requireSuperadmin() {
  const session = await auth()
  const user = session?.user as any
  return user?.is_superadmin ? user : null
}

async function ensureTable() {
  try {
    await execute(`CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT)`)
  } catch { /* already exists */ }
}

export async function GET() {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  await ensureTable()

  const row = await queryOne(`SELECT value FROM app_settings WHERE key = 'auto_cuenta_cobro'`) as any
  const auto_cuenta_cobro = row ? row.value === 'true' : false

  return NextResponse.json({ auto_cuenta_cobro })
}

export async function PATCH(req: NextRequest) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  await ensureTable()

  const body = await req.json()
  if (typeof body.auto_cuenta_cobro !== 'undefined') {
    await execute(
      `INSERT INTO app_settings (key, value) VALUES ('auto_cuenta_cobro', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [body.auto_cuenta_cobro ? 'true' : 'false']
    )
  }

  return NextResponse.json({ ok: true })
}
