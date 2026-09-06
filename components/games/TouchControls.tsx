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

function dispatchKey(type: "keydown" | "keyup", code: string) {
  window.dispatchEvent(new KeyboardEvent(type, { code }));
}

/** Detecta soporte táctil real una vez al montar. `false` en SSR. */
function useTouchSupport(): boolean {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(
      "ontouchstart" in window ||
        (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0),
    );
  }, []);

  return supported;
}

function TouchButtonEl({ button }: { button: TouchButton }) {
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

  return (
    <button
      type="button"
      className={`touch-btn touch-btn-${button.slot}`}
      aria-label={button.label}
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
    >
      {button.label}
    </button>
  );
}

export default function TouchControls({ buttons }: TouchControlsProps) {
  const touchSupported = useTouchSupport();

  // Sin soporte táctil real, el componente no renderiza nada: cero cambios
  // visuales ni de comportamiento en desktop/teclado físico.
  if (!touchSupported) return null;

  const dpadButtons = buttons.filter((b) => b.slot.startsWith("dpad-"));
  const actionButtons = buttons.filter((b) => !b.slot.startsWith("dpad-"));

  return (
    <>
      <div className="rotate-hint">
        <div>⟳</div>
        <div>GIRA TU DISPOSITIVO PARA JUGAR</div>
      </div>
      <div className="touch-controls">
        {dpadButtons.length > 0 && (
          <div className="touch-dpad">
            {dpadButtons.map((button) => (
              <TouchButtonEl key={button.slot} button={button} />
            ))}
          </div>
        )}
        {actionButtons.length > 0 && (
          <div className="touch-actions">
            {actionButtons.map((button) => (
              <TouchButtonEl key={button.slot} button={button} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
