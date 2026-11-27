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
import { hoyBogota } from './ventas'
import { CADENCIAS, cadenciaDe, pasoActual, sumarDiasHabiles, type CadenciaId } from './cadencias'
import { destinatario } from './correo-ventas'
import { celularParaWhatsApp } from './whatsapp'
import { modoVentasAuto } from './ventas-auto'

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
  W:  'W — Webinar (sin revisión regulatoria)',
  E:  'E — Nos escribió (web o WhatsApp)',
}

export const PRIORIDAD_COLOR: Record<string, string> = {
  A:  '#dc2626', // rojo
  B:  '#f59e0b', // amarillo
  C1: '#16a34a', // verde
  C2: '#6b7280', // gris
  W:  '#6d28d9', // morado
  E:  '#0e7490', // azul verdoso: llegó solo
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
  camposIn: {
    estado?: string; fecha_contacto?: string | null; proximo_paso?: string | null; notas?: string | null
    /** paso_enviado: marca el paso actual de la cadencia y programa el siguiente. respondio: la detiene.
     *  automatico_on / automatico_off: el sistema envía (o deja de enviar) la cadencia por correo (lib/ventas-auto.ts). */
    accion?: 'paso_enviado' | 'respondio' | 'automatico_on' | 'automatico_on_whatsapp' | 'automatico_off' | 'whatsapp_ok_on' | 'whatsapp_ok_off'
  }
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const prospecto = await buscarProspecto(prospectoId)
  if (!prospecto) return { ok: false, error: 'Prospecto no encontrado', status: 404 }

  if (!user.is_superadmin && prospecto.responsable_id !== user.id) {
    return { ok: false, error: 'No tienes acceso a este prospecto', status: 403 }
  }

  const { accion, ...campos } = camposIn as typeof camposIn & Parameters<typeof actualizarProspecto>[1]
  const hoy = hoyBogota()
  if (accion === 'automatico_on' || accion === 'automatico_off' || accion === 'automatico_on_whatsapp') {
    return cambiarModoAutomatico(user, prospecto, accion !== 'automatico_off', hoy, accion === 'automatico_on_whatsapp' ? 'whatsapp' : 'correo')
  }
  if (accion === 'whatsapp_ok_on' || accion === 'whatsapp_ok_off') {
    const si = accion === 'whatsapp_ok_on'
    await execute(`UPDATE prospectos_isp SET whatsapp_ok = ?, updated_at = datetime('now') WHERE id = ?`, [si ? 1 : 0, prospecto.id])
    await registrarHistorial({ prospecto_id: prospecto.id, estado_anterior: prospecto.estado, estado_nuevo: prospecto.estado, user_id: user.id,
      nota: si ? 'Aceptó recibir mensajes de Owl por WhatsApp' : 'Ya no recibe mensajes automáticos de Owl por WhatsApp' })
    if (!si && prospecto.canal_auto === 'whatsapp') await execute(`UPDATE prospectos_isp SET automatico = 0 WHERE id = ?`, [prospecto.id])
    return { ok: true }
  }
  if (accion === 'paso_enviado') {
    const actual = pasoActual(prospecto)
    if (!actual) return { ok: false, error: 'Este prospecto no tiene un paso de cadencia pendiente', status: 400 }
    const siguiente = CADENCIAS[prospecto.cadencia as CadenciaId].pasos[actual.indice + 1]
    campos.paso_cadencia = actual.indice + 1
    campos.proxima_fecha = siguiente ? sumarDiasHabiles(hoy, siguiente.esperaDias) : null
    if (!siguiente) campos.cadencia_estado = 'terminada'
    campos.fecha_contacto ??= hoy
    // El estado acompaña lo que se hizo, sin pisar uno más avanzado.
    if (campos.estado === undefined) {
      if (actual.paso.canal === 'llamada' && ['Pendiente', 'WA1 enviado'].includes(prospecto.estado)) campos.estado = 'Llamada sin contacto'
      else if (prospecto.estado === 'Pendiente') campos.estado = 'WA1 enviado'
    }
  } else if (accion === 'respondio') {
    if (prospecto.cadencia) campos.cadencia_estado = 'respondio'
    campos.proxima_fecha = hoy
    campos.fecha_contacto ??= hoy
    if (campos.estado === undefined && ['Pendiente', 'WA1 enviado', 'Llamada sin contacto'].includes(prospecto.estado)) campos.estado = 'Respondió'
    if (!campos.proximo_paso && !prospecto.proximo_paso) campos.proximo_paso = 'Agendar la reunión'
  } else if (accion !== undefined) {
    return { ok: false, error: 'Acción inválida', status: 400 }
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
    if (campos.estado === 'Propuesta enviada') await iniciarSeguimientoPostReunion({ ...prospecto, ...campos } as ProspectoRow, user.id, hoy)
  }

  return { ok: true }
}

/**
 * Después de la reunión, al pasar a "Propuesta enviada": arranca sola la cadencia de seguimiento (lib/cadencias.ts,
 * 'post-reunion'): por WhatsApp si aceptó mensajes de Owl por ahí, si no por correo; sin ninguno de los dos, queda en
 * "Para hoy" para hacerla a mano. Se detiene si responde, pasa a Cliente o a No interesado.
 */
