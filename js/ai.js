// Expectimax autoplayer for ?demo=1 and the attract mode behind the start screen.
// Works on a flat array of 16 log2 exponents (0 = empty) for speed.
import { SIZE } from './config.js';

const N = SIZE * SIZE;
const ORDER = ['up', 'left', 'right', 'down'];
// snake-shaped weights: keeps the biggest tiles chained into the top-left corner
const W = [
  15, 14, 13, 12,
  8, 9, 10, 11,
  7, 6, 5, 4,
  0, 1, 2, 3,
].map(x => Math.pow(4, x / 3));

function lineIdx(d, line) {
  const idx = [];
  for (let k = 0; k < SIZE; k++) {
    if (d === 'left') idx.push(line * SIZE + k);
    else if (d === 'right') idx.push(line * SIZE + (SIZE - 1 - k));
    else if (d === 'up') idx.push(k * SIZE + line);
    else idx.push((SIZE - 1 - k) * SIZE + line);
  }
  return idx;
}
const LINES = {}; for (const d of ORDER) LINES[d] = [0, 1, 2, 3].map(l => lineIdx(d, l));

export function slide(g, d) {
  const out = g.slice(); let moved = false, score = 0;
  for (const idx of LINES[d]) {
    const vals = idx.map(i => g[i]).filter(v => v);
    const res = [];
    for (let i = 0; i < vals.length; i++) {
      if (i + 1 < vals.length && vals[i] === vals[i + 1]) { res.push(vals[i] + 1); score += 1 << (vals[i] + 1); i++; }
      else res.push(vals[i]);
    }
    for (let k = 0; k < SIZE; k++) { const v = res[k] || 0; if (out[idx[k]] !== v) moved = true; out[idx[k]] = v; }
  }
  return { g: out, moved, score };
}

function heuristic(g) {
  let s = 0, empty = 0, smooth = 0;
  for (let i = 0; i < N; i++) {
    const v = g[i];
    if (!v) { empty++; continue; }
    s += W[i] * (1 << v);
    const r = (i / SIZE) | 0, c = i % SIZE;
    if (c < SIZE - 1 && g[i + 1]) smooth -= Math.abs(v - g[i + 1]);
    if (r < SIZE - 1 && g[i + SIZE]) smooth -= Math.abs(v - g[i + SIZE]);
  }
  return s + empty * empty * 60 + smooth * 30;
}

function maxNode(g, depth) {
  let best = -Infinity;
  for (const d of ORDER) {
    const r = slide(g, d); if (!r.moved) continue;
    best = Math.max(best, depth <= 0 ? heuristic(r.g) : chanceNode(r.g, depth));
  }
  return best === -Infinity ? -1e9 : best;
}

function chanceNode(g, depth) {
  const empty = []; for (let i = 0; i < N; i++) if (!g[i]) empty.push(i);
  if (!empty.length) return heuristic(g);
  const sample = empty.length > 6 ? empty.filter((_, k) => k % Math.ceil(empty.length / 6) === 0) : empty;
  let total = 0;
  for (const i of sample) {
    g[i] = 1; total += 0.9 * maxNode(g, depth - 1);
    g[i] = 2; total += 0.1 * maxNode(g, depth - 1);
    g[i] = 0;
  }
  return total / sample.length;
}

/** values = flat array of tile values (0 empty). Returns best direction or null. */
export function aiChoose(values, depth = 2) {
  const g = values.map(v => (v ? Math.round(Math.log2(v)) : 0));
  let bestD = null, best = -Infinity;
  for (const d of ORDER) {
    const r = slide(g, d); if (!r.moved) continue;
    const v = chanceNode(r.g, depth) + r.score * 2;
    if (v > best) { best = v; bestD = d; }
  }
  return bestD;
}
