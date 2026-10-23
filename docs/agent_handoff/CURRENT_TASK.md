Task-ID: ACTION-11L-GRIP-SUCCESS-AUTHORED-FOREARM-HAND-GATE
Status: REVIEWED
Task-Type: PRESENTATION AUTHORED VFX VISUAL GATE
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 809d530321e4042c607f3784a39e2d10a22de9a5
Review-Handoff: ACTION-11K technical PASS; User Visual Gate not yet accepted. The detached symbolic direction is close, but User wants both hands for each wrestler (4 markers total) and each forearm/hand symbol angled about 30–45 degrees across the mawashi. User supplied one authored muscular forearm+fist PNG and wants to trial only that first image.
Handoff-Mode: GITHUB

# ACTION-11L — Grip Success Authored Forearm / Hand Visual Gate

## Purpose

Replace the procedural ACTION-11K forearm/hand drawing with the single User-authored forearm+fist image supplied for this Task.

The goal is to test whether the authored illustration integrates better with the wrestler art while preserving the accepted symbolic-VFX approach.

User direction:

- use only the first supplied forearm+fist image for this Gate;
- show both hands for each wrestler;
- therefore show four forearm+hand markers total for a settled grapple pair;
- each marker should cross the mawashi / waist at approximately 30–45 degrees;
- the markers remain symbolic overlays and do NOT need to connect anatomically to the wrestler body.

This is Presentation-only.

Do not change gameplay.

---

# Required User Source Asset

Place the first User-supplied image at exactly:

```
tools/wrestler_art/input.local/candidate_grip_forearm_hand_symbol.png
```

Expected identity:

```
size: 1536 x 1024 RGBA

decoded RGBA pixel SHA-256:
2f00cba4d6256028fdbd3c545eb5c7923d030d89881a5f3680efe00c67b0dba1

PNG file SHA-256:
5f59a0c97e642cbdef3d5ae087ac5abc56e12ebbaff2279d9ca5848373b6543b
```

The source has transparent background information and must remain under `input.local/`.

Do NOT commit the authored source.

The decoded RGBA hash is the authoritative identity.

## Stop condition

If this exact file is missing or the decoded hash differs:

- STOP before Production changes;
- report the observed size/hash;
- do not substitute the other fist images;
- do not regenerate the asset;
- do not use ACTION-11K's procedural symbol as the authored source.

---

# Why This Asset Is Being Tested

The first supplied image is preferred for this Gate because:

- it includes elbow/forearm/hand as one readable illustrated shape;
- it has thick dark contouring;
- it includes cel-like highlights/shadows;
- it is closer to the current wrestler illustration than the simpler alternative fists;
- at gameplay scale it can function as a symbolic Grip marker even if the fist is anatomically simplified.

This Gate tests placement/style only.

Do not redesign the source image.

---

# Accepted Baselines — Preserve

## ACTION-11C Gameplay

Preserve all Grip gameplay.

No changes under:

```
src/game/sumo/
src/game/input/
```

## ACTION-11F Pair Compression

Keep exactly:

```
GRIP_SUCCESS_FORWARD_OFFSET_R = +0.14
GRIP_SUCCESS_LATERAL_OFFSET_R = -0.20
```

## ACTION-11H Tone Match

Keep the accepted Grip-success body tone correction exactly.

Do not re-export or retune the wrestler body art.

## ACTION-11J Pair READY Visibility

Preserve:

```
if either wrestler is TURNING:
    hide all Grip hand/forearm VFX

if both wrestlers are READY:
    show Grip hand/forearm VFX
```

No TURNING-specific authored-arm pose in this Task.

---

# Replace ACTION-11K Procedural Symbol Drawing

ACTION-11K's procedural symbolic drawing is technically valid but not the final desired output.

ACTION-11L should replace the rendered procedural marker with the authored PNG.

The final READY pair should render:

```
2 authored markers on wrestler A's waist
2 authored markers on wrestler B's waist
= 4 markers total
```

These markers visually represent the opponent's two hands gripping that wrestler.

Do NOT draw both the old procedural marker and the authored marker.

Prefer removing/deactivating obsolete procedural texture-generation code rather than maintaining two rendering paths.

The pure visibility/placement helper may be reused or replaced narrowly.

---

# Runtime Asset Pipeline

Do not load directly from `tools/`.

