// Eyes: textured wet eyeball (sclera + iris + limbal ring + pupil), anatomically shaped eyelids that
// blink by rotating shells about the eye centre, and lashes. Lids use the skin shader.
import * as THREE from 'three';
import { EYE_COLORS } from '../data/params.js';
import { mulberry32 } from '../core/rng.js';
import { FACE_RECT } from './head.js';

export function paintEyeTexture(irisHex, seed = 1) {
  const W = 1024, Hh = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
  const c = cv.getContext('2d'), rng = mulberry32(seed + 77);
  // sclera: warm off-white (never pure white), darker toward the lid corners, faint vessels
  const g = c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#d9cdbd'); g.addColorStop(0.25, '#ece3d6'); g.addColorStop(0.5, '#d7c9b6'); g.addColorStop(1, '#d9cdbd');
  c.fillStyle = g; c.fillRect(0, 0, W, Hh);
  c.fillStyle = 'rgba(160,70,60,0.10)'; for (let i = 0; i < 90; i++) { const x = rng() * W, y = Hh * (0.3 + rng() * 0.4); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 15 + rng() * 20, y + (rng() - 0.5) * 20, x + 30 + rng() * 40, y + (rng() - 0.5) * 30); c.lineWidth = 0.6 + rng() * 0.8; c.strokeStyle = 'rgba(150,60,55,0.18)'; c.stroke(); }
  const cx = W * 0.25, cy = Hh * 0.5, deg = W / 360, R = 29 * deg;       // iris radius 28deg (~11.5mm iris)
  const base = irisHex;
  const rg = c.createRadialGradient(cx, cy, 0, cx, cy, R); rg.addColorStop(0, shade(base, 0.55)); rg.addColorStop(0.35, base); rg.addColorStop(0.8, shade(base, 1.25)); rg.addColorStop(0.94, shade(base, 0.5)); rg.addColorStop(1, '#0a0705');
  c.fillStyle = rg; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill();
  // radial fibres
  for (let i = 0; i < 260; i++) { const a = rng() * 6.283, r0 = R * (0.22 + rng() * 0.2), r1 = R * (0.7 + rng() * 0.25); c.strokeStyle = rng() < 0.5 ? 'rgba(0,0,0,0.22)' : 'rgba(255,220,170,0.13)'; c.lineWidth = 0.8 + rng(); c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); c.stroke(); }
  // collarette ring & pupil
  c.strokeStyle = 'rgba(200,140,70,0.25)'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, R * 0.4, 0, 7); c.stroke();
  c.fillStyle = '#050403'; c.beginPath(); c.arc(cx, cy, 11 * deg, 0, 7); c.fill();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function shade(hex, f) { const v = [1, 3, 5].map(i => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f))); return `rgb(${v})`; }

const D2R = Math.PI / 180;
const sph = (R, phi, lat) => new THREE.Vector3(R * Math.cos(lat) * Math.sin(phi), R * Math.sin(lat), R * Math.cos(lat) * Math.cos(phi));

