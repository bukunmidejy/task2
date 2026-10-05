// Procedural animation: idle (breathing, weight shift, micro-motion), look-around, blinking,
// walk/run with PLANTED-FOOT two-bone IK (no floating, no foot skate), turning, stopping, hand poses,
// facial expressions. Poses are written onto the Character's bones every frame.
import * as THREE from 'three';
import { FINGERS } from './rig.js';
import { setBlink, setGaze } from './eyes.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Q = () => new THREE.Quaternion();
const ease = t => t * t * (3 - 2 * t);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const eul = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ'));
const UP = V(0, 1, 0);

function basis(dir, fwd) { // frame with +Y = dir, +Z ~ fwd
  const y = dir.clone().normalize(), x = new THREE.Vector3().crossVectors(y, fwd).normalize(), z = new THREE.Vector3().crossVectors(x, y).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

export const EXPRESSIONS = {
  neutral: { smile: 0, brow: 0, squint: 0 }, soft: { smile: 0.45, brow: 0.1, squint: 0.15 }, smile: { smile: 1, brow: 0.2, squint: 0.35 },
  serious: { smile: -0.25, brow: -0.45, squint: 0.1 }, surprised: { smile: 0.1, brow: 1, squint: -0.2 }, smize: { smile: 0.15, brow: 0, squint: 0.7 },
};

export class Animator {
  constructor(ch) {
    this.ch = ch; this.t = 0;
    this.input = { speed: 0, heading: 0, run: false };      // desired world speed (0..), desired heading (rad)
    this.pos = V(); this.yaw = 0; this.vel = 0; this.turnRate = 0;
    this.phase = 0; this.moving = 0;                         // 0 idle .. 1 locomotion blend
    this.feet = [0, 1].map(() => ({ mode: 'stance', plant: V(), start: V(), target: V(), t: 0 }));
    this.gaze = { yaw: 0, pitch: 0, ty: 0, tp: 0, next: 1, eyeY: 0, eyeP: 0 };
    this.blink = { next: 2.5, t: -1 };
    this.expr = { ...EXPRESSIONS.neutral }; this.exprTarget = { ...EXPRESSIONS.neutral };
    this.handPose = { L: 'relaxed', R: 'relaxed' }; this.fingerCurl = { L: 0.3, R: 0.3 };
    this.gesture = null; this.pose = 'stand'; this.camTarget = null; this.wind = V(); this.rain = 0;
    this.hero = null; this.autoExpr = false; this.exprT = 2; this.headVel = V(); this._lastHead = null; this.resetFeet();
  }
  setExpression(name) { this.exprTarget = { ...(EXPRESSIONS[name] || EXPRESSIONS.neutral) }; }
  gestureWave() { this.gesture = { name: 'wave', t: 0, dur: 2.6 }; }
  setHeroPose(p) { this.hero = p; if (p && p.bodyYaw !== undefined) { this.yaw = p.bodyYaw; this.input.heading = p.bodyYaw; } this.resetFeet(); }
  resetFeet() { if (!this.ch.rig) return; this._placeFeetAtRest(); }
  _placeFeetAtRest() {
    const J = this.ch.rig.J, c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    this.feet.forEach((f, i) => { const sg = i === 0 ? 1 : -1, lx = sg * Math.abs(J.footL[0]) * (this.hero ? 1.12 : 1), lz = J.footL[2] + (this.hero && i === 0 ? this.hero.footFwd || 0 : 0) - (this.hero && i === 1 ? (this.hero.footFwd || 0) * 0.3 : 0); f.plant.set(this.pos.x + lx * c + lz * s, 0, this.pos.z - lx * s + lz * c); f.mode = 'stance'; f.restPlant = true; });
  }

  update(dt) {
    const ch = this.ch; if (!ch.rig) return; dt = Math.min(dt, 0.05); this.t += dt;
    const { J, L } = ch.rig, B = ch.bones, t = this.t;
    // ------------------------------------------------ locomotion state
    const spdTarget = this.input.speed; this.vel = damp(this.vel, spdTarget, spdTarget > this.vel ? 5 : 7, dt);
    if (this.vel < 0.02 && spdTarget === 0) this.vel = 0;
    // turn toward heading with smoothing + lean
    let dy = ((this.input.heading - this.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    const turnSpeed = this.vel > 0.1 ? 4.5 : (Math.abs(dy) > 0.02 && this.input.turnInPlace ? 3 : 0);
    const dyaw = Math.sign(dy) * Math.min(Math.abs(dy), turnSpeed * dt * (0.4 + Math.min(1, Math.abs(dy))));
    this.yaw += dyaw; this.turnRate = damp(this.turnRate, dyaw / Math.max(dt, 1e-4), 8, dt);
    const fwd = V(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.pos.addScaledVector(fwd, this.vel * dt);
    const moving = this.vel > 0.05; this.moving = damp(this.moving, moving ? 1 : 0, moving ? 8 : 6, dt);
    const run = Math.min(1, Math.max(0, (this.vel - 1.7) / 1.4));
    const sc = L.s, legL = (J.upperLegL[1] - J.footL[1]);
    // gait timing
    const stepLen = (0.40 + 0.20 * run) * L.H * 0.95 * (ch.gaitScale || 1), cadence = this.vel / Math.max(stepLen, 0.2); // steps/s
    const cyc = Math.max(0.0001, cadence / 2); if (moving) this.phase = (this.phase + cyc * dt) % 1;
    const sf = 0.62 - 0.26 * run;                 // stance fraction
    // ------------------------------------------------ idle micro-motion
    const breathe = Math.sin(t * 1.55) * 0.5 + 0.5, sway = Math.sin(t * 0.8) * 0.5, sway2 = Math.sin(t * 0.37 + 1.3);
    const H0 = this.hero || {}; const shiftX = (1 - this.moving) * (0.011 * sway + 0.004 * sway2 + (H0.shift || 0));
    // ------------------------------------------------ hips / pelvis
    const hipsRest = V(...J.hips), hipsPos = hipsRest.clone();
    let pelvisYaw = 0, pelvisRoll = 0, pelvisPitch = 0, spineYaw = 0, spineRoll = 0, lean = 0;
    const ph = this.phase, w = this.moving;
    pelvisYaw = w * 0.09 * Math.sin(ph * 2 * Math.PI) * (1 + run); pelvisRoll = w * 0.04 * Math.sin(ph * 2 * Math.PI + Math.PI / 2) + shiftX * -1.6 + (1 - w) * (H0.roll || 0);
    spineYaw = -pelvisYaw * 1.4; spineRoll = -pelvisRoll * 0.6;
    pelvisPitch = w * (0.02 + 0.13 * run) + (1 - w) * 0.0;
    lean = -this.turnRate * 0.015 * w;
    // ------------------------------------------------ feet (planted IK)
    const rootQ = eul(0, this.yaw, 0), hipsQ = rootQ.clone().multiply(eul(pelvisPitch * 0.4, pelvisYaw, pelvisRoll));
    const hipW = i => { const sg = i === 0 ? 1 : -1; return V(...(i === 0 ? J.upperLegL : J.upperLegR)).sub(hipsRest); };
    const worldOf = (v, y = 0) => V(this.pos.x + v.x * Math.cos(this.yaw) + v.z * Math.sin(this.yaw), y, this.pos.z - v.x * Math.sin(this.yaw) + v.z * Math.cos(this.yaw));
    const restAnkleLocal = i => { const sg = i === 0 ? 1 : -1; return V(sg * Math.abs(J.footL[0]), J.footL[1], J.footL[2]); };
    const lift = 0.07 + 0.08 * run, plantY = ch.heelData?.plantY || 0, heelLiftA = ch.heelData?.angle || 0;
    const targets = [V(), V()], footPitch = [0, 0], toePitch = [0, 0];
    for (let i = 0; i < 2; i++) {
      const f = this.feet[i], p = (ph + (i === 0 ? 0 : 0.5)) % 1;
      const rest = restAnkleLocal(i);
      if (w < 0.02) {
        // idle: foot stays planted in the world; if the body has drifted (just stopped) ease toward the rest stance
        if (!f.restPlant) { const tgt = worldOf(rest, 0); f.plant.lerp(tgt, 1 - Math.exp(-6 * dt)); if (f.plant.distanceTo(tgt) < 0.004) { f.plant.copy(tgt); f.restPlant = true; } }
        targets[i].set(f.plant.x, J.footL[1] + plantY, f.plant.z); continue;
      }
      f.restPlant = false;
      const mode = p < sf ? 'stance' : 'swing';
      if (mode !== f.mode) {
        if (mode === 'swing') { f.start.copy(f.plant); f.T = (1 - sf) / Math.max(cyc, 0.01); }
        else { f.plant.copy(f.target); }
        f.mode = mode;
      }
      const Tsw = (1 - sf) / Math.max(cyc, 0.01);
      if (mode === 'swing') {
        const u = (p - sf) / (1 - sf);
        // landing spot: ahead of the body half a step, where the body will be at touch-down
        const land = this.pos.clone().addScaledVector(fwd, this.vel * Tsw * (1 - u) + stepLen * 0.5 * (0.9 + 0.2 * run));
        const lat = worldOf(V(rest.x, 0, 0)).sub(worldOf(V(0, 0, 0)));
        land.add(lat).y = 0;
        f.target.lerp(land, 0.35);
        const e = ease(u), e2 = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        targets[i].copy(f.start).lerp(f.target, e2); targets[i].y = J.footL[1] + Math.sin(Math.PI * Math.pow(u, 0.8)) * lift * (1 - 0.3 * u) + plantY;
        footPitch[i] = u < 0.5 ? 0.38 * Math.sin(Math.PI * u * 2) : -0.30 * Math.sin(Math.PI * (u - 0.5) * 2); // toe-down at push-off, toe-up before heel strike
        toePitch[i] = u < 0.25 ? 0.5 * (1 - u * 4) : 0;
        void e;
      } else {
        const u = (p) / sf, pl = f.plant;
        // roll: heel strike -> flat -> heel lift
        const heelUp = u > 0.72 ? ease((u - 0.72) / 0.28) : 0;
        targets[i].set(pl.x, J.footL[1] + plantY + heelUp * 0.045, pl.z);
        footPitch[i] = u < 0.12 ? -0.28 * (1 - u / 0.12) : heelUp * 0.55;
        toePitch[i] = heelUp * 0.55;
        // plant continues from the last swing target
      }
    }
    // hips height: compress the body just enough that both legs reach (natural walking bob)
    const legLen = Math.hypot(J.lowerLegL[0] - J.upperLegL[0], J.lowerLegL[1] - J.upperLegL[1], J.lowerLegL[2] - J.upperLegL[2]) + Math.hypot(J.footL[0] - J.lowerLegL[0], J.footL[1] - J.lowerLegL[1], J.footL[2] - J.lowerLegL[2]);
    let hy = hipsRest.y - (0.004 + 0.012 * w * (1 + run)) - 0.004 * breathe * (1 - w);
    for (let i = 0; i < 2; i++) {
      const hw = hipW(i).applyQuaternion(hipsQ); const hx = this.pos.x + 0, T = targets[i];
      const hipWorld = V(this.pos.x, 0, this.pos.z).add(hw.clone().setY(0)).setY(0);
      const dxz = Math.hypot(T.x - (this.pos.x + hw.x), T.z - (this.pos.z + hw.z)); void hx; void hipWorld;
      const dyMax = Math.sqrt(Math.max(0.0001, (legLen * 0.985) ** 2 - dxz * dxz));
      const need = T.y + dyMax - (hw.y - 0); // hips y such that hip joint is at T.y + dyMax
      hy = Math.min(hy, need - (hipsRest.y - 0) + hipsRest.y - (0));
      hy = Math.min(hy, T.y + dyMax - (J.upperLegL[1] - J.hips[1]));
    }
    hipsPos.y = hy + (this.input.crouch || 0) * -0.3; hipsPos.x += shiftX * 0.9; hipsPos.z += w * 0.0;
    // root + hips
    ch.root.position.copy(this.pos); ch.root.rotation.set(0, this.yaw, 0);
    B.hips.position.set(hipsPos.x - 0, hipsPos.y - 0, hipsPos.z - 0);
    B.hips.quaternion.copy(eul(pelvisPitch * 0.4, pelvisYaw, pelvisRoll));
    // two-bone IK for each leg (in character-local space; world feet targets converted to root-local)
    const invRoot = rootQ.clone().invert(), hipsLocalQ = B.hips.quaternion.clone();
    for (let i = 0; i < 2; i++) {
      const sd = i === 0 ? 'L' : 'R', sg = i === 0 ? 1 : -1;
      const hipJoint = V(...J[`upperLeg${sd}`]).sub(hipsRest).applyQuaternion(hipsLocalQ).add(hipsPos);       // character space
      const T = targets[i].clone().sub(this.pos).applyQuaternion(invRoot);                                       // character space
      const a = V(...J[`lowerLeg${sd}`]).distanceTo(V(...J[`upperLeg${sd}`])), b = V(...J[`foot${sd}`]).distanceTo(V(...J[`lowerLeg${sd}`]));
      const d = T.clone().sub(hipJoint), dist = THREE.MathUtils.clamp(d.length(), Math.abs(a - b) + 0.01, a + b - 0.002), u = d.clone().normalize();
      const x = (dist * dist + a * a - b * b) / (2 * dist), hh = Math.sqrt(Math.max(0, a * a - x * x));
      const pole = V(sg * 0.12, 0, 1).applyQuaternion(hipsLocalQ); pole.addScaledVector(u, -pole.dot(u)).normalize();
      const knee = hipJoint.clone().addScaledVector(u, x).addScaledVector(pole, hh);
      const d0 = V(...J[`lowerLeg${sd}`]).sub(V(...J[`upperLeg${sd}`])).normalize(), d0b = V(...J[`foot${sd}`]).sub(V(...J[`lowerLeg${sd}`])).normalize();
      const f0 = V(0, 0, 1);
      const qThigh = basis(knee.clone().sub(hipJoint), pole).multiply(basis(d0, f0).invert());
      const qShin = basis(T.clone().sub(knee), pole).multiply(basis(d0b, f0).invert());
      B[`upperLeg${sd}`].quaternion.copy(hipsLocalQ.clone().invert().multiply(qThigh));
      B[`lowerLeg${sd}`].quaternion.copy(qThigh.clone().invert().multiply(qShin));
      // foot: stays aligned with the character heading, pitched by gait roll; toe bends at push-off
      const heelLift = -heelLiftA;
      const qFoot = eul(footPitch[i] - heelLift, sg * -0.08 * (1 - w), 0);
      B[`foot${sd}`].quaternion.copy(qShin.clone().invert().multiply(qFoot));
      B[`toe${sd}`].quaternion.copy(eul(-toePitch[i] + heelLift * 0.0, 0, 0));
    }
    // ------------------------------------------------ spine, chest, neck, head
    const br = breathe * 0.5, torsoSlouch = -ch.state.body.posture * 0.045 + 0.02;
    B.spine.quaternion.copy(eul(torsoSlouch * 0.5 + pelvisPitch * 0.3 - pelvisPitch * 0.4, spineYaw * 0.5, spineRoll + lean));
    B.chest.quaternion.copy(eul(torsoSlouch * 0.6 + br * 0.015, spineYaw * 0.5 - this.turnRate * 0.01 * w, spineRoll * 0.7));
    B.chest.scale.set(1 + br * 0.006, 1 + br * 0.004, 1 + br * 0.014);
    // gaze: wander with eye leading the head
    const g = this.gaze; g.next -= dt;
    if (g.next <= 0) {
      g.next = 1.8 + Math.random() * 3.6;
      if (this.camTarget && Math.random() < 0.55) { g.ty = this.camTarget.yaw; g.tp = this.camTarget.pitch; } else { g.ty = (Math.random() - 0.5) * 0.9; g.tp = (Math.random() - 0.5) * 0.35; }
      g.saccade = 0.12;
    }
    g.eyeY = damp(g.eyeY, g.ty, 14, dt); g.eyeP = damp(g.eyeP, g.tp, 14, dt);
    g.yaw = damp(g.yaw, g.ty * 0.55, 3.2, dt); g.pitch = damp(g.pitch, g.tp * 0.5, 3.2, dt);
    const lookW = 1 - w * 0.6;
    const headYaw = g.yaw * lookW - pelvisYaw - spineYaw * 0.6 + (this.input.look ? this.input.look.yaw : 0), headPitch = g.pitch * lookW + (ch.state.body.posture < 0 ? 0.05 : 0) - 0.02;
    B.neck.quaternion.copy(eul(headPitch * 0.4 - torsoSlouch * 0.3, headYaw * 0.45, -spineRoll * 0.5));
    B.head.quaternion.copy(eul(headPitch * 0.6 + torsoSlouch * 0.15, headYaw * 0.55, -spineRoll * 0.4 + Math.sin(t * 0.5) * 0.012 * (1 - w) + (1 - w) * (H0.headRoll || 0)));
    // clavicles
    for (const sd of ['L', 'R']) B[`clav${sd}`].quaternion.copy(eul(0, 0, (sd === 'L' ? -1 : 1) * (0.015 * br)));
    // ------------------------------------------------ arms
    for (let i = 0; i < 2; i++) {
      const sd = i === 0 ? 'L' : 'R', sg = i === 0 ? 1 : -1, opp = i === 0 ? 0.5 : 0;
      const sw = Math.sin((ph + opp) * 2 * Math.PI) * w * (0.38 + 0.5 * run) * (sg > 0 ? 1 : 1);
      const armIn = 0.19 + 0.05 * Math.sin(t * 0.6 + i) * (1 - w) - 0.05 * run;
      let ua = eul(-sw * (i === 0 ? 1 : 1) - 0.03, 0, -sg * armIn), fa = eul(-(0.14 + 0.2 * Math.abs(sw) + 0.5 * run + 0.03 * Math.sin(t * 1.1 + i)), 0, 0), ha = eul(0, 0, 0);
      if (H0.armBend) fa = eul(-(0.14 + H0.armBend + 0.03 * Math.sin(t * 1.1 + i)), 0, 0);
      if (H0.handHip === sd && w < 0.1) { ua = eul(0.3, 0, sg * 0.35); fa = eul(-1.0, -sg * 1.0, -sg * 0.2); ha = eul(0, 0, 0); }
      if (this.pose === 'selfie' && sd === 'R') { ua = eul(-0.85, 0, -sg * 0.55); fa = eul(-1.95, 0, 0.0); ha = eul(-0.2, 0, 0); }
      if (this.pose === 'handsHips') { ua = eul(0.3, 0, sg * 0.35); fa = eul(-1.0, -sg * 1.0, -sg * 0.2); }
      if (this.handPose[sd] === 'holdBag') { fa = eul(-0.9, 0, 0); }
      if (this.gesture && this.gesture.name === 'wave' && sd === 'R') {
        const gp = this.gesture, k = Math.min(1, gp.t / 0.4) * Math.min(1, (gp.dur - gp.t) / 0.4);
        ua = eul(0, 0, sg * -0.0).multiply(eul(0, 0, -sg * (0.19 + k * 2.1))); fa = eul(-0.3 * k - 0.14 * (1 - k), 0, 0).multiply(eul(0, 0, 0)); ha = eul(0, 0, Math.sin(t * 9) * 0.4 * k);
      }
      B[`upperArm${sd}`].quaternion.copy(ua); B[`foreArm${sd}`].quaternion.copy(fa); B[`hand${sd}`].quaternion.copy(ha);
      // fingers: relaxed natural curl, with micro motion
      const curl = this.fingerCurl[sd] + 0.04 * Math.sin(t * 0.9 + i * 2);
      FINGERS.forEach((f, fi) => {
        const base = f === 'thumb' ? [0.12, 0.2, 0.2] : [0.12 + 0.04 * fi, 0.32 + 0.03 * fi, 0.26];
        for (let k = 1; k <= 3; k++) {
          const ang = base[k - 1] * (0.6 + curl * 1.2) * -sg * (f === 'thumb' ? 0.6 : 1);
          B[`${f}${k}${sd}`].quaternion.copy(f === 'thumb' ? eul(0, ang * 0.7, 0) : eul(0, 0, ang));
        }
      });
    }
    if (this.gesture) { this.gesture.t += dt; if (this.gesture.t > this.gesture.dur) this.gesture = null; }
    // ------------------------------------------------ face: blink + expression
    const bk = this.blink; bk.next -= dt;
    if (bk.next <= 0 && bk.t < 0) { bk.t = 0; bk.next = 2 + Math.random() * 4.5; if (Math.random() < 0.18) bk.next = 0.35; }
    let blinkAmt = 0; if (bk.t >= 0) { bk.t += dt; const d = 0.17, u = bk.t / d; blinkAmt = u < 0.45 ? ease(u / 0.45) : ease(Math.max(0, 1 - (u - 0.45) / 0.55)); if (u >= 1) bk.t = -1; }
    if (this.autoExpr) { this.exprT -= dt; if (this.exprT <= 0) { const r = Math.random(); this.setExpression(r < 0.45 ? 'soft' : r < 0.7 ? 'smile' : r < 0.85 ? 'smize' : 'neutral'); this.exprT = 2.2 + Math.random() * 3.5; } }
    for (const k of Object.keys(this.expr)) this.expr[k] = damp(this.expr[k], this.exprTarget[k], 7, dt);
    const ex = this.expr;
    ch.eyes?.forEach((e, i) => {
      const lidDown = Math.max(0, -g.eyeP) * 0.0 + Math.max(0, -g.eyeP) * 0.25;
      setBlink(e, Math.min(1, blinkAmt + lidDown), Math.max(0, ex.squint));
      setGaze(e, g.eyeY - g.yaw * 0.9 - headYaw * 0.0 + (i ? -1 : 1) * 0.0, g.eyeP - g.pitch * 0.9);
    });
    ch.setMorph?.(ex);
    // ------------------------------------------------ head velocity for hair physics
    ch.root.updateMatrixWorld(true); ch.hair.update(dt);
  }
}
