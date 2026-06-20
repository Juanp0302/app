/**
 * lib/fechas.ts
 * Lógica de vencimientos según periodicidad.
 *
 * Fechas basadas en el calendario real de obligaciones 2026 para PRST/ISP
 * colombianos (Resolución CRC 5050 de 2016 y concordantes).
 *
 * FÁCIL DE MODIFICAR: cada bloque de periodicidad es independiente.
 * Si una fecha cambia por regulación, solo se edita este archivo.
 */

export interface VencimientoCalendario {
  fecha:        string   // YYYY-MM-DD
  label:        string
  periodicidad: string
  urgencia:     'critica' | 'proxima' | 'normal'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fecha(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}

function ultimoDia(y: number, m: number): string {
  return fecha(y, m, new Date(y, m, 0).getDate())
}

function urgencia(fechaStr: string): VencimientoCalendario['urgencia'] {
  const hoy  = new Date()
  const diff = Math.ceil((new Date(fechaStr).getTime() - hoy.getTime()) / 86400000)
  if (diff < 0)   return 'normal'
  if (diff <= 7)  return 'critica'
  if (diff <= 30) return 'proxima'
  return 'normal'
}

function v(f: string, label: string, per: string): VencimientoCalendario {
  return { fecha: f, label, periodicidad: per, urgencia: urgencia(f) }
}

// ─── Generador principal ──────────────────────────────────────────────────────

export function generarVencimientos(
  periodicidad: string,
  anio: number,
): VencimientoCalendario[] {
  const p = periodicidad.toUpperCase().trim()

  // ── TRIMESTRAL ──────────────────────────────────────────────────────────────
  // Vencimiento: 30 días calendario después del cierre de cada trimestre
  // Q1 cierra 31 mar → vence 30 abr
  // Q2 cierra 30 jun → vence 31 jul
  // Q3 cierra 30 sep → vence 31 oct
  // Q4 cierra 31 dic → vence 31 ene del año siguiente
  if (p === 'TRIMESTRAL') {
    return [
      v(fecha(anio, 4, 30),   `Q1 ${anio}`,  p),
      v(fecha(anio, 7, 31),   `Q2 ${anio}`,  p),
      v(fecha(anio, 10, 31),  `Q3 ${anio}`,  p),
      v(fecha(anio+1, 1, 31), `Q4 ${anio}`,  p),
    ]
  }

  // ── SEMESTRAL ───────────────────────────────────────────────────────────────
  // S1 cierra 30 jun → vence 30 jul
  // S2 cierra 31 dic → vence 30 ene
  if (p === 'SEMESTRAL') {
    return [
      v(fecha(anio, 7, 30),   `S1 ${anio}`, p),
      v(fecha(anio+1, 1, 30), `S2 ${anio}`, p),
    ]
  }

  // ── ANUAL ───────────────────────────────────────────────────────────────────
  // Vence 31 de marzo del año siguiente al período
  if (p === 'ANUAL') {
    return [
      v(fecha(anio, 3, 31), `Anual ${anio-1}`, p),   // el del año anterior vence en marzo
      v(fecha(anio+1, 3, 31), `Anual ${anio}`, p),
    ]
  }

  // ── MENSUAL / PERIÓDICO ─────────────────────────────────────────────────────
  // Último día de cada mes
  if (p === 'MENSUAL' || p === 'PERIÓDICO') {
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    return Array.from({ length: 12 }, (_, i) => {
      const f = ultimoDia(anio, i + 1)
      return v(f, `${meses[i]} ${anio}`, p)
    })
  }

  // ── PERMANENTE / EVENTUAL / CUANDO APLIQUE → sin fecha fija ─────────────────
  return []
}

/**
 * Próximos N vencimientos desde hoy (excluyendo ya pasados).
 */
export function proximosVencimientos(
  vencimientos: VencimientoCalendario[],
  n = 8,
): VencimientoCalendario[] {
  const hoy = new Date().toISOString().slice(0, 10)
  return vencimientos
    .filter(v => v.fecha >= hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, n)
}
