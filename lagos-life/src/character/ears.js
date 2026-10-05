// Ears: separate high-resolution SDF mesh (1.3mm) - helix rim, antihelix, concha, tragus, lobe.
import * as THREE from 'three';
import { PrimList, meshSDF } from './sdf.js';
import { BONE_INDEX } from './rig.js';

export function earGeometry(f) {
  const H = BONE_INDEX.head, P = new PrimList(), sz = 1 + 0.13 * f.earSize, lobe = 1 + 0.45 * f.earLobe;
  const ey = 0.0, ez = 0.0;
  // ear local frame: +x away from head, +y up, +z forward. x=0 is the head surface.
  P.add();
  P.ell(H, [0.0065, 0.0, 0.0], 0.0032, 0.0300 * sz, 0.0158 * sz, 0.004);           // base plate
  const rim = [], n = 20;
  for (let i = 0; i <= n; i++) { const t = (-35 + (i / n) * 290) * Math.PI / 180; // C-shaped helix: opens toward the face-front lower side
    rim.push([0.0098, ey + Math.sin(t + 0.3) * 0.0285 * sz * (t > 2.4 ? 0.82 : 1), ez - Math.cos(t + 0.3) * 0.0148 * sz]); }
  for (let i = 0; i < rim.length - 1; i++) P.seg(H, rim[i], rim[i + 1], 0.0026, 0.0026, 0.0026, 0.0026, 0.002);
  const anti = []; for (let i = 0; i <= 12; i++) { const t = (-10 + (i / 12) * 220) * Math.PI / 180; anti.push([0.0088, 0.0035 + Math.sin(t + 0.4) * 0.0165 * sz, -0.0015 - Math.cos(t + 0.4) * 0.0078 * sz]); }
  for (let i = 0; i < anti.length - 1; i++) P.seg(H, anti[i], anti[i + 1], 0.0021, 0.0021, 0.0021, 0.0021, 0.003);
  P.ell(H, [0.0085, -0.0305 * sz * lobe * 0.9 + 0.0034 * lobe, 0.002 * sz], 0.0042, 0.0085 * lobe * sz, 0.0088 * sz, 0.004);  // lobe
  P.ell(H, [0.0092, 0.0035 * sz, 0.0118 * sz], 0.0033, 0.0058 * sz, 0.0042 * sz, 0.003);                                  // tragus
  P.ell(H, [0.0092, -0.0075 * sz, 0.0092 * sz], 0.003, 0.0045 * sz, 0.0032 * sz, 0.003);                                   // antitragus
  P.subtract();
  P.ell(H, [0.0125, -0.0018 * sz, 0.0028 * sz], 0.0036, 0.0105 * sz, 0.0058 * sz, 0.004);                                   // concha bowl
  const m = meshSDF(P, { min: [-0.004, -0.05 * sz, -0.03 * sz], max: [0.022, 0.05 * sz, 0.03 * sz], h: 0.0013, B: 4, weights: false });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.position, 3)); g.setAttribute('normal', new THREE.BufferAttribute(m.normal, 3)); g.setIndex(new THREE.BufferAttribute(m.index, 1));
  return g;
}
