# Integración de Pagos — Trazo (Qentaz), módulo Planes y Suscripciones

Estado: **soporte de Trazo ya respondió (2026-07-30) — ver sección 4bis. En construcción.** Este documento existe para retomar el trabajo sin perder contexto.

## 1. Origen y objetivo

El contrato de servicio de Owl Compliance (`app/suscribirse/SuscribirseContratoClient.tsx`) dice que el pago se hace por "Trazo (trazo.co)". Hoy ese flujo es 100% manual: el cliente firma el contrato, recibe un enlace de pago fuera de banda, y alguien del equipo crea su cuenta a mano tras confirmar el pago (ver `lib/notificaciones.ts` → `notificarBienvenida`, y la promesa de la pantalla `app/pago-exitoso/PagoExitosoClient.tsx`: "recibirás tu usuario y contraseña en los próximos minutos").

El objetivo de esta integración es automatizar ese ciclo usando la API de Trazo/Qentaz (planes y suscripciones recurrentes), en vez de un enlace de pago genérico gestionado a mano.

El punto de partida fue un prompt del usuario (`prompt-integracion-suscripciones-trazo.md`, aportado por él) que pedía integrar 6 endpoints. Antes de escribir código se revisó **toda** la documentación oficial (no solo los links que traía el prompt), y se encontraron vacíos importantes — ver sección 4.

## 2. Cómo funciona el modelo de Trazo (resumen)

Fuente: `https://docs.qentaz.com/documentation/planes-y-suscripciones/*` y `https://docs.qentaz.com/llms.txt` (índice completo del sitio).

- **Plan**: plantilla de cobro recurrente (moneda, monto, frecuencia, tope de cobros). No representa a un cliente.
- **Suscripción**: vínculo cliente↔plan. Al crearse, congela una copia de las condiciones del plan — si el plan cambia después, las suscripciones existentes no se enteran. No hay endpoint de "actualizar plan" ni "actualizar suscripción": el único camino para cambiar condiciones es cancelar y crear de nuevo.
- **Cobro**: ejecución individual dentro de una suscripción.
- El cliente nunca da su tarjeta a nuestro backend: Trazo devuelve `plan_url` / `subscription_url` y el cliente se vincula ahí directamente (tokenización del medio de pago).

### Autenticación (dos capas, ojo con esto)

1. `TRAZO_AUTH_KEY` — llave de larga duración (variable de entorno, nunca en frontend).
2. Con ella se pide `GET {{base_url}}/token` con header `Authorization: Bearer {auth_key}` → devuelve `{ access_token, expires_in }` (expira en 3600s típicamente).
3. Ese `access_token` se manda como `x-auth-token` en cada llamada a los demás endpoints.
4. Hay que cachear el `access_token` y renovarlo antes de que expire — **no** es una sola variable de entorno estática como sugería el prompt original.

### Endpoints (los 6 que pide el prompt)

| Acción | Método | Endpoint |
|---|---|---|
| Generar Plan | POST | `{{base_url}}/plan` |
| Consultar Plan | GET | `{{base_url}}/plan/{plan_id}` |
| Cancelar Plan | DELETE | `{{base_url}}/plan/{plan_id}` |
| Generar Suscripción | POST | `{{base_url}}/subscription` |
| Consultar Suscripción | GET | `{{base_url}}/subscription/{subscription_id}` |
| Cancelar Suscripción | DELETE | `{{base_url}}/subscription/{subscription_id}` |

Reglas de negocio que el código ya valida antes de llamar al API:
- `total_charges` entre 1 y 12 (el plan no admite más).
- Si `frequency === 'monthly'`, `billing_day` (1-30) es obligatorio.
- En Generar Suscripción: debe venir `customer` o `form_values` (no ambos vacíos). Si viene `customer.name`, `id_type` o `id_number`, los tres son obligatorios ("lógica conjunta obligatoria").
- `customer.phone` con prefijo internacional (ej. `573112223333`, no formato local).
- `retry.max_attempts` máximo 3.
- Variables dinámicas permitidas en `description`: `{{charge_number}}`, `{{month}}`, `{{week}}`, `{{biweek}}`, `{{day}}` (se resuelven según la fecha efectiva de ejecución, no la programada).

## 3. Qué ya está construido

