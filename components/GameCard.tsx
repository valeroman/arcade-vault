"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import type { Game } from "@/app/data/games";

export default function GameCard({ game }: { game: Game }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `translateY(-6px) rotateX(${-py * 6}deg) rotateY(${px * 8}deg)`;
  };

  const onLeave = () => {
    if (ref.current) ref.current.style.transform = "";
  };

  const btnClass =
    "btn " +
    (game.color === "magenta" ? "magenta" : game.color === "yellow" ? "yellow" : "");

  return (
    <div
      ref={ref}
      className="card"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={() => router.push(`/games/${game.id}`)}
    >
      <div className="cover">
        <div className={"cover-bg " + game.cover} />
        <div className="label">{game.cat}</div>
      </div>
      <div className="meta">
        <div className="title">{game.title}</div>
        <div className="desc">{game.short}</div>
        <div className="row">
          <div className="score-badge">
            <span>MEJOR PUNTUACIÓN</span>
            <b>{game.best.toLocaleString("es-ES")}</b>
          </div>
          <button
            className={btnClass}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/games/${game.id}`);
            }}
          >
            JUGAR
          </button>
        </div>
      </div>
    </div>
  );
}
