// Body + hands geometry from parameters: SDF primitives -> narrow-band marching cubes.
import { PrimList, meshSDF } from './sdf.js';
import { BONE_INDEX, FINGERS } from './rig.js';
import { clamp } from '../core/rng.js';

const B = BONE_INDEX;
const v3 = (a, b, c) => [a, b, c];

export function bodyPrims(rig, bp, asym) {
  const { J, L } = rig, P = new PrimList();
  const { H, s, sw, G, hipY, kneeY, ankleY, shoulderY, neckBaseY, pivotY, shHalf, waistY, underbustY, bustY } = L;
  const m = bp.muscle, bd = bp.build;
  const asy = asym || { shoulder: 0 };
  // ---- pelvis / torso
  const hipHalf = 0.158 * sw * G * (1 + 0.12 * bp.hips);
  const pelD = 0.098 * sw * (1 + 0.14 * bd + 0.04 * bp.glutes);
  P.seg(B.hips, v3(0, hipY - 0.045, 0), v3(0, hipY + 0.045, 0), hipHalf, hipHalf * 0.96, pelD, pelD, 0.03);
  const glute = 0.5 * (1 + bp.glutes * 0.55) + 0.02;
  for (const sg of [-1, 1]) P.ell(B.hips, v3(sg * 0.072 * sw, hipY - 0.045, -0.075 * sw), 0.074 * sw * glute * 1.12 * (1 + 0.1 * bd), 0.086 * sw * (0.9 + 0.2 * glute), 0.07 * sw * glute * 1.15, 0.05);
  const waistHalf = 0.112 * sw * G * (1 + 0.14 * bp.waist);
  const waistD = 0.083 * sw * (1 + 0.15 * bd + 0.06 * bp.stomach);
  P.seg(B.spine, v3(0, waistY - 0.05, 0), v3(0, waistY + 0.05, 0), waistHalf, waistHalf * 1.03, waistD, waistD, 0.035);
  const belly = 0.5 + 0.5 * clamp(bp.stomach, -1, 1) + 0.18 * Math.max(0, bd);
  P.ell(B.spine, v3(0, waistY - 0.03, waistD * 0.55), 0.075 * sw * (0.7 + 0.45 * belly), 0.085 * sw, 0.044 + 0.05 * belly * sw, 0.04);
  const chestHalf = 0.136 * sw * G * (1 + 0.05 * bp.shoulders + 0.03 * m), chestD = 0.095 * sw * (1 + 0.13 * bd);
  P.seg(B.chest, v3(0, underbustY - 0.015, 0), v3(0, shoulderY - 0.07, 0), chestHalf * 0.94, chestHalf * 1.04, chestD, chestD * 0.96, 0.04);
  P.seg(B.chest, v3(-shHalf * 0.74, shoulderY - 0.026, -0.005), v3(shHalf * 0.74, shoulderY - 0.026, -0.005), 0.046 + 0.01 * m, 0.046 + 0.01 * m, 0.066 * sw, 0.066 * sw, 0.04);
  // chest / bust (continuous: negative = flatter, positive = fuller; muscle adds pectoral mass)
  const bs = bp.chest, pec = 0.55 * m;
  for (const sg of [-1, 1]) {
    const bz = 0.074 * sw + 0.006 * bs, br = 0.046 + 0.03 * Math.max(bs, -0.7) + 0.012 * pec;
    P.ell(B.chest, v3(sg * (0.084 * sw + 0.004 * bs), bustY - 0.005 - 0.012 * Math.max(0, bs), bz), br * 1.1, br * 1.0, br * 0.95 * (0.85 + 0.2 * Math.max(0, bs)), 0.05);
  }
  // neck + trapezius
  const nk = 0.048 * Math.pow(s, 0.5) * (1 + 0.1 * bd + 0.12 * m);
  P.seg(B.neck, v3(0, neckBaseY - 0.03, -0.01), v3(0, pivotY - 0.03, J.head[2] + 0.004), nk, nk * 0.92, nk * 0.96, nk * 0.9, 0.05);
  P.seg(B.head, v3(0, pivotY - 0.035, J.head[2] + 0.004), v3(0, pivotY + 0.015, J.head[2] + 0.012), nk * 0.92, nk * 0.9, nk * 0.9, nk * 0.88, 0.03);
  for (const sg of [-1, 1]) P.seg(B.chest, v3(sg * 0.034, neckBaseY - 0.006, -0.012), v3(sg * (shHalf - 0.045), shoulderY - 0.004, -0.004), 0.024 + 0.008 * m, 0.03 + 0.01 * m, 0.032, 0.038, 0.035);
  // ---- arms
  const armK = 1 + 0.14 * bp.arms + 0.1 * bd + 0.1 * m;
  for (const [sd, sg] of [['L', 1], ['R', -1]]) {
    const sj = J[`upperArm${sd}`], ej = J[`foreArm${sd}`], wj = J[`hand${sd}`];
    const bu = B[`upperArm${sd}`], bf = B[`foreArm${sd}`];
    P.seg(bu, sj, ej, 0.042 * armK * sw, 0.034 * armK * sw, 0.041 * armK * sw, 0.033 * armK * sw, 0.03);
    P.ell(bu, add3(sj, 0, 0.002, 0), 0.050 * sw * (1 + 0.1 * m), 0.054 * sw, 0.048 * sw * (1 + 0.08 * m), 0.04);
    const wEnd = [wj[0] + (wj[0] - ej[0]) * 0.06, wj[1] + (wj[1] - ej[1]) * 0.06, wj[2] + (wj[2] - ej[2]) * 0.06];
    P.seg(bf, ej, wEnd, 0.036 * armK * sw, 0.025 * sw * (0.5 + 0.5 * armK), 0.034 * armK * sw, 0.021 * sw, 0.03);
  }
  // ---- legs
  const lk = (1 + 0.15 * bp.legs + 0.14 * bd + 0.09 * m) ;
  for (const [sd, sg] of [['L', 1], ['R', -1]]) {
    const hj = J[`upperLeg${sd}`], kj = J[`lowerLeg${sd}`], aj = J[`foot${sd}`];
    const bu = B[`upperLeg${sd}`], bl = B[`lowerLeg${sd}`], bf = B[`foot${sd}`], bt = B[`toe${sd}`];
    P.seg(bu, add3(hj, 0, 0.0, 0), kj, 0.090 * sw * lk * (1 + 0.06 * bp.hips), 0.054 * sw * (0.6 + 0.4 * lk), 0.092 * sw * lk, 0.056 * sw * (0.6 + 0.4 * lk), 0.035);
    P.seg(bl, kj, aj, 0.053 * sw * (0.6 + 0.4 * lk), 0.033 * sw, 0.054 * sw * (0.6 + 0.4 * lk), 0.034 * sw, 0.03);
    P.ell(bl, v3(kj[0], kj[1] - (kj[1] - aj[1]) * 0.28, kj[2] - 0.022 * sw), 0.05 * sw * (0.7 + 0.3 * lk), (kj[1] - aj[1]) * 0.27, 0.052 * sw * (0.7 + 0.3 * lk), 0.04);
    const ball = [aj[0], 0.03, 0.14 * s], heel = [aj[0], aj[1] - 0.016, aj[2] - 0.026 * sw];
    P.seg(bf, add3(aj, 0, 0, 0.005), ball, 0.037 * sw, 0.043 * sw, 0.034 * sw, 0.021, 0.03);
    P.ell(bf, heel, 0.034 * sw, 0.04, 0.04, 0.03);
    P.seg(bt, ball, [aj[0], 0.02, 0.215 * s], 0.043 * sw, 0.03 * sw, 0.02, 0.012, 0.02);
  }
  return P;
}
const add3 = (a, x, y, z) => [a[0] + x, a[1] + y, a[2] + z];

