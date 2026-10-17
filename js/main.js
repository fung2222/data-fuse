// DATA FUSE 數據熔合 — game controller.
// v1.2: feel polish + ZONE MODS + PULSE FUSE + HINT + How-to.
import * as THREE from 'three';
import {
  i18n, t, themeLabel, flags, createStore, createStage, ThemeController, themeFor, U, Particles, Shockwaves, FxState, NeonCity,
  createInput, CyberUI, Platform, createAds, readHub, returnToHub, shouldShowArcadeMenu
} from 'cyber-kit';
import {
  GAME_ID, SIZE, UNDO_DEPTH, UNDO_FREE, UNDO_REWARD, MILESTONES, AI_DEMO_INTERVAL, AI_ATTRACT_INTERVAL, AI_DEPTH,
  BOARD_Y, BOARD_HALF, ADS, colorOf, tierOf, zoneForTile, nextMilestone, prevMilestone, fourChanceFor,
  modifierFor, SURGE_UNDO_BONUS, PULSE_HOLD_MS, T_ECHO_SPAWN,
} from './config.js';
import './strings.js';
import { FuseGame, makeRng } from './logic.js';
import { aiChoose } from './ai.js';
import { BoardView, cellPos } from './board.js';
import { FuseAudio } from './audio.js';
import { loadFonts, fmt } from './labels.js';
import { ComboAura, MergeHint, slideTrail } from './polish.js';

const $ = (id) => document.getElementById(id);
const store = createStore(GAME_ID);
if (flags.reset) store.clear();
const ui = new CyberUI({ screens: ['start', 'pause', 'over'] });

let stage;
try {
  stage = createStage({ canvas: $('scene'), bloom: 0.9, bloomRadius: 0.5, bloomThreshold: 0.78, fov: 46, exposure: 1.05, onFatal: (m) => ui.fatal(m) });
} catch (e) { throw e; }
ui.glowToggle(stage);
const { scene, camera } = stage;

const theme = new ThemeController();
theme.set(1, true);
const city = new NeonCity(stage, {
  floor: 'reflect', innerRadius: 20, buildings: 260,
  billboard: { zh: '數據熔合', en: 'D A T A   F U S E', pos: [0, 22, -46], width: 30 },
  dustArea: 30, dustHeight: 12,
});
const board = new BoardView(scene);
const particles = new Particles(scene, 2200, { floorY: BOARD_Y + 0.05 });
stage.onResize((w, h, pr) => particles.resize(h, pr));
const waves = new Shockwaves(scene, 10);
const fx = new FxState();
const comboAura = new ComboAura(scene);
const mergeHint = new MergeHint();
const audio = new FuseAudio(store);
ui.setMuted(audio.muted);
const ads = createAds({ gameId: GAME_ID, ...ADS, onAdOpen: (on) => audio.duckAll(on) });

const S = {
  state: 'attract',
  demo: !!flags.demo,
  game: new FuseGame(flags.seed != null ? { rng: makeRng(flags.seed) } : {}),
  attract: new FuseGame(),
  history: [],
  undo: UNDO_FREE,
  zone: 1,
  mod: null,
  bestTile: store.getNum('bestTile', 0),
  aiT: 0, overT: 0, t: 0,
  newRecord: false,
  pulseArm: 0,
  lastDir: 'up',
};
window.__fuse = S;

function snapshotFull() { return S.game.snapshot(); }
function saveRun() {
  if (S.demo || S.state === 'attract') return;
  if (S.game.over) { store.remove('save'); return; }
  store.setJSON('save', { v: 2, snap: snapshotFull(), history: S.history, undo: S.undo, zone: S.zone, mod: S.mod });
}
function loadRun() {
  const s = store.getJSON('save');
  return s && (s.v === 1 || s.v === 2) && s.snap && Array.isArray(s.snap.values) ? s : null;
}

function setHintUi(on) { const b = $('btn-hint'); if (b) b.classList.toggle('off', !on); }
setHintUi(mergeHint.enabled);

