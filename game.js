/* ============================================================
   RODENT'S REVENGE — fan reimplementation for Android (PWA)
   Original 1991 Windows game by Christopher Lee Fraley (Microsoft).
   This is a from-scratch tribute: no original code or assets.
   ============================================================ */
'use strict';

/* ---------- Constants ---------- */
const COLS = 24, ROWS = 16, CELL = 32;
const W = COLS * CELL, H = ROWS * CELL;

const EMPTY = 0, WALL = 1, BLOCK = 2, HOLE = 3, TRAP = 4;

const State = { TITLE: 0, PLAYING: 1, CLEAR: 2, DYING: 3, OVER: 4, PAUSED: 5 };

const idx = (x, y) => y * COLS + x;
const inB = (x, y) => x >= 0 && x < COLS && y >= 0 && y < ROWS;

/* ---------- Seeded RNG ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const cv = $('game');
const ctx = cv.getContext('2d');

/* ---------- Audio (tiny synth, no assets) ---------- */
const AudioSys = {
  ctx: null, muted: localStorage.getItem('rr_muted') === '1',
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { /* no audio */ }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  beep(f0, f1, dur, type = 'square', vol = 0.12) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },
  step()    { this.beep(220, 200, 0.05, 'square', 0.03); },
  push()    { this.beep(120, 80, 0.12, 'triangle', 0.16); },
  cheese()  { this.beep(880, 1320, 0.10, 'square', 0.10); },
  trapped() { this.beep(600, 180, 0.28, 'sawtooth', 0.14); },
  death()   { this.beep(300, 60, 0.5, 'sawtooth', 0.2); },
  clear()   { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.beep(f, f, 0.14, 'square', 0.11), i * 110)); },
  spawn()   { this.beep(150, 90, 0.2, 'square', 0.1); },
  ui()      { this.beep(500, 500, 0.05, 'square', 0.06); },
};

/* ---------- Game state ---------- */
const G = {
  state: State.TITLE,
  score: 0,
  best: parseInt(localStorage.getItem('rr_high') || '0', 10) || 0,
  lives: 3,
  level: 1,
  startLevel: 1,
  terrain: new Uint8Array(COLS * ROWS),
  cheese: new Set(),
  cats: [],
  yarns: [],
  mouse: { x: 0, y: 0, stuckUntil: 0 },
  catAcc: 0, catInterval: 430,
  yarnAcc: 0, yarnInterval: 300,
  clock: 0, spawnEvery: 28000,
  rng: Math.random,
  dieT: 0, clearT: 0,
  blinkT: 0,
  shake: 0,
};

/* ---------- Level generation ---------- */
function genLevel(lvl) {
  G.level = lvl;
  for (let attempt = 0; attempt < 24; attempt++) {
    G.rng = mulberry32(lvl * 7919 + attempt * 104729 + 17);
    if (tryGen(lvl)) return;
  }
  // last resort: simple open board
  G.rng = mulberry32(lvl * 7919 + 1);
  tryGen(lvl, true);
}

