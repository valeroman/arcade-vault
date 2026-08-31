"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getGames, type Game } from "@/app/data/games";
import { getTopScores, type ScoreRow } from "@/app/data/scores";

export default function HallOfFamePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [tab, setTab] = useState<string | null>(null);
  const [rows, setRows] = useState<ScoreRow[]>([]);

  useEffect(() => {
    getGames().then((gs) => {
      setGames(gs);
      if (gs.length > 0) setTab(gs[0].id);
    });
  }, []);

  useEffect(() => {
    if (!tab) return;
    getTopScores(tab, 12).then(setRows);
  }, [tab]);

  const game = games.find((g) => g.id === tab);

  if (!game) return null;

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 80,
            color: "var(--ink-faint)",
          }}
        >
          <div
            className="pixel"
            style={{ fontSize: 14, color: "var(--magenta)", marginBottom: 12 }}
          >
            SIN PUNTUACIONES TODAVÍA
          </div>
          <div>Sé el primero en dejar tu marca en {game.title}.</div>
        </div>
      ) : (
        <>
          <div className="podium">
            {rows[1] && (
              <div className="podium-slot silver">
                <div className="rank-num">02</div>
                <div className="name">{rows[1].player_name}</div>
                <div className="score">
                  {rows[1].score.toLocaleString("es-ES")}
                </div>
                <div className="date">
                  {new Date(rows[1].created_at).toLocaleDateString("es-ES")}
                </div>
              </div>
            )}
            {rows[0] && (
              <div className="podium-slot gold">
                <div
                  className="pixel"
                  style={{
                    fontSize: 9,
                    color: "var(--gold)",
                    letterSpacing: "0.18em",
                  }}
                >
                  CAMPEÓN
                </div>
                <div
                  className="rank-num"
                  style={{ fontSize: 36, marginTop: 4 }}
                >
                  01
                </div>
                <div className="name">{rows[0].player_name}</div>
                <div className="score" style={{ fontSize: 20 }}>
                  {rows[0].score.toLocaleString("es-ES")}
                </div>
                <div className="date">
                  {new Date(rows[0].created_at).toLocaleDateString("es-ES")}
                </div>
              </div>
            )}
            {rows[2] && (
              <div className="podium-slot bronze">
                <div className="rank-num">03</div>
                <div className="name">{rows[2].player_name}</div>
                <div className="score">
                  {rows[2].score.toLocaleString("es-ES")}
                </div>
                <div className="date">
                  {new Date(rows[2].created_at).toLocaleDateString("es-ES")}
                </div>
              </div>
            )}
          </div>

          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.id}
                className={
                  "tr" +
                  (i === 0
                    ? " top1"
                    : i === 1
                      ? " top2"
                      : i === 2
                        ? " top3"
                        : "")
                }
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
                <div className="pl">{r.player_name}</div>
                <div className="sc">{r.score.toLocaleString("es-ES")}</div>
                <div className="dt">
                  {new Date(r.created_at).toLocaleDateString("es-ES")}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/games" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
