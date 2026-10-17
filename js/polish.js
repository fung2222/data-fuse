// Feel helpers: combo aura, merge-axis hint, slide trail.
import * as THREE from 'three';
import { BOARD_Y, ECHO_FADE } from './config.js';

export class ComboAura {
  constructor(scene) {
    const geo = new THREE.RingGeometry(0.55, 0.95, 48);
    this.mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.t = 0; this.power = 0;
  }
  pulse(x, z, power = 1) {
    this.mesh.position.set(x, BOARD_Y + 0.04, z);
    this.power = Math.max(this.power, power);
    this.t = 0; this.mesh.visible = true;
  }
  update(dt, color) {
    if (this.power <= 0) { this.mesh.visible = false; return; }
    this.t += dt;
    const k = Math.min(1, this.t / 0.55);
    const s = 1 + k * (0.9 + this.power * 0.35);
    this.mesh.scale.setScalar(s);
    if (color) this.mat.color.copy(color);
    this.mat.opacity = (1 - k) * (0.36 + this.power * 0.16);
    if (k >= 1) { this.power *= 0.35; this.t = 0; if (this.power < 0.15) { this.power = 0; this.mesh.visible = false; } }
  }
}

/** Soft chevron / axis glow after a dead swipe — suggests a legal merge direction. */
export class MergeHint {
  constructor() {
    this.enabled = true;
    try { if (localStorage.getItem('cyber.data-fuse.echoHint') === '0') this.enabled = false; } catch (e) { /* ignore */ }
    this.dir = null; this.t = 0; this.dur = ECHO_FADE;
  }
  setEnabled(on) {
    this.enabled = !!on;
    try { localStorage.setItem('cyber.data-fuse.echoHint', on ? '1' : '0'); } catch (e) { /* ignore */ }
    if (!on) this.clear();
  }
  toggle() { this.setEnabled(!this.enabled); return this.enabled; }
  show(dir) { if (!this.enabled || !dir) return; this.dir = dir; this.t = this.dur; }
  clear() { this.dir = null; this.t = 0; }
  update(dt) { if (this.t > 0) { this.t -= dt; if (this.t <= 0) this.clear(); } }
  get active() { return this.t > 0 && this.dir; }
  get strength() { return this.t > 0 ? Math.min(1, this.t / 0.25) * Math.min(1, this.dur ? this.t / this.dur * 2 : 1) : 0; }
}

export function slideTrail(particles, from, to, color, count = 10) {
  const v = new THREE.Vector3(), p = new THREE.Vector3();
  const dx = to.x - from.x, dz = to.z - from.z;
  for (let n = 0; n < count; n++) {
    const t = n / count;
    p.set(from.x + dx * t + (Math.random() - 0.5) * 0.15, BOARD_Y + 0.35 + Math.random() * 0.15, from.z + dz * t + (Math.random() - 0.5) * 0.15);
    v.set(-dx * 0.4 + (Math.random() - 0.5), 1.2 + Math.random(), -dz * 0.4 + (Math.random() - 0.5));
    particles.emit(p, v, color, { life: 0.18 + Math.random() * 0.14, size: 0.45 + Math.random() * 0.3, grav: -2, drag: 2.4, bright: 2.8 });
  }
}

export { ECHO_FADE };
