import AsteroidsGame from "@/components/games/AsteroidsGame";

export default function AsteroidsPage() {
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
      <AsteroidsGame />
    </div>
  );
}
