# Registro de Incidentes de Seguridad — Owl Compliance

> Base legal: Art. 17 lit. i Ley 1581 de 2012; Guía SIC de Gestión de Incidentes, dic. 2020.
> Registrar **todos** los incidentes, aunque no sean notificables a la SIC.

---

## Instrucciones de uso

1. Abrir una nueva entrada por cada incidente detectado.
2. Completar todos los campos en el momento de la detección.
3. Actualizar el estado a medida que avanza la respuesta.
4. Archivar como evidencia en caso de inspección SIC.

---

## Registro

| # | Fecha detección | Tipo | Descripción | Datos afectados | Titulares afectados | Nivel | Notificado a SIC | Notificado a titulares | Estado | Causa raíz | Acciones correctivas |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 001 | — | — | (sin incidentes registrados) | — | — | — | — | — | — | — | — |

---

## Próximo número de incidente: 001

---

## Plantilla para nuevo incidente

```
## Incidente #[N]

**Fecha y hora de detección:** [ISO-8601]
**Detectado por:** [nombre / sistema]
**Tipo de incidente:** acceso_no_autorizado | fuga_de_datos | ransomware | error_interno | disponibilidad | otro
**Nivel:** Crítico | Alto | Medio | Bajo

### Descripción
[Qué ocurrió, cómo se detectó]

### Datos personales afectados
- Categorías: [usuarios / clientes / mensajes / audit_log / documentos / otros]
- Número estimado de titulares afectados: [N]
- Tipo de datos: [email, nombre, contraseña hash, tokens OAuth, etc.]

### Encargados involucrados
[ ] Turso  [ ] Resend  [ ] Google  [ ] Microsoft  [ ] Otro: _____

### Cronología
| Fecha/Hora | Acción |
|---|---|
| [T+0] | Detección |
| [T+Xh] | Contención |
| [T+Xh] | Evaluación completada |
| [T+Xd] | Notificación SIC (si aplica — plazo: 15 días hábiles) |
| [T+Xd] | Notificación titulares (si aplica) |
| [T+Xd] | Remediación completada |

### Notificación a la SIC
- [ ] No aplica (nivel bajo / sin riesgo real)
- [ ] Sí — fecha de envío: [fecha] — canal: [RNBD / sic.gov.co]
- Número de radicado SIC: [si aplica]

### Notificación a titulares
- [ ] No aplica
- [ ] Sí — fecha de envío: [fecha] — canal: [email]

### Causa raíz
[Descripción técnica de la causa]

### Acciones correctivas
1. [Acción 1] — responsable: [nombre] — plazo: [fecha]
2. [Acción 2] — ...

### Estado final
- [ ] Abierto
- [ ] Contenido (causa no resuelta)
- [ ] Cerrado — fecha de cierre: [fecha]
```

---

*Borrador generado con compliance-co (pack ley-1581). No constituye asesoría legal.*
