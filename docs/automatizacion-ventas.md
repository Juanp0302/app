# Ventas automáticas

El objetivo es que el sistema haga solo el trabajo comercial repetitivo y que el equipo intervenga únicamente cuando alguien responde (y, más adelante, ni siquiera ahí: fases 3 y 4). Costo: cero. Usa la cuenta de Gmail que ya envía el contrato (SMTP para enviar e IMAP para leer) y GitHub Actions para el reloj (gratis; la instancia de n8n está llena).

## Fase 1 (esta): correo

| Qué | Cómo |
|---|---|
| Alguien llena un formulario de la web (contacto, autodiagnóstico) | `/api/leads` lo guarda en Leads (estadísticas) **y** lo crea en Prospectos: prioridad **E**, campaña `web`, cadencia **entrante**, responsable por reparto parejo, en modo automático. Si ya era prospecto (mismo correo o NIT), no se duplica: cuenta como respuesta. |
| Respuesta inmediata | Con el modo activo, recibe el primer correo en el mismo momento (con el calendario y la página de servicios). Su responsable recibe un aviso. |
| Cadencias por correo | Los prospectos en **modo automático** reciben su cadencia por correo: el primero con la radiografía en PDF adjunta, los siguientes en el mismo hilo. La llamada se salta y su espera se suma al paso siguiente. Días hábiles, de 8 a. m. a 6 p. m., máximo 30 por hora y 100 por día. |
| Respuestas | Cada hora se lee el buzón. Una respuesta detiene la cadencia, saca al prospecto de automático, lo pasa a "Respondió" y le avisa al responsable con el texto. Funciona también para los prospectos manuales. |
| Bajas | Todos los correos llevan un enlace de baja (página `/baja`, con confirmación) y la cabecera para darse de baja en un clic desde Gmail u Outlook. Si alguien responde "denme de baja", también. Queda en "No contactar" y no recibe más. |
| "No me interesa" | La cadencia termina y queda en "No interesado". |
| Rebotes | El correo se marca inválido, el prospecto sale de automático y el responsable recibe aviso (sigue por WhatsApp). |
| Respuestas automáticas ("fuera de la oficina") | Se ignoran: no detienen la cadencia. |
| Alertas | Si no se puede leer el buzón, si un correo no sale o si el ciclo falla, el superadmin recibe una alerta (una vez al día por problema). Si la app no responde, GitHub avisa por correo (la tarea programada falla). A las 5 p. m., resumen del día. |

En la ficha del prospecto, el botón **🤖 Pasar a automático (correo)** lo pone en este modo y **Volver a manual** lo saca. Los automáticos no aparecen en "Para hoy" del equipo. En lote: `scripts/pasar-a-automatico.mjs`.

### Interruptor

`VENTAS_AUTOMATICAS=activo` en Render envía de verdad. Sin esa variable, todo corre en **simulación**: no se envía ningún correo de cadencia y no se avanza nada; el superadmin recibe cada día hábil la lista de lo que se habría enviado. En simulación sí se crean los prospectos que llegan por la web y sí se leen las respuestas (eso no envía nada a los prospectos; solo avisa al equipo).

### Puesta en marcha (una sola vez)

1. Desplegar el código.
2. En la cuenta de Gmail de `GMAIL_USER`: activar IMAP (Configuración → Reenvío y correo POP/IMAP). La contraseña de aplicación (`GMAIL_APP_PASSWORD`) sirve para SMTP e IMAP.
3. En GitHub (repositorio Juanp0302/app → Settings → Secrets and variables → Actions): crear el secreto `INTERNAL_SECRET`, igual al de Render. La tarea `.github/workflows/ventas-automaticas.yml` corre sola cada hora (de 7 a. m. a 8 p. m. de Bogotá) y se puede lanzar a mano desde la pestaña Actions ("Run workflow").
4. Revisar el reporte de simulación del día siguiente.
5. Pasar prospectos a automático (botón o script, `--dry --prod` primero) y, cuando el reporte se vea bien, poner `VENTAS_AUTOMATICAS=activo`.

### Archivos

