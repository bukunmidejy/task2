// Parameter specs: the single source of truth for ranges. UI, clamping, validation and
// randomisation all read from here. Ranges are deliberately NATURAL - no cartoon extremes.
// face params are in [-1, 1] (0 = canonical average); body params have physical units where useful.

const DEF = { lipUpper: 0.25, lipLower: 0.35, mouthTilt: 0.6, browRidge: -0.45, cheekFull: -0.05, jawWidth: -0.3, jawLine: -0.1, noseWidth: -0.15, noseTip: -0.1, eyeSize: 0.25, cupid: 0.2, forehead: -0.1, chinWidth: -0.1, faceWidth: -0.25, browThick: -0.15, nostril: -0.1, earOut: -0.1 };
const f = (key, label, group, extra = {}) => ({ key, label, group, min: -1, max: 1, def: DEF[key] ?? 0, step: 0.01, ...extra });

export const FACE_PARAMS = [
  f('faceWidth', 'Face width', 'Shape'), f('faceLength', 'Face length', 'Shape'),
  f('forehead', 'Forehead height', 'Shape'), f('foreheadSlope', 'Forehead slope', 'Shape'),
  f('cheekFull', 'Cheek fullness', 'Cheeks & jaw'), f('cheekbone', 'Cheekbone prominence', 'Cheeks & jaw'),
  f('jawWidth', 'Jaw width', 'Cheeks & jaw'), f('jawLine', 'Jaw definition', 'Cheeks & jaw'),
  f('chinProj', 'Chin projection', 'Cheeks & jaw'), f('chinWidth', 'Chin width', 'Cheeks & jaw'),
  f('eyeSize', 'Eye size', 'Eyes'), f('eyeSpacing', 'Eye spacing', 'Eyes'), f('eyeHeight', 'Eye height', 'Eyes'),
  f('eyeTilt', 'Eye tilt', 'Eyes'), f('eyelid', 'Eyelid fullness', 'Eyes'), f('eyeDepth', 'Eye socket depth', 'Eyes'),
  f('browHeight', 'Brow height', 'Brows'), f('browArch', 'Brow arch', 'Brows'), f('browThick', 'Brow thickness', 'Brows'),
  f('browRidge', 'Brow ridge', 'Brows'),
  f('noseLength', 'Nose length', 'Nose'), f('noseBridge', 'Bridge height', 'Nose'), f('noseBridgeW', 'Bridge width', 'Nose'),
  f('noseWidth', 'Nose width', 'Nose'), f('noseTip', 'Tip projection', 'Nose'), f('noseTipRot', 'Tip rotation', 'Nose'),
  f('nostril', 'Nostril flare', 'Nose'),
  f('lipUpper', 'Upper lip fullness', 'Lips'), f('lipLower', 'Lower lip fullness', 'Lips'), f('lipWidth', 'Lip width', 'Lips'),
  f('cupid', "Cupid's bow", 'Lips'), f('mouthTilt', 'Mouth corner tilt', 'Lips'), f('mouthHeight', 'Mouth height', 'Lips'),
  f('earSize', 'Ear size', 'Ears'), f('earOut', 'Ear protrusion', 'Ears'), f('earLobe', 'Lobe length', 'Ears'),
];

const b = (key, label, min, max, def, extra = {}) => ({ key, label, group: 'Body', min, max, def, step: 0.01, ...extra });
export const BODY_PARAMS = [
  b('height', 'Height (cm)', 150, 196, 168, { step: 1, unit: 'cm' }),
  b('build', 'Overall build', -1, 1, 0.0), b('muscle', 'Muscle tone', 0, 1, 0.25),
  b('shoulders', 'Shoulders', -1, 1, 0), b('chest', 'Chest / bust', -1, 1, 0.0),
  b('waist', 'Waist', -1, 1, 0), b('hips', 'Hips', -1, 1, 0.1), b('glutes', 'Glutes', -1, 1, 0.1),
  b('legs', 'Legs fullness', -1, 1, 0), b('legLength', 'Leg length', -1, 1, 0), b('arms', 'Arms', -1, 1, 0),
  b('stomach', 'Stomach', -1, 1, 0), b('posture', 'Posture', -1, 1, 0.2),
];

export const faceDefaults = () => Object.fromEntries(FACE_PARAMS.map(p => [p.key, p.def]));
export const bodyDefaults = () => Object.fromEntries(BODY_PARAMS.map(p => [p.key, p.def]));

export const UNDERTONES = [
  { id: 'golden', label: 'Golden' }, { id: 'red', label: 'Red' }, { id: 'neutral', label: 'Neutral' },
  { id: 'cool', label: 'Cool' }, { id: 'blueblack', label: 'Blue-black' },
];

export const EYE_COLORS = [
  { id: 'darkbrown', label: 'Dark brown', hex: '#2a160c' }, { id: 'brown', label: 'Brown', hex: '#4a2a14' },
  { id: 'amber', label: 'Amber', hex: '#7a4a1c' }, { id: 'hazel', label: 'Hazel', hex: '#5d5326' },
  { id: 'grey', label: 'Grey', hex: '#5b6770' },
];

export const HAIR_COLORS = [
  { id: 'jet', label: 'Jet black', hex: '#0b0807' }, { id: 'black', label: 'Natural black', hex: '#17100c' },
  { id: 'darkbrown', label: 'Dark brown', hex: '#2b1810' }, { id: 'brown', label: 'Chestnut', hex: '#4a2a18' },
  { id: 'burgundy', label: 'Burgundy', hex: '#4a0f1c' }, { id: 'copper', label: 'Copper', hex: '#8a3d1a' },
  { id: 'honey', label: 'Honey blonde', hex: '#b57a3a' }, { id: 'blonde', label: 'Platinum', hex: '#d8c39a' },
  { id: 'ombre', label: 'Black → honey ombré', hex: '#17100c', tip: '#b57a3a' },
  { id: 'blue', label: 'Midnight blue', hex: '#101a38' },
];

