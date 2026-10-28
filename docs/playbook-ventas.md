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
- Se pone sobre la mesa en la primera reunión, no al final: "Un ISP como el suyo suele invertir entre $199 mil y $890 mil al mes en tener esto cubierto. ¿Eso está dentro de lo razonable?"
- Ancla de valor: una nómina interna regulatoria cuesta $12M+ al mes; una sola multa o un diagnóstico por separado ($4.5M) cuesta más que un año de plan Básica.

**Decisión.** ¿Habla con quien firma?
- En ISP pequeño es el dueño o gerente. Si no está en la reunión: "¿Cuándo podemos hablar los tres para que usted no tenga que explicarle todo?"

## 5. Cómo conseguir la reunión (el cuello de botella)

Principio: **no se vende el plan, se vende una reunión de 20 minutos** con un resultado concreto para ellos.
Gancho: *"Le muestro en 20 minutos qué obligaciones le aplican y cuáles tiene en riesgo, con su porcentaje de cumplimiento."*
El Autodiagnóstico gratuito (5 min) y el Mapa de Madurez son la prueba tangible.

### Guion de llamada, ~2 minutos

1. **Apertura:** "Buenos días, [Nombre]. Habla [Tu nombre], abogado(a) de Owl Compliance. ¿Tiene dos minutos?"
2. **Razón de la llamada:** el webinar al que asistió o el mensaje que le escribimos.
3. **Dolor (una pregunta):** "¿Qué tan tranquilo está con los reportes y las fechas de este año?"
4. **Cierre de la cita:** "Para no quitarle tiempo, le propongo 20 minutos: revisamos su caso y le digo con claridad qué le aplica. ¿Le sirve el [martes 10:00] o el [miércoles 15:00]?" (siempre dos opciones concretas).
5. Si dice "envíeme información": "Con gusto. Para enviarle lo que le sirve y no un PDF genérico, ¿puedo hacerle dos preguntas?" y volver al paso 3. Si insiste: enviar el enlace del autodiagnóstico y **dejar el próximo paso anotado**.

### Cold mailing

Usar los mensajes de la pestaña "Mensajes" de cada prospecto. Solo para quienes **no** están en la base del
webinar. La meta del primer mensaje es una respuesta, no la reunión.

### Cadencia del webinar del 21 de octubre (433 registrados)

Webinar "Que el MinTIC no sancione tu ISP", con Inerxia AI y Nicolás Almeyda. Repartido en partes iguales entre el
superadmin, Adriana Linares y David Osorio (parejo en asistentes e inscritos; los contactos de una misma empresa
quedan con la misma persona, y las empresas que ya estaban en el cold mailing, con quien las tenía).
Los textos están en `lib/cadencias.ts`. WhatsApp en "tú" y llamadas en "usted", como en la invitación.

**Asistieron (117)**, todos arrancan el primer día, de mayor a menor tiempo conectado:

| Paso | Cuándo (días hábiles) | Canal | Qué busca |
|---|---|---|---|
| 1 | Día 0 | WhatsApp | Gracias y una pregunta: qué le preocupa de lo que vio. Quien estuvo menos de 30 min recibe otra apertura |
| 2 | +1 | Llamada | Si no respondió: reportes y visitas del MinTIC, y propuesta de 20 minutos |
| 3 | +2 | WhatsApp | Propuesta concreta de reunión de 20 minutos con dos horarios |
| 4 | +3 | WhatsApp | Alternativa: autodiagnóstico gratuito de 5 minutos |
| 5 | +4 | WhatsApp | Cierre amable: "¿lo dejamos para más adelante?" |

**Inscritos que no asistieron (316)** arrancan de a 25 por persona por día desde el día hábil siguiente, para no
mandar cientos de WhatsApp el mismo día desde un mismo número:

| Paso | Cuándo | Canal | Qué busca |
|---|---|---|---|
| 1 | Día 0 | WhatsApp | No alcanzó a conectarse: le contamos lo más importante en 20 minutos, aplicado a su ISP |
| 2 | +3 | WhatsApp | Autodiagnóstico gratuito |
| 3 | +4 | WhatsApp | Cierre amable |

Cómo se trabaja: cada uno abre **Prospectos → Para hoy**, abre el prospecto, oprime "Abrir en WhatsApp", envía y
marca **"Ya lo envié"** (el sistema programa el siguiente paso y pone el estado). Si contesta, **"Respondió"**: la
cadencia se detiene y toca agendar la reunión. Si termina sin respuesta, se marca No interesado ("no responde").
Los marcados "⚠ ¿ISP?" (estudiantes, independientes, cédulas en vez de empresa) se confirman en el primer
contacto y, si no son operadores, se descartan.

## 6. Guion de la reunión (20–30 min)

1. **Marco (2 min):** "Voy a hacerle preguntas sobre su operación; al final le digo con honestidad si OWL le sirve o no."
2. **Dolor (10 min):** preguntas de la sección 4. Anotar sus palabras textuales.
3. **Autodiagnóstico en vivo (5 min):** si no lo hizo, hacerlo juntos; el porcentaje preliminar da el dato de riesgo.
4. **Presupuesto y decisión (5 min):** como en la sección 4.
5. **Siguiente paso (3 min):** nunca terminar sin fecha. Si califica: "Le envío la propuesta hoy, y el [fecha] la revisamos juntos." Si no: cerrar bien y marcar No interesado con motivo.
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
  "Ya lo envié", "Respondió"), datos de contacto (incluido quién se inscribió al webinar) y, en Mensajes, los
  textos del cold mailing.
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
- **Leads** sigue recibiendo los formularios de la web por n8n (ver `leads-formularios.md`), solo para estadísticas.
- Pendiente fuera de la app (n8n): alerta diaria por correo de lo que toca hoy y lo atrasado.
