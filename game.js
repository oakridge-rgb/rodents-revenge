/* ============================================================
   RODENT'S REVENGE — faithful web/Android port
   Reconstructed from study of the 1991 Microsoft Windows game.
   Mechanics cross-verified against two independent reverse-
   engineered remakes (matthewcpp/RodentsRevenge C89 and
   endemic/revenge JS) and original gameplay footage.
   See docs/COMPARISON.md and FAITHFULNESS.md.
   ============================================================ */
'use strict';

/* ---------- Board constants (original: 23x23 tiles) ---------- */
const N = 23, TILE = 36, W = N * TILE, H = N * TILE;

/* Windows 16-colour VGA palette, as used by the original */
const PAL = {
  olive:  '#808000', teal:  '#008080', cyan:  '#00ffff', silver: '#c0c0c0',
  gray:   '#808080', green: '#008000', lime:  '#00ff00', yellow: '#ffff00',
  white:  '#ffffff', black: '#000000', blue:  '#0000ff', red:    '#ff0000',
  navy:   '#000080', maroon:'#800000'
};

/* Grid cell types (mirrors the original's entity-in-grid model) */
const T = { EMPTY: 0, WALL: 1, BLOCK: 2, CHEESE: 3, HOLE: 4, TRAP: 5, CAT: 6, MOUSE: 7, YARN: 8 };

/* Original timing constants (ms) — from the reference engine */
const CAT_TICK          = 1000;   // enemy update frequency
const HOLE_STUCK_TIME   = 10000;  // sink hole
const YARN_WAIT_MIN     = 1000;   // yarn idle after spawning
const YARN_WAIT_MAX     = 5000;
const YARN_MOVE_TIME    = 100;    // yarn speed
const CLOCK_SECOND      = 1000;   // stopwatch: one position per second
const CLOCK_POSITIONS   = 30;     // positions on the dial
const WIND_SPEED        = 100;    // clock winds at 100x after a round clear
const DEATH_FRAMES      = 5;
const DEATH_FRAME_TIME  = 180;
const INPUT_REPEAT_DELAY = 350;   // OS-keyboard-repeat emulation (adapted for web)
const INPUT_REPEAT_RATE  = 100;

/* The 8 cat spawn points: corners + edge midpoints of the board */
const SPAWN_POINTS = [
  { x: 1, y: 1 }, { x: 21, y: 1 }, { x: 21, y: 21 }, { x: 1, y: 21 },
  { x: 11, y: 1 }, { x: 21, y: 11 }, { x: 11, y: 21 }, { x: 1, y: 11 }
];
const START_POS = { x: 11, y: 11 };

const $ = (id) => document.getElementById(id);
const cv = $('game');
const ctx = cv.getContext('2d');

/* ---------- Audio: PC-speaker-style beeps (recreated) ---------- */
const Sfx = {
  ac: null,
  muted: localStorage.getItem('rr_muted') === '1',
  ensure() {
    if (!this.ac) { try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (this.ac && this.ac.state === 'suspended') this.ac.resume();
  },
  beep(f0, f1, dur, type = 'square', vol = 0.08) {
    if (this.muted || !this.ac) return;
    const t = this.ac.currentTime;
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.ac.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },
  push()    { this.beep(110, 70, 0.10, 'square', 0.10); },
  blocked() { this.beep(60, 55, 0.05, 'square', 0.05); },
  cheese()  { this.beep(700, 1200, 0.09, 'square', 0.09); setTimeout(() => this.beep(900, 1500, 0.07, 'square', 0.08), 60); },
  pin()     { this.beep(500, 160, 0.22, 'square', 0.10); },
  death()   { this.beep(320, 50, 0.55, 'sawtooth', 0.14); },
  spawn()   { this.beep(160, 320, 0.12, 'square', 0.08); },
  hole()    { this.beep(240, 90, 0.3, 'triangle', 0.12); },
  boom()    { this.beep(90, 40, 0.25, 'sawtooth', 0.14); },
  clearJingle() { [392, 523, 659, 784].forEach((f, i) => setTimeout(() => this.beep(f, f, 0.12, 'square', 0.09), i * 100)); },
  ui()      { this.beep(440, 440, 0.04, 'square', 0.05); }
};

/* ---------- Game state ---------- */
const G = {
  state: 'unstarted',            // unstarted | playing | winding | paused | over
  grid: new Uint8Array(N * N),
  level: 1,
  score: 0,
  livesRemaining: 2,             // + current life = 3 total (original semantics)
  spawnCycle: [1], spawnIndex: 0,
  clockInterval: 5,
  yarnCfg: null,                 // [min,max] ms or null
  yarnTimer: 0,
  cats: [],                      // {x,y,status:'active'|'waiting'|'suspended'}
  yarns: [],
  player: { x: 11, y: 11, status: 'active', stuckTime: 0, deathT: 0, killer: null },
  clock: { acc: 0, seconds: 0, minutes: 0, target: 5 },
  catAcc: 0,
  heldDirs: [],                  // stack of held directions
  lastMoveAt: 0,
  best: parseInt(localStorage.getItem('rr_high') || '0', 10) || 0
};

const idx = (x, y) => y * N + x;
const inB = (x, y) => x >= 0 && x < N && y >= 0 && y < N;
const at = (x, y) => G.grid[idx(x, y)];
const setCell = (x, y, t) => { G.grid[idx(x, y)] = t; };
const catAt = (x, y) => G.cats.find(c => c.x === x && c.y === y && c.status !== 'killed');

/* ---------- Level loading ---------- */
function loadLevel(n) {
  const def = rrLoadLevel(n);
  G.level = n;
  G.grid.fill(T.EMPTY);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const ch = def.grid[idx(x, y)];
      G.grid[idx(x, y)] =
        ch === 'W' ? T.WALL : ch === 'B' ? T.BLOCK : ch === 'H' ? T.HOLE :
        ch === 'T' ? T.TRAP : ch === 'C' ? T.CHEESE : T.EMPTY;
    }
  }
  G.clockInterval = def.clock != null ? def.clock : 5;
  G.spawnCycle = (def.spawn && def.spawn.length) ? def.spawn : [1];
  G.spawnIndex = 0;
  G.yarnCfg = def.yarn ? [def.yarn[0] * 1000, def.yarn[1] * 1000] : null;
  G.yarnTimer = G.yarnCfg ? G.yarnCfg[0] : 0;
  G.cats = [];
  G.yarns = [];
  G.clock = { acc: 0, seconds: 0, minutes: 0, target: G.clockInterval };
  G.catAcc = 0;
  placePlayer();
  spawnBatch();                                   // the original spawns the first batch at level start
  updateChrome();
}

