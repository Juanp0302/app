# Playbook de ventas de OWL Compliance

Objetivo: que vender OWL no dependa de una sola persona. Todo lo que hoy está en la cabeza del fundador queda aquí
y en **Prospectos** (`/dashboard/prospectos`), que es donde trabaja el equipo. **Leads** (`/dashboard/leads`) queda
solo para estadísticas de formularios y campañas, y solo lo ve el superadmin.

**Diagnóstico de partida:** casi no hay objeciones; el problema es que **no hay reuniones**. Por eso el sistema
se mide en una sola métrica: **reuniones agendadas por semana**. Todo lo demás (calificar, propuesta, cierre)
empieza cuando ya hay una reunión.

## 1. A quién le vendemos (cliente ideal)

ISP pequeño (PRST) en Colombia, donde **decide el dueño o gerente**.

| Criterio | Sí perseguir | No perseguir |
|---|---|---|
| Tipo | ISP / PRST con registro TIC | Empresas fuera de telecomunicaciones |
| Tamaño | Micro y pequeño (plan Básica o Pro) | Operadores con área regulatoria propia (Premium, caso aparte) |
| Dolor visible | Requerimiento/investigación SIC o MinTIC, reportes que se les pasan, sin abogado TIC | "Estoy curioseando", sin ninguna obligación pendiente |
| Contacto | Habla con el dueño o gerente | Solo llega un auxiliar que no puede decidir ni presentarnos al jefe |

Planes de referencia (fuente: `Modelo_de_Pricing_Final_Reportes.xlsx`):

| Plan | Mes | Para quién |
|---|---|---|
| Básica (Radar) | $199.000 | ISP micro; evita multas por omisión de reportes |
| Pro (Saneamiento) | $890.000 | ISP pequeño/mediano; incluye el Diagnóstico ($4.5M en mercado) |
| Premium (Blindaje) | $2.490.000 | ISP mediano-alto; soporte en visitas, espectro, reportes |

## 2. Temperatura: a quién se le escribe primero

Cada prospecto muestra una etiqueta **🔥 Caliente / 🌤 Tibio / ❄ Frío** (más ✓ Cliente y — Descartado), con el
porqué al lado. No se pone a mano: se calcula sola (`lib/temperatura.ts`) cada vez que cambia algo, y se enfría
sola si pasan días sin respuesta. Se trabaja siempre de más caliente a más frío.

| Señal | Puntos |
|---|---|
| Asistió al webinar | +45 (y +15 si estuvo 60 min o más) |
| Inscrito al webinar | +25 |
| Prioridad A (investigación en marcha) / B (multa impuesta) | +15 / +10 |
| Respondió / En conversación | +30 / +40 |
| Reunión agendada o propuesta enviada | +60 |
| Sin respuesta (WA1 enviado o llamada sin contacto) 7 / 14 días | −10 / −20 |
| Conversación quieta 10 días o más | −20 |
| Terminó la cadencia sin respuesta | −20 |

**55 o más = Caliente · 25 a 54 = Tibio · menos de 25 = Frío.** Cliente, No interesado y No contactar tienen su
propia etiqueta. Ejemplos: un inscrito que no responde en dos semanas pasa de Tibio a Frío; un cold mailing que
responde pasa de Frío a Tibio; cualquiera con reunión agendada es Caliente.

**Regla de cruce:** si una empresa del cold mailing también está en la base del webinar, **se trabaja con la
cadencia del webinar** y no se le siguen mandando los mensajes del cold mailing. Queda en una sola fila, con su
responsable de siempre y el contacto que se inscribió al webinar (que puede no ser el representante legal).

## 3. Los estados y qué significa cada uno

Son los 10 estados de Prospectos, iguales para el cold mailing y el webinar:

