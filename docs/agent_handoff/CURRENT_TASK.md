Task-ID: ACTION-ART-03A-RIGID-WRESTLER-RUNTIME-INTEGRATION
Status: REVIEWED
Task-Type: IMPLEMENTATION / PHASER PRODUCT ART INTEGRATION / WRESTLER
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 31d658e0e4bf4d50168d0eae062e29c248b96fb9
Handoff-Mode: GITHUB

# ACTION-ART-03A — Accepted Dual Rigid Wrestler Runtime Integration

## Purpose

Replace the current procedural/articulated Phaser wrestler rendering with the User-accepted **two authored full-body rigid sprites**.

The runtime model for this Task is intentionally small:

```
Simulation participant.position
        -> sprite root position

Simulation participant.facing
        -> whole-sprite rotation

same authored sprite
        -> idle / movement / current action states
```

This Task integrates the accepted minimum-asset visual direction into the real BoutScene.

It must NOT add an 8-direction system, skeletal animation, per-limb transforms, or action-specific sprite production.

---

# Accepted User Visual Decision

ART-WRESTLER-03A produced:
- separate blue and red authored wrestlers
- 360° whole-sprite rotation previews
- faceoff variants
- translation-only advance
- translation-only stagger
- tiny-rotation stagger comparison
- close-contact / push comparison.

The User visually reviewed the results and judged that there was **not significant enough visual discomfort to block this approach**.

For the current prototype, accept:

## Accepted now

- Use **two separately authored full-body sprites**:
  - blue wrestler
  - red wrestler
- Never mirror either sprite.
- Normalize both source arts so local +X = FRONT.
- Runtime facing uses continuous whole-sprite rotation.
- Runtime movement follows the canonical participant root position.
- Use the same base full-body sprite across current gameplay states.
- No limb animation is required for this integration.
- No authored directional set is required for this integration.
- Translation-only motion is acceptable as the initial minimal animation baseline.
- Translation-only stagger / displacement is acceptable as the baseline direction.

## Not accepted / not required yet

- 8 authored directions
- right-tsuppari / left-tsuppari / grapple image sets
- final animation frame count
- final action-pose count
- skeletal rig
- per-limb Product animation
- dedicated Push / Grip / Grapple Product pose
- a special tiny-rotation stagger rule.

The +5° stagger comparison was useful validation, but do NOT add an arbitrary presentation-only rotation rule in this Task unless Current Source already provides a canonical rotation signal. It does not.

If later User Play Test shows that Push/contact/Grip/Grapple is visually insufficient, that becomes a later focused hybrid-pose Task.

---

# Important Interpretation — “Stagger by coordinate change”

The User's intended minimal animation model is:

> if a wrestler staggers, prefer showing it through the same sprite changing position instead of requiring a new animation image.

For this Task, the canonical Simulation position/facing remains Source of Truth.

Do NOT invent a second gameplay position.

Do NOT add an arbitrary presentation-only stagger displacement formula just to reproduce the offline GIF.

If the current Simulation already displaces the participant through push/external velocity/kuzushi behavior, the rigid sprite follows that canonical position and therefore visually moves with it.

The existing detailed procedural `kuzushi` body/arm deformation must NOT survive into the Product rigid sprite path.

A later presentation-only stagger offset may be considered only if User Play Test says canonical displacement alone is visually insufficient.

---

# Reviewed Product Source Art

The exact reviewed source images remain local production inputs:

```
tools/wrestler_art/input.local/
  wrestler_blue.png
  wrestler_red.png
```

## Blue source identity

- size: 1254×1254
- RGBA
- encoded file SHA-256:
  `ede9ffd2d3e010248b84c9a90a9942db48be4b1e547f73a2bb5347fe1781dbb4`
- decoded RGBA pixel SHA-256:
  `0de729df419e8be1c63c812c55c2e6a7a5b07319614194a4b649a3dc9adf65dd`

## Red source identity

- size: 1254×1254
- RGBA
- encoded file SHA-256:
  `98f9465a6306228e3c4e7757f73394b8baa5bb2f5f73a47be568edb5c9792fa9`
- decoded RGBA pixel SHA-256:
  `a212dbfeab3da3ad4e42c352f1f7baea7f7b99fc901053bd05c4609df25dafe7`

Blocking identity remains decoded pixel SHA.

### STOP discipline

If either required input is missing:
**STOP.**

Do NOT search Downloads/Desktop/Pictures or another arbitrary directory.

This explicitly corrects the non-semantic procedural deviation in ART-WRESTLER-03A.

If the input exists but identity differs:
**STOP.**

