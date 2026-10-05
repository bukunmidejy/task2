// UI: creator panels, fitting room, looks/compare/skin-lab, save/load; stage/light/camera/weather toolbar; motion dock.
import { FACE_PARAMS, BODY_PARAMS, UNDERTONES, EYE_COLORS, HAIR_COLORS, HAIR_STYLES, MAKEUP_PRESETS, MAKEUP_PALETTES, NAIL_TYPES, NAIL_SHAPES, NAIL_DESIGNS, ACCESSORY_SLOTS, OUTFIT_SLOTS, METALS } from '../data/params.js';
import { GARMENTS, GARMENT_BY_ID, CATEGORIES, QUICK_LOOKS, PATTERN_VARIANTS, STARTER_OUTFITS } from '../data/wardrobe.js';
import { createCharacter, randomCharacter, sanitize, fingerprint, defaultMakeup, asymmetry } from '../core/schema.js';
import { skinPalette, SKIN_PRESETS } from '../core/skincolor.js';
import { CAMERA_MODES } from '../render/cameraRig.js';
import { PRESETS } from '../world/lighting.js';
import { EXPRESSIONS } from '../character/animation.js';
import * as THREE from 'three';

const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); } for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(k)); return e; };
const naira = n => '₦' + n.toLocaleString('en-NG');
const hexOf = h => h;

