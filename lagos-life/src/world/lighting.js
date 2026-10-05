// Lighting rig + presets (DAYLIGHT / INDOOR / NIGHT). The SAME character is lit - nothing is swapped.
// Each preset tunes sun/key, sky ambient, environment reflections, exposure and fog so dark and brown
// skin stays warm and readable in every state (verified with the skin lineup).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

function skyScene(top, horizon, ground, sun = null) {
  const sc = new THREE.Scene();
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { top: { value: new THREE.Color(top) }, hor: { value: new THREE.Color(horizon) }, gnd: { value: new THREE.Color(ground) } },
    vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec3 p; uniform vec3 top,hor,gnd; void main(){ float h=p.y; vec3 c = h>0. ? mix(hor, top, pow(h,0.55)) : mix(hor, gnd, pow(-h,0.6)); gl_FragColor=vec4(c,1.); }' });
  sc.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), m));
  if (sun) { const s = new THREE.Mesh(new THREE.SphereGeometry(2.4, 16, 8), new THREE.MeshBasicMaterial({ color: sun.color })); s.material.color.multiplyScalar(sun.k); s.position.copy(sun.pos).normalize().multiplyScalar(45); sc.add(s); }
  return sc;
}

export const PRESETS = {
  day: { label: 'Daylight', exposure: 1.0, skinEnv: 0.28, sun: { color: '#fff0d8', i: 3.4, pos: [5, 7, 4] }, fill: { color: '#ffe9d2', i: 0.5 }, rim: { color: '#ffe8c8', i: 0.9 }, hemi: { sky: '#fff1e0', gnd: '#8a5a3a', i: 0.6 }, env: 0.75, bg: '#a9cbe8', fog: ['#cfdde6', 0.012] },
  indoor: { label: 'Indoor', exposure: 1.1, skinEnv: 0.35, fillPos: [-4, 2, 3], sun: { color: '#ffd8ae', i: 2.8, pos: [3, 5, 4.5] }, fill: { color: '#ffb878', i: 0.9 }, rim: { color: '#ffd9a8', i: 1.1 }, hemi: { sky: '#ffe3c2', gnd: '#5a4030', i: 0.5 }, env: 0.6, practical: 0, bg: '#2a211b', fog: null },
  night: { label: 'Night', exposure: 1.55, skinEnv: 0.3, fillPos: [4, 1.6, 2.5], sun: { color: '#a9bcff', i: 1.1, pos: [-4, 6, 3] }, fill: { color: '#8aa0f0', i: 1.6 }, rim: { color: '#ffb36b', i: 2.2 }, hemi: { sky: '#34478a', gnd: '#2a1c12', i: 0.6 }, env: 0.5, bg: '#05070f', fog: ['#0a0e1c', 0.02], practical: 48 },
};

export class LightRig {
  constructor(renderer, scene) {
    this.r = renderer; this.scene = scene; this.group = new THREE.Group(); scene.add(this.group);
    this.sun = new THREE.DirectionalLight(0xffffff, 3); this.sun.castShadow = true; this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.02; this.sun.target.position.set(0, 1, 0);
    this.fill = new THREE.DirectionalLight(0xffffff, 0.5); this.rim = new THREE.DirectionalLight(0xffffff, 0.8); this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
    this.practical = new THREE.PointLight(0xffb36b, 0, 0, 2); this.group.add(this.practical);
    this.group.add(this.sun, this.sun.target, this.fill, this.rim, this.hemi);
    this.pm = new THREE.PMREMGenerator(renderer); this.envs = {}; this.lamps = []; this.mode = 'day'; this.follow = new THREE.Vector3();
    this.shadowSize = 2048; this.setShadow(2048);
  }
  env(mode) {
    if (this.envs[mode]) return this.envs[mode];
    let tex;
    if (mode === 'day') tex = this.pm.fromScene(skyScene('#4f8fd8', '#dbe8f2', '#8a7a64', { color: '#fff4dd', k: 12, pos: new THREE.Vector3(5, 7, 4) }), 0.02).texture;
    else if (mode === 'night') tex = this.pm.fromScene(skyScene('#050a1c', '#1a2040', '#0a0a10', { color: '#9fb4ff', k: 2, pos: new THREE.Vector3(-4, 6, 3) }), 0.02).texture;
    else tex = this.pm.fromScene(new RoomEnvironment(), 0.04).texture;
    return (this.envs[mode] = tex);
  }
  setShadow(size) { this.shadowSize = size; this.sun.shadow.mapSize.set(size, size); const c = this.sun.shadow.camera; c.left = c.bottom = -3.2; c.right = c.top = 3.2; c.near = 0.5; c.far = 30; if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } c.updateProjectionMatrix(); }
  setShadowsEnabled(v) { this.sun.castShadow = v; }
  apply(mode, { background = true } = {}) {
    const p = PRESETS[mode]; this.mode = mode; const sc = this.scene;
    this.sun.color.set(p.sun.color); this.sun.intensity = p.sun.i; this.sun.position.set(...p.sun.pos);
    this.fill.color.set(p.fill.color); this.fill.intensity = p.fill.i; this.fill.position.set(...(p.fillPos || [-4, 2, 3]));
    this.rim.color.set(p.rim.color); this.rim.intensity = p.rim.i; this.rim.position.set(-2, 3, -5);
    this.hemi.color.set(p.hemi.sky); this.hemi.groundColor.set(p.hemi.gnd); this.hemi.intensity = p.hemi.i;
    sc.environment = this.env(mode); sc.environmentIntensity = p.env;
    if (background) sc.background = new THREE.Color(p.bg);
    sc.fog = p.fog ? new THREE.FogExp2(p.fog[0], p.fog[1]) : null;
    this.r.toneMappingExposure = p.exposure; this.envIntensity = p.env; this.practical.intensity = p.practical || 0;
    for (const l of this.lamps) l.visible = mode === 'night';
    for (const fn of this.onMode || []) fn(mode);
  }
  update(target) { this.sun.target.position.set(target.x, 1, target.z); const o = new THREE.Vector3(...PRESETS[this.mode].sun.pos); if (this.sunMul) o.multiply(new THREE.Vector3(...this.sunMul)); this.sun.position.copy(target).add(o); { const fp = PRESETS[this.mode].fillPos || [-4, 2, 3]; this.fill.position.set(target.x + fp[0], fp[1], target.z + fp[2]); } this.rim.position.set(target.x - 2, 3, target.z - 5); this.practical.position.set(target.x - 1.5, 2.3, target.z + 1.9); }
}
