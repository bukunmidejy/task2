# Lagos Life — Phase 1: The Character Look Test

Goal of this phase: prove one promise — **"that is my character."** A real-time, realistic-looking
human the player builds, dresses, animates and sees in Lagos — one canonical character state, used
everywhere.

See [`docs/PHASE1_REPORT.md`](docs/PHASE1_REPORT.md) for the honest status report (what works, what
does not reach target quality, asset requirements, performance, and the exact next phase).

## Run it

```bash
cd lagos-life
npm install
npm run dev          # http://localhost:5173   (use ?quality=high|medium|low)
npm test             # schema + skin-colour unit tests (node:test)
npm run build        # production bundle in dist/
```

Requires a WebGL2 browser. Desktop Chrome/Edge/Firefox/Safari; phones work at `Medium`/`Low`.

## What is in the prototype

| Area | Where |
|---|---|
| Canonical character state (schema, validation, migration, fingerprint) | `src/core/schema.js`, `src/data/params.js` |
| Skin colour model (OKLCH, undertones, never-grey guard) | `src/core/skincolor.js` |
| Body + hands (SDF → marching cubes, skinned) | `src/character/body.js`, `rig.js`, `sdf.js` |
| Face (SDF with carved sockets/nostrils/lips, 35 sliders) | `src/character/head.js` |
| Skin shader (SSS, pores, undertone specular) + painted face/makeup | `skinMaterial.js`, `faceTexture.js` |
| Eyes, lids, lashes, ears, nails, accessories | `eyes.js`, `ears.js`, `nails.js`, `accessories.js` |
| Hair (guides, braids/locs/afro/wigs/…, physics) | `src/character/hair/*` |
| Clothing fitted to the body (wrap/skirt/shoes/headwear, fabrics) | `src/character/clothing/*` |
| Animation (idle, blink, gaze, walk/run IK, expressions, hands) | `src/character/animation.js` |
| Stages, lighting, weather, Lagos street | `src/world/*` |
| Camera rig (creator, face, full, third-person, mirror, cinematic, selfie) | `src/render/cameraRig.js` |
| UI, fitting room, outfits, compare, skin lab, save/load | `src/ui/ui.js`, `src/main.js` |

## QA tooling (headless Chromium via Playwright)

```bash
node tools/skinqa.mjs                 # 6 skin tones x 3 lights: measures luminance/warmth, fails on grey/black
node tools/shots.mjs '[["name","()=>{ __app.setScene(\"lagos\") }"]]'   # drive the real app, save screenshots
node tools/sheet.mjs out.png '[{"hair":{"style":"afro"}}, ...]' head    # contact sheet of states
```