---

# Accepted Normalization Metadata

Current accepted/provisional Product normalization comes from:

`tools/wrestler_art/dual_rigid_recipe.json`

Preserve its current reviewed geometry unless implementation evidence shows a mechanical export bug.

## Blue

- source_front_deg: 21.4°
- root_source_px: (620, 615)
- body-core source:
  - (741, 308)
  - (544, 808)
- body-core target: 2R
- reported runtime image:
  - approximately 167×181
  - pivot approximately (84, 87)
  - alpha bbox approximately 153×169.

## Red

- source_front_deg: 160.7°
- root_source_px: (648, 609)
- body-core source:
  - (522, 251)
  - (731, 847)
- body-core target: 2R
- reported runtime image:
  - approximately 158×178
  - pivot approximately (82, 95)
  - alpha bbox approximately 146×166.

Both runtime body-core widths:
- approximately 123.077 px at the accepted current Product scale.

These values are presentation metadata, not gameplay geometry.

---

# Accepted Gameplay / Arena Contract — Do Not Reopen

- branch: develop
- Product logical canvas: 1920×1080
- Product ring center: (960, 540)
- Product ring radius: 400 px
- arena radius: 2.275 m
- gameplay bodyRadius: 0.35 m
- current presentation body-core target: about 123 px
- Simulation position is canonical
- Simulation facing is canonical and continuous
- ring-out / Tokudawara unchanged
- Push / Counter / Grip / Drive unchanged
- fixed-step Simulation unchanged
- accepted Product arena unchanged
- accepted HUD / pre-bout comparison unchanged.

No gameplay formula may be moved into Phaser.

---

# Required Reading / Current Source

Read directly before implementation:

- `AGENTS.md`
- `CLAUDE.md`
- current `CURRENT_TASK.md`
- reviewed prior `CURRENT_COMPLETION_REPORT.md`
- `docs/WRESTLER_PRODUCT_ART_SPEC.md`
- `tools/wrestler_art/dual_rigid_recipe.json`
- `tools/wrestler_art/preview_dual_rigid_wrestlers.py`
- `tools/wrestler_art/README.md`
- `src/game/scenes/WrestlerView.ts`
- `src/game/scenes/BoutScene.ts`
- `src/game/presentation/wrestlerVisualState.ts`
- `src/game/presentation/productArena.ts`
- current relevant tests.

Current Source facts:
- `WrestlerView.ts` currently generates procedural Phaser textures for:
  - foot
  - torso
  - mawashi
  - one-piece arm
  - head
  - shadow
- it currently performs detailed per-state articulated presentation transforms
- `BoutScene` already maps canonical Simulation position to Product pixels
- `BoutScene.syncViews()` already obtains `WrestlerVisualState` and calls `WrestlerView.apply()`.

Replace only the visual implementation necessary for this Product direction.

---

# Architecture

Preserve:

```
Pure TS Simulation
  -> Snapshot / WrestlerVisualState
  -> Phaser presentation
```

For this Task:

```
participant.position
        -> BoutScene meter->pixel mapping
        -> WrestlerView root position

participant.facing
        -> WrestlerView rigid image rotation
```

Do not let Phaser alter Simulation state.

Do not create duplicated position/facing Sources of Truth.

---

# Runtime Asset Export

Commit normalized runtime Product sprites derived deterministically from the exact reviewed local inputs.

Recommended runtime files:

```
public/assets/action/wrestler/
  blue.png
  red.png
```

Use the existing deterministic normalization path.

Do NOT manually resize/rotate/edit the committed PNG files.

## Required exporter behavior

Either:
- extend the existing wrestler-art tooling with a focused runtime export mode, or
- add one small explicit export script if that is clearer.

Do not make a generic asset pipeline.

The export must:
1. validate source dimensions / alpha / decoded pixel SHA
2. apply the accepted one-time source-axis normalization
3. normalize the explicit body-core to 2R
4. downscale to 1× Product runtime size
5. preserve transparent padding required by the explicit participant pivot
6. write deterministic PNGs
7. report:
   - dimensions
   - pivot
   - body-core size
   - decoded output hash.

Committed Product PNGs must be byte/pixel-verifiable against a fresh deterministic export.

No manual post-processing.

---

# Runtime Presentation Metadata

Add a small pure presentation contract, recommended:

```
src/game/presentation/productWrestlerArt.ts
```

Keep it explicit and small.

It should define, per Product wrestler asset:

- texture key
- asset URL
- runtime asset width/height if useful
- runtime pivot in px
- runtime body-core diameter in px.

