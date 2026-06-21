---
id: 03
title: About & Contact — Arcade Vault
state: Implementado
date: 2026-06-20
dependencies: [02]
---

**Objetivo:** Implementar la página `/about` portando `about.jsx` del template a Next.js 16 con formulario de contacto funcional via Resend (API Route), confirmación automática al remitente, y enlace "Acerca de" en el Nav.

---

## Scope

### Incluido

- **Ruta `/about`** — página client component portada de `about.jsx`:
  - Hero: kicker, título, texto misión, 3 highlights con `HighlightIcon` (pixel SVG).
  - Divider animado (píxeles parpadeantes).
  - Sección contacto: columna intro + formulario (nombre, email, mensaje).
  - Shake animation si algún campo vacío al enviar.
  - Estado loading en el botón mientras se llama la API.
  - Terminal de éxito (`terminal-success`) si el envío es exitoso.
  - Mensaje de error visible si la API falla.
- **API Route** — `app/api/contact/route.ts` (POST):
  - Valida que los 3 campos no estén vacíos.
  - Llama a Resend con 2 emails:
    1. **Notificación al equipo** → `valeroman@gmail.com` con nombre, email y mensaje.
    2. **Confirmación al remitente** → al email del formulario.
  - Remitente: `onboarding@resend.dev` (sandbox Resend — sin dominio propio aún).
- **Variable de entorno** — `RESEND_API_KEY` en `.env.local`.
- **Estilos** — portar clases del bloque `ABOUT PAGE` de `styles.css` (líneas 1072–1147) a `app/globals.css`.
- **Nav** — agregar enlace "Acerca de" (→ `/about`) en desktop y panel mobile; `isActive` para `pathname === "/about"`.

### No incluido

- Dominio propio verificado en Resend (se usa sandbox).
- Rate limiting en la API Route.
- Persistencia de mensajes en base de datos.
- HTML email elaborado (emails en texto plano / HTML simple).
- Tests.

---

## Data model

Sin nuevas estructuras persistentes. Solo un tipo local para la API Route:

```ts
// app/api/contact/route.ts
type ContactPayload = {
  name: string;
  email: string;
  msg: string;
};
```

`RESEND_API_KEY` se lee de `process.env.RESEND_API_KEY` en la API Route.

---

## Implementation plan

1. **Instalar Resend** — `npm install resend`.

2. **Variable de entorno** — agregar `RESEND_API_KEY=<tu_key>` a `.env.local`.

3. **API Route** — crear `app/api/contact/route.ts`:
   - Método POST; parsea JSON body como `ContactPayload`.
   - Valida que `name`, `email` y `msg` no estén vacíos → responde `400` si falla.
   - Instancia `new Resend(process.env.RESEND_API_KEY)`.
   - Envía email de notificación a `valeroman@gmail.com` (from: `onboarding@resend.dev`).
   - Envía email de confirmación al `email` del formulario (from: `onboarding@resend.dev`).
   - Responde `200 { ok: true }` si ambos envíos son exitosos; `500 { error: string }` si Resend falla.

4. **Portar estilos** — copiar el bloque `/* ===== ABOUT PAGE ===== */` de
   `references/resources/templates/home-about/styles.css` (líneas 1072–1147) a `app/globals.css`.
   Reusar variables y clases `.pixel`, `.btn`, `.field`, `.reveal`/`.in`, `.shake` ya existentes.

5. **Crear `app/about/page.tsx`** — client component (`"use client"`):
   - Sub-componente `HighlightIcon({ kind })` inline (portado de `about.jsx`).
   - Estado: `form`, `sent`, `shake`, `loading`, `error`.
   - `useEffect` con `IntersectionObserver` para `.reveal` (mismo patrón que home).
   - `onSubmit`: valida campos → activa `loading` → `fetch("/api/contact", { method:"POST", body: JSON.stringify(form) })` → si `ok` activa `sent`; si falla activa `error` con mensaje.
   - Botón deshabilitado y texto "ENVIANDO…" durante `loading`.
   - Mensaje de error debajo del botón si `error` está activo.
   - Terminal de éxito (`terminal-success`) idéntica al template cuando `sent` es truthy.

6. **Actualizar `components/Nav.tsx`** — agregar enlace "Acerca de" (→ `/about`) después de
   "Salón de la Fama" en desktop y en el panel mobile; ampliar `isActive` con
   `pathname === "/about"`.

---

## Acceptance criteria

- [ ] `/about` carga y muestra las 3 secciones en orden: hero, divider animado, contacto.
- [ ] Los 3 highlights muestran sus íconos pixel SVG con colores correctos (magenta, cyan, green).
- [ ] El divider muestra los 24 píxeles parpadeando en cyan/magenta/yellow.
- [ ] Si se envía el formulario con algún campo vacío, el form hace shake y no llama a la API.
- [ ] Durante el envío el botón muestra "ENVIANDO…" y está deshabilitado.
- [ ] Tras envío exitoso se muestra la terminal `terminal-success` con el nombre del remitente en mayúsculas.
- [ ] `valeroman@gmail.com` recibe el email de notificación con nombre, email y mensaje del formulario.
- [ ] El remitente recibe el email de confirmación automático en su dirección.
- [ ] Si Resend devuelve error, el form muestra un mensaje de error visible (no aparece la terminal de éxito).
- [ ] "ENVIAR OTRO MENSAJE" limpia el form y regresa al estado inicial.
- [ ] El Nav muestra "Acerca de" como enlace activo en `/about` (desktop y mobile).
- [ ] Las secciones con `.reveal` aparecen con animación al hacer scroll.
- [ ] No hay regresiones visuales en las páginas existentes (`/`, `/games`, `/hall-of-fame`, `/auth`).

---

## Decisions taken and discarded

| Decisión                  | Elegida                                | Descartada                  | Razón                                                           |
| ------------------------- | -------------------------------------- | --------------------------- | --------------------------------------------------------------- |
| Mecanismo de envío        | API Route (`app/api/contact/route.ts`) | Server Action               | Preferencia explícita del usuario; más fácil de probar con curl |
| Remitente Resend          | `onboarding@resend.dev` (sandbox)      | Dominio propio              | Sin dominio verificado en Resend aún                            |
| Confirmación al remitente | Sí                                     | Solo notificación al equipo | Decisión del usuario                                            |
| HTML email                | Texto plano / HTML simple              | Template elaborado          | MVP; sin diseño de emails definido aún                          |
| `HighlightIcon`           | Inline en `app/about/page.tsx`         | Componente separado         | Consistente con el patrón de home y el template                 |
| Rate limiting             | Excluido                               | Incluido                    | MVP; sin infraestructura de límites aún                         |

---

## Identified risks

- **Sandbox Resend.** `onboarding@resend.dev` solo puede enviar al email del dueño de la cuenta Resend.
  El email de confirmación al remitente fallará si su dirección no es la del propietario.
  Mitigación: documentar en el spec; migrar a dominio propio cuando esté verificado.

- **`RESEND_API_KEY` ausente en producción.** Si la variable no se configura en el entorno de deploy,
  la API Route responderá 500. Mitigación: la API Route valida que la key exista antes de instanciar Resend.
