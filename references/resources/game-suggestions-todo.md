# TODO — sugerencias de juegos

Memoria del agente `game-planner`. Lee este archivo antes de proponer nada y lo
actualiza al terminar. Un juego que aparezca en cualquier sección **no se
vuelve a sugerir**.

## Pendientes

- [ ] **SPACE INVADERS** ⭐ recomendado — `invasores` · SHOOTER · cyan · dif. 4 · `/games/invaders` — 2026-09-03
  - **Encaje:** el catálogo no tiene ningún juego de dificultad 4-5 (rocas/tetro=3, ladrillos=2, vibora=1); Invaders cubre ese hueco con oleadas que aceleran. Diferencia el SHOOTER de "rocas" (nave flotante) con un patrón de oleada descendente clásico.
  - **Viabilidad:** canvas 2D puro, 0 assets (rects/sprites dibujados a mano como rocas/tetro), motor sencillo de oleada + colisión AABB.
  - **Score:** puntos por invasor destruido → creciente y competitivo; game over inequívoco (invasores llegan abajo o se acaban las vidas).
  - **Cover:** reutiliza `.cover-invaders` (huérfano, nombre calza literal).
  - **Riesgo:** bajo — ninguno relevante (sin física compleja, sin IA de enemigos real, sin red).
  - **Fuentes:** https://github.com/CodingWith-Adam/space-invaders , https://github.com/dwmkerr/spaceinvaders

- [ ] **PONG** — `pinpon` · DUELO (cat. nueva) · magenta · dif. 2 · `/games/pong` — 2026-09-03
  - **Encaje:** único juego de raqueta/duelo 1 vs IA del catálogo; aporta input distinto (movimiento continuo vs. discreto por celdas).
  - **Viabilidad:** canvas 2D puro, 0 assets, IA de paleta trivial (sigue la bola).
  - **Score:** no crece solo — hay que definirlo explícitamente (p. ej. puntos anotados antes de perder, o "gana quien llega a 7"). Riesgo de diseño, no técnico.
  - **Cover:** reutiliza `.cover-duelo` (huérfano).
  - **Riesgo:** medio — el mapeo score↔leaderboard no es tan natural como en un shooter de oleadas.
  - **Fuentes:** https://github.com/SMenigat/html5-pong , https://gist.github.com/straker/81b59eecf70da93af396f963596dfdc5

- [ ] **FROGGER** — `rana` · ARCADE · yellow · dif. 3 · `/games/frogger` — 2026-09-03
  - **Encaje:** mecánica de esquive/timing por carriles, distinta a las 4 actuales (ninguna usa carriles de tráfico ni "montar" plataformas).
  - **Viabilidad:** procedural (rects para coches/troncos/rana), sin assets, pero más entidades que gestionar (carriles de coche + carriles de río con colisión inversa).
  - **Score:** puntos por avance/cruce completado → creciente y competitivo.
  - **Cover:** reutiliza `.cover-rana` (huérfano).
  - **Riesgo:** medio — balance de velocidad de carriles y colisión de "montar" troncos flotantes es más delicado que un shooter simple.
  - **Fuentes:** https://github.com/lukelafountaine/frogger , https://gist.github.com/straker/82a4368849cbd441b05bd6a044f2b2d3

- [ ] **PAC-MAN** — `glotón` · LABERINTO (cat. nueva) · green · dif. 5 · `/games/pacman` — 2026-09-03
  - **Encaje:** único juego de laberinto + persecución del catálogo; cubriría también el hueco de dificultad alta.
  - **Viabilidad:** procedural (laberinto dibujado con rects/líneas, sin sprites), pero exige diseño de mapa + colisión de paredes + IA de 4 fantasmas con comportamientos distintos + power pellets.
  - **Score:** puntos por punto/pellet comido y fantasma cazado → creciente y competitivo.
  - **Cover:** reutiliza `.cover-glot` (huérfano).
  - **Riesgo:** alto — IA de enemigos múltiple (regla dura de coste de port), tuning de dificultad y diseño de laberinto son el trabajo más pesado de los 4 candidatos.
  - **Fuentes:** https://github.com/nixkhm/Pacman-Clone , https://github.com/ravishan16/pacman

- [ ] **FUSIÓN** — `fusion` · PUZZLE · yellow · dif. 2 · `/games/2048` — 2026-09-03
  - **Encaje:** PUZZLE ya tiene a tetro (cyan); mecánica merge≠caída de piezas, diversifica sin clonar.
  - **Viabilidad:** grid 4x4, input 100% teclado nativo, game-over inequívoco (sin movimientos ni huecos). Coste bajo-medio.
  - **Score:** suma de valores fusionados, crece monótono — encaje perfecto con leaderboard desc.
  - **Cover:** `cover-2048`, 100% CSS.
  - **Riesgo:** bajo; solapa visualmente con tetro (ambos grid), mitigable con paleta distinta.
  - **Fuentes:** https://github.com/DanielZhu/2048-canvas , https://github.com/portrik/2048js

