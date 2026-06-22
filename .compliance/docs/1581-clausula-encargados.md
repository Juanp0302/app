# Cláusula de Encargo de Tratamiento — Owl Compliance

> Base legal: Arts. 17, 18 Ley 1581 de 2012; Arts. 25-26 Decreto 1377 de 2013.
> Usar con cada proveedor que procese datos personales por cuenta de Owl Compliance.

---

## Proveedores que requieren cláusula de encargo

| Proveedor | Datos que procesa | DPA disponible | Estado |
|---|---|---|---|
| **Turso Inc.** | BD completa (usuarios, clientes, mensajes, audit_log) | Verificar en turso.tech/legal | [COMPLETAR: ¿firmado?] |
| **Resend** | Email de destinatario + contenido de recordatorios | Verificar en resend.com/legal | [COMPLETAR] |
| **Google LLC** | Tokens OAuth + documentos en Google Drive | Google Data Processing Amendment (DPA) — aceptar en Google Cloud Console | [COMPLETAR] |
| **Microsoft Corp.** | Tokens OAuth + documentos OneDrive/SharePoint | Microsoft DPA — disponible en microsoft.com/en-us/trust-center | [COMPLETAR] |

> **Nota:** Todos los países son EE.UU., con nivel adecuado reconocido por la SIC. Las relaciones son de transmisión (encargados), no de transferencia a responsables. No se requiere Declaración de Conformidad ni autorización SIC (Circular Única Título V, numerales 3.2 y 3.3).

---

## Cláusula tipo para contratos con proveedores

**CLÁUSULA [N] — TRATAMIENTO DE DATOS PERSONALES**

**[N].1 Roles.** Para efectos de la Ley 1581 de 2012, **Owl Compliance** actúa como **Responsable del Tratamiento** y **[NOMBRE DEL PROVEEDOR]** actúa como **Encargado del Tratamiento** de los datos personales a los que tenga acceso en virtud del presente contrato.

**[N].2 Instrucciones.** El Encargado tratará los datos personales **únicamente** siguiendo las instrucciones del Responsable y para las finalidades establecidas en este contrato: [DESCRIBIR, ej. para Turso: "almacenamiento y recuperación de datos en base de datos libSQL"]. Queda prohibido al Encargado: (i) usar los datos para fines propios; (ii) cederlos a terceros sin autorización escrita previa del Responsable; (iii) transferirlos a países sin nivel adecuado de protección.

**[N].3 Seguridad.** El Encargado adoptará medidas técnicas, administrativas y humanas necesarias para garantizar la seguridad de los datos personales (Art. 17 lit. i Ley 1581; Art. 25 Decreto 1377).

**[N].4 Confidencialidad.** El Encargado garantiza la confidencialidad, incluso después de terminado el contrato (Art. 18 lit. d Ley 1581).

**[N].5 Notificación de incidentes.** El Encargado notificará al Responsable **dentro de las 24 horas** siguientes a conocer un incidente de seguridad que afecte los datos personales, con la información necesaria para que el Responsable cumpla su obligación de notificación a la SIC (plazo: 15 días hábiles desde la detección — Circular Única Título V, cap. 2).

**[N].6 Sub-encargados.** El Encargado no podrá contratar sub-encargados sin autorización previa del Responsable.

**[N].7 Devolución y supresión.** Al terminar el contrato, el Encargado devolverá o suprimirá todos los datos personales y certificará la supresión por escrito.

**[N].8 Auditorías.** El Responsable podrá realizar auditorías con preaviso razonable.

---

## Transmisión internacional (EE.UU.)

Los proveedores anteriores se ubican en **Estados Unidos**, país con nivel adecuado de protección de datos reconocido por la SIC (Circular Única — Título V, numeral 3.2, versión 29-09-2022). Por lo tanto:

- **No se requiere Declaración de Conformidad** ante la SIC.
- **No se requiere autorización de la SIC** para estas transmisiones.
- Las garantías se establecen mediante el contrato de encargo descrito arriba.

Si en el futuro se contrata un proveedor en un país **sin** nivel adecuado, se deberá suscribir un contrato con el receptor — lo que hace **presumir la Declaración de Conformidad** (Título V, numeral 3.3, parágrafo), sin necesidad de trámite adicional ante la SIC.

---

## Cómo Owl Compliance actúa como encargado de sus clientes ISP

Cuando los clientes ISP suben documentos de cumplimiento a la plataforma, esos documentos pueden contener datos personales de sus propios empleados o usuarios. En ese caso:

- El **cliente ISP** es el **responsable** del tratamiento de esos datos.
- **Owl Compliance** actúa como **encargado** del ISP.
- El contrato de servicios entre Owl Compliance y el cliente ISP debe incluir la cláusula tipo de encargo (con los roles invertidos).

**Acción requerida:** Revisar el contrato de servicios con clientes ISP e incluir cláusula de encargo.

---

*Borrador generado con compliance-co (pack ley-1581). No constituye asesoría legal. Revisar con abogado antes de suscribir.*
