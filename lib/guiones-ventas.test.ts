/** Guiones del pipeline y enlaces de WhatsApp. */
import { describe, it, expect } from 'vitest'
import { guionesPara, temaWebinar, pctAutodiagnostico } from './guiones-ventas'
import { celularParaWhatsApp, enlaceWhatsApp, primerNombreDe } from './whatsapp'

const ids = (gs: { id: string }[]) => gs.map(g => g.id)

describe('guionesPara', () => {
  it('asistente al webinar: WhatsApp con el tema, llamada y seguimiento, firmado por el vendedor', () => {
    const gs = guionesPara({ nombre: 'Ana María Ruiz', empresa: 'ISP Uno', etapa: 'nuevo', asistio_max: 1, origenes: 'webinar' },
      [{ asunto: 'Webinar: Visitas del MinTIC' }], 'Juan')
    expect(ids(gs)).toEqual(['wa-asistente', 'llamada-asistente', 'wa-autodiag-invitacion', 'wa-seguimiento'])
    expect(gs[0].texto).toContain('Hola Ana,')
    expect(gs[0].texto).toContain('Juan de OWL Compliance')
    expect(gs[0].texto).toContain('el webinar sobre Visitas del MinTIC')
    expect(gs[0].texto).toContain('ISP Uno')
  })

  it('sin vendedor conocido deja el marcador para completarlo', () => {
    const [g] = guionesPara({ etapa: 'nuevo', origen: 'contacto' }, [], null)
    expect(g.texto).toContain('[SU NOMBRE]')
    expect(g.texto).toMatch(/^Hola,/)
  })

  it('autodiagnóstico: usa su porcentaje', () => {
    const gs = guionesPara({ nombre: 'Luis', etapa: 'contactado', origen: 'autodiagnostico' },
      [{ origen: 'autodiagnostico', datos: JSON.stringify({ pct_cumplimiento: 62 }) }], 'Juan')
    expect(gs[0].id).toBe('wa-autodiag')
    expect(gs[0].texto).toContain('62%')
  })

  it('inscrito que no asistió: ofrece contarle lo importante en una reunión (no hay grabación)', () => {
    const gs = guionesPara({ etapa: 'nuevo', origenes: 'webinar' }, [{ asunto: 'Webinar (importado)' }], 'Juan')
    expect(gs[0].id).toBe('wa-inscrito')
    expect(gs[0].texto).toContain('nuestro webinar')   // "importado" no es un tema
    expect(gs[0].texto).toContain('20 minutos')
    expect(gs.map(g => g.texto).join(' ')).not.toMatch(/grabaci/i)
  })

  it('reunión agendada: confirmación, recordatorio y "no se conectó", con la fecha', () => {
    const gs = guionesPara({ etapa: 'reunion_agendada', proxima_fecha: '2026-11-03' }, [], 'Juan')
    expect(ids(gs)).toEqual(['wa-confirmacion', 'wa-recordatorio', 'wa-no-asistio'])
    expect(gs[0].texto).toMatch(/martes.*noviembre/)
  })

  it('después de la reunión usa el dolor anotado; ganado y perdido no tienen guiones', () => {
    expect(guionesPara({ etapa: 'reunion_realizada', dolor_nota: 'tiene un requerimiento de la SIC' }, [])[0].texto)
      .toContain('tiene un requerimiento de la SIC')
    expect(guionesPara({ etapa: 'ganado' }, [])).toEqual([])
    expect(guionesPara({ etapa: 'perdido' }, [])).toEqual([])
  })

  it('lee tema y porcentaje de los formularios', () => {
    expect(temaWebinar([{ asunto: 'Otro' }, { asunto: 'Webinar - Reportes CRC' }])).toBe('Reportes CRC')
    expect(pctAutodiagnostico([{ datos: 'no es json' }, { datos: '{"pct_cumplimiento":"45%"}' }])).toBe('45%')
  })
})

describe('whatsapp', () => {
  it('reconoce celulares colombianos y descarta fijos', () => {
    expect(celularParaWhatsApp('+57 300 123 4567')).toBe('573001234567')
    expect(celularParaWhatsApp('097-7485602 320-4291514')).toBe('573204291514')
    expect(celularParaWhatsApp('6012345678')).toBeNull()
    expect(celularParaWhatsApp('+57 (323) 577 3607')).toBe('573235773607')
    expect(celularParaWhatsApp('+57 (310) 253-0258')).toBe('573102530258')
    expect(celularParaWhatsApp('+57 ‪+57 300 4552687‬')).toBe('573004552687')   // con caracteres invisibles
    expect(celularParaWhatsApp('+57 311263861')).toBeNull()                      // le falta un dígito
    expect(enlaceWhatsApp('3001234567', 'Hola ñ?')).toBe('https://wa.me/573001234567?text=Hola%20%C3%B1%3F')
    expect(enlaceWhatsApp('', 'x')).toBeNull()
  })

  it('no firma con nombres genéricos de cuenta', () => {
    expect(primerNombreDe('Juan Pablo Osorio')).toBe('Juan')
    expect(primerNombreDe('Super Administrador')).toBeNull()
  })
})