function paintModChip() {
  const chip = $('hud-mod'), name = $('hud-mod-name'), sub = $('hud-mod-sub');
  if (!chip) return;
  if (!S.mod || S.state === 'attract') { chip.classList.add('hidden'); return; }
  chip.classList.remove('hidden', 'drift', 'lock', 'surge', 'echo');
  chip.classList.add(S.mod);
  name.textContent = t('mod.' + S.mod);
  sub.textContent = t('mod.' + S.mod + 'S');
}

function updateHUD(bump = false) {
  const g = S.game; g.fourChance = fourChanceFor(S.zone);
  ui.setText('hud-score', g.score.toLocaleString('en-US'));
  ui.setText('hud-best', Math.max(store.best, g.score).toLocaleString('en-US'));
  ui.setText('hud-zone', S.zone);
  ui.setText('hud-core', fmt(g.maxTile));
  const nm = nextMilestone(g.maxTile), prev = prevMilestone(g.maxTile);
  ui.setText('hud-next', fmt(nm));
  const p = Math.max(0, Math.min(1, (Math.log2(g.maxTile) - Math.log2(prev)) / (Math.log2(nm) - Math.log2(prev))));
  $('hud-progress').style.width = (g.maxTile >= prev ? p * 100 : (Math.log2(g.maxTile) / Math.log2(nm)) * 100).toFixed(1) + '%';
  ui.setText('hud-zone-name', themeLabel(themeFor(S.zone)) + (S.zone > MILESTONES.length + 1 ? ' · ' + t('endless') : ''));
  const badge = $('undo-badge'), btn = $('btn-undo');
  if (S.undo > 0) { badge.textContent = S.undo; badge.classList.remove('ad'); }
  else { badge.textContent = ads.isNative ? 'AD' : '+3'; badge.classList.add('ad'); }
  btn.classList.toggle('disabled', !S.history.length || S.demo);
  const cw = $('hud-combo-wrap'), cb = $('hud-combo');
  if (cw && cb) {
    const show = g.combo >= 2 && S.state !== 'attract';
    cw.classList.toggle('hidden', !show);
    cw.classList.toggle('hot', g.combo >= 3);
    cb.textContent = '×' + Math.max(1, g.combo);
  }
  paintModChip();
  board.setLocked(g.lockLeft > 0 ? g.lockedId : null);
  if (bump) ui.bump('hud-score');
}

function refreshStart() {
  const s = loadRun();
  $('btn-continue').classList.toggle('hidden', !s);
  if (s) ui.setText('continue-sub', t('continueS', { score: s.snap.score.toLocaleString('en-US') }));
  ui.setText('start-best', store.best.toLocaleString('en-US'));
  ui.setText('start-tile', S.bestTile ? fmt(S.bestTile) : '—');
  ui.setText('start-zone', S.bestTile >= 128 ? zoneForTile(S.bestTile) : '—');
}

function setState(s) {
  S.state = s;
  ui.show({ attract: 'start', paused: 'pause', over: 'over' }[s] || null);
  ui.hud(s === 'playing' || s === 'paused' || s === 'over');
  $('demo-tag').classList.toggle('hidden', !S.demo);
}

function applyZoneMod(zone, { announce = false } = {}) {
  S.mod = modifierFor(zone);
  S.game.setSurge(S.mod === 'surge');
  if (S.mod === 'lock') S.game.armLock();
  else if (S.game.lockLeft <= 0) S.game.clearLock();
  if (announce && S.mod) {
    audio.modChime();
    ui.toast(t('mod.' + S.mod) + ' · ' + t('mod.' + S.mod + 'S'), 2400);
  }
  paintModChip();
}

function prefillAttract() {
  S.attract.reset();
  for (let i = 0; i < 70 && !S.attract.over; i++) { const d = aiChoose(S.attract.values(), 1); if (!d || !S.attract.move(d)) break; }
}
function showAttract() {
  prefillAttract(); board.sync(S.attract, true); board.setDim(1);
  S.zone = 1; S.mod = null; theme.set(1); S.game.setSurge(false); S.game.clearLock();
  paintModChip();
  refreshStart(); setState('attract'); audio.unduckMusic(); audio.stopAmbient();
}

