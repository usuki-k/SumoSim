Task-ID: ACTION-11G-GRIP-SUCCESS-ARM-HAND-VFX
Status: READY
Task-Type: PRESENTATION VISUAL EFFECT GATE
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: a88234c335218cc5dc409e80ced3c8fd506675b6
Review-Handoff: ACTION-11F technical PASS; User Visual Gate accepted the +0.14R forward / -0.20R lateral Grip-success pair compression as visually good
Handoff-Mode: GITHUB

# ACTION-11G — Grip Success Arm / Hand VFX Gate

## Purpose

Add presentation-only arm / hand VFX while Grip success is active so the already-accepted compressed pair reads more clearly as two wrestlers actively holding / wrapping each other.

User goal:

> ACTION-11Fの密着・めり込みは良い感じ。  
> ここに腕・手のVFXを足せば、実相撲の四つ身のように「組み合っている」見た目へ近づくと思う。

This Task must preserve the accepted ACTION-11F pair compression.

The VFX is provisional and User Visual Gate owned.

Do not change gameplay.

---

# Accepted Current Visual Baseline

ACTION-11F is now the current Grip-success visual baseline.

Preserve exactly:

```
GRIP_SUCCESS_FORWARD_OFFSET_R = +0.14
GRIP_SUCCESS_LATERAL_OFFSET_R = -0.20
```

Current scope:

```
state.pose === 'grapple'
|| state.pose === 'drive'
```

Current behavior:

- success sprite is shown
- body + shadow receive the ACTION-11F display offset
- canonical Simulation centers remain unchanged
- canonical grapple bond remains 0.70 m
- current facing is unchanged
- overlap between wrestler sprites is intentional
- existing render order is stable
- release removes success display offset immediately.

Do not retune the two ACTION-11F offset constants in ACTION-11G unless a technical rendering defect makes the VFX impossible.
If tuning would be required for visual preference only, STOP and report instead.

---

# Gameplay Baseline — Preserve Exactly

ACTION-11C gameplay is accepted.

Do not change:

- Grip reach = 8 ticks
- Grip minimum attempt = 4 ticks
- Grip recovery = 12 ticks
- Grip lunge
- contact-driven Grip success
- Tsuppari > Grip
- Push impact > Grip
- Grip > Counter
- Grip vs Grip neutral
- Kuzushi -> Morozashi
- grapple bond
- Grappled Orientation
- Drive
- release
- ring-out
- same-participant input priority.

No Production changes are allowed under:

```
src/game/sumo/
src/game/input/
```

---

# Visual Target

Use the real-sumo reference already supplied by the User as the intended visual language:

- chests / shoulders are tightly engaged
- arms visibly wrap around the opponent
- at least one visible hand appears to reach the opponent's side / waist / mawashi area
- it should read as "holding / gripping" rather than two bodies merely overlapping.

The VFX does NOT need anatomical realism at full illustration quality.

At gameplay scale, prioritize:

1. readable arm silhouette
2. readable hand / grip point
3. natural attachment to the wrestler body
4. stable appearance during Drive and turning.

Do not add text / UI icons / hand symbols floating above the wrestler.

The VFX should look like body/limb presentation, not HUD.

---

# Preferred VFX Strategy

Use small procedural Presentation-only arm/hand overlays.

Do NOT create a new authored wrestler sprite or a new large art pipeline.

Preferred implementation:

- one reusable procedural forearm/hand visual generated in Phaser
- reused for both wrestlers
- positioned / rotated from pure local geometry
- mirrored naturally by local-frame math rather than runtime sprite mirroring.

A simple stylized arm is acceptable:

- skin-colored rounded forearm/capsule
- dark outline matching the wrestler art approximately
- small rounded hand / palm at the end.

No fingers are required for this Visual Gate.

Do not use external image assets unless procedural drawing proves technically unsuitable; if external art becomes necessary, STOP and report before adding it.

---

# Two-Layer Arm Model

Preferred minimal visual model per wrestler:

1. FAR arm
   - drawn behind both wrestler bodies
   - gives the impression of an arm wrapping behind / around the opponent

2. NEAR arm
   - drawn above both wrestler bodies
   - gives a visible forearm + hand crossing onto the opponent's torso / waist.

This provides depth without changing gameplay or the body sprite.

Recommended depths, relative to current body depth 2:

```
far arm  < body
body     = existing depth
near arm > body
```

Use small explicit constants such as:
- far arm depth around 1.9
- near arm depth around 2.1–2.2

Exact values may follow existing Scene depth conventions.

Do NOT add a generic z-order framework.

---

# Initial Geometry

Treat these as provisional starting values, in wrestler-local R units.

Local convention:

- +X = FRONT
- +Y = wrestler RIGHT
- -Y = wrestler LEFT.

Preferred initial geometry:

## Near arm

```
shoulder/start:
  forward = +0.20 R
  lateral = -0.42 R

hand/end:
  forward = +0.92 R
  lateral = -0.28 R

arm width:
  ~0.22 R

hand radius / half-size:
  ~0.16 R
```

