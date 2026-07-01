/**
 * lib/audit.ts
 * Helper centralizado para registrar eventos en audit_log.
 *
 * Las IPs se pseudonimizan con HMAC-SHA256 antes de guardarse
 * (privacidad por diseño — Art. 4 lit. h Ley 1581 de 2012).
 * El hash es consistente para la misma IP dentro de la misma instancia,
 * pero no reversible sin la clave secreta.
 */
import crypto from 'crypto'
import { execute } from './db'

function hashIp(ip: string | null | undefined): string {
  if (!ip) return '[sin-ip]'
  const secret = process.env.NEXTAUTH_SECRET ?? 'owl_dev_secret_2026'
  return 'ip:' + crypto.createHmac('sha256', secret).update(ip).digest('hex').slice(0, 16)
}

export function getIpFromRequest(req: Request | { headers: { get(k: string): string | null } }): string {
  const headers = req.headers
  const forwarded = typeof headers.get === 'function'
    ? headers.get('x-forwarded-for')
    : (headers as any)['x-forwarded-for']
  const raw = forwarded ? forwarded.split(',')[0].trim() : null
  return hashIp(raw)
}

export interface AuditParams {
  userId:    string
  userEmail: string
  accion:    string
  entidad:   string
  entidadId?: string
  detalle?:  Record<string, unknown> | string
  ip?:       string   // ya pseudonimizada o raw (se pseudonimiza aquí si no empieza con 'ip:')
}

export async function registrarAudit(p: AuditParams): Promise<void> {
  const ipFinal = p.ip
    ? (p.ip.startsWith('ip:') || p.ip.startsWith('[') ? p.ip : hashIp(p.ip))
    : '[sin-ip]'

  const detalleStr = p.detalle
    ? (typeof p.detalle === 'string' ? p.detalle : JSON.stringify(p.detalle))
    : null

  await execute(
    `INSERT INTO audit_log (id, user_id, user_email, accion, entidad, entidad_id, detalle, ip)
     VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?)`,
    [p.userId, p.userEmail, p.accion, p.entidad, p.entidadId ?? '', detalleStr, ipFinal]
  )
}