// Build one eye assembly. side: -1 right eye (x<0) / +1 left eye
export function buildEye({ center, side, radius, irisHex, open = 1, tilt = 0, lidFull = 0, skinMat, seed = 1 }) {
  const grp = new THREE.Group(); grp.position.set(...center);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(radius, 56, 36),
    new THREE.MeshPhysicalMaterial({ map: paintEyeTexture(irisHex, seed), roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.02, ior: 1.35, specularIntensity: 1 }));
  ball.rotation.y = -Math.PI / 2; // sphere UV front (+z at u=.25) already faces +z; keep default orientation
  ball.rotation.y = 0;
  const pivot = new THREE.Group(); pivot.add(ball); grp.add(pivot);
  // ---- lids as spherical shells with elliptical openings
  const R = radius * 1.07, nU = 60, nV = 12;
  const pOpen = 24 - 5 * lidFull + 10 * (open - 1), lOpen = -(18 + 5 * (open - 1));
  const phiMed = -54 * D2R, phiLat = 62 * D2R, phiA = -80 * D2R, phiB = 88 * D2R;
  const makeLid = upper => {
    const pos = [], uvs = [], idx = [], rowEdge = [];
    for (let j = 0; j <= nV; j++) for (let i = 0; i <= nU; i++) {
      const w = i / nU, ph = phiA + (phiB - phiA) * w;                 // shell spans well beyond the canthi
      const u = (ph - phiMed) / (phiLat - phiMed), inside = u > 0 && u < 1, v = j / nV;
      const tiltDeg = tilt * 7 * (u - 0.4);
      let edge = 0;
      if (inside) edge = upper ? Math.sin(Math.PI * Math.pow(u, 0.82)) * pOpen + tiltDeg * Math.sin(Math.PI * u)
                               : lOpen * Math.sin(Math.PI * Math.pow(u, 1.05)) + tiltDeg * 0.6 * Math.sin(Math.PI * u);
      const span = upper ? 52 : 40, lat = (edge + (upper ? 1 : -1) * span * Math.pow(v, 1.1)) * D2R;
      const rr = R * (1 - (j === 0 ? 0.01 : 0));
      const p = sph(rr, ph, lat); pos.push(p.x * side, p.y, p.z);
      const wx = center[0] + p.x * side, wy = center[1] + p.y;
      uvs.push((wx - FACE_RECT.x0) / FACE_RECT.w, (wy - FACE_RECT.y0) / FACE_RECT.h);
      if (j === 0 && inside) rowEdge.push(p.clone());
    }
    for (let j = 0; j < nV; j++) for (let i = 0; i < nU; i++) { const a = j * (nU + 1) + i, b = a + 1, c = a + nU + 1, d = c + 1; if ((side > 0) === upper) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, skinMat); m.castShadow = false;
    return { mesh: m, edge: rowEdge };
  };
  const up = makeLid(true), lo = makeLid(false);
  const upPivot = new THREE.Group(), loPivot = new THREE.Group(); upPivot.add(up.mesh); loPivot.add(lo.mesh); grp.add(upPivot, loPivot);
  // ---- lashes (upper dense, lower sparse). dark, slightly curled, tapered ribbons attached to the lid margin
  const lashMat = new THREE.MeshStandardMaterial({ color: 0x070504, roughness: 0.5, side: THREE.DoubleSide });
  const lashes = new THREE.Mesh(new THREE.BufferGeometry(), lashMat); upPivot.add(lashes);
  const lowLashes = new THREE.Mesh(new THREE.BufferGeometry(), lashMat); loPivot.add(lowLashes);
  const rng = mulberry32(seed + (side > 0 ? 3 : 5));
  const buildLashes = (len, dens, thick) => {
    const mk = (edge, upper, n, L, curl) => {
      const pos = [], idx = []; let vi = 0;
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n, f = t * (edge.length - 1), i0 = Math.floor(f), p0 = edge[i0], p1 = edge[Math.min(edge.length - 1, i0 + 1)], p = p0.clone().lerp(p1, f - i0);
        const nrm = p.clone().normalize(), up = new THREE.Vector3(0, upper ? 1 : -1, 0), side_ = new THREE.Vector3().crossVectors(up, nrm).normalize();
        const tl = L * (0.55 + 0.7 * Math.sin(Math.PI * (0.15 + 0.8 * t))) * (0.85 + 0.3 * rng());
        const dir = nrm.clone().multiplyScalar(0.92).add(up.clone().multiplyScalar(0.30 * curl)).normalize();
        const mid = p.clone().addScaledVector(dir, tl * 0.5).addScaledVector(up, tl * 0.06 * curl), tip = p.clone().addScaledVector(dir, tl).addScaledVector(up, tl * 0.42 * curl);
        const w = thick; const a = p.clone().addScaledVector(side_, -w), b = p.clone().addScaledVector(side_, w), m1 = mid.clone().addScaledVector(side_, -w * 0.6), m2 = mid.clone().addScaledVector(side_, w * 0.6);
        for (const q of [a, b, m1, m2, tip]) pos.push(q.x * side, q.y, q.z);
        idx.push(vi, vi + 1, vi + 3, vi, vi + 3, vi + 2, vi + 2, vi + 3, vi + 4); vi += 5;
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
    };
    lashes.geometry.dispose(); lowLashes.geometry.dispose();
    const upEdge = up.edge.map(v => v.clone().multiplyScalar(1.0)); upEdge.forEach(v => { v.x *= 1; });
    // positions were stored before the side flip; lashes apply it themselves
    lashes.geometry = mk(upEdge, true, Math.round(20 + 14 * dens), (0.0042 + 0.0058 * len), 1);
    lowLashes.geometry = mk(lo.edge, false, Math.round(10 + 8 * dens), 0.0020 + 0.0028 * len, 0.5);
  };
  buildLashes(0.2, 0.3, 0.00030);
  grp.userData = { ball, upPivot, loPivot, pivot, buildLashes, openAngle: { up: 0, lo: 0 }, closeUp: (pOpen + 11) * D2R, closeLo: 7 * D2R, side };
  return grp;
}

export function setBlink(eye, amount, squint = 0) {
  const u = eye.userData; // rotate about local X: +angle lowers the upper lid
  u.upPivot.rotation.x = u.closeUp * Math.min(1, amount + squint * 0.45) * 1.0;
  u.loPivot.rotation.x = -u.closeLo * Math.min(1, amount * 0.6 + squint * 0.5);
}
export function setGaze(eye, yaw, pitch) { eye.userData.pivot.rotation.set(-pitch, yaw, 0); }
export const eyeColorHex = id => (EYE_COLORS.find(e => e.id === id) || EYE_COLORS[0]).hex;
