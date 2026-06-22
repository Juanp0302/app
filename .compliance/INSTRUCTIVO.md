# Instructivo operativo — Owl Compliance (Ley 1581 de 2012)

> Qué hacer ante cada situación. Consultar este archivo cuando pase algo.
> El responsable ejecuta esto solo; el abogado solo entra en representación formal ante la SIC.

---

## A. Llega una solicitud de Habeas Data

### A.1 Consulta (derecho de acceso)
**Plazo: 10 días hábiles** (prorrogable 5 días hábiles más, **avisando al titular antes de vencer**).

1. Registrar la solicitud (fecha, canal, identidad).
2. Verificar identidad del titular (cédula o pasaporte).
3. Ejecutar consulta en la BD:
   ```sql
   SELECT id, email, nombre, rol, created_at FROM users WHERE email = '[email]';
   SELECT razon_social, nit, contacto FROM clientes WHERE user_id = '[user_id]';
   SELECT accion, entidad, created_at FROM audit_log WHERE user_email = '[email]' ORDER BY created_at DESC;
   ```
4. Preparar respuesta: qué datos tenemos, para qué, con quién los compartimos.
5. Enviar en formato legible. **Es gratuita.**
6. Archivar evidencia.

### A.2 Reclamo (rectificación / supresión / revocación)
**Plazo: 15 días hábiles** (prorrogable 8 días hábiles más, **avisando antes de vencer**).

1. Registrar el reclamo.
2. Verificar identidad.
3. Evaluar:
   - **Rectificación:** `UPDATE users SET nombre=? WHERE id=?` (o campo correspondiente).
   - **Supresión:** desactivar cuenta (`UPDATE users SET activo=0`). Si hay obligación legal de conservar, informar al titular.
   - **Revocación:** desactivar cuenta y cesar el tratamiento para esa finalidad.
4. Responder por escrito.
5. Archivar evidencia.

### A.3 El titular acude a la SIC
Solo puede hacerlo después de presentar reclamo ante Owl Compliance. Si llega requerimiento SIC:
1. Designar un contacto único.
2. Reunir evidencia: reclamo original, respuesta dada, fechas.
3. Responder en los plazos del requerimiento.

**Canal para solicitudes:** [COMPLETAR: ej. datos@owlcompliance.co]

---

## B. Brecha de seguridad

**Plazo para notificar a la SIC: 15 días hábiles** desde la detección (Circular Única Título V versión 29-09-2022, cap. 2; Guía SIC de Gestión de Incidentes, dic. 2020).

1. **Contén:** rota credenciales inmediatamente:
   - `TURSO_AUTH_TOKEN` → regenerar en console.turso.tech
   - `GOOGLE_CLIENT_SECRET` / `MICROSOFT_CLIENT_SECRET` → regenerar en Google Cloud / Azure Portal
   - `NEXTAUTH_SECRET` → cambiar en Fly.io secrets
   - `RESEND_API_KEY` → regenerar en resend.com
2. **Evalúa:** qué datos, cuántos titulares, nivel de riesgo.
3. **Notifica a la SIC** (si brecha significativa):
   - Si inscrito en RNBD: reportar por el portal del RNBD.
   - Si no inscrito: canal en sic.gov.co (Delegatura Protección Datos).
   - Incluir: naturaleza, datos afectados, número de titulares, medidas adoptadas.
4. **Notifica a los titulares** si hay riesgo real de daño.
5. **Registra** el incidente en `docs/1581-registro-incidentes.md`.
6. **Cierra:** causa raíz + fix técnico + actualiza EIPD y RAT.

Ver plan completo: `docs/1581-plan-respuesta-brechas.md`.

---

## C. Inspección SIC

1. Designar contacto único. Todo por escrito.
2. Identificar si es solicitud de información (preliminar) o investigación formal.
3. Reunir antecedentes: este directorio `.compliance/` — RAT, autorizaciones, políticas, canal Habeas Data, cláusulas de encargo, registro de incidentes, EIPD.
4. Responder en plazo, cargo por cargo. Mostrar diligencia y remediación.
5. Atenuantes: tamaño de empresa, corrección rápida, colaboración con la SIC.
6. Si escala a pliego de cargos formal: considerar asesoría legal especializada.

---

## D. Calendario de cumplimiento

| Cuándo | Qué | Quién |
|---|---|---|
| **Al publicar esta política** | Agregar aviso de privacidad y checkbox de autorización al login | Dev |
| **Inmediato** | Migrar contraseñas de SHA-256 a bcrypt | Dev |
| **Inmediato** | Cifrar tokens OAuth en storage_config | Dev |
| **Antes de siguiente sprint** | Habilitar canal de Habeas Data (email mínimo, luego endpoint) | Responsable de tratamiento + Dev |
| **30 días** | Firmar DPA con Turso, Resend, Google, Microsoft | Responsable de tratamiento |
| **30 días** | Implementar MFA para cuentas de admin | Dev |
| **Enero 2 – Marzo 31 (anual)** | Actualización anual RNBD (si obligada: activos > 100.000 UVT) | Responsable |
| **Primeros 15 días hábiles de feb. y ago.** | Reportar reclamos en el RNBD (si inscrita) | Responsable |
| **Dentro de 10 días hábiles del mes** | Reportar cambios materiales en el RNBD (si inscrita) | Responsable |
| **Anual** | Revisar y actualizar el RAT | Responsable |
| **Anual** | Capacitación del equipo sobre protección de datos | Responsable |
| **Al firmar/renovar proveedor** | Cláusula de encargo + verificar transmisión internacional | Responsable |
| **Cada release relevante** | Re-correr `/compliance-co` (detectar drift) | Dev |
| **Ante cambios de ley o circular SIC** | Actualizar sources/ y re-correr | Responsable + Dev |

---

## E. Ante cambios de ley o nuevas circulares SIC

1. Descargar texto actualizado de sic.gov.co o secretariasenado.gov.co.
2. Guardar en `D:\OWL\Administrativo\Datos Personales\skills\compliance-co\sources\`.
3. Ajustar el pack y los controles afectados.
4. Re-correr `/compliance-co` → el `state.json` muestra qué cambió.

---

*Instructivo operativo generado con compliance-co (pack ley-1581). No constituye asesoría legal.*