- `lib/ventas-auto.ts`: el motor (envíos, buzón, leads de la web, alertas, ciclo).
- `lib/correo-ventas.ts`: arma cada correo y clasifica lo que llega (sin BD).
- `lib/cadencias.ts`: los textos (los mismos del WhatsApp; el cierre dice "correo") y la cadencia `entrante`.
- `lib/baja.ts`, `lib/baja-db.ts`, `app/baja/page.tsx`, `app/api/baja/route.ts`: la baja.
- `lib/smtp.ts`: envío por SMTP de Gmail.
- `app/api/interno/ventas-automaticas/route.ts`: el ciclo (POST) y su estado (GET), con `INTERNAL_SECRET`.
- Tablas: `envios_correo` (cada correo enviado, para los hilos y para no repetir un paso) y `ventas_auto_estado` (último correo leído, último ciclo, conteos del día).

## Fases siguientes

2. **Agenda conectada**: leer las reservas del calendario de Google (la app ya tiene conexión con Google) para pasar a "Reunión agendada" y enviar confirmación y recordatorios solos.
3. **WhatsApp para recibir**: construida (sección siguiente). Falta el botón "Escríbenos por WhatsApp" en los correos y la web.
4. **IA que contesta**: construida para WhatsApp (sección "Fase 4"). Falta extenderla a las respuestas por correo.

## Fase 3: WhatsApp (solo para recibir)

Número de Owl: **+57 301 238 8989**, conectado a la API oficial de Meta (Cloud API) en la app "Owl Compliance Ventas" del portafolio OWL Compliance. Ya no tiene WhatsApp en un teléfono: las conversaciones se ven y se responden en la app.

Qué hace:

| Pieza | Qué pasa |
|---|---|
| Llega un mensaje | Meta lo manda a `/api/whatsapp/webhook` (firmado). Queda guardado y se ve en la ficha del prospecto, pestaña **WhatsApp**. |
| Es un prospecto | Se reconoce por su celular (el del prospecto o el del webinar, con cualquier formato). Cuenta como respuesta: sale del modo automático, la cadencia se detiene y se avisa al responsable. Los mensajes siguientes de la misma conversación (menos de 6 h entre uno y otro) solo se guardan, sin avisos repetidos. |
| Es un número desconocido | Se crea el prospecto: prioridad E, campaña "whatsapp", nombre del perfil de WhatsApp como empresa (hay que confirmarlo), responsable por reparto parejo. |
| Pide la baja / no le interesa | Igual que por correo: "No contactar" con baja, o "No interesado". No se le responde nada automático. |
| Respuesta automática | Solo con `VENTAS_AUTOMATICAS=activo` y solo al primer mensaje de una conversación: saludo, enlace del calendario (15 minutos) y de servicios. Texto aprobado el 2026-11-25 (`respuestaAutomatica` en `lib/whatsapp-ventas.ts`). En la fase 4 lo reemplaza la IA. |
| Responder | Desde la ficha, hasta 24 h después del último mensaje del prospecto. Pasado eso Meta exige plantillas pagas, así que la app no deja: se le escribe por correo. |
| Estados | Enviado, entregado, leído o fallido se actualizan solos. |

Variables de entorno (Render):
- `WHATSAPP_TOKEN`: token permanente del usuario del sistema `owl-ventas-api` (Meta Business → Usuarios del sistema), con `whatsapp_business_messaging` y `whatsapp_business_management`.
- `WHATSAPP_PHONE_ID`: `1459027670626993`.
- `WHATSAPP_APP_SECRET`: developers.facebook.com → la app → Configuración de la app → Básica → Clave secreta.
- `WHATSAPP_VERIFY_TOKEN`: un texto largo al azar que se pone igual en Meta al configurar el webhook.
- `WHATSAPP_GRAPH_VERSION` (opcional, por defecto `v23.0`).

Puesta en marcha (después de desplegar):
1. Las cuatro variables en Render.
2. En la app de Meta → WhatsApp → Configuración: URL `https://app.owlcompliance.com/api/whatsapp/webhook`, el mismo token de verificación, "Verificar y guardar", y suscribir el campo **messages**.
3. Activar "Suscribir webhooks" en la cuenta OWL Compliance (Paso 2 de la configuración de producción).
4. Publicar la app (pide la URL de la política de privacidad de www.owlcompliance.com). Sin publicar, Meta no entrega los mensajes reales.
5. Probar escribiéndole al número desde un celular cuyo número esté en un prospecto de prueba.

