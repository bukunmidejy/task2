// Clothing generator. Garments are built FROM THE CHARACTER'S OWN BODY SURFACE:
//  wrap  : the body mesh is clipped by a smooth region field (hems, necklines, sleeves, armholes) and
//          offset along the surface normal by per-region ease. Same skeleton + same skin weights as the
//          body => it deforms with the body exactly, cannot float, and cannot clip through it.
//  skirt : a radial loft whose radius is sampled from the body's SDF hull, so it always clears hips/thighs.
//  shoes : wrap of the foot + a rubber sole shell (+ heel block; heel height drives the foot pose).
import * as THREE from 'three';
import { GARMENT_BY_ID } from '../../data/wardrobe.js';
import { BONE_INDEX } from '../rig.js';
import { createFabricMaterial, createSoleMaterial } from './fabrics.js';
import { buildHeadwear } from './headwear.js';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const LAYER = { bottom: 0.0, top: 0.004, onePiece: 0.004, outer: 0.015 };
const ARM_BONES = new Set(Object.entries(BONE_INDEX).filter(([k]) => /^(upperArm|foreArm)/.test(k)).map(([, v]) => v));
const FOOT_BONES = new Set(Object.entries(BONE_INDEX).filter(([k]) => /^(foot|toe)/.test(k)).map(([, v]) => v));

export class Clothing {
  constructor(ch) { this.ch = ch; this.group = new THREE.Group(); this.group.name = 'clothing'; ch.root.add(this.group); this.prep = null; this.gaitScale = 1; this.heel = { angle: 0, plantY: 0 }; this.hidesHair = false; }
  clear() { for (const o of [...this.group.children]) { this.group.remove(o); o.geometry?.dispose(); o.material?.dispose?.(); } for (const o of [...(this.headItems || [])]) { o.parent?.remove(o); o.geometry?.dispose(); o.material?.dispose?.(); } this.headItems = []; }

