// Pure game logic (no DOM / Three.js) - easy to unit test.  Tiles carry ids so the view can animate them.
import { SIZE, SPAWN_FOUR_CHANCE, START_TILES } from './config.js';

export const DIRS = {
  up: { dr: -1, dc: 0 }, down: { dr: 1, dc: 0 }, left: { dr: 0, dc: -1 }, right: { dr: 0, dc: 1 },
};

/** small deterministic RNG (mulberry32) so ?seed=N reproduces a game */
export function makeRng(seed) {
  if (seed == null) return Math.random;
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class FuseGame {
  constructor({ rng = Math.random } = {}) { this.rng = rng; this.fourChance = SPAWN_FOUR_CHANCE; this.nextId = 1; this.reset(); }

  reset() {
    this.cells = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    this.score = 0; this.moves = 0; this.maxTile = 0; this.over = false;
    const spawned = [];
    for (let i = 0; i < START_TILES; i++) spawned.push(this.spawn());
    return spawned;
  }

  tiles() { const out = []; for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (this.cells[r][c]) out.push(this.cells[r][c]); return out; }
  empty() { const out = []; for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!this.cells[r][c]) out.push({ r, c }); return out; }

  spawn(forceV = null) {
    const e = this.empty(); if (!e.length) return null;
    const { r, c } = e[Math.floor(this.rng() * e.length)];
    const v = forceV || (this.rng() < this.fourChance ? 4 : 2);
    const t = { id: this.nextId++, v, r, c };
    this.cells[r][c] = t; this.maxTile = Math.max(this.maxTile, v);
    return t;
  }

  /**
   * Slide in direction d. Returns null if nothing moved, else
   * { slides: [{id, fromR, fromC, toR, toC, consumed}], merges: [{id, v, r, c, from:[idA,idB]}], gained, spawned }
   */
  move(d) {
    if (this.over) return null;
    const { dr, dc } = DIRS[d];
    const slides = [], merges = [];
    let gained = 0, moved = false;
    const next = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    for (let line = 0; line < SIZE; line++) {
      // walk cells from the leading edge backwards
      const pos = [];
      for (let k = 0; k < SIZE; k++) {
        const i = (dr + dc) > 0 ? SIZE - 1 - k : k;
        pos.push(dr !== 0 ? { r: i, c: line } : { r: line, c: i });
      }
      let tgt = 0, last = null; // last = tile placed at pos[tgt-1] that may still merge
      for (const p of pos) {
        const t = this.cells[p.r][p.c]; if (!t) continue;
        if (last && !last.merged && last.v === t.v) {
          const dest = pos[tgt - 1];
          const nv = t.v * 2;
          const nt = { id: this.nextId++, v: nv, r: dest.r, c: dest.c };
          slides.push({ id: t.id, fromR: p.r, fromC: p.c, toR: dest.r, toC: dest.c, consumed: true });
          const ls = slides.find(s => s.id === last.tile.id); ls.consumed = true;
          merges.push({ id: nt.id, v: nv, r: dest.r, c: dest.c, from: [last.tile.id, t.id] });
          next[dest.r][dest.c] = nt; gained += nv; moved = true;
          last.merged = true; this.maxTile = Math.max(this.maxTile, nv);
        } else {
          const dest = pos[tgt++];
          if (dest.r !== p.r || dest.c !== p.c) moved = true;
          slides.push({ id: t.id, fromR: p.r, fromC: p.c, toR: dest.r, toC: dest.c, consumed: false });
          const placed = { id: t.id, v: t.v, r: dest.r, c: dest.c };
          next[dest.r][dest.c] = placed; last = { tile: placed, v: t.v, merged: false };
        }
      }
    }
    if (!moved) return null;
    this.cells = next; this.score += gained; this.moves++;
    const spawned = this.spawn();
    this.over = !this.canMove();
    return { slides, merges, gained, spawned };
  }

  canMove() {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const t = this.cells[r][c]; if (!t) return true;
      if (c < SIZE - 1 && this.cells[r][c + 1] && this.cells[r][c + 1].v === t.v) return true;
      if (r < SIZE - 1 && this.cells[r + 1][c] && this.cells[r + 1][c].v === t.v) return true;
    }
    return false;
  }

  /** flat array of values (0 = empty), row-major */
  values() { const a = []; for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) a.push(this.cells[r][c] ? this.cells[r][c].v : 0); return a; }

  snapshot() { return { values: this.values(), score: this.score, moves: this.moves, maxTile: this.maxTile }; }
  /** restore from snapshot (new ids are issued - the view rebuilds) */
  restore(s) {
    this.cells = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    s.values.forEach((v, i) => { if (v) { const r = Math.floor(i / SIZE), c = i % SIZE; this.cells[r][c] = { id: this.nextId++, v, r, c }; } });
    this.score = s.score | 0; this.moves = s.moves | 0;
    this.maxTile = Math.max(s.maxTile | 0, ...s.values);
    this.over = !this.canMove();
  }
}