### `lib/trazo.ts`
Cliente HTTP + servicio de dominio completo:
- `crearPlan`, `consultarPlan`, `cancelarPlan`, `crearSuscripcion`, `consultarSuscripcion`, `cancelarSuscripcion`.
- Todas aceptan un `childId` opcional (para cuentas administradas / sub-comercios — Trazo lo llama `child-id`), sin necesidad de refactor futuro.
- Manejo de token: cache en memoria con renovación automática (margen de 60s antes de expirar). Ante un `401`, invalida el cache, loguea sin exponer el token, y lanza `TrazoAuthError` **sin reintentar automáticamente** (tal como pedía el prompt original).
- Validaciones locales (lanzan `TrazoValidationError` **antes** de tocar la red): rango de `total_charges`, `billing_day` requerido en planes mensuales, interdependencia de `customer`, formato de teléfono, tope de `retry.max_attempts`.
- Errores del API se exponen tipados como `TrazoApiError` (con `status`, `type`, `details[]` — el array de campos que Trazo devuelve en los 400).

### `lib/trazo.test.ts`
14 tests con Vitest, todos en verde (`npm test`, agregado a `package.json`):
- Creación exitosa de plan (incluye verificar que la 1ª llamada es a `/token` con `Bearer {auth_key}` y la 2ª ya lleva `x-auth-token`).
- Rechazo local de `total_charges` fuera de rango, y de `monthly` sin `billing_day` — **sin llegar a golpear el API** (se verifica que `fetch` no se llame).
- Propagación fiel de un 400 del API con sus `details`.
- `child-id` solo se manda cuando se pasa explícitamente.
- Creación exitosa de suscripción con `customer` completo.
- Rechazo cuando faltan `customer` y `form_values` a la vez.
- Rechazo de interdependencia incompleta (`name` sin `id_type`/`id_number`).
- Aceptación de `form_values` solo, sin `customer`.
- Rechazo de teléfono sin prefijo internacional.
- 401 al consultar → `TrazoAuthError`, sin reintento con el mismo token.
- 401 al pedir el token mismo (`auth_key` inválido) → también `TrazoAuthError`.
- Reuso del token cacheado entre dos llamadas seguidas (no se vuelve a pedir).
- Tras un 401, la siguiente llamada sí pide un token nuevo.

### Flujo completo construido (2026-07-30, tras las respuestas de soporte)

**Decisiones de negocio tomadas por el usuario (resuelven la sección 5):**
- **#7 Renovación:** automática. Al llegar el webhook `fulfilled` se crea nuevo Plan + Suscripción y se le envía al cliente el enlace para re-vincular su medio de pago.
- **#8 Día de cobro:** el del aniversario de cada cliente → **un Plan de Trazo por cliente**, `billing_day = día del mes de la firma` (tope 30), `initial_charge: true`, `total_charges: 12`, retry 3 intentos cada 2 días con `final_status: OVERDUE`.
- **#9 Al activarse:** creación de cuenta 100% automática (contraseña temporal = prefijo del correo, cambio obligatorio al primer login, elección de servicios por el cliente — flujo de onboarding que ya existía en la app).

**Archivos del flujo:**
- `lib/trazo-db.ts` — tabla `trazo_suscripciones`: una fila por suscripción creada en Trazo. Nace `pendiente` al firmar el contrato (aún sin cuenta), y el webhook la mueve: `activa` → (`vencida` | `cancelada` | `completada`). Guarda el JSON del formulario del contrato para poder crear la cuenta después y para las renovaciones.
- `lib/trazo-flujo.ts` — `crearSuscripcionTrazoParaContrato()` (Plan individual + Suscripción + registro local) y `procesarWebhookTrazo()` (maneja `activated`/`overdue`/`canceled`/`fulfilled`; los eventos de cobros se aceptan y loguean sin acción). En `activated`: crea la cuenta con `crearCuentaClienteAutomatica()` (lib/clientes.ts) o, si el correo ya existe, reactiva el cliente existente. En `fulfilled`: renovación automática + correos al cliente y al superadmin.
- `app/api/trazo/webhook/route.ts` — receptor. Valida `Authorization: Bearer {TRAZO_AUTH_KEY}` con comparación timing-safe. Responde 200 a eventos ignorados (evita tormentas de reintentos), 401 sin auth, 500 solo en errores reales.
- `app/api/contrato/publico/route.ts` — al firmar el contrato, si `trazoConfigurado()`, crea Plan+Suscripción y: (a) el correo del contrato lleva el botón real "Activar mi suscripción — pagar ahora", (b) la respuesta incluye `enlacePago` y la pantalla de éxito (`SuscribirseContratoClient.tsx`) muestra el botón "Pagar y activar mi suscripción". Si Trazo no está configurado o falla, el flujo sigue exactamente como antes (degradación limpia).
- `app/api/suscripcion/cancelar/route.ts` — ahora también cancela la suscripción en Trazo (si `clientes.suscripcion_externa_id` existe). Si Trazo falla, NO cancela localmente (quedaría cobrando sin acceso) y pide contactar al equipo.
- `lib/clientes.ts` — nueva `crearCuentaClienteAutomatica()`, extraída del `POST /api/clientes` (que ahora la reutiliza); mejora: hashea con bcrypt directo en vez del SHA-256 legado.
- `clientes.suscripcion_externa_id` guarda el `subscription_id` de Trazo; `suscripcion_vencimiento` se actualiza con `billing.next_charge_date` del webhook.

