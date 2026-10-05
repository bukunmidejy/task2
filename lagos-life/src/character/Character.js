// The ONE character. Everything on screen - creator, fitting room, mirror, selfie, gameplay,
// pedestrians - is a `Character` built from a canonical state object. apply(state) diffs the state
// and rebuilds only what changed (body/face sculpts, skin texture, hair, clothing...).
import * as THREE from 'three';
import { computeRig, BONE_NAMES, BONE_PARENT } from './rig.js';
import { buildBody } from './body.js';
import { buildHead, FACE_RECT, faceMorphs } from './head.js';
import { buildEye, setBlink, setGaze, eyeColorHex } from './eyes.js';
import { earGeometry } from './ears.js';
import { createSkinMaterial, createSkinUniforms, applySkinPalette } from './skinMaterial.js';
import { createFaceCanvases, paintFace } from './faceTexture.js';
import { sanitize, asymmetry } from '../core/schema.js';

const J = JSON.stringify;
export const QUALITY = {
  high:   { body: 0.010, head: 0.0026, faceTex: 2048, hairDensity: 1.0, ear: 0.0012 },
  medium: { body: 0.0125, head: 0.0032, faceTex: 1024, hairDensity: 0.6, ear: 0.0016 },
  low:    { body: 0.016, head: 0.0042, faceTex: 1024, hairDensity: 0.35, ear: 0.0022 },
};

export class Character {
  constructor({ quality = 'high', env = null } = {}) {
    this.quality = quality; this.root = new THREE.Group(); this.root.name = 'Character';
    this.state = null; this.rig = null; this.parts = {}; this.time = 0; this.q = QUALITY[quality];
    this.skinU = createSkinUniforms();
    this.bodyMat = createSkinMaterial({ uniforms: this.skinU });
    this.earMat = createSkinMaterial({ uniforms: this.skinU });
    this.faceCv = createFaceCanvases(this.q.faceTex);
    this.faceMap = new THREE.CanvasTexture(this.faceCv.color); this.faceMap.colorSpace = THREE.SRGBColorSpace; this.faceMap.anisotropy = 8;
    this.faceRough = new THREE.CanvasTexture(this.faceCv.rough); this.faceRough.colorSpace = THREE.NoColorSpace;
    this.headMat = createSkinMaterial({ uniforms: this.skinU, map: this.faceMap, roughMap: this.faceRough });
    this.lidMat = this.headMat.clone(); this.lidMat.side = THREE.DoubleSide; this.lidMat.onBeforeCompile = this.headMat.onBeforeCompile; this.lidMat.userData = this.headMat.userData;
    this.skinMats = [this.bodyMat, this.earMat, this.headMat, this.lidMat];
    this.buildSkeleton();
    this.headGroup = new THREE.Group(); this.headGroup.name = 'headGroup'; this.bones.head.add(this.headGroup);
    this.bodyMesh = null; this.headMesh = null;
    this.blink = { t: 2 + Math.random() * 3, phase: 0 }; this.expr = { smile: 0, brow: 0, squint: 0 };
  }

  buildSkeleton() {
    this.bones = {}; this.boneList = [];
    for (const n of BONE_NAMES) { const b = new THREE.Bone(); b.name = n; this.bones[n] = b; this.boneList.push(b); }
    for (const n of BONE_NAMES) { const p = BONE_PARENT[n]; if (p) this.bones[p].add(this.bones[n]); }
    this.root.add(this.bones.root);
    this.skeleton = new THREE.Skeleton(this.boneList);
  }
  layoutSkeleton(rig) {
    for (const n of BONE_NAMES) {
      const b = this.bones[n]; b.quaternion.identity(); b.scale.set(1, 1, 1);
      const p = BONE_PARENT[n], j = rig.J[n], pj = p ? rig.J[p] : [0, 0, 0];
      b.position.set(j[0] - pj[0], j[1] - pj[1], j[2] - pj[2]);
    }
    this.root.updateMatrixWorld(true);
    this.skeleton.calculateInverses();
    this.restPos = Object.fromEntries(BONE_NAMES.map(n => [n, new THREE.Vector3(...rig.J[n])]));
  }

  // ---- state application ------------------------------------------------------------------
  apply(stateIn, { fast = false } = {}) {
    const s = sanitize(stateIn), prev = this.state, ch = k => !prev || J(prev[k]) !== J(s[k]);
    this.state = s; this.asym = asymmetry(s);
    const bodyChanged = ch('body') || fast !== this._lastFast;
    const faceChanged = ch('face');
    const t0 = performance.now(); const timing = {};
    if (bodyChanged) {
      this.rig = computeRig(s.body); this.layoutSkeleton(this.rig);
      const g = buildBody(this.rig, s.body, this.asym, fast ? this.q.body * 1.45 : this.q.body);
      this.setBodyGeometry(g); timing.body = performance.now() - t0;
      this.headGroup.scale.setScalar(this.rig.L.hs);
      this.headGroup.position.set(0, 0, 0);
    }
    this._lastFast = fast;
    if (faceChanged || ch('eyes') || bodyChanged && !this.headMesh) {
      const t1 = performance.now();
      this.buildFace(s, fast); timing.face = performance.now() - t1;
    }
    if (ch('skin') || ch('makeup') || faceChanged || ch('eyes')) { this.skinPal = applySkinPalette(this.skinMats, this.skinU, s.skin); this.paintSkin(); }
    this.timing = timing;
    for (const fn of this.listeners || []) fn(s, { bodyChanged, faceChanged, ch });
    return timing;
  }

