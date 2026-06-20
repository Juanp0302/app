import { queryAll, execute } from './db'
import { generarVencimientos } from './fechas'
import { enviarEmail, templateRecordatorio } from './email'
import crypto from 'crypto'

export const UMBRALES_DIAS = [10, 5, 2, 0, -1]

export interface ResultadoRecordatorio { enviados: number; omitidos: number; errores: number; detalles: string[] }

export async function ejecutarRecordatorios(): Promise<ResultadoRecordatorio> {
  const resultado: ResultadoRecordatorio = { enviados: 0, omitidos: 0, errores: 0, detalles: [] }
  const hoy       = new Date()
  const hoyStr    = hoy.toISOString().slice(0, 10)
  const appUrl    = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const adminEmail = process.env.ADMIN_EMAIL ?? ''

  const clientes = await queryAll(
    `SELECT c.id, c.razon_social, c.email AS cliente_email, u.email AS user_email
     FROM clientes c JOIN users u ON u.id = c.user_id WHERE c.activo = 1`
  )

  for (const cliente of clientes) {
    const obligaciones = await queryAll(
      `SELECT co.id AS obl_id, co.estado, oc.sub_titulo, oc.obligacion, oc.aspecto, oc.periodicidad
       FROM cliente_obligaciones co
       JOIN obligaciones_catalogo oc ON oc.sub_id = co.catalogo_id
       WHERE co.cliente_id = ? AND co.estado IN ('pendiente','en_progreso')`,
      [(cliente as any).id]
    )

    const anioActual = hoy.getFullYear()
    const alertasHoy: { obligacion: string; obl_id: string; fecha: string; diasRestantes: number; aspecto: string }[] = []

    for (const obl of obligaciones) {
      const fechas = [
        ...generarVencimientos((obl as any).periodicidad, anioActual),
        ...generarVencimientos((obl as any).periodicidad, anioActual + 1),
      ]
      for (const v of fechas) {
        const diff = Math.ceil((new Date(v.fecha).getTime() - hoy.getTime()) / 86400000)
        if (!UMBRALES_DIAS.includes(diff)) continue

        const yaEnviado = await queryOne_local(
          `SELECT id FROM audit_log WHERE accion='recordatorio_enviado' AND entidad_id=? AND detalle LIKE ? AND date(created_at)=?`,
          [(obl as any).obl_id, `%"fecha":"${v.fecha}"%`, hoyStr]
        )
        if (yaEnviado) { resultado.omitidos++; continue }

        alertasHoy.push({ obligacion: (obl as any).obligacion, obl_id: (obl as any).obl_id, fecha: v.fecha, diasRestantes: diff, aspecto: (obl as any).aspecto })
      }
    }

    if (alertasHoy.length === 0) continue

    const porUmbral = UMBRALES_DIAS.reduce((acc, d) => {
      const items = alertasHoy.filter(a => a.diasRestantes === d)
      if (items.length) acc[d] = items
      return acc
    }, {} as Record<number, typeof alertasHoy>)

    for (const [diasStr, items] of Object.entries(porUmbral)) {
      const diasAntes     = parseInt(diasStr)
      const emailCliente  = (cliente as any).cliente_email ?? (cliente as any).user_email
      const destinatarios = [emailCliente, adminEmail].filter(Boolean)

      const asunto = diasAntes === 0
        ? `⚠️ Vence HOY — ${items.length} obligación(es) | ${(cliente as any).razon_social}`
        : diasAntes < 0
        ? `🔴 Vencimiento pasado — ${items.length} obligación(es) | ${(cliente as any).razon_social}`
        : `📅 Recordatorio ${diasAntes} día(s) — ${items.length} obligación(es) | ${(cliente as any).razon_social}`

      const html = templateRecordatorio({ clienteNombre: (cliente as any).razon_social, obligaciones: items, diasAntes, appUrl })
      const ok   = await enviarEmail({ to: destinatarios, subject: asunto, html })

      if (ok) {
        resultado.enviados++
        resultado.detalles.push(`✓ ${(cliente as any).razon_social} — ${items.length} oblig. — ${diasAntes} días`)
        for (const item of items) {
          await execute(
            `INSERT INTO audit_log (id, user_id, user_email, accion, entidad, entidad_id, detalle)
             VALUES (?, 'system', 'sistema@owlcompliance.co', 'recordatorio_enviado', 'obligacion', ?, ?)`,
            [crypto.randomUUID(), item.obl_id, JSON.stringify({ fecha: item.fecha, diasAntes, destinatarios })]
          )
        }
      } else {
        resultado.errores++
        resultado.detalles.push(`✗ Error enviando a ${(cliente as any).razon_social}`)
      }
    }
  }
  return resultado
}

async function queryOne_local(sql: string, args: any[]) {
  const { queryOne } = await import('./db')
  return queryOne(sql, args)
}