Archivos: `lib/whatsapp-api.ts` (Meta: firma, lectura del webhook, envío), `lib/whatsapp-ventas.ts` (prospectos, conversación, respuesta), `app/api/whatsapp/webhook/route.ts`, `app/api/prospectos/whatsapp/route.ts` (la ficha), tabla `mensajes_whatsapp`.

## Fase 4: la IA contesta los WhatsApp

Claude Sonnet 5.5 (Anthropic) contesta los WhatsApp de los prospectos con las reglas de `lib/ia-conocimiento.ts`: sabe solo lo que está ahí, tutea, dice "suscripción" y nunca "plan", la reunión es de 15 minutos con el enlace del calendario, da solo los precios de referencia (Básica $199.000, Pro $890.000 y Premium $2.490.000 al mes; Diagnóstico $4.500.000; aprobado el 2026-11-25), sin descuentos ni otras condiciones, no da asesoría legal y no inventa. Si le preguntan, dice que es el asistente automático de Owl. Reglas aprobadas el 2026-11-25.

Interruptor `IA_VENTAS`:
- `borrador`: la IA escribe la respuesta y la deja en la ficha (pestaña WhatsApp, "Usar este borrador"); la envía una persona. Para empezar.
- `activa`: responde sola.
- Sin definir u otro valor: apagada; queda la respuesta fija de la fase 3.

Cómo decide, en cada mensaje: responder, no responder (un "gracias") o pasar a una persona (pide hablar con alguien, queja, investigación o sanción concreta, insiste en precios, ya es cliente, no es un ISP, o no sabe). Al pasar a una persona: le dice al prospecto que alguien le escribe pronto, se calla con ese prospecto, lo anota en el historial y le avisa al responsable por correo. También se calla si alguien del equipo escribe su propio mensaje desde la ficha (enviar el borrador de la IA no la pausa). En la ficha: "Atender yo" / "Devolver a la IA".

Seguridad: antes de enviar se revisa el texto (ningún precio distinto a los de referencia, ni descuentos, sin "plan" de Owl, solo 15 minutos, solo enlaces de Owl); si no pasa, va al equipo. Espera 15 segundos por si llegan varios mensajes seguidos y manda una sola respuesta que contesta todo lo que escribió desde nuestra última respuesta. Máximo 6 respuestas por prospecto al día (`IA_MAX_RESPUESTAS_DIA`) y 300 llamadas al día en total (`IA_MAX_LLAMADAS_DIA`). Cualquier error o negativa del modelo = pasa al equipo. Si el modelo se niega por sus filtros de seguridad, la API reintenta con otro modelo (`fallbacks: "default"`).

Costo: cada respuesta usa unos miles de tokens; las reglas van en caché. Del orden de US$5–10 al mes con ~500 respuestas. `ia_respuestas` guarda los tokens de cada llamada (`usoDelMes()` da el estimado). El tope real se pone en console.anthropic.com.

Variables (Render): `ANTHROPIC_API_KEY`, `IA_VENTAS`, y opcionales `IA_MODELO`, `IA_MAX_RESPUESTAS_DIA`, `IA_MAX_LLAMADAS_DIA`.

Archivos: `lib/ia-conocimiento.ts` (reglas y lo que sabe), `lib/ia-ventas.ts` (la llamada, la revisión, los topes, el paso a una persona), y la conexión en `lib/whatsapp-ventas.ts` y `app/api/whatsapp/webhook/route.ts` (contesta con `after()`, después de responderle a Meta). Tablas: `ia_respuestas`; columna `prospectos_isp.ia_pausada`.

## Fase 5: plantillas de WhatsApp, seguimiento después de la reunión y perfil completo para la IA

**Escribirle primero por WhatsApp.** Meta solo lo permite con plantillas aprobadas, a quien dio su consentimiento, y cobra cada plantilla entregada (Colombia, desde octubre de 2026: ~US$0,0125 marketing, ~US$0,0008 utilidad; las respuestas dentro de 24 h son gratis hasta 1.000 al mes por número). Sin verificación del negocio (Owl no tiene Cámara de Comercio), el límite es 250 personas distintas al día; el sistema se queda en 200.

