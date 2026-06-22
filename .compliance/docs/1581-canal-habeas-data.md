# Canal de Habeas Data — Owl Compliance

> Base legal: Arts. 8, 14-22 Ley 1581 de 2012.
> Los titulares tienen derecho a consultar, rectificar, actualizar, suprimir sus datos
> y revocar la autorización de tratamiento.

---

## Estado actual: ❌ NO implementado

No existe canal visible para ejercer derechos de Habeas Data. Debe implementarse antes de la siguiente corrida de compliance.

---

## Implementación mínima (sin código adicional)

Mientras se implementa un canal digital, publicar la siguiente información en la política de privacidad y en un pie de página de la app:

**Contacto para solicitudes de Habeas Data:**
- **Email:** [COMPLETAR: ej. datos@owlcompliance.co]
- **Asunto del correo:** "Solicitud Habeas Data — [su nombre]"
- **Información a incluir:** nombre completo, número de cédula o NIT, descripción de la solicitud, correo de respuesta

---

## Plazos legales de respuesta

| Tipo de solicitud | Plazo inicial | Prórroga permitida | Condición de prórroga |
|---|---|---|---|
| **Consulta** (acceso a datos) | **10 días hábiles** | 5 días hábiles más | Informar al titular antes de que venza el plazo inicial |
| **Reclamo** (rectificación, actualización, supresión, revocación) | **15 días hábiles** | 8 días hábiles más | Informar al titular antes de que venza el plazo inicial |

> Base legal: Art. 14 Ley 1581 de 2012.

---

## Procedimiento para atender solicitudes

### A. Consulta (derecho de acceso)

1. Registrar la solicitud: fecha, canal, identidad del titular.
2. Verificar identidad del solicitante (cédula o pasaporte).
3. Ubicar todos los datos del titular en la base de datos (tabla `users`, `clientes`, `mensajes`, `audit_log`).
4. Preparar respuesta: qué datos tenemos, para qué finalidad, con quién los compartimos.
5. Enviar en formato legible. **Es gratuita.**
6. Archivar evidencia de la respuesta.

**Consulta SQL de apoyo:**
```sql
-- Datos del usuario
SELECT id, email, nombre, rol, activo, created_at, autorizacion_otorgada_at
FROM users WHERE email = '[email del titular]';

-- Datos de cliente asociado
SELECT razon_social, nit, contacto, email, telefono
FROM clientes WHERE user_id = '[user_id]';

-- Acciones registradas
SELECT accion, entidad, entidad_id, created_at
FROM audit_log WHERE user_email = '[email]'
ORDER BY created_at DESC;
```

### B. Reclamo (rectificación / actualización / supresión / revocación)

1. Registrar el reclamo.
2. Verificar identidad.
3. Marcar el dato como "en revisión" si aplica (para evitar que circule como correcto durante el trámite).
4. Evaluar:
   - **Rectificación/actualización:** `UPDATE users SET nombre=? WHERE id=?` (o los campos relevantes).
   - **Supresión:** eliminar o anonimizar. Si hay obligación legal de conservar, informar al titular.
   - **Revocación:** desactivar cuenta (`activo=0`) y cesar el tratamiento para la finalidad revocada.
5. Responder por escrito con el resultado.
6. Archivar evidencia.

### C. Si el titular acude a la SIC

Solo puede hacerlo **después de presentar reclamo ante Owl Compliance** y no obtener respuesta satisfactoria. Si llega un requerimiento de la SIC:
1. Designar un contacto único.
2. Reunir evidencia del trámite previo.
3. Responder en los plazos del requerimiento.

---

## Implementación digital recomendada (Fase 5)

Agregar endpoint en la API:

```
POST /api/habeas-data
  Body: { tipo: 'consulta'|'reclamo', descripcion, nombre, email, cedula }
  → Crea un ticket en la tabla tickets con tipo='habeas_data'
  → Envía confirmación al titular con número de radicado y plazo
  → Notifica al admin responsable
```

---

*Borrador generado con compliance-co (pack ley-1581). No constituye asesoría legal.*
