/**
 * lib/whatsapp-api.ts
 * API oficial de WhatsApp (Cloud API de Meta), fase 3 de docs/automatizacion-ventas.md: solo para responder a quien escribe.
 * Sin acceso a BD. Variables de entorno:
 *   WHATSAPP_TOKEN          token permanente del usuario del sistema "owl-ventas-api"
 *   WHATSAPP_PHONE_ID       identificador del número de Owl en Meta (1459027670626993)
 *   WHATSAPP_APP_SECRET     clave secreta de la app "Owl Compliance Ventas" (firma de los webhooks)
 *   WHATSAPP_VERIFY_TOKEN   texto que inventamos y se pone igual en Meta al configurar el webhook
 *   WHATSAPP_GRAPH_VERSION  versión de la Graph API (opcional)
 */
import crypto from 'crypto'

/** Meta solo deja responder con texto libre durante las 24 h siguientes al último mensaje del prospecto. */
export const VENTANA_HORAS = 24

const version = () => process.env.WHATSAPP_GRAPH_VERSION || 'v23.0'

export const whatsappConfigurado = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID)

/** Comprueba que el webhook lo mandó Meta: cabecera X-Hub-Signature-256 = HMAC-SHA256 del cuerpo crudo con la clave de la app. */
export function firmaWebhookValida(cuerpo: string, cabecera: string | null | undefined, secreto: string | undefined): boolean {
  if (!secreto || !cabecera?.startsWith('sha256=')) return false
  const esperada = Buffer.from('sha256=' + crypto.createHmac('sha256', secreto).update(cuerpo, 'utf8').digest('hex'))
  const dada = Buffer.from(cabecera)
  return dada.length === esperada.length && crypto.timingSafeEqual(dada, esperada)
}

export interface MensajeWhatsApp {
  wamid: string
  /** Número de quien escribe, solo dígitos con indicativo (573001234567). */
  de: string
  nombre: string | null
  tipo: string
  /** Texto del mensaje; para lo que no es texto, una descripción ("[imagen]", el pie de foto, el botón que tocó…). */
  texto: string
  fecha: Date
}

export interface EstadoWhatsApp {
  wamid: string
  estado: string            // sent | delivered | read | failed
  error: string | null
}

const DESCRIPCION: Record<string, string> = {
  image: '[imagen]', audio: '[audio]', voice: '[nota de voz]', video: '[video]', document: '[documento]',
  sticker: '[sticker]', location: '[ubicación]', contacts: '[contacto]', reaction: '[reacción]',
}

function textoDe(m: any): string {
  switch (m?.type) {
    case 'text': return String(m.text?.body ?? '')
    case 'button': return String(m.button?.text ?? '[botón]')
    case 'interactive': return String(m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? '[respuesta]')
    case 'reaction': return `[reacción ${m.reaction?.emoji ?? ''}]`.replace(' ]', ']')
    default: {
      const base = DESCRIPCION[m?.type] ?? `[${m?.type ?? 'mensaje'}]`
      const pie = m?.[m?.type]?.caption ?? m?.[m?.type]?.filename
      return pie ? `${base} ${pie}` : base
    }
  }
}

/**
 * Saca del cuerpo de un webhook los mensajes que llegaron y los cambios de estado de los que enviamos.
 * Si se pasa `phoneId`, ignora lo que sea de otro número (por ejemplo, el número de prueba de Meta).
 */
export function leerWebhook(payload: any, phoneId?: string): { mensajes: MensajeWhatsApp[]; estados: EstadoWhatsApp[] } {
  const mensajes: MensajeWhatsApp[] = []
  const estados: EstadoWhatsApp[] = []
  if (payload?.object !== 'whatsapp_business_account') return { mensajes, estados }
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue
      const v = change.value ?? {}
      if (phoneId && v.metadata?.phone_number_id && String(v.metadata.phone_number_id) !== String(phoneId)) continue
      const nombres = new Map<string, string>()
      for (const c of v.contacts ?? []) if (c.wa_id) nombres.set(String(c.wa_id), c.profile?.name ?? null)
      for (const m of v.messages ?? []) {
        if (!m?.id || !m.from) continue
        const de = String(m.from).replace(/\D/g, '')
        mensajes.push({
          wamid: String(m.id), de, nombre: nombres.get(de) ?? null, tipo: String(m.type ?? 'desconocido'),
          texto: textoDe(m), fecha: new Date(Number(m.timestamp ?? 0) * 1000 || Date.now()),
        })
      }
      for (const s of v.statuses ?? []) {
        if (!s?.id || !s.status) continue
        const err = s.errors?.[0]
        estados.push({ wamid: String(s.id), estado: String(s.status), error: err ? `${err.code ?? ''} ${err.title ?? err.message ?? ''}`.trim() : null })
      }
    }
  }
  return { mensajes, estados }
}

export type EnvioWhatsApp = { ok: true; wamid: string } | { ok: false; error: string; codigo?: number }

/** Envía un texto libre. Solo funciona dentro de la ventana de 24 h (fuera de ella Meta exige una plantilla, que se cobra). */
export async function enviarTextoWhatsApp(para: string, texto: string): Promise<EnvioWhatsApp> {
  const token = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_ID
  if (!token || !phoneId) return { ok: false, error: 'WHATSAPP_TOKEN o WHATSAPP_PHONE_ID no configurados' }
  try {
    const r = await fetch(`https://graph.facebook.com/${version()}/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: para.replace(/\D/g, ''),
        type: 'text', text: { preview_url: true, body: texto } }),
      signal: AbortSignal.timeout(20000),
    })
    const d: any = await r.json().catch(() => ({}))
    if (!r.ok || !d?.messages?.[0]?.id) {
      return { ok: false, codigo: d?.error?.code, error: d?.error?.message ?? `HTTP ${r.status}` }
    }
    return { ok: true, wamid: String(d.messages[0].id) }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) }
  }
}

/** ¿Sigue abierta la ventana para responder con texto libre? */
export const ventanaAbierta = (ultimoEntrante: Date | string | null | undefined, ahora = new Date()) => {
  if (!ultimoEntrante) return false
  const t = typeof ultimoEntrante === 'string' ? new Date(ultimoEntrante.includes('T') ? ultimoEntrante : ultimoEntrante.replace(' ', 'T') + 'Z') : ultimoEntrante
  return ahora.getTime() - t.getTime() < VENTANA_HORAS * 3600 * 1000
}
