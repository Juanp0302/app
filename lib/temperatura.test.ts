/** Temperatura dinámica de los prospectos. */
import { describe, it, expect } from 'vitest'
import { temperaturaProspecto } from './temperatura'

const HOY = '2026-10-28'
const t = (p: any) => temperaturaProspecto({ created_at: HOY, ...p }, HOY)

describe('temperaturaProspecto', () => {
  it('cold mailing sin respuesta es frío; si responde, tibio; con reunión, caliente', () => {
    expect(t({ prioridad: 'C2', estado: 'Pendiente' }).nivel).toBe('frio')
    expect(t({ prioridad: 'C2', estado: 'Respondió' }).nivel).toBe('tibio')
    expect(t({ prioridad: 'C2', estado: 'Reunión agendada' }).nivel).toBe('caliente')
  })

  it('webinar: asistió una hora o más es caliente; poco tiempo o solo inscrito, tibio', () => {
    expect(t({ webinar_asistio: 1, webinar_minutos: 112, en_webinar: 1 }).nivel).toBe('caliente')
    expect(t({ webinar_asistio: 1, webinar_minutos: 20, en_webinar: 1 }).nivel).toBe('tibio')
    expect(t({ en_webinar: 1 }).nivel).toBe('tibio')
  })

  it('se enfría solo si pasan días sin respuesta', () => {
    const inscrito = { en_webinar: 1, estado: 'WA1 enviado' }
    expect(t({ ...inscrito, ultimo_cambio: '2026-10-25' }).nivel).toBe('tibio')
    const frio = t({ ...inscrito, ultimo_cambio: '2026-10-12' })
    expect(frio.nivel).toBe('frio')
    expect(frio.razones).toContain('Sin respuesta hace 16 días')
    expect(t({ webinar_asistio: 1, webinar_minutos: 112, en_webinar: 1, estado: 'WA1 enviado', ultimo_cambio: '2026-10-10' }).nivel).toBe('tibio')
  })

  it('una conversación quieta también se enfría, y la cadencia terminada resta', () => {
    expect(t({ prioridad: 'C2', estado: 'Conversación', ultimo_cambio: '2026-10-10' }).nivel).toBe('frio')
    expect(t({ en_webinar: 1, cadencia_estado: 'terminada' }).nivel).toBe('frio')
  })

  it('prioridad A suma, pero sola no basta para dejar de ser frío', () => {
    expect(t({ prioridad: 'A', estado: 'Pendiente' })).toMatchObject({ nivel: 'frio', puntos: 15 })
    expect(t({ prioridad: 'A', estado: 'Respondió' }).nivel).toBe('tibio')
  })

  it('cliente y descartados tienen su propia etiqueta', () => {
    expect(t({ estado: 'Cliente' }).nivel).toBe('cliente')
    expect(t({ estado: 'No contactar', webinar_asistio: 1 }).nivel).toBe('descartado')
  })
})
