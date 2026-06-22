/**
 * lib/notificaciones.ts
 * Envía notificaciones al webhook de Google Apps Script
 * que registra en el Sheet y envía email al responsable.
 */

export interface NotificacionParams {
  id:            string
  tipo_entidad:  'ticket' | 'chat' | 'documento_subido' | 'documento_revisado'
  especialidad:  string
  asunto:        string
  cliente:       string
  admin_nombre?: string
  admin_email?:  string
  /** Para documento_revisado: email del cliente al que notificar */
  cliente_email?: string
  /** Para documento_revisado: 'aprobado' | 'rechazado' */
  resultado?:     string
  /** Comentario del admin al revisar */
  comentario?:    string
  estado:        string
  fecha:         string
}

async function enviar(params: NotificacionParams): Promise<void> {
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

export async function notificarAsignacion(params: NotificacionParams): Promise<void> {
  return enviar(params)
}

export async function notificarDocumentoSubido(params: {
  docId:        string
  cliente:      string
  aspecto:      string
  obligacion:   string
  nombreArchivo: string
  adminEmails:  string[]   // todos los admins que deben enterarse
  fecha:        string
}): Promise<void> {
  // Un POST por cada admin destinatario
  await Promise.all(params.adminEmails.map(email =>
    enviar({
      id:           params.docId,
      tipo_entidad: 'documento_subido',
      especialidad: params.aspecto,
      asunto:       `Nuevo documento: ${params.obligacion} — ${params.nombreArchivo}`,
      cliente:      params.cliente,
      admin_email:  email,
      estado:       'pendiente',
      fecha:        params.fecha,
    })
  ))
}

export async function notificarRevisionDocumento(params: {
  docId:         string
  cliente:       string
  cliente_email: string
  aspecto:       string
  obligacion:    string
  nombreArchivo: string
  aprobado:      boolean
  comentario:    string
  adminNombre:   string
  fecha:         string
}): Promise<void> {
  return enviar({
    id:            params.docId,
    tipo_entidad:  'documento_revisado',
    especialidad:  params.aspecto,
    asunto:        `Documento ${params.aprobado ? 'aprobado' : 'rechazado'}: ${params.obligacion} — ${params.nombreArchivo}`,
    cliente:       params.cliente,
    cliente_email: params.cliente_email,
    admin_nombre:  params.adminNombre,
    resultado:     params.aprobado ? 'aprobado' : 'rechazado',
    comentario:    params.comentario,
    estado:        params.aprobado ? 'aprobado' : 'rechazado',
    fecha:         params.fecha,
  })
}
