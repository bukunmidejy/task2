// CANONICAL CHARACTER STATE.
// One serialisable object is the single source of truth for a person's appearance. The creator,
// fitting room, mirror, selfie, cutscenes and gameplay all build their on-screen character from
// this object and nothing else - there is no second representation. Pure JS, no THREE imports.
import { FACE_PARAMS, BODY_PARAMS, faceDefaults, bodyDefaults, UNDERTONES, EYE_COLORS, HAIR_COLORS, HAIR_STYLES,
  MAKEUP_PRESETS, MAKEUP_PALETTES, NAIL_TYPES, NAIL_SHAPES, NAIL_DESIGNS, OUTFIT_SLOTS, GARMENT_SLOTS, ACCESSORY_SLOTS } from '../data/params.js';
import { GARMENT_BY_ID, STARTER_OUTFITS } from '../data/wardrobe.js';
import { clamp, hashString, mulberry32 } from './rng.js';

export const SCHEMA_ID = 'lagoslife.character';
export const SCHEMA_VERSION = 2;

const one = (v, list, fallback) => (list.includes(v) ? v : fallback);
const num = (v, lo, hi, def) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : def);
const hex = (v, def) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : def);

export function defaultMakeup(preset = 'natural') {
  const p = MAKEUP_PRESETS[preset], pal = MAKEUP_PALETTES[preset];
  return { preset, ...p, blushColor: pal.blush, shadowColor: pal.shadow, lipColor: pal.lip, finish: 'satin' };
}
export const defaultNails = () => ({ type: 'natural', length: 0.2, shape: 'round', color: '#c8a090', design: 'solid', designColor: '#f0e6d8' });
export const defaultAccessories = () => ({
  earrings: { id: 'studs', metal: 'gold' }, necklace: { id: 'none', metal: 'gold' }, bracelet: { id: 'none', metal: 'gold' },
  ring: { id: 'none', metal: 'gold' }, watch: { id: 'none', metal: 'gold' }, glasses: { id: 'none', color: '#1b1b1d' },
  bag: { id: 'none', color: '#5a3320' }, hairAccessory: { id: 'none', color: '#c89a2a' }, piercings: [],
});

export function createCharacter(overrides = {}) {
  const seed = overrides.seed ?? Math.floor(Math.random() * 2 ** 31);
  const base = {
    schema: SCHEMA_ID, version: SCHEMA_VERSION,
    id: overrides.id ?? `chr_${seed.toString(36)}`, name: 'Ada', seed,
    face: faceDefaults(), body: bodyDefaults(),
    skin: { depth: 0.62, undertone: 'golden', freckles: 0, blemish: 0.2, oil: 0.35, tint: 0 },
    eyes: { color: 'darkbrown' },
    hair: { style: 'knotless', color: 'black', length: 0.6, volume: 0.5, edges: 0.5, wrapColor: '#c89a2a', wrapFabric: 'asooke', highlight: 0 },
    makeup: defaultMakeup('natural'), nails: defaultNails(), accessories: defaultAccessories(),
    clothing: { worn: structuredCloneSafe(STARTER_OUTFITS.casual) },
    outfits: Object.fromEntries(OUTFIT_SLOTS.map(s => [s, structuredCloneSafe(STARTER_OUTFITS[s])])),
    activeOutfit: 'casual',
  };
  return sanitize(deepMerge(base, overrides));
}

function structuredCloneSafe(o) { return JSON.parse(JSON.stringify(o)); }
function deepMerge(a, b) {
  if (b === undefined || b === null) return a;
  if (Array.isArray(b) || typeof b !== 'object') return b;
  const out = { ...a };
  for (const k of Object.keys(b)) out[k] = (a && typeof a[k] === 'object' && !Array.isArray(a[k]) && a[k] !== null) ? deepMerge(a[k], b[k]) : b[k];
  return out;
}

function sanitizeWorn(worn) {
  const out = {};
  if (!worn || typeof worn !== 'object') return out;
  for (const slot of GARMENT_SLOTS) {
    const w = worn[slot];
    if (!w || typeof w.item !== 'string') continue;
    const def = GARMENT_BY_ID[w.item];
    if (!def || def.slot !== slot) continue; // unknown/wrong-slot garments are dropped, never crash
    const fabric = def.fabrics.includes(w.fabric) ? w.fabric : def.fabric;
    out[slot] = { item: w.item, color: hex(w.color, def.colors[0].hex), fabric, variant: Math.max(0, Math.floor(num(w.variant, 0, 9, 0))) };
  }
  // slot conflicts: a one-piece replaces top+bottom
  if (out.onePiece) { delete out.top; delete out.bottom; }
  return out;
}

