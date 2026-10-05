// Fabric materials. Procedural patterns (Ankara wax-print, Aso-oke strip-weave, lace, brocade, sequins)
// + weave bump maps, triplanar-mapped in REST space so patterns never stretch or seam when the body
// deforms. Cloth shading: roughness/sheen per fabric.
import * as THREE from 'three';
import { FABRICS } from '../../data/wardrobe.js';
import { mulberry32 } from '../../core/rng.js';

const cache = new Map();
const mk = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const hexRGB = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const toHex = a => '#' + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => toHex(hexRGB(a).map((v, i) => v + (hexRGB(b)[i] - v) * t));
function hueShift(hex, deg, l = 1) { const [r, g, b] = hexRGB(hex).map(v => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0, L = (mx + mn) / 2; const d = mx - mn;
  if (d) { s = L > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  h = (h + deg + 360) % 360; L = Math.min(0.95, Math.max(0.05, L * l)); s = Math.min(1, s * 1.05);
  const f = n => { const k = (n + h / 30) % 12, a = s * Math.min(L, 1 - L); return L - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return toHex([f(0) * 255, f(8) * 255, f(4) * 255]); }

function plainMap(color, kind) {
  const c = mk(128), g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 128, 128); const r = mulberry32(3);
  if (kind === 'denim') { for (let i = 0; i < 600; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'; g.fillRect(r() * 128, r() * 128, 1, 3 + r() * 6); } }
  else if (kind === 'sequin') { for (let y = 0; y < 128; y += 5) for (let x = (y / 5 % 2) * 2.5; x < 128; x += 5) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(x, y, 2.1, 0, 7); g.fill(); } }
  else for (let i = 0; i < 500; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)'; g.fillRect(r() * 128, r() * 128, 2, 2); }
  return c;
}
function ankara(color, variant) {
  const S = 512, c = mk(S), g = c.getContext('2d'), r = mulberry32(100 + variant * 17);
  const c2 = hueShift(color, 150, 1.0), c3 = '#e9c46a', c4 = mix(color, '#000000', 0.45), c5 = '#f4efe2', c6 = hueShift(color, -60, 1.1);
  g.fillStyle = mix(color, '#000', 0.12); g.fillRect(0, 0, S, S);
  const motif = (x, y, s, kind) => {
    g.save(); g.translate(x, y);
    if (kind === 0) { [[1, c3], [0.78, c4], [0.6, c5], [0.42, c2], [0.2, c3]].forEach(([k, col]) => { g.fillStyle = col; g.beginPath(); g.arc(0, 0, s * k, 0, 7); g.fill(); }); }
    else if (kind === 1) { for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.fillStyle = i % 2 ? c2 : c3; g.beginPath(); g.ellipse(0, -s * 0.62, s * 0.2, s * 0.4, 0, 0, 7); g.fill(); } g.fillStyle = c4; g.beginPath(); g.arc(0, 0, s * 0.28, 0, 7); g.fill(); }
    else if (kind === 2) { g.fillStyle = c6; g.beginPath(); g.moveTo(0, -s); g.quadraticCurveTo(s * 0.9, 0, 0, s); g.quadraticCurveTo(-s * 0.9, 0, 0, -s); g.fill(); g.strokeStyle = c5; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -s * 0.8); g.lineTo(0, s * 0.8); g.stroke(); for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(0, i * s * 0.2); g.lineTo(s * 0.4, i * s * 0.2 - s * 0.15); g.moveTo(0, i * s * 0.2); g.lineTo(-s * 0.4, i * s * 0.2 - s * 0.15); g.stroke(); } }
    else { for (let k = 0; k < 4; k++) { g.strokeStyle = [c3, c5, c2, c4][k]; g.lineWidth = s * 0.14; g.beginPath(); g.arc(0, 0, s * (1 - k * 0.22), 0, 7); g.stroke(); } }
    g.restore();
  };
  const step = 128;
  for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) {
    const x = gx * step + step / 2, y = gy * step + step / 2, k = (variant + gx + gy * 2) % 4, off = (gy % 2) * step / 2;
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) motif(x + off + dx, y + dy, step * (0.34 + 0.06 * ((gx + gy) % 2)), (k + variant) % 4);
  }
  for (let i = 0; i < 90; i++) { g.fillStyle = c5; g.beginPath(); g.arc(r() * S, r() * S, 2 + r() * 2, 0, 7); g.fill(); }
  return c;
}
function lace(color, variant) {
  const S = 256, c = mk(S), g = c.getContext('2d'), r = mulberry32(40 + variant * 13);
  g.clearRect(0, 0, S, S); const ground = mix(color, '#000', 0.2);
  g.fillStyle = ground; g.globalAlpha = 0.5; g.fillRect(0, 0, S, S); g.globalAlpha = 1;
  const motif = col => { for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.fillStyle = col; g.beginPath(); g.ellipse(0, -22, 7, 15, 0, 0, 7); g.fill(); g.beginPath(); g.arc(0, -42, 3, 0, 7); g.fill(); } g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill(); };
  const col = mix(color, '#ffffff', 0.35);
  for (let y = 0; y <= 2; y++) for (let x = 0; x <= 2; x++) for (const [ox, oy] of [[0, 0], [S / 2, S / 2]]) { g.save(); g.translate(x * S / 2 + ox - (ox ? S / 2 : 0) + (variant % 2 ? 20 : 0), y * S / 2 + oy - (oy ? S / 2 : 0)); if (ox === 0) motif(col); g.restore(); }
  g.strokeStyle = col; g.lineWidth = 2.2; for (let k = 0; k < 8; k++) { g.beginPath(); for (let t = 0; t <= S; t += 8) { const y = k * 32 + 16 + Math.sin(t * 0.09 + k + variant) * 7; t ? g.lineTo(t, y) : g.moveTo(t, y); } g.stroke(); }
  // scalloped border dots
  for (let i = 0; i < 160; i++) { g.fillStyle = col; g.beginPath(); g.arc(r() * S, r() * S, 1.5, 0, 7); g.fill(); }
  return c;
}
function asooke(color, variant) {
  const W = 256, c = mk(W), g = c.getContext('2d'), r = mulberry32(7 + variant * 5);
  const gold = '#e0b35a', c2 = hueShift(color, 40 + variant * 25, 0.9), c3 = mix(color, '#fff', 0.2);
  for (let x = 0; x < W; x += 32) { g.fillStyle = (x / 32) % 2 ? mix(color, '#000', 0.15) : color; g.fillRect(x, 0, 32, W); }
  for (let x = 0; x < W; x += 32) { g.fillStyle = gold; g.fillRect(x + 14, 0, 2, W); g.fillStyle = c2; g.fillRect(x + 4, 0, 3, W); }
  for (let y = 0; y < W; y += 16) for (let x = 0; x < W; x += 32) { g.fillStyle = (y / 16 + variant) % 2 ? gold : c3; g.fillRect(x + 8, y + 3, 14, 4); if ((x / 32 + y / 16) % 3 === variant % 3) { g.fillStyle = c2; g.fillRect(x + 6, y + 8, 18, 3); } }
  for (let i = 0; i < 1200; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'; g.fillRect(r() * W, r() * W, 1, 5); }
  return c;
}
function brocade(color, variant) {
  const S = 256, c = mk(S), g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, S, S); const hi = mix(color, '#fff', 0.28), lo = mix(color, '#000', 0.25);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.save(); g.translate(x * 128 + 64, y * 128 + 64 + (variant ? 10 : 0)); g.fillStyle = hi; for (let i = 0; i < 6; i++) { g.rotate(Math.PI / 3); g.beginPath(); g.ellipse(0, -28, 11, 26, 0, 0, 7); g.fill(); } g.fillStyle = lo; g.beginPath(); g.arc(0, 0, 12, 0, 7); g.fill(); g.restore(); }
  return c;
}
function bumpFor(kind) {
  const S = 128, c = mk(S), g = c.getContext('2d'), r = mulberry32(9); g.fillStyle = '#808080'; g.fillRect(0, 0, S, S);
  const grid = (n, a) => { g.fillStyle = `rgba(255,255,255,${a})`; for (let y = 0; y < S; y += S / n) for (let x = 0; x < S; x += S / n) g.fillRect(x, y, S / n / 2, S / n / 2); g.fillStyle = `rgba(0,0,0,${a})`; for (let y = S / n / 2; y < S; y += S / n) for (let x = S / n / 2; x < S; x += S / n) g.fillRect(x, y, S / n / 2, S / n / 2); };
  if (kind === 'cotton' || kind === 'linen' || kind === 'asooke' || kind === 'ankara') grid(kind === 'linen' ? 16 : 32, 0.35);
  else if (kind === 'denim' || kind === 'twill') { g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 2; for (let i = -S; i < S * 2; i += 6) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke(); } }
  else if (kind === 'jersey' || kind === 'knit') { g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 2.5; for (let y = 0; y < S; y += 8) for (let x = 0; x < S; x += 8) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4, y + 7); g.lineTo(x + 8, y); g.stroke(); } }
  else if (kind === 'leather') { for (let i = 0; i < 700; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.2)'; g.beginPath(); g.arc(r() * S, r() * S, 1 + r() * 2, 0, 7); g.fill(); } }
  else if (kind === 'sequin') { for (let y = 0; y < S; y += 5) for (let x = (y / 5 % 2) * 2.5; x < S; x += 5) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.arc(x + 1.2, y + 1.2, 1.2, 0, 7); g.fill(); } }
  else if (kind === 'lace') { g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 3; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(S / 2, S / 2, 14 + k * 14, 0, 7); g.stroke(); } }
  else if (kind === 'brocade') grid(16, 0.25);
  else if (kind === 'satin' || kind === 'rubber') { for (let i = 0; i < 200; i++) { g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(r() * S, r() * S, 1, 10); } }
  return c;
}
const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; return t; };