Do not put participant-specific gameplay logic in this module.

Do not build a generic skin/avatar framework.

The Phaser image origin must be derived from the explicit pivot:

```
originX = pivotX / textureWidth
originY = pivotY / textureHeight
```

so:

```
image.position == canonical participant center
image.rotation == participant.facing
```

after source-axis normalization.

---

# Participant -> Art Mapping

The current prototype presentation fixture may map:

- `wrestler-a` -> blue Product wrestler art
- `wrestler-b` -> red Product wrestler art.

Keep this mapping in presentation metadata / the existing `PARTICIPANT_PRESENTATION` boundary.

Do not put colors/skins into Simulation participant state.

The existing debug colors may remain for:
- debug contact circles
- debug grapple line
- debug marker/readouts.

They are not the Product sprite tint.

Do NOT tint the Product wrestler images blue/red at runtime; they are already authored.

---

# WrestlerView Runtime Direction

Refactor `WrestlerView.ts` from articulated procedural body rendering to a small rigid Product-sprite renderer.

Recommended structure:

- one Product body image
- one procedural/world shadow
- root/pivot owned by the Product image's explicit metadata.

Remove from the default Product rendering path:
- procedural foot images
- procedural torso
- procedural mawashi
- procedural arm images
- procedural head
- pose interpolation of those individual body parts
- per-limb reach/spread
- walking foot shuffle
- procedural crouch/lean
- procedural kuzushi arm/body deformation
- mawashi tint-based Morozashi cue.

Do not leave the old articulated Product path running invisibly underneath.

It is acceptable to delete obsolete procedural body-generation code from `WrestlerView.ts` if no longer used.

Do not delete the offline 02A/02B/03A art tools in this Task.

---

# WrestlerView apply() Semantics

Keep the public scene integration small.

For each frame:

1. derive `moving` from the existing `WrestlerVisualState` so presentation hysteresis behavior remains compatible
2. position the Product sprite at `positionPx`
3. rotate it to `participant.facing`
4. position the shadow using the accepted small world-space offset
5. freeze rules do not need a special body pose; canonical participant state is still rendered.

Do not add new time-based body deformation.

The same Product base image is used for:
- idle
- move
- push
- counter
- grip
- grapple
- drive
- kuzushi
for this Task.

Action readability beyond canonical root/facing is deferred to User Play Test.

---

# Shadow

Keep a subtle procedural shadow.

Requirements:
- shadow is presentation-only
- it remains below both wrestler bodies
- use accepted/current near-circular sizing
- its world-space offset remains stable
- do not bake another shadow into the Product asset
- do not create directional shadow behavior that visibly rotates with the wrestler.

If current shadow texture generation can be reduced to shadow-only code, do so.

---

# Preload

Add an explicit Product wrestler preload path.

Recommended:
- export `preloadProductWrestlers(scene)` from the wrestler presentation module / view
- call it from `BoutScene.preload()` next to `preloadProductDohyo(this)`.

Avoid loading files ad hoc from `create()`.

---

# Scale

At runtime, preserve participant-specific canonical bodyRadius semantics.

Recommended scale formula:

```
scale = (2 * bodyRadiusPx) / art.bodyCoreDiameterPx
```

At the current accepted setup this should be approximately 1.0.

This:
- does not alter gameplay bodyRadius
- keeps Product art aligned with the canonical gameplay body's visual size
- avoids scaling from the full alpha bbox.

Do not hardcode full-image size as gameplay diameter.

Add a focused pure helper if useful.

---

# Visual State

Do not redesign `wrestlerVisualState.ts`.

It remains a pure presentation mapping and may still be useful for:
- `moving` hysteresis
- future hybrid pose decisions.

For the rigid renderer:
- detailed pose fields may simply no longer produce body-part deformation.

Do NOT remove Simulation-facing action semantics from the pure mapping in this Task.

If compiler/tests show a small cleanup is required, keep it minimal.

---

# Debug / HUD Preservation

Preserve:
- key 0 debug toggle
- contact circle
- facing marker
- labels
- phase text
- grapple line
- exact arena boundary debug
- Product HUD
- pre-bout comparison
- Enter start flow
- R restart
- dummy 1/2.

The debug contact circle must remain centered on the canonical participant root.

The Product sprite pivot must visually align with that root.

Do not change the accepted HUD layout.

---

# Tests

Verification Level:
**Standard + Browser/Runtime Smoke + User Play/Visual Gate**

## Offline asset/export verification

