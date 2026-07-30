# Integración de Pagos — Trazo (Qentaz), módulo Planes y Suscripciones

Estado: **en pausa, esperando respuesta de soporte de Trazo.** Este documento existe para retomar el trabajo sin perder contexto.

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

### Lo que falta a propósito (no se ha tocado)
- **Nada de UI.** El prompt original pedía explícitamente enfocarse solo en la capa de integración/servicio.
- **Nada de variables de entorno reales** — `TRAZO_BASE_URL` y `TRAZO_AUTH_KEY` no están seteadas todavía en Render (se necesitan cuando haya credenciales reales).
- **Ningún endpoint propio** (`/api/trazo/...`) que use este servicio desde el flujo de suscripción del contrato — eso viene después, cuando se resuelvan las preguntas abiertas.
- **Ningún webhook receptor.**

## 4. Preguntas abiertas para soporte de Trazo/Qentaz

Se revisó `https://docs.qentaz.com/llms.txt` (índice completo del sitio, no solo los links del prompt original) y la sección de Webhooks (`webhooks/introduccion.md`, `webhooks/eventos-de-cobros.md`). Esto es lo que **no** queda claro y hay que preguntarle a Trazo antes de conectar nada en producción:

1. **¿Los cobros de una Suscripción disparan webhooks?** La página de "Eventos de cobros" documenta 6 estados (`SUCCESS`, `REVIEW`, `OVERDUE`, `FAILED`, `DECLINED`, `BLOCKED`) pero **no menciona explícitamente eventos de suscripciones/cobros recurrentes**. Sin esto, no hay forma de enterarse automáticamente de que la mensualidad de un cliente se cobró (o falló) — y `GET /subscription/{id}` tampoco devuelve una lista de cobros individuales, solo el estado general de la suscripción. Esta es la pregunta más importante: sin webhooks de cobros recurrentes, la única alternativa sería hacer polling periódico, con información incompleta.
2. **¿Cómo se configura/registra la URL del webhook?** No hay documentación de esto (¿panel de Trazo? ¿ticket de soporte?).
3. **Autenticación del webhook**: la doc de "Eventos de cobros" dice que llega `Authorization: Bearer base64(client_id:client_secret_key)` — ¿de dónde salen ese `client_id` y `client_secret_key`? (Son distintos del `TRAZO_AUTH_KEY` usado para pedir el `access_token`.)
4. **¿Qué pasa con las suscripciones activas si se cancela el Plan del que dependen?** La doc de "Cancelar Plan" dice literalmente que no lo especifica: solo dice que "deja de estar disponible para nuevas suscripciones". Esto importa para el flujo de cambio de plan (ej. cliente pasa de Básico a Pro).
5. **Estados posibles de una Suscripción**: la doc de "Consultar Suscripción" solo documenta `"active"` como valor de `status`; no lista qué otros estados existen (¿`overdue`? ¿`canceled`? ¿`paused`?).
6. **`base_url` real de producción** — toda la documentación usa el placeholder `{{base_url}}`, nunca resuelve cuál es la URL real (ej. `https://api.trazo.co/v1` es una suposición, no está confirmado).

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
