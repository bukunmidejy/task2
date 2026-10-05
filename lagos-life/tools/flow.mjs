// Behavioural QA of the real app: save/reload identity, scene identity, wardrobe flow, quality tiers, perf.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 200)); });
await p.goto('http://localhost:5173/?quality=medium'); await p.waitForFunction(() => window.__app, null, { timeout: 90000 }); await p.waitForTimeout(2500);
const R = [], ok = (n, c, d = '') => { R.push([c ? 'PASS' : 'FAIL', n, d]); };
// 1 same character across scenes: geometry checksum of body+head must be identical in creator / lagos / fitting
const sig = () => p.evaluate(() => { const a = __app, g = a.ch.bodyMesh.geometry.attributes.position.array, h = a.ch.headMesh.geometry.attributes.position.array; let s = 0; for (let i = 0; i < g.length; i += 97) s += g[i] * (i % 7 + 1); for (let i = 0; i < h.length; i += 53) s += h[i] * (i % 5 + 1); return s.toFixed(6) + '|' + a.store.fingerprint(); });
const s0 = await sig(); for (const sc of ['lagos', 'fitting', 'creator']) { await p.evaluate(s => __app.setScene(s), sc); await p.waitForTimeout(500); }
ok('same character geometry+fingerprint across Creator/Lagos/Fitting', s0 === await sig(), s0);
// 2 save -> rebuild from storage -> identical
await p.evaluate(() => { __app.store.mutate(d => { d.skin.depth = 0.83; d.hair.style = 'bantu'; d.face.noseWidth = 0.4; d.makeup.preset = 'night'; d.nails.shape = 'coffin'; d.clothing.worn.top = { item: 'senator', color: '#1c2a4a', fabric: 'linen', variant: 0 }; }); __app.store.save(); }); await p.waitForTimeout(1500);
const before = await sig(); const after = await p.evaluate(() => { __app.store.loadSaved(); __app.makeCharacter(); return null; }).then(() => p.waitForTimeout(1500)).then(sig);
ok('save -> destroy -> rebuild reproduces same person', before === after, before + ' vs ' + after);
// 3 reload page restores
await p.reload(); await p.waitForFunction(() => window.__app, null, { timeout: 90000 }); await p.waitForTimeout(2500); const fpR = await p.evaluate(() => __app.store.fingerprint()); ok('page reload restores saved appearance', fpR === before.split('|')[1], fpR);
// 4 outfit slot persists
await p.evaluate(() => { __app.store.mutate(d => { d.outfits.date = { onePiece: { item: 'slipdress', color: '#5a1426', fabric: 'satin', variant: 0 } }; }); __app.store.save(); }); await p.reload(); await p.waitForFunction(() => window.__app); ok('saved outfit slot persists', await p.evaluate(() => __app.store.state.outfits.date.onePiece?.item === 'slipdress'));
await p.waitForTimeout(2000);
// 5 all hair styles and garments build without error + timings
const hs = await p.evaluate(async () => { const out = {}; for (const id of ['knotless', 'box', 'cornrows', 'fulani', 'locs', 'afro', 'twistout', 'bantu', 'silkpress', 'bob', 'bonestraight', 'curlywig', 'closurewig', 'frontalwig', 'shortcut', 'fade', 'lineup', 'ponytail', 'headwrap', 'none']) { __app.store.mutate(d => { d.hair.style = id; }); const t = __app.ch.timing?.hair; out[id] = { ms: Math.round(__app.ch.timing?.hair ?? -1), ribbons: __app.ch.hair.chains.length, scalp: !!__app.ch.hair.scalpMesh }; } return out; });
ok('all 20 hair styles build', Object.keys(hs).length === 20 && !errs.length, JSON.stringify(hs).slice(0, 300));
const gs = await p.evaluate(async () => { const fails = []; const defs = (await import('/src/data/wardrobe.js')).GARMENTS; for (const g of defs) { __app.store.mutate(d => { d.clothing.worn = { [g.slot]: { item: g.id, color: g.colors[0].hex, fabric: g.fabric, variant: 0 } }; }); const n = __app.ch.clothing.group.children.length + __app.ch.clothing.headItems.length; if (!n) fails.push(g.id); } return fails; });
ok('every catalog garment generates geometry on the current body', gs.length === 0, 'empty: ' + gs.join(','));
// 6 body extremes: clothing still generates, no NaN
const nan = await p.evaluate(() => { const res = []; for (const [h, b] of [[150, -1], [196, 1], [170, 0]]) { __app.store.mutate(d => { d.body.height = h; d.body.build = b; d.body.hips = b; d.clothing.worn = { top: { item: 'tee', color: '#fff', fabric: 'jersey', variant: 0 }, bottom: { item: 'jeans', color: '#26324f', fabric: 'denim', variant: 0 } }; }); const a = __app.ch.bodyMesh.geometry.attributes.position.array; let bad = 0; for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) bad++; res.push([h, b, bad, __app.ch.clothing.group.children.length]); } return res; });
ok('body extremes produce finite meshes + clothing', nan.every(r => r[2] === 0 && r[3] >= 2), JSON.stringify(nan));
// 7 walk: feet contact ground (min foot bone world y near ground), no NaN
const walk = await p.evaluate(async () => { const a = __app; a.walkLoop = true; a.walkSpeed = 1.35; let minY = 9, maxLift = 0, nan = false; for (let i = 0; i < 240; i++) { a.an.input.speed = 1.35; a.an.input.heading = 0; a.an.update(1 / 60); a.ch.root.updateMatrixWorld(true); for (const n of ['footL', 'footR']) { const y = new (a.ch.bones.root.position.constructor)().setFromMatrixPosition(a.ch.bones[n].matrixWorld).y; if (!Number.isFinite(y)) nan = true; if (i > 60) { minY = Math.min(minY, y); maxLift = Math.max(maxLift, y); } } } return { minAnkleY: minY.toFixed(3), maxAnkleY: maxLift.toFixed(3), nan }; });
ok('walk cycle: ankles stay above ground, lift during swing, no NaN', !walk.nan && +walk.minAnkleY > 0.04 && +walk.minAnkleY < 0.1 && +walk.maxAnkleY > 0.12, JSON.stringify(walk));
for (const t of ['high', 'medium', 'low']) { await p.evaluate(t => __app.applyQuality(t), t); await p.waitForTimeout(2500); const m = await p.evaluate(() => ({ tris: __app.renderer.info.render.triangles, calls: __app.renderer.info.render.calls, ms: Math.round(__app.lastApplyMs || 0) })); R.push(['INFO', 'quality ' + t, JSON.stringify(m)]); }
console.log(R.map(r => r.join(' | ')).join('\n')); console.log('page errors:', errs.length ? errs : 'none'); await b.close();