Required:
1. missing blue source fails
2. missing red source fails
3. wrong pixel identity fails
4. deterministic runtime export
5. committed blue.png matches fresh export
6. committed red.png matches fresh export
7. expected runtime pivot preserved
8. expected body-core ~123.077 px preserved
9. no mirror/flip used in export
10. transparent padding/pivot remain valid.

Run the relevant existing Python wrestler-art suite.

## TypeScript focused checks

Add focused tests for pure Product wrestler presentation metadata/helper where useful.

At minimum verify:
- Product keys/URLs are distinct
- pivot -> Phaser origin conversion is correct
- body-core scaling formula gives ~1.0 at accepted current bodyRadius
- scaling formula responds deterministically if bodyRadiusPx differs.

Do not unit-test Phaser internals with a large mocking framework.

## Project verification

Run:
- `pnpm test`
- `pnpm build`
- `git diff --check`.

## Runtime smoke

Open the game in a browser if the Agent environment supports it.

Verify at minimum:
- Product arena loads
- blue/red Product wrestlers load
- no missing texture / console runtime error
- pre-bout comparison still works
- Enter starts Bout
- sprite roots track canonical positions
- facing rotation updates during gameplay
- key 0 debug contact circles remain centered under Product sprites
- R restart still works.

If browser/runtime smoke is genuinely unavailable:
report it as NOT RUN.
Do not call Overall Visual Acceptance PASS based only on build/tests.

---

# User Play / Visual Test — REQUIRED

Technical PASS is not acceptance.

The User must play the real runtime after integration.

Required visual/play checks:

## A. Start / faceoff

- Do blue and red look like they face one another?
- Is the scale correct in the full 1920×1080 arena?
- Are pivots/root positions natural?
- Does the old procedural body disappear completely?

## B. Movement / continuous facing

Using WASD:
- move around the opponent
- rotate through multiple angles
- confirm the sprite's 360° rigid rotation still feels acceptable in real motion.

## C. Push / Counter

- use Up Push
- use Down Counter
- judge whether unchanged rigid art is acceptable at this prototype stage.

Do not auto-fail because there is no dedicated Push pose.
This Task intentionally tests the minimum-art approach.

## D. Kuzushi / stagger

Judge:
- whether canonical participant displacement with the same rigid image communicates stagger sufficiently
- whether a later tiny rigid presentation rotation is actually necessary.

Do not add it before this User test.

## E. Grip / grapple / Drive

Use Shift and dummy modes as needed.

Judge:
- whether close contact is readable
- whether unchanged rigid images are acceptable
- whether the first dedicated Product pose should eventually be:
  - contact/push
  - grip/grapple
  - neither yet.

## F. Ring / overall readability

- rotate/move near dohyo edge
- confirm silhouette remains readable against arena
- confirm HUD remains readable.

---

# Acceptance Criteria

Technical:

1. exact reviewed sources validated
2. deterministic normalized Product runtime sprites committed
3. no mirroring
4. old procedural wrestler body rendering replaced
5. Product image root uses explicit pivot
6. canonical Simulation position drives sprite position
7. canonical participant.facing drives whole-sprite rotation
8. Product body-core scale stays aligned to canonical bodyRadius
9. Simulation/gameplay source untouched semantically
10. HUD/debug/pre-bout flows preserved
11. pnpm test PASS
12. pnpm build PASS
13. relevant Python art tests PASS
14. git diff --check PASS
15. runtime smoke PASS or honestly NOT RUN
16. User Play Test marked REQUIRED.

Product/Game Feel:
- only User can accept.

---

# Scope Out

Do NOT:

- create 8-direction authored sprites
- generate new wrestler art
- mirror current art
- add Push/Counter/Grip/Grapple dedicated pose images
- implement sprite-sheet animation
- add skeleton/rig
- add per-limb transforms
- add tween/animation framework
- add presentation-only stagger offset/rotation formula
- change gameplay
- change Simulation movement
- change collision/bodyRadius
- change input
- change HUD
- change arena
- change Save/Management
- delete previous offline art tools.

---

# SPEC Sync

Update `docs/WRESTLER_PRODUCT_ART_SPEC.md` minimally.

Required correction:

- ART-WRESTLER-03A User Visual Gate:
  - dual separately-authored rigid sprites accepted for current prototype runtime integration
  - no mirroring
  - continuous whole-sprite rotation accepted
  - translation/root movement accepted as the minimum motion baseline
  - dedicated action/contact poses remain Deferred / only add if runtime User Play Test demonstrates need.

Also update stale sections that still state Product runtime will definitely use body-part assembly / two-link arms as the selected implementation.

Do NOT delete historical experiment records, but make the **current accepted direction unambiguous**.

