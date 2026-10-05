// Signed-distance primitives + narrow-band marching cubes with SDF-derived skin weights.
// Used for the body and the hands. The body is ONE welded surface (no seams at shoulders/hips),
// and every vertex gets skin weights from the same blend that shaped it, so joints deform smoothly.
import { edgeTable, triTable } from 'three/examples/jsm/objects/MarchingCubes.js';

// Primitive layout (flat Float32Array rows, STRIDE floats each):
// kind(0=segment,1=ellipsoid) ,ax,ay,az, bx,by,bz, rxa,rxb, rza,rzb, k, bone, ex(3), ez(3), ey(3)
export const STRIDE = 23; // + op (0 add / 1 smooth-subtract)
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

export class PrimList {
  constructor() { this.rows = []; this.op = 0; }
  // subsequent primitives carve material away (smooth subtraction) instead of adding
  subtract() { this.op = 1; return this; }
  add() { this.op = 0; return this; }
  // elliptic tapered capsule from a to b. rx*/rz* = half extents across/depth at each end
  seg(bone, a, b, rxa, rxb, rza = rxa, rzb = rxb, k = 0.03) {
    const axis = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    let ex = cross(axis, [0, 0, 1]); if (Math.hypot(...ex) < 1e-4) ex = [1, 0, 0]; ex = norm(ex);
    const ez = norm(cross(ex, axis));
    this.rows.push([0, ...a, ...b, rxa, rxb, rza, rzb, k, bone, ...ex, ...ez, ...axis, this.op]);
    return this;
  }
  ell(bone, c, rx, ry, rz, k = 0.03) { this.rows.push([1, ...c, 0, 0, 0, rx, ry, rz, 0, k, bone, 1, 0, 0, 0, 0, 1, 0, 1, 0, this.op]); return this; }
  pack() { const rows = [...this.rows].sort((a, b) => a[22] - b[22]); this.rows = rows; const f = new Float32Array(rows.length * STRIDE); rows.forEach((r, i) => f.set(r, i * STRIDE)); return f; }
}