export const HAIR_STYLES = [
  { id: 'none', label: 'Bald / shaved', family: 'none' },
  { id: 'knotless', label: 'Knotless braids', family: 'braids', crown: true },
  { id: 'box', label: 'Box braids', family: 'braids' },
  { id: 'cornrows', label: 'Cornrows', family: 'cornrow' },
  { id: 'fulani', label: 'Fulani braids', family: 'cornrow', crown: true },
  { id: 'locs', label: 'Locs', family: 'locs' },
  { id: 'afro', label: 'Natural afro', family: 'afro' },
  { id: 'twistout', label: 'Twist-out', family: 'afro' },
  { id: 'bantu', label: 'Bantu knots', family: 'bantu' },
  { id: 'silkpress', label: 'Silk press', family: 'flow' },
  { id: 'bob', label: 'Bob', family: 'flow' },
  { id: 'bonestraight', label: 'Bone straight', family: 'flow' },
  { id: 'curlywig', label: 'Curly wig', family: 'flow' },
  { id: 'closurewig', label: 'Closure wig', family: 'flow' },
  { id: 'frontalwig', label: 'Frontal wig', family: 'flow' },
  { id: 'shortcut', label: 'Short cut (TWA)', family: 'scalp' },
  { id: 'fade', label: 'Fade', family: 'scalp' },
  { id: 'lineup', label: 'Line-up', family: 'scalp' },
  { id: 'ponytail', label: 'Ponytail', family: 'flow' },
  { id: 'headwrap', label: 'Head wrap', family: 'wrap' },
];

export const MAKEUP_PRESETS = {
  bare:     { foundation: 0,   concealer: 0,   blush: 0,    contour: 0,    highlight: 0,    lip: 0,   gloss: 0,   liner: 0,   shadow: 0,   brows: 0.15, lashes: 0 },
  natural:  { foundation: 0.35, concealer: 0.3, blush: 0.25, contour: 0.1,  highlight: 0.2,  lip: 0.3, gloss: 0.2, liner: 0.1, shadow: 0.15, brows: 0.4, lashes: 0.2 },
  softglam: { foundation: 0.6, concealer: 0.5, blush: 0.5,  contour: 0.35, highlight: 0.5,  lip: 0.6, gloss: 0.4, liner: 0.35, shadow: 0.4, brows: 0.6, lashes: 0.5 },
  fullglam: { foundation: 0.85, concealer: 0.7, blush: 0.65, contour: 0.65, highlight: 0.75, lip: 0.85, gloss: 0.3, liner: 0.7, shadow: 0.7, brows: 0.8, lashes: 0.85 },
  night:    { foundation: 0.75, concealer: 0.6, blush: 0.35, contour: 0.6,  highlight: 0.8,  lip: 0.9, gloss: 0.6, liner: 0.9, shadow: 0.85, brows: 0.75, lashes: 0.9 },
  bridal:   { foundation: 0.7, concealer: 0.6, blush: 0.55, contour: 0.4,  highlight: 0.65, lip: 0.7, gloss: 0.5, liner: 0.5, shadow: 0.55, brows: 0.65, lashes: 0.7 },
};
export const MAKEUP_PALETTES = {
  bare:     { blush: '#a8584a', shadow: '#5a3828', lip: '#7a3b30' },
  natural:  { blush: '#b8584a', shadow: '#6a4030', lip: '#a05048' },
  softglam: { blush: '#c4605a', shadow: '#8a5238', lip: '#b04a52' },
  fullglam: { blush: '#c85060', shadow: '#7a3a46', lip: '#a02a3c' },
  night:    { blush: '#a84860', shadow: '#2a1a3a', lip: '#5a1230' },
  bridal:   { blush: '#c8706a', shadow: '#b08060', lip: '#b8584c' },
};

export const NAIL_TYPES = ['natural', 'gel', 'acrylic', 'presson'];
export const NAIL_SHAPES = ['round', 'square', 'almond', 'coffin', 'stiletto'];
export const NAIL_DESIGNS = ['solid', 'french', 'glitter', 'ombre', 'dots', 'chrome'];

export const OUTFIT_SLOTS = ['casual', 'corporate', 'church', 'date', 'nightlife', 'wedding', 'traditional', 'beach', 'gym', 'home'];
export const GARMENT_SLOTS = ['top', 'bottom', 'onePiece', 'outer', 'shoes', 'headwear'];

export const ACCESSORY_SLOTS = {
  earrings: ['none', 'studs', 'hoops', 'drops', 'statement'],
  necklace: ['none', 'chain', 'pendant', 'choker', 'beads', 'coral'],
  bracelet: ['none', 'bangle', 'chain', 'beaded', 'cuff'],
  ring: ['none', 'band', 'stone', 'stack'],
  watch: ['none', 'classic', 'sport', 'gold'],
  glasses: ['none', 'round', 'cateye', 'square', 'sun'],
  bag: ['none', 'clutch', 'tote', 'crossbody', 'backpack'],
  hairAccessory: ['none', 'beads', 'cuffs', 'clip', 'headband', 'scarf'],
  piercings: ['nose stud', 'nose ring', 'brow', 'lip', 'helix'],
};
export const METALS = { gold: '#d9a441', silver: '#cfd2d6', rosegold: '#d99a80', black: '#1b1b1d' };
