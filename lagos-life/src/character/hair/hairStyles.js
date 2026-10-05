// Hair style generators. Each returns a description made of GUIDES rooted on the real scalp:
//   ribbons  - strand-card locks (simulated)       tubes   - braids / locs (simulated)
//   cards    - static coil / twist / baby-hair cards   coils - static spiral tubes (bantu knots)
//   scalp    - shell mode for roots, fades and line-ups
// All coordinates are canonical head units (head-group local space).
import { mulberry32 } from '../../core/rng.js';

const C = [0, 0.048, -0.012];
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

export function makeCtx(hd, seed, body = null) {
  const field = hd.field, rng = mulberry32(seed ^ 0xa11ce);
  const grad = p => { const e = 0.0015; return norm([field(p[0] + e, p[1], p[2]) - field(p[0] - e, p[1], p[2]), field(p[0], p[1] + e, p[2]) - field(p[0], p[1] - e, p[2]), field(p[0], p[1], p[2] + e) - field(p[0], p[1], p[2] - e)]); };
  // hairline latitude (rad) as a function of azimuth theta (0 = front)
  const hairLat = th => {
    const a = Math.abs(th), pts = [[0, 0.60], [0.55, 0.50], [0.95, 0.30], [1.45, 0.17], [1.9, 0.02], [2.3, -0.20], [2.8, -0.42], [3.15, -0.50]];
    for (let i = 0; i < pts.length - 1; i++) if (a <= pts[i + 1][0]) return lerp(pts[i][1], pts[i + 1][1], (a - pts[i][0]) / (pts[i + 1][0] - pts[i][0]));
    return -0.5;
  };
  const dirOf = (th, ph) => [Math.sin(th) * Math.cos(ph), Math.sin(ph), Math.cos(th) * Math.cos(ph)];
  const surf = (th, ph) => surfDir(dirOf(th, ph), th, ph);
  const surfDir = (d, thIn, phIn) => {
    const th = thIn ?? Math.atan2(d[0], d[2]), ph = phIn ?? Math.asin(Math.max(-1, Math.min(1, d[1]))); let lo = 0.03, hi = 0.16;
    for (let r = 0.03; r < 0.16; r += 0.004) { const p = [C[0] + d[0] * r, C[1] + d[1] * r, C[2] + d[2] * r]; if (field(...p) > 0) { hi = r; lo = r - 0.004; break; } }
    for (let i = 0; i < 6; i++) { const m = (lo + hi) / 2; const p = [C[0] + d[0] * m, C[1] + d[1] * m, C[2] + d[2] * m]; if (field(...p) > 0) hi = m; else lo = m; }
    const p = [C[0] + d[0] * hi, C[1] + d[1] * hi, C[2] + d[2] * hi];
    return { p, n: grad(p), th, ph };
  };
  const inRegion = (th, ph, margin = 0) => ph > hairLat(th) + margin && ph < 1.45;
  const randomRoot = (margin = 0.0) => { for (let k = 0; k < 40; k++) { const th = (rng() * 2 - 1) * Math.PI, ph = -0.5 + rng() * 2.0; if (inRegion(th, ph, margin)) return surf(th, ph); } return surf(0, 1.2); };
  // keep generated hair outside the torso (so the styled rest shape and the collision shape agree)
  const pushOut = body ? (p, margin) => { const hs = body.hs, o = body.origin; const w = q => [o[0] + q[0] * hs, o[1] + q[1] * hs, o[2] + q[2] * hs]; let q = p; for (let k = 0; k < 3; k++) { const wq = w(q), d = body.field(wq[0], wq[1], wq[2]); if (d >= margin) break; const e = 0.004, g = norm([body.field(wq[0] + e, wq[1], wq[2]) - body.field(wq[0] - e, wq[1], wq[2]), body.field(wq[0], wq[1] + e, wq[2]) - body.field(wq[0], wq[1] - e, wq[2]), body.field(wq[0], wq[1], wq[2] + e) - body.field(wq[0], wq[1], wq[2] - e)]); q = add(q, g, (margin - d) / hs); } return q; } : null;
  return { pushOut, field, grad, hairLat, surf, surfDir, inRegion, randomRoot, rng, dirOf, C };
}

