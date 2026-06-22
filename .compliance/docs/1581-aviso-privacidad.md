# Aviso de Privacidad — Owl Compliance

> **Para incluir en el formulario de login / creación de usuario, visible antes de recoger datos.**
> Base legal: Art. 15 Decreto 1377 de 2013.

---

**Owl Compliance**, NIT [por confirmar], responsable del tratamiento de sus datos personales, le informa:

**¿Qué datos recopilamos?** Nombre, correo electrónico y contraseña para la creación de su cuenta en la plataforma Owl Compliance.

**¿Para qué los usamos?** Autenticación y acceso a la plataforma; prestación del servicio de gestión de cumplimiento regulatorio; envío de recordatorios operativos.

**¿Con quién los compartimos?** Con Turso Inc. (EE.UU.) para almacenamiento en la nube y Resend (EE.UU.) para envío de correos. Ambos países cuentan con nivel adecuado de protección reconocido por la SIC.

**Sus derechos:** Puede consultar, rectificar, actualizar, suprimir sus datos o revocar su autorización escribiendo a **[COMPLETAR: ej. datos@owlcompliance.co]**. Plazo de respuesta: 10 días hábiles para consultas, 15 días hábiles para reclamos (Art. 14 Ley 1581 de 2012).

**Política completa:** Disponible en [COMPLETAR: URL, ej. https://owlcompliance.co/privacidad].

---

## Texto para checkbox de autorización (incluir en el formulario)

```
☐ He leído el Aviso de Privacidad y autorizo el tratamiento de mis datos personales
  por parte de [COMPLETAR: razón social] para las finalidades descritas,
  de acuerdo con la Ley 1581 de 2012.
```

> **Implementación requerida:** Agregar este checkbox con enlace al aviso completo en:
> - `app/login/page.tsx` (en el primer login o registro)
> - Formulario de creación de clientes (`app/api/clientes/route.ts`)
> - Conservar timestamp y versión del aviso aceptado en la tabla `users`

*Borrador generado con compliance-co (pack ley-1581). No constituye asesoría legal.*