function beginRun(resume) {
  audio.init(); audio.startMusic(); audio.unduckMusic(); audio.startAmbient();
  const s = resume ? loadRun() : null;
  if (s) {
    S.game.restore(s.snap); S.history = s.history || []; S.undo = s.undo ?? UNDO_FREE;
  } else {
    S.game.reset(); S.history = []; S.undo = UNDO_FREE;
  }
  S.zone = zoneForTile(S.game.maxTile); theme.set(S.zone); audio.setLevel(S.zone);
  applyZoneMod(S.zone, { announce: false });
  S.newRecord = false; S.aiT = 0; mergeHint.clear();
  board.sync(S.game, true); board.setDim(1); board.danger = 0;
  setState('playing'); updateHUD(); saveRun();
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) board.heatCell(r, c, 0.6);
  audio.confirm();
}

function comboToast(x, y, n) {
  const d = document.createElement('div');
  d.className = 'popup combo-toast';
  d.style.left = x + 'px'; d.style.top = y + 'px';
  d.textContent = t('comboText', { n });
  (ui.el.popups || document.body).appendChild(d);
  setTimeout(() => d.remove(), 1100);
}

function doMove(d, game = S.game, live = true, { pulse = false } = {}) {
  board.finishAll();
  const before = live ? game.snapshot() : null;
  const rec = game.move(d, { pulse });
  if (!rec) {
    if (live) {
      board.nudge(d, 0.35); audio.bump();
      game.combo = 0;
      const hd = mergeHint.enabled ? game.hintDir() : null;
      if (hd) { mergeHint.show(hd); paintHintChevron(); }
      updateHUD();
    }
    return false;
  }
  S.lastDir = d;
  mergeHint.clear(); paintHintChevron();
  if (live) { S.history.push(before); if (S.history.length > UNDO_DEPTH) S.history.shift(); }
  board.nudge(d, live ? (pulse ? 1.25 : 1) : 0.6);
  if (live || S.state === 'attract') { if (pulse) audio.pulseArm(); else audio.slide(); }

  // slide trails
  if (live || S.state === 'attract') {
    for (const s of rec.slides) {
      if (s.fromR === s.toR && s.fromC === s.toC) continue;
      const from = cellPos(s.fromR, s.fromC), to = cellPos(s.toR, s.toC);
      const tv = board.get(s.id);
      const col = new THREE.Color(tv ? colorOf(tv.v) : 0x00e5ff);
      slideTrail(particles, from, to, col, pulse ? 14 : 8);
    }
  }

  let chain = 0;
  const echoDelay = (S.mod === 'echo' && live && rec.spawned) ? T_ECHO_SPAWN : 0;
  if (echoDelay && rec.spawned) {
    board.heatCell(rec.spawned.r, rec.spawned.c, 1);
    // delay spawn visual: strip spawned from rec for applyMove, schedule later
    const sp = rec.spawned;
    const rec2 = { ...rec, spawned: null };
    board.applyMove(rec2, (m, pos) => onMerge(m, pos, chain++, live, rec));
    setTimeout(() => {
      if (!sp) return;
      const tv = board.alloc(sp.id, sp.v, sp.r, sp.c);
      board.spawnAnim(tv);
      if (live) audio.spawn();
    }, echoDelay * 1000);
  } else {
    board.applyMove(rec, (m, pos) => onMerge(m, pos, chain++, live, rec));
    if (rec.spawned && live) setTimeout(() => audio.spawn(), 90);
  }

  if (!live) return true;
  if (rec.gained) { S.game.score > store.best && !S.newRecord && store.best > 0 && (S.newRecord = true); }

  // DRIFT after a merge swipe
  if (S.mod === 'drift' && rec.merges.length && !game.over) {
    const sw = game.driftSwap();
    if (sw) {
      setTimeout(() => {
        board.swapTiles(sw.a, sw.b, sw.ar, sw.ac, sw.br, sw.bc);
        audio.drift();
      }, 140);
    }
  }

  // re-arm lock if still in lock zone and lock expired this move
  if (S.mod === 'lock' && game.lockLeft <= 0 && !game.over) {
    // only re-arm at zone entry; one lock per zone entry is enough — leave expired
  }

  const z = zoneForTile(game.maxTile);
  if (z > S.zone) { S.zone = z; reachMilestone(game.maxTile); }
  updateHUD(rec.gained > 0);
  if (store.submitBest(game.score)) {}
  if (game.maxTile > S.bestTile) { S.bestTile = game.maxTile; store.setNum('bestTile', S.bestTile); }
  const empty = game.empty().length;
  board.danger = empty <= 1 ? 1 : empty <= 3 ? 0.45 : 0;
  saveRun();
  if (game.over) gameOver();
  return true;
}

