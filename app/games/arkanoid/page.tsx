import ArkanoidGame from "@/components/games/ArkanoidGame";

export default function ArkanoidPage() {
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
      <ArkanoidGame />
    </div>
  );
}
