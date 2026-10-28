/**
 * lib/whatsapp.ts
 * Enlaces de WhatsApp con el mensaje ya escrito (no lo envía: la persona solo oprime enviar).
 * Lo usan Prospectos y el pipeline de Leads.
 */

/** Busca un celular colombiano (10 dígitos que empiezan por 3) dentro del texto del teléfono.
 *  Acepta separadores (espacios, guiones, puntos), el prefijo 57 / +57 y casos con dos números
 *  juntos ("097-7485602 320-4291514"). Devuelve el número listo para WhatsApp (57 + 10 dígitos),
 *  o null si no hay un celular reconocible (fijos, "Sin dato", números incompletos). */
export function celularParaWhatsApp(raw: string | null | undefined): string | null {
  if (!raw) return null
  // Los paréntesis ("(323) 577 3607") se tratan como separadores.
  const m = String(raw).replace(/[()]/g, ' ').match(/(?<!\d)(?:\+?57[\s\-.]*)?(3\d{2})[\s\-.]*(\d{3})[\s\-.]*(\d{4})(?!\d)/)
  return m ? `57${m[1]}${m[2]}${m[3]}` : null
}

/** Enlace que abre el chat de WhatsApp con ese número y el mensaje ya escrito (no lo envía). */
export function enlaceWhatsApp(telefono: string | null | undefined, mensaje: string): string | null {
  const num = celularParaWhatsApp(telefono)
  return num ? `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}` : null
}

/** Primer nombre de quien está conectado, para firmar los mensajes.
 *  Si el nombre de la cuenta es genérico ("Super Administrador"), devuelve null. */
export function primerNombreDe(userName: string): string | null {
  const t = (userName || '').trim().split(/\s+/)[0]
  if (!t || /^(super|admin|administrador|owl)$/i.test(t)) return null
  return t
}
