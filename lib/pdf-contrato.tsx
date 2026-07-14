/**
 * lib/pdf-contrato.tsx
 * Genera PDFs de contrato, T&C y cuenta de cobro con @react-pdf/renderer.
 * Plantilla corporativa: logo arriba-izquierda, búho fantasma abajo-derecha,
 * barra oscura en el pie de página.
 */

import React from 'react'
import {
  Document, Page, Text, View, Image, StyleSheet, renderToBuffer,
} from '@react-pdf/renderer'
import path from 'path'
import fs   from 'fs'
import { montoCOP } from './numero-letras'
import { PLANES, PlanKey } from './suscripcion'

// ── Colores ───────────────────────────────────────────────────────────────────
const BORDO       = '#712529'
const OLIVO       = '#7a6e1a'
const GRIS        = '#555555'
const NEGRO       = '#1a1a1a'
const DARK_FOOTER = '#1a1413'
const BG_TABLE_H  = '#f0ebe0'

// ── Rutas ─────────────────────────────────────────────────────────────────────
const logoFile = () => path.join(process.cwd(), 'public', 'logo.png')
const buhoFile = () => path.join(process.cwd(), 'public', 'buho.png')

// ── Links de pago por plan ────────────────────────────────────────────────────
const PAYMENT_LINKS: Record<PlanKey, string> = {
  basico:  'https://mpago.la/2DyPB4T',
  pro:     'https://mpago.la/2NYuAub',
  premium: 'https://mpago.la/1nKdbZc',
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    paddingTop:        50,
    paddingBottom:     50,
    paddingHorizontal: 55,
    fontSize:          9,
    fontFamily:        'Helvetica',
    color:             NEGRO,
    lineHeight:        1.55,
  },
  logo: {
    width:       140,
    height:      50,
    objectFit:   'contain',
    marginBottom: 18,
  },
  ghost: {
    position: 'absolute',
    bottom:   45,
    right:    -15,
    width:    280,
    height:   280,
    opacity:  0.07,
  },
  footer: {
    position:        'absolute',
    bottom:           0,
    left:             0,
    right:            0,
    backgroundColor:  DARK_FOOTER,
    paddingVertical:  8,
    paddingHorizontal: 55,
    flexDirection:    'row',
    justifyContent:   'space-between',
    alignItems:       'center',
  },
  footerText: {
    fontSize: 7.5,
    color:    '#ffffff',
  },
  h1: {
    fontSize:      11,
    fontFamily:    'Helvetica-Bold',
    color:         BORDO,
    textAlign:     'center',
    marginBottom:  3,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  h2: {
    fontSize:     9,
    fontFamily:   'Helvetica-Bold',
    color:        BORDO,
    textAlign:    'center',
    marginBottom: 12,
  },
  section: {
    fontSize:      9,
    fontFamily:    'Helvetica-Bold',
    color:         BORDO,
    marginTop:     10,
    marginBottom:  3,
    textTransform: 'uppercase',
  },
  p: {
    marginBottom: 5,
    fontSize:     9,
    lineHeight:   1.55,
  },
  bold: { fontFamily: 'Helvetica-Bold' },
  tableWrap:   { marginVertical: 6 },
  tableHeader: {
    flexDirection:   'row',
    backgroundColor:  BG_TABLE_H,
    borderBottom:    `1px solid ${BORDO}`,
  },
  tableRow:  { flexDirection: 'row', borderBottom: '0.5px solid #ddd' },
  tableRowHL:{ flexDirection: 'row', borderBottom: '0.5px solid #ddd', backgroundColor: '#f9f5eb' },
  tc:  { padding: '4px 6px', fontSize: 8,   flex: 1, lineHeight: 1.4 },
  tcb: { padding: '4px 6px', fontSize: 8,   flex: 1, lineHeight: 1.4, fontFamily: 'Helvetica-Bold' },
  tcS: { padding: '4px 6px', fontSize: 8,   flex: 1, lineHeight: 1.4, fontFamily: 'Helvetica-Bold', color: BORDO },
  signature: {
    marginTop:       20,
    padding:         '10px 14px',
    backgroundColor: '#f8f6f0',
    borderLeft:      `3px solid ${OLIVO}`,
  },
  sigTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: OLIVO, marginBottom: 4 },
  sigText:  { fontSize: 8,   color: GRIS, lineHeight: 1.5 },
})

// ── Componentes compartidos ───────────────────────────────────────────────────

function Header() {
  return (
    <View>
      {fs.existsSync(logoFile())
        ? <Image src={logoFile()} style={s.logo} />
        : <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: BORDO, marginBottom: 18 }}>OWL COMPLIANCE</Text>
      }
    </View>
  )
}

function GhostOwl() {
  if (!fs.existsSync(buhoFile())) return null
  return <Image src={buhoFile()} style={s.ghost} fixed />
}

function Footer() {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>+57 301 795 4547</Text>
      <Text style={s.footerText}>www.owlcompliance.com  |  contacto@owlcompliance.com</Text>
      <Text style={s.footerText}>Bogotá, Colombia.</Text>
    </View>
  )
}

// ── CONTRATO ─────────────────────────────────────────────────────────────────

export interface DatosContrato {
  nombreCliente:        string
  tipoPersona:          string
  tipoIdentificacion:   string
  numeroIdentificacion: string
  ciudadCliente:        string
  nombreRepresentante:  string
  ccRepresentante:      string
  plan:                 PlanKey
  fechaAceptacion:      string
  ip:                   string
  clienteEmail:         string
}