### Prueba contra sandbox (2026-07-30) — bloqueada por credenciales

El usuario recibió credenciales de sandbox (auth_key + base_url `https://api.qentaz.com/v1/merchant`). Están configuradas en el `.env.local` local del proyecto (`TRAZO_BASE_URL`, `TRAZO_AUTH_KEY`, `TRAZO_MERCHANT_ID=1053824988`) — el `.env.local` está en `.gitignore`, no se sube al repo.

Resultado de la prueba: `GET /v1/merchant/token` responde **`401 Q001: "La autorización no se encuentra en el formato correcto o no está habilitada en el sistema de Trazo"`**. Se verificó que: (a) la llave viaja byte-exacta, (b) el formato `Authorization: Bearer {auth_key}` es el documentado, (c) ese endpoint es el correcto (es el único que responde JSON de error estilo Trazo; no existen hosts sandbox separados — `sandbox.qentaz.com` etc. no resuelven DNS). Conclusión: **falta que Trazo habilite la llave sandbox de su lado**. Pendiente: el usuario le pregunta a su contacto de Trazo.

Cuando la habiliten, la prueba es: obtener token → crear plan de prueba → crear suscripción → simular webhook → cancelar/limpiar. Después de validar en sandbox, cambiar las variables en Render a las credenciales de producción.

### Lista de espera eliminada (2026-07-30)

`/suscribirse` mostraba una pantalla de lista de espera (`SuscribirseClient.tsx`, "Suscripciones · Próximamente") porque la página nunca conectó el flujo de contrato. Por decisión del usuario se eliminó la lista de espera (`git rm`; recuperable del historial) y `app/suscribirse/page.tsx` ahora renderiza `SuscribirseContratoClient` directamente: datos → contrato → firma → pago. Mientras las variables `TRAZO_*` no estén en Render, el flujo degrada limpio (contrato por correo sin botón de pago, activación manual); al configurarlas, el pago se enciende solo — `trazoConfigurado()` se evalúa en tiempo de ejecución, sin redeploy. El endpoint `/api/waitlist` sigue existiendo (lo usa la web estática) pero la app ya no lo referencia.

### Pendiente para poner en producción
1. **Variables de entorno en Render** (el usuario tiene las credenciales en archivos aparte): `TRAZO_BASE_URL` (viene con las credenciales), `TRAZO_AUTH_KEY`, y `TRAZO_MERCHANT_ID` (documento del cobrador — cédula de Juan Pablo, `1053824988`, exigido por Generar Plan).
2. **Compartir a soporte de Trazo** la URL del webhook `https://owlcompliance.onrender.com/api/trazo/webhook` y pedir que activen los eventos de **suscripciones: activated, overdue, canceled, fulfilled** (los de cobros son opcionales — el receptor los acepta y loguea, no actúa sobre ellos).
3. Probar en el ambiente que Trazo indique (¿sandbox?) el ciclo completo: firma → enlace → vinculación → webhook activated → cuenta creada.

## 4. Preguntas abiertas para soporte de Trazo/Qentaz

Se revisó `https://docs.qentaz.com/llms.txt` (índice completo del sitio, no solo los links del prompt original) y la sección de Webhooks (`webhooks/introduccion.md`, `webhooks/eventos-de-cobros.md`). Esto es lo que **no** queda claro y hay que preguntarle a Trazo antes de conectar nada en producción:

1. **¿Los cobros de una Suscripción disparan webhooks?** La página de "Eventos de cobros" documenta 6 estados (`SUCCESS`, `REVIEW`, `OVERDUE`, `FAILED`, `DECLINED`, `BLOCKED`) pero **no menciona explícitamente eventos de suscripciones/cobros recurrentes**. Sin esto, no hay forma de enterarse automáticamente de que la mensualidad de un cliente se cobró (o falló) — y `GET /subscription/{id}` tampoco devuelve una lista de cobros individuales, solo el estado general de la suscripción. Esta es la pregunta más importante: sin webhooks de cobros recurrentes, la única alternativa sería hacer polling periódico, con información incompleta.
2. **¿Cómo se configura/registra la URL del webhook?** No hay documentación de esto (¿panel de Trazo? ¿ticket de soporte?).
3. **Autenticación del webhook**: la doc de "Eventos de cobros" dice que llega `Authorization: Bearer base64(client_id:client_secret_key)` — ¿de dónde salen ese `client_id` y `client_secret_key`? (Son distintos del `TRAZO_AUTH_KEY` usado para pedir el `access_token`.)
4. **¿Qué pasa con las suscripciones activas si se cancela el Plan del que dependen?** La doc de "Cancelar Plan" dice literalmente que no lo especifica: solo dice que "deja de estar disponible para nuevas suscripciones". Esto importa para el flujo de cambio de plan (ej. cliente pasa de Básico a Pro).
5. **Estados posibles de una Suscripción**: la doc de "Consultar Suscripción" solo documenta `"active"` como valor de `status`; no lista qué otros estados existen (¿`overdue`? ¿`canceled`? ¿`paused`?).
6. **`base_url` real de producción** — toda la documentación usa el placeholder `{{base_url}}`, nunca resuelve cuál es la URL real (ej. `https://api.trazo.co/v1` es una suposición, no está confirmado).

## 4bis. Respuestas de soporte de Trazo (recibidas 2026-07-30)

Soporte respondió las preguntas de la sección 4. Resumen literal de lo que aplica:

1. **Sí hay webhooks, en dos flujos separados:**
   - **Eventos de suscripciones** (`https://docs.qentaz.com/documentation/webhooks/eventos-de-suscripciones`): se disparan cuando la suscripción cambia de estado — `activated`, `overdue`, `canceled`, `fulfilled`. El `overdue` llega solo apenas se agotan los reintentos del Plan; no hace falta polling. **Ojo:** el evento de activación se dispara cuando el cliente termina de vincular el medio de pago, *sin importar cómo salga el primer cobro* — puede llegar la activación e inmediatamente un cobro fallido.
   - **Eventos de cobros** (`eventos-de-cobros`): cada intento de cobro (SUCCESS, FAILED, BLOCKED, etc.) llega en el momento en que se ejecuta.
   - En ambos flujos se puede elegir qué eventos enviar — se le dice a Trazo cuáles y ellos los activan.

2. **Configuración de la URL del webhook:** la URL global del comercio la configura Trazo desde su lado (se les comparte la URL y opcionalmente un header personalizado). Además existe el campo `custom_webhook` al crear un Plan o un Cobro, para URLs distintas por plan/cobro. Los eventos de suscripción salen al `custom_webhook` del Plan; si el Plan no lo tiene, a la URL global del comercio.

3. **Autenticación del webhook:** el esquema `client_id`/`client_secret` de la doc es legado. Hoy **todos los webhooks llegan con `Authorization: Bearer {auth_key}`** — el mismo auth key de las credenciales. Si se configura un header personalizado, lo agregan también al evento.

4. **Cancelar un Plan NO cancela sus suscripciones:** las vigentes se mantienen hasta cumplir sus términos. Para dejar de cobrar hay que cancelar cada suscripción individualmente.

5. **Estados de una Suscripción (5):** `PENDING` (creada, esperando vinculación del medio de pago — estado transitorio, NO dispara webhook), `ACTIVE` (medio de pago vinculado y operando; puede tener cobros fallidos en curso sin dejar de estar activa), `OVERDUE` (reintentos agotados con `status_after_retry = OVERDUE`), `CANCELED` (reintentos agotados con `status_after_retry = CANCELED`, o cancelación manual), `FULFILLED` (se alcanzó `total_charges`).

6. **Credenciales:** el usuario ya las tiene (archivos aparte). El `base_url` real viene con las credenciales.

### Payload del webhook de suscripciones (de la doc)

```json
{
  "event": { "type": "subscription", "status": "activated|overdue|canceled|fulfilled" },
  "created_at": "timestamp ISO",
  "external_reference": "ID de suscripción",
  "detail": {
    "plan_id": "...", "subscription_id": "...",
    "status": "ACTIVE|OVERDUE|CANCELED|FULFILLED",
    "customer": { "id_number": "...", "email": "...", "phone": "...", "name": "..." },
    "form_field_values": { },
    "terms": { "currency": "...", "amount": 0, "description": "...", "frequency": "...", "total_charges": 0, "retry": { } },
    "billing": { "charges_executed": 0, "charges_remaining": 0, "retries_used": 0, "next_charge_date": "..." },
    "canceled_at": "timestamp o null",
    "created_at": "timestamp"
  }
}
```

