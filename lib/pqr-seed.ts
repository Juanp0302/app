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

  // ─────────────────────────────────────────────────────────────
  // CONTRATO Y ASPECTOS GENERALES
  // Verificado contra Título II, Capítulo 1 (Resolución CRC 5050 de 2016,
  // modificada por Resolución CRC 5111 de 2017 -que extendió el Régimen de
  // Protección a los operadores de TV cerrada- y normas posteriores).
  // Aplica a Internet fijo, Internet móvil, telefonía y TV por suscripción,
  // salvo que se indique lo contrario.
  // ─────────────────────────────────────────────────────────────
  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-001',
    nombre: 'Cambio o elección del plan de servicios (Libre Elección)',
    incidencia: 'N/D',
    severidad: 'Media',
    norma: 'Art. 2.1.1.2, num. 2.1.1.2.2 (CRC 5050)',
    normativa: `El Principio de Libre Elección establece que es el usuario, única y exclusivamente, quien debe elegir el operador, los planes, los servicios y los equipos utilizados para acceder al servicio.

OBLIGACIONES:
- El operador no puede presumir la voluntad o el consentimiento del usuario para cambiar de plan o de servicio
- Todo cambio de plan requiere solicitud o aceptación expresa e informada del usuario
- El operador debe conservar evidencia de la solicitud/aceptación (Art. 28 Ley 962 de 2005)

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si el operador cambió el plan/servicio sin solicitud o aceptación expresa y verificable del usuario
✗ Rechazar: Si existe evidencia de la solicitud o aceptación del usuario (grabación, firma, clic de aceptación, correo, SMS)`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos su reclamo sobre el cambio del plan [PLAN ANTERIOR] al plan [PLAN ACTUAL] sin su autorización.

HALLAZGO:
Verificamos nuestros registros y no encontramos evidencia de una solicitud o aceptación expresa de su parte para este cambio, tal como lo exige el Principio de Libre Elección (Art. 2.1.1.2.2 del Régimen de Protección).

ACCIÓN TOMADA:
1. Se ha reversado el cambio de plan a partir de [FECHA]
2. Se ha reliquidado la diferencia facturada por $[MONTO], que será acreditada en su próxima factura
3. Se han tomado medidas correctivas frente al canal que originó el cambio

Lamentamos el inconveniente ocasionado.

Atentamente,
[NOMBRE OPERADOR]
Departamento de Atención al Usuario`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su reclamo sobre el cambio del plan [PLAN ANTERIOR] al plan [PLAN ACTUAL].

HALLAZGO:
Nuestros registros muestran que usted solicitó y aceptó este cambio el [FECHA], a través de [CANAL: línea telefónica grabada/página web/app/firma física], quedando la evidencia archivada bajo el radicado [REFERENCIA].

CONCLUSIÓN:
El cambio de plan corresponde a una solicitud válida realizada por usted, por lo que el reclamo NO PROCEDE.

Derechos: Puede recurrir ante la Superintendencia de Industria y Comercio (SIC) en los 10 días hábiles posteriores a esta respuesta.

Atentamente,
[NOMBRE OPERADOR]
Departamento de Atención al Usuario`,
    guia: `PREGUNTAS CLAVE:
1. ¿Existe grabación, firma o registro digital de la solicitud/aceptación del cambio?
2. ¿Quién inició el cambio: el usuario, un asesor comercial, o un proceso automático de "upgrade"?
3. ¿El usuario fue informado previamente de las condiciones del nuevo plan?

DOCUMENTOS A REVISAR:
- Grabación de llamada o ticket de solicitud
- Historial de cambios de plan en el sistema comercial
- Comunicaciones enviadas al usuario informando el cambio

ERRORES COMUNES:
❌ Asumir que "el usuario usó el servicio" equivale a que lo aceptó
❌ No reversar la diferencia facturada al acoger el reclamo
❌ Confundir una recomendación comercial con una aceptación válida`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-002',
    nombre: 'Cobro de servicios no contratados o no autorizados',
    incidencia: 'N/D',
    severidad: 'Alta',
    norma: 'Art. 2.1.2.1, num. 2.1.2.1.2 (CRC 5050)',
    normativa: `El operador no puede cobrar al usuario servicios no prestados, ni tarifas o conceptos diferentes a los informados y aceptados previamente por este en las condiciones del contrato.

OBLIGACIONES:
- Facturar únicamente lo efectivamente contratado y aceptado
- Demostrar el origen del cobro cuando el usuario lo controvierta
- Reversar de forma inmediata cualquier cobro no autorizado que se compruebe

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si el operador no demuestra la contratación o autorización expresa del servicio cobrado
✗ Rechazar: Si existe contrato, adenda o autorización expresa (ej. suscripción a un servicio de valor agregado) que respalde el cobro`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos el cobro de $[MONTO] por el concepto [SERVICIO/PRODUCTO] en su factura de [MES/AÑO].

HALLAZGO:
No encontramos evidencia de contratación o autorización expresa de este servicio por su parte.

ACCIÓN TOMADA:
1. Se ha desactivado el servicio no autorizado
2. Se ha emitido nota crédito por $[MONTO]
3. El valor será descontado en su próxima factura

Atentamente,
[NOMBRE OPERADOR]
Departamento de Facturación`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos el cobro de $[MONTO] por el concepto [SERVICIO/PRODUCTO] en su factura de [MES/AÑO].

HALLAZGO:
Nuestros registros muestran la autorización de este servicio el [FECHA] mediante [CANAL/MEDIO DE AUTORIZACIÓN], radicado [REFERENCIA].

CONCLUSIÓN:
El cobro corresponde a un servicio efectivamente contratado, por lo que el reclamo NO PROCEDE.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]
Departamento de Facturación`,
    guia: `PREGUNTAS CLAVE:
1. ¿El servicio cobrado aparece en el contrato vigente o en una adenda posterior?
2. ¿Hay evidencia de autorización expresa (SMS de confirmación, clic de aceptación, grabación)?
3. ¿Es un servicio de terceros (aplicaciones de pago, contenidos) que requiere doble confirmación?

DOCUMENTOS A REVISAR:
- Contrato y adendas
- Registro de autorización del servicio específico
- Historial de facturación del concepto reclamado

ERRORES COMUNES:
❌ Justificar el cobro solo porque "el sistema lo activó automáticamente"
❌ No revisar si el servicio proviene de un tercero que exige autorización propia`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-003',
    nombre: 'Incremento en las tarifas de los servicios',
    incidencia: 'N/D',
    severidad: 'Media',
    norma: 'Art. 2.1.10.2 (CRC 5050); Art. 23 Ley 1341 de 2009, mod. Ley 1978 de 2019',
    normativa: `El contrato debe indicar claramente las tarifas y la forma en que estas se modificarán, incluyendo los incrementos tarifarios máximos anuales y los períodos de facturación.

OBLIGACIONES:
- Informar el incremento por el mismo medio de la factura, con mínimo 5 días hábiles de anticipación a la finalización del período de facturación en curso
- Permitir al usuario terminar el contrato sin cláusula de permanencia si el incremento no se ajusta a lo pactado
- Cualquier incremento fuera de lo pactado, sin autorización del usuario, libera al usuario de la cláusula de permanencia mínima
- Los operadores fijan libremente sus precios (Art. 23 Ley 1341/2009 mod. Ley 1978/2019); la CRC solo regula precios ante falla de mercado o incumplimiento de calidad

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si el incremento no fue notificado con la anticipación debida, o excede lo pactado en el contrato
✗ Rechazar: Si el incremento fue notificado oportunamente y está dentro de los topes contractuales`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos su reclamo sobre el incremento de $[MONTO ANTERIOR] a $[MONTO NUEVO] en su factura de [MES/AÑO].

HALLAZGO:
Confirmamos que el incremento no fue notificado con la anticipación mínima de 5 días hábiles exigida (Art. 2.1.10.2), o que excede los topes pactados en su contrato.

ACCIÓN TOMADA:
1. Se ha revertido la tarifa a $[MONTO ANTERIOR] para el período reclamado
2. Se ha emitido nota crédito por la diferencia de $[MONTO]
3. Si desea terminar el contrato por este motivo, queda liberado de la cláusula de permanencia mínima

Atentamente,
[NOMBRE OPERADOR]
Departamento de Facturación`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su reclamo sobre el incremento tarifario en su factura de [MES/AÑO].

HALLAZGO:
El incremento fue notificado el [FECHA] a través de [MEDIO], con [X] días hábiles de anticipación al cierre del período de facturación, dentro de los topes máximos informados en su contrato desde [FECHA CONTRATO].

CONCLUSIÓN:
El incremento se ajusta a lo pactado y notificado oportunamente, por lo que el reclamo NO PROCEDE.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]`,
    guia: `PREGUNTAS CLAVE:
1. ¿Con cuántos días de anticipación se notificó el incremento?
2. ¿El incremento está dentro de los topes máximos anuales pactados en el contrato?
3. ¿Se notificó por el mismo canal por el que el usuario recibe su factura?

DOCUMENTOS A REVISAR:
- Contrato (cláusula de tarifas y topes de incremento)
- Comprobante de envío de la notificación de incremento
- Historial de facturación

ERRORES COMUNES:
❌ Notificar el incremento por un canal distinto al de la factura sin haberlo acordado
❌ Aplicar el incremento sin verificar los topes pactados en el contrato específico del usuario`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-004',
    nombre: 'Incumplimiento de promociones u ofertas',
    incidencia: 'N/D',
    severidad: 'Media',
    norma: 'Art. 2.1.6.1 (CRC 5050)',
    normativa: `Los operadores están obligados a cumplir las condiciones de las promociones y ofertas informadas al usuario a través de cualquiera de los medios de atención.

OBLIGACIONES:
- Informar las condiciones y restricciones de la promoción antes de que el usuario la acepte
- Mantener esa información disponible para consulta del usuario por al menos 6 meses
- Aplicar la promoción tal como fue ofrecida, sin condiciones adicionales no informadas

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si la promoción no se aplicó, se aplicó parcialmente, o se agregaron condiciones no informadas al momento de la oferta
✗ Rechazar: Si la promoción fue aplicada correctamente según las condiciones informadas y aceptadas, o si el usuario incumplió una condición explícita (ej. permanencia mínima de la promoción)`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos su reclamo sobre la promoción [NOMBRE/DESCRIPCIÓN PROMOCIÓN] no aplicada en su factura de [MES/AÑO].

HALLAZGO:
Confirmamos que usted contrató bajo las condiciones de dicha promoción el [FECHA], y que esta no fue reflejada correctamente en su facturación.

ACCIÓN TOMADA:
1. Se ha aplicado la promoción correspondiente a partir del período [PERÍODO]
2. Se ha emitido nota crédito por $[MONTO] por los períodos afectados
3. Se ha verificado que la promoción se mantenga por el tiempo pactado