function placePlayer() {
  // original respawn: centre cell; a static entity there is destroyed,
  // otherwise fall back to a free border spawn point
  let pos = { ...START_POS };
  const ent = at(pos.x, pos.y);
  if (ent === T.CAT || ent === T.YARN) {
    const p = freeSpawnPoint();
    if (p) pos = p;
  } else if (ent !== T.EMPTY) {
    setCell(pos.x, pos.y, T.EMPTY);               // static entity destroyed
  }
  G.player = { x: pos.x, y: pos.y, status: 'active', stuckTime: 0, deathT: 0, killer: null };
  setCell(pos.x, pos.y, T.MOUSE);
}

function freeSpawnPoint() {
  const order = SPAWN_POINTS.slice().sort(() => Math.random() - 0.5);
  for (const p of order) if (at(p.x, p.y) === T.EMPTY) return { ...p };
  return null;
}

function spawnBatch() {
  const count = G.spawnCycle[G.spawnIndex % G.spawnCycle.length];
  G.spawnIndex++;
  let spawned = 0;
  for (let i = 0; i < count; i++) {
    const p = freeSpawnPoint();
    if (!p) break;                                // all spawn points blocked: deferred
    G.cats.push({ x: p.x, y: p.y, status: 'active' });
    setCell(p.x, p.y, T.CAT);
    spawned++;
  }
  if (spawned) Sfx.spawn();
  updateChrome();
}

/* ---------- Clock (the original's 30-position stopwatch) ---------- */
function clockTick(mult, dt) {
  G.clock.acc += dt * mult;
  while (G.clock.acc >= CLOCK_SECOND) {
    G.clock.acc -= CLOCK_SECOND;
    G.clock.seconds++;
    if (G.clock.seconds >= CLOCK_POSITIONS) {
      G.clock.seconds = 0;
      G.clock.minutes++;
      if (G.clock.minutes >= CLOCK_POSITIONS) G.clock.minutes = 0;
      onMinuteTick();
    }
    if (G.state === 'playing' && (G.clock.seconds === 14 || G.clock.seconds === 0)) {
      G.score += 1;                               // survival scoring, as in the original engine
      updateChrome();
    }
  }
}
function onMinuteTick() {
  if (G.clock.target === 0) return;
  if ((G.state === 'playing' || G.state === 'winding') && G.clock.minutes === G.clock.target) {
    G.clock.target = advanceTarget(G.clock.target);
    spawnBatch();
    if (G.state === 'winding') G.state = 'playing';
    updateChrome();
  }
}
function advanceTarget(t) {
  if (t === 0) return 0;
  t += G.clockInterval;
  if (t >= CLOCK_POSITIONS) t -= CLOCK_POSITIONS;
  return t;
}

