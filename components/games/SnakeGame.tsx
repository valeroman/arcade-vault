"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { submitScore } from "@/app/data/scores";
import { createGame, type EngineHandle } from "@/components/games/snake/engine";
import {
  SKINS,
  DEFAULT_SKIN,
  type SkinId,
  readSkin,
  writeSkin,
} from "@/components/games/skins";

const W = 600;
const H = 600;

const SKIN_LIST = Object.values(SKINS);

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const restartRef = useRef<(() => void) | null>(null);
  const setSkinRef = useRef<((id: SkinId) => void) | null>(null);

  // El estado arranca en el default para que el render del servidor y el
  // primero del cliente coincidan; localStorage se lee ya montado.
  const [skinId, setSkinId] = useState<SkinId>(DEFAULT_SKIN);

  const handleSkin = (id: SkinId) => {
    writeSkin(id);
    setSkinRef.current?.(id); // en caliente: no reinicia la partida
    setSkinId(id);
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
      await submitScore("vibora", trimmed, finalScore);
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

    const initialSkin = readSkin();
    setSkinId(initialSkin);

    const handle: EngineHandle = createGame(canvas, {
      onGameOver: (score) => setFinalScore(score),
      skin: initialSkin,
    });
    restartRef.current = handle.restart;
    setSkinRef.current = handle.setSkin;

    return () => {
      handle.destroy();
      setSkinRef.current = null;
    };
  }, []);

  return (
    <>
      <div style={{ width: W, margin: "0 auto" }}>
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
                  className="btn green"
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
              <button className="btn green" onClick={handleRestart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/games/vibora" className="btn ghost">
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
