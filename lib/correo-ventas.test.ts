/** Correos automáticos de las cadencias y lectura del buzón (lib/correo-ventas.ts), enlace de baja (lib/baja.ts). */
import { describe, it, expect } from 'vitest'
import {
  armarCorreo, asuntoInicial, aHtml, clasificarEntrante, correosEn, despuesDeEnviar, destinatario, esRebote,
  esRespuestaAutomatica, noInteresado, pasoCorreoDesde, pideBaja, primerCorreo, textoNuevo,
} from './correo-ventas'
import { firmaBaja, firmaBajaValida, enlaceBaja } from './baja'
import { CADENCIAS, cadenciaDe, secuenciaDelProspecto, type CadenciaId } from './cadencias'
import { ENLACES } from './ventas'

const BAJA = 'https://app.owlcompliance.com/baja?p=x&t=y'
const USTED = /(?<![\p{L}])(usted|su empresa|sus pagos|verá|le recomiendo|si le parece|sepa|puede elegir|le falta|le quede)(?![\p{L}])/iu
const TODAS: CadenciaId[] = ['webinar-asistente', 'webinar-inscrito', 'cold-mailing', 'entrante']

describe('armarCorreo', () => {
  it('el primero con radiografía: asunto con la empresa, el texto aprobado, la firma, la baja y el PDF adjunto', () => {
    const c = armarCorreo({ cadencia: 'cold-mailing', indice: 0, remitente: 'Adriana', enlaceBaja: BAJA,
      datos: { nombre: 'Rodrigo', empresa: 'Meganetwork SAS', punto: 'el punto 1, donde figura la investigación abierta en el MinTIC' } })!
    expect(c.asunto).toBe('Radiografía regulatoria de Meganetwork SAS')
    expect(c.adjuntarRadiografia).toBe(true)
    expect(c.texto).toMatch(/^Hola, Rodrigo\. Soy Adriana de Owl Compliance/)
    expect(c.texto).toContain(ENLACES.servicios)
    expect(c.texto).toContain(ENLACES.calendario)
    expect(c.texto).toContain('Adriana\nOwl Compliance · www.owlcompliance.com')
    expect(c.texto).toContain(BAJA)
    expect(c.html).toContain(`href="${ENLACES.calendario}"`)
    expect(c.html).toContain('date de baja aquí')
  })

  it('sin radiografía no adjunta nada; los siguientes van como "Re:" del primero', () => {
    const datos = { nombre: 'Ana', empresa: 'Redes del Sur', punto: null }
    const c0 = armarCorreo({ cadencia: 'cold-mailing', indice: 0, remitente: 'David', enlaceBaja: BAJA, datos })!
    expect(c0.adjuntarRadiografia).toBe(false)
    expect(c0.asunto).toBe('Cumplimiento regulatorio de Redes del Sur')
    const c2 = armarCorreo({ cadencia: 'cold-mailing', indice: 2, remitente: 'David', enlaceBaja: BAJA, datos })!
    expect(c2.asunto).toBe('Re: Cumplimiento regulatorio de Redes del Sur')
    expect(c2.adjuntarRadiografia).toBe(false)
  })

  it('la llamada no se manda por correo', () => {
    expect(armarCorreo({ cadencia: 'cold-mailing', indice: 1, remitente: 'David', enlaceBaja: BAJA, datos: {} })).toBeNull()
  })

  it('por correo, el cierre habla del correo y no del WhatsApp; ningún correo dice "WhatsApp"', () => {
    for (const cadencia of TODAS) {
      CADENCIAS[cadencia].pasos.forEach((paso, i) => {
        const c = armarCorreo({ cadencia, indice: i, remitente: 'David', enlaceBaja: BAJA, datos: { nombre: 'Ana', empresa: 'Redes', punto: 'el punto 2' } })
        if (paso.canal === 'llamada') return expect(c).toBeNull()
        expect(c!.texto, `${cadencia} ${i}`).not.toMatch(/whatsapp/i)
      })
    }
    const cierre = armarCorreo({ cadencia: 'webinar-inscrito', indice: 2, remitente: 'David', enlaceBaja: BAJA, datos: { nombre: 'Ana' } })!
    expect(cierre.texto).toMatch(/^Ana, no te quiero llenar el correo\./)
  })

  it('todos los correos de todas las cadencias: en tú, 15 minutos, calendario, firma y baja; sin doble punto ni marcadores', () => {
    for (const cadencia of TODAS) {
      for (const punto of ['el punto 2', null]) {
        for (const origen of ['autodiagnostico', 'contacto']) {
          CADENCIAS[cadencia].pasos.forEach((_, i) => {
            const c = armarCorreo({ cadencia, indice: i, remitente: 'Juan Pablo', enlaceBaja: BAJA, datos: { nombre: 'Luis', empresa: 'STARNET.NET S.A.S.', punto, origen } })
            if (!c) return
            const quien = `${cadencia} ${i} ${punto} ${origen}`
            expect(c.texto, quien).not.toMatch(USTED)
            expect(c.texto, quien).not.toContain('..')
            expect(c.texto, quien).not.toMatch(/\[[A-ZÁÉÍÓÚ ]+\]/)
            expect(c.texto, quien).toContain(BAJA)
            expect(c.texto, quien).toContain('Juan Pablo\nOwl Compliance')
            if (c.texto.includes('minutos')) expect(c.texto, quien).toMatch(/15 minutos/)
          })
        }
      }
    }
  })

  it('cadencia entrante: respuesta inmediata con calendario y servicios, distinta para el autodiagnóstico', () => {
    const auto = armarCorreo({ cadencia: 'entrante', indice: 0, remitente: 'Adriana', enlaceBaja: BAJA, datos: { nombre: 'Marta', empresa: 'Fibra Norte', origen: 'autodiagnostico' } })!
    expect(auto.asunto).toBe('Tu autodiagnóstico de cumplimiento: revisémoslo juntos')
    expect(auto.texto).toMatch(/^¡Hola, Marta! Soy Adriana, de Owl Compliance\. Ya te llegó el informe de tu autodiagnóstico/)
    expect(auto.texto).toContain(ENLACES.calendario)
    expect(auto.texto).toContain(ENLACES.servicios)
    const contacto = armarCorreo({ cadencia: 'entrante', indice: 0, remitente: 'Adriana', enlaceBaja: BAJA, datos: { nombre: 'Marta', empresa: 'Fibra Norte', origen: 'contacto' } })!
    expect(contacto.asunto).toBe('Recibimos tu mensaje · Owl Compliance')
    expect(contacto.texto).toContain('Gracias por escribirnos')
    expect(CADENCIAS.entrante.pasos.map(p => p.canal)).not.toContain('llamada')
  })

  it('el asunto sin nombre de empresa usable dice "tu ISP"', () => {
    expect(asuntoInicial('cold-mailing', { empresa: 'Na', punto: 'x' })).toBe('Tu radiografía regulatoria')
    expect(asuntoInicial('cold-mailing', { empresa: '.', punto: null })).toBe('Cumplimiento regulatorio de tu ISP')
  })

  it('aHtml escapa el texto y vuelve clicables los enlaces, sin tragarse el punto final', () => {
    const h = aHtml('Mira <esto> & aquí: https://x.co/a.\n\nOtro')
    expect(h).toContain('&lt;esto&gt; &amp;')
    expect(h).toContain('<a href="https://x.co/a" style="color:#712529;">https://x.co/a</a>.')
    expect(h.match(/<p /g)).toHaveLength(2)
  })
})

