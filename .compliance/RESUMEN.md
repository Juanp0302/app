# Resumen de Compliance — Owl Compliance · Ley 1581 de 2012
**Empresa:** Owl Compliance · **NIT:** [por confirmar] · **Bogotá, Cundinamarca**
**Representante legal / Responsable de tratamiento:** Nicolás Almeyda Orozco
**Tamaño:** Microempresa · **RNBD:** No obligada (activos ≤ 100.000 UVT, privada)
**Fecha:** 22 de junio de 2026 · **Commit auditado:** 1468c74
**Corrida:** Primera auditoría

---

## Postura general

```
Score Ley 1581:  33%  ███░░░░░░░░░░░░░░░░░
                 (8 de 24 controles evaluables en ✅ o ✅½)

✅ CUMPLE:  5   (gov-responsable*, gov-registro*, sec-logs, sec-tenant, sec-secrets)
⚠️ PARCIAL: 6   (gov-auditoria, data-transfer, data-eipd, data-minimizacion, data-privacy-by-design, sec-tls, sec-rest)
❌ FALTA:  13   (gov-politicas, gov-denuncias, data-licitud, data-autorizacion, data-derechos,
                 data-info, data-encargados, data-rights-channel, data-pseudonym,
                 sec-passwords, sec-mfa, inc-brechas, sec-monitoring)
❓ DESCONOCIDO: 2  (gov-capacitacion, sec-backups)

* gov-responsable: Nicolás Almeyda Orozco designado como responsable de tratamiento.
* gov-registro: No aplica — microempresa, no obligada al RNBD.
```

---

## Lo que SÍ está bien

- **Segregación multi-tenant** (sec-tenant ✅): cada cliente tiene su `cliente_id` y todas las queries filtran por este. Buen diseño.
- **Audit log** (sec-logs ✅): tabla `audit_log` con registro de acciones, user_email, IP y detalle JSON. Sólido.
- **Secretos fuera del código** (sec-secrets ✅): uso correcto de variables de entorno. `.env.local` no se commitea.
- **Proveedores en países con nivel adecuado** (data-transfer ⚠️): todos los proveedores externos (Turso, Resend, Google, Microsoft) están en EE.UU., que la SIC reconoce como país con nivel adecuado. No se requiere Declaración de Conformidad ni autorización SIC.
- **Control de acceso por roles**: middleware y API routes verifican permisos correctamente.

---

## Hallazgos críticos (actuar ya)

### 🔴 CRÍTICO: Hashing de contraseñas con SHA-256 (sec-passwords ❌)
**Archivo:** `lib/auth.ts:7`, `lib/clientes.ts:22`
**Riesgo:** Si la base de datos es comprometida, las contraseñas son recuperables mediante ataques de diccionario o rainbow tables. SHA-256 con salt fijo NO es aceptable para almacenar contraseñas.
**Fix:** Usar `bcryptjs` (ya en package.json) con factor de costo ≥12.
```typescript
// Reemplazar:
crypto.createHash('sha256').update(pwd + 'owl_salt_2026').digest('hex')
// Por:
import bcrypt from 'bcryptjs'
await bcrypt.hash(pwd, 12)  // para crear
await bcrypt.compare(pwd, hash)  // para verificar
```
**Migración:** Al primer login exitoso con la contraseña antigua (verificada contra el hash SHA-256), regenerar el hash con bcrypt y guardarlo.

---

### 🔴 CRÍTICO: Sin aviso de privacidad ni mecanismo de autorización (data-licitud ❌, data-info ❌, data-autorizacion ❌)
**Archivos:** `app/login/page.tsx`, `lib/clientes.ts:crearCliente`
**Riesgo:** Incumplimiento directo del Art. 9 Ley 1581. La SIC puede sancionar con hasta 2.000 SMMLV.
**Fix:** 
1. Publicar política de privacidad en `/privacidad` (usar `docs/1581-politica-privacidad.md`).
2. Agregar aviso de privacidad y checkbox de autorización en el login/registro.
3. Guardar timestamp y versión del aviso aceptado en tabla `users`.

Ver `docs/1581-autorizacion-tratamiento.md` para el código exacto.

---

### 🔴 CRÍTICO: Sin canal de Habeas Data (data-derechos ❌, data-rights-channel ❌)
**Riesgo:** Sin canal habilitado, si un titular hace una solicitud de consulta o reclamo y no es atendida en el plazo legal (10/15 días hábiles), puede acudir directamente a la SIC.
**Fix mínimo:** Publicar email de contacto en la política de privacidad. Ver `docs/1581-canal-habeas-data.md`.

---

### 🟡 ALTO: Sin MFA para administradores (sec-mfa ❌)
**Riesgo:** Si un admin es víctima de phishing o credential stuffing, el atacante tiene acceso completo a todos los datos de todos los clientes ISP.
**Fix:** Implementar TOTP con `otplib` o magic link por correo. Ver `references/build/index.md`.

