import { createClient } from "@/utils/supabase/client";

export type Profile = { id: string; display_name: string };

export async function getProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", user.id)
    .single();
  if (error) throw error;
  return data as Profile;
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
