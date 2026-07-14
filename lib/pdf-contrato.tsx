/**
 * lib/pdf-contrato.tsx
 * Genera PDFs de contrato, T&C y cuenta de cobro con @react-pdf/renderer.
 *
 * Uso (server-side):
 *   import { generarPDFContrato, generarPDFCuentaCobro } from '@/lib/pdf-contrato'
 *   const buffer = await generarPDFContrato(datos)
 */

import React from 'react'
import {
  Document, Page, Text, View, Image, StyleSheet,
  renderToBuffer, Font,
} from '@react-pdf/renderer'
import path from 'path'
import fs from 'fs'
import { montoCOP } from './numero-letras'
import { PLANES, PlanKey } from './suscripcion'

// ── Colores de marca ──────────────────────────────────────────────────────────
const BORDO  = '#712529'
const OLIVO  = '#7a6e1a'
const GRIS   = '#555555'
const NEGRO  = '#1a1a1a'

// ── Logo (leído una vez desde disco) ─────────────────────────────────────────
function logoPath(): string {
  return path.join(process.cwd(), 'public', 'logo.png')
}

// ── Estilos base ──────────────────────────────────────────────────────────────
const base = StyleSheet.create({
  page: {
    paddingTop: 60,
    paddingBottom: 70,
    paddingHorizontal: 55,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: NEGRO,
    lineHeight: 1.6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  logo: {
    width: 110,
    height: 38,
    objectFit: 'contain',
  },
  headerRight: {
    fontSize: 8,
    color: GRIS,
    textAlign: 'right',
    lineHeight: 1.5,
  },
  divider: {
    borderBottom: `1.5px solid ${BORDO}`,
    marginBottom: 16,
  },
  h1: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: BORDO,
    textAlign: 'center',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  h2: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: BORDO,
    textAlign: 'center',
    marginBottom: 10,
  },
  clausulaTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginTop: 10,
    marginBottom: 3,
    color: BORDO,
    textTransform: 'uppercase',
  },
  p: {
    marginBottom: 6,
    fontSize: 9,
    lineHeight: 1.6,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 55,
    right: 55,
  },
  footerDivider: {
    borderBottom: `1px solid ${BORDO}`,
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: GRIS,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bold: {
    fontFamily: 'Helvetica-Bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5px solid #ccc',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0ebe0',
    borderBottom: `1px solid ${BORDO}`,
  },
  tableCell: {
    padding: '4px 6px',
    fontSize: 8.5,
    flex: 1,
  },
  tableCellBold: {
    padding: '4px 6px',
    fontSize: 8.5,
    flex: 1,
    fontFamily: 'Helvetica-Bold',
  },
  signature: {
    marginTop: 24,
    padding: '12px 16px',
    backgroundColor: '#f8f6f0',
    borderLeft: `3px solid ${OLIVO}`,
    borderRadius: 2,
  },
  signatureTitle: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: OLIVO,
    marginBottom: 4,
  },
  signatureText: {
    fontSize: 8,
    color: GRIS,
    lineHeight: 1.5,
  },
})

// ── Componentes compartidos ───────────────────────────────────────────────────

function Header({ fecha }: { fecha: string }) {
  const logoExists = fs.existsSync(logoPath())
  return (
    <View style={base.header}>
      {logoExists
        ? <Image src={logoPath()} style={base.logo} />
        : <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: BORDO }}>OWL COMPLIANCE</Text>
      }
      <View style={base.headerRight}>
        <Text>contacto@owlcompliance.com</Text>
        <Text>www.owlcompliance.com</Text>
        <Text>+57 301 795 4547</Text>
        <Text style={{ marginTop: 4 }}>{fecha}</Text>
      </View>
    </View>
  )
}

function PageFooter() {
  return (
    <View style={base.footer} fixed>
      <View style={base.footerDivider} />
      <View style={base.footerRow}>
        <Text>+57 301 795 4547</Text>
        <Text>www.owlcompliance.com  |  contacto@owlcompliance.com</Text>
        <Text>Bogotá, Colombia.</Text>
      </View>
    </View>
  )
}

// ── CONTRATO ─────────────────────────────────────────────────────────────────

