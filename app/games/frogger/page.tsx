import FroggerGame from "@/components/games/FroggerGame";

export default function FroggerPage() {
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
      <FroggerGame />
    </div>
  );
}