function tryGen(lvl, simple = false) {
  const T = G.terrain, rng = G.rng;
  T.fill(EMPTY);
  G.cheese.clear(); G.cats = []; G.yarns = [];

  // border walls
  for (let x = 0; x < COLS; x++) { T[idx(x, 0)] = WALL; T[idx(x, ROWS - 1)] = WALL; }
  for (let y = 0; y < ROWS; y++) { T[idx(0, y)] = WALL; T[idx(COLS - 1, y)] = WALL; }

  const mx = COLS >> 1, my = ROWS - 4;         // mouse spawn (bottom-centre)
  G.mouse = { x: mx, y: my, stuckUntil: 0 };

  const wallP = simple ? 0 : 0.045 + Math.min(0.055, lvl * 0.0035);
  const blockP = simple ? 0.14 : 0.10 + Math.min(0.045, lvl * 0.0028);

  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (Math.abs(x - mx) <= 1 && Math.abs(y - my) <= 1) continue;   // keep spawn clear
      const r = rng();
      if (r < wallP) T[idx(x, y)] = WALL;
      else if (r < wallP + blockP) T[idx(x, y)] = BLOCK;
    }
  }

  // cats: count grows with level
  const nCats = Math.min(2 + Math.ceil(lvl / 2), 9);
  const spots = [];
  for (let y = 1; y < ROWS - 1; y++)
    for (let x = 1; x < COLS - 1; x++)
      if (T[idx(x, y)] === EMPTY && (Math.abs(x - mx) + Math.abs(y - my)) >= 7) spots.push([x, y]);
  shuffle(spots, rng);
  for (let i = 0; i < nCats && spots.length; i++) {
    const [x, y] = spots.pop();
    G.cats.push({ x, y });
  }

  // hazards
  const nHoles = lvl >= 3 ? Math.min(1 + ((lvl - 3) >> 1), 5) : 0;
  const nTraps = lvl >= 5 ? Math.min(1 + ((lvl - 5) >> 1), 4) : 0;
  const nYarn  = lvl >= 7 ? Math.min(1 + ((lvl - 7) >> 2), 3) : 0;
  const placeHazard = (type, minDist) => {
    for (let tries = 0; tries < 60; tries++) {
      const x = 1 + Math.floor(rng() * (COLS - 2));
      const y = 1 + Math.floor(rng() * (ROWS - 2));
      if (T[idx(x, y)] !== EMPTY) continue;
      if (Math.abs(x - mx) + Math.abs(y - my) < minDist) continue;
      T[idx(x, y)] = type;
      return true;
    }
    return false;
  };
  for (let i = 0; i < nHoles; i++) placeHazard(HOLE, 4);
  for (let i = 0; i < nTraps; i++) placeHazard(TRAP, 5);
  // yarn balls spawn as entities on free tiles far from mouse
  for (let i = 0; i < nYarn; i++) {
    for (let tries = 0; tries < 60; tries++) {
      const x = 1 + Math.floor(rng() * (COLS - 2));
      const y = 1 + Math.floor(rng() * (ROWS - 2));
      if (T[idx(x, y)] !== EMPTY) continue;
      if (Math.abs(x - mx) + Math.abs(y - my) < 7) continue;
      if (G.cats.some(c => c.x === x && c.y === y)) continue;
      const dirs = [[1, 1], [1, -1], [-1, 1], [-1, -1]][Math.floor(rng() * 4)];
      G.yarns.push({ x, y, dx: dirs[0], dy: dirs[1] });
      break;
    }
  }

  // connectivity: flood fill from mouse over non-WALL cells (blocks are pushable)
  const seen = new Uint8Array(COLS * ROWS);
  const stack = [[mx, my]];
  seen[idx(mx, my)] = 1;
  let reach = 0;
  while (stack.length) {
    const [x, y] = stack.pop();
    reach++;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + ox, ny = y + oy;
      if (!inB(nx, ny) || seen[idx(nx, ny)]) continue;
      if (T[idx(nx, ny)] === WALL) continue;
      seen[idx(nx, ny)] = 1;
      stack.push([nx, ny]);
    }
  }
  const openCells = [];
  for (let i = 0; i < T.length; i++) if (T[i] !== WALL) openCells.push(i);
  if (reach < openCells.length * 0.9) return false;          // too compartmentalised
  if (G.cats.some(c => !seen[idx(c.x, c.y)])) return false;  // cat sealed off at spawn
  return G.cats.length >= Math.min(2, nCats);
}

function shuffle(a, rng) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

/* ---------- Movement helpers ---------- */
const solidForMouse = (x, y) => {
  const t = G.terrain[idx(x, y)];
  return t === WALL || t === BLOCK;
};
const solidForCat = (x, y) => {
  if (!inB(x, y)) return true;
  const t = G.terrain[idx(x, y)];
  return t !== EMPTY;                    // cats only walk on open floor
};
const solidForYarn = (x, y) => {
  if (!inB(x, y)) return true;
  const t = G.terrain[idx(x, y)];
  return t === WALL || t === BLOCK;      // yarn bounces off walls & crates
};
const catAt = (x, y) => G.cats.find(c => c.x === x && c.y === y);
const yarnAt = (x, y) => G.yarns.find(g => g.x === x && g.y === y);