function onMerge(m, pos, chain, live, rec) {
  const tier = tierOf(m.v), col = new THREE.Color(colorOf(m.v));
  const feel = rec?.tier || 'normal';
  board.heatCell(m.r, m.c, 1);
  board.pulseAt(pos.x, pos.z, Math.min(1.6, 0.5 + tier * 0.08));
  if (!live && S.state === 'attract') { particles.burst(pos, col, 14, { speed: 2.5, up: 2, life: 0.5, size: 0.7 }); return; }
  audio.merge(tier, chain, feel);
  const big = tier >= 7 || feel === 'legendary' || feel === 'pulse';
  const count = feel === 'legendary' ? 90 : feel === 'pulse' || feel === 'multi' ? 55 : big ? 70 : 26 + tier * 2;
  particles.burst(pos, col, count, { speed: big ? 6 : 3.4, up: big ? 5 : 3, life: big ? 1.0 : 0.6, size: big ? 1.2 : 0.8, color2: new THREE.Color(0xffffff) });
  waves.spawn(new THREE.Vector3(pos.x, BOARD_Y + 0.05, pos.z), col, { r0: 0.2, r1: big ? 5 : 1.4 + tier * 0.12, h: big ? 0.9 : 0.35, dur: big ? 0.7 : 0.45 });
  city.pulse(pos.x * 3, pos.z * 3 - 4, big ? 1.4 : 0.4);
  if (big) { fx.kick({ trauma: 0.18 + (tier - 7) * 0.04, aberr: 0.6 }); Platform.haptic('medium'); }
  else Platform.haptic('light');
  if (tier >= 4 || feel === 'pulse' || feel === 'multi') {
    const sp = stage.toScreen(pos.clone().setY(pos.y + 0.6));
    const cls = feel === 'legendary' ? 'legendary' : feel === 'pulse' ? 'pulse' : feel === 'multi' ? 'multi' : big ? 'big' : 'merge';
    ui.popup(sp.x, sp.y, '+' + m.v, rec?.scoreMult > 1 ? '×' + rec.scoreMult : '', cls);
    if (rec?.combo >= 2 && chain === 0) {
      comboAura.pulse(pos.x, pos.z, rec.combo >= 4 ? 1.4 : 1);
      comboToast(sp.x, sp.y - 36, rec.combo);
      audio.combo(rec.combo);
    }
  }
  // PERFECT FUSE: every moving tile was consumed into a merge
  if (live && chain === 0 && rec?.merges?.length && rec.slides.every(s => s.consumed || (s.fromR === s.toR && s.fromC === s.toC))) {
    ui.toast(t('perfectFuse'), 1200);
  }
}

function reachMilestone(v) {
  theme.set(S.zone); audio.setLevel(S.zone); audio.levelUp();
  const th = themeFor(S.zone);
  const special = v === 2048 ? t('legendary') : v > MILESTONES[MILESTONES.length - 1] ? t('endlessZone', { n: S.zone }) : v >= 4096 ? t('beyond') : t('entering', { name: themeLabel(th) });
  const mod = modifierFor(S.zone);
  ui.banner(t('fuseN', { v: fmt(v) }), t('zoneN', { n: S.zone }), mod ? t('mod.' + mod) : special);
  S.game.fourChance = fourChanceFor(S.zone);
  applyZoneMod(S.zone, { announce: !!mod });
  if (S.undo < UNDO_FREE) { S.undo++; ui.toast(t('zoneBonus'), 2200); }
  if (mod === 'surge' && S.undo < UNDO_FREE + SURGE_UNDO_BONUS) { S.undo = Math.min(UNDO_FREE + SURGE_UNDO_BONUS, S.undo + SURGE_UNDO_BONUS); }
  ui.flash(`rgba(255,255,255,${v >= 2048 ? 0.55 : 0.28})`, 420);
  fx.kick({ trauma: 0.3, aberr: 1, glitch: 0.5, fovKick: 1 });
  const c = new THREE.Color(colorOf(v));
  particles.ring(new THREE.Vector3(0, BOARD_Y + 0.1, 0), c, 160, 9, BOARD_Y + 0.1);
  waves.spawn(new THREE.Vector3(0, BOARD_Y, 0), c, { r0: 1, r1: 14, h: 2.2, dur: 1.1, a: 3 });
  city.pulse(0, -6, 2.2);
  Platform.haptic('success');
}

