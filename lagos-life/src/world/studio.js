// Studio / fitting-room stage: soft floor, backdrop, curtain, and a REAL planar mirror (Reflector).
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

export class Studio {
  constructor(quality = 'high') {
    this.group = new THREE.Group(); this.group.name = 'Studio';
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
    const gr = g.createRadialGradient(256, 256, 20, 256, 256, 256); gr.addColorStop(0, '#6a625c'); gr.addColorStop(0.55, '#3b3633'); gr.addColorStop(1, '#161413'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1; for (let r = 40; r < 256; r += 40) { g.beginPath(); g.arc(256, 256, r, 0, 7); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: t, roughness: 0.75, metalness: 0 })); this.floor.receiveShadow = true; this.group.add(this.floor);
    // fitting room extras (shown in 'fitting' mode)
    this.room = new THREE.Group(); this.group.add(this.room);
    const curtain = new THREE.MeshStandardMaterial({ color: '#6a2a3a', roughness: 0.95, side: THREE.DoubleSide });
    for (let i = 0; i < 18; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.34, 3.2, 0.06), curtain); f.position.set(-3.1 + i * 0.36, 1.6, -2.4 + Math.sin(i * 1.3) * 0.05); f.rotation.y = Math.sin(i) * 0.08; f.castShadow = true; this.room.add(f); }
    const wallM = new THREE.MeshStandardMaterial({ color: '#b9a48a', roughness: 0.95 }); const back = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.4), wallM); back.position.set(0, 1.7, 2.5); back.rotation.y = Math.PI; this.room.add(back);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.55, 2.35, 0.08), new THREE.MeshStandardMaterial({ color: '#c89a2a', metalness: 0.8, roughness: 0.35 })); frame.position.set(0, 1.25, 2.44); this.room.add(frame);
    const sz = quality === 'low' ? 512 : quality === 'medium' ? 1024 : 2048;
    this.mirror = new Reflector(new THREE.PlaneGeometry(1.4, 2.2), { textureWidth: sz, textureHeight: sz, color: 0xdddddd, clipBias: 0.003 }); this.mirror.position.set(0, 1.25, 2.39); this.mirror.rotation.y = Math.PI; this.room.add(this.mirror);
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.45, 20), new THREE.MeshStandardMaterial({ color: '#3b2a1e', roughness: 0.7 })); stool.position.set(1.4, 0.225, 0.4); stool.castShadow = true; this.room.add(stool);
    this.room.visible = false;
  }
  setFitting(v) { this.room.visible = v; }
}