export interface DatosContrato {
  nombreCliente:        string
  tipoPersona:          string   // 'natural' | 'juridica'
  tipoIdentificacion:   string   // 'NIT' | 'CC' | etc.
  numeroIdentificacion: string
  ciudadCliente:        string
  nombreRepresentante:  string
  ccRepresentante:      string
  plan:                 PlanKey
  fechaAceptacion:      string   // ISO string
  ip:                   string
  clienteEmail:         string
}

function ContratoDoc({ d }: { d: DatosContrato }) {
  const plan  = PLANES[d.plan]
  const fecha = new Date(d.fechaAceptacion).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const planLabel = plan.label
  const precio    = `$${plan.precio.toLocaleString('es-CO')} COP mensuales, más IVA si aplica`

  const tipoPersonaLabel = d.tipoPersona === 'natural' ? 'persona natural' : 'persona jurídica'

  return (
    <Document>
      <Page size="LETTER" style={base.page}>
        <Header fecha={fecha} />
        <View style={base.divider} />

        <Text style={base.h1}>Contrato de Prestación de Servicios</Text>
        <Text style={base.h2}>Gestión Regulatoria para PRST en Colombia — Plan {planLabel}</Text>

        {/* PARTES */}
        <Text style={base.clausulaTitle}>Partes</Text>
        <Text style={base.p}>
          <Text style={base.bold}>PRESTADOR: </Text>
          Juan Pablo Osorio Marín, mayor de edad, identificado con cédula de ciudadanía número 1.053.824.988 de Manizales, domiciliado en Bogotá D.C., Colombia, abogado con Tarjeta Profesional No. 284.927 del Consejo Superior de la Judicatura, quien actúa de forma independiente y bajo la marca comercial Owl Compliance, en adelante el PRESTADOR.
        </Text>
        <Text style={base.p}>
          <Text style={base.bold}>CLIENTE: </Text>
          {d.nombreCliente}, {tipoPersonaLabel}, identificado con {d.tipoIdentificacion} número {d.numeroIdentificacion}, domiciliado en {d.ciudadCliente}, Colombia, representado por {d.nombreRepresentante}, identificado con cédula de ciudadanía número {d.ccRepresentante}, en adelante el CLIENTE.
        </Text>

        {/* DECLARACIONES */}
        <Text style={base.clausulaTitle}>Declaraciones</Text>
        <Text style={base.p}>
          El PRESTADOR declara que cuenta con conocimiento y experiencia en derecho, consultoría regulatoria y gestión de cumplimiento aplicable a proveedores de redes y servicios de telecomunicaciones, ISPs en Colombia, y que presta sus servicios de forma independiente sin impedimento legal o contractual para celebrar este contrato.
        </Text>
        <Text style={base.p}>
          El CLIENTE declara que actúa como PRST, ISP o empresa vinculada a la prestación de servicios de telecomunicaciones o internet en Colombia; que tiene interés legítimo en contratar servicios de gestión regulatoria, capacidad legal para contratar, y que suministrará información completa, veraz y oportuna. Las Partes reconocen que este contrato corresponde a condiciones generales predispuestas por el PRESTADOR. El CLIENTE declara que recibió el texto contractual, los Términos y Condiciones (Anexo 1), el alcance del plan, los precios y las reglas de servicio antes de contratar, y que pudo formular preguntas antes de aceptar.
        </Text>

        {/* CLÁUSULA 1 */}
        <Text style={base.clausulaTitle}>Cláusula 1. Objeto</Text>
        <Text style={base.p}>
          El PRESTADOR se obliga a prestar al CLIENTE servicios profesionales de gestión, monitoreo, consultoría jurídica y técnico-regulatoria en cumplimiento aplicable a PRST en Colombia, de acuerdo con el plan contratado y los Términos y Condiciones incorporados al presente contrato como Anexo 1. La representación formal ante autoridades, interposición de recursos, atención de audiencias, firma de memoriales, demandas o actuaciones que exijan mandato especial no se entienden incluidas automáticamente en la mensualidad. Esas actividades requieren orden de servicio independiente.
        </Text>

        {/* CLÁUSULA 2 */}
        <Text style={base.clausulaTitle}>Cláusula 2. Plan de Servicio</Text>
        <Text style={base.p}>El CLIENTE contrata el siguiente plan mensual:</Text>

        {/* Tabla de plan */}
        <View style={{ marginBottom: 8 }}>
          <View style={base.tableHeader}>
            <Text style={base.tableCellBold}>Plan</Text>
            <Text style={base.tableCellBold}>Precio</Text>
            <Text style={[base.tableCellBold, { flex: 2 }]}>Servicios principales incluidos</Text>
          </View>
          <View style={base.tableRow}>
            <Text style={base.tableCellBold}>{planLabel}</Text>
            <Text style={base.tableCell}>{precio}</Text>
            <Text style={[base.tableCell, { flex: 2 }]}>
              {plan.tickets} consultas/mes, {plan.chats} chats/mes.
              {d.plan === 'basico' && ' Alertas mensuales, plantillas de liquidación, minutas CCU, vademécum regulatorio, orientación RUTIC.'}
              {d.plan === 'pro' && ' Incluye Plan Básico, diagnóstico inicial, revisión y ajuste de CCU, conceptos escritos, repositorio de evidencias, acompañamiento remoto en visitas.'}
              {d.plan === 'premium' && ' Incluye Plan Pro, acompañamiento técnico-regulatorio intensivo, soporte estratégico, tarifas preferenciales para servicios on-demand.'}
            </Text>
          </View>
        </View>

        {/* CLÁUSULA 3 */}
        <Text style={base.clausulaTitle}>Cláusula 3. Precio, Facturación y Forma de Pago</Text>
        <Text style={base.p}>
          El CLIENTE pagará la retribución mensual correspondiente al plan contratado ({precio}). El pago será mensual anticipado, dentro de los primeros cinco días hábiles de cada mes de servicio. El primer pago se realizará al momento de la aceptación del contrato o de la activación del servicio. El CLIENTE asumirá IVA, retenciones, impuestos, tasas y demás cargas aplicables según la ley. Los pagos se harán por transferencia bancaria, PSE, pasarela de pagos, débito autorizado o el medio que el PRESTADOR informe. La mora causará intereses a la tasa máxima legal permitida en Colombia. La retribución mensual podrá ajustarse al inicio de cada anualidad con aviso de treinta días calendario.
        </Text>

        {/* CLÁUSULA 4 */}
        <Text style={base.clausulaTitle}>Cláusula 4. Obligaciones del Prestador</Text>
        <Text style={base.p}>
          Prestar los servicios incluidos en el plan con diligencia profesional, criterio jurídico y estándares razonables del sector. Mantener seguimiento al marco normativo aplicable a PRST (MinTIC, CRC, SIC y demás autoridades). Responder consultas dentro de los tiempos establecidos en el Anexo 1, siempre que el CLIENTE entregue información completa. Guardar confidencialidad sobre la información del CLIENTE y tratar datos personales conforme a la ley. No usar información del CLIENTE para fines propios no autorizados. Informar cambios normativos materiales que afecten el calendario o los entregables del plan.
        </Text>

        {/* CLÁUSULA 5 */}
        <Text style={base.clausulaTitle}>Cláusula 5. Obligaciones del Cliente</Text>
        <Text style={base.p}>
          Pagar oportunamente la retribución pactada. Suministrar información, documentos, accesos y soportes completos, veraces y oportunos. Designar un contacto interno autorizado para gestionar la relación contractual. Validar internamente los documentos y recomendaciones antes de presentarlos ante autoridades. Informar cambios relevantes en razón social, registro, cobertura, infraestructura o situación regulatoria. Usar la plataforma y los entregables conforme a su finalidad, sin compartir credenciales ni sublicenciar documentos a terceros. Contratar mediante orden de servicio las actividades que excedan el plan.
        </Text>

        {/* CLÁUSULA 6 */}
        <Text style={base.clausulaTitle}>Cláusula 6. Alcance y Exclusiones</Text>
        <Text style={base.p}>
          Salvo pacto expreso en orden de servicio, no están incluidos en la mensualidad: representación judicial o administrativa formal, interposición de recursos, demandas, audiencias, defensa integral en investigaciones sancionatorias, radicación de trámites con mandato, revisión masiva de expedientes, desplazamientos, viáticos, atención fuera de horario, emisión de dictámenes periciales, certificaciones de cumplimiento, implementación técnica directa de sistemas, pago de tasas o derechos y servicios de terceros.
        </Text>

        {/* CLÁUSULA 7 */}
        <Text style={base.clausulaTitle}>Cláusula 7. Propiedad Intelectual</Text>
        <Text style={base.p}>
          Los métodos, metodologías, marcos de análisis, bases de conocimiento, plantillas generales, vademécum, herramientas, automatizaciones y materiales desarrollados por el PRESTADOR son de su propiedad exclusiva. El contrato confiere al CLIENTE una licencia de uso limitada, no exclusiva, intransferible y revocable sobre los entregables generados específicamente para él, para los fines propios de su operación. Los entregables no podrán ser reproducidos, revendidos, cedidos ni usados fuera del alcance de este contrato.
        </Text>

        {/* CLÁUSULA 8 */}
        <Text style={base.clausulaTitle}>Cláusula 8. Confidencialidad y Datos Personales</Text>
        <Text style={base.p}>
          Las Partes mantendrán reserva sobre la información intercambiada con ocasión de este contrato. El PRESTADOR actuará como encargado del tratamiento de datos personales que el CLIENTE suministre, conforme a la Ley 1581 de 2012 y sus decretos reglamentarios, y a las instrucciones documentadas del CLIENTE. Las obligaciones de confidencialidad se mantendrán por dos (2) años después de la terminación del contrato.
        </Text>

        {/* CLÁUSULA 9 */}
        <Text style={base.clausulaTitle}>Cláusula 9. Duración y Terminación</Text>
        <Text style={base.p}>
          El contrato tendrá una duración inicial de un (1) mes calendario y se renovará automáticamente cada mes mientras el CLIENTE mantenga un plan activo y realice el pago correspondiente. Cualquiera de las Partes podrá terminarlo con aviso escrito de quince (15) días calendario. El CLIENTE podrá terminar sin penalidad por incumplimiento material del PRESTADOR no subsanado en diez (10) días hábiles. El PRESTADOR podrá suspender o terminar por mora mayor a diez (10) días hábiles.
        </Text>

        {/* CLÁUSULA 10 */}
        <Text style={base.clausulaTitle}>Cláusula 10. Responsabilidad</Text>
        <Text style={base.p}>
          El PRESTADOR responde por los servicios incluidos en el plan con el estándar propio de un profesional diligente del sector. Su responsabilidad máxima frente al CLIENTE no excederá el equivalente a tres (3) mensualidades del plan contratado. No responde por decisiones de autoridades, cambios normativos sobrevinientes no imputables a su negligencia, ni por resultados de actuaciones que dependan de terceros. El CLIENTE es responsable de la veracidad y completitud de la información suministrada.
        </Text>

        {/* CLÁUSULA 11 */}
        <Text style={base.clausulaTitle}>Cláusula 11. Ley Aplicable y Resolución de Disputas</Text>
        <Text style={base.p}>
          Este contrato se rige por la ley colombiana. Las Partes procurarán resolver cualquier diferencia de forma directa. Si en quince (15) días hábiles no se logra acuerdo, la diferencia se someterá a conciliación ante un Centro de Conciliación en Bogotá D.C. Si la conciliación fracasa, se acudirá a la justicia ordinaria competente en Bogotá D.C.
        </Text>

        {/* CLÁUSULA 12 */}
        <Text style={base.clausulaTitle}>Cláusula 12. Pasarela de Pagos y Medios Electrónicos</Text>
        <Text style={base.p}>
          Cuando el pago se realice a través de una pasarela electrónica, esta actúa únicamente como medio de recaudo y no como parte del contrato ni como responsable del servicio profesional. La aceptación electrónica del presente contrato, con registro de fecha, hora, dirección IP y correo del CLIENTE, constituye manifestación válida de voluntad conforme al artículo 14 de la Ley 527 de 1999 (Ley de Comercio Electrónico).
        </Text>

        {/* FIRMA ELECTRÓNICA */}
        <View style={base.signature}>
          <Text style={base.signatureTitle}>Firma Electrónica — Aceptación del Contrato</Text>
          <Text style={base.signatureText}>
            {d.nombreRepresentante} ({d.nombreCliente}) aceptó este contrato y sus Términos y Condiciones (Anexo 1)
            de forma electrónica el {fecha}, desde la dirección IP {d.ip}, mediante el correo {d.clienteEmail}.
            Esta aceptación tiene plena validez jurídica conforme al artículo 14 de la Ley 527 de 1999.
          </Text>
          <Text style={{ ...base.signatureText, marginTop: 8 }}>
            Juan Pablo Osorio Marín — C.C. 1.053.824.988 — T.P. 284.927 C.S.J. — Owl Compliance
          </Text>
        </View>

        <PageFooter />
      </Page>
    </Document>
  )
}

