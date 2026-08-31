import { createClient } from "@/utils/supabase/client";

export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string;
  color: "cyan" | "magenta" | "yellow" | "green";
  difficulty: number;
  best: number;
  plays: number;
};

export async function getGames(): Promise<Game[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("games_with_stats")
    .select("*")
    .order("title");
  if (error) throw error;
  return (data ?? []) as Game[];
}

export async function getGame(id: string): Promise<Game | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("games_with_stats")
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

export function formatPlays(n: number): string {
  if (n < 1000) return n.toLocaleString("es-ES");
  return (n / 1000).toFixed(1) + "K";
}

export function difficultyStars(d: number): string {
  const clamped = Math.min(5, Math.max(0, d));
  return "★ ".repeat(clamped) + "☆ ".repeat(5 - clamped);
}
