'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

const C = { vino: '#270205', bordo: '#712529', olivo: '#968622', marfil: '#e7dfca' }

const PLANES_INFO: Record<string, { label: string; precio: string; precioNum: number; tickets: number; chats: number }> = {
  basico:  { label: 'Básico',  precio: '$199.000/mes',    precioNum: 199000,  tickets: 3,  chats: 6  },
  pro:     { label: 'Pro',     precio: '$890.000/mes',    precioNum: 890000,  tickets: 6,  chats: 12 },
  premium: { label: 'Premium', precio: '$2.490.000/mes',  precioNum: 2490000, tickets: 10, chats: 20 },
}

const CLAUSULAS_CONTRATO = [
  { titulo: 'Partes', texto: 'PRESTADOR: Juan Pablo Osorio Marín, mayor de edad, identificado con cédula de ciudadanía número 1.053.824.988 de Manizales, domiciliado en Bogotá D.C., Colombia, abogado con Tarjeta Profesional No. 284.927 del Consejo Superior de la Judicatura, quien actúa de forma independiente y bajo la marca comercial Owl Compliance, en adelante el PRESTADOR. CLIENTE: Identificado con los datos ingresados en el formulario de suscripción, en adelante el CLIENTE.' },
  { titulo: 'Declaraciones', texto: 'Declara el PRESTADOR que cuenta con conocimiento y experiencia en derecho, consultoría regulatoria y gestión de cumplimiento aplicable a proveedores de redes y servicios de telecomunicaciones, proveedores de servicios de internet e ISPs en Colombia. Declara que presta sus servicios de forma independiente y que no existe impedimento legal o contractual para celebrar este contrato. Declara el CLIENTE que actúa como PRST, ISP o como empresa vinculada a la prestación de servicios de telecomunicaciones o internet en Colombia, que tiene interés legítimo en contratar servicios de gestión regulatoria, que cuenta con capacidad legal para contratar y que suministrará información completa, veraz y oportuna para la ejecución del servicio. Las Partes reconocen que este contrato corresponde a condiciones generales predispuestas por el PRESTADOR para la contratación de planes estandarizados. El CLIENTE declara que recibió el texto contractual, los términos y condiciones, el alcance del plan, los precios y las reglas de servicio antes de contratar, y que pudo formular preguntas o solicitar aclaraciones antes de aceptar.' },
  { titulo: 'Cláusula 1. Objeto', texto: 'El PRESTADOR se obliga a prestar al CLIENTE servicios profesionales de gestión, monitoreo, consultoría jurídica y técnico-regulatoria en cumplimiento aplicable a PRST en Colombia, de acuerdo con el plan contratado y los Términos y Condiciones incorporados al presente contrato. El servicio comprende orientación regulatoria, seguimiento normativo, elaboración de documentos, revisión de insumos, apoyo en cumplimiento ante autoridades, estructuración de evidencias, gestión de alertas y acompañamiento profesional en los frentes incluidos en el plan. La plataforma Owl Compliance, cuando esté disponible, será un medio operativo de coordinación, soporte, repositorio, tickets y entrega de información. La representación formal ante autoridades, la interposición de recursos, la atención de audiencias, la firma de memoriales, demandas o actuaciones que exijan mandato especial, así como cualquier actuación judicial o administrativa con derecho de postulación, no se entienden incluidas automáticamente en la mensualidad. Esas actividades requieren orden de servicio independiente, aceptación expresa, definición de honorarios y otorgamiento del mandato correspondiente cuando aplique.' },
  { titulo: 'Cláusula 2. Planes de Servicio y Cobertura', texto: 'El CLIENTE contrata el plan mensual correspondiente al seleccionado en el proceso de suscripción. Los planes son: Básico ($199.000 COP/mes) — tres consultas incluidas por mes, alertas mensuales, plantillas de liquidación, minutas tipo de CCU para descarga, acceso al vademécum regulatorio y orientación para actualización RUTIC por solicitud. Pro ($890.000 COP/mes) — seis consultas incluidas por mes, incluye el Plan Básico más diagnóstico inicial por una vez, revisión y ajuste de CCU, conceptos escritos, validación de políticas corporativas, repositorio de evidencias, acompañamiento remoto en visitas y elaboración de respuestas ordinarias. Premium ($2.490.000 COP/mes) — diez consultas incluidas por mes, incluye Plan Pro más acompañamiento técnico-regulatorio presencial sujeto a disponibilidad, soporte en trámites de espectro u obligaciones de hacer, apoyo en reportes periódicos, y tarifas preferenciales para servicios on-demand. Los servicios on-demand se contratarán mediante orden de servicio. La orden indicará alcance, honorarios, entregables, plazo, responsables, forma de pago y si requiere mandato especial. Los valores no incluyen IVA, impuestos, tasas, gastos administrativos, desplazamientos, viáticos, autenticaciones, certificados, traducciones, gastos de radicación, pagos a terceros o costos de plataforma externa.' },
  { titulo: 'Cláusula 3. Precio, Facturación, Impuestos y Forma de Pago', texto: 'El CLIENTE pagará la retribución mensual correspondiente al plan contratado. El pago será mensual anticipado, dentro de los primeros cinco días hábiles de cada mes de servicio. El primer pago se realizará al momento de la aceptación del contrato o de la activación del servicio. El PRESTADOR emitirá factura electrónica o documento equivalente cuando esté obligado a ello, según su régimen tributario. El CLIENTE asumirá IVA, retenciones, impuestos, tasas y demás cargas aplicables de acuerdo con la ley. Los pagos se harán por transferencia bancaria, PSE, la pasarela de pagos Trazo (trazo.co), débito autorizado o el medio que el PRESTADOR informe por escrito. Si el pago es rechazado, reversado o no se acredita oportunamente, el PRESTADOR podrá suspender el servicio previo aviso por escrito. La mora causará intereses a la tasa máxima legal permitida en Colombia, sin perjuicio de la terminación por incumplimiento. La retribución mensual podrá ajustarse al inicio de cada anualidad con aviso de treinta días calendario.' },
  { titulo: 'Cláusula 4. Obligaciones del Prestador', texto: 'Prestar los servicios incluidos en el plan contratado con diligencia profesional, criterio jurídico, actualización regulatoria y estándares razonables del sector. Mantener seguimiento al marco normativo aplicable a PRST, en especial MinTIC, CRC, SIC y demás autoridades vinculadas al servicio contratado. Responder las consultas dentro de los tiempos establecidos en los Términos y Condiciones, siempre que el CLIENTE entregue información completa y oportuna. Guardar confidencialidad sobre la información del CLIENTE. Tratar los datos personales conforme a la ley, la política de tratamiento y las instrucciones documentadas cuando actúe como encargado. No usar información del CLIENTE para fines propios no autorizados. Informar cambios normativos materiales que afecten el calendario o los entregables del plan. No subcontratar el servicio profesional principal sin aviso al CLIENTE cuando la subcontratación afecte información reservada o datos personales.' },
  { titulo: 'Cláusula 5. Obligaciones del Cliente', texto: 'Pagar oportunamente la retribución pactada. Suministrar información, documentos, accesos, antecedentes y soportes completos, veraces y oportunos. Designar un contacto interno autorizado para gestionar la relación contractual. Validar internamente los documentos, conceptos y recomendaciones antes de presentarlos ante autoridades o terceros. Informar cambios relevantes en razón social, registro, cobertura, infraestructura, operación, servicios, datos de contacto o situación regulatoria. Usar la plataforma y los entregables conforme a su finalidad, sin compartir credenciales ni sublicenciar documentos a terceros. Contar con autorización, base jurídica y habilitación legal para cargar datos personales de terceros en la plataforma o remitirlos al PRESTADOR. Contratar mediante orden de servicio las actividades que excedan el plan, incluidas actuaciones formales ante autoridades o documentos que requieran firma jurídica independiente.' },
  { titulo: 'Cláusula 6. Alcance de los Planes y Exclusiones', texto: 'Salvo pacto expreso en orden de servicio, no están incluidos en la mensualidad los siguientes servicios: representación judicial o administrativa formal, interposición de recursos, demandas, audiencias, defensa integral en investigaciones sancionatorias, radicación de trámites con mandato, revisión masiva de expedientes, desplazamientos, viáticos, atención fuera de horario, emisión de dictámenes periciales, certificaciones de cumplimiento, implementación técnica directa de sistemas, pago de tasas o derechos y servicios de terceros. Las visitas presenciales, acompañamientos en sitio, urgencias críticas, respuestas a requerimientos complejos, revisión de expedientes extensos y actuaciones que impliquen responsabilidad jurídica formal deberán cotizarse o confirmarse por orden de servicio, aun cuando el cliente tenga Plan Premium.' },
  { titulo: 'Cláusula 7. Propiedad Intelectual', texto: 'Los métodos, metodologías, marcos de análisis, bases de conocimiento, plantillas generales, vademécum, herramientas, automatizaciones y materiales desarrollados por el PRESTADOR son de su propiedad exclusiva. El contrato concede al CLIENTE una licencia de uso interna, no exclusiva, no transferible y limitada a su operación. Los documentos, datos e información propios del CLIENTE, así como los productos elaborados específicamente para él, serán de propiedad del CLIENTE. Las plantillas generales entregadas podrán usarse internamente, pero no comercializarse, sublicenciarse, publicarse o entregarse a terceros como producto propio.' },
  { titulo: 'Cláusula 8. Confidencialidad', texto: 'Las Partes guardarán reserva sobre toda información técnica, jurídica, regulatoria, comercial, financiera, operativa, de seguridad, contractual, estratégica o documental recibida en virtud del contrato. La obligación cobija credenciales, expedientes, estrategias de defensa, documentos regulatorios, secretos empresariales, datos personales, información de clientes finales, bases de datos y entregables no publicados. Para información ordinaria, la confidencialidad subsistirá por tres (3) años contados desde la terminación del contrato. Para secretos empresariales, datos personales, credenciales, estrategias, expedientes e información reservada, la obligación subsistirá mientras la información conserve carácter reservado o no sea pública por una fuente legítima. La confidencialidad no aplica a información pública por causa no imputable a la Parte receptora, o a información que deba divulgarse por orden de autoridad competente.' },
  { titulo: 'Cláusula 9. Protección de Datos Personales', texto: 'Para datos de representantes, contactos, usuarios, proveedores o personas vinculadas al CLIENTE que el PRESTADOR recolecte para administrar el servicio, el PRESTADOR actuará como responsable del tratamiento. Para datos personales de empleados, usuarios finales, contratistas, proveedores o terceros que el CLIENTE cargue, remita o incorpore en documentos, el CLIENTE actuará como responsable y el PRESTADOR como encargado. El CLIENTE garantiza que cuenta con autorización, aviso de privacidad, política de tratamiento, base jurídica y finalidad aplicable para entregar o cargar datos personales de terceros. El PRESTADOR tratará esos datos únicamente conforme a instrucciones documentadas del CLIENTE, el contrato, la política de tratamiento y las finalidades necesarias para prestar el servicio. Los titulares podrán ejercer derechos de consulta, actualización, rectificación, supresión, revocatoria y demás derechos legales a través del correo de hábeas data informado en la Política de Tratamiento de Datos Personales de Owl Compliance.' },
  { titulo: 'Cláusula 10. Naturaleza del Servicio y Obligaciones de Medio', texto: 'Los servicios son de medio y no de resultado. El PRESTADOR se obliga a desplegar diligencia profesional, conocimiento jurídico, seguimiento regulatorio y razonabilidad técnica. No garantiza la ausencia de sanciones, aprobación de trámites, aceptación de documentos por autoridades, éxito de investigaciones, resultado favorable de recursos, demandas, visitas o actuaciones regulatorias. Las recomendaciones, conceptos, diagnósticos, alertas y documentos son herramientas de apoyo para la toma de decisiones del CLIENTE. La implementación, validación interna, entrega ante autoridades y cumplimiento material de obligaciones regulatorias siguen bajo responsabilidad del CLIENTE.' },
  { titulo: 'Cláusula 11. Limitación de Responsabilidad', texto: 'Para reclamaciones ordinarias derivadas de la ejecución del plan mensual, la responsabilidad total del PRESTADOR se limitará al valor efectivamente pagado por el CLIENTE durante los seis (6) meses anteriores al hecho que origine la reclamación. Si la reclamación se refiere a un servicio on-demand, el límite será el valor pagado por la orden de servicio correspondiente. El límite anterior no aplica frente a dolo, culpa grave, fraude, violación de confidencialidad, infracción de datos personales, uso indebido de información, infracción de propiedad intelectual, actuación sin autorización, incumplimiento deliberado o apropiación indebida de documentos, datos o recursos del CLIENTE. El PRESTADOR no responderá por sanciones, multas, requerimientos, daños indirectos, lucro cesante, pérdida de clientes, pérdida de contratos, decisiones de autoridad, cambios normativos posteriores, fallas de terceros, falta de implementación de recomendaciones, decisiones del CLIENTE o información falsa, incompleta o tardía.' },
  { titulo: 'Cláusula 12. Indemnidad', texto: 'El CLIENTE mantendrá indemne al PRESTADOR frente a reclamaciones, sanciones, costos, daños o gastos derivados de información falsa, incompleta o tardía, incumplimientos regulatorios propios, carga o entrega de datos sin autorización, uso indebido de entregables, decisiones adoptadas sin atender recomendaciones, actos de sus empleados o contratistas, o instrucciones contrarias a la ley. El PRESTADOR mantendrá indemne al CLIENTE frente a reclamaciones causadas directamente por violación de confidencialidad, infracción de datos personales, infracción de propiedad intelectual, uso indebido de información del CLIENTE, actuación sin autorización o incumplimiento deliberado de obligaciones esenciales del contrato.' },
  { titulo: 'Cláusula 13. Plazo y Renovación', texto: 'El contrato tendrá vigencia inicial de un mes contado desde la fecha de aceptación o suscripción y el pago efectivo de los costos de suscripción. Al vencimiento se renovará automáticamente por periodos iguales, salvo que cualquiera de las Partes informe su decisión de no renovar con anterioridad a la fecha de corte del plan contratado a través del botón de cancelación en la herramienta dispuesta para la prestación del servicio.' },
  { titulo: 'Cláusula 14. Terminación', texto: 'El contrato terminará por vencimiento sin renovación, mutuo acuerdo, incumplimiento grave no subsanado dentro de quince días hábiles, mora de dos o más mensualidades, imposibilidad legal o material de ejecución, o por las demás causales previstas en este contrato. El CLIENTE podrá terminar sin causa con anterioridad a la fecha de corte del plan contratado a través del botón de cancelación en la herramienta dispuesta para la prestación del servicio. El PRESTADOR podrá terminar sin causa con preaviso de treinta (30) días calendario, garantizando la entrega ordenada de documentos del CLIENTE y el cierre de tickets pendientes según su estado. El PRESTADOR podrá terminar de forma inmediata cuando exista uso indebido del servicio, actividad ilícita, información falsa, falta grave de cooperación, conflicto de interés, riesgo legal o reputacional relevante, intento de obtener servicios no contratados mediante presión indebida, afectación a la seguridad de la plataforma, incumplimiento de protección de datos o pérdida objetiva de confianza profesional.' },
  { titulo: 'Cláusula 15. Fuerza Mayor, Caso Fortuito y Fallas de Terceros', texto: 'Ninguna Parte responderá por incumplimientos derivados de fuerza mayor o caso fortuito debidamente acreditados, conforme al artículo 64 del Código Civil colombiano. También se reconocerán como eventos de contingencia operativa las fallas generalizadas de internet, energía, proveedores tecnológicos, pasarelas de pago, servicios de nube, sistemas de autoridad o indisponibilidad de plataformas oficiales, siempre que la Parte afectada adopte medidas razonables de mitigación.' },
  { titulo: 'Cláusula 16. Disponibilidad de Plataforma y Continuidad', texto: 'La plataforma Owl Compliance es un medio de apoyo al servicio. El PRESTADOR realizará esfuerzos razonables para mantenerla disponible durante el horario de servicio. Si existe indisponibilidad, el correo electrónico y los canales alternos informados continuarán habilitados para solicitudes críticas. El PRESTADOR podrá realizar mantenimientos programados con aviso de cuarenta y ocho (48) horas cuando sea posible. Las fallas de terceros, interrupciones de nube, pasarelas, redes o servicios externos, no serán imputables al PRESTADOR.' },
  { titulo: 'Cláusula 17. Independencia entre las Partes', texto: 'El contrato no crea vínculo laboral, sociedad, agencia comercial, mandato general, franquicia, representación permanente ni subordinación. El PRESTADOR actúa como contratista independiente y asume las obligaciones tributarias y de seguridad social que le correspondan.' },
  { titulo: 'Cláusula 18. Firma Electrónica, Aceptación y Trazabilidad', texto: 'El contrato podrá suscribirse mediante firma manuscrita, firma electrónica, aceptación digital, mensaje de datos, casilla de aceptación no premarcada, plataforma de firma o mecanismo equivalente. Las Partes reconocen validez probatoria a los mensajes de datos y a los registros electrónicos asociados a la aceptación. El PRESTADOR conservará evidencia de aceptación, versión contractual, fecha, hora, dirección IP cuando aplique, correo electrónico, identidad del firmante, mecanismo usado, plan contratado, precio aceptado y copia del documento vigente al momento de la aceptación.' },
  { titulo: 'Cláusula 19. Modificaciones, Términos y Condiciones', texto: 'El contrato principal solo podrá modificarse por escrito aceptado por ambas Partes. Los Términos y Condiciones podrán actualizarse para mejorar canales, tiempos, seguridad, reglas operativas o funcionamiento de la plataforma, con aviso previo de quince (15) días hábiles. El PRESTADOR no podrá modificar unilateralmente precio, responsabilidad, confidencialidad, tratamiento de datos personales, alcance esencial del plan, solución de controversias, propiedad intelectual o causales de terminación sin aceptación expresa del CLIENTE. Si el CLIENTE no acepta una modificación operativa relevante, podrá terminar el contrato sin penalidad, pagando valores causados.' },
  { titulo: 'Cláusula 20. Ley Aplicable y Solución de Controversias', texto: 'El contrato se regirá por las leyes de Colombia. Las Partes intentarán resolver directamente cualquier controversia dentro de treinta (30) días hábiles contados desde la comunicación escrita del conflicto. Si no hay acuerdo, la controversia será conocida por los jueces competentes de Bogotá D.C., sin perjuicio de las reglas imperativas de competencia aplicables.' },
  { titulo: 'Cláusula 21. Integralidad, Prelación e Interpretación', texto: 'El contrato, los Términos y Condiciones, la Política de Tratamiento de Datos Personales, las órdenes de servicio y los anexos aceptados integran el acuerdo completo entre las Partes. En caso de contradicción, prevalecerá el contrato principal sobre los términos, y la orden de servicio prevalecerá respecto del servicio específico que regule. Cualquier ambigüedad deberá resolverse procurando conservar el equilibrio contractual, la finalidad del servicio y la naturaleza empresarial del cliente.' },
  { titulo: 'Cláusula 22. Independencia de las Cláusulas', texto: 'Si una cláusula se declara nula, inválida o inaplicable por autoridad competente, las demás continuarán vigentes. Las Partes reemplazarán la estipulación afectada por una válida que refleje la finalidad económica y jurídica inicial.' },
]