El evento `subscription.canceled` trae además `"reason": "retry_exhausted"` (automática) o `"reason": "manual"` (API/dashboard).

Headers de todo webhook entrante: `Authorization: Bearer {auth_key}` + `Content-Type: application/json`.

**Implicación clave para el diseño:** el estado `FULFILLED` + su webhook resuelven la decisión #7 (tope de 12 cobros) — al llegar `fulfilled` se puede crear automáticamente la suscripción de renovación.

**Pendiente con Trazo cuando esté listo el receptor:** compartirles la URL del webhook (ej. `https://owlcompliance.onrender.com/api/trazo/webhook`) y decirles qué eventos activar.

## 5. Decisiones de negocio pendientes (nuestras, no de Trazo)

7. **Tope de 12 cobros vs. renovación indefinida**: el contrato de Owl Compliance se renueva mensualmente sin límite ("Cláusula 13. Plazo y Renovación"), pero un Plan de Trazo admite máximo `total_charges: 12`. Propuesta a validar: crear un plan con `total_charges: 12` (cubre un año) y, al agotarse, generar automáticamente un Plan + Suscripción nuevos para "renovar" — hay que decidir si esto se automatiza o queda como tarea del equipo.
8. **`billing_day` fijo o variable**: los planes `monthly` exigen un día fijo de cobro (1-30). El contrato dice "dentro de los primeros cinco días hábiles del mes". ¿Se cobra a todos el mismo día del mes (ej. día 1), o el día en que cada cliente se suscribió originalmente? Esto define si se crean 3 Planes fijos reutilizables (Básico/Pro/Premium, un plan_id por cada uno) o un Plan nuevo por cada cliente.
9. **Qué se automatiza al confirmarse un pago**: ¿creación automática de la cuenta del cliente (usuario + contraseña, tal como promete hoy `PagoExitosoClient.tsx`), o el webhook/polling solo actualiza `suscripcion_estado` en la tabla `clientes` y la creación de cuenta se sigue haciendo a mano?

## 6. Cómo retomar esto

1. Si ya llegó respuesta de Trazo sobre las preguntas de la sección 4, empezar por ahí — probablemente cambie el diseño de cómo nos enteramos de los cobros (webhook vs. polling).
2. Resolver las decisiones de la sección 5 con el usuario (Juan Pablo).
3. Pedir/generar en Render las variables `TRAZO_BASE_URL` y `TRAZO_AUTH_KEY`.
4. Construir el endpoint propio que conecte el flujo de contrato/suscripción actual (`app/api/contrato/publico`, `app/api/suscripcion/*`) con `lib/trazo.ts`: al aceptar el contrato, generar (o reusar) el Plan correspondiente al plan contratado, crear la Suscripción para ese cliente, y guardar el `subscription_id`/`plan_url` para redirigir al cliente a vincular su medio de pago.
5. Si Trazo confirma webhooks de cobros recurrentes: construir el endpoint receptor (`app/api/trazo/webhook` o similar) que actualice `suscripcion_estado`/`suscripcion_vencimiento` en la tabla `clientes` y dispare `notificarSuscripcion` (ya existe en `lib/notificaciones.ts`).
6. Si Trazo NO tiene webhooks para esto: diseñar un cron (mismo patrón que `auto-cuentas-cobro` o `recordatorios`, disparado desde N8N) que haga polling a `GET /subscription/{id}` para los clientes con suscripción activa.

## 7. Referencias

- Prompt original del usuario: `C:\Users\Usuario\Downloads\prompt-integracion-suscripciones-trazo.md`
- Índice completo de la documentación: https://docs.qentaz.com/llms.txt
- Introducción Planes y Suscripciones: https://docs.qentaz.com/documentation/planes-y-suscripciones/introduccion.md
- Términos de relevancia: https://docs.qentaz.com/documentation/planes-y-suscripciones/terminos-de-relevancia.md
- Generar/Consultar/Cancelar Plan: https://docs.qentaz.com/documentation/planes-y-suscripciones/generar-plan.md · consultar-plan.md · cancelar-plan.md
- Generar/Consultar/Cancelar Suscripción: https://docs.qentaz.com/documentation/planes-y-suscripciones/generar-suscripcion.md · consultar-suscripcion.md · cancelar-suscripcion.md
- Autenticación (token): https://docs.qentaz.com/documentation/autenticacion/token.md
- Webhooks: https://docs.qentaz.com/documentation/webhooks/introduccion.md · eventos-de-cobros.md
- Código: `lib/trazo.ts`, tests en `lib/trazo.test.ts`
