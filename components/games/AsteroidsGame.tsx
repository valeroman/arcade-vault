"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { submitScore } from "@/app/data/scores";
import {
  DEFAULT_SKIN,
  SKINS,
  type Skin,
  type SkinId,
  getSkin,
  readSkin,
  withAlpha,
  writeSkin,
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
  { code: "ArrowUp", label: "▲", mode: "hold", slot: "dpad-up" },
  { code: "Space", label: "🔥", mode: "hold", slot: "action-1" },
];

export default function AsteroidsGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const restartRef = useRef<(() => void) | null>(null);

  // El motor de Asteroids sigue inline (ver "Known deviations"), así que la skin
  // activa vive en una ref mutable que cada draw() lee: cambiarla no remonta el
  // componente ni reinicia la partida.
  const skinRef = useRef<Skin>(getSkin(DEFAULT_SKIN));
  const [skinId, setSkinId] = useState<SkinId>(DEFAULT_SKIN);

  // Se sincroniza tras el montaje para no desalinear el HTML del servidor.
  useEffect(() => {
    const stored = readSkin();
    skinRef.current = getSkin(stored);
    setSkinId(stored);
  }, []);

  const handleSkin = (id: SkinId) => {
    writeSkin(id);
    skinRef.current = getSkin(id);
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
      await submitScore("rocas", trimmed, finalScore);
      setSaved(true);
      (document.activeElement as HTMLElement | null)?.blur();
    } catch {
      setSaveError("NO SE PUDO GUARDAR. INTENTA DE NUEVO.");
    } finally {
      setSaving(false);
    }
  };

  const handleRestart = () => restartRef.current?.();
  const handleClose = () => setFinalScore(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── Skin ──────────────────────────────────────────────────────────────
    // Paleta activa, leída en cada frame desde la ref mutable del componente.
    const palette = () => skinRef.current;

    // ── Input ─────────────────────────────────────────────────────────────
    const keys: Record<string, boolean> = {};
    const justPressed: Record<string, boolean> = {};

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (!keys[e.code]) justPressed[e.code] = true;
      keys[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    function pressed(code: string) {
      const val = justPressed[code];
      justPressed[code] = false;
      return val;
    }

    // ── Utils ─────────────────────────────────────────────────────────────
    const wrap = (v: number, max: number) => ((v % max) + max) % max;
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);
    const rand = (min: number, max: number) =>
      min + Math.random() * (max - min);
    const randInt = (min: number, max: number) =>
      Math.floor(rand(min, max + 1));

    // ── Constants ─────────────────────────────────────────────────────────
    const POWERUP_DROP_CHANCE = 0.15;
    const POWERUP_DURATION = 5;
    const POWERUP_TTL = 12;
    const TRIPLE_SPREAD = 0.18;

    // ── Bullet ────────────────────────────────────────────────────────────
    class Bullet {
      x: number;
      y: number;
      vx: number;
      vy: number;
      ttl: number;
      radius: number;
      dead: boolean;

      constructor(x: number, y: number, angle: number) {
        this.x = x;
        this.y = y;
        const SPEED = 520;
        this.vx = Math.cos(angle) * SPEED;
        this.vy = Math.sin(angle) * SPEED;
        this.ttl = 1.1;
        this.radius = 2;
        this.dead = false;
      }

      update(dt: number) {
        this.x = wrap(this.x + this.vx * dt, W);
        this.y = wrap(this.y + this.vy * dt, H);
        this.ttl -= dt;
        if (this.ttl <= 0) this.dead = true;
      }

      draw() {
        ctx!.fillStyle = palette().fg;
        ctx!.beginPath();
        ctx!.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    // ── Asteroid ──────────────────────────────────────────────────────────
    const RADII = [0, 16, 30, 50]; // por tamaño 1, 2, 3
    const SPEEDS = [0, 85, 55, 32]; // velocidad base por tamaño
    const POINTS = [0, 100, 50, 20]; // puntos por tamaño

    class Asteroid {
      x: number;
      y: number;
      size: number;
      radius: number;
      dead: boolean;
      vx: number;
      vy: number;
      rotSpeed: number;
      rot: number;
      verts: [number, number][];

      constructor(x: number, y: number, size = 3) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.radius = RADII[size];
        this.dead = false;

        const angle = rand(0, Math.PI * 2);
        const speed = SPEEDS[size] + rand(-15, 15);
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.rotSpeed = rand(-1.2, 1.2);
        this.rot = rand(0, Math.PI * 2);

        // Polígono irregular
        const n = randInt(8, 13);
        this.verts = [];
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const r = this.radius * rand(0.6, 1.0);
          this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
      }

      update(dt: number) {
        this.x = wrap(this.x + this.vx * dt, W);
        this.y = wrap(this.y + this.vy * dt, H);
        this.rot += this.rotSpeed * dt;
      }

      split(): Asteroid[] {
        if (this.size <= 1) return [];
        return [
          new Asteroid(this.x, this.y, this.size - 1),
          new Asteroid(this.x, this.y, this.size - 1),
        ];
      }

      draw() {
        ctx!.save();
        ctx!.translate(this.x, this.y);
        ctx!.rotate(this.rot);
        // El tamaño (1..3) indexa la paleta rotatoria de la skin.
        ctx!.strokeStyle =
          palette().entities[this.size - 1] ?? palette().entities[0];
        ctx!.lineWidth = 1.5;
        ctx!.lineJoin = "round";
        ctx!.beginPath();
        ctx!.moveTo(this.verts[0][0], this.verts[0][1]);
        for (let i = 1; i < this.verts.length; i++)
          ctx!.lineTo(this.verts[i][0], this.verts[i][1]);
        ctx!.closePath();
        ctx!.stroke();
        ctx!.restore();
      }
    }

    // ── PowerUp ───────────────────────────────────────────────────────────
    class PowerUp {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      ttl: number;
      dead: boolean;

      constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        const angle = rand(0, Math.PI * 2);
        const speed = rand(20, 40);
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.radius = 12;
        this.ttl = POWERUP_TTL;
        this.dead = false;
      }

      update(dt: number) {
        this.x = wrap(this.x + this.vx * dt, W);
        this.y = wrap(this.y + this.vy * dt, H);
        this.ttl -= dt;
        if (this.ttl <= 0) this.dead = true;
      }

      draw() {
        if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
        const pulse = 0.85 + Math.sin(performance.now() / 150) * 0.15;
        ctx!.save();
        ctx!.translate(this.x, this.y);
        ctx!.rotate(Math.PI / 4);
        ctx!.strokeStyle = palette().grid;
        ctx!.lineWidth = 2;
        const r = this.radius * pulse;
        ctx!.strokeRect(-r, -r, r * 2, r * 2);
        ctx!.restore();
        ctx!.fillStyle = palette().accent;
        ctx!.font = "bold 12px monospace";
        ctx!.textAlign = "center";
        ctx!.textBaseline = "middle";
        ctx!.fillText("3x", this.x, this.y);
      }
    }

    // ── Ship ──────────────────────────────────────────────────────────────
    class Ship {
      tripleShot: number;
      x!: number;
      y!: number;
      angle!: number;
      vx!: number;
      vy!: number;
      radius!: number;
      thrusting!: boolean;
      invincible!: number;
      shootCooldown!: number;
      dead!: boolean;

      constructor() {
        this.tripleShot = 0;
        this.reset();
      }

      reset() {
        this.x = W / 2;
        this.y = H / 2;
        this.angle = -Math.PI / 2;
        this.vx = 0;
        this.vy = 0;
        this.radius = 12;
        this.thrusting = false;
        this.invincible = 3;
        this.shootCooldown = 0;
        this.dead = false;
      }

      update(dt: number) {
        if (this.dead) return;
        if (this.invincible > 0) this.invincible -= dt;
        if (this.shootCooldown > 0) this.shootCooldown -= dt;
        if (this.tripleShot > 0) this.tripleShot -= dt;

        const ROT = 3.5; // rad/s
        const THRUST = 260; // px/s²
        const DRAG = 0.987;

        if (keys["ArrowLeft"]) this.angle -= ROT * dt;
        if (keys["ArrowRight"]) this.angle += ROT * dt;

        this.thrusting = !!keys["ArrowUp"];
        if (this.thrusting) {
          this.vx += Math.cos(this.angle) * THRUST * dt;
          this.vy += Math.sin(this.angle) * THRUST * dt;
        }

        this.vx *= DRAG;
        this.vy *= DRAG;
        this.x = wrap(this.x + this.vx * dt, W);
        this.y = wrap(this.y + this.vy * dt, H);
      }

      tryShoot(): Bullet[] {
        if (this.shootCooldown > 0 || this.dead) return [];
        this.shootCooldown = 0.2;
        const NOSE = 21;
        const ox = this.x + Math.cos(this.angle) * NOSE;
        const oy = this.y + Math.sin(this.angle) * NOSE;
        if (this.tripleShot > 0) {
          return [
            new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
            new Bullet(ox, oy, this.angle),
            new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
          ];
        }
        return [new Bullet(ox, oy, this.angle)];
      }

      draw() {
        if (this.dead) return;
        // Parpadeo durante invencibilidad de reaparición
        if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0)
          return;

        ctx!.save();
        ctx!.translate(this.x, this.y);
        ctx!.rotate(this.angle);
        ctx!.strokeStyle = palette().fg;
        ctx!.lineWidth = 1.5;
        ctx!.lineJoin = "round";

        // Silueta clásica: triángulo con muesca trasera
        ctx!.beginPath();
        ctx!.moveTo(20, 0); // nariz
        ctx!.lineTo(-12, -9); // ala izquierda
        ctx!.lineTo(-7, 0); // muesca trasera
        ctx!.lineTo(-12, 9); // ala derecha
        ctx!.closePath();
        ctx!.stroke();

        // Llama del propulsor
        if (this.thrusting && Math.random() > 0.35) {
          ctx!.beginPath();
          ctx!.moveTo(-8, -4);
          ctx!.lineTo(-8 - rand(6, 14), 0);
          ctx!.lineTo(-8, 4);
          ctx!.strokeStyle = palette().accent2;
          ctx!.stroke();
        }

        ctx!.restore();
      }
    }

    // ── Partículas (explosión) ──────────────────────────────────────────────
    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      ttl: number;
      dead: boolean;

      constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        const angle = rand(0, Math.PI * 2);
        const speed = rand(30, 130);
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = rand(0.4, 1.1);
        this.ttl = this.life;
        this.dead = false;
      }

      update(dt: number) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.ttl -= dt;
        if (this.ttl <= 0) this.dead = true;
      }

      draw() {
        const alpha = this.ttl / this.life;
        ctx!.strokeStyle = withAlpha(palette().fg, alpha);
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(this.x, this.y);
        ctx!.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
        ctx!.stroke();
      }
    }

    // ── Estado del juego ──────────────────────────────────────────────────
    let ship: Ship;
    let bullets: Bullet[];
    let asteroids: Asteroid[];
    let particles: Particle[];
    let powerUps: PowerUp[];
    let score: number;
    let lives: number;
    let level: number;
    let state: "playing" | "dead" | "gameover";
    let deadTimer: number;
    let powerUpSpawned: boolean;
    let killsSinceSpawn: number;

    function spawnAsteroids(count: number) {
      const SAFE_DIST = 130;
      for (let i = 0; i < count; i++) {
        let x, y;
        do {
          x = rand(0, W);
          y = rand(0, H);
        } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
        asteroids.push(new Asteroid(x, y, 3));
      }
    }

    function initGame() {
      ship = new Ship();
      bullets = [];
      asteroids = [];
      particles = [];
      powerUps = [];
      powerUpSpawned = false;
      killsSinceSpawn = 0;
      score = 0;
      lives = 3;
      level = 1;
      state = "playing";
      spawnAsteroids(4);

      setFinalScore(null);
      setName("");
      setSaving(false);
      setSaved(false);
      setSaveError(null);
    }

    function nextLevel() {
      level++;
      bullets = [];
      particles = [];
      powerUps = [];
      powerUpSpawned = false;
      killsSinceSpawn = 0;
      ship.reset();
      spawnAsteroids(3 + level);
    }

    function explode(x: number, y: number, count = 8) {
      for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
    }

    function killShip() {
      explode(ship.x, ship.y, 14);
      ship.dead = true;
      lives--;
      if (lives <= 0) {
        state = "gameover";
        setFinalScore(score);
      } else {
        state = "dead";
        deadTimer = 2;
      }
    }

    // ── Update ──────────────────────────────────────────────────────────────
    function update(dt: number) {
      if (state === "gameover") {
        particles.forEach((p) => p.update(dt));
        particles = particles.filter((p) => !p.dead);
        return;
      }

      if (state === "dead") {
        deadTimer -= dt;
        particles.forEach((p) => p.update(dt));
        particles = particles.filter((p) => !p.dead);
        asteroids.forEach((a) => a.update(dt));
        if (deadTimer <= 0) {
          state = "playing";
          ship.reset();
        }
        return;
      }

      // Disparar
      if (pressed("Space")) {
        bullets.push(...ship.tryShoot());
      }

      ship.update(dt);
      bullets.forEach((b) => b.update(dt));
      asteroids.forEach((a) => a.update(dt));
      particles.forEach((p) => p.update(dt));
      powerUps.forEach((p) => p.update(dt));

      bullets = bullets.filter((b) => !b.dead);
      particles = particles.filter((p) => !p.dead);
      powerUps = powerUps.filter((p) => !p.dead);

      for (const p of powerUps) {
        if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
          p.dead = true;
          ship.tripleShot = POWERUP_DURATION;
        }
      }

      // Bala vs asteroide
      const newAsteroids: Asteroid[] = [];
      for (const b of bullets) {
        for (const a of asteroids) {
          if (!a.dead && !b.dead && dist(b, a) < a.radius) {
            b.dead = true;
            a.dead = true;
            score += POINTS[a.size];
            explode(a.x, a.y, a.size * 5);
            newAsteroids.push(...a.split());
            if (!powerUpSpawned) {
              killsSinceSpawn++;
              const guaranteed = killsSinceSpawn >= 5;
              if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
                powerUps.push(new PowerUp(a.x, a.y));
                powerUpSpawned = true;
              }
            }
          }
        }
      }
      asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
      bullets = bullets.filter((b) => !b.dead);

      // Nave vs asteroide
      if (ship.invincible <= 0) {
        for (const a of asteroids) {
          if (dist(ship, a) < ship.radius + a.radius * 0.82) {
            killShip();
            break;
          }
        }
      }

      // Nivel completado
      if (asteroids.length === 0) nextLevel();
    }

    // ── Draw ────────────────────────────────────────────────────────────────
    function drawLifeIcon(x: number, y: number) {
      ctx!.save();
      ctx!.translate(x, y);
      ctx!.rotate(-Math.PI / 2);
      ctx!.strokeStyle = palette().fg;
      ctx!.lineWidth = 1.2;
      ctx!.lineJoin = "round";
      ctx!.beginPath();
      ctx!.moveTo(9, 0);
      ctx!.lineTo(-6, -5);
      ctx!.lineTo(-3, 0);
      ctx!.lineTo(-6, 5);
      ctx!.closePath();
      ctx!.stroke();
      ctx!.restore();
    }

    function drawHUD() {
      ctx!.fillStyle = palette().fg;
      ctx!.font = "15px monospace";

      ctx!.textAlign = "left";
      ctx!.fillText(`SCORE  ${score}`, 14, 26);

      ctx!.textAlign = "center";
      ctx!.fillText(`NIVEL ${level}`, W / 2, 26);

      for (let i = 0; i < lives; i++) drawLifeIcon(W - 16 - i * 22, 18);

      if (ship.tripleShot > 0) {
        ctx!.textAlign = "left";
        ctx!.fillStyle = palette().accent;
        ctx!.fillText(`3x  ${ship.tripleShot.toFixed(1)}s`, 14, 46);
      }
    }

    function drawOverlay(title: string, sub: string) {
      // En `clasico` el velo es transparente: el original no oscurecía la escena.
      ctx!.fillStyle = palette().overlay;
      ctx!.fillRect(0, 0, W, H);

      ctx!.textAlign = "center";
      ctx!.fillStyle = palette().fg;
      ctx!.font = "bold 46px monospace";
      ctx!.fillText(title, W / 2, H / 2 - 18);
      ctx!.font = "18px monospace";
      ctx!.fillStyle = palette().dim;
      ctx!.fillText(sub, W / 2, H / 2 + 22);
    }

    function draw() {
      ctx!.fillStyle = palette().bg;
      ctx!.fillRect(0, 0, W, H);

      particles.forEach((p) => p.draw());
      asteroids.forEach((a) => a.draw());
      powerUps.forEach((p) => p.draw());
      bullets.forEach((b) => b.draw());
      ship.draw();

      drawHUD();

      if (state === "gameover")
        drawOverlay(
          "GAME OVER",
          `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`,
        );
    }

    // ── Loop principal ───────────────────────────────────────────────────────
    let lastTime: number | null = null;
    let rafId: number;

    function loop(ts: number) {
      const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;
      update(dt);
      draw();
      rafId = requestAnimationFrame(loop);
    }

    restartRef.current = initGame;
    initGame();
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
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
            <span className="led">SEÑAL ROCAS</span>
            <span>CRT-83 · 60HZ</span>
          </div>
        </div>
        <TouchControls buttons={TOUCH_BUTTONS} />
        {/* Nav queda oculto en táctil (ver .game-screen en globals.css): su
            función relevante durante el juego (cambiar skin) reaparece acá.
            Sin pausa: Asteroids no tiene esa mecánica. */}
        <div className="game-bottom-bar">
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
                  className="btn yellow"
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
              <button className="btn yellow" onClick={handleRestart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/games/rocas" className="btn ghost">
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
