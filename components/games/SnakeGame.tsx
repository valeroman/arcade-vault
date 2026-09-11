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
import TouchControls, {
  TouchButtonView,
  type TouchButton,
} from "@/components/games/TouchControls";

const W = 600;
const H = 600;

const SKIN_LIST = Object.values(SKINS);

const TOUCH_BUTTONS: TouchButton[] = [
  { code: "ArrowUp", label: "▲", mode: "tap", slot: "dpad-up" },
  { code: "ArrowDown", label: "▼", mode: "tap", slot: "dpad-down" },
  { code: "ArrowLeft", label: "◀", mode: "tap", slot: "dpad-left" },
  { code: "ArrowRight", label: "▶", mode: "tap", slot: "dpad-right" },
];

// La pausa se ubica en la barra inferior (pastilla con texto), no entre los
// botones de dirección — ver diseño "bisel CRT".
const PAUSE_BUTTON: TouchButton = {
  code: "KeyP",
  label: "⏸ PAUSA",
  mode: "tap",
  slot: "pause",
};

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
      // Ambas refs sueltan el closure del motor destruido.
      restartRef.current = null;
      setSkinRef.current = null;
    };
  }, []);

  return (
    <>
      <div
        className="game-canvas-wrap"
        style={{ "--canvas-max-w": `${W}px` } as React.CSSProperties}
      >
        <div className="skin-row">
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
        <div className="game-crt">
          <div className="game-crt-screen">
            <canvas ref={canvasRef} width={W} height={H} />
          </div>
          <div className="game-crt-bottom">
            <span className="led">SEÑAL VIBORA</span>
            <span>CRT-83 · 60HZ</span>
          </div>
        </div>
        <TouchControls buttons={TOUCH_BUTTONS} />
        {/* Nav queda oculto en táctil (ver .game-screen en globals.css): sus
            dos funciones relevantes durante el juego reaparecen acá, junto
            a la pausa (que se muda de los controles a esta barra). */}
        <div className="game-bottom-bar">
          <TouchButtonView button={PAUSE_BUTTON} className="pause-pill" />
          <select
            className="skin-select"
            value={skinId}
            onChange={(e) => handleSkin(e.target.value as SkinId)}
          >
            {SKIN_LIST.map((skin) => (
              <option key={skin.id} value={skin.id}>
                {skin.label}
              </option>
            ))}
          </select>
          <Link href="/games" className="btn ghost">
            ← SALIR
          </Link>
        </div>
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
