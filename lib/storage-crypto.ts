/**
 * lib/storage-crypto.ts
 * Cifrado AES-256-GCM para tokens OAuth almacenados en la BD.
 *
 * Los tokens (access_token, refresh_token) se cifran antes de guardar en
 * clientes.storage_config y se descifran al leer. El resto del config
 * (type, basePath, site_url, etc.) se guarda en claro.
 *
 * Formato de un valor cifrado: "enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>"
 * Los valores sin ese prefijo son plaintext heredado y se devuelven tal cual
 * (migración transparente: se re-cifran la próxima vez que se guarden).
 *
 * Clave: derivada de NEXTAUTH_SECRET con SHA-256 → 32 bytes.
 * Requiere que NEXTAUTH_SECRET esté definido en producción.
 */

import crypto from 'crypto'

const FIELDS_TO_ENCRYPT = ['access_token', 'refresh_token'] as const
const PREFIX = 'enc:v1:'

function getKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET ?? 'owl_dev_secret_2026_change_in_prod'
  return crypto.createHash('sha256').update(secret).digest()
}

function encrypt(plaintext: string): string {
  const key = getKey()
  const iv  = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ct  = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + iv.toString('hex') + ':' + tag.toString('hex') + ':' + ct.toString('hex')
}

function decrypt(value: string): string {
  if (!value.startsWith(PREFIX)) return value  // plaintext heredado
  const parts = value.slice(PREFIX.length).split(':')
  if (parts.length !== 3) return value
  const [ivHex, tagHex, ctHex] = parts
  const key    = getKey()
  const iv     = Buffer.from(ivHex, 'hex')
  const tag    = Buffer.from(tagHex, 'hex')
  const ct     = Buffer.from(ctHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(ct).toString('utf8') + decipher.final('utf8')
}

/** Cifra los tokens sensibles de un objeto de configuración de storage. */
export function encryptStorageConfig(config: Record<string, any>): Record<string, any> {
  const result = { ...config }
  for (const field of FIELDS_TO_ENCRYPT) {
    if (typeof result[field] === 'string' && result[field]) {
      result[field] = encrypt(result[field])
    }
  }
  return result
}

/** Descifra los tokens sensibles de un objeto de configuración de storage. */
export function decryptStorageConfig(config: Record<string, any>): Record<string, any> {
  const result = { ...config }
  for (const field of FIELDS_TO_ENCRYPT) {
    if (typeof result[field] === 'string' && result[field]) {
      try {
        result[field] = decrypt(result[field])
      } catch {
        // Si falla el descifrado (ej. clave rotada), devolver vacío para forzar re-autenticación
        result[field] = ''
      }
    }
  }
  return result
}
