# Leads: cómo llega cada formulario al menú del superadmin

El menú **Leads** (`/dashboard/leads`, solo superadmin) lee la tabla `leads`. Todo formulario del sitio
llega ahí por **n8n → `POST /api/leads`** (con `Authorization: Bearer $LEADS_WEBHOOK_SECRET`).

| Formulario | Webhook de n8n | Flujo (`D:\OWL\n8n\flujos`) | `origen` |
|---|---|---|---|
| Contacto (`contacto.html`) | `/webhook/contacto` | `contacto-web.json` | `contacto` |
| Webinar (`webinar.html`, mismo webhook) | `/webhook/contacto` | `contacto-web.json` | `webinar` (se deduce porque el asunto empieza por "Webinar") |
| Autodiagnóstico | `/webhook/autodiagnostico` | `autodiagnostico.json` | `autodiagnostico` |

En ambos flujos el nodo **"Guardar lead en app"** sale en paralelo desde el Webhook: si falla el correo,
el lead igual se guarda (y viceversa).

## Campos que acepta `/api/leads`

`nombre, empresa, correo, telefono, asunto, mensaje, reunion, utm_source, utm_medium, utm_campaign,
utm_term, utm_content, landing_page, referrer, origen` y `datos` (objeto o texto JSON con lo propio del
formulario: NIT, cargo, % de cumplimiento, etc.; se ve al abrir la fila del lead).

## Agregar un formulario nuevo (evento, taller…)

1. En la página, enviar el `fetch` al webhook de n8n de `contacto` (reusa el flujo; basta con que el `asunto`
   identifique el formulario) **o** crear un flujo nuevo copiando `autodiagnostico.json`.
2. Si es un flujo nuevo: dejar el nodo "Guardar lead en app" con un `origen` propio (ej. `taller-habeas`).
   Aparece solo como nuevo filtro y barra "Por formulario" en el menú Leads; no hay que tocar la app.
3. Mandar también `utm_*`, `landing_page` y `referrer` desde `sessionStorage('owl_utms')` para tener atribución.

## Si los leads no aparecen

- Comparar `LEADS_WEBHOOK_SECRET`: debe existir **igual** en Render (app) y en las variables de n8n. Si no
  coincide, el nodo recibe 401 y, como tiene `neverError`, falla en silencio.
- Revisar en n8n → Executions el nodo "Guardar lead en app".

## Seguimiento comercial

El menú Leads es solo para estadísticas. El trabajo con cada contacto (temperatura, cadencia, estados) se hace en
**Prospectos**: ver [playbook-ventas.md](./playbook-ventas.md). Para cargar una base de webinar:
`scripts/importar-webinar.mjs` y luego `scripts/webinar-a-prospectos.mjs`.
