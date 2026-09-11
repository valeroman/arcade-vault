---
id: 12
title: Autenticación real con Supabase — Arcade Vault
state: Aprobado
date: 2026-09-11
dependencies: [04]
env:
  - NEXT_PUBLIC_SITE_URL
---

**Objetivo:** Reemplazar el login/registro simulado en localStorage por autenticación real de
Supabase Auth (email+password + OAuth Google/GitHub) con verificación de email y recuperación de
contraseña, agregando un perfil de jugador (`profiles`) cuyo `display_name` se usa para atribuir
puntajes automáticamente cuando hay sesión — manteniendo intacto el modo invitado (nombre manual,
sin login).

---

## Scope

### Incluido

- **`/auth`** (misma ruta, mismos tabs INICIAR SESIÓN/CREAR CUENTA): lógica reemplazada por
  `supabase.auth.signUp()` / `signInWithPassword()` / `signInWithOAuth({provider: "google"|"github"})`,
  con estados de carga/error por formulario.
- **Confirmación de email**: tras `signUp`, mensaje "revisa tu correo" (no auto-login); el link
  del correo apunta a `/auth/callback`.
- **`/auth/callback`** (nueva ruta, `route.ts`): intercambia el `code` (OAuth y confirmación de
  email) por sesión (`exchangeCodeForSession`) y redirige a `/games`.
- **Recuperar contraseña**: link "¿Olvidaste tu contraseña?" en el tab de login → pide email →
  `resetPasswordForEmail()` → pantalla nueva `/auth/reset-password` para setear la nueva
  contraseña (llega vía link de recovery, también pasa por `/auth/callback`).
- **Tabla `profiles`** (`supabase/schema.sql`): `id uuid` FK a `auth.users` (PK), `display_name
text`, `created_at`. Trigger `on_auth_user_created` que la crea automáticamente al `signUp`
  (toma `display_name` de `raw_user_meta_data`, con fallback `"PLAYER1".slice(0,10)` si viene
  vacío). RLS: `select` público (`to anon`, así el nombre se puede mostrar en
  hall-of-fame/leaderboards sin sesión), `update` solo del propio dueño (`auth.uid() = id`).
- **`app/data/profile.ts`** (nuevo): `getProfile()` (perfil del usuario actual, o `null` sin
  sesión), `updateDisplayName()`.
- **`components/Nav.tsx`**: reemplaza `getStoredUser()`/localStorage por
  `supabase.auth.onAuthStateChange()` + `getProfile()`; muestra `display_name`; `handleSignOut`
  llama `supabase.auth.signOut()` real.
- **`app/data/user.ts`**: eliminado (sin más consumidores tras el cambio de Nav — se verifica en
  el plan de implementación).
- **Los 5 wrappers de juego** (`AsteroidsGame`, `TetrisGame`, `ArkanoidGame`, `SnakeGame`,
  `FroggerGame`): en el modal de game-over, si hay sesión activa se usa el `display_name` del
  perfil automáticamente (sin input de nombre, guardado inmediato o con confirmación de un botón,
  sin campo editable); si no hay sesión, el input manual de nombre se mantiene igual que hoy (modo
  invitado).
- **`.env.template`** y `.env.local`: agregar `NEXT_PUBLIC_SITE_URL`.
- Botones OAuth Google/GitHub ya existentes en la UI de `/auth` pasan de decorativos a
  funcionales.

### No incluido

- Configurar las OAuth apps de Google/GitHub y cargarlas en el dashboard de Supabase — lo hace el
  usuario fuera del repo, antes de aprobar/probar este spec.
- Página "Mi cuenta" (editar perfil, historial de partidas) — fuera de alcance,
  `updateDisplayName()` queda listo en `profile.ts` pero sin UI que lo use todavía.
- Cambios a RLS de `scores` (sigue `to anon`/`with check(true)`, sin `user_id`).
- Cualquier ruta protegida por sesión — todo el catálogo, juegos y hall-of-fame siguen 100%
  públicos.
- `middleware.ts` — sin cambios, ya refresca la sesión en cada request.
- Rate limiting, CAPTCHA, 2FA.
- Tests.

---

## Data model

```sql
-- supabase/schema.sql (append)

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 20),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_select_public"
  on profiles for select
  to anon, authenticated
  using (true);

create policy "profiles_update_own"
  on profiles for update
  to authenticated
  using (auth.uid() = id);

-- Auto-crea el profile al registrarse; toma display_name de
-- raw_user_meta_data (pasado en signUp options.data), con fallback.
create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'PLAYER1')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

- `app/data/profile.ts`:
  ```ts
  export type Profile = { id: string; display_name: string };
  export async function getProfile(): Promise<Profile | null>; // null si no hay sesión
  export async function updateDisplayName(name: string): Promise<void>;
  ```
- Sin cambios en `games`/`scores`/`games_with_stats`.

---

## Implementation plan

1. **`supabase/schema.sql`** — agregar el bloque de `profiles` (tabla, RLS, trigger) del modelo de
   datos anterior. Aplicar manualmente en el SQL Editor de Supabase.
   _Verificación:_ `select * from profiles;` no da error; un `insert` de prueba en `auth.users` (o
   un signup real de prueba una vez esté el paso 3) crea la fila en `profiles` automáticamente.

2. **`.env.template` / `.env.local`** — agregar `NEXT_PUBLIC_SITE_URL` (`http://localhost:3000` en
   local).
   _Verificación:_ `npm run dev` arranca sin error de env faltante.