Atentamente,
[NOMBRE OPERADOR]
Departamento Comercial`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su reclamo sobre la promoción [NOMBRE/DESCRIPCIÓN PROMOCIÓN].

HALLAZGO:
Las condiciones informadas y aceptadas el [FECHA] establecían [CONDICIÓN/RESTRICCIÓN: ej. vigencia de 3 meses, permanencia mínima de 12 meses]. Su caso no cumple dicha condición porque [MOTIVO].

CONCLUSIÓN:
La promoción fue aplicada conforme a las condiciones informadas, por lo que el reclamo NO PROCEDE.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]
Departamento Comercial`,
    guia: `PREGUNTAS CLAVE:
1. ¿Cuáles eran las condiciones exactas de la promoción informadas al usuario?
2. ¿Existe registro de aceptación de dichas condiciones?
3. ¿La promoción sigue vigente (dentro de los 6 meses de disponibilidad de consulta)?

DOCUMENTOS A REVISAR:
- Pieza publicitaria o script comercial de la promoción
- Registro de aceptación del usuario
- Historial de facturación del período promocional

ERRORES COMUNES:
❌ Aplicar restricciones que no fueron informadas al momento de la oferta
❌ No conservar evidencia de las condiciones promocionales por el término mínimo exigido (6 meses)`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-005',
    nombre: 'Pago oportuno y suspensión del servicio por no pago',
    incidencia: 'N/D',
    severidad: 'Media',
    norma: 'Título II, Cap. 1 (Régimen de Protección — CRC 5050)',
    normativa: `El usuario está obligado a pagar su factura como máximo hasta la fecha de pago oportuno indicada en ella.

OBLIGACIONES:
- Si el usuario no paga oportunamente, el operador puede suspender el servicio, pero debe suspender también la facturación del mismo
- El operador debe reactivar el servicio dentro de los 3 días hábiles siguientes al pago de los saldos pendientes
- Si existe cláusula de permanencia mínima vigente durante la suspensión, solo se pueden cobrar los valores asociados a dicha cláusula
- No recibir la factura no libera al usuario de su obligación de pago; puede solicitarla por la línea de atención

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si se facturó el servicio durante el período de suspensión, o si no se reactivó dentro de los 3 días hábiles tras el pago
✗ Rechazar: Si la suspensión y reactivación se ajustaron a estos plazos y no hubo facturación indebida durante la suspensión`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos su reclamo sobre [la facturación durante la suspensión / la demora en la reactivación] de su servicio.

HALLAZGO:
Confirmamos que [se facturó indebidamente el servicio durante la suspensión / la reactivación tomó [X] días hábiles, superando el plazo máximo de 3 días hábiles].

ACCIÓN TOMADA:
1. Se ha emitido nota crédito por $[MONTO] correspondiente al período indebidamente facturado
2. Se ha reactivado el servicio de forma inmediata
3. Se han tomado medidas para evitar la recurrencia

Atentamente,
[NOMBRE OPERADOR]
Departamento de Cartera`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su reclamo sobre la suspensión de su servicio por falta de pago.

HALLAZGO:
Su factura con fecha de pago oportuno [FECHA] no fue cancelada dentro del plazo. El servicio fue suspendido el [FECHA] y reactivado el [FECHA], dentro del plazo de 3 días hábiles siguientes al pago registrado el [FECHA]. No se facturó el servicio durante la suspensión.

CONCLUSIÓN:
La suspensión y reactivación se ajustaron a la normativa vigente, por lo que el reclamo NO PROCEDE.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]
Departamento de Cartera`,
    guia: `PREGUNTAS CLAVE:
1. ¿Cuál fue la fecha de pago oportuno y la fecha real de pago?
2. ¿Se facturó el servicio durante el período de suspensión?
3. ¿Cuántos días hábiles transcurrieron entre el pago y la reactivación?
4. ¿Existe cláusula de permanencia mínima vigente que deba respetarse durante la suspensión?

DOCUMENTOS A REVISAR:
- Historial de pagos y fechas de pago oportuno
- Registro de suspensión y reactivación del servicio
- Facturación del período suspendido

ERRORES COMUNES:
❌ Facturar el servicio pleno durante un período de suspensión
❌ Superar el plazo de 3 días hábiles para reactivar tras el pago`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-006',
    nombre: 'Restricciones no permitidas en planes ilimitados (voz e Internet)',
    incidencia: 'N/D',
    severidad: 'Media',
    norma: 'Art. 2.1.3.5; Art. 2.1.2.2.2 (CRC 5050)',
    normativa: `Los planes de acceso a Internet promocionados, ofrecidos o estipulados como "ilimitados" no pueden tener restricciones distintas a las propias de la tecnología empleada y a la velocidad efectiva ofrecida. Los planes de voz "ilimitados" no pueden restringir la cantidad de destinos.

OBLIGACIONES:
- No imponer topes de consumo, cortes de velocidad severos ("fair use") no informados, ni bloqueo de destinos en planes catalogados como ilimitados
- El usuario debe cumplir los términos y condiciones pactados sobre el uso del servicio, incluso en planes ilimitados (deber del usuario)

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si se restringió el consumo, la velocidad o los destinos de un plan ofrecido como ilimitado, sin que la restricción corresponda a una limitación tecnológica informada
✗ Rechazar: Si la restricción reclamada corresponde a un uso que incumple los términos y condiciones pactados (ej. uso comercial de un plan personal, reventa del servicio)`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos su reclamo sobre la restricción aplicada a su plan ilimitado de [Voz/Internet].

HALLAZGO:
Confirmamos que se aplicó [reducción de velocidad / bloqueo de destinos / tope de consumo] que no corresponde a una limitación tecnológica del servicio contratado.

ACCIÓN TOMADA:
1. Se ha removido la restricción aplicada a su línea/plan
2. Se ha verificado el correcto funcionamiento del plan ilimitado
3. Se ha aplicado compensación de $[MONTO] por el período afectado, si aplica

Atentamente,
[NOMBRE OPERADOR]
Departamento Técnico`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su reclamo sobre la restricción aplicada a su plan ilimitado.

HALLAZGO:
La limitación observada corresponde a [la tecnología empleada (ej. velocidad efectiva contratada) / un uso que incumple los términos y condiciones pactados, específicamente: DESCRIPCIÓN].

CONCLUSIÓN:
La restricción reclamada no contraviene la categoría de "ilimitado" definida en la regulación, por lo que el reclamo NO PROCEDE.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]`,
    guia: `PREGUNTAS CLAVE:
1. ¿La restricción es de velocidad, consumo de datos o cantidad de destinos?
2. ¿Corresponde a una limitación tecnológica informada al contratar, o es una política interna no informada?
3. ¿El uso del usuario incumple los términos y condiciones (uso comercial no autorizado, tethering masivo, etc.)?

DOCUMENTOS A REVISAR:
- Ficha técnica del plan contratado
- Términos y condiciones aceptados
- Logs de uso/consumo del usuario

ERRORES COMUNES:
❌ Aplicar "fair use" no informado a un plan promocionado como ilimitado
❌ Confundir una limitación tecnológica legítima con una restricción comercial no autorizada`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-007',
    nombre: 'Posible fraude en la contratación de servicios',
    incidencia: 'N/D',
    severidad: 'Alta',
    norma: 'Art. 2.1.10.7 (CRC 5050)',
    normativa: `Los operadores deben usar herramientas tecnológicas apropiadas para prevenir fraudes y hacer seguimiento periódico de los mecanismos adoptados en sus redes. Ante conductas que puedan considerarse delictivas, deben ponerlas en conocimiento de las autoridades competentes.

OBLIGACIONES:
- Investigar las causas cuando el usuario presente una PQR relacionada con presunto fraude
- Si se determina que no existe fraude, demostrar al usuario las razones por las cuales no procede su PQR
- Si el usuario actuó diligentemente en el uso del servicio, no habrá lugar al cobro de los consumos reclamados

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si el usuario actuó diligentemente y el operador no demuestra lo contrario, o si se confirma que el fraude no le es imputable al usuario
✗ Rechazar: Si el operador demuestra negligencia del usuario (ej. entrega de claves/OTP a terceros) o ausencia de fraude`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Investigamos su reporte sobre un posible fraude relacionado con [DESCRIPCIÓN: contratación no reconocida/consumo no reconocido].

HALLAZGO:
Nuestra investigación no encontró evidencia de negligencia de su parte, y sí indicios de una conducta fraudulenta ajena a su voluntad.

ACCIÓN TOMADA:
1. Se ha reversado el cobro/contrato objeto del fraude por $[MONTO]
2. Se ha puesto en conocimiento de las autoridades competentes, según corresponda
3. Se han reforzado los controles de seguridad en su cuenta

Atentamente,
[NOMBRE OPERADOR]
Departamento de Seguridad y Fraude`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Investigamos su reporte sobre un posible fraude relacionado con [DESCRIPCIÓN].

HALLAZGO:
Nuestra investigación (radicado [REFERENCIA]) no encontró evidencia de una conducta fraudulenta imputable al operador. [DETALLE: la solicitud fue autenticada con sus credenciales / OTP enviado a su número registrado y utilizado].

CONCLUSIÓN:
No se acredita fraude ajeno a su gestión, por lo que el reclamo NO PROCEDE.

Le recomendamos denunciar ante las autoridades competentes si considera que fue víctima de un tercero.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]
Departamento de Seguridad y Fraude`,
    guia: `PREGUNTAS CLAVE:
1. ¿Qué mecanismo de autenticación se usó en la operación reclamada (OTP, biometría, clave, presencial)?
2. ¿Hay indicios de suplantación o de que el usuario compartió sus credenciales?
3. ¿Se investigaron los logs técnicos y el canal de contratación?

DOCUMENTOS A REVISAR:
- Logs de autenticación de la transacción
- Grabaciones del canal de contratación
- Reportes de seguridad/fraude interno

ERRORES COMUNES:
❌ Cerrar el caso sin investigar, asumiendo automáticamente responsabilidad del usuario
❌ No poner en conocimiento de las autoridades un patrón de fraude detectado`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-008',
    nombre: 'Reporte injustificado en centrales de riesgo',
    incidencia: 'N/D',
    severidad: 'Alta',
    norma: 'Título II, Cap. 1 (CRC 5050); Decreto 2952 de 2010',
    normativa: `La información reportada por el operador a centrales de riesgo debe ser verdadera, comprobable, actualizada, completa y exacta.

OBLIGACIONES:
- Avisar al usuario con 20 días calendario de anticipación antes de reportarlo, para que pague o controvierta el supuesto incumplimiento
- Si el usuario solicita rectificación o niega la relación contractual, informar a la central de riesgos dentro de los 2 días hábiles siguientes que la información está "en discusión"
- Actualizar el reporte a más tardar dentro del mes siguiente al pago
- Respetar los términos de permanencia del reporte negativo: máximo el doble de la mora si esta es inferior a 2 años; 4 años en los demás casos (Decreto 2952 de 2010)

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si no se avisó con 20 días de anticipación, si no se actualizó el reporte tras el pago, o si el término de permanencia excede lo permitido
✗ Rechazar: Si se cumplieron los avisos y plazos y el reporte corresponde a una mora real y vigente`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos su reclamo sobre el reporte negativo en centrales de riesgo por $[MONTO].