Create a deterministic temporary Visual Gate runtime asset.

Preferred output:

```
public/assets/action/wrestler/grip-symbol-authored-gate/forearm_hand.png
```

Preferred tooling:

```
tools/wrestler_art/grip_forearm_hand_gate_recipe.json
tools/wrestler_art/export_grip_forearm_hand_gate.py
tools/wrestler_art/tests/test_export_grip_forearm_hand_gate.py
```

Equivalent narrow names are acceptable.

This remains provisional Visual Gate art.

Do not promote it to permanent Product Grip art/spec yet.

---

# Offline Asset Preparation

The source is much larger than required at runtime.

Preferred deterministic pipeline:

1. validate exact source identity;
2. use alpha > 8 to find the non-transparent content bounds;
3. crop to content with a small deterministic transparent padding;
4. record explicit source-space anchor points for:
   - elbow center;
   - hand / fist center;
5. downscale deterministically to a reasonable runtime texture size;
6. preserve alpha;
7. preserve source RGB values;
8. write one runtime PNG.

Do NOT:
- recolor
- tone-match
- redraw
- sharpen
- blur
- AI-edit.

The authored appearance should remain intact for this Gate.

## Anchor measurement

The exporter/recipe must record explicit elbow and hand anchor points.

These may be manually measured once from the supplied source.

Completion Report must provide:

```
elbow_source_px = (...)
hand_source_px = (...)
runtime elbow anchor = (...)
runtime hand anchor = (...)
```

If the elbow/hand landmarks cannot be determined safely from the image:
- STOP;
- do not guess wildly.

---

# Marker Ownership

Continue the ACTION-11K target-local concept.

Each WrestlerView draws the two grip markers that appear on THAT wrestler's own waist:

```
target wrestler A:
  marker LEFT
  marker RIGHT

target wrestler B:
  marker LEFT
  marker RIGHT
```

These represent the opponent's two hands.

This avoids needing to connect the visual markers back to the gripping wrestler.

---

# Four-Marker Layout

Each target wrestler receives two markers.

Use the target wrestler's displayed Grip-success center and canonical facing.

Target-local convention:

- +X = target FRONT
- -X = target BACK / mawashi-knot side
- +Y = target RIGHT
- -Y = target LEFT.

## Right-side marker

Preferred starting contact:

```
hand:
  forward = -0.45 R
  lateral = +0.62 R
```

Preferred elbow:

```
elbow:
  forward = -0.15 R
  lateral = +1.02 R
```

Vector elbow -> hand:

```
delta forward = -0.30 R
delta lateral = -0.40 R
```

This crosses the waist at approximately:

```
atan(0.30 / 0.40) ~= 36.9 degrees
```

relative to the mawashi/lateral direction.

## Left-side marker

Mirror the target-local layout:

```
hand:
  forward = -0.45 R
  lateral = -0.62 R

elbow:
  forward = -0.15 R
  lateral = -1.02 R
```

Again approximately 36.9 degrees relative to the waist band.

These values are the initial Visual Gate layout.

Small local tuning is allowed if the authored hand does not visually land on the mawashi because of its silhouette.

Required final visible angle:

```
30–45 degrees relative to the target's mawashi / local lateral axis
```

Do not accept a final angle outside that range without STOP/report.

---

# Marker Scale

The authored source contains more arm length than the procedural ACTION-11K symbol.

Scale it as a symbolic mark, not as a life-size anatomical arm.

Preferred displayed elbow-to-hand anchor distance:

```
~0.65–0.75 R
```

Initial target:

```
0.70 R
```

Do not let the arm span across the whole wrestler body.

The hand should remain the dominant readable end of the symbol.

Completion Report must state the final displayed elbow-to-hand distance in R.

---

# Rotation / Pivot

Use the recorded elbow and hand anchors.

At runtime:

- place the hand contact on the desired target-local mawashi point;
- rotate the texture so elbow -> hand follows the desired 30–45 degree grip direction;
- scale from the recorded elbow-hand source distance.

Preferred transform ownership is a Phaser-free pure placement helper.

Do not rotate around arbitrary texture center if that causes the hand contact to drift.

The hand contact point is the important anchor.

---

# Mirroring

For this first Gate, use the SAME authored source for all four markers if it reads acceptably at gameplay scale.

