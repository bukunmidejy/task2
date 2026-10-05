// Face geometry: smooth union/subtraction of anatomical primitives, meshed at ~2.5mm.
// All coordinates are in CANONICAL HEAD UNITS (metres for a 168cm person); the head group is
// scaled by the character's head scale afterwards. Origin = head bone pivot (skull base),
// +Y up, +Z forward. Every face slider maps to a *bounded* change of one or two primitives,
// so proportions stay natural by construction.
import { PrimList, meshSDF, makeField } from './sdf.js';
import { BONE_INDEX } from './rig.js';

const HB = BONE_INDEX.head;

export function faceLayout(f, a) {
  const A = k => (a && a[k]) || 0;
  const ex = 0.0328 * (1 + 0.11 * f.eyeSpacing), ey = 0.0432 + 0.0042 * f.eyeHeight, ez = 0.0585;
  const eyeR = 0.0122;
  const L = {
    eyeR, eye: [[-ex + 0, ey - 0.0009 * A('eye'), ez], [ex, ey + 0.0009 * A('eye'), ez]], // [right(-x), left(+x)]
    eyeOpen: 1 + 0.16 * f.eyeSize, eyeTilt: f.eyeTilt, lidFull: f.eyelid,
    mouthY: -0.0182 + 0.0021 * f.mouthHeight - 0.0045 * f.faceLength * 0.5,
  };
  return L;
}