// ── TÉRMINOS Y CONDICIONES ────────────────────────────────────────────────────

const TYC_SECCIONES = [
  {
    titulo: '1. Definiciones',
    texto: `Canal de atención: medio habilitado para recibir solicitudes del CLIENTE (ticket, chat, correo). Chat: mensajería operativa para preguntas puntuales y coordinación; no reemplaza el ticket cuando se requiera trazabilidad. Consulta: solicitud puntual de orientación que requiere análisis razonable y se descuenta de la cuota mensual cuando supera coordinación operativa. Comunicación operativa: mensaje sobre coordinación, estado del servicio, alertas, entrega de documentos; no se descuenta de la cuota. Concepto regulatorio: documento escrito que analiza un asunto jurídico o técnico-regulatorio con fundamento normativo y recomendaciones. Defensa o representación formal: actuación que implica mandato especial, firma jurídica, recurso, audiencia, demanda o comparecencia ante autoridad; requiere orden de servicio independiente. Entregable: documento, plantilla, diagnóstico, concepto, respuesta, matriz o producto tangible generado por el PRESTADOR. Escalamiento: reclasificación de una solicitud como servicio on-demand cuando excede el plan, la cuota, el alcance o requiere representación formal. Horario de atención: lunes a viernes, 8:00 a.m. a 6:00 p.m., hora Colombia, días hábiles; se excluyen festivos. Incidente crítico: situación con plazo regulatorio inminente, visita de autoridad el mismo día o al siguiente, o requerimiento con vencimiento inmediato. Ticket: solicitud registrada formalmente con número, categoría, prioridad, responsable y estado de atención.`,
  },
  {
    titulo: '2. Canales de Atención',
    texto: `El ticket es el canal principal para solicitudes que generen entregables, seguimiento, revisión documental, conceptos, respuestas, diagnósticos o trazabilidad. Toda solicitud recibida por chat o correo que requiera análisis será convertida en ticket. El chat se usará para consultas rápidas, coordinación y aclaraciones operativas; si una conversación requiere investigación o entregable, será convertida en ticket y contabilizada como tal. El correo contacto@owlcompliance.com se usará para comunicaciones contractuales, entrega de documentos y contingencias de plataforma. Las solicitudes que requieran seguimiento serán convertidas en ticket.`,
  },
  {
    titulo: '3. Prioridades y Tiempos de Primera Respuesta',
    texto: `Crítica (plazo regulatorio inminente, visita el mismo día): Básico 4h hábiles / Pro 2h hábiles / Premium 1h hábil. Alta (vencimiento próximo, audiencia dentro de 3 días): Básico 1 día hábil / Pro 8h hábiles / Premium 4h hábiles. Normal (consulta regulatoria general, concepto sin urgencia): Básico 2 días / Pro 1 día / Premium 8h. Baja (informativa, archivo, actualización de repositorio): Básico 5 días / Pro 3 días / Premium 2 días. Los tiempos corren dentro del horario de servicio y desde que la solicitud esté completa. Las solicitudes fuera de horario inician al siguiente día hábil. La primera respuesta no equivale a entrega final del entregable.`,
  },
  {
    titulo: '4. Tiempos Orientativos de Resolución',
    texto: `Consulta puntual directa: 1 día hábil. Concepto regulatorio simple: 3 a 5 días hábiles desde solicitud completa. Concepto regulatorio complejo: 5 a 10 días hábiles. Respuesta a requerimiento de autoridad: según plazo legal, con inicio desde la entrega completa del expediente. Revisión y ajuste de CCU: 3 a 7 días hábiles. Diagnóstico Integral Avanzado: 10 a 15 días hábiles desde reunión de inicio. Repositorio de evidencias: 10 a 20 días hábiles según volumen. Los plazos se suspenden mientras el PRESTADOR espera información, validación, documentos, accesos o instrucciones del CLIENTE.`,
  },
  {
    titulo: '5. Cuota de Consultas Mensuales',
    texto: `Básico: 3 consultas/mes. Pro: 6 consultas/mes. Premium: 10 consultas/mes. Se descuenta una consulta cuando la solicitud requiere análisis, investigación, revisión documental, criterio profesional o respuesta estructurada. No descuentan cuota las alertas regulatorias, actualizaciones de calendario, comunicaciones administrativas, notificaciones de estado, entrega de facturas, corrección de errores imputables al PRESTADOR o aclaraciones menores de un entregable dentro de las rondas incluidas. Cuando el CLIENTE alcance el 80% de su cuota, el PRESTADOR informará el estado de consumo. Al agotarse la cuota, las nuevas solicitudes podrán atenderse como servicio on-demand, acumularse para el siguiente mes por acuerdo escrito, o quedar pendientes hasta renovación de cuota.`,
  },
  {
    titulo: '6. Alcance de Planes y Exclusiones',
    texto: `Incluido según plan: alertas regulatorias, consultas mensuales, revisión documental según alcance, plantillas, diagnósticos, conceptos, soporte remoto o presencial cuando el plan lo indique. No incluido salvo orden de servicio: representación formal, recursos, demandas, audiencias, defensa integral, revisión de expedientes extensos, visitas presenciales no previstas, viáticos, radicaciones con mandato, pagos a terceros y trámites que exijan firma o mandato especial. Plan Premium: incluye acompañamiento técnico-regulatorio intensivo, soporte estratégico y tarifas preferenciales; no incluye defensa formal automática ni actuaciones con mandato sin orden de servicio.`,
  },
  {
    titulo: '7. Entregables y Revisiones',
    texto: `Los entregables se remitirán en Word, PDF, Excel u otro formato útil según su naturaleza. Los conceptos formales se entregarán en PDF definitivo y en Word cuando se requiera revisión del CLIENTE. Cada entregable incluye hasta dos entregas para revisión sin costo adicional, siempre que las observaciones se reciban dentro de los cinco (5) días hábiles siguientes a la entrega. Las revisiones adicionales, extemporáneas o que cambien el alcance inicial se cotizarán como servicio adicional o consumirán cuota según corresponda. Los entregables reflejan el marco normativo vigente a la fecha de elaboración.`,
  },
  {
    titulo: '8. Escalamiento a Servicio On-Demand',
    texto: `Una solicitud se escalará cuando supere el alcance del plan, exija dedicación superior a la prevista, requiera representación formal, implique firma jurídica, demande revisión documental extensa, exceda la cuota mensual, exija desplazamiento o tenga impacto económico que amerite encargo separado. El PRESTADOR informará el motivo del escalamiento, alcance, tarifa, plazo y documentos requeridos. El servicio adicional iniciará con aceptación de la orden de servicio y pago anticipado cuando aplique.`,
  },
  {
    titulo: '9. Actualizaciones del Marco Regulatorio',
    texto: `El PRESTADOR hará seguimiento al marco aplicable a PRST, incluyendo MinTIC, CRC, SIC y autoridades relacionadas. Las alertas regulatorias informarán cambios materiales dentro de los dos (2) días hábiles siguientes a la identificación del cambio relevante. La actualización de calendario se realizará en máximo tres (3) días hábiles cuando la plataforma esté habilitada. La actualización de plantillas se hará en máximo diez (10) días hábiles cuando el cambio afecte modelos generales del servicio.`,
  },
  {
    titulo: '10. Disponibilidad de la Plataforma y Contingencia',
    texto: `La plataforma es un canal de apoyo y trazabilidad. Si se presenta indisponibilidad, el correo electrónico funcionará como canal alterno para asuntos críticos. Los mantenimientos programados se informarán con cuarenta y ocho (48) horas de anticipación cuando sea posible. Las fallas de proveedores de nube, internet, energía, plataformas oficiales, pasarelas o servicios externos no constituyen incumplimiento del PRESTADOR si se adoptan medidas razonables de contingencia.`,
  },
  {
    titulo: '11. Uso Aceptable del Servicio',
    texto: `El CLIENTE usará el servicio para asuntos relacionados con su operación como PRST o empresa vinculada al sector regulatorio contratado. El CLIENTE no podrá compartir credenciales, revender entregables, usar documentos como servicio propio a terceros o crear solicitudes duplicadas para alterar prioridades. El CLIENTE no cargará información ilícita, datos sin autorización de titular, malware ni contenido que viole derechos de terceros. El incumplimiento de estas reglas podrá dar lugar a suspensión inmediata del servicio.`,
  },
  {
    titulo: '12. Tratamiento de Datos Personales',
    texto: `El PRESTADOR tratará los datos personales del CLIENTE y de sus empleados o representantes conforme a la Ley 1581 de 2012, el Decreto 1377 de 2013 y las demás normas que los modifiquen o complementen. Los datos se usarán exclusivamente para la ejecución del contrato, facturación, comunicaciones operativas y cumplimiento de obligaciones legales. El CLIENTE autoriza el tratamiento de sus datos y garantiza que cuenta con las autorizaciones necesarias para suministrar datos de terceros. El PRESTADOR adoptará medidas técnicas y organizativas razonables para proteger la información.`,
  },
  {
    titulo: '13. Modificación de los Términos',
    texto: `El PRESTADOR podrá modificar estos Términos y Condiciones con aviso escrito al CLIENTE con treinta (30) días calendario de anticipación. Si el CLIENTE no manifiesta oposición dentro de ese plazo, se entenderá que acepta las modificaciones. Si el CLIENTE se opone, podrá terminar el contrato sin penalidad pagando los servicios causados hasta la fecha efectiva de terminación.`,
  },
]

