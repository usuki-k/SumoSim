Task-ID: ACTION-ART-01-BACKGROUND-SPEC
Status: REVIEWED
Task-Type: INVESTIGATION / PRODUCT ART SPEC / BOUT BACKGROUND + DOHYO
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: 1c5b033addbb1adfb7fd19fc3c51b28a8bd96ca6
Handoff-Mode: GITHUB

# ACTION-ART-01 — Product Background / Dohyo Asset Specification

## Purpose

The project is moving away from throwaway visual prototypes.

User direction:

- For Action art, do not plan on repeatedly recreating temporary assets.
- Create assets with the intent that they can remain in the Product version.
- Wrestlers will ultimately use a **part-based image composition** approach rather than runtime primitive graphics.
- Art production order is now:
  1. Background / Dohyo
  2. HUD
  3. Wrestler character assets

This Task is the first Product-art specification step.

The goal is to define a production-ready specification for the Bout background and dohyo BEFORE generating or integrating final image files.

Investigation / Specification Only.

Do not create image assets or Production implementation in this Task.

## Accepted Product-Art Direction

The User prefers the visual direction of the previously supplied reference:

- polished top-down / high-angle sumo game presentation
- strong central dohyo
- warm Japanese/traditional atmosphere
- readable tawara / ring edge
- surrounding environment that makes the screen look like a real game rather than a technical prototype
- illustrative / hand-painted / stylized game-art quality rather than debug geometry
- sufficiently polished that the art is intended for Product use, not a disposable prototype

Do not mechanically copy any external/reference artwork.

Treat the reference as:
- composition / quality / mood direction
not:
- an exact asset to reproduce
- an exact UI layout
- an exact copyrighted design to imitate

## Development Priority

Still Action-first.

Do NOT expand into:
- Simulation / Management
- MatchDayFlow
- BashoRecord
- Banzuke
- tournament scheduling

The purpose of Product background art is to make the current Action game evaluable in a realistic visual context.

## Current Source Baseline

Production source baseline:
`1c5b033addbb1adfb7fd19fc3c51b28a8bd96ca6`

Current implementation still contains the VISUAL-01A runtime-generated wrestler visuals and Graphics-based dohyo.

These remain Current Source for now.

Do not remove or redesign them in this Specification Task.

## Central Goal

Produce a background/dohyo asset specification that can be handed directly to:

- an image-generation workflow,
- an artist,
- or a later asset-generation task,

without repeatedly rediscovering:

- what images are needed,
- what each layer contains,
- how big they are,
- where the dohyo center/radius live,
- how images align with Simulation coordinates,
- where HUD may later sit,
- how character scale relates to the background,
- how responsive browser layouts should crop/scale.

The spec should minimize later redraws.

# Required Source Inspection

Inspect at minimum:

- `AGENTS.md`
- `package.json`
- `src/main.ts`
- `src/style.css`
- `src/game/scenes/BoutScene.ts`
- `src/game/scenes/DohyoView.ts`
- `src/game/scenes/WrestlerView.ts`
- `src/game/sumo/BoutTypes.ts`
- `src/game/sumo/BoutSimulation.ts`
- `docs/ARCHITECTURE.md`
- `docs/GAME_CONCEPT.md`
- current Review Handoff

Confirm current:
- logical game size
- dohyo radius in Simulation meters
- meter→pixel mapping
- current ring fill ratio
- initial wrestler positions
- current UI/debug occupied areas
- current center-based Ring-out rule

Do not treat current 640×640 as final merely because it exists.

# Scope

Investigate and specify:

1. Product Action-screen composition
2. Recommended final/as-authored aspect ratio strategy
3. Background layer decomposition
4. Dohyo layer decomposition
5. Exact simulation-to-art alignment rules
6. Asset filenames
7. Pixel dimensions / working dimensions
8. Transparent vs opaque files
9. Safe areas for future HUD
10. Safe/action area for wrestlers and Gyoji
11. Character scale assumptions
12. Art-style constraints
13. Color/contrast requirements
14. responsive/cropping strategy
15. file format
16. Vite/Phaser asset path recommendation
17. implementation handoff requirements
18. acceptance checklist for generated artwork

Do not generate images in this Task.

# Scope Out

Do NOT:

