# COMPARISON — v1 remake vs the original Rodent's Revenge (1991)

Research basis (sources actually consulted, see FAITHFULNESS.md):

- **matthewcpp/RodentsRevenge** (C89/SDL2) — engine code studied file-by-file
  (`enemy.c`, `player.c`, `clock.c`, `spawner.c`, `grid.c`, `yarn.c`, `game.c`);
  contains hand-transcribed copies of original levels 1–4
  (`assets/levels/level01–04.txt`).
- **endemic/revenge** (JS) — independent partial re-implementation; its
  transcribed level data and enemy logic used for cross-verification.
- **Original gameplay footage** (animated GIF of the real game, 73 frames,
  from endemic's repo) + gameplay screenshots (YouTube) — visual reference for
  palette, sprites, window chrome, status bar, clock.
- **Wikipedia** — documented rules (clock "blue line", 50 levels then
  indefinite, speed/difficulty bonuses, hazards, 3 lives).

## Every major difference found in v1

| # | Area | v1 (remake) | Original | Status now |
|---|------|-------------|----------|------------|
| 1 | Grid | 24×16 | **23×23**, ring of unmovable wall | Fixed |
| 2 | Levels | Procedural, endless | **50 fixed levels**, then indefinite; level 1 = plain 15×15 block field with mouse spawned at centre (block under mouse destroyed) | L1–4 authentic transcriptions; L5–50 reconstructed generator (documented) |
| 3 | Cat AI | 4-dir chase, invented wander | **8-directional greedy chase**: examine all 8 neighbours each tick, move to the free one minimising squared Euclidean distance to the mouse; diagonal movement allowed | Fixed |
| 4 | Cat speed | Variable per level (260–430ms) | **Constant 1000ms** every level | Fixed |
| 5 | Trap rule | 4 orthogonal sides blocked | Cat **pinned when all 8 neighbours are occupied**; pinned cats re-try every tick and un-pin if you open a gap | Fixed |
| 6 | Win condition | "all cats trapped" per level | **Round = pin every spawned cat simultaneously** → each pinned cat becomes cheese (+1) → clock winds at 10× speed → next spawn batch → repeat until spawn target exhausted → next level | Fixed |
| 7 | Cats at level start | 3+ cats placed | Level starts with **one spawn-cycle batch** (level 1: a single cat) at the border spawn points | Fixed |
| 8 | Cat spawning | Random empty tiles | **8 fixed border points**: corners + edge midpoints (1,1) (21,1) (21,21) (1,21) (11,1) (21,11) (11,21) (1,11) | Fixed |
| 9 | Spawning schedule | Timer every 28s | **Stopwatch**: hand sweeps 30 positions (1/s); each full sweep = 1 "minute" tick; spawn batch when the minute hand reaches the **blue line** (target), then target advances by the level's clock interval; target 0 = no more spawns; `#clock N` from level data | Fixed |
| 10 | Clock UI | Progress bar | **Stopwatch face in the status bar** (white face, red marks, blue hand, blue target line) that visibly winds fast after a round clear | Fixed |
| 11 | Push rules | One block only, into empty tiles | **Chain pushes**: push a contiguous run of blocks; blocked by wall/trap/yarn at the end; end cell occupied by a cat → the cat tries to flee, push succeeds only if it moves; push over cheese destroys the cheese; push into a hole consumes the adjacent block (hole stays) | Fixed |
| 12 | Holes | Stuck 3s, reusable | **Stuck 10 seconds**, hole is consumed on entering; cats keep moving | Fixed |
| 13 | Traps | Kill mouse, persisted | Kill mouse, **trap consumed**; death animation (5 frames), killer cat re-occupies the death cell | Fixed |
| 14 | Yarn | Invented diagonal bounce | Spawns **on a border wall cell** (wall restored behind it after first move), waits 1–5s, then moves every 100ms (dy ±1, dx ∈ −1/0/1); **explodes** on wall/block/trap, dies in holes, hops over cats, kills mouse on contact (yarn dies too); **max 2 alive**; spawn interval from level properties | Fixed |
| 15 | Scoring | Cheese 50, cat 250, level 100×L | **Cheese eaten +100; pinned cat +1; survival +1 when the clock hand passes position 14 and 0** (i.e. +1 per 15s); level completion bonus per original docs is folded into these (exact original formula not recoverable — see report) | Fixed |
| 16 | Lives | 3 | 3 (2 remaining + current). Death → **respawn at centre (or a free border spawn point)** without resetting the level; score persists | Fixed |
| 17 | Mouse movement | 150ms auto-repeat | 1 cell per keypress; original relied on OS key-repeat (hold to repeat) | Fixed (hold ≈100ms repeat) |
| 18 | Visuals | Invented modern theme (wood crates, dark bg, checkered floor) | **Windows 16-colour VGA palette**: olive floor (128,128,0), teal/cyan/silver pyramid-brick walls, green/lime/silver blocks, yellow cat, silver mouse, yellow cheese; sprites hand-recreated to match footage | Fixed |
| 19 | UI | Custom dark HUD | **Win 3.1 chrome**: blue title bar "Rodent's Revenge [N]", menu bar **Game / Options / Help**, gray status strip: mouse-icon lives (left), stopwatch (centre), score (right) | Fixed |
| 20 | Level select | Title-screen ± buttons | Original offered **Choose Level 1–50** in the Game menu | Fixed (menu dialog) |
| 21 | Sound | Custom synth | Simple PC-speaker-style beeps recreated with WebAudio | Recreated |
| 22 | Android/PWA | — | Kept (manifest, offline worker, touch D-pad + swipe, fullscreen) — required compatibility, not a gameplay change | Kept |

## What could NOT be verified (and was therefore not invented)

- Exact layouts of original levels 5–50 (only 1–4 recovered; 5–50 are
  deterministic reconstructions seeded per level number).
- The exact level-completion bonus formula (original docs mention a
  speed/difficulty bonus; the recovered engine interprets completion points as
  the +1-per-pinned-cat and +1-per-15s ticks).
- Whether the original's yarn timing was per-level configured (reconstructed
  per level).