| Estado | Cuándo |
|---|---|
| **Pendiente** | Todavía no se le ha escrito |
| **WA1 enviado** | Se envió el primer mensaje (el botón "Ya lo envié" de la cadencia lo pone solo) |
| **Respondió** | Contestó algo (el botón "Respondió" lo pone solo y detiene la cadencia) |
| **Llamada sin contacto** | Se llamó y no contestó (el paso de llamada de la cadencia lo pone solo) |
| **Conversación** | Hay intercambio real; se está buscando la reunión |
| **Reunión agendada** | Hay fecha y hora confirmadas |
| **Propuesta enviada** | Ya tuvo la reunión, califica (sección 4) y se le envió la propuesta |
| **Cliente** | Pagó o firmó (Trazo/Wompi) |
| **No interesado** | Se descarta; anotar el motivo en Notas (sin dolor / sin presupuesto / no decide / no responde) |
| **No contactar** | Pidió no ser contactado |

Un "no" temprano vale oro: marcar *No interesado* con motivo es un buen resultado, no un fracaso.

## 4. Calificación en la reunión: Dolor, Presupuesto, Decisión

Antes de enviar una propuesta tienen que estar claras las tres. Se anotan en las **Notas** del prospecto.

**Dolor.** ¿Tiene un problema que le cuesta plata, tiempo o tranquilidad y que OWL resuelve?
- Preguntas: "¿Han recibido algún requerimiento de la SIC o el MinTIC?", "¿Quién se encarga hoy de los reportes y quién se acuerda de las fechas?", "¿Qué pasaría si un reporte sale tarde?", "¿Cuándo fue la última vez que revisaron sus contratos de condiciones uniformes?"
- Está confirmado cuando lo dijo con sus palabras y puede ponerle un costo (multa, horas, riesgo). Anotar la frase textual.
- Regla: **si no hay dolor, no hay venta.** Se cierra con cariño y se marca No interesado.

**Presupuesto.** ¿Quiere y puede pagar?
- Se pone sobre la mesa en la primera reunión, no al final: "Un ISP como el tuyo suele invertir entre $199 mil y $890 mil al mes en tener esto cubierto. ¿Eso te parece razonable?"
- Ancla de valor: una nómina interna regulatoria cuesta $12M+ al mes; una sola multa o un diagnóstico por separado ($4.5M) cuesta más que un año de plan Básica.

**Decisión.** ¿Habla con quien firma?
- En ISP pequeño es el dueño o gerente. Si no está en la reunión: "¿Cuándo podemos hablar los tres para que no tengas que explicárselo todo tú?"

## 5. Cómo conseguir la reunión (el cuello de botella)

Principio: **no se vende el plan, se vende una reunión de 15 minutos** con un resultado concreto para ellos.
Gancho: *"Te muestro en 15 minutos qué obligaciones te aplican y cuáles tienes en riesgo, con tu porcentaje de cumplimiento."*
El Autodiagnóstico gratuito (5 min) y el Mapa de Madurez son la prueba tangible.

### Guion de llamada, ~2 minutos

