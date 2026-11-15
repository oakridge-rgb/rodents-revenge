/* ============================================================
   levels.js — level data for the faithful port
   - Levels 1-4: authentic transcriptions of the original game's
     layouts (cross-verified across two independent remakes and
     original gameplay footage). Chars: W wall, B movable block,
     H hole, T trap. Metadata: #clock N (spawn interval),
     #spawn a b c... (spawn batch cycle).
   - Levels 5-50: DETERMINISTIC reconstructions seeded per level
     number (same layout every time you play), built from the
     original's pattern vocabulary (SQUARE / BOXCHESS / WALLCHESS
     x LARGE / MEDIUM / SMALL + random wall/box/hole/trap counts),
     following the documented difficulty ramp. See FAITHFULNESS.md.
   ============================================================ */
'use strict';

const RR_GRID = 23;

/* ---- Authentic levels 1-4 (transcribed from the original game) ---- */
const RR_AUTHENTIC = {
  1: {
    clock: 5, spawn: [1, 2],
    map: [
      'WWWWWWWWWWWWWWWWWWWWWWW',
      'W                     W',
      'W                     W',
      'W                     W',
      'W   BBBBBBBBBBBBBBB   W',
      'W   BBBBBBBBBBBBBBB   W',
      'W   BBBBBBBBBBBBBBB   W',
      'W   BBBBBBBBBBBBBBB   W',
      'W   BBBBBBBBBBBBBBB   W',
      'W   BBBBBBBBBBBBBBB   W',
      'W   BBBBBBBBBBBBBBB   W',
      'W   BBBBBBBBBBBBBBB   W',
      'W   BBBBBBBBBBBBBBB   W',
      'W   BBBBBBBBBBBBBBB   W',
      'W   BBBBBBBBBBBBBBB   W',
      'W   BBBBBBBBBBBBBBB   W',
      'W   BBBBBBBBBBBBBBB   W',
      'W   BBBBBBBBBBBBBBB   W',
      'W   BBBBBBBBBBBBBBB   W',
      'W                     W',
      'W                     W',
      'W                     W',
      'WWWWWWWWWWWWWWWWWWWWWWW'
    ]
  },
  2: {
    clock: 5, spawn: [1, 2],
    map: [
      'WWWWWWWWWWWWWWWWWWWWWWW',
      'W                     W',
      'W         W           W',
      'W W                   W',
      'W   BBBBBBBBBBBBBBB   W',
      'W   BBBBBBBBBBBBBBB W W',
      'W   BBBBBBBBBWBWBBB   W',
      'W   BBBBBBBBBBBBBBB   W',
      'W   BBBBBBBBBBBBBBB   W',
      'W   BBBWBWBBBBBBBBB   W',
      'W   BBBBBBBBWBBBBBB   W',
      'W   BBBBBBBBBBBWBBB   W',
      'W   BBBBBBBBBBBBBBB   W',
      'W   WBBBBBBBBBBBBBB   W',
      'W   BBBBBBBBBBBBBBB   W',
      'W   BBBBBBBBBBBBBBB   W',
      'W   BBBBBBBBBBWBBBB   W',
      'W   WBBBBBBBBBBBBBB   W',
      'W  WWBBBWBBBBBBBBBW   W',
      'W             W       W',
      'W      W    W         W',
      'W                     W',
      'WWWWWWWWWWWWWWWWWWWWWWW'
    ]
  },
  3: {
    clock: 5, spawn: [3],
    map: [
      'WWWWWWWWWWWWWWWWWWWWWWW',
      'W               B  B  W',
      'WB    B BBB    B  W B W',
      'W     B BW       B BB W',
      'W  W       B B   BB B W',
      'W    B        W B     W',
      'W BBB  B B    WB  B   W',
      'W   BB   BBBB     B B W',
      'W   BBB  BB B B BBWB  W',
      'W B  BB      B   BBB  W',
      'W  B   BW B  B    BB  W',
      'W      BB  B B B      W',
      'W BB BB      B  WB B  W',
      'W  B   B  B   B B BWW W',
      'W B    B   BB      B  W',
      'W B B     B B  B BB B W',
      'W   B B  B BBB B BB B W',
      'W  B B   BB BB  BBB   W',
      'WW B B  BBW  BB  B    W',
      'W B B      BBB  B W B W',
      'W W  BBB  BBB B B  BB W',
      'W                     W',
      'WWWWWWWWWWWWWWWWWWWWWWW'
    ]
  },
  4: {
    clock: 2, spawn: [1],
    map: [
      'WWWWWWWWWWWWWWWWWWWWWWW',
      'W            H        W',
      'W  B B B B B H B B B  W',
      'WHB B B B B B B B B B W',
      'W  B B B B B B B B B  W',
      'W B B B B B B B B B B W',
      'W  B B B B BHB B B B  W',
      'W B B B B B B B B B B W',
      'W  B B B B B B B B B  W',
      'W B B B B B B B B B B W',
      'W  B B B B B B B B B  W',
      'W B B B B B B B B B B W',
      'W  B B B B B B BHB B  W',
      'W B B B B B B B B B B W',
      'W  B B B B B B B B B  W',
      'W B B B BHB B B B B B W',
      'W  B B B B B B B B B  W',
      'W B B B B B B B B B B W',
      'W  B B B B B B B B B  W',
      'W B B B B B B B B B B W',
      'W  B B B B B B B B B  W',
      'W                     W',
      'WWWWWWWWWWWWWWWWWWWWWWW'
    ]
  }
};

