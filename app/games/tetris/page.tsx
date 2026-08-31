import TetrisGame from "@/components/games/TetrisGame";

export default function TetrisPage() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#000",
        padding: "24px 0",
      }}
    >
      <TetrisGame />
    </div>
  );
}