/* ---------- Cat AI (original: greedy 8-directional chase) ---------- */
const DELTAS8 = [
  { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
  { x: -1, y: 0 },                   { x: 1, y: 0 },
  { x: -1, y: 1 },  { x: 0, y: 1 },  { x: 1, y: 1 }
];

function catTick() {
  for (const c of G.cats) {
    if (c.status !== 'active' && c.status !== 'waiting') continue;
    catMove(c);
  }
  // round clear: every spawned cat is pinned simultaneously
  if (G.cats.length > 0 && G.cats.every(c => c.status === 'waiting')) {
    roundClear();
  }
}

function catMove(c) {
  let best = null, bestDist = Infinity;
  const p = G.player;
  for (const d of DELTAS8) {
    const nx = c.x + d.x, ny = c.y + d.y;
    if (!inB(nx, ny)) continue;
    if (nx === p.x && ny === p.y && (p.status === 'active' || p.status === 'stuck')) {
      // the cat reaches the mouse
      setCell(c.x, c.y, T.EMPTY);
      c.status = 'suspended';
      killPlayer(c);
      return;
    }
    if (at(nx, ny) !== T.EMPTY) continue;         // walls, blocks, cheese, holes, traps, cats: all block
    const dist = (nx - p.x) * (nx - p.x) + (ny - p.y) * (ny - p.y);
    if (dist < bestDist) { bestDist = dist; best = { x: nx, y: ny }; }
  }
  if (!best) {
    c.status = 'waiting';                         // pinned on all 8 sides
    return;
  }
  setCell(c.x, c.y, T.EMPTY);
  c.x = best.x; c.y = best.y;
  c.status = 'active';
  setCell(c.x, c.y, T.CAT);
}

function roundClear() {
  for (const c of G.cats) {
    setCell(c.x, c.y, T.CHEESE);                  // each pinned cat becomes cheese
    G.score += 1;
  }
  G.cats = [];
  Sfx.clearJingle();
  if (G.clock.target !== 0) {
    G.state = 'winding';                          // the clock visibly winds to the next spawn
  } else {
    nextLevel();
  }
  updateChrome();
}

function nextLevel() {
  loadLevel(G.level + 1);                         // level 51, 52, ... continue indefinitely
  G.state = 'playing';
  updateChrome();
}

/* ---------- Player ---------- */
function tryMove(dx, dy) {
  const p = G.player;
  if (G.state !== 'playing' || p.status !== 'active') return;
  const nx = p.x + dx, ny = p.y + dy;
  if (!inB(nx, ny)) return;
  const t = at(nx, ny);
  switch (t) {
    case T.EMPTY:
      stepTo(nx, ny);
      break;
    case T.BLOCK:
      push(nx, ny, dx, dy);
      break;
    case T.WALL:
    case T.YARN:
      Sfx.blocked();
      break;
    case T.CAT: {
      const c = catAt(nx, ny);
      setCell(nx, ny, T.EMPTY);
      c.status = 'suspended';
      stepTo(nx, ny);
      killPlayer(c);
      break;
    }
    case T.CHEESE:
      setCell(nx, ny, T.EMPTY);
      G.score += 100;                             // eating cheese, as in the original
      Sfx.cheese();
      stepTo(nx, ny);
      updateChrome();
      break;
    case T.HOLE:
      setCell(nx, ny, T.EMPTY);                   // the hole is consumed
      stepTo(nx, ny);
      p.status = 'stuck';
      p.stuckTime = HOLE_STUCK_TIME;
      Sfx.hole();
      break;
    case T.TRAP:
      setCell(nx, ny, T.EMPTY);                   // the trap is consumed
      stepTo(nx, ny);
      killPlayer(null);
      break;
  }
  updateChrome();
}

function stepTo(nx, ny) {
  const p = G.player;
  setCell(p.x, p.y, T.EMPTY);
  p.x = nx; p.y = ny;
  setCell(nx, ny, T.MOUSE);
}

/* Original push: chains of blocks slide one cell; the chain's end determines
   whether the push is legal. */
function push(tx, ty, dx, dy) {
  let ex = tx, ey = ty;
  while (at(ex, ey) === T.BLOCK) { ex += dx; ey += dy; }
  const end = at(ex, ey);
  if (!inB(ex, ey) || end === T.WALL || end === T.TRAP || end === T.YARN) {
    Sfx.blocked();
    return;
  }
  if (end === T.CAT) {
    const c = catAt(ex, ey);
    setCell(ex, ey, T.EMPTY);
    catMove(c);                                   // the cat tries to flee; if pinned the push fails
    if (c.status === 'waiting') {
      setCell(ex, ey, T.CAT);                     // it never left the cell
      Sfx.blocked();
      return;
    }
  } else if (end === T.CHEESE) {
    setCell(ex, ey, T.EMPTY);                     // blocks pushed over cheese destroy it
  } else if (end === T.HOLE) {
    ex -= dx; ey -= dy;                           // the last block falls in; the hole stays
    setCell(ex, ey, T.EMPTY);
  }
  // slide the chain one cell toward the end
  let cx = ex, cy = ey;
  while (cx !== tx || cy !== ty) {
    const sx = cx - dx, sy = cy - dy;
    const e = at(sx, sy);
    setCell(sx, sy, T.EMPTY);
    setCell(cx, cy, e);
    cx = sx; cy = sy;
  }
  stepTo(tx, ty);
  Sfx.push();
}

function killPlayer(killer) {
  const p = G.player;
  p.status = 'dying';
  p.deathT = performance.now();
  p.killer = killer;
  setCell(p.x, p.y, T.EMPTY);
  Sfx.death();
}

function afterDeath() {
  const p = G.player;
  if (p.killer) {
    // the killer cat takes the mouse's place
    setCell(p.x, p.y, T.CAT);
    G.cats.push({ x: p.x, y: p.y, status: 'active' });
    p.killer = null;
  }
  G.livesRemaining--;
  if (G.livesRemaining >= 0) {
    placePlayer();
  } else {
    gameOver();
  }
  updateChrome();
}

function gameOver() {
  G.state = 'over';
  saveHighScore();
  $('overScore').textContent = G.score;
  $('overLevel').textContent = G.level;
  $('overBest').textContent = G.best;
  openDialog('dlgOver');
  updateChrome();
}

function saveHighScore() {
  if (G.score <= 0) return;
  if (G.score > G.best) {
    G.best = G.score;
    localStorage.setItem('rr_high', String(G.best));
  }
  try {
    const list = JSON.parse(localStorage.getItem('rr_scores') || '[]');
    list.push({ score: G.score, level: G.level, date: new Date().toISOString().slice(0, 10) });
    list.sort((a, b) => b.score - a.score);
    localStorage.setItem('rr_scores', JSON.stringify(list.slice(0, 10)));
  } catch (e) {}
}

/* ---------- Yarn balls (original behaviour) ---------- */
function spawnYarn() {
  if (G.yarns.filter(y => y.status !== 'killed').length >= 2) return;
  const cand = [];
  for (let x = 1; x < N - 1; x++) { cand.push({ x, y: 0, side: 'h' }); cand.push({ x, y: N - 1, side: 'h' }); }
  for (let y = 1; y < N - 1; y++) { cand.push({ x: 0, y, side: 'v' }); cand.push({ x: N - 1, y, side: 'v' }); }
  for (let tries = 0; tries < 50; tries++) {
    const c = cand[Math.floor(Math.random() * cand.length)];
    if (at(c.x, c.y) !== T.WALL) continue;
    const dy = c.side === 'h' ? (c.y === 0 ? 1 : -1) : [-1, 0, 1][Math.floor(Math.random() * 3)];
    const dx = c.side === 'h' ? [-1, 0, 1][Math.floor(Math.random() * 3)] : (c.x === 0 ? 1 : -1);
    setCell(c.x, c.y, T.YARN);                    // spawns on the wall cell
    G.yarns.push({
      x: c.x, y: c.y, dx, dy,
      status: 'waiting',
      statusTime: YARN_WAIT_MIN + Math.floor(Math.random() * (YARN_WAIT_MAX - YARN_WAIT_MIN)),
      moveCount: 0, suspX: 0, suspY: 0, deathT: 0
    });
    return;
  }
}

function yarnUpdate(g, dt) {
  g.statusTime -= dt;
  switch (g.status) {
    case 'waiting':
      if (g.statusTime <= 0) { g.status = 'active'; g.statusTime = YARN_MOVE_TIME; }
      break;
    case 'active': {
      if (g.statusTime > 0) return;
      const nx = g.x + g.dx, ny = g.y + g.dy;
      const t = inB(nx, ny) ? at(nx, ny) : T.WALL;
      const behind = g.moveCount === 0 ? T.WALL : T.EMPTY;
      if (t === T.EMPTY) {
        setCell(g.x, g.y, behind);                // restores the wall it spawned on
        g.x = nx; g.y = ny;
        setCell(nx, ny, T.YARN);
        g.moveCount++;
      } else if (t === T.MOUSE && G.player.status !== 'dying' && G.player.status !== 'killed') {
        setCell(g.x, g.y, behind);
        g.status = 'killed';
        killPlayer(null);
      } else if (t === T.HOLE) {
        g.status = 'killed';                      // falls into the hole
        Sfx.boom();
      } else if (t === T.CAT) {
        g.suspX = nx; g.suspY = ny;
        setCell(g.x, g.y, behind);
        g.status = 'suspended';
        g.statusTime = 0;
      } else {
        g.status = 'dying';                       // explodes on walls, blocks, traps, cheese
        g.deathT = performance.now();
        Sfx.boom();
      }
      g.statusTime = YARN_MOVE_TIME;
      break;
    }
    case 'dying':
      if (performance.now() - g.deathT > 450) g.status = 'killed';
      break;
    case 'suspended': {
      const occ = at(g.suspX, g.suspY);
      if (occ === T.EMPTY) {
        g.x = g.suspX; g.y = g.suspY;
        setCell(g.x, g.y, T.YARN);
        g.status = 'active';
        g.statusTime = YARN_MOVE_TIME;
        return;
      }
      if (g.statusTime >= YARN_MOVE_TIME) {
        const tx = g.suspX + g.dx, ty = g.suspY + g.dy;
        const tt = inB(tx, ty) ? at(tx, ty) : T.WALL;
        if (tt === T.EMPTY || tt === T.CAT) { g.suspX = tx; g.suspY = ty; }
        else { g.status = 'dying'; g.deathT = performance.now(); }
        g.statusTime = 0;
      }
      break;
    }
  }
}

function cleanupYarns() {
  for (let i = G.yarns.length - 1; i >= 0; i--) {
    const g = G.yarns[i];
    if (g.status === 'killed') {
      if (at(g.x, g.y) === T.YARN) setCell(g.x, g.y, T.EMPTY);
      G.yarns.splice(i, 1);
      if (G.yarnCfg) G.yarnTimer = G.yarnCfg[0] + Math.floor(Math.random() * (G.yarnCfg[1] - G.yarnCfg[0]));
    }
  }
}

/* ---------- Main loop ---------- */
let lastT = 0;
function frame(t) {
  const dt = Math.min(60, t - lastT || 16);
  lastT = t;
  if (G.state === 'playing') {
    clockTick(1, dt);
    G.catAcc += dt;
    while (G.catAcc >= CAT_TICK && G.state === 'playing') { G.catAcc -= CAT_TICK; catTick(); }
    for (const g of G.yarns) yarnUpdate(g, dt);
    cleanupYarns();
    if (G.yarnCfg) {
      const alive = G.yarns.filter(y => y.status !== 'killed').length;
      if (alive < 2) {
        G.yarnTimer -= dt;
        if (G.yarnTimer <= 0) {
          spawnYarn();
          G.yarnTimer = G.yarnCfg[0] + Math.floor(Math.random() * (G.yarnCfg[1] - G.yarnCfg[0]));
        }
      }
    }
    handleHeldInput(t);
    const p = G.player;
    if (p.status === 'stuck') {
      p.stuckTime -= dt;
      if (p.stuckTime <= 0) p.status = 'active';
    } else if (p.status === 'dying') {
      if (t - p.deathT > DEATH_FRAMES * DEATH_FRAME_TIME) afterDeath();
    }
  } else if (G.state === 'winding') {
    clockTick(WIND_SPEED, dt);
  }
  draw(t);
  requestAnimationFrame(frame);
}

/* ---------- Input ---------- */
const DIRS = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
};
const KEYMAP = {
  arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down',
  arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right'
};

