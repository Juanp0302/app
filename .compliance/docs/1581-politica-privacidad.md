# Política de Tratamiento de Datos Personales
## Owl Compliance — Owl Compliance

**Versión:** 1.0
**Fecha de vigencia:** [COMPLETAR: fecha de publicación]
**Última actualización:** 22 de junio de 2026

---

## 1. Responsable del tratamiento

**Owl Compliance**, con NIT [por confirmar], domiciliada en Bogotá, Cundinamarca, Colombia, correo electrónico: [COMPLETAR: ej. datos@owlcompliance.co], teléfono: [COMPLETAR].

Marca comercial: **Owl Compliance** — Centro de Cumplimiento Regulatorio para ISPs.

---

## 2. Marco legal

Esta política se rige por la **Ley 1581 de 2012** (Habeas Data comercial) y el **Decreto 1377 de 2013** (compilado en Decreto 1074 de 2015), aplicables al tratamiento de datos personales de personas naturales en Colombia. Fiscaliza: **Superintendencia de Industria y Comercio (SIC)**.

---

## 3. Ámbito de aplicación

Esta política aplica a todos los datos personales de personas naturales que Owl Compliance recopile, almacene, use o transmita en el desarrollo de su plataforma de gestión de cumplimiento regulatorio para proveedores de servicios de telecomunicaciones (ISPs).

**No aplica** a los datos de personas jurídicas como tales, ni a los datos de los clientes finales de los ISPs usuarios de la plataforma (cuyo tratamiento es responsabilidad de cada ISP).

---

## 4. Datos personales que tratamos

Tratamos las siguientes categorías de datos personales:

| Categoría | Datos | Titulares |
|---|---|---|
| Identificación y contacto | Nombre, correo electrónico, teléfono | Administradores; representantes de clientes ISP |
| Acceso a la plataforma | Correo electrónico, contraseña (almacenada como hash), rol | Todos los usuarios registrados |
| Información de la empresa | Razón social, NIT, persona de contacto, correo y teléfono de la empresa | Representantes de clientes ISP |
| Comunicaciones | Contenido de mensajes en el chat interno de la plataforma | Usuarios de la plataforma |
| Auditoría y seguridad | Registro de acciones (qué usuario hizo qué acción, cuándo y desde qué IP) | Usuarios de la plataforma |
| Recordatorios | Correo electrónico de destino para notificaciones de vencimiento | Administradores y contactos de clientes |

**No tratamos datos sensibles** (Art. 6 Ley 1581): no recopilamos datos de salud, biométricos, origen racial, opiniones políticas, convicciones religiosas ni datos procesales penales.

**No atendemos usuarios menores de edad.** La plataforma está dirigida exclusivamente a personas jurídicas y sus representantes legales mayores de edad.

---

## 5. Finalidades del tratamiento

Tratamos sus datos personales para:

1. **Autenticación y acceso:** verificar su identidad y gestionar el acceso a la plataforma.
2. **Prestación del servicio:** gestionar las obligaciones de cumplimiento regulatorio de su empresa ISP.
3. **Comunicaciones del servicio:** enviar recordatorios de vencimiento de obligaciones y notificaciones operativas.
4. **Soporte y atención:** gestionar sus consultas y solicitudes a través del chat y sistema de tickets.
5. **Seguridad y auditoría:** registrar acciones para detectar accesos no autorizados y garantizar la trazabilidad.
6. **Cumplimiento legal:** cumplir con obligaciones legales aplicables a Owl Compliance.

---

## 6. Base de licitud del tratamiento

El tratamiento se basa en:
- **Autorización previa, expresa e informada del titular** (Art. 9 Ley 1581) — obtenida al momento del registro en la plataforma.
- **Ejecución del contrato de servicios** suscrito con la empresa cliente.
- **Obligación legal** para el mantenimiento de registros de auditoría y seguridad (Art. 17 lit. i Ley 1581).

---

## 7. Derechos del titular (Habeas Data)

Como titular de datos personales, usted tiene derecho a:

| Derecho | Descripción | Plazo de respuesta |
|---|---|---|
| **Consulta (acceso)** | Conocer qué datos tenemos sobre usted y para qué los usamos | 10 días hábiles (prorrogable 5 días hábiles más, avisando antes del vencimiento) |
| **Rectificación / Actualización** | Corregir datos inexactos o desactualizados | 15 días hábiles (prorrogable 8 días hábiles más) |
| **Supresión** | Solicitar la eliminación de sus datos cuando no haya obligación legal de conservarlos | 15 días hábiles |
| **Revocación de autorización** | Retirar el consentimiento para el tratamiento | 15 días hábiles |
| **Presentar queja ante la SIC** | Si considera que sus derechos han sido vulnerados, puede acudir a la SIC (solo después de presentar reclamo ante Owl Compliance) | — |

Para ejercer estos derechos, contacte: **[COMPLETAR: ej. datos@owlcompliance.co]** con el asunto "Solicitud Habeas Data".

---

## 8. Encargados del tratamiento y transmisiones internacionales

Owl Compliance trabaja con los siguientes encargados del tratamiento, a quienes transmite datos personales bajo contrato para la prestación del servicio:

| Proveedor | País | Función | Nivel adecuado (SIC) |
|---|---|---|---|
| Turso Inc. | Estados Unidos | Base de datos en la nube | ✅ Sí |
| Resend | Estados Unidos | Envío de correos de recordatorio | ✅ Sí |
| Google LLC | Estados Unidos | Almacenamiento opcional de documentos (Google Drive) | ✅ Sí |
| Microsoft Corporation | Estados Unidos | Almacenamiento opcional de documentos (SharePoint/OneDrive) | ✅ Sí |

Todos los países anteriores cuentan con nivel adecuado de protección reconocido por la SIC (Circular Única — Título V, numeral 3.2). No realizamos transferencias de datos a responsables en países sin nivel adecuado.

---

## 9. Seguridad de la información

Aplicamos medidas técnicas, administrativas y humanas proporcionales al riesgo para garantizar la confidencialidad, integridad y disponibilidad de sus datos personales, entre ellas:

- Cifrado de contraseñas mediante función de hashing segura.
- Control de acceso basado en roles (admin / cliente / superadmin).
- Registro de auditoría de todas las acciones relevantes.
- Segregación de datos por cliente (multi-tenant).
- Uso de variables de entorno para credenciales y secretos.
- Comunicaciones cifradas mediante TLS/HTTPS en producción.

En caso de un incidente de seguridad que afecte sus datos, le notificaremos dentro del plazo legal y reportaremos a la SIC según corresponda.

---

## 10. Plazos de conservación

Conservamos sus datos personales durante el tiempo necesario para cumplir las finalidades descritas y las obligaciones legales aplicables:

- **Datos de usuarios y clientes:** durante la vigencia de la relación contractual y [COMPLETAR: ej. 5 años] después de su terminación.
- **Registros de auditoría:** [COMPLETAR: ej. 5 años] desde la fecha del registro.
- **Mensajes y conversaciones:** [COMPLETAR: ej. 2 años] desde el cierre de la conversación.

---

## 11. Modificaciones a esta política

Notificaremos cambios materiales a esta política con al menos 10 días hábiles de anticipación, a través del correo electrónico registrado en la plataforma.

---

## 12. Vigencia

Esta política rige a partir del [COMPLETAR: fecha de publicación].

---

**Owl Compliance** — Owl Compliance · [COMPLETAR: ciudad], Colombia · [correo por confirmar]

*Este documento es un borrador generado con compliance-co (pack ley-1581). No constituye asesoría legal.*
