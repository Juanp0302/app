# Procedimiento de Inscripción en el RNBD — Owl Compliance

**Empresa:** Owl Compliance · **NIT:** [NIT por confirmar]
**Responsable:** Nicolás Almeyda Orozco (Representante Legal)
**Fecha:** 22 de junio de 2026

> **¿Quién está obligado a inscribirse?** (Circular Única Título V, cap. 2.2)
> - Personas jurídicas de derecho privado con **activos totales superiores a 100.000 UVT** al 31 de diciembre del año anterior.
> - Personas jurídicas de **naturaleza pública**.
> - Las personas naturales y las empresas con activos ≤ 100.000 UVT **no están obligadas** (pueden inscribirse voluntariamente).
>
> Base legal: Arts. 25-26 Ley 1581; Decreto 90 de 2018; Circular Única Título V.
> Plataforma: **rnbd.sic.gov.co**

---

## Determinación de la obligación

**Tamaño de la empresa:** Microempresa
**Activos totales al 31 dic del año anterior:** ≤ 100.000 UVT (confirmado por el responsable)
**Naturaleza:** Persona jurídica privada

**Conclusión:**
- [x] **No obligada** — microempresa con activos ≤ 100.000 UVT, de naturaleza privada. La inscripción en el RNBD no es exigible (Circular Única Título V, cap. 2.2). Sin riesgo de sanción por no inscribirse. Inscripción voluntaria no requerida por ahora.

> Verificar anualmente: si los activos superan el umbral de 100.000 UVT en algún ejercicio, la obligación de inscripción surgirá en el período siguiente.

---

## Estado actual

- [x] **No inscrita — no obligada.** No se requiere acción. Revisar umbral anualmente.

---

## Bases de datos a inscribir (si aplica la obligación)

| # | Nombre de la base | Categorías de datos | Finalidad | Titulares | ¿Datos sensibles? | Países de transmisión |
|---|---|---|---|---|---|---|
| 1 | Usuarios del sistema | Nombre, email, password (hash), rol | Autenticación y acceso | Admins y representantes de clientes | No | EE.UU. (Turso) |
| 2 | Clientes (empresas ISP) | Razón social, NIT, contacto, email, teléfono | Prestación del servicio | Representantes de empresas ISP | No | EE.UU. (Turso, Resend) |
| 3 | Mensajes y conversaciones | Contenido de mensajes, user_id | Soporte y comunicación | Usuarios de la plataforma | No | EE.UU. (Turso) |
| 4 | Documentos de cumplimiento | Nombre de archivo, metadatos | Acreditación de cumplimiento | Admins y representantes | No | EE.UU. (Turso, Google, Microsoft) |
| 5 | Bitácora de auditoría | user_email, acciones, IP | Seguridad y trazabilidad | Usuarios de la plataforma | No | EE.UU. (Turso) |

---

## Plazos (si está inscrita o se inscribe)

- **Cambios materiales:** dentro de los primeros 10 días hábiles del mes siguiente al cambio.
- **Actualización anual:** entre el **2 de enero y el 31 de marzo** de cada año.
- **Reporte de reclamos:** primeros **15 días hábiles** de febrero y agosto.

---

## Consecuencias de no inscribirse (solo si es obligada)

La no inscripción puede ser sancionada por la SIC (multas hasta 2.000 SMMLV). Si la empresa no está obligada (activos ≤ 100.000 UVT), este riesgo no aplica directamente. Verificar el umbral anualmente.

---

*Borrador generado con compliance-co (pack ley-1581). No constituye asesoría legal.*