- create background image files
- integrate image assets
- remove current Graphics background
- create HUD art
- create wrestler art
- create Gyoji art
- install Aseprite/Tiled
- add art dependencies
- change Gameplay
- change canvas/resolution in Production
- change camera
- add crowd animation
- add audio
- add Result/Management screen

# Product Background Design Questions

## Q1 — Target Screen Composition

Recommend the Product Bout screen composition.

Evaluate:

A. current near-square composition
B. 16:9 landscape composition similar to the User's reference direction
C. another responsive composition

The target platform is web/CrazyGames.

Discuss:
- desktop browser presentation
- common landscape play area
- whether Action readability benefits from more space around the ring
- future HUD placement
- mobile is NOT the current final target decision

Recommend one primary authored composition.

## Q2 — Logical Resolution vs Asset Resolution

Do not confuse:
- Phaser logical game size
- authored image pixel dimensions
- CSS/browser display dimensions

Recommend:
- Product art working resolution
- whether background should be authored at 1920×1080, 1600×900, 1280×720, or another size
- whether the runtime logical resolution should eventually match or scale independently

Goal:
avoid redrawing assets later.

Do not change source in this Task.

## Q3 — Dohyo Size in the Product Composition

Current Simulation:
- arena radius is 2.275 m
- ring center is logical origin
- Ring-out uses participant center > arena radius

Define how the Product art must represent the simulation ring.

Critical rule:
**the visible gameplay boundary must align unambiguously with the Simulation radius.**

Specify:
- art-space center coordinate
- art-space gameplay radius
- tawara thickness treatment
- whether the exact Simulation boundary runs:
  - center of the tawara,
  - inner edge,
  - outer edge,
  - another clearly defined art line

Current implementation draws the tawara centered on the rule radius.
Do not assume this is final without analyzing visual consistency.

Recommend one mapping.

## Q4 — Center-Based Ring-out Visual Compatibility

Current accepted Prototype Ring-out rule:
participant center crosses the gameplay radius.

Because Product art will be more realistic, assess:
- whether the boundary representation should visually support this rule
- how much body may appear outside before losing
- whether the art should avoid implying a foot/contact-based rule that conflicts with center-based detection

Do NOT change Ring-out in this Task.

Flag future visual/gameplay mismatch risk for User Play Test.

## Q5 — Background Layer Decomposition

Compare one flattened background image versus layered assets.

Recommend the minimum Product-ready layers.

Candidate structure:

1. outer arena/environment background
2. dohyo platform / clay base
3. tawara / ring-edge overlay
4. shikiri lines
5. foreground/edge decoration
6. optional ambient shadow/light overlay

Decide which layers should be separate and why.

Prioritize:
- redraw minimization
- later HUD integration
- Ring-out readability
- character occlusion correctness
- small implementation complexity

## Q6 — Required Background Asset List

Produce an exact table with at minimum:

- filename
- purpose
- dimensions
- alpha/transparency
- anchor/alignment
- runtime layer/depth
- whether required for v1 Product Action screen

Example naming only:
```
arena_background.png
dohyo_base.png
tawara_overlay.png
shikiri_overlay.png
arena_foreground.png
```

Do not invent unnecessary layers.

## Q7 — Full-Screen Background vs Isolated Dohyo

Decide whether:
- arena_background contains the entire screen including the clay platform
- dohyo is a separate transparent overlay
- or another split is preferable

Consider:
- responsive scaling
- exact ring alignment
- future alternate venues/themes
- implementation simplicity

## Q8 — Safe Area for Future HUD

HUD is the next Product-art phase.

Background must reserve appropriate visual space.

Specify safe zones for:
- top-left wrestler/HUD
- top-right wrestler/HUD
- center/top title or match info if used
- bottom corners / match metadata if later used

Do NOT design the HUD itself.

Goal:
background details should not fight future HUD readability.

## Q9 — Gameplay Safe Area

Specify where critical gameplay must remain visible:
- full dohyo edge
- both wrestlers
- future Gyoji result presentation
- potential effects/particles

Avoid decorative foreground elements covering:
- tawara
- ring-out region
- wrestlers

## Q10 — Gyoji / Officials / Crowd in Background

User previously decided Gyoji does NOT need to remain visible during fighting.

Therefore:
- do not bake the result Gyoji into the permanent background.