function gameOver() {
  S.overT = 0;
  setTimeout(() => {
    if (!S.game.over || S.state !== 'playing') return;
    audio.saturated(); audio.stopAmbient(); fx.kick({ glitch: 0.8, aberr: 1, trauma: 0.25 }); board.setDim(0.45); board.danger = 1;
    ui.flash('rgba(255,40,90,0.35)', 600); Platform.haptic('error');
    if (S.demo) { setTimeout(() => S.demo && beginRun(false), 2600); return; }
    store.remove('save');
    ui.setText('over-score', S.game.score.toLocaleString('en-US'));
    ui.setText('over-tile', fmt(S.game.maxTile));
    ui.setText('over-moves', S.game.moves);
    ui.setText('over-best', store.best.toLocaleString('en-US'));
    $('newrecord').classList.toggle('hidden', !(S.game.score >= store.best && S.game.score > 0 && S.newRecord));
    const canRevive = S.history.length > 0 && ads.rewardedAvailable();
    $('btn-revive').classList.toggle('hidden', !canRevive);
    ui.setText('revive-sub', t(ads.isNative ? 'rewindAd' : 'rewindFree'));
    setState('over');
  }, 520);
}

async function revive() {
  if (S.state !== 'over' || !S.history.length) return;
  audio.click();
  const r = await ads.rewarded('revive');
  if (!r.rewarded) { ui.toast(t('noReward')); return; }
  const snap = S.history[0]; S.history = [];
  S.game.restore(snap); board.sync(S.game, true); board.setDim(1); board.danger = 0.45;
  S.zone = zoneForTile(S.game.maxTile);
  applyZoneMod(S.zone);
  setState('playing'); updateHUD(); saveRun(); audio.undo(); audio.unduckMusic(); audio.startAmbient();
  ui.toast(t('rewound'), 1400);
}

async function undo() {
  if (S.state !== 'playing' || S.demo || ui.modalOpen) return;
  if (!S.history.length) { audio.denied(); ui.toast(t('nothingUndo')); return; }
  if (S.undo <= 0) {
    const ok = await ui.confirm(ads.isNative
      ? { kicker: 'UNDO', title: t('undoMoreQ'), text: t('adText'), ok: t('kit.watchAd'), okSmall: '+3', cancel: t('kit.noThanks'), cancelSmall: '' }
      : { kicker: 'UNDO', title: t('undoMore'), text: t('freeText'), ok: t('claim'), okSmall: '+3', cancel: t('kit.noThanks'), cancelSmall: '' });
    if (!ok) return;
    const r = await ads.rewarded('undo');
    if (!r.rewarded) { ui.toast(t('noReward')); return; }
    S.undo += UNDO_REWARD; updateHUD();
    if (S.state !== 'playing') return;
  }
  S.undo--;
  const snap = S.history.pop();
  S.game.restore(snap); board.sync(S.game, false);
  for (const tv of board.pool) if (tv.active) { tv.mat.uniforms.uGlow.value = 0.8; board.anims.push({ tv, kind: 'pop', t: 0.1, dur: 0.24 }); }
  S.zone = Math.max(1, Math.min(S.zone, zoneForTile(S.game.maxTile)));
  applyZoneMod(S.zone);
  board.danger = S.game.empty().length <= 1 ? 1 : 0;
  fx.kick({ aberr: 0.7, glitch: 0.25 }); audio.undo(); Platform.haptic('light');
  updateHUD(); saveRun();
}

