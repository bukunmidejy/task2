// Promo renders: each hero x 3 lights x 3 shots, clean (no UI). usage: node tools/hero.mjs [heroes] [lights] [shots]
import { chromium } from 'playwright-core'; import fs from 'node:fs';
const heroes = (process.argv[2] || 'amara,tolu,chidi').split(','), lights = (process.argv[3] || 'day,indoor,night').split(','), shots = (process.argv[4] || 'hero').split(',');
const W = +(process.env.W_ || 1100), H = +(process.env.H_ || 1400); fs.mkdirSync('.shots/hero', { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: W, height: H } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 200)); });
await p.goto('http://localhost:5173/?clean=1&quality=' + (process.env.Q || 'high')); await p.waitForFunction(() => window.__app, null, { timeout: 90000 }); await p.waitForTimeout(2500);
for (const h of heroes) for (const l of lights) for (const s of shots) {
  await p.evaluate(([h, l, s]) => { __app.showHero(h, { lighting: l, shot: s }); __app.camRig.snap(__app.an); }, [h, l, s]); await p.waitForTimeout(+(process.env.WAIT || 4500));
  await p.evaluate(() => { __app.camRig.snap(__app.an); }); await p.waitForTimeout(1200); await p.screenshot({ path: `.shots/hero/${h}_${l}_${s}.png` }); console.log('shot', h, l, s);
}
console.log('errors:', errs.length ? errs : 'none'); await b.close();