/* ---------- Mouse ---------- */
function tryMouseMove(ox, oy) {
  if (G.state !== State.PLAYING) return;
  const m = G.mouse;
  if (performance.now() < m.stuckUntil) return;          // sunk in a hole
  const nx = m.x + ox, ny = m.y + oy;
  if (!inB(nx, ny)) return;

  // push crate?
  if (G.terrain[idx(nx, ny)] === BLOCK) {
    const bx = nx + ox, by = ny + oy;
    if (!inB(bx, by) || G.terrain[idx(bx, by)] !== EMPTY || G.cheese.has(idx(bx, by))
        || catAt(bx, by) || yarnAt(bx, by)) {
      AudioSys.push();
      return;                                            // crate can't budge
    }
    G.terrain[idx(bx, by)] = BLOCK;
    G.terrain[idx(nx, ny)] = EMPTY;
    m.x = nx; m.y = ny;
    AudioSys.push();
    checkTrappedCats();
    return;
  }

  // cat contact = death
  if (catAt(nx, ny)) { killMouse(); return; }

  m.x = nx; m.y = ny;
  AudioSys.step();

  // cheese
  const ci = idx(nx, ny);
  if (G.cheese.has(ci)) {
    G.cheese.delete(ci);
    G.score += 50;
    AudioSys.cheese();
    updateHud();
  }
  // hazards
  const t = G.terrain[ci];
  if (t === TRAP) { killMouse(); return; }
  if (t === HOLE) {
    m.stuckUntil = performance.now() + 3000;
    AudioSys.beep(200, 90, 0.25, 'triangle', 0.14);
  }
}

function killMouse() {
  if (G.state !== State.PLAYING) return;
  G.state = State.DYING;
  G.dieT = performance.now();
  G.lives--;
  G.shake = 12;
  AudioSys.death();
  updateHud();
}

/* ---------- Cats ---------- */
function catTick() {
  for (const c of G.cats) {
    if (G.state !== State.PLAYING) return;
    catStep(c);
    if (c.x === G.mouse.x && c.y === G.mouse.y) { killMouse(); return; }
  }
  checkTrappedCats();
}