Do not lock final animation/pose counts.

---

# Implementation Evidence

Completion Report must include a compact evidence section:

| Design Requirement | Implementation Evidence | Preserved | Verified By |
|---|---|---|---|

Cover at least:
- separate blue/red source
- no mirror
- explicit pivot/root
- body-core scale
- continuous canonical facing
- canonical position
- no per-limb Product rendering
- HUD/debug preservation.

---

# Completion Report

Include:

- Result
- Preflight
- reviewed source identities
- asset export command/path
- committed Product PNG dimensions/hashes
- runtime pivot/origin metadata
- scale formula
- changed files
- WrestlerView replacement summary
- preload integration
- canonical position/facing evidence
- no-mirror evidence
- removal of procedural body-art path
- tests
- build
- browser/runtime smoke
- User Play Test Required
- Implementation Evidence
- Design Deviations
- Unexpected Scope
- Git delivery.

---

# Design Deviations

Required.

If none:

`Design Deviations: NONE`

STOP and report before semantic deviation if implementation would require:
- mirror
- 8 directions
- per-limb Product rendering
- new action pose art
- gameplay change
- new stagger gameplay/presentation formula
- replacing canonical position/facing with presentation-owned equivalents.

---

# Stop Conditions

STOP/BLOCKED if:

- reviewed source files are missing
- reviewed source identity differs
- deterministic export cannot reproduce accepted Product normalization
- runtime requires mirroring to face correctly
- current source / accepted design materially conflicts
- integration cannot preserve canonical participant root/facing
- unrelated required prerequisite is discovered.

Do not broaden scope to solve a prerequisite silently.

---

# Git Delivery

Follow `AGENTS.md`.

Expected Task-owned changes may include:

- deterministic wrestler Product export tooling/config if required
- `public/assets/action/wrestler/blue.png`
- `public/assets/action/wrestler/red.png`
- small pure Product wrestler presentation metadata module
- `src/game/scenes/WrestlerView.ts`
- minimal `src/game/scenes/BoutScene.ts` preload / constructor wiring
- focused tests
- minimal `docs/WRESTLER_PRODUCT_ART_SPEC.md`
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`.

Do not stage unrelated files.

Suggested commit:

`feat: integrate rigid product wrestlers`

Push `origin/develop`.
Do not modify `main`.

# Final Instruction

Implement only the accepted dual rigid-sprite Product baseline.

Stop after runtime integration, technical verification, and Browser Smoke.

Do NOT begin dedicated action-pose production.

After commit/push/report:

「ACTION-ART-03A-RIGID-WRESTLER-RUNTIME-INTEGRATION が完了し、ChatGPT ReviewとUser Play Test待ちです」


# Final ChatGPT Review

Overall Result: TECHNICAL PASS / RUNTIME SMOKE PASS / USER PLAY TEST REQUIRED

## Reviewed Delivery

- Implementation commit:
  `f6f006dd967c5ce9b259c7cb5c140625d49f0719`
- Agent-Start-Head:
  `aff9f7948c894bd21d4f6456afa4d0571bede250`
- Delivery is one implementation commit.
- No Simulation / gameplay files changed.
- No input files changed.
- No package / lockfile changes.

## Reported Implementation vs Design

PASS.

The runtime implementation matches the accepted rigid Product-wrestler direction.

Current renderer:

```
canonical participant.position
  -> BoutScene meter-to-pixel mapping
  -> Product sprite explicit pivot/root

canonical participant.facing
  -> whole Product sprite rotation
