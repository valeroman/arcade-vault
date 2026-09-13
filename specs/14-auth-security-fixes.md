---
id: 14
title: Endurecimiento de auth — correcciones de auditoría de seguridad
state: Implementado
date: 2026-09-13
dependencies: [12, 13]
---

**Objetivo:** Cerrar los 5 hallazgos de seguridad abiertos del área `auth`: redirect no acotado a
backslash, errores de Supabase renderizados crudos, `/auth/reset-password` sin guard de sesión, el
link de recuperación que nunca llega al formulario de nueva contraseña, y el fallback de nombre
público que expone el email.

---

## Scope

### Incluido

- **`app/auth/callback/route.ts`**: reemplazar el guard `nextParam.startsWith("/") &&
!nextParam.startsWith("//")` por una validación robusta (`new URL(nextParam, origin).origin ===
origin`, o equivalente) antes de redirigir — cierra el bypass por backslash.
- **`app/auth/errors.ts`** (nuevo, helper compartido, mismo patrón que `password.ts`): exporta un
  mensaje fijo en español (`"No pudimos completar la operación. Revisa los datos e inténtalo de
nuevo."`) y una función `getAuthErrorMessage(error: unknown): string` que siempre lo devuelve,
  además de un `console.error(error)` interno para no perder el detalle en el log del
  servidor/consola.
- **`app/auth/page.tsx`**: reemplazar los 4 `setError(error.message)` crudos (login, signup, OAuth,
  forgot-password) por `getAuthErrorMessage(error)`; agregar `?next=/auth/reset-password` al
  `redirectTo` de `resetPasswordForEmail()`.
- **`app/auth/reset-password/page.tsx`**: reemplazar su `setError(error.message)` por
  `getAuthErrorMessage(error)`; verificar sesión al montar (`supabase.auth.getSession()`) y
  redirigir a `/auth` si no hay sesión; tras `updateUser()` exitoso, llamar `signOut()` y redirigir
  a `/auth` (en vez de `/games`).
- **`app/data/profile.ts`**: quitar el fallback a `user.email?.split("@")[0]` en
  `deriveDisplayName()`, dejando `"PLAYER1"` directo — coherente con el trigger
  `handle_new_user()`.

### No incluido

- A1 (políticas de Supabase Auth Dashboard) — ya aplicado por el usuario, fuera de este spec.
- El guard de reset-password no espera el evento `PASSWORD_RECOVERY` específico de
  `onAuthStateChange` — usa `getSession()` simple, más sencillo y suficiente para el caso.
- Mensajes de error diferenciados por categoría — un solo mensaje genérico, ya decidido.
- Hallazgos de las áreas `DATOS`, `API`, `CONFIG`, `CLIENTE` (RLS, HTML sin escapar del contacto,
  headers, `game.route`/`avatar_url`, etc.) — quedan fuera, son otras áreas.
- Rate limiting, CAPTCHA, 2FA.
- Tests automatizados (no hay test runner en el proyecto).

---

## Data model

Esta spec no introduce nuevas estructuras de datos persistentes — no hay tablas, columnas ni
claves de `localStorage` nuevas. El único artefacto nuevo es un helper en memoria:

```ts
// app/auth/errors.ts
export const GENERIC_AUTH_ERROR =
  "No pudimos completar la operación. Revisa los datos e inténtalo de nuevo.";

export function getAuthErrorMessage(error: unknown): string;
// Loguea `error` completo con console.error y siempre devuelve GENERIC_AUTH_ERROR.
```

Sin cambios en `profiles`, `games`, `scores`, o `games_with_stats`.

---

## Plan de implementación

1. **`app/auth/callback/route.ts`** — reemplazar el guard `startsWith("/") &&
!startsWith("//")` por `new URL(nextParam, origin).origin === origin` (con fallback a `/games`
   si no pasa). Cierra A2. Verificable: `?next=/\evil.com` ya no resuelve a un host externo.
2. **`app/auth/errors.ts`** (nuevo) — `GENERIC_AUTH_ERROR` + `getAuthErrorMessage()`. Sin
   consumidores todavía; el sistema sigue funcional.
3. **`app/auth/page.tsx`** — reemplazar los 4 `setError(error.message)` (login, signup, OAuth,
   forgot-password) por `getAuthErrorMessage(error)`. Verificable: login con credenciales
   incorrectas muestra el mensaje genérico, no el de Supabase.
4. **`app/auth/page.tsx`** — agregar `?next=/auth/reset-password` al `redirectTo` de
   `resetPasswordForEmail()`. Depende del paso 1 ya aplicado (el guard ya no es código muerto).
5. **`app/auth/reset-password/page.tsx`** — reemplazar su `setError(error.message)` por
   `getAuthErrorMessage(error)`.
6. **`app/auth/reset-password/page.tsx`** — agregar guard de sesión: `useEffect` de montaje llama
   `supabase.auth.getSession()`, redirige a `/auth` si no hay sesión. Cierra la mitad "sesión
   ajena" de A4.
7. **`app/auth/reset-password/page.tsx`** — tras `updateUser()` exitoso, llamar `signOut()` y
   redirigir a `/auth` (reemplaza el redirect a `/games`). Cierra la primitiva de "sesión
   indefinida" del recovery link.
8. **`app/data/profile.ts`** — en `deriveDisplayName()`, quitar el fallback
   `user.email?.split("@")[0]`, dejar `"PLAYER1"` directo.
9. **Verificación final end-to-end** — flujo completo "olvidé mi contraseña" (email → link →
   `/auth/reset-password` → nueva contraseña → login), confirmar que `?next=/\evil.com` ya no
   funciona, confirmar mensaje genérico en credenciales inválidas y en signup duplicado, `npm run
build` limpio.

