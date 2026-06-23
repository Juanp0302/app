/**
 * lib/password.ts
 * Hashing seguro de contraseñas con bcrypt (costo 12).
 *
 * Migración silenciosa: los hashes antiguos (SHA-256 + salt fijo) se
 * detectan por longitud y formato. En el login, si el hash almacenado es
 * SHA-256 y la contraseña es correcta, se re-hashea con bcrypt en ese mismo
 * request — el usuario no nota nada.
 */

import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const BCRYPT_ROUNDS = 12
const LEGACY_SALT   = 'owl_salt_2026'

/** Genera un hash bcrypt. Usar al crear o cambiar contraseñas. */
export async function hashPassword(pwd: string): Promise<string> {
  return bcrypt.hash(pwd, BCRYPT_ROUNDS)
}

/**
 * Verifica una contraseña contra el hash almacenado.
 *
 * Devuelve:
 *   { ok: true,  rehash: null }           — bcrypt correcto
 *   { ok: true,  rehash: '<nuevo hash>' } — era SHA-256 y coincide; guardar el nuevo hash
 *   { ok: false, rehash: null }           — contraseña incorrecta
 */
export async function verifyPassword(
  pwd: string,
  stored: string
): Promise<{ ok: boolean; rehash: string | null }> {
  // Hash bcrypt moderno ($2a$ o $2b$)
  if (stored.startsWith('$2')) {
    const ok = await bcrypt.compare(pwd, stored)
    return { ok, rehash: null }
  }

  // Hash SHA-256 heredado (hex de 64 chars)
  const legacy = crypto.createHash('sha256').update(pwd + LEGACY_SALT).digest('hex')
  if (legacy !== stored) return { ok: false, rehash: null }

  // Coincide — generar hash bcrypt para reemplazarlo
  const rehash = await hashPassword(pwd)
  return { ok: true, rehash }
}
