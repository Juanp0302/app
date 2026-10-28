# Playbook de ventas de OWL Compliance

Objetivo: que vender OWL no dependa de una sola persona. Todo lo que hoy está en la cabeza del fundador queda aquí
y en el pipeline del dashboard (`/dashboard/leads` → "Pipeline de ventas").

**Diagnóstico de partida:** casi no hay objeciones; el problema es que **no hay reuniones**. Por eso el sistema
se mide en una sola métrica: **reuniones realizadas por semana**. Todo lo demás (calificar, propuesta, cierre)
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

Se trabaja siempre de más caliente a más frío. El pipeline ordena las tarjetas así.

| Temp. | Quién | Cómo se contacta | Meta |
|---|---|---|---|
| 1 | **Asistió al webinar** (150+) | Llamada o WhatsApp personal en 48 h, citando el tema que vio | Reunión |
| 2 | **Inscrito, no asistió** (250+) | WhatsApp ofreciendo contarle en 20 min lo más importante del webinar, aplicado a su empresa | Reunión |
| 3 | Pidió contacto o hizo el autodiagnóstico | Llamada en el día, usando su % de cumplimiento | Reunión |
| 4 | Frío (cold mailing, `prospectos`) | Secuencia WhatsApp día 0 / 6 / 12 ya cargada | Respuesta y reunión |

**Regla de cruce:** si una empresa del cold mailing también está en la base del webinar, **se trabaja por el flujo
del webinar** y no se le hace cold mailing. El script `scripts/importar-webinar.mjs` la marca (etiqueta morada
"Webinar" en Prospectos).

## 3. Las etapas y qué debe pasar para avanzar

| Etapa | Entra cuando | Requisito que el sistema exige |
|---|---|---|
| **Nuevo** | Llega un lead o se importa | — |
| **Contactado** | Hubo un intento real (llamada contestada, WhatsApp respondido) | — |
| **Reunión agendada** | Hay fecha y hora confirmadas | Fecha en "Próxima acción" |
| **Reunión realizada** | La reunión ocurrió | Dolor registrado (mínimo "Parcial") |
| **Propuesta** | Se envía la propuesta del plan | Dolor y Decisión **Confirmados**, Presupuesto al menos **Parcial**, plan objetivo elegido |
| **Ganado** | Pagó o firmó (Trazo/Wompi) | — |
| **Perdido** | Se descarta | Motivo escrito (sin dolor / sin presupuesto / no decide / no responde) |

Un "no" temprano vale oro: marcar *Perdido* con motivo es un buen resultado, no un fracaso.

## 4. Calificación: Dolor, Presupuesto, Decisión

Se califica **en la reunión** (0 = sin info, 1 = parcial, 2 = confirmado). No se envía propuesta sin pasar el filtro.

**Dolor.** ¿Tiene un problema que le cuesta plata, tiempo o tranquilidad y que OWL resuelve?
- Preguntas: "¿Han recibido algún requerimiento de la SIC o el MinTIC?", "¿Quién se encarga hoy de los reportes y quién se acuerda de las fechas?", "¿Qué pasaría si un reporte sale tarde?", "¿Cuándo fue la última vez que revisaron sus contratos de condiciones uniformes?"
- Confirmado (2) = lo dijo con sus palabras y puede ponerle un costo (multa, horas, riesgo). Se anota en "Dolor en sus palabras".
- Regla: **si no hay dolor, no hay venta.** Se cierra con cariño y se pasa a Perdido o a nutrición.

**Presupuesto.** ¿Quiere y puede pagar?
- Se pone sobre la mesa en la primera reunión, no al final: "Un ISP como el suyo suele invertir entre $199 mil y $890 mil al mes en tener esto cubierto. ¿Eso está dentro de lo razonable?"
- Ancla de valor: una nómina interna regulatoria cuesta $12M+ al mes; una sola multa o un diagnóstico por separado ($4.5M) cuesta más que un año de plan Básica.

**Decisión.** ¿Habla con quien firma?
- En ISP pequeño es el dueño o gerente. Si no está en la reunión: "¿Cuándo podemos hablar los tres para que usted no tenga que explicarle todo?"
- Confirmado (2) = el decisor estuvo presente o dijo expresamente que decide solo.

## 5. Cómo conseguir la reunión (el cuello de botella)