- [ ] **APAGÓN** — `apagon` · PUZZLE · green · dif. 1 · `/games/lights-out` — 2026-09-03
  - **Encaje:** PUZZLE de dificultad baja, complementa a vibora(dif.1) con perfil de puzzle en vez de reflejos.
  - **Viabilidad:** grid 5x5 toggle, tablero random resoluble cada restart, input teclado (cursor+espacio). Coste bajo.
  - **Score:** construido (no orgánico) a partir de clics/tiempo al resolver — aceptable pero rango de score acotado.
  - **Cover:** `cover-apagon`, 100% CSS.
  - **Riesgo:** medio — score artificial + partidas muy cortas.
  - **Fuentes:** https://github.com/jdan/LightsOut

- [ ] **GEMAS** — `gemas` · ARCADE · yellow · dif. 3 · `/games/match-3` — 2026-09-03
  - **Encaje:** ARCADE ya tiene ladrillos(magenta)/vibora(green); yellow evita choque de color.
  - **Viabilidad:** motor no trivial (match+cascada+refill, ≥ Tetris); input nativo es mouse/drag, adaptarlo a teclado es una deviation real. Coste medio-alto.
  - **Score:** natural, puntos por combinación, crece monótono.
  - **Cover:** `cover-gemas`, 100% CSS.
  - **Riesgo:** medio — coste de motor alto + deviation de input notable.
  - **Fuentes:** https://github.com/rembound/Match-3-Game-HTML5 , https://github.com/bazhanius/match-3-game

- [ ] **GALAGA** — `escuadron` · SHOOTER · cyan · dif. 3 · `/games/galaga` — 2026-09-03
  - **Encaje:** shooter de formación/oleadas, complementa a rocas (free-roam) sin duplicar mecánica.
  - **Viabilidad:** input y score cumplen el contrato sin fricción; coste medio por IA de picado y gestión de formación.
  - **Score:** puntos por enemigo + bonus por atacar en picado, natural para leaderboard.
  - **Cover:** clase propia (no reusar `.cover-invaders`, asociado a candidato vetado).
  - **Riesgo:** curvas de vuelo/formación; omitir la mecánica de captura original para no sobre-alcanzar scope.
  - **Fuentes:** https://github.com/gregfrazier/gakaga

- [ ] **MISSILE COMMAND** — `defensa` · DEFENSA (cat. nueva) · magenta · dif. 4 · `/games/missile-command` — 2026-09-03
  - **Encaje:** cubre gap real de categoría (defensa/estrategia), inexistente en el catálogo actual.
  - **Viabilidad:** score/game-over cumplen contrato; el original es mouse/trackball puro, adaptarlo a teclado (cursor+disparo) degrada el "feel". Coste medio.
  - **Score:** misiles interceptados + ciudades supervivientes, ordenable desc sin problema.
  - **Cover:** procedural puro (skyline + explosiones radiales), sin sprites.
  - **Riesgo:** rediseño de input mouse→teclado; balanceo de oleadas.
  - **Fuentes:** https://gist.github.com/straker/afc4e2a30b6df772a5f9f6ef01751d41

- [ ] **CENTIPEDE** — `ciempies` · ARCADE · yellow · dif. 3 · `/games/centipede` — 2026-09-03
  - **Encaje:** tercer ARCADE, mecánica de disparo en jardín de hongos distinta a ladrillos/vibora.
  - **Viabilidad:** input/score cumplen contrato sin fricción (mejora al original, que usaba trackball); coste medio-alto por lógica de split de segmentos + 2-3 IAs de enemigo.
  - **Score:** puntos por segmento/enemigo destruido, leaderboard natural.
  - **Cover:** CSS puro, cuerpo segmentado sobre grid de hongos.
  - **Riesgo:** estructura de datos de segmentos enlazados + split, múltiples IAs simultáneas.
  - **Fuentes:** https://github.com/erezbosch/centipede

- [ ] **DIG DUG** — `excavador` · ARCADE · cyan · dif. 4 · `/games/dig-dug` — 2026-09-03
  - **Encaje:** cubre gap de mecánica (terreno destructible/excavación), inédito en catálogo.
  - **Viabilidad:** cumple contrato del motor pero es el port más caro del lote: terreno mutable + hold-to-charge + física de rocas + IA con modo fantasma por tierra sólida.
  - **Score:** puntos por enemigo inflado/aplastado, leaderboard natural.
  - **Cover:** CSS posible (estratos de tierra + túneles) pero laborioso.
  - **Riesgo:** alto — el más caro de los 20 candidatos evaluados.
  - **Fuentes:** https://github.com/lazyleung/DigDugJS

