# Mecanismo de Autorización de Tratamiento de Datos — Owl Compliance

> Base legal: Arts. 9, 11 Ley 1581 de 2012; Art. 7 Decreto 1377 de 2013.
> La autorización debe ser **previa, expresa e informada**. Debe conservarse la prueba.

---

## Estado actual: ❌ NO implementado

La auditoría del código no encontró mecanismo de autorización explícita en ningún flujo de registro o creación de usuarios. Esto es un incumplimiento del Art. 9 Ley 1581.

---

## Cambios de código requeridos

### 1. Migración de base de datos

Agregar columnas a la tabla `users` para registrar la autorización:

```sql
ALTER TABLE users ADD COLUMN autorizacion_otorgada_at TEXT;
ALTER TABLE users ADD COLUMN autorizacion_texto_version TEXT;
-- Ejemplo: '2026-06-22T22:50:52Z' y 'v1.0'
```

### 2. Frontend — Formulario de login / registro

En `app/login/page.tsx` (o en el formulario de primer acceso), agregar:

```tsx
// Antes del botón de enviar:
<div style={{ marginBottom: '1rem' }}>
  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
    <input
      type="checkbox"
      required
      checked={autorizacion}
      onChange={e => setAutorizacion(e.target.checked)}
      style={{ marginTop: '2px', flexShrink: 0 }}
    />
    <span style={{ fontSize: '0.75rem', color: '#270205', lineHeight: 1.5 }}>
      He leído el{' '}
      <a href="/privacidad" target="_blank" style={{ color: '#968622', fontWeight: 700 }}>
        Aviso de Privacidad
      </a>
      {' '}y autorizo el tratamiento de mis datos personales por parte de{' '}
      [COMPLETAR: razón social] para las finalidades descritas,
      de acuerdo con la Ley 1581 de 2012.
    </span>
  </label>
</div>
```

### 3. Backend — Guardar la autorización

En `lib/clientes.ts`, función `crearCliente`, guardar la autorización al crear el usuario:

```typescript
// Agregar al INSERT de users:
{ sql: `INSERT INTO users (id, email, password, nombre, rol, autorizacion_otorgada_at, autorizacion_texto_version)
        VALUES (?, ?, ?, ?, 'cliente', datetime('now'), ?)`,
  args: [userId, input.user_email, hashPassword(input.user_password), input.user_nombre, 'v1.0'] }
```

### 4. Versionar el texto del aviso

Mantener un registro de las versiones del aviso de privacidad:

```typescript
// lib/autorizacion-versiones.ts
export const AVISO_VERSION = 'v1.0'
export const AVISO_TEXTO = `He leído el Aviso de Privacidad y autorizo el tratamiento...`
// Al cambiar el texto, incrementar la versión y notificar a los titulares existentes.
```

---

## Excepciones a la autorización previa (Art. 10 Ley 1581)

En los siguientes casos NO se requiere autorización previa del titular:
- Datos de naturaleza pública (información en registros públicos).
- Emergencia médica o sanitaria.
- Tratamiento de datos para fines periodísticos, históricos, estadísticos o científicos.
- Obligación legal o judicial.

Estos casos **no aplican** a los flujos principales de Owl Compliance; se requiere autorización en todos los flujos de registro.

---

*Borrador generado con compliance-co (pack ley-1581). No constituye asesoría legal.*