/* ---- Deterministic generator for levels 5-50 (reconstructed) ----
   Pattern vocabulary + per-level difficulty parameters follow the
   progression documented by the community; layouts are seeded so
   every playthrough of level N is identical. */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Per-level generator specs for 5..50 (0-indexed from level 5). */
const RR_GEN_SPECS = [
  /*  5 */ { p: 'OPEN',      wall: 60, box: 60, hole: 10, trap: 0,  spawn: [1, 3], yarn: [6, 12] },
  /*  6 */ { p: 'WALLCHESS M', wall: 0, box: 65, hole: 18, trap: 0, spawn: [1, 3], yarn: [6, 12] },
  /*  7 */ { p: 'SQUARE M',    wall: 0, box: 0,  hole: 6,  trap: 1,  spawn: [1, 3], yarn: [6, 12] },
  /*  8 */ { p: 'SQUARE M',    wall: 11, box: 0, hole: 12, trap: 4,  spawn: [1, 3], yarn: [6, 12] },
  /*  9 */ { p: 'OPEN',      wall: 6,  box: 100, hole: 13, trap: 6, spawn: [1, 3], yarn: [5, 10] },
  /* 10 */ { p: 'BOXCHESS M',  wall: 0, box: 0,  hole: 18, trap: 7,  spawn: [1, 3], yarn: [5, 10] },
  /* 11 */ { p: 'OPEN',      wall: 60, box: 60, hole: 23, trap: 14, spawn: [1, 3], yarn: [5, 10] },
  /* 12 */ { p: 'WALLCHESS M', wall: 0, box: 60, hole: 25, trap: 18, spawn: [1, 3], yarn: [5, 10] },
  /* 13 */ { p: 'SQUARE L',    wall: 0, box: 0,  hole: 20, trap: 9,  spawn: [1, 3], yarn: [5, 10] },
  /* 14 */ { p: 'SQUARE S',    wall: 1, box: 0,  hole: 18, trap: 8,  spawn: [1, 3], yarn: [5, 10] },
  /* 15 */ { p: 'OPEN',      wall: 3,  box: 70, hole: 15, trap: 10, spawn: [1, 3], yarn: [5, 10] },
  /* 16 */ { p: 'BOXCHESS M',  wall: 0, box: 0,  hole: 15, trap: 11, spawn: [1, 3], yarn: [5, 10] },
  /* 17 */ { p: 'OPEN',      wall: 60, box: 60, hole: 23, trap: 17, spawn: [1, 3], yarn: [5, 10] },
  /* 18 */ { p: 'WALLCHESS M', wall: 0, box: 60, hole: 21, trap: 16, spawn: [1, 3], yarn: [5, 10] },
  /* 19 */ { p: 'SQUARE M',    wall: 0, box: 0,  hole: 15, trap: 10, spawn: [1, 3], yarn: [5, 10] },
  /* 20+ */ { p: 'CYCLE', spawn: [2, 3], yarn: [4, 8] }
];

function rrSpecFor(n) {
  if (n <= 19) return RR_GEN_SPECS[n - 5];
  const tier = n <= 29 ? 0 : n <= 39 ? 1 : 2;
  const cycle = ['SQUARE L', 'BOXCHESS M', 'WALLCHESS M', 'OPEN', 'SQUARE M'][n % 5];
  const growth = tier * 10;
  const spec = { p: cycle, spawn: [[2, 3], [2, 4], [3, 4]][tier], yarn: [4, 8] };
  if (cycle === 'SQUARE L') { spec.hole = 18 + growth; spec.trap = 8 + growth; }
  else if (cycle === 'BOXCHESS M') { spec.hole = 16 + growth; spec.trap = 10 + growth; }
  else if (cycle === 'WALLCHESS M') { spec.box = 60; spec.hole = 20 + growth; spec.trap = 14 + growth; }
  else if (cycle === 'SQUARE M') { spec.hole = 14 + growth; spec.trap = 10 + growth; spec.wall = 8 + tier * 4; }
  else { spec.wall = 40 + growth; spec.box = 60 + growth; spec.hole = 18 + growth; spec.trap = 12 + growth; }
  return spec;
}

