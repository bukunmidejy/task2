// Procedural hair textures (canvas). Created lazily once and shared.
import * as THREE from 'three';
import { mulberry32 } from '../../core/rng.js';

const cache = {};
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true, repeat = false) => { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };

// Lock of straight/wavy hair: many fine strands, transparent between clusters, tapered tip. U across, V along (0 = root).
export function strandTex() {
  if (cache.strand) return cache.strand;
  const W = 128, H = 512, c = mk(W, H), g = c.getContext('2d'), r = mulberry32(11);
  g.clearRect(0, 0, W, H);
  for (let i = 0; i < 46; i++) {
    const x0 = 3 + r() * (W - 6), amp = 0.5 + r() * 2.2, ph = r() * 6, len = H * (0.78 + r() * 0.22), v = 50 + r() * 70;
    g.strokeStyle = `rgba(${v},${v},${v},${0.75 + r() * 0.25})`; g.lineWidth = 1.2 + r() * 1.6; g.beginPath();
    for (let y = 0; y <= len; y += 8) { const x = x0 + Math.sin(y * 0.02 + ph) * amp; y ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }
  // soft taper to the tips and a dense root band
  g.globalCompositeOperation = 'destination-in'; const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.82, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0.0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'destination-over'; g.fillStyle = 'rgba(45,45,45,0.9)'; g.fillRect(W * 0.18, 0, W * 0.64, H * 0.9);
  return (cache.strand = tex(c));
}
// Dense kinky coils (afro / TWA / twist-out puffs)
export function coilTex(kind = 'coil') {
  if (cache[kind]) return cache[kind];
  const S = 256, c = mk(S, S), g = c.getContext('2d'), r = mulberry32(kind === 'coil' ? 5 : 9);
  g.clearRect(0, 0, S, S);
  if (kind === 'coil') {
    for (let i = 0; i < 620; i++) {
      const x = r() * S, y = r() * S, rad = 2.2 + r() * 4.2, v = 45 + r() * 85;
      g.strokeStyle = `rgba(${v},${v},${v},${0.8 + r() * 0.2})`; g.lineWidth = 1.6 + r() * 1.6; g.beginPath(); g.arc(x, y, rad, r() * 6, r() * 6 + 4.6); g.stroke();
      g.beginPath(); g.arc(x + rad * 1.2, y + rad * 0.4, rad * 0.8, r() * 6, r() * 6 + 4.2); g.stroke();
    }
    g.globalCompositeOperation = 'destination-over'; g.fillStyle = 'rgba(30,30,30,0.95)'; g.beginPath(); g.ellipse(S / 2, S * 0.5, S * 0.2, S * 0.3, 0, 0, 7); g.fill();
  } else { // twist-out: soft wavy clumps running along V
    for (let i = 0; i < 9; i++) {
      const x0 = 14 + i * 27 + r() * 8; g.lineWidth = 9 + r() * 4;
      for (let k = 0; k < 4; k++) { const v = 30 + r() * 45; g.strokeStyle = `rgba(${v},${v},${v},0.95)`; g.beginPath(); for (let y = 0; y <= S; y += 6) { const x = x0 + Math.sin(y * 0.09 + i + k * 1.7) * 7 + (k - 1.5) * 4; y ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
    }
  }
  g.globalCompositeOperation = 'destination-in'; g.fillStyle = 'rgba(0,0,0,1)'; g.fillRect(0, 0, S, S);
  return (cache[kind] = tex(c));
}
// Plaited braid pattern (repeat along V). Returns {map, bump}
export function braidTex() {
  if (cache.braid) return cache.braid;
  const W = 64, H = 128, c = mk(W, H), g = c.getContext('2d'), b = mk(W, H), gb = b.getContext('2d');
  g.fillStyle = '#505050'; g.fillRect(0, 0, W, H); gb.fillStyle = '#808080'; gb.fillRect(0, 0, W, H);
  for (let y = -H; y < H * 2; y += 32) for (const [x0, dir] of [[0, 1], [W / 2, -1]]) {
    for (let k = 0; k < 2; k++) { // chevrons: V-shaped plait ridges
      g.strokeStyle = 'rgba(30,30,30,0.85)'; gb.strokeStyle = 'rgba(15,15,15,1)'; g.lineWidth = 3; gb.lineWidth = 5;
      g.beginPath(); g.moveTo(x0, y + k * 16); g.lineTo(x0 + W / 2, y + k * 16 + dir * 14); g.stroke(); gb.beginPath(); gb.moveTo(x0, y + k * 16); gb.lineTo(x0 + W / 2, y + k * 16 + dir * 14); gb.stroke();
      g.strokeStyle = 'rgba(120,120,120,0.5)'; gb.strokeStyle = 'rgba(245,245,245,1)'; g.lineWidth = 2; gb.lineWidth = 3;
      g.beginPath(); g.moveTo(x0, y + k * 16 + 4); g.lineTo(x0 + W / 2, y + k * 16 + dir * 14 + 4); g.stroke(); gb.beginPath(); gb.moveTo(x0, y + k * 16 + 4); gb.lineTo(x0 + W / 2, y + k * 16 + dir * 14 + 4); gb.stroke();
    }
  }
  return (cache.braid = { map: tex(c, true, true), bump: tex(b, false, true) });
}
export function locTex() {
  if (cache.loc) return cache.loc;
  const W = 64, H = 128, c = mk(W, H), g = c.getContext('2d'), r = mulberry32(3);
  g.fillStyle = '#555'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 140; i++) { const v = r() < 0.5 ? 40 : 190; g.strokeStyle = `rgba(${v},${v},${v},0.35)`; g.lineWidth = 1 + r() * 2; const x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - 0.5) * 30, y + 14, x + (r() - 0.5) * 24, y + 30); g.stroke(); }
  return (cache.loc = { map: tex(c, true, true), bump: tex(c, false, true) });
}
export function stubbleTex() {
  if (cache.stub) return cache.stub;
  const S = 256, c = mk(S, S), g = c.getContext('2d'), r = mulberry32(21);
  g.fillStyle = '#6a6a6a'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 5200; i++) { const v = r() < 0.6 ? 20 : 200; g.fillStyle = `rgba(${v},${v},${v},0.5)`; const x = r() * S, y = r() * S, w = 1 + r() * 1.4; g.fillRect(x, y, w, w); }
  // wave pattern (360 waves) faint
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 3; for (let y = 0; y < S; y += 10) { g.beginPath(); for (let x = 0; x <= S; x += 8) g.lineTo(x, y + Math.sin(x * 0.12 + y) * 3); g.stroke(); }
  return (cache.stub = tex(c, true, true));
}