function catStep(c) {
  const dx = G.mouse.x - c.x, dy = G.mouse.y - c.y;
  let opts = [];
  const hx = Math.sign(dx), hy = Math.sign(dy);
  if (Math.abs(dx) >= Math.abs(dy)) { if (hx) opts.push([hx, 0]); if (hy) opts.push([0, hy]); }
  else { if (hy) opts.push([0, hy]); if (hx) opts.push([hx, 0]); }
  if (Math.abs(dx) === Math.abs(dy) && G.rng() < 0.5) opts.reverse();
  if (G.rng() < 0.12) opts.reverse();                    // a little wander
  for (const [ox, oy] of opts) {
    if (catCan(c, ox, oy)) { catMove(c, ox, oy); return; }
  }
  // perpendicular scramble
  const perp = [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(() => G.rng() - 0.5);
  for (const [ox, oy] of perp) {
    if (catCan(c, ox, oy)) { catMove(c, ox, oy); return; }
  }
}

function catCan(c, ox, oy) {
  const nx = c.x + ox, ny = c.y + oy;
  if (solidForCat(nx, ny)) return false;
  if (catAt(nx, ny)) return false;
  return true;
}
function catMove(c, ox, oy) { c.x += ox; c.y += oy; }

/* A cat boxed in on all four orthogonal sides becomes cheese. */
function checkTrappedCats() {
  for (let i = G.cats.length - 1; i >= 0; i--) {
    const c = G.cats[i];
    const boxed = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .every(([ox, oy]) => {
        const nx = c.x + ox, ny = c.y + oy;
        if (!inB(nx, ny)) return true;                   // arena edge counts as solid
        const t = G.terrain[idx(nx, ny)];
        return t === WALL || t === BLOCK;
      });
    if (boxed) {
      G.cheese.add(idx(c.x, c.y));
      G.cats.splice(i, 1);
      G.score += 250;
      AudioSys.trapped();
      updateHud();
    }
  }
  if (G.state === State.PLAYING && G.cats.length === 0) levelClear();
}

function spawnCat() {
  if (G.cats.length >= 10) return;
  const rng = Math.random;
  for (let tries = 0; tries < 80; tries++) {
    const x = 1 + Math.floor(rng() * (COLS - 2));
    const y = 1 + Math.floor(rng() * (ROWS - 2));
    if (G.terrain[idx(x, y)] !== EMPTY) continue;
    if (Math.abs(x - G.mouse.x) + Math.abs(y - G.mouse.y) < 8) continue;
    if (catAt(x, y) || yarnAt(x, y)) continue;
    G.cats.push({ x, y });
    AudioSys.spawn();
    G.clock = 0;
    updateHud();
    return;
  }
}

/* ---------- Yarn balls ---------- */
function yarnStepAll() {
  for (const g of G.yarns) {
    let nx = g.x + g.dx, ny = g.y + g.dy;
    const bx = solidForYarn(nx, g.y);
    const by = solidForYarn(g.x, ny);
    if (bx && by) { g.dx = -g.dx; g.dy = -g.dy; continue; }
    if (bx) { g.dx = -g.dx; ny = g.y + g.dy; if (solidForYarn(nx, ny)) continue; }
    if (by) { g.dy = -g.dy; nx = g.x + g.dx; if (solidForYarn(nx, ny)) continue; }
    g.x = nx; g.y = ny;
    if (g.x === G.mouse.x && g.y === G.mouse.y) { killMouse(); return; }
  }
}

/* ---------- Flow ---------- */
function startGame() {
  G.score = 0;
  G.lives = 3;
  loadLevel(G.startLevel);
  setState(State.PLAYING);
}

function loadLevel(lvl) {
  genLevel(lvl);
  G.catAcc = 0;
  G.yarnAcc = 0;
  G.clock = 0;
  G.catInterval = Math.max(260, 430 - (lvl - 1) * 12);
  G.spawnEvery = Math.max(16000, 28000 - lvl * 300);
  updateHud();
}

function levelClear() {
  const bonus = 100 * G.level;
  G.score += bonus;
  $('clearBonus').textContent = '+' + bonus;
  G.state = State.CLEAR;
  G.clearT = performance.now();
  AudioSys.clear();
  saveBest();
  updateHud();
}

function nextLevel() { loadLevel(G.level + 1); setState(State.PLAYING); }

function retryLevel() {
  G.lives = 3;
  loadLevel(G.level);            // same seed → same layout
  setState(State.PLAYING);
}

function gameOver() {
  G.state = State.OVER;
  saveBest();
  $('overScore').textContent = G.score;
  $('overBest').textContent = G.score >= G.best && G.score > 0 ? '★ NEW BEST!' : 'BEST ' + G.best;
  showScreen('scrOver');
}

function saveBest() {
  if (G.score > G.best) { G.best = G.score; localStorage.setItem('rr_high', String(G.best)); updateHud(); }
}

/* ---------- UI state ---------- */
function showScreen(id) {
  const ov = $('overlay');
  ov.classList.toggle('hidden', !id);
  for (const s of ['scrTitle', 'scrClear', 'scrOver', 'scrPause'])
    $(s).classList.toggle('hidden', s !== id);
}
function setState(s) {
  G.state = s;
  if (s === State.TITLE) showScreen('scrTitle');
  else if (s === State.CLEAR) showScreen('scrClear');
  else if (s === State.OVER) showScreen('scrOver');
  else if (s === State.PAUSED) showScreen('scrPause');
  else showScreen(null);
  updateHud();
}

function updateHud() {
  $('hudScore').textContent = G.score;
  $('hudLevel').textContent = G.level;
  $('hudCats').textContent = G.cats.length;
  $('hudBest').textContent = G.best;
  const lv = $('hudLives');
  lv.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const s = document.createElement('span');
    s.textContent = '🐭';
    if (i >= G.lives) s.className = 'dead';
    lv.appendChild(s);
  }
}

/* ---------- Main loop ---------- */
let lastT = 0;
function frame(t) {
  const dt = Math.min(50, t - lastT);
  lastT = t;
  if (G.state === State.PLAYING) {
    G.catAcc += dt;
    while (G.catAcc >= G.catInterval) { G.catAcc -= G.catInterval; catTick(); if (G.state !== State.PLAYING) break; }
    if (G.state === State.PLAYING) {
      G.yarnAcc += dt;
      while (G.yarnAcc >= G.yarnInterval) { G.yarnAcc -= G.yarnInterval; yarnStepAll(); if (G.state !== State.PLAYING) break; }
    }
    if (G.state === State.PLAYING) {
      G.clock += dt;
      if (G.clock >= G.spawnEvery) spawnCat();
    }
  } else if (G.state === State.DYING) {
    if (t - G.dieT > 900) {
      if (G.lives > 0) { loadLevel(G.level); setState(State.PLAYING); }
      else gameOver();
    }
  } else if (G.state === State.CLEAR) {
    if (t - G.clearT > 1600) nextLevel();
  }
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt / 40);
  draw(t);
  requestAnimationFrame(frame);
}