document.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (KEYMAP[k] || k === ' ') e.preventDefault();
  Sfx.ensure();
  if (k === 'm') { toggleSound(); return; }
  if (G.state === 'unstarted' || G.state === 'over') {
    if (k === ' ' || k === 'enter') newGame();
    return;
  }
  if (k === 'p' || k === 'escape' || k === ' ') { togglePause(); return; }
  const dir = KEYMAP[k];
  if (!dir || G.state !== 'playing') return;
  if (!e.repeat) {
    G.heldDirs = G.heldDirs.filter(d => d !== dir);
    G.heldDirs.push(dir);
    tryMove(DIRS[dir].x, DIRS[dir].y);
    G.lastMoveAt = performance.now();
  }
});
document.addEventListener('keyup', (e) => {
  const dir = KEYMAP[e.key.toLowerCase()];
  if (dir) G.heldDirs = G.heldDirs.filter(d => d !== dir);
});

function handleHeldInput(t) {
  if (!G.heldDirs.length) return;
  if (t - G.lastMoveAt >= INPUT_REPEAT_DELAY) {
    const dir = G.heldDirs[G.heldDirs.length - 1];
    tryMove(DIRS[dir].x, DIRS[dir].y);
    G.lastMoveAt = t - (INPUT_REPEAT_DELAY - INPUT_REPEAT_RATE);
  }
}

