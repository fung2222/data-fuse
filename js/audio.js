// DATA FUSE sound set (all synthesised). Cyber neon arcade: clean fuse SFX + driving pulse BGM.
// v1.2.3 audio pass: one rounded fuse body + glass ping; softer hats/ambient for phone speakers.
import { SynthAudio, mtof } from 'cyber-kit/audio/synth.js';

/** Slight cents jitter so stacked layers don't phase-lock into one flat tone. Mobile-safe (no AudioWorklet). */
const det = (spread = 12) => (Math.random() - 0.5) * 2 * spread;

/** Timbre cycle per chain/combo step — electronic carriers, avoid one flat beep. */
const STEP_TIMBRES = ['sawtooth', 'square', 'sawtooth', 'square', 'triangle', 'sawtooth', 'square', 'sawtooth'];

/** Stimulating cyber drive: four-on-floor + neon arp, climbs with zone level. */
const FUSE_DRIVE = {
  bpm: 108,
  bpmPerLevel: 3,
  bpmMax: 136,
  roots: [45, 41, 48, 43],
  chords: [[0, 3, 7], [0, 4, 7], [0, 3, 7], [0, 5, 7]],
  kick: 'four',
  hats: 'soft',
  bass: 'eighths',
  arp: true,
  pad: 0.015,
  gain: 0.42,
  trimDb: 4.2,
};

export class FuseAudio extends SynthAudio {
  constructor(store) {
    super({ store, music: FUSE_DRIVE, sfxTrimDb: 7.5 });
    this._amb = null;
  }

  /** Keep the top end below phone-speaker hiss while the drive is playing. */
  unduckMusic() {
    if (!this.ctx || !this.musicFilter) return;
    const t = this.ctx.currentTime;
    this.musicFilter.frequency.cancelScheduledValues(t);
    this.musicFilter.frequency.setTargetAtTime(14000, t, 0.2);
  }

  slide() {
    // Short digital whoosh — noise sweep + thin square tick
    this.noiseHit({ dur: 0.07, vol: 0.04, type: 'bandpass', f: 900, f2: 4200, q: 1.8, a: 0.01 });
    this.osc({ type: 'square', f: 1400, f2: 2200, dur: 0.035, vol: 0.03, lp: 5000, detune: det(20) });
  }

  /**
   * tier = log2(value); chain = merge index within this move; feel = 'normal'|'multi'|'big'|'legendary'|'pulse'
   * Chain hits rise shallow→deep; one rounded body carries the pitch, one ping gives identity.
   * Keep this sparse: phone speakers turn a detuned saw/noise stack into mud.
   */
  merge(tier, chain = 0, feel = 'normal') {
    if (!this.ctx) return;
    const t = chain * 0.04;
    const n = Math.max(1, tier) - 1;
    const depth = Math.min(chain, 5);
    const scale = [0, 2, 4, 7, 9];
    const m = 64 + Math.floor(n / 5) * 12 + scale[n % 5] - depth * 3;
    const big = tier >= 7 || feel === 'big' || feel === 'legendary';
    const pulse = feel === 'pulse';
    const vol = (big ? 0.048 : 0.042) * (1 - depth * 0.04);
    const body = 0.17 + depth * 0.02;

    // 1) Rounded body: one sine fundamental with a short downward pitch.
    this.osc({ type: 'sine', f: mtof(m - 12), f2: mtof(m - 14), t, dur: body, vol: vol * 0.95, a: 0.004, send: 0.10 });
    // 2) Warm triangle partial — no detuned saw stack, so phone speakers stay clear.
    this.osc({ type: 'triangle', f: mtof(m), f2: mtof(m - 2), t, dur: body * 0.8, vol: vol * 0.38, lp: 3000, q: 1.1, send: 0.16 });
    // 3) One glass ping is the fuse identity; it cuts through the music without noise.
    this.osc({ type: 'sine', f: mtof(m + 19), f2: mtof(m + 12), t: t + 0.006, dur: 0.11, vol: vol * 0.26, a: 0.002, send: 0.22 });
    // 4) Very short click for definition; deliberately quiet.
    this.noiseHit({ t, dur: 0.026, vol: 0.012, type: 'bandpass', f: 2600, f2: 1300, q: 1.2, a: 0.001 });
    // 5) One low lift for big / pulse, not a second detuned stack.
    if (big || pulse) this.osc({ type: 'sine', f: mtof(Math.max(28, m - 24)), t, dur: 0.34, vol: big ? 0.06 : 0.05, a: 0.006, send: 0.08 });
    if (pulse) this.osc({ type: 'square', f: mtof(m + 7), f2: mtof(m + 12), t: t + 0.01, dur: 0.06, vol: 0.022, lp: 2200, q: 2, send: 0.12 });
    if (feel === 'multi') this.osc({ type: 'sine', f: mtof(m + 12), t: t + 0.03, dur: 0.08, vol: 0.025, send: 0.2 });
  }