export function headPrims(f, a) {
  const P = new PrimList(), A = k => (a && a[k]) || 0;
  const L = faceLayout(f, a);
  const dy = -0.0070 * f.faceLength; // lengthens/shortens the lower face
  // ---- skull & face mass
  P.add();
  P.ell(HB, [0, 0.068 + 0.002 * f.forehead, -0.0135], 0.0670 + 0.0030 * f.faceWidth, 0.0845 + 0.0035 * f.forehead, 0.0905, 0.03);
  P.seg(HB, [0, 0.036, 0.020], [0, -0.010 + dy * 0.6, 0.030], 0.0575 + 0.0040 * f.faceWidth, 0.0470 + 0.004 * f.faceWidth, 0.058, 0.052, 0.03);
  P.ell(HB, [0, -0.027 + dy, 0.0165], 0.0400 + 0.005 * f.jawWidth + 0.003 * f.faceWidth - 0.002 * f.jawLine, 0.037, 0.0605, 0.03);
  for (const sg of [-1, 1]) {
    const j = 1 + 0.12 * A('jaw') * sg;
    P.ell(HB, [sg * (0.0385 + 0.0045 * f.jawWidth) * j, -0.0140 + dy, -0.0105], 0.0115 + 0.0040 * f.jawLine + 0.002 * f.jawWidth, 0.027, 0.024 + 0.005 * f.jawLine, 0.022);
  }
  P.ell(HB, [A('jaw') * 0.0012, -0.0495 + dy - 0.0012 * f.chinProj, 0.0575 + 0.0075 * f.chinProj], 0.0170 + 0.0060 * f.chinWidth, 0.0175, 0.0195 + 0.003 * f.chinProj, 0.018);
  for (const sg of [-1, 1]) {
    const c = 1 + 0.12 * A('cheek') * sg;
    P.ell(HB, [sg * 0.0310, -0.0085, 0.0475], (0.0200 + 0.0085 * f.cheekFull) * c, 0.0275 + 0.003 * f.cheekFull, 0.0235 + 0.0080 * f.cheekFull, 0.03);
    P.ell(HB, [sg * (0.0505 + 0.002 * f.faceWidth), 0.0205, 0.0335], 0.0145 + 0.0055 * f.cheekbone, 0.0125 + 0.002 * f.cheekbone, 0.0215 + 0.0070 * f.cheekbone, 0.02);
  }
  P.ell(HB, [0, 0.095 + 0.004 * f.forehead, 0.0515 - 0.0065 * f.foreheadSlope], 0.0515 + 0.002 * f.faceWidth, 0.0365 + 0.0085 * f.forehead, 0.0405, 0.03);
  for (const sg of [-1, 1]) {
    const bh = 0.0615 + 0.0030 * f.browHeight + 0.0008 * A('brow') * sg;
    P.ell(HB, [sg * 0.0275, bh, 0.0765 - 0.0015 * f.eyeDepth], 0.0270, 0.0072 + 0.0030 * f.browRidge, 0.0095 + 0.0040 * f.browRidge, 0.012);
  }
  P.ell(HB, [0, -0.052 + dy * 0.5, 0.0], 0.032, 0.026, 0.038, 0.03); // under-jaw fill into the neck
  // ---- nose
  const nasionY = 0.0525, subY = 0.0025 - 0.0065 * f.noseLength;   // nose length lowers the base of the nose
  const tipY = subY + 0.0065 + 0.0035 * f.noseTipRot - 0.002 * f.noseLength;
  const tipZ = 0.1055 + 0.0095 * f.noseTip, nz = A('nose') * 0.0009;
  const bridgeW = 0.0068 + 0.0030 * f.noseBridgeW, bridgeD = 0.0088 + 0.0034 * f.noseBridge;
  P.seg(HB, [nz * 0.3, nasionY, 0.0815 + 0.0030 * f.noseBridge], [nz, tipY + 0.006, tipZ - 0.007], bridgeW, bridgeW * 1.18 + 0.0012, bridgeD, bridgeD * 1.1, 0.012);
  P.ell(HB, [nz, tipY, tipZ - 0.0035], 0.0095 + 0.0014 * f.noseWidth + 0.0014 * f.noseTipRot * 0, 0.0100, 0.0112 + 0.0010 * f.noseTip, 0.01);
  for (const sg of [-1, 1]) {
    P.ell(HB, [sg * (0.0158 + 0.0046 * f.noseWidth + 0.0018 * f.nostril) + nz * 0.5, subY + 0.0035 + 0.003 * f.noseTipRot, 0.0885 + 0.002 * f.noseTip], 0.0088 + 0.0014 * f.nostril, 0.0105, 0.0096, 0.008);
  }
  P.seg(HB, [nz, tipY - 0.003, tipZ - 0.008], [0, subY - 0.0005, 0.0885], 0.0040, 0.0045, 0.0042, 0.0050, 0.005); // columella
  // ---- lips (two horizontal capsules + side segments that curve back around the arch)
  const my = L.mouthY, lw = 0.0238 * (1 + 0.13 * f.lipWidth), lu = f.lipUpper, ll = f.lipLower;
  const uz = 0.0825 - 0.0005 * f.lipUpper, ty = 0.0030 * f.mouthTilt, as = A('mouth') * 0.0011;
  const uy = my + 0.0034 + 0.0010 * lu, ly = my - 0.0046 - 0.0014 * ll;
  const urx = 0.0034 + 0.0029 * lu, lrx = 0.0046 + 0.0032 * ll;
  P.seg(HB, [-lw * 0.42, uy, uz], [lw * 0.42, uy, uz], urx, urx, 0.0078 + 0.0034 * lu, 0.0078 + 0.0034 * lu, 0.0035);
  P.seg(HB, [-lw * 0.42, ly, uz - 0.0008], [lw * 0.42, ly, uz - 0.0008], lrx, lrx, 0.0088 + 0.0036 * ll, 0.0088 + 0.0036 * ll, 0.0035);
  for (const sg of [-1, 1]) {
    const cy = my + ty + as * sg;
    P.seg(HB, [sg * lw * 0.42, uy, uz], [sg * lw * 0.99, cy + 0.0014, uz - 0.0135], urx * 0.9, 0.0025, 0.0072 + 0.003 * lu, 0.0048, 0.0035);
    P.seg(HB, [sg * lw * 0.42, ly, uz - 0.0008], [sg * lw * 0.99, cy - 0.0012, uz - 0.0145], lrx * 0.85, 0.0025, 0.0082 + 0.003 * ll, 0.0048, 0.0035);
    // cupid's bow peaks
    P.ell(HB, [sg * 0.0058, uy + 0.0032 + 0.0014 * f.cupid, uz + 0.0012], 0.0036 + 0.0014 * f.cupid, 0.0030 + 0.0018 * f.cupid, 0.0040, 0.003);
  }
  // ---- carve: eye sockets, nostrils, folds, creases
  P.subtract();
  for (let i = 0; i < 2; i++) {
    const e = L.eye[i], sg = i === 0 ? -1 : 1;
    P.ell(HB, [e[0], e[1] + 0.0004, e[2] + 0.0128], 0.0136 + 0.0012 * f.eyeSize, 0.0108 + 0.0018 * f.eyeSize, 0.0116 + 0.0012 * f.eyeDepth, 0.005);
    // tear trough / medial canthus pit
    P.ell(HB, [sg * (Math.abs(e[0]) - 0.0128), e[1] - 0.0028, e[2] + 0.0035], 0.0055, 0.0075, 0.0095, 0.006);
  }
  for (const sg of [-1, 1]) {
    P.ell(HB, [sg * (0.0088 + 0.0030 * f.noseWidth + 0.0014 * f.nostril), subY - 0.0036, 0.0958], 0.0036 + 0.0020 * f.nostril, 0.0072, 0.0070, 0.003);
    P.seg(HB, [sg * (0.0215 + 0.004 * f.noseWidth), subY + 0.0035, 0.0845], [sg * 0.0300, my + 0.0030, 0.0765], 0.0007, 0.0005, 0.0013, 0.0009, 0.012); // nasolabial fold
  }
  P.ell(HB, [0, my - 0.0148, 0.0805], 0.0125, 0.0016, 0.0090, 0.006);  // mentolabial crease
  P.ell(HB, [0, subY + 0.0028, 0.0955], 0.0028, 0.0020, 0.0030, 0.004); // philtrum dimple
  P.ell(HB, [0, my + 0.0002 + 0.0, 0.0905 + 0.0], lw * 0.82, 0.0006, 0.0055, 0.0018); // mouth seam
  const ctx = { subY, tipY, tipZ, my, lw, uy, ly, urx, lrx, ty, as, lu, ll, nostrilX: (sg) => sg * (0.0088 + 0.0030 * f.noseWidth + 0.0014 * f.nostril), cupid: f.cupid };
  return { prims: P, layout: L, subY, tipY, tipZ, my, lw, ctx };
}

