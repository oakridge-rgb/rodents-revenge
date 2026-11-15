# 🐭 Rodent's Revenge — faithful web & Android port
Just like all great android ports, it's made with help by ai, specifically GLM 5.3 agent mode
A port of the 1991 Microsoft Windows game **Rodent's Revenge** (designed by
Christopher Lee Fraley) to modern browsers and Android, rebuilt to preserve the
original's mechanics, level structure, presentation and feel — not to
modernise them.

**Play / install:** https://oakridge-rgb.github.io/rodents-revenge/

## What this is

- The **original game's rules**: 23×23 board, 8-directional cat chase AI,
  pin-all-cats-together round clears, chained block pushes, the 30-position
  stopwatch with the blue spawn line, sink holes (10s), mouse traps, yarn
  balls that leave a wall trail, 3 lives, centre respawn, level 51+ forever.
- The **original presentation**: Windows 16-colour VGA palette (olive floor,
  cyan pyramid walls, green blocks, yellow cats, silver mouse), Win 3.1
  program-window chrome (blue title bar with `Rodent's Revenge [N]`,
  **Game / Options / Help** menus, status strip with mouse-icon lives, the
  stopwatch and the score), PC-speaker-style beeps.
- The **original level structure**: levels 1–4 are authentic transcriptions of
  the original layouts; levels 5–50 are deterministic reconstructions built
  from the original's pattern vocabulary (see [FAITHFULNESS.md](FAITHFULNESS.md)
  for exactly what is authentic, what is reconstructed, and what remains
  uncertain — no fabricated "recovered" data).

## Install on Android (1 minute, no APK)

1. Open **https://oakridge-rgb.github.io/rodents-revenge/** in Chrome.
2. Menu **⋮ → Add to Home screen**.
3. Launch **Rodent** from the app drawer — fullscreen, standalone, works
   offline. High scores stay on the device.

## Controls

- ⌨️ Arrows / WASD to move (hold to repeat) · **P** pause · **M** sound ·
  Space start
- 📱 Swipe on the board or hold the on-screen D-pad; fullscreen button on the
  title bar
- Menus: **Game → New Game / Choose Level (1–50) / Pause**,
  **Options → Sound / Fullscreen**, **Help → How to Play / High Scores / About**

## Quick rules

Push the green blocks to box every cat in on **all eight sides** — a pinned
cat becomes cheese (+1), which you eat for +100. When every cat is pinned at
once the round clears, the stopwatch winds up and drops the next batch of
cats at the board's edge points; after the final wave (blue line reaches the
end of the dial) you advance a level. Cats chase you every second, diagonals
included. Sink holes trap you for 10 seconds while cats keep moving; traps
snap; yarn balls fly and explode against walls — they also spawn *from* walls.

## Repository layout

```
index.html    program-window chrome, menus, dialogs
style.css     Windows 3.1 look (VGA palette, beveled chrome)
levels.js     authentic levels 1-4 + deterministic generator for 5-50
game.js       engine (cat AI, clock, spawner, yarn, scoring, sprites)
sw.js         offline cache
docs/COMPARISON.md   every difference found between the v1 remake and the original
```

## Legal

Non-commercial fan port. Rodent's Revenge game design © 1991 Microsoft
Corporation. This repository contains **no** original Microsoft code or
artwork: all mechanics were re-derived from publicly documented behaviour and
published reverse-engineering studies, and all sprites/sounds are hand-made
recreations. Not affiliated with or endorsed by Microsoft. Code: MIT
([LICENSE](LICENSE)).
