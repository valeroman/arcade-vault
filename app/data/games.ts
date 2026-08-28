import { createClient } from "@/utils/supabase/client";

export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string;
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;
};

export async function getGames(): Promise<Game[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("games").select("*");
  if (error) throw error;
  return (data ?? []) as Game[];
}

export async function getGame(id: string): Promise<Game | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Game | null;
}

export function deriveCats(games: Game[]): string[] {
  const unique = Array.from(new Set(games.map((g) => g.cat)));
  return ["TODOS", ...unique];
}
