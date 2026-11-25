/**
 * lib/retomar.ts
 * Lo que necesita una persona del equipo para retomar la conversación con un prospecto en cualquier momento: cuántas veces
 * se le escribió y por dónde, si respondió y qué dijo, cuántos días lleva sin responder, en qué va la cadencia, qué hace la IA
 * y el resumen del caso que la IA mantiene al día. Lo muestra el recuadro "Para retomar" de la ficha.
 */
import { queryAll, queryOne } from './db'
import { migrateVentasAuto } from './ventas-auto'
import { CADENCIAS, type CadenciaId } from './cadencias'
import { modoIA } from './ia-ventas'
import type { ProspectoRow } from './prospectos-db'

export interface ParaRetomar {
  contactos: { correos: number; whatsappAutomaticos: number; whatsappIA: number; whatsappEquipo: number; total: number }
  ultimoContacto: { fecha: string; canal: 'correo' | 'whatsapp' } | null
  respuestas: { whatsapp: number; correo: number }
  ultimaRespuesta: { fecha: string; canal: 'correo' | 'whatsapp'; texto: string } | null
  /** Días desde el último mensaje nuestro sin que haya respondido después (null si respondió de último o nunca se le escribió). */
  diasSinResponder: number | null
  cadencia: { nombre: string; paso: number; total: number; estado: string | null; proxima: string | null; automatico: boolean; canal: string } | null
  ia: { modo: string; pausada: boolean; resumen: string | null; resumenEn: string | null }
  permisoWhatsApp: boolean
}

const aFecha = (s: string) => new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z')

export async function paraRetomar(p: ProspectoRow, ahora = new Date()): Promise<ParaRetomar> {
  await migrateVentasAuto()
  const correo = await queryOne<{ n: number; ultimo: string | null }>(
    `SELECT COUNT(*) AS n, MAX(created_at) AS ultimo FROM envios_correo WHERE prospecto_id = ? AND estado = 'enviado' AND para NOT LIKE '+%'`, [p.id])
  const wa = await queryAll<{ estado: string | null; user_id: string | null; n: number; ultimo: string }>(
    `SELECT estado, user_id, COUNT(*) AS n, MAX(created_at) AS ultimo FROM mensajes_whatsapp
     WHERE prospecto_id = ? AND direccion = 'saliente' AND COALESCE(estado, '') <> 'failed' GROUP BY estado, user_id`, [p.id])
  const entrantes = await queryOne<{ n: number; ultimo: string | null }>(
    `SELECT COUNT(*) AS n, MAX(created_at) AS ultimo FROM mensajes_whatsapp WHERE prospecto_id = ? AND direccion = 'entrante'`, [p.id])
  const ultimoWA = entrantes?.ultimo
    ? await queryOne<{ texto: string }>(`SELECT texto FROM mensajes_whatsapp WHERE prospecto_id = ? AND direccion = 'entrante' ORDER BY created_at DESC, rowid DESC LIMIT 1`, [p.id])
    : undefined
  // Las respuestas por correo quedan en el historial (lib/ventas-auto.ts, actuarSobreProspecto).
  const porCorreo = await queryAll<{ nota: string; created_at: string }>(
    `SELECT nota, created_at FROM prospectos_isp_historial WHERE prospecto_id = ? AND user_id IS NULL
       AND (nota LIKE 'Respondió por correo:%' OR nota LIKE 'Pidió la baja por correo:%' OR nota LIKE 'Respondió que no le interesa:%' OR nota LIKE 'Llegó por el formulario%')
     ORDER BY created_at DESC`, [p.id])

  const suma = (f: (r: { estado: string | null; user_id: string | null }) => boolean) => wa.filter(f).reduce((a, r) => a + Number(r.n), 0)
  const whatsappAutomaticos = suma(r => r.estado === 'plantilla' || r.estado === 'automatico')
  const whatsappIA = suma(r => r.estado === 'ia')
  const whatsappEquipo = suma(r => !!r.user_id)
  const correos = Number(correo?.n ?? 0)

  const salidas = [
    correo?.ultimo ? { fecha: correo.ultimo, canal: 'correo' as const } : null,
    ...wa.map(r => ({ fecha: r.ultimo, canal: 'whatsapp' as const })),
  ].filter((x): x is { fecha: string; canal: 'correo' | 'whatsapp' } => !!x)
  const ultimoContacto = salidas.sort((a, b) => aFecha(b.fecha).getTime() - aFecha(a.fecha).getTime())[0] ?? null

  const llegadas = [
    entrantes?.ultimo ? { fecha: entrantes.ultimo, canal: 'whatsapp' as const, texto: ultimoWA?.texto ?? '' } : null,
    porCorreo[0] ? { fecha: porCorreo[0].created_at, canal: 'correo' as const, texto: porCorreo[0].nota.replace(/^[^:]+:\s*/, '') } : null,
  ].filter((x): x is { fecha: string; canal: 'correo' | 'whatsapp'; texto: string } => !!x)
  const ultimaRespuesta = llegadas.sort((a, b) => aFecha(b.fecha).getTime() - aFecha(a.fecha).getTime())[0] ?? null

  const diasSinResponder = ultimoContacto && (!ultimaRespuesta || aFecha(ultimoContacto.fecha) > aFecha(ultimaRespuesta.fecha))
    ? Math.floor((ahora.getTime() - aFecha(ultimoContacto.fecha).getTime()) / 86400000)
    : null

  const cad = p.cadencia && CADENCIAS[p.cadencia as CadenciaId]
  return {
    contactos: { correos, whatsappAutomaticos, whatsappIA, whatsappEquipo, total: correos + whatsappAutomaticos + whatsappIA + whatsappEquipo },
    ultimoContacto,
    respuestas: { whatsapp: Number(entrantes?.n ?? 0), correo: porCorreo.length },
    ultimaRespuesta: ultimaRespuesta ? { ...ultimaRespuesta, texto: ultimaRespuesta.texto.slice(0, 300) } : null,
    diasSinResponder,
    cadencia: cad ? {
      nombre: cad.nombre, paso: Math.min(Number(p.paso_cadencia ?? 0), cad.pasos.length), total: cad.pasos.length,
      estado: p.cadencia_estado ?? null, proxima: p.proxima_fecha ?? null, automatico: !!p.automatico, canal: p.canal_auto ?? 'correo',
    } : null,
    ia: { modo: modoIA(), pausada: !!p.ia_pausada, resumen: p.resumen_ia ?? null, resumenEn: p.resumen_ia_en ?? null },
    permisoWhatsApp: !!p.whatsapp_ok,
  }
}