Do not create or require a second authored hand.

If left/right placement looks obviously wrong because the fist chirality is visible:

- it is acceptable to derive one mirrored runtime variant offline from the same authored source;
- report it as a deterministic derived variant;
- do not ask for a second source image.

Do not runtime-mirror frame-by-frame.

Preferred if needed:

```
forearm_hand.png
forearm_hand_mirrored.png
```

from the same one authored source.

---

# Visual Style / Depth

Use the authored image unchanged in color.

Depth:

```
body = 2.0
authored Grip marker ~= 2.3
Kuzushi sweat = 2.5
```

The marker should visibly overlay the mawashi/waist.

No glow.
No UI frame.
No particles.
No extra outline generated in Phaser.

The PNG itself owns the visual style.

---

# READY / TURNING Visibility

Preserve pair-level rule.

READY:
- four markers total visible.

TURNING:
- zero markers visible.

When TURNING becomes READY:
- all four appear on the same presentation frame.

Release:
- all disappear immediately.

No fade/timer.

---

# Neutral / Drive / Morozashi

Use the same four-marker layout for:

- neutral
- Drive
- Morozashi.

No advantage-specific marker layout yet.

---

# Remove Procedural Drawing Ownership

The final ACTION-11L runtime must not continue generating the ACTION-11K procedural forearm/mitten texture.

Allowed to retain:
- pure pair READY visibility helper;
- useful target-local transform logic.

Remove or replace:
- procedural `Graphics.generateTexture` Grip symbol drawing;
- ACTION-11K skin/shade/highlight marker color constants if no longer used;
- tests specific only to the procedural shape.

Do not perform unrelated refactoring.

---

# Required Tests

## Asset

A1. exact authored source identity.

A2. deterministic crop/downscale.

A3. alpha preserved through export.

A4. runtime output matches fresh export.

A5. explicit elbow/hand anchors remain inside runtime texture.

A6. no RGB recolor/tone transform is applied.

## Four-marker geometry

G1. exactly two marker placements per target wrestler.

G2. settled pair therefore has exactly four total.

G3. LEFT / RIGHT hand contacts are on opposite mawashi sides.

G4. final marker axis is 30–45 degrees relative to target local lateral axis.

G5. displayed elbow-to-hand length is within 0.65–0.75 R.

G6. transforms correctly for facing 0 / π/2 / π / -π/2.

G7. positions are deterministic and non-coincident.

## Visibility

V1. READY neutral -> four visible.

V2. READY Drive -> four visible.

V3. READY Morozashi -> four visible.

V4. either TURNING -> zero visible.

V5. Grip attempt -> zero.

V6. release/recovery -> zero.

V7. Push/Tsuppari/Counter/Kuzushi/idle -> zero.

## Preservation

P1. ACTION-11F constants unchanged.

P2. ACTION-11H body runtime textures/recipe unchanged.

P3. canonical 0.70 m bond unchanged.

P4. Snapshot unchanged.

P5. no src/game/sumo / src/game/input diff.

P6. no wrestler body asset changes outside the new authored Grip-symbol gate directory.

---

# Browser / Runtime Smoke

Required.

Capture standard montage:

1. neutral immediately after success
2. neutral settled
3. Drive
4. Morozashi
5. release
6. turning immediately after success
7. turning mid
8. turning settled.

Expected:

## READY frames 1–4 / 8

- four authored markers total;
- two on each wrestler's mawashi;
- markers cross waist at roughly 30–45 degrees;
- hand/fist contacts overlap the mawashi;
- markers do not span unrealistically across the whole body;
- no procedural ACTION-11K marker remains.

## TURNING 6–7

- zero markers.

## Release 5

- zero markers.

Also verify:
- R restart;
- no new runtime errors;
- Push/Tsuppari/Counter/Kuzushi unchanged.

Create:
- 8-frame pair sheet;
- one close-up of neutral settled;
- if possible before/after against ACTION-11K.

---

# User Visual Gate

REQUIRED.

Primary questions:

1. Does the authored arm art fit the wrestler illustration better than the procedural symbol?
2. Do four markers clearly communicate both wrestlers using both hands?
3. Are markers angled naturally across the mawashi at 30–45 degrees?
4. Is the marker size short/symbolic enough?
5. Does the fist read as gripping rather than punching?
6. Is TURNING hide still acceptable?
7. Does Drive/Morozashi remain coherent?