describe('qué paso se manda y cuándo', () => {
  it('se salta la llamada y suma su espera al paso siguiente', () => {
    expect(pasoCorreoDesde('cold-mailing', 1)).toBe(2)
    expect(despuesDeEnviar('cold-mailing', 0)).toEqual({ siguiente: 2, esperaDias: 3 })   // 1 de la llamada + 2 de la propuesta
    expect(despuesDeEnviar('cold-mailing', 2)).toEqual({ siguiente: 3, esperaDias: 3 })
    expect(despuesDeEnviar('cold-mailing', 4)).toEqual({ siguiente: null, esperaDias: 0 })
    expect(despuesDeEnviar('webinar-inscrito', 0)).toEqual({ siguiente: 1, esperaDias: 3 })
    expect(pasoCorreoDesde('entrante', 3)).toBeNull()
  })

  it('a quién se le escribe: quien se inscribió, si no el correo de la empresa; el primero válido', () => {
    expect(destinatario({ webinar_correo: 'Ana@Redes.co', correo: 'info@redes.co' })).toBe('ana@redes.co')
    expect(destinatario({ webinar_correo: 'sin dato', correo: 'gerencia@x.com; otro@y.com' })).toBe('gerencia@x.com')
    expect(destinatario({ correo: 'no tiene' })).toBeNull()
    expect(primerCorreo(null)).toBeNull()
  })

  it('quien llegó por la web sigue la cadencia entrante', () => {
    expect(cadenciaDe({ campana: 'web' })).toBe('entrante')
    const s = secuenciaDelProspecto({ campana: 'web', cadencia: 'entrante', paso_cadencia: 0, cadencia_estado: 'activa', representante: 'Marta', empresa: 'Fibra', origen_lead: 'autodiagnostico', automatico: 1 }, 'Adriana', '2026-11-12')
    expect(s.pasos).toHaveLength(3)
    expect(s.pasos[0].texto).toContain('informe de tu autodiagnóstico')
    expect(s.pasos[2].texto).toContain('llenar el correo')
  })
})