HALLAZGO:
Confirmamos que [no se le avisó con 20 días calendario de anticipación / el reporte no fue actualizado tras su pago del [FECHA] / el término de permanencia excede lo permitido por el Decreto 2952 de 2010].

ACCIÓN TOMADA:
1. Se ha solicitado a la central de riesgos la actualización/retiro del reporte
2. Este trámite se realizará dentro del mes siguiente a esta respuesta
3. Le informaremos por escrito una vez confirmada la actualización

Atentamente,
[NOMBRE OPERADOR]
Departamento de Cartera`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su reclamo sobre el reporte negativo en centrales de riesgo.

HALLAZGO:
Se le notificó el aviso previo el [FECHA], con 20 días calendario de anticipación al reporte efectuado el [FECHA]. La mora reportada corresponde a la suma de $[MONTO], vigente y no cancelada a la fecha.

CONCLUSIÓN:
El reporte se ajustó a los requisitos legales, por lo que el reclamo NO PROCEDE.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]
Departamento de Cartera`,
    guia: `PREGUNTAS CLAVE:
1. ¿Se envió el aviso previo con 20 días calendario de anticipación? ¿Por qué canal?
2. ¿El usuario pagó y el reporte fue actualizado dentro del mes siguiente?
3. ¿Cuánto tiempo lleva el reporte vigente frente al término máximo de permanencia?

DOCUMENTOS A REVISAR:
- Comprobante de envío del aviso previo
- Historial de pagos
- Fecha de reporte y de actualización ante la central de riesgos

ERRORES COMUNES:
❌ Reportar sin el aviso previo de 20 días calendario
❌ No actualizar el reporte dentro del mes siguiente al pago
❌ Dejar vigente un reporte más allá del término máximo de permanencia`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-009',
    nombre: 'Retraso en el inicio de la prestación del servicio contratado',
    incidencia: 'N/D',
    severidad: 'Media',
    norma: 'Art. 2.1.10.1 (CRC 5050)',
    normativa: `Una vez contratado un servicio, el operador tiene 15 días hábiles para iniciar su prestación, salvo fuerza mayor, caso fortuito, o causas imputables al usuario. Este plazo puede modificarse por acuerdo entre las partes, en documento separado del contrato.

OBLIGACIONES:
- Iniciar la prestación dentro de los 15 días hábiles pactados
- Si no se cumple el plazo, el usuario puede terminar el contrato y exigir la devolución del dinero pagado

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si el operador excedió el plazo de 15 días hábiles (o el pactado) sin causa justificada
✗ Rechazar: Si el retraso se debió a fuerza mayor, caso fortuito, o a causas imputables al usuario (ej. no permitir el acceso para la instalación)`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos su reclamo por el retraso en la instalación de su servicio, contratado el [FECHA CONTRATACIÓN].

HALLAZGO:
Confirmamos que a la fecha de su reclamo habían transcurrido [X] días hábiles sin causa justificada que exceda el plazo máximo de 15 días hábiles.

ACCIÓN TOMADA:
1. Se ha priorizado la instalación para el [FECHA/HORARIO]
2. Si usted prefiere terminar el contrato, procederemos a la devolución de $[MONTO] pagado, dentro de los 5 días hábiles siguientes
3. Ofrecemos [COMPENSACIÓN ADICIONAL] por la demora

Atentamente,
[NOMBRE OPERADOR]
Departamento de Instalaciones`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su reclamo por el retraso en la instalación de su servicio.

HALLAZGO:
El retraso se debió a [CAUSA: usted no permitió el acceso al domicilio en las visitas programadas del [FECHAS] / fuerza mayor: DESCRIPCIÓN], ajena a nuestra responsabilidad.

CONCLUSIÓN:
El plazo de 15 días hábiles no aplica o se justifica por la causal descrita, por lo que el reclamo NO PROCEDE. Reprogramaremos la instalación con gusto.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]
Departamento de Instalaciones`,
    guia: `PREGUNTAS CLAVE:
1. ¿Cuántos días hábiles han transcurrido desde la contratación?
2. ¿Hubo un acuerdo escrito modificando el plazo de 15 días hábiles?
3. ¿El retraso es atribuible al operador o al usuario (falta de acceso, información errada)?

DOCUMENTOS A REVISAR:
- Fecha de contratación y de las visitas técnicas programadas
- Registro de intentos de instalación
- Documento de modificación del plazo, si existe

ERRORES COMUNES:
❌ No ofrecer la devolución del dinero cuando el usuario prefiere terminar el contrato por el retraso
❌ Atribuir el retraso al usuario sin evidencia de los intentos de instalación`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-010',
    nombre: 'Traslado de servicios por cambio de domicilio',
    incidencia: 'N/D',
    severidad: 'Media',
    norma: 'Art. 2.1.10.12 (CRC 5050)',
    normativa: `Cuando el usuario cambia de domicilio y, por razones técnicas o falta de cobertura, el operador no puede seguir prestando el servicio en el nuevo lugar, procede la terminación del contrato sin cobro de cláusula de permanencia mínima, salvo que el usuario decida ceder su contrato a un tercero.

OBLIGACIONES:
- Evaluar la disponibilidad técnica en el nuevo domicilio ante la solicitud de traslado
- Si no hay cobertura, terminar el contrato sin cobrar la cláusula de permanencia mínima
- Si hay cobertura y el usuario decide no trasladarse, puede exigirse el pago de la cláusula de permanencia o continuar el contrato

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si se cobró la cláusula de permanencia mínima pese a no existir cobertura técnica en el nuevo domicilio
✗ Rechazar: Si existía cobertura técnica y el usuario decidió no trasladar el servicio, o no solicitó formalmente el traslado`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos su solicitud de traslado del servicio al nuevo domicilio en [DIRECCIÓN].

HALLAZGO:
Confirmamos que no contamos con cobertura técnica en la nueva dirección informada.

ACCIÓN TOMADA:
1. Se procede a la terminación del contrato sin cobro de cláusula de permanencia mínima
2. [Si aplica] Se le informa la posibilidad de ceder el contrato a un tercero en el domicilio actual
3. Se generará el paz y salvo correspondiente

Atentamente,
[NOMBRE OPERADOR]
Departamento Comercial`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su solicitud/reclamo relacionado con el traslado del servicio por cambio de domicilio.

HALLAZGO:
Verificamos que sí existe cobertura técnica en la nueva dirección [DIRECCIÓN], por lo que el traslado es viable y no genera la terminación automática del contrato sin cobro de permanencia.

CONCLUSIÓN:
Al existir cobertura, puede optar por realizar el traslado con normalidad o mantener el servicio en la dirección actual. El reclamo por exención de la cláusula de permanencia NO PROCEDE.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]
Departamento Comercial`,
    guia: `PREGUNTAS CLAVE:
1. ¿El usuario presentó formalmente la solicitud de traslado?
2. ¿Existe cobertura técnica verificada en el nuevo domicilio?
3. ¿Hay cláusula de permanencia mínima vigente y en qué condiciones?

DOCUMENTOS A REVISAR:
- Solicitud de traslado
- Mapa de cobertura / verificación técnica de disponibilidad
- Contrato vigente y cláusula de permanencia

ERRORES COMUNES:
❌ Cobrar la cláusula de permanencia cuando no hay cobertura técnica en el nuevo domicilio
❌ No verificar formalmente la disponibilidad técnica antes de responder`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-011',
    nombre: 'Valor y procedencia del cobro por reconexión del servicio',
    incidencia: 'N/D',
    severidad: 'Media',
    norma: 'Art. 2.1.12.1 (CRC 5050); Resolución CRC 8255 de 2026 (topes máximos)',
    normativa: `Cuando el servicio es efectivamente suspendido por el operador por no pago, este puede cobrar un valor de reconexión, que debe corresponder estrictamente a los costos asociados a la operación de reconexión.

ACTUALIZACIÓN NORMATIVA (2026):
La Resolución CRC 8255 de 2026 fijó topes máximos obligatorios al cobro por reconexión de servicios suspendidos por falta de pago, vigentes desde el 17 de julio de 2026. Cualquier cobro que exceda dichos topes es improcedente, independientemente de los costos internos que alegue el operador.

OBLIGACIONES:
- Cuando se trate de un paquete de servicios, solo se puede cobrar un valor de reconexión por cada tipo de conexión física empleado (ej. un solo cobro si todo el paquete usa fibra óptica)
- No cobrar suma alguna por reconexión cuando la interrupción no fue imputable al usuario

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si el cobro excede los topes de la Resolución CRC 8255 de 2026, si se cobró más de un valor de reconexión por un único tipo de conexión en un paquete, o si la suspensión no fue por no pago
✗ Rechazar: Si el cobro está dentro de los topes vigentes y corresponde a una suspensión real por no pago`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos el cobro de $[MONTO] por concepto de reconexión en su factura de [MES/AÑO].

HALLAZGO:
Confirmamos que [el valor cobrado excede el tope máximo vigente según la Resolución CRC 8255 de 2026 / se cobraron múltiples valores de reconexión para un mismo tipo de conexión en su paquete de servicios].

ACCIÓN TOMADA:
1. Se ha ajustado el cobro al valor máximo permitido: $[MONTO CORRECTO]
2. Se ha emitido nota crédito por la diferencia de $[MONTO]
3. Se han corregido los parámetros de facturación para evitar recurrencia

Atentamente,
[NOMBRE OPERADOR]
Departamento de Facturación`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos el cobro de $[MONTO] por concepto de reconexión en su factura de [MES/AÑO].

HALLAZGO:
El valor cobrado corresponde a un único tipo de conexión de su paquete de servicios y se encuentra dentro del tope máximo vigente conforme a la Resolución CRC 8255 de 2026. La suspensión se originó por falta de pago de la factura con vencimiento [FECHA].

CONCLUSIÓN:
El cobro es procedente, por lo que el reclamo NO PROCEDE.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]
Departamento de Facturación`,
    guia: `PREGUNTAS CLAVE:
1. ¿El valor cobrado está dentro del tope vigente de la Resolución CRC 8255 de 2026?
2. ¿Cuántos tipos de conexión física componen el paquete del usuario? ¿Se cobró un valor por cada uno o solo uno?
3. ¿La suspensión se originó realmente por no pago, o por otra causa que no admite cobro de reconexión?

DOCUMENTOS A REVISAR:
- Tabla de topes vigente (Resolución CRC 8255 de 2026) y política interna de tarifas de reconexión
- Tipo(s) de conexión física del paquete contratado
- Causal de la suspensión registrada

ERRORES COMUNES:
❌ Seguir aplicando la tarifa de reconexión anterior a julio de 2026 sin ajustarla al nuevo tope
❌ Cobrar un valor de reconexión por cada servicio del paquete cuando comparten el mismo tipo de conexión física
❌ Cobrar reconexión cuando la suspensión no fue por no pago`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-012',
    nombre: 'Calidad en la atención al usuario',
    incidencia: 'N/D',
    severidad: 'Baja',
    norma: 'Título II, Cap. 1 (Régimen de Protección — CRC 5050)',
    normativa: `De manera posterior a la atención recibida a través de cualquier medio de atención (página web, línea telefónica, red social o cualquier mecanismo idóneo), el usuario puede calificar la atención recibida mediante una encuesta de satisfacción.

OBLIGACIONES:
- Disponer de un mecanismo de encuesta de satisfacción posterior a cada interacción de atención
- Registrar y hacer seguimiento a los resultados de dichas encuestas

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si el reclamo evidencia que no existe mecanismo de encuesta de satisfacción disponible, o mala atención documentada
✗ Rechazar: Si la atención se ajustó a los protocolos y se ofreció la encuesta correspondiente`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Lamentamos la experiencia reportada en su interacción del [FECHA] con nuestro canal de atención.

