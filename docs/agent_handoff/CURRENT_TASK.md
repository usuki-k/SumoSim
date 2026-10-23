Task-ID: ACTION-11I-GRIP-SUCCESS-LIMB-VFX-POSITION-TUNE
Status: READY
Task-Type: PRESENTATION VISUAL TUNE
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: f062164afa668c2329f2203ddb46c1d3b3183788
Review-Handoff: ACTION-11H technical PASS; User Visual Gate accepted the tone correction as good enough for now. ACTION-11G limb VFX remains visually rejected. ACTION-11F pair compression remains accepted baseline.
Handoff-Mode: GITHUB

# ACTION-11I — Grip Success Limb VFX Position Tune

## Purpose

Rework only the position / orientation / layering of the existing Grip-success arm/hand VFX so the pair reads more like two wrestlers actively wrapping and holding each other.

User feedback on ACTION-11G:

- the procedural limb VFX is technically functional but visually wrong
- current arms look like detached horizontal bars laid across the bodies
- desired hand/arm relationship is closer to the latest User reference:
  - arms originate from the wrestler body
  - one arm wraps higher around the opponent's upper torso / shoulder area
  - another arm reaches lower around the opponent's side / waist / mawashi area
  - partial occlusion by the opponent body is acceptable and often preferable
  - it is NOT necessary for the whole hand/forearm to remain visible.

This is a Presentation-only visual tune.

Do not change gameplay.

---

# Accepted Baselines — Preserve

## ACTION-11H Tone Match

Accepted by User for now.

Do not reopen:

- Grip-success skin tone correction
- selected Candidate C levels curve
- Grip-success runtime dimensions / pivot / body core
- red -> blue derivation.

Current corrected Grip success assets remain as-is.

## ACTION-11F Pair Compression

Accepted by User.

Preserve exactly:

```
GRIP_SUCCESS_FORWARD_OFFSET_R = +0.14
GRIP_SUCCESS_LATERAL_OFFSET_R = -0.20
```

Do not retune these in ACTION-11I.

## ACTION-11C Gameplay

Preserve exactly:

- Grip lunge / timing
- contact success
- Push / Tsuppari / Counter / Grip contest rules
- canonical 0.70 m grapple bond
- Grappled Orientation
- Drive
- release
- ring-out.

No Production changes under:

```
src/game/sumo/
src/game/input/
```

---

# Current Rejected Limb VFX Baseline

Current ACTION-11G uses two procedural limbs per wrestler:

```
FAR:
start (0.18, +0.42)
end   (0.82, +0.25)
width 0.20 R
hand  0.15 R

NEAR:
start (0.22, -0.65)
end   (1.12, -0.58)
width 0.22 R
hand  0.16 R
```

Depths:

```
far = 1.9
body = 2.0
near = 2.2
```

These values are NOT visually accepted.

ACTION-11I may change:
- limb start/end points
- limb angle
- width / hand size if needed
- far/near assignment
- fixed depth values
- whether part of an arm is intentionally hidden by body overlap.

Do not change the underlying success body placement.

---

# Visual Goal

The revised VFX should read like:

> each wrestler has arms wrapped around the opponent rather than bars floating over the pair.

Target relationship:

## High arm

- originates around the wrestler's shoulder / upper side
- crosses toward the opponent's upper torso / shoulder / upper back region
- may disappear partially behind the opponent body
- only the useful visible forearm / hand segment needs to remain visible.

## Low arm

- originates lower on the wrestler's side
- wraps toward the opponent's flank / waist / mawashi region
- hand should visually land near the opponent torso / waist / mawashi
- partial overlap/occlusion is desirable if it makes the grip read more naturally.

The two arms do not need to be perfectly symmetric vertically.

It is acceptable for one arm to be visually more prominent than the other.

---

# Important Visual Rule

Do NOT optimize for showing the whole arm.

Optimize for a believable grip.

If necessary:

- hide the shoulder/root under the wrestler body
- hide part of forearm under the opponent body
- show only the distal forearm/hand
- let one wrestler visually cover the other's limb where the fixed draw order does so naturally.

