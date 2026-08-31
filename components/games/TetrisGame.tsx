"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { submitScore } from "@/app/data/scores";
import {
  createGame,
  type EngineHandle,
  type HudState,
} from "@/components/games/tetris/engine";

const BOARD_W = 300;
const BOARD_H = 600;
const NEXT_SIZE = 120;

export default function TetrisGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement>(null);
  const restartRef = useRef<(() => void) | null>(null);

  const [hud, setHud] = useState<HudState>({ score: 0, lines: 0, level: 1 });
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    if (finalScore === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setSaveError(null);
    try {
      await submitScore("tetro", trimmed, finalScore);
      setSaved(true);
      (document.activeElement as HTMLElement | null)?.blur();
    } catch {
      setSaveError("NO SE PUDO GUARDAR. INTENTA DE NUEVO.");
    } finally {
      setSaving(false);
    }
  };

  const handleRestart = () => {
    setFinalScore(null);
    setName("");
    setSaving(false);
    setSaved(false);
    setSaveError(null);
    restartRef.current?.();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const nextCanvas = nextCanvasRef.current;
    if (!canvas || !nextCanvas) return;

    const handle: EngineHandle = createGame(canvas, nextCanvas, {
      onHud: setHud,
      onGameOver: (score) => setFinalScore(score),
    });
    restartRef.current = handle.restart;

    return () => {
      handle.destroy();
    };
  }, []);

  return (
    <>
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <canvas ref={canvasRef} width={BOARD_W} height={BOARD_H} />

        <aside
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            width: 140,
          }}
        >
          <div className="stat-strip" style={{ gridTemplateColumns: "1fr" }}>
            <div>
              <div className="l">SCORE</div>
              <div className="v">{hud.score.toLocaleString("es-ES")}</div>
            </div>
            <div>
              <div className="l">LINES</div>
              <div className="v">{hud.lines}</div>
            </div>
            <div>
              <div className="l">LEVEL</div>
              <div className="v">{hud.level}</div>
            </div>
          </div>

          <div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--ink-faint)",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                marginBottom: 6,
              }}
            >
              NEXT
            </div>
            <canvas
              ref={nextCanvasRef}
              width={NEXT_SIZE}
              height={NEXT_SIZE}
              style={{
                background: "var(--bg-2)",
                border: "1px solid var(--line)",
              }}
            />
          </div>
        </aside>
      </div>

      {finalScore !== null && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{finalScore.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value.toUpperCase().slice(0, 20))
                  }
                  placeholder="TU NOMBRE"
                  maxLength={20}
                />
                <button
                  className="btn"
                  onClick={handleSave}
                  disabled={saving || name.trim().length === 0}
                >
                  {saving ? "GUARDANDO…" : "GUARDAR"}
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            {saveError && (
              <div
                style={{ color: "var(--magenta)", fontSize: 11, marginTop: 8 }}
              >
                {saveError}
              </div>
            )}
            <div className="actions">
              <button className="btn" onClick={handleRestart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/games/tetro" className="btn ghost">
                VER RANKING
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
