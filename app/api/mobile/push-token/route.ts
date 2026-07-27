/**
 * POST /api/mobile/push-token
 * Registra (o actualiza) el token de notificaciones push (FCM) del
 * dispositivo del administrador autenticado con la app móvil.
 *
 * DELETE /api/mobile/push-token
 * Elimina el token (por ejemplo, al cerrar sesión en el dispositivo).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile-auth'
import { registrarPushToken, eliminarPushToken } from '@/lib/push-tokens-db'

export async function POST(req: NextRequest) {
  const user = getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const token = (body.token ?? '').toString().trim()
  if (!token) return NextResponse.json({ error: 'token requerido' }, { status: 400 })

  await registrarPushToken(user.id, token)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const token = (body.token ?? '').toString().trim()
  if (!token) return NextResponse.json({ error: 'token requerido' }, { status: 400 })

  await eliminarPushToken(token)
  return NextResponse.json({ ok: true })
}
