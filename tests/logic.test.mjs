// node tests/logic.test.mjs  — pure logic checks (no browser)
import { FuseGame, makeRng } from '../js/logic.js';
import { zoneForTile, nextMilestone, fourChanceFor, MILESTONES, modifierFor, MOD_FROM, SURGE_MULT } from '../js/config.js';
let fails = 0;
const eq = (a, b, m) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fails++; console.error('FAIL', m, JSON.stringify(a), '!=', JSON.stringify(b)); } else console.log('ok  ', m); };
function setRow(g, rows) { g.restore({ values: rows.flat(), score: 0, moves: 0, maxTile: 0 }); }
const g = new FuseGame({ rng: makeRng(1) });
const firstRow = (g) => g.values().slice(0, 4);
setRow(g, [[2, 2, 2, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]); g.move('left'); eq(firstRow(g), [4, 4, 0, 0], '2 2 2 2 -> 4 4');
setRow(g, [[2, 2, 4, 4], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]); g.move('left'); eq(firstRow(g), [4, 8, 0, 0], '2 2 4 4 -> 4 8');
setRow(g, [[4, 2, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]); g.move('left'); eq(firstRow(g), [4, 4, 0, 0], 'no double merge 4 2 2 -> 4 4');
setRow(g, [[2, 0, 2, 4], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]); g.move('right'); eq(firstRow(g), [0, 0, 4, 4], 'right 2 . 2 4 -> . . 4 4');
setRow(g, [[2, 0, 0, 0], [2, 0, 0, 0], [4, 0, 0, 0], [4, 0, 0, 0]]); g.move('up'); eq([g.values()[0], g.values()[4]], [4, 8], 'up column merge');
setRow(g, [[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]]); eq(g.canMove(), false, 'full no-move board detected');
eq(g.move('left'), null, 'no-op move returns null');
setRow(g, [[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]); const r = g.move('left'); eq([r.gained, r.merges.length, r.slides.filter(s => s.consumed).length], [4, 1, 2], 'move record');
eq(g.score, 4, 'score accumulates');
const f = new FuseGame({ rng: makeRng(42) }); let ok = true;
for (let i = 0; i < 3000 && !f.over; i++) { const before = f.values().reduce((a, b) => a + b, 0); const res = f.move(['up', 'left', 'down', 'right'][i % 4]); if (!res) continue; const after = f.values().reduce((a, b) => a + b, 0); if (after !== before + (res.spawned ? res.spawned.v : 0)) ok = false; }
eq(ok, true, 'fuzz: value sum invariant');
eq(MILESTONES.map(zoneForTile), MILESTONES.map((m, i) => i + 2), 'zoneForTile matches authored milestones');
eq([zoneForTile(262144), zoneForTile(1 << 20), nextMilestone(131072), nextMilestone(64), nextMilestone(128)], [13, 15, 262144, 128, 256], 'endless zones continue past 131072');
eq([fourChanceFor(1), fourChanceFor(6), fourChanceFor(10), fourChanceFor(99)], [0.1, 0.1, 0.14, 0.2], 'four-spawn chance capped at 20%');
const z = new FuseGame({ rng: makeRng(3) }); z.fourChance = 1; z.reset(); eq(z.values().filter(v => v).every(v => v === 4), true, 'fourChance honoured');

// v1.2
{
  const g2 = new FuseGame({ rng: makeRng(9) });
  g2.restore({ values: [2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], score: 0, moves: 0, maxTile: 2 });
  const pr = g2.move('left', { pulse: true });
  eq(!!pr && pr.pulse && pr.merges.length === 1 && pr.merges[0].v === 4, true, 'pulse merges adjacent equals');
  eq(g2.values()[0], 4, 'pulse result in place');
}
{
  const g2 = new FuseGame({ rng: makeRng(2) });
  g2.restore({ values: [2, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], score: 0, moves: 0, maxTile: 2 });
  eq(g2.move('left', { pulse: true }), null, 'pulse ignores non-adjacent');
}
{
  const g2 = new FuseGame({ rng: makeRng(3) });
  g2.restore({ values: [8, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], score: 0, moves: 0, maxTile: 8 });
  g2.armLock(1);
  const lockedId = g2.lockedId;
  eq(!!g2.move('left'), true, 'lock still allows other merges');
  const still = g2.tiles().find(t => t.id === lockedId) || g2.tiles().find(t => t.v === 8);
  eq(!!still && still.r === 0 && still.c === 0, true, 'locked 8 stayed in place');
}
{
  const g2 = new FuseGame({ rng: makeRng(4) });
  g2.restore({ values: [2, 2, 4, 8, 16, 32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], score: 0, moves: 0, maxTile: 32 });
  g2.move('left');
  const before = g2.values().slice();
  const sw = g2.driftSwap();
  eq(!!sw, true, 'driftSwap returns pair');
  eq(g2.values().reduce((a, b) => a + b, 0), before.reduce((a, b) => a + b, 0), 'drift preserves sum');
}
{
  const g2 = new FuseGame({ rng: makeRng(5) });
  g2.restore({ values: [2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], score: 0, moves: 0, maxTile: 2 });
  g2.setSurge(true);
  const rr = g2.move('left');
  eq(rr.gained, Math.round(4 * SURGE_MULT), 'surge multiplies score');
}
eq([modifierFor(1), modifierFor(2), modifierFor(3), modifierFor(4), modifierFor(5), modifierFor(6)], [null, null, 'drift', 'lock', 'surge', 'echo'], 'modifier schedule');
eq(MOD_FROM, 3, 'mods from zone 3');
{
  const g2 = new FuseGame({ rng: makeRng(6) });
  g2.restore({ values: [2, 2, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], score: 0, moves: 0, maxTile: 4 });
  eq(g2.hintDir(), 'left', 'hint prefers merge direction');
}

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
