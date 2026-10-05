// Composition root. One Character instance (the player) is moved between stages - Creator, Fitting room,
// Lagos street - so you always see the SAME person under different light, camera and weather.
import * as THREE from 'three';
import { Character, QUALITY } from './character/Character.js';
import { Animator } from './character/animation.js';
import { LightRig, PRESETS } from './world/lighting.js';
import { LagosWorld, Rain } from './world/lagos.js';
import { Studio } from './world/studio.js';
import { Showcase } from './world/showcase.js';
import { SHOWCASE } from './world/lighting.js';
import { HEROES } from './data/heroes.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CameraRig } from './render/cameraRig.js';
import { Store } from './core/store.js';
import { createCharacter, randomCharacter, sanitize } from './core/schema.js';
import { SKIN_PRESETS } from './core/skincolor.js';
import { buildUI } from './ui/ui.js';

const TIERS = {
  high:   { pr: 2, shadow: 2048, shadows: true, ped: 4, world: 'high', rain: 3000 },
  medium: { pr: 1.5, shadow: 1024, shadows: true, ped: 2, world: 'medium', rain: 1800 },
  low:    { pr: 1, shadow: 512, shadows: false, ped: 0, world: 'low', rain: 900 },
};

const HERO_POSE = {
  amara: { shift: 0.02, roll: 0.05, handHip: 'R', headRoll: 0.08, footFwd: 0.1, bodyYaw: -0.4, camYaw: 0.0, armBend: 0.25 },
  tolu: { shift: -0.018, roll: -0.05, handHip: 'L', headRoll: -0.07, footFwd: -0.08, bodyYaw: 0.4, camYaw: 0.0, armBend: 0.3 },
  chidi: { shift: 0.012, roll: 0.03, handHip: null, headRoll: -0.04, footFwd: 0.07, bodyYaw: -0.3, camYaw: 0.0, armBend: 0.45 },
};
export class App {
  constructor(canvas) {
    this.canvas = canvas; this.tier = new URLSearchParams(location.search).get('quality') || (matchMedia('(max-width: 800px)').matches ? 'medium' : 'high');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.store = new Store(); this.clock = new THREE.Clock(); this.sceneName = 'creator'; this.lighting = 'indoor'; this.weather = { rain: 0, wind: 0 }; this.fps = 60; this.extra = []; this.walkLoop = false; this.keys = new Set(); this.letterbox = false;
    this.studioScene = new THREE.Scene(); this.lagosScene = new THREE.Scene();
    this.showScene = new THREE.Scene(); this.showRig = new LightRig(this.renderer, this.showScene); this.showRig.table = SHOWCASE; this.showcase = new Showcase(); this.showScene.add(this.showcase.group); this.fx = true;
    this.clean = new URLSearchParams(location.search).has('clean');
    this.studioRig = new LightRig(this.renderer, this.studioScene); this.lagosRig = new LightRig(this.renderer, this.lagosScene);
    this.studio = new Studio(this.tier); this.studioScene.add(this.studio.group);
    this.lagos = null; this.rain = new Rain(TIERS[this.tier].rain); this.studioScene.add(this.rain.mesh);
    this.camera = new THREE.PerspectiveCamera(24, 1, 0.05, 200); this.camRig = new CameraRig(this.camera, canvas);
    this.pedestrians = [];
    this.makeCharacter(); this.applyQuality(this.tier, true); if (this.clean) document.getElementById('ui').style.display = 'none'; this.setScene('creator'); this.setLighting('indoor');
    this.store.subscribe((st, o) => this.onState(st, o));
    addEventListener('resize', () => this.resize()); this.resize();
    addEventListener('keydown', e => { if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return; this.keys.add(e.key.toLowerCase()); }); addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    this.renderer.setAnimationLoop(() => this.frame());
  }
  // ------------------------------------------------------------------ character
  makeCharacter() {
    const pos = this.an ? this.an.pos.clone() : new THREE.Vector3(), yaw = this.an ? this.an.yaw : 0;
    if (this.ch) { this.ch.root.parent?.remove(this.ch.root); this.ch.dispose(); }
    this.ch = new Character({ quality: this.tier }); this.ch.apply(this.store.state); this.an = new Animator(this.ch); this.an.pos.copy(pos); this.an.yaw = yaw; this.an.input.heading = yaw; this.an.resetFeet(); this.ch.animator = this.an;
    this.camRig.setCharacter(this.ch); this.activeScene()?.add(this.ch.root); this.applyWeather(); if (this.lighting) this.applySkinEnv();
  }
  onState(st, { live } = {}) {
    clearTimeout(this._hi); this._pending = st;
    if (this._busy) { this._dirty = true; if (live) return; }
    this.flush(live);
    if (live) this._hi = setTimeout(() => { this.ch.apply(this.store.state, { fast: false }); this.camRig.setCharacter(this.ch); this.afterApply(); }, 260);
  }
  flush(live) {
    this._busy = true; const t0 = performance.now();
    this.timing = this.ch.apply(this.store.state, { fast: !!live }); this.camRig.setCharacter(this.ch); this.afterApply();
    this.lastApplyMs = performance.now() - t0; this._busy = false; if (this._dirty) { this._dirty = false; this.flush(true); }
  }
  afterApply() { this.an.resetFeetIfIdle?.(); this.applyWeather(); for (const fn of this.listeners || []) fn(); }
  // ------------------------------------------------------------------ stages / light / weather / quality
  activeScene() { return this.sceneName === 'lagos' ? this.lagosScene : this.sceneName === 'showcase' ? this.showScene : this.studioScene; }
  rigOf() { return this.sceneName === 'lagos' ? this.lagosRig : this.sceneName === 'showcase' ? this.showRig : this.studioRig; }
  ensureLagos() {
    if (this.lagos) return; this.lagos = new LagosWorld(TIERS[this.tier].world); this.lagosScene.add(this.lagos.group); this.lagosScene.add(this.rain.mesh.clone());
    this.lagosRain = new Rain(TIERS[this.tier].rain); this.lagosScene.add(this.lagosRain.mesh); this.lagosRig.lamps = this.lagos.lamps; this.spawnPedestrians();
  }
  setScene(name) {
    const prev = this.sceneName; this.sceneName = name; if (name === 'lagos') this.ensureLagos();
    const sc = this.activeScene(); sc.add(this.ch.root); for (const c of this.extra) sc.add(c.ch.root);
    this.studio.setFitting(name === 'fitting'); this.studio.floor.visible = name !== 'lagos';
    if (name === 'showcase') { this.an.pos.set(0, 0, 0); this.an.resetFeet(); this.camRig.env = 'showcase'; }
    if (name === 'fitting' && prev !== 'fitting') this.setLighting('indoor'); else this.setLighting(this.lighting);
    if (name === 'fitting') { this.an.input.heading = 0; this.an.yaw = 0; }
    this.camRig.env = name; this.lagosRig.sunMul = [-1, 1, 1];
    if (name === 'lagos') { this.an.pos.set(1.6, 0, 0); this.an.yaw = -1.25; this.an.input.heading = -1.25; this.an.resetFeet(); this.camRig.g.yaw = -1.25; this.camRig.manual = false; }
    else if (prev === 'lagos') { this.an.pos.set(0, 0, 0); this.an.resetFeet(); }
    this.applyWeather(); for (const fn of this.listeners || []) fn();
  }
  setLighting(mode) {
    this.lighting = mode; this.studioRig.apply(mode, { background: true }); this.lagosRig.apply(mode, { background: true }); this.showRig.apply(mode, { background: true }); this.showcase.setMode(mode);
    if (this.sceneName === 'creator' || this.sceneName === 'fitting') { this.studioScene.background = new THREE.Color(this.sceneName === 'fitting' ? { day: '#c9b7a0', indoor: '#2a211b', night: '#0c0a10' }[mode] : PRESETS[mode].bg); }
    this.lagos?.setMode(mode); this.applySkinEnv(); this.applyWeather(); for (const fn of this.listeners || []) fn();
  }
  applySkinEnv() { const rig = this.rigOf(), p = (rig.table || PRESETS)[this.lighting], env = rig.env(this.lighting); for (const c of [this.ch, ...this.extra.map(e => e.ch), ...this.pedestrians.map(q => q.ch)]) c.setEnvironment(env, p.skinEnv ?? 0.4); }
  setWeather(w) { Object.assign(this.weather, w); this.applyWeather(); }
  applyWeather() {
    const { rain, wind } = this.weather, chars = [this.ch, ...this.pedestrians.map(p => p.ch), ...this.extra.map(e => e.ch)];
    this.rain.set(this.sceneName === 'lagos' ? 0 : rain); this.lagosRain?.set(this.sceneName === 'lagos' ? rain : 0); this.lagos?.setRain(rain);
    for (const c of chars) { c.skinU.uWet.value = 0.85 * rain; c.hair.setWet(rain); c.hair.windVec.set(wind * 4.5, 0, wind * 2.2); }
  }
  applyQuality(name, silent = false) {
    this.tier = name; const T = TIERS[name]; this.renderer.setPixelRatio(Math.min(devicePixelRatio, T.pr)); this.renderer.shadowMap.enabled = T.shadows;
    for (const r of [this.studioRig, this.lagosRig]) { r.setShadow(T.shadow); r.setShadowsEnabled(T.shadows); }
    this.resize(); if (silent) return;
    this.makeCharacter(); if (this.lagos) { this.lagosScene.remove(this.lagos.group); this.lagos = null; this.clearPedestrians(); this.ensureLagos(); this.lagos.setMode(this.lighting); }
    this.setScene(this.sceneName); for (const fn of this.listeners || []) fn();
  }
  // ------------------------------------------------------------------ hero showcase
  showHero(name, { lighting = 'indoor', shot = 'hero' } = {}) {
    const P = HERO_POSE[name] || {}; this.clearExtra(); this.walkLoop = false; this.an.input.speed = 0;
    this.store.replace(HEROES[name]()); this.setScene('showcase'); this.setLighting(lighting); this.an.pose = 'stand'; this.an.setHeroPose(P); this.an.autoExpr = true; this.an.setExpression('soft');
    this.camRig.heroYaw = P.camYaw ?? 0; this.camRig.setMode(shot); this.hero = name; for (const fn of this.listeners || []) fn();
  }
  setShot(shot) { this.camRig.setMode(shot); }
  ensureFx() {
    if (this.composer) return; const w = innerWidth, h = innerHeight, rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt); this.renderPass = new RenderPass(this.showScene, this.camera); this.composer.addPass(this.renderPass);
    this.bokeh = new BokehPass(this.showScene, this.camera, { focus: 6, aperture: 0.0006, maxblur: 0.012 }); this.composer.addPass(this.bokeh);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.2, 0.6, 1.25); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
  }
  renderFrame() {
    if (this.sceneName === 'showcase' && this.fx && this.tier !== 'low') {
      this.ensureFx(); const sz = this.renderer.getSize(new THREE.Vector2()); if (this.composer._w !== sz.x || this.composer._h !== sz.y) { this.composer.setSize(sz.x, sz.y); this.composer._w = sz.x; this.composer._h = sz.y; }
      const d = this.camera.position.distanceTo(this.camRig.target); this.bokeh.uniforms.focus.value = d; this.bokeh.uniforms.aperture.value = 0.00065 * (this.camRig.mode === 'portrait' ? 1.4 : 1); this.bokeh.uniforms.maxblur.value = 0.013;
      this.bloom.strength = this.lighting === 'night' ? 0.32 : 0.1; this.renderPass.scene = this.showScene; this.composer.render();
    } else this.renderer.render(this.activeScene(), this.camera);
  }
  // ------------------------------------------------------------------ pedestrians (same Character class, low-cost hair)
  clearPedestrians() { for (const p of this.pedestrians) { p.ch.root.parent?.remove(p.ch.root); p.ch.dispose(); } this.pedestrians = []; }
  spawnPedestrians() {
    const n = TIERS[this.tier].ped; const styles = ['afro', 'shortcut', 'cornrows', 'bantu', 'headwrap', 'fade', 'twistout']; const looks = [['tee', 'jeans'], ['kaftan'], ['buba', 'iro'], ['senator', 'sokoto']];
    for (let i = 0; i < n; i++) setTimeout(() => {
      if (!this.lagos) return; const st = randomCharacter(777 + i * 31); st.hair.style = styles[i % styles.length]; st.hair.wrapColor = ['#c89a2a', '#b0206a', '#0f6a50', '#1f3f9a'][i % 4];
      const l = looks[i % looks.length]; st.clothing.worn = {}; const mk = (item, slot, color, fabric) => ({ item, color, fabric, variant: i % 4 });
      if (l[0] === 'kaftan') st.clothing.worn.onePiece = mk('kaftan', 'onePiece', ['#1f3f9a', '#d9604a'][i % 2], 'ankara'); else { st.clothing.worn.top = mk(l[0], 'top', ['#ece8e0', '#a24a2e', '#0f6a50'][i % 3], l[0] === 'buba' ? 'lace' : undefined); st.clothing.worn.bottom = mk(l[1], 'bottom', ['#26324f', '#c89a2a', '#e6dcc4'][i % 3], l[1] === 'iro' ? 'ankara' : undefined); }
      st.clothing.worn.shoes = { item: 'sandals', color: '#141416', fabric: 'leather', variant: 0 };
      const c = new Character({ quality: 'low' }); c.apply(sanitize(st)); const an = new Animator(c);
      const x = (i % 2 ? 4.9 : -4.9) + (i % 3) * 0.2, z0 = -14 + i * 7; an.pos.set(x, 0, z0); an.yaw = i % 2 ? Math.PI : 0; an.resetFeet(); c.animator = an; this.lagosScene.add(c.root);
      this.pedestrians.push({ ch: c, an, dir: i % 2 ? -1 : 1, x, speed: 0.9 + 0.3 * (i % 3) / 3, pause: 0 }); this.applyWeather(); this.applySkinEnv();
    }, 600 + i * 1800);
  }
  // ------------------------------------------------------------------ compare / skin lab (extra characters share the same scene)
  async skinLineup(onProgress) {
    this.clearExtra(); const base = JSON.parse(JSON.stringify(this.store.state)), n = SKIN_PRESETS.length;
    for (let i = 0; i < n; i++) {
      const st = sanitize({ ...base, skin: { ...base.skin, depth: SKIN_PRESETS[i].depth, undertone: SKIN_PRESETS[i].undertone } });
      const c = new Character({ quality: 'medium' }); c.apply(st); const an = new Animator(c); an.pos.set((i - (n - 1) / 2) * 0.62, 0, 0.0); an.resetFeet(); c.animator = an; c.root.userData.label = SKIN_PRESETS[i].name;
      this.extra.push({ ch: c, an, label: SKIN_PRESETS[i].name }); this.activeScene().add(c.root); onProgress?.(i + 1, n); await new Promise(r => setTimeout(r, 30));
    }
    this.ch.root.visible = false; this.lab = true; this.camRig.setMode('front'); this.camRig.g.dist = 9.5; this.camRig.manual = true; this.camRig.mode = 'creator'; this.camRig.g.yaw = 0; this.camRig.g.pitch = 0.05;
    this.labMode = 'skin';
  }
  async compare(snapshot) {
    this.clearExtra(); const A = sanitize(snapshot), c = new Character({ quality: this.tier === 'low' ? 'low' : 'medium' }); c.apply(A); const an = new Animator(c); an.pos.set(-0.55, 0, this.an.pos.z); an.resetFeet(); c.animator = an;
    this.extra.push({ ch: c, an, label: 'A' }); this.activeScene().add(c.root); this.an.pos.x = 0.55; this.an.resetFeet(); this.labMode = 'compare'; this.camRig.manual = true; this.camRig.g.dist = 6.2; this.applyWeather();
  }
  clearExtra() { for (const e of this.extra) { e.ch.root.parent?.remove(e.ch.root); e.ch.dispose(); } this.extra = []; this.ch.root.visible = true; if (this.labMode === 'compare') { this.an.pos.x = 0; this.an.resetFeet(); } this.labMode = null; this.camRig.manual = false; }
  // ------------------------------------------------------------------ frame
  resize() {
    const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h;
    // centre the character in the free area (beside the panel on desktop, above the bottom sheet on mobile)
    if (this.clean) this.camera.clearViewOffset(); else if (w > 820) this.camera.setViewOffset(w, h, -192, 0, w, h); else this.camera.setViewOffset(w, h, 0, Math.round(h * 0.2), w, h);
    this.camera.updateProjectionMatrix();
  }
  input() {
    const k = this.keys, an = this.an; let fx = 0, fz = 0; if (k.has('w') || k.has('arrowup')) fz += 1; if (k.has('s') || k.has('arrowdown')) fz -= 1; if (k.has('a') || k.has('arrowleft')) fx -= 1; if (k.has('d') || k.has('arrowright')) fx += 1;
    const run = k.has('shift');
    if (fx || fz) { const camYaw = this.camRig.yaw, dx = -Math.sin(camYaw) * fz + Math.cos(camYaw) * fx * -1, dz = -Math.cos(camYaw) * fz + Math.sin(camYaw) * fx; an.input.heading = Math.atan2(dx, dz); an.input.speed = run ? 3.4 : 1.35; this.walkLoop = false; this.manualMove = true; }
    else if (this.manualMove) { an.input.speed = 0; this.manualMove = false; }
    if (this.walkLoop) { an.input.heading += 0.5 * this.dt; an.input.speed = this.walkSpeed || 1.35; }
    an.input.turnInPlace = true;
  }
  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05); this.dt = dt; this.fps += (1 / Math.max(dt, 1e-4) - this.fps) * 0.05;
    this.input();
    if (this.sceneName === 'lagos') for (const p of this.pedestrians) { p.an.input.heading = p.dir > 0 ? 0 : Math.PI; p.an.input.speed = p.speed; if ((p.dir > 0 && p.an.pos.z > 34) || (p.dir < 0 && p.an.pos.z < -18)) { p.dir *= -1; } p.an.update(dt); }
    this.an.update(dt); for (const e of this.extra) { e.an.update(dt); }
    this.ch.root.updateMatrixWorld(true);
    this.camRig.update(dt, this.an); const rig = this.rigOf(); rig.update(this.an.pos);
    this.lagos?.update(dt, this.weather.wind); this.rain.update(dt, this.an.pos); this.lagosRain?.update(dt, this.an.pos);
    // mirror / selfie phone prop
    this.renderFrame();
  }
}
export function boot() {
  const canvas = document.getElementById('c'); const app = new App(canvas); window.__app = app; buildUI(app); return app;
}
