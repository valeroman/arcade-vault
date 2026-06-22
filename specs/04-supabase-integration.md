---
id: 04
title: Supabase Integration — Arcade Vault
state: Aprobado
date: 2026-06-21
dependencies: [01, 02, 03]
env:
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
---

**Objetivo:** Instalar y configurar Supabase como infraestructura base (cliente browser, cliente servidor, middleware de sesión) sin modificar ninguna UI existente.

---

## Scope

### Incluido

- **Dependencias** — instalar `@supabase/ssr` y `@supabase/supabase-js`.
- **Variables de entorno** — agregar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` a `.env.local` y `.env.template`.
- **Cliente browser** — `utils/supabase/client.ts` con `createBrowserClient`.
- **Cliente servidor** — `utils/supabase/server.ts` con `createServerClient` (compatible con App Router: cookies de Next.js).
- **Middleware** — `middleware.ts` en la raíz del proyecto para refresh automático de sesión en cada request.

### No incluido

- Integración de la UI de `/auth` con Supabase Auth (spec futuro).
- Tablas, migraciones o schema de base de datos (specs futuros).
- Tipos TypeScript generados desde el schema (specs futuros).
- Realtime subscriptions (spec futuro).
- Edge Functions (spec futuro).
- Row Level Security (se define en cada spec de feature).
- Tests.

---

## Data model

Sin nuevas estructuras. Este spec solo instala y configura la capa de conexión.
Las tablas, migraciones y tipos TypeScript se definen en specs futuros.

---

## Implementation plan

1. **Instalar dependencias**

   ```bash
   npm install @supabase/ssr @supabase/supabase-js
   ```

2. **Variables de entorno** — agregar a `.env.local` y a `.env.template`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
   ```

3. **Cliente browser** — crear `utils/supabase/client.ts`:

   ```ts
   import { createBrowserClient } from "@supabase/ssr";

   export function createClient() {
     return createBrowserClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
     );
   }
   ```

4. **Cliente servidor** — crear `utils/supabase/server.ts`:

   ```ts
   import { createServerClient } from "@supabase/ssr";
   import { cookies } from "next/headers";

   export async function createClient() {
     const cookieStore = await cookies();
     return createServerClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
       {
         cookies: {
           getAll: () => cookieStore.getAll(),
           setAll: (cookiesToSet) => {
             cookiesToSet.forEach(({ name, value, options }) =>
               cookieStore.set(name, value, options),
             );
           },
         },
       },
     );
   }
   ```

5. **Middleware** — crear `middleware.ts` en la raíz del proyecto:

   ```ts
   import { createServerClient } from "@supabase/ssr";
   import { NextResponse, type NextRequest } from "next/server";

   export async function middleware(request: NextRequest) {
     let supabaseResponse = NextResponse.next({ request });

     const supabase = createServerClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
       {
         cookies: {
           getAll: () => request.cookies.getAll(),
           setAll: (cookiesToSet) => {
             cookiesToSet.forEach(({ name, value }) =>
               request.cookies.set(name, value),
             );
             supabaseResponse = NextResponse.next({ request });
             cookiesToSet.forEach(({ name, value, options }) =>
               supabaseResponse.cookies.set(name, value, options),
             );
           },
         },
       },
     );

     await supabase.auth.getUser();
     return supabaseResponse;
   }

   export const config = {
     matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
   };
   ```

---

## Acceptance criteria

- [ ] `@supabase/ssr` y `@supabase/supabase-js` aparecen en `package.json`.
- [ ] `.env.local` contiene `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` con valores reales.
- [ ] `.env.template` contiene ambas variables vacías como referencia.
- [ ] `utils/supabase/client.ts` exporta `createClient()` para uso en client components.
- [ ] `utils/supabase/server.ts` exporta `createClient()` async para uso en server components y API routes.
- [ ] `middleware.ts` existe en la raíz y refresca la sesión en cada request.
- [ ] El servidor arranca sin errores (`npm run dev`).
- [ ] No hay regresiones visuales ni funcionales en ninguna página existente (`/`, `/games`, `/about`, `/hall-of-fame`, `/auth`).

---

## Decisions taken and discarded

| Decisión                  | Elegida                                | Descartada                            | Razón                                                 |
| ------------------------- | -------------------------------------- | ------------------------------------- | ----------------------------------------------------- |
| Alcance del spec          | Auth + DB setup (infraestructura)      | Solo Auth o solo DB                   | Base común para todos los specs futuros               |
| Schema inicial            | Excluido                               | Crear `profiles` en este spec         | Usuario prefiere definir tablas en specs dedicados    |
| Tipos TypeScript          | Excluidos                              | Generar `types/supabase.ts`           | Sin schema aún; se generan cuando haya tablas         |
| Variable de anon key      | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY`       | Nombre definido por el usuario                        |
| UI de `/auth`             | Intacta                                | Conectar a Supabase Auth en este spec | Separación de responsabilidades; spec futuro dedicado |
| Realtime / Edge Functions | Excluidos                              | Incluir configuración base            | MVP de integración; specs futuros los abordan         |
