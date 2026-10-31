// DATA FUSE sound set (all synthesised). Soft, relaxing: chimes climb a pentatonic scale with tile tier.
// v1.2.2: D-note merge/combo variety — harmonics + detune + per-step timbre (keep shallow→deep).
import { SynthAudio, mtof } from 'cyber-kit/audio/synth.js';

/** Slight cents jitter so stacked layers don't phase-lock into one flat tone. Mobile-safe (no AudioWorklet). */
const det = (spread = 12) => (Math.random() - 0.5) * 2 * spread;

/** Timbre cycle per chain/combo step — avoid one sine looping. */
const STEP_TIMBRES = ['sine', 'triangle', 'sawtooth', 'square', 'triangle', 'sine', 'sawtooth', 'square'];

export class FuseAudio extends SynthAudio {
  constructor(store) { super({ store, music: 'chill', sfxTrimDb: 7.5 }); this._amb = null; }
  slide() { this.noiseHit({ dur: 0.09, vol: 0.035, type: 'bandpass', f: 700, f2: 2400, q: 1.4, a: 0.02 }); }
  /** tier = log2(value); chain = merge index within this move; feel = 'normal'|'multi'|'big'|'legendary'|'pulse'
   *  Chain hits rise shallow→deep: early hits bright/high, later hits drop pitch + grow body/volume (no clipping).
   *  v1.2.2: D5-centred early merges (tier≈3) used to sound like one flat beep — add harmonics, random detune,
   *  and a different carrier timbre each chain step while keeping the pitch-drop arc. */
  merge(tier, chain = 0, feel = 'normal') {
    if (!this.ctx) return;
    const t = chain * 0.05;
    const scale = [0, 2, 4, 7, 9];
    const n = tier - 1;
    const depth = Math.min(chain, 7); // shallow→deep steps within one swipe
    const m = 70 + Math.floor(n / 5) * 12 + scale[n % 5] - depth * 4; // drop ~4 semitones per chain hit
    const base = feel === 'legendary' || feel === 'pulse' ? 0.12 : feel === 'big' ? 0.105 : 0.095;
    const vol = Math.min(0.155, base + depth * 0.008); // soft climb, hard cap under kit trim
    const carrier = STEP_TIMBRES[depth % STEP_TIMBRES.length];
    const bright = STEP_TIMBRES[(depth + 2) % STEP_TIMBRES.length];
    // Carrier + slight detune twin (chorusing) so D/common pitches don't feel mono
    this.osc({ type: carrier, f: mtof(m), t, dur: 0.48 + depth * 0.03, vol, detune: det(10), send: 0.42, lp: carrier === 'sawtooth' || carrier === 'square' ? 3200 - depth * 100 : null });
    this.osc({ type: 'sine', f: mtof(m), t, dur: 0.42 + depth * 0.02, vol: vol * 0.45, detune: det(14), send: 0.3 });
    // Harmonic stack: octave / fifth / major 3rd-ish partials with independent detune
    this.osc({ type: bright === 'square' ? 'triangle' : bright, f: mtof(m + 12 - Math.min(depth, 5)), t, dur: 0.16 + depth * 0.01, vol: Math.min(0.055, 0.035 + depth * 0.003), detune: det(16), send: 0.28 });
    this.osc({ type: 'triangle', f: mtof(m + 7), t: t + 0.012, dur: 0.14, vol: Math.min(0.04, 0.022 + depth * 0.002), detune: det(11), send: 0.22 });
    this.osc({ type: 'square', f: mtof(m + 19), t: t + 0.02, dur: 0.055, vol: Math.min(0.028, 0.016 + depth * 0.0015), lp: 2600 - depth * 120, detune: det(8) });
    // Soft 2nd partial shimmer unique per step (avoids flat loop)
    this.osc({ type: 'sine', f: mtof(m + 4 + (depth % 3)), t: t + 0.03, dur: 0.11, vol: 0.018 + (depth % 2) * 0.006, detune: det(18), send: 0.25 });
    // Growing sub body = the "deep" thrill (keeps highs soft so we don't clip)
    if (depth >= 1) {
      this.osc({ type: 'sine', f: mtof(m - 12 - depth * 2), t, dur: 0.42 + depth * 0.04, vol: Math.min(0.18, 0.07 + depth * 0.018), detune: det(6) });
    }
    if (depth >= 3) {
      this.osc({ type: 'sine', f: mtof(Math.max(24, m - 24 - depth)), t: t + 0.01, dur: 0.5, vol: Math.min(0.2, 0.1 + depth * 0.012) });
      this.noiseHit({ t, dur: 0.22, vol: Math.min(0.045, 0.02 + depth * 0.004), type: 'bandpass', f: 420, f2: 1800 + depth * 200, q: 1.1, a: 0.012 });
    }
    if (tier >= 7 || feel === 'big' || feel === 'legendary') {
      this.osc({ type: 'sine', f: mtof(m - 24), t, dur: 0.45, vol: Math.min(0.2, 0.16 + depth * 0.008) });
      this.noiseHit({ t, dur: 0.32, vol: 0.045, type: 'bandpass', f: 600, f2: 5000, q: 1, a: 0.01 });
    }
    if (feel === 'pulse') {
      this.osc({ type: 'sawtooth', f: mtof(m - 12), t: t + 0.02, dur: 0.2, vol: 0.065, lp: 2000, detune: det(10), send: 0.32 });
    }
    if (feel === 'multi') {
      this.osc({ type: 'triangle', f: mtof(m + 7 - depth), t: t + 0.05, dur: 0.16, vol: 0.04, detune: det(12), send: 0.35 });
    }
  }
  /** Combo sting: starts bright/shallow at ×2, sinks deeper + thicker as n rises.
   *  v1.2.2: root ~D5 territory was one flat chord — vary partials/timbre + detune per degree. */
  combo(n = 2) {
    if (!this.ctx) return;
    const depth = Math.min(Math.max(n, 2), 8);
    const root = 74 - depth * 3; // ×2 ~68, ×8 ~50 — shallow→deep (74 = D5)
    const vol = Math.min(0.07, 0.038 + depth * 0.004);
    const intervals = [0, 4, 7, 12, 19]; // add flat-ish 19th sparkle for richer chord
    intervals.forEach((iv, i) => {
      const timbre = STEP_TIMBRES[(depth + i) % STEP_TIMBRES.length];
      const type = i === 0 ? (timbre === 'sine' ? 'sawtooth' : timbre) : (i >= 3 ? 'sine' : 'triangle');
      const f = mtof(root + iv - (i > 1 ? Math.floor(depth / 2) : 0));
      const v = vol * (i === 0 ? 1 : i === 4 ? 0.45 : 0.7);
      this.osc({
        type,
        f,
        t: i * 0.026,
        dur: 0.15 + depth * 0.01 + (i === 0 ? 0.04 : 0),
        vol: v,
        lp: 2400 - depth * 80 + i * 180,
        detune: det(8 + i * 3),
        send: 0.38,
      });
      // Micro detuned twin on root + fifth for width
      if (i === 0 || i === 2) {
        this.osc({ type: 'sine', f, t: i * 0.026, dur: 0.2, vol: v * 0.35, detune: det(20), send: 0.25 });
      }
    });
    // Deep thump grows with combo (volume-capped)
    this.osc({ type: 'sine', f: mtof(root - 12), t: 0.02, dur: 0.28 + depth * 0.02, vol: Math.min(0.16, 0.06 + depth * 0.012), detune: det(5) });
    if (depth >= 4) this.osc({ type: 'sine', f: mtof(Math.max(28, root - 24)), t: 0.03, dur: 0.36, vol: Math.min(0.18, 0.08 + depth * 0.01) });
    this.noiseHit({ t: 0, dur: 0.12 + depth * 0.01, vol: Math.min(0.04, 0.025 + depth * 0.002), type: 'bandpass', f: 700 - depth * 40, f2: 3200, q: 1.15 });
  }
  pulseArm() {
    this.osc({ type: 'sine', f: 220, f2: 880, dur: 0.18, vol: 0.07, send: 0.3 });
    this.noiseHit({ dur: 0.12, vol: 0.04, type: 'highpass', f: 2000, f2: 6000 });
  }
  modChime() { this.osc({ type: 'sine', f: 520, f2: 1040, dur: 0.25, vol: 0.05, send: 0.4 }); this.osc({ type: 'triangle', f: 780, t: 0.06, dur: 0.18, vol: 0.04 }); }
  drift() { for (let i = 0; i < 3; i++) this.osc({ type: 'triangle', f: 400 + i * 180, t: i * 0.05, dur: 0.08, vol: 0.035, send: 0.3 }); this.noiseHit({ dur: 0.18, vol: 0.035, type: 'bandpass', f: 900, f2: 2200, q: 2 }); }
  spawn() { this.osc({ type: 'sine', f: 1700, f2: 2500, dur: 0.07, vol: 0.025, send: 0.3 }); }
  undo() { this.noiseHit({ dur: 0.18, vol: 0.05, type: 'bandpass', f: 3000, f2: 600, q: 1.2, a: 0.04 }); this.osc({ type: 'sine', f: 900, f2: 500, dur: 0.18, vol: 0.06, send: 0.3 }); }
  bump() { this.osc({ type: 'triangle', f: 160, f2: 110, dur: 0.09, vol: 0.06 }); }
  saturated() {
    if (!this.ctx) return;
    [0, 3, 7].forEach((n, i) => this.osc({ type: 'sawtooth', f: mtof(57 + n), f2: mtof(45 + n), t: i * 0.05, dur: 1.4, vol: 0.05, a: 0.05, lp: 1400, send: 0.4 }));
    this.osc({ type: 'sine', f: 110, f2: 55, dur: 1.0, vol: 0.25 });
    this.duckMusic();
  }
  startAmbient() {
    if (!this.ctx || this._amb) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 380; bp.Q.value = 0.55;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    src.connect(bp); bp.connect(g); g.connect(this.sfx);
    src.start();
    g.gain.setTargetAtTime(0.014, ctx.currentTime, 0.9);
    this._amb = { src, g };
  }
  stopAmbient(fade = 0.5) {
    if (!this._amb) return;
    const { src, g } = this._amb; this._amb = null;
    try {
      g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, fade / 3);
      setTimeout(() => { try { src.stop(); } catch (_) {} }, fade * 1000 + 80);
    } catch (_) {}
  }
}
