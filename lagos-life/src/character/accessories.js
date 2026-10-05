// Accessories - procedural jewellery/eyewear/bags attached to the right bones, positioned from the sculpted anatomy.
import * as THREE from 'three';
import { METALS } from '../data/params.js';
import { FINGERS } from './rig.js';

const metalMat = k => new THREE.MeshStandardMaterial({ color: METALS[k] || METALS.gold, metalness: 1, roughness: k === 'black' ? 0.35 : 0.22 });
const gemMat = new THREE.MeshPhysicalMaterial({ color: '#e8f0ff', roughness: 0.02, metalness: 0, transmission: 0.0, clearcoat: 1, ior: 2.2, specularIntensity: 1 });
const beadMat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35 });
const V = (...a) => new THREE.Vector3(...a);

export function buildAccessories(ch) {
  const s = ch.state.accessories, rig = ch.rig, J = rig.J, L = rig.L, f = ch.faceA || ch.state.face, out = [], H = ch.headGroup;
  const add = (parent, mesh) => { parent.add(mesh); mesh.castShadow = true; out.push(mesh); return mesh; };
  const tube = (pts, r, mat, closed = false, seg = 64) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), seg, r, 6, closed), mat);
  // ---- earrings (+ lobe anchor in ear-group space)
  const sz = 1 + 0.13 * f.earSize, lobe = 1 + 0.45 * f.earLobe, lobeY = -0.0305 * sz * lobe * 0.9 + 0.0034 * lobe, lobeZ = 0.002 * sz - 0.012;
  const e = s.earrings;
  if (e.id !== 'none') for (const grp of ch.ears || []) {
    const M = metalMat(e.metal), g = new THREE.Group(); g.position.set(0.0132, lobeY - 0.003, lobeZ); grp.add(g); out.push(g);
    if (e.id === 'studs') { g.add(new THREE.Mesh(new THREE.SphereGeometry(0.0032, 16, 12), gemMat)); const bk = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.0012, 14).rotateZ(Math.PI / 2), M); bk.position.x = -0.0016; g.add(bk); }
    if (e.id === 'hoops') { const t = new THREE.Mesh(new THREE.TorusGeometry(0.0155, 0.0013, 10, 40), M); t.rotation.y = Math.PI / 2; t.position.set(0.0, -0.0145, 0); g.add(t); }
    if (e.id === 'drops') { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.0006, 0.0006, 0.026, 6), M); st.position.y = -0.013; const dr = new THREE.Mesh(new THREE.SphereGeometry(0.0058, 16, 12).scale(1, 1.5, 1), gemMat); dr.position.y = -0.03; g.add(st, dr); }
    if (e.id === 'statement') { for (let i = 0; i < 4; i++) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.016 - i * 0.0025, 0.016 - i * 0.0025, 0.0012, 22).rotateZ(Math.PI / 2), i % 2 ? M : beadMat('#c0392b')); d.position.set(0.0012 * i, -0.014 - i * 0.012, 0); g.add(d); } }
  }
  // ---- necklace (chest/neck bone, in rest coords relative to that joint)
  const n = s.necklace;
  if (n.id !== 'none') {
    const M = metalMat(n.metal), nb = L.neckBaseY, bone = n.id === 'choker' ? ch.bones.neck : ch.bones.chest, jb = n.id === 'choker' ? J.neck : J.chest;
    const ring = (r0x, r0z, y0, drop, N = 36) => Array.from({ length: N }, (_, i) => { const a = i / N * Math.PI * 2, fr = Math.max(0, Math.cos(a)), y = y0 - drop * Math.pow(fr, 1.5); return V(Math.sin(a) * r0x, y, -0.012 + Math.cos(a) * r0z); });
    const toLocal = p => p.sub(V(...jb));
    const place = (pts, r, mat) => { const m = tube(pts.map(p => toLocal(p.clone())), r, mat, true, 90); add(bone, m); return m; };
    if (n.id === 'chain') place(ring(0.064, 0.074, nb + 0.012, 0.07), 0.0013, M);
    if (n.id === 'pendant') { const pts = ring(0.064, 0.074, nb + 0.012, 0.06); place(pts, 0.0012, M); const front = pts.reduce((a, p) => (p.z > a.z ? p : a), pts[0]).clone(); const g = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 20, 14).scale(1, 1.25, 0.7), gemMat); g.position.copy(toLocal(front.add(V(0, -0.012, 0.004)))); add(bone, g); }
    if (n.id === 'choker') place(ring(0.0535, 0.0555, nb + 0.014, 0.012, 40), 0.0028, M);
    if (n.id === 'beads' || n.id === 'coral') {
      const strands = n.id === 'coral' ? 3 : 1, col = n.id === 'coral' ? '#d8462c' : '#c89a2a', rb = n.id === 'coral' ? 0.0058 : 0.0042;
      for (let k = 0; k < strands; k++) { const pts = ring(0.066 + 0.006 * k, 0.078 + 0.008 * k, nb + 0.0 - 0.004 * k, 0.07 + 0.04 * k), curve = new THREE.CatmullRomCurve3(pts, true);
        const N = 62 + k * 8, inst = new THREE.InstancedMesh(new THREE.SphereGeometry(rb, 12, 9), beadMat(col), N), m4 = new THREE.Matrix4();
        for (let i = 0; i < N; i++) { const p = curve.getPointAt(i / N).sub(V(...jb)); m4.makeTranslation(p.x, p.y, p.z); inst.setMatrixAt(i, m4); } inst.castShadow = true; add(bone, inst); }
    }
  }
  // ---- bracelet / watch (left wrist) , ring (left ring finger)
  const wristPos = sd => { const w = V(...J[`hand${sd}`]), el = V(...J[`foreArm${sd}`]), d = w.clone().sub(el).normalize(); return { p: w.clone().addScaledVector(d, -0.032), d }; };
  const orient = (obj, d) => obj.quaternion.setFromUnitVectors(V(0, 0, 1), d);
  const br = s.bracelet;
  if (br.id !== 'none') for (const sd of ['R']) { const { p, d } = wristPos(sd), M = metalMat(br.metal), base = ch.bones[`foreArm${sd}`], loc = p.sub(V(...J[`foreArm${sd}`]));
    const mk = (r, t, m) => { const o = new THREE.Mesh(new THREE.TorusGeometry(r, t, 10, 40), m); orient(o, d); o.position.copy(loc); add(base, o); return o; };
    if (br.id === 'bangle') { mk(0.0305, 0.0022, M); mk(0.0305, 0.0022, M).position.addScaledVector(d, -0.007); }
    if (br.id === 'chain') mk(0.0292, 0.0009, M);
    if (br.id === 'cuff') { const o = new THREE.Mesh(new THREE.CylinderGeometry(0.0305, 0.0305, 0.018, 36, 1, true), M); o.material.side = THREE.DoubleSide; orient(o, d); o.rotateX(Math.PI / 2); o.position.copy(loc); add(base, o); }
    if (br.id === 'beaded') for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, o = new THREE.Mesh(new THREE.SphereGeometry(0.0033, 10, 8), beadMat(i % 3 ? '#c0392b' : '#c89a2a')), q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), d), v = V(Math.cos(a) * 0.0305, Math.sin(a) * 0.0305, 0).applyQuaternion(q); o.position.copy(loc).add(v); add(base, o); }
  }
  const wt = s.watch;
  if (wt.id !== 'none') { const { p, d } = wristPos('L'), base = ch.bones.foreArmL, loc = p.sub(V(...J.foreArmL)), M = wt.id === 'gold' ? metalMat('gold') : wt.id === 'classic' ? new THREE.MeshStandardMaterial({ color: '#4a2e1c', roughness: 0.6 }) : new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.5 });
    const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.0299, 0.0299, 0.016, 40, 1, true), M); strap.material.side = THREE.DoubleSide; orient(strap, d); strap.rotateX(Math.PI / 2); strap.position.copy(loc); add(base, strap);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(wt.id === 'sport' ? 0.0185 : 0.0155, wt.id === 'sport' ? 0.0185 : 0.0155, 0.008, 28), wt.id === 'gold' || wt.id === 'classic' ? metalMat(wt.id === 'gold' ? 'gold' : 'silver') : M);
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.0135, 0.0086, 28), new THREE.MeshStandardMaterial({ color: wt.id === 'classic' ? '#f2efe6' : '#101820', roughness: 0.3 }));
    const outward = V(1, 0, 0), g = new THREE.Group(); g.add(face, dial); g.quaternion.setFromUnitVectors(V(0, 1, 0), outward); g.position.copy(loc).addScaledVector(outward, 0.0335); add(base, g);
  }
  const rg = s.ring;
  if (rg.id !== 'none') { const F = rig.hands.L.fingers.ring, a = V(...F.joints[0]), b = V(...F.joints[1]), mid = a.clone().lerp(b, 0.5), d = b.clone().sub(a).normalize(), base = ch.bones.ring1L, loc = mid.sub(V(...J.ring1L)), M = metalMat(rg.metal);
    const bands = rg.id === 'stack' ? 3 : 1; for (let i = 0; i < bands; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(F.radius * 1.0 + 0.0008, rg.id === 'stack' ? 0.0009 : 0.0016, 8, 28), M); t.quaternion.setFromUnitVectors(V(0, 0, 1), d); t.position.copy(loc).addScaledVector(d, (i - (bands - 1) / 2) * 0.004); add(base, t); }
    if (rg.id === 'stone') { const g = new THREE.Mesh(new THREE.OctahedronGeometry(0.0042), gemMat), outwardDir = V(1, 0, 0); g.position.copy(loc).addScaledVector(outwardDir, F.radius + 0.0042); add(base, g); }
  }
  // ---- glasses (head space)
  const gl = s.glasses;
  if (gl.id !== 'none') {
    const col = new THREE.MeshStandardMaterial({ color: gl.color, roughness: 0.35, metalness: 0.1 }), dark = gl.id === 'sun', lens = new THREE.MeshPhysicalMaterial({ color: dark ? '#0a0a0c' : '#dfe8ee', transparent: true, opacity: dark ? 0.82 : 0.14, roughness: 0.05, side: THREE.DoubleSide });
    const lay = ch.headData.layout, z = 0.1005;
    for (let i = 0; i < 2; i++) {
      const ex = lay.eye[i][0], ey = lay.eye[i][1] - 0.001, sg = i ? 1 : -1; const grp = new THREE.Group(); grp.position.set(ex, ey, z);
      let shape; const w = 0.0245, h = gl.id === 'cateye' ? 0.0195 : gl.id === 'square' ? 0.0195 : 0.0235;
      if (gl.id === 'round') shape = new THREE.Shape().absarc(0, 0, w, 0, Math.PI * 2);
      else { shape = new THREE.Shape(); const rr = gl.id === 'cateye' ? 0.006 : 0.007; shape.moveTo(-w + rr, -h); shape.lineTo(w - rr, -h); shape.quadraticCurveTo(w, -h, w, -h + rr); shape.lineTo(w, h - rr + (gl.id === 'cateye' ? 0.004 : 0)); shape.quadraticCurveTo(w, h + (gl.id === 'cateye' ? 0.004 : 0), w - rr, h + (gl.id === 'cateye' ? 0.004 : 0)); shape.lineTo(-w + rr, h); shape.quadraticCurveTo(-w, h, -w, h - rr); shape.lineTo(-w, -h + rr); shape.quadraticCurveTo(-w, -h, -w + rr, -h); }
      const hole = new THREE.Path(); const scale = 0.9; shape.getPoints(24).forEach((p, k) => (k ? hole.lineTo(p.x * scale, p.y * scale) : hole.moveTo(p.x * scale, p.y * scale)));
      const fr = new THREE.Shape(shape.getPoints(32)); fr.holes.push(hole);
      const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(fr, { depth: 0.0022, bevelEnabled: false }), col), ln = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(shape.getPoints(32).map(p => new THREE.Vector2(p.x * 0.92, p.y * 0.92)))), lens);
      rim.castShadow = true; grp.add(rim, ln);
      const temple = tube([V(sg * w, 0.004, 0.001), V(sg * (w + 0.01), 0.004, -0.02), V(sg * (w + 0.012), 0.002, -0.07), V(sg * (w + 0.004), -0.008, -0.1)].map(p => p.clone().add(V(sg * (Math.abs(ex) - Math.abs(ex)), 0, 0))), 0.0011, col); grp.add(temple);
      H.add(grp); out.push(grp);
    }
    const bridge = tube([V(-0.009, 0.049, z + 0.002), V(0, 0.053, z + 0.0035), V(0.009, 0.049, z + 0.002)], 0.0011, col); H.add(bridge); out.push(bridge);
  }
  // ---- bags
  const bg = s.bag;
  if (bg.id !== 'none') {
    const mat = new THREE.MeshStandardMaterial({ color: bg.color, roughness: 0.55 }), strapM = new THREE.MeshStandardMaterial({ color: bg.color, roughness: 0.6 }), hip = J.hips[1];
    if (bg.id === 'clutch') { const o = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.24), mat); const hp = V(...J.handR), el = V(...J.foreArmR); o.position.copy(hp.clone().sub(V(...J.handR))).add(V(-0.045, -0.02, 0.02)); add(ch.bones.handR, o); ch.animator && (ch.animator.handPose.R = 'holdBag'); }
    if (bg.id === 'tote') { const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.3), mat); body.position.set(-0.1, -0.28, 0.0); const hd = tube([V(-0.1, -0.12, -0.08), V(-0.06, 0.0, -0.0), V(-0.1, -0.12, 0.08)], 0.005, strapM); const g = new THREE.Group(); g.add(body, hd); g.position.set(-0.0, -0.04, 0.0); add(ch.bones.handR, g); }
    if (bg.id === 'crossbody') {
      const strap = tube([V(-0.06, L.neckBaseY, -0.02), V(-0.11, L.bustY, 0.1), V(0.0, J.spine[1], 0.115), V(0.13, hip + 0.02, 0.07), V(0.2, hip - 0.07, 0.0)].map(p => p.sub(V(...J.chest))), 0.0085, strapM); add(ch.bones.chest, strap);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.15, 0.2), mat); body.position.set(0.215, hip - 0.12, 0).sub(V(...J.chest)).add(V(0, 0, 0)); body.position.y = hip - 0.12 - J.chest[1]; add(ch.bones.chest, body);
    }
    if (bg.id === 'backpack') { const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.4, 0.14), mat); body.position.set(0, L.shoulderY - 0.2 - J.chest[1], -0.15); add(ch.bones.chest, body); for (const sg of [-1, 1]) { const st = tube([V(sg * 0.07, L.shoulderY + 0.01, -0.0), V(sg * 0.1, L.shoulderY - 0.06, 0.09), V(sg * 0.1, L.shoulderY - 0.2, 0.05), V(sg * 0.1, L.shoulderY - 0.3, -0.08)].map(p => p.sub(V(...J.chest))), 0.011, strapM); add(ch.bones.chest, st); } }
  }
  // ---- hair accessories that sit on the head (headband / scarf / clip / bead tiara). Beads & cuffs on braids are built by the hair system.
  const ha = s.hairAccessory;
  if (ha.id === 'headband' || ha.id === 'scarf') {
    const mat = new THREE.MeshStandardMaterial({ color: ha.color, roughness: ha.id === 'scarf' ? 0.35 : 0.6 }), pts = Array.from({ length: 30 }, (_, i) => { const a = i / 30 * Math.PI * 2; return V(Math.sin(a) * 0.0775, 0.083 + 0.012 * Math.cos(a) - 0.02 * Math.max(0, -Math.cos(a)), -0.014 + Math.cos(a) * 0.092); });
    const band = tube(pts, ha.id === 'scarf' ? 0.011 : 0.0075, mat, true, 80); H.add(band); out.push(band);
    if (ha.id === 'scarf') { const kn = new THREE.Mesh(new THREE.TorusKnotGeometry(0.014, 0.0055, 40, 7, 2, 3), mat); kn.position.set(0.045, 0.108, 0.07); kn.rotation.set(0.6, 0.4, 0.3); H.add(kn); out.push(kn); for (const sg of [1, -1]) { const tail = tube([V(0.045, 0.1, 0.07), V(0.05 + sg * 0.01, 0.08, 0.075), V(0.058 + sg * 0.02, 0.05, 0.062)], 0.0065, mat); H.add(tail); out.push(tail); } }
  }
  if (ha.id === 'clip') { const m = metalMat('gold'), c = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.007, 0.012), m); c.position.set(0.055, 0.082, 0.05); c.rotation.set(0, -0.6, 0.5); H.add(c); out.push(c); for (let i = 0; i < 3; i++) { const g = new THREE.Mesh(new THREE.SphereGeometry(0.0038, 10, 8), gemMat); g.position.set(0.04 + i * 0.012, 0.0845 - i * 0.002, 0.052 + i * 0.011).add(V(0, 0, 0)); c.parent.add(g); out.push(g); } }
  if (ha.id === 'beads' && !ch.hair.hasTubes?.()) { const N = 22; for (let i = 0; i < N; i++) { const a = (i / (N - 1) - 0.5) * 2.2, b = new THREE.Mesh(new THREE.SphereGeometry(0.0034, 10, 8), metalMat('gold')); b.position.set(Math.sin(a) * 0.072, 0.092 - 0.01 * Math.abs(a), 0.045 + Math.cos(a) * 0.043); H.add(b); out.push(b); } }
  // ---- piercings
  const pc = s.piercings, M = metalMat('gold'), lay = ch.headData, an = lay.anchors;
  const sph = (x, y, z, r, mat = M) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), mat); m.position.set(x, y, z); H.add(m); out.push(m); return m; };
  if (pc.includes('nose stud')) sph(0.0238 + 0.0046 * f.noseWidth, an.subY + 0.0050, 0.0895, 0.0018);
  if (pc.includes('nose ring')) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.0045, 0.0007, 8, 20, Math.PI * 1.7), M); t.position.set(0.0215 + 0.0046 * f.noseWidth, an.subY + 0.0, 0.0905); t.rotation.set(0, Math.PI / 2, 0); H.add(t); out.push(t); }
  if (pc.includes('brow')) { sph(0.0335, 0.0675 + 0.003 * f.browHeight, 0.0805, 0.0016); sph(0.0368, 0.0655 + 0.003 * f.browHeight, 0.0795, 0.0016); }
  if (pc.includes('lip')) { sph(0.007, an.ly - 0.0045, 0.0855, 0.0015); }
  if (pc.includes('helix')) for (const grp of ch.ears || []) { const g = sph(0.0102, 0.0245 * sz, -0.0105, 0.0017); H.remove(g); grp.add(g); g.position.set(0.0105, 0.0245 * sz, -0.012 - 0.003); }
  return out;
}
