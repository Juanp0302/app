# Resumen Ejecutivo de Cumplimiento — Ley 1581 de 2012
**Empresa:** Owl Compliance · **NIT:** [por confirmar]
**Responsable:** Nicolás Almeyda Orozco
**Fecha:** 1 de julio de 2026
**Corrida anterior:** 22 de junio de 2026

---

## Puntuación global

| Métrica | Corrida anterior | Esta corrida | Variación |
|---|---|---|---|
| **Score** | **33%** (commit 1468c74) | **42%** (commit 0bb29ef) | **+9 pp** |
| Controles evaluables | 24 | 24 | — |
| Pass | 5 | 7 | +2 |
| Partial | 4 | 6 | +2 |
| Fail | 13 | 11 | -2 |
| Unknown | 2 | 2 | — |
| Scope | Solo app/ | App + deploy/ | ampliado |

> Score = (pass + 0.5 × partial) / evaluables = (7 + 3) / 24 = 42%

---

## Avances desde la corrida anterior

### Mejoras confirmadas en código (commit 82e11f9)

| Control | Antes | Ahora | Cambio |
|---|---|---|---|
| **sec-passwords** | fail — SHA-256 | **pass** — bcrypt costo 12, migración silenciosa al login | Implementado |
| **sec-rest** | partial — tokens en claro en BD | **pass** — AES-256-GCM (lib/storage-crypto.ts) | Implementado |
| **inc-brechas** | fail — sin documentación | **partial** — plan y registro generados (.compliance/docs/) | Documentado |
| **data-eipd** | fail | **partial** — EIPD generada como buena práctica | Documentado |

### Nuevos archivos de documentación (.compliance/)

Todos los documentos del pack ley-1581 están generados:
- Política de privacidad completa
- Aviso de privacidad (para login y formularios)
- Autorización de tratamiento (con código SQL + frontend)
- Canal de Habeas Data
- Cláusula de encargo a proveedores
- Plan de respuesta a brechas
- Registro de incidentes
- Procedimiento RNBD (no obligada)
- EIPD

---

## Nuevos hallazgos — Deploy (web pública)

El alcance de esta corrida se amplió a `D:\OWL\deploy`. Se identificó que `autodiagnostico.html` recoge datos personales de prospectos:

**Datos recopilados:** empresa, representante legal, cargo, email, teléfono, RUTIC, servicios.

**Encargados involucrados:**
- EmailJS (USA) — notificación al equipo de ventas
- Google Sheets vía Apps Script (USA) — almacenamiento de leads

**Problemas:**
1. **Sin aviso de privacidad** antes del formulario (Art. 10 Ley 1581).
2. **Sin checkbox de autorización** — el envío ocurre sin consentimiento explícito (Art. 9 Ley 1581).
3. **Sin DPA con EmailJS** (Google LLC ya tiene DPA disponible).
4. **Sin plazo de retención** definido para los leads en Google Sheets.

Esto agrava los controles `data-licitud`, `data-autorizacion`, `data-encargados` y `data-info`.

**Nuevo documento generado:** Base de datos 6 en `docs/1581-rat.md` (leads/prospectos).

---

## Plan de acción priorizado

### Alta prioridad — Obligaciones legales directas (Arts. 9, 10 Ley 1581)

| # | Tarea | Archivo guía | Responsable |
|---|---|---|---|
| 1 | Agregar aviso de privacidad y checkbox de autorización en `autodiagnostico.html` antes del botón Enviar | docs/1581-autorizacion-tratamiento.md | Dev / Nicolás |
| 2 | Agregar aviso de privacidad + enlace a política en el login de la app (`app/login/page.tsx`) | docs/1581-aviso-privacidad.md | Dev |
| 3 | Publicar política de privacidad en `/privacidad` de la app y enlazarla desde el footer del deploy | docs/1581-politica-privacidad.md | Dev |
| 4 | Crear canal de Habeas Data y publicarlo en la política + footer | docs/1581-canal-habeas-data.md | Nicolás |

### Media prioridad — Gestión de encargados

| # | Tarea | Referencia |
|---|---|---|
| 5 | Aceptar Data Processing Amendment de Google (cubre Drive, Sheets y Apps Script) | google.com/about/company/user-consent-policy |
| 6 | Verificar DPA de Turso (turso.tech/legal) | docs/1581-clausula-encargados.md |
| 7 | Verificar DPA de Resend (resend.com/legal) | docs/1581-clausula-encargados.md |
| 8 | Verificar DPA de Microsoft (microsoft.com/trust-center) | docs/1581-clausula-encargados.md |
| 9 | Verificar si EmailJS tiene DPA o evaluar reemplazarlo con Resend para notificaciones | docs/1581-clausula-encargados.md |

### Baja prioridad — Buenas prácticas / robustez

| # | Tarea |
|---|---|
| 10 | Aprobar formalmente el plan de respuesta a brechas (firma del responsable) y comunicarlo al equipo |
| 11 | Implementar MFA para cuentas admin (TOTP o magic link) |
| 12 | Documentar plazo de retención de leads en Google Sheets + proceso de supresión |
| 13 | Definir plazos de conservación en el RAT (campos con [COMPLETAR]) |
| 14 | Implementar alertas sobre el audit_log |
| 15 | Actualizar EIPD para incluir el flujo de leads del autodiagnóstico |

---

## Proyección de score al completar las acciones

| Escenario | Score estimado |
|---|---|
| Actual (hoy) | 42% |
| Tras acciones 1-4 (aviso + autorización + política + canal) | ~58% |
| Tras acciones 1-9 (+ DPAs con encargados) | ~67% |
| Tras acciones 1-15 (plan completo) | ~83% |

> El 100% teórico requiere controles organizacionales (capacitación anual, monitoreo, backups documentados) que no son verificables por código.

---

## Documentos generados en esta corrida

| Archivo | Descripción |
|---|---|
| `.compliance/state.json` | Estado completo de controles |
| `.compliance/docs/1581-rat.md` | RAT con 6 bases de datos (incluye leads del autodiagnóstico) |
| `.compliance/docs/1581-politica-privacidad.md` | Política de privacidad completa |
| `.compliance/docs/1581-aviso-privacidad.md` | Aviso corto para formularios y login |
| `.compliance/docs/1581-autorizacion-tratamiento.md` | Código para capturar autorización |
| `.compliance/docs/1581-canal-habeas-data.md` | Canal y procedimiento Habeas Data |
| `.compliance/docs/1581-clausula-encargados.md` | DPA tipo + lista de encargados (incl. EmailJS, Google Sheets) |
| `.compliance/docs/1581-plan-respuesta-brechas.md` | Plan de respuesta a incidentes |
| `.compliance/docs/1581-registro-incidentes.md` | Registro de incidentes |
| `.compliance/docs/1581-procedimiento-rnbd.md` | RNBD — no obligada |
| `.compliance/docs/1581-eipd.md` | Evaluación de impacto |
| `.compliance/INSTRUCTIVO.md` | Runbooks operacionales |

---

*Generado con compliance-co (pack ley-1581). No constituye asesoría legal.*