If the only remaining problem is that the fist reads too much like a punch:
- next step may regenerate only the small authored hand asset into a mawashi-gripping hand;
- do not regenerate wrestler bodies.

---

# Scope

## In Scope

- one supplied authored forearm+fist source
- deterministic temporary runtime VFX asset
- four-marker layout
- 30–45 degree waist angle
- scale/rotation/anchor placement
- optional offline mirror derived from same source
- pair READY visibility
- tests/smoke/screenshots.

## Scope Out

Do NOT:

- use the second/third supplied fist images
- AI regenerate anything
- change gameplay
- change Grappled Orientation
- change ACTION-11F compression
- change ACTION-11H body tone
- change Grip attempt/success wrestler images
- add dynamic z sorting
- add particles/audio/camera
- modify PROJECT_HANDOFF.md.

---

# Stop Conditions

STOP if:

- required source image is missing/hash mismatched
- elbow/hand anchors cannot be measured safely
- 4-marker placement needs gameplay/bond changes
- authored asset cannot be made readable without editing its pixels/art
- dynamic z sorting is required
- unrelated accepted visuals regress.

---

# Verification

Verification Level:
Standard Presentation Art Visual Gate

Required:

- focused authored-asset exporter tests
- focused four-marker geometry tests
- pair READY visibility tests
- Grip success presentation regression
- Grip/Grapple/Drive/Orientation regression
- Push/Tsuppari/Counter/Kuzushi presentation regression
- `pnpm test`
- `pnpm build`
- `git diff --check`
- deterministic exporter + --check
- browser/runtime smoke
- prove ACTION-11F/11H unchanged
- prove src/game/sumo / src/game/input unchanged.

---

# Completion Report

Include:

- Result
- exact source identity
- source alpha/crop diagnostics
- elbow/hand source anchors
- runtime asset size/hash
- whether one or two derived runtime variants are used
- final marker count
- final target-local LEFT/RIGHT contacts
- final angles relative to mawashi
- final displayed elbow-to-hand length R
- changed files
- proof ACTION-11F/11H unchanged
- proof gameplay/bond unchanged
- focused/full verification
- 8-frame montage + neutral close-up
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

`art(presentation): trial authored grip hand markers`

Do not modify:

- `main`
- `PROJECT_HANDOFF.md`
- `CURRENT_TASK.md`.

# Final Instruction

Use only the first User-supplied authored forearm+fist image.

Place two authored forearm/hand markers on each wrestler's waist/mawashi, four total per settled pair.

Each marker must cross the mawashi at approximately 30–45 degrees, with the hand visibly contacting the mawashi.

Keep the markers detached/symbolic; do not connect them to the wrestler body.

Preserve the pair READY visibility rule: if either wrestler is TURNING, hide all four markers.


---

# ChatGPT Review Handoff

Review-Date: 2026-10-23
Overall Result: TECHNICAL PASS / USER VISUAL GATE REQUIRED
Accepted Technical Baseline: 2b38f0d293dc2f4ff9660dbf7f799d86cd1a80e9

## Source Identity

Confirmed from Completion Report / Current Source:

- exact source path:
  `tools/wrestler_art/input.local/candidate_grip_forearm_hand_symbol.png`
- size: 1536 x 1024 RGBA
- decoded RGBA SHA-256:
  `2f00cba4d6256028fdbd3c545eb5c7923d030d89881a5f3680efe00c67b0dba1`
- PNG file SHA-256:
  `5f59a0c97e642cbdef3d5ae087ac5abc56e12ebbaff2279d9ca5848373b6543b`

This matches the original ACTION-11L Task identity.

The earlier local alternate hash was not used in the successful implementation.

## Reported Implementation vs Design

Accepted as aligned with ACTION-11L.

Confirmed:

- only the first User-authored forearm+fist source is used
- deterministic temporary runtime export exists
- authored + offline mirrored variants are generated from the one source
- no recolor / tone match / redraw / AI edit is applied to the marker art
- each WrestlerView renders two markers on its own waist
- settled pair therefore shows four markers total
- fists are hand-anchored to the target mawashi / waist
- marker axis crosses the target local lateral / mawashi axis at ~36.87 degrees
- displayed elbow-to-hand distance = 0.70 R
- marker depth = 2.3
- TURNING hides all markers for both wrestlers
- release / recovery / other actions hide all markers
- no procedural ACTION-11K marker remains rendered
- no src/game/sumo / src/game/input changes
- ACTION-11F compression unchanged
- ACTION-11H body tone correction unchanged
- canonical grapple bond remains 0.70 m.

