/**
 * lib/baja-db.ts
 * Da de baja a un prospecto desde el enlace de sus correos: no recibe más correos de venta y queda en "No contactar".
 */
import { execute } from './db'
import { buscarProspecto, registrarHistorial } from './prospectos-db'
import { firmaBajaValida } from './baja'
import { migrateVentasAuto } from './ventas-auto'

export async function darDeBaja(prospectoId: string, firma: string): Promise<'ok' | 'ya' | 'invalido'> {
  if (!prospectoId || !firmaBajaValida(prospectoId, firma)) return 'invalido'
  await migrateVentasAuto()
  const p = await buscarProspecto(prospectoId)
  if (!p) return 'invalido'
  if (p.baja) return 'ya'
  await execute(
    `UPDATE prospectos_isp SET baja = 1, baja_en = datetime('now'), automatico = 0, estado = 'No contactar', proxima_fecha = NULL,
       cadencia_estado = CASE WHEN cadencia IS NULL THEN NULL ELSE 'terminada' END, updated_at = datetime('now') WHERE id = ?`, [prospectoId])
  await registrarHistorial({ prospecto_id: prospectoId, estado_anterior: p.estado, estado_nuevo: 'No contactar', user_id: null,
    nota: 'Se dio de baja con el enlace del correo' })
  return 'ok'
}
