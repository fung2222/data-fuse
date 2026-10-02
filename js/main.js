// DATA FUSE 數據熔合 — game controller: states, input, undo, milestones, camera, effects, saves, ads hooks.
import * as THREE from 'three';
import {
  i18n, t, themeLabel, flags, createStore, createStage, ThemeController, themeFor, U, Particles, Shockwaves, FxState, NeonCity,
  createInput, CyberUI, Platform, createAds,
} from 'cyber-kit';
import {
  GAME_ID, SIZE, UNDO_DEPTH, UNDO_FREE, UNDO_REWARD, MILESTONES, AI_DEMO_INTERVAL, AI_ATTRACT_INTERVAL, AI_DEPTH,
  BOARD_Y, BOARD_HALF, ADS, colorOf, tierOf, zoneForTile, nextMilestone, prevMilestone, fourChanceFor,
} from './config.js';
import './strings.js';
import { FuseGame, makeRng } from './logic.js';
import { aiChoose } from './ai.js';
import { BoardView, cellPos } from './board.js';
import { FuseAudio } from './audio.js';
import { loadFonts, fmt } from './labels.js';

const $ = (id) => document.getElementById(id);
const store = createStore(GAME_ID);
if (flags.reset) store.clear();
const ui = new CyberUI({ screens: ['start', 'pause', 'over'] });

let stage;
try {
  stage = createStage({ canvas: $('scene'), bloom: 0.9, bloomRadius: 0.5, bloomThreshold: 0.78, fov: 46, exposure: 1.05, onFatal: (m) => ui.fatal(m) });
} catch (e) { throw e; }
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
const audio = new FuseAudio(store);
ui.setMuted(audio.muted);
const ads = createAds({ gameId: GAME_ID, ...ADS, onAdOpen: (on) => audio.duckAll(on) });

// ------------------------------------------------------------------ state
const S = {
  state: 'attract',          // attract | playing | paused | over
  demo: !!flags.demo,
  game: new FuseGame(flags.seed != null ? { rng: makeRng(flags.seed) } : {}),
  attract: new FuseGame(),
  history: [],               // snapshots for undo (newest last)
  undo: UNDO_FREE,
  zone: 1,
  bestTile: store.getNum('bestTile', 0),
  aiT: 0, overT: 0, t: 0,
  newRecord: false,
};
window.__fuse = S;  // test hook (tests/smoke.py)

function snapshotFull() { return S.game.snapshot(); }
function saveRun() {
  if (S.demo || S.state === 'attract') return;
  if (S.game.over) { store.remove('save'); return; }
  store.setJSON('save', { v: 1, snap: snapshotFull(), history: S.history, undo: S.undo, zone: S.zone });
}
function loadRun() { const s = store.getJSON('save'); return s && s.v === 1 && s.snap && Array.isArray(s.snap.values) ? s : null; }


// ------------------------------------------------------------------ HUD
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

// ------------------------------------------------------------------ flow
function setState(s) {
  S.state = s;
  ui.show({ attract: 'start', paused: 'pause', over: 'over' }[s] || null);
  ui.hud(s === 'playing' || s === 'paused' || s === 'over');
  $('demo-tag').classList.toggle('hidden', !S.demo);
}

function prefillAttract() {
  // play some instant AI moves so the background board is interesting from the first frame
  S.attract.reset();
  for (let i = 0; i < 70 && !S.attract.over; i++) { const d = aiChoose(S.attract.values(), 1); if (!d || !S.attract.move(d)) break; }
}
function showAttract() {
  prefillAttract(); board.sync(S.attract, true); board.setDim(1);
  S.zone = 1; theme.set(1);
  refreshStart(); setState('attract'); audio.unduckMusic();
}

function beginRun(resume) {
  audio.init(); audio.startMusic(); audio.unduckMusic();
  const s = resume ? loadRun() : null;
  if (s) {
    S.game.restore(s.snap); S.history = s.history || []; S.undo = s.undo ?? UNDO_FREE;
  } else {
    S.game.reset(); S.history = []; S.undo = UNDO_FREE;
  }
  S.zone = zoneForTile(S.game.maxTile); theme.set(S.zone); audio.setLevel(S.zone);
  S.newRecord = false; S.aiT = 0;
  board.sync(S.game, true); board.setDim(1); board.danger = 0;
  setState('playing'); updateHUD(); saveRun();
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) board.heatCell(r, c, 0.6);
  audio.confirm();
}

