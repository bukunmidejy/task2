// Procedural face skin texture (colour + roughness), painted in the head's planar UV space from the
// sculpted feature map: regional skin variation, brows, lips, nostrils, imperfections, then the full
// makeup stack (foundation, concealer, blush, contour, highlight, shadow, liner, lips).
import { FACE_RECT } from './head.js';
import { skinPalette, lin2hex } from '../core/skincolor.js';
import { mulberry32, clamp } from '../core/rng.js';
import { MAKEUP_PALETTES } from '../data/params.js';

const hexRGB = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgba = (h, a) => { const [r, g, b] = hexRGB(h); return `rgba(${r},${g},${b},${a})`; };
const mixHex = (a, b, t) => { const A = hexRGB(a), B = hexRGB(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const shade = (hex, f) => '#' + hexRGB(hex).map(v => Math.round(clamp(v * f, 0, 255)).toString(16).padStart(2, '0')).join('');

export function createFaceCanvases(size = 1024) {
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = size; return c; };
  return { color: mk(), rough: mk(), size };
}

export function paintFace(cv, skin, makeup, eyesLayout, fm, seed, opts = {}) {
  const S = cv.size, c = cv.color.getContext('2d'), r = cv.rough.getContext('2d');
  const pal = skinPalette(skin), base = lin2hex(pal.base);
  const X = x => ((x - FACE_RECT.x0) / FACE_RECT.w) * S, Y = y => (1 - (y - FACE_RECT.y0) / FACE_RECT.h) * S;
  const sx = S / FACE_RECT.w, sy = S / FACE_RECT.h; // px per metre
  const rng = mulberry32(seed ^ 0x51ed);
  const hx = k => lin2hex(pal[k]);
  const blob = (ctx, x, y, rx, ry, col, a, rot = 0, soft = 1) => {
    ctx.save(); ctx.translate(X(x), Y(y)); ctx.rotate(rot); ctx.scale(rx * sx, ry * sy);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, rgba(col, a)); g.addColorStop(soft * 0.45, rgba(col, a * 0.55)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, 7); ctx.fill(); ctx.restore();
  };
  const path = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); };
  const mk = makeup;
  c.globalCompositeOperation = 'source-over'; r.globalCompositeOperation = 'source-over';
  c.fillStyle = base; c.fillRect(0, 0, S, S);
  const oil = 0.42 - 0.18 * skin.oil * -1; // base roughness (lower = oilier)
  const baseRough = clamp(0.62 - 0.22 * skin.oil, 0.3, 0.8);
  r.fillStyle = `rgb(${Math.round(baseRough * 255)},${Math.round(baseRough * 255)},${Math.round(baseRough * 255)})`; r.fillRect(0, 0, S, S);
  void oil;

  // ---- natural regional variation (this is what stops dark skin reading flat/grey)
  blob(c, 0, 0.098, 0.050, 0.030, hx('forehead'), 0.55); // forehead a touch lighter / oilier
  for (let i = 0; i < 2; i++) {
    const sg = i ? 1 : -1;
    blob(c, sg * 0.036, -0.002, 0.026, 0.026, hx('cheek'), 0.45);                 // cheek warmth
    blob(c, sg * 0.0335, 0.0405, 0.020, 0.0085, hx('underEye'), 0.62, sg * 0.15);   // under-eye
    blob(c, sg * 0.049, 0.074, 0.016, 0.014, shade(base, 0.92), 0.4);              // temples
  }
  blob(c, 0, 0.004, 0.017, 0.022, hx('nose'), 0.7);           // nose
  blob(c, 0, -0.058, 0.026, 0.014, hx('chin'), 0.5);          // chin
  // oil / specular roughness variation: T-zone shinier
  const rb = (x, y, rx, ry, v, a) => { r.save(); r.translate(X(x), Y(y)); r.scale(rx * sx, ry * sy); const g = r.createRadialGradient(0, 0, 0, 0, 0, 1); const gv = Math.round(v * 255); g.addColorStop(0, `rgba(${gv},${gv},${gv},${a})`); g.addColorStop(1, `rgba(${gv},${gv},${gv},0)`); r.fillStyle = g; r.beginPath(); r.arc(0, 0, 1, 0, 7); r.fill(); r.restore(); };
  rb(0, 0.098, 0.04, 0.03, baseRough - 0.12, 0.7); rb(0, 0.006, 0.014, 0.03, baseRough - 0.16, 0.8); rb(0, -0.058, 0.02, 0.012, baseRough - 0.08, 0.6);
  for (const sg of [-1, 1]) rb(sg * 0.052, 0.022, 0.014, 0.014, baseRough - 0.1, 0.6);

  c.save(); c.globalCompositeOperation = 'screen';
  for (const sg of [-1, 1]) blob(c, sg * 0.0485, 0.0225, 0.012, 0.005, shade(base, 1.5), 0.16, sg * -0.4);   // cheekbone catch-light
  blob(c, 0, 0.026, 0.0032, 0.019, shade(base, 1.45), 0.14); blob(c, 0, 0.0045, 0.0042, 0.0042, shade(base, 1.5), 0.14); blob(c, 0, 0.098, 0.03, 0.012, shade(base, 1.4), 0.1);
  c.restore();
  // ---- imperfections (seeded, subtle)
  const bl = skin.blemish, nspots = Math.round(40 + 160 * bl);
  for (let i = 0; i < nspots; i++) {
    const x = (rng() - 0.5) * 0.12, y = -0.06 + rng() * 0.17;
    const dark = rng() < 0.6;
    blob(c, x, y, 0.0012 + rng() * 0.0035, 0.0012 + rng() * 0.0035, dark ? shade(base, 0.82) : hx('cheek'), 0.12 + rng() * 0.22 * (0.4 + bl));
  }
  if (skin.freckles > 0) for (let i = 0; i < 220 * skin.freckles; i++) {
    const x = (rng() - 0.5) * 0.09, y = -0.012 + rng() * 0.07; if (Math.abs(x) < 0.006) continue;
    blob(c, x, y, 0.0009 + rng() * 0.0014, 0.0009 + rng() * 0.0014, shade(base, 0.7), 0.22 + 0.3 * skin.freckles);
  }

  // ---- lips (natural colour; shape follows the sculpt)
  const L = fm.lips, N = 24, xs = Array.from({ length: N + 1 }, (_, i) => -L.lw + (2 * L.lw * i) / N);
  const upper = [...xs.map(x => [x, L.topY(x)]), ...[...xs].reverse().map(x => [x, fm.seamY(x) + 0.0005])];
  const lower = [...xs.map(x => [x, fm.seamY(x) - 0.0005]), ...[...xs].reverse().map(x => [x, L.botY(x)])];
  const lipCol = hx('lip');
  for (const poly of [upper, lower]) { c.save(); c.shadowColor = rgba(lipCol, 0.9); c.shadowBlur = 5; path(c, poly); c.fillStyle = rgba(lipCol, 0.95); c.fill(); c.restore(); }
  // lip edge soft (vermilion border) & lip lines
  path(c, xs.map(x => [x, fm.seamY(x)])); c.lineWidth = 0.0013 * sy; c.strokeStyle = rgba(hx('lipInner'), 0.9); c.stroke();
  // ---- nostrils (dark)
  for (const [nx, ny] of fm.nostrils) blob(c, nx, ny - 0.0006, 0.0030, 0.0036, '#150a07', 0.72);
  // ---- brows (natural): hair strokes along the arc
  const browDark = shade(base, 0.32), bcol = mixHex(browDark, '#0c0705', 0.5);
  const browDensity = 0.5 + 0.5 * mk.brows;
  for (const b of fm.brows) {
    for (let k = 0; k < 340; k++) {
      const t = rng(), seg = Math.min(b.pts.length - 2, Math.floor(t * (b.pts.length - 1))), u = t * (b.pts.length - 1) - seg;
      const p = [b.pts[seg][0] + (b.pts[seg + 1][0] - b.pts[seg][0]) * u, b.pts[seg][1] + (b.pts[seg + 1][1] - b.pts[seg][1]) * u];
      const thick = b.width * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, t * 0.85 + 0.12)));
      const off = (rng() - 0.5) * thick, dirx = Math.sign(p[0]) * (1 - 0.5 * t), len = 0.0042 + rng() * 0.0025;
      c.beginPath(); c.moveTo(X(p[0]), Y(p[1] + off)); c.lineTo(X(p[0] + dirx * len), Y(p[1] + off + (0.0012 + 0.0016 * t) * (1 - t) - 0.0015 * t));
      c.lineWidth = 1.2 + rng() * 0.9; c.strokeStyle = rgba(bcol, 0.14 + 0.2 * browDensity); c.stroke();
    }
    // soft under-colour
    path(c, b.pts); c.lineWidth = b.width * sy * 0.9; c.lineCap = 'round'; c.strokeStyle = rgba(bcol, 0.1 + 0.28 * mk.brows * 0.9); c.stroke();
  }

  // ==================== MAKEUP ====================
  const pm = MAKEUP_PALETTES[mk.preset] || MAKEUP_PALETTES.natural;
  // foundation: unify tone with a colour-matched base (never greys the skin)
  if (mk.foundation > 0) {
    const fcol = mixHex(base, hx('forehead'), 0.5), a = 0.55 * mk.foundation;
    c.save(); c.globalAlpha = a; c.fillStyle = fcol;
    // limited to the face region (everything inside the face rect fades at the edges); avoids hairline hard edge
    const g = c.createRadialGradient(X(0), Y(0.02), 0, X(0), Y(0.02), 0.095 * sx); g.addColorStop(0, fcol); g.addColorStop(0.82, fcol); g.addColorStop(1, rgba(fcol, 0));
    c.fillStyle = g; c.fillRect(0, 0, S, S); c.restore();
    // re-draw nostrils/mouth seam lightly so foundation doesn't erase them
    for (const [nx, ny] of fm.nostrils) blob(c, nx, ny - 0.0006, 0.0030, 0.0036, '#150a07', 0.65);
    path(c, xs.map(x => [x, fm.seamY(x)])); c.lineWidth = 0.0013 * sy; c.strokeStyle = rgba(hx('lipInner'), 0.9); c.stroke();
  }
  if (mk.concealer > 0) for (const sg of [-1, 1]) blob(c, sg * 0.0335, 0.0395, 0.019, 0.0075, mixHex(base, '#c89060', 0.12), 0.7 * mk.concealer, sg * 0.15);
  if (mk.contour > 0) {
    const dk = shade(base, 0.62);
    for (const sg of [-1, 1]) {
      blob(c, sg * 0.046, 0.0, 0.016, 0.0095, dk, 0.55 * mk.contour, sg * -0.5);     // cheek hollow
      blob(c, sg * 0.070, 0.062, 0.012, 0.022, dk, 0.4 * mk.contour);               // temple
      blob(c, sg * 0.040, -0.052, 0.020, 0.0065, dk, 0.4 * mk.contour, sg * 0.3);    // jaw
      blob(c, sg * 0.0118, 0.032, 0.0062, 0.021, dk, 0.35 * mk.contour);            // nose sides
    }
    blob(c, 0, 0.116, 0.050, 0.012, dk, 0.35 * mk.contour);                         // hairline
  }
  if (mk.blush > 0) for (const sg of [-1, 1]) blob(c, sg * 0.0425, 0.0030, 0.025, 0.0165, mk.blushColor, 0.62 * mk.blush, sg * 0.35);
  if (mk.shadow > 0) {
    for (let i = 0; i < 2; i++) {
      const e = eyesLayout.eye[i], sg = i ? 1 : -1;
      c.save(); c.globalCompositeOperation = 'source-over';
      blob(c, e[0] + sg * 0.002, e[1] + 0.0105, 0.0185, 0.0095, mk.shadowColor, 0.78 * mk.shadow, sg * -0.12); // lid
      blob(c, e[0] + sg * 0.007, e[1] + 0.0175, 0.0165, 0.0058, shade(mk.shadowColor, 0.65), 0.55 * mk.shadow, sg * -0.2); // crease/outer V
      c.restore();
    }
  }
  if (mk.liner > 0) for (let i = 0; i < 2; i++) {
    const e = eyesLayout.eye[i], sg = i ? 1 : -1, ex = Math.abs(e[0]), w = 0.0022 + 0.0020 * mk.liner;
    const pts = [[-0.0128, 0.0058], [-0.006, 0.0102], [0.002, 0.0112], [0.0096, 0.0092], [0.0140, 0.0066]].map(([u, v]) => [sg * (ex + u * (i ? 1 : -1) * 1 * (i ? 1 : 1)), e[1] + v]);
    const wing = 0.0035 * mk.liner;
    const lp = pts.map(([x, y]) => [x, y]); lp.push([lp[lp.length - 1][0] + sg * wing * 1.4, lp[lp.length - 1][1] + wing * 0.9]);
    path(c, lp); c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = w * sy; c.strokeStyle = rgba('#0a0605', 0.9 * Math.min(1, mk.liner * 1.4)); c.stroke();
  }
  if (mk.highlight > 0) {
    const hl = mixHex(base, '#ffe0b0', 0.55);
    c.save(); c.globalCompositeOperation = 'screen';
    for (const sg of [-1, 1]) { blob(c, sg * 0.0505, 0.0245, 0.0125, 0.0055, hl, 0.42 * mk.highlight, sg * -0.4); blob(c, sg * 0.0305, 0.0545, 0.012, 0.0045, hl, 0.28 * mk.highlight); }
    blob(c, 0, 0.026, 0.0035, 0.020, hl, 0.34 * mk.highlight); blob(c, 0, 0.0045, 0.0045, 0.0045, hl, 0.3 * mk.highlight);
    blob(c, 0, fm.c.uy + 0.0055, 0.0075, 0.0028, hl, 0.28 * mk.highlight);
    c.restore();
    for (const sg of [-1, 1]) rb(sg * 0.0505, 0.0245, 0.012, 0.0055, 0.28, 0.6 * mk.highlight); // glow = shinier
  }
  if (mk.lip > 0) {
    const lc = mk.lipColor, a = Math.min(0.95, 0.15 + 0.85 * mk.lip);
    for (const poly of [upper, lower]) { c.save(); c.shadowColor = rgba(lc, a); c.shadowBlur = 5; path(c, poly); c.fillStyle = rgba(lc, a); c.fill(); c.restore(); }
    // glossy centre highlight on the lower lip + soft shading at the corners
    c.save(); c.globalCompositeOperation = 'screen'; blob(c, 0, fm.c.ly + 0.0008, 0.0075, 0.0022, '#ffd8c0', 0.28 + 0.3 * mk.gloss); c.restore();
    path(c, xs.map(x => [x, fm.seamY(x)])); c.lineWidth = 0.0011 * sy; c.strokeStyle = rgba(shade(lc, 0.45), 0.85 * Math.min(1, mk.lip * 1.2)); c.stroke();
  }
  // lip gloss + finish -> roughness map
  const lipRough = mk.finish === 'matte' ? 0.7 : mk.finish === 'dewy' ? 0.28 : 0.45;
  const gl = clamp(lipRough - 0.34 * mk.gloss, 0.06, 0.8);
  for (const poly of [upper, lower]) { path(r, poly); const v = Math.round(gl * 255); r.fillStyle = `rgb(${v},${v},${v})`; r.fill(); }
  // matte foundation lowers face shine, dewy raises
  if (mk.foundation > 0) { const v = mk.finish === 'matte' ? 0.75 : mk.finish === 'dewy' ? 0.38 : baseRough; r.save(); r.globalAlpha = 0.5 * mk.foundation; r.fillStyle = `rgb(${Math.round(v * 255)},${Math.round(v * 255)},${Math.round(v * 255)})`; r.fillRect(0, 0, S, S); r.restore(); for (const poly of [upper, lower]) { path(r, poly); const vv = Math.round(gl * 255); r.fillStyle = `rgb(${vv},${vv},${vv})`; r.fill(); } }
  // lashes are geometry; mascara darkens lid margin slightly
  return { base };
}
