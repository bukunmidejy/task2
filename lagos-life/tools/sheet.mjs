// node tools/sheet.mjs out.png '<json array of overrides>' [view] [extra query]
import { execFileSync } from 'node:child_process';
const [,, out, json, view = 'head', extra = ''] = process.argv;
const n = JSON.parse(json).length;
execFileSync('node', ['tools/shot.mjs', `/dev-sheet.html?view=${view}&s=${encodeURIComponent(json)}${extra}`, out, String(view === 'full' ? 330 * n : 360 * n), String(view === 'full' ? 900 : 520), '__done'], { stdio: 'inherit', timeout: 170000 });