export function fabricMaps(fabric, color, variant) {
  const key = `${fabric}|${color}|${variant}`; if (cache.has(key)) return cache.get(key);
  const F = FABRICS[fabric] || FABRICS.cotton; let canvas;
  switch (F.pattern) { case 'ankara': canvas = ankara(color, variant); break; case 'lace': canvas = lace(color, variant); break; case 'asooke': canvas = asooke(color, variant); break; case 'brocade': canvas = brocade(color, variant); break; default: canvas = plainMap(color, fabric); }
  const bk = `bump|${fabric}`; if (!cache.has(bk)) cache.set(bk, tex(bumpFor(fabric), false));
  const out = { map: tex(canvas), bump: cache.get(bk), tile: F.pattern === 'ankara' ? 0.26 : F.pattern === 'lace' ? 0.14 : F.pattern === 'asooke' ? 0.2 : F.pattern === 'brocade' ? 0.16 : (F.scale ? 8 / F.scale : 0.1) };
  cache.set(key, out); return out;
}

// Triplanar cloth material (rest-space mapping => no stretching under deformation)
export function createFabricMaterial(fabric, color, variant) {
  const F = FABRICS[fabric] || FABRICS.cotton, m = fabricMaps(fabric, color, variant);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: F.rough, metalness: F.metal || 0, sheen: F.sheen * 0.45, sheenRoughness: 0.6, sheenColor: new THREE.Color(color).lerp(new THREE.Color(1, 1, 1), 0.15),
    side: THREE.DoubleSide, transparent: !!F.alpha, alphaTest: F.alpha ? 0.02 : 0, depthWrite: !F.alpha });
  if (fabric === 'satin') { mat.clearcoat = 0.08; mat.clearcoatRoughness = 0.5; mat.roughness = 0.42; }
  if (fabric === 'asooke' || fabric === 'brocade') { mat.metalness = 0.08; }
  const U = { uMap: { value: m.map }, uBump: { value: m.bump }, uTile: { value: m.tile }, uBumpScale: { value: fabric === 'satin' ? 0.1 : fabric === 'lace' ? 0.5 : 0.7 }, uAlpha: { value: F.alpha ? 1 : 0 } };
  mat.userData.U = U;
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aRest; varying vec3 vRestP; varying vec3 vRestN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRestP = aRest; vRestN = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vRestP; varying vec3 vRestN; uniform sampler2D uMap, uBump; uniform float uTile, uBumpScale;
      vec4 tri( sampler2D t, vec3 p, vec3 n ) { vec3 w = pow( abs( n ), vec3( 4.0 ) ); w /= ( w.x + w.y + w.z ); return texture2D( t, p.zy / uTile ) * w.x + texture2D( t, p.xz / uTile ) * w.y + texture2D( t, p.xy / uTile ) * w.z; }
      vec3 clothPerturb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
        vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) ); vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) ); vec3 vN = surf_norm;
        vec3 R1 = cross( vSigmaY, vN ); vec3 R2 = cross( vN, vSigmaX ); float fDet = dot( vSigmaX, R1 ) * faceDirection;
        vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 ); return normalize( abs( fDet ) * surf_norm - vGrad ); }`)
      .replace('#include <map_fragment>', 'vec4 tc = tri( uMap, vRestP, normalize( vRestN ) ); diffuseColor *= tc;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float h = tri( uBump, vRestP, normalize( vRestN ) ).r; vec2 dh = vec2( dFdx( h ), dFdy( h ) ) * uBumpScale * 0.012; normal = clothPerturb( - vViewPosition, normal, dh, faceDirection ); }`);
  };
  mat.customProgramCacheKey = () => 'cloth-v1' + (F.alpha ? 'a' : '');
  return mat;
}
export function createSoleMaterial(color) { return new THREE.MeshStandardMaterial({ color, roughness: 0.7 }); }
