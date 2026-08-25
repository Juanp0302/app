/**
 * lib/codigos-descuento.ts
 * Lógica de negocio de códigos de descuento — capa sobre
 * lib/codigos-descuento-db.ts. Se usa en:
 *   - app/api/superadmin/codigos-descuento (CRUD, solo superadmin)
 *   - app/api/codigos-descuento/validar (público, previsualización sin consumir uso)
 *   - app/api/contrato/publico (aplicación real: valida + descuenta el precio
 *     del plan antes de generar el enlace de pago, en cualquier pasarela)
 *
 * Importante: el descuento SIEMPRE se calcula y valida en el servidor a
 * partir del código — nunca se confía en un monto o porcentaje que mande el
 * cliente. El navegador solo envía el texto del código.
 */
import { PLANES, type PlanKey } from './suscripcion'
import {
  crearCodigoDescuentoRow,
  listarCodigosDescuentoRows,
  buscarCodigoDescuentoRow,
  actualizarCodigoDescuentoRow,
  incrementarUsoCodigoDescuento,
  eliminarCodigoDescuentoRow,
  type CodigoDescuentoRow,
} from './codigos-descuento-db'

export type { CodigoDescuentoRow }

export interface ResultadoDescuento {
  valido: boolean
  motivo?: string
  codigo?: string
  tipo?: 'porcentaje' | 'fijo'
  valor?: number
  montoOriginal?: number
  montoDescuento?: number
  montoFinal?: number
}

/**
 * Valida un código contra un plan y calcula el monto final. No consume el
 * uso — eso lo hace por separado `aplicarCodigoDescuento` (llamado solo
 * cuando el pago realmente se genera, no en la previsualización).
 */
export async function validarCodigoDescuento(codigoRaw: string, plan: PlanKey): Promise<ResultadoDescuento> {
  const planInfo = PLANES[plan]
  const montoOriginal = planInfo?.precio ?? 0
  const codigo = (codigoRaw ?? '').trim().toUpperCase()
  if (!codigo) return { valido: false, motivo: 'Código vacío' }

  const row = await buscarCodigoDescuentoRow(codigo)
  if (!row) return { valido: false, motivo: 'Código no encontrado' }
  if (!row.activo) return { valido: false, motivo: 'Este código ya no está activo' }
  if (row.plan && row.plan !== plan) return { valido: false, motivo: `Este código solo aplica al plan ${PLANES[row.plan as PlanKey]?.label ?? row.plan}` }
  if (row.vigente_hasta && row.vigente_hasta < new Date().toISOString().slice(0, 10)) {
    return { valido: false, motivo: 'Este código ya venció' }
  }
  if (row.usos_maximos !== null && row.usos_actuales >= row.usos_maximos) {
    return { valido: false, motivo: 'Este código alcanzó su límite de usos' }
  }

  const montoDescuento = row.tipo === 'porcentaje'
    ? Math.round(montoOriginal * (row.valor / 100))
    : Math.min(row.valor, montoOriginal)
  const montoFinal = Math.max(0, montoOriginal - montoDescuento)

  return {
    valido: true,
    codigo: row.codigo,
    tipo: row.tipo,
    valor: row.valor,
    montoOriginal,
    montoDescuento,
    montoFinal,
  }
}

/**
 * Igual que validarCodigoDescuento, pero además registra el uso (incrementa
 * usos_actuales). Solo debe llamarse cuando el descuento realmente se aplica
 * a un cobro/enlace de pago generado — no en la previsualización del form.
 */
export async function aplicarCodigoDescuento(codigoRaw: string, plan: PlanKey): Promise<ResultadoDescuento> {
  const resultado = await validarCodigoDescuento(codigoRaw, plan)
  if (resultado.valido && resultado.codigo) {
    await incrementarUsoCodigoDescuento(resultado.codigo)
  }
  return resultado
}

// ── CRUD para el panel de superadmin ─────────────────────────────────────────

export interface CrearCodigoDescuentoInput {
  codigo: string
  tipo: 'porcentaje' | 'fijo'
  valor: number
  plan?: PlanKey | null
  usosMaximos?: number | null
  vigenteHasta?: string | null
  creadoPor?: string | null
}

export async function crearCodigoDescuento(input: CrearCodigoDescuentoInput): Promise<CodigoDescuentoRow> {
  if (!input.codigo?.trim()) throw new Error('El código es requerido')
  if (!/^[A-Za-z0-9_-]{3,40}$/.test(input.codigo.trim())) {
    throw new Error('El código solo puede tener letras, números, guiones y guion bajo (3-40 caracteres)')
  }
  if (input.tipo === 'porcentaje' && (!(input.valor > 0) || input.valor > 100)) {
    throw new Error('El porcentaje debe estar entre 1 y 100')
  }
  if (input.tipo === 'fijo' && !(input.valor > 0)) {
    throw new Error('El monto fijo debe ser mayor a 0')
  }
  if (input.plan && !PLANES[input.plan]) {
    throw new Error(`Plan inválido: ${input.plan}`)
  }
  if (input.usosMaximos !== null && input.usosMaximos !== undefined && input.usosMaximos < 1) {
    throw new Error('Los usos máximos deben ser al menos 1')
  }

  return crearCodigoDescuentoRow({
    codigo: input.codigo,
    tipo: input.tipo,
    valor: Math.round(input.valor),
    plan: input.plan ?? null,
    usos_maximos: input.usosMaximos ?? null,
    vigente_hasta: input.vigenteHasta ?? null,
    creado_por: input.creadoPor ?? null,
  })
}

export async function listarCodigosDescuento(): Promise<CodigoDescuentoRow[]> {
  return listarCodigosDescuentoRows()
}

export async function toggleCodigoDescuento(id: string, activo: boolean): Promise<void> {
  await actualizarCodigoDescuentoRow(id, { activo })
}

export async function eliminarCodigoDescuento(id: string): Promise<void> {
  await eliminarCodigoDescuentoRow(id)
}
