# Plan de Respuesta a Brechas de Seguridad — Owl Compliance

> Base legal: Art. 17 lit. i Ley 1581 de 2012; Circular Única SIC — Título V, Capítulo Segundo;
> Guía de Gestión de Incidentes SIC, dic. 2020.
> **Plazo para notificar a la SIC: 15 días hábiles desde la detección del incidente.**

---

## Estado actual: ❌ NO implementado formalmente

Este documento establece el plan. Debe ser aprobado por [COMPLETAR: representante legal] y comunicado al equipo.

---

## 1. Clasificación de incidentes

| Nivel | Descripción | Ejemplos | Notificar a SIC |
|---|---|---|---|
| **Crítico** | Acceso no autorizado masivo o exposición de datos de múltiples titulares | Volcado de BD, ransomware, exfiltración | Sí (15 días hábiles) |
| **Alto** | Acceso no autorizado a datos de un titular o grupo pequeño | Cuenta de admin comprometida, token OAuth robado | Sí, si hay riesgo real de daño |
| **Medio** | Falla de disponibilidad o integridad sin exposición confirmada | Corrupción de datos, error de backup | Evaluar; registrar siempre |
| **Bajo** | Incidente menor sin impacto en datos personales | Intento fallido de acceso, error de aplicación | No, pero registrar |

---

## 2. Equipo de respuesta

| Rol | Persona | Contacto |
|---|---|---|
| Coordinador del incidente | [COMPLETAR: responsable de tratamiento] | [COMPLETAR: teléfono/email] |
| Técnico | [COMPLETAR: desarrollador principal] | [COMPLETAR] |
| Comunicaciones (SIC/titulares) | [COMPLETAR: representante legal] | [COMPLETAR] |

---

## 3. Procedimiento paso a paso

### Fase 1: Contención (primeras horas)
1. **Aislar** los sistemas afectados: revocar tokens OAuth comprometidos, reasignar accesos.
2. **Abrir bitácora** del incidente en `registro-incidentes.md`.
3. **Notificar internamente** al coordinador del incidente.
4. Si el incidente involucra un encargado (Turso, Google, Microsoft, Resend): **exigir informe** al proveedor dentro de las 24 horas.
5. Cambiar credenciales: `NEXTAUTH_SECRET`, `TURSO_AUTH_TOKEN`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_SECRET`, `RESEND_API_KEY`.

**Consulta de auditoría para detectar accesos sospechosos:**
```sql
-- Acciones recientes en la plataforma
SELECT user_email, accion, entidad, ip, created_at
FROM audit_log
WHERE created_at >= datetime('now', '-24 hours')
ORDER BY created_at DESC;

-- Tokens OAuth almacenados (revisar si fueron comprometidos)
SELECT id, storage_type, storage_config FROM clientes WHERE storage_type != 'local';
```

### Fase 2: Evaluación (primeras 24-48 horas)
1. Determinar: ¿qué datos fueron expuestos? ¿cuántos titulares? ¿qué riesgo real?
2. Evaluar si la brecha es "significativa" (riesgo real de daño a los titulares).
3. Si hay riesgo real → preparar notificación a la SIC y a los titulares.

### Fase 3: Notificación (dentro de 15 días hábiles desde la detección)

**A la SIC:**
- **Si está inscrito en el RNBD:** reportar a través del portal del RNBD.
- **Si no está inscrito:** reportar por los canales habilitados en sic.gov.co (Delegatura para la Protección de Datos Personales) o correo: [verificar canal vigente en sic.gov.co].
- Incluir: naturaleza del incidente, datos afectados, número de titulares, consecuencias probables, medidas adoptadas.

**A los titulares afectados:**
- Si hay riesgo real de daño: notificar qué ocurrió, qué riesgo corren, qué medidas tomamos.
- Canal: correo electrónico al email registrado.

### Fase 4: Remediación y cierre
1. Identificar causa raíz y corregir la vulnerabilidad.
2. Actualizar el `registro-incidentes.md`.
3. Revisar y actualizar el RAT si cambiaron los datos o los flujos.
4. Re-correr `/compliance-co` para detectar nuevos huecos.
5. Si aplica: actualizar el RNBD.

---

## 4. Vulnerabilidades conocidas que deben remediarse

Las siguientes vulnerabilidades detectadas en la auditoría deben corregirse como medida preventiva:

1. **CRÍTICO — Hashing débil de contraseñas:** SHA-256 con salt fijo es inseguro. Migrar a bcrypt (ya disponible en package.json). Si ocurre una brecha de la BD, todas las contraseñas serían fácilmente recuperables.
2. **ALTO — Tokens OAuth en storage_config:** Los tokens de Google y Microsoft se almacenan en JSON en la BD. Cifrar este campo antes de almacenar.
3. **ALTO — Sin MFA:** Las cuentas de admin no tienen segundo factor. Un credential stuffing compromete el acceso completo.
4. **MEDIO — Sin monitoreo de accesos:** No hay alertas ante patrones sospechosos en el audit_log.

---

*Borrador generado con compliance-co (pack ley-1581). No constituye asesoría legal.*