## Far arm

```
shoulder/start:
  forward = +0.18 R
  lateral = +0.42 R

hand/end:
  forward = +0.82 R
  lateral = +0.25 R

arm width:
  ~0.20 R

hand radius / half-size:
  ~0.15 R
```

These values are not gameplay values.

Agent may make small local visual adjustments if the initial geometry clearly floats off the body or misses the opponent because of the normalized success sprite.

If adjusted:
- keep the change minimal
- report the final R-relative values
- do not change ACTION-11F pair compression constants.

---

# Pure Presentation Geometry

Prefer a Phaser-free helper, for example:

```
src/game/presentation/gripSuccessLimbVfx.ts
```

It should own:

- whether VFX is visible
- local start/end points
- width / hand size
- layer role (far / near)
- conversion to world/canvas positions from:
  - displayed wrestler center
  - canonical facing
  - body radius R.

The helper must NOT:

- read Scene time
- use render delta
- mutate Snapshot
- decide gameplay
- import Phaser.

The VFX must use the already ACTION-11F-adjusted displayed center as its anchor.

Do not recompute or duplicate the Grip-success pair compression formula.

---

# Visibility Scope

Show the arm/hand VFX only while the Grip-success pose is active:

```
state.pose === 'grapple'
|| state.pose === 'drive'
```

Required:

- neutral grapple -> visible
- Drive -> visible
- Morozashi holder -> visible
- Morozashi disadvantaged -> visible
- Grappled Orientation turning -> visible and follows facing.

Must be hidden for:

- Grip attempt
- Grip recovery
- idle
- move
- Push
- Tsuppari
- Counter
- Kuzushi
- after release
- pre-bout.

No independent timer.

---

# Neutral / Morozashi

For ACTION-11G, use the same arm/hand VFX geometry for:

- neutral
- Morozashi holder
- Morozashi disadvantaged.

Do not encode Morozashi advantage into the hand VFX yet.

No special color / glow / icon for holder.

That remains Deferred.

---

# Turning / Orientation

VFX must follow each wrestler's current canonical facing.

During TURNING:

- shoulder anchor stays attached to that wrestler's displayed success body
- forearm rotates smoothly with facing
- hand does not stay fixed in world space
- no unexplained teleport
- no independent interpolation.

Do not add turning-specific animation.

If one arm passes visually through the wrong layer during turning, keep the fixed far/near layer model for this Gate unless it causes a severe visual break.

Do not change Grappled Orientation gameplay.

---

# Drive

During Drive:

- success body remains ACTION-11F-compressed
- arms/hands remain visible
- VFX follows current canonical facing
- no flicker / hide/show caused by `pose: drive`.

Do not animate hand pumping or limb motion yet.

Static attached limbs are sufficient for this Gate.

---

# Release

At release:

```
grapple / drive
-> FREE
```

VFX must disappear on the first free frame, exactly with the success-art / pair-compression removal.

Do not fade.

Do not show arms during Grip recovery.

---

# Rendering / Style

Use a small procedural texture or equivalent simple Graphics-based representation.

Preferred visual style:

- skin fill close to current wrestler skin
- dark outline close to current sprite outline
- opaque or nearly opaque
- no glow
- no particles
- no UI icon style.

If using generated textures:
- generate once per relevant R / scene
- reuse images
- do not recreate texture every frame.

If using Graphics:
- keep object count small and explicit
- do not create/destroy every frame.

Do not introduce a particle system.

---

# Draw Order Stability

The current ACTION-11F body overlap uses stable existing body ordering.

For limb overlays:

- FAR arms must stay behind the bodies
- NEAR arms must stay above the bodies
- ordering must remain stable frame-to-frame
- no z-fighting/flicker.

If two near arms overlap, existing stable creation order is acceptable.

Do not build dynamic depth sorting unless a clear technical defect proves necessary.

---

# WrestlerView Integration

WrestlerView may own the Phaser images/graphics for the limb VFX.

Expected responsibilities:

- create/preload/generate VFX resources
- update visibility
- set arm/hand position/rotation/size from pure helper geometry
- follow ACTION-11F displayed body center
- use canonical facing.

Do not alter:

- success texture selection
- body pivot
- body scale
- ACTION-11F pair compression
- shadow logic except necessary reuse of displayed body center
- Kuzushi sweat.

---

# Required Tests

## Pure Geometry

G1. non-success pose -> VFX hidden.

G2. grapple -> visible.

G3. drive -> visible.

G4. local start/end transform correctly for facing 0.

G5. transform correctly for facing π/2, π, -π/2.

G6. arm length / width / hand size use R-relative values.

G7. near and far arms remain on opposite lateral sides.

G8. geometry is deterministic.

## State Scope

S1. neutral grapple -> both wrestlers get VFX.

S2. Morozashi holder -> VFX.

S3. Morozashi disadvantaged -> VFX.

S4. Drive -> VFX.

S5. Grip attempt -> hidden.

