// Camera rig: creator orbit + presets (full body, face close-up, front/side/back), third-person follow,
// mirror, cinematic and phone-selfie cameras. Smoothly damped; never wider than needed.
import * as THREE from 'three';

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const CAMERA_MODES = ['creator', 'full', 'face', 'front', 'side', 'back', 'third', 'mirror', 'cinematic', 'selfie', 'hero', 'beauty', 'portrait'];

export class CameraRig {
  constructor(camera, dom) {
    this.cam = camera; this.dom = dom; this.mode = 'creator'; this.t = 0;
    this.yaw = 0.25; this.pitch = 0.08; this.dist = 4.4; this.fov = 24; this.target = new THREE.Vector3(0, 0.9, 0);
    this.g = { yaw: 0.25, pitch: 0.08, dist: 4.4, fov: 24, target: new THREE.Vector3(0, 0.9, 0) }; this.drag = null; this.userOrbit = true; this.H = 1.68; this.manual = false;
    dom.addEventListener('pointerdown', e => { if (e.target !== dom) return; this.drag = { x: e.clientX, y: e.clientY, id: e.pointerId, pts: new Map() }; dom.setPointerCapture(e.pointerId); });
    dom.addEventListener('pointermove', e => { if (!this.drag || this.drag.id !== e.pointerId) return; const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y; this.drag.x = e.clientX; this.drag.y = e.clientY; this.orbit(dx, dy); });
    dom.addEventListener('pointerup', e => { this.drag = null; }); dom.addEventListener('pointercancel', () => { this.drag = null; });
    dom.addEventListener('wheel', e => { e.preventDefault(); this.zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
    dom.addEventListener('dblclick', () => this.setMode(this.mode === 'face' ? 'full' : 'creator'));
    // pinch zoom
    const tp = new Map(); let pd = 0;
    dom.addEventListener('touchstart', e => { if (e.touches.length === 2) pd = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }, { passive: true });
    dom.addEventListener('touchmove', e => { if (e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); if (pd) this.zoom(pd / d); pd = d; } }, { passive: true }); void tp;
  }
  orbit(dx, dy) { if (!this.userOrbit) { this.mode = 'creator'; this.userOrbit = true; } this.g.yaw -= dx * 0.008; this.g.pitch = Math.max(-0.5, Math.min(1.25, this.g.pitch + dy * 0.006)); this.manual = true; }
  zoom(f) { const lim = this.mode === 'face' ? [0.35, 2.2] : [0.45, 9]; this.g.dist = Math.max(lim[0], Math.min(lim[1], this.g.dist * f)); this.manual = true; }
  setMode(m) { this.mode = m; this.manual = false; this.userOrbit = ['creator', 'full', 'face', 'front', 'side', 'back', 'hero', 'beauty', 'portrait'].includes(m); }
  snap(an) { this.update(100, an); this.update(100, an); }
  setCharacter(ch) { this.ch = ch; this.H = ch.state.body.height / 100; }
  update(dt, an) {
    this.t += dt; const ch = this.ch, H = this.H, g = this.g, root = an.pos, head = ch.rig ? ch.rig.J.head[1] : H * 0.9;
    const yawChar = an.yaw; let tgt = null;
    switch (this.mode) {
      case 'creator': if (!this.manual) { const lg = this.env === 'lagos'; g.dist = (lg ? 6.4 : 5.0) * H / 1.68; g.fov = lg ? 30 : 24; g.pitch = lg ? 0.05 : 0.08; } tgt = [root.x, H * 0.52, root.z]; break;
      case 'full': g.dist = 5.0 * H / 1.68; g.fov = 24; g.pitch = 0.02; if (!this.manual) g.yaw = yawChar + 0.0; tgt = [root.x, H * 0.5, root.z]; this.manual = false; break;
      case 'face': g.dist = this.manual ? g.dist : 0.78; g.fov = 22; if (!this.manual) g.pitch = 0.0; tgt = [root.x, head + 0.045, root.z]; break;
      case 'front': g.yaw = yawChar; g.dist = 5.0 * H / 1.68; g.fov = 24; g.pitch = 0.05; tgt = [root.x, H * 0.52, root.z]; break;
      case 'side': g.yaw = yawChar + Math.PI / 2; g.dist = 5.0 * H / 1.68; g.fov = 24; g.pitch = 0.05; tgt = [root.x, H * 0.52, root.z]; break;
      case 'back': g.yaw = yawChar + Math.PI; g.dist = 5.0 * H / 1.68; g.fov = 24; g.pitch = 0.05; tgt = [root.x, H * 0.52, root.z]; break;
      case 'third': g.yaw = yawChar + Math.PI + 0.25; g.dist = 3.3; g.fov = 40; g.pitch = 0.22; tgt = [root.x, H * 0.62, root.z]; break;
      case 'mirror': g.yaw = yawChar + Math.PI + 0.42; g.dist = 3.3; g.fov = 42; g.pitch = 0.08; tgt = [root.x, H * 0.6, root.z + 1.25]; break;
      case 'cinematic': g.yaw = yawChar + 0.55 + 0.35 * Math.sin(this.t * 0.18); g.dist = 3.0 + 0.5 * Math.sin(this.t * 0.11); g.fov = 32; g.pitch = -0.04 + 0.05 * Math.sin(this.t * 0.13); tgt = [root.x, H * 0.62 + 0.12 * Math.sin(this.t * 0.07), root.z]; break;
      case 'hero': g.yaw = (this.heroYaw ?? 0.0); g.dist = 4.7 * H / 1.68; g.fov = 26; g.pitch = -0.03; tgt = [root.x, H * 0.5, root.z]; this.manual = false; break;
      case 'beauty': g.yaw = (this.heroYaw ?? 0.0) + 0.12; g.dist = 2.5 * H / 1.68; g.fov = 26; g.pitch = 0.02; tgt = [root.x, H * 0.72, root.z]; this.manual = false; break;
      case 'portrait': g.yaw = (this.heroYaw ?? 0.0) + 0.2; g.dist = 1.05; g.fov = 20; g.pitch = 0.0; tgt = [root.x, head + 0.035, root.z]; this.manual = false; break;
      case 'selfie': g.yaw = yawChar; g.dist = 0.62; g.fov = 52; g.pitch = 0.0; tgt = [root.x + Math.sin(yawChar) * 0.0, head + 0.01, root.z]; break;
    }
    if (tgt) g.target.set(...tgt);
    const k = this.drag ? 28 : 6; this.yaw = damp(this.yaw, this.g.yaw, k, dt); this.pitch = damp(this.pitch, g.pitch, k, dt); this.dist = damp(this.dist, g.dist, 5, dt); this.fov = damp(this.fov, g.fov, 4, dt);
    this.target.set(damp(this.target.x, g.target.x, 7, dt), damp(this.target.y, g.target.y, 7, dt), damp(this.target.z, g.target.z, 7, dt));
    const cp = Math.cos(this.pitch);
    this.cam.position.set(this.target.x + Math.sin(this.yaw) * cp * this.dist, this.target.y + Math.sin(this.pitch) * this.dist, this.target.z + Math.cos(this.yaw) * cp * this.dist);
    if (this.mode === 'cinematic') { this.cam.position.x += Math.sin(this.t * 1.7) * 0.006; this.cam.position.y += Math.sin(this.t * 2.3) * 0.005; }
    this.cam.lookAt(this.target); if (Math.abs(this.cam.fov - this.fov) > 0.01) { this.cam.fov = this.fov; this.cam.updateProjectionMatrix(); }
    // gaze target for the character: look at the camera when it's close (selfie/face/mirror), else wander
    const toCam = this.cam.position.clone().sub(new THREE.Vector3(root.x, head, root.z)); const yawTo = Math.atan2(toCam.x, toCam.z) - an.yaw, pitchTo = Math.atan2(toCam.y, Math.hypot(toCam.x, toCam.z));
    an.camTarget = { yaw: Math.max(-0.7, Math.min(0.7, Math.atan2(Math.sin(yawTo), Math.cos(yawTo)))), pitch: Math.max(-0.25, Math.min(0.3, pitchTo)) };
  }
}
