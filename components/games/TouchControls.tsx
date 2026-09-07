"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Controles táctiles compartidos por los 4 juegos ya portados.
 *
 * No conoce ningún engine: solo sintetiza los mismos `KeyboardEvent` que cada
 * `engine.ts` ya escucha vía `window.addEventListener("keydown"/"keyup", ...)`.
 * Cero acoplamiento con `EngineHandle`/`EngineCallbacks` — el canal es el mismo
 * que usa el teclado físico.
 */

export type TouchButtonMode = "hold" | "tap";

export type TouchButton = {
  /** El mismo `e.code` que el engine ya escucha, p. ej. "ArrowLeft". */
  code: string;
  /** Texto/ícono del botón, p. ej. "◀", "⟳", "⤓". */
  label: string;
  mode: TouchButtonMode;
  /**
   * Posición dentro del layout: agrupa los botones de dirección en un d-pad
   * y el resto como botones de acción sueltos.
   */
  slot:
    | "dpad-up"
    | "dpad-down"
    | "dpad-left"
    | "dpad-right"
    | "action-1"
    | "action-2"
    | "pause";
};

export type TouchControlsProps = {
  buttons: TouchButton[];
};

// Auto-repeat simulado para el modo "hold": delay inicial + repetición, igual
// que el auto-repeat de un teclado físico.
const HOLD_INITIAL_DELAY = 250;
const HOLD_REPEAT_INTERVAL = 50;

// Se despacha en `document`, no en `window`: Arkanoid/Snake/Asteroids
// escuchan en `window`, pero Tetris escucha en `document`. Un evento
// despachado en `document` con `bubbles: true` sí llega a los listeners de
// `window` (sube por la cadena de burbujeo document → window), pero uno
// despachado en `window` nunca llega a los de `document` (no hay a dónde
// burbujear desde ahí) — por eso los botones no movían nada en Tetris.
function dispatchKey(type: "keydown" | "keyup", code: string) {
  document.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
}

/**
 * Detecta si el dispositivo es táctil una vez al montar. `false` en SSR.
 *
 * No usa `"ontouchstart" in window`/`navigator.maxTouchPoints` — esos dos
 * también dan `true` en una notebook con pantalla táctil (Windows, 2-en-1)
 * cuya entrada *principal* sigue siendo mouse/trackpad, mostrando de
 * entrada los controles y el bloqueo de landscape pensados para un celular
 * en una notebook de escritorio normal. `(pointer: coarse)` refleja el
 * dispositivo de entrada *principal*: verdadero en un celular/tablet (no
 * tienen otra entrada), falso en una notebook táctil con mouse/trackpad
 * (esa sigue siendo la principal), aunque `maxTouchPoints` sea > 0 en
 * ambos casos.
 */
export function useTouchSupport(): boolean {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(
      typeof window.matchMedia === "function" &&
        window.matchMedia("(pointer: coarse)").matches,
    );
  }, []);

  return supported;
}

// Path de triángulo por dirección, uno por rotación — mismo `viewBox`/`path`
// que `references/resources/gamepad-assets/gamepad.html` (`.dp-arrow`).
const DPAD_ARROW_PATHS: Record<string, string> = {
  "dpad-up": "M12 4 L20 16 L4 16 Z",
  "dpad-right": "M8 4 L20 12 L8 20 Z",
  "dpad-down": "M4 8 L20 8 L12 20 Z",
  "dpad-left": "M16 4 L16 20 L4 12 Z",
};

/** SVG de flecha para un slot de d-pad, o `null` si el slot no es de d-pad. */
function dpadArrowPath(slot: TouchButton["slot"]) {
  const path = DPAD_ARROW_PATHS[slot];
  if (!path) return null;
  return (
    <svg className="touch-dpad-arrow" viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} fill="currentColor" />
    </svg>
  );
}