Principio: **no se vende el plan, se vende una reunión de 20 minutos** con un resultado concreto para ellos.
Gancho: *"Le muestro en 20 minutos qué obligaciones le aplican y cuáles tiene en riesgo, con su porcentaje de cumplimiento."*
El Autodiagnóstico gratuito (5 min) y el Mapa de Madurez son la prueba tangible.

### Guion de llamada (temperatura 1 y 3), ~2 minutos

1. **Apertura:** "Buenos días, [Nombre]. Habla [Tu nombre] de OWL Compliance. Usted estuvo en el webinar sobre [tema]. ¿Tiene dos minutos?"
2. **Razón de la llamada:** "Quería preguntarle algo que salió en el webinar: [visitas del MinTIC / reportes]. ¿Ustedes ya lo tienen cubierto?"
3. **Dolor (una pregunta):** "¿Qué tan tranquilo está con los reportes y las fechas de este año?"
4. **Cierre de la cita:** "Para no quitarle tiempo, le propongo 20 minutos: revisamos su caso y le digo con claridad qué le aplica. ¿Le sirve el [martes 10:00] o el [miércoles 15:00]?" (siempre dos opciones concretas).
5. Si dice "envíeme información": "Con gusto. Para enviarle lo que le sirve y no un PDF genérico, ¿puedo hacerle dos preguntas?" y volver al paso 3. Si insiste: enviar el enlace del autodiagnóstico y **dejar fecha de seguimiento en el sistema**.

### WhatsApp (temperatura 2)

> Hola [Nombre], le escribe [Tu nombre] de OWL Compliance. Vi que se inscribió al webinar sobre [tema] y no alcanzó a conectarse.
> Si le sirve, le cuento en 20 minutos lo más importante, aplicado a [Empresa]. ¿Le queda mejor el [día 1] o el [día 2]?

Sigue el mismo patrón día 0 / 6 / 12 de la secuencia de Prospectos: apertura, valor, cierre. En cada mensaje **una sola pregunta**.

### Cold mailing (temperatura 4)

Usar los textos de la tabla de Prospectos. Solo para quienes **no** están en la base del webinar. La meta del primer mensaje es una respuesta, no la reunión.

### Cadencia del webinar del 21 de octubre (433 registrados)

Webinar "Que el MinTIC no sancione tu ISP", con Inerxia AI y Nicolás Almeyda. Se importó con
`scripts/importar-webinar.mjs`, repartido en partes iguales entre el superadmin, Adriana Linares y David Osorio
(parejo en asistentes e inscritos; los contactos de una misma empresa quedan con la misma persona).
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

Cómo se trabaja: cada uno abre **Leads → Para hoy**, abre el lead, oprime "Abrir en WhatsApp", envía y marca
**"Ya lo envié"** (el sistema programa el siguiente paso). Si contesta, **"Respondió"**: la cadencia se detiene y
toca agendar la reunión con los guiones de la etapa. Si termina sin respuesta, se marca Perdido ("no responde").
Los leads marcados "⚠ Revisar si es un ISP" (estudiantes, independientes, cédulas en vez de empresa) se confirman
en el primer contacto y, si no son operadores, se descartan.

## 6. Guion de la reunión (20–30 min)

1. **Marco (2 min):** "Voy a hacerle preguntas sobre su operación; al final le digo con honestidad si OWL le sirve o no."
2. **Dolor (10 min):** preguntas de la sección 4. Anotar sus palabras textuales.
3. **Autodiagnóstico en vivo (5 min):** si no lo hizo, hacerlo juntos; el porcentaje preliminar da el dato de riesgo.
4. **Presupuesto y decisión (5 min):** como en la sección 4.
5. **Siguiente paso (3 min):** nunca terminar sin fecha. Si califica: "Le envío la propuesta hoy, y el [fecha] la revisamos juntos." Si no: cerrar bien y marcar Perdido con motivo.
6. **Ese mismo día:** registrar la calificación en el pipeline y mover la etapa.

## 7. Qué recomendar según lo que encuentres

- Solo necesita no olvidar reportes y plantillas → **Básica**.
- Tiene requerimientos, CCU sin revisar o visitas próximas → **Pro** (el Diagnóstico de $4.5M viene incluido).
- Investigación en curso, espectro/PSO o quiere presencia en visitas → **Premium**.
- Quiere probar sin suscripción → **Diagnóstico** suelto ($4.5M; el 40% de descuento aplica al contratar Básica).

## 8. El recetario: la actividad diaria

