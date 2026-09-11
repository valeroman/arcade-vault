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
  /**
   * Repinta un frame suelto. Hace falta porque el loop se detiene en game over
   * (puerta G1): sin esto, cambiar de skin con la partida terminada dejaría el
   * canvas congelado con la paleta anterior.
   */
  const redrawRef = useRef<(() => void) | null>(null);

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
    redrawRef.current?.();
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

    /** Teclas que el juego consume: se les cancela el scroll de la página. */
    const CONSUMED = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "Space"]);

    /**
     * El guard de foco cubre los tres elementos editables/navegables con
     * teclado: el `<input>` del nombre en el modal y el `<select>` de skin de
     * la barra inferior (con él enfocado, las flechas cambiaban de skin y
     * pilotaban la nave a la vez).
     */
    const isFormTarget = (t: EventTarget | null) =>
      t instanceof HTMLInputElement ||
      t instanceof HTMLSelectElement ||
      t instanceof HTMLTextAreaElement;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isFormTarget(e.target)) return;
      if (CONSUMED.has(e.code)) e.preventDefault();
      if (!keys[e.code]) justPressed[e.code] = true;
      keys[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };
    /**
     * Al perder el foco (Alt-Tab, cambio de pestaña) el `keyup` nunca llega:
     * sin esto la nave volvía acelerando o girando sola.
     */
    const clearKeys = () => {
      for (const code in keys) keys[code] = false;
      for (const code in justPressed) justPressed[code] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearKeys);
    document.addEventListener("visibilitychange", clearKeys);

    function pressed(code: string) {
      const val = justPressed[code];
      justPressed[code] = false;
      return val;
    }

    // ── Utils ─────────────────────────────────────────────────────────────
    const wrap = (v: number, max: number) => ((v % max) + max) % max;

    /**
     * Separación en un eje que envuelve: nave, balas, asteroides y power-ups
     * pasan todos por `wrap()`, así que el mundo es un toro y la distancia real
     * entre dos puntos es la menor de las dos rutas (directa o por el borde).
     * Con la resta euclídea a secas, un asteroide partido por el borde era
     * intocable: las balas lo atravesaban y la nave lo cruzaba sin morir.
     */
    const axisDist = (d: number, max: number) => {
      const a = d < 0 ? -d : d;
      return a > max / 2 ? max - a : a;
    };
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(axisDist(a.x - b.x, W), axisDist(a.y - b.y, H));
    const rand = (min: number, max: number) =>
      min + Math.random() * (max - min);
    const randInt = (min: number, max: number) =>
      Math.floor(rand(min, max + 1));

    /**
     * Elimina en sitio los elementos muertos, preservando el orden. Sustituye a
     * `arr = arr.filter(x => !x.dead)`, que asignaba un array nuevo más un
     * closure por lista y por frame (5 listas × 60 fps).
     */
    function compact<T extends { dead: boolean }>(arr: T[]) {
      let w = 0;
      for (let i = 0; i < arr.length; i++) {
        if (!arr[i].dead) arr[w++] = arr[i];
      }
      arr.length = w;
    }

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

      /** Empuja los fragmentos en `out` en vez de devolver un array nuevo. */
      splitInto(out: Asteroid[]) {
        if (this.size <= 1) return;
        out.push(new Asteroid(this.x, this.y, this.size - 1));
        out.push(new Asteroid(this.x, this.y, this.size - 1));
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
        // `font`/`textAlign`/`textBaseline` quedaban puestos al salir de acá y
        // nadie los restauraba: desde el primer power-up, todo el texto del
        // resto de la sesión (HUD y overlay) se dibujaba con baseline "middle".
        ctx!.save();
        ctx!.fillStyle = palette().accent;
        ctx!.font = "bold 12px monospace";
        ctx!.textAlign = "center";
        ctx!.textBaseline = "middle";
        ctx!.fillText("3x", this.x, this.y);
        ctx!.restore();
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

        // DRAG está expresado por frame a 60Hz. Aplicado tal cual una vez por
        // llamada, la velocidad terminal dependía del refresh rate (333 px/s a
        // 60Hz, 139 a 144Hz, 667 a 30Hz). Reexpresado como factor por segundo,
        // `DRAG ** (dt * 60)` vale exactamente DRAG cuando dt = 1/60 (error 0),
        // así que el feel a 60Hz —el framerate con el que se diseñó— no cambia:
        // solo deja de degradarse en el resto del hardware (332 px/s a 144Hz).
        const drag = Math.pow(DRAG, dt * 60);
        this.vx *= drag;
        this.vy *= drag;
        this.x = wrap(this.x + this.vx * dt, W);
        this.y = wrap(this.y + this.vy * dt, H);
      }

      /** Empuja los proyectiles en `out`: evita el array + spread por disparo. */
      shootInto(out: Bullet[]) {
        if (this.shootCooldown > 0 || this.dead) return;
        this.shootCooldown = 0.2;
        const NOSE = 21;
        const ox = this.x + Math.cos(this.angle) * NOSE;
        const oy = this.y + Math.sin(this.angle) * NOSE;
        if (this.tripleShot > 0) {
          out.push(new Bullet(ox, oy, this.angle - TRIPLE_SPREAD));
          out.push(new Bullet(ox, oy, this.angle));
          out.push(new Bullet(ox, oy, this.angle + TRIPLE_SPREAD));
          return;
        }
        out.push(new Bullet(ox, oy, this.angle));
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

      /**
       * `strokeStyle`/`lineWidth` los fija `drawParticles()` una vez para todo
       * el lote y el desvanecido va por `globalAlpha` en vez de por
       * `withAlpha()`, que construía ~6 objetos (match del regex, 3 `slice`,
       * el `toFixed` y el template literal) por partícula y por frame — hasta
       * 700 allocs/frame en el peor caso. El compuesto resultante es idéntico.
       */
      draw() {
        ctx!.globalAlpha = this.ttl / this.life;
        ctx!.beginPath();
        ctx!.moveTo(this.x, this.y);
        ctx!.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
        ctx!.stroke();
      }
    }

    // ── Estado del juego ──────────────────────────────────────────────────
    // Las 5 listas son estables durante toda la sesión: se vacían con
    // `length = 0` y se compactan en sitio, nunca se reasignan. Así ni el
    // update ni el draw asignan un array por frame.
    let ship: Ship;
    const bullets: Bullet[] = [];
    const asteroids: Asteroid[] = [];
    const particles: Particle[] = [];
    const powerUps: PowerUp[] = [];
    /** Fragmentos de los asteroides partidos en este frame (buffer reusado). */
    const pendingAsteroids: Asteroid[] = [];
    let score: number;
    let lives: number;
    let level: number;
    let state: "playing" | "dead" | "gameover";
    let deadTimer: number;
    let powerUpSpawned: boolean;
    let killsSinceSpawn: number;
    /** Subtítulo del overlay de game over, construido una vez en `killShip()`. */
    let overlaySub = "";

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
      bullets.length = 0;
      asteroids.length = 0;
      particles.length = 0;
      powerUps.length = 0;
      pendingAsteroids.length = 0;
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
      bullets.length = 0;
      particles.length = 0;
      powerUps.length = 0;
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
        overlaySub = `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`;
        setFinalScore(score);
      } else {
        state = "dead";
        deadTimer = 2;
      }
    }

    // ── Update ──────────────────────────────────────────────────────────────
    // Todos los recorridos son `for` con índice: `forEach`/`filter` asignaban
    // un closure (y un array, en el caso de `filter`) por lista y por frame.
    function updateParticles(dt: number) {
      for (let i = 0; i < particles.length; i++) particles[i].update(dt);
      compact(particles);
    }

    function update(dt: number) {
      if (state === "gameover") {
        updateParticles(dt);
        return;
      }

      if (state === "dead") {
        deadTimer -= dt;
        updateParticles(dt);
        for (let i = 0; i < asteroids.length; i++) asteroids[i].update(dt);
        if (deadTimer <= 0) {
          state = "playing";
          ship.reset();
        }
        return;
      }

      // Disparar
      if (pressed("Space")) {
        ship.shootInto(bullets);
      }

      ship.update(dt);
      for (let i = 0; i < bullets.length; i++) bullets[i].update(dt);
      for (let i = 0; i < asteroids.length; i++) asteroids[i].update(dt);
      for (let i = 0; i < powerUps.length; i++) powerUps[i].update(dt);
      updateParticles(dt);

      compact(bullets);
      compact(powerUps);

      for (let i = 0; i < powerUps.length; i++) {
        const p = powerUps[i];
        if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
          p.dead = true;
          ship.tripleShot = POWERUP_DURATION;
        }
      }

      // Bala vs asteroide
      for (let bi = 0; bi < bullets.length; bi++) {
        const b = bullets[bi];
        for (let ai = 0; ai < asteroids.length; ai++) {
          const a = asteroids[ai];
          // El radio de la bala (2px) entra en el test: antes solo contaba el
          // del asteroide, así que un roce en el borde exacto no registraba.
          if (!a.dead && !b.dead && dist(b, a) < a.radius + b.radius) {
            b.dead = true;
            a.dead = true;
            score += POINTS[a.size];
            explode(a.x, a.y, a.size * 5);
            a.splitInto(pendingAsteroids);
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
      compact(asteroids);
      for (let i = 0; i < pendingAsteroids.length; i++)
        asteroids.push(pendingAsteroids[i]);
      pendingAsteroids.length = 0;
      compact(bullets);

      // Nave vs asteroide
      if (ship.invincible <= 0) {
        for (let i = 0; i < asteroids.length; i++) {
          const a = asteroids[i];
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
    /**
     * Los iconos de vida son 14 ops vectoriales idénticas cada uno, repintadas
     * igual en todos los frames (42 ops/frame con 3 vidas). Se prerenderizan
     * una vez por color de skin en un canvas offscreen — mismo patrón de caché
     * por skin que `arkanoid/sprites.ts` — y el frame solo paga 3 `drawImage`.
     *
     * El offscreen usa el mismo encadenado `translate(centro)` + `rotate` que el
     * dibujo directo y se blitea en offsets enteros, así que el antialiasing
     * resultante es idéntico píxel a píxel al de antes.
     */
    const LIFE_ICON = 24;
    const lifeIcons = new Map<string, HTMLCanvasElement>();

    function lifeIcon(color: string) {
      const cached = lifeIcons.get(color);
      if (cached) return cached;
      const off = document.createElement("canvas");
      off.width = LIFE_ICON;
      off.height = LIFE_ICON;
      const g = off.getContext("2d")!;
      g.translate(LIFE_ICON / 2, LIFE_ICON / 2);
      g.rotate(-Math.PI / 2);
      g.strokeStyle = color;
      g.lineWidth = 1.2;
      g.lineJoin = "round";
      g.beginPath();
      g.moveTo(9, 0);
      g.lineTo(-6, -5);
      g.lineTo(-3, 0);
      g.lineTo(-6, 5);
      g.closePath();
      g.stroke();
      lifeIcons.set(color, off);
      return off;
    }

    // Textos del HUD cacheados: se reconstruyen solo cuando cambia el valor que
    // muestran, no en cada frame.
    let scoreText = "";
    let scoreShown = -1;
    let levelText = "";
    let levelShown = -1;
    let tripleText = "";
    let tripleShown = -1;

    function drawHUD() {
      if (score !== scoreShown) {
        scoreShown = score;
        scoreText = `SCORE  ${score}`;
      }
      if (level !== levelShown) {
        levelShown = level;
        levelText = `NIVEL ${level}`;
      }

      // El HUD es el último que escribe `font`/`textAlign`/`textBaseline` en el
      // frame. Hoy sobrevive por reasignación exhaustiva, pero eso es fragilidad
      // latente (puerta G5): el `save()`/`restore()` lo deja aislado, igual que
      // en Frogger y Arkanoid.
      ctx!.save();
      ctx!.fillStyle = palette().fg;
      ctx!.font = "15px monospace";
      ctx!.textBaseline = "alphabetic";

      ctx!.textAlign = "left";
      ctx!.fillText(scoreText, 14, 26);

      ctx!.textAlign = "center";
      ctx!.fillText(levelText, W / 2, 26);

      const icon = lifeIcon(palette().fg);
      for (let i = 0; i < lives; i++)
        ctx!.drawImage(
          icon,
          W - 16 - i * 22 - LIFE_ICON / 2,
          18 - LIFE_ICON / 2,
        );

      if (ship.tripleShot > 0) {
        // Cuantizado a la décima que ya mostraba `toFixed(1)`: mismo texto,
        // reconstruido ~10 veces por segundo en vez de 60.
        const tenths = Math.round(ship.tripleShot * 10);
        if (tenths !== tripleShown) {
          tripleShown = tenths;
          tripleText = `3x  ${(tenths / 10).toFixed(1)}s`;
        }
        ctx!.textAlign = "left";
        ctx!.fillStyle = palette().accent;
        ctx!.fillText(tripleText, 14, 46);
      }
      ctx!.restore();
    }

    function drawOverlay(title: string, sub: string) {
      ctx!.save();
      // En `clasico` el velo es transparente: el original no oscurecía la escena.
      ctx!.fillStyle = palette().overlay;
      ctx!.fillRect(0, 0, W, H);

      ctx!.textAlign = "center";
      ctx!.textBaseline = "alphabetic";
      ctx!.fillStyle = palette().fg;
      ctx!.font = "bold 46px monospace";
      ctx!.fillText(title, W / 2, H / 2 - 18);
      ctx!.font = "18px monospace";
      ctx!.fillStyle = palette().dim;
      ctx!.fillText(sub, W / 2, H / 2 + 22);
      ctx!.restore();
    }

    function drawParticles() {
      if (particles.length === 0) return;
      // Un solo `strokeStyle`/`lineWidth` para todo el lote; el desvanecido de
      // cada partícula va por `globalAlpha`, que `restore()` devuelve a 1.
      ctx!.save();
      ctx!.strokeStyle = palette().fg;
      ctx!.lineWidth = 1;
      for (let i = 0; i < particles.length; i++) particles[i].draw();
      ctx!.restore();
    }

    function draw() {
      ctx!.fillStyle = palette().bg;
      ctx!.fillRect(0, 0, W, H);

      drawParticles();
      for (let i = 0; i < asteroids.length; i++) asteroids[i].draw();
      for (let i = 0; i < powerUps.length; i++) powerUps[i].draw();
      for (let i = 0; i < bullets.length; i++) bullets[i].draw();
      ship.draw();

      drawHUD();

      if (state === "gameover") drawOverlay("GAME OVER", overlaySub);
    }

    // ── Loop principal ───────────────────────────────────────────────────────
    let lastTime: number | null = null;
    let rafId = 0;

    function loop(ts: number) {
      const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;
      update(dt);
      draw();
      // En game over, apagada la última partícula de la explosión final, ya no
      // queda nada que animar: la escena y el overlay están dibujados en el
      // canvas y se quedan ahí. Antes se repintaban 60 veces por segundo
      // (indefinidamente, detrás del modal de React, mientras el jugador
      // escribe su nombre). Mismo patrón que `tetris/engine.ts:362`.
      if (state === "gameover" && particles.length === 0) return;
      rafId = requestAnimationFrame(loop);
    }

    // Cancel-then-request: reiniciar con el loop todavía vivo (botón "JUGAR DE
    // NUEVO" antes de que se apaguen las partículas) no deja dos rAF corriendo.
    function start() {
      cancelAnimationFrame(rafId);
      lastTime = null;
      rafId = requestAnimationFrame(loop);
    }

    restartRef.current = () => {
      initGame();
      start();
    };
    redrawRef.current = draw;
    initGame();
    start();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearKeys);
      document.removeEventListener("visibilitychange", clearKeys);
      restartRef.current = null;
      redrawRef.current = null;
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