async function tryPulse(d) {
  if (S.state !== 'playing' || S.demo || ui.modalOpen) return false;
  if (S.undo <= 0) { audio.denied(); ui.toast(t('pulseNeed')); return false; }
  // peek: would pulse work?
  const probe = new FuseGame({ rng: () => 0 });
  probe.restore(S.game.snapshot());
  probe.lockedId = S.game.lockedId; probe.lockLeft = S.game.lockLeft; probe.nextId = S.game.nextId + 5000;
  probe.scoreMult = S.game.scoreMult;
  if (!probe.move(d, { pulse: true })) { audio.bump(); ui.toast(t('pulseNo')); return false; }
  S.undo--;
  audio.pulseArm();
  return doMove(d, S.game, true, { pulse: true });
}

function pause() { if (S.state !== 'playing') return; setState('paused'); audio.duckMusic(); audio.back(); }
function resume() { if (S.state !== 'paused') return; setState('playing'); audio.unduckMusic(); audio.click(); }
function toMenu() { saveRun(); audio.back(); showAttract(); }

async function newGameConfirm() {
  if (S.state !== 'playing' || ui.modalOpen) return;
  if (S.game.moves > 0 && !S.demo) {
    const ok = await ui.confirm({ kicker: 'NEW GAME', title: t('newQ'), text: t('newText'), ok: t('newGame'), okSmall: '', cancel: t('keepPlaying'), cancelSmall: '' });
    if (!ok) return;
  }
  beginRun(false);
}
async function retry() {
  if (S.state !== 'over') return;
  audio.click();
  await ads.naturalBreak('gameover');
  beginRun(false);
}
async function overToMenu() { if (S.state !== 'over') return; await ads.naturalBreak('gameover'); showAttract(); }

function paintHintChevron() {
  const el = $('hint-chevron'); if (!el) return;
  if (!mergeHint.active) { el.classList.remove('on'); el.textContent = ''; board.setHint(null, 0); return; }
  const map = { up: '▲', down: '▼', left: '◀', right: '▶' };
  el.textContent = map[mergeHint.dir] || '';
  el.classList.add('on');
  board.setHint(mergeHint.dir, mergeHint.strength);
}

function setPulseMeter(frac) {
  const fill = $('pulse-fill'), btn = $('btn-pulse');
  if (fill) fill.style.width = (Math.max(0, Math.min(1, frac)) * 100) + '%';
  if (btn) btn.classList.toggle('arming', frac >= 1);
}

S.api = {
  resync: () => { board.sync(S.game, true); applyZoneMod(S.zone); updateHUD(); },
  endlessTest: () => { const v = Array(SIZE * SIZE).fill(0); v[0] = v[1] = 131072; v[5] = 2; S.game.restore({ values: v, score: S.game.score, moves: S.game.moves, maxTile: 131072 }); S.zone = zoneForTile(131072); applyZoneMod(S.zone); board.sync(S.game, true); doMove('left'); },
  move: (d) => doMove(d),
  pulse: (d) => tryPulse(d || S.lastDir),
  undo: () => undo(),
  forceOver: () => { S.game.restore({ values: Array.from({ length: SIZE * SIZE }, (_, i) => ((Math.floor(i / SIZE) + i) % 2 ? 4 : 2) * (i === 0 ? 8 : 1)), score: S.game.score, moves: S.game.moves, maxTile: 0 }); board.sync(S.game); gameOver(); },
};

// ------------------------------------------------------------------ input
let holdDir = null, holdTimer = 0, holdRaf = 0, pulsed = false;
function clearHold() {
  holdDir = null; pulsed = false; setPulseMeter(0);
  if (holdTimer) { clearTimeout(holdTimer); holdTimer = 0; }
  if (holdRaf) { cancelAnimationFrame(holdRaf); holdRaf = 0; }
}
function armHold(d) {
  clearHold();
  holdDir = d; pulsed = false;
  const t0 = performance.now();
  const tick = () => {
    if (!holdDir) return;
    const k = (performance.now() - t0) / PULSE_HOLD_MS;
    setPulseMeter(k);
    if (k >= 1) { pulsed = true; const dir = holdDir; clearHold(); tryPulse(dir); return; }
    holdRaf = requestAnimationFrame(tick);
  };
  holdRaf = requestAnimationFrame(tick);
}

