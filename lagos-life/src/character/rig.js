// Rig layout: joint positions (rest pose, metres, +Y up, character faces +Z, character-left = +X)
// computed from body parameters. Pure maths (no THREE) so it can be unit-tested.
const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
export const BONE_NAMES = ['root', 'hips', 'spine', 'chest', 'neck', 'head'];
for (const s of ['L', 'R']) {
  BONE_NAMES.push(`clav${s}`, `upperArm${s}`, `foreArm${s}`, `hand${s}`);
  for (const f of FINGERS) for (let i = 1; i <= 3; i++) BONE_NAMES.push(`${f}${i}${s}`);
}
for (const s of ['L', 'R']) BONE_NAMES.push(`upperLeg${s}`, `lowerLeg${s}`, `foot${s}`, `toe${s}`);
export const BONE_INDEX = Object.fromEntries(BONE_NAMES.map((n, i) => [n, i]));

export const BONE_PARENT = { root: null, hips: 'root', spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck' };
for (const s of ['L', 'R']) {
  Object.assign(BONE_PARENT, { [`clav${s}`]: 'chest', [`upperArm${s}`]: `clav${s}`, [`foreArm${s}`]: `upperArm${s}`, [`hand${s}`]: `foreArm${s}`,
    [`upperLeg${s}`]: 'hips', [`lowerLeg${s}`]: `upperLeg${s}`, [`foot${s}`]: `lowerLeg${s}`, [`toe${s}`]: `foot${s}` });
  for (const f of FINGERS) for (let i = 1; i <= 3; i++) BONE_PARENT[`${f}${i}${s}`] = i === 1 ? `hand${s}` : `${f}${i - 1}${s}`;
}
export { FINGERS };

const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const nrm = v => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

export function computeRig(body) {
  const H = body.height / 100, s = H / 1.68;
  const sw = Math.pow(s, 0.62);                       // widths scale slower than height
  const G = 1 + 0.17 * body.build + 0.05 * body.muscle; // overall girth
  const hs = Math.pow(s, 0.55) * 0.935;                       // head scale
  const leg = 0.515 + 0.02 * body.legLength;
  const hipY = leg * H, ankleY = 0.0387 * H, kneeY = ankleY + (hipY - ankleY) * 0.505;
  const shoulderY = 0.822 * H + 0.004 * body.posture, neckBaseY = shoulderY + 0.018 * H;
  const pivotY = H - 0.15 * hs;
  const post = -body.posture * 0.012 + 0.012;          // slouch moves neck/head forward
  const shHalf = 0.158 * sw * (1 + 0.10 * body.shoulders + 0.03 * body.muscle) * (1 + 0.04 * body.build);
  const J = {};
  J.root = [0, 0, 0]; J.hips = [0, hipY, 0]; J.spine = [0, hipY + 0.085 * H, 0];
  J.chest = [0, hipY + 0.19 * H, 0.0]; J.neck = [0, neckBaseY, -0.012 + post * 0.5];
  J.head = [-0.0, pivotY, -0.012 + post];
  const armScale = s;
  const upL = 0.295 * armScale, foL = 0.262 * armScale;
  for (const [sd, sg] of [['L', 1], ['R', -1]]) {
    J[`clav${sd}`] = [sg * 0.02, neckBaseY - 0.02, 0];
    J[`upperArm${sd}`] = [sg * shHalf, shoulderY, 0.0];
    const ua = nrm([sg * 0.26, -0.965, 0.02]);
    J[`foreArm${sd}`] = add(J[`upperArm${sd}`], ua, upL);
    const fa = nrm([sg * 0.17, -0.96, 0.16 + (body.posture < 0 ? 0.04 : 0)]);
    J[`hand${sd}`] = add(J[`foreArm${sd}`], fa, foL);
    J[`_ua${sd}`] = ua; J[`_fa${sd}`] = fa;
    J[`upperLeg${sd}`] = [sg * 0.088 * sw * (1 + 0.06 * body.hips), hipY - 0.01, -0.004];
    J[`lowerLeg${sd}`] = [sg * 0.094 * sw, kneeY, 0.008];
    J[`foot${sd}`] = [sg * 0.092 * sw, ankleY, -0.012];
    J[`toe${sd}`] = [sg * 0.092 * sw, 0.026, 0.118 * s];
  }
  const hands = {};
  for (const [sd, sg] of [['L', 1], ['R', -1]]) {
    const h = handLayout(J[`hand${sd}`], J[`_fa${sd}`], sg, s);
    hands[sd] = h;
    for (const f of FINGERS) for (let i = 1; i <= 3; i++) J[`${f}${i}${sd}`] = h.fingers[f].joints[i - 1];
  }
  const L = { H, s, sw, G, hipY, ankleY, kneeY, shoulderY, neckBaseY, pivotY, shHalf,
    crotchY: hipY - 0.062 * H * (1 + 0.0), waistY: hipY + 0.095 * H, underbustY: hipY + 0.183 * H, bustY: hipY + 0.2 * H,
    thighMidY: (hipY + kneeY) / 2 - 0.02, calfY: kneeY - (kneeY - ankleY) * 0.35, hs, post, upL, foL };
  return { J, L, hands };
}

// Hand layout in the forearm frame. dir = forearm axis, palm faces body (n), fingers spread along Z.
export function handLayout(wrist, dir, sg, s) {
  const d = nrm(dir);
  let n = [-sg, 0, 0]; // palm faces the body (towards x=0), then made perpendicular to the forearm axis
  const dn = d[0] * n[0] + d[1] * n[1] + d[2] * n[2];
  n = nrm([n[0] - d[0] * dn, n[1] - d[1] * dn, n[2] - d[2] * dn]);
  const z = [0, 0, 1];
  const hs = Math.pow(s, 0.85);
  const palmLen = 0.092 * hs;
  const spec = { index: [0.037, [0.040, 0.024, 0.020], 0.0078], middle: [0.0125, [0.044, 0.027, 0.022], 0.0082], ring: [-0.0125, [0.040, 0.025, 0.021], 0.0076], pinky: [-0.036, [0.031, 0.019, 0.018], 0.0066] };
  const fingers = {};
  for (const [name, [zo, segs, r]] of Object.entries(spec)) {
    const base = add(add(wrist, d, palmLen), z, zo * hs);
    const dirF = nrm(add(d, z, zo * 1.7)); // natural splay
    const joints = [base]; let p = base;
    for (let i = 0; i < 3; i++) { p = add(p, dirF, segs[i] * hs); joints.push(p); }
    fingers[name] = { joints, dir: dirF, radius: r * hs, segs: segs.map(q => q * hs) };
  }
  const tb = add(add(add(wrist, d, 0.026 * hs), z, 0.03 * hs), n, 0.004);
  const tdir = nrm(add(add(d, z, 0.62), n, 0.12));
  const tj = [tb]; let q = tb; for (const l of [0.034, 0.031, 0.026]) { q = add(q, tdir, l * hs); tj.push(q); }
  fingers.thumb = { joints: tj, dir: tdir, radius: 0.0104 * hs, segs: [0.034 * hs, 0.031 * hs, 0.026 * hs] };
  return { wrist, d, n, z, palmLen, hs, fingers };
}