The User explicitly accepts overlap.

---

# Preferred Rendering Strategy

Reuse the current procedural limb system.

Do not regenerate wrestler images.

Do not add external limb image assets.

Prefer updating:

```
src/game/presentation/gripSuccessLimbVfx.ts
```

and, only as needed:

```
src/game/scenes/WrestlerView.ts
```

Keep the helper Phaser-free.

Do not introduce a generic animation or limb framework.

---

# Placement Strategy

Use wrestler-local geometry in R units, anchored to the ACTION-11F displayed body center.

Local convention:

- +X = FRONT
- +Y = wrestler RIGHT
- -Y = wrestler LEFT.

However, unlike ACTION-11G, do not assume both useful arms should simply extend forward in near-parallel lines.

Investigate geometry that better crosses toward the opponent.

Recommended exploration:

### Candidate A — upper wrap + low waist grip

High arm:
- shoulder relatively lateral / upper side
- hand endpoint nearer opponent shoulder / upper torso

Low arm:
- shoulder lower / opposite side
- hand endpoint farther forward and closer to opponent waist / mawashi.

### Candidate B — one visible near arm + one mostly hidden far arm

- make the NEAR limb the main readable grip
- keep FAR limb mostly behind / occluded so it adds depth without looking like another bar.

### Candidate C — asymmetric visible lengths

- shorter visible high arm
- longer low arm reaching toward mawashi.

Do not mechanically preserve the current ACTION-11G geometry if another small geometry better matches the User reference.

---

# Reference Image Interpretation

The latest User reference should guide the geometry:

- both arms appear to wrap around an opponent
- hands are not centered on the wrestler's own body
- arm roots are visually connected to shoulders/sides
- distal hands sit on the opponent side / waist
- no obvious circular cut-face / detached tube appearance should dominate.

The VFX does NOT need to reproduce full fingers or exact anatomy.

At gameplay scale:
- attachment
- direction
- grip destination
matter more than anatomical detail.

---

# Root / Cut-Face Problem

The current VFX can expose a rounded/circular shoulder-end that reads like a cut cylinder.

Reduce that visual.

Preferred methods:

1. bury root deeper under the wrestler body
2. let body occlude the start cap
3. shorten the visible segment
4. adjust texture/origin so the cap is hidden beneath body.

Do not solve by editing the wrestler source sprite.

If necessary, the procedural texture may omit the visible shoulder-end cap on the exposed side.

Keep the change small and explicit.

---

# Depth / Occlusion

The current simple depth split may be adjusted.

Goal:

- at least one arm visually passes behind the bodies
- at least one forearm / hand appears on top where it indicates holding.

Allowed:
- tweak FAR depth
- tweak NEAR depth
- use existing stable body creation order
- assign one wrestler's visible grip arm differently only if needed through existing stable order.

Do NOT add:
- dynamic per-frame depth sorting
- generic z-order system.

If convincing overlap requires dynamic sorting, STOP and report.

---

# Visibility Scope

Still only:

```
state.pose === 'grapple'
|| state.pose === 'drive'
```

Hidden for:

- Grip attempt
- Grip recovery
- idle
- move
- Push
- Tsuppari
- Counter
- Kuzushi
- after release.

No timer.

---

# Neutral / Morozashi / Drive

Use the same tuned geometry for:

- neutral
- Morozashi holder
- Morozashi disadvantaged
- Drive.

Do not add advantage-specific limbs yet.

---

# Turning

Inspect:

1. turning immediately after grapple
2. turning mid
3. turning settled.

The VFX must follow current canonical facing.

However, the User's primary target is the settled/front-facing grip.

Do not over-engineer a turning-specific solution.

If the tuned limbs look temporarily less perfect during turning but remain coherent / attached, that is acceptable.

If turning causes severe floating / inversion:
- STOP and report
- do not change Grappled Orientation gameplay.

---

# Required Browser Screens

Capture the same 8-frame set:

1. neutral immediately after success
2. neutral settled
3. Drive while grappled
4. Morozashi grapple
5. immediately after release
6. turning immediately after success
7. turning mid
8. turning settled.

Create a montage/sheet.

Also create a before/after comparison against ACTION-11G if practical.

---

# Required Tests

## Geometry

G1. tuned limb geometry is deterministic.

G2. limb start is attached sufficiently close to wrestler body region.

G3. hand endpoints are meaningfully in front / across toward the opponent.

G4. one limb is clearly higher / upper-wrap oriented.

G5. one limb is clearly lower / waist-grip oriented.

G6. dimensions remain R-relative.

## Visibility

V1. grapple visible.

V2. Drive visible.

V3. attempt hidden.

V4. release/recovery hidden.

V5. other actions hidden.

## Preservation

P1. ACTION-11F forward/lateral constants unchanged.

P2. ACTION-11H tone-match recipe/curve unchanged.

P3. Grip-success body textures unchanged by this Task.

P4. canonical 0.70 m bond unchanged.

P5. Snapshot unchanged.

P6. no src/game/sumo or src/game/input Production diff.

---

# User Visual Gate

REQUIRED.

Primary question:

> Do the revised arms/hands now look like they belong to each wrestler and wrap around the opponent toward upper torso / waist, rather than floating horizontal bars?

Judge:

- arm root feels attached
- high arm reads as upper-body wrap
- low arm reads as waist/mawashi grip
- hands look like they land on the opponent
- partial occlusion looks natural
- settled neutral is convincing
- Drive remains coherent
- turning remains acceptable
- release removes all limb VFX cleanly.

If rejected again:
- report whether the failure is:
  - arm root
  - endpoint / hand position
  - thickness
  - depth / occlusion
  - procedural shape itself.

Do not jump to authored limb sprites unless the User explicitly asks.

---

# Scope

## In Scope

- existing procedural Grip limb VFX geometry
- width/hand size if needed
- fixed depth/layer assignment
- root occlusion
- before/after visual evidence
- tests and browser smoke.

## Scope Out

Do NOT:

- change ACTION-11F compression
- change ACTION-11H tone matching
- change gameplay
- change canonical bond
- modify Grip success / attempt source images
- AI regenerate art
- add audio/camera/particles
- add Morozashi-specific pose
- modify PROJECT_HANDOFF.md.

---

# Stop Conditions

STOP if:

- position/depth tuning cannot make procedural limbs read naturally
- an authored external limb asset becomes necessary
- pair compression must be retuned materially
- gameplay/facing/bond changes would be required
- dynamic z-order framework is required
- unrelated accepted visuals regress.

---

# Verification

Verification Level:
Standard Presentation Visual Tune

Required:

- focused limb geometry tests
- Grip success presentation tests
- Grip/Grapple/Drive/Orientation regression
- Push/Tsuppari/Counter/Kuzushi presentation regression
- `pnpm test`
- `pnpm build`
- `git diff --check`
- browser/runtime smoke
- prove ACTION-11F/11H unchanged
- prove src/game/sumo and src/game/input unchanged.

---

# Completion Report

Include:

- Result
- old limb geometry -> new limb geometry
- final depth values
- any root-cap/occlusion change
- changed files
- proof ACTION-11F constants unchanged
- proof ACTION-11H tone curve unchanged
- proof gameplay/canonical bond unchanged
- focused/full verification
- 8-frame montage
- before/after comparison if available
- turning observation
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

`feat(presentation): retune grip success limb placement`

Do not modify:

- `main`
- `PROJECT_HANDOFF.md`
- `CURRENT_TASK.md`.

# Final Instruction

Keep accepted Grip gameplay, ACTION-11F pair compression and ACTION-11H tone matching unchanged.

Retune only the existing procedural Grip-success arm/hand VFX so that:
- one arm wraps higher toward the opponent's upper torso/shoulder
- one arm wraps lower toward the opponent's waist/mawashi
- roots are visually attached/occluded
- hands visibly land on the opponent
- the result no longer looks like detached horizontal bars.
