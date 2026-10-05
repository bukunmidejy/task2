// Builds hair meshes from a style description and simulates them (verlet chains with head/neck/
// shoulder/chest colliders, gravity, wind, rain weight, root-motion inertia). Static styles
// (afro, coils, short cuts) ride rigidly on the head; braids/locs/loose hair are simulated.
import * as THREE from 'three';
import { HAIR_COLORS } from '../../data/params.js';
import { makeCtx, generateHair } from './hairStyles.js';
import { strandTex, coilTex, braidTex, locTex, stubbleTex } from './hairTextures.js';
import { mulberry32 } from '../../core/rng.js';

const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class HairSystem {
  constructor(ch) {
    this.ch = ch; this.rigidGroup = new THREE.Group(); this.simGroup = new THREE.Group();
    ch.headGroup.add(this.rigidGroup); ch.root.add(this.simGroup);
    this.chains = []; this.wet = 0; this.windVec = new THREE.Vector3(); this.lastRootPos = new THREE.Vector3(); this.rootVel = new THREE.Vector3(); this.rootAcc = new THREE.Vector3();
    this.mats = {}; this.time = 0; this.style = null;
  }
  clear() {
    for (const g of [this.rigidGroup, this.simGroup]) for (const o of [...g.children]) { g.remove(o); o.geometry?.dispose(); }
    this.chains = []; this.colorTargets = [];
  }
  color() {
    const h = this.ch.state.hair, def = HAIR_COLORS.find(c => c.id === h.color) || HAIR_COLORS[1];
    return { base: new THREE.Color(def.hex), tip: new THREE.Color(def.tip || def.hex), hl: new THREE.Color('#b57a3a'), highlight: h.highlight };
  }
  build() {
    this.clear(); const ch = this.ch, s = ch.state, hd = ch.headData, hair = s.hair;
    this.style = hair.style; if (!hd || hair.style === 'none' || hair.style === 'headwrap') return;
    const ctx = makeCtx(hd, s.seed, ch.bodyData?.field ? { field: ch.bodyData.field, hs: ch.rig.L.hs, origin: ch.rig.J.head } : null), desc = generateHair(hair.style, { ...hair, edges: hair.edges }, ctx, ch.q.hairDensity);
    this.desc = desc; const col = this.color(), rng = mulberry32(s.seed + 5);
    this.buildScalp(desc.scalp, ctx, hd, col);
    if (desc.cards.length) this.buildCards(desc.cards, col, rng);
    if (desc.coils.length) this.buildCoils(desc.coils, col);
    if (desc.ribbons.length) this.buildRibbons(desc.ribbons, col, rng);
    if (desc.tubes.length) this.buildTubes(desc.tubes, col, rng);
    this.initSim(); this.setWet(this.wet);
  }
  mat(kind) {
    if (this.mats[kind]) return this.mats[kind];
    let m;
    if (kind === 'strand') m = new THREE.MeshPhysicalMaterial({ map: strandTex(), alphaTest: 0.38, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.7, anisotropy: 0.3, specularIntensity: 0.1, sheen: 0.04, sheenRoughness: 0.5, sheenColor: new THREE.Color(0.18, 0.15, 0.13), vertexColors: true });
    else if (kind === 'coil' || kind === 'twist') m = new THREE.MeshPhysicalMaterial({ map: coilTex(kind), alphaTest: 0.35, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.85, sheen: 0.1, sheenRoughness: 0.7, sheenColor: new THREE.Color(0.15, 0.12, 0.1), vertexColors: true });
    else if (kind === 'braid') { const t = braidTex(); m = new THREE.MeshPhysicalMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 2.0, roughness: 0.48, sheen: 0.08, sheenRoughness: 0.5, sheenColor: new THREE.Color(0.18, 0.15, 0.13), vertexColors: true }); }
    else if (kind === 'loc') { const t = locTex(); m = new THREE.MeshPhysicalMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 2.5, roughness: 0.78, sheen: 0.08, sheenColor: new THREE.Color(0.15, 0.12, 0.1), vertexColors: true }); }
    else if (kind === 'scalp') m = new THREE.MeshStandardMaterial({ map: stubbleTex(), vertexColors: true, transparent: true, roughness: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    return (this.mats[kind] = m);
  }
  // ---------------------------------------------------------------- scalp shell
  buildScalp(sc, ctx, hd, col) {
    if (!sc || sc.mode === 'none') return;
    const P = hd.position, N = hd.normal, n = P.length / 3, C = ctx.C, alpha = new Float32Array(n);
    const stub = sc.mode === 'stubble' || sc.mode === 'fade' || sc.mode === 'lineup';
    for (let i = 0; i < n; i++) {
      const x = P[i * 3] - C[0], y = P[i * 3 + 1] - C[1], z = P[i * 3 + 2] - C[2], th = Math.atan2(x, z), ph = Math.atan2(y, Math.hypot(x, z)), hl = ctx.hairLat(th);
      let a = 0;
      if (sc.mode === 'fade') a = sm(0.1, 0.95, ph) * sm(hl - 0.02, hl + 0.05, ph);
      else if (sc.mode === 'lineup') a = sm(0.05, 0.7, ph) * sm(hl + 0.012, hl + 0.016, ph) * (1 - 0.0);
      else a = sm(hl - 0.01, hl + 0.06, ph) * (sc.alpha ?? 0.9);
      if (ph > 1.45) a = sc.alpha ?? 1;
      alpha[i] = a * (stub ? 1 : 0.92);
    }
    const pos = [], nor = [], uv = [], colr = [], idx = []; const map = new Map();
    const I = hd.index, bc = col.base.clone().multiplyScalar(0.7), off = stub ? 0.0018 : 0.0008;
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t], b = I[t + 1], c = I[t + 2]; if (alpha[a] < 0.02 && alpha[b] < 0.02 && alpha[c] < 0.02) continue;
      for (const v of [a, b, c]) { if (!map.has(v)) { map.set(v, pos.length / 3); pos.push(P[v * 3] + N[v * 3] * off, P[v * 3 + 1] + N[v * 3 + 1] * off, P[v * 3 + 2] + N[v * 3 + 2] * off); nor.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]); uv.push(P[v * 3] * 55, P[v * 3 + 1] * 55 + P[v * 3 + 2] * 25); colr.push(bc.r, bc.g, bc.b, alpha[v]); } idx.push(map.get(v)); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 4)); g.setIndex(idx);
    const m = new THREE.Mesh(g, this.mat('scalp')); m.renderOrder = 2; this.rigidGroup.add(m); this.scalpMesh = m; this.scalpColor = { attr: g.attributes.color, mul: 0.7 };
  }
  // ---------------------------------------------------------------- static cards (afro, twist-out, baby hairs)
  buildCards(cards, col, rng) {
    const groups = { coil: [], twist: [], strand: [] }; for (const c of cards) groups[c.tex].push(c);
    for (const [tex, list] of Object.entries(groups)) {
      if (!list.length) continue;
      const pos = [], nor = [], uv = [], colr = [], idx = []; let vi = 0;
      for (const c of list) {
        const P = c.pts, n = P.length, up = new THREE.Vector3(), t = new THREE.Vector3(), side = new THREE.Vector3(), out = new THREE.Vector3();
        const jit = 0.85 + 0.3 * rng(); const cc = col.base.clone().multiplyScalar(jit); if (col.highlight > 0 && rng() < col.highlight * 0.35) cc.lerp(col.hl, 0.5);
        for (let i = 0; i < n; i++) {
          const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)]; t.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
          out.set(P[i][0], P[i][1] - 0.04, P[i][2] + 0.0).normalize(); side.crossVectors(t, out).normalize(); if (c.roll) side.applyAxisAngle(t, c.roll * 0.5);
          const tipw = i / (n - 1), w = c.w * 0.5 * (tex === 'strand' ? 1 - 0.5 * tipw : 1 - 0.15 * tipw), tc = col.base.clone().lerp(col.tip, tipw).multiplyScalar(jit);
          for (const sgn of [-1, 1]) { pos.push(P[i][0] + side.x * w * sgn, P[i][1] + side.y * w * sgn, P[i][2] + side.z * w * sgn); nor.push(out.x, out.y, out.z); uv.push(sgn < 0 ? 0 : 1, i / (n - 1)); colr.push(tc.r, tc.g, tc.b); }
          if (i < n - 1) { const k = vi + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
        }
        vi += n * 2; void up; void cc;
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); g.setIndex(idx);
      const m = new THREE.Mesh(g, this.mat(tex === 'strand' ? 'strand' : tex)); m.castShadow = true; m.frustumCulled = false; this.rigidGroup.add(m);
    }
  }
  // ---------------------------------------------------------------- static spiral tubes (bantu knots)
  buildCoils(coils, col) {
    const T = { pos: [], nor: [], uv: [], col: [], idx: [] };
    for (const c of coils) tubeInto(T, c.pts, new Array(c.pts.length).fill(c.rad), 7, col.base, null, 0.03);
    this.rigidGroup.add(meshFrom(T, this.mat('braid')));
  }
  // ---------------------------------------------------------------- simulated ribbons / tubes
  buildRibbons(list, col, rng) {
    const pts = [], meta = []; let total = 0;
    for (const r of list) { meta.push({ start: total, n: r.pts.length, rigid: r.rigid, stiff: r.stiff, w: r.w, roll: r.roll || 0 }); total += r.pts.length; pts.push(...r.pts); }
    const g = new THREE.BufferGeometry(), pos = new Float32Array(total * 6), uv = new Float32Array(total * 4), colr = new Float32Array(total * 6), nor = new Float32Array(total * 6), idx = [];
    meta.forEach((m, gi) => {
      const jit = 0.82 + 0.36 * rng(), hl = col.highlight > 0 && rng() < col.highlight * 0.4;
      for (let i = 0; i < m.n; i++) {
        const k = (m.start + i) * 2, t = i / (m.n - 1), c = col.base.clone().lerp(col.tip, Math.pow(t, 1.5)).multiplyScalar(jit * (0.6 + 0.4 * sm(0, 0.15, t))); if (hl) c.lerp(col.hl, 0.55);
        for (let s = 0; s < 2; s++) { uv[(k + s) * 2] = s; uv[(k + s) * 2 + 1] = t; colr.set([c.r, c.g, c.b], (k + s) * 3); }
        if (i < m.n - 1) idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    });
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(colr, 3)); g.setIndex(idx);
    const mesh = new THREE.Mesh(g, this.mat('strand')); mesh.frustumCulled = false; mesh.castShadow = true; this.simGroup.add(mesh);
    this.chains.push({ kind: 'ribbon', mesh, meta, local: Float32Array.from(pts.flat()), total });
  }
  buildTubes(list, col, rng) {
    for (const kind of ['braid', 'loc']) {
      const sub = list.filter(t => t.kind === kind); if (!sub.length) continue;
      const pts = [], meta = []; let total = 0;
      for (const r of sub) { meta.push({ start: total, n: r.pts.length, rigid: r.rigid, stiff: r.stiff, rad: r.rad, tapered: r.tapered, ends: r.ends, beads: r.beads }); total += r.pts.length; pts.push(...r.pts); }
      const NS = 6, g = new THREE.BufferGeometry(), nv = total * NS, pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), colr = new Float32Array(nv * 3), idx = [];
      meta.forEach(m => {
        const jit = 0.85 + 0.3 * rng();
        for (let i = 0; i < m.n; i++) {
          const t = i / (m.n - 1); const c = col.base.clone().lerp(col.tip, Math.pow(t, 2)).multiplyScalar(jit);
          let bead = 0; if (m.beads) for (const bt of [0.32, 0.5, 0.68, 0.84]) bead = Math.max(bead, Math.exp(-Math.pow((t - bt) / 0.012, 2)));
          if (bead > 0.3) c.set('#d9a441'); m.beadAt = m.beadAt || [];
          for (let s = 0; s < NS; s++) { const k = (m.start + i) * NS + s; uv[k * 2] = s / NS; colr.set([c.r, c.g, c.b], k * 3); }
          if (i < m.n - 1) for (let s = 0; s < NS; s++) { const a = (m.start + i) * NS + s, b = (m.start + i) * NS + (s + 1) % NS, a2 = a + NS, b2 = b + NS; idx.push(a, a2, b, b, a2, b2); }
        }
      });
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(colr, 3)); g.setIndex(idx);
      const mesh = new THREE.Mesh(g, this.mat(kind)); mesh.frustumCulled = false; mesh.castShadow = true; this.simGroup.add(mesh);
      this.chains.push({ kind: 'tube', NS, mesh, meta, local: Float32Array.from(pts.flat()), total });
    }
  }
  // ---------------------------------------------------------------- simulation
  headMatrix() { const ch = this.ch; ch.root.updateMatrixWorld(true); return _m.copy(ch.root.matrixWorld).invert().multiply(ch.headGroup.matrixWorld); }
  initSim() {
    const M = this.headMatrix().clone();
    for (const c of this.chains) {
      c.pos = new Float32Array(c.total * 3); c.prev = new Float32Array(c.total * 3); c.seg = new Float32Array(c.total); c.rest = new Float32Array(c.total * 3);
      for (let i = 0; i < c.total; i++) { _v.set(c.local[i * 3], c.local[i * 3 + 1], c.local[i * 3 + 2]).applyMatrix4(M); c.pos.set([_v.x, _v.y, _v.z], i * 3); }
      c.prev.set(c.pos);
      for (const m of c.meta) for (let i = m.start; i < m.start + m.n; i++) {
        if (i > m.start) { const a = i * 3, b = (i - 1) * 3; c.seg[i] = Math.hypot(c.pos[a] - c.pos[b], c.pos[a + 1] - c.pos[b + 1], c.pos[a + 2] - c.pos[b + 2]); c.rest[a] = c.pos[a] - c.pos[b]; c.rest[a + 1] = c.pos[a + 1] - c.pos[b + 1]; c.rest[a + 2] = c.pos[a + 2] - c.pos[b + 2]; }
      }
    }
    this.yaw0 = this.headYaw(M); this.buildColliders();
    for (let k = 0; k < 90; k++) this.step(1 / 60, true);
    for (const c of this.chains) this.writeGeometry(c);
  }
  headYaw(M) { _v.set(0, 0, 1).transformDirection(M); return Math.atan2(_v.x, _v.z); }
  buildColliders() {
    const L = this.ch.rig.L, B = this.ch.bones; this.colliders = [
      { head: true, o: [0, 0.062, -0.013], r: 0.083 }, { head: true, o: [0, 0.0, 0.022], r: 0.068 }, { head: true, o: [0, 0.02, 0.05], r: 0.07 }, { head: true, o: [0, -0.03, -0.01], r: 0.06 },
      { bone: 'neck', o: [0, 0.04, -0.005], r: 0.056 }, { bone: 'neck', o: [0, 0.0, -0.008], r: 0.062 },
      { bone: 'upperArmL', o: [0, 0.005, -0.005], r: 0.066 }, { bone: 'upperArmR', o: [0, 0.005, -0.005], r: 0.066 },
      { bone: 'chest', o: [0, 0.02, -0.04], r: 0.125 * L.sw }, { bone: 'chest', o: [0, -0.02, 0.03], r: 0.115 * L.sw }, { bone: 'chest', o: [0, -0.1, -0.03], r: 0.12 * L.sw }, { bone: 'spine', o: [0, 0.02, -0.03], r: 0.115 * L.sw },
      { bone: 'upperArmL', o: [0.03, -0.11, 0], r: 0.05, arm: 1 }, { bone: 'upperArmR', o: [-0.03, -0.11, 0], r: 0.05, arm: 1 },
    ];
    this.colBuf = this.colliders.map(() => new THREE.Vector3()); const worn = Object.keys(this.ch.state.clothing.worn).length > 0; this.colR = this.colliders.map(c => c.r * (c.head ? this.ch.rig.L.hs : 1) + 0.004 + (c.head ? 0 : worn ? 0.016 : 0));
  }
  updateColliders(M) {
    const ch = this.ch, inv = _m.copy(ch.root.matrixWorld).invert();
    this.colliders.forEach((c, i) => {
      if (c.head) this.colBuf[i].set(...c.o).applyMatrix4(M);
      else { _v.set(...c.o); const b = ch.bones[c.bone]; this.colBuf[i].copy(_v).applyMatrix4(b.matrixWorld).applyMatrix4(inv); }
    });
  }
  setWet(w) { this.wet = w; for (const m of Object.values(this.mats)) { if (m.isMeshPhysicalMaterial) { m.roughness = (m === this.mats.loc ? 0.75 : m === this.mats.coil ? 0.8 : 0.45) * (1 - 0.5 * w); m.sheen = 0.3 + 0.3 * w; } } this.wetDarken = 1 - 0.35 * w; }
  setColor() {
    const col = this.color(); this.build(); void col;
  }
  update(dt) {
    if (!this.chains.length) return; const ch = this.ch; dt = Math.min(dt, 0.033); this.time += dt;
    // root motion inertia
    const wp = ch.root.position; this.rootVel.copy(wp).sub(this.lastRootPos).divideScalar(Math.max(dt, 1e-4)); this.lastRootPos.copy(wp);
    this.step(dt, false);
    for (const c of this.chains) this.writeGeometry(c);
  }
  step(dt, settle) {
    const ch = this.ch, M = this.headMatrix().clone(), yaw = this.headYaw(M), dyaw = settle ? 0 : yaw - this.yaw0; this.updateColliders(M);
    const cy = Math.cos(dyaw), sy = Math.sin(dyaw);
    // external acceleration in character-root space
    const rq = _q.setFromEuler(new THREE.Euler(0, -ch.root.rotation.y, 0));
    const vel = _v.copy(this.rootVel).applyQuaternion(rq); this.rootAcc.copy(vel).sub(this.lastVelR || vel).divideScalar(Math.max(dt, 1e-4)); this.lastVelR = vel.clone();
    const wind = this.windVec.clone().applyQuaternion(rq), tw = this.time;
    const gust = 0.6 + 0.4 * Math.sin(tw * 1.7) * Math.sin(tw * 0.63 + 1);
    const ax = (settle ? 0 : -THREE.MathUtils.clamp(this.rootAcc.x, -12, 12) * 0.5) + wind.x * gust, ay = -9.8 * (1 + 0.5 * this.wet), az = (settle ? 0 : -THREE.MathUtils.clamp(this.rootAcc.z, -12, 12) * 0.5) + wind.z * gust;
    const damp = 0.965 - 0.02 * this.wet, dt2 = dt * dt, wetK = 1 - 0.5 * this.wet;
    for (const c of this.chains) {
      const P = c.pos, Pv = c.prev, loc = c.local, S = c.seg, R = c.rest;
      for (const m of c.meta) {
        const s0 = m.start, e = m.start + m.n;
        for (let i = s0; i < e; i++) {
          const k = i * 3;
          if (i - s0 < m.rigid) { _v.set(loc[k], loc[k + 1], loc[k + 2]).applyMatrix4(M); Pv[k] = P[k]; Pv[k + 1] = P[k + 1]; Pv[k + 2] = P[k + 2]; P[k] = _v.x; P[k + 1] = _v.y; P[k + 2] = _v.z; continue; }
          const t = (i - s0) / (m.n - 1), flex = 0.4 + 0.9 * t;
          const vx = (P[k] - Pv[k]) * damp, vy = (P[k + 1] - Pv[k + 1]) * damp, vz = (P[k + 2] - Pv[k + 2]) * damp;
          Pv[k] = P[k]; Pv[k + 1] = P[k + 1]; Pv[k + 2] = P[k + 2];
          P[k] += vx + ax * dt2 * flex; P[k + 1] += vy + ay * dt2; P[k + 2] += vz + az * dt2 * flex;
        }
        for (let it = 0; it < 3; it++) for (let i = s0 + m.rigid; i < e; i++) {
          const k = i * 3, p = k - 3;
          // shape memory: lean toward the styled shape (rotated with head yaw only so gravity still wins on tilt)
          const st = m.stiff * wetK * (1 - 0.55 * ((i - s0) / (m.n - 1)));
          const rx = R[k] * cy + R[k + 2] * sy, rz = -R[k] * sy + R[k + 2] * cy;
          P[k] += (P[p] + rx - P[k]) * st; P[k + 1] += (P[p + 1] + R[k + 1] - P[k + 1]) * st; P[k + 2] += (P[p + 2] + rz - P[k + 2]) * st;
          // collisions
          for (let q = 0; q < this.colBuf.length; q++) {
            const cb = this.colBuf[q], r = this.colR[q], dx = P[k] - cb.x, dy = P[k + 1] - cb.y, dz = P[k + 2] - cb.z, d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < r * r) { const d = Math.sqrt(d2) || 1e-5, f = r / d; P[k] = cb.x + dx * f; P[k + 1] = cb.y + dy * f; P[k + 2] = cb.z + dz * f; }
          }
          // distance constraint to parent
          let dx = P[k] - P[p], dy = P[k + 1] - P[p + 1], dz = P[k + 2] - P[p + 2]; const d = Math.hypot(dx, dy, dz) || 1e-6, f = S[i] / d;
          P[k] = P[p] + dx * f; P[k + 1] = P[p + 1] + dy * f; P[k + 2] = P[p + 2] + dz * f;
        }
      }
    }
  }
  writeGeometry(c) {
    const g = c.mesh.geometry, pos = g.attributes.position.array, P = c.pos;
    if (c.kind === 'ribbon') {
      const nor = g.attributes.normal.array, t = new THREE.Vector3(), out = new THREE.Vector3(), side = new THREE.Vector3(), cen = this.ch.rig.J.head, hy = cen[1] + 0.03;
      for (const m of c.meta) for (let i = 0; i < m.n; i++) {
        const k = (m.start + i) * 3, a = (m.start + Math.max(0, i - 1)) * 3, b = (m.start + Math.min(m.n - 1, i + 1)) * 3;
        t.set(P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]).normalize(); out.set(P[k] - 0, P[k + 1] - hy, P[k + 2] - cen[2]).normalize();
        side.crossVectors(t, out); if (side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize(); if (m.roll) side.applyAxisAngle(t, m.roll * 0.6);
        const tp = i / (m.n - 1), w = m.w * 0.5 * (1 - 0.35 * tp), vi = (m.start + i) * 2 * 3;
        pos[vi] = P[k] - side.x * w; pos[vi + 1] = P[k + 1] - side.y * w; pos[vi + 2] = P[k + 2] - side.z * w; pos[vi + 3] = P[k] + side.x * w; pos[vi + 4] = P[k + 1] + side.y * w; pos[vi + 5] = P[k + 2] + side.z * w;
        nor[vi] = nor[vi + 3] = out.x; nor[vi + 1] = nor[vi + 4] = out.y; nor[vi + 2] = nor[vi + 5] = out.z;
      }
      g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
    } else {
      const nor = g.attributes.normal.array, uv = g.attributes.uv.array, NS = c.NS;
      const t = new THREE.Vector3(), n = new THREE.Vector3(), bn = new THREE.Vector3(), prevN = new THREE.Vector3();
      for (const m of c.meta) {
        let arc = 0;
        for (let i = 0; i < m.n; i++) {
          const k = (m.start + i) * 3, a = (m.start + Math.max(0, i - 1)) * 3, b = (m.start + Math.min(m.n - 1, i + 1)) * 3;
          t.set(P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]).normalize();
          if (i === 0) { n.set(0, 0, 1); if (Math.abs(t.z) > 0.9) n.set(1, 0, 0); } else n.copy(prevN);
          n.addScaledVector(t, -n.dot(t)).normalize(); prevN.copy(n); bn.crossVectors(t, n);
          if (i > 0) arc += Math.hypot(P[k] - P[k - 3], P[k + 1] - P[k - 2], P[k + 2] - P[k - 1]);
          const tt = i / (m.n - 1); let r = m.rad;
          if (m.tapered) r *= 0.5 + 0.5 * sm(0, 0.14, tt); if (m.ends && tt > 0.95) r *= 1 - (tt - 0.95) / 0.05 * 0.55;
          if (m.beads) for (const bt of [0.32, 0.5, 0.68, 0.84]) r *= 1 + 0.7 * Math.exp(-Math.pow((tt - bt) / 0.012, 2));
          for (let s = 0; s < NS; s++) {
            const ang = (s / NS) * Math.PI * 2, cs = Math.cos(ang), sn = Math.sin(ang), vi = ((m.start + i) * NS + s) * 3;
            const nx = n.x * cs + bn.x * sn, ny = n.y * cs + bn.y * sn, nz = n.z * cs + bn.z * sn;
            pos[vi] = P[k] + nx * r; pos[vi + 1] = P[k + 1] + ny * r; pos[vi + 2] = P[k + 2] + nz * r; nor[vi] = nx; nor[vi + 1] = ny; nor[vi + 2] = nz;
            uv[((m.start + i) * NS + s) * 2 + 1] = arc / 0.030;
          }
        }
      }
      g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true; g.attributes.uv.needsUpdate = true;
    }
  }
}

