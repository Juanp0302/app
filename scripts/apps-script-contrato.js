/**
 * ACTUALIZACIÓN DE GOOGLE APPS SCRIPT — Flujo de contrato
 *
 * Agrega este bloque al switch/if dentro de tu función doPost() actual,
 * justo antes del return ContentService...
 *
 * También necesitas:
 * 1. Crear una carpeta "Contratos OWL" en el Drive de contacto@owlcompliance.com
 * 2. Copiar el ID de esa carpeta (el segmento largo en la URL de Drive)
 * 3. Pegar ese ID en la constante CONTRATOS_FOLDER_ID abajo
 */

// ── Constante — edita con el ID real de tu carpeta en Drive ──────────────────
const CONTRATOS_FOLDER_ID = 'PEGA_AQUI_EL_ID_DE_LA_CARPETA'

const LOGO_URL = 'https://owlcompliance.onrender.com/logo.png'

// ── Handler para tipo_entidad === 'contrato_firmado' ─────────────────────────
// Agrega esto dentro de tu función doPost(), en el bloque if/else o switch:

/*
  } else if (data.tipo_entidad === 'contrato_firmado') {
    manejarContratoFirmado(data)

  // (resto de tu código...)
*/

function manejarContratoFirmado(data) {
  /*
    data contiene:
    - cliente:             nombre de la empresa/persona
    - cliente_email:       correo del cliente
    - plan_label:          "Básico" | "Pro" | "Premium"
    - fecha:               ISO string
    - adjuntos:            Array de { nombre: string, base64: string }
    - carpeta_drive:       nombre de la subcarpeta a crear
    - cuenta_cobro_numero: "OWL-26-00001" o null
  */

  // 1. Obtener o crear la subcarpeta del cliente dentro de "Contratos OWL"
  var carpetaPadre = DriveApp.getFolderById(CONTRATOS_FOLDER_ID)
  var nombreSubcarpeta = data.carpeta_drive || data.cliente
  var subcarpetas = carpetaPadre.getFoldersByName(nombreSubcarpeta)
  var subcarpeta = subcarpetas.hasNext()
    ? subcarpetas.next()
    : carpetaPadre.createFolder(nombreSubcarpeta)

  // 2. Guardar los PDFs en Drive
  var adjuntos = data.adjuntos || []
  var blobs = []
  adjuntos.forEach(function(adj) {
    var bytes = Utilities.base64Decode(adj.base64)
    var blob  = Utilities.newBlob(bytes, 'application/pdf', adj.nombre)
    subcarpeta.createFile(blob)
    blobs.push(blob)
  })

  // 3. Enviar correo al cliente con los documentos adjuntos
  var fechaFormateada = Utilities.formatDate(
    new Date(data.fecha),
    'America/Bogota',
    "d 'de' MMMM 'de' yyyy"
  )

  var itemsCuenta = data.cuenta_cobro_numero
    ? '<li style="margin-bottom:6px;">Cuenta de Cobro No. ' + data.cuenta_cobro_numero + '</li>'
    : ''

  var notaCuenta = data.cuenta_cobro_numero
    ? '<div style="margin:20px 0;padding:14px 18px;background:#f9f6f0;border-left:3px solid #968622;border-radius:4px;">' +
        '<p style="margin:0;font-size:13px;color:#270205;">Adjuntamos también tu <strong>Cuenta de Cobro No. ' + data.cuenta_cobro_numero + '</strong> con el enlace de pago a través de Trazo (trazo.co).</p>' +
      '</div>'
    : ''

  var htmlCliente =
    '<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;background:#ffffff;">' +

      // Header
      '<div style="background:#270205;padding:24px 32px;border-radius:8px 8px 0 0;">' +
        '<img src="' + LOGO_URL + '" width="160" style="display:block;max-height:56px;object-fit:contain;" />' +
      '</div>' +

      // Body
      '<div style="padding:32px;border:1px solid #e0d8c8;border-top:none;">' +
        '<h2 style="font-size:20px;color:#270205;margin:0 0 6px;">Bienvenido a Owl Compliance</h2>' +
        '<p style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#968622;margin:0 0 24px;">Gestión Regulatoria para PRSTs en Colombia</p>' +

        '<p style="font-size:14px;color:#270205;margin:0 0 12px;">Hola <strong>' + data.cliente + '</strong>,</p>' +
        '<p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 16px;">' +
          'Tu contrato de prestación de servicios de gestión regulatoria ha sido firmado exitosamente el <strong style="color:#270205;">' + fechaFormateada + '</strong>.' +
        '</p>' +

        '<p style="font-size:13px;color:#270205;font-weight:700;margin:0 0 8px;">Documentos adjuntos:</p>' +
        '<ul style="font-size:13px;color:#555;line-height:1.8;margin:0 0 20px;padding-left:20px;">' +
          '<li style="margin-bottom:6px;">Contrato de Prestación de Servicios — Plan ' + data.plan_label + '</li>' +
          '<li style="margin-bottom:6px;">Términos y Condiciones (Anexo 1)</li>' +
          itemsCuenta +
        '</ul>' +

        notaCuenta +

        '<p style="font-size:13px;color:#555;line-height:1.7;margin:0 0 16px;">' +
          'Tu suscripción quedará activa una vez se procese el primer pago. Guarda estos documentos para tu archivo.' +
        '</p>' +

        '<p style="font-size:13px;color:#555;line-height:1.7;margin:0 0 24px;">' +
          'Para cualquier duda, escríbenos a <a href="mailto:contacto@owlcompliance.com" style="color:#712529;">contacto@owlcompliance.com</a> o al +57 301 795 4547.' +
        '</p>' +

        '<div style="border-top:1px solid #e0d8c8;padding-top:20px;">' +
          '<p style="font-size:13px;color:#270205;margin:0;">Atentamente,</p>' +
          '<p style="font-size:13px;font-weight:700;color:#270205;margin:4px 0 2px;">Juan Pablo Osorio Marín</p>' +
          '<p style="font-size:12px;color:#968622;margin:0;">Owl Compliance</p>' +
        '</div>' +
      '</div>' +

      // Footer
      '<div style="background:#1a1413;padding:14px 32px;border-radius:0 0 8px 8px;display:flex;justify-content:space-between;align-items:center;">' +
        '<span style="font-size:11px;color:rgba(231,223,202,0.7);">+57 301 795 4547</span>' +
        '<span style="font-size:11px;color:rgba(231,223,202,0.7);">www.owlcompliance.com</span>' +
        '<span style="font-size:11px;color:rgba(231,223,202,0.7);">Bogotá, Colombia</span>' +
      '</div>' +

    '</div>'

  GmailApp.sendEmail(
    data.cliente_email,
    'Contrato firmado — Plan ' + data.plan_label + ' · Owl Compliance',
    '',
    {
      htmlBody:    htmlCliente,
      attachments: blobs,
      name:        'Owl Compliance',
    }
  )

  // 4. Notificar al superadmin
  var superadminEmail = 'contacto@owlcompliance.com'
  var htmlAdmin =
    '<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;background:#ffffff;">' +

      '<div style="background:#270205;padding:20px 28px;border-radius:8px 8px 0 0;">' +
        '<img src="' + LOGO_URL + '" width="140" style="display:block;max-height:50px;object-fit:contain;" />' +
      '</div>' +

      '<div style="padding:28px;border:1px solid #e0d8c8;border-top:none;">' +
        '<h3 style="font-size:16px;color:#712529;margin:0 0 16px;">[CONTRATO FIRMADO] ' + data.cliente + '</h3>' +
        '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
          '<tr><td style="padding:6px 0;color:#968622;font-weight:700;width:140px;">Cliente</td><td style="color:#270205;">' + data.cliente + ' (' + data.cliente_email + ')</td></tr>' +
          '<tr><td style="padding:6px 0;color:#968622;font-weight:700;">Plan</td><td style="color:#270205;">' + data.plan_label + '</td></tr>' +
          '<tr><td style="padding:6px 0;color:#968622;font-weight:700;">Fecha</td><td style="color:#270205;">' + fechaFormateada + '</td></tr>' +
          (data.cuenta_cobro_numero ? '<tr><td style="padding:6px 0;color:#968622;font-weight:700;">Cuenta de cobro</td><td style="color:#270205;">' + data.cuenta_cobro_numero + '</td></tr>' : '') +
          '<tr><td style="padding:6px 0;color:#968622;font-weight:700;">Drive</td><td style="color:#270205;">Contratos OWL → ' + data.carpeta_drive + '</td></tr>' +
        '</table>' +
      '</div>' +

      '<div style="background:#1a1413;padding:12px 28px;border-radius:0 0 8px 8px;">' +
        '<span style="font-size:11px;color:rgba(231,223,202,0.6);">Owl Compliance · Sistema interno</span>' +
      '</div>' +

    '</div>'

  GmailApp.sendEmail(
    superadminEmail,
    '[CONTRATO FIRMADO] ' + data.cliente + ' — Plan ' + data.plan_label,
    '',
    { htmlBody: htmlAdmin, name: 'Owl Compliance Sistema' }
  )
}
