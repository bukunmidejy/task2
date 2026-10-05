// usage: node tools/shot.mjs "<url-path>" out.png [w h] [waitFlag]
import { chromium } from 'playwright-core';
const [,, url, out, w = '900', h = '1200', flag = '__done'] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
p.on('console', m => { if (['error', 'warning'].includes(m.type())) console.log('[console.' + m.type() + ']', m.text().slice(0, 400)); });
p.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 600)));
await p.goto('http://localhost:5173' + url);
await p.waitForFunction(f => window[f], flag, { timeout: 60000 }).catch(e => console.log('timeout waiting', flag));
await p.waitForTimeout(500);
await p.screenshot({ path: out });
console.log('ms', await p.evaluate(() => window.__ms));
await b.close();