Cada paso deja el sistema funcional; se puede pausar entre pasos sin romper nada.

---

## Acceptance criteria

- [x] `?next=/\evil.com` (y variantes con backslash) en `/auth/callback` ya no redirige fuera del
      origen — cae al fallback `/games`.
- [x] `?next=/auth/reset-password` en `/auth/callback` sigue funcionando (mismo origen, redirect
      válido).
- [x] `app/auth/errors.ts` existe, exporta `GENERIC_AUTH_ERROR` y `getAuthErrorMessage()`.
- [x] En `/auth`, login con credenciales incorrectas muestra el mensaje genérico en español, no el
      texto crudo de Supabase.
- [x] En `/auth`, signup con un email ya registrado muestra el mensaje genérico (no "User already
      registered").
- [x] En `/auth`, el error de `signInWithOAuth` (si falla) muestra el mensaje genérico.
- [x] El error de la solicitud de recuperación de contraseña ("¿Olvidaste tu contraseña?") muestra
      el mensaje genérico.
- [x] En `/auth/reset-password`, un error de `updateUser` (p. ej. contraseña débil, ya cubierto por
      `validatePassword`) muestra el mensaje genérico si Supabase lo rechaza igual.
- [x] Navegar directo a `/auth/reset-password` **sin sesión** redirige a `/auth`.
- [x] Flujo completo de recuperación: pedir reset en `/auth` → abrir el link del correo → llega a
      `/auth/reset-password` (ya no a `/games`) → cambiar contraseña → queda deslogueado → loguear
      con la contraseña nueva funciona.
- [x] Un usuario OAuth sin `display_name`/`full_name`/`name` (o con lectura fallida de `profiles`)
      muestra `"PLAYER1"`, nunca la parte local de su email.
- [x] `npm run build` sin errores de TypeScript ni imports rotos.
- [x] Sin regresiones en signup normal, login normal, OAuth normal, ni en el modo invitado de los 5
      juegos.

---

## Decisiones tomadas y descartadas

- **Guard de `next` con `new URL(v, origin).origin === origin`, no una lista de `startsWith` más
  larga.** Es el patrón correcto documentado en el hallazgo transversal del propio audit —
  cualquier variante nueva de bypass (backslash, doble slash, esquema) queda cubierta por comparar
  el `origin` resultante, en vez de ir parcheando `startsWith` caso por caso.
- **Un solo mensaje genérico para todos los errores de auth, no mensajes diferenciados por
  categoría.** Menor superficie de mantenimiento y cero riesgo de introducir una enumeración nueva
  por accidente (p. ej. distinguir "rate limit" de "credenciales" ya es información). Precedente
  exacto en el repo: `app/auth/callback/route.ts:22`.
- **El guard de `/auth/reset-password` usa `getSession()` simple, no espera el evento
  `PASSWORD_RECOVERY` de `onAuthStateChange`.** Más simple de implementar y suficiente: cualquier
  sesión activa ya deja pasar al formulario (igual que hoy), lo que se cierra es el acceso **sin**
  sesión alguna. Diferenciar el tipo de sesión (recovery vs. normal) queda fuera — ver Riesgos.
- **Tras cambiar la contraseña, `signOut()` + redirect a `/auth`, no a `/games`.** Consistente con
  cerrar la sesión: dejar al usuario en `/games` con una sesión que se acaba de cerrar sería
  confuso; `/auth` lo invita a loguear con la contraseña nueva, confirmando que quedó guardada.
- **`deriveDisplayName()` cae directo a `"PLAYER1"`, sin ninguna otra fuente adicional.** Coherente
  con el fallback ya usado por el trigger `handle_new_user()` (spec 12) — una sola convención de
  fallback en todo el proyecto.
- **A1 (políticas de Dashboard de Supabase Auth) no se repite en este spec.** El usuario confirmó
  que ya aplicó los 3 toggles; spec 13 sigue siendo el registro histórico de esa tarea.
- **Los hallazgos de las áreas `DATOS`, `API`, `CONFIG` y `CLIENTE` quedan fuera.** Este spec ataca
  solo `AUTH`; los demás requieren sus propios specs (tocan SQL, `app/api/contact/route.ts`,
  `next.config.ts`, etc., fuera del alcance pedido).

---

## Riesgos identificados

- **`getSession()` puede no estar hidratado aún en el primer render**, causando un redirect
  falso-positivo a `/auth` mientras la sesión de recovery todavía se está estableciendo justo
  después de volver de `/auth/callback`. Mitigación: mostrar un estado de carga breve mientras se
  resuelve `getSession()` antes de decidir el redirect, en vez de redirigir en el primer render
  vacío.
- **El guard de sesión no distingue una sesión de recovery de una sesión normal.** Con el fix,
  alguien con sesión normal activa (equipo compartido) sigue pudiendo entrar a
  `/auth/reset-password` y cambiar la contraseña sin conocer la actual — el `signOut()` posterior
  mitiga el impacto (no queda una sesión de recovery viva indefinidamente) pero no cierra el vector
  completo. Documentado como riesgo aceptado de esta iteración, no como pendiente silencioso.
- **Usuarios con un link de recuperación ya enviado antes de este cambio** (`redirectTo` sin
  `?next=`) seguirán cayendo en el comportamiento viejo hasta que pidan un nuevo link — no hay
  forma de invalidar links en vuelo.
- **El mensaje genérico único puede ocultar un error operativo real** (p. ej. Supabase caído)
  detrás del mismo texto que un error de usuario — se compensa con el `console.error(error)`
  interno del helper para que quede trazable en logs/consola, no visible al usuario.