- [ ] **TANK BATTLE** — `tanque` · SHOOTER · yellow · dif. 3 · `/games/tank-battle` — 2026-09-03
  - **Encaje:** SHOOTER top-down con defensa de base, complementa a rocas sin solape de mecánica.
  - **Viabilidad:** el candidato con mejor encaje de input/score de su lote — teclado 100% nativo sin adaptaciones forzadas. Coste medio.
  - **Score:** puntos por tanque enemigo destruido, leaderboard natural.
  - **Cover:** CSS puro (grid tipo laberinto + silueta de tanque), sin sprites.
  - **Riesgo:** IA simple de tanques + contabilidad de muros destructibles; evitar nombrar "Battle City" literal por marca.
  - **Fuentes:** https://github.com/newagebegins/BattleCity

- [ ] **TOPOS** — `topos` · REFLEJOS (cat. nueva) · yellow · dif. 2 · `/games/whack-a-mole` — 2026-09-03
  - **Encaje:** mecánica de reflejos con mouse, ningún juego actual la usa — cero solape.
  - **Viabilidad:** score creciente ok; game-over = fin de temporizador (paradigma distinto al resto). Input 100% mouse, deviation grande vs. convención teclado.
  - **Score:** golpes acertados en tiempo límite, desc funciona bien.
  - **Cover:** `cover-topos`, procedural, coste bajo.
  - **Riesgo:** sin fallback de teclado razonable; adaptar "onGameOver por timeout" al contrato.
  - **Fuentes:** https://github.com/ImKennyYip/whac-a-mole

- [ ] **PATOS** — `patos` · SHOOTER · cyan · dif. 3 · `/games/duck-hunt` — 2026-09-03
  - **Encaje:** shooter de puntería con mouse, variante distinta a rocas pero mismo cat.
  - **Viabilidad:** score creciente ok; game-over ambiguo (hay que diseñar vidas/rondas, el original no las tiene claras). 100% mouse.
  - **Score:** patos acertados, desc ok.
  - **Cover:** requiere spritesheet propio (pato en vuelo/caído, arbustos, mira) — coste medio-alto.
  - **Riesgo:** solo mouse; diseño de vidas/rondas no trivial; assets propios pesan el port.
  - **Fuentes:** https://github.com/ImKennyYip/duck-hunt

- [ ] **FRUTAS NINJA** — `frutas` · ARCADE · magenta · dif. 2 · `/games/fruit-ninja` — 2026-09-03
  - **Encaje:** mouse drag/swipe (trail), mecánica nueva de verdad para el catálogo.
  - **Viabilidad:** score creciente ok (fruta cortada + combos); game-over limpio (3 fallos o bomba cortada). Input 100% mouse/touch.
  - **Score:** frutas cortadas, desc ok, admite combos como bonus.
  - **Cover:** procedural (círculos/elipses, mitades con arcos), sin sprites, coste bajo-medio.
  - **Riesgo:** sin fallback de teclado; detección de swipe (trackear posiciones recientes, no solo click).
  - **Fuentes:** https://github.com/aa-ayushadhikari/fruitninja

- [ ] **AVE** — `ave` · ARCADE · yellow · dif. 3 · `/games/flappy-bird` — 2026-09-03
  - **Encaje:** un solo botón (`e.code`), 100% teclado — encaja perfecto en la convención existente, sin deviation de mouse.
  - **Viabilidad:** score creciente (tubos superados), game-over clarísimo (colisión). Input ideal.
  - **Score:** tubos superados, desc perfecto para leaderboard.
  - **Cover:** procedural total (ave + tubos como formas simples), igual que rocas/tetro, coste bajo.
  - **Riesgo:** mínimo; posible percepción de similitud con vibora (ambos ARCADE de reflejos simples) pero física distinta.
  - **Fuentes:** https://github.com/kecav/flappy-birds-js

- [ ] **SALTO** — `salto` · PLATAFORMAS (cat. nueva) · green · dif. 3 · `/games/doodle-jump` — 2026-09-03
  - **Encaje:** scroll vertical infinito, mecánica de plataformas inédita en el catálogo.
  - **Viabilidad:** input teclado (izq/der) sin deviation; score creciente (altura), game-over claro (caer bajo pantalla).
  - **Score:** altura alcanzada, desc ok.
  - **Cover:** procedural (plataformas + muñeco como formas simples), coste bajo-medio.
  - **Riesgo:** mínimo; el reto es la generación procedural infinita de plataformas, bien documentada en las fuentes.
  - **Fuentes:** https://github.com/M-Adil-AS/Doodle-Jump

