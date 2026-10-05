// Headwear built in head space from the real head mesh: a conforming cap shell + sculpted folds.
//  gele : cap + stacked brow band + large pleated fan "wing"        fila : soft aso-oke cap with folded brim
//  wrap : turban-style head wrap (cap + wound rolls + top knot)
import * as THREE from 'three';
import { createFabricMaterial } from './fabrics.js';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

function capShell(hd, lineFn, offFn) {
  const P = hd.position, N = hd.normal, I = hd.index, n = P.length / 3, g = new Float32Array(n);
  for (let i = 0; i < n; i++) g[i] = lineFn(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
  const pos = [], nor = [], idx = [], cache = new Map(), vmap = new Int32Array(n).fill(-1);
  const mk = (a, b, t) => { const x = lerp(P[a * 3], P[b * 3], t), y = lerp(P[a * 3 + 1], P[b * 3 + 1], t), z = lerp(P[a * 3 + 2], P[b * 3 + 2], t); let nx = lerp(N[a * 3], N[b * 3], t), ny = lerp(N[a * 3 + 1], N[b * 3 + 1], t), nz = lerp(N[a * 3 + 2], N[b * 3 + 2], t); const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; const o = offFn(g_at(a, b, t), x, y, z); pos.push(x + nx * o, y + ny * o, z + nz * o); nor.push(nx, ny, nz); };
  const g_at = (a, b, t) => lerp(g[a], g[b], t);
  const vert = i => { if (vmap[i] >= 0) return vmap[i]; vmap[i] = pos.length / 3; mk(i, i, 0); return vmap[i]; };
  const edge = (a, b) => { const key = a < b ? a * 1e7 + b : b * 1e7 + a; let v = cache.get(key); if (v !== undefined) return v; v = pos.length / 3; const t = g[a] / (g[a] - g[b]); if (a < b) mk(a, b, t); else mk(b, a, 1 - t); cache.set(key, v); return v; };
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2], ins = [g[a] >= 0, g[b] >= 0, g[c] >= 0], cnt = ins[0] + ins[1] + ins[2]; if (!cnt) continue;
    if (cnt === 3) { idx.push(vert(a), vert(b), vert(c)); continue; }
    const v = [a, b, c];
    if (cnt === 1) { const k = ins.indexOf(true), p = v[k], q = v[(k + 1) % 3], r = v[(k + 2) % 3]; idx.push(vert(p), edge(p, q), edge(p, r)); }
    else { const k = ins.indexOf(false), p = v[k], q = v[(k + 1) % 3], r = v[(k + 2) % 3]; const e1 = edge(q, p), e2 = edge(r, p); idx.push(vert(q), vert(r), e2, vert(q), e2, e1); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('aRest', new THREE.Float32BufferAttribute(pos.slice(), 3)); geo.setIndex(idx);
  return geo;
}
const ribbon = (pts, widths, side, geoOut) => { // flat folded ribbon along pts
  const { pos, idx } = geoOut, base = pos.length / 3;
  for (let i = 0; i < pts.length; i++) { const w = widths[i] / 2; pos.push(pts[i][0] - side[i][0] * w, pts[i][1] - side[i][1] * w, pts[i][2] - side[i][2] * w, pts[i][0] + side[i][0] * w, pts[i][1] + side[i][1] * w, pts[i][2] + side[i][2] * w); if (i < pts.length - 1) { const k = base + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
};
function meshFrom(pos, idx, mat) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aRest', new THREE.Float32BufferAttribute(pos.slice(), 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; return m;
}

export function buildHeadwear(ch, kind, def, w) {
  const hd = ch.headData, items = [], mat = createFabricMaterial(w.fabric, w.color, w.variant), v = new THREE.Vector3();
  const yLine = (z, front) => front - 0.5 * Math.max(0, -(z + 0.005)) * 1.0 - 0.012 * Math.max(0, z - 0.04);
  if (kind === 'gele' || kind === 'wrap') {
    const front = kind === 'wrap' ? 0.082 : 0.090;
    const cap = capShell(hd, (x, y, z) => y - yLine(z, front) - (Math.abs(x) > 0.058 ? 0.0 : 0), (g) => 0.011 + 0.008 * (1 - sm(0, 0.025, g)) + 0.004 * Math.sin(g * 160));
    const cm = new THREE.Mesh(cap, mat); cm.castShadow = true; cm.frustumCulled = false; items.push(cm);
    const pos = [], idx = [];
    if (kind === 'gele') {
      // pleated fan wing sweeping up and out from the right side of the crown
      const F0 = new THREE.Vector3(0.026, 0.108, -0.004), N_ = 17;
      for (let k = 0; k < N_; k++) {
        const u = k / (N_ - 1), psi = lerp(-1.35, 1.25, u), dir = new THREE.Vector3(Math.sin(psi) * 0.85 + 0.18, Math.cos(psi), -0.3 * Math.sin(psi) * 0.5).normalize(), reach = 0.15 + 0.07 * Math.sin(Math.PI * u) + 0.02 * (k % 2);
        const pts = [], widths = [], sides = [], nrm = new THREE.Vector3(0.2, 0.0, 1).normalize();
        for (let i = 0; i <= 8; i++) {
          const t = i / 8, p = F0.clone().addScaledVector(dir, 0.012 + reach * t); p.y -= 0.045 * t * t * t; p.z += 0.02 * Math.sin(Math.PI * t) * (k % 2 ? 1 : -1) * 0.5; pts.push([p.x, p.y, p.z]);
          widths.push(0.016 + 0.052 * t); const s = new THREE.Vector3().crossVectors(dir, nrm).normalize(); s.applyAxisAngle(dir, (k % 2 ? 1 : -1) * 0.55); sides.push([s.x, s.y, s.z]);
        }
        ribbon(pts, widths, sides, { pos, idx });
      }
      // brow band: three stacked tubes around the forehead for a layered wrapped edge
      for (let r = 0; r < 3; r++) {
        const curve = new THREE.CatmullRomCurve3(Array.from({ length: 28 }, (_, i) => { const a = (i / 28) * Math.PI * 2, rx = 0.074 + 0.003 * r, rz = 0.09 + 0.002 * r, y = yLine(Math.cos(a) * rz - 0.0, front) + 0.012 + r * 0.006; return new THREE.Vector3(Math.sin(a) * rx, y, -0.012 + Math.cos(a) * rz); }), true);
        const tg = new THREE.TubeGeometry(curve, 72, 0.0085, 7, true), m = new THREE.Mesh(tg, mat); tg.setAttribute('aRest', tg.attributes.position.clone()); m.castShadow = true; m.frustumCulled = false; items.push(m);
      }
    } else {
      // wound rolls + knot
      for (let r = 0; r < 4; r++) {
        const tilt = (r - 1.5) * 0.28, curve = new THREE.CatmullRomCurve3(Array.from({ length: 28 }, (_, i) => { const a = (i / 28) * Math.PI * 2; return new THREE.Vector3(Math.sin(a) * (0.083 + 0.004 * r), 0.075 + Math.cos(a) * 0.012 + tilt * Math.sin(a) * 0.05 + 0.012 * r, -0.012 + Math.cos(a) * (0.092 + 0.004 * r)); }), true);
        const tg = new THREE.TubeGeometry(curve, 72, 0.0135, 7, true), m = new THREE.Mesh(tg, mat); tg.setAttribute('aRest', tg.attributes.position.clone()); m.castShadow = true; m.frustumCulled = false; items.push(m);
      }
      const kn = new THREE.TorusKnotGeometry(0.024, 0.0095, 64, 8, 2, 3), km = new THREE.Mesh(kn, mat); kn.setAttribute('aRest', kn.attributes.position.clone()); km.position.set(0.012, 0.15, 0.025); km.rotation.set(0.5, 0.3, 0); km.frustumCulled = false; items.push(km);
    }
    if (pos.length) items.push(meshFrom(pos, idx, mat));
  } else if (kind === 'fila') {
    const cap = capShell(hd, (x, y, z) => y - (0.070 - 0.35 * Math.max(0, -(z + 0.005))) - 0.014 * (x > 0 ? 1 : 0) * 0, (g) => 0.011 + 0.011 * (1 - sm(0, 0.022, g)));
    const cm = new THREE.Mesh(cap, mat); cm.castShadow = true; cm.frustumCulled = false; items.push(cm);
  }
  return items;
}
