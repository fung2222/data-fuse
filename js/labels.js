// Canvas textures for tile numbers (cached per value). Call await loadFonts() before first use.
import * as THREE from 'three';

const cache = new Map();
export async function loadFonts() {
  try { await Promise.race([document.fonts.load('900 120px Orbitron'), new Promise(r => setTimeout(r, 2500))]); } catch {}
}
export function fmt(v) { return v >= 100000 ? Math.round(v / 1024) + 'K' : String(v); }

export function labelTexture(v, colorHex) {
  if (cache.has(v)) return cache.get(v);
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const txt = fmt(v), n = txt.length;
  const fs = [0, 150, 132, 104, 80, 66, 56][Math.min(n, 6)];
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 ${fs}px Orbitron, "Noto Sans TC", sans-serif`;
  const col = '#' + new THREE.Color(colorHex).getHexString();
  // dark halo for contrast against the glowing glass, then coloured glow, then white core
  g.lineJoin = 'round'; g.strokeStyle = 'rgba(4,0,14,0.85)'; g.lineWidth = fs * 0.16; g.strokeText(txt, S / 2, S / 2 + fs * 0.04);
  g.shadowColor = col; g.shadowBlur = 18; g.fillStyle = col; g.fillText(txt, S / 2, S / 2 + fs * 0.04);
  g.shadowBlur = 0; g.fillStyle = '#ffffff'; g.globalAlpha = 0.92; g.fillText(txt, S / 2, S / 2 + fs * 0.04);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true;
  cache.set(v, t);
  return t;
}