function rrClockFor(n) {
  if (n <= 4) return null;               // authentic levels carry their own
  if (n <= 9) return 4;
  if (n <= 19) return 3;
  return 2;
}

function rrGenerate(n) {
  const spec = rrSpecFor(n);
  let attempt = 0;
  for (;;) {
    const rng = mulberry32(n * 7919 + attempt * 104729 + 17);
    const g = new Array(RR_GRID * RR_GRID).fill(' ');
    for (let i = 0; i < RR_GRID; i++) {
      g[i] = g[(RR_GRID - 1) * RR_GRID + i] = g[i * RR_GRID] = g[i * RR_GRID + RR_GRID - 1] = 'W';
    }
    const C = 11; // centre
    const put = (x, y, ch) => { g[y * RR_GRID + x] = ch; };
    const at = (x, y) => g[y * RR_GRID + x];

    // pattern
    const size = spec.p.includes(' L') ? 15 : spec.p.includes(' M') ? 11 : spec.p.includes(' S') ? 7 : 0;
    if (spec.p.startsWith('SQUARE')) {
      const r = (size - 1) / 2;
      for (let y = C - r; y <= C + r; y++) for (let x = C - r; x <= C + r; x++) put(x, y, 'B');
    } else if (spec.p.startsWith('BOXCHESS')) {
      const r = (size - 1) / 2;
      for (let y = C - r; y <= C + r; y++) for (let x = C - r; x <= C + r; x++)
        if ((x + y) % 2 === 0) put(x, y, 'B');
    } else if (spec.p.startsWith('WALLCHESS')) {
      const r = (size - 1) / 2;
      for (let y = C - r; y <= C + r; y++) for (let x = C - r; x <= C + r; x++)
        if ((x + y) % 2 === 0) put(x, y, 'W');
    }

    // random placements (walls, boxes, holes, traps)
    const scatter = (ch, count, minDist) => {
      let placed = 0, tries = 0;
      while (placed < count && tries < count * 30) {
        tries++;
        const x = 1 + Math.floor(rng() * (RR_GRID - 2));
        const y = 1 + Math.floor(rng() * (RR_GRID - 2));
        if (at(x, y) !== ' ') continue;
        if (Math.abs(x - C) + Math.abs(y - C) < minDist) continue;
        put(x, y, ch);
        placed++;
      }
    };
    if (spec.wall) scatter('W', spec.wall, 4);
    if (spec.box) scatter('B', spec.box, 4);
    if (spec.hole) scatter('H', spec.hole, 6);
    if (spec.trap) scatter('T', spec.trap, 7);

    // reachability guard: flood fill over non-wall cells from centre
    const seen = new Uint8Array(RR_GRID * RR_GRID);
    const stack = [C * RR_GRID + C];
    seen[C * RR_GRID + C] = 1;
    let reach = 0, openCells = 0;
    while (stack.length) {
      const i = stack.pop();
      reach++;
      const x = i % RR_GRID, y = (i / RR_GRID) | 0;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ox, ny = y + oy;
        if (nx < 0 || nx >= RR_GRID || ny < 0 || ny >= RR_GRID) continue;
        const j = ny * RR_GRID + nx;
        if (seen[j] || g[j] === 'W') continue;
        seen[j] = 1;
        stack.push(j);
      }
    }
    for (let i = 0; i < g.length; i++) if (g[i] !== 'W') openCells++;
    if (reach >= openCells * 0.92) {
      return {
        map: [],
        grid: g,
        clock: rrClockFor(n),
        spawn: spec.spawn,
        yarn: spec.yarn
      };
    }
    attempt++;
    if (attempt > 40) { // accept anyway
      return { map: [], grid: g, clock: rrClockFor(n), spawn: spec.spawn, yarn: spec.yarn };
    }
  }
}

/* Public API: returns {grid: string[529 chars] layout, clock, spawn:[], yarn:[min,max]|null} */
function rrLoadLevel(n) {
  const auth = RR_AUTHENTIC[n];
  if (auth) {
    const g = auth.map.join('').replace(/\n/g, '');
    return { grid: g, clock: auth.clock, spawn: auth.spawn, yarn: null };
  }
  return rrGenerate(n);
}
