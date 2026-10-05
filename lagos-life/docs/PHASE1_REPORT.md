# Phase 1 Report — The Character Look Test

## Verdict (read this first)

**The prototype is a working, complete *pipeline* for the promise "that is my character" — but it does
NOT yet pass acceptance criterion #1 ("looks convincingly human" / "a screenshot reads as a photo of a
person").** The result is stylised-realistic: a good procedural 3D mannequin with a believable skin
shader, a real skeleton, real hair strands and clothing that genuinely fits — not a MetaHuman-class face.
Closing that gap needs authored assets (see *Asset requirements*), not more procedural code. I am
stating this plainly rather than claiming otherwise.

| # | Acceptance criterion | Status |
|---|---|---|
| 1 | Looks convincingly human | **Not met.** Reads as a clean 3D character. Face is the weakest part (smooth, slightly heavy, mouth/nose area mask-like). |
| 2 | Skin good across dark/brown tones | **Met for tone/warmth** (automated QA, 6 tones × 3 lights, no grey/black); light tones lean slightly salmon. Micro-detail is procedural, not scanned. |
| 3 | Hair believable | **Partly.** Afro, cornrows, knotless/box, Fulani, bantu knots, fades read well. Straight/wig styles are sparse and shard-like; locs and twist-out are weak. |
| 4 | Clothing fits the body | **Met.** Generated from the character's own skinned surface; verified on extreme bodies, 36 garments. Loose garments (agbada, kaftan) are inflated-looking; no cloth simulation. |
| 5 | Face proportions natural | **Met by construction** (bounded ranges, anatomical thirds, seeded asymmetry); not "beautiful". |
| 6 | Same character across scenes | **Met** (automated: identical geometry + fingerprint across Creator/Fitting/Lagos; save→rebuild→identical). |
| 7 | Lighting doesn't make her grey/plastic | **Met** (skin QA); required fixes for sky specular veil and night crush. |
| 8 | Walking not robotic | **Mostly met:** planted-foot IK, pelvis/spine counter-rotation, arm swing, heel-lift, bob. No motion capture; no secondary cloth/soft-tissue motion. |
| 9 | Rotate/view from many angles | **Met** (orbit, front/side/back/face/full/third/mirror/cinematic/selfie). |
| 10 | Visible appearance change | **Met.** |
| 11 | See clothing on own body before buying | **Met** (try-on, walk it, compare, buy/cancel; ₦ wallet is a mock). |
| 12 | Save and restore | **Met** (3 slots, autosave, JSON export/import, reload test). |
| 13 | Shown in a Lagos environment | **Met, stylised** (boxy but unmistakable). |
| 14 | Communicates intended visual direction | **Partly** — direction yes, cinematic realism no. |

## Polish pass (post-review)
Face: removed carved nasolabial grooves and softened cheek/jaw blends (no more aged jowl lines), narrowed face ~8 %, opened eyes and raised eye-slider sensitivity. Hair: removed the grey environment-specular veil from all hair materials, de-glinted silk press, denser/less edge-on flow hair, darker/smaller twist-out cards. Face remains smooth and doll-like; still not photoreal.

## What was built

Web prototype (three.js + Vite). Everything procedural, no binary assets. ~9k lines.

* **Canonical state** (`src/core/schema.js`): one JSON object — face(35)/body(13) params, skin
  (depth, undertone, tint, freckles, blemish, oil), eyes, hair, makeup(11 layers + preset), nails,
  accessories(8 slots + piercings), clothing worn (6 slots), 10 outfit slots. Clamps to natural ranges, drops
  unknown ids, versioned + migrated, stable `fingerprint()`. Unit-tested (13 tests).
* **Body**: signed-distance field of elliptic capsules/ellipsoids → narrow-band marching cubes → one welded
  mesh (no seams), ~27k verts @10 mm; skin weights from the same blend → smooth joints. 58-bone skeleton with
  fingers. Hands meshed at 3.4 mm. Rebuilds in ~0.3 s; sliders refine progressively (coarse while dragging).
* **Face**: SDF with *smooth subtraction* (eye sockets, nostrils, nasolabial folds, mentolabial crease) at
  2.6 mm, 4 expression morph targets, eyes with wet cornea + iris texture, anatomical eyelid shells that blink,
  lashes, SDF ears. Makeup is painted from the sculpt's own landmark map so it never drifts off features.
* **Skin**: OKLCH colour model (hard chroma floor, 5 undertones), wrapped-diffuse + scatter-fringe SSS, tinted
  indirect scatter, pore/relief normals, undertone-tinted specular (cool for blue-black), wetness. Skin gets its
  own reflection level because a bright sky in the specular lobe veils dark skin.
* **Hair**: 20 styles from strand guides rooted on the real scalp (ray-marched on the head SDF). Simulated
  (verlet, head/neck/shoulder/chest colliders, wind, rain weight, root inertia) for braids/locs/loose hair;
  static for afro/coils/short cuts. Shapes are body-aware so rest shape and collision agree.
* **Clothing**: wrap (clip + ease-offset of the body surface), skirt/robe loft from the body SDF hull, shoes
  (+heel pose), headwear (gele with pleated fan, fila, head wrap). 36 garments, 10 categories, Ankara / Aso-oke
  / lace / brocade / sequin procedural fabrics, rest-space triplanar mapping (no stretching).
* **Animation**: idle breathing, weight shift, saccadic look-around, blinking, planted-foot IK walk/run,
  turning/stopping, hand poses, wave, selfie pose, 6 expressions.
