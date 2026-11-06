/** Cadencias del webinar, reparto de la base y días hábiles. */
import { describe, it, expect } from 'vitest'
import { ENLACES } from './ventas'
import { CADENCIAS, CUANDO_RESPONDE, cadenciaDe, mensajesCuandoResponde, pasoActual, secuenciaDelProspecto, textoDelPaso, sumarDiasHabiles, FESTIVOS as FESTIVOS_APP } from './cadencias'
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
  const PUNTO = 'el punto 2: el reporte T.1.3 Líneas o accesos, que vence el 14 de noviembre'
  const IDS = ['webinar-asistente', 'webinar-inscrito', 'cold-mailing'] as const
  const todos = (rad: boolean) => IDS.flatMap(id =>
    CADENCIAS[id].pasos.map(p => ({ id, titulo: p.titulo, canal: p.canal, texto: textoDelPaso(p, { nombre: 'RODRIGO Vargas', empresa: 'Meganetwork SAS', minutos_webinar: 112, ...(rad ? { punto: PUNTO } : {}) }, 'Adriana', id) })))

  it('con radiografía, el paso 1 es el mensaje aprobado: según asistió, se inscribió o viene del cold mailing', () => {
    const lead = { nombre: 'RODRIGO Vargas', empresa: 'Meganetwork SAS', punto: PUNTO }
    const asis = textoDelPaso(CADENCIAS['webinar-asistente'].pasos[0], lead, 'Adriana', 'webinar-asistente')
    expect(asis).toContain('Hola, Rodrigo. Soy Adriana de Owl Compliance')
    expect(asis).toContain('Gracias por acompañarnos en el webinar del 21 de octubre')
    const insc = textoDelPaso(CADENCIAS['webinar-inscrito'].pasos[0], { ...lead, nombre: 'Luis', empresa: 'Novacom' }, 'David', 'webinar-inscrito')
    expect(insc).toContain('Soy David de Owl Compliance')
    expect(insc).toContain('no alcanzaste a conectarte')
    const frio = textoDelPaso(CADENCIAS['cold-mailing'].pasos[0], lead, 'Juan Pablo', 'cold-mailing')
    expect(frio).toContain('Soy Juan Pablo de Owl Compliance')
    expect(frio).toContain('\n\nPreparamos para Meganetwork SAS')
    expect(frio).not.toMatch(/webinar/i)
  })

  it('el primer mensaje de cada perfil, con y sin radiografía, lleva la página de servicios; los demás pasos no', () => {
    for (const rad of [false, true]) for (const id of IDS) {
      const pasos = todos(rad).filter(x => x.id === id)
      expect(pasos[0].texto, `${id} rad=${rad}`).toContain(ENLACES.servicios)
      for (const resto of pasos.slice(1)) expect(resto.texto, `${id} · ${resto.titulo}`).not.toContain(ENLACES.servicios)
    }
  })

  it('sin radiografía no la mencionan; el cold mailing sin radiografía se presenta y pregunta', () => {
    expect(todos(false).map(x => x.texto).join(' ')).not.toMatch(/radiograf/i)
    const frio = textoDelPaso(CADENCIAS['cold-mailing'].pasos[0], { nombre: 'Ana', empresa: 'Redes SAS' }, 'David', 'cold-mailing')
    expect(frio).toContain('¡Hola, Ana! 👋 Soy David, de Owl Compliance.')
    expect(frio).toContain('en Redes SAS?')
    expect(frio).not.toMatch(/webinar/i)
  })

  it('todos los textos hablan de 15 minutos, mandan al calendario y no dejan marcadores ni datos vacíos', () => {
    for (const rad of [false, true]) for (const { id, titulo, texto } of todos(rad)) {
      const donde = `${id} · ${titulo} · radiografía=${rad}`
      expect(texto, donde).not.toMatch(/\[DÍA|undefined|null|20 minutos|30 minutos/)
      for (const m of texto.matchAll(/\b(\d+) minutos/g)) expect([5, 15], donde).toContain(Number(m[1]))   // 5 = lo que dura el autodiagnóstico
      if (titulo.startsWith('WhatsApp') && /videollamada|reunión|horario/.test(texto)) expect(texto, donde).toContain(ENLACES.calendario)
    }
  })

  it('todo en tú, WhatsApp y llamadas, con y sin radiografía', () => {
    // \b no entiende las tildes: se usan lookarounds con letras unicode, así también cuentan alcanzó, esté, etc.
    const usted = /(?<![\p{L}])(usted|ustedes|le (escribo|propongo|envío|dejo|cuento|recomiendo|muestro|llamo|habla|aplican)|su ISP|su empresa|sus pagos|tiene un minuto|tiene tiempo|puede elegir|prefiere|alcanzó|sepa|esté)(?![\p{L}])/iu
    // El detector tiene que detectar: con textos en usted sí se activa (así no puede quedar vacío).
    expect('Le escribo porque usted alcanzó a ver su ISP. Puede elegir el horario. ¿Estaría bien? Si le parece, sepa que esté tranquilo').toMatch(usted)
    for (const rad of [false, true]) for (const { id, titulo, texto } of todos(rad)) expect(texto, `${id} · ${titulo} · radiografía=${rad}`).not.toMatch(usted)
    expect(todos(true).find(x => x.canal === 'llamada')!.texto).toContain('¿Tienes un minuto?')
  })

  it('una empresa que termina en punto ("S.A.S.") no deja dobles puntos en ningún texto', () => {
    for (const rad of [false, true]) for (const id of IDS) for (const paso of CADENCIAS[id].pasos) {
      const t = textoDelPaso(paso, { nombre: 'María', empresa: 'STARNET.NET S.A.S.', ...(rad ? { punto: PUNTO } : {}) }, 'Adriana', id)
      expect(t, `${id} · ${paso.titulo} · radiografía=${rad}`).not.toContain('..')
    }
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

  it('pasoActual: solo con la cadencia activa y mientras queden pasos; el cold mailing tiene 5', () => {
    expect(CADENCIAS['cold-mailing'].pasos).toHaveLength(5)
    expect(pasoActual({ cadencia: 'cold-mailing', paso_cadencia: 1, cadencia_estado: 'activa' })?.paso.titulo).toBe('Llamada · si no respondió')
    expect(pasoActual({ cadencia: 'webinar-inscrito', paso_cadencia: 1, cadencia_estado: 'activa' })?.paso.titulo).toBe('WhatsApp · autodiagnóstico')
    expect(pasoActual({ cadencia: 'webinar-inscrito', paso_cadencia: 3, cadencia_estado: 'activa' })).toBeNull()
    expect(pasoActual({ cadencia: 'webinar-inscrito', paso_cadencia: 0, cadencia_estado: 'respondio' })).toBeNull()
    expect(pasoActual({ cadencia: null })).toBeNull()
  })

  it('cadenciaDe: la que tiene o, si no, según asistió, se inscribió o cold mailing', () => {
    expect(cadenciaDe({ cadencia: 'cold-mailing' })).toBe('cold-mailing')
    expect(cadenciaDe({ webinar_asistio: 1 })).toBe('webinar-asistente')
    expect(cadenciaDe({ campana: 'webinar' })).toBe('webinar-inscrito')
    expect(cadenciaDe({ en_webinar: 1 })).toBe('webinar-inscrito')
    expect(cadenciaDe({ campana: 'cold-mailing' })).toBe('cold-mailing')
    expect(cadenciaDe({ cadencia: 'inventada' })).toBe('cold-mailing')
  })

  it('la pestaña Mensajes muestra todos los pasos completos, también de quien no tiene cadencia ni radiografía', () => {
    for (const p of [
      { empresa: 'Redes SAS', representante: 'MARÍA PÉREZ' },                                                    // cold mailing sin cadencia ni radiografía
      { empresa: 'Meganetwork SAS', campana: 'webinar', webinar_asistio: 1, webinar_nombre: 'Rodrigo Vargas', cadencia: 'webinar-asistente', paso_cadencia: 2, cadencia_estado: 'activa', radiografia_en: '2026-11-05 10:00:00', prioridad: 'W' },
      { empresa: 'Novacom', campana: 'webinar', webinar_nombre: 'Luis', cadencia: 'webinar-inscrito', paso_cadencia: 0, cadencia_estado: 'respondio' },
    ]) {
      const sec = secuenciaDelProspecto(p, 'Adriana', '2026-11-06')
      expect(sec.pasos.length).toBe(CADENCIAS[sec.id].pasos.length)
      for (const paso of sec.pasos) { expect(paso.texto.length, paso.titulo).toBeGreaterThan(40); expect(paso.texto).not.toMatch(/undefined|null/) }
    }
    const asis = secuenciaDelProspecto({ empresa: 'Meganetwork SAS', webinar_asistio: 1, cadencia: 'webinar-asistente', paso_cadencia: 2, cadencia_estado: 'activa', radiografia_en: '2026-11-05 10:00:00', prioridad: 'W' }, 'Adriana', '2026-11-06')
    expect(asis.pasos.map(x => x.estado)).toEqual(['hecho', 'hecho', 'toca', 'pendiente', 'pendiente'])
    expect(asis.pasos[0].texto).toContain('radiografía regulatoria')
    expect(asis.pasos[1].cuando).toBe('1 día hábil después del paso anterior')
    const respondio = secuenciaDelProspecto({ empresa: 'Novacom', en_webinar: 1, cadencia: 'webinar-inscrito', paso_cadencia: 1, cadencia_estado: 'respondio' }, 'David', '2026-11-06')
    expect(respondio.pasos.map(x => x.estado)).toEqual(['hecho', 'pendiente', 'pendiente'])   // ya respondió: ninguno "le toca"
  })

  it('"Cuando responde": seis mensajes en tú, con el nombre, el calendario y lo que se completa a mano entre corchetes', () => {
    expect(CUANDO_RESPONDE).toHaveLength(6)
    const m = mensajesCuandoResponde('RODRIGO Vargas')
    expect(m.map(x => x.id)).toEqual(['pide-informacion', 'confirmar-reunion', 'recordatorio', 'no-se-conecto', 'resumen', 'seguimiento-propuesta'])
    for (const x of m) {
      expect(x.texto, x.titulo).toMatch(/^Rodrigo, /)
      expect(x.texto, x.titulo).not.toMatch(/(?<![\p{L}])(usted|le (escribo|envío|propongo)|tiene|puede|su)(?![\p{L}])/iu)
      expect(x.texto, x.titulo).not.toMatch(/20 minutos|undefined|null/)
    }
    expect(m[0].texto).toContain(ENLACES.servicios)
    expect(m[3].texto).toContain(ENLACES.calendario)
    expect(m[1].texto).toContain('[DÍA]')
    expect(mensajesCuandoResponde(null)[2].texto).toMatch(/^Te recuerdo/)
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
