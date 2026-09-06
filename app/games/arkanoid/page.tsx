import ArkanoidGame from "@/components/games/ArkanoidGame";

export default function ArkanoidPage() {
  return (
    <div
      className="game-screen"
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#000",
      }}
    >
      <ArkanoidGame />
    </div>
  );
}