3. **`app/data/profile.ts`** (nuevo) — `getProfile()`/`updateDisplayName()` contra la tabla
   `profiles`, usando `utils/supabase/client.ts`.
   _Verificación:_ compila, sin usarse todavía en ninguna página.

4. **`app/auth/callback/route.ts`** (nuevo) — recibe `code` (query param),
   `supabase.auth.exchangeCodeForSession(code)`, redirige a `/games`; si falla, redirige a
   `/auth?error=...`.
   _Verificación:_ `npm run build` sin errores; ruta responde (probada en el paso 6 con un flujo
   real).

5. **`app/auth/page.tsx`** — reemplazar el `submit`/`guestLogin` simulados:
   - Tab CREAR CUENTA → `supabase.auth.signUp({ email, password, options: { data: {
display_name }, emailRedirectTo: `${NEXT_PUBLIC_SITE_URL}/auth/callback` } })`; en éxito,
     mensaje "revisa tu correo" en vez de redirigir.
   - Tab INICIAR SESIÓN → `supabase.auth.signInWithPassword({ email, password })`; en éxito,
     `router.push("/games")`.
   - Botones Google/GitHub → `supabase.auth.signInWithOAuth({ provider, options: { redirectTo:
`${NEXT_PUBLIC_SITE_URL}/auth/callback` } })`.
   - Link "¿Olvidaste tu contraseña?" → nuevo estado/vista dentro de la misma página que pide
     email y llama `resetPasswordForEmail(email, { redirectTo: .../auth/callback })`.
   - Botón "JUGAR COMO INVITADO" se mantiene igual (`router.push("/games")`, sin tocar sesión).
   - Estados de error/carga por formulario (reutilizando el patrón `saving`/`saveError` ya usado
     en los juegos).
     _Verificación:_ signup real crea usuario + profile (paso 1), llega el correo de confirmación;
     login con credenciales correctas entra, con incorrectas muestra error; invitado sigue
     funcionando igual que antes.

6. **`app/auth/reset-password/page.tsx`** (nuevo) — formulario de nueva contraseña, llega con
   sesión de recovery ya activa (post `/auth/callback`); `supabase.auth.updateUser({ password })`,
   luego redirige a `/games`.
   _Verificación:_ flujo completo "olvidé mi contraseña" → correo → link → nueva contraseña →
   login funciona con la nueva.

7. **`components/Nav.tsx`** — quitar `getStoredUser`/`removeUser`; `useEffect` con
   `supabase.auth.onAuthStateChange()` + `getProfile()` para poblar `user`; `handleSignOut` →
   `supabase.auth.signOut()` real, luego `router.push("/")`.
   _Verificación:_ Nav refleja sesión real (nombre del perfil) tras login/OAuth, y vuelve a
   "Iniciar Sesión" tras logout, en cualquier página.

8. **`app/data/user.ts`** — eliminar el archivo (buscar y confirmar que ningún otro import lo
   referencia fuera de Nav.tsx, ya migrado en el paso 7).
   _Verificación:_ `npm run build` sin imports rotos.

9. **Los 5 wrappers de juego** (`AsteroidsGame`, `TetrisGame`, `ArkanoidGame`, `SnakeGame`,
   `FroggerGame`) — en el modal de game-over: si `getProfile()` devuelve perfil, mostrar el
   `display_name` de solo lectura con un botón "GUARDAR" que llama
   `submitScore(gameId, profile.display_name, finalScore)` directo (sin input); si es `null`
   (invitado), mismo input manual de hoy sin cambios.
   _Verificación:_ una partida completa de cada uno de los 5 juegos, logueado y como invitado,
   guarda el score correctamente y aparece en `games/[id]` y hall-of-fame con el nombre esperado.

10. **Verificación final end-to-end** — signup → confirmar email → login → logout → login con
    Google → login con GitHub → olvidé mi contraseña → jugar logueado (nombre automático) → jugar
    invitado (nombre manual) → `npm run build` limpio.

Ningún paso toca `middleware.ts`, RLS de `scores`, `games`/`games_with_stats`, engines, skins, o
assets binarios.

---

## Acceptance criteria

- [ ] `profiles` existe en Supabase con RLS (`select` público, `update` solo del dueño) y el
      trigger `on_auth_user_created` crea la fila automáticamente al registrarse.
- [ ] `NEXT_PUBLIC_SITE_URL` está en `.env.template` y `.env.local`.
- [ ] Registrarse con email+contraseña crea el usuario y su `profile`, y no inicia sesión hasta
      confirmar el correo.
- [ ] El correo de confirmación redirige a `/auth/callback`, que activa la sesión y lleva a
      `/games`.
- [ ] Iniciar sesión con email+contraseña correctos entra y redirige a `/games`; con credenciales
      incorrectas muestra error sin redirigir.
