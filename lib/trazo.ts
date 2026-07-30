/**
 * lib/trazo.ts
 * Integración con la API de Trazo (Qentaz) — módulo de Planes y Suscripciones.
 *
 * Variables de entorno requeridas:
 *   TRAZO_BASE_URL — base de la API (ej. https://api.trazo.co/v1)
 *   TRAZO_AUTH_KEY — llave de autenticación de larga duración; con ella se
 *                    obtiene un access_token temporal (GET /token) que viaja
 *                    como x-auth-token en cada request.
 *
 * Reglas que esta capa garantiza antes de llamar al API:
 *   - total_charges entre 1 y 12.
 *   - customer.name / id_type / id_number: si viene uno, vienen los tres.
 *   - Generar Suscripción exige al menos uno de customer o form_values.
 *   - child-id solo se envía cuando se pasa explícitamente (cuentas administradas).
 *
 * El access_token expira (expires_in en segundos); se cachea en memoria y se
 * renueva con 60s de margen. Ante un 401 NO se reintenta automáticamente: se
 * invalida el cache y se lanza TrazoAuthError (sin exponer tokens en logs).
 */

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type TrazoFrequency = 'monthly' | 'biweekly' | 'weekly'
export type TrazoIdType = 'CC' | 'CE' | 'NIT' | 'PASAPORTE' | 'DNI' | 'EIN'
export type TrazoRetryFinalStatus = 'ACTIVE' | 'OVERDUE' | 'CANCELED'

export interface TrazoPlanDetails {
  currency: 'COP' | 'USD'
  amount: number
  description?: string          // admite {{charge_number}}, {{month}}, {{week}}, {{biweek}}, {{day}}
  frequency: TrazoFrequency
  billing_day?: number          // requerido por el API si frequency === 'monthly'
  total_charges?: number        // 1-12 (default del API: 12)
  initial_charge?: boolean      // default: true
  trial_days?: number           // default: 0
  expires_at?: string           // YYYY-MM-DD, límite para nuevas suscripciones
  retry?: {
    max_attempts?: number       // máx 3
    interval_days?: number
    final_status?: TrazoRetryFinalStatus
  }
}

export interface TrazoFormField {
  type: 'text' | 'number' | 'list'
  label: string
  is_visible: boolean
  is_required: boolean
  options?: string[]            // requerido si type === 'list'
  default_value?: string
}

export interface CrearPlanInput {
  merchant_id_number: string
  name: string
  plan_details: TrazoPlanDetails
  return_url?: string
  form_fields?: {
    image_url?: string
    field_one?: TrazoFormField
    field_two?: TrazoFormField
    field_three?: TrazoFormField
    field_four?: TrazoFormField
    field_five?: TrazoFormField
    field_six?: TrazoFormField
  }
}

export interface PlanCreado {
  plan_id: string
  name: string
  status: string
  expires_at?: string
  plan_url: string
  created_at: string
}

export interface PlanDetalle extends PlanCreado {
  return_url?: string
  plan_details: TrazoPlanDetails
  form_fields?: Record<string, unknown>
}

export interface PlanCancelado {
  plan_id: string
  status: 'canceled'
  canceled_at: string
}

export interface TrazoCustomer {
  name?: string
  id_type?: TrazoIdType
  id_number?: string
  email?: string
  phone?: string                // con prefijo internacional: 573112223333
}

export interface CrearSuscripcionInput {
  plan_id: string
  customer?: TrazoCustomer
  form_values?: Record<string, string>
}

export interface SuscripcionCreada {
  subscription_id: string
  plan_id: string
  subscription_url: string
  created_at: string
}

export interface SuscripcionDetalle {
  subscription_id: string
  plan_id: string
  status: string
  subscription_url: string
  customer?: TrazoCustomer
  form_values?: Record<string, string>
  created_at: string
}

export interface SuscripcionCancelada {
  subscription_id: string
  status: 'canceled'
  canceled_at: string
}

// ── Errores ───────────────────────────────────────────────────────────────────

export interface TrazoErrorDetail { field: string; message: string }

export class TrazoApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly type: string,
    message: string,
    public readonly details: TrazoErrorDetail[] = [],
  ) {
    super(message)
    this.name = 'TrazoApiError'
  }
}

export class TrazoAuthError extends TrazoApiError {
  constructor(message = 'Autenticación con Trazo fallida (401)') {
    super(401, 'unauthorized', message)
    this.name = 'TrazoAuthError'
  }
}

/** Error de validación local — se lanza ANTES de llamar al API. */
export class TrazoValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TrazoValidationError'
  }
}

// ── Configuración ─────────────────────────────────────────────────────────────

function baseUrl(): string {
  const url = process.env.TRAZO_BASE_URL
  if (!url) throw new Error('TRAZO_BASE_URL no está configurada')
  return url.replace(/\/$/, '')
}

function authKey(): string {
  const key = process.env.TRAZO_AUTH_KEY
  if (!key) throw new Error('TRAZO_AUTH_KEY no está configurada')
  return key
}

// ── Token (cache en memoria, renovación con margen de 60s) ───────────────────

let _token: { value: string; expiresAt: number } | null = null

