import { computeRig } from '/home/user/task2/lagos-life/src/character/rig.js';
import { buildBody } from '/home/user/task2/lagos-life/src/character/body.js';
import { bodyDefaults } from '/home/user/task2/lagos-life/src/data/params.js';
const bp = bodyDefaults(); const rig = computeRig(bp);
for (const h of [0.016, 0.011, 0.008]) { const t=performance.now(); const g = buildBody(rig, bp, null, h); console.log(h, 'verts', g.position.length/3, 'tris', g.index.length/3, 'ms', (performance.now()-t).toFixed(0)); }
