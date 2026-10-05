// Warm cinematic character-presentation set: arched window, wood floor, plants, art, string lights, rattan chair.
// A generic stylish interior - NOT the Lagos world. Used for hero shots and the creator backdrop.
import * as THREE from 'three';
import { mulberry32 } from '../core/rng.js';

const rng = mulberry32(88);
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, rep) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; };

function woodTex() {
  const c = cv(512, 512), g = c.getContext('2d'); g.fillStyle = '#8a5a38'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8; i++) { const y = i * 64, sh = 100 + rng() * 40; g.fillStyle = `rgb(${sh + 40},${sh - 10},${sh - 50})`; g.fillRect(0, y, 512, 62); for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(40,20,10,${0.05 + rng() * 0.12})`; g.lineWidth = 1; g.beginPath(); const yy = y + rng() * 62; g.moveTo(0, yy); g.bezierCurveTo(150, yy + (rng() - 0.5) * 6, 350, yy + (rng() - 0.5) * 6, 512, yy); g.stroke(); } g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y + 62, 512, 2); const jx = rng() * 512; g.fillRect(jx, y, 2, 62); }
  return tex(c, [3, 3]);
}
function wallTex() {
  const c = cv(512, 512), g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#8e5a40'); gr.addColorStop(1, '#6e402a'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(${rng() < 0.5 ? '255,235,210' : '70,30,15'},${rng() * 0.07})`; g.fillRect(rng() * 512, rng() * 512, 2 + rng() * 14, 2 + rng() * 6); }
  return tex(c, [2, 1]);
}
function windowTex(mode) {
  const c = cv(256, 512), g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 512);
  if (mode === 'night') { gr.addColorStop(0, '#0a1230'); gr.addColorStop(1, '#2a2a5a'); } else if (mode === 'indoor') { gr.addColorStop(0, '#e8a860'); gr.addColorStop(1, '#ffd9a0'); } else { gr.addColorStop(0, '#9fcdf0'); gr.addColorStop(1, '#fff2d8'); }
  g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
  g.fillStyle = mode === 'night' ? '#05080f' : '#2d5a2a'; for (let i = 0; i < 9; i++) { g.save(); g.translate(40 + rng() * 180, 420 + rng() * 80); g.rotate((rng() - 0.5) * 1.6); g.beginPath(); g.ellipse(0, -50, 10, 70 + rng() * 40, 0, 0, 7); g.fill(); g.restore(); }
  if (mode === 'night') for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,${200 + rng() * 55},150,${rng()})`; g.fillRect(rng() * 256, 300 + rng() * 200, 2, 2); }
  g.strokeStyle = '#2b1a10'; g.lineWidth = 6; g.beginPath(); g.moveTo(128, 0); g.lineTo(128, 512); g.moveTo(0, 220); g.lineTo(256, 220); g.stroke();
  return tex(c);
}
function artTex(v) {
  const c = cv(256, 320), g = c.getContext('2d'); const cols = [['#0f6a50', '#e0b35a', '#b0206a'], ['#1f3f9a', '#f2b705', '#d9604a']][v % 2]; g.fillStyle = cols[0]; g.fillRect(0, 0, 256, 320);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 4; x++) { const cx = x * 64 + 32 + (y % 2) * 32, cy = y * 64 + 32; [[26, cols[1]], [18, cols[2]], [9, '#f4efe2']].forEach(([r, col]) => { g.fillStyle = col; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); }); }
  return tex(c);
}
const std = o => new THREE.MeshStandardMaterial(o);
const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); o.castShadow = o.receiveShadow = true; return o; };

export class Showcase {
  constructor() {
    this.group = new THREE.Group(); this.group.name = 'Showcase'; this.glow = []; this.lamps = [];
    const G = this.group;
    const floorMat = std({ map: woodTex(), roughness: 0.5, metalness: 0 }); const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 14), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.z = -1; floor.receiveShadow = true; G.add(floor); this.floor = floor;
    const wallMat = std({ map: wallTex(), roughness: 0.95 }); const wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 6), wallMat); wall.position.set(0, 3, -3.6); wall.receiveShadow = true; G.add(wall);
    const side = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), wallMat); side.position.set(-7.5, 3, 0); side.rotation.y = Math.PI / 2; G.add(side);
    // arched window
    this.winMats = {}; for (const m of ['day', 'indoor', 'night']) this.winMats[m] = new THREE.MeshBasicMaterial({ map: windowTex(m), toneMapped: true, color: m === 'night' ? 0xffffff : 0x9a9a9a });
    this.win = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 3.1), this.winMats.day); this.win.position.set(-1.9, 2.0, -3.58); G.add(this.win);
    const arch = new THREE.Mesh(new THREE.CircleGeometry(0.85, 32, 0, Math.PI), this.winMats.day); arch.position.set(-1.9, 3.55, -3.58); G.add(arch); this.arch = arch;
    const trim = std({ color: '#2b1a10', roughness: 0.7 }); G.add(box(0.12, 3.1, 0.14, trim, -2.8, 0.45, -3.55), box(0.12, 3.1, 0.14, trim, -1.0, 0.45, -3.55));
    // sheer curtains
    const curt = std({ color: '#f1e3cf', roughness: 1, transparent: true, opacity: 0.55, side: THREE.DoubleSide }); for (const x of [-3.15, -0.65]) { const c = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 3.8, 6, 1), curt); const p = c.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 14) * 0.05); c.position.set(x, 2.1, -3.45); G.add(c); }
    // art frames
    for (let i = 0; i < 3; i++) { const f = box(0.62, 0.78, 0.04, std({ color: '#d9a441', metalness: 0.8, roughness: 0.4 }), 1.4 + i * 0.85, 1.55 + (i % 2) * 0.35, -3.56); G.add(f); const a = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.7), std({ map: artTex(i), roughness: 0.8 })); a.position.set(1.4 + i * 0.85, 1.55 + (i % 2) * 0.35 + 0.39, -3.53); G.add(a); }
    // shelf + plants
    G.add(box(1.8, 0.05, 0.28, trim, 2.1, 2.7, -3.45));
    const potM = std({ color: '#b5683c', roughness: 0.8 }), leafM = std({ color: '#2f6b2a', roughness: 0.7, side: THREE.DoubleSide });
    const plant = (x, z, s) => { const g = new THREE.Group(); g.position.set(x, 0, z); const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.17 * s, 0.34 * s, 16), potM); pot.position.y = 0.17 * s; pot.castShadow = true; g.add(pot); for (let i = 0; i < 14; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.2 * s, 10, 8).scale(0.35, 1.6, 0.12), leafM); const a = i / 14 * Math.PI * 2; l.position.set(Math.cos(a) * 0.12 * s, 0.75 * s + (i % 3) * 0.1 * s, Math.sin(a) * 0.12 * s); l.rotation.set(Math.sin(a) * 0.7, a, Math.cos(a) * 0.7); l.castShadow = true; g.add(l); } G.add(g); };
    plant(-4.3, -2.6, 1.5); plant(3.9, -2.8, 1.25); plant(2.4, -3.3, 0.35);
    // rattan chair + side table with lamp
    const rat = std({ color: '#b98a54', roughness: 0.85 }); const chair = new THREE.Group(); chair.position.set(3.0, 0, -1.6); chair.rotation.y = -0.5;
    chair.add(box(0.8, 0.12, 0.75, rat, 0, 0.42, 0)); chair.add(box(0.8, 0.9, 0.1, rat, 0, 0.5, -0.35)); const rb = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.1, 24, 1, false, 0, Math.PI), rat); rb.rotation.set(Math.PI / 2, 0, Math.PI); rb.position.set(0, 1.1, -0.36); chair.add(rb); for (const [x, z] of [[-0.35, 0.3], [0.35, 0.3], [-0.35, -0.3], [0.35, -0.3]]) chair.add(box(0.06, 0.42, 0.06, trim, x, 0, z)); G.add(chair);
    G.add(box(0.5, 0.55, 0.5, std({ color: '#3b2a1e', roughness: 0.6 }), -3.4, 0, -1.4));
    const shade = std({ color: '#ffe2b0', emissive: '#ffb860', emissiveIntensity: 0.15, roughness: 0.9 }); const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.3, 20), shade); lamp.position.set(-3.4, 0.7, -1.4); G.add(lamp); this.glow.push(shade);
    const lp = new THREE.PointLight(0xffb060, 0, 7, 1.7); lp.position.set(-3.4, 0.85, -1.2); G.add(lp); this.lamps.push(lp);
    // rug
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.9, 48), std({ color: '#6a3a28', roughness: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.set(0.2, 0.006, -0.2); rug.receiveShadow = true; G.add(rug);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.45, 1.55, 48), std({ color: '#e0b35a', roughness: 0.9 })); ring.rotation.x = -Math.PI / 2; ring.position.set(0.2, 0.008, -0.2); G.add(ring);
    // string lights across the back (bokeh sources)
    const stringM = std({ color: '#fff0c0', emissive: '#ffd27a', emissiveIntensity: 1.2 }); this.bulbs = [];
    for (let i = 0; i < 26; i++) { const t = i / 25, x = -5.5 + t * 11, y = 4.4 - Math.sin(t * Math.PI) * 0.55 - ((i % 2) * 0.12); const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), stringM); b.position.set(x, y, -3.4); G.add(b); }
    this.stringM = stringM; this.glow.push(stringM);
    this.setMode('day');
  }
  setMode(mode) {
    this.mode = mode; const w = this.winMats[mode]; this.win.material = w; this.arch.material = w;
    this.stringM.emissiveIntensity = mode === 'night' ? 4 : mode === 'indoor' ? 2.4 : 0.7; this.glow[0].emissiveIntensity = mode === 'day' ? 0.1 : 1.2;
    this.lamps.forEach(l => (l.intensity = mode === 'day' ? 0 : mode === 'indoor' ? 14 : 18));
  }
}