/** Solo para tests: descarta el token cacheado. */
export function _resetTokenCache() { _token = null }

async function obtenerToken(): Promise<string> {
  if (_token && Date.now() < _token.expiresAt) return _token.value

  const res = await fetch(`${baseUrl()}/token`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${authKey()}` },
  })

  if (res.status === 401) {
    console.error('[trazo] 401 al obtener token — revisar TRAZO_AUTH_KEY')
    throw new TrazoAuthError('No se pudo obtener el token de Trazo: credenciales inválidas')
  }
  if (!res.ok) {
    throw new TrazoApiError(res.status, 'token_error', `Error ${res.status} obteniendo token de Trazo`)
  }

  const data = await res.json() as { access_token: string; expires_in: number }
  _token = {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(data.expires_in - 60, 30) * 1000,
  }
  return _token.value
}

// ── Cliente HTTP ──────────────────────────────────────────────────────────────

async function request<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  opts: { body?: unknown; childId?: string } = {},
): Promise<T> {
  const token = await obtenerToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-auth-token': token,
  }
  if (opts.childId) headers['child-id'] = opts.childId

  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })

  if (res.status === 401) {
    // Token inválido o revocado: invalidar cache, alertar y NO reintentar.
    _token = null
    console.error(`[trazo] 401 en ${method} ${path} — token rechazado`)
    throw new TrazoAuthError()
  }

  if (!res.ok) {
    let type = 'api_error'
    let message = `Error ${res.status} en ${method} ${path}`
    let details: TrazoErrorDetail[] = []
    try {
      const err = await res.json() as { error?: { type?: string; message?: string; details?: TrazoErrorDetail[] } }
      if (err.error) {
        type = err.error.type ?? type
        message = err.error.message ?? message
        details = err.error.details ?? []
      }
    } catch { /* respuesta sin JSON */ }
    throw new TrazoApiError(res.status, type, message, details)
  }

  return res.json() as Promise<T>
}

// ── Validaciones locales ──────────────────────────────────────────────────────

function validarPlan(input: CrearPlanInput): void {
  const tc = input.plan_details.total_charges
  if (tc !== undefined && (!Number.isInteger(tc) || tc < 1 || tc > 12)) {
    throw new TrazoValidationError('total_charges debe ser un entero entre 1 y 12')
  }
  if (input.plan_details.frequency === 'monthly') {
    const bd = input.plan_details.billing_day
    if (bd === undefined || !Number.isInteger(bd) || bd < 1 || bd > 30) {
      throw new TrazoValidationError('billing_day (1-30) es requerido cuando frequency es monthly')
    }
  }
  const ra = input.plan_details.retry?.max_attempts
  if (ra !== undefined && (!Number.isInteger(ra) || ra < 1 || ra > 3)) {
    throw new TrazoValidationError('retry.max_attempts debe ser un entero entre 1 y 3')
  }
}

function validarSuscripcion(input: CrearSuscripcionInput): void {
  const tieneCustomer = input.customer && Object.keys(input.customer).length > 0
  const tieneFormValues = input.form_values && Object.keys(input.form_values).length > 0
  if (!tieneCustomer && !tieneFormValues) {
    throw new TrazoValidationError('Debe enviarse al menos uno de customer o form_values')
  }

  if (input.customer) {
    const { name, id_type, id_number } = input.customer
    const enviados = [name, id_type, id_number].filter(v => v !== undefined && v !== '')
    if (enviados.length > 0 && enviados.length < 3) {
      throw new TrazoValidationError('Si se envía customer.name, id_type o id_number, los tres son obligatorios')
    }
    if (input.customer.phone && !/^\d{10,15}$/.test(input.customer.phone)) {
      throw new TrazoValidationError('customer.phone debe llevar prefijo internacional sin signos (ej. 573112223333)')
    }
  }
}

// ── Servicio de dominio ───────────────────────────────────────────────────────

export async function crearPlan(input: CrearPlanInput, childId?: string): Promise<PlanCreado> {
  validarPlan(input)
  return request<PlanCreado>('POST', '/plan', { body: input, childId })
}

export async function consultarPlan(planId: string, childId?: string): Promise<PlanDetalle> {
  return request<PlanDetalle>('GET', `/plan/${encodeURIComponent(planId)}`, { childId })
}

export async function cancelarPlan(planId: string, childId?: string): Promise<PlanCancelado> {
  return request<PlanCancelado>('DELETE', `/plan/${encodeURIComponent(planId)}`, { childId })
}

export async function crearSuscripcion(input: CrearSuscripcionInput, childId?: string): Promise<SuscripcionCreada> {
  validarSuscripcion(input)
  return request<SuscripcionCreada>('POST', '/subscription', { body: input, childId })
}

export async function consultarSuscripcion(subscriptionId: string, childId?: string): Promise<SuscripcionDetalle> {
  return request<SuscripcionDetalle>('GET', `/subscription/${encodeURIComponent(subscriptionId)}`, { childId })
}

export async function cancelarSuscripcion(subscriptionId: string, childId?: string): Promise<SuscripcionCancelada> {
  return request<SuscripcionCancelada>('DELETE', `/subscription/${encodeURIComponent(subscriptionId)}`, { childId })
}