function TyCDoc({ fechaAceptacion, clienteEmail, ip }: {
  fechaAceptacion: string
  clienteEmail:    string
  ip:              string
}) {
  const fecha = new Date(fechaAceptacion).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  return (
    <Document>
      <Page size="LETTER" style={base.page}>
        <Header fecha={fecha} />
        <View style={base.divider} />

        <Text style={base.h1}>Términos y Condiciones de Prestación del Servicio</Text>
        <Text style={{ ...base.h2, marginBottom: 14 }}>
          Anexo 1 del Contrato de Prestación de Servicios Profesionales de Gestión Regulatoria
        </Text>

        {TYC_SECCIONES.map((s) => (
          <View key={s.titulo}>
            <Text style={base.clausulaTitle}>{s.titulo}</Text>
            <Text style={base.p}>{s.texto}</Text>
          </View>
        ))}

        <View style={base.signature}>
          <Text style={base.signatureTitle}>Aceptación Electrónica</Text>
          <Text style={base.signatureText}>
            Estos Términos y Condiciones fueron presentados, leídos y aceptados electrónicamente el {fecha},
            desde la dirección IP {ip}, mediante el correo {clienteEmail}. Esta aceptación tiene plena
            validez jurídica conforme al artículo 14 de la Ley 527 de 1999.
          </Text>
        </View>

        <PageFooter />
      </Page>
    </Document>
  )
}

