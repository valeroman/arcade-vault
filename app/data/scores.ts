import { createClient } from "@/utils/supabase/client";

export type ScoreRow = {
  id: string;
  game_id: string;
  player_name: string;
  score: number;
  created_at: string;
};

export async function getTopScores(
  gameId: string,
  limit: number,
): Promise<ScoreRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("*")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ScoreRow[];
}

export async function submitScore(
  gameId: string,
  playerName: string,
  score: number,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("scores").insert({
    game_id: gameId,
    player_name: playerName,
    score,
  });
  if (error) throw error;
}
