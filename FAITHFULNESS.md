# FAITHFULNESS REPORT

What in this port is verified authentic, what is reconstructed, and what
remains uncertain. Written so nobody has to take "faithful" on faith.

## Sources used

1. **Original gameplay footage** — a 73-frame animated capture of the real
   1991 game (level 1) plus gameplay screenshots (level 3) from public
   gameplay videos. Used to verify: board proportions, tile scale, the exact
   Win 3.1 window chrome, status-bar layout (mouse-icon lives / stopwatch /
   score), the clock's appearance (white face, red marks, blue hand, blue
   target line), and the VGA colour palette (sampled pixel-exact:
   floor `#808000`, wall teal `#008080`/cyan `#00ffff`/silver `#c0c0c0`,
   blocks `#008000`/`#00ff00`, cat `#ffff00`, mouse silver).
2. **matthewcpp/RodentsRevenge** (C89/SDL2, GitHub) — a reverse-engineering
   study of the original; its engine files (`enemy.c`, `player.c`, `clock.c`,
   `spawner.c`, `grid.c`, `yarn.c`, `game.c`) were read file-by-file and are
   the primary mechanical reference. Its `assets/levels/level01–04.txt` are
   transcriptions of the original's first four layouts.
3. **endemic/revenge** (JS, GitHub) — an independent partial
   re-implementation; its level-1 transcription and enemy logic agree with
   source 2 on every rule they both cover (cross-verification).
4. **Wikipedia** — documented rules: clock "blue line", 50 selectable levels
   then indefinite continuation, 3 lives, hazard behaviours, scoring
   descriptions.

## Reproduced with high confidence (verified)

| Mechanic | Detail |
| --- | --- |
| Board | 23×23 tiles, ring of unmovable wall, mouse spawns at centre (11,11); a block under the centre is destroyed on spawn — visible in level-1 footage |
| Cat AI | Greedy 8-direction chase: each 1000 ms tick a cat examines all 8 neighbours, moves to the free one minimising squared Euclidean distance to the mouse; diagonal steps allowed; reaching the mouse's cell (or the mouse walking into it) kills the mouse |
| Pinning | A cat with no free neighbour is pinned ("waiting") and becomes stationary; pinned cats re-check every tick and resume if a gap opens |
| Round clear | **All** spawned cats pinned simultaneously → each converts to cheese (+1) → the stopwatch winds at 100× speed → next spawn batch → repeat |
| Level end | After the final spawn wave (spawn target exhausted) the next level begins; level 51+ continue indefinitely |
| Spawning | Batches from a per-level cycle (`#spawn 1 2` = 1, then 2, …) at 8 fixed border points (corners + edge midpoints); first batch spawns at level start |
| Stopwatch | Hand sweeps 30 positions, one per second; each full sweep is one "minute" tick; cats spawn when the minute hand reaches the blue line, which then advances by the level's `#clock` interval; interval 30 wraps to 0 = no more spawns |
| Survival scoring | +1 when the hand passes position 14 and position 0 (i.e. every 15 s) |
| Cheese | Eating cheese +100; cheese blocks cats; blocks pushed over cheese destroy it |
| Block pushes | Chains of blocks slide one cell; push legal only if the chain's end is free ground; end occupied by a cat → the cat flees if it can, otherwise the push fails; ends at wall/trap/yarn fail |
| Sink holes | Entering consumes the hole and traps the mouse for 10 s (cats keep moving); pushing blocks into a hole consumes one block per push, the hole remains |
| Mouse traps | Kill on contact, trap consumed; 5-frame death animation; a killer cat re-occupies the death cell afterwards |
| Yarn balls | Spawn on border wall cells, idle 1–5 s, then move every 100 ms (dy ±1, dx −1/0/1); the wall behind them is restored after their first move; explode against walls/blocks/traps/cheese, die in holes, hop over cats, kill the mouse on contact (yarn dies too); at most 2 alive |
| Lives | 3 total (2 remaining + current); death respawns at the centre (or a free border point) without resetting the level; score persists |
| Level select | Start levels 1–50 |
| Presentation | VGA 16-colour palette, Win 3.1 title bar `Rodent's Revenge [N]`, Game/Options/Help menus, status strip layout, stopwatch face |

## Reconstructed (clearly marked, not claimed as recovered)

- **Levels 5–50 layouts.** Only the original's levels 1–4 were recoverable
  (transcribed by the reference remakes; level 1 additionally verified frame-
  by-frame against footage). Levels 5–50 here are **deterministic,
  seed-locked reconstructions** built from the original's documented pattern
  vocabulary (SQUARE / BOXCHESS / WALLCHESS × LARGE / MEDIUM / SMALL, plus
  random wall/box/hole/trap counts — a per-level progression table published
  by a third community port was used as the structural guide). Every
  playthrough of level N produces the same layout, preserving the "fixed
  levels" structure; the layouts themselves are not the original's.
- **Yarn configuration per level.** The original's yarn timing per level is
  not recoverable from available sources; reconstructed levels enable yarn
  from level 5 with intervals that tighten as levels progress.
- **Clock intervals and spawn cycles for levels 5–50.** Levels 1–4 carry
  their authentic values (`#clock 5/5/5/2`, cycles `[1,2] [1,2] [3] [1]`);
  later levels ramp 4 → 3 → 2.
- **Sprites and sounds.** All artwork and PC-speaker-style sounds are
  hand-made recreations matched by eye/ear to footage — close, but not
  bit-identical to the original's bitmaps.

## Uncertain / known deviations

- **Level-completion bonus.** Period documentation mentions extra points for
  completion speed and difficulty. The recovered engine implements
  completion scoring as +1 per pinned cat and +1 per 15 s survived, which
  plausibly *is* that bonus, but the original formula could not be verified.
  No invented formula was added.
- **Mouse movement repeat.** The original relied on the Windows keyboard
  repeat; this port repeats a held direction after 350 ms at 10 steps/s
  (touch D-pad repeats continuously). The per-step game feel matches footage
  but the exact original repeat curve is unknown.
- **Spawn-point order.** The 8 spawn points are verified; whether the
  original picks them randomly or in a fixed order within a batch is unknown
  (randomised here).
- **Cat iteration order.** Cats move in spawn order each tick, matching the
  reference engine; the original's exact iteration order is unknown.
- The reference engine's spawn-position table contains a duplicated corner
  entry, likely its own transcription slip; this port uses the 8 distinct
  geometric points (4 corners + 4 edge midpoints), which matches footage.