Evaluate what can be baked:
- spectators
- officials seated outside ring
- banners
- lanterns
- seating

and what should stay separate:
- future animated Gyoji
- characters
- active FX

Avoid background art that later prevents moving/animating Gyoji.

## Q11 — Venue Scope

Recommend the smallest Product-quality venue.

User reference contains substantial arena detail.

Determine whether Product v1 background should include:
- dohyo
- surrounding wooden/clay platform
- limited audience/official silhouettes
- banners/lanterns
- architectural trim

without turning this into a large environment-production project.

Provide Required / Optional / Deferred environment details.

## Q12 — Art Style Specification

Define a concise Product art brief.

Include:
- top-down/high-angle degree
- stylization level
- line quality
- texture/detail
- lighting
- palette
- Japanese/sumo atmosphere
- material readability
- avoidance of overly photoreal / overly chibi if appropriate

Do not overfit to a single reference image.

The background style must later support part-based wrestler artwork in the same visual language.

## Q13 — Perspective Consistency

Because wrestlers will later be constructed from body-part images, background perspective must be compatible.

Specify:
- pure orthographic top-down vs lightly angled top-down
- expected visible vertical faces of platform/objects
- whether wrestler images should be top-down with slight 3/4 volume

Choose a direction that will not make future character assets look pasted on.

## Q14 — Lighting Direction

Specify one stable global lighting direction for:
- background painting
- wrestler shadows
- UI-independent character rendering
- future Gyoji

Avoid ambiguous multi-direction lighting that complicates part-based characters.

Recommend a light direction and softness.

## Q15 — Character Shadow Grounding

Define background assumptions for later wrestler shadows:
- shadow direction
- softness
- opacity range
- whether shadows should be separate character layers

Do not bake wrestler shadows into the background.

## Q16 — Color Contrast

Specify contrast requirements:
- wrestlers must stand out from the clay
- blue/red mawashi or other palette variants must remain readable
- tawara must be visible at a glance
- HUD will later need contrast zones

Recommend avoiding background colors too close to skin/mawashi.

## Q17 — Texture Density

Recommend a texture/detail density that:
- feels Product-quality
- does not visually compete with Action
- remains legible when browser-scaled down

Define where detail should be concentrated:
- outside gameplay area
- around ring
- center clay

## Q18 — Ring/Clay Wear Marks

Decide whether to include:
- footprints
- sweep marks
- clay scuffs

as baked details.

Ensure they do not look like gameplay trails/events.

Recommend subtle static texture only.

## Q19 — Responsive Scaling Strategy

CrazyGames/browser windows vary.

Recommend a Product strategy such as:
- fixed 16:9 authored composition + FIT/letterbox
- cover/crop with protected center region
- another method

Specify which portions may safely crop and which may not.

Do not implement now.

## Q20 — Asset Format

Recommend:
- PNG
- WebP
- or combination

Consider:
- alpha
- source/master file vs runtime delivery file
- compression
- browser support

Since these are Product assets, distinguish:
- source/master art
- runtime exported file

Do not introduce source-art tools yet.

## Q21 — Repository Asset Path

Recommend exact runtime path for Product art.

Candidate:
`public/assets/action/background/`

If accepted later:
- Phaser loader can read stable URLs.
- AGENTS.md directory rule requires explicit permission in the Implementation Task.

Do not create directories in this Spec Task.

Also recommend where non-runtime source/master art should live, if anywhere.
Avoid placing editor/source files in runtime folders.

## Q22 — Master Asset Ownership

Since repeated redraw is expensive, specify how Product art should be versioned.

Recommend whether repository should store:
- only exported runtime PNG/WebP
- source PSD/Krita/Aseprite files
- both

No tool is currently confirmed.

Do not assume proprietary source formats or tools.

If master-art tool choice is required, mark it as a User Decision instead of inventing one.

## Q23 — Asset Generation Workflow

User wants Product-quality assets, not throwaway prototype art.

Recommend a workflow such as:

1. lock composition/spec
2. generate/create one background concept
3. review
4. make targeted revisions
5. lock Product background
6. export runtime layers
7. integrate
8. User visual check in Browser

The goal is to avoid repeatedly generating complete backgrounds.

Recommend how to separate:
- composition approval
- final rendering approval
- integration/crop approval

## Q24 — AI/Image Generation Considerations

