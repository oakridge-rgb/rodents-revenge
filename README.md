# 🐭 Rodent's Revenge — Android Edition

A faithful, from-scratch reimplementation of the 1991 Microsoft Windows classic
**Rodent's Revenge** (by Christopher Lee Fraley), rebuilt as an HTML5 game and
packaged as an **installable Android app (PWA)**. Playable offline, installable
from the browser, no store required.

**Play / install:** https://oakridge-rgb.github.io/rodents-revenge/

---

## Why this game

Rodent's Revenge shipped with Microsoft Entertainment Pack in 1991 and, unlike
Solitaire or Minesweeper, it **never received an official or notable Android
port** — 30+ years later it still only exists on Windows (original + a 2000s C++
remake). This repo changes that: same rules, same feel, running on your phone.

## How to install on Android (1 minute, no APK)

1. Open **https://oakridge-rgb.github.io/rodents-revenge/** in Chrome on your
   Android phone.
2. Tap the **⋮ menu → Add to Home screen** (or the inline **Install** banner).
3. Launch **Rodent** from your home screen — it opens fullscreen, standalone,
   works **offline** (service worker), and appears in your app drawer like any
   native app.

That's a real port path: GitHub Pages hosts it, the web app manifest + service
worker make it an Android app. Your high score persists between sessions.

## How to play

You are the mouse. Every level is a walled arena filled with **crates** (pushable)
and **stone** (fixed), and a pack of cats that hunt you.

| Action | Result |
| --- | --- |
| Push crates to **box a cat in on all 4 sides** | Cat turns into **cheese** (+250) |
| Walk over cheese | **Eat it** (+50) |
| Box in **every cat** | **Level clear** (+100 × level) |
| Cat touches you | Lose a life (3 total) |

Hazards grow with the levels: **sink holes** (stuck 3s — cats keep moving!),
**mouse traps** (instant death), and from level 7 **flying yarn balls**
(diagonal, bouncing, deadly). A **clock** in the HUD fills up every ~28 seconds
and spawns an extra cat — more danger, more points.

**Controls**

- 📱 Touch: swipe on the board, or hold the on-screen D-pad (auto-repeats)
- ⌨️ Keyboard: arrows / WASD · **P** pause · **M** mute
- Start level selectable 1–50 on the title screen, like the original

## Building a real APK (optional)

The PWA is a complete Android app for daily use. If you want a sideloadable APK
for distribution:

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://oakridge-rgb.github.io/rodents-revenge/manifest.webmanifest
bubblewrap build          # produces app-release-signed.apk
```

(Bubblewrap wraps this exact site in a Trusted Web Activity — same code, APK
container.) Any WebView wrapper (Capacitor, Cordova) works identically since
the game has zero external dependencies.

## Tech

- Zero dependencies, zero build step: `index.html` + `style.css` + `game.js`
- Canvas renderer with a crisp retro look, procedural levels (seeded per level —
  layouts are deterministic), WebAudio synth sound effects (no audio files)
- PWA: manifest + offline service worker + generated icon set (192/512/maskable)
- Works in any modern browser; tested on Android Chrome (touch) and desktop

## Fair-use note

This is a **non-commercial fan tribute**. The original Rodent's Revenge game
design is © 1991 Microsoft Corporation (designed by Christopher Lee Fraley).
This repo contains **none** of the original code, art, or audio — everything
here was written from scratch. The name is used to describe the homage.

## License

Code: MIT — see [LICENSE](LICENSE).
