// A small, fictionalised LAGOS street: danfo, keke, shopfronts with hand-painted signs, compound wall + gate,
// bungalow with louvre windows & zinc roof, open drains, poles & wires, palms, bunting, billboard, street lamps.
// Not a city - a stage that answers "does my character belong in Lagos?".
import * as THREE from 'three';
import { mulberry32 } from '../core/rng.js';

const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, repeat = null, srgb = true) => { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); } return t; };
const rng = mulberry32(2024);

function asphaltTex() {
  const c = mkCanvas(512, 512), g = c.getContext('2d'); g.fillStyle = '#3b3b3d'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) { const v = 40 + rng() * 40; g.fillStyle = `rgba(${v},${v},${v + 2},0.5)`; g.fillRect(rng() * 512, rng() * 512, 1 + rng() * 2, 1 + rng() * 2); }
  g.strokeStyle = 'rgba(15,15,15,0.55)'; g.lineWidth = 2; for (let i = 0; i < 7; i++) { g.beginPath(); let x = rng() * 512, y = rng() * 512; g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (rng() - 0.5) * 70; y += (rng() - 0.3) * 60; g.lineTo(x, y); } g.stroke(); }
  g.fillStyle = 'rgba(70,60,50,0.3)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(rng() * 512, rng() * 512, 30 + rng() * 40, 18 + rng() * 25, rng() * 3, 0, 7); g.fill(); }
  return tex(c, [3, 12]);
}
function earthTex() {
  const c = mkCanvas(256, 256), g = c.getContext('2d'); g.fillStyle = '#9a5a36'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) { const v = rng(); g.fillStyle = v < 0.5 ? 'rgba(60,30,15,0.25)' : 'rgba(200,130,80,0.2)'; g.fillRect(rng() * 256, rng() * 256, 1 + rng() * 3, 1 + rng() * 3); }
  return tex(c, [2, 10]);
}
function wallTex(base, grimeTop = false) {
  const c = mkCanvas(256, 256), g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(0,0,0,${rng() * 0.07})`; g.fillRect(rng() * 256, rng() * 256, 2 + rng() * 6, 1 + rng() * 5); }
  const gr = g.createLinearGradient(0, 256, 0, 150); gr.addColorStop(0, 'rgba(60,40,25,0.5)'); gr.addColorStop(1, 'rgba(60,40,25,0)'); g.fillStyle = gr; g.fillRect(0, 150, 256, 106);
  if (grimeTop) { const g2 = g.createLinearGradient(0, 0, 0, 60); g2.addColorStop(0, 'rgba(40,30,20,0.35)'); g2.addColorStop(1, 'rgba(40,30,20,0)'); g.fillStyle = g2; g.fillRect(0, 0, 256, 60); }
  for (let y = 0; y < 256; y += 32) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, y, 256, 1.5); }
  return tex(c, [3, 1.2]);
}
function zincTex() { const c = mkCanvas(128, 128), g = c.getContext('2d'); g.fillStyle = '#8b5a45'; g.fillRect(0, 0, 128, 128); for (let x = 0; x < 128; x += 8) { const gr = g.createLinearGradient(x, 0, x + 8, 0); gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0.18)'); g.fillStyle = gr; g.fillRect(x, 0, 8, 128); } for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(120,50,20,${rng() * 0.3})`; g.fillRect(rng() * 128, rng() * 128, 2, 5); } return tex(c, [4, 3]); }
function signTex(lines, bg, fg, accent) {
  const c = mkCanvas(768, 256), g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, 768, 256); g.strokeStyle = accent; g.lineWidth = 10; g.strokeRect(8, 8, 752, 240);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => { g.font = `bold ${i ? 40 : 76}px Impact, 'Arial Black', sans-serif`; g.fillText(l, 384, lines.length === 1 ? 128 : 78 + i * 90, 720); });
  for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(0,0,0,${rng() * 0.08})`; g.fillRect(rng() * 768, rng() * 256, 3, 2); }
  return tex(c);
}
function frondTex() { const c = mkCanvas(64, 256), g = c.getContext('2d'); g.strokeStyle = '#3b7a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(32, 0); g.lineTo(32, 256); g.stroke(); for (let y = 6; y < 256; y += 6) { const l = 28 * (1 - Math.abs(y - 100) / 200); g.strokeStyle = y % 12 ? '#4a9a34' : '#2f6b22'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(32, y); g.lineTo(32 - l, y + 12); g.moveTo(32, y); g.lineTo(32 + l, y + 12); g.stroke(); } return tex(c); }

const std = (o) => new THREE.MeshStandardMaterial(o);
const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; return m; };

export class LagosWorld {
  constructor(quality = 'high') {
    this.group = new THREE.Group(); this.group.name = 'Lagos'; this.quality = quality; this.t = 0; this.sway = []; this.vehicles = []; this.glow = []; this.lamps = []; this.rain = 0; this.wetMats = [];
    this.build();
  }
  build() {
    const q = this.quality, G = this.group, hi = q === 'high', mid = q !== 'low';
    // ---------------- ground
    const roadMat = std({ map: asphaltTex(), roughness: 0.92 }), earthMat = std({ map: earthTex(), roughness: 1 });
    this.wetMats.push(roadMat, earthMat);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 90), roadMat); road.rotation.x = -Math.PI / 2; road.position.set(0, 0, 10); road.receiveShadow = true; G.add(road);
    for (const sg of [-1, 1]) { const e = new THREE.Mesh(new THREE.PlaneGeometry(14, 90), earthMat); e.rotation.x = -Math.PI / 2; e.position.set(sg * (3.6 + 7), -0.005, 10); e.receiveShadow = true; G.add(e); }
    // dashed centre line
    const line = std({ color: '#d9d4b8', roughness: 0.9 }); for (let z = -30; z < 50; z += 4) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 1.6), line); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.004, z); G.add(m); }
    // open drains with concrete slabs
    const conc = std({ color: '#9a9690', roughness: 0.95 }), drainDark = std({ color: '#2b2a25', roughness: 0.6 });
    for (const sg of [-1, 1]) { G.add(box(0.9, 0.04, 90, drainDark, sg * 3.95, -0.03, 10)); for (let z = -30; z < 50; z += 2.2) G.add(box(0.9, 0.06, 1.0, conc, sg * 3.95, 0.0, z + (sg > 0 ? 0 : 0.6))); G.add(box(0.12, 0.2, 90, conc, sg * 3.55, 0, 10)); }
    // ---------------- compound (left)
    const wallM = std({ map: wallTex('#e8dcc0'), roughness: 0.95 }), band = std({ color: '#1f7a46', roughness: 0.8 }), spike = std({ color: '#222', roughness: 0.5, metalness: 0.6 });
    this.compoundWall(G, wallM, band, spike);
    this.bungalow(G);
    // ---------------- shops (right)
    this.shops(G, mid);
    // ---------------- vehicles
    this.danfo(G, 5.4 * 0 + 2.2, 0, 12.5, Math.PI / 2 * 0); this.keke(G, -2.0, 0, 6.5, Math.PI); if (mid) this.sedan(G, 1.8, 0, -9, 0);
    // ---------------- poles, wires, bunting, lamps, billboard, trees
    this.poles(G, hi); this.bunting(G); this.billboard(G); this.lamp(G, -4.6, 3.0); this.lamp(G, 4.6, 14);
    this.trees(G, mid);
    this.addons = G;
  }
  compoundWall(G, wallM, band, spike) {
    const x = -6.2; G.add(box(0.25, 2.1, 14, wallM, x, 0, -9)); G.add(box(0.27, 0.22, 14, band, x, 2.1, -9)); G.add(box(0.25, 2.1, 12, wallM, x, 0, 14)); G.add(box(0.27, 0.22, 12, band, x, 2.1, 14));
    for (let z = -16; z < -2; z += 0.5) G.add(box(0.04, 0.16, 0.04, spike, x, 2.32, z)); for (let z = 8; z < 20; z += 0.5) G.add(box(0.04, 0.16, 0.04, spike, x, 2.32, z));
    // gate z -2..8 (blue metal)
    const gate = std({ color: '#1f4aa8', roughness: 0.5, metalness: 0.5 }); for (const z0 of [-1.8, 3.1]) { G.add(box(0.08, 2.0, 4.6, gate, x + 0.02, 0, z0 + 2.3)); for (let k = 0; k < 8; k++) G.add(box(0.1, 1.9, 0.08, gate, x + 0.06, 0.05, z0 + 0.3 + k * 0.58)); }
    G.add(box(0.45, 2.6, 0.45, wallM, x, 0, -2.1)); G.add(box(0.45, 2.6, 0.45, wallM, x, 0, 8.1));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.4), std({ map: signTex(['BEWARE OF DOG', 'Private Property'], '#f4f0e2', '#b00020', '#b00020'), roughness: 0.7 })); sign.position.set(x + 0.17, 1.6, 3.1); sign.rotation.y = Math.PI / 2; G.add(sign);
    // bougainvillea over the wall
    const bg = std({ color: '#c2185b', roughness: 0.9 }); for (let i = 0; i < 26; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22 + rng() * 0.2, 0), i % 3 ? bg : std({ color: '#2e7d32', roughness: 0.9 })); s.position.set(x + 0.25, 1.9 + rng() * 0.5, -14 + rng() * 11); s.castShadow = true; G.add(s); }
  }
  bungalow(G) {
    const m = std({ map: wallTex('#d9b98a', true), roughness: 0.95 }), roof = std({ map: zincTex(), roughness: 0.6, metalness: 0.3 }), win = std({ color: '#1a2b3f', roughness: 0.3, metalness: 0.5 });
    const g = new THREE.Group(); g.position.set(-11.5, 0, 3);
    g.add(box(6.5, 3.2, 8.5, m, 0, 0, 0)); const r = new THREE.Mesh(new THREE.ConeGeometry(6.2, 1.9, 4), roof); r.rotation.y = Math.PI / 4; r.position.y = 3.2 + 0.95; r.scale.set(1, 1, 1.28); r.castShadow = true; g.add(r);
    g.add(box(0.1, 2.1, 1.1, std({ color: '#5a3a22', roughness: 0.6 }), 3.28, 0, 0.8));
    for (const z of [-2.6, 2.4]) { g.add(box(0.1, 1.2, 1.5, win, 3.28, 1.0, z)); for (let k = 0; k < 7; k++) g.add(box(0.14, 0.05, 1.5, std({ color: '#7fa0c0', roughness: 0.3, metalness: 0.6 }), 3.3, 1.12 + k * 0.15, z)); }
    g.add(box(0.5, 0.45, 0.9, std({ color: '#e8e8e8', roughness: 0.6 }), 3.45, 1.9, -2.6)); // AC
    g.add(box(0.8, 0.7, 0.6, std({ color: '#b02a20', roughness: 0.6 }), 3.6, 0, -3.6)); // generator
    // water tank on stand
    g.add(box(0.2, 1.8, 0.2, std({ color: '#555' }), 1.2, 0, -3.2)); const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.0, 20), std({ color: '#1565c0', roughness: 0.5 })); tank.position.set(1.2, 2.3, -3.2); tank.castShadow = true; g.add(tank);
    G.add(g);
  }
  shops(G, mid) {
    const defs = [['MAMA TOLU', 'Provisions • Cold Drinks', '#1e7a3c', '#fff6c8', '#ffd54f'], ['GOLDEN FABRICS', 'Ankara • Lace • Aso-Oke', '#6a1b3a', '#ffe6a8', '#e0b35a'], ['QUICK POS', 'Airtime • Transfers • Charging', '#e8a31c', '#1a1a1a', '#b71c1c'], ['BUKKA JOINT', 'Amala • Ewedu • Gbegiri', '#c0392b', '#fff6c8', '#ffd54f'], ['TOP-UP HAIR', 'Braiding • Wigs • Beauty', '#1b6f7a', '#ffffff', '#ffd54f']];
    const n = mid ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const [t1, t2, bg, fg, ac] = defs[i], z = -8 + i * 4.8, wall = std({ map: wallTex(bg, true), roughness: 0.95 }), g = new THREE.Group(); g.position.set(7.4, 0, z);
      g.add(box(3.6, 3.0, 4.4, wall, 0.6, 0, 0)); const front = std({ color: '#0e0c0a', roughness: 1 }); g.add(box(0.05, 2.0, 3.2, front, -1.18, 0.1, 0)); // dark opening
      g.add(box(0.5, 0.9, 3.4, std({ color: '#6b4a2f', roughness: 0.8 }), -1.5, 0, 0)); // counter
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.0), std({ map: signTex([t1, t2], bg, fg, ac), roughness: 0.7 })); sg.position.set(-1.27, 2.5, 0); sg.rotation.y = -Math.PI / 2; g.add(sg);
      const aw = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 3.6), std({ color: i % 2 ? '#2e7d32' : '#f5f5f5', roughness: 0.9 })); aw.position.set(-1.9, 2.15, 0); aw.rotation.z = 0.28; aw.castShadow = true; g.add(aw);
      // goods: crates & stacked bottles
      for (let k = 0; k < 5; k++) g.add(box(0.4, 0.3, 0.4, std({ color: ['#c62828', '#1565c0', '#f9a825', '#2e7d32'][k % 4], roughness: 0.7 }), -2.15, 0, -1.4 + k * 0.7));
      // plastic chairs + table
      for (const c of [-0.6, 0.6]) { g.add(box(0.42, 0.04, 0.42, std({ color: '#b71c1c', roughness: 0.5 }), -3.0, 0.42, c)); g.add(box(0.42, 0.4, 0.04, std({ color: '#b71c1c', roughness: 0.5 }), -3.0 - 0.2, 0.46, c)); for (const dx of [-0.17, 0.17]) for (const dz of [-0.17, 0.17]) g.add(box(0.03, 0.4, 0.03, std({ color: '#9e9e9e' }), -3.0 + dx, 0, c + dz)); }
      const lightM = std({ color: '#fff3c0', emissive: '#ffd27a', emissiveIntensity: 0.03 }); const lt = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.2), lightM); lt.position.set(-1.15, 2.1, 0); g.add(lt); this.glow.push(lightM);
      G.add(g);
    }
    // umbrella stall
    const um = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.5, 12), std({ color: '#e53935', roughness: 0.8, side: THREE.DoubleSide })); um.position.set(5.2, 2.2, -11.5); um.castShadow = true; G.add(um); G.add(box(0.05, 2.2, 0.05, std({ color: '#444' }), 5.2, 0, -11.5));
  }
  wheel(r = 0.33) { const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.22, 20), std({ color: '#151515', roughness: 0.9 })); w.rotation.z = Math.PI / 2; w.castShadow = true; return w; }
  danfo(G, x, y, z, ry) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; const yel = std({ color: '#f2b705', roughness: 0.45, metalness: 0.25 }), blk = std({ color: '#111', roughness: 0.6 }), glass = std({ color: '#22333f', roughness: 0.15, metalness: 0.6 });
    g.add(box(1.9, 1.05, 4.4, yel, 0, 0.45, 0)); g.add(box(1.88, 0.95, 3.6, yel, 0, 1.45, -0.35)); g.add(box(1.92, 0.22, 4.42, blk, 0, 0.95, 0)); // black band
    for (const sx of [-1, 1]) { g.add(box(0.03, 0.6, 3.2, glass, sx * 0.95, 1.6, -0.35)); }
    g.add(box(1.6, 0.6, 0.03, glass, 0, 1.6, 1.46)); g.add(box(1.5, 0.05, 3.0, std({ color: '#555', metalness: 0.5, roughness: 0.5 }), 0, 2.42, -0.35));
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.15), std({ map: signTex(['LAGOS'], '#f4f0e2', '#111', '#111'), roughness: 0.6 })); plate.position.set(0, 0.55, 2.21); g.add(plate);
    for (const [wx, wz] of [[-0.9, 1.4], [0.9, 1.4], [-0.9, -1.4], [0.9, -1.4]]) { const w = this.wheel(0.38); w.position.set(wx, 0.38, wz); g.add(w); }
    G.add(g); this.vehicles.push({ g, speed: 0 });
  }
  keke(G, x, y, z, ry) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; const yel = std({ color: '#f2b705', roughness: 0.5, metalness: 0.2 }), grn = std({ color: '#1f7a46', roughness: 0.5 });
    g.add(box(1.2, 0.8, 1.6, yel, 0, 0.35, -0.2)); g.add(box(1.25, 0.1, 1.9, grn, 0, 1.55, -0.1)); g.add(box(1.0, 0.7, 0.05, std({ color: '#22333f', roughness: 0.2 }), 0, 0.85, 0.65));
    for (const sx of [-1, 1]) g.add(box(0.04, 1.2, 0.04, grn, sx * 0.58, 0.4, -0.95)); const f = this.wheel(0.26); f.position.set(0, 0.26, 0.85); g.add(f); for (const sx of [-1, 1]) { const w = this.wheel(0.26); w.position.set(sx * 0.62, 0.26, -0.7); g.add(w); }
    G.add(g);
  }
  sedan(G, x, y, z, ry) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; const paint = std({ color: '#c9ccd1', roughness: 0.3, metalness: 0.7 }), glass = std({ color: '#1b2630', roughness: 0.1, metalness: 0.8 });
    g.add(box(1.8, 0.55, 4.4, paint, 0, 0.35, 0)); g.add(box(1.6, 0.5, 2.3, glass, 0, 0.9, -0.1)); g.add(box(1.55, 0.04, 1.9, paint, 0, 1.4, -0.1));
    for (const [wx, wz] of [[-0.85, 1.4], [0.85, 1.4], [-0.85, -1.4], [0.85, -1.4]]) { const w = this.wheel(0.33); w.position.set(wx, 0.33, wz); g.add(w); }
    G.add(g); this.vehicles.push({ g, speed: 3.2, dir: 1, z0: -30, z1: 38 });
  }
  poles(G, hi) {
    const pm = std({ color: '#7a6a58', roughness: 0.95 }); const pts = [];
    for (let z = -22; z <= 40; z += 14) { G.add(box(0.22, 8.2, 0.22, pm, -4.7, 0, z)); G.add(box(2.4, 0.12, 0.12, pm, -4.7, 7.5, z)); pts.push(z); }
    if (hi) for (const dx of [-0.9, 0, 0.9]) for (let i = 0; i < pts.length - 1; i++) { const a = new THREE.Vector3(-4.7 + dx, 7.5, pts[i]), b = new THREE.Vector3(-4.7 + dx, 7.5, pts[i + 1]), m = a.clone().lerp(b, 0.5); m.y -= 0.7; const curve = new THREE.QuadraticBezierCurve3(a, m, b); G.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.012, 4), std({ color: '#111' }))); }
  }
  bunting(G) {
    const a = new THREE.Vector3(-4.6, 6.2, -6), b = new THREE.Vector3(4.6, 6.4, -6), curve = new THREE.QuadraticBezierCurve3(a, new THREE.Vector3(0, 5.3, -6), b);
    G.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.01, 4), std({ color: '#222' })));
    for (let i = 1; i < 28; i++) { const p = curve.getPoint(i / 28), tri = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.34, 3), std({ color: i % 2 ? '#0b8a3d' : '#f5f5f5', roughness: 0.8, side: THREE.DoubleSide })); tri.position.copy(p).add(new THREE.Vector3(0, -0.17, 0)); tri.rotation.set(Math.PI, 0, 0); tri.rotation.y = Math.PI / 2; G.add(tri); this.sway.push({ o: tri, a: 0.12, ph: i }); }
  }
  billboard(G) {
    const pole = box(0.3, 7, 0.3, std({ color: '#555', metalness: 0.5, roughness: 0.6 }), 5.2, 0, -20); G.add(pole);
    const c = mkCanvas(1024, 512), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 1024, 512); gr.addColorStop(0, '#0b8a3d'); gr.addColorStop(1, '#f7c948'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
    g.fillStyle = '#fff'; g.font = 'bold 120px Impact, sans-serif'; g.textAlign = 'left'; g.fillText('NAIJA GLOW', 60, 200); g.font = '56px Arial'; g.fillText('Beauty you own. Style you earn.', 60, 290); g.fillStyle = '#111'; g.font = 'bold 44px Arial'; g.fillText('• Lagos • Abuja • Port Harcourt', 60, 440);
    const bb = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), std({ map: tex(c), roughness: 0.6, emissive: '#ffffff', emissiveMap: tex(c), emissiveIntensity: 0.04 })); bb.position.set(5.2, 7.4, -19.8); this.glow.push(bb.material); G.add(bb);
  }
  lamp(G, x, z) {
    const m = std({ color: '#444', metalness: 0.6, roughness: 0.5 }); G.add(box(0.12, 6.5, 0.12, m, x, 0, z)); const arm = box(1.2, 0.08, 0.08, m, x + 0.5 * Math.sign(-x), 6.4, z); G.add(arm);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), std({ color: '#ffb347', emissive: '#ffb347', emissiveIntensity: 0.1 })); head.position.set(x + 1.0 * Math.sign(-x), 6.35, z); G.add(head); this.glow.push(head.material);
    const pl = new THREE.PointLight(0xffb347, 90, 18, 1.6); pl.position.copy(head.position); pl.visible = false; G.add(pl); this.lamps.push(pl);
  }
  trees(G, mid) {
    const frond = std({ map: frondTex(), alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.8 }), trunk = std({ color: '#6b5a45', roughness: 1 });
    const palm = (x, z, h) => { const g = new THREE.Group(); g.position.set(x, 0, z); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, h, 8), trunk); t.position.y = h / 2; t.rotation.z = 0.05; t.castShadow = true; g.add(t);
      const top = new THREE.Group(); top.position.set(0.1, h, 0); for (let i = 0; i < 11; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 3.2, 1, 6), frond); const p = f.geometry.attributes.position; for (let k = 0; k < p.count; k++) { const y = p.getY(k); p.setZ(k, -0.0 + 0.0); p.setY(k, y + 1.6); const bend = Math.pow(Math.max(0, y + 1.6) / 3.2, 2) * -0.9; p.setZ(k, bend); } f.geometry.computeVertexNormals(); const a = (i / 11) * Math.PI * 2; const pivot = new THREE.Group(); pivot.rotation.set(0, a, 0); f.rotation.x = -1.2 + 0.2 * (i % 3) * 0.3; f.rotation.set(-1.15, 0, 0); f.castShadow = true; pivot.add(f); top.add(pivot); } g.add(top); this.sway.push({ o: top, a: 0.03, ph: x + z, rot: true }); G.add(g); };
    palm(-5.6, -12, 8); palm(-5.7, 11, 9); if (mid) { palm(6.3, 18, 7.5); palm(-5.5, 24, 8.5); palm(6.4, -17, 8); }
    // mango tree (cluster)
    const leaf = std({ color: '#2f6b2a', roughness: 0.9 }); const m = new THREE.Group(); m.position.set(-5.9, 0, 18); m.add(box(0.4, 3, 0.4, trunk, 0, 0, 0)); for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3 + rng() * 0.8, 1), leaf); s.position.set((rng() - 0.5) * 2.6, 3.4 + rng() * 1.6, (rng() - 0.5) * 2.6); s.castShadow = true; m.add(s); } G.add(m);
  }
  setMode(mode) { const night = mode === 'night'; this.glow.forEach(m => { m.emissiveIntensity = night ? 2.4 : 0.03; }); this.lamps.forEach(l => (l.visible = night)); this.group.traverse(o => { if (o.isMesh && o.material.emissiveIntensity > 1 && !night) o.material.emissiveIntensity = 0.03; }); }
  setRain(a) { this.rain = a; for (const m of this.wetMats) { m.roughness = 0.92 - 0.6 * a; m.color.setScalar(1 - 0.35 * a); } }
  update(dt, wind = 0) {
    this.t += dt; for (const s of this.sway) { const k = Math.sin(this.t * 1.4 + s.ph) * s.a * (0.6 + wind * 1.2); if (s.rot) { s.o.rotation.z = k; s.o.rotation.x = k * 0.6; } else s.o.rotation.z = k; }
    for (const v of this.vehicles) if (v.speed) { v.g.position.z += v.speed * dt * v.dir; if (v.g.position.z > v.z1) v.g.position.z = v.z0; }
  }
}

// Rain: streaks that fall in a box around the camera target
export class Rain {
  constructor(count = 2600) {
    this.n = count; const pos = new Float32Array(count * 6); this.pos = pos; this.vel = new Float32Array(count); for (let i = 0; i < count; i++) this.vel[i] = 11 + Math.random() * 5;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); this.mesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#cfe0ff', transparent: true, opacity: 0.0, depthWrite: false })); this.mesh.frustumCulled = false; this.mesh.visible = false; this.center = new THREE.Vector3(); this.amount = 0;
    for (let i = 0; i < count; i++) this.spawn(i, true);
  }
  spawn(i, init) { const x = this.center.x + (Math.random() - 0.5) * 12, z = this.center.z + (Math.random() - 0.5) * 12, y = init ? Math.random() * 9 : 9 + Math.random() * 2; this.pos.set([x, y, z, x - 0.02, y + 0.35, z - 0.01], i * 6); }
  set(a) { this.amount = a; this.mesh.visible = a > 0.01; this.mesh.material.opacity = 0.35 * a; this.mesh.geometry.setDrawRange(0, Math.round(this.n * a) * 2); }
  update(dt, c) { if (!this.mesh.visible) return; this.center.copy(c); for (let i = 0; i < this.n * this.amount; i++) { const k = i * 6; this.pos[k + 1] -= this.vel[i] * dt; this.pos[k + 4] -= this.vel[i] * dt; if (this.pos[k + 1] < 0 || Math.abs(this.pos[k] - this.center.x) > 6.5 || Math.abs(this.pos[k + 2] - this.center.z) > 6.5) this.spawn(i, false); } this.mesh.geometry.attributes.position.needsUpdate = true; }
}
