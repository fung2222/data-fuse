// node tests/ai.bench.mjs — how far does the demo AI get? (sanity / tuning)
import { FuseGame, makeRng } from '../js/logic.js';
import { aiChoose } from '../js/ai.js';
const res = [];
for (let s = 1; s <= 2; s++) {
  const g = new FuseGame({ rng: makeRng(s) }); const t0 = Date.now(); let n = 0;
  while (!g.over && n < 1500) { const d = aiChoose(g.values()); if (!d) break; g.move(d); n++; }
  res.push({ seed: s, max: g.maxTile, score: g.score, moves: n, msPerMove: ((Date.now() - t0) / n).toFixed(2) });
}
console.table(res);