S6. release recovery -> hidden.

S7. Push / Tsuppari / Counter / Kuzushi / idle -> hidden.

## Ownership / Regression

O1. Snapshot unchanged.

O2. canonical grapple bond remains 0.70 m.

O3. ACTION-11F pair compression constants remain +0.14 / -0.20.

O4. Grip success / attempt textures unchanged.

O5. no src/game/sumo or src/game/input Production diff.

O6. no public wrestler asset / wrestler-art tool changes.

---

# Browser / Runtime Smoke

Required.

At minimum inspect:

1. Enter starts Bout
2. Grip attempt has no arm/hand VFX
3. neutral success shows arms/hands
4. shoulders / arms appear attached, not floating
5. at least one visible hand reaches opponent torso / waist area
6. pair still uses accepted ACTION-11F compression
7. visible overlap remains stable
8. far arm remains behind bodies
9. near arm remains above bodies
10. Drive keeps VFX stable
11. Morozashi keeps VFX stable
12. TURNING start
13. TURNING mid
14. TURNING settled
15. release removes VFX immediately
16. later Grip attempt has no stale VFX
17. Push / Tsuppari / Counter / Kuzushi unchanged
18. R restart
19. no new console/runtime errors.

Capture screenshots / crops:

- neutral immediately after success
- neutral settled
- Drive
- Morozashi
- turning immediately after success
- turning mid
- turning settled
- immediately after release.

Also create one montage / sheet if convenient for User Visual Gate.

---

# User Visual Gate

REQUIRED.

Primary question:

> Do the procedural arms/hands make the accepted ACTION-11F compressed pair read clearly as two wrestlers actively holding / grappling each other?

Judge:

- arms visibly wrap toward the opponent
- at least one hand reads as grabbing / holding near torso or mawashi
- limbs do not float
- arm thickness matches the character reasonably
- VFX does not look like a UI icon
- overlap is acceptable
- neutral / Drive / Morozashi remain coherent
- turning does not break badly
- release removal is clean.

If hands/arms are too subtle:
- tune only the limb geometry/size first.

If limbs look visually disconnected from the wrestler:
- tune local anchor/end points first.

Do not immediately replace body sprites or change gameplay.

---

# Scope

## In Scope

- procedural Grip-success arm/hand VFX
- pure local geometry
- far/near layer model
- WrestlerView presentation integration
- focused presentation tests
- browser visual smoke
- User Visual Gate.

## Scope Out

Do NOT:

- change ACTION-11F pair compression
- change gameplay
- change Simulation position/facing/bond
- change Grip success/attempt images
- modify art exporters/recipes
- add Morozashi-specific hand pose
- add attack animations
- add audio/camera shake
- add particles
- add generic limb/animation framework
- modify PROJECT_HANDOFF.md.

---

# Stop Conditions

STOP if:

- convincing arm/hand VFX requires gameplay geometry changes
- ACTION-11F offsets must be changed materially to attach the arms
- a new authored full wrestler sprite is required
- external image assets are required instead of the planned procedural VFX
- turning requires new gameplay/facing semantics
- rendering needs a broad dynamic z-order system
- unrelated accepted visuals regress.

---

# Verification

Verification Level:
Standard Presentation Visual Gate

Required:

- focused pure limb geometry tests
- focused Grip success presentation tests
- Grip attempt regression
- Grip/Grapple/Drive/Orientation gameplay regression
- Counter/Tsuppari/Kuzushi/Push presentation regression
- `pnpm test`
- `pnpm build`
- `git diff --check`
- browser/runtime smoke
- prove src/game/sumo and src/game/input unchanged
- prove public/assets/action/wrestler and tools/wrestler_art unchanged.

---

# Completion Report

Include:

- Result
- final VFX geometry values
- final layer/depth values
- render method
- changed files
- proof ACTION-11F values unchanged
- proof gameplay/canonical bond unchanged
- focused/full verification
- browser smoke
- neutral/Drive/Morozashi/turning/release screenshots
- draw-order observation
- Design Deviations
- Unexpected Scope
- User Visual Gate: REQUIRED
- Git delivery.

If none:

```
Design Deviations: NONE
```

---

# Git Delivery

Follow `AGENTS.md`.

Normal successful Task:

- stage Task-owned files only
- one implementation commit
- fetch / fast-forward safety
- push `origin/develop`
- verify remote SHA
- clean working tree.

Suggested commit:

`feat(presentation): add grip success arm hand vfx`

Do not modify:

- `main`
- `PROJECT_HANDOFF.md`
- `CURRENT_TASK.md`.

# Final Instruction

Keep ACTION-11F pair compression exactly as accepted.

Add only Presentation-only Grip-success arm/hand VFX while:

```
pose === 'grapple' || pose === 'drive'
```

Use a small procedural far-arm / near-arm model anchored to each wrestler's ACTION-11F displayed body position and canonical facing.

Do not change gameplay, canonical positions, bond distance, facing, wrestler assets or art tooling.
