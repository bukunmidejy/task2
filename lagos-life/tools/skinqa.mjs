// Automated skin QA: 6 tones x 3 lighting states, face close-up, sample both cheeks. Fails if skin goes grey/ashy/black.
import { chromium } from 'playwright-core'; import { PNG } from 'pngjs'; import fs from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errs = [];
p.on('pageerror', e => errs.push(e.message)); await p.goto('http://localhost:5173/?quality=medium'); await p.waitForFunction(() => window.__app, null, { timeout: 90000 }); await p.waitForTimeout(2500);
const tones = [[0.06, 'golden'], [0.3, 'red'], [0.5, 'neutral'], [0.72, 'cool'], [0.9, 'neutral'], [1.0, 'blueblack']]; const lights = (process.env.ONLY || 'day,indoor,night').split(','); const rows = []; fs.mkdirSync('.shots/skin', { recursive: true });
await p.evaluate(() => { __app.store.mutate(d => { d.hair.style = 'shortcut'; d.makeup.preset = 'bare'; }); });
for (const L of lights) for (const [depth, ut] of tones) {
  await p.evaluate(([L, depth, ut]) => { __app.setLighting(L); __app.store.mutate(d => { d.skin.depth = depth; d.skin.undertone = ut; }); __app.camRig.setMode('face'); __app.camRig.snap(__app.an); }, [L, depth, ut]);
  await p.waitForTimeout(1200); const f = `.shots/skin/${L}_${depth}_${ut}.png`; await p.screenshot({ path: f });
  const png = PNG.sync.read(fs.readFileSync(f)); const W = png.width, H = png.height; let best = null;
  const sample = (x0, y0, w, h) => { let r = 0, g = 0, bl = 0, n = 0; for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const i = (W * y + x) * 4; r += png.data[i]; g += png.data[i + 1]; bl += png.data[i + 2]; n++; } return [r / n, g / n, bl / n]; };
  const cx = W / 2 + 192, cy = H / 2, k = H / (2 * 0.78 * Math.tan(11 * Math.PI / 180)); const A = sample(Math.round(cx - 0.036 * k - 20), Math.round(cy + 0.05 * k - 20), 40, 40), B = sample(Math.round(cx + 0.036 * k - 20), Math.round(cy + 0.05 * k - 20), 40, 40);
  const m = [0, 1, 2].map(i => (A[i] + B[i]) / 2), lum = 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2], warm = (m[0] - m[2]) / Math.max(m[0], 1);
  rows.push({ L, depth, ut, rgb: m.map(v => v.toFixed(0)).join(','), lum: lum.toFixed(0), warm: warm.toFixed(2), ok: lum > 28 && warm > 0.12 && warm < 0.74 && m[0] >= m[1] && m[1] >= m[2] });
}
console.table(rows); console.log(rows.every(r => r.ok) ? 'SKIN QA PASS' : 'SKIN QA FAIL: ' + rows.filter(r => !r.ok).map(r => `${r.L}/${r.depth}/${r.ut}`).join(', ')); if (errs.length) console.log('errors', errs); await b.close();
