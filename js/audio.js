// DATA FUSE sound set (all synthesised). Soft, relaxing: chimes climb a pentatonic scale with tile tier.
import { SynthAudio, mtof } from 'cyber-kit/audio/synth.js';

export class FuseAudio extends SynthAudio {
  constructor(store) { super({ store, music: 'chill' }); }
  slide() { this.noiseHit({ dur: 0.09, vol: 0.035, type: 'bandpass', f: 700, f2: 2400, q: 1.4, a: 0.02 }); }
  /** tier = log2(value); chain = merge index within this move */
  merge(tier, chain = 0) {
    if (!this.ctx) return;
    const t = chain * 0.045;
    const scale = [0, 2, 4, 7, 9];
    const n = tier - 1, m = 64 + Math.floor(n / 5) * 12 + scale[n % 5];
    this.osc({ type: 'sine', f: mtof(m), t, dur: 0.5, vol: 0.11, send: 0.45 });
    this.osc({ type: 'triangle', f: mtof(m + 12), t, dur: 0.18, vol: 0.05, send: 0.3 });
    this.osc({ type: 'square', f: mtof(m + 19), t: t + 0.02, dur: 0.06, vol: 0.025, lp: 3000 });
    if (tier >= 7) { this.osc({ type: 'sine', f: mtof(m - 24), t, dur: 0.45, vol: 0.22 }); this.noiseHit({ t, dur: 0.35, vol: 0.05, type: 'bandpass', f: 600, f2: 5000, q: 1, a: 0.01 }); }
  }
  spawn() { this.osc({ type: 'sine', f: 1700, f2: 2500, dur: 0.07, vol: 0.025, send: 0.3 }); }
  undo() { this.noiseHit({ dur: 0.18, vol: 0.05, type: 'bandpass', f: 3000, f2: 600, q: 1.2, a: 0.04 }); this.osc({ type: 'sine', f: 900, f2: 500, dur: 0.18, vol: 0.06, send: 0.3 }); }
  bump() { this.osc({ type: 'triangle', f: 160, f2: 110, dur: 0.09, vol: 0.06 }); }
  /** gentle "saturated" end - descending pad, not a crash (relaxing game) */
  saturated() {
    if (!this.ctx) return;
    [0, 3, 7].forEach((n, i) => this.osc({ type: 'sawtooth', f: mtof(57 + n), f2: mtof(45 + n), t: i * 0.05, dur: 1.4, vol: 0.05, a: 0.05, lp: 1400, send: 0.4 }));
    this.osc({ type: 'sine', f: 110, f2: 55, dur: 1.0, vol: 0.25 });
    this.duckMusic();
  }
}
