/**
 * GET  /api/superadmin/asignacion
 *   → configuraciones actuales + admins disponibles por especialidad
 *
 * PATCH /api/superadmin/asignacion
 *   body: { tipo, especialidad, modo, adminIds }
 *   → guarda la configuración y resetea el contador
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryAll } from '@/lib/db'
import {
  ESPECIALIDADES,
  listarAsignacionConfig,
  guardarAsignacionConfig,
} from '@/lib/asignacion'

async function requireSuperadmin() {
  const session = await auth()
  const user = session?.user as any
  return user?.is_superadmin ? user : null
}

export async function GET() {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  // Admins activos con sus especialidades
  const admins = await queryAll(
    `SELECT u.id, u.nombre, u.email,
            GROUP_CONCAT(ae.tipo, ',') AS especialidades
     FROM users u
     LEFT JOIN admin_especialidades ae ON ae.user_id = u.id
     WHERE u.rol = 'admin' AND u.activo = 1
     GROUP BY u.id
     ORDER BY u.nombre`
  ) as any[]

  const adminsConEsp = admins.map(a => ({
    ...a,
    especialidades: a.especialidades ? a.especialidades.split(',') : [],
  }))

  const configs = await listarAsignacionConfig()

  // Construir mapa tipo+especialidad → config
  const cfgMap: Record<string, any> = {}
  for (const c of configs) {
    const key = `${c.tipo}:${c.especialidad}`
    cfgMap[key] = {
      modo:      c.modo,
      adminIds:  JSON.parse(c.admin_ids ?? '[]'),
      contador:  c.contador,
    }
  }

  // Armar estructura completa (rellenar con defaults si no existe config)
  const resultado: any = {}
  for (const esp of ESPECIALIDADES) {
    resultado[esp] = {}
    for (const tipo of ['ticket', 'chat', 'documento'] as const) {
      const key = `${tipo}:${esp}`
      resultado[esp][tipo] = cfgMap[key] ?? { modo: 'consecutivo', adminIds: [], contador: 0 }
    }
  }

  return NextResponse.json({ configs: resultado, admins: adminsConEsp })
}

export async function PATCH(req: NextRequest) {
  const user = await requireSuperadmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { tipo, especialidad, modo, adminIds } = await req.json()

  if (!['ticket', 'chat', 'documento'].includes(tipo))
    return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
  if (!ESPECIALIDADES.includes(especialidad))
    return NextResponse.json({ error: 'especialidad inválida' }, { status: 400 })
  if (!['unico', 'consecutivo'].includes(modo))
    return NextResponse.json({ error: 'modo inválido' }, { status: 400 })
  if (!Array.isArray(adminIds))
    return NextResponse.json({ error: 'adminIds debe ser array' }, { status: 400 })

  await guardarAsignacionConfig(tipo, especialidad, modo, adminIds)
  return NextResponse.json({ ok: true })
}