describe('lo que llega al buzón', () => {
  const base = { de: 'ana@redes.co', asunto: 'Re: Radiografía regulatoria de Redes', cabeceras: {} as Record<string, string> }

  it('una respuesta normal', () => {
    expect(clasificarEntrante({ ...base, texto: 'Hola, sí me interesa. ¿El jueves?' })).toBe('respuesta')
  })

  it('respuestas automáticas: por asunto o por cabecera; no detienen la cadencia', () => {
    expect(clasificarEntrante({ ...base, asunto: 'Respuesta automática: Radiografía', texto: 'Estoy fuera' })).toBe('automatica')
    expect(clasificarEntrante({ ...base, asunto: 'Out of Office', texto: '' })).toBe('automatica')
    expect(clasificarEntrante({ ...base, cabeceras: { 'auto-submitted': 'auto-replied' }, texto: 'x' })).toBe('automatica')
    expect(esRespuestaAutomatica('Re: hola', { 'auto-submitted': 'no' })).toBe(false)
  })

  it('rebotes, y a quién no se le pudo entregar', () => {
    expect(esRebote('Mail Delivery Subsystem <mailer-daemon@googlemail.com>', 'Delivery Status Notification (Failure)')).toBe(true)
    expect(esRebote('postmaster@x.co', 'Undeliverable: Radiografía')).toBe(true)
    expect(esRebote('ana@redes.co', 'Re: Radiografía')).toBe(false)
    expect(correosEn('No se encontró la dirección Ana@Redes.co. Más: ana@redes.co, otro@x.com')).toEqual(['ana@redes.co', 'otro@x.com'])
  })

  it('baja y "no me interesa", leyendo solo lo nuevo (no el correo citado)', () => {
    expect(clasificarEntrante({ ...base, texto: 'Por favor darme de baja de su lista' })).toBe('baja')
    expect(clasificarEntrante({ ...base, texto: 'No me escriban más' })).toBe('baja')
    expect(clasificarEntrante({ ...base, texto: 'Gracias, pero no nos interesa por ahora.' })).toBe('no-interesado')
    expect(clasificarEntrante({ ...base, texto: 'Ya contamos con un asesor.' })).toBe('no-interesado')
    // Nuestro propio pie ("si no quieres recibir más correos… date de baja") viene citado: no cuenta.
    const citado = 'Perfecto, el martes.\n\nEl mié, 12 nov 2026 a las 9:00, Adriana <contacto@owlcompliance.com> escribió:\n> Si no quieres recibir más correos, date de baja aquí'
    expect(textoNuevo(citado)).toBe('Perfecto, el martes.')
    expect(clasificarEntrante({ ...base, texto: citado })).toBe('respuesta')
    expect(clasificarEntrante({ ...base, texto: 'Ok\n> no me interesa' })).toBe('respuesta')
    expect(pideBaja('quiero saber más')).toBe(false)
    expect(noInteresado('me interesa mucho')).toBe(false)
  })
})

describe('enlace de baja', () => {
  it('la firma valida solo su propio prospecto', () => {
    expect(firmaBajaValida('abc', firmaBaja('abc'))).toBe(true)
    expect(firmaBajaValida('abd', firmaBaja('abc'))).toBe(false)
    expect(firmaBajaValida('abc', '')).toBe(false)
    expect(enlaceBaja('a b')).toMatch(/\/baja\?p=a%20b&t=[\w-]{24}$/)
  })
})