// ---- tube helper for static geometry
export function tubeInto(T, pts, radii, NS, color, beadFn, uvScale) {
  const base = T.pos.length / 3; const t = new THREE.Vector3(), n = new THREE.Vector3(), bn = new THREE.Vector3(), pn = new THREE.Vector3(); let arc = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; t.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    if (i === 0) { n.set(0, 0, 1); if (Math.abs(t.z) > 0.9) n.set(1, 0, 0); } else n.copy(pn); n.addScaledVector(t, -n.dot(t)).normalize(); pn.copy(n); bn.crossVectors(t, n);
    if (i) arc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
    for (let s = 0; s < NS; s++) { const ang = s / NS * 6.2832, cs = Math.cos(ang), sn = Math.sin(ang), nx = n.x * cs + bn.x * sn, ny = n.y * cs + bn.y * sn, nz = n.z * cs + bn.z * sn, r = radii[i];
      T.pos.push(pts[i][0] + nx * r, pts[i][1] + ny * r, pts[i][2] + nz * r); T.nor.push(nx, ny, nz); T.uv.push(s / NS, arc / uvScale); T.col.push(color.r, color.g, color.b); }
    if (i < pts.length - 1) for (let s = 0; s < NS; s++) { const a0 = base + i * NS + s, b0 = base + i * NS + (s + 1) % NS; T.idx.push(a0, a0 + NS, b0, b0, a0 + NS, b0 + NS); }
  }
}
function meshFrom(T, mat) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(T.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(T.nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(T.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(T.col, 3)); g.setIndex(T.idx);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.frustumCulled = false; return m;
}
