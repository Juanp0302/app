/**
 * POST /api/contrato/publico
 * Endpoint PÚBLICO — sin autenticación.
 * Genera PDFs del contrato + T&C (+ cuenta de cobro si aplica),
 * los envía directamente por SMTP (nodemailer) y los sube a Drive vía Apps Script.
 */

import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import {
  generarPDFContrato,
  generarPDFTyC,
  generarPDFCuentaCobro,
  DatosContrato,
  DatosCuentaCobro,
} from '@/lib/pdf-contrato'
import { PLANES, PlanKey } from '@/lib/suscripcion'
import { subirContratoADrive } from '@/lib/drive-upload'
import {
  migrateContrato,
  crearCuentaCobro,
} from '@/lib/contrato-db'
import { trazoConfigurado, crearSuscripcionTrazoParaContrato } from '@/lib/trazo-flujo'
import { wompiConfigurado, crearPagoWompiParaContrato } from '@/lib/wompi-flujo'
import { trazoCobrosConfigurado, crearCobroTrazoParaContrato } from '@/lib/trazo-cobros-flujo'

function getIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '0.0.0.0'
  )
}

function mesLabel(fecha: Date): string {
  return fecha.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
}

/** Envía el correo con los PDFs adjuntos directamente por SMTP */
async function enviarCorreo(opts: {
  destinatario: string
  planLabel:    string
  cliente:      string
  fechaFmt:     string
  numeroCuenta: string | null
  enlacePago:   string | null
  adjuntos:     Array<{ filename: string; content: Buffer }>
}): Promise<void> {
  const gmailUser = process.env.GMAIL_USER
  const gmailPass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '')
  if (!gmailUser || !gmailPass) {
    console.error('[contrato/publico] GMAIL_USER o GMAIL_APP_PASSWORD no configurados')
    return
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: gmailUser, pass: gmailPass },
  })

  const listaDocs = `
    <ul>
      <li>Contrato de Prestación de Servicios — Plan ${opts.planLabel}</li>
      <li>Términos y Condiciones (Anexo 1)</li>
      ${opts.numeroCuenta ? `<li>Cuenta de Cobro No. ${opts.numeroCuenta}</li>` : ''}
    </ul>`

  const cuentaTexto = opts.numeroCuenta
    ? `<p>Incluimos también tu <strong>cuenta de cobro No. ${opts.numeroCuenta}</strong> con el enlace de pago a través de Trazo (trazo.co).</p>`
    : ''

  const pagoTexto = opts.enlacePago
    ? `<p style="margin:24px 0;"><a href="${opts.enlacePago}" style="background:#712529;color:#ffffff;padding:12px 26px;border-radius:6px;text-decoration:none;font-weight:bold;">Activar mi suscripción — pagar ahora</a></p>
       <p style="font-size:13px;color:#555;">Al vincular tu medio de pago se realizará el primer cobro y tu cuenta quedará activa automáticamente.</p>`
    : ''

  const htmlCliente = `
    <div style="font-family:Arial,sans-serif;max-width:600px;color:#1a1a1a;">
      <img src="https://app.owlcompliance.com/buho.png" width="120" style="margin-bottom:16px;"/>
      <h2 style="color:#712529;">Contrato firmado — Owl Compliance</h2>
      <p>Hola <strong>${opts.cliente}</strong>,</p>
      <p>Tu contrato de prestación de servicios ha sido firmado electrónicamente el <strong>${opts.fechaFmt}</strong>.</p>
      <p>Adjuntamos a este correo:</p>
      ${listaDocs}
      ${cuentaTexto}
      ${pagoTexto}
      <p>Guarda estos documentos para tu archivo. Tu suscripción quedará activa una vez se procese el primer pago a través de Trazo (trazo.co).</p>
      <p>Para cualquier duda escríbenos a <a href="mailto:contacto@owlcompliance.com">contacto@owlcompliance.com</a> o al +57 301 795 4547.</p>
      <br/><p>Atentamente,<br/><strong>Juan Pablo Osorio Marín</strong><br/>Owl Compliance</p>
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0;"/>
      <p style="font-size:11px;color:#888;">www.owlcompliance.com · contacto@owlcompliance.com · +57 301 795 4547 · Bogotá, Colombia</p>
    </div>`

  // Correo al cliente
  await transporter.sendMail({
    from:        `"Owl Compliance" <${gmailUser}>`,
    to:          opts.destinatario,
    subject:     `Contrato firmado — Plan ${opts.planLabel} · Owl Compliance`,
    html:        htmlCliente,
    attachments: opts.adjuntos,
  })

  // Notificación al superadmin (sin adjuntos)
  const superadmin = process.env.SUPERADMIN_EMAIL ?? 'contacto@owlcompliance.com'
  await transporter.sendMail({
    from:    `"Owl Compliance Sistema" <${gmailUser}>`,
    to:      superadmin,
    subject: `[CONTRATO FIRMADO] ${opts.cliente} — Plan ${opts.planLabel}`,
    html:    `
      <div style="font-family:Arial,sans-serif;max-width:600px;">
        <h3 style="color:#712529;">[CONTRATO FIRMADO] ${opts.cliente}</h3>
        <p><strong>Cliente:</strong> ${opts.cliente} (${opts.destinatario})</p>
        <p><strong>Plan:</strong> ${opts.planLabel}</p>
        <p><strong>Fecha:</strong> ${opts.fechaFmt}</p>
        ${opts.numeroCuenta ? `<p><strong>Cuenta de cobro:</strong> ${opts.numeroCuenta}</p>` : ''}
      </div>`,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    nombreCliente, tipoPersona, tipoIdentificacion,
    numeroIdentificacion, ciudadCliente, nombreRepresentante,
    ccRepresentante, plan, email, cuentaCobroSolicitada,
  } = body

  const requeridos: Record<string, string> = {
    nombreCliente, tipoPersona, tipoIdentificacion,
    numeroIdentificacion, ciudadCliente, nombreRepresentante,
    ccRepresentante, plan, email,
  }
  for (const [campo, valor] of Object.entries(requeridos)) {
    if (!valor?.toString().trim()) {
      return NextResponse.json({ error: `Campo requerido: ${campo}` }, { status: 400 })
    }
  }

  if (!PLANES[plan as PlanKey]) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }

  const ip       = getIP(req)
  const ahora    = new Date()
  const fechaISO = ahora.toISOString()
  const planKey  = plan as PlanKey
  const planObj  = PLANES[planKey]

  const fechaFmt = ahora.toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // ── Generar PDFs ────────────────────────────────────────────────────────────

  const datosContrato: DatosContrato = {
    nombreCliente, tipoPersona, tipoIdentificacion,
    numeroIdentificacion, ciudadCliente, nombreRepresentante, ccRepresentante,
    plan: planKey, fechaAceptacion: fechaISO, ip, clienteEmail: email,
  }

  let pdfContrato: Buffer
  let pdfTyC:      Buffer
  let pdfCuenta:   Buffer | null = null
  let numeroCuenta: string | null = null

  try {
    ;[pdfContrato, pdfTyC] = await Promise.all([
      generarPDFContrato(datosContrato),
      generarPDFTyC({ fechaAceptacion: fechaISO, clienteEmail: email, ip }),
    ])
  } catch (e: any) {
    console.error('[contrato/publico] Error generando PDFs:', e)
    return NextResponse.json({ error: 'Error generando documentos: ' + e.message }, { status: 500 })
  }

  const nombreArchivoContrato = `Contrato-${nombreCliente.replace(/\s+/g, '_')}-${ahora.toISOString().slice(0, 10)}.pdf`
  const nombreArchivoTyC      = `TyC-OWL-Compliance-${ahora.toISOString().slice(0, 10)}.pdf`

  const adjuntosEmail: Array<{ filename: string; content: Buffer }> = [
    { filename: nombreArchivoContrato, content: pdfContrato },
    { filename: nombreArchivoTyC,      content: pdfTyC },
  ]

  if (cuentaCobroSolicitada) {
    await migrateContrato()
    try {
      // crearCuentaCobro inserta en DB y devuelve el número basado en el id real (sin race condition)
      numeroCuenta = await crearCuentaCobro({
        clienteId:    email,
        plan:         planKey,
        monto:        planObj.precio,
        concepto:     `Plan ${planObj.label} — ${mesLabel(ahora)}`,
        mes:          ahora.toISOString().slice(0, 7),
        fechaEmision: fechaISO,
      })

      const datosCuenta: DatosCuentaCobro = {
        numero:             numeroCuenta,
        fecha:              fechaISO,
        nombreEmpresa:      nombreCliente,
        nit:                numeroIdentificacion,
        representanteLegal: nombreRepresentante,
        plan:               planKey,
        mes:                mesLabel(ahora),
      }
      pdfCuenta = await generarPDFCuentaCobro(datosCuenta)
      if (pdfCuenta) {
        adjuntosEmail.push({ filename: `CuentaCobro-${numeroCuenta}.pdf`, content: pdfCuenta })
      }
    } catch (e) {
      console.error('[contrato/publico] Error cuenta de cobro:', e)
    }
  }

  // ── Generar el enlace de pago, según PASARELA_ACTIVA ────────────────────────
  // Por defecto (sin la variable, o con cualquier valor distinto a 'wompi'/
  // 'trazo-cobros') el comportamiento es EXACTAMENTE el mismo de siempre:
  // Trazo con Suscripciones. Los dos planes B (Wompi, y Trazo con Cobros de
  // pago único — ver lib/wompi-flujo.ts y lib/trazo-cobros-flujo.ts) solo se
  // activan cambiando esta variable en el entorno, sin tocar código. Si la
  // pasarela activa falla, el flujo sigue como antes: contrato por correo y
  // activación manual del pago.
  let enlacePago: string | null = null
  const pasarelaActiva = (process.env.PASARELA_ACTIVA ?? 'trazo').toLowerCase()

  if (pasarelaActiva === 'wompi' && wompiConfigurado()) {
    try {
      const wompi = await crearPagoWompiParaContrato({
        plan: planKey,
        nombreCliente,
        tipoIdentificacion,
        numeroIdentificacion,
        email,
        contratoDatos: datosContrato,
      })
      enlacePago = wompi.checkoutUrl
    } catch (e: any) {
      console.error('[contrato/publico] Error generando enlace de pago en Wompi:', e)
    }
  } else if (pasarelaActiva === 'trazo-cobros' && trazoCobrosConfigurado()) {
    try {
      const cobro = await crearCobroTrazoParaContrato({
        plan: planKey,
        nombreCliente,
        tipoIdentificacion,
        numeroIdentificacion,
        email,
        contratoDatos: datosContrato,
      })
      enlacePago = cobro.link
    } catch (e: any) {
      console.error('[contrato/publico] Error generando Cobro en Trazo:', e)
    }
  } else if (trazoConfigurado()) {
    try {
      const trazo = await crearSuscripcionTrazoParaContrato({
        plan: planKey,
        nombreCliente,
        tipoIdentificacion,
        numeroIdentificacion,
        email,
        contratoDatos: datosContrato,
      })
      enlacePago = trazo.subscriptionUrl
    } catch (e: any) {
      console.error('[contrato/publico] Error creando suscripción en Trazo:', e)
    }
  }

  // ── Enviar correo por SMTP ──────────────────────────────────────────────────
  try {
    await enviarCorreo({
      destinatario: email,
      planLabel:    planObj.label,
      cliente:      nombreCliente,
      fechaFmt,
      numeroCuenta,
      enlacePago,
      adjuntos:     adjuntosEmail,
    })
  } catch (e: any) {
    console.error('[contrato/publico] Error enviando correo:', e)
    // No falla el flujo completo — los docs se generaron, solo falló el envío
  }

  // ── Subir a Drive directamente vía Drive API (fire-and-forget) ────────────
  subirContratoADrive({
    nombreCliente,
    adjuntos: adjuntosEmail,
  }).catch(e => console.error('[contrato/publico] Error Drive:', e))

  return NextResponse.json({ ok: true, numeroCuenta: numeroCuenta ?? null, enlacePago })
}