HALLAZGO:
Revisamos la interacción y confirmamos que no se ajustó a nuestros protocolos de calidad de atención.

ACCIÓN TOMADA:
1. Se ha retroalimentado al equipo/agente involucrado
2. Se ha reforzado la disponibilidad de la encuesta de satisfacción en este canal
3. Ofrecemos disculpas por la experiencia vivida

Atentamente,
[NOMBRE OPERADOR]
Departamento de Atención al Usuario`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su reclamo sobre la calidad de la atención recibida el [FECHA].

HALLAZGO:
La interacción se ajustó a nuestros protocolos de atención y se le ofreció la encuesta de satisfacción correspondiente al finalizar el contacto.

CONCLUSIÓN:
No se evidencia una falla en la atención prestada, por lo que el reclamo NO PROCEDE.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]
Departamento de Atención al Usuario`,
    guia: `PREGUNTAS CLAVE:
1. ¿Qué canal de atención se utilizó y en qué fecha?
2. ¿Se ofreció la encuesta de satisfacción al usuario?
3. ¿Existe grabación o registro de la interacción para verificar el trato recibido?

DOCUMENTOS A REVISAR:
- Grabación o transcripción de la interacción
- Registro de la encuesta de satisfacción (ofrecida/respondida)
- Protocolos internos de atención vigentes

ERRORES COMUNES:
❌ No ofrecer la encuesta de satisfacción tras la interacción
❌ Descartar el reclamo sin revisar la grabación o el registro de la atención`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-013',
    nombre: 'Calidad general en la prestación de los servicios',
    incidencia: 'N/D',
    severidad: 'Media',
    norma: 'Título II, Cap. 1 (Régimen de Protección — CRC 5050)',
    normativa: `El operador debe prestar los servicios en forma continua y eficiente, cumpliendo los niveles de calidad establecidos por la CRC, incluidas las normas de calidad en la atención a los usuarios.

OBLIGACIONES:
- Cumplir los parámetros de calidad técnica definidos para cada servicio (Título de Calidad de la Resolución CRC 5050)
- Investigar y corregir fallas recurrentes de calidad

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si se demuestra incumplimiento reiterado de los parámetros de calidad técnica atribuible al operador
✗ Rechazar: Si los parámetros medidos están dentro de los niveles exigidos, o la causa es ajena al operador`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos su reclamo general sobre la calidad en la prestación de su servicio.

HALLAZGO:
Nuestras mediciones confirman un incumplimiento reiterado de los parámetros de calidad exigidos, atribuible a [CAUSA].

ACCIÓN TOMADA:
1. Se han implementado medidas correctivas en la infraestructura/atención afectada
2. Se realizará seguimiento por [PERÍODO] para verificar la corrección
3. Se aplicará compensación de $[MONTO] si corresponde según el Anexo de compensación

Atentamente,
[NOMBRE OPERADOR]
Departamento de Calidad`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su reclamo general sobre la calidad en la prestación de su servicio.

HALLAZGO:
Nuestras mediciones muestran que los parámetros de calidad se encuentran dentro de los niveles exigidos por la CRC para este servicio.

CONCLUSIÓN:
No se evidencia incumplimiento atribuible al operador, por lo que el reclamo NO PROCEDE.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]
Departamento de Calidad`,
    guia: `PREGUNTAS CLAVE:
1. ¿Qué parámetro de calidad específico se reclama (disponibilidad, velocidad, nivel de señal, atención)?
2. ¿Las mediciones técnicas están dentro de los niveles exigidos por el Título de Calidad de la CRC?
3. ¿Es un problema puntual o recurrente?

DOCUMENTOS A REVISAR:
- Reportes de indicadores de calidad del servicio/zona
- Historial de reclamos similares del usuario
- Parámetros exigidos por la CRC para el servicio específico

ERRORES COMUNES:
❌ Responder de forma genérica sin remitirse a mediciones técnicas concretas
❌ Ignorar la recurrencia del reclamo como indicio de una falla estructural`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-014',
    nombre: 'Cancelación de uno o más servicios sin terminar el contrato',
    incidencia: 'N/D',
    severidad: 'Baja',
    norma: 'Art. 2.1.10.1 (CRC 5050)',
    normativa: `El usuario titular del contrato puede cancelar uno o algunos de los servicios contratados, sin terminar definitivamente el contrato, a través de cualquier medio de atención, presentando la solicitud al menos 3 días hábiles antes del corte de facturación.

OBLIGACIONES:
- Si la solicitud se presenta con menor antelación, la cancelación se hará efectiva en el siguiente período de facturación
- Informar en el momento de la solicitud las condiciones en que se seguirán prestando los servicios no cancelados

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si la cancelación parcial no se aplicó en el período correspondiente pese a haberse solicitado con la antelación debida
✗ Rechazar: Si la solicitud se presentó con menos de 3 días hábiles de antelación y la cancelación se aplicó en el siguiente ciclo, conforme a la norma`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos su solicitud de cancelación parcial del servicio [SERVICIO A CANCELAR], presentada el [FECHA].

HALLAZGO:
Confirmamos que la solicitud se presentó con más de 3 días hábiles de antelación al corte de facturación del [FECHA], y no fue aplicada en el período correspondiente.

ACCIÓN TOMADA:
1. Se ha cancelado el servicio [SERVICIO] con efecto retroactivo al período correspondiente
2. Se ha emitido nota crédito por $[MONTO]
3. Se mantienen sin afectación los demás servicios de su paquete

Atentamente,
[NOMBRE OPERADOR]
Departamento Comercial`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su solicitud/reclamo de cancelación parcial del servicio [SERVICIO].

HALLAZGO:
La solicitud fue presentada el [FECHA], con menos de 3 días hábiles de antelación al corte de facturación del [FECHA]. Conforme a la norma, la cancelación se hizo efectiva en el siguiente período de facturación, tal como fue informado en el momento de la solicitud.

CONCLUSIÓN:
La cancelación se procesó conforme a los plazos legales, por lo que el reclamo NO PROCEDE.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]
Departamento Comercial`,
    guia: `PREGUNTAS CLAVE:
1. ¿Con cuántos días de antelación al corte de facturación se presentó la solicitud?
2. ¿Se informó al usuario, en el momento de la solicitud, en qué período se haría efectiva la cancelación?
3. ¿Se afectaron indebidamente los demás servicios del paquete?

DOCUMENTOS A REVISAR:
- Fecha de radicación de la solicitud
- Fecha de corte de facturación del período
- Confirmación enviada al usuario sobre la cancelación

ERRORES COMUNES:
❌ No informar al usuario en qué período se hará efectiva la cancelación
❌ Cancelar por error otros servicios del paquete no solicitados`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-015',
    nombre: 'Cesión del contrato a un tercero',
    incidencia: 'N/D',
    severidad: 'Media',
    norma: 'Título II, Cap. 1 (Régimen de Protección — CRC 5050)',
    normativa: `Cuando el usuario desea ceder su contrato, debe: (i) informar por escrito al operador su intención, acompañada de la aceptación de quien recibe el contrato; (ii) el operador debe responder dentro de los 15 días hábiles siguientes; (iii) si se acepta la cesión, el usuario cedente queda liberado de responsabilidad desde ese momento.

OBLIGACIONES:
La cesión solo puede rechazarse por: a) no cumplir los requisitos formales (indicando qué debe corregirse); b) que el cesionario no cumpla las condiciones mínimas para asegurar el cumplimiento del contrato; c) razones técnicas que impidan la prestación del servicio. Para servicios fijos, el propietario del inmueble puede solicitar el cambio de titularidad si demuestra que el usuario ya no reside allí.

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si se rechazó la cesión por una razón distinta a las tres causales legales, o si no se respondió dentro de los 15 días hábiles
✗ Rechazar: Si el rechazo se ajusta a una de las tres causales legales, debidamente sustentada`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos su solicitud de cesión de contrato a favor de [NOMBRE CESIONARIO], presentada el [FECHA].

HALLAZGO:
Confirmamos que [no se dio respuesta dentro de los 15 días hábiles / el rechazo no se sustentó en ninguna de las tres causales legales].

ACCIÓN TOMADA:
1. Se aprueba la cesión del contrato a favor de [NOMBRE CESIONARIO]
2. Usted, como cedente, queda liberado de responsabilidad a partir de esta fecha
3. Se generará el nuevo contrato a nombre del cesionario

Atentamente,
[NOMBRE OPERADOR]
Departamento Comercial`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su solicitud de cesión de contrato a favor de [NOMBRE CESIONARIO].

HALLAZGO:
La solicitud no cumple con [CAUSAL: los requisitos formales de la solicitud / las condiciones mínimas de quien recibiría el contrato / no es posible por razones técnicas: DESCRIPCIÓN].

CONCLUSIÓN:
El rechazo se ajusta a una causal legalmente admisible, por lo que el reclamo NO PROCEDE. [Si aplica: le indicamos qué debe corregir para radicar nuevamente su solicitud].

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]
Departamento Comercial`,
    guia: `PREGUNTAS CLAVE:
1. ¿La solicitud de cesión cumple los requisitos formales (escrito + aceptación del cesionario)?
2. ¿Se respondió dentro de los 15 días hábiles?
3. Si se rechazó, ¿en cuál de las tres causales legales se sustenta?

DOCUMENTOS A REVISAR:
- Solicitud escrita de cesión y aceptación del cesionario
- Fecha de radicación y de respuesta
- Evaluación de condiciones del cesionario (si aplica)

ERRORES COMUNES:
❌ Rechazar la cesión por razones distintas a las tres causales legales
❌ Exceder el plazo de 15 días hábiles para responder`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-016',
    nombre: 'Entrega oportuna de la factura',
    incidencia: 'N/D',
    severidad: 'Baja',
    norma: 'Art. 2.1.12.1 (CRC 5050)',
    normativa: `El usuario debe recibir su factura como mínimo 5 días hábiles antes de la fecha de pago oportuno, por el medio (físico o electrónico) que haya elegido; si no elige, se envía por medio electrónico. El operador debe informar el canal específico de envío al momento de la contratación, y el usuario puede solicitar sin costo la entrega impresa en cualquier momento.

OBLIGACIONES:
- Facturar los consumos de terceros operadores (larga distancia, roaming, contenidos) máximo dentro de los 3 períodos de facturación siguientes
- No recibir la factura no libera al usuario de pagar; puede solicitarla por cualquier medio de atención
- No suspender el servicio si existen PQR pendientes de respuesta

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si la factura no se entregó con al menos 5 días hábiles de anticipación al pago oportuno, o se facturaron consumos de terceros fuera del plazo de 3 períodos
✗ Rechazar: Si la factura se entregó dentro del plazo por el canal informado/elegido`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos su reclamo sobre la entrega tardía de su factura de [MES/AÑO].