function doMove(d, game = S.game, live = true) {
  board.finishAll();
  const before = live ? game.snapshot() : null;
  const rec = game.move(d);
  if (!rec) {
    if (live) { board.nudge(d, 0.35); audio.bump(); }
    return false;
  }
  if (live) { S.history.push(before); if (S.history.length > UNDO_DEPTH) S.history.shift(); }
  board.nudge(d, live ? 1 : 0.6);
  if (live || S.state === 'attract') audio.slide();
  let chain = 0;
  board.applyMove(rec, (m, pos) => onMerge(m, pos, chain++, live));
  if (rec.spawned && live) setTimeout(() => audio.spawn(), 90);
  if (!live) return true;
  if (rec.gained) { S.game.score > store.best && !S.newRecord && store.best > 0 && (S.newRecord = true); }
  // milestones
  const z = zoneForTile(game.maxTile);
  if (z > S.zone) { S.zone = z; reachMilestone(game.maxTile); }
  updateHUD(rec.gained > 0);
  if (store.submitBest(game.score)) {}
  if (game.maxTile > S.bestTile) { S.bestTile = game.maxTile; store.setNum('bestTile', S.bestTile); }
  // danger glow when the grid is almost full
  const empty = game.empty().length;
  board.danger = empty <= 1 ? 1 : empty <= 3 ? 0.45 : 0;
  saveRun();
  if (game.over) gameOver();
  return true;
}

function onMerge(m, pos, chain, live) {
  const tier = tierOf(m.v), col = new THREE.Color(colorOf(m.v));
  board.heatCell(m.r, m.c, 1);
  board.pulseAt(pos.x, pos.z, Math.min(1.6, 0.5 + tier * 0.08));
  if (!live && S.state === 'attract') { particles.burst(pos, col, 14, { speed: 2.5, up: 2, life: 0.5, size: 0.7 }); return; }
  audio.merge(tier, chain);
  const big = tier >= 7;
  particles.burst(pos, col, big ? 70 : 26 + tier * 2, { speed: big ? 6 : 3.4, up: big ? 5 : 3, life: big ? 1.0 : 0.6, size: big ? 1.2 : 0.8, color2: new THREE.Color(0xffffff) });
  waves.spawn(new THREE.Vector3(pos.x, BOARD_Y + 0.05, pos.z), col, { r0: 0.2, r1: big ? 5 : 1.4 + tier * 0.12, h: big ? 0.9 : 0.35, dur: big ? 0.7 : 0.45 });
  city.pulse(pos.x * 3, pos.z * 3 - 4, big ? 1.4 : 0.4);
  if (big) { fx.kick({ trauma: 0.18 + (tier - 7) * 0.04, aberr: 0.6 }); Platform.haptic('medium'); }
  else Platform.haptic('light');
  if (tier >= 4) {
    const sp = stage.toScreen(pos.clone().setY(pos.y + 0.6));
    ui.popup(sp.x, sp.y, '+' + m.v, '', big ? 'big' : 'merge');
  }
}

function reachMilestone(v) {
  theme.set(S.zone); audio.setLevel(S.zone); audio.levelUp();
  const th = themeFor(S.zone);
  const special = v === 2048 ? t('legendary') : v > MILESTONES[MILESTONES.length - 1] ? t('endlessZone', { n: S.zone }) : v >= 4096 ? t('beyond') : t('entering', { name: themeLabel(th) });
  ui.banner(t('fuseN', { v: fmt(v) }), t('zoneN', { n: S.zone }), special);
  S.game.fourChance = fourChanceFor(S.zone);
  ui.flash(`rgba(255,255,255,${v >= 2048 ? 0.55 : 0.28})`, 420);
  fx.kick({ trauma: 0.3, aberr: 1, glitch: 0.5, fovKick: 1 });
  const c = new THREE.Color(colorOf(v));
  particles.ring(new THREE.Vector3(0, BOARD_Y + 0.1, 0), c, 160, 9, BOARD_Y + 0.1);
  waves.spawn(new THREE.Vector3(0, BOARD_Y, 0), c, { r0: 1, r1: 14, h: 2.2, dur: 1.1, a: 3 });
  city.pulse(0, -6, 2.2);
  if (S.undo < UNDO_FREE) { S.undo++; ui.toast(t('zoneBonus'), 2200); }
  Platform.haptic('success');
}

