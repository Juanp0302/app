/**
 * lib/reloj-ventas.ts
 * El reloj de las ventas automáticas: un ciclo por hora (7 a. m. a 8 p. m., hora de Bogotá). Lo dispara la propia app
 * (instrumentation.ts revisa cada 5 minutos si ya toca) y, como respaldo, GitHub Actions (.github/workflows/ventas-automaticas.yml).
 * GitHub no garantiza sus horarios programados (el 25 y 26 de noviembre de 2026 corrió 2 de ~20 veces), por eso el reloj
 * principal vive en la app. Un candado en la base (una clave por hora) hace que cada hora corra un solo ciclo, sin importar
 * quién lo dispare ni cuántas instancias de la app haya.
 */
import crypto from 'crypto'
import { queryOne, execute } from './db'
import { cicloVentasAutomaticas, migrateVentasAuto, horaBogota, alertar, type ResumenCiclo } from './ventas-auto'
import { hoyBogota } from './ventas'

export const HORA_PRIMER_CICLO = 7
export const HORA_ULTIMO_CICLO = 20

export type ResultadoReloj =
  | { corrio: true; resumen: ResumenCiclo }
  | { corrio: false; motivo: 'fuera de horario' | 'ya corrió esta hora' }

/** Corre el ciclo de esta hora si nadie lo ha corrido todavía. Seguro de llamar muchas veces y desde varios lados. */
export async function cicloSiToca(ahora = new Date()): Promise<ResultadoReloj> {
  const hora = horaBogota(ahora)
  if (hora < HORA_PRIMER_CICLO || hora > HORA_ULTIMO_CICLO) return { corrio: false, motivo: 'fuera de horario' }
  await migrateVentasAuto()
  const clave = `ciclo:${hoyBogota(ahora)}:${String(hora).padStart(2, '0')}`
  const yo = crypto.randomUUID()
  await execute(`INSERT INTO ventas_auto_estado (clave, valor, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(clave) DO NOTHING`, [clave, yo])
  const dueno = await queryOne<{ valor: string }>(`SELECT valor FROM ventas_auto_estado WHERE clave = ?`, [clave])
  if (dueno?.valor !== yo) return { corrio: false, motivo: 'ya corrió esta hora' }
  // Limpieza: las claves de horas de hace más de una semana ya no sirven.
  await execute(`DELETE FROM ventas_auto_estado WHERE clave LIKE 'ciclo:%' AND updated_at < datetime('now', '-7 days')`).catch(() => null)
  try {
    return { corrio: true, resumen: await cicloVentasAutomaticas(ahora) }
  } catch (e: any) {
    await alertar('el ciclo de ventas automáticas falló', String(e?.message ?? e)).catch(() => null)
    throw e
  }
}

let corriendo = false
let iniciado = false

/** Arranca el reloj dentro del servidor (lo llama instrumentation.ts una vez). Revisa cada 5 minutos. */
export function iniciarRelojVentas() {
  if (iniciado) return
  iniciado = true
  const revisar = async () => {
    if (corriendo) return
    corriendo = true
    try { await cicloSiToca() } catch (e) { console.error('[reloj-ventas]', e) } finally { corriendo = false }
  }
  setTimeout(revisar, 60_000).unref?.()
  setInterval(revisar, 5 * 60_000).unref?.()
  console.log('[reloj-ventas] iniciado: revisa cada 5 minutos (ciclos de 7 a. m. a 8 p. m., hora de Bogotá)')
}
