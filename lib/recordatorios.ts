/**
 * lib/recordatorios.ts
 * Motor de recordatorios.
 *
 * Lógica: corre diariamente, revisa todos los vencimientos próximos
 * y envía emails en los umbrales configurados.
 *
 * Umbrales (del archivo de recordatorios original): 10, 5, 2, 0, -1 días
 */

import { db } from './db'
import { generarVencimientos } from './fechas'
import { enviarEmail, templateRecordatorio } from './email'
import crypto from 'crypto'

// Días de anticipación en los que se envía recordatorio
// -1 = un día después del vencimiento (alerta de incumplimiento)
export const UMBRALES_DIAS = [10, 5, 2, 0, -1]

export interface ResultadoRecordatorio {
  enviados:   number
  omitidos:   number
  errores:    number
  detalles:   string[]
}

export async function ejecutarRecordatorios(): Promise<ResultadoRecordatorio> {
  const resultado: ResultadoRecordatorio = { enviados: 0, omitidos: 0, errores: 0, detalles: [] }
  const hoy      = new Date()
  const hoyStr   = hoy.toISOString().slice(0, 10)
  const appUrl   = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const adminEmail = process.env.ADMIN_EMAIL ?? 'jposoriomarin@gmail.com'

  // Obtener todos los clientes activos con sus obligaciones y email
  const clientes = db.prepare(`
    SELECT c.id, c.razon_social, c.email AS cliente_email, u.email AS user_email
    FROM clientes c
    JOIN users u ON u.id = c.user_id
    WHERE c.activo = 1
  `).all() as any[]

  for (const cliente of clientes) {
    // Obligaciones pendientes/en_progreso con su periodicidad
    const obligaciones = db.prepare(`
      SELECT
        co.id     AS obl_id,
        co.estado,
        oc.sub_titulo,
        oc.obligacion,
        oc.aspecto,
        oc.periodicidad
      FROM cliente_obligaciones co
      JOIN obligaciones_catalogo oc ON oc.sub_id = co.catalogo_id
      WHERE co.cliente_id = ?
        AND co.estado IN ('pendiente','en_progreso')
    `).all(cliente.id) as any[]

    const anioActual  = hoy.getFullYear()
    const anioSig     = anioActual + 1

    // Generar todos los vencimientos para este año y el siguiente
    const alertasHoy: {
      obligacion: string; fecha: string; diasRestantes: number; aspecto: string
    }[] = []

    for (const obl of obligaciones) {
      const fechas = [
        ...generarVencimientos(obl.periodicidad, anioActual),
        ...generarVencimientos(obl.periodicidad, anioSig),
      ]

      for (const v of fechas) {
        const diff = Math.ceil(
          (new Date(v.fecha).getTime() - hoy.getTime()) / 86400000
        )

        // ¿Cae en algún umbral de recordatorio?
        if (!UMBRALES_DIAS.includes(diff)) continue

        // ¿Ya se envió un recordatorio para esta obligación en esta fecha hoy?
        const yaEnviado = db.prepare(`
          SELECT id FROM audit_log
          WHERE accion = 'recordatorio_enviado'
            AND entidad_id = ?
            AND detalle LIKE ?
            AND date(created_at) = ?
        `).get(obl.obl_id, `%"fecha":"${v.fecha}"%`, hoyStr)

        if (yaEnviado) { resultado.omitidos++; continue }

        alertasHoy.push({
          obligacion:    obl.obligacion,
          fecha:         v.fecha,
          diasRestantes: diff,
          aspecto:       obl.aspecto,
        })
      }
    }

    if (alertasHoy.length === 0) continue

    // Agrupar por días restantes para enviar un email por umbral
    const porUmbral = UMBRALES_DIAS.reduce((acc, d) => {
      const items = alertasHoy.filter(a => a.diasRestantes === d)
      if (items.length) acc[d] = items
      return acc
    }, {} as Record<number, typeof alertasHoy>)

    for (const [diasStr, items] of Object.entries(porUmbral)) {
      const diasAntes  = parseInt(diasStr)
      const emailCliente = cliente.cliente_email ?? cliente.user_email
      const destinatarios = [emailCliente, adminEmail].filter(Boolean)

      const asunto = diasAntes === 0
        ? `⚠️ Vence HOY — ${items.length} obligación${items.length > 1 ? 'es' : ''} | ${cliente.razon_social}`
        : diasAntes < 0
        ? `🔴 Vencimiento pasado — ${items.length} obligación${items.length > 1 ? 'es' : ''} | ${cliente.razon_social}`
        : `📅 Recordatorio ${diasAntes} día${diasAntes > 1 ? 's' : ''} — ${items.length} obligación${items.length > 1 ? 'es' : ''} | ${cliente.razon_social}`

      const html = templateRecordatorio({
        clienteNombre: cliente.razon_social,
        obligaciones:  items,
        diasAntes,
        appUrl,
      })

      const ok = await enviarEmail({ to: destinatarios, subject: asunto, html })

      if (ok) {
        resultado.enviados++
        resultado.detalles.push(`✓ ${cliente.razon_social} — ${items.length} oblig. — ${diasAntes} días`)

        // Registrar en auditoría cada obligación notificada
        for (const item of items) {
          db.prepare(`
            INSERT INTO audit_log (id, user_id, user_email, accion, entidad, entidad_id, detalle)
            VALUES (?, 'system', 'sistema@owlcompliance.co', 'recordatorio_enviado', 'obligacion', ?, ?)
          `).run(
            crypto.randomUUID(),
            alertasHoy.find(a => a.obligacion === item.obligacion)
              ? obligaciones.find(o => o.obligacion === item.obligacion)?.obl_id ?? 'unknown'
              : 'unknown',
            JSON.stringify({ fecha: item.fecha, diasAntes, destinatarios })
          )
        }
      } else {
        resultado.errores++
        resultado.detalles.push(`✗ Error enviando a ${cliente.razon_social}`)
      }
    }
  }

  return resultado
}