createInput({
  anyGesture() { audio.init(); audio.startMusic(); },
  dir(d) {
    if (ui.modalOpen) return;
    if (S.state === 'playing' && !S.demo) {
      // createInput swipe:once fires on swipe; also keydowns fire dir each press.
      // Hold-to-pulse is handled via keydown tracking below + pulse button.
      doMove(d);
    }
  },
  action(a) {
    if (ui.modalOpen) { if (a === 'pause') ui.closeModal(); return; }
    if (a === 'primary') { if (S.state === 'attract') beginRun(!!loadRun()); else if (S.state === 'paused') resume(); else if (S.state === 'over') retry(); }
    else if (a === 'pause') { if (S.state === 'playing') pause(); else if (S.state === 'paused') resume(); }
    else if (a === 'mute') toggleMute();
    else if (a === 'undo') undo();
    else if (a === 'restart') { if (S.state === 'over') retry(); else newGameConfirm(); }
    else if (a === 'fps') $('fps').classList.toggle('hidden');
    else if (a === 'hint') { setHintUi(mergeHint.toggle()); audio.click(); }
    else if (a === 'pulse') tryPulse(S.lastDir);
  },
  holdStart() {
    if (S.state !== 'playing' || S.demo || ui.modalOpen) return;
    armHold(S.lastDir || 'up');
  },
  holdEnd() {
    if (pulsed) { clearHold(); return; }
    clearHold();
  },
}, { swipe: 'once', threshold: 22, holdMs: PULSE_HOLD_MS, actions: { KeyH: 'hint', KeyX: 'pulse' } });

// Remember last keyboard direction for Pulse (KeyX / button).
window.addEventListener('keydown', (e) => {
  const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
  if (map[e.code]) S.lastDir = map[e.code];
});

function toggleMute() { audio.init(); const m = audio.toggleMute(); ui.setMuted(m); if (m) audio.stopAmbient(); else if (S.state === 'playing') audio.startAmbient(); }
ui.on('btn-start', () => { audio.init(); beginRun(false); });
const __hub = readHub();
if (shouldShowArcadeMenu(__hub)) { const b = document.getElementById('btn-arcade-menu'); if (b) b.classList.remove('hidden'); }
ui.on('btn-arcade-menu', () => { try { audio.back(); } catch {} returnToHub({ gameId: 'data-fuse', openStore: false }); });

ui.on('btn-continue', () => { audio.init(); beginRun(true); });
ui.on('btn-resume', resume);
ui.on('btn-quit', toMenu);
ui.on('btn-pause', pause);
ui.on('btn-mute', toggleMute);
ui.on('btn-undo', undo);
ui.on('btn-new', newGameConfirm);
ui.on('btn-hint', () => { setHintUi(mergeHint.toggle()); audio.click(); });
ui.on('btn-pulse', () => tryPulse(S.lastDir || 'up'));
// Pulse button hold
(() => {
  const btn = $('btn-pulse'); if (!btn) return;
  let holding = false;
  const down = (e) => { e.preventDefault(); holding = true; armHold(S.lastDir || 'up'); };
  const up = () => { if (!holding) return; holding = false; if (!pulsed) clearHold(); };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointerleave', up);
  btn.addEventListener('pointercancel', up);
})();
i18n.bindToggle($('btn-lang')); i18n.bindToggle($('btn-lang2'));
i18n.onChange(() => { updateHUD(); if (S.state === 'attract') refreshStart(); if (S.state === 'over') ui.setText('revive-sub', t(ads.isNative ? 'rewindAd' : 'rewindFree')); });
ui.on('btn-retry', retry);
ui.on('btn-menu', overToMenu);
ui.on('btn-revive', revive);

ui.mountHowto({
  privacyUrl: './privacy.html',
  onOpen: () => { try { audio.click(); } catch (_) {} },
  getContent: () => ({
    kicker: 'DATA FUSE',
    title: t('kit.howto'),
    sections: [
      { heading: t('kit.rules'), body: t('help.rules') },
      { heading: t('kit.controls'), body: t('help.controls') },
    ],
  }),
});
ui.mountSettings({
  audio, stage,
  onOpen: () => { try { audio.click(); } catch (_) {} },
});