// sanitize(): clamps to natural ranges, drops unknown ids, fills missing fields. Never throws on junk input.
export function sanitize(c) {
  const d = {};
  d.schema = SCHEMA_ID; d.version = SCHEMA_VERSION;
  d.seed = Number.isFinite(c.seed) ? c.seed >>> 0 : 1;
  d.id = typeof c.id === 'string' ? c.id : `chr_${d.seed.toString(36)}`;
  d.name = typeof c.name === 'string' ? c.name.slice(0, 32) : 'Ada';
  const fd = faceDefaults(), bd = bodyDefaults();
  d.face = {}; for (const p of FACE_PARAMS) d.face[p.key] = num(c.face?.[p.key], p.min, p.max, fd[p.key]);
  d.body = {}; for (const p of BODY_PARAMS) d.body[p.key] = num(c.body?.[p.key], p.min, p.max, bd[p.key]);
  const s = c.skin || {};
  d.skin = { depth: num(s.depth, 0, 1, 0.62), undertone: one(s.undertone, UNDERTONES.map(u => u.id), 'golden'), freckles: num(s.freckles, 0, 1, 0), blemish: num(s.blemish, 0, 1, 0.2), oil: num(s.oil, 0, 1, 0.35), tint: num(s.tint, -1, 1, 0) };
  d.eyes = { color: one(c.eyes?.color, EYE_COLORS.map(e => e.id), 'darkbrown') };
  const h = c.hair || {};
  d.hair = { style: one(h.style, HAIR_STYLES.map(x => x.id), 'knotless'), color: one(h.color, HAIR_COLORS.map(x => x.id), 'black'), length: num(h.length, 0, 1, 0.6), volume: num(h.volume, 0, 1, 0.5), edges: num(h.edges, 0, 1, 0.5), wrapColor: hex(h.wrapColor, '#c89a2a'), wrapFabric: one(h.wrapFabric, ['asooke', 'ankara', 'satin', 'cotton', 'brocade'], 'asooke'), highlight: num(h.highlight, 0, 1, 0) };
  const m = c.makeup || {}, md = defaultMakeup(one(m.preset, Object.keys(MAKEUP_PRESETS), 'natural'));
  d.makeup = { preset: md.preset, finish: one(m.finish, ['matte', 'satin', 'dewy'], 'satin'), blushColor: hex(m.blushColor, md.blushColor), shadowColor: hex(m.shadowColor, md.shadowColor), lipColor: hex(m.lipColor, md.lipColor) };
  for (const k of ['foundation', 'concealer', 'blush', 'contour', 'highlight', 'lip', 'gloss', 'liner', 'shadow', 'brows', 'lashes']) d.makeup[k] = num(m[k], 0, 1, md[k]);
  const n = c.nails || {};
  d.nails = { type: one(n.type, NAIL_TYPES, 'natural'), length: num(n.length, 0, 1, 0.2), shape: one(n.shape, NAIL_SHAPES, 'round'), color: hex(n.color, '#c8a090'), design: one(n.design, NAIL_DESIGNS, 'solid'), designColor: hex(n.designColor, '#f0e6d8') };
  const a = c.accessories || {}, ad = defaultAccessories();
  d.accessories = {};
  for (const slot of Object.keys(ACCESSORY_SLOTS)) {
    if (slot === 'piercings') { d.accessories.piercings = Array.isArray(a.piercings) ? a.piercings.filter(p => ACCESSORY_SLOTS.piercings.includes(p)) : []; continue; }
    const v = a[slot] || {};
    d.accessories[slot] = { ...ad[slot], id: one(v.id, ACCESSORY_SLOTS[slot], 'none') };
    if (ad[slot].metal) d.accessories[slot].metal = one(v.metal, ['gold', 'silver', 'rosegold', 'black'], 'gold');
    if (ad[slot].color) d.accessories[slot].color = hex(v.color, ad[slot].color);
  }
  d.clothing = { worn: sanitizeWorn(c.clothing?.worn) };
  d.outfits = {};
  for (const slot of OUTFIT_SLOTS) d.outfits[slot] = c.outfits?.[slot] ? sanitizeWorn(c.outfits[slot]) : sanitizeWorn(STARTER_OUTFITS[slot]);
  d.activeOutfit = one(c.activeOutfit, OUTFIT_SLOTS, 'casual');
  return d;
}

// ---- persistence -------------------------------------------------------------------------
export function serialize(c) { return JSON.stringify(sanitize(c)); }
export function deserialize(json) {
  const raw = typeof json === 'string' ? JSON.parse(json) : json;
  if (!raw || raw.schema !== SCHEMA_ID) throw new Error('Not a Lagos Life character');
  return sanitize(migrate(raw));
}
export function migrate(raw) {
  const r = structuredCloneSafe(raw);
  if ((r.version ?? 1) < 2) { // v1 stored skin as a single 'tone' value and a flat 'accessory' list
    if (r.skin && r.skin.tone != null && r.skin.depth == null) r.skin.depth = r.skin.tone;
    r.version = 2;
  }
  return r;
}
// Stable fingerprint of the *appearance* (not the id/name). Same fingerprint => same person on screen.
export function fingerprint(c) {
  const d = sanitize(c);
  const { id, name, ...rest } = d;
  return hashString(JSON.stringify(rest)).toString(16).padStart(8, '0');
}

// Small per-character asymmetry derived from the seed: believable, stable, not random per frame.
export function asymmetry(c) {
  const r = mulberry32(c.seed ^ 0x9e3779b9);
  const a = () => (r() - 0.5) * 2;
  return { eye: a(), brow: a(), nose: a(), mouth: a(), jaw: a(), ear: a(), cheek: a(), shoulder: a(), lipTilt: a() };
}

// Random but natural. Used by the skin-lineup / pedestrian generator.
export function randomCharacter(seed = Math.floor(Math.random() * 2 ** 31)) {
  const r = mulberry32(seed);
  const c = createCharacter({ seed });
  const gauss = () => (r() + r() + r() + r() - 2) / 2; // ~[-1,1], centred
  for (const p of FACE_PARAMS) c.face[p.key] = clamp(gauss() * 0.55, p.min, p.max);
  for (const p of BODY_PARAMS) {
    if (p.key === 'height') c.body.height = Math.round(158 + r() * 30);
    else if (p.key === 'muscle') c.body.muscle = r() * 0.6;
    else c.body[p.key] = clamp(gauss() * 0.5, p.min, p.max);
  }
  c.skin.depth = 0.25 + r() * 0.75;
  c.skin.undertone = UNDERTONES[Math.floor(r() * UNDERTONES.length)].id;
  return sanitize(c);
}