/**
 * Un botón táctil individual, exportado para el caso de pausa: en el diseño
 * "bisel CRT" la pausa se muda de `.touch-actions` a la barra inferior
 * (junto al selector de skin y "salir"), fuera del layout que arma este
 * componente — cada wrapper la ubica ahí con este mismo botón, para no
 * duplicar la lógica de hold/tap ni el despacho de `KeyboardEvent`.
 */
export function TouchButtonView({
  button,
  className,
}: {
  button: TouchButton;
  /** Reemplaza `touch-btn touch-btn-${slot}` (p. ej. `"pause-pill"`). */
  className?: string;
}) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Limpieza si el componente se desmonta con el dedo todavía apoyado.
  useEffect(() => clearTimers, []);

  const handleStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    dispatchKey("keydown", button.code);
    if (button.mode === "hold") {
      timeoutRef.current = setTimeout(() => {
        intervalRef.current = setInterval(() => {
          dispatchKey("keydown", button.code);
        }, HOLD_REPEAT_INTERVAL);
      }, HOLD_INITIAL_DELAY);
    }
  };

  const handleEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    clearTimers();
    dispatchKey("keyup", button.code);
  };

  const arrow = dpadArrowPath(button.slot);

  return (
    <button
      type="button"
      className={className ?? `touch-btn touch-btn-${button.slot}`}
      aria-label={button.label}
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
    >
      {arrow ?? button.label}
    </button>
  );
}

export default function TouchControls({ buttons }: TouchControlsProps) {
  const touchSupported = useTouchSupport();

  // Marca el <body> mientras esta pantalla de juego está montada en un
  // dispositivo táctil real — la misma detección que ya gatea este
  // componente, reusada por `app/globals.css` para ocultar Nav/Footer y
  // mover los chips de skin a la barra inferior. Evita depender de una
  // media query CSS aparte (`hover`/`pointer`) que podría no coincidir
  // exactamente con esta detección en algunos navegadores móviles.
  useEffect(() => {
    document.body.classList.toggle("av-touch-game", touchSupported);
    return () => {
      document.body.classList.remove("av-touch-game");
    };
  }, [touchSupported]);

  // Sin soporte táctil real, el componente no renderiza nada: cero cambios
  // visuales ni de comportamiento en desktop/teclado físico.
  if (!touchSupported) return null;

  const dpadButtons = buttons.filter((b) => b.slot.startsWith("dpad-"));
  // "pause" ya no se arma acá: cada wrapper la ubica en la barra inferior
  // con `TouchButtonView` directamente (ver diseño "bisel CRT").
  const actionButtons = buttons.filter(
    (b) => !b.slot.startsWith("dpad-") && b.slot !== "pause",
  );
  // Cruz de 4 direcciones (Snake, Tetris) vs. fila simple (Arkanoid, que solo
  // usa izquierda/derecha; Asteroids, que no usa abajo): sin arriba/abajo no
  // hace falta la grilla completa, una fila centrada se ve mejor.
  const dpadIsCross = dpadButtons.some(
    (b) => b.slot === "dpad-up" || b.slot === "dpad-down",
  );

  return (
    <>
      {/* Los 4 juegos solo se juegan en portrait: en landscape, este overlay
          (solo visible en dispositivos táctiles — el componente entero ya
          está gateado por `touchSupported`) tapa todo pidiendo volver a
          vertical, en vez de invertir en un layout landscape aparte. */}
      <div className="landscape-block">
        <div>⟳</div>
        <div>GIRA TU DISPOSITIVO A VERTICAL PARA JUGAR</div>
      </div>
      <div className="touch-controls">
        {dpadButtons.length > 0 && (
          <div className={dpadIsCross ? "touch-dpad" : "touch-dpad-row"}>
            {dpadButtons.map((button) => (
              <TouchButtonView key={button.slot} button={button} />
            ))}
            <div className="gp-hub" aria-hidden="true">
              <span className="gp-hub-gem" />
            </div>
          </div>
        )}
        {actionButtons.length > 0 && (
          <div className="touch-actions">
            {actionButtons.map((button) => (
              <TouchButtonView key={button.slot} button={button} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
