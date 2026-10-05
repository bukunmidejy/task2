// QA: drive the REAL app through scenes/lighting/cameras and save screenshots + metrics.
import { chromium } from 'playwright-core'; import fs from 'node:fs';
const out = '.shots/qa'; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } }); const errs = [];
p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text().slice(0, 300)); }); p.on('pageerror', e => errs.push('PAGEERROR ' + e.message.slice(0, 400)));
await p.goto('http://localhost:5173/?quality=' + (process.env.Q || 'medium')); await p.waitForFunction(() => window.__app, null, { timeout: 90000 }); await p.waitForTimeout(3000);
const shot = async n => { await p.waitForTimeout(+(process.env.W || 1500)); await p.screenshot({ path: `${out}/${n}.png` }); console.log('shot', n); };
const run = f => p.evaluate(`(${f})()`);
const steps = JSON.parse(process.argv[2] || '[]');
for (const [name, code] of steps) { await run(code); await shot(name); }
console.log('errors:', errs.length ? errs : 'none'); await b.close();
