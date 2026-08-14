import AsteroidsGame from "@/components/games/AsteroidsGame";

export default function AsteroidsPage() {
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
      <AsteroidsGame />
    </div>
  );
}