function ContratoDoc({ d }: { d: DatosContrato }) {
  const fecha = new Date(d.fechaAceptacion).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const dia  = new Date(d.fechaAceptacion).getDate().toString()
  const mes  = new Date(d.fechaAceptacion).toLocaleDateString('es-CO', { month: 'long' })
  const anio = new Date(d.fechaAceptacion).getFullYear().toString()
  const tipoPersonaLabel = d.tipoPersona === 'natural' ? 'persona natural' : 'persona jurídica'

  const PLANES_TABLA = [
    {
      key:      'basico',
      label:    'Básico',
      precio:   '$199.000 COP mensuales, más IVA si aplica',
      servicios:'Tres consultas incluidas por mes. Alertas mensuales, plantillas de liquidación, minutas tipo de CCU para descarga, acceso al vademécum regulatorio y orientación para actualización RUTIC por solicitud.',
    },
    {
      key:      'pro',
      label:    'Pro',
      precio:   '$890.000 COP mensuales, más IVA si aplica',
      servicios:'Seis consultas incluidas por mes. Incluye el Plan Básico, diagnóstico inicial por una vez, revisión y ajuste de CCU, conceptos escritos, validación de políticas corporativas, repositorio de evidencias, acompañamiento remoto en visitas y elaboración de respuestas ordinarias.',
    },
    {
      key:      'premium',
      label:    'Premium',
      precio:   '$2.490.000 COP mensuales, más IVA si aplica',
      servicios:'Diez consultas incluidas por mes. Incluye Plan Pro, acompañamiento técnico-regulatorio presencial sujeto a disponibilidad, soporte en trámites de espectro u obligaciones de hacer, apoyo en reportes periódicos, y tarifas preferenciales para servicios on-demand.',
    },
  ]

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <GhostOwl />
        <Header />

        <Text style={s.h1}>OWL COMPLIANCE — Gestión Regulatoria para PRST en Colombia</Text>
        <Text style={s.h1}>Contrato de Prestación de Servicios Profesionales de Gestión Regulatoria</Text>

        {/* PARTES */}
        <Text style={s.section}>Partes</Text>
        <Text style={s.p}>
          <Text style={s.bold}>PRESTADOR: </Text>
          Juan Pablo Osorio Marín, mayor de edad, identificado con cédula de ciudadanía número 1.053.824.988 de Manizales, domiciliado en Bogotá D.C., Colombia, abogado con Tarjeta Profesional No. 284.927 del Consejo Superior de la Judicatura, quien actúa de forma independiente y bajo la marca comercial Owl Compliance, en adelante el PRESTADOR.
        </Text>
        <Text style={s.p}>
          <Text style={s.bold}>CLIENTE: </Text>
          {d.nombreCliente}, {tipoPersonaLabel}, identificado con {d.tipoIdentificacion} número {d.numeroIdentificacion}, domiciliado en {d.ciudadCliente}, Colombia, representado por {d.nombreRepresentante}, identificado con cédula de ciudadanía número {d.ccRepresentante}, en adelante el CLIENTE.
        </Text>
        <Text style={s.p}>El PRESTADOR y el CLIENTE se denominarán conjuntamente las Partes.</Text>

        {/* DECLARACIONES */}
        <Text style={s.section}>Declaraciones</Text>
        <Text style={s.p}>
          Declara el PRESTADOR que cuenta con conocimiento y experiencia en derecho, consultoría regulatoria y gestión de cumplimiento aplicable a proveedores de redes y servicios de telecomunicaciones, proveedores de servicios de internet e ISPs en Colombia. Declara que presta sus servicios de forma independiente y que no existe impedimento legal o contractual para celebrar este contrato.
        </Text>
        <Text style={s.p}>
          Declara el CLIENTE que actúa como PRST, ISP o como empresa vinculada a la prestación de servicios de telecomunicaciones o internet en Colombia. Declara que tiene interés legítimo en contratar servicios de gestión regulatoria, que cuenta con capacidad legal para contratar y que suministrará información completa, veraz y oportuna para la ejecución del servicio.
        </Text>
        <Text style={s.p}>
          Las Partes reconocen que este contrato corresponde a condiciones generales predispuestas por el PRESTADOR para la contratación de planes estandarizados. El CLIENTE declara que recibió el texto contractual, los términos y condiciones, el alcance del plan, los precios y las reglas de servicio antes de contratar, y que pudo formular preguntas o solicitar aclaraciones antes de aceptar.
        </Text>

        {/* CLÁUSULA 1 */}
        <Text style={s.section}>Cláusula 1. Objeto</Text>
        <Text style={s.p}>
          El PRESTADOR se obliga a prestar al CLIENTE servicios profesionales de gestión, monitoreo, consultoría jurídica y técnico-regulatoria en cumplimiento aplicable a PRST en Colombia, de acuerdo con el plan contratado y los Términos y Condiciones incorporados al presente contrato.
        </Text>
        <Text style={s.p}>
          El servicio comprende orientación regulatoria, seguimiento normativo, elaboración de documentos, revisión de insumos, apoyo en cumplimiento ante autoridades, estructuración de evidencias, gestión de alertas y acompañamiento profesional en los frentes incluidos en el plan. La plataforma Owl Compliance, cuando esté disponible, será un medio operativo de coordinación, soporte, repositorio, tickets y entrega de información.
        </Text>
        <Text style={s.p}>
          La representación formal ante autoridades, la interposición de recursos, la atención de audiencias, la firma de memoriales, demandas o actuaciones que exijan mandato especial, así como cualquier actuación judicial o administrativa con derecho de postulación, no se entienden incluidas automáticamente en la mensualidad. Esas actividades requieren orden de servicio independiente, aceptación expresa, definición de honorarios y otorgamiento del mandato correspondiente cuando aplique.
        </Text>

        {/* CLÁUSULA 2 */}
        <Text style={s.section}>Cláusula 2. Planes de Servicio y Cobertura</Text>
        <Text style={s.p}>El CLIENTE contrata el siguiente plan mensual: Básico, Pro o Premium, según la casilla marcada o la orden de servicio aceptada. Los planes son acumulativos según lo indicado en esta cláusula, salvo exclusiones expresas.</Text>

        <View style={s.tableWrap}>
          <View style={s.tableHeader}>
            <Text style={[s.tcb, { flex: 0.7 }]}>Plan</Text>
            <Text style={[s.tcb, { flex: 1.3 }]}>Precio</Text>
            <Text style={[s.tcb, { flex: 3 }]}>Servicios incluidos</Text>
          </View>
          {PLANES_TABLA.map(p => (
            <View key={p.key} style={p.key === d.plan ? s.tableRowHL : s.tableRow}>
              <Text style={[p.key === d.plan ? s.tcS : s.tcb, { flex: 0.7 }]}>
                {p.key === d.plan ? '✓ ' : ''}{p.label}
              </Text>
              <Text style={[s.tc, { flex: 1.3 }]}>{p.precio}</Text>
              <Text style={[s.tc, { flex: 3 }]}>{p.servicios}</Text>
            </View>
          ))}
        </View>

        <Text style={s.p}>Los servicios on-demand se contratarán mediante orden de servicio. La orden indicará alcance, honorarios, entregables, plazo, responsables, forma de pago y si requiere mandato especial. Los servicios on-demand no se entienden incluidos en la mensualidad, salvo indicación expresa.</Text>

        <View style={s.tableWrap}>
          <View style={s.tableHeader}>
            <Text style={[s.tcb, { flex: 2 }]}>Servicio on-demand</Text>
            <Text style={[s.tcb, { flex: 1 }]}>Sin plan</Text>
            <Text style={[s.tcb, { flex: 1 }]}>Básico</Text>
            <Text style={[s.tcb, { flex: 1 }]}>Pro</Text>
            <Text style={[s.tcb, { flex: 1 }]}>Premium</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={[s.tc, { flex: 2 }]}>Diagnóstico Integral Avanzado</Text>
            <Text style={[s.tc, { flex: 1 }]}>$4.500.000 COP</Text>
            <Text style={[s.tc, { flex: 1 }]}>$2.700.000 COP</Text>
            <Text style={[s.tcb, { flex: 1 }]}>Incluido</Text>
            <Text style={[s.tcb, { flex: 1 }]}>Incluido</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={[s.tc, { flex: 2 }]}>Acompañamiento técnico-regulatorio en investigación administrativa</Text>
            <Text style={[s.tc, { flex: 1 }]}>$8.500.000 COP</Text>
            <Text style={[s.tc, { flex: 1 }]}>$8.075.000 COP</Text>
            <Text style={[s.tc, { flex: 1 }]}>$7.225.000 COP</Text>
            <Text style={[s.tc, { flex: 1 }]}>$5.525.000 COP</Text>
          </View>
          <View style={s.tableRow}>
            <Text style={[s.tc, { flex: 2 }]}>Representación formal, recurso, audiencia, demanda o actuación con mandato</Text>
            <Text style={[s.tc, { flex: 1 }]}>Cotización específica</Text>
            <Text style={[s.tc, { flex: 1 }]}>Cotización específica</Text>
            <Text style={[s.tc, { flex: 1 }]}>Cotización específica</Text>
            <Text style={[s.tc, { flex: 1 }]}>Cotización específica</Text>
          </View>
        </View>

        <Text style={s.p}>Los valores no incluyen IVA, impuestos, tasas, gastos administrativos, desplazamientos, viáticos, autenticaciones, certificados, traducciones, gastos de radicación, pagos a terceros o costos de plataforma externa. Estos deberán pactarse de manera expresa entre las partes.</Text>

        {/* CLÁUSULA 3 */}
        <Text style={s.section}>Cláusula 3. Precio, Facturación, Impuestos y Forma de Pago</Text>
        <Text style={s.p}>El CLIENTE pagará la retribución mensual correspondiente al plan contratado. El pago será mensual anticipado, dentro de los primeros cinco días hábiles de cada mes de servicio. El primer pago se realizará al momento de la aceptación del contrato o de la activación del servicio.</Text>
        <Text style={s.p}>El PRESTADOR emitirá factura electrónica o documento equivalente cuando esté obligado a ello, según su régimen tributario. El CLIENTE asumirá IVA, retenciones, impuestos, tasas y demás cargas aplicables de acuerdo con la ley. El CLIENTE deberá entregar la información tributaria requerida, incluido RUT cuando sea necesario.</Text>
        <Text style={s.p}>Los pagos se harán por transferencia bancaria, PSE, pasarela de pagos, débito autorizado o el medio que el PRESTADOR informe por escrito. Si se usa una pasarela, esta actuará únicamente como medio de recaudo y no como parte del contrato ni como responsable del servicio profesional. Las condiciones técnicas de la pasarela serán las propias de su proveedor.</Text>
        <Text style={s.p}>Si el pago es rechazado, reversado o no se acredita oportunamente, el PRESTADOR podrá suspender el servicio previo aviso por escrito. La mora causará intereses a la tasa máxima legal permitida en Colombia, sin perjuicio de la terminación por incumplimiento. La retribución mensual podrá ajustarse al inicio de cada anualidad con aviso de treinta días calendario. Si el CLIENTE no acepta el ajuste, podrá terminar el contrato sin penalidad, pagando los servicios causados hasta la fecha efectiva de terminación.</Text>

        {/* CLÁUSULA 4 */}
        <Text style={s.section}>Cláusula 4. Obligaciones del Prestador</Text>
        <Text style={s.p}>Prestar los servicios incluidos en el plan contratado con diligencia profesional, criterio jurídico, actualización regulatoria y estándares razonables del sector.</Text>
        <Text style={s.p}>Mantener seguimiento al marco normativo aplicable a PRST, en especial MinTIC, CRC, SIC y demás autoridades vinculadas al servicio contratado.</Text>
        <Text style={s.p}>Responder las consultas dentro de los tiempos establecidos en los Términos y Condiciones, siempre que el CLIENTE entregue información completa y oportuna.</Text>
        <Text style={s.p}>Guardar confidencialidad sobre la información del CLIENTE. Tratar los datos personales conforme a la ley, la política de tratamiento y las instrucciones documentadas cuando actúe como encargado. No usar información del CLIENTE para fines propios no autorizados.</Text>
        <Text style={s.p}>Informar cambios normativos materiales que afecten el calendario o los entregables del plan.</Text>
        <Text style={s.p}>No subcontratar el servicio profesional principal sin aviso al CLIENTE cuando la subcontratación afecte información reservada o datos personales.</Text>

        {/* CLÁUSULA 5 */}
        <Text style={s.section}>Cláusula 5. Obligaciones del Cliente</Text>
        <Text style={s.p}>Pagar oportunamente la retribución pactada.</Text>
        <Text style={s.p}>Suministrar información, documentos, accesos, antecedentes y soportes completos, veraces y oportunos.</Text>
        <Text style={s.p}>Designar un contacto interno autorizado para gestionar la relación contractual.</Text>
        <Text style={s.p}>Validar internamente los documentos, conceptos y recomendaciones antes de presentarlos ante autoridades o terceros.</Text>
        <Text style={s.p}>Informar cambios relevantes en razón social, registro, cobertura, infraestructura, operación, servicios, datos de contacto o situación regulatoria.</Text>
        <Text style={s.p}>Usar la plataforma y los entregables conforme a su finalidad, sin compartir credenciales ni sublicenciar documentos a terceros.</Text>
        <Text style={s.p}>Contar con autorización, base jurídica y habilitación legal para cargar datos personales de terceros en la plataforma o remitirlos al PRESTADOR.</Text>
        <Text style={s.p}>Contratar mediante orden de servicio las actividades que excedan el plan, incluidas actuaciones formales ante autoridades o documentos que requieran firma jurídica independiente.</Text>

        {/* CLÁUSULA 6 */}
        <Text style={s.section}>Cláusula 6. Alcance de los Planes y Exclusiones</Text>
        <Text style={s.p}>Salvo pacto expreso en orden de servicio, no están incluidos en la mensualidad los siguientes servicios: representación judicial o administrativa formal, interposición de recursos, demandas, audiencias, defensa integral en investigaciones sancionatorias, radicación de trámites con mandato, revisión masiva de expedientes, desplazamientos, viáticos, atención fuera de horario, emisión de dictámenes periciales, certificaciones de cumplimiento, implementación técnica directa de sistemas, pago de tasas o derechos y servicios de terceros.</Text>
        <Text style={s.p}>Las visitas presenciales, acompañamientos en sitio, urgencias críticas, respuestas a requerimientos complejos, revisión de expedientes extensos y actuaciones que impliquen responsabilidad jurídica formal deberán cotizarse o confirmarse por orden de servicio, aun cuando el cliente tenga Plan Premium.</Text>

        {/* CLÁUSULA 7 */}
        <Text style={s.section}>Cláusula 7. Propiedad Intelectual</Text>
        <Text style={s.p}>Los métodos, metodologías, marcos de análisis, bases de conocimiento, plantillas generales, vademécum, herramientas, automatizaciones y materiales desarrollados por el PRESTADOR son de su propiedad exclusiva. El contrato concede al CLIENTE una licencia de uso interna, no exclusiva, no transferible y limitada a su operación.</Text>
        <Text style={s.p}>Los documentos, datos e información propios del CLIENTE, así como los productos elaborados específicamente para él, serán de propiedad del CLIENTE.</Text>
        <Text style={s.p}>Las plantillas generales entregadas podrán usarse internamente, pero no comercializarse, sublicenciarse, publicarse o entregarse a terceros como producto propio.</Text>

        {/* CLÁUSULA 8 */}
        <Text style={s.section}>Cláusula 8. Confidencialidad</Text>
        <Text style={s.p}>Las Partes guardarán reserva sobre toda información técnica, jurídica, regulatoria, comercial, financiera, operativa, de seguridad, contractual, estratégica o documental recibida en virtud del contrato. La obligación cobija credenciales, expedientes, estrategias de defensa, documentos regulatorios, secretos empresariales, datos personales, información de clientes finales, bases de datos y entregables no publicados.</Text>
        <Text style={s.p}>Para información ordinaria, la confidencialidad subsistirá por tres (3) años contados desde la terminación del contrato. Para secretos empresariales, datos personales, credenciales, estrategias, expedientes e información reservada, la obligación subsistirá mientras la información conserve carácter reservado o no sea pública por una fuente legítima.</Text>
        <Text style={s.p}>La confidencialidad no aplica a información pública por causa no imputable a la Parte receptora, a información recibida legítimamente de un tercero sin deber de reserva, o a información que deba divulgarse por orden de autoridad competente. En tal caso, la Parte requerida informará a la otra cuando la ley lo permita.</Text>

        {/* CLÁUSULA 9 */}
        <Text style={s.section}>Cláusula 9. Protección de Datos Personales</Text>
        <Text style={s.p}>Para datos de representantes, contactos, usuarios, proveedores o personas vinculadas al CLIENTE que el PRESTADOR recolecte para administrar el servicio, el PRESTADOR actuará como responsable del tratamiento.</Text>
        <Text style={s.p}>Para datos personales de empleados, usuarios finales, contratistas, proveedores o terceros que el CLIENTE cargue, remita o incorpore en documentos, el CLIENTE actuará como responsable y el PRESTADOR como encargado. El CLIENTE garantiza que cuenta con autorización, aviso de privacidad, política de tratamiento, base jurídica y finalidad aplicable para entregar o cargar datos personales de terceros.</Text>
        <Text style={s.p}>El PRESTADOR tratará esos datos únicamente conforme a instrucciones documentadas del CLIENTE, el contrato, la política de tratamiento y las finalidades necesarias para prestar el servicio. El PRESTADOR deberá conservar medidas de seguridad, confidencialidad, acceso restringido, trazabilidad y eliminación o devolución de datos al terminar el contrato.</Text>
        <Text style={s.p}>Cuando el PRESTADOR contrate proveedores tecnológicos que traten datos por su cuenta, deberá vincularlos mediante DPA, contrato de transmisión o cláusula equivalente antes de iniciar tratamiento. Los proveedores futuros no se entienden aprobados de forma automática cuando su intervención cambie sustancialmente el riesgo, país, finalidad o categoría de datos.</Text>
        <Text style={s.p}>Los titulares podrán ejercer derechos de consulta, actualización, rectificación, supresión, revocatoria y demás derechos legales a través del correo de hábeas data informado en la Política de Tratamiento de Datos Personales de Owl Compliance. La política y el aviso de privacidad forman parte del entorno contractual de servicio.</Text>

        {/* CLÁUSULA 10 */}
        <Text style={s.section}>Cláusula 10. Naturaleza del Servicio y Obligaciones de Medio</Text>
        <Text style={s.p}>Los servicios son de medio y no de resultado. El PRESTADOR se obliga a desplegar diligencia profesional, conocimiento jurídico, seguimiento regulatorio y razonabilidad técnica. No garantiza la ausencia de sanciones, aprobación de trámites, aceptación de documentos por autoridades, éxito de investigaciones, resultado favorable de recursos, demandas, visitas o actuaciones regulatorias.</Text>
        <Text style={s.p}>Las recomendaciones, conceptos, diagnósticos, alertas y documentos son herramientas de apoyo para la toma de decisiones del CLIENTE. La implementación, validación interna, entrega ante autoridades y cumplimiento material de obligaciones regulatorias siguen bajo responsabilidad del CLIENTE.</Text>

        {/* CLÁUSULA 11 */}
        <Text style={s.section}>Cláusula 11. Limitación de Responsabilidad</Text>
        <Text style={s.p}>Para reclamaciones ordinarias derivadas de la ejecución del plan mensual, la responsabilidad total del PRESTADOR se limitará al valor efectivamente pagado por el CLIENTE durante los seis (6) meses anteriores al hecho que origine la reclamación. Si la reclamación se refiere a un servicio on-demand, el límite será el valor pagado por la orden de servicio correspondiente.</Text>
        <Text style={s.p}>El límite anterior no aplica frente a dolo, culpa grave, fraude, violación de confidencialidad, infracción de datos personales, uso indebido de información, infracción de propiedad intelectual, actuación sin autorización, incumplimiento deliberado o apropiación indebida de documentos, datos o recursos del CLIENTE.</Text>
        <Text style={s.p}>El PRESTADOR no responderá por sanciones, multas, requerimientos, daños indirectos, lucro cesante, pérdida de clientes, pérdida de contratos, decisiones de autoridad, cambios normativos posteriores, fallas de terceros, falta de implementación de recomendaciones, decisiones del CLIENTE, información falsa, incompleta o tardía, incumplimientos previos del CLIENTE o cargas regulatorias que dependan de su operación.</Text>

        {/* CLÁUSULA 12 */}
        <Text style={s.section}>Cláusula 12. Indemnidad</Text>
        <Text style={s.p}>El CLIENTE mantendrá indemne al PRESTADOR frente a reclamaciones, sanciones, costos, daños o gastos derivados de información falsa, incompleta o tardía, incumplimientos regulatorios propios, carga o entrega de datos sin autorización, uso indebido de entregables, decisiones adoptadas sin atender recomendaciones, actos de sus empleados o contratistas, o instrucciones contrarias a la ley.</Text>
        <Text style={s.p}>El PRESTADOR mantendrá indemne al CLIENTE frente a reclamaciones causadas directamente por violación de confidencialidad, infracción de datos personales, infracción de propiedad intelectual, uso indebido de información del CLIENTE, actuación sin autorización o incumplimiento deliberado de obligaciones esenciales del contrato.</Text>
        <Text style={s.p}>La Parte que conozca una reclamación deberá informar a la otra dentro de un plazo razonable, entregar soportes, permitir la defensa y mitigar el daño.</Text>

        {/* CLÁUSULA 13 */}
        <Text style={s.section}>Cláusula 13. Plazo y Renovación</Text>
        <Text style={s.p}>El contrato tendrá vigencia inicial de un mes contado desde la fecha de aceptación o suscripción y el pago efectivo de los costos de suscripción. Al vencimiento se renovará automáticamente por periodos iguales, salvo que cualquiera de las Partes informe su decisión de no renovar con anterioridad a la fecha de corte del plan contratado a través del botón de cancelación en la herramienta dispuesta para la prestación del servicio.</Text>

        {/* CLÁUSULA 14 */}
        <Text style={s.section}>Cláusula 14. Terminación</Text>
        <Text style={s.p}>El contrato terminará por vencimiento sin renovación, mutuo acuerdo, incumplimiento grave no subsanado dentro de quince días hábiles, mora de dos o más mensualidades, imposibilidad legal o material de ejecución, o por las demás causales previstas en este contrato.</Text>
        <Text style={s.p}>El CLIENTE podrá terminar sin causa con anterioridad a la fecha de corte del plan contratado a través del botón de cancelación en la herramienta dispuesta para la prestación del servicio.</Text>
        <Text style={s.p}>El PRESTADOR podrá terminar sin causa con preaviso de treinta (30) días calendario, garantizando la entrega ordenada de documentos del CLIENTE y el cierre de tickets pendientes según su estado.</Text>
        <Text style={s.p}>El PRESTADOR podrá terminar de forma inmediata cuando exista uso indebido del servicio, actividad ilícita, información falsa, falta grave de cooperación, conflicto de interés, riesgo legal o reputacional relevante, intento de obtener servicios no contratados mediante presión indebida, afectación a la seguridad de la plataforma, incumplimiento de protección de datos o pérdida objetiva de confianza profesional.</Text>
        <Text style={s.p}>Terminada la relación, cesan los servicios, subsisten las obligaciones de pago causadas, confidencialidad, protección de datos, propiedad intelectual, responsabilidad, indemnidad y solución de controversias. El PRESTADOR pondrá a disposición los documentos del CLIENTE por treinta (30) días calendario y luego podrá eliminarlos de forma segura, salvo obligación legal o acuerdo distinto.</Text>

        {/* CLÁUSULA 15 */}
        <Text style={s.section}>Cláusula 15. Fuerza Mayor, Caso Fortuito y Fallas de Terceros</Text>
        <Text style={s.p}>Ninguna Parte responderá por incumplimientos derivados de fuerza mayor o caso fortuito debidamente acreditados, conforme al artículo 64 del Código Civil colombiano. También se reconocerán como eventos de contingencia operativa las fallas generalizadas de internet, energía, proveedores tecnológicos, pasarelas de pago, servicios de nube, sistemas de autoridad o indisponibilidad de plataformas oficiales, siempre que la Parte afectada adopte medidas razonables de mitigación.</Text>

        {/* CLÁUSULA 16 */}
        <Text style={s.section}>Cláusula 16. Disponibilidad de Plataforma y Continuidad</Text>
        <Text style={s.p}>La plataforma Owl Compliance es un medio de apoyo al servicio. El PRESTADOR realizará esfuerzos razonables para mantenerla disponible durante el horario de servicio. Si existe indisponibilidad, el correo electrónico y los canales alternos informados continuarán habilitados para solicitudes críticas.</Text>
        <Text style={s.p}>El PRESTADOR podrá realizar mantenimientos programados con aviso de cuarenta y ocho (48) horas cuando sea posible. Las fallas de terceros, interrupciones de nube, pasarelas, redes o servicios externos, no serán imputables al PRESTADOR. El PRESTADOR deberá conservar registros de tickets, entregables, aceptación, pagos y comunicaciones contractuales conforme a sus políticas internas de seguridad, backups y trazabilidad.</Text>

        {/* CLÁUSULA 17 */}
        <Text style={s.section}>Cláusula 17. Independencia entre las Partes</Text>
        <Text style={s.p}>El contrato no crea vínculo laboral, sociedad, agencia comercial, mandato general, franquicia, representación permanente ni subordinación. El PRESTADOR actúa como contratista independiente y asume las obligaciones tributarias y de seguridad social que le correspondan.</Text>

        {/* CLÁUSULA 18 */}
        <Text style={s.section}>Cláusula 18. Firma Electrónica, Aceptación y Trazabilidad</Text>
        <Text style={s.p}>El contrato podrá suscribirse mediante firma manuscrita, firma electrónica, aceptación digital, mensaje de datos, casilla de aceptación no premarcada, plataforma de firma o mecanismo equivalente. Las Partes reconocen validez probatoria a los mensajes de datos y a los registros electrónicos asociados a la aceptación.</Text>
        <Text style={s.p}>El PRESTADOR conservará evidencia de aceptación, versión contractual, fecha, hora, dirección IP cuando aplique, correo electrónico, identidad del firmante, mecanismo usado, plan contratado, precio aceptado y copia del documento vigente al momento de la aceptación.</Text>

        {/* CLÁUSULA 19 */}
        <Text style={s.section}>Cláusula 19. Modificaciones, Términos y Condiciones</Text>
        <Text style={s.p}>El contrato principal solo podrá modificarse por escrito aceptado por ambas Partes. Los Términos y Condiciones podrán actualizarse para mejorar canales, tiempos, seguridad, reglas operativas o funcionamiento de la plataforma, con aviso previo de quince (15) días hábiles.</Text>
        <Text style={s.p}>El PRESTADOR no podrá modificar unilateralmente precio, responsabilidad, confidencialidad, tratamiento de datos personales, alcance esencial del plan, solución de controversias, propiedad intelectual o causales de terminación sin aceptación expresa del CLIENTE.</Text>
        <Text style={s.p}>Si el CLIENTE no acepta una modificación operativa relevante, podrá terminar el contrato sin penalidad, pagando valores causados.</Text>

        {/* CLÁUSULA 20 */}
        <Text style={s.section}>Cláusula 20. Ley Aplicable y Solución de Controversias</Text>
        <Text style={s.p}>El contrato se regirá por las leyes de Colombia. Las Partes intentarán resolver directamente cualquier controversia dentro de treinta (30) días hábiles contados desde la comunicación escrita del conflicto. Si no hay acuerdo, la controversia será conocida por los jueces competentes de Bogotá D.C., sin perjuicio de las reglas imperativas de competencia aplicables.</Text>

        {/* CLÁUSULA 21 */}
        <Text style={s.section}>Cláusula 21. Integralidad, Prelación e Interpretación</Text>
        <Text style={s.p}>El contrato, los Términos y Condiciones, la Política de Tratamiento de Datos Personales, las órdenes de servicio y los anexos aceptados integran el acuerdo completo entre las Partes. En caso de contradicción, prevalecerá el contrato principal sobre los términos, y la orden de servicio prevalecerá respecto del servicio específico que regule.</Text>
        <Text style={s.p}>Las expresiones técnicas u operativas se interpretarán conforme a las definiciones contractuales. Cualquier ambigüedad deberá resolverse procurando conservar el equilibrio contractual, la finalidad del servicio y la naturaleza empresarial del cliente.</Text>

        {/* CLÁUSULA 22 */}
        <Text style={s.section}>Cláusula 22. Independencia de las Cláusulas</Text>
        <Text style={s.p}>Si una cláusula se declara nula, inválida o inaplicable por autoridad competente, las demás continuarán vigentes. Las Partes reemplazarán la estipulación afectada por una válida que refleje la finalidad económica y jurídica inicial.</Text>

        {/* FIRMAS */}
        <Text style={s.section}>Firmas</Text>
        <Text style={s.p}>En constancia de lo anterior, las Partes suscriben o aceptan el presente contrato en Bogotá D.C., el día {dia} del mes de {mes} de {anio}.</Text>

        <View style={s.signature}>
          <Text style={s.sigTitle}>EL PRESTADOR — EL CLIENTE</Text>
          <Text style={s.sigText}>
            Juan Pablo Osorio Marín — C.C. 1.053.824.988 de Manizales — T.P. No. 284.927 del C.S. de la J.{'\n'}
            Actúa bajo la marca comercial Owl Compliance — contacto@owlcompliance.com
          </Text>
          <Text style={{ ...s.sigText, marginTop: 8 }}>
            {d.nombreCliente} — {d.tipoIdentificacion}: {d.numeroIdentificacion}{'\n'}
            Representante: {d.nombreRepresentante}
          </Text>
          <Text style={{ ...s.sigText, marginTop: 8 }}>
            Aceptación electrónica registrada el {fecha} — IP: {d.ip} — Correo: {d.clienteEmail}{'\n'}
            Validez jurídica conforme al artículo 14 de la Ley 527 de 1999 (Ley de Comercio Electrónico de Colombia).
          </Text>
        </View>

        <Footer />
      </Page>
    </Document>
  )
}

