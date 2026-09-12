import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

function deriveDisplayName(user: User): string {
  const meta = user.user_metadata ?? {};
  return (
    meta.display_name ||
    meta.full_name ||
    meta.name ||
    user.email?.split("@")[0] ||
    "PLAYER1"
  )
    .toString()
    .toUpperCase()
    .slice(0, 20);
}

function deriveAvatarUrl(user: User): string | null {
  const meta = user.user_metadata ?? {};
  return meta.avatar_url ?? meta.picture ?? null;
}

/**
 * Perfil para un `User` ya resuelto (p. ej. el que entrega
 * `onAuthStateChange`), evitando una segunda llamada de red.
 *
 * Nunca lanza: si falta la fila en `profiles` (trigger no corrido
 * aún, tabla no aplicada, RLS distinta), se auto-repara con un
 * upsert y, si ese upsert también falla, igual devuelve un perfil
 * derivado de los metadatos de auth. Perder la sesión visualmente
 * por un error de lectura de una tabla secundaria es peor que
 * mostrar un nombre derivado.
 */
export async function getProfileForUser(user: User): Promise<Profile> {
  const supabase = createClient();
  const fallback: Profile = {
    id: user.id,
    display_name: deriveDisplayName(user),
    avatar_url: deriveAvatarUrl(user),
  };

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.warn("getProfileForUser: fallo leyendo profiles", error);
      return fallback;
    }

    if (data) {
      return { ...fallback, display_name: data.display_name };
    }

    // No hay fila todavía (el trigger no llegó a correr): la creamos.
    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert({ id: user.id, display_name: fallback.display_name });
    if (upsertError) {
      console.warn(
        "getProfileForUser: no se pudo auto-reparar el perfil",
        upsertError,
      );
    }
    return fallback;
  } catch (err) {
    console.warn("getProfileForUser: error inesperado", err);
    return fallback;
  }
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getProfileForUser(user);
}

export async function updateDisplayName(name: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay sesión activa.");

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name })
    .eq("id", user.id);
  if (error) throw error;
}
