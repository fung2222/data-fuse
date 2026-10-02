// 3D view: floating board slab with glowing sockets, holo beam, and glass data-cube tiles with animated
// slide / merge-pop / spawn. Pure view - driven by main.js from FuseGame move records.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { U } from 'cyber-kit/core/theme.js';
import { SIZE, CELL, TILE, TILE_H, BOARD_Y, BOARD_HALF, T_SLIDE, T_POP, T_SPAWN, colorOf, tierOf } from './config.js';
import { labelTexture } from './labels.js';

export const cellPos = (r, c, out = new THREE.Vector3()) => out.set((c - (SIZE - 1) / 2) * CELL, BOARD_Y, (r - (SIZE - 1) / 2) * CELL);
const easeOutCubic = k => 1 - Math.pow(1 - k, 3);
const easeOutBack = k => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };

const TILE_VS = /* glsl */`
  varying vec3 vL; varying vec3 vN; varying vec3 vV; varying vec3 vW;
  void main(){ vL = position; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz);
    gl_Position = projectionMatrix * viewMatrix * w; }`;
const TILE_FS = /* glsl */`
  uniform vec3 uColor; uniform float uGlow, uTime, uSpawn, uDim, uSeed; uniform vec3 uHalf;
  varying vec3 vL; varying vec3 vN; varying vec3 vV; varying vec3 vW;
  void main(){
    vec3 d = uHalf - abs(vL);                          // distance to each face pair
    // second-smallest distance -> near an edge
    float s1 = min(min(d.x, d.y), d.z);
    float s3 = max(max(d.x, d.y), d.z);
    float s2 = d.x + d.y + d.z - s1 - s3;
    float edge = smoothstep(0.075, 0.0, s2);
    float fres = pow(1.0 - clamp(abs(dot(normalize(vN), vV)), 0.0, 1.0), 2.2);
    float top = step(0.5, vN.y);
    float hy = (vL.y + uHalf.y) / (2.0 * uHalf.y);   // 0 bottom .. 1 top
    vec3 col = uColor * (0.10 + 0.22 * hy) + uColor * fres * 0.9 + uColor * edge * 1.9;
    // inner circuit lines on the side faces
    float lines = step(0.92, fract((vL.x + vL.z) * 9.0 + uSeed)) * (1.0 - top) * 0.25;
    col += uColor * lines * (0.4 + 0.6 * sin(uTime * 2.0 + uSeed * 6.0 + vL.y * 20.0));
    // travelling scan band
    float band = exp(-pow((hy - fract(uTime * 0.35 + uSeed)) * 9.0, 2.0)) * (1.0 - top);
    col += uColor * band * 0.35;
    col += vec3(1.0) * uGlow * (0.35 + edge);
    col *= uDim;
    float alpha = clamp(0.62 + fres * 0.3 + edge * 0.6 + top * 0.18 + uGlow, 0.0, 1.0);
    // spawn materialise: reveal bottom->top with a bright cut line
    float reveal = smoothstep(0.0, 0.02, uSpawn * 1.15 - hy);
    col += uColor * 3.0 * exp(-pow((uSpawn * 1.15 - hy) * 30.0, 2.0)) * step(uSpawn, 0.999);
    alpha *= reveal;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col, alpha);
  }`;

class TileView {
  constructor(parent, geo, coreGeo, labelGeo) {
    this.group = new THREE.Group();
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color() }, uGlow: { value: 0 }, uTime: U.uTime, uSpawn: { value: 1 }, uDim: { value: 1 }, uSeed: { value: Math.random() }, uHalf: { value: new THREE.Vector3(TILE / 2, TILE_H / 2, TILE / 2) } },
      vertexShader: TILE_VS, fragmentShader: TILE_FS,
    });
    this.body = new THREE.Mesh(geo, this.mat); this.body.renderOrder = 3;
    this.coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
    this.core = new THREE.Mesh(coreGeo, this.coreMat); this.core.renderOrder = 2;
    this.labelMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest: true, color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -2 });
    this.label = new THREE.Mesh(labelGeo, this.labelMat); this.label.renderOrder = 4;
    this.label.rotation.x = -Math.PI / 2; this.label.position.y = TILE_H / 2 + 0.004;
    this.group.add(this.core, this.body, this.label);
    parent.add(this.group);
    this.color = new THREE.Color();
    this.active = false; this.group.visible = false;
  }
  setValue(v) {
    this.v = v; this.color.set(colorOf(v));
    this.mat.uniforms.uColor.value.copy(this.color);
    this.coreMat.color.copy(this.color).multiplyScalar(1.6 + Math.min(tierOf(v), 11) * 0.12);
    const s = 0.1 + Math.min(tierOf(v), 12) * 0.016; this.core.scale.setScalar(s);
    this.labelMat.map = labelTexture(v, colorOf(v)); this.labelMat.needsUpdate = true;
    this.labelMat.color.setScalar(v >= 2048 ? 1.25 : 1.0);
  }
}