// ── TÉRMINOS Y CONDICIONES ────────────────────────────────────────────────────

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
      <Page size="LETTER" style={s.page}>
        <GhostOwl />
        <Header />

        <Text style={s.h1}>Términos y Condiciones de Prestación del Servicio</Text>
        <Text style={s.h2}>Anexo 1 del Contrato de Prestación de Servicios Profesionales de Gestión Regulatoria</Text>

        {/* 1. Definiciones */}
        <Text style={s.section}>1. Definiciones</Text>
        {[
          ['Canal de atención','Medio habilitado para recibir solicitudes del CLIENTE: ticket, chat, correo electrónico u otro canal informado.'],
          ['Chat','Mensajería operativa para preguntas puntuales y coordinación. No reemplaza el ticket cuando se requiera trazabilidad o entregable.'],
          ['Consulta','Solicitud puntual de orientación que requiere análisis razonable y se descuenta de la cuota mensual cuando supera coordinación operativa o respuesta inmediata.'],
          ['Comunicación operativa','Mensaje sobre coordinación, estado del servicio, alertas, entrega de documentos o gestión administrativa. No se descuenta de la cuota de consultas.'],
          ['Concepto regulatorio','Documento escrito que analiza un asunto jurídico o técnico-regulatorio específico, con fundamento normativo y recomendaciones.'],
          ['Defensa o representación formal','Actuación que implica mandato especial, firma jurídica, recurso, audiencia, demanda, contestación formal o comparecencia ante autoridad. Requiere orden de servicio independiente.'],
          ['Entregable','Documento, plantilla, diagnóstico, concepto, respuesta, matriz, repositorio o producto tangible generado por el PRESTADOR.'],
          ['Escalamiento','Reclasificación de una solicitud como servicio on-demand cuando excede el plan, la cuota, el alcance o requiere representación formal.'],
          ['Horario de atención y servicio','Lunes a viernes, 8:00 a.m. a 6:00 p.m., hora Colombia, días hábiles. Se excluyen festivos.'],
          ['Incidente crítico','Situación con plazo regulatorio inminente, visita de autoridad el mismo día o al día siguiente, o requerimiento con vencimiento inmediato.'],
          ['Orden de servicio','Documento aceptado por las Partes para servicios on-demand o fuera del alcance del plan.'],
          ['Plataforma','Sistema Owl Compliance usado como canal de tickets, repositorio, entrega y seguimiento, cuando esté habilitado.'],
          ['Solicitud completa','Presentación de ticket con todos los anexos necesarios para generar la respuesta requerida por el cliente.'],
          ['Ticket','Solicitud registrada formalmente con número, categoría, prioridad, responsable y estado de atención.'],
        ].map(([term, def]) => (
          <Text key={term} style={s.p}>
            <Text style={s.bold}>{term}: </Text>{def}
          </Text>
        ))}

        {/* 2. Canales */}
        <Text style={s.section}>2. Canales de Atención</Text>
        <Text style={{ ...s.p, fontFamily: 'Helvetica-Bold' }}>2.1 Tickets</Text>
        <Text style={s.p}>El ticket es el canal principal para solicitudes que generen entregables, seguimiento, revisión documental, conceptos, respuestas, diagnósticos o trazabilidad. Toda solicitud recibida por chat o correo que requiera análisis será convertida en ticket. El CLIENTE deberá indicar categoría, prioridad, plazo, descripción completa, documentos de soporte y contexto. El sistema o el PRESTADOR confirmará radicación cuando la plataforma esté habilitada.</Text>
        <Text style={{ ...s.p, fontFamily: 'Helvetica-Bold' }}>2.2 Chat</Text>
        <Text style={s.p}>El chat se usará para consultas rápidas, coordinación y aclaraciones operativas. Si una conversación requiere investigación, revisión documental o entregable, será convertida en ticket y será contabilizada como tal y se podrá descontar de la cuota mensual de tickets.</Text>
        <Text style={{ ...s.p, fontFamily: 'Helvetica-Bold' }}>2.3 Correo electrónico</Text>
        <Text style={s.p}>El correo contacto@owlcompliance.com se usará para comunicaciones contractuales, entrega de documentos, contingencias de plataforma y solicitudes de clientes sin acceso activo. Las solicitudes que requieran seguimiento serán convertidas en ticket.</Text>

        {/* 3. Prioridades */}
        <Text style={s.section}>3. Prioridades y Tiempos de Primera Respuesta</Text>
        <View style={s.tableWrap}>
          <View style={s.tableHeader}>
            <Text style={[s.tcb, { flex: 0.8 }]}>Prioridad</Text>
            <Text style={[s.tcb, { flex: 2 }]}>Descripción</Text>
            <Text style={[s.tcb, { flex: 0.8 }]}>Básico</Text>
            <Text style={[s.tcb, { flex: 0.8 }]}>Pro</Text>
            <Text style={[s.tcb, { flex: 0.8 }]}>Premium</Text>
          </View>
          {[
            ['Crítica','Plazo regulatorio que vence el mismo día o al día siguiente, visita inminente, incidente que exige acción inmediata.','4 horas hábiles','2 horas hábiles','1 hora hábil'],
            ['Alta','Requerimiento con vencimiento próximo, audiencia cercana, riesgo regulatorio dentro de tres días hábiles.','1 día hábil','8 horas hábiles','4 horas hábiles'],
            ['Normal','Consulta regulatoria general, concepto sin urgencia, orientación FUTIC o RUTIC.','2 días hábiles','1 día hábil','8 horas hábiles'],
            ['Baja','Solicitud informativa, archivo, actualización de repositorio o consulta sin impacto inmediato.','5 días hábiles','3 días hábiles','2 días hábiles'],
          ].map(([p, d, b, pr, pm]) => (
            <View key={p} style={s.tableRow}>
              <Text style={[s.tcb, { flex: 0.8 }]}>{p}</Text>
              <Text style={[s.tc, { flex: 2 }]}>{d}</Text>
              <Text style={[s.tc, { flex: 0.8 }]}>{b}</Text>
              <Text style={[s.tc, { flex: 0.8 }]}>{pr}</Text>
              <Text style={[s.tc, { flex: 0.8 }]}>{pm}</Text>
            </View>
          ))}
        </View>
        <Text style={s.p}>Los tiempos corren dentro del horario de servicio y desde que la solicitud esté completa. Las solicitudes fuera de horario inician al siguiente día hábil. La primera respuesta no equivale a entrega final del entregable.</Text>

        {/* 4. Tiempos orientativos */}
        <Text style={s.section}>4. Tiempos Orientativos de Resolución</Text>
        <View style={s.tableWrap}>
          <View style={s.tableHeader}>
            <Text style={[s.tcb, { flex: 2 }]}>Solicitud</Text>
            <Text style={[s.tcb, { flex: 1.5 }]}>Plazo orientativo</Text>
          </View>
          {[
            ['Consulta puntual directa','1 día hábil.'],
            ['Concepto regulatorio simple','3 a 5 días hábiles desde la solicitud completa.'],
            ['Concepto regulatorio complejo','5 a 10 días hábiles desde la solicitud completa.'],
            ['Respuesta a requerimiento de autoridad','Según plazo legal, con inicio desde la entrega completa del expediente por el CLIENTE.'],
            ['Revisión y ajuste de CCU','3 a 7 días hábiles.'],
            ['Diagnóstico Integral Avanzado','10 a 15 días hábiles desde la reunión de inicio y entrega completa de información.'],
            ['Repositorio de evidencias','10 a 20 días hábiles según volumen de soportes.'],
            ['Acompañamiento virtual o presencial','Según agenda de autoridad y disponibilidad confirmada por el PRESTADOR.'],
          ].map(([sol, plazo]) => (
            <View key={sol} style={s.tableRow}>
              <Text style={[s.tc, { flex: 2 }]}>{sol}</Text>
              <Text style={[s.tc, { flex: 1.5 }]}>{plazo}</Text>
            </View>
          ))}
        </View>
        <Text style={s.p}>Los plazos se suspenden mientras el PRESTADOR espera información, validación, documentos, accesos o instrucciones del CLIENTE. Los plazos podrán ampliarse si la autoridad, el volumen documental o la complejidad del asunto lo exige.</Text>

        {/* 5. Cuota */}
        <Text style={s.section}>5. Cuota de Consultas Mensuales</Text>
        <View style={s.tableWrap}>
          <View style={s.tableHeader}>
            <Text style={[s.tcb, { flex: 1 }]}>Plan</Text>
            <Text style={[s.tcb, { flex: 2 }]}>Cuota mensual</Text>
          </View>
          {[['Básico','3 consultas incluidas por mes'],['Pro','6 consultas incluidas por mes'],['Premium','10 consultas incluidas por mes']].map(([p, c]) => (
            <View key={p} style={s.tableRow}>
              <Text style={[s.tc, { flex: 1 }]}>{p}</Text>
              <Text style={[s.tc, { flex: 2 }]}>{c}</Text>
            </View>
          ))}
        </View>
        <Text style={s.p}>Se descuenta una consulta cuando la solicitud requiere análisis, investigación, revisión documental, criterio profesional o respuesta estructurada. No descuentan cuota las alertas regulatorias, actualizaciones de calendario, comunicaciones administrativas, notificaciones de estado, entrega de facturas, corrección de errores imputables al PRESTADOR o aclaraciones menores de un entregable dentro de las rondas incluidas.</Text>
        <Text style={s.p}>Cuando el CLIENTE alcance el ochenta por ciento de su cuota, el PRESTADOR informará el estado de consumo. Al agotarse la cuota, las nuevas solicitudes podrán atenderse como servicio on-demand, acumularse para el siguiente mes por acuerdo escrito, o quedar pendientes hasta renovación de cuota.</Text>

        {/* 6. Alcance */}
        <Text style={s.section}>6. Alcance de Planes y Exclusiones Operativas</Text>
        <View style={s.tableWrap}>
          <View style={s.tableHeader}>
            <Text style={[s.tcb, { flex: 1 }]}>Categoría</Text>
            <Text style={[s.tcb, { flex: 3 }]}>Regla</Text>
          </View>
          {[
            ['Incluido según plan','Alertas regulatorias, consultas mensuales, revisión documental según alcance, plantillas, diagnósticos, conceptos, soporte remoto o presencial cuando el plan lo indique y exista disponibilidad.'],
            ['No incluido salvo orden de servicio','Representación formal, recursos, demandas, audiencias, defensa integral, revisión de expedientes extensos, visitas presenciales no previstas, viáticos, radicaciones con mandato, pagos a terceros y trámites que exijan firma o mandato especial.'],
            ['Premium','Incluye acompañamiento técnico-regulatorio intensivo, soporte estratégico y tarifas preferenciales. No incluye defensa formal automática ni actuaciones con mandato sin orden de servicio.'],
          ].map(([cat, regla]) => (
            <View key={cat} style={s.tableRow}>
              <Text style={[s.tcb, { flex: 1 }]}>{cat}</Text>
              <Text style={[s.tc, { flex: 3 }]}>{regla}</Text>
            </View>
          ))}
        </View>

        {/* 7. Entregables */}
        <Text style={s.section}>7. Entregables y Revisiones</Text>
        <Text style={s.p}>Los entregables se remitirán en Word, PDF, Excel u otro formato útil según su naturaleza. Los conceptos formales se entregarán en PDF cuando estén definitivos y en Word cuando se requiera revisión del CLIENTE.</Text>
        <Text style={s.p}>Cada entregable incluye hasta dos entregas para revisión sin costo adicional, siempre que las observaciones se reciban dentro de los cinco (5) días hábiles siguientes a la entrega. Las revisiones adicionales, extemporáneas o que cambien el alcance inicial se cotizarán como servicio adicional o consumirán cuota según corresponda.</Text>
        <Text style={s.p}>Los entregables reflejan el marco normativo vigente a la fecha de elaboración. Si ocurre un cambio normativo posterior, el PRESTADOR informará al CLIENTE y definirá si la actualización está incluida, consume cuota o requiere orden de servicio.</Text>

        {/* 8. Escalamiento */}
        <Text style={s.section}>8. Escalamiento a Servicio On-Demand</Text>
        <Text style={s.p}>Una solicitud se escalará cuando supere el alcance del plan, exija dedicación superior a la prevista, requiera representación formal, implique firma jurídica, demande revisión documental extensa, exceda la cuota mensual, exija desplazamiento o tenga impacto económico o regulatorio que amerite encargo separado.</Text>
        <Text style={s.p}>El PRESTADOR informará el motivo del escalamiento, alcance, tarifa, plazo y documentos requeridos. El servicio adicional iniciará con aceptación de la orden de servicio y pago anticipado cuando aplique.</Text>

        {/* 9. Actualizaciones */}
        <Text style={s.section}>9. Actualizaciones del Marco Regulatorio</Text>
        <Text style={s.p}>El PRESTADOR hará seguimiento al marco aplicable a PRST, incluyendo MinTIC, CRC, SIC y autoridades relacionadas. Las alertas regulatorias informarán cambios materiales con impacto razonable en la operación del CLIENTE.</Text>
        <Text style={s.p}>Las alertas se enviarán dentro de los dos (2) días hábiles siguientes a la identificación del cambio relevante. La actualización de calendario se realizará en máximo tres (3) días hábiles cuando la plataforma esté habilitada. La actualización de plantillas se hará en máximo diez (10) días hábiles cuando el cambio afecte modelos generales del servicio.</Text>

        {/* 10. Disponibilidad */}
        <Text style={s.section}>10. Disponibilidad de la Plataforma y Contingencia</Text>
        <Text style={s.p}>La plataforma es un canal de apoyo y trazabilidad. El PRESTADOR hará esfuerzos razonables para mantenerla disponible durante el horario de servicio. Si se presenta indisponibilidad, el correo electrónico funcionará como canal alterno, en especial para asuntos críticos.</Text>
        <Text style={s.p}>Los mantenimientos programados se informarán con cuarenta y ocho (48) horas de anticipación cuando sea posible. Las fallas de proveedores de nube, internet, energía, plataformas oficiales, pasarelas o servicios externos no constituyen incumplimiento del PRESTADOR si se adoptan medidas razonables de contingencia. El PRESTADOR mantendrá políticas internas de backups, restauración, revocación de accesos, seguridad y trazabilidad en la medida exigida por su operación y por la información tratada.</Text>

        {/* 11. Uso aceptable */}
        <Text style={s.section}>11. Uso Aceptable del Servicio</Text>
        <Text style={s.p}>El CLIENTE usará el servicio para asuntos relacionados con su operación como PRST o empresa vinculada al sector regulatorio contratado. El CLIENTE no podrá compartir credenciales, revender entregables, usar documentos como servicio propio a terceros o crear solicitudes duplicadas para alterar prioridades.</Text>
        <Text style={s.p}>El CLIENTE no cargará información ilícita, datos sin autorización, secretos de terceros sin habilitación, malware, contenidos ajenos al servicio o documentos que excedan la finalidad contratada.</Text>
        <Text style={s.p}>El CLIENTE no podrá exigir representación formal, firma de documentos, recursos, demandas o audiencias sin orden de servicio y mandato especial cuando aplique.</Text>

        {/* 12. Datos personales */}
        <Text style={s.section}>12. Datos Personales y Seguridad</Text>
        <Text style={s.p}>El tratamiento de datos se regirá por el contrato principal, la Política de Tratamiento de Datos Personales, el aviso de privacidad y las instrucciones documentadas del CLIENTE cuando Owl Compliance actúe como encargado. El CLIENTE declara que cuenta con habilitación para remitir o cargar datos de terceros.</Text>
        <Text style={s.p}>Antes de vincular proveedores que traten datos personales, el PRESTADOR exigirá DPA, contrato de transmisión o cláusula equivalente. La incorporación de proveedores con impacto relevante en país, riesgo, finalidad o categoría de datos será informada cuando corresponda.</Text>

        {/* 13. Modificaciones */}
        <Text style={s.section}>13. Modificaciones a los Términos</Text>
        <Text style={s.p}>El PRESTADOR podrá actualizar estos términos para mejorar canales, seguridad, tiempos, disponibilidad, soporte, escalamiento, formatos o reglas operativas, con aviso de quince (15) días hábiles. La versión vigente estará disponible para el CLIENTE.</Text>
        <Text style={s.p}>No se modificarán unilateralmente precio, responsabilidad, confidencialidad, datos personales, alcance esencial del plan, propiedad intelectual, solución de controversias o causales de terminación sin aceptación expresa del CLIENTE. Si el CLIENTE no acepta una modificación operativa relevante, podrá terminar el contrato sin penalidad, pagando valores causados.</Text>

        {/* 14. Calidad */}
        <Text style={s.section}>14. Calidad y Retroalimentación</Text>
        <Text style={s.p}>El CLIENTE podrá informar observaciones sobre entregables dentro de los cinco (5) días hábiles siguientes a su recepción. Si la observación corresponde al alcance inicial, se atenderá dentro de las rondas incluidas. Si introduce hechos nuevos, cambia la solicitud o exige trabajo adicional, podrá imputarse a la cuota o cotizarse.</Text>
        <Text style={s.p}>El PRESTADOR podrá solicitar valoración del servicio para fines de mejora interna. La valoración será opcional y no condiciona la atención de solicitudes.</Text>

        {/* 15. Incorporación */}
        <Text style={s.section}>15. Incorporación al Contrato</Text>
        <Text style={s.p}>Estos Términos y Condiciones son parte integral del contrato principal. En caso de contradicción, prevalece el contrato principal. Las órdenes de servicio prevalecen respecto del servicio específico que regulen.</Text>

        {/* Aceptación */}
        <Text style={s.section}>Aceptación</Text>
        <Text style={s.p}>El CLIENTE declara que leyó estos Términos y Condiciones, que entiende el alcance del plan contratado y que acepta su incorporación al contrato principal mediante firma, aceptación digital, orden de servicio, pago del plan o activación del servicio.</Text>

        <View style={s.signature}>
          <Text style={s.sigTitle}>Aceptación Electrónica</Text>
          <Text style={s.sigText}>
            Estos Términos y Condiciones fueron presentados, leídos y aceptados electrónicamente el {fecha}, desde la dirección IP {ip}, mediante el correo {clienteEmail}. Esta aceptación tiene plena validez jurídica conforme al artículo 14 de la Ley 527 de 1999.
          </Text>
        </View>

        <Footer />
      </Page>
    </Document>
  )
}