export async function iniciarSeguimientoPostReunion(p: ProspectoRow, userId: string | null, hoy: string) {
  if (p.baja) return
  const celular = celularParaWhatsApp(p.webinar_telefono) ?? celularParaWhatsApp(p.telefono)
  // En simulación el sistema no envía nada: el seguimiento queda en "Para hoy" para hacerlo a mano.
  const canal = modoVentasAuto() !== 'activo' ? null
    : p.whatsapp_ok && celular ? 'whatsapp' : destinatario(p) && !p.correo_invalido ? 'correo' : null
  await execute(
    `UPDATE prospectos_isp SET cadencia = 'post-reunion', paso_cadencia = 0, cadencia_estado = 'activa', proxima_fecha = ?,
       automatico = ?, canal_auto = ?, proximo_paso = 'Seguimiento de la propuesta', updated_at = datetime('now') WHERE id = ?`,
    [sumarDiasHabiles(hoy, CADENCIAS['post-reunion'].pasos[0].esperaDias), canal ? 1 : 0, canal ?? 'correo', p.id])
  await registrarHistorial({ prospecto_id: p.id, estado_anterior: p.estado, estado_nuevo: p.estado, user_id: userId,
    nota: canal
      ? `Empieza el seguimiento de la propuesta: el sistema le escribe por ${canal === 'whatsapp' ? 'WhatsApp' : 'correo'} en 2 días hábiles si no responde antes`
      : `Empieza el seguimiento de la propuesta, a mano en "Para hoy" (${modoVentasAuto() !== 'activo' ? 'las ventas automáticas están en simulación' : 'no tiene WhatsApp autorizado ni correo válido'})` })
}

/** Pasa un prospecto a modo automático (el sistema le envía la cadencia por correo) o lo devuelve a manual. */
async function cambiarModoAutomatico(user: { id: string }, p: ProspectoRow, encender: boolean, hoy: string, canal: 'correo' | 'whatsapp' = 'correo'): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!encender) {
    await execute(`UPDATE prospectos_isp SET automatico = 0, updated_at = datetime('now') WHERE id = ?`, [p.id])
    await registrarHistorial({ prospecto_id: p.id, estado_anterior: p.estado, estado_nuevo: p.estado, user_id: user.id, nota: 'Vuelve al trabajo manual (sale del modo automático)' })
    return { ok: true }
  }
  if (p.baja) return { ok: false, error: 'Se dio de baja: no se le pueden enviar mensajes', status: 400 }
  if (canal === 'correo') {
    if (p.correo_invalido) return { ok: false, error: 'Su correo rebotó: no puede ir en automático', status: 400 }
    if (!destinatario(p)) return { ok: false, error: 'No tiene un correo válido', status: 400 }
  } else {
    if (!p.whatsapp_ok) return { ok: false, error: 'No aceptó mensajes de Owl por WhatsApp', status: 400 }
    if (!(celularParaWhatsApp(p.webinar_telefono) ?? celularParaWhatsApp(p.telefono))) return { ok: false, error: 'No tiene un celular válido', status: 400 }
  }
  if (p.cadencia_estado && p.cadencia_estado !== 'activa') return { ok: false, error: 'Su cadencia ya no está activa (respondió o terminó)', status: 400 }
  if (['No contactar', 'No interesado', 'Cliente'].includes(p.estado)) return { ok: false, error: `Está en "${p.estado}"`, status: 400 }
  // Sin cadencia, empieza la que le corresponde; con cadencia, sigue desde el paso en que va (la llamada se salta).
  const cadencia = p.cadencia ?? cadenciaDe(p)
  await execute(
    `UPDATE prospectos_isp SET automatico = 1, canal_auto = ?, cadencia = ?, cadencia_estado = 'activa', paso_cadencia = COALESCE(paso_cadencia, 0),
       proxima_fecha = COALESCE(proxima_fecha, ?), updated_at = datetime('now') WHERE id = ?`, [canal, cadencia, hoy, p.id])
  await registrarHistorial({ prospecto_id: p.id, estado_anterior: p.estado, estado_nuevo: p.estado, user_id: user.id,
    nota: canal === 'whatsapp'
      ? 'Pasa a modo automático: el sistema le envía la cadencia por WhatsApp (plantillas)'
      : `Pasa a modo automático: el sistema le envía la cadencia por correo a ${destinatario(p)}` })
  return { ok: true }
}

/**
 * Elimina un prospecto y todo lo suyo (historial, conversación de WhatsApp y sus archivos, decisiones de la IA, envíos de la
 * cadencia y radiografía). No se puede deshacer. Solo superadmin (se valida en la ruta); pensado para pruebas y duplicados.
 * El lead del formulario, si lo hay, se queda en Leads (estadísticas).
 */
export async function eliminarProspecto(id: string): Promise<{ ok: true; empresa: string } | { ok: false; error: string; status: number }> {
  const p = await buscarProspecto(id)
  if (!p) return { ok: false, error: 'Prospecto no encontrado', status: 404 }
  const borrar = async (sql: string) => { try { await execute(sql, [id]) } catch { /* la tabla puede no existir todavía */ } }
  await borrar(`DELETE FROM medios_whatsapp WHERE wamid IN (SELECT id FROM mensajes_whatsapp WHERE prospecto_id = ?)`)
  await borrar(`DELETE FROM mensajes_whatsapp WHERE prospecto_id = ?`)
  await borrar(`DELETE FROM ia_respuestas WHERE prospecto_id = ?`)
  await borrar(`DELETE FROM envios_correo WHERE prospecto_id = ?`)
  await borrar(`DELETE FROM radiografias WHERE prospecto_id = ?`)
  await borrar(`DELETE FROM prospectos_isp_historial WHERE prospecto_id = ?`)
  await execute(`DELETE FROM prospectos_isp WHERE id = ?`, [id])
  return { ok: true, empresa: p.empresa }
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