/* ---------- Drawing ---------- */
function draw(t) {
  ctx.save();
  if (G.shake > 0) {
    ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
  }
  // floor
  ctx.fillStyle = '#151522';
  ctx.fillRect(-8, -8, W + 16, H + 16);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const px = x * CELL, py = y * CELL;
      if ((x + y) % 2 === 0) { ctx.fillStyle = '#171726'; ctx.fillRect(px, py, CELL, CELL); }
      drawTerrain(x, y);
    }
  }
  // cheese
  for (const ci of G.cheese) drawCheese(ci % COLS, (ci / COLS) | 0, t);
  // yarn
  for (const g of G.yarns) drawYarn(g.x, g.y, t);
  // cats
  for (const c of G.cats) drawCat(c.x, c.y, t);
  // mouse on top
  if (G.state !== State.TITLE) drawMouse(G.mouse.x, G.mouse.y, t);
  ctx.restore();
}

function drawTerrain(x, y) {
  const px = x * CELL, py = y * CELL;
  const t = G.terrain[idx(x, y)];
  if (t === WALL) {
    ctx.fillStyle = '#3d4257';
    ctx.fillRect(px, py, CELL, CELL);
    ctx.fillStyle = '#2e3244';
    ctx.fillRect(px, py, CELL, 3);
    ctx.fillRect(px, py + 15, CELL, 3);
    ctx.fillRect(px + (y % 2 ? 8 : 20), py, 3, 15);
    ctx.fillRect(px + (y % 2 ? 22 : 6), py + 18, 3, 14);
    ctx.fillStyle = '#4a5068';
    ctx.fillRect(px + 2, py + 2, CELL - 4, 2);
  } else if (t === BLOCK) {
    // wooden crate
    ctx.fillStyle = '#b57a24';
    ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
    ctx.fillStyle = '#d19a3c';
    ctx.fillRect(px + 4, py + 4, CELL - 8, CELL - 8);
    ctx.strokeStyle = '#8a5a14';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + 4, py + 4); ctx.lineTo(px + CELL - 4, py + CELL - 4);
    ctx.moveTo(px + CELL - 4, py + 4); ctx.lineTo(px + 4, py + CELL - 4);
    ctx.stroke();
    ctx.strokeRect(px + 1.5, py + 1.5, CELL - 3, CELL - 3);
  } else if (t === HOLE) {
    ctx.fillStyle = '#050508';
    ctx.beginPath();
    ctx.ellipse(px + CELL / 2, py + CELL / 2, 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2a2a3c';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (t === TRAP) {
    ctx.fillStyle = '#5a3a3a';
    ctx.fillRect(px + 5, py + 10, CELL - 10, CELL - 16);
    ctx.strokeStyle = '#9a9aae';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px + CELL / 2, py + CELL / 2 + 4, 9, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px + CELL / 2 - 9, py + CELL / 2 + 4);
    ctx.lineTo(px + CELL / 2 + 9, py + CELL / 2 + 4);
    ctx.stroke();
    ctx.fillStyle = '#c23b3b';
    ctx.fillRect(px + CELL / 2 - 3, py + CELL / 2, 6, 3);
  }
}