// ── CUENTA DE COBRO ───────────────────────────────────────────────────────────

export interface DatosCuentaCobro {
  numero:             string
  fecha:              string
  nombreEmpresa:      string
  nit:                string
  representanteLegal: string
  plan:               PlanKey
  mes:                string
}

const ccS = StyleSheet.create({
  numFechaRow: {
    flexDirection: 'row',
    gap:           12,
    marginBottom:  16,
    marginTop:     4,
  },
  numFechaCell: {
    flex:    1,
    border:  '1px solid #ccc',
    padding: '6px 10px',
  },
  cellLabel: {
    fontSize:      7.5,
    fontFamily:    'Helvetica-Bold',
    color:         GRIS,
    marginBottom:  2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cellValue: {
    fontSize:   9.5,
    fontFamily: 'Helvetica-Bold',
    color:      NEGRO,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom:  5,
  },
  infoLabel: {
    width:      140,
    fontSize:   9,
    fontFamily: 'Helvetica-Bold',
    color:      GRIS,
    textAlign:  'right',
    paddingRight: 8,
  },
  infoValue: {
    flex:     1,
    fontSize: 9,
    color:    NEGRO,
  },
  totalBox: {
    border:        `1.5px solid ${BORDO}`,
    padding:       '10px 14px',
    width:         180,
    marginBottom:  12,
  },
  totalLabel: {
    fontSize:   8.5,
    fontFamily: 'Helvetica-Bold',
    color:      BORDO,
    marginBottom: 4,
  },
  totalMonto: {
    fontSize:   14,
    fontFamily: 'Helvetica-Bold',
    color:      BORDO,
  },
  totalLetras: {
    fontSize:   8,
    color:      GRIS,
    marginTop:  4,
    lineHeight: 1.4,
  },
  paymentBox: {
    marginTop:    10,
    marginBottom: 12,
    fontSize:     8.5,
    lineHeight:   1.7,
  },
  declaracion: {
    flex:       1,
    paddingLeft: 16,
    fontSize:   7.5,
    color:      GRIS,
    lineHeight: 1.55,
  },
})

function CuentaCobroDoc({ d }: { d: DatosCuentaCobro }) {
  const plan    = PLANES[d.plan]
  const fecha   = new Date(d.fecha).toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
  const monto   = plan.precio
  const letras  = montoCOP(monto)
  const concepto = `Plan ${plan.label} - ${d.mes}`
  const payLink  = PAYMENT_LINKS[d.plan]

  return (
    <Document>
      <Page size="LETTER" style={{ ...s.page, paddingBottom: 55 }}>
        <GhostOwl />
        <Header />

        <Text style={{ ...s.h1, marginBottom: 16 }}>Cuenta de Cobro</Text>

        {/* Número y fecha */}
        <View style={ccS.numFechaRow}>
          <View style={ccS.numFechaCell}>
            <Text style={ccS.cellLabel}>Cuenta de Cobro No.</Text>
            <Text style={ccS.cellValue}>{d.numero}</Text>
          </View>
          <View style={ccS.numFechaCell}>
            <Text style={ccS.cellLabel}>Fecha</Text>
            <Text style={ccS.cellValue}>{fecha}</Text>
          </View>
        </View>

        {/* Datos del cliente */}
        <View style={{ marginTop: 4, marginBottom: 16 }}>
          {([
            ['EMPRESA:',           d.nombreEmpresa],
            ['NIT:',               d.nit],
            ['REPRESENTANTE LEGAL:',d.representanteLegal],
            ['DEBE A:',            'Juan Pablo Osorio Marín'],
            ['CÉDULA:',            '1.053.824.988'],
            ['POR CONCEPTO DE:',   concepto],
          ] as [string, string][]).map(([lbl, val]) => (
            <View key={lbl} style={ccS.infoRow}>
              <Text style={ccS.infoLabel}>{lbl}</Text>
              <Text style={ccS.infoValue}>{val}</Text>
            </View>
          ))}
        </View>

        {/* Total + declaración */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View>
            <View style={ccS.totalBox}>
              <Text style={ccS.totalLabel}>TOTAL A PAGAR:</Text>
              <Text style={ccS.totalMonto}>${monto.toLocaleString('es-CO')}</Text>
              <Text style={ccS.totalLetras}>{letras}</Text>
            </View>
            <View style={ccS.paymentBox}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>
                Realiza tu pago en el siguiente enlace de Mercado Pago:
              </Text>
              <Text style={{ color: BORDO, fontSize: 8.5 }}>{payLink}</Text>
            </View>
          </View>
          <Text style={ccS.declaracion}>
            Declaración: Para efectos de la aplicación de la tabla de retención en la fuente establecida en el artículo 383 del Estatuto Tributario Nacional, la cual se aplica a los pagos o abonos en cuenta por concepto de compensación de servicios personales, declaro bajo la gravedad de juramento que no me tomaré costos y gastos deducibles asociados a este pago en el año gravable, dado que mis ingresos no provienen de una relación laboral o legal y reglamentaria; opto porque se aplique la tabla del art. 383 del E.T. y su 25% exento.
          </Text>
        </View>

        {/* Firma */}
        <View style={{ marginTop: 24, fontSize: 8.5 }}>
          <Text style={{ marginBottom: 28 }}>Atentamente,</Text>
          <Text style={{ fontFamily: 'Helvetica-Bold' }}>JUAN PABLO OSORIO MARÍN</Text>
          <Text style={{ color: GRIS, fontSize: 8 }}>C.C. 1.053.824.988</Text>
        </View>

        <Footer />
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