// follow the head, then hang. Returns points in head-local space.
function chain(ctx, root, dir0, L, P, o = {}) {
  const { field, grad } = ctx; const pts = []; let p = add(root.p, root.n, o.lift ?? 0.003); pts.push(p);
  let d = norm(dir0); const step = L / (P - 1), down = [0, -1, 0];
  for (let i = 1; i < P; i++) {
    const t = i / (P - 1), gw = sm(o.g0 ?? 0.08, o.g1 ?? 0.55, t);
    d = norm([d[0] * (1 - gw * 0.5) + down[0] * gw * 0.5, d[1] * (1 - gw * 0.5) + down[1] * gw * 0.5, d[2] * (1 - gw * 0.5) + down[2] * gw * 0.5]);
    if (o.wave) { const w = o.wave * Math.sin(i * (o.freq || 1.3) + (o.ph || 0)); d = norm([d[0] + w, d[1], d[2] + w * 0.6]); }
    p = add(p, d, step);
    const dist = field(...p), off = (o.off ?? 0.006) + (o.vol || 0) * 0.02 * Math.max(0, 1 - t * 1.5);
    if (dist < off) p = add(p, grad(p), off - dist);
    pts.push(p);
  }
  return pts;
}

// Styled hair path: follow the scalp meridian, sweep front hair beside/behind the ear, then hang as a curtain around
// the neck/shoulders (outside the shoulder line). Deterministic - the physics only adds motion on top.
function curtain(ctx, r, L, P, o = {}) {
  const th0 = r.th, sgn = (r.p[0] >= 0 ? 1 : -1) * (Math.abs(r.p[0]) < 0.002 ? (ctx.rng() < 0.5 ? 1 : -1) : 1);
  const front = Math.abs(th0) < 1.25, thE = front ? sgn * (1.25 + (o.back ?? 0.35) * (1 - Math.abs(th0) / 1.25)) : th0;
  const phE = -0.42, lenHead = Math.max(0.01, (r.ph - phE) * 0.092);
  const pts = [add(r.p, r.n, o.lift ?? 0.003)]; const seg = L / (P - 1); let travelled = 0, p = pts[0];
  const spread = (ctx.rng() - 0.5) * (o.spread ?? 0.012); if (o.frontSide === undefined) o = { ...o, frontSide: ctx.rng() < (o.frontP ?? 0.45) };
  for (let i = 1; i < P; i++) {
    travelled += seg;
    if (travelled < lenHead) {
      const u = travelled / lenHead, th = th0 + (thE - th0) * u * u * (3 - 2 * u), ph = r.ph + (phE - r.ph) * u;
      const s = ctx.surf(th, ph); p = add(s.p, s.n, (o.off ?? 0.005) + (o.vol || 0) * 0.02 * (1 - u));
    } else {
      const d = travelled - lenHead, sideK = Math.abs(Math.sin(thE)) > 0.55, ex = sgn * Math.max(Math.abs(Math.sin(thE)) * 0.112, sideK ? 0.105 : 0), ez = sideK ? (o.frontSide ? 0.05 : -0.075) : -0.012 + Math.cos(thE) * 0.108 - (Math.cos(thE) < -0.3 ? 0.012 : 0);
      const last = pts[pts.length - 1], k = Math.min(1, d / 0.08);
      p = [last[0] + (ex + spread * (1 + d * 3) - last[0]) * 0.35 * k + (0), last[1] - seg, last[2] + (ez - last[2]) * 0.35 * k];
    }
    if (travelled >= lenHead && ctx.pushOut) p = ctx.pushOut(p, o.bodyMargin ?? 0.03);
    if (o.wave) { const w = o.wave * Math.sin(i * (o.freq || 1.3) + (o.ph || 0)); p = [p[0] + w, p[1], p[2] + w * 0.6]; }
    pts.push(p);
  }
  return pts;
}

