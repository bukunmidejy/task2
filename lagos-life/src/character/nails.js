// Nails: curved plates on every fingertip, attached to the distal finger bones so they move with the hand.
// type -> finish/thickness (natural matte, gel glossy, acrylic thick+long, press-on glossy); shape -> outline;
// design -> canvas texture (solid, french, glitter, ombre, dots, chrome).
import * as THREE from 'three';
import { FINGERS } from './rig.js';
import { mulberry32 } from '../core/rng.js';
import { skinPalette, lin2hex } from '../core/skincolor.js';

const outline = (shape, v) => { // half-width factor along the nail (v: 0 base .. 1 free edge)
  switch (shape) {
    case 'square': return 1 - 0.03 * v * v;
    case 'round': return v < 0.75 ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow((v - 0.75) / 0.25, 2)));
    case 'almond': return Math.pow(Math.max(0, 1 - Math.pow(v, 2.2) * 0.98), 0.9) * (v > 0.55 ? 1 - (v - 0.55) * 0.9 : 1);
    case 'coffin': return v < 0.6 ? 1 : 1 - (v - 0.6) * 1.3;
    case 'stiletto': return Math.max(0.05, 1 - v * 0.95);
    default: return 1;
  }
};
function designTex(design, color, accent) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d'), r = mulberry32(5);
  g.fillStyle = color; g.fillRect(0, 0, 64, 128);
  if (design === 'french') { g.fillStyle = accent; g.beginPath(); g.moveTo(0, 128); g.lineTo(0, 100); g.quadraticCurveTo(32, 84, 64, 100); g.lineTo(64, 128); g.fill(); }
  else if (design === 'glitter') for (let i = 0; i < 160; i++) { g.fillStyle = r() < 0.5 ? accent : '#ffffff'; g.fillRect(r() * 64, r() * 128, 1.6, 1.6); }
  else if (design === 'ombre') { const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, color); gr.addColorStop(1, accent); g.fillStyle = gr; g.fillRect(0, 0, 64, 128); }
  else if (design === 'dots') for (let i = 0; i < 6; i++) { g.fillStyle = accent; g.beginPath(); g.arc(14 + r() * 36, 20 + i * 18, 4, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildNails(ch) {
  const s = ch.state.nails, rig = ch.rig, out = [];
  const natural = s.type === 'natural';
  if (natural) return out; // natural nails are skin-tone and sub-pixel at game distance: rendering a plate only creates pale flakes
  const mat = new THREE.MeshPhysicalMaterial({ map: designTex(s.design, s.color, s.designColor), roughness: natural ? 0.55 : 0.12, clearcoat: natural ? 0.1 : 1, clearcoatRoughness: 0.05,
    metalness: s.design === 'chrome' ? 0.9 : 0, side: THREE.DoubleSide, transparent: false });
  if (s.design === 'chrome') { mat.color = new THREE.Color('#d8d8e0'); mat.roughness = 0.08; }
  for (const sd of ['L', 'R']) {
    const hl = rig.hands[sd];
    for (const f of FINGERS) {
      const F = hl.fingers[f], a = F.joints[2], b = F.joints[3], d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), segLen = d.length(); d.normalize();
      const dorsal = new THREE.Vector3(...hl.n).multiplyScalar(-1), across = new THREE.Vector3(0, 0, 1);
      const thick = F.radius * 0.86 * 0.9 * (natural ? 0.9 : 1.0), halfW = F.radius * 0.72 * (f === 'thumb' ? 1.08 : 1);
      const natLen = segLen * 0.78, ext = s.length * (s.type === 'natural' ? 0.2 : 1) * 0.016 * (f === 'pinky' ? 0.85 : 1) * (s.type === 'acrylic' ? 1.25 : 1) + (natural ? 0 : 0.0008);
      const NU = 10, NV = 12, pos = [], uv = [], idx = [], L = natLen + ext, start = segLen - natLen;
      for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
        const v = j / NV, u = (i / NU) * 2 - 1, w = Math.max(0.0001, outline(s.shape, v)) * halfW;
        const along = start + L * v, over = Math.max(0, along - segLen), curl = u * u * halfW * 0.55;
        const base = new THREE.Vector3(...a).addScaledVector(d, Math.min(along, segLen) + over).addScaledVector(across, u * w).addScaledVector(dorsal, thick + 0.0006 - curl * (0.6 + 0.4 * (1 - v)) + over * 0.04 * (s.type === 'acrylic' ? 0.8 : 0.3));
        pos.push(base.x, base.y, base.z); uv.push(i / NU, 1 - v);
      }
      for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const k = j * (NU + 1) + i; idx.push(k, k + 1, k + NU + 1, k + 1, k + NU + 2, k + NU + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      // geometry is in character rest space; attach to the distal bone via inverse of its rest position (bones have identity rest rotation)
      g.translate(-a[0], -a[1], -a[2]);
      const m = new THREE.Mesh(g, mat); m.position.set(0, 0, 0); m.castShadow = false; m.frustumCulled = false; ch.bones[`${f}3${sd}`].add(m); out.push(m);
    }
  }
  return out;
}