// Solid hair-clump skin: fine streaks running along V (tube length), soft light/dark banding. Lit with anisotropic spec.
export function clumpTex() {
  if (cache.clump) return cache.clump;
  const W = 128, H = 256, c = mk(W, H), g = c.getContext('2d'), b = mk(W, H), gb = b.getContext('2d'), r = mulberry32(31);
  g.fillStyle = '#808080'; g.fillRect(0, 0, W, H); gb.fillStyle = '#808080'; gb.fillRect(0, 0, W, H);
  for (let i = 0; i < 150; i++) {
    const x = r() * W, v = 95 + r() * 90, w = 0.8 + r() * 1.8, a = 0.25 + r() * 0.5;
    g.strokeStyle = `rgba(${v},${v},${v},${a})`; g.lineWidth = w; gb.strokeStyle = `rgba(${v},${v},${v},${a})`; gb.lineWidth = w;
    g.beginPath(); gb.beginPath();
    for (let y = 0; y <= H; y += 16) { const xx = x + Math.sin(y * 0.03 + i) * 1.4; y ? (g.lineTo(xx, y), gb.lineTo(xx, y)) : (g.moveTo(xx, y), gb.moveTo(xx, y)); }
    g.stroke(); gb.stroke();
  }
  return (cache.clump = { map: tex(c, true, true), bump: tex(b, false, true) });
}