export class BoardView {
  constructor(scene) {
    this.scene = scene;
    // pivot at the board surface so tilt feedback rotates around the board centre
    this.root = new THREE.Group(); this.root.position.y = BOARD_Y; scene.add(this.root);
    this.inner = new THREE.Group(); this.inner.position.y = -BOARD_Y; this.root.add(this.inner);
    this.tiltTarget = new THREE.Vector2(); this.tilt = new THREE.Vector2(); this.tiltVel = new THREE.Vector2();
    this.buildBoard();
    const geo = new RoundedBoxGeometry(TILE, TILE_H, TILE, 4, 0.12);
    const coreGeo = new THREE.OctahedronGeometry(1, 0);
    const labelGeo = new THREE.PlaneGeometry(TILE * 0.86, TILE * 0.86);
    this.pool = []; for (let i = 0; i < 40; i++) this.pool.push(new TileView(this.tiles, geo, coreGeo, labelGeo));
    this.byId = new Map();
    this.anims = []; // {tv, kind, t, dur, ...}
  }

  buildBoard() {
    const B = BOARD_HALF;
    this.board = new THREE.Group(); this.inner.add(this.board);
    this.board.position.y = 0;
    // slab
    const slabMat = new THREE.MeshStandardMaterial({ color: 0x07060f, metalness: 0.92, roughness: 0.28, envMapIntensity: 1.2 });
    const slab = new THREE.Mesh(new RoundedBoxGeometry(B * 2, 0.42, B * 2, 3, 0.12), slabMat);
    slab.position.y = BOARD_Y - 0.21; this.board.add(slab);
    // socket surface
    this.sockU = {
      uTime: U.uTime, uC1: U.uC1, uC2: U.uC2, uC3: U.uC3,
      uPulses: { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, -100, 0)) },
      uDanger: { value: 0 }, uHeat: { value: new Array(16).fill(0) },
    };
    const sock = new THREE.Mesh(new THREE.PlaneGeometry(B * 2 - 0.12, B * 2 - 0.12), new THREE.ShaderMaterial({
      uniforms: this.sockU, transparent: false,
      vertexShader: /* glsl */`varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uDanger; uniform vec3 uC1, uC2, uC3; uniform vec4 uPulses[4]; uniform float uHeat[16];
        varying vec2 vP;
        float sdRound(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
        void main(){
          vec2 p = vec2(vP.x, -vP.y);                       // plane y -> world -z
          float C = ${CELL.toFixed(3)}; float N = ${SIZE.toFixed(1)};
          vec2 g = p / C + N * 0.5;  vec2 cell = floor(g); vec2 f = (fract(g) - 0.5) * C;
          float inside = step(0.0, cell.x) * step(cell.x, N - 1.0) * step(0.0, cell.y) * step(cell.y, N - 1.0);
          float d = sdRound(f, vec2(${(TILE / 2 + 0.03).toFixed(3)}), 0.14);
          vec3 base = vec3(0.012, 0.010, 0.026);
          vec3 col = base;
          float rim = exp(-abs(d) * 38.0) * inside;
          float idx = cell.y * N + cell.x; float heat = 0.0;
          for (int i = 0; i < 16; i++) if (abs(float(i) - idx) < 0.5) heat = uHeat[i];
          col += mix(uC1, uC3, heat) * rim * (0.32 + heat * 1.4);
          col += uC1 * smoothstep(0.0, -0.5, d) * 0.03 * inside;                         // faint recess fill
          col += mix(uC1, uC3, 0.5) * heat * 0.12 * step(d, 0.0) * inside;
          // fine dot grid on frame
          vec2 gp = fract(p * 6.0) - 0.5; col += uC2 * smoothstep(0.08, 0.0, length(gp)) * 0.05 * (1.0 - inside * step(d, 0.0));
          // merge pulses
          for (int i = 0; i < 4; i++) {
            vec4 P = uPulses[i]; float age = uTime - P.z;
            if (age > 0.0 && age < 1.2) { float r = age * 7.0; float dd = length(p - P.xy);
              col += mix(uC2, uC1, 0.4) * exp(-pow((dd - r) * 3.0, 2.0)) * P.w * (1.0 - age / 1.2) * (0.25 + rim * 2.0); }
          }
          // slow scan sweep
          float sy = mod(uTime * 1.6, 9.0) - 4.5; col += uC1 * exp(-pow((p.y - sy) * 2.5, 2.0)) * (0.02 + rim * 0.5);
          col += vec3(1.0, 0.05, 0.2) * uDanger * (0.04 + rim * 1.2);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    }));
    sock.rotation.x = -Math.PI / 2; sock.position.y = BOARD_Y + 0.002; this.board.add(sock);
    // neon rims
    this.rimMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.rimMat2 = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const L = B * 2 - 0.1;
    for (const s of [-1, 1]) {
      for (const [w, d, x, z] of [[L, 0.05, 0, s * (B - 0.02)], [0.05, L, s * (B - 0.02), 0]]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), this.rimMat); m.position.set(x, BOARD_Y + 0.01, z); this.board.add(m);
        const m2 = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), this.rimMat2); m2.position.set(x * 1.012, BOARD_Y - 0.4, z * 1.012); this.board.add(m2);
      }
    }
    // corner nodes
    this.nodeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.nodes = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const n = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), this.nodeMat); n.position.set(sx * (B + 0.25), BOARD_Y + 0.1, sz * (B + 0.25)); this.board.add(n); this.nodes.push(n);
    }
    // holo projector beam under the board
    const beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: U.uTime, uC1: U.uC1, uC2: U.uC2 },
      vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */`uniform float uTime; uniform vec3 uC1, uC2; varying vec2 vUv;
        void main(){ float a = pow(vUv.y, 1.6) * 0.16; float st = step(0.5, fract(vUv.y * 14.0 - uTime * 0.8)) * 0.35 + 0.65;
          float sides = 0.6 + 0.4 * step(0.5, fract(vUv.x * 32.0));
          gl_FragColor = vec4(mix(uC2, uC1, vUv.y) * a * st * sides, 1.0); }`,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(B * 0.95, 0.6, BOARD_Y - 0.4, 4, 1, true), beamMat);
    beam.rotation.y = Math.PI / 4; beam.position.y = (BOARD_Y - 0.4) / 2; this.board.add(beam);
    this.tiles = new THREE.Group(); this.inner.add(this.tiles);
  }

  // ---------- tile management ----------
  get(id) { return this.byId.get(id); }
  alloc(id, v, r, c) {
    let tv = this.pool.find(t => !t.active);
    if (!tv) { tv = this.pool[0]; }
    tv.active = true; tv.group.visible = true; tv.id = id;
    tv.setValue(v);
    cellPos(r, c, tv.group.position); tv.group.position.y = BOARD_Y + TILE_H / 2;
    tv.group.scale.set(1, 1, 1); tv.mat.uniforms.uGlow.value = 0; tv.mat.uniforms.uSpawn.value = 1; tv.mat.uniforms.uDim.value = 1;
    tv.base = tv.group.position.clone();
    this.byId.set(id, tv);
    return tv;
  }
  free(tv) { tv.active = false; tv.group.visible = false; this.byId.delete(tv.id); }
  clear() { for (const tv of this.pool) if (tv.active) this.free(tv); this.anims.length = 0; }

  /** rebuild instantly from a FuseGame (used on restore / undo) */
  sync(game, spawnAnim = false) {
    this.clear();
    for (const t of game.tiles()) { const tv = this.alloc(t.id, t.v, t.r, t.c); if (spawnAnim) this.spawnAnim(tv, Math.random() * 0.15); }
  }
  spawnAnim(tv, delay = 0) {
    tv.mat.uniforms.uSpawn.value = 0; tv.group.scale.setScalar(0.6);
    this.anims.push({ tv, kind: 'spawn', t: -delay, dur: T_SPAWN });
  }

  /** animate a move record from FuseGame.move(). onMerge(m, worldPos) fires when each merge lands. */
  applyMove(rec, onMerge) {
    this.finishAll();
    for (const s of rec.slides) {
      const tv = this.get(s.id); if (!tv) continue;
      const from = tv.group.position.clone();
      const to = cellPos(s.toR, s.toC); to.y = BOARD_Y + TILE_H / 2;
      this.anims.push({ tv, kind: 'slide', t: 0, dur: T_SLIDE, from, to, consumed: s.consumed });
    }
    for (const m of rec.merges) {
      this.anims.push({ kind: 'merge', t: 0, dur: T_SLIDE, m, onMerge });
    }
    if (rec.spawned) {
      const sp = rec.spawned;
      this.anims.push({ kind: 'spawnLater', t: 0, dur: T_SLIDE * 0.8, sp });
    }
  }
  /** fast-forward everything (new input arrived) */
  finishAll() { let guard = 0; while (this.anims.length && guard++ < 10) this.update(10, 0); }
  get busy() { return this.anims.some(a => a.kind !== 'pop' && a.kind !== 'spawn'); }

  update(dt, t) {
    const done = [];
    const list = this.anims.slice();
    for (const a of list) {
      a.t += dt;
      const k = Math.min(1, Math.max(0, a.t / a.dur));
      if (a.kind === 'slide') {
        const e = easeOutCubic(k);
        a.tv.group.position.lerpVectors(a.from, a.to, e);
        // squash & stretch along motion
        const st = Math.sin(k * Math.PI) * 0.12;
        const dx = Math.abs(a.to.x - a.from.x) > 0.01, dz = Math.abs(a.to.z - a.from.z) > 0.01;
        a.tv.group.scale.set(1 + (dx ? st : -st * 0.4), 1 - st * 0.3, 1 + (dz ? st : -st * 0.4));
        if (k >= 1) { a.tv.group.scale.set(1, 1, 1); if (a.consumed) this.free(a.tv); done.push(a); }
      } else if (a.kind === 'merge') {
        if (k >= 1) {
          const tv = this.alloc(a.m.id, a.m.v, a.m.r, a.m.c);
          tv.mat.uniforms.uGlow.value = 1.4;
          this.anims.push({ tv, kind: 'pop', t: 0, dur: T_POP });
          a.onMerge && a.onMerge(a.m, tv.group.position.clone());
          done.push(a);
        }
      } else if (a.kind === 'spawnLater') {
        if (k >= 1) { const tv = this.alloc(a.sp.id, a.sp.v, a.sp.r, a.sp.c); this.spawnAnim(tv); done.push(a); }
      } else if (a.kind === 'pop') {
        const s = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.28 * (1 - k * 0.3) : 1;
        a.tv.group.scale.set(s, 1 + (s - 1) * 1.6, s);
        a.tv.mat.uniforms.uGlow.value = 1.4 * Math.pow(1 - k, 2);
        if (k >= 1) { a.tv.group.scale.set(1, 1, 1); done.push(a); }
      } else if (a.kind === 'spawn') {
        if (a.t < 0) continue;
        a.tv.mat.uniforms.uSpawn.value = easeOutCubic(k);
        a.tv.group.scale.setScalar(0.6 + 0.4 * easeOutBack(k));
        if (k >= 1) { a.tv.group.scale.setScalar(1); a.tv.mat.uniforms.uSpawn.value = 1; done.push(a); }
      }
    }
    this.anims = this.anims.filter(a => !done.includes(a));
    // per-frame life: core spin + bob, socket heat decay
    for (const tv of this.pool) if (tv.active) {
      tv.core.rotation.y += dt * 1.4; tv.core.rotation.x += dt * 0.6;
      tv.core.position.y = Math.sin(t * 2 + tv.mat.uniforms.uSeed.value * 6) * 0.03;
    }
    const heat = this.sockU.uHeat.value; for (let i = 0; i < 16; i++) heat[i] = Math.max(0, heat[i] - dt * 1.2);
    // board tilt spring
    const kS = 90, damp = 12;
    this.tiltVel.x += ((this.tiltTarget.x - this.tilt.x) * kS - this.tiltVel.x * damp) * Math.min(dt, 0.05);
    this.tiltVel.y += ((this.tiltTarget.y - this.tilt.y) * kS - this.tiltVel.y * damp) * Math.min(dt, 0.05);
    this.tilt.x += this.tiltVel.x * Math.min(dt, 0.05); this.tilt.y += this.tiltVel.y * Math.min(dt, 0.05);
    this.tiltTarget.multiplyScalar(Math.exp(-dt * 10));
    this.root.position.y = BOARD_Y + Math.sin(t * 0.9) * 0.06;
    this.root.rotation.x = this.tilt.y * 0.45; this.root.rotation.z = -this.tilt.x * 0.45;
    // neon colours follow theme
    this.rimMat.color.copy(U.uC1.value).multiplyScalar(1.5);
    this.rimMat2.color.copy(U.uC2.value).multiplyScalar(1.2);
    this.nodeMat.color.copy(U.uC3.value).multiplyScalar(Math.sin(t * 3) > 0 ? 3 : 1.2);
    for (const n of this.nodes) n.rotation.y = t * 1.5;
  }

  /** nudge the board toward a direction (move feedback); strength ~1 */
  nudge(d, s = 1) {
    const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d];
    this.tiltVel.x += v[0] * 0.9 * s; this.tiltVel.y += v[1] * 0.9 * s;
  }
  pulseAt(x, z, strength = 1) {
    const P = this.sockU.uPulses.value; P.unshift(P.pop()); P[0].set(x, z, U.uTime.value, strength);
  }
  heatCell(r, c, h = 1) { this.sockU.uHeat.value[r * SIZE + c] = Math.min(1, h); }
  set danger(v) { this.sockU.uDanger.value = v; }
  /** dim all tiles (game over) 0..1 */
  setDim(v) { for (const tv of this.pool) if (tv.active) tv.mat.uniforms.uDim.value = v; }
}
