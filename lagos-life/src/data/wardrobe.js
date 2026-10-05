// Wardrobe catalog: PURE DATA. Garments are *recipes* that the clothing generator turns into
// meshes fitted to the player's own body (shrink-wrap from the body surface, same skin weights).
// Nothing here is an inventory icon - every item is rendered on the character.
//
// part types:
//   wrap  : { torso:{hem,neck,neckDepth,sleeve,sleeveFlare,strap,ease:{bust,waist,hip,arm},flare,frontOpen}, legs:{hem,ease,flare,rise} }
//   skirt : { waist:'waist'|'hip'|'under', hem, flare, ease, profile:'straight'|'aline'|'mermaid'|'ball' }
//   shoes : { kind, heel }          headwear: { kind }
// hems (high -> low): crop, waist, hip, thigh, midthigh, knee, calf, ankle, brief, short
// sleeve: -1 straps/strapless, 0 sleeveless, .25 short, .5 elbow, .75 three-quarter, 1 long

const C = (name, hex) => ({ name, hex });
const NEUTRALS = [C('Black', '#141416'), C('White', '#ece8e0'), C('Cream', '#d8c9aa'), C('Navy', '#1c2a4a'), C('Olive', '#4a4f2c'), C('Terracotta', '#a24a2e'), C('Burgundy', '#5a1426'), C('Emerald', '#0f5a44'), C('Royal blue', '#1f3f9a'), C('Mustard', '#c8941c'), C('Blush', '#d9a0a0')];
const BRIGHTS = [C('Gold', '#c89a2a'), C('Emerald', '#0f6a50'), C('Royal blue', '#1f3f9a'), C('Fuchsia', '#b0206a'), C('Coral', '#d9604a'), C('Ivory', '#e6dcc4'), C('Wine', '#5a1426'), C('Teal', '#0f6a72')];
const DENIM = [C('Indigo', '#26324f'), C('Light wash', '#6a86a8'), C('Black', '#161618')];

export const FABRICS = {
  jersey: { rough: 0.85, sheen: 0.2, weave: 0.35, scale: 90 }, cotton: { rough: 0.9, sheen: 0.1, weave: 0.6, scale: 70 },
  linen: { rough: 0.95, sheen: 0.05, weave: 0.9, scale: 45 }, satin: { rough: 0.32, sheen: 0.9, weave: 0.08, scale: 140 },
  denim: { rough: 0.85, sheen: 0.1, weave: 0.9, scale: 55 }, twill: { rough: 0.8, sheen: 0.15, weave: 0.7, scale: 60 },
  knit: { rough: 0.95, sheen: 0.3, weave: 1.0, scale: 30 }, leather: { rough: 0.45, sheen: 0.0, weave: 0.15, scale: 24 },
  lace: { rough: 0.8, sheen: 0.2, weave: 0.3, scale: 1, pattern: 'lace', alpha: true },
  ankara: { rough: 0.78, sheen: 0.15, weave: 0.55, scale: 1, pattern: 'ankara' },
  asooke: { rough: 0.7, sheen: 0.45, weave: 0.9, scale: 1, pattern: 'asooke' },
  brocade: { rough: 0.5, sheen: 0.6, weave: 0.4, scale: 1, pattern: 'brocade' },
  sequin: { rough: 0.3, sheen: 0.4, weave: 0.2, scale: 1, pattern: 'sequin', metal: 0.6 },
  rubber: { rough: 0.6, sheen: 0, weave: 0.1, scale: 40 },
};

// patterned fabrics expose design choices (pattern index)
export const PATTERN_VARIANTS = { ankara: 6, lace: 3, asooke: 4, brocade: 2, sequin: 1 };

const g = (id, name, slot, cats, price, fabric, parts, colors = NEUTRALS, extra = {}) =>
  ({ id, name, slot, cats, price, fabric, fabrics: extra.fabrics || [fabric], parts, colors, ...extra });

