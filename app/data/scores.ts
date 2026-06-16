export type LocalScore = {
  game: string;
  score: number;
  name: string;
  at: number;
};

const KEY = "av_scores";

export function saveScore(entry: Omit<LocalScore, "at">): void {
  const all = getScores();
  all.push({ ...entry, at: Date.now() });
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function getScores(): LocalScore[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LocalScore[]) : [];
  } catch {
    return [];
  }
}
