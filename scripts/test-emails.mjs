/**
 * test-emails.mjs
 * Envía un correo de prueba por cada tipo de notificación del sistema.
 * Destinatario de prueba: contacto@simplaw.co
 * Superadmin copia: contacto@owlcompliance.com
 */

const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbyWFHLutUmf8tPlVDVoACWw7uYGaiZSxgeaL-bb9dnKGXo-Y4wwtAw5Xig-IUBLD3fH/exec'
const TEST_EMAIL  = 'contacto@simplaw.co'
const ADMIN_EMAIL = 'contacto@owlcompliance.com'
const FECHA       = new Date().toLocaleString('es-CO')

async function enviar(label, params) {
  console.log(`\n📨 Enviando: ${label}`)
  try {
    const res = await fetch(WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(params),
    })
    const text = await res.text()
    console.log(`   ✓ Status ${res.status}: ${text.slice(0, 120)}`)
  } catch (e) {
    console.error(`   ✗ Error:`, e.message)
  }
  // Pausa entre envíos para no saturar el webhook
  await new Promise(r => setTimeout(r, 1500))
}

// ─── 1. Bienvenida al cliente ────────────────────────────────────────────────
await enviar('Bienvenida — correo al cliente', {
  id:            'test-bienvenida-cliente',
  tipo_entidad:  'ticket',
  especialidad:  'transversal',
  asunto:        'Bienvenido a Owl Compliance — Tus credenciales de acceso',
  cliente:       'Operador de Prueba S.A.S.',
  cliente_email: TEST_EMAIL,
  admin_email:   TEST_EMAIL,
  comentario:    `Usuario: ${TEST_EMAIL} | Contraseña temporal: OwlTest1! | Plan: Básico | Ingresa en: https://app.owlcompliance.com/login`,
  estado:        'activa',
  fecha:         FECHA,
})

// ─── 2. Bienvenida — copia al superadmin ────────────────────────────────────
await enviar('Bienvenida — copia al superadmin', {
  id:            'test-bienvenida-admin',
  tipo_entidad:  'ticket',
  especialidad:  'transversal',
  asunto:        '[NUEVO CLIENTE] Operador de Prueba S.A.S. se suscribió al Plan Básico',
  cliente:       'Operador de Prueba S.A.S.',
  cliente_email: TEST_EMAIL,
  admin_email:   ADMIN_EMAIL,
  estado:        'activa',
  fecha:         FECHA,
})

// ─── 3. Suscripción activada — cliente ──────────────────────────────────────
await enviar('Suscripción ACTIVADA — cliente', {
  id:            'test-sub-activa-cliente',
  tipo_entidad:  'ticket',
  especialidad:  'transversal',
  asunto:        '[SUSCRIPCIÓN ACTIVADA] Plan Básico — Operador de Prueba S.A.S.',
  cliente:       'Operador de Prueba S.A.S.',
  cliente_email: TEST_EMAIL,
  admin_email:   TEST_EMAIL,
  estado:        'activa',
  fecha:         FECHA,
})

await enviar('Suscripción ACTIVADA — superadmin', {
  id:            'test-sub-activa-admin',
  tipo_entidad:  'ticket',
  especialidad:  'transversal',
  asunto:        '[SUSCRIPCIÓN ACTIVADA] Plan Básico — Operador de Prueba S.A.S.',
  cliente:       'Operador de Prueba S.A.S.',
  cliente_email: TEST_EMAIL,
  admin_email:   ADMIN_EMAIL,
  estado:        'activa',
  fecha:         FECHA,
})

// ─── 4. Suscripción suspendida ───────────────────────────────────────────────
await enviar('Suscripción SUSPENDIDA — cliente', {
  id:            'test-sub-suspendida-cliente',
  tipo_entidad:  'ticket',
  especialidad:  'transversal',
  asunto:        '[SUSCRIPCIÓN SUSPENDIDA] Plan Básico — Operador de Prueba S.A.S.',
  cliente:       'Operador de Prueba S.A.S.',
  cliente_email: TEST_EMAIL,
  admin_email:   TEST_EMAIL,
  estado:        'suspendida',
  fecha:         FECHA,
})

await enviar('Suscripción SUSPENDIDA — superadmin', {
  id:            'test-sub-suspendida-admin',
  tipo_entidad:  'ticket',
  especialidad:  'transversal',
  asunto:        '[SUSCRIPCIÓN SUSPENDIDA] Plan Básico — Operador de Prueba S.A.S.',
  cliente:       'Operador de Prueba S.A.S.',
  cliente_email: TEST_EMAIL,
  admin_email:   ADMIN_EMAIL,
  estado:        'suspendida',
  fecha:         FECHA,
})

// ─── 5. Suscripción cancelada ────────────────────────────────────────────────
await enviar('Suscripción CANCELADA — cliente', {
  id:            'test-sub-cancelada-cliente',
  tipo_entidad:  'ticket',
  especialidad:  'transversal',
  asunto:        '[SUSCRIPCIÓN CANCELADA] Plan Básico — Operador de Prueba S.A.S.',
  cliente:       'Operador de Prueba S.A.S.',
  cliente_email: TEST_EMAIL,
  admin_email:   TEST_EMAIL,
  estado:        'cancelada',
  fecha:         FECHA,
})

