// usage: node tools/px.mjs img.png x y w h  -> mean sRGB of the rect + HSL-ish summary
import { PNG } from 'pngjs'; import fs from 'node:fs';
const [,, f, x0, y0, w, h] = process.argv; const png = PNG.sync.read(fs.readFileSync(f));
let r = 0, g = 0, b = 0, n = 0;
for (let y = +y0; y < +y0 + +h; y++) for (let x = +x0; x < +x0 + +w; x++) { const i = (png.width * y + x) * 4; r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2]; n++; }
r /= n; g /= n; b /= n; const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
console.log(`rgb(${r.toFixed(0)},${g.toFixed(0)},${b.toFixed(0)}) #${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')} sat=${((mx - mn) / (mx || 1)).toFixed(2)} lum=${(0.2126 * r + 0.7152 * g + 0.0722 * b).toFixed(0)}`);