  /**
   * Combo sting: starts bright/shallow at ×2, sinks deeper + thicker as n rises.
   * v1.2.3: electronic stack — saw root, square sparkle, noise crack.
   */
  combo(n = 2) {
    if (!this.ctx) return;
    const depth = Math.min(Math.max(n, 2), 8);
    const root = 74 - depth * 3; // ×2 ~68, ×8 ~50 — shallow→deep
    const vol = Math.min(0.068, 0.036 + depth * 0.004);
    const intervals = [0, 4, 7, 12, 19];
    intervals.forEach((iv, i) => {
      const timbre = STEP_TIMBRES[(depth + i) % STEP_TIMBRES.length];
      const type = i === 0 ? 'sawtooth' : i >= 3 ? 'square' : timbre;
      const f = mtof(root + iv - (i > 1 ? Math.floor(depth / 2) : 0));
      const v = vol * (i === 0 ? 1 : i === 4 ? 0.4 : 0.65);
      this.osc({
        type,
        f,
        t: i * 0.022,
        dur: 0.12 + depth * 0.01 + (i === 0 ? 0.03 : 0),
        vol: v,
        lp: 3200 - depth * 90 + i * 200,
        q: 3.5,
        detune: det(10 + i * 3),
        send: 0.32,
      });
      if (i === 0 || i === 2) {
        this.osc({
          type: 'square',
          f,
          t: i * 0.022,
          dur: 0.1,
          vol: v * 0.28,
          lp: 2800,
          detune: det(24),
          send: 0.18,
        });
      }
    });
    // Deep thump + grit
    this.osc({
      type: 'sine',
      f: mtof(root - 12),
      t: 0.015,
      dur: 0.24 + depth * 0.02,
      vol: Math.min(0.15, 0.055 + depth * 0.011),
      detune: det(5),
    });
    if (depth >= 4) {
      this.osc({
        type: 'sine',
        f: mtof(Math.max(28, root - 24)),
        t: 0.025,
        dur: 0.32,
        vol: Math.min(0.17, 0.075 + depth * 0.01),
      });
    }
    this.noiseHit({
      t: 0,
      dur: 0.09 + depth * 0.01,
      vol: Math.min(0.045, 0.028 + depth * 0.002),
      type: 'bandpass',
      f: 900 - depth * 50,
      f2: 3800,
      q: 1.3,
    });
  }

  pulseArm() {
    this.osc({ type: 'sawtooth', f: 180, f2: 960, dur: 0.14, vol: 0.065, lp: 3200, q: 5, send: 0.25 });
    this.osc({ type: 'square', f: 420, f2: 1400, dur: 0.08, vol: 0.04, lp: 5000, detune: det(15) });
    this.noiseHit({ dur: 0.1, vol: 0.045, type: 'highpass', f: 2200, f2: 7500 });
  }

  modChime() {
    this.osc({ type: 'square', f: 620, f2: 1240, dur: 0.12, vol: 0.045, lp: 4500, send: 0.3, detune: det(10) });
    this.osc({ type: 'sawtooth', f: 930, t: 0.05, dur: 0.1, vol: 0.035, lp: 3800, send: 0.2 });
    this.noiseHit({ t: 0.02, dur: 0.06, vol: 0.025, type: 'bandpass', f: 2000, f2: 5000, q: 1.5 });
  }

  drift() {
    for (let i = 0; i < 3; i++) {
      this.osc({
        type: i % 2 ? 'square' : 'sawtooth',
        f: 480 + i * 220,
        f2: 320 + i * 160,
        t: i * 0.04,
        dur: 0.07,
        vol: 0.032,
        lp: 3600,
        send: 0.22,
        detune: det(16),
      });
    }
    this.noiseHit({ dur: 0.14, vol: 0.04, type: 'bandpass', f: 1100, f2: 2800, q: 2.2 });
  }

  spawn() {
    this.osc({ type: 'square', f: 1900, f2: 2800, dur: 0.045, vol: 0.028, lp: 6000, detune: det(20), send: 0.2 });
    this.noiseHit({ dur: 0.035, vol: 0.02, type: 'highpass', f: 4000, f2: 9000 });
  }

  undo() {
    this.noiseHit({ dur: 0.14, vol: 0.055, type: 'bandpass', f: 3200, f2: 500, q: 1.4, a: 0.03 });
    this.osc({ type: 'sawtooth', f: 980, f2: 420, dur: 0.14, vol: 0.055, lp: 2400, send: 0.22 });
  }

  bump() {
    this.osc({ type: 'square', f: 140, f2: 90, dur: 0.07, vol: 0.055, lp: 900 });
    this.noiseHit({ dur: 0.04, vol: 0.03, type: 'lowpass', f: 800, f2: 200 });
  }

  saturated() {
    if (!this.ctx) return;
    [0, 3, 7].forEach((n, i) =>
      this.osc({
        type: 'sawtooth',
        f: mtof(57 + n),
        f2: mtof(45 + n),
        t: i * 0.045,
        dur: 1.2,
        vol: 0.048,
        a: 0.04,
        lp: 1600,
        q: 4,
        send: 0.35,
        detune: det(10),
      }),
    );
    this.osc({ type: 'sine', f: 110, f2: 55, dur: 0.9, vol: 0.24 });
    this.noiseHit({ dur: 0.5, vol: 0.06, type: 'bandpass', f: 600, f2: 200, q: 1 });
    this.duckMusic();
  }

  // Soft noise bed under drive BGM (subtle neon hum, not chill pad)
  startAmbient() {
    if (!this.ctx || this._amb) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 520;
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfx);
    src.start();
    g.gain.setTargetAtTime(0.006, ctx.currentTime, 0.7);
    this._amb = { src, g };
  }

  stopAmbient(fade = 0.5) {
    if (!this._amb) return;
    const { src, g } = this._amb;
    this._amb = null;
    try {
      g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, fade / 3);
      setTimeout(() => {
        try {
          src.stop();
        } catch (_) {}
      }, fade * 1000 + 80);
    } catch (_) {}
  }
}
