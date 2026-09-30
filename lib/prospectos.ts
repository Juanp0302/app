/**
 * lib/prospectos.ts
 * Lógica de negocio para el tablero de prospectos ISP (estrategia de
 * contacto uno a uno, 200 empresas — ver docs/prospectos-isp.md).
 */
import {
  listarProspectos, buscarProspecto, actualizarProspecto, registrarHistorial,
  listarHistorial, contarPorEstado, type ProspectoRow,
} from './prospectos-db'
import { execute } from './db'

// Los 10 estados exactos de la hoja "Tablero" del Excel — en este orden.
export const ESTADOS_PROSPECTO = [
  'Pendiente',
  'WA1 enviado',
  'Respondió',
  'Llamada sin contacto',
  'Conversación',
  'Reunión agendada',
  'Propuesta enviada',
  'Cliente',
  'No interesado',
  'No contactar',
] as const

export type EstadoProspecto = typeof ESTADOS_PROSPECTO[number]

export const PRIORIDAD_LABEL: Record<string, string> = {
  A:  'A — Investigación en marcha',
  B:  'B — Multa impuesta',
  C1: 'C1 — Sin investigación (top 50 ingresos)',
  C2: 'C2 — Sin investigación',
}

export const PRIORIDAD_COLOR: Record<string, string> = {
  A:  '#dc2626', // rojo
  B:  '#f59e0b', // amarillo
  C1: '#16a34a', // verde
  C2: '#6b7280', // gris
}

/** Lista los prospectos visibles para este usuario: admin ve solo los suyos, superadmin ve los 200. */
export async function prospectosVisiblesPara(user: { id: string; is_superadmin?: boolean }): Promise<ProspectoRow[]> {
  return listarProspectos(user.is_superadmin ? null : user.id)
}

/** Resumen tipo "Tablero": conteo por estado, para el mismo alcance (admin: lo suyo; superadmin: todo). */
export async function resumenPorEstado(user: { id: string; is_superadmin?: boolean }): Promise<Record<string, number>> {
  return contarPorEstado(user.is_superadmin ? null : user.id)
}

/**
 * Actualiza un prospecto. Solo el responsable asignado o el superadmin pueden
 * hacerlo. Si cambia el estado, se registra en el historial.
 */
export async function actualizarProspectoComoUsuario(
  user: { id: string; is_superadmin?: boolean },
  prospectoId: string,
  campos: { estado?: string; fecha_contacto?: string | null; proximo_paso?: string | null; notas?: string | null }
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const prospecto = await buscarProspecto(prospectoId)
  if (!prospecto) return { ok: false, error: 'Prospecto no encontrado', status: 404 }

  if (!user.is_superadmin && prospecto.responsable_id !== user.id) {
    return { ok: false, error: 'No tienes acceso a este prospecto', status: 403 }
  }

  if (campos.estado !== undefined && !ESTADOS_PROSPECTO.includes(campos.estado as EstadoProspecto)) {
    return { ok: false, error: `Estado inválido. Opciones: ${ESTADOS_PROSPECTO.join(', ')}`, status: 400 }
  }

  await actualizarProspecto(prospectoId, campos)

  if (campos.estado !== undefined && campos.estado !== prospecto.estado) {
    await registrarHistorial({
      prospecto_id: prospectoId,
      estado_anterior: prospecto.estado,
      estado_nuevo: campos.estado,
      user_id: user.id,
    })
  }

  return { ok: true }
}

/** Reasigna uno o varios prospectos a otro responsable. Solo superadmin (se valida en la ruta). */
export async function reasignarProspectos(
  ids: string[],
  nuevoResponsableId: string,
  superadminId: string
): Promise<{ reasignados: number }> {
  let reasignados = 0
  for (const id of ids) {
    const prospecto = await buscarProspecto(id)
    if (!prospecto) continue
    const anteriorResponsable = prospecto.responsable_id
    await actualizarProspecto(id, { responsable_id: nuevoResponsableId })
    if (anteriorResponsable !== nuevoResponsableId) {
      await registrarHistorial({
        prospecto_id: id,
        estado_anterior: prospecto.estado,
        estado_nuevo: prospecto.estado, // el estado no cambia, solo se deja constancia de la reasignación
        user_id: superadminId,
        nota: `Reasignado de ${prospecto.responsable_nombre ?? 'sin responsable'} a otro administrador`,
      })
    }
    reasignados++
  }
  return { reasignados }
}

export { listarHistorial }
export type { ProspectoRow }
