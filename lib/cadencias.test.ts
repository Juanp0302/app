/** Cadencias del webinar, reparto de la base y días hábiles. */
import { describe, it, expect } from 'vitest'
import { ENLACES } from './ventas'
import { CADENCIAS, pasoActual, textoDelPaso, sumarDiasHabiles, FESTIVOS as FESTIVOS_APP } from './cadencias'
import { repartir, revisarIcp, corregirNitEnEmpresa, coincideConProspecto, claveGrupo, fechasDeInicio, FESTIVOS as FESTIVOS_SCRIPT, sumarDiasHabiles as habilesScript } from './reparto.mjs'

describe('días hábiles', () => {
  it('salta fines de semana y festivos (2 de noviembre de 2026 es lunes festivo)', () => {
    expect(sumarDiasHabiles('2026-10-30', 1)).toBe('2026-11-03')   // viernes + 1 hábil → martes
    expect(sumarDiasHabiles('2026-10-31', 0)).toBe('2026-11-03')   // sábado → siguiente hábil
    expect(sumarDiasHabiles('2026-10-28', 0)).toBe('2026-10-28')
  })
  it('el script y la app usan los mismos festivos y la misma regla', () => {
    expect([...FESTIVOS_SCRIPT].sort()).toEqual([...FESTIVOS_APP].sort())
    for (const [f, n] of [['2026-10-30', 1], ['2026-11-13', 1], ['2026-12-24', 2]] as const)
      expect(habilesScript(f, n)).toBe(sumarDiasHabiles(f, n))
  })
})