---

### 🟡 ALTO: Tokens OAuth en BD sin cifrar (sec-rest ⚠️)
**Archivo:** `app/api/storage/config/route.ts:34-37`, columna `clientes.storage_config`
**Riesgo:** Los tokens de acceso de Google y Microsoft se almacenan como JSON en la BD. Si la BD es comprometida, los atacantes tienen acceso a los documentos en Google Drive/SharePoint de los clientes.
**Fix:** Cifrar `storage_config` con AES-256 antes de guardar; descifrar al leer.

---

### 🟡 ALTO: Sin contratos de encargo (DPA) con proveedores (data-encargados ❌)
**Proveedores:** Turso, Resend, Google, Microsoft.
**Fix:**
- Turso: verificar si sus ToS incluyen términos de encargo adecuados; en caso contrario, suscribir DPA.
- Google: aceptar el Data Processing Amendment en Google Cloud Console.
- Microsoft: suscribir el Data Processing Agreement en el portal de Microsoft.
- Resend: verificar ToS de Resend para términos de encargo.

---

## Hallazgos pendientes de información del usuario

Los siguientes controles requieren información que no está en el código:

| Control | Información necesaria |
|---|---|
| gov-responsable | ¿Quién está designado formalmente como responsable de tratamiento? |
| gov-registro | ¿Está inscrita en el RNBD? ¿Cuál es el tamaño de la empresa? |
| gov-capacitacion | ¿Hay capacitación documentada del equipo en protección de datos? |
| sec-backups | ¿Está documentada la política de backups de Turso? ¿Se han probado restauraciones? |

---

## Plan de acción prioritario

| Prioridad | Acción | Archivo de referencia | Plazo sugerido |
|---|---|---|---|
| 🔴 1 | Migrar contraseñas a bcrypt | `docs/1581-autorizacion-tratamiento.md` | Esta semana |
| 🔴 2 | Publicar política de privacidad y aviso en la app | `docs/1581-politica-privacidad.md`, `docs/1581-aviso-privacidad.md` | Esta semana |
| 🔴 3 | Agregar checkbox de autorización en login/registro | `docs/1581-autorizacion-tratamiento.md` | Esta semana |
| 🔴 4 | Habilitar canal de Habeas Data (email mínimo) | `docs/1581-canal-habeas-data.md` | Esta semana |
| 🟡 5 | Implementar MFA para admins | `references/build/index.md` | 30 días |
| 🟡 6 | Cifrar tokens OAuth en BD | `docs/1581-eipd.md` | 30 días |
| 🟡 7 | Firmar DPA con Turso, Resend, Google, Microsoft | `docs/1581-clausula-encargados.md` | 30 días |
| 🔵 8 | Determinar obligación RNBD según tamaño/activos | `docs/1581-procedimiento-rnbd.md` | 30 días |
| 🔵 9 | Implementar endpoint de Habeas Data en la API | `docs/1581-canal-habeas-data.md` | 60 días |
| 🔵 10 | Configurar monitoreo y alertas en audit_log | `references/build/monitoreo.md` | 60 días |

---

## Siguientes pasos

1. **Responder las preguntas pendientes** (razón social, NIT, tamaño, RNBD) para completar los documentos con [COMPLETAR].
2. **Completar los 4 items críticos** esta semana — especialmente bcrypt y el aviso de privacidad.
3. **Commitear este directorio** para tener el estado versionado:
   ```
   git add .compliance && git commit -m "compliance: primera auditoría Ley 1581 - score 27%"
   ```
4. **Re-correr `/compliance-co`** después de implementar las correcciones para ver el avance.

---

## Documentos generados en esta corrida

| Documento | Archivo |
|---|---|
| Registro de Actividades de Tratamiento (RAT) | `docs/1581-rat.md` |
| Política de privacidad | `docs/1581-politica-privacidad.md` |
| Aviso de privacidad (para login) | `docs/1581-aviso-privacidad.md` |
| Mecanismo de autorización | `docs/1581-autorizacion-tratamiento.md` |
| Canal de Habeas Data | `docs/1581-canal-habeas-data.md` |
| Cláusula de encargados | `docs/1581-clausula-encargados.md` |
| Plan de respuesta a brechas | `docs/1581-plan-respuesta-brechas.md` |
| Registro de incidentes | `docs/1581-registro-incidentes.md` |
| Procedimiento RNBD | `docs/1581-procedimiento-rnbd.md` |
| EIPD | `docs/1581-eipd.md` |

---

*Generado con compliance-co (pack ley-1581). No constituye asesoría legal. Responsable del tratamiento: Nicolás Almeyda Orozco — Owl Compliance, Bogotá.*