If image generation is used later, specify what must be controlled in the prompt/spec:

- exact camera/perspective
- empty dohyo (no wrestlers)
- no baked HUD/text/logo
- no permanent Gyoji in the fighting background
- exact center/ring placement
- safe areas
- layer separation limitations

Identify which elements may need separate generation or manual masking because generative images may not provide exact geometry.

Do not generate images in this Task.

## Q25 — Exact Geometry vs Painted Art

A critical Product issue:

Generated/painted background art may not place the tawara at mathematically exact geometry.

Recommend a solution:
- use painted base but keep the gameplay tawara/shikiri as separate exact overlay
- post-process/mask to exact geometry
- or another approach

Prioritize avoiding visual mismatch between art and Simulation.

## Q26 — Product Background Acceptance Criteria

Define an approval checklist before the background is considered locked.

Must include:
- looks Product-quality
- style compatible with later wrestlers
- dohyo unmistakable
- exact gameplay boundary alignment
- enough contrast
- no embedded characters/HUD
- HUD safe area
- responsive crop safety
- no illegible details
- browser-scale readability

## Q27 — Integration Requirements for Later Task

Define what the later background implementation Task will need:
- preload asset paths
- image/layer creation
- transform based on logical resolution
- exact Simulation-to-art alignment
- fallback/debug overlay for geometry verification
- browser visual check

Do not implement.

## Q28 — Geometry Verification Overlay

Recommend a temporary developer-only overlay for the Integration Task:
- simulation center
- exact arena radius
- initial participant positions
- shikiri reference positions

This would allow checking whether Product art aligns pixel-perfectly.

The overlay should not ship visible by default.

## Q29 — HUD Handoff

At the end of this Spec, define the exact information that HUD design will inherit:
- authored screen dimensions/aspect ratio
- safe areas
- ring bounding box
- reserved zones
- primary visual hierarchy

Do not specify final HUD elements beyond these boundaries.

## Q30 — Wrestler Handoff

Define what later part-based character design will inherit:
- expected on-screen body diameter/height
- perspective
- lighting
- shadow direction
- palette contrast requirements
- available gameplay/action area

Do not create wrestler asset specs yet beyond these interface requirements.

## Q31 — User Decisions Required

List only material decisions that truly require User confirmation before Product background generation.

At minimum consider:
- primary aspect ratio
- perspective (true top-down vs slight high-angle)
- environment richness
- whether spectators/officials are baked into background
- runtime background decomposition
- art source/master workflow if necessary

Give a recommended default for each.

## Q32 — Next Task Sequence

Recommend a minimal Product-art sequence.

Expected direction:

1. ACTION-ART-01 Background Spec Review / User decisions
2. ACTION-ART-01A Background concept/generation
3. User visual approval
4. ACTION-ART-01B exact Product layer export/integration
5. Browser visual verification
6. ACTION-ART-02 HUD Spec
7. HUD generation/integration
8. ACTION-ART-03 Wrestler part asset spec
9. Wrestler Product art production/integration

Do not mix HUD or wrestler production into the background task.

# Key Product Constraint — Avoid Redraws

This Task should actively minimize full redraw cycles.

Prefer:
- exact geometry defined before art creation
- safe zones defined before painting
- layer split defined before generation
- one approved composition before high-detail rendering

Do not recommend "just generate several different backgrounds and see what works" as the main workflow.

# Stop Conditions

Return BLOCKED if:

- Product background geometry cannot be specified without first changing the Gameplay camera/ring layout
- Current 640×640 implementation materially prevents choosing a Product aspect ratio without User decision
- exact Simulation/ring alignment cannot be reconciled with the desired painted style
- a specific paid/proprietary art tool becomes a prerequisite and User has not chosen it
- Current Source materially conflicts with the requested art direction

Do not make Production changes.

# Verification

Investigation / Product Art Specification.