// ── CUENTA DE COBRO ───────────────────────────────────────────────────────────

export interface DatosCuentaCobro {
  numero:               string   // OWL-26-00001
  fecha:                string   // ISO date
  nombreEmpresa:        string
  nit:                  string
  representanteLegal:   string
  plan:                 PlanKey
  mes:                  string   // Ej: "julio 2026"
}

const ccStyles = StyleSheet.create({
  infoTable: {
    marginTop: 12,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  infoLabel: {
    width: 130,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: GRIS,
    textAlign: 'right',
    paddingRight: 8,
  },
  infoValue: {
    flex: 1,
    fontSize: 9,
    color: NEGRO,
  },
  numFechaTable: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    marginTop: 4,
  },
  numFechaCell: {
    flex: 1,
    border: '1px solid #ccc',
    padding: '6px 10px',
  },
  numFechaLabel: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: GRIS,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  numFechaValue: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: NEGRO,
  },
  totalBox: {
    border: `1.5px solid ${BORDO}`,
    padding: '10px 14px',
    width: 180,
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: BORDO,
    marginBottom: 4,
  },
  totalMonto: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: BORDO,
  },
  totalLetras: {
    fontSize: 8,
    color: GRIS,
    marginTop: 4,
    lineHeight: 1.4,
  },
  bankInfo: {
    marginTop: 10,
    marginBottom: 12,
    fontSize: 8.5,
    lineHeight: 1.6,
  },
  declaracion: {
    flex: 1,
    paddingLeft: 16,
    fontSize: 7.5,
    color: GRIS,
    lineHeight: 1.55,
  },
  firma: {
    marginTop: 24,
    fontSize: 8.5,
  },
})

