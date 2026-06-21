/**
 * lib/notificaciones.ts
 * Envía notificaciones al webhook de Google Apps Script
 * que registra en el Sheet y envía email al responsable.
 */

export interface NotificacionParams {
  id:            string
  tipo_entidad:  'ticket' | 'chat'
  especialidad:  string
  asunto:        string
  cliente:       string
  admin_nombre?: string
  admin_email?:  string
  estado:        string
  fecha:         string
}

export async function notificarAsignacion(params: NotificacionParams): Promise<void> {
  const url = process.env.SHEETS_WEBHOOK_URL
  if (!url) return

  try {
    await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(params),
    })
  } catch (e) {
    console.error('[notificaciones] Error enviando webhook:', e)
  }
}