export const GARMENTS = [
  // ---- tops
  g('tee', 'Classic tee', 'top', ['casual', 'home', 'gym'], 8500, 'jersey', [{ type: 'wrap', torso: { hem: 'hip', neck: 'crew', sleeve: 0.25, ease: { bust: 0.012, waist: 0.02, hip: 0.025, arm: 0.015 } } }]),
  g('croptop', 'Crop top', 'top', ['casual', 'nightlife', 'beach'], 9500, 'jersey', [{ type: 'wrap', torso: { hem: 'crop', neck: 'scoop', neckDepth: 0.35, sleeve: 0, strap: 0.055, ease: { bust: 0.006, waist: 0.01, hip: 0.01, arm: 0.01 } } }]),
  g('tank', 'Fitted tank', 'top', ['casual', 'gym', 'home'], 7000, 'jersey', [{ type: 'wrap', torso: { hem: 'hip', neck: 'scoop', sleeve: 0, strap: 0.045, ease: { bust: 0.006, waist: 0.008, hip: 0.01, arm: 0.01 } } }]),
  g('sportsbra', 'Sports bra', 'top', ['gym', 'beach'], 12000, 'jersey', [{ type: 'wrap', torso: { hem: 'bra', neck: 'scoop', neckDepth: 0.4, sleeve: 0, strap: 0.04, ease: { bust: 0.004, waist: 0.004, hip: 0.004, arm: 0.004 } } }]),
  g('bikinitop', 'Bikini top', 'top', ['beach'], 11000, 'jersey', [{ type: 'wrap', torso: { hem: 'bra', neck: 'halter', neckDepth: 0.5, sleeve: -1, strap: 0.012, ease: { bust: 0.004, waist: 0.003, hip: 0.003, arm: 0.003 } } }], BRIGHTS),
  g('blouse', 'Silk blouse', 'top', ['corporate', 'church', 'date'], 24000, 'satin', [{ type: 'wrap', torso: { hem: 'hip', neck: 'v', neckDepth: 0.3, sleeve: 0.75, ease: { bust: 0.022, waist: 0.035, hip: 0.04, arm: 0.03 } } }], NEUTRALS),
  g('corset', 'Corset top', 'top', ['nightlife', 'date', 'wedding'], 32000, 'satin', [{ type: 'wrap', torso: { hem: 'waist', neck: 'sweetheart', sleeve: -1, ease: { bust: 0.004, waist: 0.003, hip: 0.004, arm: 0.004 } } }], BRIGHTS, { fabrics: ['satin', 'brocade', 'sequin'] }),
  g('buba', 'Buba', 'top', ['traditional', 'church', 'wedding'], 38000, 'lace', [{ type: 'wrap', torso: { hem: 'hip', neck: 'boat', neckDepth: 0.2, sleeve: 0.75, sleeveFlare: 0.04, ease: { bust: 0.03, waist: 0.045, hip: 0.05, arm: 0.04 } } }], BRIGHTS, { fabrics: ['lace', 'ankara', 'asooke', 'brocade'] }),
  g('senator', 'Senator top', 'top', ['traditional', 'corporate', 'church'], 42000, 'linen', [{ type: 'wrap', torso: { hem: 'thigh', neck: 'high', sleeve: 1, ease: { bust: 0.035, waist: 0.04, hip: 0.04, arm: 0.03 } } }], NEUTRALS, { fabrics: ['linen', 'cotton', 'brocade'] }),
  g('lounge', 'Lounge tee', 'top', ['home'], 6000, 'jersey', [{ type: 'wrap', torso: { hem: 'thigh', neck: 'crew', sleeve: 0.25, ease: { bust: 0.03, waist: 0.04, hip: 0.045, arm: 0.03 } } }]),
  // ---- outer
  g('blazer', 'Tailored blazer', 'outer', ['corporate', 'date', 'church'], 58000, 'twill', [{ type: 'wrap', torso: { hem: 'thigh', neck: 'v', neckDepth: 0.55, sleeve: 1, frontOpen: 0.04, ease: { bust: 0.026, waist: 0.03, hip: 0.034, arm: 0.016 } } }], NEUTRALS, { fabrics: ['twill', 'linen'] }),
  g('denimjacket', 'Denim jacket', 'outer', ['casual', 'nightlife'], 34000, 'denim', [{ type: 'wrap', torso: { hem: 'hip', neck: 'v', neckDepth: 0.5, sleeve: 1, frontOpen: 0.05, ease: { bust: 0.026, waist: 0.026, hip: 0.028, arm: 0.016 } } }], DENIM),
  g('agbada', 'Agbada', 'outer', ['traditional', 'wedding'], 95000, 'brocade', [
    { type: 'wrap', torso: { hem: 'hip', neck: 'boat', neckDepth: 0.3, sleeve: 1, sleeveFlare: 0.075, ease: { bust: 0.05, waist: 0.06, hip: 0.065, arm: 0.04 } } },
    { type: 'skirt', waist: 'hip', hem: 'ankle', flare: 0.1, ease: 0.07, profile: 'aline' }], BRIGHTS, { fabrics: ['brocade', 'asooke', 'cotton'] }),
  // ---- bottoms
  g('jeans', 'High-rise jeans', 'bottom', ['casual', 'nightlife', 'date'], 22000, 'denim', [{ type: 'wrap', legs: { hem: 'ankle', ease: 0.012, rise: 'waist' } }], DENIM),
  g('trousers', 'Tailored trousers', 'bottom', ['corporate', 'church'], 26000, 'twill', [{ type: 'wrap', legs: { hem: 'ankle', ease: 0.032, rise: 'waist' } }], NEUTRALS),
  g('leggings', 'Gym leggings', 'bottom', ['gym', 'home'], 14000, 'jersey', [{ type: 'wrap', legs: { hem: 'ankle', ease: 0.004, rise: 'waist' } }]),
  g('shorts', 'Shorts', 'bottom', ['gym', 'home', 'beach', 'casual'], 9000, 'cotton', [{ type: 'wrap', legs: { hem: 'midthigh', ease: 0.02, rise: 'hip' } }]),
  g('sokoto', 'Sokoto', 'bottom', ['traditional', 'church'], 30000, 'cotton', [{ type: 'wrap', legs: { hem: 'ankle', ease: 0.075, rise: 'waist' } }], NEUTRALS, { fabrics: ['cotton', 'linen', 'asooke', 'ankara'] }),
  g('bikinibottom', 'Bikini bottom', 'bottom', ['beach'], 9000, 'jersey', [{ type: 'wrap', legs: { hem: 'brief', ease: 0.003, rise: 'hip' } }], BRIGHTS),
  g('pencilskirt', 'Pencil skirt', 'bottom', ['corporate', 'church', 'date'], 21000, 'twill', [{ type: 'skirt', waist: 'waist', hem: 'knee', flare: 0.0, ease: 0.012, profile: 'straight' }], NEUTRALS),
  g('miniskirt', 'Mini skirt', 'bottom', ['nightlife', 'casual', 'date'], 15000, 'leather', [{ type: 'skirt', waist: 'hip', hem: 'thigh', flare: 0.02, ease: 0.012, profile: 'aline' }], NEUTRALS, { fabrics: ['leather', 'sequin', 'denim'] }),
  g('iro', 'Iro (wrapper)', 'bottom', ['traditional', 'church', 'wedding'], 36000, 'ankara', [{ type: 'skirt', waist: 'under', hem: 'ankle', flare: 0.03, ease: 0.03, profile: 'straight' }], BRIGHTS, { fabrics: ['ankara', 'asooke', 'lace', 'brocade'] }),
  g('sarong', 'Beach sarong', 'bottom', ['beach'], 12000, 'cotton', [{ type: 'skirt', waist: 'hip', hem: 'calf', flare: 0.06, ease: 0.02, profile: 'aline' }], BRIGHTS, { fabrics: ['cotton', 'ankara'] }),
  // ---- one piece
  g('bodycon', 'Bodycon dress', 'onePiece', ['nightlife', 'date'], 28000, 'jersey', [{ type: 'wrap', torso: { hem: 'midthigh', neck: 'square', neckDepth: 0.3, sleeve: -1, strap: 0.04, ease: { bust: 0.004, waist: 0.004, hip: 0.004, arm: 0.004 } } }], BRIGHTS, { fabrics: ['jersey', 'satin', 'sequin'] }),
  g('slipdress', 'Slip dress', 'onePiece', ['date', 'nightlife'], 30000, 'satin', [
    { type: 'wrap', torso: { hem: 'hip', neck: 'v', neckDepth: 0.6, sleeve: -1, strap: 0.015, ease: { bust: 0.008, waist: 0.012, hip: 0.015, arm: 0.01 } } },
    { type: 'skirt', waist: 'hip', hem: 'calf', flare: 0.05, ease: 0.02, profile: 'aline' }], BRIGHTS),
  g('churchdress', 'Church dress', 'onePiece', ['church', 'corporate'], 40000, 'twill', [
    { type: 'wrap', torso: { hem: 'waist', neck: 'boat', neckDepth: 0.15, sleeve: 0.5, ease: { bust: 0.014, waist: 0.012, hip: 0.015, arm: 0.02 } } },
    { type: 'skirt', waist: 'waist', hem: 'calf', flare: 0.12, ease: 0.025, profile: 'aline' }], NEUTRALS, { fabrics: ['twill', 'satin', 'lace'] }),
  g('mermaid', 'Aso-ebi mermaid gown', 'onePiece', ['wedding', 'nightlife', 'traditional'], 85000, 'lace', [
    { type: 'wrap', torso: { hem: 'knee', neck: 'sweetheart', sleeve: -1, ease: { bust: 0.004, waist: 0.003, hip: 0.004, arm: 0.004 } } },
    { type: 'skirt', waist: 'knee', hem: 'ankle', flare: 0.2, ease: 0.0, profile: 'mermaid' }], BRIGHTS, { fabrics: ['lace', 'satin', 'sequin', 'asooke'] }),
  g('weddinggown', 'Wedding gown', 'onePiece', ['wedding'], 180000, 'satin', [
    { type: 'wrap', torso: { hem: 'waist', neck: 'sweetheart', sleeve: -1, ease: { bust: 0.004, waist: 0.003, hip: 0.004, arm: 0.004 } } },
    { type: 'skirt', waist: 'waist', hem: 'ankle', flare: 0.42, ease: 0.04, profile: 'ball' }], [C('Ivory', '#e8e0cc'), C('White', '#f0eee8'), C('Champagne', '#d8c49a')], { fabrics: ['satin', 'lace'] }),
  g('kaftan', 'Kaftan', 'onePiece', ['casual', 'beach', 'home', 'traditional'], 26000, 'cotton', [
    { type: 'wrap', torso: { hem: 'hip', neck: 'v', neckDepth: 0.35, sleeve: 0.75, sleeveFlare: 0.1, ease: { bust: 0.05, waist: 0.07, hip: 0.08, arm: 0.05 } } },
    { type: 'skirt', waist: 'hip', hem: 'calf', flare: 0.14, ease: 0.07, profile: 'aline' }], BRIGHTS, { fabrics: ['cotton', 'ankara', 'linen', 'satin'] }),
  g('swimsuit', 'Swimsuit', 'onePiece', ['beach'], 18000, 'jersey', [{ type: 'wrap', torso: { hem: 'hip', neck: 'v', neckDepth: 0.55, sleeve: -1, strap: 0.03, ease: { bust: 0.004, waist: 0.003, hip: 0.003, arm: 0.003 } }, legs: { hem: 'brief', ease: 0.003, rise: 'hip' } }], BRIGHTS),
  // ---- shoes
  g('sneakers', 'Sneakers', 'shoes', ['casual', 'gym', 'home'], 28000, 'leather', [{ type: 'shoes', kind: 'sneaker', heel: 0.02 }], NEUTRALS),
  g('heels', 'Block heels', 'shoes', ['corporate', 'date', 'nightlife', 'church', 'wedding'], 34000, 'leather', [{ type: 'shoes', kind: 'heel', heel: 0.075 }], NEUTRALS),
  g('sandals', 'Flat sandals', 'shoes', ['beach', 'casual', 'traditional'], 12000, 'leather', [{ type: 'shoes', kind: 'sandal', heel: 0.012 }], NEUTRALS),
  g('loafers', 'Loafers', 'shoes', ['corporate', 'traditional', 'church'], 36000, 'leather', [{ type: 'shoes', kind: 'loafer', heel: 0.02 }], NEUTRALS),
  g('slides', 'Slides', 'shoes', ['home', 'beach'], 7000, 'rubber', [{ type: 'shoes', kind: 'slide', heel: 0.012 }], NEUTRALS),
  // ---- headwear
  g('gele', 'Gele', 'headwear', ['traditional', 'wedding', 'church'], 22000, 'asooke', [{ type: 'headwear', kind: 'gele' }], BRIGHTS, { fabrics: ['asooke', 'brocade', 'satin'] }),
  g('fila', 'Fila (aso-oke cap)', 'headwear', ['traditional', 'wedding'], 15000, 'asooke', [{ type: 'headwear', kind: 'fila' }], BRIGHTS, { fabrics: ['asooke', 'cotton'] }),
];