function CuentaCobroDoc({ d }: { d: DatosCuentaCobro }) {
  const plan   = PLANES[d.plan]
  const fecha  = new Date(d.fecha).toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
  const monto  = plan.precio
  const letras = montoCOP(monto)
  const concepto = `Plan ${plan.label} - ${d.mes}`

  return (
    <Document>
      <Page size="LETTER" style={{ ...base.page, paddingBottom: 80 }}>
        <Header fecha={fecha} />
        <View style={base.divider} />

        <Text style={{ ...base.h1, marginBottom: 16 }}>Cuenta de Cobro</Text>

        {/* Número y fecha */}
        <View style={ccStyles.numFechaTable}>
          <View style={ccStyles.numFechaCell}>
            <Text style={ccStyles.numFechaLabel}>Cuenta de Cobro No.</Text>
            <Text style={ccStyles.numFechaValue}>{d.numero}</Text>
          </View>
          <View style={ccStyles.numFechaCell}>
            <Text style={ccStyles.numFechaLabel}>Fecha</Text>
            <Text style={ccStyles.numFechaValue}>{fecha}</Text>
          </View>
        </View>

        {/* Datos del cliente */}
        <View style={ccStyles.infoTable}>
          {[
            ['EMPRESA:', d.nombreEmpresa],
            ['NIT:', d.nit],
            ['REPRESENTANTE LEGAL:', d.representanteLegal],
            ['DEBE A:', 'Juan Pablo Osorio Marín'],
            ['CÉDULA:', '1.053.824.988'],
            ['POR CONCEPTO DE:', concepto],
          ].map(([lbl, val]) => (
            <View key={lbl} style={ccStyles.infoRow}>
              <Text style={ccStyles.infoLabel}>{lbl}</Text>
              <Text style={ccStyles.infoValue}>{val}</Text>
            </View>
          ))}
        </View>

        {/* Total + declaración */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View>
            <View style={ccStyles.totalBox}>
              <Text style={ccStyles.totalLabel}>TOTAL A PAGAR:</Text>
              <Text style={ccStyles.totalMonto}>${monto.toLocaleString('es-CO')}</Text>
              <Text style={ccStyles.totalLetras}>{letras}</Text>
            </View>
            <View style={ccStyles.bankInfo}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>
                Favor consignar a la cuenta de ahorros Davivienda:
              </Text>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>087270004853</Text>
              <Text>a nombre de Juan Pablo Osorio Marín</Text>
            </View>
          </View>
          <Text style={ccStyles.declaracion}>
            Declaración: Para efectos de la aplicación de la tabla de retención en la fuente establecida
            en el artículo 383 del Estatuto Tributario Nacional, la cual se aplica a los pagos o abonos
            en cuenta por concepto de compensación de servicios personales, declaro bajo la gravedad de
            juramento que no me tomaré costos y gastos deducibles asociados a este pago en el año
            gravable, dado que mis ingresos no provienen de una relación laboral o legal y reglamentaria;
            opto porque se aplique la tabla del art. 383 del E.T. y su 25% exento.
          </Text>
        </View>

        {/* Firma */}
        <View style={ccStyles.firma}>
          <Text style={{ marginBottom: 28 }}>Atentamente,</Text>
          <Text style={{ fontFamily: 'Helvetica-Bold' }}>JUAN PABLO OSORIO MARÍN</Text>
          <Text style={{ color: GRIS, fontSize: 8 }}>C.C. 1.053.824.988</Text>
        </View>

        <PageFooter />
      </Page>
    </Document>
  )
}

// ── Exportaciones ─────────────────────────────────────────────────────────────

export async function generarPDFContrato(datos: DatosContrato): Promise<Buffer> {
  return renderToBuffer(<ContratoDoc d={datos} />) as Promise<Buffer>
}

export async function generarPDFTyC(opts: {
  fechaAceptacion: string
  clienteEmail:    string
  ip:              string
}): Promise<Buffer> {
  return renderToBuffer(<TyCDoc {...opts} />) as Promise<Buffer>
}

export async function generarPDFCuentaCobro(datos: DatosCuentaCobro): Promise<Buffer> {
  return renderToBuffer(<CuentaCobroDoc d={datos} />) as Promise<Buffer>
}
