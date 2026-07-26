/**
 * lib/pqr-seed.ts
 * Contenido semilla del Repositorio de PQR: tipologías, normativa,
 * plantillas de respuesta (SÍ/NO) y guía de aplicación por tipología.
 * Basado en CRC Data Flash 2025-003 y Resolución CRC 5050 de 2016.
 */

export interface PqrSeedItem {
  servicio:    string
  codigo:      string
  nombre:      string
  incidencia:  string
  severidad:   'Alta' | 'Media' | 'Baja'
  norma:       string
  normativa:   string
  plantillaSi: string
  plantillaNo: string
  guia:        string
}

export const PQR_SEED: PqrSeedItem[] = [
  {
    servicio: 'INTERNET FIJO',
    codigo: 'ISP-FIJ-001',
    nombre: 'No disponibilidad del servicio',
    incidencia: '40.3%',
    severidad: 'Alta',
    norma: 'Art. 2.1, 2.1.15 (CRC 5050)',
    normativa: `El operador debe garantizar la disponibilidad del servicio contratado.

OBLIGACIONES:
- Mantener el servicio disponible 24/7 o según lo pactado
- Informar al usuario sobre interrupciones programadas con 48h de anticipación
- Ofrecer compensación automática por falta de continuidad (Art. 2.1.11.1)
- Responder al reclamo en máximo 15 días hábiles

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si se comprueba caída del servicio por culpa del operador
✗ Rechazar: Si la caída fue por culpa del cliente (ruta mala del operador) o fuerza mayor no previsible`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Reconocemos su inconformidad respecto a la falta de disponibilidad del servicio de internet fijo durante el período [FECHAS], el cual afectó su experiencia como usuario.

Luego de revisar nuestros registros técnicos, confirmamos que la caída fue ocasionada por [CAUSA ESPECÍFICA: falla en infraestructura/error operacional/etc]. Esta situación fue de nuestra responsabilidad como operador.

ACCIÓN TOMADA:
1. Se han aplicado las compensaciones automáticas correspondientes por [X HORAS] de indisponibilidad
2. El monto de $[VALOR] será abonado en su próxima factura
3. Se han implementado medidas correctivas en la infraestructura afectada

Agradecemos su paciencia y reiterar nuestro compromiso con la calidad del servicio.

Atentamente,
[NOMBRE OPERADOR]
Departamento de Atención al Usuario`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Agradecemos el tiempo dedicado a presentar su reclamo sobre la falta de disponibilidad del servicio reportada en las fechas [FECHAS].

ANÁLISIS DE LA SITUACIÓN:
Nuestros sistemas técnicos registran que durante el período en cuestión:
- La conexión en el lado del operador funcionaba correctamente
- Los registros muestran desconexiones originadas en el router/módem del cliente
- No hay evidencia de falla en la infraestructura de acceso

CONCLUSIÓN:
La indisponibilidad reportada se debió a problemas en los equipos terminales del cliente, no en la red del operador. Por lo anterior, el reclamo NO PROCEDE.

Sin embargo, le recomendamos:
1. Verificar el estado físico de cables y conexiones
2. Reiniciar el equipamiento (router/módem)
3. Contactar al departamento técnico para diagnóstico remoto

Derechos: Si considera que esta decisión es injusta, puede recurrir ante la Superintendencia de Industria y Comercio (SIC) en los 10 días hábiles posteriores a esta respuesta.

Atentamente,
[NOMBRE OPERADOR]
Departamento de Atención al Usuario`,
    guia: `PREGUNTAS CLAVE ANTES DE RESPONDER:
1. ¿Cuándo reportó el cliente la caída? (dentro de 24h de ocurrida)
2. ¿Cuál fue la duración de la interrupción? (verificar logs)
3. ¿Fue una interrupción programada? (si sí, ¿se notificó con 48h?)
4. ¿Cuál fue la causa técnica? (hardware, software, infraestructura)

DOCUMENTOS A REVISAR:
- Logs de disponibilidad del cliente
- Registros de incidentes de infraestructura
- Historiales de tickets técnicos
- Notificaciones enviadas al cliente

ERRORES COMUNES:
❌ NO admitir culpa sin revisar logs técnicos
❌ NO prometer compensación sin verificar políticas internas
❌ Ignorar si fue interrupción programada (notificada = sin culpa)
❌ NO mencionar el plazo de la SIC para recurrir

CHECKLIST ANTES DE ENVIAR:
□ Verificado el período exacto de la caída
□ Consultados los logs técnicos
□ Identificada la causa raíz
□ Calculada compensación si aplica
□ Revisado cumplimiento de plazo (15 días hábiles)
□ Explicación clara en lenguaje simple

CASO PRÁCTICO:
Cliente: Juan García
Queja: "El 15 de noviembre no tuve internet todo el día"
Verificación: Logs muestran caída entre 09:00-17:00 por falla en equipo amplificador
Responsabilidad: DEL OPERADOR (equipamiento de infraestructura)
Respuesta: ACEPTAR + Compensación por 8 horas`,
  },
  {
    servicio: 'INTERNET FIJO',
    codigo: 'ISP-FIJ-002',
    nombre: 'Error en facturación / Cobros injustificados',
    incidencia: '12.5%',
    severidad: 'Media',
    norma: 'Art. 2.1.6, 2.1.12 (CRC 5050)',
    normativa: `El operador debe garantizar facturación correcta y transparencia en cobros.

OBLIGACIONES:
- Facturar únicamente servicios contratados
- Aplicar promociones y descuentos pactados
- Permitir que el usuario verifique su factura online
- No cobrar sin previa notificación de cambios tarifarios
- Máximo de cambio unilateral: 2 veces/año con 30 días de aviso

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si hay error matemático, cobro de servicio no contratado, o no se aplicó descuento
✗ Rechazar: Si el servicio fue contratado/usado y el usuario olvidó`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos detalladamente su reclamo sobre el cobro de $[MONTO] en su factura del período [MES/AÑO].

HALLAZGO:
Encontramos que [DESCRIPCIÓN: p.ej. "se cobró el servicio Premium a $X cuando usted contrataba el plan Básico a $Y" / "no se aplicó el descuento de promoción mencionado en su contrato"].

ACCIÓN TOMADA:
1. Hemos emitido nota crédito por $[MONTO AJUSTE]
2. Este valor será descontado de su próxima factura
3. Se ha verificado que el error no se repita en futuros ciclos

Nuevamente, disculpas por el inconveniente.

Atentamente,
[NOMBRE OPERADOR]
Departamento de Facturación`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su solicitud respecto al cobro de $[MONTO] en su factura [MES/AÑO].

ANÁLISIS:
Según nuestros registros:
- El servicio facturado corresponde al plan [PLAN CONTRATADO] a $[VALOR]
- Este valor coincide con el contrato vigente desde [FECHA]
- No hay promociones o descuentos pendientes de aplicar
- El consumo reportado en su uso real fue de [DATOS]

CONCLUSIÓN:
El cobro es correcto y corresponde a servicios efectivamente contratados y utilizados.

Sin embargo, le ofrecemos revisar su contrato con nuestro departamento comercial si considera que hay error en lo pactado.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]
Departamento de Facturación`,
    guia: `PREGUNTAS CLAVE:
1. ¿Cuál fue el servicio cobrado? ¿Estaba contratado?
2. ¿Se aplicaron descuentos? ¿Constan en contrato?
3. ¿El monto coincide con el plan contratado?
4. ¿Hay error matemático en cálculo de consumo?

DOCUMENTOS A REVISAR:
- Contrato vigente
- Registro de cambios de plan
- Comprobantes de promociones
- Cálculo de consumo del período
- Historial de cobros anteriores

CHECKLIST:
□ Verificado contrato del período
□ Confirmadas promociones y descuentos
□ Revisado cálculo matemático
□ Cotejado con facturas anteriores
□ Explicación clara del por qué sí/no está correcto`,
  },
  {
    servicio: 'INTERNET FIJO',
    codigo: 'ISP-FIJ-003',
    nombre: 'Intermitencia del servicio',
    incidencia: '13%',
    severidad: 'Media',
    norma: 'Art. 5.1.1, 5.1.2 (CRC 5050 - Disponibilidad)',
    normativa: `El operador debe mantener el servicio estable sin desconexiones frecuentes.

OBLIGACIONES:
- Indicador de disponibilidad mínimo: 99.5%
- Registrar e investigar intermitencias
- Ofrecer técnico si es falla de operador

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si registros técnicos muestran caídas frecuentes atribuibles al operador
✗ Rechazar: Si son caídas aisladas o causadas por equipamiento del cliente`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Confirmamos que sus reportes sobre intermitencia en el servicio de internet son válidos.

Nuestros registros técnicos muestran [X DESCONEXIONES] en los últimos [PERÍODO], todas originadas en [CAUSA: falla en línea/equipo en nodo/etc.].

ACCIONES:
1. Técnico especializado visitará su domicilio en [FECHA/HORARIO]
2. Se reemplazará/reparará [COMPONENTE]
3. Se monitoreará su línea por [PERÍODO] para confirmar estabilidad
4. Compensación: $[MONTO] por molestias

Agradecemos paciencia y confirmo disponibilidad técnica.

Atentamente,
[NOMBRE OPERADOR]
Departamento Técnico`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su reporte sobre intermitencia del servicio.

ANÁLISIS TÉCNICO:
- Disponibilidad registrada: 99.7% (superior al mínimo regulado)
- Las desconexiones reportadas son aisladas (1-2 por semana)
- Origen: Compatible con problemas en equipamiento del cliente

RECOMENDACIONES:
1. Verificar cables de conexión
2. Actualizar firmware del router
3. Revisar si hay interferencias (otros aparatos inalámbricos)

Si persiste, podemos agendar diagnóstico técnico.

Derechos: Puede recurrir ante la SIC.

Atentamente,
[NOMBRE OPERADOR]`,
    guia: `VERIFICAR:
1. Frecuencia de desconexiones (logs del operador)
2. Duración de cada caída
3. Hora del día (patrón)
4. Afecta a todos los dispositivos o solo uno

CAUSA PROBABLE:
- Operador: Patrón de caídas, varias en corto tiempo, misma hora
- Cliente: Caídas aisladas, un dispositivo, después de reiniciar router mejora`,
  },
  {
    servicio: 'INTERNET MÓVIL',
    codigo: 'ISP-MOV-001',
    nombre: 'Error en facturación de internet móvil',
    incidencia: '40.8%',
    severidad: 'Media',
    norma: 'Art. 2.1.6 (CRC 5050)',
    normativa: `Similar a fijo, pero aplicado a servicios móviles.

PARTICULARIDADES:
- Cobros de datos no contratados
- Facturación de roaming internacional no autorizado
- Servicios de valor agregado (apps de pago) no autorizados

CRITERIOS:
✓ Acoger: Si hay cobro de servicio no contratado o data/roaming no utilizado
✗ Rechazar: Si el consumo es real y el servicio fue contratado`,
    plantillaSi: `Similar a Internet Fijo - Error facturación, pero reemplazar con:
"Se cobró roaming internacional en [PAÍS] por $[MONTO] aunque su plan no incluye esta cobertura automática"
o
"Se descontaron $[MONTO] por aplicación de pago [NOMBRE] que usted no contrató"`,
    plantillaNo: `Similar a Internet Fijo, con énfasis en:
"Nuestros registros de datos muestran consumo de [X MB] en roaming internacional, lo que justifica el cobro de $[MONTO]"`,
    guia: `PREGUNTAS CLAVE:
1. ¿El cliente tiene roaming activado? ¿Lo contrató?
2. ¿Hay consumo real de datos en los registros?
3. ¿Se notificó sobre cambio de zona de cobertura?
4. ¿El cliente está en un país donde debe activar manualmente?`,
  },
  {
    servicio: 'TELEVISIÓN POR SUSCRIPCIÓN',
    codigo: 'TV-001',
    nombre: 'No disponibilidad del servicio de televisión',
    incidencia: '37.7%',
    severidad: 'Alta',
    norma: 'Art. 5.2.2, 5.2.3, 5.2.4 (CRC 5050 - Calidad TV)',
    normativa: `El operador de televisión debe garantizar disponibilidad y calidad de la señal.

OBLIGACIONES DEL OPERADOR:
- Mantener disponibilidad mínima del 99.5% de los canales
- Notificar interrupciones programadas con 48h de anticipación
- Ofrecer compensación automática por falta de continuidad
- Responder al reclamo en máximo 15 días hábiles
- Mantener documentación de incidencias por 3 períodos

PARTICULARIDADES TV:
- Diferencia entre caída total y pérdida de canales específicos
- Problemas de señal (pixelación, congelamiento)
- Fallas en equipamiento (decodificador, smart TV)
- Diferencia entre problemas de infraestructura del operador vs problemas del cliente

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si caída fue responsabilidad del operador (infraestructura, nodo, servidor), comprobado en logs
✓ Acoger parcial: Si solo algunos canales estuvieron caídos (compensación proporcional)
✗ Rechazar: Si problema está en equipo del cliente (decodificador, cables, TV), sin culpa del operador`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Reconocemos su inconformidad respecto a la falta de disponibilidad del servicio de televisión durante el período [FECHAS], afectando su acceso a los canales contratados.

ANÁLISIS TÉCNICO:
Nuestros registros técnicos muestran que entre las [HORAS], se presentó [DESCRIPCIÓN: falla en nodo distribuidor / corte en línea de transmisión / problema en servidor de contenidos], afectando [CANTIDAD] suscriptores en su zona.

RESPONSABILIDAD:
Esta falla fue ocasionada por [CAUSA: mantenimiento no comunicado / falla en equipamiento / error operacional], siendo responsabilidad del operador.

ACCIONES TOMADAS:
1. Se ha corregido la falla en la infraestructura
2. Se han aplicado créditos automáticos por [X HORAS] de indisponibilidad: $[MONTO]
3. Se ha implementado monitoreo adicional en su nodo durante [PERÍODO]
4. Notificamos al equipo de mantenimiento para evitar recurrencia

COMPENSACIÓN:
Valor del crédito: $[MONTO] (equivalente a [X HORAS] del servicio)
Forma de aplicación: Descuento automático en próxima factura

Agradecemos su paciencia y reiteramos nuestro compromiso con la calidad.

Atentamente,
[NOMBRE OPERADOR]
Departamento de Atención al Usuario - Televisión`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Agradecemos la presentación de su reclamo sobre la falta de disponibilidad del servicio de televisión reportada en las fechas [FECHAS].

ANÁLISIS TÉCNICO:
Realizamos revisión exhaustiva de nuestros sistemas y encontramos lo siguiente:
- En el período reportado, todos los nodos de distribución funcionaban correctamente
- No se registraron caídas de infraestructura en su zona de cobertura
- La señal fue transmitida correctamente hasta el punto de entrada de su domicilio (DSLAM/NAP)

HALLAZGO:
El problema se originó en los equipos terminales de su domicilio, específicamente:
- Falla en el decodificador (revisar conexión o reinicio)
- Problema en cables HDMI/coaxial
- Configuración incorrecta de entrada en TV
- Falla del equipo terminal (más allá de responsabilidad del operador)

CONCLUSIÓN:
El reclamo NO PROCEDE porque la indisponibilidad fue causada por equipamiento en su poder, no por falla en la infraestructura del operador.

RECOMENDACIONES:
1. Verificar conexión física de cables
2. Reiniciar el decodificador (apagar 30 segundos, encender)
3. Verificar que la TV esté en la entrada correcta (HDMI/AV)
4. Si persiste, contáctenos para diagnóstico técnico presencial

DERECHOS DEL USUARIO:
Si considera que esta decisión es injusta, puede presentar recurso de reposición ante nuestro departamento de atención en los 10 días hábiles posteriores. Si insistimos en el rechazo, puede recurrir ante la Superintendencia de Industria y Comercio (SIC).

Atentamente,
[NOMBRE OPERADOR]
Departamento Técnico - Televisión`,
    guia: `PREGUNTAS CLAVE ANTES DE RESPONDER:
1. ¿En qué fecha/hora exacta se reportó la falla?
2. ¿Afectó a 1 canal, varios canales o TODOS?
3. ¿Se registra caída en los logs del operador (infraestructura)?
4. ¿Fue interrupción programada? ¿Se notificó con 48h?
5. ¿El cliente reportó si otros canales funcionaban?
6. ¿Cuál es el tipo de tecnología (Cable HFC, IPTV, Satélite)?

DOCUMENTOS A REVISAR:
- Logs de disponibilidad del nodo/DSLAM/servidor
- Reportes de incidentes de infraestructura en la fecha
- Registros de mantenimiento programado
- Notificaciones enviadas al cliente
- Historial técnico de la línea del cliente
- Estado del decodificador (último reinicio, errores)

CAUSAS OPERADOR (ACOGER):
✓ Caída de nodo distribuidor
✓ Falla en línea de transmisión
✓ Problema en servidor de contenidos
✓ Falla en DSLAM (para IPTV)
✓ Corte de energía en infraestructura (sin backup)
✓ Ataque DDoS o problema de seguridad

CAUSAS CLIENTE (RECHAZAR):
✗ Decodificador sin energía/desconectado
✗ Cables desconectados o dañados
✗ TV en entrada incorrecta (no HDMI/AV)
✗ Decodificador sin señal de entrada (problema en "último metro")
✗ Falta de pago (servicio suspendido)
✗ Contratación de pack incorrecto (no incluye ese canal)

ERRORES COMUNES:
❌ NO asumir culpa sin revisar logs de infraestructura
❌ NO confundir "problema en equipamiento cliente" con "falla del operador"
❌ NO ofrecer compensación sin verificar si fue interrupción programada
❌ Ignorar si solo algunos canales estuvieron caídos (compensación debe ser proporcional)
❌ NO mencionar SIC y derechos del usuario = ERROR GRAVE

CHECKLIST ANTES DE ENVIAR:
□ Verificado período exacto de la caída
□ Consultados logs técnicos (nodo, DSLAM, servidor)
□ Identificado si fue problema de infraestructura o equipamiento
□ Confirmado si fue interrupción programada (si sí = sin culpa)
□ Calculada compensación si aplica (horas de caída × tarifa diaria ÷ 24)
□ Revisado si es falla recurrente (si sí, mencionar monitoreo adicional)
□ Confirmado cumplimiento de plazo (15 días hábiles)
□ Incluido derechos a recurrir ante SIC

CASO PRÁCTICO:
Cliente: María Gómez
Reclamo: "El 20 de febrero entre 14:00-17:00 no tuve televisión"
Verificación:
  - Logs muestran caída en nodo distribuidor 14:15-16:45
  - Causada por falla en equipo amplificador
  - Afectó 847 suscriptores en zona
  - Interrupción no fue programada
Compensación: 2.67 horas × (tarifa mensual ÷ 720 horas)
Respuesta: ACOGER + Crédito automático`,
  },
  {
    servicio: 'TELEVISIÓN POR SUSCRIPCIÓN',
    codigo: 'TV-002',
    nombre: 'Error en facturación / Cobros injustificados',
    incidencia: '14.3%',
    severidad: 'Media',
    norma: 'Art. 2.1.6, 2.1.12 (CRC 5050)',
    normativa: `El operador de TV debe facturar correctamente según contrato.

OBLIGACIONES:
- Facturar solo canales contratados
- Aplicar promociones y descuentos según acuerdos
- Notificar cambios de tarifa con 30 días de anticipación
- Permitir acceso a factura online detallada

PARTICULARIDADES TV:
- Cobro de canales premium no contratados
- No aplicación de promoción "primeros 3 meses"
- Aumento tarifario sin notificación previo
- Retención de depósito sin justificación
- Cobro por servicio después de cancelación

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si hay cobro de canal no contratado, error matemático, o no se aplicó promoción válida
✗ Rechazar: Si cliente pidió canal premium, se prestó servicio, pero olvidó la contratación`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos su reclamo sobre el cobro de $[MONTO] en su factura del período [MES/AÑO].

HALLAZGO:
Encontramos que [DESCRIPCIÓN: se cobró canal HBO por $[X] cuando su contrato solo incluye paquete básico / se facturó el servicio después de su cancelación / no se aplicó promoción de 3 meses gratis].

ANÁLISIS DE CONTRATO:
Según el contrato vigente desde [FECHA], su plan incluye [CANALES], sin incluir [CANAL COBRADO].

ACCIÓN TOMADA:
1. Se ha emitido nota crédito por $[MONTO]
2. El crédito será descontado en su próxima factura
3. Se ha verificado que su siguiente factura sea correcta

Disculpas por el inconveniente.

Atentamente,
[NOMBRE OPERADOR]
Departamento de Facturación`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su solicitud sobre el cobro de $[MONTO] en su factura [MES/AÑO].

ANÁLISIS:
- Contrato vigente: [Tipo de paquete] por $[VALOR]
- Servicios contratados: [Lista de canales]
- Servicios facturados: [Misma lista]
- Promociones aplicadas: [Lista]
- Cálculo de consumo: Correcto

CONCLUSIÓN:
El cobro es correcto y corresponde a servicios efectivamente contratados y utilizados durante el período.

Si considera que hay error en lo pactado, podemos revisar su contrato con nuestro departamento comercial.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]
Departamento de Facturación`,
    guia: `PREGUNTAS CLAVE:
1. ¿Cuál es el paquete contratado exactamente?
2. ¿Cuál fue el servicio cobrado? ¿Estaba en el contrato?
3. ¿Se aplicaron promociones? ¿Constan en contrato vigente?
4. ¿El monto coincide con lo pactado?
5. ¿Hay cambio de paquete? ¿Fue autorizado por cliente?

DOCUMENTOS A REVISAR:
- Contrato vigente (producto, canales, valor)
- Comprobantes de promociones
- Registro de cambios de plan
- Historial de cobros anteriores
- Email de confirmación de cambios

CHECKLIST:
□ Verificado contrato del período
□ Confirmadas promociones vigentes
□ Revisado si hay cambio de paquete autorizado
□ Explicación clara del por qué sí/no es correcto`,
  },
  {
    servicio: 'TELEVISIÓN POR SUSCRIPCIÓN',
    codigo: 'TV-003',
    nombre: 'Intermitencia y mala calidad de la señal',
    incidencia: '~8-10%',
    severidad: 'Media',
    norma: 'Art. 5.2.3 (CRC 5050 - Parámetros de calidad)',
    normativa: `El operador debe garantizar calidad de imagen y sonido sin interferencias.

OBLIGACIONES:
- Mantener señal estable sin pixelación/congelamiento
- Parámetros técnicos mínimos según tecnología (Cable HFC, IPTV, Satélite)
- Investigar y corregir intermitencias recurrentes

PARTICULARIDADES:
- No es lo mismo "caída total" que "mala calidad"
- Pixelación puede ser por infraestructura o equipamiento cliente
- Congelamiento en IPTV puede ser por ancho de banda/router

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si logs técnicos muestran parámetros fuera de norma en infraestructura del operador
✗ Rechazar: Si señal es normal en entrada, problema está en equipamiento cliente`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Confirmamos su reporte sobre intermitencia/mala calidad en la señal de televisión.

HALLAZGO TÉCNICO:
Nuestras mediciones registran:
- Nivel de señal fuera de rango especificado
- Interferencias en [FRECUENCIA/CANAL]
- Problema originado en [UBICACIÓN DE INFRAESTRUCTURA]

ACCIONES:
1. Técnico visitará domicilio en [FECHA/HORARIO] para verificación
2. Se optimizará señal en nodo distribuidor
3. Se reemplazará equipamiento defectuoso si es necesario
4. Monitoreo especial por [PERÍODO]

Agradecemos paciencia.

Atentamente,
[NOMBRE OPERADOR]
Departamento Técnico`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su reporte sobre intermitencia en la señal de televisión.

HALLAZGO TÉCNICO:
- Mediciones de infraestructura: DENTRO DE RANGO NORMAL
- Señal en punto de entrada: [X dBmV] (correcto)
- Análisis de decodificador: Parámetros aceptables

CAUSA PROBABLE:
El problema está en los equipos de su domicilio:
- Cables dañados o mal conectados
- Divisores de señal defectuosos
- Router interfiriendo (si es IPTV)
- Decodificador con firmware desactualizado

RECOMENDACIONES:
1. Verificar cables coaxial/HDMI
2. Revisar conexiones
3. Si es IPTV, revisar posición del router (alejado de TV)
4. Actualizar decodificador

Contáctenos si persiste para diagnóstico presencial.

Derechos: Puede recurrir ante SIC.

Atentamente,
[NOMBRE OPERADOR]`,
    guia: `PREGUNTAS CLAVE:
1. ¿Intermitencia es constante o esporádica?
2. ¿Afecta a 1 canal o TODOS?
3. ¿Persiste después de reiniciar decodificador?
4. ¿Se presenta en horas específicas?
5. ¿Qué tecnología usa: Cable HFC, IPTV, Satélite?

DOCUMENTOS A REVISAR:
- Logs técnicos de nivel de señal (dBmV)
- Reporte de interferencias
- Historial de errores del decodificador
- Parámetros especificados según tecnología

DIFERENCIACIÓN TÉCNICA:
Cable HFC: Pixelación = signal dropout o interferencia en HFC
IPTV: Congelamiento = saturación de ancho de banda o problema router
Satélite: Mala calidad = interferencia o lluvia (factores externos)`,
  },
]