HALLAZGO:
Confirmamos que la factura fue entregada el [FECHA], con menos de 5 días hábiles antes de la fecha de pago oportuno del [FECHA].

ACCIÓN TOMADA:
1. Se ha ampliado su fecha de pago oportuno a [NUEVA FECHA] para este período
2. Se han removido intereses o recargos por mora asociados a este retraso, si los hubo
3. Se han corregido los parámetros de envío para períodos futuros

Atentamente,
[NOMBRE OPERADOR]
Departamento de Facturación`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su reclamo sobre la entrega de su factura de [MES/AÑO].

HALLAZGO:
La factura fue enviada el [FECHA] por [CANAL INFORMADO/ELEGIDO], con [X] días hábiles de anticipación a la fecha de pago oportuno del [FECHA], cumpliendo el mínimo de 5 días hábiles exigido.

CONCLUSIÓN:
La entrega se realizó dentro del plazo legal, por lo que el reclamo NO PROCEDE.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]
Departamento de Facturación`,
    guia: `PREGUNTAS CLAVE:
1. ¿Por qué canal se envió la factura y coincide con el elegido/informado al usuario?
2. ¿Cuántos días hábiles hay entre el envío y la fecha de pago oportuno?
3. ¿Hay consumos de terceros facturados fuera del plazo de 3 períodos?

DOCUMENTOS A REVISAR:
- Registro de envío de la factura (correo, SMS, físico)
- Fecha de pago oportuno del período
- Detalle de consumos de terceros y su período de facturación

ERRORES COMUNES:
❌ No ajustar la fecha de pago oportuno cuando la factura se entrega tarde
❌ Cobrar intereses de mora generados por un envío tardío atribuible al operador`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-017',
    nombre: 'Fecha de cobro y ciclo de facturación en modalidad pospago',
    incidencia: 'N/D',
    severidad: 'Baja',
    norma: 'Art. 2.1.13.1 (CRC 5050)',
    normativa: `El operador debe informar en la factura el período de facturación, la fecha de corte y la fecha de pago oportuno conforme fueron pactadas en el contrato; estas solo pueden modificarse con la aceptación del usuario.

OBLIGACIONES:
- No modificar unilateralmente el ciclo de facturación pactado
- Informar previamente cualquier cambio aceptado por el usuario

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si el ciclo de facturación (corte/pago) se modificó sin la aceptación del usuario
✗ Rechazar: Si el ciclo corresponde al pactado en el contrato vigente, o fue modificado con aceptación expresa`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos su reclamo sobre el cambio en la fecha de corte/pago de su factura de [MES/AÑO].

HALLAZGO:
Confirmamos que el ciclo de facturación fue modificado sin su aceptación expresa.

ACCIÓN TOMADA:
1. Se ha restablecido el ciclo de facturación pactado originalmente: corte el [DÍA], pago oportuno el [DÍA]
2. Se ha ajustado la factura del período afectado
3. Cualquier cambio futuro será solo con su aceptación previa

Atentamente,
[NOMBRE OPERADOR]
Departamento de Facturación`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su reclamo sobre la fecha de corte/pago de su factura de [MES/AÑO].

HALLAZGO:
El ciclo de facturación corresponde al pactado en su contrato vigente desde [FECHA] [/ fue modificado con su aceptación expresa el FECHA, canal CANAL].

CONCLUSIÓN:
No se evidencia una modificación unilateral, por lo que el reclamo NO PROCEDE.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]
Departamento de Facturación`,
    guia: `PREGUNTAS CLAVE:
1. ¿Cuál es el ciclo de facturación pactado en el contrato original?
2. ¿Hubo algún cambio y consta la aceptación expresa del usuario?
3. ¿El cambio generó perjuicio en intereses o cobros duplicados?

DOCUMENTOS A REVISAR:
- Contrato vigente (fechas de corte y pago pactadas)
- Registro de aceptación de cambios de ciclo, si los hubo
- Historial de facturación de los últimos períodos

ERRORES COMUNES:
❌ Modificar el ciclo de facturación por conveniencia operativa sin aceptación del usuario
❌ No explicar claramente al usuario la fecha de corte vs. la fecha de pago oportuno`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-018',
    nombre: 'Inconformidad con el contenido de la factura y derecho a reclamar',
    incidencia: 'N/D',
    severidad: 'Media',
    norma: 'Art. 2.1.13.1 (CRC 5050)',
    normativa: `La factura debe indicar claramente el valor por establecimiento de comunicación, la unidad y valor de consumo, el número de unidades consumidas, el período y fecha de corte de facturación, la fecha de pago oportuno, el valor total pagado en la factura anterior y el detalle de servicios suplementarios y de acceso a Internet.

OBLIGACIONES:
- Permitir al usuario reclamar antes del vencimiento del pago oportuno, pagando solo las sumas no controvertidas
- No exigir el pago total de la factura como requisito para recibir, atender, tramitar y responder la PQR
- No suspender el servicio mientras existan PQR pendientes de respuesta
- Respetar el término de 6 meses desde el pago oportuno para presentar cualquier PQR relacionada con esa factura

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si se exigió el pago total como condición para tramitar la PQR, se suspendió el servicio con PQR pendiente, o se rechazó la PQR por extemporánea estando dentro de los 6 meses
✗ Rechazar: Si la PQR se presentó fuera del término de 6 meses, o la factura cumple con toda la información exigida y no hay error`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos su reclamo sobre el trámite dado a su inconformidad con la factura de [MES/AÑO].

HALLAZGO:
Confirmamos que [se exigió el pago total de la factura como condición para atender su PQR / se suspendió el servicio pese a existir una PQR pendiente / se rechazó por extemporaneidad estando usted dentro del término de 6 meses].

ACCIÓN TOMADA:
1. Se ha admitido y tramitado su PQR sobre el valor en discusión de $[MONTO]
2. Se ha reactivado el servicio, si fue suspendido indebidamente
3. Se dará respuesta de fondo dentro de los 15 días hábiles siguientes

Atentamente,
[NOMBRE OPERADOR]
Departamento de Facturación`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su reclamo sobre el trámite dado a su inconformidad con la factura de [MES/AÑO], con fecha de pago oportuno [FECHA].

HALLAZGO:
Su PQR fue presentada el [FECHA], superando el término de 6 meses contados desde la fecha de pago oportuno de dicha factura.

CONCLUSIÓN:
Al haberse presentado fuera del término legal, el reclamo NO PROCEDE por extemporaneidad.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]
Departamento de Facturación`,
    guia: `PREGUNTAS CLAVE:
1. ¿Cuántos meses han transcurrido desde la fecha de pago oportuno de la factura reclamada?
2. ¿Se exigió el pago total como condición para tramitar la PQR?
3. ¿Se suspendió el servicio existiendo una PQR pendiente de respuesta?

DOCUMENTOS A REVISAR:
- Fecha de pago oportuno de la factura reclamada vs. fecha de radicación de la PQR
- Registro de suspensión del servicio y su motivo
- Historial de la PQR (recepción, trámite, respuesta)

ERRORES COMUNES:
❌ Exigir el pago total de la factura como condición para atender la PQR
❌ Suspender el servicio mientras hay una PQR pendiente de respuesta
❌ Rechazar por extemporaneidad sin verificar el término real de 6 meses`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-019',
    nombre: 'Disponibilidad y trámite de PQR por la línea de atención telefónica',
    incidencia: 'N/D',
    severidad: 'Media',
    norma: 'Título II, Cap. 1 (CRC 5050); Resolución CRC 6242 de 2021 (digitalización)',
    normativa: `El usuario puede presentar cualquier PQR a través de la línea telefónica gratuita del operador, aun cuando su servicio esté suspendido o no posea saldo. El operador debe almacenar las grabaciones de las llamadas en que se interpone y se responde una PQR por al menos 6 meses siguientes a la notificación de la respuesta definitiva.

ACTUALIZACIÓN NORMATIVA:
La Resolución CRC 6242 de 2021 permite a los operadores digitalizar su relacionamiento con los usuarios: para los asuntos que hayan sido digitalizados y debidamente informados al usuario, la atención puede prestarse solo por el canal digital dispuesto. Aun así, el usuario siempre puede presentar cualquier PQR a través de la línea de atención telefónica.
NOTA: las medidas de horario extendido asociadas a la emergencia por COVID-19 (Art. 4 de la Resolución CRC 6183 de 2021) fueron transitorias y ya no están vigentes; verifique el horario de línea telefónica actualmente informado por cada operador en su contrato y página web.

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si se le impidió al usuario presentar su PQR por línea telefónica argumentando suspensión del servicio o falta de saldo, o si no se conservó la grabación exigida
✗ Rechazar: Si la PQR fue recibida y tramitada correctamente por la línea telefónica, o si el asunto específico fue válidamente digitalizado y debidamente informado al usuario`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos su reclamo sobre la imposibilidad de presentar su PQR a través de nuestra línea de atención telefónica.

HALLAZGO:
Confirmamos que se le impidió indebidamente presentar su PQR por [SUSPENSIÓN DEL SERVICIO / FALTA DE SALDO], lo cual no es una causal válida para negar este derecho.

ACCIÓN TOMADA:
1. Se ha admitido y radicado su PQR bajo el Código Único Numérico [CUN]
2. Se ha retroalimentado al personal/sistema del canal telefónico
3. Le daremos respuesta de fondo dentro de los 15 días hábiles siguientes

Atentamente,
[NOMBRE OPERADOR]
Departamento de Atención al Usuario`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su reclamo sobre la atención recibida en nuestra línea telefónica el [FECHA].

HALLAZGO:
Nuestros registros muestran que su PQR fue recibida y radicada bajo el CUN [CUN] el [FECHA], y tramitada dentro de los términos legales.

CONCLUSIÓN:
No se evidencia una restricción indebida al canal telefónico, por lo que el reclamo NO PROCEDE.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]
Departamento de Atención al Usuario`,
    guia: `PREGUNTAS CLAVE:
1. ¿Se le impidió al usuario presentar la PQR por estar el servicio suspendido o sin saldo?
2. ¿El asunto específico fue válidamente digitalizado y se informó previamente al usuario?
3. ¿Se conserva la grabación de la llamada por el término mínimo de 6 meses tras la respuesta definitiva?

DOCUMENTOS A REVISAR:
- Grabación de la llamada
- Registro del CUN asignado y su trazabilidad
- Comunicación previa sobre digitalización del asunto específico, si aplica

ERRORES COMUNES:
❌ Negar la radicación de una PQR por línea telefónica argumentando suspensión o falta de saldo
❌ No conservar las grabaciones por el término mínimo exigido
❌ Aplicar horarios o restricciones basadas en normas transitorias de la pandemia ya derogadas`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-020',
    nombre: 'Modificación unilateral del contrato',
    incidencia: 'N/D',
    severidad: 'Alta',
    norma: 'Art. 2.1.3.2 (CRC 5050)',
    normativa: `Los operadores no pueden modificar unilateralmente las condiciones acordadas con los usuarios, ni cobrar servicios que el usuario no haya aceptado. Si el operador modifica estas condiciones, el usuario puede terminar el contrato así tenga cláusula de permanencia mínima vigente, sin pagar sumas por este concepto.

OBLIGACIONES:
- Cuando las modificaciones sean acordadas con el usuario, enviar el contrato actualizado dentro del período de facturación siguiente
- Conservar las evidencias de las solicitudes de servicios tramitadas (Art. 28 Ley 962 de 2005)

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si se modificaron condiciones del contrato sin aceptación del usuario y se le cobró la cláusula de permanencia al querer terminar por este motivo
✗ Rechazar: Si la modificación contó con aceptación expresa del usuario, debidamente documentada`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos su reclamo sobre la modificación de las condiciones de su contrato sin su aceptación.

