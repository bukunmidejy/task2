import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter, serialize, deserialize, sanitize, fingerprint, randomCharacter, migrate } from '../src/core/schema.js';
import { FACE_PARAMS, BODY_PARAMS } from '../src/data/params.js';
import { GARMENTS } from '../src/data/wardrobe.js';

test('round-trip preserves appearance exactly', () => {
  const c = createCharacter({ seed: 42, skin: { depth: 0.9, undertone: 'blueblack' }, hair: { style: 'locs' } });
  const back = deserialize(serialize(c));
  assert.deepEqual(back, c);
  assert.equal(fingerprint(back), fingerprint(c));
});
test('face/body params are clamped into natural ranges', () => {
  const c = sanitize({ seed: 1, face: { noseWidth: 99, eyeSize: -50 }, body: { height: 400, hips: 9 } });
  assert.equal(c.face.noseWidth, 1); assert.equal(c.face.eyeSize, -1);
  assert.equal(c.body.height, 196); assert.equal(c.body.hips, 1);
});
test('junk input never throws and falls back to defaults', () => {
  const c = sanitize({ hair: { style: 'dragon' }, skin: { undertone: 'purple' }, clothing: { worn: { top: { item: 'nope' }, shoes: { item: 'tee' } } } });
  assert.equal(c.hair.style, 'knotless'); assert.equal(c.skin.undertone, 'golden');
  assert.deepEqual(c.clothing.worn, {});
});
test('one-piece replaces top and bottom', () => {
  const c = sanitize({ clothing: { worn: { onePiece: { item: 'slipdress' }, top: { item: 'tee' }, bottom: { item: 'jeans' } } } });
  assert.ok(c.clothing.worn.onePiece); assert.ok(!c.clothing.worn.top); assert.ok(!c.clothing.worn.bottom);
});
test('all 10 outfit slots exist and every starter outfit is valid', () => {
  const c = createCharacter({ seed: 3 });
  assert.equal(Object.keys(c.outfits).length, 10);
  for (const [slot, w] of Object.entries(c.outfits)) assert.ok(Object.keys(w).length > 0, `outfit ${slot} empty`);
});
test('saved outfit persists through serialisation', () => {
  const c = createCharacter({ seed: 3 });
  c.outfits.date = { top: { item: 'corset', color: '#5a1426', fabric: 'satin', variant: 0 } };
  const back = deserialize(serialize(c));
  assert.equal(back.outfits.date.top.item, 'corset');
});
test('random characters stay within natural ranges', () => {
  for (let i = 0; i < 50; i++) {
    const c = randomCharacter(i + 1);
    for (const p of FACE_PARAMS) assert.ok(c.face[p.key] >= p.min && c.face[p.key] <= p.max);
    for (const p of BODY_PARAMS) assert.ok(c.body[p.key] >= p.min && c.body[p.key] <= p.max);
  }
});
test('catalog covers the required Nigerian garments and categories', () => {
  const ids = new Set(GARMENTS.map(g => g.id));
  for (const id of ['agbada', 'buba', 'iro', 'senator', 'kaftan', 'gele', 'sokoto']) assert.ok(ids.has(id), id);
  const fabrics = new Set(GARMENTS.flatMap(g => g.fabrics));
  for (const f of ['ankara', 'asooke', 'lace']) assert.ok(fabrics.has(f), f);
  const cats = new Set(GARMENTS.flatMap(g => g.cats));
  for (const c of ['casual', 'corporate', 'date', 'nightlife', 'church', 'traditional', 'wedding', 'beach', 'gym', 'home']) assert.ok(cats.has(c), c);
});
test('v1 saves migrate', () => {
  const v1 = { schema: 'lagoslife.character', version: 1, seed: 5, skin: { tone: 0.8 } };
  assert.equal(deserialize(v1).skin.depth, 0.8);
});