const TYC_SECCIONES = [
  { titulo: '1. Definiciones', texto: 'Canal de atención: Medio habilitado para recibir solicitudes del CLIENTE (ticket, chat, correo u otro canal informado). Chat: Mensajería operativa para preguntas puntuales y coordinación. No reemplaza el ticket cuando se requiera trazabilidad o entregable. Consulta: Solicitud puntual de orientación que requiere análisis razonable y se descuenta de la cuota mensual cuando supera coordinación operativa o respuesta inmediata. Comunicación operativa: Mensaje sobre coordinación, estado del servicio, alertas, entrega de documentos o gestión administrativa. No se descuenta de la cuota de consultas. Concepto regulatorio: Documento escrito que analiza un asunto jurídico o técnico-regulatorio específico, con fundamento normativo y recomendaciones. Defensa o representación formal: Actuación que implica mandato especial, firma jurídica, recurso, audiencia, demanda, contestación formal o comparecencia ante autoridad. Requiere orden de servicio independiente. Entregable: Documento, plantilla, diagnóstico, concepto, respuesta, matriz, repositorio o producto tangible generado por el PRESTADOR. Escalamiento: Reclasificación de una solicitud como servicio on-demand cuando excede el plan, la cuota, el alcance o requiere representación formal. Horario de atención y servicio: Lunes a viernes, 8:00 a.m. a 6:00 p.m., hora Colombia, días hábiles. Se excluyen festivos. Incidente crítico: Situación con plazo regulatorio inminente, visita de autoridad el mismo día o al día siguiente, o requerimiento con vencimiento inmediato. Orden de servicio: Documento aceptado por las Partes para servicios on-demand o fuera del alcance del plan. Plataforma: Sistema Owl Compliance usado como canal de tickets, repositorio, entrega y seguimiento, cuando esté habilitado. Solicitud completa: Presentación de ticket con todos los anexos necesarios para generar la respuesta requerida por el cliente. Ticket: Solicitud registrada formalmente con número, categoría, prioridad, responsable y estado de atención.' },
  { titulo: '2. Canales de Atención', texto: '2.1 Tickets: El ticket es el canal principal para solicitudes que generen entregables, seguimiento, revisión documental, conceptos, respuestas, diagnósticos o trazabilidad. Toda solicitud recibida por chat o correo que requiera análisis será convertida en ticket. El CLIENTE deberá indicar categoría, prioridad, plazo, descripción completa, documentos de soporte y contexto. 2.2 Chat: El chat se usará para consultas rápidas, coordinación y aclaraciones operativas. Si una conversación requiere investigación, revisión documental o entregable, será convertida en ticket y será contabilizada como tal y se podrá descontar de la cuota mensual de tickets. 2.3 Correo electrónico: El correo contacto@owlcompliance.com se usará para comunicaciones contractuales, entrega de documentos, contingencias de plataforma y solicitudes de clientes sin acceso activo. Las solicitudes que requieran seguimiento serán convertidas en ticket.' },
  { titulo: '3. Prioridades y Tiempos de Primera Respuesta', texto: 'Prioridad Crítica: Plazo regulatorio que vence el mismo día o al día siguiente, visita inminente, incidente que exige acción inmediata. Tiempos: Básico 4 horas hábiles / Pro 2 horas hábiles / Premium 1 hora hábil. Prioridad Alta: Requerimiento con vencimiento próximo, audiencia cercana, riesgo regulatorio dentro de tres días hábiles. Tiempos: Básico 1 día hábil / Pro 8 horas hábiles / Premium 4 horas hábiles. Prioridad Normal: Consulta regulatoria general, concepto sin urgencia, orientación FUTIC o RUTIC. Tiempos: Básico 2 días hábiles / Pro 1 día hábil / Premium 8 horas hábiles. Prioridad Baja: Solicitud informativa, archivo, actualización de repositorio o consulta sin impacto inmediato. Tiempos: Básico 5 días hábiles / Pro 3 días hábiles / Premium 2 días hábiles. Los tiempos corren dentro del horario de servicio y desde que la solicitud esté completa. Las solicitudes fuera de horario inician al siguiente día hábil. La primera respuesta no equivale a entrega final del entregable.' },
  { titulo: '4. Tiempos Orientativos de Resolución', texto: 'Consulta puntual directa: 1 día hábil. Concepto regulatorio simple: 3 a 5 días hábiles desde la solicitud completa. Concepto regulatorio complejo: 5 a 10 días hábiles desde la solicitud completa. Respuesta a requerimiento de autoridad: Según plazo legal, con inicio desde la entrega completa del expediente por el CLIENTE. Revisión y ajuste de CCU: 3 a 7 días hábiles. Diagnóstico Integral Avanzado: 10 a 15 días hábiles desde la reunión de inicio y entrega completa de información. Repositorio de evidencias: 10 a 20 días hábiles según volumen de soportes. Acompañamiento virtual o presencial: Según agenda de autoridad y disponibilidad confirmada por el PRESTADOR. Los plazos se suspenden mientras el PRESTADOR espera información, validación, documentos, accesos o instrucciones del CLIENTE. Los plazos podrán ampliarse si la autoridad, el volumen documental o la complejidad del asunto lo exige.' },
  { titulo: '5. Cuota de Consultas Mensuales', texto: 'Plan Básico: 3 consultas incluidas por mes. Plan Pro: 6 consultas incluidas por mes. Plan Premium: 10 consultas incluidas por mes. Se descuenta una consulta cuando la solicitud requiere análisis, investigación, revisión documental, criterio profesional o respuesta estructurada. No descuentan cuota las alertas regulatorias, actualizaciones de calendario, comunicaciones administrativas, notificaciones de estado, entrega de facturas, corrección de errores imputables al PRESTADOR o aclaraciones menores de un entregable dentro de las rondas incluidas. Cuando el CLIENTE alcance el ochenta por ciento de su cuota, el PRESTADOR informará el estado de consumo. Al agotarse la cuota, las nuevas solicitudes podrán atenderse como servicio on-demand, acumularse para el siguiente mes por acuerdo escrito, o quedar pendientes hasta renovación de cuota.' },
  { titulo: '6. Alcance de Planes y Exclusiones Operativas', texto: 'Incluido según plan: Alertas regulatorias, consultas mensuales, revisión documental según alcance, plantillas, diagnósticos, conceptos, soporte remoto o presencial cuando el plan lo indique y exista disponibilidad. No incluido salvo orden de servicio: Representación formal, recursos, demandas, audiencias, defensa integral, revisión de expedientes extensos, visitas presenciales no previstas, viáticos, radicaciones con mandato, pagos a terceros y trámites que exijan firma o mandato especial. Premium: Incluye acompañamiento técnico-regulatorio intensivo, soporte estratégico y tarifas preferenciales. No incluye defensa formal automática ni actuaciones con mandato sin orden de servicio.' },
  { titulo: '7. Entregables y Revisiones', texto: 'Los entregables se remitirán en Word, PDF, Excel u otro formato útil según su naturaleza. Los conceptos formales se entregarán en PDF cuando estén definitivos y en Word cuando se requiera revisión del CLIENTE. Cada entregable incluye hasta dos entregas para revisión sin costo adicional, siempre que las observaciones se reciban dentro de los cinco (5) días hábiles siguientes a la entrega. Las revisiones adicionales, extemporáneas o que cambien el alcance inicial se cotizarán como servicio adicional o consumirán cuota según corresponda. Los entregables reflejan el marco normativo vigente a la fecha de elaboración. Si ocurre un cambio normativo posterior, el PRESTADOR informará al CLIENTE y definirá si la actualización está incluida, consume cuota o requiere orden de servicio.' },
  { titulo: '8. Escalamiento a Servicio On-Demand', texto: 'Una solicitud se escalará cuando supere el alcance del plan, exija dedicación superior a la prevista, requiera representación formal, implique firma jurídica, demande revisión documental extensa, exceda la cuota mensual, exija desplazamiento o tenga impacto económico o regulatorio que amerite encargo separado. El PRESTADOR informará el motivo del escalamiento, alcance, tarifa, plazo y documentos requeridos. El servicio adicional iniciará con aceptación de la orden de servicio y pago anticipado cuando aplique.' },
  { titulo: '9. Actualizaciones del Marco Regulatorio', texto: 'El PRESTADOR hará seguimiento al marco aplicable a PRST, incluyendo MinTIC, CRC, SIC y autoridades relacionadas. Las alertas regulatorias informarán cambios materiales con impacto razonable en la operación del CLIENTE. Las alertas se enviarán dentro de los dos (2) días hábiles siguientes a la identificación del cambio relevante. La actualización de calendario se realizará en máximo tres (3) días hábiles cuando la plataforma esté habilitada. La actualización de plantillas se hará en máximo diez (10) días hábiles cuando el cambio afecte modelos generales del servicio.' },
  { titulo: '10. Disponibilidad de la Plataforma y Contingencia', texto: 'La plataforma es un canal de apoyo y trazabilidad. El PRESTADOR hará esfuerzos razonables para mantenerla disponible durante el horario de servicio. Si se presenta indisponibilidad, el correo electrónico funcionará como canal alterno, en especial para asuntos críticos. Los mantenimientos programados se informarán con cuarenta y ocho (48) horas de anticipación cuando sea posible. Las fallas de proveedores de nube, internet, energía, plataformas oficiales, pasarelas o servicios externos no constituyen incumplimiento del PRESTADOR si se adoptan medidas razonables de contingencia. El PRESTADOR mantendrá políticas internas de backups, restauración, revocación de accesos, seguridad y trazabilidad en la medida exigida por su operación y por la información tratada.' },
  { titulo: '11. Uso Aceptable del Servicio', texto: 'El CLIENTE usará el servicio para asuntos relacionados con su operación como PRST o empresa vinculada al sector regulatorio contratado. El CLIENTE no podrá compartir credenciales, revender entregables, usar documentos como servicio propio a terceros o crear solicitudes duplicadas para alterar prioridades. El CLIENTE no cargará información ilícita, datos sin autorización, secretos de terceros sin habilitación, malware, contenidos ajenos al servicio o documentos que excedan la finalidad contratada. El CLIENTE no podrá exigir representación formal, firma de documentos, recursos, demandas o audiencias sin orden de servicio y mandato especial cuando aplique.' },
  { titulo: '12. Datos Personales y Seguridad', texto: 'El tratamiento de datos se regirá por el contrato principal, la Política de Tratamiento de Datos Personales, el aviso de privacidad y las instrucciones documentadas del CLIENTE cuando Owl Compliance actúe como encargado. El CLIENTE declara que cuenta con habilitación para remitir o cargar datos de terceros. Antes de vincular proveedores que traten datos personales, el PRESTADOR exigirá DPA, contrato de transmisión o cláusula equivalente. La incorporación de proveedores con impacto relevante en país, riesgo, finalidad o categoría de datos será informada cuando corresponda.' },
  { titulo: '13. Modificaciones a los Términos', texto: 'El PRESTADOR podrá actualizar estos términos para mejorar canales, seguridad, tiempos, disponibilidad, soporte, escalamiento, formatos o reglas operativas, con aviso de quince (15) días hábiles. La versión vigente estará disponible para el CLIENTE. No se modificarán unilateralmente precio, responsabilidad, confidencialidad, datos personales, alcance esencial del plan, propiedad intelectual, solución de controversias o causales de terminación sin aceptación expresa del CLIENTE. Si el CLIENTE no acepta una modificación operativa relevante, podrá terminar el contrato sin penalidad, pagando valores causados.' },
  { titulo: '14. Calidad y Retroalimentación', texto: 'El CLIENTE podrá informar observaciones sobre entregables dentro de los cinco (5) días hábiles siguientes a su recepción. Si la observación corresponde al alcance inicial, se atenderá dentro de las rondas incluidas. Si introduce hechos nuevos, cambia la solicitud o exige trabajo adicional, podrá imputarse a la cuota o cotizarse. El PRESTADOR podrá solicitar valoración del servicio para fines de mejora interna. La valoración será opcional y no condiciona la atención de solicitudes.' },
  { titulo: '15. Incorporación al Contrato', texto: 'Estos Términos y Condiciones son parte integral del contrato principal. En caso de contradicción, prevalece el contrato principal. Las órdenes de servicio prevalecen respecto del servicio específico que regulen. El CLIENTE declara que leyó estos Términos y Condiciones, que entiende el alcance del plan contratado y que acepta su incorporación al contrato principal mediante firma, aceptación digital, orden de servicio, pago del plan o activación del servicio.' },
]

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: 'rgba(231,223,202,0.5)', marginBottom: '0.35rem',
}
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(231,223,202,0.06)', border: '1px solid rgba(150,134,34,0.3)',
  borderRadius: '8px', padding: '0.65rem 0.9rem', fontSize: '0.85rem', color: C.marfil,
  fontFamily: "'Josefin Sans', sans-serif", outline: 'none', boxSizing: 'border-box',
}
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer', appearance: 'none' }

