"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { submitScore } from "@/app/data/scores";
import {
  createGame,
  type EngineHandle,
  type HudState,
} from "@/components/games/tetris/engine";
import {
  DEFAULT_SKIN,
  SKINS,
  type SkinId,
  readSkin,
  writeSkin,
} from "@/components/games/skins";
import TouchControls, {
  TouchButtonView,
  type TouchButton,
} from "@/components/games/TouchControls";

const BOARD_W = 300;
const BOARD_H = 600;
const NEXT_SIZE = 120;

const SKIN_LIST = Object.values(SKINS);

const TOUCH_BUTTONS: TouchButton[] = [
  { code: "ArrowLeft", label: "◀", mode: "hold", slot: "dpad-left" },
  { code: "ArrowRight", label: "▶", mode: "hold", slot: "dpad-right" },
  { code: "ArrowDown", label: "▼", mode: "hold", slot: "dpad-down" },
  { code: "ArrowUp", label: "⟳", mode: "tap", slot: "action-1" },
  { code: "Space", label: "⤓", mode: "tap", slot: "action-2" },
];

// La pausa se ubica en la barra inferior (pastilla con texto), no entre los
// botones de movimiento/acción — ver diseño "bisel CRT".
const PAUSE_BUTTON: TouchButton = {
  code: "KeyP",
  label: "⏸ PAUSA",
  mode: "tap",
  slot: "pause",
};

export default function TetrisGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement>(null);
  const boardRowRef = useRef<HTMLDivElement>(null);
  const bottomBarRef = useRef<HTMLDivElement>(null);
  const restartRef = useRef<(() => void) | null>(null);
  const handleRef = useRef<EngineHandle | null>(null);

  // Arranca en el default para que el HTML del servidor y el del cliente
  // coincidan; la skin persistida se aplica ya montado, junto con el motor.
  const [skinId, setSkinId] = useState<SkinId>(DEFAULT_SKIN);

  const handleSkin = (id: SkinId) => {
    writeSkin(id);
    setSkinId(id);
    // El motor repinta con la paleta nueva sin reiniciar la partida.
    handleRef.current?.setSkin(id);
  };

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

  const handleClose = () => setFinalScore(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const nextCanvas = nextCanvasRef.current;
    if (!canvas || !nextCanvas) return;

    const stored = readSkin();
    setSkinId(stored);

    const handle: EngineHandle = createGame(canvas, nextCanvas, {
      onHud: setHud,
      onGameOver: (score) => setFinalScore(score),
      skin: stored,
    });
    restartRef.current = handle.restart;
    handleRef.current = handle;

    return () => {
      handle.destroy();
      handleRef.current = null;
    };
  }, []);

  // Ajusta el alto del tablero cuando el layout está apilado (mobile, o una
  // ventana de escritorio angosta — el mismo caso que ya apila
  // `.tetris-board-row` vía CSS): el tablero (300×600, relación 1:2) es
  // angosto y muy alto, y ni en portrait entra completo junto con el aside
  // de stats/preview y los controles debajo. En vez de un cálculo de CSS
  // (frágil: un intento con flexbox no resolvía el porcentaje de alto
  // contra un contenedor dos niveles más arriba, y un número de píxeles
  // fijo ya nos salió mal varias veces con los otros juegos), se mide el
  // espacio real disponible con `getBoundingClientRect` — la distancia
  // desde donde empieza el canvas hasta el final de la barra inferior es,
  // por construcción, exactamente lo que ocupan el aside + los controles +
  // la barra, sin importar el alto actual del propio canvas.
  useEffect(() => {
    const canvas = canvasRef.current;
    const nextCanvas = nextCanvasRef.current;
    const boardRow = boardRowRef.current;
    const bottomBar = bottomBarRef.current;
    if (!canvas || !nextCanvas || !boardRow || !bottomBar) return;

    function fitBoard() {
      const stacked = getComputedStyle(boardRow!).flexDirection === "column";
      if (!stacked) {
        canvas!.style.maxHeight = "";
        // Vuelve al tamaño del atributo HTML (NEXT_SIZE): en desktop el
        // aside ya reserva 140px de sobra para el preview a tamaño real.
        nextCanvas!.style.width = "";
        nextCanvas!.style.height = "";
        return;
      }
      const canvasRect = canvas!.getBoundingClientRect();
      const bottomBarRect = bottomBar!.getBoundingClientRect();
      const viewportHeight =
        window.visualViewport?.height ?? window.innerHeight;
      const spaceAbove = canvasRect.top;
      const spaceBelow = bottomBarRect.bottom - canvasRect.bottom;
      // Margen de seguridad chico (padding inferior de `.game-screen`, etc.)
      // para no dejar ni un pixel de scroll.
      const available = viewportHeight - spaceAbove - spaceBelow - 16;
      const boardHeight = Math.max(120, Math.min(BOARD_H, available));
      canvas!.style.maxHeight = `${boardHeight}px`;

      // El preview de la próxima pieza debe verse a la MISMA escala que el
      // tablero (cada bloque, el mismo tamaño en los dos lados) — no un
      // tamaño de CSS fijo, que quedaba grande o chico según cuánto se
      // haya achicado el tablero. Misma proporción que el tablero
      // (boardHeight / BOARD_H) aplicada al tamaño nativo del preview.
      const scale = boardHeight / BOARD_H;
      const nextSize = Math.round(NEXT_SIZE * scale);
      nextCanvas!.style.width = `${nextSize}px`;
      nextCanvas!.style.height = `${nextSize}px`;
    }

    fitBoard();
    window.addEventListener("resize", fitBoard);
    window.addEventListener("orientationchange", fitBoard);
    const ro = new ResizeObserver(fitBoard);
    ro.observe(boardRow);
    ro.observe(bottomBar);

    return () => {
      window.removeEventListener("resize", fitBoard);
      window.removeEventListener("orientationchange", fitBoard);
      ro.disconnect();
    };
  }, []);

  return (
    <>
      {/* La página centra con flex en fila: sin este contenedor, los chips
          quedarían al lado del tablero en vez de encima. */}
      <div className="tetris-layout">
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

        <div className="tetris-board-row" ref={boardRowRef}>
          <div className="game-crt">
            <div className="game-crt-screen">
              <canvas ref={canvasRef} width={BOARD_W} height={BOARD_H} />
            </div>
            <div className="game-crt-bottom">
              <span className="led">SEÑAL TETRO</span>
              <span>CRT-83 · 60HZ</span>
            </div>
          </div>

          <aside className="tetris-aside">
            <div className="stat-strip">
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
                className="tetris-next-canvas"
                style={{
                  background: "var(--bg-2)",
                  border: "1px solid var(--line)",
                }}
              />
            </div>
          </aside>
        </div>

        <TouchControls buttons={TOUCH_BUTTONS} />
        {/* Nav queda oculto en táctil (ver .game-screen en globals.css): sus
            dos funciones relevantes durante el juego reaparecen acá, junto
            a la pausa (que se muda de los controles a esta barra). */}
        <div className="game-bottom-bar" ref={bottomBarRef}>
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