export const GARMENT_BY_ID = Object.fromEntries(GARMENTS.map(x => [x.id, x]));
export const CATEGORIES = ['casual', 'corporate', 'date', 'nightlife', 'church', 'traditional', 'wedding', 'beach', 'gym', 'home'];

// Ready-made looks per category (used for starter wardrobe + "quick looks").
const w = (item, color, fabric, variant = 0) => ({ item, color, fabric, variant });
export const STARTER_OUTFITS = {
  casual: { top: w('tee', '#ece8e0'), bottom: w('jeans', '#26324f'), shoes: w('sneakers', '#ece8e0') },
  corporate: { top: w('blouse', '#d8c9aa'), bottom: w('pencilskirt', '#141416'), outer: w('blazer', '#141416'), shoes: w('heels', '#141416') },
  church: { onePiece: w('churchdress', '#1c2a4a'), shoes: w('heels', '#141416') },
  date: { onePiece: w('slipdress', '#5a1426'), shoes: w('heels', '#d9a441') },
  nightlife: { top: w('corset', '#141416', 'satin'), bottom: w('miniskirt', '#141416', 'leather'), shoes: w('heels', '#141416') },
  wedding: { onePiece: w('weddinggown', '#e8e0cc'), headwear: w('gele', '#e6dcc4', 'brocade'), shoes: w('heels', '#e8e0cc') },
  traditional: { top: w('buba', '#0f6a50', 'lace', 1), bottom: w('iro', '#c89a2a', 'ankara', 2), headwear: w('gele', '#c89a2a', 'asooke', 1), shoes: w('sandals', '#c89a2a') },
  beach: { top: w('bikinitop', '#d9604a'), bottom: w('sarong', '#0f6a72', 'cotton'), shoes: w('slides', '#141416') },
  gym: { top: w('sportsbra', '#141416'), bottom: w('leggings', '#1c2a4a'), shoes: w('sneakers', '#141416') },
  home: { top: w('lounge', '#d8c9aa'), bottom: w('shorts', '#4a4f2c'), shoes: w('slides', '#141416') },
};