La meta se baja a actividades. Fórmula (`recetario()` en `lib/pipeline.ts`):
**contactos necesarios = reuniones deseadas por semana ÷ tasa contacto→reunión**.

Con una tasa inicial supuesta de 10 % (se reemplaza por la real del embudo a las 3 semanas):

| Meta | Contactos/semana | Contactos/día |
|---|---|---|
| 3 reuniones/semana | 30 | 6 |
| 5 reuniones/semana | 50 | 10 |
| 8 reuniones/semana | 80 | 16 |

Rutina diaria (≈ 90 min):
1. **Seguimientos atrasados** (el pipeline marca los rojos) — primero siempre.
2. **Temperatura 1 y 3** nuevos del día.
3. **Temperatura 2** y 4 hasta completar el recetario.
4. Al final, actualizar etapas y *Próxima acción* de cada lead tocado. Sin fecha de próxima acción no se considera trabajado.

Revisión **semanal** (30 min, siempre el mismo día): embudo, reuniones de la semana vs. meta, leads atascados más de 10 días en la misma etapa, y qué mensaje obtuvo más respuestas.

## 9. Medir (qué mira el embudo del dashboard)

| Métrica | Dónde se ve | Para qué |
|---|---|---|
| **Reuniones realizadas por semana** | Embudo | La métrica principal (también se ven las agendadas) |
| Conversión entre etapas | Embudo ("% de la anterior") | Ver dónde se cae el proceso. Cuenta la etapa más alta a la que llegó cada lead, aunque después se pierda |
| Seguimientos atrasados | Embudo | Disciplina de la rutina |
| Leads por temperatura y origen | Tablero / Análisis | Qué base rinde más (webinar vs. cold) |
| Motivos de descarte | Etapa Perdido | Mejorar guion y selección |

## 10. Incorporar un vendedor nuevo (para que no dependa del fundador)

- **Día 1:** leer este playbook, acompañar como oyente 2 reuniones reales del fundador, hacer su propio autodiagnóstico.
- **Semana 1:** llamadas acompañadas; el vendedor habla y el fundador escucha. Registra todo en el pipeline.
- **Semana 2:** vendedor solo con temperatura 1 y 3; coaching diario de 15 min sobre **llamadas reales** (no teoría).
- **Scorecard semanal del vendedor:** contactos vs. recetario, reuniones agendadas, reuniones realizadas, % de leads con dolor/presupuesto/decisión calificados, seguimientos atrasados.
- Se evalúa contra el proceso (¿registró?, ¿calificó?, ¿dejó próxima acción?), no contra qué tan bien cae.
- Mejora continua: grabar (con permiso) las reuniones, extraer con IA las frases que lograron la cita y sumarlas a los guiones de arriba.

## 11. Operación en el sistema

- **Cargar la base del webinar:** exportar el Excel a CSV UTF-8 con columnas `nombre, empresa, correo, telefono, nit, asistio` y correr
  `node scripts/importar-webinar.mjs archivo.csv` (BD local) para probar; con `--prod` escribe en producción. Es seguro repetirlo: no duplica por correo.
- **Guiones en la ficha:** al abrir un lead aparece "Qué decirle", con los mensajes de este playbook ya llenos (nombre, empresa, tema del webinar, % del autodiagnóstico, fecha de la reunión) según su temperatura y etapa. Cada uno tiene "Abrir en WhatsApp" (abre el chat con el texto escrito; usted solo oprime enviar) y "Copiar". Los textos se editan en `lib/guiones-ventas.ts`. En un lead nuevo, el botón "Ya le escribí" lo pasa a Contactado con seguimiento en 3 días.
- **Un lead por contacto:** si alguien con el mismo correo, o de una empresa con el mismo NIT, llena otro formulario, no se crea otra tarjeta. El envío se suma al lead que ya existe (se ve en su ficha) y la temperatura queda en la más caliente de todos sus formularios. La tabla de análisis sigue mostrando cada envío.
- **Cada lead** tiene: etapa, calificación 0–6, dolor en sus palabras, plan objetivo, próxima acción con fecha y motivo de descarte; los cambios de etapa quedan en `leads_etapas`.
- Los formularios nuevos (autodiagnóstico, contacto, webinar) entran por n8n en etapa **Nuevo** (ver `leads-formularios.md`).
- Pendiente fuera de la app (n8n): alerta diaria de seguimientos atrasados por correo; hoy se ven en rojo en el tablero.
