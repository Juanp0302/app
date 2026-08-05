/**
 * lib/cortesias.ts
 * Suscripciones de cortesía: el superadmin activa una cuenta nueva gratis por
 * N meses (sin pasar por Trazo/Wompi). Al vencer, se suspende y se notifica
 * igual que cualquier otra suspensión por falta de pago.
 */
import { queryAll, execute } from './db'
import { migrateSuscripcion, PLANES, type PlanKey } from './suscripcion'
import { crearCuentaClienteAutomatica } from './clientes'

export interface DatosCortesia {
  razon_social: string
  email:        string
  nit?:         string
  contacto?:    string   // nombre del representante/contacto, para el correo de bienvenida
  plan:         PlanKey
  meses:        number   // 1-24
}

function sumarMeses(fecha: Date, meses: number): Date {
  const d = new Date(fecha)
  d.setMonth(d.getMonth() + meses)
  return d
}

/**
 * Crea la cuenta completa de un cliente nuevo en modalidad de cortesía:
 * misma cuenta/onboarding que un cliente que paga (contraseña temporal,
 * cambio obligatorio, elección de servicios, correo de bienvenida), pero
 * marcada como es_cortesia = 1 y con vencimiento a los N meses.
 */
export async function crearCortesia(datos: DatosCortesia): Promise<{ clienteId: string; passwordTemporal: string }> {
  await migrateSuscripcion()

  const planInfo = PLANES[datos.plan]
  if (!planInfo) throw new Error(`Plan inválido: ${datos.plan}`)
  if (!Number.isInteger(datos.meses) || datos.meses < 1 || datos.meses > 24) {
    throw new Error('Los meses de cortesía deben ser un entero entre 1 y 24')
  }

  const vencimiento = sumarMeses(new Date(), datos.meses)

  const cuenta = await crearCuentaClienteAutomatica({
    razon_social: datos.razon_social,
    nit:          datos.nit,
    contacto:     datos.contacto,
    email:        datos.email,
    user_email:   datos.email,
    // Siempre la razón social — "contacto" puede venir vacío o con datos que
    // no son un nombre de persona (ej. un número de teléfono), y este valor
    // es el que se muestra como "Cliente" en los correos de bienvenida y
    // de notificación al superadmin.
    user_nombre:  datos.razon_social,
    plan:         datos.plan,
    suscripcion_vencimiento: vencimiento.toISOString(),
  })

  await execute(`UPDATE clientes SET es_cortesia = 1 WHERE id = ?`, [cuenta.clienteId])

  return { clienteId: cuenta.clienteId, passwordTemporal: cuenta.passwordTemporal }
}

export interface ResultadoCortesiaVencida { clienteId: string; cliente: string; email: string }

/**
 * Busca cortesías activas cuyo vencimiento ya pasó, las suspende y notifica
 * al cliente con el mismo correo genérico de suspensión que usan Trazo/Wompi.
 * Pensada para llamarse una vez al día desde un cron (ver
 * app/api/interno/cortesias-vencidas).
 */
export async function procesarCortesiasVencidas(): Promise<ResultadoCortesiaVencida[]> {
  await migrateSuscripcion()

  const vencidas = await queryAll(`
    SELECT c.id, c.razon_social, c.plan, u.email
    FROM clientes c
    JOIN users u ON u.id = c.user_id
    WHERE c.es_cortesia = 1
      AND c.suscripcion_estado = 'activa'
      AND c.suscripcion_vencimiento IS NOT NULL
      AND datetime(c.suscripcion_vencimiento) <= datetime('now')
  `) as any[]

  const { notificarSuscripcion } = await import('./notificaciones')
  const resultado: ResultadoCortesiaVencida[] = []

  for (const c of vencidas) {
    await execute(`UPDATE clientes SET suscripcion_estado = 'suspendida', updated_at = datetime('now') WHERE id = ?`, [c.id])

    notificarSuscripcion({
      clienteId: c.id, cliente: c.razon_social, clienteEmail: c.email,
      plan: c.plan ?? '', estado: 'suspendida', fecha: new Date().toISOString(),
    }).catch(e => console.error('[cortesias] Error notificando vencimiento de cortesía:', e))

    resultado.push({ clienteId: c.id, cliente: c.razon_social, email: c.email })
  }

  return resultado
}