/* D-pad + swipe */
let swipe = null;
cv.addEventListener('pointerdown', (e) => {
  Sfx.ensure();
  if (G.state === 'unstarted' || G.state === 'over') return;
  swipe = { x: e.clientX, y: e.clientY, done: false };
});
cv.addEventListener('pointermove', (e) => {
  if (!swipe || swipe.done || G.state !== 'playing') return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
  swipe.done = true;
  if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? 1 : -1, 0);
  else tryMove(0, dy > 0 ? 1 : -1);
});
cv.addEventListener('pointerup', () => { swipe = null; });

document.querySelectorAll('.pad-btn').forEach(btn => {
  let rep = null;
  const dir = btn.dataset.dir;
  const fire = () => { if (G.state === 'playing') tryMove(DIRS[dir].x, DIRS[dir].y); };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault(); Sfx.ensure();
    if (G.state === 'unstarted' || G.state === 'over') return;
    fire();
    clearInterval(rep);
    rep = setInterval(fire, INPUT_REPEAT_RATE + 50);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => btn.addEventListener(ev, () => clearInterval(rep)));
});

/* ---------- Flow / chrome ---------- */
function newGame() {
  Sfx.ensure(); Sfx.ui();
  G.score = 0;
  G.livesRemaining = 2;
  closeDialogs();
  loadLevel(G.level);
  G.state = 'playing';
  updateChrome();
}
function startAtLevel(n) {
  G.level = Math.max(1, Math.min(50, n));
  newGame();
}
function togglePause() {
  if (G.state === 'playing') G.state = 'paused';
  else if (G.state === 'paused') G.state = 'playing';
  updateChrome();
  Sfx.ui();
}
function toggleSound() {
  Sfx.muted = !Sfx.muted;
  localStorage.setItem('rr_muted', Sfx.muted ? '1' : '0');
  syncMenus();
}
function updateChrome() {
  $('titleText').textContent = 'Rodent\'s Revenge [' + G.level + ']';
  $('scoreVal').textContent = G.score;
  $('startBanner').classList.toggle('hidden', G.state !== 'unstarted');
  const lv = $('livesBox');
  lv.innerHTML = '';
  for (let i = 0; i < Math.max(0, G.livesRemaining); i++) {
    const c = document.createElement('canvas');
    c.width = 18; c.height = 14;
    drawMouseIcon(c.getContext('2d'));
    lv.appendChild(c);
  }
  syncMenus();
}
function syncMenus() {
  $('miSound').textContent = (Sfx.muted ? '\u2610 ' : '\u2611 ') + 'Sound';
  $('miPause').textContent = G.state === 'paused' ? 'Resume' : 'Pause';
}

/* ---------- Menus / dialogs (Win 3.1 style) ---------- */
function closeMenus() {
  document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
}
document.querySelectorAll('.menu-item').forEach(mi => {
  mi.addEventListener('click', (e) => {
    e.stopPropagation();
    const dd = mi.parentElement.querySelector('.dropdown');
    const was = dd.classList.contains('open');
    closeMenus();
    if (!was) dd.classList.add('open');
    Sfx.ensure(); Sfx.ui();
  });
});
document.addEventListener('click', () => closeMenus());

