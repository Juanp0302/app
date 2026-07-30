import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  crearPlan, crearSuscripcion, consultarSuscripcion, cancelarSuscripcion,
  TrazoValidationError, TrazoAuthError, TrazoApiError,
  _resetTokenCache,
  type CrearPlanInput,
} from './trazo'

const PLAN_BASE: CrearPlanInput = {
  merchant_id_number: '1053824988',
  name: 'Plan Pro',
  plan_details: { currency: 'COP', amount: 890000, frequency: 'monthly', billing_day: 1, total_charges: 12 },
}

function mockFetch(...responses: Array<{ status: number; json: unknown }>) {
  const fn = vi.fn()
  for (const r of responses) {
    fn.mockResolvedValueOnce({
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => r.json,
    })
  }
  vi.stubGlobal('fetch', fn)
  return fn
}

const TOKEN_OK = { status: 200, json: { access_token: 'tok-123', expires_in: 3600 } }

beforeEach(() => {
  _resetTokenCache()
  process.env.TRAZO_BASE_URL = 'https://api.trazo.test/v1'
  process.env.TRAZO_AUTH_KEY = 'auth-key-test'
})

afterEach(() => vi.unstubAllGlobals())

describe('crearPlan', () => {
  it('crea un plan exitosamente y envía el token en x-auth-token', async () => {
    const fetchMock = mockFetch(TOKEN_OK, {
      status: 200,
      json: { plan_id: 'A1A2A3A4', name: 'Plan Pro', status: 'active', plan_url: 'https://pay.trazo.co/p/abc', created_at: '2026-07-28T15:30:00Z' },
    })

    const plan = await crearPlan(PLAN_BASE)

    expect(plan.plan_id).toBe('A1A2A3A4')
    expect(plan.plan_url).toContain('trazo.co')

    // 1ª llamada: GET /token con Bearer auth_key; 2ª: POST /plan con x-auth-token
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [tokenUrl, tokenOpts] = fetchMock.mock.calls[0]
    expect(tokenUrl).toBe('https://api.trazo.test/v1/token')
    expect(tokenOpts.headers.Authorization).toBe('Bearer auth-key-test')

    const [planUrl, planOpts] = fetchMock.mock.calls[1]
    expect(planUrl).toBe('https://api.trazo.test/v1/plan')
    expect(planOpts.method).toBe('POST')
    expect(planOpts.headers['x-auth-token']).toBe('tok-123')
    expect(planOpts.headers['child-id']).toBeUndefined()
  })

  it('rechaza total_charges fuera de rango SIN llamar al API', async () => {
    const fetchMock = mockFetch()
    await expect(crearPlan({
      ...PLAN_BASE,
      plan_details: { ...PLAN_BASE.plan_details, total_charges: 13 },
    })).rejects.toThrow(TrazoValidationError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rechaza plan monthly sin billing_day', async () => {
    await expect(crearPlan({
      ...PLAN_BASE,
      plan_details: { currency: 'COP', amount: 890000, frequency: 'monthly' },
    })).rejects.toThrow(/billing_day/)
  })

  it('propaga el 400 del API con sus detalles', async () => {
    mockFetch(TOKEN_OK, {
      status: 400,
      json: { error: { type: 'bad_request', message: 'The request contains invalid or incomplete data.', details: [{ field: 'plan_details.amount', message: 'amount is required' }] } },
    })
    const err = await crearPlan(PLAN_BASE).catch(e => e)
    expect(err).toBeInstanceOf(TrazoApiError)
    expect(err.status).toBe(400)
    expect(err.details[0].field).toBe('plan_details.amount')
  })

  it('envía child-id solo cuando se pasa', async () => {
    const fetchMock = mockFetch(TOKEN_OK, { status: 200, json: { plan_id: 'X', name: '', status: 'active', plan_url: '', created_at: '' } })
    await crearPlan(PLAN_BASE, 'child-99')
    expect(fetchMock.mock.calls[1][1].headers['child-id']).toBe('child-99')
  })
})

describe('crearSuscripcion', () => {
  it('crea una suscripción exitosamente', async () => {
    mockFetch(TOKEN_OK, {
      status: 200,
      json: { subscription_id: 'B1B2B3B4', plan_id: 'A1A2A3A4', subscription_url: 'https://pay.trazo.co/s/abc', created_at: '2026-07-28T15:30:00Z' },
    })
    const sus = await crearSuscripcion({
      plan_id: 'A1A2A3A4',
      customer: { name: 'Empresa SAS', id_type: 'NIT', id_number: '900123456', email: 'x@y.com', phone: '573112223333' },
    })
    expect(sus.subscription_id).toBe('B1B2B3B4')
  })

  it('rechaza cuando faltan customer Y form_values, sin llamar al API', async () => {
    const fetchMock = mockFetch()
    await expect(crearSuscripcion({ plan_id: 'A1' })).rejects.toThrow(TrazoValidationError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rechaza customer con interdependencia incompleta (name sin id_type/id_number)', async () => {
    const fetchMock = mockFetch()
    await expect(crearSuscripcion({
      plan_id: 'A1',
      customer: { name: 'Empresa SAS', email: 'x@y.com' },
    })).rejects.toThrow(/los tres son obligatorios/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('acepta form_values solo, sin customer', async () => {
    mockFetch(TOKEN_OK, { status: 200, json: { subscription_id: 'B1', plan_id: 'A1', subscription_url: '', created_at: '' } })
    const sus = await crearSuscripcion({ plan_id: 'A1', form_values: { field_one: 'valor' } })
    expect(sus.subscription_id).toBe('B1')
  })

  it('rechaza phone sin prefijo internacional', async () => {
    await expect(crearSuscripcion({
      plan_id: 'A1',
      customer: { name: 'X', id_type: 'CC', id_number: '123', phone: '311-222-3333' },
    })).rejects.toThrow(/prefijo internacional/)
  })
})

describe('manejo de token y 401', () => {
  it('lanza TrazoAuthError ante 401 sin reintentar con el mismo token', async () => {
    const fetchMock = mockFetch(TOKEN_OK, { status: 401, json: { error: { type: 'unauthorized', message: 'Authentication failed.' } } })
    await expect(consultarSuscripcion('B1')).rejects.toThrow(TrazoAuthError)
    expect(fetchMock).toHaveBeenCalledTimes(2) // token + intento único, sin retry
  })

  it('lanza TrazoAuthError si el auth_key es rechazado al pedir token', async () => {
    mockFetch({ status: 401, json: {} })
    await expect(cancelarSuscripcion('B1')).rejects.toThrow(TrazoAuthError)
  })

  it('reutiliza el token cacheado entre llamadas', async () => {
    const fetchMock = mockFetch(
      TOKEN_OK,
      { status: 200, json: { subscription_id: 'B1', plan_id: 'A1', status: 'active', subscription_url: '', created_at: '' } },
      { status: 200, json: { subscription_id: 'B2', plan_id: 'A1', status: 'active', subscription_url: '', created_at: '' } },
    )
    await consultarSuscripcion('B1')
    await consultarSuscripcion('B2')
    // 3 llamadas: 1 token + 2 consultas (el token no se vuelve a pedir)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('tras un 401 el siguiente request pide token nuevo', async () => {
    const fetchMock = mockFetch(
      TOKEN_OK,
      { status: 401, json: {} },
      { status: 200, json: { access_token: 'tok-456', expires_in: 3600 } },
      { status: 200, json: { subscription_id: 'B1', plan_id: 'A1', status: 'active', subscription_url: '', created_at: '' } },
    )
    await expect(consultarSuscripcion('B1')).rejects.toThrow(TrazoAuthError)
    await consultarSuscripcion('B1')
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock.mock.calls[3][1].headers['x-auth-token']).toBe('tok-456')
  })
})