Required:
- Q1–Q32 answered or explicit BLOCKED
- Current Source directly inspected
- Current Fact / Recommendation / User Decision / Deferred clearly separated
- exact asset table included
- exact geometry/alignment section included
- Production Source unchanged
- package/lockfile unchanged
- repository change only `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- `git diff --check` PASS

Tests/build not required because Source must not change.

# Completion Report

Minimum:
- Result
- Preflight
- Current Rendering Facts
- Recommended Product composition
- logical vs authored resolution
- exact dohyo geometry mapping
- background layer model
- exact background asset list/table
- art brief
- perspective
- lighting/shadows
- safe areas
- responsive strategy
- format/export strategy
- repository paths
- master-art/source recommendation
- generation/revision workflow
- exact-geometry strategy
- Product acceptance checklist
- integration handoff
- HUD handoff
- wrestler handoff
- User Decisions Required
- Deferred
- Next Product-art Task Sequence
- Design Deviations
- Unexpected Scope
- Verification
- Git delivery

# User Play Test

NOT REQUIRED for Specification.

User visual approval is REQUIRED in the later Background concept/generation Task.

# Git Delivery

Investigation-only Report Commit Exception:
- change only CURRENT_COMPLETION_REPORT.md
- explicit stage
- git diff --check
- one Report-only commit
- push origin/develop
- verify remote SHA / clean tree

Example:
`docs(agent): specify product bout background`

# Final Instruction

Stop after Product Background / Dohyo specification.

Do not generate or integrate images.

After Report Commit / Push:
「ACTION-ART-01-BACKGROUND-SPEC が完了し、ChatGPT ReviewとUser Decision待ちです」


# Final ChatGPT Review

Overall Result: PASS WITH CORRECTIONS / USER DECISIONS REQUIRED BEFORE BACKGROUND GENERATION

## Reviewed Delivery

- Specification report commit:
  `98d9da89bb74e426a06dbed2d1a4285a6eaccb9c`
- Agent-Start-Head:
  `dd8b5d5b49574cf483642c63d73e43df376faaad`
- Diff is exactly one Report-only commit:
  `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- Production Source / package / lockfile unchanged.
- `main` unchanged.

## Overall Assessment

PASS.

The Report provides a sufficiently concrete Product-art foundation for the next background generation step:

- 16:9 authored composition
- explicit dohyo center/radius
- layered base + exact-geometry overlay strategy
- HUD/gameplay safe areas
- art direction/perspective/lighting
- runtime/master export concepts
- Product acceptance checklist
- HUD and wrestler handoff constraints.

The most important redraw-minimization decision is correct:

> Do not rely on generative/painted art for the exact gameplay ring geometry. Keep the visually exact tawara/shikiri geometry separable from the painted venue/base.

This materially reduces the risk of regenerating the full background when geometry changes.

## Accepted Product Art Coordinate Space

Accept the **1920×1080 Product runtime-art coordinate space** and **3840×2160 2× master working space** as the current art-production baseline.

For the 1920×1080 Product art space:

- dohyo center reference: `(960, 540)`
- proposed gameplay-radius reference: `400 px`
- corresponding scale: about `175.82 px/m`
- wrestler gameplay diameter at current 0.7 m: about `123 px`
- initial participant x offset: about `123 px`.

These are suitable handoff coordinates for:
- background generation
- later HUD layout
- later part-based wrestler art.

## Correction C-A1 — Do NOT lock Phaser logical resolution to 1920×1080 yet

The Report recommends:

> Phaser logical size = 1920×1080

Do not accept that as a Product gameplay/runtime decision in this Art Spec.

Separate:

1. **Product art coordinate space / runtime exported background**
   - 1920×1080: ACCEPTED baseline for art production.

2. **Phaser logical rendering resolution**
   - remains a later Integration/performance decision.

The artwork can be scaled/mapped to whatever 16:9 logical resolution is selected later.

Reason:
- choosing 1920×1080 logical rendering may be perfectly viable,
- but it affects rendering workload, text sizing, debug UI, effects and device performance,
- none of those need to be decided in order to create a 1920×1080 background asset.

Therefore the background must NOT need to be redrawn if the eventual logical resolution becomes, for example, 1280×720.

ACTION-ART-01B should implement one explicit art-space→logical-space transform rather than assuming permanent 1:1 pixels.

## Accepted Composition

Accept as the current recommendation:

- primary authored aspect ratio: **16:9 landscape**
- dohyo centered in the composition
- enough lateral area for future HUD and venue atmosphere
- FIT/letterbox as the initial web strategy
- no crop of gameplay-critical geometry in Product v1.

This is compatible with the User's Action-first direction and future CrazyGames presentation.

## Perspective — USER DECISION REQUIRED