// 2D (x,y) face landmark map in head space. The skin texture (makeup, brows, lips) is painted from this,
// so makeup always follows the sculpted face - it can never drift off the features.
export function featureMap(f, a, L, c) {
  const A = k => (a && a[k]) || 0;
  const brow = i => {
    const sg = i === 0 ? -1 : 1, e = L.eye[i], ex = Math.abs(e[0]);
    const by = e[1] + 0.0158 + 0.0034 * f.browHeight + 0.0010 * A('brow') * sg;
    const arch = 0.0030 + 0.0034 * f.browArch, inner = ex - 0.0235, outer = ex + 0.0215;
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12, x = inner + (outer - inner) * t;
      const y = by - 0.0012 + arch * Math.sin(Math.PI * Math.pow(t, 0.8)) * (t < 0.65 ? 1 : 1) - 0.0045 * Math.max(0, t - 0.7) * 3 + 0.0016 * (1 - t);
      pts.push([sg * x, y]);
    }
    return { pts, width: 0.0042 + 0.0030 * f.browThick };
  };
  const seamY = x => c.my + c.ty * Math.pow(Math.min(1, Math.abs(x) / c.lw), 2.2) * 1 + (x < 0 ? -c.as : c.as) * Math.abs(x) / c.lw;
  return {
    brows: [brow(0), brow(1)], eye: L.eye, seamY,
    lips: { lw: c.lw, my: c.my, topY: x => c.uy + c.urx * (1 - Math.pow(Math.abs(x) / c.lw, 2)) + 0.0016 * c.cupid * Math.exp(-Math.pow((Math.abs(x) - 0.0058) / 0.0035, 2)) * 1.0 - 0.0014 * Math.exp(-(x * x) / 0.000004), botY: x => c.ly - c.lrx * (1 - Math.pow(Math.abs(x) / c.lw, 2.4)) * 1.0 },
    nostrils: [-1, 1].map(sg => [c.nostrilX(sg), c.subY - 0.0036]),
    cheek: [-1, 1].map(sg => [sg * 0.0385, -0.004]), cheekbone: [-1, 1].map(sg => [sg * 0.0505, 0.0215]),
    c,
  };
}