describe('cadencias', () => {
  const CON_RAD = { punto: 'el punto 2: el reporte T.1.3 Líneas o accesos, que vence el 14 de noviembre' }
  const todos = (rad: boolean) => (['webinar-asistente', 'webinar-inscrito'] as const).flatMap(id =>
    CADENCIAS[id].pasos.map(p => ({ id, titulo: p.titulo, texto: textoDelPaso(p, { nombre: 'RODRIGO Vargas', empresa: 'Meganetwork SAS', minutos_webinar: 112, ...(rad ? CON_RAD : {}) }, 'Adriana', id) })))

  it('con radiografía, el paso 1 es el mensaje aprobado, con quien firma y según asistió o no', () => {
    const asis = textoDelPaso(CADENCIAS['webinar-asistente'].pasos[0], { nombre: 'RODRIGO Vargas', empresa: 'Meganetwork SAS', ...CON_RAD }, 'Adriana', 'webinar-asistente')
    expect(asis).toContain('Hola, Rodrigo. Soy Adriana de Owl Compliance')
    expect(asis).toContain('Gracias por acompañarnos en el webinar del 21 de octubre')
    const insc = textoDelPaso(CADENCIAS['webinar-inscrito'].pasos[0], { nombre: 'Luis', empresa: 'Novacom', ...CON_RAD }, 'David', 'webinar-inscrito')
    expect(insc).toContain('Soy David de Owl Compliance')
    expect(insc).toContain('no alcanzó a conectarse')
    expect(insc).toContain('el punto 2: el reporte T.1.3')
  })

  it('sin radiografía quedan los textos de siempre, sin mencionarla', () => {
    const t = todos(false)
    expect(t.map(x => x.texto).join(' ')).not.toMatch(/radiograf/i)
    expect(t[0].texto).toContain('¡Hola, Rodrigo! 👋 Soy Adriana, de Owl Compliance')
  })

  it('todos los textos hablan de 15 minutos, mandan al calendario y no dejan marcadores ni datos vacíos', () => {
    for (const rad of [false, true]) for (const { id, titulo, texto } of todos(rad)) {
      const donde = `${id} · ${titulo} · radiografía=${rad}`
      expect(texto, donde).not.toMatch(/\[DÍA|undefined|null|20 minutos|30 minutos/)
      for (const m of texto.matchAll(/(\d+) minutos/g)) expect([5, 15], donde).toContain(Number(m[1]))   // 5 = lo que dura el autodiagnóstico
      // Todo WhatsApp que propone una reunión o un horario lleva el enlace al calendario (las llamadas lo envían después por WhatsApp).
      if (titulo.startsWith('WhatsApp') && /videollamada|reunión|horario/.test(texto)) expect(texto, donde).toContain(ENLACES.calendario)
    }
    const pasos = todos(true).filter(x => x.id === 'webinar-asistente').map(x => x.texto)
    for (const i of [0, 2, 3, 4]) expect(pasos[i]).toContain(ENLACES.calendario)
  })

  it('con radiografía todo va en "usted", igual que el mensaje aprobado', () => {
    for (const { id, titulo, texto } of todos(true)) expect(texto, `${id} · ${titulo}`).not.toMatch(/(te|tienes|puedes|prefieres|quieres|tu|ti)/i)
  })

  it('quien estuvo poco tiempo recibe otra apertura (sin radiografía)', () => {
    const wa1 = textoDelPaso(CADENCIAS['webinar-asistente'].pasos[0], { nombre: 'Uriel', empresa: 'Basilisco', minutos_webinar: 1 }, 'Juan')
    expect(wa1).toContain('no siempre se puede quedar hasta el final')
  })

  it('sin nombre usable ni empresa real, el saludo y la empresa quedan neutros', () => {
    const wa1 = textoDelPaso(CADENCIAS['webinar-inscrito'].pasos[0], { nombre: '.', empresa: 'Na' }, null, 'webinar-inscrito')
    expect(wa1).toMatch(/^¡Hola! 👋 Soy \[SU NOMBRE\]/)
    expect(wa1).toContain('aplicado a tu ISP')
  })

  it('pasoActual: solo con la cadencia activa y mientras queden pasos', () => {
    expect(pasoActual({ cadencia: 'webinar-inscrito', paso_cadencia: 1, cadencia_estado: 'activa' })?.paso.titulo).toBe('WhatsApp · autodiagnóstico')
    expect(pasoActual({ cadencia: 'webinar-inscrito', paso_cadencia: 3, cadencia_estado: 'activa' })).toBeNull()
    expect(pasoActual({ cadencia: 'webinar-inscrito', paso_cadencia: 0, cadencia_estado: 'respondio' })).toBeNull()
    expect(pasoActual({ cadencia: null })).toBeNull()
  })
})

describe('reparto de la base del webinar', () => {
  const fila = (n: number, asistio: boolean, empresa = `ISP ${n}`, minutos = asistio ? 200 - n : null) =>
    ({ clave: `f${n}`, nombre: `Persona ${n}`, empresa, asistio, minutos })

  it('partes iguales y parejas en asistentes e inscritos', () => {
    const filas = [...Array.from({ length: 117 }, (_, i) => fila(i, true)), ...Array.from({ length: 316 }, (_, i) => fila(1000 + i, false))]
    const r = repartir(filas, ['a', 'b', 'c'])
    const de = (x: string, asis: boolean) => filas.filter(f => f.asistio === asis && r.get(f.clave) === x).length
    for (const x of ['a', 'b', 'c']) expect(de(x, true)).toBe(39)
    expect(['a', 'b', 'c'].map(x => de(x, false)).sort()).toEqual([105, 105, 106])
    // Los tres reciben asistentes de mucha y de poca permanencia, no uno todos los mejores.
    const top3 = filas.slice(0, 3).map(f => r.get(f.clave))
    expect(new Set(top3).size).toBe(3)
  })

  it('contactos de la misma empresa quedan con la misma persona (no con nombres genéricos)', () => {
    const filas = [fila(1, true, 'Santelellano sas'), fila(2, true, 'Otro'), fila(3, false, 'santelellano SAS'),
      fila(4, false, 'Fibra'), fila(5, false, 'Fibra')]
    const r = repartir(filas, ['a', 'b', 'c'])
    expect(r.get('f3')).toBe(r.get('f1'))
    expect(claveGrupo(filas[3])).not.toBe(claveGrupo(filas[4]))
  })

  it('cuenta lo que cada uno ya tenía', () => {
    const r = repartir([fila(1, true), fila(2, true)], ['a', 'b'], { a: { asistio: 5, inscrito: 0 } })
    expect([r.get('f1'), r.get('f2')]).toEqual(['b', 'b'])
  })

  it('marca para revisar lo que no parece un ISP', () => {
    expect(revisarIcp('Estudiante', 'Juan Pablo')).toBe(true)
    expect(revisarIcp('71392877', 'Cesar')).toBe(true)
    expect(revisarIcp('David Diosa', 'David Diosa')).toBe(true)
    expect(revisarIcp('Cable Comunicaciones del Cauca, es una parabólica y quiero aprender para futuro', 'Ángel')).toBe(true)
    expect(revisarIcp('Meganetwork SAS', 'Rodrigo Vargas')).toBe(false)
    // ISP que pusieron la empresa también como nombre: no son personas.
    for (const e of ['REDES CABLE VISION', 'R&H Telecomunicaciones SAS', 'REDMA', 'TELFLY S.A.S'])
      expect(revisarIcp(e, e)).toBe(false)
    expect(revisarIcp('Wilson Bermudez', 'Wilson Bermudez')).toBe(true)
  })

  it('cruza con el cold mailing por nombre de empresa, correo o NIT', () => {
    const r = { empresa: 'Telecomunicaciones del sur sas', correo: 'x@y.co', nit: '' }
    expect(coincideConProspecto(r, { empresa: 'TELECOMUNICACIONES DEL SUR S.A.S' })).toBe(true)
    expect(coincideConProspecto(r, { empresa: 'Otra', correo: ' X@y.co ' })).toBe(true)
    expect(coincideConProspecto({ empresa: 'A', nit: '900123456' }, { empresa: 'B', nit: '900.123.456' })).toBe(true)
    expect(coincideConProspecto({ empresa: 'Red' }, { empresa: 'RED S.A.S' })).toBe(false)   // demasiado corto para cruzar
  })

  it('un NIT escrito en el campo de la empresa se guarda como NIT', () => {
    expect(corregirNitEnEmpresa('900232917', 'TRICOMTELECOMUNICACIONES SAS')).toEqual({ empresa: 'TRICOMTELECOMUNICACIONES SAS', nit: '900232917' })
    expect(corregirNitEnEmpresa('71392877', 'cesar mauricio areiza cano').nit).toBe('')   // cédula, no NIT
  })

  it('asistentes arrancan el primer día; inscritos de a N por responsable en los días hábiles siguientes', () => {
    const filas = [{ clave: 'a1', asistio: true, responsable: 'a' },
      ...Array.from({ length: 5 }, (_, i) => ({ clave: `i${i}`, asistio: false, responsable: 'a' })),
      { clave: 'b1', asistio: false, responsable: 'b' }]
    const f = fechasDeInicio(filas, '2026-10-29', 2)
    expect(f.get('a1')).toBe('2026-10-29')
    expect([f.get('i0'), f.get('i1'), f.get('i2'), f.get('i3'), f.get('i4')])
      .toEqual(['2026-10-30', '2026-10-30', '2026-11-03', '2026-11-03', '2026-11-04'])   // salta fin de semana y el festivo
    expect(f.get('b1')).toBe('2026-10-30')
  })
})