The Report recommends strict top-down orthographic presentation.

This is technically the safest option because:
- the Simulation ring is circular,
- facing rotates continuously,
- participant collision geometry is isotropic.

However, the User's visual reference has a more illustrated/game-art feel, and strict orthographic art may feel flatter than desired.

Before image generation, User must choose between:

### A. Strict top-down orthographic — recommended for lowest technical risk
- ring remains a true circle
- all directions visually symmetric
- part-based wrestler rotation is simplest
- vertical faces shown only through narrow edge/shadow cues.

### B. Stylized near-top-down while gameplay plane remains circular
- allows slightly more volume/depth in painted environment,
- but the playable ring itself must still remain a geometrically circular top-plane,
- characters must still be designed to rotate without perspective contradiction.

Do NOT use a perspective that visibly turns the playable circle into an ellipse while Simulation remains circular.

## Correction C-A2 — Tawara boundary mapping is a Gameplay/Presentation contract, not a cosmetic choice

The Report recommends:

> Simulation radius 400 px = tawara outer edge.

This is visually attractive because it communicates "on the tawara is still in."

However, Current Source also documents the 2.275 m radius as half of the approximately 4.55 m inner dohyo diameter.

Those two interpretations are not identical:

- if 2.275 m maps to the **inner edge**, it preserves the current real-dimension interpretation;
- if 2.275 m maps to the **outer edge**, it changes what the 2.275 m circle visually represents.

Because the User already stated that the center-based Ring-out rule may be revisited after representative graphics, do not silently resolve this inconsistency as presentation-only.

### Required strategy

Keep the Product background base independent of the exact tawara boundary.

The exact tawara/shikiri overlay must remain separately replaceable.

Before final overlay export/integration, User chooses:

- **inner edge = gameplay radius**
- **centerline = gameplay radius**
- **outer edge = gameplay radius**

Review recommendation for current center-based Ring-out:
**outer edge is the best visual candidate**, but it remains a User decision.

This choice must not force regeneration of `arena_base`.

## Layer Model — ACCEPTED WITH REFINEMENT

Accept:

1. `arena_base`
   - opaque venue/environment
   - clay platform/base
   - non-critical soil/sand texture
   - no exact tawara/shikiri geometry

2. `dohyo_ring_overlay`
   - exact gameplay-critical tawara
   - shikiri lines
   - transparent

3. `arena_ambient`
   - optional
   - low-frequency lighting/vignette
   - behind characters.

Do not add foreground decorations over the playable area.

This split is the strongest part of the Report for preventing redraws.

## Correction C-A3 — Exact-geometry overlay runtime export must be lossless

For `arena_base`:
- lossy WebP at appropriate quality is acceptable.

For `dohyo_ring_overlay`:
- require **lossless PNG or lossless WebP** for the first Product integration.

Do not use lossy compression on the exact gameplay-boundary overlay.

Reason:
- the overlay is specifically responsible for 1-pixel geometry alignment,
- compression artifacts/fringing around the tawara edge would undermine that purpose.

The exact runtime format can be benchmarked later, but geometry correctness wins over a very small file-size saving here.

## Safe Areas — ACCEPTED AS DESIGN GUIDES, NOT FINAL HUD DIMENSIONS

The proposed HUD safe areas and 532 px protected gameplay radius are useful planning guides.

Accept them as:
- reserved/low-detail regions for background painting,
- not final HUD panel dimensions.

HUD design remains ACTION-ART-02.

Important:
- do not bake visible HUD-shaped empty boxes into the background.
- create calm/low-detail areas instead.

## Venue Scope — ACCEPTED

Product v1 background should include:

Required:
- dohyo/platform
- surrounding floor
- clear clay/sand/tawara material separation
- enough venue framing to look like a finished game.

Optional:
- static dark audience silhouettes
- seated officials outside the protected gameplay region
- restrained architectural/cloth accents.

Deferred:
- moving crowd
- roof that occludes play
- complex lighting animation
- banners/text-heavy decor
- venue variants.

Gyoji must NOT be baked into the fighting background.

## Art Style — ACCEPTED AS DIRECTION

Use:
- polished stylized 2D game art
- painted/illustrative finish
- warm traditional atmosphere
- clear shapes over photoreal detail
- restrained texture in the central playable area
- stronger detail/atmosphere outside the action area.

