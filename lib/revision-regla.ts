/**
 * lib/revision-regla.ts
 * Regla ÚNICA de "¿este cliente requiere que un administrador revise sus
 * documentos?". Es lo primero que consulta cualquier parte del sistema: la
 * subida de documentos, la cola de Revisiones, la vista del superadmin, la
 * exportación y la pantalla del cliente.
 *
 * Un cliente REQUIERE revisión si:
 *   - su diagnóstico integral está activo, o
 *   - tiene plan Pro o Premium, con la suscripción ACTIVA, y no es cortesía.
 *
 * NO requiere revisión (los documentos los sube el cliente como soporte propio):
 * plan Básico, cortesías, `trial`, cuentas sin plan, y suscripciones
 * suspendidas o canceladas.
 *
 * Como la regla se evalúa al CONSULTAR (no se guarda un estado por documento),
 * un upgrade de plan hace que los documentos ya cargados aparezcan al instante
 * en la cola de revisión, sin importar por qué camino cambió el plan (pago por
 * Trazo/Wompi, edición del superadmin, etc.).
 *
 * Este archivo no importa nada a propósito (evita imports circulares).
 */

export const PLANES_CON_REVISION = ['pro', 'premium'] as const

export interface ClienteParaRevision {
  plan:               string | null
  es_cortesia:        number | boolean | null
  suscripcion_estado: string | null
  diagnostico_estado: string | null
}

/** ¿La suscripción del cliente incluye la revisión de documentos (sin contar el diagnóstico)? */
export function incluyeRevisionPorPlan(c: ClienteParaRevision): boolean {
  if (c.es_cortesia) return false
  if (c.suscripcion_estado !== 'activa') return false
  return (PLANES_CON_REVISION as readonly string[]).includes(c.plan ?? '')
}

/** ¿Los documentos de este cliente deben pasar por un administrador? */
export function requiereRevision(c: ClienteParaRevision): boolean {
  return c.diagnostico_estado === 'activo' || incluyeRevisionPorPlan(c)
}

/**
 * Fragmento SQL equivalente a requiereRevision(), para usar en cualquier
 * consulta que tenga la tabla `clientes` con ese alias. Las columnas las crea
 * migrateSuscripcion(), que hay que llamar antes de ejecutar la consulta.
 */
export function sqlRequiereRevision(alias = 'c'): string {
  return `(${alias}.diagnostico_estado = 'activo' OR (${alias}.plan IN ('pro','premium') AND COALESCE(${alias}.es_cortesia,0) = 0 AND ${alias}.suscripcion_estado = 'activa'))`
}
