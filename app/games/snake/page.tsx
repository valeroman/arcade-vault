import SnakeGame from "@/components/games/SnakeGame";

export default function SnakePage() {
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
      <SnakeGame />
    </div>
  );
}