export function buildHead(f, a, h = 0.0028) {
  const { prims, layout, subY, tipY, tipZ, my, lw, ctx } = headPrims(f, a);
  const m = meshSDF(prims, { min: [-0.095, -0.095, -0.12], max: [0.095, 0.16, 0.125], h, B: 4, weights: false });
  // UV: planar front projection over the face + clamp; makeup/skin texture is painted in this space
  const n = m.position.length / 3, uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { const p = m.position; uv[i * 2] = (p[i * 3] - FACE_RECT.x0) / FACE_RECT.w; uv[i * 2 + 1] = (p[i * 3 + 1] - FACE_RECT.y0) / FACE_RECT.h; }
  const field = makeField(prims);
  return { ...m, uv, layout, field, anchors: { subY, tipY, tipZ, my, lw }, features: featureMap(f, a, layout, ctx) };
}
export const FACE_RECT = { x0: -0.085, w: 0.17, y0: -0.095, h: 0.245 };

// Expression morph targets (deltas in canonical head units). Built per face sculpt so the
// smile / brow motion is anchored to this person's actual mouth corners and brows.
export function faceMorphs(position, fm, layout) {
  const n = position.length / 3, c = fm.c, lw = c.lw, my = c.my;
  const out = [new Float32Array(n * 3), new Float32Array(n * 3), new Float32Array(n * 3), new Float32Array(n * 3)]; // smile, frown, browUp, browDown
  const g = (dx, dy, sx, sy) => Math.exp(-(dx * dx) / (2 * sx * sx) - (dy * dy) / (2 * sy * sy));
  for (let i = 0; i < n; i++) {
    const x = position[i * 3], y = position[i * 3 + 1], z = position[i * 3 + 2], sg = x < 0 ? -1 : 1, ax = Math.abs(x);
    const front = Math.min(1, Math.max(0, (z - 0.02) / 0.04)); if (front <= 0) continue;
    const cornerY = my + c.ty;
    const gc = g(ax - lw, y - cornerY, 0.0115, 0.011) * front, gk = g(ax - 0.040, y + 0.004, 0.020, 0.02) * front;
    const gl = g(x, y - my, 0.026, 0.0095) * front;
    // smile: corners out+up, cheeks lift, lips stretch
    out[0][i * 3] = sg * 0.0036 * gc + sg * 0.0012 * gk + x * 0.05 * gl; out[0][i * 3 + 1] = 0.0058 * gc + 0.0034 * gk + 0.0004 * gl; out[0][i * 3 + 2] = 0.0009 * gc + 0.0016 * gk;
    // frown / serious: corners down, chin pushes up
    out[1][i * 3 + 1] = -0.0045 * gc - 0.0018 * g(x, y + 0.052, 0.02, 0.012) * -1 * front + 0.0020 * g(x, y + 0.052, 0.018, 0.012) * front; out[1][i * 3] = -sg * 0.0008 * gc;
    // brows
    const gb = g(ax - 0.034, y - 0.0625, 0.027, 0.0125) * front, gf = g(x, y - 0.092, 0.04, 0.02) * front;
    out[2][i * 3 + 1] = 0.0046 * gb + 0.0022 * gf; out[2][i * 3 + 2] = 0.0012 * gb;
    const gi = g(ax - 0.014, y - 0.0585, 0.012, 0.01) * front;
    out[3][i * 3 + 1] = -0.0032 * gb - 0.0022 * gi; out[3][i * 3] = -sg * 0.0016 * gi; out[3][i * 3 + 2] = 0.0008 * gi;
  }
  return out;
}
