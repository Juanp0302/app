/**
 * GET  /api/storage/config?clienteId=xxx
 * PATCH /api/storage/config
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryOne, execute } from '@/lib/db'

async function requireAdmin() {
  const session = await auth()
  if (!session?.user) return null
  const user = session.user as any
  return user.role === 'admin' ? user : null
}

export async function GET(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const clienteId = req.nextUrl.searchParams.get('clienteId')
  if (!clienteId) return NextResponse.json({ error: 'clienteId requerido' }, { status: 400 })

  const row = await queryOne('SELECT storage_type, storage_config FROM clientes WHERE id = ?', [clienteId])
  if (!row) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  let cfg: any = {}
  try { cfg = JSON.parse((row as any).storage_config ?? '{}') } catch {}

  return NextResponse.json({
    type:      (row as any).storage_type ?? 'local',
    basePath:  cfg.basePath  ?? null,
    site_url:  cfg.site_url  ?? null,
    connected: !!(cfg.access_token || (row as any).storage_type === 'local'),
  })
}

export async function PATCH(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { clienteId, type, basePath, site_url } = body
  if (!clienteId) return NextResponse.json({ error: 'clienteId requerido' }, { status: 400 })

  if (type === 'local') {
    const config = JSON.stringify({ type: 'local', basePath: basePath ?? null })
    await execute(`UPDATE clientes SET storage_type='local', storage_config=? WHERE id=?`, [config, clienteId])
    return NextResponse.json({ ok: true })
  }

  if (type === 'disconnect') {
    await execute(`UPDATE clientes SET storage_type='local', storage_config='{}' WHERE id=?`, [clienteId])
    return NextResponse.json({ ok: true })
  }

  if (type === 'sharepoint' && site_url) {
    const row = await queryOne('SELECT storage_config FROM clientes WHERE id = ?', [clienteId])
    let cfg: any = {}
    try { cfg = JSON.parse((row as any)?.storage_config ?? '{}') } catch {}
    cfg.site_url = site_url
    cfg.site_id  = undefined
    cfg.drive_id = undefined
    await execute(`UPDATE clientes SET storage_config=? WHERE id=?`, [JSON.stringify(cfg), clienteId])
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Operación no válida' }, { status: 400 })
}