* **World**: Studio, Fitting room (real planar mirror), fictional Lagos street (danfo, keke, shopfronts with
  signs, compound wall, poles, bunting, billboard, palms), Day/Indoor/Night, rain, wind, pedestrians
  (same Character class), quality tiers.
* **QA tooling** (headless Chromium): `tools/skinqa.mjs`, `tools/flow.mjs`, `tools/shots.mjs`, `tools/sheet.mjs`.

## Technical decisions

* **Web/three.js, procedural, no authored assets** — nothing authored was available in the repo/sandbox. The
  pipeline is deliberately shaped so authored content can replace procedural parts (see below).
* **SDF + marching cubes for body/face** — gives parametric, seamless, smoothly-skinned humans and lets clothing
  be derived from the same surface (clothing fits by construction). Cost: no authored topology, no UV-based scan
  detail, 8–10 mm body resolution.
* **One Character instance moved between stages** — "no swapping models" is enforced architecturally.
* **Skin-specific env level, painted face map, planar face UVs** — pragmatic, documented limitations.

## Known limitations (not hidden)

* Not photoreal. No scanned skin, no real teeth/mouth interior (mouth is closed; no speech/open-mouth expressions),
  no tongue, eyebrows are painted not strands, no eyelid skin wrinkling, ears/feet simplified, toes unresolved.
* Hair: wigs/silk-press are sparse card hair with shard artefacts; locs & twist-out weak; "closure"/"frontal" wigs
  are only part/length presets (no lace construction); no strand-level shading/scattering; braid beads are
  radius bumps; hair accessory beads/cuffs only on braids partly implemented (headband/scarf/clip/bead tiara work).
* Clothing: no cloth simulation; loose garments follow the body (inflated look, no drape/folds); hems slightly
  ragged at 10 mm; skirts approximate legs (stride is reduced for pencil/mermaid); sneakers are bulky; shoes are
  shells, no laces/straps detail beyond bands.
* Animation: procedural only; no foot-roll IK on slopes; hands never collide; heels computed analytically.
* Lagos is a boxy stage; pedestrians use the same Character at LOW quality with static hairstyles.
* Dev-only measurement environment: all captures were made with software GL (SwiftShader) — **no real GPU/phone
  numbers were measured**. FPS shown in screenshots is not representative.
* Cinematic camera has no depth of field/bloom. No post-processing (SSAO, SMAA).

## Performance notes (measured where possible)

* Body rebuild ≈ 0.3–0.5 s, face ≈ 0.4–1.0 s (CPU, JS main thread; headless sandbox) — slider drag uses coarser
  meshes and refines after 260 ms. **Should move to a Web Worker** (marching cubes + weights are pure functions).
* Triangles (headless, one character): high ≈ 100–150k incl. hair; draw calls 14–40 (Studio); Lagos ≈ 160 calls /
  ≈ 360k tris at medium.
* Tiers: HIGH (2× DPR, 2k shadows, 2k face map, 4 pedestrians, dense hair) / MEDIUM (1.5×, 1k, 1k, 2) /
  LOW (1×, no shadows, 1k face map, hair 35 %, 0 pedestrians). Character mesh/hair/texture fidelity is kept
  highest relative to the environment as tiers drop. **Needs on-device validation on mid-range phones.**
* Risks: hair verlet is CPU; 1.6k ribbons × 16 points on mobile is the main concern → move to GPU or reduce.

## Asset requirements (to reach the target)

1. **Authored head + body base meshes** (clean topology, 2 UV sets, 4k skin maps) with ~40 face morph targets and a
   body-shape morph set; wrap the current parameter schema onto morph weights (the schema was designed to map 1:1).
2. **Skin scans/maps** across the tone range: albedo, normal, roughness, thickness/SSS, cavity — authored by tone &
   undertone (not a darkened light-skin map).
3. **Teeth/tongue/mouth interior**, eyelash and eyebrow *strand* assets, eye shaders from scanned eyes.
4. **Groomed hair assets** (strand or high-quality card sets) for each of the 20 styles, authored for Black hair
   textures and protective styles (braid patterns, parting, edges), with collision proxies.
5. **Tailored garment assets** (or cloth-sim pipeline) for the Nigerian wardrobe with real fabric scans/prints
   (Ankara, Aso-oke, lace, agbada drape), authored on the base body for size morphs.
6. **Motion capture** idle/walk/run/turn/gesture libraries + facial blendshape set (FACS).
7. **Lagos environment kit** (photoscanned/modelled facades, signage, vehicles, vegetation) with correct PBR.

## Exact next phase (Phase 2 recommendation)

**"Authored Face & Skin Vertical Slice"** — one hero character, end-to-end, to the target quality, before adding more
content:
1. Commission/author the base head+body with morph targets; implement a glTF loader path behind the existing
   `Character` interface (schema unchanged; procedural path stays as the LOD/fallback).
2. Replace the skin shader inputs with authored maps for 3 tones (light brown, mid, deep) — evaluate with
   `tools/skinqa.mjs` across Day/Indoor/Night + rain.
3. Authored hair for 3 hero styles (knotless braids, afro, silk-press wig) with GPU strand/card shading.
4. Mouth interior + FACS blendshapes (speech/emotion), eyebrow strands.
5. Move body/face meshing to a worker; add a real-device performance harness (iOS/Android mid-range).
6. Exit criteria: a blind screenshot test — people shown 10 unlabeled captures (5 game, 5 photos) rate "looks like a
   person" ≥ 70 %.
