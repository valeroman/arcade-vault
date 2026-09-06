"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { submitScore } from "@/app/data/scores";
import {
  createGame,
  type EngineHandle,
} from "@/components/games/arkanoid/engine";
import {
  DEFAULT_SKIN,
  SKINS,
  readSkin,
  writeSkin,
  type SkinId,
} from "@/components/games/skins";
import TouchControls, {
  type TouchButton,
} from "@/components/games/TouchControls";

const W = 800;
const H = 600;

const SKIN_LIST = Object.values(SKINS);

const TOUCH_BUTTONS: TouchButton[] = [
  { code: "ArrowLeft", label: "◀", mode: "hold", slot: "dpad-left" },
  { code: "ArrowRight", label: "▶", mode: "hold", slot: "dpad-right" },
  { code: "KeyP", label: "⏸", mode: "tap", slot: "pause" },
];

export default function ArkanoidGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const restartRef = useRef<(() => void) | null>(null);
  const setSkinRef = useRef<((id: SkinId) => void) | null>(null);

  // Arranca en el default para no desalinear el HTML del servidor; el efecto de
  // montaje aplica la skin persistida.
  const [skinId, setSkinId] = useState<SkinId>(DEFAULT_SKIN);

  const handleSkin = (id: SkinId) => {
    writeSkin(id);
    setSkinId(id);
    setSkinRef.current?.(id); // cambio en caliente: la partida sigue viva
  };

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
      await submitScore("ladrillos", trimmed, finalScore);
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

  const handleClose = () => setFinalScore(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const stored = readSkin();
    setSkinId(stored);

    const handle: EngineHandle = createGame(canvas, {
      onGameOver: (score) => setFinalScore(score),
      skin: stored,
    });
    restartRef.current = handle.restart;
    setSkinRef.current = handle.setSkin;

    return () => {
      handle.destroy();
    };
  }, []);

  return (
    <>
      <div
        className="game-canvas-wrap"
        style={{ "--canvas-max-w": `${W}px` } as React.CSSProperties}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginBottom: 10,
          }}
        >
          {SKIN_LIST.map((skin) => (
            <button
              key={skin.id}
              type="button"
              className={"chip" + (skinId === skin.id ? " active" : "")}
              aria-pressed={skinId === skin.id}
              onClick={() => handleSkin(skin.id)}
            >
              {skin.label}
            </button>
          ))}
        </div>
        <canvas ref={canvasRef} width={W} height={H} />
        <TouchControls buttons={TOUCH_BUTTONS} />
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
                  className="btn magenta"
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
              <button className="btn magenta" onClick={handleRestart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/games/ladrillos" className="btn ghost">
                VER RANKING
              </Link>
              <button className="btn ghost" onClick={handleClose}>
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