export function generateHair(styleId, hair, ctx, density = 1) {
  const R = ctx.rng, out = { ribbons: [], tubes: [], cards: [], coils: [], scalp: { mode: 'dark', alpha: 0.85 }, edges: hair.edges };
  const len = hair.length, vol = hair.volume, S = Math.max(0.35, density);
  // Loose styles: SOLID tapered clumps (+ a few flyaway cards). Clumps carry streak texture and silky anisotropic shine.
  const flow = o => {
    const nClump = Math.round((o.clumps ?? 240) * S), L0 = o.L;
    for (let i = 0; i < nClump; i++) {
      const r = ctx.randomRoot(0.02), L = L0 * (0.92 + 0.14 * R()) * (o.curl ? 1.22 : 1);
      let pts = curtain(ctx, r, L, o.curl ? 30 : 20, { vol: vol * 0.7 + 0.3, back: o.side ? 0.1 : 0.45, frontP: o.frontP, spread: 0.02 });
      if (o.curl) pts = helix(pts, o.curl, i);
      else if (o.wave) pts = pts.map((p, k) => [p[0] + o.wave * Math.sin(k * 0.8 + i), p[1], p[2] + o.wave * 0.6 * Math.sin(k * 0.8 + i * 1.7)]);
      out.tubes.push({ pts, rigid: 2, stiff: o.stiff, rad: (o.rad || 0.0115) * (0.85 + 0.3 * R()), kind: 'clump', tapered: false, ends: false });
    }
    for (let i = 0; i < Math.round(70 * S); i++) { // short flyaways that break the silhouette near the head
      const r = ctx.randomRoot(0.02);
      out.ribbons.push({ pts: curtain(ctx, r, Math.min(0.14, L0 * 0.3), 10, { vol: vol * 0.7 + 0.45, back: o.side ? 0.1 : 0.45, spread: 0.035 }), rigid: 2, stiff: o.stiff, w: 0.011, roll: (R() - 0.5) * 2.4 });
    }
    out.scalp = { mode: 'dark', alpha: 0.95, part: o.side ? 0.028 : 0 };
  };
  // ringlet curls: helical offsets around the guide, growing toward the ends
  const helix = (pts, amp, k0) => pts.map((p, i) => { const t = i / (pts.length - 1), a = i * 1.15 + k0, A = amp * (0.25 + 0.75 * t); return [p[0] + Math.cos(a) * A, p[1] - Math.abs(Math.sin(a * 0.5)) * A * 0.5, p[2] + Math.sin(a) * A]; });
  switch (styleId) {
    case 'silkpress': flow({ clumps: 260, L: 0.2 + 0.5 * len, stiff: 0.55, wave: 0.0035, rad: 0.0115 }); break;
    case 'bonestraight': flow({ clumps: 260, L: 0.3 + 0.6 * len, stiff: 0.55, rad: 0.0115 }); break;
    case 'bob': flow({ clumps: 230, L: 0.17 + 0.06 * len, stiff: 0.6, rad: 0.0125, side: true }); break;
    case 'closurewig': flow({ clumps: 260, L: 0.3 + 0.45 * len, stiff: 0.55, wave: 0.006 }); break;
    case 'frontalwig': flow({ clumps: 260, L: 0.35 + 0.5 * len, stiff: 0.55, side: true, wave: 0.008 }); break;
    case 'curlywig': flow({ clumps: 330, L: 0.2 + 0.3 * len, stiff: 0.6, curl: 0.016, rad: 0.0085 }); break;
    case 'ponytail': {
      const A = [0, 0.096, -0.092], N = Math.round(380 * S);
      for (let i = 0; i < N; i++) {
        const r = ctx.randomRoot(0.02), pts = [add(r.p, r.n, 0.003)], k = 6;
        for (let j = 1; j <= k; j++) { const t = j / k, q = [lerp(r.p[0], A[0], t), lerp(r.p[1], A[1], t), lerp(r.p[2], A[2], t)]; pts.push(add(q, r.n, 0.006 * (1 - t) + 0.004)); }
        const sp = [(R() - 0.5) * 0.03, (R() - 0.5) * 0.02, (R() - 0.5) * 0.03], L = 0.18 + 0.5 * len;
        let p = add(A, sp, 1); for (let j = 1; j < 11; j++) { p = [p[0] + sp[0] * 0.05 + 0.002 * Math.sin(j + i), p[1] - L / 10, p[2] - 0.004]; pts.push(p); }
        out.ribbons.push({ pts, rigid: k + 1, stiff: 0.07, w: 0.016, roll: (R() - 0.5) * 1.5 });
      }
      break;
    }
    case 'knotless': case 'box': braids(styleId === 'box' ? 0.0165 : 0.0135, styleId === 'box' ? 0.0050 : 0.0040, styleId === 'knotless'); break;
    case 'locs': braids(0.026, 0.0058, false, true); break;
    case 'cornrows': cornrows(false); break;
    case 'fulani': cornrows(true); break;
    case 'afro': puffs(0.045 + 0.12 * vol, 4600, 'coil', 0.034); break;
    case 'shortcut': puffs(0.012 + 0.014 * len, 1700, 'coil', 0.016); out.scalp = { mode: 'stubble', alpha: 1 }; break;
    case 'twistout': twistout(); break;
    case 'bantu': bantu(); break;
    case 'fade': out.scalp = { mode: 'fade', alpha: 1 }; puffsTop(0.012 + 0.02 * len); break;
    case 'lineup': out.scalp = { mode: 'lineup', alpha: 1 }; break;
    default: out.scalp = { mode: 'none' };
  }
  if (['afro', 'twistout', 'silkpress', 'bonestraight', 'closurewig', 'frontalwig', 'curlywig', 'knotless', 'box', 'cornrows', 'fulani', 'bob', 'ponytail'].includes(styleId)) babyHairs();

  function braids(spacing, rad, tapered, locs = false) {
    const rows = [];
    for (let ph = 1.35; ph > -0.35; ph -= spacing / 0.088 * 0.95) rows.push(ph);
    for (const ph of rows) {
      const circ = 2 * Math.PI * 0.085 * Math.cos(ph), n = Math.max(3, Math.round(circ / spacing));
      for (let k = 0; k < n; k++) {
        const th = ((k + (rows.indexOf(ph) % 2) * 0.5) / n) * 2 * Math.PI - Math.PI + (R() - 0.5) * 0.04;
        if (!ctx.inRegion(th, ph, 0.03)) continue;
        const r = ctx.surf(th, ph), L = (locs ? 0.1 + 0.55 * len : 0.12 + 0.72 * len) * (0.92 + 0.14 * R()), P = locs ? 14 : 20;
        const wf = Math.max(0, Math.cos(th)) * sm(0.2, 1.1, ph), sgn = Math.sign(r.p[0]) || 1;
        const d0 = norm([Math.sin(th) * 0.9 + sgn * 1.2 * wf, -0.15, -0.6 * wf + Math.cos(th) * 0.2 * (1 - wf)]);
        const pts = curtain(ctx, r, L, P + 6, { off: 0.006, lift: 0.002, wave: locs ? 0.004 : 0, ph: R() * 6, spread: 0.02, back: 0.5 }); void d0;
        out.tubes.push({ pts, rigid: 2, stiff: locs ? 0.3 : 0.32, rad: rad * (locs ? 0.8 + 0.5 * R() : 1), kind: locs ? 'loc' : 'braid', tapered, ends: !locs, beadsAt: null });
      }
    }
    out.scalp = { mode: 'dark', alpha: 0.9 };
  }
  function cornrows(fulani) {
    const xs = fulani ? [-0.9, -0.62, -0.34, 0, 0.34, 0.62, 0.9] : Array.from({ length: 11 }, (_, k) => -0.95 + 1.9 * k / 10);
    for (let k = 0; k < xs.length; k++) {
      const xk = xs[k], pts = [], P = 28, bold = fulani && xk === 0;
      for (let i = 0; i < P; i++) {
        const u = i / (P - 1), al = lerp(0.62, Math.PI + 0.42, u), lat = xk * (1 - 0.55 * u) * (0.9 + 0.1 * Math.cos(al));
        // path in the sagittal plane (front -> over the crown -> nape), pulled sideways by the row offset; curved feed-in on Fulani sides
        const bend = fulani && !bold ? Math.sin(u * 3.0) * 0.18 * Math.sign(xk) : 0;
        const d = norm([lat + bend, Math.sin(al), Math.cos(al)]), r = ctx.surfDir(d);
        pts.push(add(r.p, r.n, 0.0030 + (bold ? 0.0012 : 0)));
      }
      const hang = (len > 0.25 || fulani) && (!fulani || Math.abs(xk) > 0.8 || bold);
      if (hang) { let p = pts[P - 1]; const Lh = 0.08 + 0.5 * len; for (let i = 1; i < 14; i++) { p = [p[0] * 0.99, p[1] - Lh / 13, p[2] - 0.002]; pts.push(p); } }
      out.tubes.push({ pts, rigid: hang ? P : pts.length, stiff: 0.3, rad: bold ? 0.0046 : 0.0036, kind: 'braid', tapered: false, ends: hang, beads: fulani && hang });
    }
    if (fulani) for (const sg of [-1, 1]) for (let j = 0; j < 4; j++) { // hanging side braids with beads
      const r = ctx.surf(sg * (1.4 + j * 0.12), 0.1 - j * 0.08); out.tubes.push({ pts: curtain(ctx, r, 0.3 + 0.35 * len, 20, { off: 0.007, back: 0 }), rigid: 2, stiff: 0.3, rad: 0.0046, kind: 'braid', tapered: false, ends: true, beads: true });
    }
    out.scalp = { mode: 'dark', alpha: 0.95 };
  }
  function puffs(Lmax, n, tex, width) {
    const N = Math.round(n * S);
    for (let i = 0; i < N; i++) {
      const r = ctx.randomRoot(0.0), edge = sm(0, 0.12, r.ph - ctx.hairLat(r.th)), L = Lmax * (0.45 + 0.55 * edge) * (0.8 + 0.4 * R());
      const dir = norm([r.n[0] * 0.8 + (R() - 0.5) * 0.7, r.n[1] * 0.8 + (R() - 0.5) * 0.7 + 0.1, r.n[2] * 0.8 + (R() - 0.5) * 0.7]);
      const p1 = add(add(r.p, r.n, 0.002), dir, L * 0.5), p2 = add(add(p1, dir, L * 0.5), [0, -1, 0], L * 0.08);
      out.cards.push({ pts: [add(r.p, r.n, 0.002), p1, p2], w: width * (0.7 + 0.6 * R()), tex, roll: R() * 6 });
    }
    out.scalp = { mode: 'dark', alpha: 1 };
  }
  function puffsTop(Lm) {
    for (let i = 0; i < 900 * S; i++) { const r = ctx.randomRoot(0.0); if (r.ph < 0.55) continue; out.cards.push({ pts: [add(r.p, r.n, 0.001), add(r.p, r.n, Lm * 0.6), add(r.p, r.n, Lm)], w: 0.012, tex: 'coil', roll: R() * 6 }); }
  }
  function twistout() {
    const N = Math.round(1900 * S), L0 = 0.07 + 0.12 * len;
    for (let i = 0; i < N; i++) {
      const r = ctx.randomRoot(0.0), t = sm(0, 0.15, r.ph - ctx.hairLat(r.th)), L = L0 * (0.5 + 0.5 * t) * (0.85 + 0.3 * R());
      const dir = norm([r.n[0] * 0.9 + (R() - 0.5) * 0.4, r.n[1] * 0.7 - 0.05, r.n[2] * 0.9 + (R() - 0.5) * 0.4]);
      let p = add(r.p, r.n, 0.003); const pts = [p]; let d = dir; for (let j = 1; j < 6; j++) { d = norm([d[0], d[1] - 0.22, d[2]]); p = add(p, d, L / 5 * (1 + 0.15 * vol)); pts.push(p); }
      out.cards.push({ pts, w: 0.018 + 0.012 * R(), tex: 'twist', roll: R() * 6 });
    }
    out.scalp = { mode: 'dark', alpha: 1 };
  }
  function bantu() {
    const rows = [1.3, 1.0, 0.7, 0.42, 0.16, -0.1, -0.34];
    rows.forEach((ph, ri) => {
      const n = Math.max(3, Math.round(2 * Math.PI * 0.09 * Math.cos(ph) / 0.040));
      for (let k = 0; k < n; k++) {
        const th = ((k + (ri % 2) * 0.5) / n) * 2 * Math.PI - Math.PI; if (!ctx.inRegion(th, ph, 0.05)) continue;
        const r = ctx.surf(th, ph), pts = [], turns = 2.6, steps = 26, up = r.n; let a = norm([up[1], -up[0], 0]); if (Math.hypot(up[0], up[1]) < 0.2) a = [1, 0, 0];
        const b = norm([up[1] * a[2] - up[2] * a[1], up[2] * a[0] - up[0] * a[2], up[0] * a[1] - up[1] * a[0]]);
        for (let i = 0; i <= steps; i++) { const t = i / steps, ang = t * turns * 2 * Math.PI, rr = 0.0125 * (1 - t * 0.7), hgt = 0.004 + 0.012 * Math.min(1, t * 3);
          pts.push([r.p[0] + up[0] * hgt + (a[0] * Math.cos(ang) + b[0] * Math.sin(ang)) * rr, r.p[1] + up[1] * hgt + (a[1] * Math.cos(ang) + b[1] * Math.sin(ang)) * rr, r.p[2] + up[2] * hgt + (a[2] * Math.cos(ang) + b[2] * Math.sin(ang)) * rr]); }
        out.coils.push({ pts, rad: 0.0037 });
      }
    });
    out.scalp = { mode: 'dark', alpha: 0.95 };
  }
  function babyHairs() {
    const n = Math.round(70 * hair.edges * S);
    for (let i = 0; i < n; i++) {
      const th = (R() * 2 - 1) * 1.25, r = ctx.surf(th, ctx.hairLat(th) + 0.015 + R() * 0.03), d = norm([Math.sin(th) * 0.4 + (R() - 0.5) * 0.8, -0.5, 0.35]);
      const p0 = add(r.p, r.n, 0.0008), l = 0.011 + 0.014 * R(), p1 = add(p0, d, l * 0.5), p2 = add(add(p1, d, l * 0.5), [(R() - 0.5) * 2, 0.4, 0], l * 0.5);
      out.cards.push({ pts: [p0, add(p1, r.n, 0.0007), add(p2, r.n, 0.0009)], w: 0.0042, tex: 'strand', roll: 0, edge: true });
    }
  }
  return out;
}
