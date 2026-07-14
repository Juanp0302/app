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

  var cuentaCobroTexto = data.cuenta_cobro_numero
    ? '<p>Adjuntamos también tu <strong>cuenta de cobro No. ' + data.cuenta_cobro_numero + '</strong> con los datos bancarios para el pago.</p>'
    : ''

  var htmlCliente = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1a1a1a;">
      <img src="https://owlcompliance.onrender.com/buho.png" width="120" style="margin-bottom: 16px;" />
      <h2 style="color: #712529;">Bienvenido a Owl Compliance</h2>
      <p>Hola <strong>${data.cliente}</strong>,</p>
      <p>Tu contrato de prestación de servicios profesionales de gestión regulatoria ha sido firmado exitosamente el <strong>${fechaFormateada}</strong>.</p>
      <p>Encontrarás adjuntos a este correo:</p>
      <ul>
        <li>Contrato de Prestación de Servicios — Plan ${data.plan_label}</li>
        <li>Términos y Condiciones (Anexo 1)</li>
        ${data.cuenta_cobro_numero ? '<li>Cuenta de Cobro No. ' + data.cuenta_cobro_numero + '</li>' : ''}
      </ul>
      ${cuentaCobroTexto}
      <p>Guarda estos documentos para tu archivo. Tu suscripción quedará activa una vez se procese el primer pago a través de Mercado Pago.</p>
      <p>Para cualquier duda, escríbenos a <a href="mailto:contacto@owlcompliance.com">contacto@owlcompliance.com</a> o al +57 301 795 4547.</p>
      <br/>
      <p>Atentamente,<br/><strong>Juan Pablo Osorio Marín</strong><br/>Owl Compliance</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
      <p style="font-size: 11px; color: #888;">
        www.owlcompliance.com · contacto@owlcompliance.com · +57 301 795 4547 · Bogotá, Colombia
      </p>
    </div>
  `

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
  var htmlAdmin = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1a1a1a;">
      <img src="https://owlcompliance.onrender.com/buho.png" width="80" style="margin-bottom: 12px;" />
      <h3 style="color: #712529;">[CONTRATO FIRMADO] ${data.cliente}</h3>
      <p><strong>Cliente:</strong> ${data.cliente} (${data.cliente_email})</p>
      <p><strong>Plan:</strong> ${data.plan_label}</p>
      <p><strong>Fecha:</strong> ${fechaFormateada}</p>
      ${data.cuenta_cobro_numero ? '<p><strong>Cuenta de cobro:</strong> ' + data.cuenta_cobro_numero + '</p>' : ''}
      <p>Los documentos han sido guardados en Drive → Contratos OWL → ${data.carpeta_drive}</p>
    </div>
  `

  GmailApp.sendEmail(
    superadminEmail,
    '[CONTRATO FIRMADO] ' + data.cliente + ' — Plan ' + data.plan_label,
    '',
    { htmlBody: htmlAdmin, name: 'Owl Compliance Sistema' }
  )
}