HALLAZGO:
Confirmamos que [DESCRIPCIÓN DE LA MODIFICACIÓN] se aplicó sin evidencia de su aceptación expresa.

ACCIÓN TOMADA:
1. Se han restablecido las condiciones originalmente pactadas
2. Si usted desea terminar el contrato por este motivo, queda liberado de cualquier cobro por cláusula de permanencia mínima
3. Se ha emitido nota crédito por $[MONTO], si aplica

Atentamente,
[NOMBRE OPERADOR]
Departamento Comercial`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su reclamo sobre la modificación de las condiciones de su contrato.

HALLAZGO:
La modificación [DESCRIPCIÓN] fue aceptada por usted el [FECHA] a través de [CANAL], radicado [REFERENCIA], y el contrato actualizado le fue enviado dentro del período de facturación siguiente.

CONCLUSIÓN:
No hubo modificación unilateral, por lo que el reclamo NO PROCEDE.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]
Departamento Comercial`,
    guia: `PREGUNTAS CLAVE:
1. ¿Qué condición específica del contrato cambió (tarifa, velocidad, canales, permanencia)?
2. ¿Existe evidencia de aceptación expresa del usuario para el cambio?
3. ¿Se envió el contrato actualizado dentro del período de facturación siguiente a la aceptación?

DOCUMENTOS A REVISAR:
- Contrato original vs. condiciones actuales
- Evidencia de aceptación del cambio (grabación, firma, clic)
- Envío del contrato actualizado

ERRORES COMUNES:
❌ Aplicar cambios "por defecto" u "opt-out" sin aceptación expresa
❌ Cobrar la cláusula de permanencia cuando el usuario termina el contrato por una modificación unilateral`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-021',
    nombre: 'Prestación de servicios empaquetados',
    incidencia: 'N/D',
    severidad: 'Baja',
    norma: 'Título II, Cap. 1 (Régimen de Protección — CRC 5050)',
    normativa: `El paquete de servicios corresponde a la oferta y prestación de 2 o más servicios de comunicaciones, por uno o varios operadores, bajo un único precio.

OBLIGACIONES:
- El usuario debe recibir una sola factura por todos los servicios del paquete
- Informar, cuando el usuario lo solicite: (i) las características de cada servicio; (ii) el precio individual de cada uno si se contrataran por separado; (iii) el precio total del paquete
- Cuando el paquete lo prestan 2 o más operadores, el usuario firma el contrato con solo uno de ellos, ante quien puede presentar sus PQR de todo el paquete
- Disponer en la página web de un comparador de planes y tarifas propios

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si se facturó por separado un paquete que debía facturarse unificado, o si el operador contratante se negó a tramitar una PQR sobre un servicio del paquete prestado por un tercero
✗ Rechazar: Si la facturación y el trámite de PQR se ajustaron a estas reglas`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos su reclamo sobre [la facturación separada de su paquete / la negativa a tramitar su PQR sobre uno de los servicios del paquete].

HALLAZGO:
Confirmamos la irregularidad señalada respecto de las reglas de empaquetamiento.

ACCIÓN TOMADA:
1. Se ha unificado su facturación en una sola factura a partir del período [PERÍODO]
2. Se ha admitido y tramitado su PQR sobre el servicio [SERVICIO] del paquete
3. Se le entregará el detalle individual de precios que solicitó

Atentamente,
[NOMBRE OPERADOR]
Departamento Comercial`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su reclamo sobre las condiciones de su paquete de servicios.

HALLAZGO:
Su paquete se factura de manera unificada en una sola factura, y el detalle de precios individuales le fue entregado el [FECHA] a solicitud suya.

CONCLUSIÓN:
El paquete se ajusta a las reglas vigentes, por lo que el reclamo NO PROCEDE.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]
Departamento Comercial`,
    guia: `PREGUNTAS CLAVE:
1. ¿El paquete se está facturando en una sola factura?
2. ¿Se entregó al usuario el detalle de precios individuales cuando lo solicitó?
3. Si el paquete involucra 2 operadores, ¿ante cuál de ellos firmó el contrato el usuario?

DOCUMENTOS A REVISAR:
- Facturación del período reclamado
- Contrato de paquete y operador titular frente al usuario
- Solicitud de detalle de precios, si existió

ERRORES COMUNES:
❌ Facturar por separado servicios que conforman un mismo paquete
❌ Remitir al usuario a "otro operador" del paquete en vez de tramitar la PQR directamente`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-022',
    nombre: 'Presunta estafa relacionada con el servicio contratado',
    incidencia: 'N/D',
    severidad: 'Alta',
    norma: 'Art. 246, Ley 599 de 2000 (Código Penal)',
    normativa: `Cuando el usuario considere que se ha cometido una conducta delictiva correspondiente a estafa (Art. 246, Ley 599 de 2000), debe interponer en primera medida la respectiva denuncia ante las autoridades judiciales competentes.

OBLIGACIONES DEL OPERADOR:
- Orientar al usuario sobre esta vía y facilitar la información que las autoridades le requieran
- No es competencia del operador ni de la CRC calificar penalmente la conducta; esa es una función judicial

CRITERIOS DE RESOLUCIÓN:
Esta tipología no admite "acoger/rechazar" en el sentido de reversar un cobro por sí sola: la respuesta debe orientar al usuario a la vía penal, sin perjuicio de que, si el reclamo también implica un cobro o servicio irregular imputable al operador, este se tramite y resuelva de forma independiente bajo la tipología de facturación o fraude que corresponda.`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU COMUNICACIÓN

Hemos recibido su comunicación relacionada con una presunta estafa asociada a [DESCRIPCIÓN DE LOS HECHOS].

ORIENTACIÓN:
Le informamos que, de considerar que se ha cometido una conducta delictiva tipificada como estafa (Art. 246 del Código Penal - Ley 599 de 2000), debe interponer en primera medida la respectiva denuncia ante las autoridades judiciales competentes (Fiscalía General de la Nación), lo cual facilitará cualquier gestión posterior.

ACCIÓN ADICIONAL DE NUESTRA PARTE:
En paralelo, revisamos el aspecto contractual/comercial de su reclamo relacionado con [DETALLE], sobre el cual [se ha tomado la siguiente acción: DESCRIPCIÓN].

Quedamos atentos a colaborar con la autoridad competente que así lo requiera.

Atentamente,
[NOMBRE OPERADOR]
Departamento de Atención al Usuario`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU COMUNICACIÓN

Hemos recibido su comunicación relacionada con una presunta estafa asociada a [DESCRIPCIÓN DE LOS HECHOS].

ORIENTACIÓN:
Le informamos que la calificación de una conducta como estafa (Art. 246 del Código Penal) corresponde exclusivamente a las autoridades judiciales, por lo que le recomendamos presentar la denuncia respectiva ante la Fiscalía General de la Nación.

En cuanto al aspecto contractual de su reclamo, revisamos [DETALLE] y no encontramos una irregularidad atribuible al operador, por lo que en ese aspecto el reclamo NO PROCEDE.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores respecto de los aspectos de protección al usuario.

Atentamente,
[NOMBRE OPERADOR]
Departamento de Atención al Usuario`,
    guia: `PREGUNTAS CLAVE:
1. ¿Los hechos relatados corresponden a una conducta penal (estafa) o a un reclamo comercial/contractual ordinario?
2. ¿El usuario ya presentó denuncia penal? ¿Requiere el operador aportar información a la autoridad?
3. ¿Hay, además, un aspecto contractual (cobro, servicio) que deba resolverse independientemente?

DOCUMENTOS A REVISAR:
- Relato de los hechos del usuario
- Registros internos relacionados con la operación cuestionada
- Requerimientos de autoridades judiciales, si existen

ERRORES COMUNES:
❌ Intentar "calificar" penalmente el hecho en la respuesta, función que no corresponde al operador
❌ Ignorar el aspecto contractual/comercial que sí puede resolverse directamente
❌ No orientar claramente al usuario hacia la Fiscalía General de la Nación`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-023',
    nombre: 'Presunta suplantación de identidad',
    incidencia: 'N/D',
    severidad: 'Alta',
    norma: 'Art. 296, Ley 599 de 2000 (Código Penal - Falsedad Personal)',
    normativa: `Cuando el usuario considere que se ha cometido una conducta delictiva de suplantación de identidad, tipificada como "Falsedad Personal" (Art. 296, Ley 599 de 2000), debe interponer en primera medida la respectiva denuncia ante las autoridades judiciales competentes.

CONTEXTO OPERATIVO (ej. SIM swapping/reposición de SIM):
Cuando la presunta suplantación se relaciona con la reposición o duplicado de una SIM/línea, el operador debe verificar que utilizó herramientas tecnológicas idóneas para validar la identidad de quien solicitó la reposición (ver también la tipología de fraude, GEN-007). Si el operador no acredita una verificación de identidad adecuada, puede haber responsabilidad administrativa independiente de la investigación penal.

CRITERIOS DE RESOLUCIÓN:
✓ Acoger (aspecto operativo): Si el operador no verificó adecuadamente la identidad en el trámite cuestionado (ej. reposición de SIM) y de ahí se derivó un perjuicio al usuario
✗ Rechazar (aspecto operativo): Si el operador demuestra una verificación de identidad idónea y el hecho es ajeno a su gestión
La calificación penal de la conducta, en cualquier caso, corresponde a la autoridad judicial.`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU COMUNICACIÓN - ACEPTADO (aspecto operativo)

Revisamos su reporte sobre una presunta suplantación de identidad relacionada con [DESCRIPCIÓN: reposición de SIM/apertura de línea/otro trámite].

HALLAZGO:
Confirmamos que el trámite se realizó sin una verificación de identidad idónea de nuestra parte.

ACCIÓN TOMADA:
1. Se ha revertido/bloqueado el trámite cuestionado
2. Se han reversado los cargos derivados de $[MONTO]
3. Se han reforzado los controles de verificación de identidad para este tipo de trámites

ORIENTACIÓN:
Le recomendamos presentar la denuncia respectiva por Falsedad Personal (Art. 296, Código Penal) ante la Fiscalía General de la Nación, para lo cual estamos disponibles a colaborar con la información que la autoridad requiera.

