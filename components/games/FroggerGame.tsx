"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { submitScore } from "@/app/data/scores";
import { getProfile, type Profile } from "@/app/data/profile";
import {
  createGame,
  type EngineHandle,
} from "@/components/games/frogger/engine";
import {
  SKINS,
  DEFAULT_SKIN,
  type SkinId,
  readSkin,
  writeSkin,
} from "@/components/games/skins";

const W = 640;
const H = 560;

const SKIN_LIST = Object.values(SKINS);

const NAME_KEY = "av_player_name";

function readStoredName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function FroggerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const restartRef = useRef<(() => void) | null>(null);
  const setSkinRef = useRef<((id: SkinId) => void) | null>(null);

  // Arranca en el default para que el HTML del servidor y el primer render del
  // cliente coincidan; localStorage se lee ya montado.
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
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProfile()
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    if (finalScore === null) return;
    const playerName = profile ? profile.display_name : name.trim();
    if (!playerName) return;
    setSaving(true);
    setSaveError(null);
    try {
      await submitScore("rana", playerName, finalScore);
      if (!profile) {
        try {
          localStorage.setItem(NAME_KEY, playerName);
        } catch {
          // localStorage puede fallar (modo privado, cuota); no es crítico.
        }
      }
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
    setName(readStoredName());
    setSaving(false);
    setSaved(false);
    setSaveError(null);
    restartRef.current?.();
  };

  const handleClose = () => setFinalScore(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Arranca vacío para no desalinear el HTML del servidor; el nombre
    // persistido se lee acá (solo cliente), igual que la skin en otros juegos.
    setName(readStoredName());

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
                {profile ? (
                  <input value={profile.display_name} readOnly disabled />
                ) : (
                  <input
                    value={name}
                    onChange={(e) =>
                      setName(e.target.value.toUpperCase().slice(0, 20))
                    }
                    placeholder="TU NOMBRE"
                    maxLength={20}
                  />
                )}
                <button
                  className="btn green"
                  onClick={handleSave}
                  disabled={saving || (!profile && name.trim().length === 0)}
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
              <Link href="/games/rana" className="btn ghost">
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
