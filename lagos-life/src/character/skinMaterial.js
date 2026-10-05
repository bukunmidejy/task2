// Skin shading. A physically based material (GGX specular, sheen for vellus hair) extended with:
//  - cheap subsurface scattering: wrapped diffuse + a warm red scatter fringe at the light terminator
//    (this is what keeps dark skin warm and alive instead of grey), plus tinted indirect light
//  - procedural pore / micro-relief normal detail (fades with distance to avoid shimmer)
//  - low-frequency albedo variation, wetness (rain) response
// Colours come from core/skincolor.js (OKLCH) so tone/undertone stay consistent head-to-toe.
import * as THREE from 'three';
import { skinPalette } from '../core/skincolor.js';

const GLSL_NOISE = /* glsl */`
float skHash(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float skNoise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(skHash(i),skHash(i+vec3(1,0,0)),f.x),mix(skHash(i+vec3(0,1,0)),skHash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(skHash(i+vec3(0,0,1)),skHash(i+vec3(1,0,1)),f.x),mix(skHash(i+vec3(0,1,1)),skHash(i+vec3(1,1,1)),f.x),f.y),f.z); }
float skPores(vec3 p, float fade){
  float a = skNoise(p*1900.0), b = skNoise(p*700.0), c = skNoise(p*260.0);
  float pores = smoothstep(0.62, 0.9, a) * 0.8;                 // dimples
  return (-pores*fade + (b-0.5)*0.55*fade + (c-0.5)*0.9);        // fine + medium relief
}`;

export function createSkinUniforms() {
  return { uSssColor: { value: new THREE.Color(0.6, 0.12, 0.05) }, uSss: { value: 0.7 }, uPore: { value: 1.0 }, uWet: { value: 0 }, uVar: { value: 0.05 } };
}

export function createSkinMaterial({ uniforms, map = null, roughMap = null, thin = 0 } = {}) {
  const U = uniforms || createSkinUniforms();
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: roughMap ? 1 : 0.52, metalness: 0, specularIntensity: 0.75,
    sheen: 0.18, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.5, 0.35, 0.28), clearcoat: 0.04, clearcoatRoughness: 0.4,
    map, roughnessMap: roughMap,
  });
  mat.userData.uniforms = U;
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSkinPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSkinPos = position;');
    let chunk = THREE.ShaderChunk.lights_physical_pars_fragment;
    chunk = chunk.replace('reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
      `reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
       { float nl = dot( geometryNormal, directLight.direction );
         float band = smoothstep( -0.30, 0.04, nl ) * ( 1.0 - smoothstep( 0.04, 0.60, nl ) );
         float wrap = max( 0.0, ( nl + 0.28 ) / 1.28 ) - max( nl, 0.0 );
         vec3 sc = uSssColor * material.diffuseColor;
         reflectedLight.directDiffuse += directLight.color * ( band * 1.5 + wrap * 0.55 ) * uSss * sc * RECIPROCAL_PI; }`);
    chunk = chunk.replace('reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
      'reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor ) * ( vec3( 1.0 ) + uSss * 0.35 * uSssColor );');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vSkinPos; uniform vec3 uSssColor; uniform float uSss, uPore, uWet, uVar;\n${GLSL_NOISE}
        vec3 skinPerturb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
          vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) ); vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) ); vec3 vN = surf_norm;
          vec3 R1 = cross( vSigmaY, vN ); vec3 R2 = cross( vN, vSigmaX ); float fDet = dot( vSigmaX, R1 ) * faceDirection;
          vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 ); return normalize( abs( fDet ) * surf_norm - vGrad ); }`)
      .replace('#include <lights_physical_pars_fragment>', chunk)
      .replace('#include <color_fragment>', `#include <color_fragment>\n diffuseColor.rgb *= 1.0 + uVar * ( skNoise( vSkinPos * 38.0 ) - 0.5 ) * 2.0;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n roughnessFactor = mix( roughnessFactor, 0.16, uWet ); diffuseColor.rgb *= 1.0 - 0.14 * uWet;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float fw = length( fwidth( vSkinPos ) ); float fade = 1.0 - smoothstep( 0.0006, 0.0021, fw );
          float h = skPores( vSkinPos, fade );
          vec2 dh = vec2( dFdx( h ), dFdy( h ) ) * 0.0016 * uPore;
          normal = skinPerturb( - vViewPosition, normal, dh, faceDirection ); }`);
  };
  mat.customProgramCacheKey = () => 'skin-v3' + (map ? 'm' : '') + (roughMap ? 'r' : '');
  return mat;
}

// Push palette (tone + undertone) into the shared uniforms / materials.
export function applySkinPalette(mats, uniforms, skin) {
  const p = skinPalette(skin);
  for (const m of mats) {
    // textured skin (face): the map carries colour, material tint stays white; untextured: tint is the base colour
    if (!m.map) m.color.setRGB(p.base[0], p.base[1], p.base[2]);
    m.specularColor = new THREE.Color(p.spec[0], p.spec[1], p.spec[2]);
    m.roughness = m.roughnessMap ? 1 : 0.5 - 0.18 * skin.oil;
    m.sheenColor.setRGB(p.base[0] * 1.2 + 0.04, p.base[1] * 1.15 + 0.03, p.base[2] * 1.1 + 0.03);
    m.needsUpdate = true;
  }
  uniforms.uSssColor.value.setRGB(p.sss[0], p.sss[1], p.sss[2]);
  uniforms.uSss.value = 0.5 + 0.3 * (1 - skin.depth * 0.6);
  return p;
}
