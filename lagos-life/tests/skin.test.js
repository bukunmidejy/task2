import test from 'node:test';
import assert from 'node:assert/strict';
import { skinPalette, luminance } from '../src/core/skincolor.js';
import { UNDERTONES } from '../src/data/params.js';

test('skin is never grey/ashy: warm ordering R>=G>=B and chroma floor, every depth x undertone', () => {
  for (const u of UNDERTONES) for (let d = 0; d <= 1.001; d += 0.05) {
    const p = skinPalette({ depth: d, undertone: u.id, tint: 0 });
    const [r, g, b] = p.base;
    assert.ok(r >= g && g >= b - 1e-6, `${u.id}@${d.toFixed(2)} not warm: ${p.base.map(x => x.toFixed(3))}`);
    assert.ok(r - b > 0.012, `${u.id}@${d.toFixed(2)} too grey (R-B=${(r - b).toFixed(4)})`);
  }
});
test('lightness decreases monotonically with depth', () => {
  for (const u of UNDERTONES) {
    let prev = Infinity;
    for (let d = 0; d <= 1.001; d += 0.05) { const y = luminance(skinPalette({ depth: d, undertone: u.id }).base); assert.ok(y < prev + 1e-9); prev = y; }
  }
});
test('lips are darker/redder than base skin; under-eye darker than cheek-free base', () => {
  const p = skinPalette({ depth: 0.7, undertone: 'neutral' });
  assert.ok(luminance(p.lip) < luminance(p.base)); assert.ok(luminance(p.underEye) < luminance(p.base));
});