  // ---- per-body preprocessing (cached until the body mesh changes)
  prepare() {
    const bd = this.ch.bodyData, [v0, v1] = bd.ranges[0], n = v1 - v0, rig = this.ch.rig, J = rig.J;
    const P = bd.position, N = bd.normal, SI = bd.skinIndex, SW = bd.skinWeight, I = [];
    for (let t = 0; t < bd.index.length; t += 3) if (bd.index[t] < v1 && bd.index[t + 1] < v1 && bd.index[t + 2] < v1) I.push(bd.index[t], bd.index[t + 1], bd.index[t + 2]);
    const wArm = new Float32Array(n), wFoot = new Float32Array(n), armS = new Float32Array(n);
    const arms = { L: [J.upperArmL, J.foreArmL, J.handL], R: [J.upperArmR, J.foreArmR, J.handR] }, seg = {};
    for (const sd of ['L', 'R']) { const [a, b, c] = arms[sd], l1 = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2]); seg[sd] = { a, b, c, l1, l2, tot: l1 + l2 }; }
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 4; k++) { const b = SI[i * 4 + k], w = SW[i * 4 + k]; if (ARM_BONES.has(b)) wArm[i] += w; if (FOOT_BONES.has(b)) wFoot[i] += w; }
      const sd = P[i * 3] >= 0 ? 'L' : 'R', S = seg[sd], x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      let best = 1e9, bs = 0;
      for (const [A, Bp, off, len] of [[S.a, S.b, 0, S.l1], [S.b, S.c, S.l1, S.l2]]) {
        const dx = Bp[0] - A[0], dy = Bp[1] - A[1], dz = Bp[2] - A[2], l2 = dx * dx + dy * dy + dz * dz; let t = ((x - A[0]) * dx + (y - A[1]) * dy + (z - A[2]) * dz) / l2; t = Math.max(-0.2, Math.min(1, t));
        const d = Math.hypot(x - (A[0] + dx * t), y - (A[1] + dy * t), z - (A[2] + dz * t)); if (d < best) { best = d; bs = (off + len * Math.max(0, t)) / S.tot; }
      }
      armS[i] = bs;
    }
    // adjacency (CSR) for smoothing scalar fields
    const deg = new Int32Array(n + 1); for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) deg[I[t + k] + 1] += 2;
    for (let i = 0; i < n; i++) deg[i + 1] += deg[i]; const adj = new Int32Array(deg[n]), fill = deg.slice(0, n);
    for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) { const a = I[t + k], b = I[t + (k + 1) % 3], c = I[t + (k + 2) % 3]; adj[fill[a]++] = b; adj[fill[a]++] = c; }
    this.prep = { n, P, N, SI, SW, I: Uint32Array.from(I), wArm, wFoot, armS, seg, deg, adj, rig };
  }
  smoothField(g, passes = 2) { const { n, deg, adj } = this.prep; const tmp = new Float32Array(n); for (let p = 0; p < passes; p++) { for (let i = 0; i < n; i++) { let s = g[i] * 2, c = 2; for (let k = deg[i]; k < deg[i + 1]; k++) { s += g[adj[k]]; c++; } tmp[i] = s / c; } g.set(tmp); } }

  build() {
    this.clear(); const ch = this.ch, st = ch.state; if (!ch.bodyData) return;
    this.prepare(); this.gaitScale = 1; this.heel = { angle: 0, plantY: 0 }; this.hidesHair = false;
    const worn = st.clothing.worn; this.wornDefs = [];
    for (const slot of ['bottom', 'top', 'onePiece', 'outer', 'shoes', 'headwear']) {
      const w = worn[slot]; if (!w) continue; const def = GARMENT_BY_ID[w.item]; if (!def) continue;
      const layer = LAYER[slot] ?? 0;
      for (const part of def.parts) {
        if (part.type === 'wrap') this.addMesh(this.wrap(part, layer, slot), def, w);
        else if (part.type === 'skirt') this.addMesh(this.skirt(part, layer + (slot === 'outer' ? 0.01 : 0)), def, w);
        else if (part.type === 'shoes') this.shoes(part, def, w);
        else if (part.type === 'headwear') { const items = buildHeadwear(ch, part.kind, def, w); items.forEach(m => { ch.headGroup.add(m); this.headItems.push(m); }); this.hidesHair = true; }
      }
      this.wornDefs.push({ slot, def, w });
    }
    if (st.hair.style === 'headwrap') { const items = buildHeadwear(ch, 'wrap', GARMENT_BY_ID.gele, { color: st.hair.wrapColor, fabric: st.hair.wrapFabric, variant: 1 }); items.forEach(m => { ch.headGroup.add(m); this.headItems.push(m); }); this.hidesHair = true; }
    ch.hair.rigidGroup.visible = ch.hair.simGroup.visible = !this.hidesHair;
    ch.gaitScale = this.gaitScale; ch.setHeel?.(this.heel);
  }
  addMesh(g, def, w) {
    if (!g) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(g.position, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(g.normal, 3)); geo.setAttribute('aRest', new THREE.BufferAttribute(g.rest, 3));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(g.skinIndex, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(g.skinWeight, 4)); geo.setIndex(new THREE.BufferAttribute(g.index, 1));
    const mat = g.mat || createFabricMaterial(w.fabric, w.color, w.variant);
    const m = new THREE.SkinnedMesh(geo, mat); m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; m.name = 'garment:' + def.id;
    this.group.add(m); m.bind(this.ch.skeleton, new THREE.Matrix4()); return m;
  }

  // ------------------------------------------------------------------ wrap
  landmarks() {
    const L = this.prep.rig.L; return {
      bra: L.underbustY + 0.005, crop: L.underbustY - 0.075, waist: L.waistY - 0.02, hip: L.hipY - 0.06, thigh: L.crotchY - 0.045,
      midthigh: lerp(L.crotchY, L.kneeY, 0.45), knee: L.kneeY + 0.02, calf: lerp(L.kneeY, L.ankleY, 0.45), ankle: L.ankleY + 0.035, brief: L.crotchY + 0.012, short: L.crotchY - 0.05,
    };
  }
  neckTop(t, x, z) {
    const L = this.prep.rig.L, base = L.neckBaseY - 0.012, ax = Math.abs(x), front = sm(-0.012, 0.035, z), d = t.neckDepth ?? 0.3;
    switch (t.neck) {
      case 'crew': return base - 0.004 - 0.012 * front;
      case 'scoop': return base - front * (0.025 + 0.13 * d) * Math.max(0, 1 - Math.pow(ax / 0.1, 2)) - (1 - front) * 0.015;
      case 'v': return base - front * (0.04 + 0.24 * d) * Math.max(0, 1 - ax / 0.085) - (1 - front) * 0.012;
      case 'square': return base - front * (0.03 + 0.12 * d) * (1 - sm(0.062, 0.072, ax)) - (1 - front) * 0.012;
      case 'boat': return base - 0.03 - 0.03 * d;
      case 'high': return base + 0.045;
      case 'halter': return front > 0.5 ? L.neckBaseY + 0.03 - sm(0.0, 0.13, ax) * (L.neckBaseY - L.bustY - 0.02) : L.underbustY + 0.07;
      case 'sweetheart': return L.bustY + 0.032 - front * 0.03 * (1 - sm(0, 0.06, ax)) - (1 - front) * 0.025;
      default: return base;
    }
  }
  wrap(part, layer, slot) {
    const pr = this.prep, { n, P, N, wArm, armS, seg } = pr, L = pr.rig.L, lm = this.landmarks(), T = part.torso, G = part.legs;
    const g = new Float32Array(n).fill(-1), e = new Float32Array(n), thick = 0.0035 + layer;
    const K = 0.72, E = T ? T.ease : { bust: 0, waist: 0, hip: 0, arm: 0 }, ease = { bust: E.bust * K, waist: E.waist * K, hip: E.hip * K, arm: E.arm };
    const sleeveEnd = s => (s <= 0 ? 0.12 : s <= 0.25 ? 0.3 : s <= 0.5 ? 0.54 : s <= 0.75 ? 0.78 : 0.985);
    const hemT = T ? lm[T.hem] : 0, riseY = G ? (G.rise === 'waist' ? L.waistY - 0.015 : G.rise === 'hip' ? L.hipY - 0.005 : L.hipY + 0.03) : 0, hemG = G ? lm[G.hem] : 0;
    for (let i = 0; i < n; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], ax = Math.abs(x);
      let gi = -1, ei = 0;
      if (T) {
        if (wArm[i] > 0.5) {
          if (T.sleeve >= 0) { gi = (sleeveEnd(T.sleeve) - armS[i]) * seg.L.tot; if (T.sleeve === 0 && T.strap) gi = -1; }
          ei = 0.004 + (ease.arm * K - 0.004) * sm(0.0, 0.35, armS[i]) + (T.sleeveFlare || 0) * Math.pow(armS[i], 2.2);
        } else {
          const top = this.neckTop(T, x, z); let gt = Math.min(y - hemT, top - y);
          if (T.strap) { const sx = L.shHalf * 0.5, gs = Math.min(T.strap / 2 - Math.abs(ax - sx), L.shoulderY + 0.03 - y, y - hemT); gt = Math.max(gt, gs); }
          if (T.frontOpen && z > 0.01) gt = Math.min(gt, ax - T.frontOpen * (0.5 + 0.5 * sm(L.waistY, L.hipY - 0.1, y)));
          gi = gt;
          // ease by height (bust -> waist -> hip), legs inherit hip ease
          let ev = y > L.waistY ? lerp(ease.waist, ease.bust, sm(L.waistY, L.bustY, y)) : lerp(ease.hip, ease.waist, sm(L.hipY, L.waistY, y));
          if (y > L.bustY) ev = lerp(ease.bust, Math.min(ease.bust, 0.006), sm(L.bustY, L.shoulderY - 0.02, y));
          ei = ev;
        }
      }
      if (G && wArm[i] <= 0.5) {
        let hy = hemG; if (G.hem === 'brief') hy = L.crotchY + 0.01 + 0.07 * sm(0.0, 0.14, ax) + 0.02 * (z > 0 ? 0 : 1);
        const gl = Math.min(riseY - y, y - hy);
        if (gl > gi) { gi = gl; ei = G.ease * (G.ease > 0.02 ? 0.8 : 1) + (G.flare || 0) * Math.min(1, Math.max(0, (L.crotchY - y) / (L.crotchY - L.ankleY))); }
      }
      g[i] = gi; e[i] = ei + thick;
    }
    this.smoothField(g, 2);
    let em = 0; for (let i = 0; i < n; i++) if (g[i] >= 0 && e[i] > em) em = e[i]; return this.clip(g, e, Math.round(1 + 9 * Math.min(1, Math.max(0, (em - 0.02) / 0.06))));
  }

  // marching-triangles clip of the body mesh by the scalar field g (>=0 inside), then offset along normals
  clip(g, e, smoothOut) {
    const { P, N, I, SI, SW, n } = this.prep, pos = [], nor = [], rest = [], si = [], sw = [], idx = [], cache = new Map();
    const vmap = new Int32Array(n).fill(-1);
    const vert = i => { if (vmap[i] >= 0) return vmap[i]; const k = pos.length / 3; vmap[i] = k; push(i, i, 0); return k; };
    const push = (a, b, t) => {
      const px = lerp(P[a * 3], P[b * 3], t), py = lerp(P[a * 3 + 1], P[b * 3 + 1], t), pz = lerp(P[a * 3 + 2], P[b * 3 + 2], t);
      let nx = lerp(N[a * 3], N[b * 3], t), ny = lerp(N[a * 3 + 1], N[b * 3 + 1], t), nz = lerp(N[a * 3 + 2], N[b * 3 + 2], t); const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const off = lerp(e[a], e[b], t); rest.push(px, py, pz); pos.push(px + nx * off, py + ny * off, pz + nz * off); nor.push(nx, ny, nz);
      const s = t < 0.5 ? a : b; for (let k = 0; k < 4; k++) { si.push(SI[s * 4 + k]); sw.push(SW[s * 4 + k]); }
    };
    const edge = (a, b) => { const key = a < b ? a * 1e7 + b : b * 1e7 + a; let v = cache.get(key); if (v !== undefined) return v; const t = g[a] / (g[a] - g[b]); v = pos.length / 3; if (a < b) push(a, b, t); else push(b, a, 1 - t); cache.set(key, v); return v; };
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t], b = I[t + 1], c = I[t + 2], ia = g[a] >= 0, ib = g[b] >= 0, ic = g[c] >= 0, cnt = ia + ib + ic; if (!cnt) continue;
      if (cnt === 3) { idx.push(vert(a), vert(b), vert(c)); continue; }
      const v = [a, b, c], ins = [ia, ib, ic];
      if (cnt === 1) { const k = ins.indexOf(true), p = v[k], q = v[(k + 1) % 3], r = v[(k + 2) % 3]; idx.push(vert(p), edge(p, q), edge(p, r)); }
      else { const k = ins.indexOf(false), p = v[k], q = v[(k + 1) % 3], r = v[(k + 2) % 3]; const e1 = edge(q, p), e2 = edge(r, p); idx.push(vert(q), vert(r), e2, vert(q), e2, e1); }
    }
    if (!idx.length) return null;
    const out = { position: Float32Array.from(pos), normal: Float32Array.from(nor), rest: Float32Array.from(rest), skinIndex: Uint16Array.from(si), skinWeight: Float32Array.from(sw), index: Uint32Array.from(idx) };
    if (smoothOut) this.smoothMesh(out, smoothOut === true ? 1 : smoothOut);
    return out;
  }
  smoothMesh(m, iters) {
    const nv = m.position.length / 3, nb = Array.from({ length: nv }, () => new Set());
    for (let t = 0; t < m.index.length; t += 3) for (let k = 0; k < 3; k++) { nb[m.index[t + k]].add(m.index[t + (k + 1) % 3]); nb[m.index[t + k]].add(m.index[t + (k + 2) % 3]); }
    let a = m.position, b = new Float32Array(a.length);
    for (let it = 0; it < iters; it++) { for (let i = 0; i < nv; i++) { let x = 0, y = 0, z = 0; const s = nb[i]; if (!s.size) { b.set(a.subarray(i * 3, i * 3 + 3), i * 3); continue; } for (const j of s) { x += a[j * 3]; y += a[j * 3 + 1]; z += a[j * 3 + 2]; } x /= s.size; y /= s.size; z /= s.size; b[i * 3] = a[i * 3] * 0.5 + x * 0.5; b[i * 3 + 1] = a[i * 3 + 1] * 0.5 + y * 0.5; b[i * 3 + 2] = a[i * 3 + 2] * 0.5 + z * 0.5; } [a, b] = [b, a]; }
    m.position = a;
  }

  // ------------------------------------------------------------------ skirt / robe loft
  skirt(part, layer) {
    const ch = this.ch, L = ch.rig.L, lm = this.landmarks(), field = ch.bodyData.field, zc = -0.004;
    const topY = { waist: L.waistY - 0.005, hip: L.hipY - 0.01, under: L.waistY + 0.045, knee: L.kneeY + 0.01 }[part.waist] ?? L.waistY;
    const hemY = { ankle: L.ankleY + 0.05, calf: lm.calf, knee: lm.knee, thigh: lm.thigh, midthigh: lm.midthigh }[part.hem] ?? lm.knee;
    const NA = 56, NY = 26, ease = part.ease + layer + 0.004;
    const hullAt = y => {
      const r = new Float32Array(NA);
      for (let k = 0; k < NA; k++) { const th = k / NA * Math.PI * 2, sx = Math.sin(th), cz = Math.cos(th); let hit = 0;
        for (let q = 0.4; q > 0.0; q -= 0.012) if (field(q * sx, y, zc + q * cz) < 0) { let lo = q, hi = q + 0.012; for (let b = 0; b < 5; b++) { const m = (lo + hi) / 2; if (field(m * sx, y, zc + m * cz) < 0) lo = m; else hi = m; } hit = lo; break; }
        r[k] = hit; }
      const o = new Float32Array(NA); for (let k = 0; k < NA; k++) { let m = 0; for (let d = -5; d <= 5; d++) m = Math.max(m, r[(k + d + NA) % NA] * (1 - Math.abs(d) * 0.015)); o[k] = m; }
      let f = o; for (let pass = 0; pass < 3; pass++) { const h = new Float32Array(NA); for (let k = 0; k < NA; k++) h[k] = (f[(k - 2 + NA) % NA] + f[(k - 1 + NA) % NA] * 2 + f[k] * 3 + f[(k + 1) % NA] * 2 + f[(k + 2) % NA]) / 9; f = h; } return f;
    };
    const rings = []; for (let j = 0; j <= NY; j++) { const t = j / NY, y = lerp(topY, hemY, t); rings.push({ t, y, r: hullAt(y) }); }
    for (let pass = 0; pass < 4; pass++) for (let j = 1; j < NY; j++) for (let k = 0; k < NA; k++) rings[j].r[k] = (rings[j - 1].r[k] + rings[j].r[k] * 2 + rings[j + 1].r[k]) / 4;
    const pos = [], nor = [], rest = [], si = [], sw = [], idx = [];
    const legF = { straight: 0.9, aline: 0.4, mermaid: 0.8, ball: 0.12 }[part.profile] ?? 0.5;
    const flareAt = (t, y) => { switch (part.profile) { case 'straight': return part.flare * t; case 'aline': return part.flare * Math.pow(t, 1.25); case 'mermaid': return part.flare * Math.pow(Math.max(0, (L.kneeY + 0.02 - y) / (L.kneeY + 0.02 - hemY)), 1.6); case 'ball': return part.flare * Math.pow(t, 0.75); default: return part.flare * t; } };
    for (const R of rings) for (let k = 0; k <= NA; k++) {
      const kk = k % NA, th = kk / NA * Math.PI * 2, sx = Math.sin(th), cz = Math.cos(th);
      const fl = flareAt(R.t, R.y) * (1 + 0.6 * Math.abs(cz)), r = Math.max(R.r[kk], 0.075) + ease + fl;
      const x = r * sx, z = zc + r * cz; pos.push(x, R.y, z); rest.push(x, R.y, z);
      const a = legF * sm(L.crotchY + 0.03, L.crotchY - 0.2, R.y), b = sm(L.kneeY + 0.03, L.kneeY - 0.2, R.y) * 0.7, ls = sm(-0.035, 0.035, x), lw = sm(0.035, 0.09, Math.abs(x));
      const L1 = x >= 0 ? BONE_INDEX.upperLegL : BONE_INDEX.upperLegR, L2 = x >= 0 ? BONE_INDEX.lowerLegL : BONE_INDEX.lowerLegR;
      // near the centre line blend both upper legs (no lower-leg influence) to avoid tearing
      const wUL = a * ls, wUR = a * (1 - ls), wL2 = a * b * lw;
      void L1; void L2;
      const wl = [[BONE_INDEX.hips, 1 - a], [BONE_INDEX.upperLegL, wUL * (1 - (x >= 0 ? b * lw : 0))], [BONE_INDEX.upperLegR, wUR * (1 - (x < 0 ? b * lw : 0))], [x >= 0 ? BONE_INDEX.lowerLegL : BONE_INDEX.lowerLegR, wL2]];
      for (const [bi, w] of wl) { si.push(bi); sw.push(w); }
    }
    const row = NA + 1;
    for (let j = 0; j < NY; j++) for (let k = 0; k < NA; k++) { const a = j * row + k, b = a + 1, c = a + row, d = c + 1; idx.push(a, c, b, b, c, d); }
    const nrm = new Float32Array(pos.length), p3 = i => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
    for (let j = 0; j <= NY; j++) for (let k = 0; k <= NA; k++) {
      const i = j * row + k, ik0 = j * row + (k + NA - 1) % NA, ik1 = j * row + (k + 1) % NA, j0 = Math.max(0, j - 1) * row + k, j1 = Math.min(NY, j + 1) * row + k;
      const tu = p3(ik1).map((v, q) => v - p3(ik0)[q]), tv = p3(j1).map((v, q) => v - p3(j0)[q]);
      let n3 = [tu[1] * tv[2] - tu[2] * tv[1], tu[2] * tv[0] - tu[0] * tv[2], tu[0] * tv[1] - tu[1] * tv[0]]; const l = Math.hypot(...n3) || 1; n3 = n3.map(v => -v / l);
      const px = pos[i * 3], pz = pos[i * 3 + 2] - zc; if (n3[0] * px + n3[2] * pz < 0) n3 = n3.map(v => -v); nrm.set(n3, i * 3);
    }
    this.gaitScale = Math.min(this.gaitScale, { straight: part.flare < 0.05 && part.hem !== 'ankle' ? 0.6 : 0.62, mermaid: 0.5, aline: 0.85, ball: 0.8 }[part.profile] ?? 1);
    return { position: Float32Array.from(pos), normal: nrm, rest: Float32Array.from(rest), skinIndex: Uint16Array.from(si), skinWeight: Float32Array.from(sw), index: Uint32Array.from(idx) };
  }

  // ------------------------------------------------------------------ shoes
  shoes(part, def, w) {
    const pr = this.prep, { n, P, N, wFoot } = pr, L = pr.rig.L, kind = part.kind, ay = L.ankleY;
    const gU = new Float32Array(n).fill(-1), eU = new Float32Array(n), gS = new Float32Array(n).fill(-1), eS = new Float32Array(n);
    const sole = kind === 'heel' ? 0.012 : kind === 'sneaker' ? 0.02 : kind === 'loafer' ? 0.016 : 0.012;
    for (let i = 0; i < n; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], ny = N[i * 3 + 1]; if (y > ay + 0.09) continue;
      let top = -1;
      switch (kind) {
        case 'sneaker': top = ay + 0.04; break;
        case 'loafer': top = z > 0.025 ? ay - 0.025 : ay - 0.008; break;
        case 'heel': top = z > 0.07 ? 0.046 : z > 0.0 ? 0.036 : ay + 0.0; break;
        case 'sandal': { const bands = Math.max(0.0075 - Math.abs(z - 0.105), 0.0075 - Math.abs(z - 0.045) , 0.007 - Math.abs(y - (ay + 0.012)) ); top = bands > 0 ? 0.075 : -1; gU[i] = bands > 0 && y < ay + 0.03 ? bands : -1; eU[i] = 0.004; continue; }
        case 'slide': { const band = 0.019 - Math.abs(z - 0.09); gU[i] = band > 0 && y < 0.06 ? band : -1; eU[i] = 0.006; continue; }
      }
      gU[i] = top - y; eU[i] = 0.0038 + (kind === 'sneaker' ? 0.0015 : 0);
    }
    for (let i = 0; i < n; i++) { const y = P[i * 3 + 1]; gS[i] = sole - y; eS[i] = 0.005 + 0.003 * Math.min(1, Math.max(0, (-N[i * 3 + 1] + 0.1))); }
    this.smoothField(gU, 1);
    const up = this.clip(gU, eU, false), so = this.clip(gS, eS, false);
    const soleCol = kind === 'sneaker' ? '#e8e4da' : kind === 'slide' || kind === 'sandal' ? w.color : '#1a1a1a';
    if (up) this.addMesh(up, def, w);
    if (so) {
      // push the sole bottom down for thickness; add heel block
      const m = so, nv = m.position.length / 3, push = kind === 'heel' ? 0.004 : sole * 0.55;
      for (let i = 0; i < nv; i++) if (m.normal[i * 3 + 1] < -0.2) m.position[i * 3 + 1] -= push * Math.min(1, -m.normal[i * 3 + 1] * 1.5);
      if (kind === 'heel') this.addHeel(m, def, w, part.heel);
      this.addMesh({ ...m, mat: createSoleMaterial(soleCol) }, def, w);
    }
    // heel: foot plantar-flexes so the ball and heel both reach the ground
    const h = kind === 'heel' ? part.heel : 0, a = Math.atan((0.01 + h) / 0.185), ankleRelBall = 0.035;
    const planted = h > 0 ? 0.035 * Math.cos(a) + 0.14 * Math.sin(a) - ay + 0.0 : sole * 0.5;
    this.heel = { angle: h > 0 ? a : 0, plantY: Math.max(0, planted) + (h > 0 ? 0 : 0) }; void ankleRelBall;
  }
  addHeel(m, def, w, h) {
    // block heel: tapered cylinder under the heel, skinned fully to the foot bones
    const L = this.prep.rig.L, J = this.prep.rig.J; const verts = [], idx = [], nor = [], si = [], sw = [], rest = [], R0 = 0.021, R1 = 0.015, seg = 10;
    for (const sd of ['L', 'R']) {
      const fx = J[`foot${sd}`][0], fz = J[`foot${sd}`][2] - 0.045, boneI = BONE_INDEX[`foot${sd}`], base = verts.length / 3, yTop = 0.026, yBot = yTop - 0.012 - h;
      for (let r = 0; r < 2; r++) for (let k = 0; k < seg; k++) { const a = k / seg * Math.PI * 2, rad = r ? R1 : R0, y = r ? yBot : yTop; verts.push(fx + Math.cos(a) * rad, y, fz + Math.sin(a) * rad); nor.push(Math.cos(a), 0, Math.sin(a)); rest.push(fx + Math.cos(a) * rad, y, fz + Math.sin(a) * rad); si.push(boneI, 0, 0, 0); sw.push(1, 0, 0, 0); }
      for (let k = 0; k < seg; k++) { const a = base + k, b = base + (k + 1) % seg, c = a + seg, d = b + seg; idx.push(a, c, b, b, c, d); }
      const cb = verts.length / 3; verts.push(fx, yBot, fz); nor.push(0, -1, 0); rest.push(fx, yBot, fz); si.push(boneI, 0, 0, 0); sw.push(1, 0, 0, 0); for (let k = 0; k < seg; k++) idx.push(cb, base + seg + (k + 1) % seg, base + seg + k);
    }
    const cat = (A, B) => { const o = new A.constructor(A.length + B.length); o.set(A); o.set(B, A.length); return o; };
    const off = m.position.length / 3;
    m.position = cat(m.position, Float32Array.from(verts)); m.normal = cat(m.normal, Float32Array.from(nor)); m.rest = cat(m.rest, Float32Array.from(rest));
    m.skinIndex = cat(m.skinIndex, Uint16Array.from(si)); m.skinWeight = cat(m.skinWeight, Float32Array.from(sw)); m.index = cat(m.index, Uint32Array.from(idx.map(i => i + off)));
    void L;
  }
}