function drawCheese(x, y, t) {
  const px = x * CELL, py = y * CELL;
  const bob = Math.sin(t / 220 + x) * 1.2;
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(px + 6, py + 24 + bob);
  ctx.lineTo(px + 26, py + 24 + bob);
  ctx.lineTo(px + 26, py + 12 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8a91c';
  ctx.fillRect(px + 6, py + 23 + bob, 20, 2);
  ctx.fillStyle = '#c98f12';
  ctx.beginPath(); ctx.arc(px + 18, py + 19 + bob, 1.8, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(px + 12, py + 21 + bob, 1.4, 0, 7); ctx.fill();
}

function drawCat(x, y, t) {
  const px = x * CELL, py = y * CELL;
  const step = Math.floor(t / 300) % 2;
  // how close is this cat to being boxed? (worried eyes)
  let sides = 0;
  for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + ox, ny = y + oy;
    if (!inB(nx, ny) || G.terrain[idx(nx, ny)] === WALL || G.terrain[idx(nx, ny)] === BLOCK) sides++;
  }
  const worried = sides >= 3;
  // body
  ctx.fillStyle = '#e8853d';
  ctx.fillRect(px + 6, py + 9, 20, 18);
  // head
  ctx.fillRect(px + 4, py + 5, 24, 14);
  // ears
  ctx.fillStyle = '#d1742c';
  ctx.beginPath(); ctx.moveTo(px + 5, py + 7); ctx.lineTo(px + 9, py + 1); ctx.lineTo(px + 12, py + 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(px + 19, py + 7); ctx.lineTo(px + 23, py + 1); ctx.lineTo(px + 27, py + 7); ctx.fill();
  // eyes
  const dxm = Math.sign(G.mouse.x - x), dym = Math.sign(G.mouse.y - y);
  ctx.fillStyle = worried ? '#ff4a4a' : '#9ef01a';
  const ex = px + 10 + dxm, ey = py + 10 + dym + (step ? 0 : 0);
  ctx.fillRect(ex, ey, 4, worried ? 5 : 3);
  ctx.fillRect(ex + 8, ey, 4, worried ? 5 : 3);
  ctx.fillStyle = '#111';
  ctx.fillRect(ex + 1, ey + 1, 2, 2);
  ctx.fillRect(ex + 9, ey + 1, 2, 2);
  // whiskers
  ctx.strokeStyle = '#f5d9b8'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + 2, py + 15); ctx.lineTo(px + 8, py + 15);
  ctx.moveTo(px + 24, py + 15); ctx.lineTo(px + 30, py + 15);
  ctx.stroke();
  // paws
  ctx.fillStyle = '#d1742c';
  ctx.fillRect(px + 6 + step, py + 25, 6, 3);
  ctx.fillRect(px + 20 - step, py + 25, 6, 3);
  // tail
  ctx.strokeStyle = '#d1742c'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(px + 26, py + 24);
  ctx.quadraticCurveTo(px + 31, py + 22 + (step ? 3 : -2), px + 29, py + 14);
  ctx.stroke();
}

function drawMouse(x, y, t) {
  const m = G.mouse;
  const now = performance.now();
  const sunk = Math.max(0, Math.min(1, (m.stuckUntil - now) / 3000));
  const px = x * CELL, py = y * CELL + sunk * 6;
  const dying = G.state === State.DYING && Math.floor((now - G.dieT) / 100) % 2 === 0;
  const scale = 1 - sunk * 0.45;
  ctx.save();
  if (dying) ctx.globalAlpha = 0.35;
  ctx.translate(px + CELL / 2, py + CELL / 2);
  ctx.scale(scale, scale);
  ctx.translate(-CELL / 2, -CELL / 2);
  // ears
  ctx.fillStyle = '#f2a0b5';
  ctx.beginPath(); ctx.arc(px + 10, py + 10, 6, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(px + 22, py + 10, 6, 0, 7); ctx.fill();
  // body
  ctx.fillStyle = dying ? '#ff8a8a' : '#cfd4dc';
  ctx.fillRect(px + 7, py + 12, 18, 15);
  ctx.fillRect(px + 9, py + 9, 14, 8);
  // face
  ctx.fillStyle = '#111';
  ctx.fillRect(px + 11, py + 12, 2, 3);
  ctx.fillRect(px + 19, py + 12, 2, 3);
  ctx.fillStyle = '#f2a0b5';
  ctx.fillRect(px + 15, py + 16, 3, 2);
  // tail
  ctx.strokeStyle = '#cfd4dc'; ctx.lineWidth = 2;
  const wig = Math.sin(t / 150) * 3;
  ctx.beginPath();
  ctx.moveTo(px + 25, py + 24);
  ctx.quadraticCurveTo(px + 31, py + 26 + wig, px + 29, py + 30);
  ctx.stroke();
  ctx.restore();
}

function drawYarn(x, y, t) {
  const px = x * CELL, py = y * CELL;
  ctx.fillStyle = '#5aa7e8';
  ctx.beginPath();
  ctx.arc(px + CELL / 2, py + CELL / 2, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3b7fc0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px + CELL / 2, py + CELL / 2, 6, t / 200, t / 200 + 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(px + CELL / 2, py + CELL / 2, 9, t / 260 + 1, t / 260 + 3.5);
  ctx.stroke();
}

/* ---------- Input ---------- */
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

document.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  AudioSys.ensure();

  if (G.state === State.TITLE) { if (k !== 'm') startFromTitle(); return; }
  if (G.state === State.OVER) { if (k !== 'm') retryLevel(); return; }

  if (k === 'p') { togglePause(); return; }
  if (k === 'm') { toggleMute(); return; }
  if (G.state !== State.PLAYING) return;

  const dir = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' }[k];
  if (dir) tryMouseMove(...DIRS[dir]);
});

/* D-pad: hold to repeat */
document.querySelectorAll('.pad-btn').forEach(btn => {
  let rep = null;
  const fire = () => tryMouseMove(...DIRS[btn.dataset.dir]);
  const start = (e) => {
    e.preventDefault();
    AudioSys.ensure();
    if (G.state === State.TITLE) { startFromTitle(); return; }
    if (G.state === State.OVER) { retryLevel(); return; }
    fire();
    clearInterval(rep);
    rep = setInterval(fire, 150);
  };
  const stop = () => clearInterval(rep);
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointercancel', stop);
  btn.addEventListener('pointerleave', stop);
});

/* Swipe on the canvas */
let swipe = null;
cv.addEventListener('pointerdown', (e) => {
  AudioSys.ensure();
  if (G.state === State.TITLE) { startFromTitle(); return; }
  if (G.state === State.OVER) { retryLevel(); return; }
  swipe = { x: e.clientX, y: e.clientY, done: false };
});
cv.addEventListener('pointermove', (e) => {
  if (!swipe || swipe.done) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
  swipe.done = true;
  if (Math.abs(dx) > Math.abs(dy)) tryMouseMove(dx > 0 ? 1 : -1, 0);
  else tryMouseMove(0, dy > 0 ? 1 : -1);
});
cv.addEventListener('pointerup', () => { swipe = null; });

function startFromTitle() {
  AudioSys.ensure();
  AudioSys.ui();
  startGame();
}

function togglePause() {
  if (G.state === State.PLAYING) setState(State.PAUSED);
  else if (G.state === State.PAUSED) setState(State.PLAYING);
}
function toggleMute() {
  AudioSys.muted = !AudioSys.muted;
  localStorage.setItem('rr_muted', AudioSys.muted ? '1' : '0');
  $('btnMute').textContent = AudioSys.muted ? '🔇' : '🔊';
}

/* Buttons */
$('btnStart').addEventListener('click', startFromTitle);
$('btnRetry').addEventListener('click', retryLevel);
$('btnMenu').addEventListener('click', () => setState(State.TITLE));
$('btnResume').addEventListener('click', () => setState(State.PLAYING));
$('btnQuit').addEventListener('click', () => setState(State.TITLE));
$('btnPause').addEventListener('click', togglePause);
$('btnMute').addEventListener('click', toggleMute);
$('btnRestart').addEventListener('click', () => { if (G.state !== State.TITLE) { G.lives = Math.max(1, G.lives); loadLevel(G.level); setState(State.PLAYING); } });

$('lvlMinus').addEventListener('click', () => { G.startLevel = Math.max(1, G.startLevel - 1); $('lvlValue').textContent = G.startLevel; AudioSys.ensure(); AudioSys.ui(); });
$('lvlPlus').addEventListener('click', () => { G.startLevel = Math.min(50, G.startLevel + 1); $('lvlValue').textContent = G.startLevel; AudioSys.ensure(); AudioSys.ui(); });

document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.state === State.PLAYING) setState(State.PAUSED);
});

/* Touch detection */
if ('ontouchstart' in window || navigator.maxTouchPoints > 0 || new URLSearchParams(location.search).has('touch')) {
  document.body.classList.add('touch');
}

/* ---------- Boot ---------- */
$('btnMute').textContent = AudioSys.muted ? '🔇' : '🔊';
genLevel(1);                 // draw a board behind the title
updateHud();
showScreen('scrTitle');
requestAnimationFrame(frame);