await enviar('Suscripción CANCELADA — superadmin', {
  id:            'test-sub-cancelada-admin',
  tipo_entidad:  'ticket',
  especialidad:  'transversal',
  asunto:        '[SUSCRIPCIÓN CANCELADA] Plan Básico — Operador de Prueba S.A.S.',
  cliente:       'Operador de Prueba S.A.S.',
  cliente_email: TEST_EMAIL,
  admin_email:   ADMIN_EMAIL,
  estado:        'cancelada',
  fecha:         FECHA,
})

// ─── 6. Documento subido (notificación al admin) ─────────────────────────────
await enviar('Documento subido — admin', {
  id:            'test-doc-subido',
  tipo_entidad:  'documento_subido',
  especialidad:  'infraestructura',
  asunto:        'Nuevo documento: Reporte de calidad del servicio — reporte_calidad_2025.pdf',
  cliente:       'Operador de Prueba S.A.S.',
  cliente_email: TEST_EMAIL,
  admin_email:   ADMIN_EMAIL,
  estado:        'pendiente',
  fecha:         FECHA,
})

await enviar('Documento subido — copia al cliente (test)', {
  id:            'test-doc-subido-cliente',
  tipo_entidad:  'documento_subido',
  especialidad:  'infraestructura',
  asunto:        'Nuevo documento: Reporte de calidad del servicio — reporte_calidad_2025.pdf',
  cliente:       'Operador de Prueba S.A.S.',
  cliente_email: TEST_EMAIL,
  admin_email:   TEST_EMAIL,
  estado:        'pendiente',
  fecha:         FECHA,
})

// ─── 7. Documento aprobado ───────────────────────────────────────────────────
await enviar('Documento APROBADO — cliente', {
  id:            'test-doc-aprobado',
  tipo_entidad:  'documento_revisado',
  especialidad:  'infraestructura',
  asunto:        'Documento aprobado: Reporte de calidad del servicio — reporte_calidad_2025.pdf',
  cliente:       'Operador de Prueba S.A.S.',
  cliente_email: TEST_EMAIL,
  admin_email:   TEST_EMAIL,
  admin_nombre:  'Admin Owl Compliance',
  resultado:     'aprobado',
  comentario:    'El documento cumple con todos los requisitos exigidos. Queda registrado en la matriz de obligaciones.',
  estado:        'aprobado',
  fecha:         FECHA,
})

await enviar('Documento APROBADO — superadmin', {
  id:            'test-doc-aprobado-admin',
  tipo_entidad:  'documento_revisado',
  especialidad:  'infraestructura',
  asunto:        'Documento aprobado: Reporte de calidad del servicio — reporte_calidad_2025.pdf',
  cliente:       'Operador de Prueba S.A.S.',
  cliente_email: TEST_EMAIL,
  admin_email:   ADMIN_EMAIL,
  admin_nombre:  'Admin Owl Compliance',
  resultado:     'aprobado',
  comentario:    'El documento cumple con todos los requisitos exigidos.',
  estado:        'aprobado',
  fecha:         FECHA,
})

// ─── 8. Documento rechazado ──────────────────────────────────────────────────
await enviar('Documento RECHAZADO — cliente', {
  id:            'test-doc-rechazado',
  tipo_entidad:  'documento_revisado',
  especialidad:  'infraestructura',
  asunto:        'Documento rechazado: Reporte de calidad del servicio — reporte_calidad_2025.pdf',
  cliente:       'Operador de Prueba S.A.S.',
  cliente_email: TEST_EMAIL,
  admin_email:   TEST_EMAIL,
  admin_nombre:  'Admin Owl Compliance',
  resultado:     'rechazado',
  comentario:    'El documento no corresponde al período requerido. Por favor cargue el reporte del primer trimestre de 2025.',
  estado:        'rechazado',
  fecha:         FECHA,
})

await enviar('Documento RECHAZADO — superadmin', {
  id:            'test-doc-rechazado-admin',
  tipo_entidad:  'documento_revisado',
  especialidad:  'infraestructura',
  asunto:        'Documento rechazado: Reporte de calidad del servicio — reporte_calidad_2025.pdf',
  cliente:       'Operador de Prueba S.A.S.',
  cliente_email: TEST_EMAIL,
  admin_email:   ADMIN_EMAIL,
  admin_nombre:  'Admin Owl Compliance',
  resultado:     'rechazado',
  comentario:    'El documento no corresponde al período requerido.',
  estado:        'rechazado',
  fecha:         FECHA,
})

// ─── 9. Ticket sin asignar ───────────────────────────────────────────────────
await enviar('Ticket SIN ASIGNAR — superadmin', {
  id:            'test-ticket-sin-asignar',
  tipo_entidad:  'ticket',
  especialidad:  'transversal',
  asunto:        'SIN ASIGNAR: ¿Cómo subo el reporte T.1.1 para el servicio de internet?',
  cliente:       'Operador de Prueba S.A.S.',
  cliente_email: TEST_EMAIL,
  admin_email:   ADMIN_EMAIL,
  estado:        'sin_asignar',
  fecha:         FECHA,
})

// ─── 10. Chat sin asignar ────────────────────────────────────────────────────
await enviar('Chat SIN ASIGNAR — superadmin', {
  id:            'test-chat-sin-asignar',
  tipo_entidad:  'chat',
  especialidad:  'transversal',
  asunto:        'SIN ASIGNAR: Consulta sobre plazo de entrega del reporte mensual',
  cliente:       'Operador de Prueba S.A.S.',
  cliente_email: TEST_EMAIL,
  admin_email:   ADMIN_EMAIL,
  estado:        'sin_asignar',
  fecha:         FECHA,
})

console.log('\n✅ Todos los correos de prueba enviados.')