## Runtime Asset Pipeline

Accepted provisional gate assets:

```
public/assets/action/wrestler/grip-symbol-authored-gate/forearm_hand.png
public/assets/action/wrestler/grip-symbol-authored-gate/forearm_hand_mirrored.png
```

Runtime size:

```
94 x 59
```

Pixel hashes:

- authored:
  `c1c171a21aa9d9050d89456aac7d4910d088b9ae5a0c666c695d01340dbd5ebb`
- mirrored:
  `8fb61adf1e1a573c4bab91f442351d3a845c0cac419e32dfce60e5036cd961ea`

Source anchors:

```
hand_source_px  = (290, 752)
elbow_source_px = (1207, 567)
```

Runtime authored anchors:

```
hand  = (15.875, 42.125)
elbow = (73.1875, 30.5625)
```

The mirrored variant is derived offline only.

## Final Layout

Per target wrestler:

RIGHT:

```
hand  = (-0.45 R, +0.62 R)
elbow = (-0.03 R, +1.18 R)
```

LEFT:

```
hand  = (-0.45 R, -0.62 R)
elbow = (-0.03 R, -1.18 R)
```

Therefore:

- two markers per wrestler
- four markers per READY pair
- marker length = 0.70 R
- mawashi crossing angle = 36.87 degrees
- hand anchor stays on the intended waist point during rotation/scale.

## Design Deviation Review

Accepted.

The Task's initial elbow coordinate produced only 0.50 R elbow->hand distance, conflicting with the same Task's required 0.65–0.75 R range.

Implementation preserved:
- hand point
- 36.87 degree angle

and extended elbow outward to reach 0.70 R.

This is a coherent local correction and does not change semantics.

Offline mirrored left-side variant was explicitly allowed by the Task.

## Verification Review

Accepted:

- authored exporter focused tests: 13 / 13
- wrestler-art suite: 222 / 222
- deterministic export / --check: PASS
- existing art exporters --check: PASS
- TS marker tests: 15 / 15
- pnpm test: 30 files / 520 PASS
- pnpm build: PASS
- git diff --check: PASS
- Browser / Runtime Smoke: 27 / 27 PASS
- ACTION-11F / 11H regressions preserved
- gameplay / canonical bond unchanged.

This is sufficient for Technical PASS.

## Visual Review From Submitted Screenshots

Observed:

Positive:
- four authored markers are clearly present in READY grapple states
- authored arm art integrates more naturally with the wrestler illustration than the procedural ACTION-11K symbol
- both wrestlers now visibly appear to use both hands
- the 30–45 degree goal is achieved numerically and visually
- TURNING frames correctly suppress all markers
- release clears markers cleanly
- Drive / Morozashi keep the same marker treatment.

Remaining visual questions:
- the upper markers can read as forearms resting on the upper body rather than clearly gripping the mawashi
- the lower markers sometimes extend slightly beyond the body silhouette
- because the source hand is a closed fist, the marker can still read somewhat like a punch/fist rather than an explicit mawashi-gripping hand.

These are User Visual Gate questions, not technical failures.

## User Visual Gate

REQUIRED.

Primary questions:

1. Does the authored forearm/fist art fit the wrestler style better than the procedural symbol?
2. Do four markers make it clear that both wrestlers are using both hands?
3. Is the ~36.9 degree placement visually right?
4. Is 0.70 R short enough as a symbolic overlay?
5. Does the fist read as gripping the mawashi, or still too much like punching?
6. Are the upper/lower placements acceptable?
7. Is hiding all markers during TURNING still acceptable?

## Next Task Constraint

Do not create a new Grip-hand Task until User Visual Gate feedback is known.

If the only remaining problem is the hand shape:
- keep the accepted four-marker layout / angle / READY rule
- replace only the small authored marker art with a hand specifically drawn as gripping the mawashi
- do not regenerate wrestler bodies or reopen gameplay.

If placement itself is rejected:
- tune only marker position / scale / angle before replacing art.
