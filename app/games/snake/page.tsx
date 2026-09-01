import SnakeGame from "@/components/games/SnakeGame";

export default function SnakePage() {
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
      <SnakeGame />
    </div>
  );
}
