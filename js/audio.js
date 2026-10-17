// DATA FUSE sound set (all synthesised). Soft, relaxing: chimes climb a pentatonic scale with tile tier.
// v1.2: combo / pulse / mod / ambient bed.
import { SynthAudio, mtof } from 'cyber-kit/audio/synth.js';

export class FuseAudio extends SynthAudio {
  constructor(store) { super({ store, music: 'chill', sfxTrimDb: 7.5 }); this._amb = null; }
  slide() { this.noiseHit({ dur: 0.09, vol: 0.035, type: 'bandpass', f: 700, f2: 2400, q: 1.4, a: 0.02 }); }
  /** tier = log2(value); chain = merge index within this move; feel = 'normal'|'multi'|'big'|'legendary'|'pulse' */
  merge(tier, chain = 0, feel = 'normal') {
    if (!this.ctx) return;
    const t = chain * 0.045;
    const scale = [0, 2, 4, 7, 9];
    const n = tier - 1, m = 64 + Math.floor(n / 5) * 12 + scale[n % 5];
    const vol = feel === 'legendary' || feel === 'pulse' ? 0.14 : feel === 'big' ? 0.12 : 0.11;
    this.osc({ type: 'sine', f: mtof(m), t, dur: 0.5, vol, send: 0.45 });
    this.osc({ type: 'triangle', f: mtof(m + 12), t, dur: 0.18, vol: 0.05, send: 0.3 });
    this.osc({ type: 'square', f: mtof(m + 19), t: t + 0.02, dur: 0.06, vol: 0.025, lp: 3000 });
    if (tier >= 7 || feel === 'big' || feel === 'legendary') {
      this.osc({ type: 'sine', f: mtof(m - 24), t, dur: 0.45, vol: 0.22 });
      this.noiseHit({ t, dur: 0.35, vol: 0.05, type: 'bandpass', f: 600, f2: 5000, q: 1, a: 0.01 });
    }
    if (feel === 'pulse') {
      this.osc({ type: 'sawtooth', f: mtof(m - 12), t: t + 0.02, dur: 0.2, vol: 0.07, lp: 2200, send: 0.35 });
    }
    if (feel === 'multi') {
      this.osc({ type: 'triangle', f: mtof(m + 7), t: t + 0.05, dur: 0.16, vol: 0.045, send: 0.4 });
    }
  }
  combo(n = 2) {
    if (!this.ctx) return;
    const root = 60 + Math.min(n, 8) * 2;
    [0, 4, 7, 12].forEach((iv, i) => this.osc({ type: 'sawtooth', f: mtof(root + iv), t: i * 0.03, dur: 0.18, vol: 0.045, lp: 2600 + i * 400, send: 0.4 }));
    this.noiseHit({ t: 0, dur: 0.14, vol: 0.035, type: 'bandpass', f: 800, f2: 4000, q: 1.2 });
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