// Menswear-leaning quick looks (any body can wear any piece - these are just shortcuts)
export const QUICK_LOOKS = [
  { id: 'agbadaset', name: 'Agbada set', worn: { top: w('senator', '#e6dcc4', 'cotton'), bottom: w('sokoto', '#e6dcc4', 'cotton'), outer: w('agbada', '#1f3f9a', 'brocade', 1), headwear: w('fila', '#1f3f9a', 'asooke', 0), shoes: w('loafers', '#141416') } },
  { id: 'bubasokoto', name: 'Buba & sokoto', worn: { top: w('buba', '#a24a2e', 'ankara', 3), bottom: w('sokoto', '#a24a2e', 'ankara', 3), shoes: w('sandals', '#141416') } },
  { id: 'senatorset', name: 'Senator', worn: { top: w('senator', '#1c2a4a', 'linen'), bottom: w('trousers', '#1c2a4a'), shoes: w('loafers', '#141416') } },
  { id: 'irobuba', name: 'Iro & buba + gele', worn: { top: w('buba', '#b0206a', 'lace', 0), bottom: w('iro', '#d9a441', 'asooke', 2), headwear: w('gele', '#b0206a', 'asooke', 1), shoes: w('heels', '#d9a441') } },
  { id: 'ankaradress', name: 'Ankara kaftan', worn: { onePiece: w('kaftan', '#1f3f9a', 'ankara', 4), shoes: w('sandals', '#141416') } },
];