let dialogResume = null;
function openDialog(id) {
  closeDialogs();
  closeMenus();
  if (G.state === 'playing') dialogResume = 'playing';
  if (G.state === 'playing') G.state = 'paused';
  $('dialogs').classList.remove('hidden');
  $(id).classList.remove('hidden');
}
function closeDialogs() {
  $('dialogs').classList.add('hidden');
  document.querySelectorAll('.win-dialog').forEach(d => d.classList.add('hidden'));
  if (dialogResume === 'playing' && G.state === 'paused') G.state = 'playing';
  dialogResume = null;
}

$('miNew').addEventListener('click', () => { closeMenus(); newGame(); });
$('miLevel').addEventListener('click', () => { closeMenus(); buildLevelPicker(); openDialog('dlgLevel'); });
$('miPause').addEventListener('click', () => { closeMenus(); togglePause(); });
$('miSound').addEventListener('click', () => { closeMenus(); toggleSound(); });
$('miFull').addEventListener('click', () => {
  closeMenus();
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
});
$('miHow').addEventListener('click', () => { closeMenus(); openDialog('dlgHow'); });
$('miAbout').addEventListener('click', () => { closeMenus(); openDialog('dlgAbout'); });
$('miScores').addEventListener('click', () => { closeMenus(); buildScoreList(); openDialog('dlgScores'); });

function buildLevelPicker() {
  const box = $('levelGrid');
  box.innerHTML = '';
  for (let i = 1; i <= 50; i++) {
    const b = document.createElement('button');
    b.className = 'lvl-cell';
    b.textContent = i;
    b.addEventListener('click', () => { closeDialogs(); startAtLevel(i); });
    box.appendChild(b);
  }
}
function buildScoreList() {
  const box = $('scoreList');
  box.innerHTML = '';
  let list = [];
  try { list = JSON.parse(localStorage.getItem('rr_scores') || '[]'); } catch (e) {}
  if (!list.length) {
    box.innerHTML = '<div class="score-row muted">No games scored yet.</div>';
    return;
  }
  list.forEach((s, i) => {
    const d = document.createElement('div');
    d.className = 'score-row';
    d.innerHTML = '<span>' + (i + 1) + '.</span><span>' + s.score + '</span><span>Lvl ' + s.level + '</span><span>' + s.date + '</span>';
    box.appendChild(d);
  });
}

$('btnOverOk').addEventListener('click', () => {
  closeDialogs();
  G.state = 'unstarted';
  loadLevel(G.level);
  updateChrome();
});
$('dlgStartBtn').addEventListener('click', () => newGame());
document.querySelectorAll('.dlg-close').forEach(b => b.addEventListener('click', closeDialogs));
$('startBanner').addEventListener('click', (e) => {
  if (G.state === 'unstarted') newGame();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.state === 'playing') { G.state = 'paused'; updateChrome(); }
});

/* Touch detection */
if ('ontouchstart' in window || navigator.maxTouchPoints > 0 || new URLSearchParams(location.search).has('touch')) {
  document.body.classList.add('touch');
}

/* ============================================================
   RENDERING — Windows 16-colour VGA sprites, hand-recreated to
   match original gameplay footage (docs/COMPARISON.md).
   ============================================================ */
function draw(t) {
  ctx.fillStyle = PAL.olive;
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const px = x * TILE, py = y * TILE;
      const tile = G.grid[idx(x, y)];
      if (tile === T.WALL) drawWall(px, py);
      else if (tile === T.BLOCK) drawBlock(px, py);
      else if (tile === T.HOLE) drawHole(px, py);
      else if (tile === T.TRAP) drawTrap(px, py);
      else if (tile === T.CHEESE) drawCheese(px, py);
    }
  }
  for (const c of G.cats) drawCat(c, t);
  for (const g of G.yarns) if (g.status !== 'killed') drawYarn(g, t);
  if (G.player.status !== 'killed') drawPlayer(t);
  drawStopwatch();
}

/* Wall tile: teal brick with a bright cyan stepped-pyramid motif */
function drawWall(px, py) {
  ctx.fillStyle = PAL.teal;
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = PAL.black;
  ctx.fillRect(px, py, TILE, 1); ctx.fillRect(px, py, 1, TILE);
  const cx = px + TILE / 2, cy = py + TILE / 2;
  ctx.fillStyle = PAL.cyan;
  for (let i = 0; i < 3; i++) {
    const half = (TILE / 2 - 3) - i * 6;
    ctx.fillRect(cx - half, cy - half, half * 2, 2);
    ctx.fillRect(cx - half, cy - half, 2, half * 2);
    ctx.fillRect(cx - half, cy + half - 2, half * 2, 2);
    ctx.fillRect(cx + half - 2, cy - half, 2, half * 2);
  }
  ctx.fillStyle = PAL.silver;
  ctx.fillRect(cx - 3, cy - 3, 6, 6);
  ctx.fillStyle = PAL.teal;
  ctx.fillRect(cx - 1, cy - 1, 2, 2);
}