- [ ] **SIMON** ⭐ recomendado — `secuencia` · MEMORIA (cat. nueva) · magenta · dif. 2 · `/games/simon` — 2026-09-03
  - **Encaje:** categoría nueva (memoria/reflejos), cero solape con rocas/tetro/ladrillos/vibora.
  - **Viabilidad:** score natural = nivel/ronda alcanzada (entero creciente, nada inventado). Game-over inequívoco (input erróneo). Input teclado trivial (4 teclas fijas vía `e.code`), sin IA. Coste bajo.
  - **Score:** natural, cero fricción con leaderboard.
  - **Cover:** `cover-simon`, 100% procedural (canvas arcs/rects).
  - **Riesgo:** bajo — único cuidado es la temporización de flashes con `dt` clamp para no romper la secuencia tras cambio de pestaña.
  - **Fuentes:** https://github.com/erilyth/Simon-Says-Game , https://github.com/mm86/simon-game

- [ ] **AIR HOCKEY** — `hockey` · DEPORTES (cat. nueva) · cyan · dif. 3 · `/games/air-hockey` — 2026-09-03
  - **Encaje:** hueco nuevo (deportes/físicas), pero mismo paradigma real-time que el resto del catálogo.
  - **Viabilidad:** score natural = goles anotados (o "goles antes de perder" contra IA con dificultad creciente, como ya hace Arkanoid). Game-over claro. Input teclado viable (paleta restringida a tu mitad), IA reactiva simple (seguir el puck). Coste medio.
  - **Score:** natural, encaja sin inventar nada raro.
  - **Cover:** `cover-hockey`, 100% procedural.
  - **Riesgo:** medio — física de colisión/rebote y anti-tunneling a alta velocidad, calibrar IA.
  - **Fuentes:** https://github.com/dahveed15/Air-Hockey , https://github.com/KaANO-8/airHockey

- [ ] **QBERT** — `cubos` · PLATAFORMAS · green · dif. 4 · `/games/qbert` — 2026-09-03
  - **Encaje:** visualmente muy distinto (isométrico), gran diversidad pero el mayor salto de complejidad del lote.
  - **Viabilidad:** score el más natural de los 20 (puntos por cubo + bonus + evitar enemigos), game-over claro. Pero requiere proyección isométrica desde cero, múltiples IAs de enemigo (Coily persigue, otros patrullan) y progresión de nivel. Coste alto.
  - **Score:** el más natural del lote, rodeado del mayor esfuerzo de implementación.
  - **Cover:** procedural factible (paralelogramos isométricos) pero enemigos añaden complejidad visual.
  - **Riesgo:** el más alto del lote — casi un diseño desde cero más que un port; pocas referencias vanilla-JS pulidas.
  - **Fuentes:** https://github.com/alainsmet/qbert

## Aceptados

_(vacío)_

## Descartados

| Juego                               | Fecha      | Razón del descarte                                                                                                                                            |
| ----------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CAMPO (Minesweeper) — `campo`       | 2026-09-03 | Sin score natural (binario ganar/perder) + input nativo mouse (clic/clic-derecho), doble deviation del contrato del motor.                                    |
| CAJAS (Sokoban) — `cajas`           | 2026-09-03 | Sin game-over real (solo nivel resuelto/bloqueo) ni score único creciente; exige niveles curados a mano, no procedurales.                                     |
| MEMORAMA — `memoria`                | 2026-09-03 | Sin score natural (termina en "parejas encontradas", no en contador creciente); mecánica point-and-click de grid, fricción con input-teclado-primero.         |
| 4 EN LÍNEA (Connect 4) — `conecta4` | 2026-09-03 | Paradigma por turnos (no `dt` real-time) y resultado natural win/lose/draw, no score numérico; reconvertirlo rompe el patrón "una partida = un `onGameOver`". |

## Implementados

| Juego     | ID          | Fecha      | Spec                         |
| --------- | ----------- | ---------- | ---------------------------- |
| ASTEROIDS | `rocas`     | 2026-06-22 | `specs/05-asteroids-game.md` |
| TETRIS    | `tetro`     | 2026-08-31 | `specs/07-tetris.md`         |
| ARKANOID  | `ladrillos` | 2026-09-01 | `specs/08-arkanoid.md`       |
| SNAKE     | `vibora`    | 2026-09-01 | `specs/09-snake.md`          |