- [ ] Los botones "GOOGLE" y "GITHUB" en `/auth` inician el flujo OAuth real y, al completarse,
      dejan sesión activa.
- [ ] El flujo "¿Olvidaste tu contraseña?" (pedir email → correo → `/auth/reset-password` → nueva
      contraseña) permite loguear después con la contraseña nueva.
- [ ] `Nav.tsx` muestra el `display_name` del perfil cuando hay sesión, y vuelve a "Iniciar Sesión"
      tras `handleSignOut`, en cualquier página.
- [ ] `app/data/user.ts` ya no existe y no queda ningún import roto.
- [ ] En los 5 juegos, con sesión activa el modal de game-over guarda el score con el
      `display_name` del perfil sin pedir nombre; sin sesión, el input manual de nombre sigue
      funcionando igual que antes (modo invitado intacto).
- [ ] El nombre guardado (logueado o invitado) aparece correctamente en `games/[id]` y en
      `hall-of-fame`.
- [ ] `middleware.ts`, RLS de `scores`, `games`/`games_with_stats`, engines y skins no tienen
      ningún cambio.
- [ ] `npm run build` no tiene errores de TypeScript ni imports rotos.
- [ ] No hay regresiones visuales ni funcionales en `/`, `/games`, `/about`, `/hall-of-fame`.

---

## Decisions taken and discarded

| Decisión                     | Elegida                                     | Descartada                                  | Por qué                                                                                                                                                                                              |
| ---------------------------- | ------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mecanismo de auth            | Email+password + OAuth (Google/GitHub)      | Solo email+password / Magic link            | Los botones OAuth ya existen en la UI como decorativos; activarlos evita rehacer la pantalla luego. Magic link se descarta por requerir infra de correo dedicada sin beneficio claro sobre password. |
| Rutas de auth                | Mantener `/auth` con tabs                   | Separar `/login` y `/register`              | Menor cambio de superficie; la UI de tabs ya está construida y aprobada visualmente.                                                                                                                 |
| Nombre público del jugador   | Tabla `profiles` + trigger                  | `user_metadata` de Supabase Auth            | Permite editar el nombre después (`update` propio vía RLS) sin tocar `auth.users`; deja la puerta abierta a una futura página "Mi cuenta".                                                           |
| Modo invitado                | Se mantiene intacto                         | Login obligatorio para guardar score        | Es un cambio de auth, no de producto — obligar login reduciría la fricción de "jugar ya" que tiene hoy el catálogo.                                                                                  |
| Config de OAuth apps         | La hace el usuario fuera del repo           | Automatizarla desde el spec                 | Requiere credenciales/dashboard de terceros (Google Cloud Console, GitHub OAuth Apps) fuera del alcance de un cambio de código.                                                                      |
| Verificación de email        | Obligatoria (default de Supabase)           | Auto-confirmado                             | Evita cuentas con emails inválidos/ajenos; es el comportamiento por defecto, no requiere config extra.                                                                                               |
| Recuperación de contraseña   | Incluida en este spec                       | Diferida a spec futuro                      | Es parte natural del flujo de auth real; dejarla fuera dejaría el login incompleto para cualquier usuario que olvide su contraseña.                                                                  |
| Atribución de score logueado | Usa `display_name` del perfil, sin input    | Input manual siempre                        | Evita que un usuario logueado escriba un nombre distinto al de su cuenta; simplifica el modal cuando ya sabemos quién juega.                                                                         |
| RLS de `scores`              | Sin cambios (`to anon`, `with check(true)`) | Agregar `user_id` + policy por `auth.uid()` | Mantiene el modo invitado simple; agregar `user_id` es una migración de esquema más grande sin necesidad clara para este spec.                                                                       |
| `app/data/user.ts`           | Eliminado                                   | Mantener en paralelo                        | Sesión real de Supabase lo vuelve redundante; mantenerlo duplicaría la fuente de verdad del usuario actual.                                                                                          |
| Redirects                    | `/games` tras login, `/` tras logout        | Quedarse en la página actual                | Igual al comportamiento ya existente del botón invitado; consistente con la expectativa de "entrar a jugar".                                                                                         |
| Rutas protegidas             | Ninguna                                     | Página "Mi cuenta" protegida                | Fuera de alcance de este spec (ver Scope); se puede agregar después reusando `getProfile()`.                                                                                                         |

---

## Identified risks

- **Config OAuth pendiente**: hasta que el usuario cargue las credenciales de Google/GitHub en el
  dashboard de Supabase, esos botones fallarán en producción/pruebas — el spec no puede
  verificarlos de punta a punta sin ese paso externo.
- **Entrega de correos**: Supabase usa su SMTP por defecto (límite bajo, puede ir a spam) para
  confirmación y recovery — no es Resend. Si falla la entrega, el signup/reset queda bloqueado;
  mitigación fuera de este spec (config de SMTP propio).
- **`security definer` en el trigger**: `handle_new_user()` corre con privilegios elevados; se
  limita el daño con `search_path = ''` y solo hace un `insert` fijo a `profiles`.