/* Movable block: green tile with lime bevel + inset ring + drop shadow */
function drawBlock(px, py) {
  ctx.fillStyle = PAL.gray;
  ctx.fillRect(px + 3, py + 3, TILE - 3, TILE - 3);
  ctx.fillStyle = PAL.green;
  ctx.fillRect(px + 1, py + 1, TILE - 4, TILE - 4);
  ctx.fillStyle = PAL.lime;
  ctx.fillRect(px + 1, py + 1, TILE - 4, 3);
  ctx.fillRect(px + 1, py + 1, 3, TILE - 4);
  ctx.fillStyle = PAL.teal;
  ctx.fillRect(px + TILE - 6, py + 4, 3, TILE - 7);
  ctx.strokeStyle = PAL.black;
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 5.5, py + 5.5, TILE - 13, TILE - 13);
  ctx.fillStyle = PAL.lime;
  const m = 10;
  ctx.fillRect(px + m, py + m, 4, 4);
  ctx.fillRect(px + TILE - m - 4, py + m, 4, 4);
  ctx.fillRect(px + m, py + TILE - m - 4, 4, 4);
  ctx.fillRect(px + TILE - m - 4, py + TILE - m - 4, 4, 4);
}

function drawHole(px, py) {
  ctx.fillStyle = PAL.black;
  ctx.beginPath();
  ctx.ellipse(px + TILE / 2, py + TILE / 2, 13, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PAL.gray;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawTrap(px, py) {
  ctx.fillStyle = PAL.gray;
  ctx.fillRect(px + 4, py + 12, TILE - 8, TILE - 18);
  ctx.fillStyle = PAL.silver;
  ctx.fillRect(px + 4, py + 12, TILE - 8, 3);
  ctx.strokeStyle = PAL.black;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px + TILE / 2, py + TILE / 2 + 2, 10, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(px + TILE / 2 - 10, py + TILE / 2 + 2);
  ctx.lineTo(px + TILE / 2 + 10, py + TILE / 2 + 2);
  ctx.stroke();
}

function drawCheese(px, py) {
  ctx.fillStyle = PAL.black;
  ctx.beginPath();
  ctx.moveTo(px + 5, py + 26); ctx.lineTo(px + 29, py + 26); ctx.lineTo(px + 29, py + 12);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.yellow;
  ctx.beginPath();
  ctx.moveTo(px + 6, py + 25); ctx.lineTo(px + 28, py + 25); ctx.lineTo(px + 28, py + 13);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.white;
  ctx.fillRect(px + 24, py + 14, 4, 10);
  ctx.fillStyle = PAL.olive;
  ctx.beginPath(); ctx.arc(px + 17, py + 21, 2, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(px + 12, py + 23, 1.5, 0, 7); ctx.fill();
}

function drawYarn(g, t) {
  const px = g.x * TILE, py = g.y * TILE;
  if (g.status === 'waiting' && Math.floor(t / 120) % 2 === 0) return;   // idle blink
  if (g.status === 'dying') {
    const f = Math.floor((performance.now() - g.deathT) / 150);
    ctx.strokeStyle = PAL.blue;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(px + TILE / 2, py + TILE / 2, 6 + f * 6, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = PAL.blue;
  ctx.beginPath();
  ctx.arc(px + TILE / 2, py + TILE / 2, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PAL.cyan;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px + TILE / 2, py + TILE / 2, 8, t / 200, t / 200 + 3.6);
  ctx.stroke();
  ctx.fillStyle = PAL.white;
  ctx.fillRect(px + TILE / 2 - 5, py + TILE / 2 - 6, 3, 3);
}

/* Cat sprite: yellow body, black outline, gray spots — 2-frame walk */
function drawCat(c, t) {
  const px = c.x * TILE, py = c.y * TILE;
  const f = Math.floor(t / 300) % 2;
  const waiting = c.status === 'waiting';
  ctx.save();
  if (waiting) {
    ctx.translate(px + TILE / 2, py + TILE / 2);
    ctx.scale(1, 0.88);
    ctx.translate(-(px + TILE / 2), -(py + TILE / 2) - 2);
  }
  const X = px, Y = py;
  ctx.fillStyle = PAL.black;
  ctx.fillRect(X + 6, Y + 8, 22, 20);
  ctx.fillStyle = PAL.yellow;
  ctx.fillRect(X + 7, Y + 9, 20, 18);
  ctx.fillStyle = PAL.black;
  ctx.fillRect(X + 5, Y + 4, 24, 12);
  ctx.beginPath(); ctx.moveTo(X + 6, Y + 6); ctx.lineTo(X + 10, Y); ctx.lineTo(X + 13, Y + 6); ctx.fill();
  ctx.beginPath(); ctx.moveTo(X + 19, Y + 6); ctx.lineTo(X + 23, Y); ctx.lineTo(X + 26, Y + 6); ctx.fill();
  ctx.fillStyle = PAL.yellow;
  ctx.fillRect(X + 6, Y + 5, 22, 10);
  ctx.fillStyle = PAL.gray;
  ctx.fillRect(X + 9, Y + 12, 4, 3);
  ctx.fillRect(X + 20, Y + 16, 5, 3);
  const dx = Math.sign(G.player.x - c.x), dy = Math.sign(G.player.y - c.y);
  ctx.fillStyle = waiting ? PAL.red : PAL.black;
  ctx.fillRect(X + 10 + dx, Y + 8 + dy, 3, waiting ? 5 : 3);
  ctx.fillRect(X + 19 + dx, Y + 8 + dy, 3, waiting ? 5 : 3);
  ctx.fillStyle = PAL.black;
  ctx.fillRect(X + 2, Y + 14, 4, 1);
  ctx.fillRect(X + 26, Y + 14, 4, 1);
  ctx.fillRect(X + 8 + f * 2, Y + 27, 4, 3);
  ctx.fillRect(X + 20 - f * 2, Y + 27, 4, 3);
  ctx.strokeStyle = PAL.black;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(X + 27, Y + 22);
  ctx.quadraticCurveTo(X + 33, Y + 20 + (f ? 3 : -2), X + 31, Y + 12);
  ctx.stroke();
  ctx.restore();
}

/* Mouse sprite: silver body, black outline, gray shading */
function drawPlayer(t) {
  const p = G.player;
  const px = p.x * TILE, py = p.y * TILE;
  let scale = 1, sink = 0, alpha = 1;
  if (p.status === 'stuck') { sink = 7; alpha = 0.75; }
  if (p.status === 'dying') {
    const f = Math.floor((performance.now() - p.deathT) / DEATH_FRAME_TIME);
    alpha = (f % 2 === 0) ? 1 : 0.25;
    scale = Math.max(0.25, 1 - f * 0.18);
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(px + TILE / 2, py + TILE / 2 - sink);
  ctx.scale(scale, scale);
  ctx.translate(-TILE / 2, -TILE / 2);
  const X = 0, Y = 0;                            // local tile coordinates
  ctx.strokeStyle = PAL.black;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(X + 24, Y + 26);
  ctx.quadraticCurveTo(X + 32, Y + 24, X + 30, Y + 14);
  ctx.stroke();
  ctx.fillStyle = PAL.black;
  ctx.beginPath(); ctx.arc(X + 11, Y + 11, 6, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(X + 21, Y + 11, 6, 0, 7); ctx.fill();
  ctx.fillStyle = PAL.silver;
  ctx.beginPath(); ctx.arc(X + 11, Y + 11, 4, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(X + 21, Y + 11, 4, 0, 7); ctx.fill();
  ctx.fillStyle = PAL.black;
  ctx.fillRect(X + 6, Y + 13, 20, 15);
  ctx.fillStyle = PAL.silver;
  ctx.fillRect(X + 7, Y + 14, 18, 13);
  ctx.fillStyle = PAL.gray;
  ctx.fillRect(X + 7, Y + 23, 18, 4);
  ctx.fillStyle = PAL.black;
  ctx.fillRect(X + 11, Y + 16, 2, 3);
  ctx.fillRect(X + 19, Y + 16, 2, 3);
  ctx.fillRect(X + 14, Y + 20, 4, 2);
  ctx.fillRect(X + 4, Y + 20, 6, 1);
  ctx.fillRect(X + 22, Y + 20, 6, 1);
  ctx.restore();
}

function drawMouseIcon(c) {
  c.fillStyle = PAL.black;
  c.beginPath(); c.arc(5, 5, 3.4, 0, 7); c.fill();
  c.beginPath(); c.arc(12, 5, 3.4, 0, 7); c.fill();
  c.fillStyle = PAL.silver;
  c.beginPath(); c.arc(5, 5, 2.2, 0, 7); c.fill();
  c.beginPath(); c.arc(12, 5, 2.2, 0, 7); c.fill();
  c.fillStyle = PAL.black;
  c.fillRect(3, 7, 11, 6);
  c.fillStyle = PAL.silver;
  c.fillRect(4, 8, 9, 4);
}

/* The stopwatch from the original status bar: white face, red marks,
   blue second hand and the blue target line. */
function drawStopwatch() {
  const c = $('clockCv');
  const g = c.getContext('2d');
  const S = c.width;
  g.clearRect(0, 0, S, S);
  const cx = S / 2, cy = S / 2 + 2, R = S / 2 - 4;
  g.fillStyle = PAL.gray;
  g.beginPath(); g.arc(cx, cy, R + 3, 0, 7); g.fill();
  g.fillStyle = PAL.silver;
  g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
  g.fillRect(cx - 4, 0, 8, 5);
  g.fillStyle = PAL.white;
  g.beginPath(); g.arc(cx, cy, R - 3, 0, 7); g.fill();
  for (let i = 0; i < CLOCK_POSITIONS; i++) {
    const a = (i / CLOCK_POSITIONS) * Math.PI * 2 - Math.PI / 2;
    g.strokeStyle = PAL.red;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6));
    g.lineTo(cx + Math.cos(a) * (R - 2), cy + Math.sin(a) * (R - 2));
    g.stroke();
  }
  if (G.clock.target !== 0) {
    const a = (G.clock.target / CLOCK_POSITIONS) * Math.PI * 2 - Math.PI / 2;
    g.strokeStyle = PAL.blue;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * (R - 10), cy + Math.sin(a) * (R - 10));
    g.lineTo(cx + Math.cos(a) * (R - 2), cy + Math.sin(a) * (R - 2));
    g.stroke();
  }
  const secA = (G.clock.seconds / CLOCK_POSITIONS) * Math.PI * 2 - Math.PI / 2;
  g.strokeStyle = PAL.blue;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx + Math.cos(secA) * (R - 8), cy + Math.sin(secA) * (R - 8));
  g.stroke();
  const minA = (G.clock.minutes / CLOCK_POSITIONS) * Math.PI * 2 - Math.PI / 2;
  g.strokeStyle = PAL.black;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx + Math.cos(minA) * (R - 13), cy + Math.sin(minA) * (R - 13));
  g.stroke();
  g.fillStyle = PAL.black;
  g.beginPath(); g.arc(cx, cy, 2, 0, 7); g.fill();
}

/* ---------- Boot ---------- */
loadLevel(1);
G.state = 'unstarted';
updateChrome();
requestAnimationFrame(frame);
