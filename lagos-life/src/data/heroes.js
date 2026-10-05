// Three hero characters for the Phase 1 visual test. Each is a full canonical state - same schema as the player.
import { createCharacter, defaultMakeup } from '../core/schema.js';

const W = (item, color, fabric, variant = 0) => ({ item, color, fabric, variant });
export const HEROES = {
  amara: () => createCharacter({
    seed: 4101, name: 'Amara',
    skin: { depth: 0.9, undertone: 'red', blemish: 0.1, oil: 0.3, freckles: 0 }, eyes: { color: 'darkbrown' },
    face: { faceWidth: -0.35, faceLength: 0.2, forehead: 0.1, cheekFull: -0.1, cheekbone: 0.7, jawWidth: -0.45, jawLine: 0.1, chinProj: 0.1, chinWidth: -0.4,
      eyeSize: 0.55, eyeSpacing: 0.05, eyeTilt: 0.4, eyelid: -0.2, browArch: 0.5, browThick: -0.2, noseWidth: 0.2, noseBridge: -0.15, noseTip: 0.1, noseTipRot: 0.3, lipUpper: 0.5, lipLower: 0.65, lipWidth: 0.05, cupid: 0.6, mouthTilt: 0.7, earSize: -0.2 },
    body: { height: 173, build: -0.2, muscle: 0.2, shoulders: -0.15, chest: 0.25, waist: -0.35, hips: 0.5, glutes: 0.5, legs: 0.1, legLength: 0.35, arms: -0.2, stomach: -0.3, posture: 0.7 },
    hair: { style: 'knotless', color: 'black', length: 0.85, volume: 0.4, edges: 0.7, highlight: 0.08 }, makeup: defaultMakeup('softglam'),
    nails: { type: 'gel', length: 0.45, shape: 'almond', color: '#8a1c3a', design: 'solid', designColor: '#f0e6d8' },
    accessories: { earrings: { id: 'hoops', metal: 'gold' }, necklace: { id: 'pendant', metal: 'gold' }, bracelet: { id: 'bangle', metal: 'gold' }, ring: { id: 'none' }, watch: { id: 'none' } },
    clothing: { worn: { top: W('croptop', '#c89a2a', 'ankara', 2), bottom: W('trousers', '#d8c9aa', 'twill'), shoes: W('heels', '#141416', 'leather') } },
    outfits: { date: { onePiece: W('slipdress', '#0f5a44', 'satin') } },
  }),
  tolu: () => createCharacter({
    seed: 7202, name: 'Tolu',
    skin: { depth: 0.42, undertone: 'golden', blemish: 0.15, oil: 0.35, freckles: 0.15 }, eyes: { color: 'brown' },
    face: { faceWidth: 0.25, faceLength: -0.25, forehead: -0.15, cheekFull: 0.55, cheekbone: 0.2, jawWidth: 0.0, jawLine: -0.2, chinProj: -0.1, chinWidth: 0.1,
      eyeSize: 0.4, eyeSpacing: 0.3, eyeTilt: -0.1, eyelid: 0.2, browArch: -0.1, browThick: 0.35, noseWidth: -0.3, noseBridge: 0.1, noseTip: 0.35, noseTipRot: 0.1, lipUpper: 0.15, lipLower: 0.45, lipWidth: -0.15, cupid: 0.2, mouthTilt: 0.8, earOut: 0.2 },
    body: { height: 163, build: 0.3, muscle: 0.15, shoulders: -0.3, chest: 0.5, waist: -0.4, hips: 0.7, glutes: 0.65, legs: 0.35, legLength: -0.1, arms: 0.1, stomach: 0.0, posture: 0.5 },
    hair: { style: 'bonestraight', color: 'jet', length: 0.8, volume: 0.5, edges: 0.8, highlight: 0.0 }, makeup: defaultMakeup('fullglam'),
    nails: { type: 'acrylic', length: 0.5, shape: 'coffin', color: '#d9a441', design: 'french', designColor: '#f0e6d8' },
    accessories: { earrings: { id: 'drops', metal: 'gold' }, necklace: { id: 'chain', metal: 'gold' }, ring: { id: 'stone', metal: 'gold' } },
    clothing: { worn: { onePiece: W('slipdress', '#5a1426', 'satin'), shoes: W('heels', '#d9a441', 'leather') } },
  }),
  chidi: () => createCharacter({
    seed: 9303, name: 'Chidi',
    skin: { depth: 0.86, undertone: 'neutral', blemish: 0.25, oil: 0.4 }, eyes: { color: 'darkbrown' },
    face: { faceWidth: 0.5, faceLength: 0.3, forehead: 0.15, cheekFull: -0.3, cheekbone: 0.3, jawWidth: 0.65, jawLine: 0.8, chinProj: 0.45, chinWidth: 0.55,
      eyeSize: -0.1, eyeSpacing: -0.1, eyeTilt: -0.25, eyelid: 0.3, eyeDepth: 0.4, browRidge: 0.55, browArch: -0.2, browThick: 0.6, noseWidth: 0.5, noseBridge: 0.4, noseTip: 0.1, nostril: 0.3, lipUpper: 0.05, lipLower: 0.3, lipWidth: 0.3, cupid: -0.1, mouthTilt: 0.15, earSize: 0.25 },
    body: { height: 186, build: 0.0, muscle: 0.45, shoulders: 0.4, chest: -0.6, waist: -0.1, hips: -0.7, glutes: -0.45, legs: 0.2, legLength: 0.1, arms: 0.2, stomach: -0.1, posture: 0.6 },
    hair: { style: 'fade', color: 'jet', length: 0.25, volume: 0.3, edges: 0.3 }, makeup: defaultMakeup('bare'),
    nails: { type: 'natural', length: 0.1, shape: 'square', color: '#c8a090' },
    accessories: { earrings: { id: 'studs', metal: 'silver' }, watch: { id: 'classic', metal: 'gold' }, glasses: { id: 'none' } },
    clothing: { worn: { top: W('tee', '#ece8e0', 'jersey'), outer: W('blazer', '#1c2a4a', 'twill'), bottom: W('trousers', '#2b2a28', 'twill'), shoes: W('loafers', '#3a2416', 'leather') } },
  }),
};
