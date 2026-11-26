/**
 * POST /api/on-demand/<token>  (público)
 * Quien recibió el enlace de un servicio on demand envía sus datos de contacto
 * y el objeto del servicio. Se guarda, se registra como lead, se avisa al
 * superadmin y se genera el Cobro de Trazo; la respuesta trae el enlace de pago.
 *
 * Si ya llenó los datos y el pago sigue pendiente, devuelve el mismo enlace
 * (no crea otro cobro). Nada de esto crea cuentas: ver crearCobroOnDemand.
 */
import { NextRequest, NextResponse } from 'next/server'
import { buscarServicioPorToken, guardarDatosSolicitante } from '@/lib/on-demand-db'
import { crearCobroOnDemand, trazoCobrosConfigurado } from '@/lib/trazo-cobros-flujo'
import { migrateLeads, insertarLead } from '@/lib/leads-db'

const ORIGEN_LEAD = 'on demand'
const TIPOS_ID = ['NIT', 'CC', 'CE', 'PASAPORTE']
const CORREO_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/
const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '').slice(0, max)

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const servicio = await buscarServicioPorToken(token)
  if (!servicio || servicio.avance === 'cancelado') return NextResponse.json({ error: 'Este enlace no existe o ya no está disponible.' }, { status: 404 })
  if (servicio.estado_pago === 'pagada') return NextResponse.json({ error: 'Este servicio ya fue pagado. ¡Gracias!' }, { status: 409 })
  if (servicio.estado_pago === 'pendiente' && servicio.link_pago) return NextResponse.json({ ok: true, link: servicio.link_pago })

  let b: any
  try { b = await req.json() } catch { return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 }) }
  if (typeof b._honey === 'string' && b._honey.trim() !== '') return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })

  const nombre   = texto(b.nombre, 120)
  const empresa  = texto(b.empresa, 160)
  const tipoId   = texto(b.tipo_id, 20).toUpperCase()
  const numeroId = texto(b.numero_id, 30)
  const telefono = texto(b.telefono, 30)
  const correo   = texto(b.correo, 160).toLowerCase()
  const objeto   = typeof b.objeto === 'string' ? b.objeto.trim().slice(0, 3000) : ''
  const digitos  = telefono.replace(/\D/g, '')

  const errores: string[] = []
  if (nombre.length < 2)                         errores.push('nombre')
  if (empresa.length < 2)                        errores.push('empresa')
  if (!TIPOS_ID.includes(tipoId))                errores.push('tipo_id')
  if (numeroId.replace(/\W/g, '').length < 4)    errores.push('numero_id')
  if (digitos.length < 7 || digitos.length > 15) errores.push('telefono')
  if (!CORREO_RE.test(correo))                   errores.push('correo')
  if (objeto.length < 10)                        errores.push('objeto')
  if (b.autorizacion !== true)                   errores.push('autorizacion')
  if (errores.length) return NextResponse.json({ error: 'Revise los campos marcados', campos: errores }, { status: 400 })

  if (!trazoCobrosConfigurado()) return NextResponse.json({ error: 'El pago en línea no está disponible en este momento. Escríbanos a contacto@owlcompliance.com.' }, { status: 503 })

  // Trazo exige el documento de quien paga: si es NIT, el pagador es la empresa
  let cobro: { externalReference: string; link: string }
  try {
    cobro = await crearCobroOnDemand({
      concepto: servicio.concepto, monto: servicio.monto,
      nombreCliente: tipoId === 'NIT' ? empresa : nombre,
      tipoIdentificacion: tipoId, numeroIdentificacion: numeroId, email: correo,
      clienteId: servicio.cliente_id,
    })
  } catch (e: any) {
    console.error('[on-demand] Trazo no generó el cobro:', e)
    return NextResponse.json({ error: 'No pudimos generar el pago. Intente de nuevo en unos minutos o escríbanos a contacto@owlcompliance.com.' }, { status: 502 })
  }

  await guardarDatosSolicitante(servicio.id, {
    nombre, empresa, tipoId, numeroId, telefono, correo, objeto,
    externalReference: cobro.externalReference, linkPago: cobro.link,
  })

  // Como todos los formularios, también queda en Leads. Si falla, el servicio ya quedó guardado.
  try {
    await migrateLeads()
    await insertarLead({
      origen: ORIGEN_LEAD, nombre, empresa, correo, telefono,
      asunto: `Servicio on demand: ${servicio.concepto}`, mensaje: objeto,
      landing_page: '/pago', datos: JSON.stringify({ servicio_id: servicio.id, nit: tipoId === 'NIT' ? numeroId : undefined, monto: servicio.monto }),
    })
  } catch (e) {
    console.error('[on-demand] No se pudo registrar el lead:', e)
  }

  const { enviarEmail } = await import('@/lib/email')
  const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
  const appUrl = (process.env.NEXTAUTH_URL ?? 'https://app.owlcompliance.com').replace(/\/$/, '')
  enviarEmail({
    to: process.env.SUPERADMIN_EMAIL ?? 'owlcompliance2026@gmail.com',
    subject: `[ON DEMAND] ${servicio.concepto} — ${empresa} llenó sus datos`,
    html: `<p><strong>${esc(nombre)}</strong> (${esc(empresa)}) llenó sus datos para <strong>${esc(servicio.concepto)}</strong>
      ($${servicio.monto.toLocaleString('es-CO')} COP). Ya se le envió a pagar.</p>
      <p>Teléfono: ${esc(telefono)}<br>Correo: ${esc(correo)}</p>
      <p><strong>Objeto del servicio:</strong><br>${esc(objeto).replace(/\n/g, '<br>')}</p>
      <p><a href="${appUrl}/dashboard/on-demand">Ver seguimiento</a></p>`,
  }).catch(e => console.error('[on-demand] Error avisando al superadmin:', e))

  return NextResponse.json({ ok: true, link: cobro.link })
}