// distance from p to primitive i (approximate Euclidean, exact enough for blending)
// row layout: 0 kind | 1-3 a | 4-6 b | 7 rxa 8 rxb 9 rza 10 rzb | 11 k | 12 bone | 13-15 ex | 16-18 ez | 19-21 axis
export function primDist(P, i, x, y, z) {
  const o = i * STRIDE;
  if (P[o] === 1) {
    const dx = (x - P[o + 1]) / P[o + 7], dy = (y - P[o + 2]) / P[o + 8], dz = (z - P[o + 3]) / P[o + 9];
    const m = Math.min(P[o + 7], P[o + 8], P[o + 9]);
    return (Math.sqrt(dx * dx + dy * dy + dz * dz) - 1) * m;
  }
  const ax = P[o + 1], ay = P[o + 2], az = P[o + 3];
  const bax = P[o + 4] - ax, bay = P[o + 5] - ay, baz = P[o + 6] - az;
  const pax = x - ax, pay = y - ay, paz = z - az;
  const l2 = bax * bax + bay * bay + baz * baz;
  let t = (pax * bax + pay * bay + paz * baz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = pax - bax * t, qy = pay - bay * t, qz = paz - baz * t; // vector from closest axis point
  const u = qx * P[o + 13] + qy * P[o + 14] + qz * P[o + 15];       // across (ex)
  const w = qx * P[o + 16] + qy * P[o + 17] + qz * P[o + 18];       // depth  (ez)
  const al = qx * P[o + 19] + qy * P[o + 20] + qz * P[o + 21];      // along (only non-zero past end caps)
  const rx = P[o + 7] + (P[o + 8] - P[o + 7]) * t, rz = P[o + 9] + (P[o + 10] - P[o + 9]) * t;
  const rm = (rx + rz) * 0.5, mn = rx < rz ? rx : rz;
  const sx = u / rx, sz = w / rz, sa = al / rm;
  return (Math.sqrt(sx * sx + sz * sz + sa * sa) - 1) * mn;
}

const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

export function evalField(P, n, list, x, y, z) {
  let d = 1e9;
  for (let j = 0; j < list.length; j++) {
    const i = list[j], o = i * STRIDE;
    if (P[o + 22] === 1) { const s = -primDist(P, i, x, y, z), k = P[o + 11]; const hh = Math.max(k - Math.abs(d - s), 0) / k; d = Math.max(d, s) + hh * hh * k * 0.25; }
    else d = d === 1e9 ? primDist(P, i, x, y, z) : smin(d, primDist(P, i, x, y, z), P[o + 11]);
  }
  return d;
}

// Narrow-band marching cubes. opts: { min:[x,y,z], max:[x,y,z], h, B, tau, maxInfl, boneCount }
export function meshSDF(prims, opts) {
  const P = prims.pack(), n = prims.rows.length;
  const { min, max, h, B = 4, tau = 0.014 } = opts;
  const nx = Math.ceil((max[0] - min[0]) / h) + 1, ny = Math.ceil((max[1] - min[1]) / h) + 1, nz = Math.ceil((max[2] - min[2]) / h) + 1;
  const sy = nx, sz = nx * ny;
  const field = new Float32Array(nx * ny * nz).fill(NaN);
  const bx = Math.ceil((nx - 1) / B), by = Math.ceil((ny - 1) / B), bz = Math.ceil((nz - 1) / B);
  const blockLists = new Array(bx * by * bz).fill(null);
  const R = Math.sqrt(3) * B * h * 0.5;
  const kmax = 0.08;
  const ds = new Float32Array(n);
  const active = [];
  for (let kz = 0; kz < bz; kz++) for (let ky = 0; ky < by; ky++) for (let kx = 0; kx < bx; kx++) {
    const cx = min[0] + (kx * B + B / 2) * h, cy = min[1] + (ky * B + B / 2) * h, cz = min[2] + (kz * B + B / 2) * h;
    let dmin = 1e9;
    for (let i = 0; i < n; i++) { const d = primDist(P, i, cx, cy, cz); ds[i] = d; if (P[i * STRIDE + 22] === 0 && d < dmin) dmin = d; }
    if (dmin - kmax * 0.25 > R) continue; // wholly outside the union
    const list = [];
    let anyCarve = false;
    for (let i = 0; i < n; i++) {
      if (P[i * STRIDE + 22] === 1) { if (-ds[i] - R < dmin + R + kmax && ds[i] < R + kmax) { list.push(i); anyCarve = true; } }
      else if (ds[i] - R < dmin + R + kmax) list.push(i);
    }
    if (dmin + R < 0 && !anyCarve) continue; // wholly inside, nothing carves here
    const bi = kx + bx * (ky + by * kz);
    blockLists[bi] = list; active.push(bi);
    for (let k = 0; k <= B; k++) for (let j = 0; j <= B; j++) for (let i = 0; i <= B; i++) {
      const gx = kx * B + i, gy = ky * B + j, gz = kz * B + k;
      if (gx >= nx || gy >= ny || gz >= nz) continue;
      const id = gx + sy * gy + sz * gz;
      if (!Number.isNaN(field[id])) continue;
      field[id] = evalField(P, n, list, min[0] + gx * h, min[1] + gy * h, min[2] + gz * h);
    }
  }
  // ---- marching cubes
  const edgeVert = new Int32Array(nx * ny * nz * 3).fill(-1);
  const pos = [], nor = [], vBlock = [];
  const idx = [];
  const cornerOff = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
  const edgeCorners = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  const val = (gx, gy, gz) => { const v = field[gx + sy * gy + sz * gz]; return v; };
  const gradAt = (gx, gy, gz, out) => {
    const f = (a, b, c) => { if (a < 0 || b < 0 || c < 0 || a >= nx || b >= ny || c >= nz) return NaN; return field[a + sy * b + sz * c]; };
    const c0 = f(gx, gy, gz);
    const comp = (m, p) => { const a = f(gx - (p === 0), gy - (p === 1), gz - (p === 2)), b = f(gx + (p === 0), gy + (p === 1), gz + (p === 2)); if (!Number.isNaN(a) && !Number.isNaN(b)) return (b - a); if (!Number.isNaN(b)) return (b - c0) * 2; if (!Number.isNaN(a)) return (c0 - a) * 2; return 0; };
    out[0] = comp(0, 0); out[1] = comp(0, 1); out[2] = comp(0, 2);
  };
  const g0 = [0, 0, 0], g1 = [0, 0, 0];
  const getVert = (gx, gy, gz, axis, blk) => {
    const id = (gx + sy * gy + sz * gz) * 3 + axis;
    let v = edgeVert[id]; if (v >= 0) return v;
    const gx2 = gx + (axis === 0), gy2 = gy + (axis === 1), gz2 = gz + (axis === 2);
    const a = val(gx, gy, gz), b = val(gx2, gy2, gz2);
    const t = Math.abs(a - b) < 1e-9 ? 0.5 : a / (a - b);
    const x = min[0] + (gx + (gx2 - gx) * t) * h, y = min[1] + (gy + (gy2 - gy) * t) * h, z = min[2] + (gz + (gz2 - gz) * t) * h;
    gradAt(gx, gy, gz, g0); gradAt(gx2, gy2, gz2, g1);
    let nxv = g0[0] + (g1[0] - g0[0]) * t, nyv = g0[1] + (g1[1] - g0[1]) * t, nzv = g0[2] + (g1[2] - g0[2]) * t;
    const l = Math.hypot(nxv, nyv, nzv) || 1;
    v = pos.length / 3; edgeVert[id] = v; pos.push(x, y, z); nor.push(nxv / l, nyv / l, nzv / l); vBlock.push(blk);
    return v;
  };
  const verts = new Int32Array(12);
  for (const bi of active) {
    const kx = bi % bx, ky = Math.floor(bi / bx) % by, kz = Math.floor(bi / (bx * by));
    for (let k = 0; k < B; k++) for (let j = 0; j < B; j++) for (let i = 0; i < B; i++) {
      const gx = kx * B + i, gy = ky * B + j, gz = kz * B + k;
      if (gx >= nx - 1 || gy >= ny - 1 || gz >= nz - 1) continue;
      let cube = 0, bad = false;
      const cv = [0, 0, 0, 0, 0, 0, 0, 0];
      for (let c = 0; c < 8; c++) { const o = cornerOff[c]; const v = val(gx + o[0], gy + o[1], gz + o[2]); if (Number.isNaN(v)) { bad = true; break; } cv[c] = v; if (v < 0) cube |= 1 << c; }
      if (bad || cube === 0 || cube === 255) continue;
      const em = edgeTable[cube]; if (!em) continue;
      for (let e = 0; e < 12; e++) {
        if (!(em & (1 << e))) continue;
        const [c0, c1] = edgeCorners[e]; const o0 = cornerOff[c0], o1 = cornerOff[c1];
        // canonical edge = lower corner + axis
        const lo = (o0[0] + o0[1] * 2 + o0[2] * 4) < (o1[0] + o1[1] * 2 + o1[2] * 4) ? o0 : o1;
        const axis = o0[0] !== o1[0] ? 0 : o0[1] !== o1[1] ? 1 : 2;
        verts[e] = getVert(gx + lo[0], gy + lo[1], gz + lo[2], axis, bi);
      }
      for (let t = cube * 16; triTable[t] !== -1; t += 3) idx.push(verts[triTable[t]], verts[triTable[t + 2]], verts[triTable[t + 1]]);
    }
  }
  if (opts.weights === false) return { position: new Float32Array(pos), normal: new Float32Array(nor), index: new Uint32Array(idx), prims: P, count: n, fieldFn: (x, y, z) => evalField(P, n, allIdx(n), x, y, z) };
  // ---- skin weights from the same blend
  const vc = pos.length / 3, maxInfl = 4;
  const skinIndex = new Uint16Array(vc * maxInfl), skinWeight = new Float32Array(vc * maxInfl);
  const tmp = [];
  for (let v = 0; v < vc; v++) {
    const list = blockLists[vBlock[v]], x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    tmp.length = 0; let dmin = 1e9;
    for (const i of list) { if (P[i * STRIDE + 22] === 1) continue; const d = primDist(P, i, x, y, z); tmp.push([i, d]); if (d < dmin) dmin = d; }
    const acc = new Map();
    for (const [i, d] of tmp) { const w = Math.exp(-(d - dmin) / tau); if (w < 0.02) continue; const bone = P[i * STRIDE + 12]; acc.set(bone, (acc.get(bone) || 0) + w); }
    const arr = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxInfl);
    const s = arr.reduce((q, e) => q + e[1], 0) || 1;
    for (let q = 0; q < arr.length; q++) { skinIndex[v * 4 + q] = arr[q][0]; skinWeight[v * 4 + q] = arr[q][1] / s; }
  }
  return { position: new Float32Array(pos), normal: new Float32Array(nor), index: new Uint32Array(idx), skinIndex, skinWeight, prims: P, count: n };
}

const allIdx = n => Array.from({ length: n }, (_, i) => i);
// Stand-alone field evaluator for a primitive list (used for surface queries: hair roots, accessories)
export function makeField(prims) { const P = prims.pack(), n = prims.rows.length, all = allIdx(n); return (x, y, z) => evalField(P, n, all, x, y, z); }