export function buildUI(app) {
  const root = document.getElementById('ui'), store = app.store;
  const toast = el('div', { class: 'toast' }); document.body.append(toast); let tt;
  const say = m => { toast.textContent = m; toast.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove('on'), 2400); };
  let tab = 'face', trial = null, snapshotA = null, openGroups = new Set(['Shape', 'Body']);

  // ---------- small components
  const slider = (label, get, set, min, max, step = 0.01, fmt = v => (Math.abs(max) <= 1.001 && min <= 0 || max <= 1.001 ? v.toFixed(2) : String(Math.round(v)))) => {
    const val = el('span', { class: 'val' }, fmt(get())), inp = el('input', { type: 'range', min, max, step, value: get() });
    inp.addEventListener('input', () => { set(+inp.value, true); val.textContent = fmt(+inp.value); }); inp.addEventListener('change', () => { set(+inp.value, false); });
    return el('div', { class: 'row' }, el('label', {}, label), inp, val);
  };
  const chips = (items, active, pick) => el('div', { class: 'chips' }, items.map(it => el('button', { class: 'chip' + (active(it) ? ' on' : ''), onclick: () => pick(it) }, it.label ?? it.id ?? String(it))));
  const swatches = (items, active, pick, lg = false) => el('div', { class: 'sw' }, items.map(it => el('button', { class: (active(it) ? 'on ' : '') + (lg ? 'lg' : ''), title: it.label || it.name, style: `background:${it.hex}`, onclick: () => pick(it) })));
  const mut = (fn, live = false) => store.mutate(fn, { live });
  const colorInput = (label, get, set) => el('div', { class: 'row' }, el('label', {}, label), el('input', { type: 'color', value: get(), style: 'flex:1;height:30px;border:0;background:none', oninput: e => set(e.target.value, true), onchange: e => set(e.target.value, false) }));

  // ---------- tab renderers
  const T = {};
  T.face = () => {
    const s = store.state, out = [];
    out.push(el('div', { class: 'btns' }, el('button', { class: 'btn', onclick: () => { const r = randomCharacter(Math.floor(Math.random() * 1e9)); mut(d => { d.face = r.face; d.seed = r.seed; }); render(); } }, '🎲 Natural random'), el('button', { class: 'btn', onclick: () => { mut(d => { for (const p of FACE_PARAMS) d.face[p.key] = 0; }); render(); } }, 'Reset face')));
    out.push(el('div', { class: 'note' }, 'All ranges are limited to natural human proportions. A small seeded asymmetry is built in, so faces are never perfectly mirrored.'));
    const groups = [...new Set(FACE_PARAMS.map(p => p.group))];
    for (const g of groups) {
      const open = openGroups.has(g), body = el('div', { class: open ? '' : 'hidden' }, FACE_PARAMS.filter(p => p.group === g).map(p => slider(p.label, () => store.state.face[p.key], (v, live) => mut(d => { d.face[p.key] = v; }, live), p.min, p.max, p.step)));
      out.push(el('h4', { style: 'cursor:pointer', onclick: () => { open ? openGroups.delete(g) : openGroups.add(g); render(); } }, (open ? '▾ ' : '▸ ') + g), body);
    }
    out.push(el('h4', {}, 'Eye colour'), swatches(EYE_COLORS, c => s.eyes.color === c.id, c => { mut(d => { d.eyes.color = c.id; }); render(); }, true));
    return out;
  };
  T.body = () => {
    const s = store.state, presets = { Slim: { build: -0.6, hips: -0.1, glutes: -0.2, chest: -0.2, legs: -0.3, muscle: 0.15 }, Athletic: { build: -0.1, muscle: 0.7, shoulders: 0.3, hips: -0.1, glutes: 0.1, legs: 0.2 }, Curvy: { build: 0.25, hips: 0.7, glutes: 0.7, waist: -0.3, chest: 0.4, legs: 0.4 }, Full: { build: 0.8, stomach: 0.5, hips: 0.5, glutes: 0.4, chest: 0.4, legs: 0.5 }, Broad: { build: 0.3, shoulders: 0.7, chest: -0.2, hips: -0.4, glutes: -0.2, muscle: 0.6, height: 182 } };
    return [el('h4', {}, 'Build presets'), el('div', { class: 'chips' }, Object.entries(presets).map(([n, p]) => el('button', { class: 'chip', onclick: () => { mut(d => { for (const p0 of BODY_PARAMS) if (p0.key !== 'height') d.body[p0.key] = p0.def; Object.assign(d.body, p); }); render(); } }, n))),
      el('h4', {}, 'Fine control'), BODY_PARAMS.map(p => slider(p.label, () => store.state.body[p.key], (v, live) => mut(d => { d.body[p.key] = v; }, live), p.min, p.max, p.step)),
      el('div', { class: 'note' }, 'Natural ranges only. Clothes are generated from this exact body, so every change re-fits them.')];
  };
  T.skin = () => {
    const s = store.state, pal = skinPalette(s.skin);
    return [el('h4', {}, 'Skin tone'), swatches(SKIN_PRESETS.map(p => ({ ...p, hex: skinPalette(p).hex })), p => Math.abs(p.depth - s.skin.depth) < 0.02 && p.undertone === s.skin.undertone, p => { mut(d => { d.skin.depth = p.depth; d.skin.undertone = p.undertone; }); render(); }, true),
      slider('Depth', () => store.state.skin.depth, (v, live) => mut(d => { d.skin.depth = v; }, live), 0, 1),
      el('h4', {}, 'Undertone'), chips(UNDERTONES, u => s.skin.undertone === u.id, u => { mut(d => { d.skin.undertone = u.id; }); render(); }),
      slider('Warmth shift', () => store.state.skin.tint, (v, live) => mut(d => { d.skin.tint = v; }, live), -1, 1),
      el('h4', {}, 'Natural detail'), slider('Freckles', () => store.state.skin.freckles, (v, live) => mut(d => { d.skin.freckles = v; }, live), 0, 1), slider('Blemishes', () => store.state.skin.blemish, (v, live) => mut(d => { d.skin.blemish = v; }, live), 0, 1), slider('Natural oil / shine', () => store.state.skin.oil, (v, live) => mut(d => { d.skin.oil = v; }, live), 0, 1),
      el('div', { class: 'note' }, 'Skin is shaded with subsurface scattering, pore-level relief and undertone-tinted specular. Colours are generated in OKLCH with a hard floor on chroma, so no tone goes grey or ashy. Use ', el('b', {}, 'Looks → Skin lineup'), ' to compare 10 tones in the current light.')];
  };
  T.hair = () => {
    const s = store.state, h = s.hair;
    const out = [el('h4', {}, 'Style'), el('div', { class: 'chips' }, HAIR_STYLES.map(st => el('button', { class: 'chip' + (h.style === st.id ? ' on' : ''), onclick: () => { mut(d => { d.hair.style = st.id; }); render(); } }, st.label)))];
    out.push(el('h4', {}, 'Colour'), swatches(HAIR_COLORS, c => h.color === c.id, c => mut(d => { d.hair.color = c.id; })));
    out.push(slider('Length', () => store.state.hair.length, (v, live) => mut(d => { d.hair.length = v; }, live), 0, 1), slider('Volume', () => store.state.hair.volume, (v, live) => mut(d => { d.hair.volume = v; }, live), 0, 1), slider('Edges / baby hairs', () => store.state.hair.edges, (v, live) => mut(d => { d.hair.edges = v; }, live), 0, 1), slider('Highlights', () => store.state.hair.highlight, (v, live) => mut(d => { d.hair.highlight = v; }, live), 0, 1));
    if (h.style === 'headwrap') out.push(el('h4', {}, 'Head wrap fabric'), chips(['asooke', 'ankara', 'satin', 'cotton', 'brocade'].map(x => ({ id: x })), f => h.wrapFabric === f.id, f => { mut(d => { d.hair.wrapFabric = f.id; }); render(); }), colorInput('Wrap colour', () => h.wrapColor, (v, live) => mut(d => { d.hair.wrapColor = v; }, live)));
    out.push(el('div', { class: 'note' }, 'Braids, locs, wigs and loose hair are simulated strand-guides with head, neck and shoulder collision, wind, rain weight and walking inertia. Afro, twist-out, short cuts and bantu knots are static volumes that move rigidly with the head.'));
    return out;
  };
  T.makeup = () => {
    const m = store.state.makeup, pal = skinPalette(store.state.skin), L = ['foundation', 'concealer', 'contour', 'blush', 'highlight', 'shadow', 'liner', 'lashes', 'brows', 'lip', 'gloss'];
    return [el('h4', {}, 'Look'), el('div', { class: 'chips' }, Object.keys(MAKEUP_PRESETS).map(k => el('button', { class: 'chip' + (m.preset === k ? ' on' : ''), onclick: () => { mut(d => { d.makeup = defaultMakeup(k); }); render(); } }, k === 'softglam' ? 'Soft glam' : k === 'fullglam' ? 'Full glam' : k[0].toUpperCase() + k.slice(1)))),
      el('div', { class: 'row' }, el('label', {}, 'Foundation match'), el('span', { style: `flex:1;height:24px;border-radius:7px;background:${pal.hex};border:1px solid #fff3` }), el('span', { class: 'val', style: 'flex-basis:70px' }, pal.hex)),
      el('h4', {}, 'Intensity'), L.map(k => slider(k[0].toUpperCase() + k.slice(1), () => store.state.makeup[k], (v, live) => mut(d => { d.makeup[k] = v; }, live), 0, 1)),
      el('h4', {}, 'Colours'), colorInput('Blush', () => m.blushColor, (v, live) => mut(d => { d.makeup.blushColor = v; }, live)), colorInput('Eyeshadow', () => m.shadowColor, (v, live) => mut(d => { d.makeup.shadowColor = v; }, live)), colorInput('Lips', () => m.lipColor, (v, live) => mut(d => { d.makeup.lipColor = v; }, live)),
      el('h4', {}, 'Finish'), chips(['matte', 'satin', 'dewy'].map(x => ({ id: x })), f => m.finish === f.id, f => { mut(d => { d.makeup.finish = f.id; }); render(); })];
  };
  T.details = () => {
    const n = store.state.nails, a = store.state.accessories, out = [el('h4', {}, 'Nails')];
    out.push(chips(NAIL_TYPES.map(x => ({ id: x, label: { natural: 'Natural', gel: 'Gel', acrylic: 'Acrylic', presson: 'Press-on' }[x] })), t => n.type === t.id, t => { mut(d => { d.nails.type = t.id; }); render(); }), chips(NAIL_SHAPES.map(x => ({ id: x, label: x[0].toUpperCase() + x.slice(1) })), t => n.shape === t.id, t => { mut(d => { d.nails.shape = t.id; }); render(); }),
      slider('Length', () => store.state.nails.length, (v, live) => mut(d => { d.nails.length = v; }, live), 0, 1), chips(NAIL_DESIGNS.map(x => ({ id: x, label: x[0].toUpperCase() + x.slice(1) })), t => n.design === t.id, t => { mut(d => { d.nails.design = t.id; }); render(); }),
      swatches(['#c8a090', '#8a1c3a', '#d9a441', '#141416', '#f0e6d8', '#1f3f9a', '#2fa05a', '#d9604a'].map(h => ({ hex: h })), c => n.color === c.hex, c => mut(d => { d.nails.color = c.hex; })), colorInput('Accent / design', () => n.designColor, (v, live) => mut(d => { d.nails.designColor = v; }, live)));
    out.push(el('h4', {}, 'Accessories'));
    for (const [slot, ids] of Object.entries(ACCESSORY_SLOTS)) {
      if (slot === 'piercings') { out.push(el('div', { class: 'note' }, 'Piercings'), el('div', { class: 'chips' }, ids.map(p => el('button', { class: 'chip' + (a.piercings.includes(p) ? ' on' : ''), onclick: () => { mut(d => { const i = d.accessories.piercings.indexOf(p); i >= 0 ? d.accessories.piercings.splice(i, 1) : d.accessories.piercings.push(p); }); render(); } }, p)))); continue; }
      out.push(el('div', { class: 'note' }, slot.replace(/([A-Z])/g, ' $1').toLowerCase()), chips(ids.map(x => ({ id: x })), c => a[slot].id === c.id, c => { mut(d => { d.accessories[slot].id = c.id; }); render(); }));
      if (a[slot].id !== 'none' && a[slot].metal) out.push(el('div', { class: 'sw' }, Object.entries(METALS).map(([k, hx]) => el('button', { class: a[slot].metal === k ? 'on' : '', style: `background:${hx}`, title: k, onclick: () => { mut(d => { d.accessories[slot].metal = k; }); render(); } }))));
      if (a[slot].id !== 'none' && a[slot].color) out.push(colorInput('Colour', () => a[slot].color, (v, live) => mut(d => { d.accessories[slot].color = v; }, live)));
    }
    return out;
  };

  // ---------- wardrobe / fitting room
  const owned = () => { const s = new Set(store.owned); for (const w of Object.values(store.state.outfits)) for (const x of Object.values(w)) s.add(x.item); for (const x of Object.values(store.state.clothing.worn)) if (!trial) s.add(x.item); return s; };
  const wearItem = (def, over = {}) => mut(d => { const slot = def.slot; const cur = d.clothing.worn[slot]; d.clothing.worn[slot] = { item: def.id, color: over.color || (cur && cur.item === def.id ? cur.color : def.colors[0].hex), fabric: over.fabric || (cur && cur.item === def.id ? cur.fabric : def.fabric), variant: over.variant ?? (cur && cur.item === def.id ? cur.variant : 0) }; if (slot === 'onePiece') { delete d.clothing.worn.top; delete d.clothing.worn.bottom; } if ((slot === 'top' || slot === 'bottom') && d.clothing.worn.onePiece) delete d.clothing.worn.onePiece; });
  let wardCat = 'casual';
  T.wardrobe = () => {
    const st = store.state, worn = st.clothing.worn, out = [];
    out.push(el('div', { class: 'row' }, el('span', { class: 'price' }, 'Wallet ' + naira(store.wallet)), el('span', { class: 'note', style: 'margin-left:auto' }, 'prototype currency')));
    out.push(el('div', { class: 'note' }, 'Everything is tried on YOUR character, live — rotate, walk and compare before you buy.'));
    out.push(el('h4', {}, 'Category'), el('div', { class: 'chips' }, CATEGORIES.map(c => el('button', { class: 'chip' + (wardCat === c ? ' on' : ''), onclick: () => { wardCat = c; render(); } }, c[0].toUpperCase() + c.slice(1)))));
    const list = GARMENTS.filter(g => g.cats.includes(wardCat)), ow = owned();
    out.push(el('div', { class: 'grid' }, list.map(g => el('button', { class: 'gar' + (worn[g.slot]?.item === g.id ? ' on' : ''), onclick: () => { if (!trial) trial = { prev: JSON.parse(JSON.stringify(worn)) }; trial.id = g.id; wearItem(g); render(); } }, g.name, el('small', {}, g.slot === 'onePiece' ? 'one-piece' : g.slot), el('span', { class: 'price' }, ow.has(g.id) ? 'owned' : naira(g.price))))));
    // currently worn / editing
    out.push(el('h4', {}, 'Worn now'));
    for (const [slot, w] of Object.entries(worn)) {
      const def = GARMENT_BY_ID[w.item]; const card = el('div', { class: 'card' }, el('div', { class: 'row' }, el('b', {}, def.name), el('span', { class: 'note', style: 'margin-left:auto' }, slot), el('button', { class: 'chip', onclick: () => { mut(d => { delete d.clothing.worn[slot]; }); render(); } }, '✕')));
      card.append(swatches(def.colors, c => w.color === c.hex, c => { mut(d => { d.clothing.worn[slot].color = c.hex; }); render(); }));
      if (def.fabrics.length > 1) card.append(chips(def.fabrics.map(f => ({ id: f })), f => w.fabric === f.id, f => { mut(d => { d.clothing.worn[slot].fabric = f.id; d.clothing.worn[slot].variant = 0; }); render(); }));
      const nv = PATTERN_VARIANTS[w.fabric]; if (nv > 1) card.append(el('div', { class: 'chips' }, Array.from({ length: nv }, (_, i) => el('button', { class: 'chip' + (w.variant === i ? ' on' : ''), onclick: () => { mut(d => { d.clothing.worn[slot].variant = i; }); render(); } }, 'Pattern ' + (i + 1)))));
      out.push(card);
    }
    if (trial) {
      const def = GARMENT_BY_ID[trial.id], isOwned = owned().has(trial.id) || store.owned.has(trial.id);
      out.push(el('div', { class: 'card', style: 'border-color:var(--gold)' }, el('b', {}, 'Trying on: ' + def.name), el('div', { class: 'note' }, isOwned ? 'You own this.' : 'Price ' + naira(def.price)),
        el('div', { class: 'btns' }, el('button', { class: 'btn grn', onclick: () => { if (!isOwned && !store.buy(trial.id, def.price)) { say('Not enough ₦ for that'); return; } trial = null; say(isOwned ? 'Wearing it' : 'Bought!'); store.save(); render(); } }, isOwned ? 'Wear' : 'Buy ' + naira(def.price)), el('button', { class: 'btn red', onclick: () => { store.mutate(d => { d.clothing.worn = trial.prev; }); trial = null; render(); } }, 'Cancel'),
          el('button', { class: 'btn', onclick: () => { app.camRig.setMode('full'); app.walkLoop = true; } }, 'Walk it'), el('button', { class: 'btn', onclick: () => { snapshotA = JSON.parse(JSON.stringify({ ...store.state, clothing: { worn: trial.prev } })); app.compare(snapshotA); say('Left: before · Right: trying on'); } }, 'Compare'))));
    }
    out.push(el('h4', {}, 'Outfit slots'), el('div', { class: 'note' }, 'Save what you are wearing into a slot, or wear a saved outfit.'));
    out.push(el('div', { class: 'grid' }, OUTFIT_SLOTS.map(slot => { const o = st.outfits[slot], names = Object.values(o).map(w => GARMENT_BY_ID[w.item]?.name).filter(Boolean).slice(0, 3).join(', ');
      return el('div', { class: 'card', style: 'margin:0' }, el('b', {}, slot[0].toUpperCase() + slot.slice(1) + (st.activeOutfit === slot ? ' ★' : '')), el('div', { class: 'note', style: 'min-height:30px' }, names || 'empty'),
        el('div', { class: 'btns', style: 'margin:0' }, el('button', { class: 'chip', onclick: () => { mut(d => { d.clothing.worn = JSON.parse(JSON.stringify(d.outfits[slot])); d.activeOutfit = slot; }); trial = null; render(); } }, 'Wear'), el('button', { class: 'chip', onclick: () => { mut(d => { d.outfits[slot] = JSON.parse(JSON.stringify(d.clothing.worn)); d.activeOutfit = slot; }); store.save(); say('Saved to ' + slot); render(); } }, 'Save here'))); })));
    out.push(el('h4', {}, 'Quick looks'), el('div', { class: 'chips' }, QUICK_LOOKS.map(q => el('button', { class: 'chip', onclick: () => { mut(d => { d.clothing.worn = JSON.parse(JSON.stringify(q.worn)); }); render(); } }, q.name))));
    return out;
  };
  // ---------- looks / compare / skin lab / demo people
  const DEMO = () => ({
    Ada: createCharacter({ seed: 20251005, name: 'Ada' }),
    Zainab: createCharacter({ seed: 11, name: 'Zainab', skin: { depth: 0.2, undertone: 'golden', freckles: 0.3 }, hair: { style: 'headwrap', wrapColor: '#b0206a', wrapFabric: 'asooke' }, face: { cheekFull: 0.5, noseWidth: -0.2, lipUpper: 0.2, faceLength: 0.2, eyeSize: 0.3 }, body: { height: 164, build: 0.3, hips: 0.5, glutes: 0.4 }, eyes: { color: 'amber' }, clothing: { worn: STARTER_OUTFITS.traditional } }),
    Tunde: createCharacter({ seed: 33, name: 'Tunde', skin: { depth: 0.82, undertone: 'neutral' }, hair: { style: 'fade', length: 0.2 }, face: { jawWidth: 0.5, jawLine: 0.6, browRidge: 0.5, noseWidth: 0.3, chinProj: 0.3, lipLower: 0.2, cheekFull: -0.3, faceWidth: 0.3 }, body: { height: 184, build: 0.2, muscle: 0.55, shoulders: 0.6, chest: -0.5, hips: -0.5, glutes: -0.3, waist: -0.1 }, makeup: defaultMakeup('bare'), accessories: { earrings: { id: 'none' } }, clothing: { worn: { top: { item: 'senator', color: '#1c2a4a', fabric: 'linen', variant: 0 }, bottom: { item: 'trousers', color: '#1c2a4a', fabric: 'twill', variant: 0 }, shoes: { item: 'loafers', color: '#141416', fabric: 'leather', variant: 0 } } } }),
    Ngozi: createCharacter({ seed: 77, name: 'Ngozi', skin: { depth: 0.96, undertone: 'blueblack' }, hair: { style: 'afro', volume: 0.7 }, face: { eyeSpacing: 0.2, noseTip: 0.2, lipUpper: 0.5, lipLower: 0.5, cheekbone: 0.5, chinWidth: -0.3, jawWidth: -0.3 }, body: { height: 174, build: -0.3, legs: 0.2, hips: 0.2 }, makeup: defaultMakeup('softglam'), clothing: { worn: { onePiece: { item: 'slipdress', color: '#0f6a50', fabric: 'satin', variant: 0 }, shoes: { item: 'heels', color: '#d9a441', fabric: 'leather', variant: 0 } } } }),
  });
  T.looks = () => {
    const out = [el('h4', {}, 'People'), el('div', { class: 'chips' }, Object.entries(DEMO()).map(([n, st]) => el('button', { class: 'chip', onclick: () => { store.replace(st); render(); } }, n)), el('button', { class: 'chip', onclick: () => { store.replace(randomCharacter(Math.floor(Math.random() * 1e9))); render(); } }, '🎲 Random'))];
    out.push(el('h4', {}, 'Compare looks'), el('div', { class: 'btns' }, el('button', { class: 'btn', onclick: () => { snapshotA = JSON.parse(JSON.stringify(store.state)); say('Look A captured — now change something, then press Compare'); } }, 'Capture look A'), el('button', { class: 'btn pri', onclick: () => { if (!snapshotA) { say('Capture look A first'); return; } app.compare(snapshotA); } }, 'Compare A | now'), el('button', { class: 'btn', onclick: () => { app.clearExtra(); app.ch.root.visible = true; } }, 'Clear')));
    out.push(el('div', { class: 'note' }, 'Left = captured look, right = live. Both are the same character system, same lighting.'));
    out.push(el('h4', {}, 'Skin lineup (lighting test)'), el('div', { class: 'btns' }, el('button', { class: 'btn pri', onclick: async () => { say('Building 10 skin tones…'); await app.skinLineup((i, n) => say(`Skin ${i}/${n}`)); say('Switch Daylight / Indoor / Night to test'); } }, 'Show 10 tones'), el('button', { class: 'btn', onclick: () => app.clearExtra() }, 'Back to my character')));
    out.push(el('div', { class: 'note' }, 'Same face, body, hair and outfit across ten tones from honey to midnight. Change lighting and stage to check no tone goes grey or plastic.'));
    return out;
  };
  // ---------- save/load
  T.save = () => {
    const slots = store.slots(), fp = store.fingerprint();
    const out = [el('div', { class: 'card' }, el('div', { class: 'row' }, el('label', {}, 'Name'), el('input', { type: 'text', value: store.state.name, style: 'flex:1;background:var(--panel2);color:var(--txt);border:1px solid var(--line);border-radius:8px;padding:6px', onchange: e => mut(d => { d.name = e.target.value; }) })), el('div', { class: 'note' }, 'Appearance fingerprint: ', el('b', { id: 'fp' }, fp)))];
    out.push(el('h4', {}, 'Slots'));
    for (const slot of ['main', 'slot 2', 'slot 3']) { const e = slots[slot]; out.push(el('div', { class: 'card' }, el('div', { class: 'row' }, el('b', {}, slot), el('span', { class: 'note', style: 'margin-left:auto' }, e ? `${e.name} · ${e.fp} · ${new Date(e.at).toLocaleTimeString()}` : 'empty')), el('div', { class: 'btns', style: 'margin:0' }, el('button', { class: 'btn', onclick: () => { store.save(slot); say('Saved ' + slot); render(); } }, 'Save'), el('button', { class: 'btn', disabled: !e, onclick: () => { store.loadSlot(slot); say('Loaded ' + slot); render(); } }, 'Load')))); }
    out.push(el('h4', {}, 'Reload test'), el('div', { class: 'note' }, 'Saves, destroys the character, rebuilds it from the saved data and compares fingerprints.'), el('div', { class: 'btns' }, el('button', { class: 'btn pri', onclick: () => { const before = store.fingerprint(); store.save(); const ok = store.loadSaved(); app.makeCharacter(); const after = store.fingerprint(); say(before === after && ok ? `✓ Same person restored (${after})` : '✗ Mismatch'); render(); } }, 'Save → rebuild → verify')));
    out.push(el('h4', {}, 'File'), el('div', { class: 'btns' }, el('button', { class: 'btn', onclick: () => { const b = new Blob([store.exportJSON()], { type: 'application/json' }), a = el('a', { href: URL.createObjectURL(b), download: `${store.state.name || 'character'}.lagoslife.json` }); a.click(); } }, 'Export JSON'), el('label', { class: 'btn' }, 'Import JSON', el('input', { type: 'file', accept: '.json', class: 'hidden', onchange: async e => { try { store.importJSON(await e.target.files[0].text()); say('Imported'); render(); } catch (err) { say('Not a valid character file'); } } }))));
    out.push(el('div', { class: 'btns' }, el('button', { class: 'btn red', onclick: () => { store.replace(createCharacter({ seed: Math.floor(Math.random() * 1e9) })); render(); } }, 'New character')));
    return out;
  };

  // ---------- panel shell
  const TABS = [['face', 'Face'], ['body', 'Body'], ['skin', 'Skin'], ['hair', 'Hair'], ['makeup', 'Makeup'], ['details', 'Nails & Acc.'], ['wardrobe', 'Fitting room'], ['looks', 'Looks'], ['save', 'Save']];
  const tabsEl = el('div', { class: 'tabs' }), bodyEl = el('div', { class: 'body' });
  const panel = el('div', { class: 'panel' }, el('div', { class: 'brand' }, el('i', { class: 'dot' }), el('b', {}, 'Lagos Life'), el('span', {}, 'Phase 1 · Character Look Test')), tabsEl, bodyEl);
  function render() {
    tabsEl.replaceChildren(...TABS.map(([id, l]) => el('button', { class: 'tab' + (tab === id ? ' on' : ''), onclick: () => { tab = id; if (id === 'wardrobe' && app.sceneName === 'creator') { app.setScene('fitting'); } render(); } }, l)));
    const y = bodyEl.scrollTop; bodyEl.replaceChildren(...[].concat(T[tab]())); bodyEl.scrollTop = y; syncToolbar();
  }

  // ---------- toolbar + dock
  const btn = (label, on, fn, title) => el('button', { class: on() ? 'on' : '', title, onclick: () => { fn(); syncToolbar(); } }, label);
  let toolbarSync = [];
  const group = (...items) => el('div', { class: 'grp' }, items);
  const stage = group(...[['creator', 'Creator'], ['fitting', 'Fitting room'], ['lagos', 'Lagos']].map(([id, l]) => { const b = btn(l, () => app.sceneName === id, () => app.setScene(id)); toolbarSync.push(() => b.classList.toggle('on', app.sceneName === id)); return b; }));
  const light = group(...Object.entries(PRESETS).map(([id, p]) => { const b = btn(p.label, () => app.lighting === id, () => app.setLighting(id)); toolbarSync.push(() => b.classList.toggle('on', app.lighting === id)); return b; }));
  const camSel = el('select', { onchange: e => { setCam(e.target.value); } }, CAMERA_MODES.map(m => el('option', { value: m }, 'Camera: ' + m)));
  const setCam = m => { if (m === 'mirror' && app.sceneName !== 'fitting') app.setScene('fitting'); app.camRig.setMode(m); const sel = m === 'selfie'; app.an.pose = sel ? 'selfie' : (app.an.pose === 'selfie' ? 'stand' : app.an.pose); app.setPhone?.(sel); app.letterbox = m === 'cinematic'; document.getElementById('letterbox').classList.toggle('hidden', m !== 'cinematic'); camSel.value = m; selfieBtn.classList.toggle('hidden', m !== 'selfie'); };
  const selfieBtn = el('button', { class: 'btn pri hidden', style: 'position:absolute;left:50%;bottom:90px;transform:translateX(-50%)', onclick: () => { app.renderer.render(app.activeScene(), app.camera); app.canvas.toBlob(b => { const a = el('a', { href: URL.createObjectURL(b), download: 'selfie.png' }); a.click(); say('📸 Selfie saved'); }); } }, '📸 Take selfie');
  const quick = group(el('button', { onclick: () => setCam('face') }, 'Face'), el('button', { onclick: () => setCam('full') }, 'Full body'), el('button', { onclick: () => setCam('front') }, 'Front'), el('button', { onclick: () => setCam('side') }, 'Side'), el('button', { onclick: () => setCam('back') }, 'Back'), camSel);
  const qual = group(...['high', 'medium', 'low'].map(q => { const b = btn(q === 'medium' ? 'Med' : q[0].toUpperCase() + q.slice(1), () => app.tier === q, () => { say('Quality: ' + q); setTimeout(() => app.applyQuality(q), 30); }); toolbarSync.push(() => b.classList.toggle('on', app.tier === q)); return b; }));
  const wx = group(btn('☔ Rain', () => app.weather.rain > 0, () => app.setWeather({ rain: app.weather.rain > 0 ? 0 : 1 })), btn('🌬 Wind', () => app.weather.wind > 0, () => app.setWeather({ wind: app.weather.wind > 0 ? 0 : 1 })));
  toolbarSync.push(() => { wx.children[0].classList.toggle('on', app.weather.rain > 0); wx.children[1].classList.toggle('on', app.weather.wind > 0); });
  const top = el('div', { class: 'top' }, stage, light, quick, qual, wx);
  const mv = (label, fn) => el('button', { onclick: fn }, label);
  const dock = el('div', { class: 'dock' },
    group(mv('Idle', () => { app.walkLoop = false; app.an.input.speed = 0; app.an.pose = 'stand'; }), mv('Walk', () => { app.walkLoop = true; app.walkSpeed = 1.35; }), mv('Run', () => { app.walkLoop = true; app.walkSpeed = 3.6; }), mv('Stop', () => { app.walkLoop = false; app.an.input.speed = 0; }), mv('👋 Wave', () => app.an.gestureWave()), mv('Hands on hips', () => { app.an.pose = app.an.pose === 'handsHips' ? 'stand' : 'handsHips'; })),
    group(...Object.keys(EXPRESSIONS).map(k => mv(k[0].toUpperCase() + k.slice(1), () => app.an.setExpression(k)))), group(mv('📱 Selfie', () => setCam('selfie')), mv('🪞 Mirror', () => setCam('mirror')), mv('🎬 Cinematic', () => setCam('cinematic')), mv('Third person', () => setCam('third'))));
  const stats = el('div', { class: 'stats' }), hint = el('div', { class: 'hint' }, 'Drag to rotate · wheel/pinch to zoom · double-click: face ↔ full · WASD to walk (Shift runs)');
  function syncToolbar() { toolbarSync.forEach(f => f()); }
  root.append(panel, top, dock, stats, hint, selfieBtn);
  app.listeners = [...(app.listeners || []), syncToolbar];
  setInterval(() => { const t = app.timing || {}; stats.textContent = `${app.fps.toFixed(0)} fps · ${app.tier} · ${app.renderer.info.render.triangles.toLocaleString()} tris · ${app.renderer.info.render.calls} calls\nlast build ${(app.lastApplyMs || 0).toFixed(0)} ms (body ${(t.body || 0).toFixed(0)} · face ${(t.face || 0).toFixed(0)} · hair ${(t.hair || 0).toFixed(0)} · cloth ${(t.clothing || 0).toFixed(0)})\n${store.state.name} · fp ${store.fingerprint()}`; stats.style.whiteSpace = 'pre'; const fp = document.getElementById('fp'); if (fp) fp.textContent = store.fingerprint(); }, 500);
  // phone prop for selfie
  let phone = null; app.setPhone = on => { if (!phone) { phone = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.15, 0.008), new THREE.MeshStandardMaterial({ color: '#0c0c10', roughness: 0.2, metalness: 0.6 })); phone.position.set(-0.02, -0.065, 0.04); phone.rotation.set(0.2, 0.0, 0.0); phone.castShadow = true; } if (on) app.ch.bones.handR.add(phone); else phone.parent?.remove(phone); };
  store.subscribe(() => { if (tab === 'looks' || tab === 'save') return; });
  render(); setCam('creator');
  // autosave (debounced)
  let sv; store.subscribe(() => { clearTimeout(sv); sv = setTimeout(() => store.save(), 1200); });
  return { render };
}
