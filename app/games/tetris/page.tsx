import TetrisGame from "@/components/games/TetrisGame";

export default function TetrisPage() {
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
      <TetrisGame />
    </div>
  );
}