Do not copy the supplied reference image literally.

The art style must support the later part-based wrestler assets in the same visual language.

## Lighting — ACCEPTED

Use one soft high-angle light from upper-left.

Later:
- wrestler parts
- shadows
- Gyoji
- FX

should follow the same direction.

Do not bake wrestler shadows into the background.

## Master / Source Strategy — CORRECTION C-A4

The Report recommends:
- 3840×2160 layer PNG masters,
- optional tool-native format later.

This is sufficient as a minimum interchange/master export, but for the User's explicit goal of avoiding expensive redraws, also preserve the **production recipe**.

For AI-generated or edited Product background work, retain alongside the master:

- approved composition reference
- generation/edit prompt or art brief version
- exact geometry guide/mask
- layer separation specification
- original generated source image before destructive edits where applicable.

If a real editable source tool is later selected:
- preserve its native layered source file as well.

Do not require choosing PSD/Krita/Aseprite now.

## Repository Path Direction — ACCEPTED, CREATION DEFERRED

Recommended runtime path remains:

`public/assets/action/background/`

Recommended source/master-art path:

`art-source/action/background/`

Neither should be created in the Specification task.

The asset generation/integration task must explicitly authorize new directories under AGENTS.md §5.

Large-source Git/LFS policy remains Deferred until actual file sizes are known.

## Product Background Acceptance — ACCEPTED

Before background is considered locked, require:

- Product-quality appearance
- 16:9 composition
- style compatible with future wrestler parts
- obvious/readable dohyo
- exact ring overlay alignment
- visible tawara under gameplay
- center/action contrast
- no baked wrestler/Gyoji/HUD/text
- future HUD low-detail safe areas
- browser scaling readability
- no static marks that look like gameplay trails
- responsive FIT check.

## Geometry Verification — ACCEPTED

ACTION-ART-01B should include a developer-only overlay for:

- art/simulation center
- exact gameplay radius
- initial participant centers
- shikiri references
- optional HUD/gameplay safe guides.

This is an excellent safeguard against integrating attractive but geometrically incorrect art.

## User Decisions Required Before ACTION-ART-01A Generation

Only the following need to be decided now.

### UD-A1 — Aspect ratio / art coordinate space

Review recommendation:
**16:9, runtime-art coordinate space 1920×1080, master 3840×2160.**

Note:
this does NOT lock Phaser logical resolution.

### UD-A2 — Perspective

Choose:
- strict top-down orthographic
- stylized near-top-down with a circular top gameplay plane.

Review recommendation:
**strict top-down orthographic for the first Product background**, unless the User strongly prefers the extra depth of the visual reference.

### UD-A3 — Tawara / gameplay-radius mapping

Choose:
- inner edge
- centerline
- outer edge.

Review recommendation:
**outer edge**, given the current center-based Ring-out visual feel.

But this is explicitly revisitable after Product-art browser Play Test.

### UD-A4 — Venue richness

Review recommendation:
- finished dohyo/platform/floor = required
- static dark spectators/officials outside gameplay region = allowed
- no moving crowd / roof / ornate foreground.

### UD-A5 — Production method for ACTION-ART-01A

User previously asked for Product assets rather than repeated throwaway prototypes.

Recommended workflow:
- create one controlled composition/background direction from this spec,
- review that composition,
- make targeted edits,
- then lock and export layers.

Do NOT generate many unrelated full backgrounds as alternatives.

Image generation can be used, but exact tawara/shikiri geometry remains a separately controlled layer.

## Next Task After User Decisions

Once UD-A1–A5 are confirmed:

**ACTION-ART-01A — Product Background Creation**

should produce:
- the approved arena/background image direction
- Product-quality background master
- exact/non-destructive geometry guide
- separated output suitable for later exact overlay creation
- User visual approval.

Do NOT integrate it into Phaser until visual approval.

Then:

**ACTION-ART-01B — Background Integration**
- export runtime layers
- implement art-space mapping
- update presentation layout
- geometry overlay verification
- browser visual check.

## Do Not Reopen Yet

Do not start:
- HUD production
- wrestler Product art
- Gyoji art
- Management
- gameplay tuning

until Product background direction is visually approved.

The center-based Ring-out rule itself may be reconsidered after representative Product graphics are visible, per User direction.
