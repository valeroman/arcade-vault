---
id: 13
title: Checklist de seguridad básica — Arcade Vault
state: Implementado
date: 2026-09-13
dependencies: [04, 12]
---

**Objetivo:** Cerrar el checklist de seguridad básico
(`references/resources/security/security-checklist.md`) agregando headers HTTP de seguridad en
Next.js, revocando el acceso público a la función huérfana `rls_auto_enable()` vía SQL, validando
en el cliente (regex: mínimo 8 caracteres, mayúscula, minúscula, dígito y símbolo) la contraseña
antes de crearla o resetearla para no enviar a Supabase una que ya sabemos que va a fallar, y
dejando documentadas como pasos manuales de Dashboard las 3 políticas de Supabase Auth restantes
(longitud mínima de contraseña, protección de contraseñas filtradas, límite de signups por IP)
además del INSERT público de `scores` como riesgo aceptado.

---

## Scope

### Incluido

- **Headers de seguridad HTTP** (`next.config.ts`): agregar la función `headers()` con los 3
  headers exactos del checklist (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`) aplicados a `/(.*)`.
- **`supabase/schema.sql`** (bloque nuevo, idempotente, mismo patrón que el resto del archivo):
  `REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;` para resolver
  los 2 hallazgos WARN de `rls_auto_enable()` sin borrar la función.
- **`app/auth/password.ts`** (nuevo, helper compartido): exporta la regex de complejidad
  (`/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/`) y una función
  `validatePassword(pass: string): string | null` que devuelve `null` si es válida o un mensaje de
  error en español (p. ej. "La contraseña debe tener mínimo 8 caracteres, con mayúscula,
  minúscula, número y símbolo.") si no.
- **`app/auth/page.tsx`**: en `submit`, cuando `tab === "up"`, llama `validatePassword(pass)`
  antes de `supabase.auth.signUp()` — si devuelve un mensaje, lo setea en el mismo estado `error`
  ya existente y hace `return` sin llamar a Supabase. El tab de login (`tab === "in"`) no se toca:
  sigue llamando `signInWithPassword` sin esta validación.
- **`app/auth/reset-password/page.tsx`**: reemplaza el chequeo actual `pass.length < 6` por
  `validatePassword(pass)` (mismo helper, mismo patrón de `error` ya existente), antes del chequeo
  de coincidencia (`pass !== confirm`) y antes de `updateUser({ password: pass })`.
- **Sección "Configuración externa (manual)"** en esta misma spec, documentando los 3 pasos a
  aplicar a mano en el Dashboard de Supabase (Authentication → Policies/Settings): longitud mínima
  de contraseña = 8, activar "Leaked password protection", limitar signups por IP — cada uno como
  criterio de aceptación manual, sin código ni SQL asociado.
- **Riesgo aceptado documentado** (sección Decisiones): `scores_insert_public` (`WITH CHECK
(true)` para `anon` en INSERT) se mantiene igual — es el diseño intencional del modo invitado
  (spec 12), sin cambios de policy.

### No incluido

- Cambiar la policy de INSERT en `scores` (queda como riesgo aceptado, no como cambio de código).
- `DROP FUNCTION rls_auto_enable()` — solo se revoca el `EXECUTE`, no se borra la función.
- Checklist en vivo de requisitos de contraseña mientras se tipea — el feedback es solo al
  enviar (mensaje de error), no una UI nueva de progreso.
- Validar la contraseña en el formulario de INICIAR SESIÓN — solo signup y reset-password (las 2
  pantallas que crean/reemplazan una contraseña).
- Headers adicionales a los 3 del checklist (sin `Strict-Transport-Security` ni
  `Permissions-Policy`).
- Cualquier cambio a `middleware.ts`, RLS de `games`, o al esquema de `profiles` (spec 12) — sin
  cambios.
- Rate limiting a nivel de aplicación, CAPTCHA, 2FA — fuera de alcance del checklist básico.
- Tests automatizados (no hay test runner en el proyecto).

---

## Data model

Esta spec no introduce nuevas estructuras de datos — no hay tablas ni columnas nuevas. El único
cambio en `schema.sql` es un `REVOKE` sobre una función existente (no una definición de datos), y
`password.ts` es solo una función de validación en memoria, sin persistencia. Se omite esta
sección.

---

## Plan de implementación

1. **Headers de seguridad** — agregar `headers()` a `next.config.ts` con los 3 headers
   (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) aplicados a `/(.*)`.
   Verificable de inmediato con `npm run dev` + inspección de respuesta HTTP, sin tocar nada más.
2. **`supabase/schema.sql`** — agregar al final el bloque
   `REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;` con su
   comentario explicativo (mismo estilo que el resto del archivo), listo para aplicar a mano en el
   SQL Editor.
3. **`app/auth/password.ts`** (nuevo) — regex de complejidad + `validatePassword()`, sin
   consumidores todavía. El sistema sigue funcional (archivo aislado, nadie lo importa aún).
4. **`app/auth/page.tsx`** — importar `validatePassword` y llamarlo en `submit` cuando
   `tab === "up"`, antes del `supabase.auth.signUp()`; si devuelve mensaje, setearlo en `error` y
   `return`. Login (`tab === "in"`) sin cambios.
5. **`app/auth/reset-password/page.tsx`** — importar `validatePassword`, reemplazar el
   `if (pass.length < 6)` por la llamada al helper, mismo flujo de `error` ya existente.
6. **Sección de configuración manual** — ya queda escrita en esta misma spec (Scope); no requiere
   paso de código, pero se verifica manualmente contra el Dashboard de Supabase como parte de los
   criterios de aceptación.

Cada paso deja el sistema funcional y es independiente de los siguientes (se puede pausar entre
pasos sin dejar nada roto).

---

## Acceptance criteria

**Código (verificable en el repo):**

- [ ] `next.config.ts` responde con los 3 headers (`X-Content-Type-Options: nosniff`,
      `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`) en cualquier
      ruta (`curl -I` o DevTools → Network).
- [ ] `supabase/schema.sql` contiene el bloque
      `REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;`, aplicado
      en el SQL Editor sin error.
- [ ] `app/auth/password.ts` existe, exporta `validatePassword()`, y rechaza cualquier
      contraseña que le falte minúscula, mayúscula, dígito, símbolo o los 8 caracteres mínimos.
- [ ] En `/auth`, tab CREAR CUENTA: escribir una contraseña que no cumple la regex y enviar el
      form **no dispara ninguna llamada de red a Supabase** (verificable en DevTools → Network) y
      muestra el mensaje de error bajo el form.
- [ ] En `/auth`, tab CREAR CUENTA: una contraseña que sí cumple la regex sigue creando la cuenta
      normalmente (flujo de spec 12 intacto).
- [ ] En `/auth`, tab INICIAR SESIÓN: el login **no** aplica esta validación — sigue llamando
      `signInWithPassword` sin importar el formato de la contraseña tecleada.
- [ ] En `/auth/reset-password`: una contraseña que no cumple la regex muestra el mensaje de
      error y no llama a `updateUser`; una que sí cumple guarda la contraseña normalmente.

**Manual (Dashboard de Supabase Auth):**

- [ ] Longitud mínima de contraseña configurada en 8.
- [ ] "Leaked password protection" activada.
- [ ] Límite de signups por IP configurado (anti-bot).

**Documental:**

- [ ] Esta spec deja registrado en Decisiones el riesgo aceptado de `scores_insert_public`.

---

## Decisiones tomadas y descartadas

- **`scores_insert_public` se mantiene como está (riesgo aceptado), no se endurece.** Es el
  diseño intencional del modo invitado (spec 12): cualquiera puede jugar y subir un score sin
  sesión. Endurecer el `WITH CHECK` agregaría superficie de cambio en SQL y riesgo de romper
  submits legítimos, para un WARN que en este contexto (leaderboard de arcade, sin datos
  sensibles) es aceptable.
- **`rls_auto_enable()` se revoca (`REVOKE EXECUTE`), no se hace `DROP FUNCTION`.** La función no
  existe en `schema.sql` — es drift del proyecto Supabase en vivo, de origen desconocido.
  Revocar el acceso público resuelve los 2 hallazgos del linter sin arriesgar romper algo que
  dependa de ella.
- **Las 3 políticas de Supabase Auth (longitud mínima, leaked password protection, límite de
  signups) se documentan como pasos manuales, no como código.** El proyecto no usa Supabase CLI
  ni migraciones — todo el schema se aplica a mano en el SQL Editor (convención ya establecida), y
  estas 3 son settings de Dashboard, no SQL ni código de Next.js.
- **La regex de contraseña se valida solo en signup y reset-password, no en login.** Un usuario
  con cuenta creada antes de esta regla podría tener una contraseña que no cumple el patrón
  nuevo; bloquear su login por eso lo dejaría afuera de una cuenta válida.
- **El feedback de la regex es un mensaje de error al enviar, no un checklist en vivo mientras se
  tipea.** Reusa el patrón visual ya existente en `app/auth/page.tsx`/`reset-password/page.tsx`
  (`error` en magenta bajo el form) — cambio mínimo, sin componente de UI nuevo.
- **La regex vive en un helper compartido (`app/auth/password.ts`)** en vez de duplicarse en
  `page.tsx` y `reset-password/page.tsx` — misma regla, un solo lugar para mantenerla.
- **"Símbolo" = cualquier carácter no alfanumérico (`[^A-Za-z0-9]`), sin lista cerrada y sin largo
  máximo propio** — más simple de mantener que una lista explícita de símbolos permitidos.
- **Headers limitados a los 3 exactos del checklist**, sin agregar `Strict-Transport-Security` ni
  `Permissions-Policy` — respeta el alcance "básico" ya aprobado, sin expandirlo por iniciativa
  propia.

---

## Riesgos identificados

- **`REVOKE EXECUTE` sobre `rls_auto_enable()` podría romper algo desconocido.** Como no sabemos
  qué la creó ni si es interna del proyecto Supabase (linter, extensión, config previa), revocar
  el acceso público es la opción más segura ya elegida, pero si algo la invocaba vía RPC desde
  `anon`/`authenticated` dejaría de funcionar — mitigación: si eso pasa, es trivial revertir con
  `GRANT EXECUTE ... TO anon, authenticated;`.
- **Los 3 pasos manuales del Dashboard no quedan verificados por código.** Nada en el repo falla
  si alguien olvida activarlos — quedan como checklist manual sin gate automático.
- **La regex podría rechazar contraseñas legítimas con caracteres no-ASCII** (tildes, ñ, emoji)
  si el usuario las usa como "símbolo" esperando que cuenten — `[^A-Za-z0-9]` sí las acepta como
  símbolo, pero vale confirmarlo en pruebas manuales antes de aprobar.
- **`X-Frame-Options: DENY`** bloquea cualquier future embed del sitio en un iframe (p. ej. un
  widget compartido) — hoy no existe ese caso de uso, así que el riesgo es bajo, pero queda
  documentado por si surge más adelante.
