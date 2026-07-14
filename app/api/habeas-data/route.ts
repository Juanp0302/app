/**
 * /api/habeas-data
 *
 * GET  ?email=xxx  — Consulta: devuelve todos los datos personales del titular
 * DELETE ?email=xxx — Supresión: anonimiza los datos personales del titular
 *
 * Solo accesible para superadmin.
 * Base legal: Art. 14-16 Ley 1581 de 2012 (derechos de consulta y supresión).
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryAll, execute } from '@/lib/db'

async function checkAuth() {
  const session = await auth()
  const user = session?.user as any
  if (!user?.is_superadmin) return null
  return user
}

/* ──────────────────────────────────────
   GET — Consulta de datos del titular
   Plazo legal: 10 días hábiles (Art. 14 Ley 1581)
────────────────────────────────────── */
export async function GET(req: NextRequest) {
  try {
    const admin = await checkAuth()
    if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase()
    if (!email) return NextResponse.json({ error: 'Parámetro email requerido' }, { status: 400 })

    // 1. Usuario
    const usuarios = await queryAll(
      `SELECT id, email, nombre, rol, activo, created_at FROM users WHERE lower(email) = ?`,
      [email]
    ) as any[]

    if (usuarios.length === 0) {
      return NextResponse.json({ encontrado: false, email }, { status: 200 })
    }

    const user = usuarios[0]
    const userId = user.id

    // 2. Cliente asociado (si es usuario de ISP)
    const clientes = await queryAll(
      `SELECT id, razon_social, nit, contacto, email, telefono, activo, created_at
       FROM clientes WHERE user_id = ?`,
      [userId]
    ) as any[]

    // 3. Mensajes de chat (contenido)
    const mensajes = await queryAll(
      `SELECT m.id, m.contenido, m.created_at, c.id AS conversacion_id
       FROM mensajes m
       JOIN conversaciones c ON c.id = m.conversacion_id
       WHERE m.user_id = ?
       ORDER BY m.created_at DESC LIMIT 100`,
      [userId]
    ) as any[]

    // 4. Respuestas de tickets
    const ticketRespuestas = await queryAll(
      `SELECT tr.id, tr.contenido, tr.created_at, tr.ticket_id
       FROM ticket_respuestas tr WHERE tr.user_id = ?
       ORDER BY tr.created_at DESC LIMIT 100`,
      [userId]
    ) as any[]

    // 5. Audit log (acciones realizadas por el usuario)
    const auditLog = await queryAll(
      `SELECT id, accion, entidad, detalle, ip, created_at
       FROM audit_log WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 200`,
      [userId]
    ) as any[]

    // 6. Recordatorios con su email (tabla opcional)
    let recordatorios: any[] = []
    try {
      recordatorios = await queryAll(
        `SELECT r.id, r.email_destino, r.dias_antes, r.activo, r.created_at
         FROM recordatorios r
         JOIN clientes cl ON cl.id = r.cliente_id
         WHERE cl.user_id = ? AND r.email_destino = ?`,
        [userId, email]
      ) as any[]
    } catch { /* tabla no existe aún */ }

    const resultado = {
      encontrado: true,
      email,
      consultado_en: new Date().toISOString(),
      datos: {
        usuario: {
          id: user.id,
          email: user.email,
          nombre: user.nombre,
          rol: user.rol,
          activo: user.activo,
          created_at: user.created_at,
        },
        clientes,
        mensajes_chat: mensajes,
        respuestas_tickets: ticketRespuestas,
        recordatorios,
        audit_log: auditLog,
      },
      resumen: {
        clientes: clientes.length,
        mensajes_chat: mensajes.length,
        respuestas_tickets: ticketRespuestas.length,
        registros_auditoria: auditLog.length,
        recordatorios: recordatorios.length,
      },
    }

    return NextResponse.json(resultado)
  } catch (err: any) {
    console.error('[GET /api/habeas-data]', err)
    return NextResponse.json({ error: err?.message ?? 'Error interno del servidor' }, { status: 500 })
  }
}

/* ──────────────────────────────────────
   DELETE — Supresión / anonimización del titular
   Plazo legal: 15 días hábiles (Art. 15 Ley 1581)
   Se conserva el registro mínimo por obligación legal (Art. 17 lit. b Ley 1581).
────────────────────────────────────── */
export async function DELETE(req: NextRequest) {
  try {
  const admin = await checkAuth()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'Parámetro email requerido' }, { status: 400 })

  const usuarios = await queryAll(
    `SELECT id FROM users WHERE lower(email) = ?`,
    [email]
  ) as any[]

  if (usuarios.length === 0) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  const userId = usuarios[0].id
  const anonEmail = `suprimido_${userId.slice(0, 8)}@eliminado.local`
  const ahora = new Date().toISOString()

  // Anonimizar usuario (conservamos id y rol para integridad referencial)
  await execute(
    `UPDATE users SET email = ?, nombre = '[datos suprimidos]', password = '[suprimido]',
     activo = 0 WHERE id = ?`,
    [anonEmail, userId]
  )

  // Anonimizar contacto del cliente asociado (conservamos la empresa por obligaciones del ISP)
  await execute(
    `UPDATE clientes SET contacto = '[datos suprimidos]', email = ?, telefono = '[suprimido]'
     WHERE user_id = ?`,
    [anonEmail, userId]
  )

  // Eliminar mensajes de chat (contenido personal)
  await execute(`DELETE FROM mensajes WHERE user_id = ?`, [userId])

  // Eliminar respuestas de tickets (contenido personal)
  await execute(`DELETE FROM ticket_respuestas WHERE user_id = ?`, [userId])

  // Anonimizar audit_log (conservamos la trazabilidad pero sin PII)
  await execute(
    `UPDATE audit_log SET user_email = '[suprimido]', ip = '[suprimido]'
     WHERE user_id = ?`,
    [userId]
  )

  // Registrar la supresión en audit_log (obligación legal — trazabilidad del ejercicio del derecho)
  await execute(
    `INSERT INTO audit_log (id, user_id, user_email, accion, entidad, detalle, ip, created_at)
     VALUES (lower(hex(randomblob(16))), ?, '[habeas-data]', 'SUPRESION_DATOS_PERSONALES',
             'users', ?, '[sistema]', ?)`,
    [
      admin.id,
      JSON.stringify({
        solicitante_email: email,
        ejecutado_por: admin.email,
        base_legal: 'Art. 15 Ley 1581 de 2012',
        nota: 'Supresión ejecutada desde panel de Habeas Data. Datos personales anonimizados. Estructura conservada por integridad referencial y obligaciones legales.',
      }),
      ahora,
    ]
  )

  return NextResponse.json({
    ok: true,
    email_suprimido: email,
    ejecutado_en: ahora,
    ejecutado_por: admin.email,
    acciones: [
      'Usuario anonimizado (email, nombre, password)',
      'Contacto del cliente anonimizado',
      'Mensajes de chat eliminados',
      'Respuestas de tickets eliminadas',
      'Audit log anonimizado (IP y email)',
      'Registro de supresión creado en audit_log',
    ],
    nota: 'El registro de empresa (cliente) se conserva por obligaciones legales del ISP.',
  })
  } catch (err: any) {
    console.error('[DELETE /api/habeas-data]', err)
    return NextResponse.json({ error: err?.message ?? 'Error interno del servidor' }, { status: 500 })
  }
}