```

No duplicated presentation-owned gameplay position/facing was introduced.

## Product Runtime Assets

PASS.

Committed deterministic runtime assets:

### blue
- `public/assets/action/wrestler/blue.png`
- 167×181
- pivot: (84, 87)
- body-core: ~123.0769 px
- decoded pixel SHA:
  `bbd3459360064934c1b2fa247fdb5821f3c5e8699b594e4b27dec93f8975fc7b`

### red
- `public/assets/action/wrestler/red.png`
- 158×178
- pivot: (82, 95)
- body-core: ~123.0769 px
- decoded pixel SHA:
  `d66895bf7301cd3dc9573cea07db7dceca07f2114ba85bcc0be763334313cdaa`

The exporter validates the reviewed source images and reproduces the committed PNGs deterministically.

Do Not Reopen:
- no manual edit of committed runtime PNGs
- no mirror/flip
- scale reference remains the explicit body-core, not full alpha bbox.

## Product Presentation Contract

PASS.

`src/game/presentation/productWrestlerArt.ts` is a small Phaser-free presentation contract.

It owns:
- asset id
- texture key
- asset path
- runtime dimensions
- explicit pivot
- body-core diameter.

Phaser origin is correctly derived from:

```
originX = pivotX / width
originY = pivotY / height
```

Display scale is:

```
(2 * canonicalBodyRadiusPx) / bodyCoreDiameterPx
```

At the accepted current bodyRadius this is ~1.0.

This preserves gameplay bodyRadius ownership while keeping presentation art visually aligned.

## WrestlerView Replacement

PASS.

Direct source inspection confirms the old procedural articulated Product path is removed.

Current `WrestlerView` contains only:
- one authored Product body Image
- one procedural near-circular shadow.

Removed from Product rendering:
- procedural feet
- procedural torso
- procedural mawashi
- procedural arms
- procedural head
- per-limb reach/spread
- crouch/lean
- torso pose interpolation
- walking/shuffle part motion
- kuzushi body-part deformation
- runtime mawashi tint cue.

No obsolete articulated body path continues invisibly.

## Canonical Position / Facing

PASS.

Direct source inspection confirms:

`BoutScene.syncViews()`
- computes `pos = toCanvas(participant.position)`
- uses the same `pos` for debug contact-circle center
- passes that `pos` to `WrestlerView.apply()`.

`WrestlerView.apply()`:
- `body.setPosition(positionPx.x, positionPx.y)`
- `body.setRotation(participant.facing)`.

No facing quantization.
No presentation interpolation of gameplay facing.
No alternate root position.

This is the requested architecture.

## No-Mirror / No Per-Limb Product Rendering

PASS.

Runtime uses distinct blue / red texture files.

No:
- `setFlipX`
- `setFlipY`
- negative display scale
- per-limb Product renderables
- sprite-part reconstruction.

This preserves the User-approved visual baseline.

## Minimal Motion Interpretation

PASS.

The runtime now follows the intended minimum-animation interpretation:

- movement:
  canonical participant root moves; same sprite follows
- facing:
  same sprite rotates continuously
- Push / Counter / Grip / Grapple / Drive / Kuzushi:
  same base Product sprite remains in use
- no dedicated action pose yet
- no invented presentation-only stagger translation/rotation.

For Kuzushi/stagger specifically:
the renderer shows the canonical Simulation displacement only.

This is intentional.
A later presentation-only stagger polish must not be added unless User Play Test shows it is necessary.

## Visual State Preservation

PASS.

`wrestlerVisualState.ts` was not redesigned.

It remains pure and continues to expose existing action/pose semantics.

The rigid Product renderer currently uses it only to maintain `moving` hysteresis compatibility.

This preserves a clean future route to a hybrid minimal-pose system without prematurely adding poses now.

## Shadow

ACCEPTED for current baseline.

The shadow remains:
- presentation-only
- below Product bodies
- world-position offset down/right
- near-circular ellipse
- not baked into Product PNG.

The ellipse still receives participant facing rotation, as the previous current visual path did.
Because the shape is near-circular, this is not a blocking Product issue.

Do not reopen unless User Play Test makes shadow rotation visibly distracting.

## BoutScene / HUD / Debug Preservation

PASS.

Direct source inspection confirms only minimal scene wiring:
- Product wrestler preload
- blue/red art id in presentation metadata
- Product art passed to WrestlerView
- obsolete `dtMs` argument removed from `syncViews()`.

Preserved:
- pre-bout comparison
- Enter start
- Product HUD
- key 0 debug
- contact circles
- facing marker
- labels / phase text
- grapple line
- arena boundary debug
- R restart
- dummy 1 / 2
- existing input/gameplay flow.

## Verification Completeness

PASS technically.

Reported verification:

- `pnpm test`
  - PASS
  - 18 files / 262 tests

- `pnpm build`
  - PASS

- Python wrestler-art tests
  - 107 PASS

- `git diff --check`
  - PASS

- deterministic export `--check`
  - blue PASS
  - red PASS

- Browser/runtime smoke
  - PASS
  - Product arena loaded
  - blue/red assets loaded
  - pre-bout flow worked
  - Enter start worked
  - movement/facing updated
  - key 0 debug root alignment checked
  - R restart worked
  - old procedural bodies absent
  - no relevant console runtime exception.

## Runtime Smoke Limitation

The Agent smoke did NOT fully verify:
- real User-perceived motion quality
- Kuzushi readability
- successful Grip/Grapple/Drive visual quality
- dohyo-edge readability during actual play.

The automated input attempt did not establish Grip; engagement stayed FREE.

Therefore those items remain mandatory User Play Test, not Technical PASS evidence.

## Unexpected Scope Review

The Agent changed `docs/ARCHITECTURE.md` by 3 lines even though it was not listed in expected Task-owned changes.

Reviewed result:
- only stale current-state documentation was synchronized
- it now accurately states the rigid Product WrestlerView
- no architecture rule or gameplay semantics changed.

Classification:
**Accepted non-semantic documentation sync.**

No rerun required.

Do not treat nearby stale documentation as automatic permission for future scope expansion; report first when material.

## SPEC Sync

PASS.

The Product wrestler spec now makes current authority explicit in §0:

- two separately authored rigid full-body sprites
- no mirror
- continuous whole-image facing rotation
- canonical root translation as minimum movement baseline
- all current action states use the same sprite
- dedicated action/contact poses Deferred pending User Play Test.

Older part-based/two-link material remains clearly labeled historical.

This is sufficient and avoids rewriting historical design records.

## User Goal Attainment

Technical runtime integration goal:
**ACHIEVED**

Product / Game Feel goal:
**PENDING USER PLAY TEST**

The assets are now running in the actual Phaser game, but Technical PASS cannot decide whether:
- rigid Push looks convincing
- Counter is readable
- Kuzushi feels like stagger
- Grip/Grapple/Drive is readable
- continuous rotation still feels acceptable under real input.

## User Play Test — REQUIRED

Run the current `develop` runtime.

Suggested local command:

```
pnpm dev
```

Then test:

### 1. Pre-bout / start
- comparison appears
- Enter starts
- blue left / red right
- size and facing look natural.

### 2. Movement / rotation
- WASD around the opponent
- circle around the opponent
- inspect diagonal / vertical / reverse directions
- judge 360° rigid rotation in live motion.

### 3. Push / Counter
- ArrowUp Push
- ArrowDown Counter
- judge whether same base sprite is acceptable at this prototype stage.

### 4. Kuzushi / stagger
- trigger successful/failed Counter where practical
- judge whether canonical displacement alone visually communicates stagger
- specifically decide whether a future tiny rigid rotation/offset is needed.

### 5. Grip / Grapple / Drive
- Shift for Grip
- use dummy mode 1 / 2 as needed
- establish Grapple if possible
- hold ArrowUp for Drive
- judge close-contact readability.

### 6. Debug alignment
- key 0
- verify contact circles remain centered under body mass
- verify facing marker agrees with apparent sprite front.

### 7. Edge readability
- move toward dohyo edge
- rotate near tawara
- check silhouette and HUD readability.

## Acceptance Questions

Please report:

1. **360° rotation**: OK / NG
2. **normal movement**: OK / NG
3. **Push/Counter with same sprite**: OK / NG
4. **Kuzushi using position change only**: OK / NG
5. **Grip/Grapple/Drive with same sprite**: OK / NG / not tested
6. **sprite size/root alignment**: OK / NG
7. any specific state that first looks unacceptable.

## Accepted Baseline If User Passes

If User Play Test is acceptable, current baseline becomes:

- blue/red rigid Product sprites integrated
- no mirror
- one base sprite per wrestler
- canonical position translation
- canonical continuous facing rotation
- no action-specific Product pose yet.

Then the next visual task should be driven only by an observed runtime weakness, not by automatically creating animation sets.

## Next Task Constraint

Do NOT create a new action-pose / 8-direction / animation-production Task until User Play Test identifies a concrete deficiency.

If the current rigid baseline passes:
continue to the next highest-priority Action/Game Feel issue.

If only one state fails:
create a narrowly scoped hybrid-pose investigation for that state only.

## Final Acceptance State

Implementation:
**TECHNICAL PASS**

Runtime Smoke:
**PASS**

Architecture / Scope:
**PASS with accepted minor documentation sync**

Product Game Feel:
**PENDING USER PLAY TEST**


# User Play Test Result — 2026-10-21

User Play Test has now been completed for the ACTION-ART-03A rigid Product-wrestler runtime baseline.

## Accepted

### 360° rigid rotation
**USER ACCEPTED**

- continuous whole-sprite facing rotation is acceptable
- no 8-direction authored set is required for the current baseline.

### Normal movement
**USER ACCEPTED**

- canonical participant position -> rigid sprite translation is acceptable for normal movement.

### Sprite size / root alignment
**USER ACCEPTED**

- current Product size and root/pivot alignment are acceptable.

These are now the current Product visual baseline and should not be reopened without an explicit task.

## Push / Counter

### Push
Current same-sprite Push is **acceptable enough to continue for now**.

Do not create a Push-specific image automatically.

### Counter
Current same-sprite Counter is **NOT accepted**.

User decision:
- pressing Down / Counter should use dedicated authored art
- the dedicated visual must also support a Counter whiff / failed attempt being readable.

Do not lock the exact number of Counter frames/images yet.

A future focused Counter-art task is required before Counter visuals are Product-accepted.

## Counter Success Relocation / Stagger

User observed obvious instant-position jumps around the tested Counter-success moments and rejected the current visual.

Current Source inspection shows this is not merely the `posture.kind === 'kuzushi'` state.

On successful Counter, `BoutSimulation.resolveCounter()` currently calls `counterRelocationTarget(...)` and then directly assigns:

```
defender.position.x = target.x
defender.position.y = target.y
```

in one Simulation tick.

Therefore the rigid Product sprite correctly exposes an existing **instant canonical Counter relocation**.

User goal:
- the displaced / broken wrestler should visibly stagger through a short continuous position animation
- the successful wrestler should also move naturally during the exchange
- the same base sprite may be reused for the stagger if position-only animation is visually sufficient
- reference feel: the uploaded `yoroke.mp4`
- do NOT assume new stagger artwork is required.

Important:
This is now a Movement / State-ownership issue, not just an art swap.

Do NOT implement presentation smoothing blindly.

A focused Investigation / Design must decide whether:
1. Counter positional resolution becomes time-based canonical Simulation movement, or
2. gameplay relocation remains instantaneous and Phaser derives a temporary presentation transition.

The architecture consequences and contact/ring-out semantics must be reviewed before implementation.

Do not silently change accepted Counter gameplay semantics.

## Terminology Correction

For User-facing discussion:

- `Kuzushi` = internal gameplay posture/state in current Source
- the visually rejected instant jump = successful Counter's direct position relocation
- do not use “Kuzushi” as shorthand for that teleport-like relocation.

## Grip / Grapple / Drive

Current non-Grip rigid image:
**USER ACCEPTED as the non-Grip/base state.**

Current same-sprite Grip/Grapple visuals:
**USER REJECTED.**

User direction:
- create a dedicated **Grip state** authored image
- create a separate dedicated **Grip / Morozashi state** authored image.

Do not assume the exact runtime mapping yet between:
- `action.kind === 'grip'` reach/recovery
- established neutral `engagement.kind === 'grappled'`
- Morozashi holder/disadvantaged.

That mapping needs a focused art/state design task so “Grip state” is not interpreted incorrectly.

### Tsuri / lift

User direction:
- if a future Tsuri/lift state can be communicated clearly using position-only motion, prefer that
- if it is visually unclear, dedicated Tsuri art may be added.

Tsuri is Deferred.
Do not implement it as part of the current Counter/Grip follow-up unless explicitly tasked.

## Updated Product Art Strategy

Current accepted strategy is now **hybrid minimal-pose**, not “one sprite for every action”.

Accepted minimum:

- Base / non-Grip:
  - current blue/red rigid sprites
  - 360° rotation
  - normal translation.

Future dedicated art is justified only where User Play Test found a concrete failure:

- Counter: dedicated art required
- Grip established state: dedicated art required
- Grip Morozashi state: dedicated art required.

Potentially no new art:
- normal movement
- Push, for now
- Counter-success stagger displacement, if continuous position animation with existing art is sufficient
- future Tsuri, if position-only motion is readable.

Do NOT expand this into an 8-direction × every-state sprite matrix.

## Next Work Ordering Constraint

Before generating/implementing all dedicated art, first address the Counter visual/movement problem carefully.

Recommended next sequence:

1. focused Investigation / Design:
   Counter success relocation + stagger motion ownership
   - why instant relocation exists
   - Simulation-time movement vs presentation-only transition
   - successful-side movement
   - contact/ring-out/facing implications
   - preserve Counter outcome semantics unless User approves a gameplay change.

2. after design is accepted:
   implement the smallest continuous Counter-success movement/stagger representation.

3. separately:
   define/generate dedicated Counter art and map Counter active/whiff states.

4. separately:
   define/generate dedicated Grip neutral and Morozashi art and map them to canonical state.

Do not combine Counter movement semantics + Counter new art + Grip new art into one large implementation task.

## User Reference Video

The User uploaded `yoroke.mp4` as a feel reference.

Use it only as a reference for:
- short continuous displacement
- loser stagger/readability
- successful side also moving naturally through the exchange.

Do not copy its gameplay rules or frame timing blindly.
Do not treat it as proof that one static sprite is sufficient; that remains a User visual gate after implementation.
