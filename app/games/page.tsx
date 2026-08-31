import { getGames } from "@/app/data/games";
import LibraryClient from "@/components/LibraryClient";

export default async function LibraryPage() {
  const games = await getGames();

  return <LibraryClient games={games} />;
}
