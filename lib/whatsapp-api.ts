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
  /** Audio, nota de voz, imagen, video o documento: su id en Meta para descargarlo (no los stickers ni las reacciones). */
  medio?: { id: string; mime: string | null; nombre: string | null } | null
}

/** Tipos de mensaje que traen un archivo que el equipo tiene que ver o escuchar. */
export const TIPOS_CON_ARCHIVO = ['audio', 'voice', 'image', 'video', 'document']

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
        const archivo = TIPOS_CON_ARCHIVO.includes(m.type) ? m[m.type] : null
        mensajes.push({
          wamid: String(m.id), de, nombre: nombres.get(de) ?? null, tipo: String(m.type ?? 'desconocido'),
          texto: textoDe(m), fecha: new Date(Number(m.timestamp ?? 0) * 1000 || Date.now()),
          medio: archivo?.id ? { id: String(archivo.id), mime: archivo.mime_type ?? null, nombre: archivo.filename ?? null } : null,
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

/** Los phone_number_id que trae un webhook (para avisar si llega algo de un número que no es el configurado). */
export function numerosDelWebhook(payload: any): string[] {
  const ids = new Set<string>()
  for (const entry of payload?.entry ?? []) for (const ch of entry?.changes ?? []) {
    const id = ch?.value?.metadata?.phone_number_id
    if (id) ids.add(String(id))
  }
  return [...ids]
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

/** Descarga un archivo que llegó por WhatsApp (dos pasos: la URL temporal del medio y luego el contenido, ambos con el token). */
export async function descargarMedio(medioId: string): Promise<{ ok: true; contenido: Buffer; mime: string } | { ok: false; error: string }> {
  const token = process.env.WHATSAPP_TOKEN
  if (!token) return { ok: false, error: 'WHATSAPP_TOKEN no configurado' }
  try {
    const info = await fetch(`https://graph.facebook.com/${version()}/${medioId}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) })
    const d: any = await info.json().catch(() => ({}))
    if (!info.ok || !d?.url) return { ok: false, error: d?.error?.message ?? `HTTP ${info.status}` }
    if (Number(d.file_size ?? 0) > 15 * 1024 * 1024) return { ok: false, error: 'El archivo pesa más de 15 MB' }
    const r = await fetch(d.url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(60000) })
    if (!r.ok) return { ok: false, error: `HTTP ${r.status} al descargar` }
    return { ok: true, contenido: Buffer.from(await r.arrayBuffer()), mime: d.mime_type ?? r.headers.get('content-type') ?? 'application/octet-stream' }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) }
  }
}

/** Cuenta de WhatsApp Business de Owl (OWL Compliance). No es secreta. */
export const wabaId = () => process.env.WHATSAPP_WABA_ID || '2586269871867852'

async function graph(ruta: string, init: { method?: string; body?: any } = {}): Promise<{ ok: boolean; status: number; d: any }> {
  const token = process.env.WHATSAPP_TOKEN
  if (!token) return { ok: false, status: 0, d: { error: { message: 'WHATSAPP_TOKEN no configurado' } } }
  try {
    const r = await fetch(`https://graph.facebook.com/${version()}/${ruta}`, {
      method: init.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(20000),
    })
    return { ok: r.ok, status: r.status, d: await r.json().catch(() => ({})) }
  } catch (e: any) {
    return { ok: false, status: 0, d: { error: { message: e?.message ?? String(e) } } }
  }
}

/** Envía una plantilla aprobada (sirve fuera de la ventana de 24 h). Se cobra por mensaje entregado. */
export async function enviarPlantillaWhatsApp(para: string, nombre: string, parametros: string[], boton?: string): Promise<EnvioWhatsApp> {
  const phoneId = process.env.WHATSAPP_PHONE_ID
  if (!phoneId) return { ok: false, error: 'WHATSAPP_PHONE_ID no configurado' }
  const components: any[] = []
  if (parametros.length) components.push({ type: 'body', parameters: parametros.map(text => ({ type: 'text', text })) })
  if (boton) components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: boton }] })
  const r = await graph(`${phoneId}/messages`, { method: 'POST', body: {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: para.replace(/\D/g, ''), type: 'template',
    template: { name: nombre, language: { code: 'es' }, components },
  } })
  if (!r.ok || !r.d?.messages?.[0]?.id) return { ok: false, codigo: r.d?.error?.code, error: r.d?.error?.message ?? `HTTP ${r.status}` }
  return { ok: true, wamid: String(r.d.messages[0].id) }
}

export interface EstadoPlantilla { nombre: string; estado: string; categoria?: string; motivo?: string | null }

/** Las plantillas registradas en Meta con su estado (APPROVED, PENDING, REJECTED…). */
export async function listarPlantillasMeta(): Promise<{ ok: true; plantillas: EstadoPlantilla[] } | { ok: false; error: string }> {
  const r = await graph(`${wabaId()}/message_templates?fields=name,status,category,rejected_reason,language&limit=200`)
  if (!r.ok) return { ok: false, error: r.d?.error?.message ?? `HTTP ${r.status}` }
  return { ok: true, plantillas: (r.d?.data ?? []).filter((t: any) => !t.language || String(t.language).startsWith('es'))
    .map((t: any) => ({ nombre: t.name, estado: t.status, categoria: t.category, motivo: t.rejected_reason && t.rejected_reason !== 'NONE' ? t.rejected_reason : null })) }
}

/** Registra una plantilla en Meta para que la revise. */
export async function registrarPlantillaMeta(cuerpo: any): Promise<{ ok: true; estado: string } | { ok: false; error: string }> {
  const r = await graph(`${wabaId()}/message_templates`, { method: 'POST', body: cuerpo })
  if (!r.ok) return { ok: false, error: r.d?.error?.error_user_msg ?? r.d?.error?.message ?? `HTTP ${r.status}` }
  return { ok: true, estado: r.d?.status ?? 'PENDING' }
}

/** ¿Sigue abierta la ventana para responder con texto libre? */
export const ventanaAbierta = (ultimoEntrante: Date | string | null | undefined, ahora = new Date()) => {
  if (!ultimoEntrante) return false
  const t = typeof ultimoEntrante === 'string' ? new Date(ultimoEntrante.includes('T') ? ultimoEntrante : ultimoEntrante.replace(' ', 'T') + 'Z') : ultimoEntrante
  return ahora.getTime() - t.getTime() < VENTANA_HORAS * 3600 * 1000
}
