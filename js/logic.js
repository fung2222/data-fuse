// Pure game logic (no DOM / Three.js). Tiles carry ids so the view can animate them.
// v1.2: pulse fuse, zone mods (lock/drift), combo tracking, score multiplier.
import { SIZE, SPAWN_FOUR_CHANCE, START_TILES, COMBO_CAP, SURGE_MULT, LOCK_SWIPES } from './config.js';

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
  constructor({ rng = Math.random } = {}) {
    this.rng = rng; this.fourChance = SPAWN_FOUR_CHANCE; this.nextId = 1;
    this.scoreMult = 1; this.lockedId = null; this.lockLeft = 0;
    this.combo = 0; this.maxCombo = 0;
    this.reset();
  }

  reset() {
    this.cells = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    this.score = 0; this.moves = 0; this.maxTile = 0; this.over = false;
    this.combo = 0; this.maxCombo = 0; this.lockedId = null; this.lockLeft = 0;
    const spawned = [];
    for (let i = 0; i < START_TILES; i++) spawned.push(this.spawn());
    return spawned;
  }

  tiles() { const out = []; for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (this.cells[r][c]) out.push(this.cells[r][c]); return out; }
  empty() { const out = []; for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!this.cells[r][c]) out.push({ r, c }); return out; }

  spawn(forceV = null, forcePos = null) {
    const e = this.empty(); if (!e.length) return null;
    let spot = forcePos && e.some(p => p.r === forcePos.r && p.c === forcePos.c) ? forcePos : e[Math.floor(this.rng() * e.length)];
    const { r, c } = spot;
    const v = forceV || (this.rng() < this.fourChance ? 4 : 2);
    const t = { id: this.nextId++, v, r, c };
    this.cells[r][c] = t; this.maxTile = Math.max(this.maxTile, v);
    return t;
  }

  /** Pin the highest-value tile for LOCK_SWIPES swipes (lock zone mod). */
  armLock(swipes = LOCK_SWIPES) {
    let best = null;
    for (const t of this.tiles()) if (!best || t.v > best.v || (t.v === best.v && t.id > best.id)) best = t;
    this.lockedId = best ? best.id : null;
    this.lockLeft = this.lockedId != null ? swipes : 0;
  }
  clearLock() { this.lockedId = null; this.lockLeft = 0; }
  setSurge(on) { this.scoreMult = on ? SURGE_MULT : 1; }

  _isLocked(t) { return this.lockedId != null && t && t.id === this.lockedId && this.lockLeft > 0; }

  /**
   * Slide in direction d. Returns null if nothing moved, else
   * { slides, merges, gained, spawned, combo, pulse, tier, drifted }
   */
  move(d, { pulse = false } = {}) {
    if (this.over) return null;
    return pulse ? this._pulse(d) : this._slide(d);
  }

  _slide(d) {
    const { dr, dc } = DIRS[d];
    const slides = [], merges = [];
    let gained = 0, moved = false;
    const next = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    for (let line = 0; line < SIZE; line++) {
      const pos = [];
      for (let k = 0; k < SIZE; k++) {
        const i = (dr + dc) > 0 ? SIZE - 1 - k : k;
        pos.push(dr !== 0 ? { r: i, c: line } : { r: line, c: i });
      }
      let tgt = 0, last = null;
      for (const p of pos) {
        const t = this.cells[p.r][p.c]; if (!t) continue;
        if (this._isLocked(t)) {
          // Locked core stays put; advance target past it so others don't occupy its cell.
          const dest = p;
          while (tgt < pos.length && (pos[tgt].r !== dest.r || pos[tgt].c !== dest.c)) tgt++;
          tgt++;
          slides.push({ id: t.id, fromR: p.r, fromC: p.c, toR: dest.r, toC: dest.c, consumed: false, locked: true });
          next[dest.r][dest.c] = { id: t.id, v: t.v, r: dest.r, c: dest.c };
          last = null; // cannot merge through lock
          continue;
        }
        if (last && !last.merged && last.v === t.v && !this._isLocked(last.tile)) {
          const dest = pos[tgt - 1];
          const nv = t.v * 2;
          const nt = { id: this.nextId++, v: nv, r: dest.r, c: dest.c };
          slides.push({ id: t.id, fromR: p.r, fromC: p.c, toR: dest.r, toC: dest.c, consumed: true });
          const ls = slides.find(s => s.id === last.tile.id); if (ls) ls.consumed = true;
          merges.push({ id: nt.id, v: nv, r: dest.r, c: dest.c, from: [last.tile.id, t.id] });
          next[dest.r][dest.c] = nt; gained += nv; moved = true;
          last.merged = true; this.maxTile = Math.max(this.maxTile, nv);
        } else {
          // Skip occupied / locked destinations
          while (tgt < pos.length && next[pos[tgt].r][pos[tgt].c]) tgt++;
          if (tgt >= pos.length) {
            // no room — stay (shouldn't happen on valid boards)
            slides.push({ id: t.id, fromR: p.r, fromC: p.c, toR: p.r, toC: p.c, consumed: false });
            next[p.r][p.c] = { id: t.id, v: t.v, r: p.r, c: p.c };
            last = { tile: next[p.r][p.c], v: t.v, merged: false };
            continue;
          }
          const dest = pos[tgt++];
          if (dest.r !== p.r || dest.c !== p.c) moved = true;
          slides.push({ id: t.id, fromR: p.r, fromC: p.c, toR: dest.r, toC: dest.c, consumed: false });
          const placed = { id: t.id, v: t.v, r: dest.r, c: dest.c };
          next[dest.r][dest.c] = placed; last = { tile: placed, v: t.v, merged: false };
        }
      }
    }
    if (!moved && !merges.length) return null;
    return this._commit(next, slides, merges, gained, false);
  }

  /** PULSE FUSE: only adjacent equal pairs along axis fuse in place; no sliding into empties. */
  _pulse(d) {
    const { dr, dc } = DIRS[d];
    const slides = [], merges = [];
    let gained = 0;
    const next = this.cells.map(row => row.map(t => (t ? { id: t.id, v: t.v, r: t.r, c: t.c } : null)));
    const used = new Set();
    // Walk from leading edge so the "front" tile absorbs.
    for (let line = 0; line < SIZE; line++) {
      const pos = [];
      for (let k = 0; k < SIZE; k++) {
        const i = (dr + dc) > 0 ? SIZE - 1 - k : k;
        pos.push(dr !== 0 ? { r: i, c: line } : { r: line, c: i });
      }
      for (let i = 0; i < pos.length - 1; i++) {
        const a = pos[i], b = pos[i + 1];
        const ta = next[a.r][a.c], tb = next[b.r][b.c];
        if (!ta || !tb || used.has(ta.id) || used.has(tb.id)) continue;
        if (this._isLocked(ta) || this._isLocked(tb)) continue;
        if (ta.v !== tb.v) continue;
        // b slides into a and merges
        const nv = ta.v * 2;
        const nt = { id: this.nextId++, v: nv, r: a.r, c: a.c };
        slides.push({ id: tb.id, fromR: b.r, fromC: b.c, toR: a.r, toC: a.c, consumed: true });
        slides.push({ id: ta.id, fromR: a.r, fromC: a.c, toR: a.r, toC: a.c, consumed: true });
        merges.push({ id: nt.id, v: nv, r: a.r, c: a.c, from: [ta.id, tb.id] });
        next[a.r][a.c] = nt; next[b.r][b.c] = null;
        used.add(ta.id); used.add(tb.id); used.add(nt.id);
        gained += nv; this.maxTile = Math.max(this.maxTile, nv);
        i++; // skip past absorbed partner
      }
    }
    if (!merges.length) return null;
    return this._commit(next, slides, merges, gained, true);
  }

  _commit(next, slides, merges, gainedRaw, pulse) {
    const gained = Math.round(gainedRaw * this.scoreMult);
    this.cells = next; this.score += gained; this.moves++;
    if (merges.length) {
      this.combo = Math.min(COMBO_CAP, this.combo + 1);
      this.maxCombo = Math.max(this.maxCombo, this.combo);
    } else {
      this.combo = 0;
    }
    if (this.lockLeft > 0) { this.lockLeft--; if (this.lockLeft <= 0) this.clearLock(); }
    const spawned = this.spawn();
    this.over = !this.canMove();
    let tier = 'normal';
    if (pulse) tier = 'pulse';
    else if (merges.length >= 2) tier = 'multi';
    else if (merges.some(m => m.v >= 128)) tier = 'big';
    if (merges.some(m => m.v >= 2048)) tier = 'legendary';
    return { slides, merges, gained, spawned, combo: this.combo, pulse, tier, scoreMult: this.scoreMult };
  }

  /** After a merge move: soft-swap two non-locked, non-max tiles (drift mod). */
  driftSwap() {
    const cand = this.tiles().filter(t => !this._isLocked(t) && t.v < this.maxTile);
    if (cand.length < 2) return null;
    const i = Math.floor(this.rng() * cand.length);
    let j = Math.floor(this.rng() * (cand.length - 1)); if (j >= i) j++;
    const a = cand[i], b = cand[j];
    const ar = a.r, ac = a.c;
    a.r = b.r; a.c = b.c; b.r = ar; b.c = ac;
    this.cells[a.r][a.c] = a; this.cells[b.r][b.c] = b;
    return { a: a.id, b: b.id, ar: a.r, ac: a.c, br: b.r, bc: b.c };
  }

  canMove() {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const t = this.cells[r][c]; if (!t) return true;
      if (c < SIZE - 1 && this.cells[r][c + 1] && this.cells[r][c + 1].v === t.v) return true;
      if (r < SIZE - 1 && this.cells[r + 1][c] && this.cells[r + 1][c].v === t.v) return true;
    }
    return false;
  }

  /** Prefer a direction that would produce a merge (for hint chevrons). */
  hintDir() {
    const order = ['up', 'left', 'right', 'down'];
    const mergeFirst = [];
    const any = [];
    for (const d of order) {
      const { dr, dc } = DIRS[d];
      let canMerge = false, canMove = false;
      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        const t = this.cells[r][c]; if (!t || this._isLocked(t)) continue;
        // look ahead along the direction for first blocker
        let rr = r + dr, cc = c + dc;
        while (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE) {
          const o = this.cells[rr][cc];
          if (!o) { canMove = true; rr += dr; cc += dc; continue; }
          if (!this._isLocked(o) && o.v === t.v) canMerge = true;
          break;
        }
      }
      if (canMerge) mergeFirst.push(d);
      else if (canMove) any.push(d);
    }
    return mergeFirst[0] || any[0] || null;
  }

  values() { const a = []; for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) a.push(this.cells[r][c] ? this.cells[r][c].v : 0); return a; }

  snapshot() {
    return {
      values: this.values(), score: this.score, moves: this.moves, maxTile: this.maxTile,
      combo: this.combo, maxCombo: this.maxCombo, scoreMult: this.scoreMult,
      lockLeft: this.lockLeft, lockedV: this.lockedId != null ? (this.tiles().find(t => t.id === this.lockedId)?.v || 0) : 0,
    };
  }
  restore(s) {
    this.cells = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    s.values.forEach((v, i) => { if (v) { const r = Math.floor(i / SIZE), c = i % SIZE; this.cells[r][c] = { id: this.nextId++, v, r, c }; } });
    this.score = s.score | 0; this.moves = s.moves | 0;
    this.maxTile = Math.max(s.maxTile | 0, ...s.values);
    this.combo = s.combo | 0; this.maxCombo = s.maxCombo | 0;
    this.scoreMult = s.scoreMult || 1;
    this.lockLeft = s.lockLeft | 0;
    this.lockedId = null;
    if (this.lockLeft > 0 && s.lockedV) {
      const t = this.tiles().filter(x => x.v === s.lockedV).sort((a, b) => b.id - a.id)[0];
      if (t) this.lockedId = t.id;
    }
    this.over = !this.canMove();
  }
}