  setBodyGeometry(g) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(g.position, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(g.normal, 3));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(g.skinIndex, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(g.skinWeight, 4));
    geo.setIndex(new THREE.BufferAttribute(g.index, 1)); geo.userData.body = g;
    if (this.bodyMesh) { this.bodyMesh.geometry.dispose(); this.bodyMesh.geometry = geo; }
    else {
      this.bodyMesh = new THREE.SkinnedMesh(geo, this.bodyMat); this.bodyMesh.name = 'body'; this.bodyMesh.frustumCulled = false; this.bodyMesh.castShadow = true; this.bodyMesh.receiveShadow = true;
      this.root.add(this.bodyMesh);
    }
    this.bodyMesh.bind(this.skeleton, new THREE.Matrix4());
    this.bodyData = g;
  }

  buildFace(s, fast) {
    const h = fast ? this.q.head * 1.35 : this.q.head;
    const hd = buildHead(s.face, this.asym, h); this.headData = hd;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(hd.position, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(hd.normal, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(hd.uv, 2)); geo.setIndex(new THREE.BufferAttribute(hd.index, 1));
    geo.morphAttributes.position = faceMorphs(hd.position, hd.features, hd.layout).map(a => new THREE.BufferAttribute(a, 3));
    geo.morphTargetsRelative = true;
    if (this.headMesh) { this.headMesh.geometry.dispose(); this.headMesh.geometry = geo; this.headMesh.updateMorphTargets(); }
    else { this.headMesh = new THREE.Mesh(geo, this.headMat); this.headMesh.name = 'head'; this.headMesh.castShadow = true; this.headMesh.receiveShadow = true; this.headGroup.add(this.headMesh); this.headMesh.updateMorphTargets(); }
    // eyes
    for (const e of this.eyes || []) { this.headGroup.remove(e); }
    this.eyes = hd.layout.eye.map((c, i) => buildEye({ center: c, side: i === 0 ? -1 : 1, radius: hd.layout.eyeR, irisHex: eyeColorHex(s.eyes.color), open: hd.layout.eyeOpen, tilt: hd.layout.eyeTilt, lidFull: hd.layout.lidFull, skinMat: this.lidMat, seed: s.seed + i }));
    this.eyes.forEach(e => { this.headGroup.add(e); e.userData.buildLashes(s.makeup.lashes, 0.3 + 0.7 * s.makeup.lashes, 0.00022 + 0.0001 * s.makeup.lashes); });
    // ears
    if (!fast || !this.ears) {
      for (const e of this.ears || []) this.headGroup.remove(e);
      const eg = earGeometry(s.face); this.ears = [];
      for (const sg of [-1, 1]) {
        const grp = new THREE.Group(), m = new THREE.Mesh(eg, this.earMat); m.castShadow = true; m.receiveShadow = true;
        m.position.z = -0.012; grp.add(m); grp.scale.x = sg;
        grp.position.set(sg * 0.0625, 0.0205 + 0.0016 * this.asym.ear * sg, -0.0015); grp.rotation.y = -sg * 0 - (0.30 + 0.22 * s.face.earOut) * (sg > 0 ? 1 : 1) * (sg > 0 ? 1 : 1);
        // rotation sign for mirrored group is applied in local space
        this.headGroup.add(grp); this.ears.push(grp);
      }
    }
  }

  setMorph(ex) {
    const m = this.headMesh?.morphTargetInfluences; if (!m) return;
    m[0] = Math.max(0, ex.smile); m[1] = Math.max(0, -ex.smile); m[2] = Math.max(0, ex.brow); m[3] = Math.max(0, -ex.brow);
  }

  paintSkin() {
    const s = this.state, hd = this.headData; if (!hd) return;
    paintFace(this.faceCv, s.skin, s.makeup, hd.layout, hd.features, s.seed);
    this.faceMap.needsUpdate = true; this.faceRough.needsUpdate = true;
    for (const e of this.eyes || []) e.userData.buildLashes(s.makeup.lashes, 0.3 + 0.7 * s.makeup.lashes, 0.00022 + 0.0001 * s.makeup.lashes);
  }

  setEnvironment(envMap, intensity = 1) { for (const m of this.skinMats) { m.envMap = envMap; m.envMapIntensity = intensity; } }

  dispose() { this.root.traverse(o => { o.geometry?.dispose?.(); }); }
}