export function handPrims(rig, sd) {
  const hl = rig.hands[sd], P = new PrimList(), { wrist, d, hs } = hl;
  const bh = B[`hand${sd}`], sg = sd === 'L' ? 1 : -1;
  const pe = [wrist[0] + d[0] * hl.palmLen, wrist[1] + d[1] * hl.palmLen, wrist[2] + d[2] * hl.palmLen];
  const w0 = [wrist[0] - d[0] * 0.02, wrist[1] - d[1] * 0.02, wrist[2] - d[2] * 0.02];
  // thickness (rx) is along palm normal n, width (rz) along Z. forearm stub sits just under the forearm skin.
  P.seg(bh, w0, pe, 0.0205 * hs, 0.0155 * hs, 0.0270 * hs, 0.0405 * hs, 0.012);
  P.ell(bh, [wrist[0] + d[0] * 0.034 * hs + hl.n[0] * 0.004, wrist[1] + d[1] * 0.034 * hs, wrist[2] + hl.z[2] * 0.03 * hs], 0.02 * hs, 0.03 * hs, 0.02 * hs, 0.012); // thenar pad
  for (const f of FINGERS) {
    const F = hl.fingers[f];
    for (let i = 0; i < 3; i++) {
      const a = F.joints[i], b = F.joints[i + 1], bone = B[`${f}${i + 1}${sd}`];
      const r0 = F.radius * (1 - i * 0.09), r1 = F.radius * (1 - (i + 1) * 0.1) * (i === 2 ? 0.92 : 1);
      P.seg(bone, a, b, r0 * 0.86, r1 * 0.86, r0, r1, 0.004);
    }
  }
  return P;
}

// Build body + both hands into ONE geometry description (shared skeleton).
export function buildBody(rig, bp, asym, h = 0.011) {
  const prims = bodyPrims(rig, bp, asym);
  const top = rig.L.pivotY + 0.07;
  const body = meshSDF(prims, { min: [-0.5, -0.02, -0.2], max: [0.5, top, 0.3], h, tau: 0.012 });
  const parts = [body];
  for (const sd of ['L', 'R']) {
    const hl = rig.hands[sd], pts = [hl.wrist, ...Object.values(hl.fingers).flatMap(f => f.joints)];
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (const p of pts) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], p[i]); mx[i] = Math.max(mx[i], p[i]); }
    const pad = 0.045;
    parts.push(meshSDF(handPrims(rig, sd), { min: mn.map(v => v - pad), max: mx.map(v => v + pad), h: Math.max(0.0034, h * 0.34), B: 4, tau: 0.006 }));
  }
  return mergeParts(parts);
}

function mergeParts(parts) {
  let vc = 0, ic = 0; for (const p of parts) { vc += p.position.length / 3; ic += p.index.length; }
  const position = new Float32Array(vc * 3), normal = new Float32Array(vc * 3), skinIndex = new Uint16Array(vc * 4), skinWeight = new Float32Array(vc * 4), index = new Uint32Array(ic);
  const ranges = []; let vo = 0, io = 0;
  for (const p of parts) {
    const n = p.position.length / 3;
    position.set(p.position, vo * 3); normal.set(p.normal, vo * 3); skinIndex.set(p.skinIndex, vo * 4); skinWeight.set(p.skinWeight, vo * 4);
    for (let i = 0; i < p.index.length; i++) index[io + i] = p.index[i] + vo;
    ranges.push([vo, vo + n]); vo += n; io += p.index.length;
  }
  return { position, normal, skinIndex, skinWeight, index, ranges };
}
