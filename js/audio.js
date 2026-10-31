// DATA FUSE sound set (all synthesised). Cyber neon arcade: electronic/synth SFX + driving pulse BGM.
// v1.2.3: SFX → saw/square/noise + filter sweeps (keep shallow→deep chain); BGM chill→drive synthwave.
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
  hats: true,
  bass: 'eighths',
  arp: true,
  pad: 0.02,
  gain: 0.4,
  trimDb: 4.2,
};

export class FuseAudio extends SynthAudio {
  constructor(store) {
    super({ store, music: FUSE_DRIVE, sfxTrimDb: 7.5 });
    this._amb = null;
  }

  slide() {
    // Short digital whoosh — noise sweep + thin square tick
    this.noiseHit({ dur: 0.07, vol: 0.04, type: 'bandpass', f: 900, f2: 4200, q: 1.8, a: 0.01 });
    this.osc({ type: 'square', f: 1400, f2: 2200, dur: 0.035, vol: 0.03, lp: 5000, detune: det(20) });
  }

  /**
   * tier = log2(value); chain = merge index within this move; feel = 'normal'|'multi'|'big'|'legendary'|'pulse'
   * Chain hits rise shallow→deep: early hits bright/high, later hits drop pitch + grow body/volume (no clipping).
   * v1.2.3: electronic carriers (saw/square), filter sweeps, noise grit — still short/punchy, not muddy.
   */
  merge(tier, chain = 0, feel = 'normal') {
    if (!this.ctx) return;
    const t = chain * 0.045;
    const scale = [0, 2, 4, 7, 9];
    const n = tier - 1;
    const depth = Math.min(chain, 7);
    const m = 70 + Math.floor(n / 5) * 12 + scale[n % 5] - depth * 4; // drop ~4 semitones per chain hit
    const base = feel === 'legendary' || feel === 'pulse' ? 0.11 : feel === 'big' ? 0.1 : 0.09;
    const vol = Math.min(0.15, base + depth * 0.008);
    const carrier = STEP_TIMBRES[depth % STEP_TIMBRES.length];
    const bright = STEP_TIMBRES[(depth + 3) % STEP_TIMBRES.length];
    const lpOpen = 4200 - depth * 180; // early bright, later darker (filter body)

    // Punchy carrier + detuned twin (chorusing) — electronic, not soft sine pad
    this.osc({
      type: carrier,
      f: mtof(m),
      t,
      dur: 0.22 + depth * 0.025,
      vol,
      detune: det(14),
      send: 0.28,
      lp: lpOpen,
      q: 3.5,
    });
    this.osc({
      type: 'square',
      f: mtof(m),
      t,
      dur: 0.14 + depth * 0.015,
      vol: vol * 0.35,
      detune: det(22),
      send: 0.18,
      lp: lpOpen * 0.85,
    });

    // Harmonic bite: octave / fifth / sparkle with independent detune + short noise grit
    this.osc({
      type: bright,
      f: mtof(m + 12 - Math.min(depth, 4)),
      t,
      dur: 0.1 + depth * 0.012,
      vol: Math.min(0.05, 0.028 + depth * 0.003),
      detune: det(18),
      send: 0.22,
      lp: 5200 - depth * 150,
    });
    this.osc({
      type: 'sawtooth',
      f: mtof(m + 7),
      t: t + 0.01,
      dur: 0.09,
      vol: Math.min(0.038, 0.02 + depth * 0.002),
      detune: det(12),
      send: 0.16,
      lp: 3600,
    });
    // Micro FM-ish pitch sweep on a thin square (cyber zap)
    this.osc({
      type: 'square',
      f: mtof(m + 19),
      f2: mtof(m + 7 + (depth % 3)),
      t: t + 0.015,
      dur: 0.05,
      vol: Math.min(0.03, 0.014 + depth * 0.0015),
      lp: 2800 - depth * 80,
      detune: det(10),
    });
    this.noiseHit({
      t,
      dur: 0.045 + depth * 0.006,
      vol: Math.min(0.038, 0.018 + depth * 0.0025),
      type: 'bandpass',
      f: 1800 + depth * 120,
      f2: 500 + depth * 40,
      q: 1.4,
      a: 0.003,
    });

    // Growing sub body = the "deep" thrill
    if (depth >= 1) {
      this.osc({
        type: 'sine',
        f: mtof(m - 12 - depth * 2),
        t,
        dur: 0.32 + depth * 0.035,
        vol: Math.min(0.17, 0.065 + depth * 0.016),
        detune: det(6),
      });
      this.osc({
        type: 'sawtooth',
        f: mtof(m - 12 - depth),
        t,
        dur: 0.16 + depth * 0.02,
        vol: Math.min(0.05, 0.022 + depth * 0.004),
        lp: 900 + depth * 80,
        q: 4,
      });
    }
    if (depth >= 3) {
      this.osc({
        type: 'sine',
        f: mtof(Math.max(24, m - 24 - depth)),
        t: t + 0.008,
        dur: 0.42,
        vol: Math.min(0.19, 0.095 + depth * 0.011),
      });
      this.noiseHit({
        t,
        dur: 0.16,
        vol: Math.min(0.04, 0.018 + depth * 0.0035),
        type: 'lowpass',
        f: 2200,
        f2: 280,
        q: 0.9,
        a: 0.008,
      });
    }
    if (tier >= 7 || feel === 'big' || feel === 'legendary') {
      this.osc({ type: 'sine', f: mtof(m - 24), t, dur: 0.4, vol: Math.min(0.19, 0.15 + depth * 0.007) });
      this.osc({
        type: 'sawtooth',
        f: mtof(m),
        f2: mtof(m - 7),
        t,
        dur: 0.18,
        vol: 0.045,
        lp: 2400,
        q: 5,
        send: 0.3,
        detune: det(8),
      });
      this.noiseHit({ t, dur: 0.22, vol: 0.04, type: 'bandpass', f: 800, f2: 4500, q: 1.1, a: 0.008 });
    }
    if (feel === 'pulse') {
      this.osc({
        type: 'sawtooth',
        f: mtof(m - 12),
        f2: mtof(m),
        t: t + 0.015,
        dur: 0.16,
        vol: 0.07,
        lp: 2600,
        q: 6,
        detune: det(12),
        send: 0.28,
      });
      this.noiseHit({ t: t + 0.01, dur: 0.08, vol: 0.035, type: 'highpass', f: 2500, f2: 7000, q: 1.2 });
    }
    if (feel === 'multi') {
      this.osc({
        type: 'square',
        f: mtof(m + 7 - depth),
        t: t + 0.04,
        dur: 0.1,
        vol: 0.038,
        lp: 3800,
        detune: det(14),
        send: 0.25,
      });
    }
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
    g.gain.setTargetAtTime(0.012, ctx.currentTime, 0.7);
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
