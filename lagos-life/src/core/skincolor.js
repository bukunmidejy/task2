// Skin colour model. Works in OKLCH so we can control lightness, chroma (never grey/ashy) and
// undertone hue independently, then converts to linear sRGB for the renderer.
// Pure JS - unit-tested for: monotonic lightness, minimum chroma, warm R>G>B ordering.
import { clamp, lerp } from './rng.js';

export function oklch2lin(L, C, hDeg) {
  const h = hDeg * Math.PI / 180, a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s].map(v => clamp(v, 0, 1));
}
export const lin2srgb = v => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
export const srgb2lin = v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
export const lin2hex = rgb => '#' + rgb.map(v => Math.round(clamp(lin2srgb(v), 0, 1) * 255).toString(16).padStart(2, '0')).join('');
export const hex2lin = h => [1, 3, 5].map(i => srgb2lin(parseInt(h.slice(i, i + 2), 16) / 255));
export const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// hue (deg), chroma multiplier, sss hue shift, specular tint (cool for blue-black)
const UNDERTONE = {
  golden:    { h: 62, c: 1.00, sss: 32, spec: [1.0, 0.96, 0.88] },
  red:       { h: 40, c: 0.95, sss: 28, spec: [1.0, 0.92, 0.9] },
  neutral:   { h: 49, c: 0.88, sss: 30, spec: [1.0, 0.97, 0.94] },
  cool:      { h: 27, c: 0.86, sss: 24, spec: [0.95, 0.96, 1.0] },
  blueblack: { h: 24, c: 0.62, sss: 26, spec: [0.86, 0.92, 1.0] },
};

// depth 0 (light brown / honey) ... 1 (deepest blue-black)
export function skinPalette(skin) {
  const u = UNDERTONE[skin.undertone] || UNDERTONE.neutral;
  const d = clamp(skin.depth, 0, 1);
  const L = lerp(0.74, 0.27, Math.pow(d, 0.88));
  const hue = u.h + (skin.tint || 0) * 8;
  const C = (0.034 + 0.050 * Math.sin(Math.PI * Math.pow(d, 0.7) * 0.9 + 0.2)) * u.c * 0.93; // rich mid-tones, never zero chroma
  const mk = (dL, dC, dH) => oklch2lin(clamp(L + dL, 0.05, 0.95), Math.max(0.028, C * dC), hue + dH);
  const p = {
    base: mk(0, 1, 0),
    forehead: mk(0.02, 0.95, 4), cheek: mk(-0.022, 1.2, -8), nose: mk(-0.028, 1.25, -9), chin: mk(-0.01, 1.05, -3),
    underEye: mk(-0.055, 1.0, -14), lip: mk(-0.12, 1.25, -26), lipInner: mk(-0.17, 1.3, -30), knuckle: mk(-0.045, 1.0, -4),
    palm: mk(0.1, 1.2, -6), nailBed: mk(0.06, 1.35, -14), ear: mk(-0.02, 1.4, -12),
    sss: oklch2lin(clamp(L * 0.8, 0.2, 0.7), 0.17, u.sss + 340 - 340), // warm red scatter colour
    spec: u.spec, L, hue, chroma: C,
  };
  p.hex = lin2hex(p.base);
  return p;
}

export const SKIN_PRESETS = [
  { name: 'Honey', depth: 0.06, undertone: 'golden' }, { name: 'Caramel', depth: 0.17, undertone: 'golden' },
  { name: 'Bronze', depth: 0.28, undertone: 'red' }, { name: 'Chestnut', depth: 0.40, undertone: 'neutral' },
  { name: 'Mahogany', depth: 0.52, undertone: 'red' }, { name: 'Walnut', depth: 0.62, undertone: 'golden' },
  { name: 'Cocoa', depth: 0.72, undertone: 'cool' }, { name: 'Espresso', depth: 0.84, undertone: 'neutral' },
  { name: 'Ebony', depth: 0.94, undertone: 'blueblack' }, { name: 'Midnight', depth: 1.0, undertone: 'blueblack' },
];