Platform.onBack(() => {
  if (ui.closeModal()) return true;
  if (S.state === 'playing') { pause(); return true; }
  if (S.state === 'paused') { resume(); return true; }
  if (S.state === 'over') { overToMenu(); return true; }
  return false;
});
Platform.onPause(() => { saveRun(); if (S.state === 'playing' && !S.demo) pause(); });

const camPos = new THREE.Vector3(0, 20, 14), camLook = new THREE.Vector3(0, BOARD_Y, 0);
const tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3();
function frameCamera(dt, now, instant = false) {
  const aspect = stage.width / stage.height, portrait = aspect < 0.9;
  const attract = S.state === 'attract';
  const vfov = portrait ? 50 : 42;
  camera.fov = vfov + fx.fovKick * 3; camera.updateProjectionMatrix();
  const pitch = THREE.MathUtils.degToRad(attract ? (portrait ? 50 : 40) : (portrait ? 64 : 58));
  const halfW = BOARD_HALF + 0.35;
  const tanV = Math.tan(THREE.MathUtils.degToRad(vfov / 2)), tanH = tanV * aspect;
  const usable = portrait ? 0.6 : 0.74;
  const dW = halfW / (tanH * (portrait ? 0.97 : 0.9)) + halfW * Math.cos(pitch);
  const dH = halfW * Math.sin(pitch) / (tanV * usable) + halfW * Math.cos(pitch);
  let d = Math.max(dW, dH);
  let yaw = Math.sin(now * 0.13) * 0.035, lx = 0, lz = portrait ? -0.45 : 0;
  if (attract) {
    yaw = Math.sin(now * 0.12) * 0.4; d *= portrait ? 1.1 : 1.3;
    if (!portrait) lx = -BOARD_HALF * 0.95; else lz = 2.2;
  }
  tmpL.set(lx, BOARD_Y, lz);
  tmpP.set(Math.sin(yaw) * Math.cos(pitch) * d, Math.sin(pitch) * d, Math.cos(yaw) * Math.cos(pitch) * d).add(tmpL);
  if (attract && !portrait) tmpP.x += lx;
  const k = instant ? 1 : 1 - Math.exp(-dt * 3);
  camPos.lerp(tmpP, k); camLook.lerp(tmpL, k);
  camera.position.copy(camPos); camera.lookAt(camLook);
  fx.shake(camera, now, 0.6);
}

function tick(dt, now) {
  S.t = now; U.uTime.value = now;
  theme.update(dt); fx.update(dt);
  mergeHint.update(dt); paintHintChevron();
  comboAura.update(dt, new THREE.Color(theme.accent));
  if (S.state === 'attract') {
    S.aiT += dt;
    if (S.aiT > AI_ATTRACT_INTERVAL) {
      S.aiT = 0;
      if (S.attract.over || S.attract.maxTile >= 1024) { prefillAttract(); board.sync(S.attract, true); }
      else { const d = aiChoose(S.attract.values(), 1); if (d) doMove(d, S.attract, false); }
    }
  } else if (S.state === 'playing' && S.demo && !S.game.over) {
    S.aiT += dt;
    if (S.aiT > AI_DEMO_INTERVAL) { S.aiT = 0; const d = aiChoose(S.game.values(), AI_DEPTH); if (d) doMove(d); }
  }
  board.update(dt, now);
  particles.update(dt); waves.update(dt);
  city.update(now, dt, camera);
  frameCamera(dt, now);
  fx.applyPost(stage, now);
  ui.tick(dt);
  stage.render(dt);
}

async function boot() {
  await loadFonts();
  board.sync(S.attract, false);
  frameCamera(0, 0, true);
  if (S.demo || flags.autostart) { audio.init(); beginRun(!S.demo && !!loadRun()); }
  else showAttract();
  ui.loaded();
  stage.loop(tick, { isActive: () => S.state === 'playing' || S.state === 'attract', fpsEl: $('fps') });
  if (flags.fps) $('fps').classList.remove('hidden');
  ads.init().catch(() => {});
}
boot().catch((e) => { console.error(e); ui.fatal(t('fatal') + ': ' + e.message); });