- Consentimiento: `prospectos_isp.whatsapp_ok`. Se marca en la ficha ("Aceptó mensajes de Owl por WhatsApp"), solo cuando alguien escribe al WhatsApp de Owl, y en lote para la campaña webinar (el superadmin confirmó el 2026-11-25 que a los 433 inscritos se les puede escribir). A los del cold mailing (datos del RUTIC) no: a ellos se les escribe por correo.
- Plantillas: `lib/plantillas-whatsapp.ts` (8 textos, aprobados el 2026-11-26). Se registran en Meta desde Prospectos → "💬 Plantillas WhatsApp" (solo superadmin), que también muestra si Meta las aprobó. Mientras una no esté aprobada, los pasos que la usan esperan (no cuentan como fallo; llega una alerta). Todas las de marketing terminan con "Si no quieres recibir más mensajes, responde BAJA." y responder BAJA da de baja.
- Webinar: el primer mensaje cambia si asistió ("Hace un mes nos vimos en el webinar del 21 de octubre…") o solo se inscribió, y si tiene radiografía; empieza con "Te escribimos desde el WhatsApp de Owl Compliance", así sirve aunque alguien del equipo ya le hubiera escrito desde su celular (en la app no quedó registrado a quién). A los que asistieron, la propuesta de reunión también menciona el webinar.
- La de la radiografía trae el botón "Ver la radiografía", que abre `/r/<token>` (enlace firmado, público).
- Modo automático por WhatsApp: `prospectos_isp.canal_auto = 'whatsapp'`. En la ficha, "🤖 Automático por WhatsApp" (con permiso y celular); en lote, `node scripts/pasar-a-automatico.mjs --canal whatsapp --campana webinar --dry --prod`. Salta la llamada, igual que por correo. Lo enviado queda en la pestaña WhatsApp de la ficha y en el historial. Si responde, la cadencia se detiene y la IA conversa.

**Después de la reunión.** Al pasar un prospecto a "Propuesta enviada" arranca la cadencia `post-reunion` (`lib/cadencias.ts`): a los 2 días hábiles "¿pudiste revisar la propuesta?", 3 días después un recordatorio y 4 días después el cierre amable. Con `VENTAS_AUTOMATICAS=activo` sale sola, por WhatsApp si aceptó (si no, por correo); en simulación queda en "Para hoy" para hacerla a mano. En la pestaña WhatsApp, "📝 Resumen de la reunión con IA" redacta el resumen a partir de las notas de la ficha; una persona lo revisa y lo envía (como texto si está abierta la ventana de 24 h, si no como la plantilla "Resumen de la reunión").

**La IA ve el perfil completo** (`armarPedido` en `lib/ia-ventas.ts`): estado, próximo paso, notas, últimas 12 entradas del historial, lo que se le envió en la cadencia, webinar, radiografía y ubicación. Las notas son internas: las usa para entender el caso, no las cita. Según el estado: sin reunión busca la reunión; con reunión agendada no vuelve a mandar el calendario y pasa a una persona si quiere cambiarla; con propuesta enviada resuelve dudas generales y propone 15 minutos para revisarla, y pasa a una persona ante condiciones, pagos o negociación. A un cliente, a quien dijo que no le interesaba o pidió no ser contactado y vuelve a escribir, lo atiende siempre una persona (sin pasar por la IA). Las secciones nuevas de las reglas se aprobaron el 2026-11-26.

## Para retomar la conversación

Cualquier persona del equipo debe poder asumir un prospecto en cualquier momento. En la ficha, arriba de las pestañas, el recuadro **"📌 Para retomar"** (`lib/retomar.ts`, `/api/prospectos/retomar`) muestra:
- **Contactos:** cuántos mensajes se le han enviado, por canal y origen (correos, WhatsApp automáticos, de la IA y del equipo), y cuándo fue el último.
- **Respuestas:** cuántas y la última, con el texto.
- **Sin responder:** días desde nuestro último mensaje sin que haya respondido (en rojo desde 7).
- **Cadencia:** cuál, en qué paso va, si es automática o a mano, y cuándo es el próximo.
- **WhatsApp:** si aceptó mensajes de Owl y si la IA lo atiende.
- **Resumen del caso:** 1 a 3 frases que la IA actualiza con cada mensaje (situación, preocupaciones, lo que pidió y lo que se le prometió). Es interno; nunca se le envía.

En la pestaña WhatsApp, debajo de cada mensaje del prospecto aparece lo que decidió la IA y por qué (respondió, dejó un borrador, no respondió, lo pasó al equipo). El historial sigue registrando cada envío, respuesta, baja y cambio de modo. Los contactos manuales desde celulares personales no quedan registrados salvo que se marquen en la app ("paso enviado").
