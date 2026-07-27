/**
 * lib/notificaciones.ts
 * Envía notificaciones al webhook de Google Apps Script
 * que registra en el Sheet y envía email al responsable, y notificaciones
 * push a la app móvil cuando corresponde.
 */
import { notificarPush } from './push-notify'

export interface NotificacionParams {
  id:            string
  tipo_entidad:  'ticket' | 'chat' | 'documento_subido' | 'documento_revisado' | 'suscripcion'
  especialidad:  string
  asunto:        string
  cliente:       string
  admin_nombre?: string
  admin_email?:  string
  /** ID del admin asignado — habilita la notificación push a su app móvil */
  admin_id?:     string
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
  await enviar(params)

  if (params.admin_id && (params.tipo_entidad === 'ticket' || params.tipo_entidad === 'chat')) {
    const tipoLabel = params.tipo_entidad === 'ticket' ? 'ticket' : 'chat'
    await notificarPush(params.admin_id, {
      titulo: `Nuevo ${tipoLabel} de ${params.cliente}`,
      cuerpo: params.asunto,
      data: { tipo_entidad: params.tipo_entidad, id: params.id },
    })
  }
}

export async function notificarSinAsignar(params: {
  tipo:       'ticket' | 'chat' | 'documento'
  id:         string
  asunto:     string
  cliente:    string
  especialidad: string
  fecha:      string
}): Promise<void> {
  const superadminEmail = process.env.SUPERADMIN_EMAIL ?? 'owlcompliance2026@gmail.com'
  return enviar({
    id:           params.id,
    tipo_entidad: params.tipo as any,
    especialidad: params.especialidad,
    asunto:       `SIN ASIGNAR: ${params.asunto}`,
    cliente:      params.cliente,
    admin_email:  superadminEmail,
    estado:       'sin_asignar',
    fecha:        params.fecha,
  })
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

/** Envía email de bienvenida con credenciales al nuevo cliente */
export async function notificarBienvenida(params: {
  clienteEmail: string
  clienteNombre: string
  password:      string
  plan:          string
  fecha:         string
}): Promise<void> {
  const planLabel = params.plan === 'basico' ? 'Básico' : params.plan === 'pro' ? 'Pro' : 'Premium'
  const superadminEmail = process.env.SUPERADMIN_EMAIL ?? 'owlcompliance2026@gmail.com'
  // Email al cliente con sus credenciales
  await enviar({
    id:            'bienvenida-' + Date.now(),
    tipo_entidad:  'ticket',
    especialidad:  'transversal',
    asunto:        `Bienvenido a Owl Compliance — Tus credenciales de acceso`,
    cliente:       params.clienteNombre,
    cliente_email: params.clienteEmail,
    admin_email:   params.clienteEmail,
    comentario:    `Usuario: ${params.clienteEmail} | Contraseña temporal: ${params.password} | Plan: ${planLabel} | Ingresa en: https://owlcompliance.onrender.com/login`,
    estado:        'activa',
    fecha:         params.fecha,
  })
  // Copia al superadmin
  await enviar({
    id:            'bienvenida-admin-' + Date.now(),
    tipo_entidad:  'ticket',
    especialidad:  'transversal',
    asunto:        `[NUEVO CLIENTE] ${params.clienteNombre} se suscribió al Plan ${planLabel}`,
    cliente:       params.clienteNombre,
    cliente_email: params.clienteEmail,
    admin_email:   superadminEmail,
    estado:        'activa',
    fecha:         params.fecha,
  })
}

export async function notificarSuscripcion(params: {
  clienteId:    string
  cliente:      string
  clienteEmail: string
  plan:         string
  estado:       string   // 'activa' | 'suspendida' | 'cancelada'
  fecha:        string
}): Promise<void> {
  const superadminEmail = process.env.SUPERADMIN_EMAIL ?? 'owlcompliance2026@gmail.com'
  const planLabel = params.plan === 'basico' ? 'Básico' : params.plan === 'pro' ? 'Pro' : params.plan === 'premium' ? 'Premium' : params.plan
  const estadoLabel = params.estado === 'activa' ? 'activada' : params.estado === 'suspendida' ? 'suspendida' : 'cancelada'
  return enviar({
    id:           params.clienteId,
    tipo_entidad: 'ticket',
    especialidad: 'transversal',
    asunto:       `[SUSCRIPCIÓN ${estadoLabel.toUpperCase()}] Plan ${planLabel} — ${params.cliente}`,
    cliente:      params.cliente,
    cliente_email: params.clienteEmail,
    admin_email:  superadminEmail,
    estado:       params.estado,
    fecha:        params.fecha,
  })
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