Atentamente,
[NOMBRE OPERADOR]
Departamento de Seguridad y Fraude`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU COMUNICACIÓN - RECHAZADO (aspecto operativo)

Revisamos su reporte sobre una presunta suplantación de identidad relacionada con [DESCRIPCIÓN].

HALLAZGO:
El trámite se realizó cumpliendo nuestros protocolos de verificación de identidad: [DETALLE: presentación de documento físico / validación biométrica / OTP a línea registrada].

CONCLUSIÓN:
No se evidencia una falla operativa atribuible al operador, por lo que en este aspecto el reclamo NO PROCEDE.

ORIENTACIÓN:
Le recomendamos presentar la denuncia respectiva ante la Fiscalía General de la Nación por Falsedad Personal (Art. 296, Código Penal), autoridad competente para calificar e investigar el hecho.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores respecto del aspecto de protección al usuario.

Atentamente,
[NOMBRE OPERADOR]
Departamento de Seguridad y Fraude`,
    guia: `PREGUNTAS CLAVE:
1. ¿Qué trámite fue objeto de la presunta suplantación (reposición de SIM, cambio de titular, nueva línea)?
2. ¿Qué mecanismo de verificación de identidad se usó y quedó registrado?
3. ¿El usuario ya presentó la denuncia penal correspondiente?

DOCUMENTOS A REVISAR:
- Registro del trámite y del mecanismo de verificación usado
- Copia del documento de identidad presentado, si aplica
- Logs de OTP/biometría del trámite cuestionado

ERRORES COMUNES:
❌ No distinguir entre el aspecto operativo (verificación de identidad) y la calificación penal (que no corresponde al operador)
❌ No reforzar los controles de verificación tras un caso confirmado de suplantación`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-024',
    nombre: 'Tratamiento y protección de datos personales del usuario',
    incidencia: 'N/D',
    severidad: 'Alta',
    norma: 'Ley 1581 de 2012 (Habeas Data)',
    normativa: `La recolección, almacenamiento, uso, circulación y actualización de los datos personales del usuario por parte del operador, así como la finalidad de los mismos, los derechos del usuario y las condiciones de revocatoria de la autorización, deben ajustarse a la Ley 1581 de 2012.

OBLIGACIONES:
- Contar con autorización previa, expresa e informada del titular para el tratamiento de sus datos
- Permitir el ejercicio de los derechos de conocer, actualizar, rectificar y suprimir datos, y revocar la autorización
- Atender las solicitudes en los términos de la Ley 1581 de 2012 y el Decreto 1377 de 2013

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si el operador trató datos sin autorización, se negó a atender una solicitud de acceso/rectificación/supresión, o no atendió la revocatoria de autorización
✗ Rechazar: Si el tratamiento contó con autorización válida y las solicitudes del titular fueron atendidas en los términos legales

Entidad de vigilancia y control: Superintendencia de Industria y Comercio (SIC).`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos su solicitud relacionada con el tratamiento de sus datos personales.

HALLAZGO:
Confirmamos que [no contábamos con autorización válida para el tratamiento reclamado / no atendimos oportunamente su solicitud de acceso, rectificación, supresión o revocatoria].

ACCIÓN TOMADA:
1. Se ha [suprimido/actualizado/dejado de circular] la información de acuerdo con su solicitud
2. Se ha revocado la autorización de tratamiento para las finalidades indicadas
3. Le confirmaremos por escrito una vez completado el trámite, dentro de los términos de la Ley 1581 de 2012

Atentamente,
[NOMBRE OPERADOR]
Oficial de Protección de Datos`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su solicitud relacionada con el tratamiento de sus datos personales.

HALLAZGO:
Contamos con su autorización expresa, otorgada el [FECHA] a través de [CANAL], para las finalidades de [FINALIDADES]. [Si aplica: su solicitud de acceso/rectificación fue atendida el FECHA].

CONCLUSIÓN:
El tratamiento se ajusta a la Ley 1581 de 2012, por lo que el reclamo NO PROCEDE.

Derechos: Puede recurrir ante la Superintendencia de Industria y Comercio (SIC), entidad encargada de vigilar el cumplimiento de la Ley 1581 de 2012.

Atentamente,
[NOMBRE OPERADOR]
Oficial de Protección de Datos`,
    guia: `PREGUNTAS CLAVE:
1. ¿Existe autorización válida, expresa e informada para la finalidad de tratamiento reclamada?
2. ¿Qué derecho ejerce el usuario (acceso, rectificación, actualización, supresión, revocatoria)?
3. ¿Se atendió dentro de los términos de la Ley 1581 de 2012 y el Decreto 1377 de 2013?

DOCUMENTOS A REVISAR:
- Autorización de tratamiento de datos y sus finalidades
- Política de tratamiento de datos vigente
- Registro de la solicitud del titular y su trámite

ERRORES COMUNES:
❌ Tratar datos para finalidades no autorizadas por el titular
❌ No atender oportunamente una solicitud de supresión o revocatoria
❌ Confundir esta tipología con la de reporte a centrales de riesgo (que tiene reglas propias, ver GEN-008)`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-025',
    nombre: 'Suspensión del servicio a pesar del pago oportuno',
    incidencia: 'N/D',
    severidad: 'Alta',
    norma: 'Anexo 2.1, Título "Anexos Título II" (CRC 5050)',
    normativa: `Cuando el operador suspenda el servicio a pesar de que el usuario haya pagado oportunamente su factura, el usuario tiene derecho a ser compensado por el tiempo que dure dicha suspensión indebida, de acuerdo con la metodología del Anexo 2.1 del Título "Anexos Título II" de la Resolución CRC 5050 de 2016.

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si se verifica el pago oportuno y la suspensión ocurrió de todas formas
✗ Rechazar: Si el pago se realizó después de la fecha de pago oportuno, o el sistema de pagos del operador no había recibido el pago al momento de la suspensión por causas ajenas a este (ej. demora del medio de pago del usuario, no imputable al operador)`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos su reclamo sobre la suspensión de su servicio pese a haber pagado oportunamente su factura de [MES/AÑO].

HALLAZGO:
Confirmamos el pago oportuno registrado el [FECHA], previo a la fecha límite del [FECHA], y verificamos que la suspensión se aplicó de forma indebida.

ACCIÓN TOMADA:
1. Se ha reactivado el servicio de forma inmediata
2. Se ha aplicado la compensación correspondiente por [X HORAS/DÍAS] de suspensión indebida, conforme al Anexo 2.1 del Título II
3. Valor de la compensación: $[MONTO], aplicado en su próxima factura

Atentamente,
[NOMBRE OPERADOR]
Departamento de Cartera`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su reclamo sobre la suspensión de su servicio.

HALLAZGO:
Nuestros registros muestran que el pago fue recibido/registrado el [FECHA], posterior a la fecha de pago oportuno del [FECHA], por lo que la suspensión aplicada fue procedente.

CONCLUSIÓN:
No se evidencia una suspensión indebida, por lo que el reclamo NO PROCEDE.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]
Departamento de Cartera`,
    guia: `PREGUNTAS CLAVE:
1. ¿Cuál fue la fecha exacta de pago y la fecha de pago oportuno?
2. ¿El pago fue registrado por el operador antes de la suspensión?
3. ¿Cuánto tiempo duró la suspensión indebida, para calcular la compensación según el Anexo 2.1?

DOCUMENTOS A REVISAR:
- Comprobante de pago del usuario
- Registro de conciliación de pagos del operador
- Fecha y hora exacta de suspensión y reactivación

ERRORES COMUNES:
❌ No verificar la fecha real de pago antes de responder
❌ No aplicar la compensación conforme a la metodología del Anexo 2.1 del Título II`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-026',
    nombre: 'Suspensión temporal del servicio por solicitud del usuario',
    incidencia: 'N/D',
    severidad: 'Baja',
    norma: 'Art. 2.1.8.2 (CRC 5050)',
    normativa: `El usuario puede solicitar la suspensión del contrato para que el servicio no le sea prestado ni facturado, hasta por dos períodos de facturación durante el transcurso de 1 año. La solicitud debe hacerse ante el operador antes del inicio del ciclo de facturación que se desea suspender. Si existe cláusula de permanencia mínima, esta se prorroga por el tiempo que dure la suspensión.

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si se facturó el servicio durante un período de suspensión válidamente solicitado, o se negó la suspensión estando el usuario dentro del límite de 2 períodos por año
✗ Rechazar: Si el usuario ya agotó los 2 períodos de suspensión permitidos en el año, o la solicitud se presentó después de iniciado el ciclo de facturación`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos su reclamo sobre la suspensión temporal de su servicio solicitada el [FECHA].

HALLAZGO:
Confirmamos que su solicitud se presentó antes del inicio del ciclo de facturación a suspender, y que usted no ha agotado los 2 períodos de suspensión permitidos en el año.

ACCIÓN TOMADA:
1. Se ha aplicado la suspensión para el período [PERÍODO]
2. Se ha ajustado/reversado la facturación indebida de $[MONTO], si aplica
3. Se le informa que la cláusula de permanencia mínima, si existe, se prorrogará por el tiempo de la suspensión

Atentamente,
[NOMBRE OPERADOR]
Departamento Comercial`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su solicitud de suspensión temporal del servicio.

HALLAZGO:
Usted ya hizo uso de los 2 períodos de suspensión permitidos en el último año (períodos [X] y [Y]) [/ la solicitud se presentó el FECHA, después de iniciado el ciclo de facturación del período que deseaba suspender].

CONCLUSIÓN:
No es posible acceder a una nueva suspensión bajo esta figura, por lo que el reclamo NO PROCEDE.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]
Departamento Comercial`,
    guia: `PREGUNTAS CLAVE:
1. ¿Cuántos períodos de suspensión ha usado el usuario en el último año?
2. ¿La solicitud se presentó antes del inicio del ciclo de facturación a suspender?
3. ¿Existe cláusula de permanencia mínima que deba prorrogarse por el tiempo de suspensión?

DOCUMENTOS A REVISAR:
- Historial de suspensiones temporales del usuario en el último año
- Fecha de radicación de la solicitud vs. fecha de inicio del ciclo de facturación
- Estado de la cláusula de permanencia mínima

ERRORES COMUNES:
❌ Facturar el servicio durante un período de suspensión válidamente solicitado
❌ No prorrogar la cláusula de permanencia mínima por el tiempo que duró la suspensión`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-027',
    nombre: 'Terminación definitiva del contrato',
    incidencia: 'N/D',
    severidad: 'Alta',
    norma: 'Art. 2.1.8.3 (CRC 5050)',
    normativa: `Solo el usuario titular del contrato puede solicitar su terminación, a través de cualquier medio de atención, presentando la solicitud al menos 3 días hábiles antes del corte del período de facturación (si la presenta con menor antelación, la terminación se dará en el siguiente período).

OBLIGACIONES:
- El operador no puede oponerse a la terminación ni exigir documentos o requisitos adicionales, salvo el cumplimiento de obligaciones y pagos pactados
- Debe recoger, sin costo para el usuario, los elementos de su propiedad (decodificadores, routers)
- Debe almacenar la solicitud de terminación para consulta del usuario
- El operador solo puede terminar unilateralmente el contrato por incumplimiento del usuario (avisando con mínimo 5 días hábiles de antelación) o por vencimiento del plazo (avisando con mínimo 1 mes de antelación)

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si se exigieron requisitos adicionales no permitidos, se cobró por el retiro de equipos, o el operador terminó unilateralmente sin el aviso mínimo exigido
✗ Rechazar: Si la terminación se tramitó conforme a estas reglas y no hay obligaciones pendientes que impidan cerrarla`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos su reclamo sobre la solicitud de terminación de su contrato presentada el [FECHA].

