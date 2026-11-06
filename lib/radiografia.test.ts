/** Mensaje con la radiografía (aprobado el 4 de noviembre de 2026) y sus variables. */
import { describe, it, expect } from 'vitest'
import { sinDobles, mensajeRadiografia, puntoConcreto, proximoVencimiento, nombreParaSaludar, isPara, estadoWebinar, situacionRegulatoria } from './radiografia'
import { nombreRemitente } from './whatsapp'
import { ENLACES } from './ventas'

const HOY = '2026-11-04'

describe('mensajeRadiografia', () => {
  it('es exactamente el texto aprobado en tú, con la página de servicios (asistió, investigación abierta, firma Adriana)', () => {
    expect(mensajeRadiografia({ nombre: 'RODRIGO Vargas', empresa: 'Meganetwork SAS', remitente: 'Adriana', webinar: 'asistio',
      punto: 'el punto 1, donde figura la investigación abierta en el MinTIC' })).toBe(
      'Hola, Rodrigo. Soy Adriana de Owl Compliance, firma especializada en cumplimiento regulatorio para operadores de internet en Colombia. ' +
      'Gracias por acompañarnos en el webinar del 21 de octubre con Nicolás Almeyda.\n\n' +
      'Después del webinar preparamos para Meganetwork SAS una radiografía regulatoria de una página: en dos minutos verás lo que hoy ve el MinTIC ' +
      'de tu empresa, tus pagos regulatorios y tus próximos vencimientos. Te recomiendo mirar el punto 1, donde figura la investigación abierta en el MinTIC.\n\n' +
      'Aquí puedes conocer nuestros servicios: https://www.owlcompliance.com/servicios\n\n' +
      'Si te parece, la revisamos en una videollamada de 15 minutos y hacemos juntos el autodiagnóstico de cumplimiento, para que sepas exactamente en qué estás bien ' +
      'y qué te falta. Puedes elegir el horario que te quede mejor aquí: https://calendar.app.google/3rizAH6m6afFaFkJ8')
  })

  it('lleva la página de servicios y el calendario público, el calendario de último, y no deja marcadores de día y hora', () => {
    const m = mensajeRadiografia({ nombre: 'Ana', empresa: 'Redes', remitente: 'David', webinar: null, punto: 'el punto 2' })
    expect(m).toContain(ENLACES.servicios)
    expect(m.endsWith(ENLACES.calendario)).toBe(true)
    expect(m).not.toMatch(/xxx|\[DÍA/)
    expect(m).not.toContain('20 minutos')
  })

  it('el nombre de una empresa que termina en punto no deja doble punto', () => {
    expect(mensajeRadiografia({ nombre: 'Ana', empresa: 'STARNET.NET S.A.S.', remitente: 'David', webinar: null, punto: 'el punto 2' })).not.toContain('..')
    expect(sinDobles('a S.A.S.. b ... c')).toBe('a S.A.S. b ... c')
  })

  it('todo en tú: ni "usted" ni sus formas', () => {
    for (const webinar of ['asistio', 'inscrito', null] as const) {
      const m = mensajeRadiografia({ nombre: 'Ana', empresa: 'Redes', remitente: 'David', webinar, punto: 'el punto 2: el reporte T.1.3' })
      // \b no entiende las tildes ("verás" parecería "verá"): se usan lookarounds con letras unicode.
      expect(m, String(webinar)).not.toMatch(/(?<![\p{L}])(usted|su empresa|sus pagos|sus próximos|verá|le recomiendo|si le parece|sepa|puede elegir|le falta|le quede|alcanzó|inscribió)(?![\p{L}])/iu)
    }
  })

  it('inscrito que no asistió: no le da las gracias; quien no se inscribió: sin frase del webinar', () => {
    const base = { nombre: 'Luis', empresa: 'Fibra Norte', remitente: 'Juan Pablo', punto: 'el punto 2' }
    const b = mensajeRadiografia({ ...base, webinar: 'inscrito' })
    expect(b).toContain('Vi que te inscribiste al webinar del 21 de octubre con Nicolás Almeyda y no alcanzaste a conectarte.')
    expect(b).not.toContain('Gracias por acompañarnos')
    expect(b).toContain('Después del webinar preparamos')
    const c = mensajeRadiografia({ ...base, webinar: null })
    expect(c).not.toMatch(/webinar/i)
    expect(c).toContain('\n\nPreparamos para Fibra Norte una radiografía')
  })

  it('sin nombre usable saluda sin nombre; sin remitente deja el marcador; la empresa mal escrita pasa a "tu ISP"', () => {
    const m = mensajeRadiografia({ nombre: 'Sin dato', empresa: 'Na', remitente: null, webinar: null, punto: 'el punto 2' })
    expect(m).toMatch(/^Hola\. Soy \[SU NOMBRE\] de Owl Compliance/)
    expect(m).toContain('para tu ISP una radiografía')
    expect(nombreParaSaludar('Sisaa')).toBe('Sisaa')
    for (const malo of ['.', 'Sin', 'No', '71392877', 'jm@x.co', null, '']) expect(nombreParaSaludar(malo)).toBeNull()
    expect(isPara('71392877')).toBe('tu ISP')
    expect(isPara('Winets SAS')).toBe('Winets SAS')
  })
})

describe('quién firma', () => {
  it('el superadmin firma Juan Pablo y los admins su primer nombre', () => {
    expect(nombreRemitente('Super Administrador', true)).toBe('Juan Pablo')
    expect(nombreRemitente('Adriana Linares', false)).toBe('Adriana')
    expect(nombreRemitente('David Osorio', false)).toBe('David')
  })
})

describe('el punto concreto de la radiografía', () => {
  it('investigación abierta (prioridad A) y sanción registrada (B, con el año del primer mensaje)', () => {
    expect(puntoConcreto({ prioridad: 'A' }, HOY)).toBe('el punto 1, donde figura la investigación abierta en el MinTIC')
    expect(puntoConcreto({ prioridad: 'B', whatsapp_1: 'Vimos la multa (2023) por reportes' }, HOY)).toBe('el punto 1, donde figura la sanción registrada (2023)')
    // Igual que el generador: si el dato está marcado "revisar a mano", no se inventa el año.
    expect(puntoConcreto({ prioridad: 'B', revisar_a_mano: 1, whatsapp_1: '(2023)' }, HOY)).toBe('el punto 1, donde figura la sanción registrada')
  })

  it('sin sanciones: el próximo reporte del calendario, sin contar los pagos', () => {
    const v = proximoVencimiento(HOY)!
    expect(v.fecha >= HOY).toBe(true)
    expect(v.financiero).toBeFalsy()
    const p = puntoConcreto({ prioridad: 'C2' }, HOY)
    expect(p).toBe(`el punto 2: el reporte ${v.codigo} ${v.nombre}, que vence el ${p.split('que vence el ')[1]}`)
    expect(p).toMatch(/que vence el \d{1,2} de [a-z]+$/)
    // Los vencimientos de octubre ya pasaron: no se recomienda mirar uno vencido.
    expect(proximoVencimiento('2026-10-31')!.fecha >= '2026-10-31').toBe(true)
    expect(puntoConcreto({ prioridad: 'W' }, HOY)).toBe(puntoConcreto({ prioridad: 'C1' }, HOY))
  })

  it('si el calendario se acabó, no inventa una fecha', () => {
    expect(proximoVencimiento('2030-01-01')).toBeNull()
    expect(puntoConcreto({ prioridad: 'C2' }, '2030-01-01')).toBe('el punto 2, con sus próximos vencimientos')
  })

  it('situación y estado del webinar', () => {
    expect(situacionRegulatoria({ prioridad: 'C1' }).tipo).toBe('ninguna')
    expect(estadoWebinar({ webinar_asistio: 1 })).toBe('asistio')
    expect(estadoWebinar({ en_webinar: 1 })).toBe('inscrito')
    expect(estadoWebinar({ campana: 'webinar' })).toBe('inscrito')
    expect(estadoWebinar({ campana: 'cold-mailing' })).toBeNull()
  })
})
