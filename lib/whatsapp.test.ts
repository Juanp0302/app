/** Enlaces de WhatsApp con el mensaje escrito. */
import { describe, it, expect } from 'vitest'
import { celularParaWhatsApp, enlaceWhatsApp, primerNombreDe } from './whatsapp'

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