HALLAZGO:
Confirmamos que [se le exigieron requisitos adicionales no permitidos / se le cobró indebidamente por el retiro de equipos / el operador terminó el contrato sin el aviso mínimo exigido].

ACCIÓN TOMADA:
1. Se ha tramitado la terminación de su contrato con efecto al [FECHA]
2. Se ha programado el retiro de los equipos de nuestra propiedad sin costo alguno para usted
3. Se ha reversado el cobro indebido de $[MONTO], si aplica

Atentamente,
[NOMBRE OPERADOR]
Departamento Comercial`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su reclamo sobre el trámite de terminación de su contrato.

HALLAZGO:
Su solicitud fue tramitada conforme a la norma: se presentó el [FECHA], se hizo efectiva el [FECHA], y no se le exigieron requisitos adicionales ni se le cobró por el retiro de equipos. [Si aplica: usted mantiene obligaciones pendientes de pago por $MONTO que deben saldarse para el cierre definitivo].

CONCLUSIÓN:
El trámite se ajustó a la normativa vigente, por lo que el reclamo NO PROCEDE.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]
Departamento Comercial`,
    guia: `PREGUNTAS CLAVE:
1. ¿Quién solicitó la terminación? ¿Es el usuario titular del contrato?
2. ¿Con cuántos días de antelación al corte de facturación se presentó la solicitud?
3. ¿Se exigieron requisitos adicionales o se cobró por el retiro de equipos?
4. Si la terminación fue iniciativa del operador, ¿se dio el aviso mínimo exigido (5 días hábiles por incumplimiento, o 1 mes por vencimiento del plazo)?

DOCUMENTOS A REVISAR:
- Solicitud de terminación y fecha de radicación
- Registro de retiro de equipos y su costo (si lo hubo)
- Aviso de terminación unilateral del operador, si aplica

ERRORES COMUNES:
❌ Exigir documentos o trámites adicionales al usuario para procesar la terminación
❌ Cobrar por el retiro de equipos de propiedad del operador
❌ Terminar unilateralmente el contrato sin el aviso previo mínimo exigido`,
  },

  {
    servicio: 'CONTRATO Y ASPECTOS GENERALES',
    codigo: 'GEN-028',
    nombre: 'Cláusulas de permanencia mínima en servicios fijos',
    incidencia: 'N/D',
    severidad: 'Media',
    norma: 'Art. 2.1.4.1 (CRC 5050)',
    normativa: `Las cláusulas de permanencia mínima para servicios fijos solo pueden pactarse cuando el usuario las haya aceptado y el operador le otorgue, a cambio, un descuento sobre el cargo por conexión o el diferimiento de su pago. Solo se pactan una vez, al inicio del contrato, y su período no puede superar 12 meses.

OBLIGACIONES:
- Ofrecer siempre la alternativa de contratar sin permanencia mínima, informando el valor del cargo por conexión y el valor mensual del servicio en ese escenario
- Informar en el contrato y en la factura mensual: (i) el valor total del cargo por conexión, (ii) la suma descontada o diferida, (iii) las fechas exactas de inicio y fin de la permanencia, (iv) el valor a pagar si se termina anticipadamente
- Si el usuario termina antes de finalizar la permanencia mínima, solo debe pagar el valor que a la fecha adeude de la suma descontada o diferida (no el valor total del período restante)

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si se pactó permanencia mínima sin descuento/diferimiento real, si supera los 12 meses, si no se ofreció la alternativa sin permanencia, o si se cobró más de lo que legalmente corresponde al terminar anticipadamente
✗ Rechazar: Si la cláusula se pactó conforme a estos requisitos y el cobro por terminación anticipada corresponde al saldo real adeudado`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos su reclamo sobre el cobro de $[MONTO] por terminación anticipada de su cláusula de permanencia mínima.

HALLAZGO:
Confirmamos que el valor cobrado no corresponde al saldo real adeudado de la suma descontada/diferida del cargo por conexión, conforme al Art. 2.1.4.1 [/ la cláusula pactada supera los 12 meses permitidos / no se le ofreció la alternativa sin permanencia mínima].

ACCIÓN TOMADA:
1. Se ha recalculado el valor a pagar, correspondiente a $[MONTO CORRECTO]
2. Se ha emitido nota crédito por la diferencia de $[MONTO]
3. Se ha dado por terminada la cláusula de permanencia mínima conforme a lo solicitado

Atentamente,
[NOMBRE OPERADOR]
Departamento Comercial`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su reclamo sobre el cobro de $[MONTO] por terminación anticipada de su cláusula de permanencia mínima.

HALLAZGO:
Su contrato del [FECHA] pactó una permanencia mínima de [X] meses, con un descuento en el cargo por conexión de $[MONTO DESCUENTO]. El valor cobrado de $[MONTO] corresponde exactamente al saldo pendiente de dicho descuento a la fecha de terminación, conforme al Art. 2.1.4.1.

CONCLUSIÓN:
El cobro es correcto y se ajusta a la normativa vigente, por lo que el reclamo NO PROCEDE.

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]
Departamento Comercial`,
    guia: `PREGUNTAS CLAVE:
1. ¿La permanencia mínima está respaldada por un descuento o diferimiento real del cargo por conexión?
2. ¿El período pactado supera los 12 meses?
3. ¿El valor cobrado por terminación anticipada corresponde al saldo real adeudado, o al valor total del período restante?
4. ¿Se ofreció la alternativa de contratar sin permanencia mínima?

DOCUMENTOS A REVISAR:
- Contrato con el detalle de la cláusula de permanencia mínima (montos, fechas)
- Historial de facturación mostrando el descuento/diferimiento aplicado
- Comparación de tarifas con y sin permanencia mínima ofrecidas al usuario

ERRORES COMUNES:
❌ Cobrar el valor total del período restante en vez del saldo real adeudado del descuento/diferimiento
❌ Pactar permanencia mínima superior a 12 meses
❌ No informar claramente en la factura las fechas de inicio y fin de la permanencia`,
  },

  {
    servicio: 'INTERNET FIJO',
    codigo: 'ISP-FIJ-004',
    nombre: 'Velocidad contratada e información sobre velocidad efectiva de Internet',
    incidencia: 'N/D',
    severidad: 'Media',
    norma: 'Título II, Cap. 1 (Régimen de Protección — CRC 5050)',
    normativa: `El contrato de acceso a Internet fijo o móvil debe incluir la velocidad contratada (fijo), la capacidad máxima incluida en el plan (cuando aplique), las tarifas, y si el servicio es de banda ancha (cuando aplique). Antes de suscribir el contrato, el operador debe informar los principales factores que limitan la velocidad efectiva, diferenciando los que están bajo su control de los que le son ajenos.

OBLIGACIONES:
- Los planes publicitados o contratados como "ilimitados" no pueden tener restricciones distintas a las de la tecnología empleada y la velocidad efectiva ofrecida
- Poner a disposición del usuario (para Internet fijo, mediante aplicación gratuita del operador) una herramienta para consultar la velocidad de envío y descarga contratada frente a la efectivamente recibida

CRITERIOS DE RESOLUCIÓN:
✓ Acoger: Si mediciones técnicas confirman que la velocidad efectiva está reiteradamente muy por debajo de la contratada, por causas atribuibles al operador, o si no se dispone de herramienta de consulta de velocidad
✗ Rechazar: Si las mediciones están dentro de los parámetros de velocidad efectiva informados al contratar, o la causa es ajena al operador (ej. red interna, WiFi, dispositivo del usuario)`,
    plantillaSi: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - ACEPTADO

Revisamos su reclamo sobre la velocidad de su servicio de Internet, contratada en [VELOCIDAD CONTRATADA].

HALLAZGO:
Nuestras mediciones técnicas confirman una velocidad efectiva de [VELOCIDAD MEDIDA], por debajo de los parámetros informados al contratar, originada en [CAUSA: infraestructura de acceso/nodo/enlace].

ACCIÓN TOMADA:
1. Se ha realizado el ajuste técnico correspondiente en [COMPONENTE]
2. Se aplicará compensación de $[MONTO] por el período afectado, si corresponde
3. Se hará seguimiento durante [PERÍODO] para confirmar la estabilidad de la velocidad

Atentamente,
[NOMBRE OPERADOR]
Departamento Técnico`,
    plantillaNo: `Ref. PQR: [NÚMERO-PQR] | Fecha: [DD/MM/YYYY]

Señor(a) [NOMBRE CLIENTE],

RESPUESTA A SU RECLAMO - RECHAZADO

Revisamos su reclamo sobre la velocidad de su servicio de Internet.

HALLAZGO:
Nuestras mediciones muestran una velocidad efectiva de [VELOCIDAD MEDIDA], dentro de los parámetros informados al contratar. La diferencia observada por usted es compatible con [CAUSA AJENA: uso simultáneo de múltiples dispositivos, conexión WiFi con interferencia, capacidad del equipo terminal].

CONCLUSIÓN:
No se evidencia incumplimiento atribuible al operador, por lo que el reclamo NO PROCEDE.

RECOMENDACIONES:
1. Realizar la prueba de velocidad por cable directo, no por WiFi
2. Verificar la cantidad de dispositivos conectados simultáneamente
3. Actualizar el firmware del router

Derechos: Puede recurrir ante la SIC en los 10 días hábiles posteriores.

Atentamente,
[NOMBRE OPERADOR]
Departamento Técnico`,
    guia: `PREGUNTAS CLAVE:
1. ¿Cuál es la velocidad contratada y cuál la medida técnicamente (por cable, no WiFi)?
2. ¿La medición se hizo en horario de máxima congestión o en condiciones normales?
3. ¿El usuario tiene acceso a la herramienta gratuita de medición del operador?
4. ¿Es un plan "ilimitado"? ¿La restricción reclamada es tecnológica o comercial?

DOCUMENTOS A REVISAR:
- Ficha técnica del plan contratado (velocidad de subida/bajada)
- Mediciones técnicas oficiales (no reportadas por el usuario vía apps de terceros)
- Información precontractual sobre factores que limitan la velocidad efectiva

ERRORES COMUNES:
❌ Comparar mediciones hechas por WiFi contra la velocidad contratada por cable
❌ No ofrecer o no tener disponible la herramienta gratuita de medición de velocidad
❌ Ignorar mediciones reiteradas y consistentes por debajo del umbral aceptable`,
  },
]