1. **Apertura:** "Hola, [Nombre]. Habla [Tu nombre], abogado(a) de Owl Compliance. ¿Tienes un minuto?"
2. **Razón de la llamada:** la radiografía o el mensaje que te escribimos por WhatsApp.
3. **Dolor (una pregunta):** "¿Qué tan tranquilo estás con los reportes y las fechas de este año?"
4. **Cierre de la cita:** "Para no quitarte tiempo, te propongo 15 minutos: revisamos tu caso y te digo con claridad qué te aplica. Te envío el enlace para que elijas el horario." (el calendario público de Owl: https://calendar.app.google/3rizAH6m6afFaFkJ8).
5. Si dice "envíame información": "Con gusto. Para enviarte lo que te sirve y no un PDF genérico, ¿puedo hacerte dos preguntas?" y volver al paso 3. Si insiste: enviar el enlace del autodiagnóstico y **dejar el próximo paso anotado**.

### Los mensajes: todo en tú, completos en cada ficha

Los mensajes de contacto, por WhatsApp y por llamada, van **en "tú"**. El primer mensaje lleva siempre la página de servicios
(https://www.owlcompliance.com/servicios) para que conozcan lo que hace Owl, y en todos se habla de reuniones de **15 minutos** con el
enlace al calendario público. En la ficha de **cada** prospecto, pestaña **Mensajes**, están los textos completos, ya con su nombre,
su empresa y quien firma: la **secuencia de contacto** (cada paso con su momento y si ya se hizo) y lo que se envía **cuando responde**.
No dependen de lo que haya guardado en la base: los ven igual los del cold mailing, los del webinar y las bases cargadas desde Excel.
La invitación al webinar ya no va; los guiones viejos de servicio no se muestran (siguen en la base) y las investigaciones de cada empresa
quedan como "contexto para la llamada", plegadas.

### La radiografía regulatoria y su mensaje

La radiografía es un PDF de una página que Owl prepara para cada ISP: lo que ve el MinTIC de su empresa (investigaciones y
sanciones), sus pagos regulatorios y sus próximos cinco vencimientos. Se genera con
`Marketing/Cold Mailing/Tercera campaña/radiografia_generador/generar.py` (ver su cabecera). El PDF mismo queda en "usted", como documento formal.
Cuando un prospecto tiene su radiografía cargada en la app, **su primer mensaje es este** (aprobado el 4 de noviembre de 2026 en "usted" y
pasado a "tú", con la página de servicios, el 6 de noviembre):

> Hola, **{nombre}**. Soy **{Adriana / David / Juan Pablo}** de Owl Compliance, firma especializada en cumplimiento regulatorio
> para operadores de internet en Colombia. **{frase del webinar}**
>
> Después del webinar preparamos para **{ISP}** una radiografía regulatoria de una página: en dos minutos verás lo que hoy ve
> el MinTIC de tu empresa, tus pagos regulatorios y tus próximos vencimientos. Te recomiendo mirar **{punto concreto}**.
>
> Aquí puedes conocer nuestros servicios: https://www.owlcompliance.com/servicios
>
> Si te parece, la revisamos en una videollamada de 15 minutos y hacemos juntos el autodiagnóstico de cumplimiento, para que sepas
> exactamente en qué estás bien y qué te falta. Puedes elegir el horario que te quede mejor aquí: https://calendar.app.google/3rizAH6m6afFaFkJ8

La app llena sola todo lo que está entre llaves:

| Dato | De dónde sale |
|---|---|
| Nombre | El primer nombre de quien se inscribió al webinar o, si no hay, del representante legal. Si no sirve ("Sin dato", un punto, una cédula), saluda "Hola." sin nombre |
| Quién firma | El **responsable del prospecto**: Adriana, David o, si es del superadmin, **Juan Pablo**. Así el mensaje es el mismo lo abra quien lo abra. Si el superadmin contacta un prospecto de otra persona, en su ficha pulsa "firmar como yo" |
| Frase del webinar | Asistió: "Gracias por acompañarnos en el webinar del 21 de octubre con Nicolás Almeyda." · Inscrito que no asistió: "Vi que te inscribiste al webinar… y no alcanzaste a conectarte." · Cold mailing sin webinar: sin frase, y "Después del webinar preparamos" pasa a "Preparamos" |
| ISP | El nombre de la empresa; si lo escrito no es un nombre ("Na", una cédula), dice "tu ISP" |
| Punto concreto | Prioridad A: "el punto 1, donde figura la investigación abierta en el MinTIC" · Prioridad B: "el punto 1, donde figura la sanción registrada (año)" · Sin sanciones: "el punto 2: el reporte {código y nombre}, que vence el {fecha}", tomado del calendario (`lib/calendario-isp.json`, el mismo que usa el generador; se actualiza en los dos) |

**Cómo se usa:** en la ficha del prospecto aparece "📄 Radiografía regulatoria" con el botón **"⬇ Descargar PDF"**. Se descarga el PDF,
se abre el WhatsApp con el mensaje ya escrito y se adjunta el PDF en el mismo chat. Si la radiografía tiene más de 7 días, la ficha avisa que
sus vencimientos pueden haber cambiado. Sin radiografía cargada, el primer mensaje no la menciona: se presenta, pregunta y manda la página de servicios.

**Cómo se cargan (superadmin):**
1. Generar los PDF (desde `radiografia_generador`, con la fecha de hoy por defecto; ver la cabecera de `generar.py`):
   - **Los 200 del cold mailing:** `python generar.py --todas --salida "<carpeta>"`. Traen su situación real ante el MinTIC (investigación abierta,
     sanción registrada o ninguna), que sale del Excel `Prospectos_ISP_Abordaje_v2.xlsx`.
   - **Los demás (webinar y bases cargadas):** primero `node scripts/exportar-prospectos-radiografia.mjs --prod --salida <archivo.json>` (solo lee la
     base: deja una vez cada empresa y aparta las que no parecen un ISP) y luego `python generar.py --json <archivo.json> --salida "<carpeta>"`.
   - **Sin NIT no pasa nada:** la cabecera omite el NIT y el archivo se llama solo con el nombre; la app lo empareja por nombre. Con NIT, el archivo lo lleva
     (`Radiografia_900860597_WINETS_S_A_S_.pdf`) y el emparejamiento es exacto.
   - **Sin información de sanciones no se afirma nada:** de las empresas que no están en el Excel no tenemos esa base, así que su tarjeta dice
     **"Por confirmar"** en vez de "Ninguna identificada". Si alguna se verifica a mano, se genera con `--manual`.
   - La invitación del PDF dice **15 minutos**, igual que los mensajes.
2. En Prospectos, botón **"📄 Cargar radiografías"**: elegir todos los PDF a la vez. Muestra a qué empresa irá cada uno y cuáles no tienen
   prospecto (no se cargan). Se emparejan por el NIT del archivo o, si no lo trae, por el nombre de la empresa. Si una empresa tiene varias
   filas (un contacto por fila), todas reciben su radiografía. Cargar de nuevo reemplaza la anterior.
3. Antes de enviar, regenerar con la fecha de hoy: las radiografías viejas traen vencimientos que ya pasaron.

### Las tres cadencias

Cada prospecto sigue una cadencia, según de dónde viene. Los textos están en `lib/cadencias.ts` (dos versiones: con radiografía y sin ella).
Los pasos se programan en días hábiles, sin sábados, domingos ni festivos.

**Asistió al webinar del 21 de octubre ("Que el MinTIC no sancione tu ISP", con Inerxia AI y Nicolás Almeyda; 117):**

| Paso | Cuándo (días hábiles) | Canal | Qué busca |
|---|---|---|---|
| 1 | Día 0 | WhatsApp | Con radiografía: el mensaje de arriba. Sin ella: gracias y una pregunta sobre qué le preocupa de lo que vio (quien estuvo menos de 30 min recibe otra apertura), más la página de servicios |
| 2 | +1 | Llamada | Si no respondió: reportes y visitas del MinTIC, y propuesta de 15 minutos |
| 3 | +2 | WhatsApp | Propuesta de reunión de 15 minutos con el enlace al calendario |
| 4 | +3 | WhatsApp | Alternativa: autodiagnóstico gratuito de 5 minutos |
| 5 | +4 | WhatsApp | Cierre amable: "¿lo dejamos para más adelante?" |

**Inscritos que no asistieron (316)**, de a 25 por persona por día para no mandar cientos de WhatsApp desde un mismo número:

| Paso | Cuándo | Canal | Qué busca |
|---|---|---|---|
| 1 | Día 0 | WhatsApp | Con radiografía: el mensaje de arriba ("no alcanzaste a conectarte"). Sin ella: te cuento lo más importante en 15 minutos, más la página de servicios |
| 2 | +3 | WhatsApp | Autodiagnóstico gratuito |
| 3 | +4 | WhatsApp | Cierre amable |

**Cold mailing y bases cargadas desde Excel (los que no están en el webinar):** los mismos 5 pasos que los asistentes, sin la frase del
webinar ("Preparamos para {ISP} una radiografía…"). Sin radiografía, el primer mensaje se presenta ("Acompañamos a los ISP en el cumplimiento
ante la CRC, el MinTIC y la SIC") y pregunta cómo manejan hoy los reportes y los vencimientos. Se activa con
`node scripts/cadencia-cold-mailing.mjs --prod` (primero `--dry --prod`): pone el paso 1 y la fecha, de a 25 por responsable por día desde el día
hábil siguiente, empezando por investigación abierta (A), luego sanción registrada (B) y luego los demás por su puesto.

**Cuando responde** (para todos los perfiles; lo que va entre [CORCHETES] se completa a mano):
1. Si pide más información: la página de servicios y la propuesta de revisar su radiografía en 15 minutos.
2. Confirmar la reunión, apenas se agenda.
3. Recordatorio, un día antes.
4. Si no se conectó: otro horario del calendario.
5. Resumen después de la reunión: lo que se encontró, y cuándo llega la propuesta.
6. Seguimiento de la propuesta, 2 días después de enviarla.

Cómo se trabaja: cada uno abre **Prospectos → Para hoy**, abre el prospecto, oprime "Abrir en WhatsApp", envía y
marca **"Ya lo envié"** (el sistema programa el siguiente paso y pone el estado). Si contesta, **"Respondió"**: la
cadencia se detiene y toca agendar la reunión con los mensajes de "Cuando responde". Si termina sin respuesta, se marca No interesado ("no responde").
Los marcados "⚠ ¿ISP?" (estudiantes, independientes, cédulas en vez de empresa) se confirman en el primer
contacto y, si no son operadores, se descartan.

## 6. Guion de la reunión (hasta 30 min; en los mensajes siempre se dice 15)

1. **Marco (2 min):** "Voy a hacerte preguntas sobre tu operación; al final te digo con honestidad si OWL te sirve o no."
2. **Dolor (10 min):** preguntas de la sección 4. Anotar sus palabras textuales.
3. **Autodiagnóstico en vivo (5 min):** si no lo hizo, hacerlo juntos; el porcentaje preliminar da el dato de riesgo.
4. **Presupuesto y decisión (5 min):** como en la sección 4.
5. **Siguiente paso (3 min):** nunca terminar sin fecha. Si califica: "Te envío la propuesta hoy, y el [fecha] la revisamos juntos." Si no: cerrar bien y marcar No interesado con motivo.
6. **Ese mismo día:** anotar dolor, presupuesto y decisión en las Notas y cambiar el estado.

## 7. Qué recomendar según lo que encuentres

- Solo necesita no olvidar reportes y plantillas → **Básica**.
- Tiene requerimientos, CCU sin revisar o visitas próximas → **Pro** (el Diagnóstico de $4.5M viene incluido).
- Investigación en curso, espectro/PSO o quiere presencia en visitas → **Premium**.
- Quiere probar sin suscripción → **Diagnóstico** suelto ($4.5M; el 40% de descuento aplica al contratar Básica).

## 8. El recetario: la actividad diaria

La meta se baja a actividades: **contactos necesarios = reuniones deseadas por semana ÷ tasa contacto→reunión**.

Con una tasa inicial supuesta de 10 % (se reemplaza por la real después de unas semanas):

| Meta | Contactos/semana | Contactos/día |
|---|---|---|
| 3 reuniones/semana | 30 | 6 |
| 5 reuniones/semana | 50 | 10 |
| 8 reuniones/semana | 80 | 16 |

Rutina diaria (≈ 90 min):
1. **Para hoy**: lo atrasado (⚠ en rojo) primero, siempre.
2. Lo demás de **Para hoy**, que ya viene ordenado de más caliente a más frío.
3. Los 🔥 Calientes que respondieron y todavía no tienen reunión.
4. Al final, revisar que cada prospecto tocado tenga estado y próximo paso al día.

Revisión **semanal** (30 min, siempre el mismo día): cuántos 🔥 hay y cuántos pasaron a Reunión agendada, quiénes
llevan más de 10 días quietos, y qué mensaje obtuvo más respuestas.

## 9. Medir

| Métrica | Dónde se ve | Para qué |
|---|---|---|
| **Reuniones agendadas** | Prospectos, contador del estado "Reunión agendada" | La métrica principal |
| Cuántos hay por temperatura | Prospectos, botones 🔥 / 🌤 / ❄ | Ver si la base se calienta o se enfría |
| Por estado | Prospectos, barra de estados de arriba | Ver dónde se atasca el proceso |
| Por campaña | Prospectos, filtro de campaña | Qué base rinde más (webinar vs. cold mailing) |
| Atrasados | Prospectos, "Para hoy" (⚠) | Disciplina de la rutina |
| Formularios y campañas web | Leads (solo superadmin) | De dónde llegan los contactos de la web |

## 10. Incorporar un vendedor nuevo (para que no dependa del fundador)

- **Día 1:** leer este playbook, acompañar como oyente 2 reuniones reales del fundador, hacer su propio autodiagnóstico.
- **Semana 1:** llamadas acompañadas; el vendedor habla y el fundador escucha. Registra todo en Prospectos.
- **Semana 2:** vendedor solo con los 🔥 y 🌤; coaching diario de 15 min sobre **llamadas reales** (no teoría).
- **Scorecard semanal del vendedor:** "Para hoy" al día, reuniones agendadas, prospectos que pasaron a Respondió, atrasados.
- Se evalúa contra el proceso (¿registró?, ¿calificó?, ¿dejó próximo paso?), no contra qué tan bien cae.
- Mejora continua: grabar (con permiso) las reuniones, extraer con IA las frases que lograron la cita y sumarlas a los guiones de arriba.

## 11. Operación en el sistema

- **Prospectos** es la herramienta de trabajo: cada admin ve solo los suyos; el superadmin ve todos, filtra por
  responsable y reasigna (uno a uno o en lote).
- **Filtros:** "Para hoy" (pasos de la cadencia que tocan hoy o están atrasados), temperatura (🔥 / 🌤 / ❄),
  campaña (cold mailing, webinar asistieron, webinar inscritos), estado, prioridad y responsable.
- **Ficha:** temperatura con su porqué, la cadencia con el mensaje del paso ya escrito ("Abrir en WhatsApp",
  "Ya lo envié", "Respondió"), datos de contacto (incluido quién se inscribió al webinar) y, en la pestaña
  Mensajes, todos los textos de su cadencia más los de "Cuando responde", completos y en tú.
- **Cargar otra base de contactos (superadmin):** en Prospectos, botón **"⬆ Cargar base"**. Se sube un .xlsx o
  .csv (primera hoja; primera fila con encabezados como empresa o ISP, nombre o contacto, correo, celular o teléfono,
  NIT, municipio, departamento, notas, en cualquier orden), se le pone nombre a la campaña y se marcan los
  responsables. **"Ver vista previa"** muestra, sin escribir nada, qué columnas reconoció, cuántos le tocan a cada
  uno, cuáles ya están en Prospectos (no se duplican ni se reasignan) y cuáles parecen no ser ISP. **"Cargar"** los
  crea en estado Pendiente, prioridad O, con la campaña como etiqueta y filtro, repartidos en partes iguales (los de
  una misma empresa con la misma persona). Subir el mismo archivo otra vez no duplica nada. Máximo 5 MB / 5.000 filas.
  Lógica en `lib/carga-prospectos.ts`.
- **Cargar una base de webinar:** `scripts/importar-webinar.mjs` la carga en Leads (estadísticas), la reparte y
  programa la cadencia; después `scripts/webinar-a-prospectos.mjs` la pasa a Prospectos. Los dos tienen `--dry`
  para simular y `--prod` para producción, y se pueden repetir sin duplicar.
- **Completar el NIT de los prospectos:** `scripts/nit-desde-rutic.mjs "<ISP RUTIC - fecha.xlsx>"` (el listado del MinTIC, columnas
  "No. Identificación" y "Razón Social"). **Regla: si no estamos seguros, no se escribe nada**, porque un NIT equivocado haría que la
  radiografía muestre las sanciones de otra empresa. Solo toca los que tienen el NIT vacío y solo escribe el NIT, cuando el **nombre**
  coincide con una sola razón social del RUTIC (o con una sola vigente). Lo que coincide únicamente por **correo**, lo dudoso (varias
  empresas, nombre y correo que no coinciden) y lo que no aparece se lista aparte y se revisa a mano. También avisa si una misma
  empresa quedó en dos filas con distinto responsable. Con `--dry --prod` solo simula. El 4 de noviembre de 2026, con el RUTIC del 21 de
  agosto, se completaron 137 por nombre; se probaron 36 por correo y se quitaron (quedan 284 sin NIT).
- **Leads** sigue recibiendo los formularios de la web por n8n (ver `leads-formularios.md`), solo para estadísticas.
- Pendiente fuera de la app (n8n): alerta diaria por correo de lo que toca hoy y lo atrasado.