export default function SuscribirseContratoClient() {
  const params = useSearchParams()
  const plan   = params.get('plan') ?? 'basico'
  const info   = PLANES_INFO[plan] ?? PLANES_INFO.basico

  const [paso,      setPaso]      = useState<1 | 2 | 3>(1)
  const [tab,       setTab]       = useState<'contrato' | 'tyc'>('contrato')
  const [cargando,  setCargando]  = useState(false)
  const [error,     setError]     = useState('')
  const [aceptado,  setAceptado]  = useState(false)
  const [enviado,   setEnviado]   = useState(false)
  const [enlacePago, setEnlacePago] = useState<string | null>(null)

  const [form, setForm] = useState({
    email:                '',
    nombreCliente:        '',
    tipoPersona:          'juridica',
    tipoIdentificacion:   'NIT',
    numeroIdentificacion: '',
    ciudadCliente:        'Bogotá',
    nombreRepresentante:  '',
    ccRepresentante:      '',
    cuentaCobroSolicitada: false,
  })

  function setF(k: keyof typeof form, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function paso1Valido() {
    return (
      form.email.trim() &&
      form.nombreCliente.trim() &&
      form.numeroIdentificacion.trim() &&
      form.ciudadCliente.trim() &&
      form.nombreRepresentante.trim() &&
      form.ccRepresentante.trim()
    )
  }

  async function finalizar() {
    if (!aceptado) return
    setCargando(true)
    setError('')
    try {
      // 1. Registrar contrato y generar PDFs
      const resContrato = await fetch('/api/contrato/publico', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...form, plan }),
      })
      const dataContrato = await resContrato.json()
      if (!resContrato.ok) {
        setError(dataContrato.error ?? 'Error al procesar el contrato.')
        setCargando(false)
        return
      }

      if (dataContrato.enlacePago) {
        // Ir directo a la pasarela de pago — no hace falta que el cliente haga clic en nada más
        window.location.href = dataContrato.enlacePago
        return
      }

      setEnlacePago(null)
      setEnviado(true)
      setCargando(false)
    } catch {
      setError('Error de conexión. Intenta nuevamente.')
      setCargando(false)
    }
  }

  const tipoPersonaLabel = form.tipoPersona === 'natural' ? 'persona natural' : 'persona jurídica'

  return (
    <div style={{
      minHeight: '100vh', background: C.vino, display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontFamily: "'Josefin Sans', sans-serif", color: C.marfil,
      padding: '2rem',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Josefin+Sans:wght@300;400;600;700&display=swap" rel="stylesheet" />

      <div style={{
        maxWidth: paso === 2 ? 820 : 500, width: '100%',
        background: 'rgba(231,223,202,0.04)', border: '1px solid rgba(150,134,34,0.25)',
        borderRadius: '16px', overflow: 'hidden',
        transition: 'max-width 0.3s ease',
      }}>
        {enviado ? (
          <div style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '1rem' }}>✅</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.8rem' }}>
              Contrato firmado correctamente
            </div>
            <p style={{ fontSize: '0.85rem', color: 'rgba(231,223,202,0.7)', lineHeight: 1.8 }}>
              Enviamos el contrato y los términos y condiciones a <strong style={{ color: C.marfil }}>{form.email}</strong>,
              junto con el enlace de pago de Trazo (trazo.co) para activar tu acceso a la plataforma.
            </p>
            {enlacePago && (
              <>
                <a href={enlacePago}
                  style={{ display: 'inline-block', marginTop: '1.6rem', background: C.olivo, color: C.vino,
                    borderRadius: '8px', padding: '0.85rem 2rem', fontWeight: 700, fontSize: '0.78rem',
                    letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none' }}>
                  Pagar y activar mi suscripción →
                </a>
                <p style={{ fontSize: '0.72rem', color: 'rgba(231,223,202,0.45)', marginTop: '0.9rem', lineHeight: 1.6 }}>
                  Al vincular tu medio de pago se realiza el primer cobro y tu cuenta se crea automáticamente —
                  recibirás tus credenciales de acceso por correo.
                </p>
              </>
            )}
          </div>
        ) : (
        <>
        {/* Cabecera */}
        <div style={{ padding: '1.8rem 2rem 1.2rem', borderBottom: '1px solid rgba(150,134,34,0.15)' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Owl Compliance
          </div>
          <div style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.olivo }}>
            Plan {info.label} · {info.precio}
          </div>
        </div>

        {/* Indicador de pasos */}
        <div style={{ display: 'flex', padding: '0.9rem 2rem 0', gap: '0.5rem' }}>
          {['Tus datos', 'Contrato', 'Confirmar'].map((lbl, i) => (
            <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: paso === i + 1 ? 1 : 0.4 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                background: paso > i ? C.olivo : 'rgba(150,134,34,0.15)',
                border: `1px solid ${C.olivo}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.58rem', fontWeight: 700, color: C.vino, flexShrink: 0,
              }}>
                {paso > i ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: '0.63rem', fontWeight: 600, letterSpacing: '0.08em', color: C.marfil, whiteSpace: 'nowrap' }}>{lbl}</span>
              {i < 2 && <div style={{ width: 16, height: 1, background: 'rgba(150,134,34,0.3)', flexShrink: 0 }} />}
            </div>
          ))}
        </div>

        {/* Contenido */}
        <div style={{ padding: '1.4rem 2rem', maxHeight: paso === 2 ? '65vh' : 'none', overflowY: paso === 2 ? 'auto' : 'visible' }}>

          {/* ── PASO 1: Datos ── */}
          {paso === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <p style={{ fontSize: '0.76rem', color: 'rgba(231,223,202,0.5)', margin: 0, lineHeight: 1.6 }}>
                Estos datos aparecerán en el contrato de prestación de servicios.
              </p>

              <div>
                <label style={labelStyle}>Nombre o razón social *</label>
                <input value={form.nombreCliente} onChange={e => setF('nombreCliente', e.target.value)}
                  placeholder="Nombre de la empresa" style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Correo electrónico *</label>
                <input type="email" value={form.email} onChange={e => setF('email', e.target.value)}
                  placeholder="correo@empresa.com" style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
                <div>
                  <label style={labelStyle}>Tipo de persona *</label>
                  <select value={form.tipoPersona} onChange={e => setF('tipoPersona', e.target.value)} style={selectStyle}>
                    <option value="juridica">Persona jurídica</option>
                    <option value="natural">Persona natural</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Tipo de identificación *</label>
                  <select value={form.tipoIdentificacion} onChange={e => setF('tipoIdentificacion', e.target.value)} style={selectStyle}>
                    <option value="NIT">NIT</option>
                    <option value="CC">Cédula</option>
                    <option value="CE">Cédula extranjería</option>
                    <option value="Pasaporte">Pasaporte</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
                <div>
                  <label style={labelStyle}>Número de identificación *</label>
                  <input value={form.numeroIdentificacion} onChange={e => setF('numeroIdentificacion', e.target.value)}
                    placeholder="900123456-7" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Ciudad *</label>
                  <input value={form.ciudadCliente} onChange={e => setF('ciudadCliente', e.target.value)}
                    placeholder="Bogotá" style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Nombre del representante legal *</label>
                <input value={form.nombreRepresentante} onChange={e => setF('nombreRepresentante', e.target.value)}
                  placeholder="Nombre completo" style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Cédula del representante legal *</label>
                <input value={form.ccRepresentante} onChange={e => setF('ccRepresentante', e.target.value)}
                  placeholder="1234567890" style={inputStyle} />
              </div>

              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.7rem', cursor: 'pointer',
                padding: '0.8rem', background: 'rgba(150,134,34,0.05)',
                border: '1px solid rgba(150,134,34,0.2)', borderRadius: '8px',
              }}>
                <input type="checkbox" checked={form.cuentaCobroSolicitada}
                  onChange={e => setF('cuentaCobroSolicitada', e.target.checked)}
                  style={{ marginTop: '2px', accentColor: C.olivo, width: 15, height: 15, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: C.marfil, marginBottom: '0.2rem' }}>Solicitar cuenta de cobro</div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(231,223,202,0.5)', lineHeight: 1.5 }}>
                    Recibirás una cuenta de cobro con el enlace de pago, adjunta al contrato y mensualmente antes de cada renovación.
                  </div>
                </div>
              </label>
            </div>
          )}

          {/* ── PASO 2: Revisión del contrato ── */}
          {paso === 2 && (
            <div>
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(150,134,34,0.2)', marginBottom: '1rem' }}>
                {(['contrato', 'tyc'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)} style={{
                    background: 'none', border: 'none', padding: '0.5rem 1rem',
                    fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                    cursor: 'pointer', color: tab === t ? C.olivo : 'rgba(231,223,202,0.35)',
                    borderBottom: tab === t ? `2px solid ${C.olivo}` : '2px solid transparent',
                    marginBottom: '-1px', fontFamily: "'Josefin Sans', sans-serif",
                  }}>
                    {t === 'contrato' ? 'Contrato' : 'Términos y condiciones'}
                  </button>
                ))}
              </div>

              <div style={{ fontSize: '0.77rem', color: 'rgba(231,223,202,0.8)', lineHeight: 1.7 }}>
                {tab === 'contrato' && (
                  <div>
                    <p style={{ fontWeight: 700, color: C.marfil, marginBottom: '0.3rem', fontSize: '0.85rem' }}>
                      Contrato de Prestación de Servicios Profesionales de Gestión Regulatoria
                    </p>
                    <p style={{ fontWeight: 700, color: C.olivo, fontSize: '0.72rem', marginBottom: '1rem' }}>
                      OWL COMPLIANCE — Plan {info.label}
                    </p>
                    {CLAUSULAS_CONTRATO.map(c => (
                      <div key={c.titulo} style={{ marginBottom: '0.85rem' }}>
                        <div style={{ fontWeight: 700, color: C.olivo, fontSize: '0.71rem', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.titulo}</div>
                        <div style={{ color: 'rgba(231,223,202,0.78)' }}>{c.texto}</div>
                      </div>
                    ))}
                  </div>
                )}
                {tab === 'tyc' && (
                  <div>
                    <p style={{ fontWeight: 700, color: C.marfil, marginBottom: '0.3rem', fontSize: '0.85rem' }}>Términos y Condiciones de Prestación del Servicio</p>
                    <p style={{ fontWeight: 700, color: C.olivo, fontSize: '0.72rem', marginBottom: '1rem' }}>Anexo 1 del Contrato de Prestación de Servicios Profesionales de Gestión Regulatoria</p>
                    {TYC_SECCIONES.map(s => (
                      <div key={s.titulo} style={{ marginBottom: '0.85rem' }}>
                        <div style={{ fontWeight: 700, color: C.olivo, fontSize: '0.71rem', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.titulo}</div>
                        <div style={{ color: 'rgba(231,223,202,0.78)' }}>{s.texto}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PASO 3: Confirmación ── */}
          {paso === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                background: 'rgba(150,134,34,0.08)', border: '1px solid rgba(150,134,34,0.25)',
                borderRadius: '10px', padding: '1rem 1.2rem', fontSize: '0.78rem',
                color: 'rgba(231,223,202,0.8)', lineHeight: 1.7,
              }}>
                Al hacer clic en <strong style={{ color: C.marfil }}>Aceptar y pagar</strong> estás firmando
                electrónicamente el contrato de prestación de servicios y los términos y condiciones de Owl Compliance.
                Esta firma tiene plena validez jurídica conforme al artículo 14 de la Ley 527 de 1999.
              </div>

              <div style={{ fontSize: '0.74rem', color: 'rgba(231,223,202,0.55)', lineHeight: 1.8 }}>
                <div>Firmante: <strong style={{ color: C.marfil }}>{form.nombreRepresentante} — {form.nombreCliente}</strong></div>
                <div>Plan: <strong style={{ color: C.marfil }}>Plan {info.label} — {info.precio}</strong></div>
                <div>Correo: <strong style={{ color: C.marfil }}>{form.email}</strong></div>
                {form.cuentaCobroSolicitada && <div style={{ color: C.olivo }}>Incluye cuenta de cobro mensual</div>}
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.7rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={aceptado} onChange={e => setAceptado(e.target.checked)}
                  style={{ marginTop: '3px', accentColor: C.olivo, width: 15, height: 15, flexShrink: 0 }} />
                <span style={{ fontSize: '0.78rem', color: 'rgba(231,223,202,0.8)', lineHeight: 1.5 }}>
                  He leído y acepto el contrato de prestación de servicios y los términos y condiciones de Owl Compliance.
                </span>
              </label>

              {error && (
                <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '8px', padding: '0.7rem 1rem', fontSize: '0.78rem', color: '#f87171' }}>
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Botones de navegación */}
        <div style={{
          padding: '1rem 2rem 1.5rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderTop: '1px solid rgba(150,134,34,0.12)',
        }}>
          {paso > 1 ? (
            <button
              onClick={() => { setPaso((p) => (p - 1) as 1 | 2 | 3); setError('') }}
              disabled={cargando}
              style={{ background: 'transparent', color: 'rgba(231,223,202,0.45)', border: '1px solid rgba(231,223,202,0.15)', borderRadius: '8px', padding: '0.5rem 1rem', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', fontFamily: "'Josefin Sans', sans-serif" }}>
              Atrás
            </button>
          ) : (
            <div />
          )}

          {paso < 3 ? (
            <button
              onClick={() => {
                if (paso === 1 && !paso1Valido()) { setError('Completa todos los campos requeridos.'); return }
                setError('')
                setPaso((p) => (p + 1) as 1 | 2 | 3)
              }}
              style={{
                background: C.olivo, color: C.vino, border: 'none', borderRadius: '8px',
                padding: '0.7rem 1.6rem', fontWeight: 700, fontSize: '0.75rem',
                letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer',
                fontFamily: "'Josefin Sans', sans-serif",
              }}>
              {paso === 1 ? 'Ver contrato →' : 'Continuar →'}
            </button>
          ) : (
            <button
              onClick={finalizar}
              disabled={!aceptado || cargando}
              style={{
                background: aceptado && !cargando ? C.olivo : 'rgba(150,134,34,0.2)',
                color: aceptado && !cargando ? C.vino : C.olivo,
                border: `1px solid ${C.olivo}`, borderRadius: '8px',
                padding: '0.7rem 1.6rem', fontWeight: 700, fontSize: '0.75rem',
                letterSpacing: '0.1em', textTransform: 'uppercase',
                cursor: aceptado && !cargando ? 'pointer' : 'not-allowed',
                fontFamily: "'Josefin Sans', sans-serif", transition: 'all 0.2s',
              }}>
              {cargando ? 'Procesando…' : 'Aceptar y firmar →'}
            </button>
          )}
        </div>

        {/* Error paso 1 inline */}
        {error && paso === 1 && (
          <div style={{ padding: '0 2rem 1rem', fontSize: '0.75rem', color: '#f87171' }}>{error}</div>
        )}

        <div style={{ padding: '0 2rem 1.2rem', fontSize: '0.68rem', color: 'rgba(231,223,202,0.25)', lineHeight: 1.6 }}>
          Tras aceptar recibirás el contrato firmado por correo, junto con el enlace de pago de Trazo (trazo.co) para activar tu acceso.
        </div>
        </>
        )}
      </div>
    </div>
  )
}