function gameOver() {
  S.overT = 0;
  setTimeout(() => {
    if (!S.game.over || S.state !== 'playing') return;
    audio.saturated(); fx.kick({ glitch: 0.8, aberr: 1, trauma: 0.25 }); board.setDim(0.45); board.danger = 1;
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
  setState('playing'); updateHUD(); saveRun(); audio.undo(); audio.unduckMusic();
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
  board.danger = S.game.empty().length <= 1 ? 1 : 0;
  fx.kick({ aberr: 0.7, glitch: 0.25 }); audio.undo(); Platform.haptic('light');
  updateHUD(); saveRun();
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

S.api = { endlessTest: () => { const v = Array(SIZE * SIZE).fill(0); v[0] = v[1] = 131072; v[5] = 2; S.game.restore({ values: v, score: S.game.score, moves: S.game.moves, maxTile: 131072 }); S.zone = zoneForTile(131072); board.sync(S.game, true); doMove('left'); }, move: (d) => doMove(d), undo: () => undo(), forceOver: () => { S.game.restore({ values: Array.from({ length: SIZE * SIZE }, (_, i) => ((Math.floor(i / SIZE) + i) % 2 ? 4 : 2) * (i === 0 ? 8 : 1)), score: S.game.score, moves: S.game.moves, maxTile: 0 }); board.sync(S.game); gameOver(); } };

// ------------------------------------------------------------------ input
createInput({
  anyGesture() { audio.init(); audio.startMusic(); },
  dir(d) { if (ui.modalOpen) return; if (S.state === 'playing' && !S.demo) doMove(d); },
  action(a) {
    if (ui.modalOpen) { if (a === 'pause') ui.closeModal(); return; }
    if (a === 'primary') { if (S.state === 'attract') beginRun(!!loadRun()); else if (S.state === 'paused') resume(); else if (S.state === 'over') retry(); }
    else if (a === 'pause') { if (S.state === 'playing') pause(); else if (S.state === 'paused') resume(); }
    else if (a === 'mute') toggleMute();
    else if (a === 'undo') undo();
    else if (a === 'restart') { if (S.state === 'over') retry(); else newGameConfirm(); }
    else if (a === 'fps') $('fps').classList.toggle('hidden');
  },
}, { swipe: 'once', threshold: 22 });

function toggleMute() { audio.init(); const m = audio.toggleMute(); ui.setMuted(m); }
ui.on('btn-start', () => { audio.init(); beginRun(false); });
ui.on('btn-continue', () => { audio.init(); beginRun(true); });
ui.on('btn-resume', resume);
ui.on('btn-quit', toMenu);
ui.on('btn-pause', pause);
ui.on('btn-mute', toggleMute);
ui.on('btn-undo', undo);
ui.on('btn-new', newGameConfirm);
i18n.bindToggle($('btn-lang')); i18n.bindToggle($('btn-lang2'));
i18n.onChange(() => { updateHUD(); if (S.state === 'attract') refreshStart(); if (S.state === 'over') ui.setText('revive-sub', t(ads.isNative ? 'rewindAd' : 'rewindFree')); });
ui.on('btn-retry', retry);
ui.on('btn-menu', overToMenu);
ui.on('btn-revive', revive);

Platform.onBack(() => {
  if (ui.closeModal()) return true;
  if (S.state === 'playing') { pause(); return true; }
  if (S.state === 'paused') { resume(); return true; }
  if (S.state === 'over') { overToMenu(); return true; }
  return false;
});
Platform.onPause(() => { saveRun(); if (S.state === 'playing' && !S.demo) pause(); });

// ------------------------------------------------------------------ camera
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
  if (attract && !portrait) tmpP.x += lx;   // keep orbit centred on the board, shift framing sideways
  const k = instant ? 1 : 1 - Math.exp(-dt * 3);
  camPos.lerp(tmpP, k); camLook.lerp(tmpL, k);
  camera.position.copy(camPos); camera.lookAt(camLook);
  fx.shake(camera, now, 0.6);
}

// ------------------------------------------------------------------ loop
function tick(dt, now) {
  S.t = now; U.uTime.value = now;
  theme.update(dt); fx.update(dt);
  // autopilots
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
