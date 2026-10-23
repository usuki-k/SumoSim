Task-ID: ACTION-11L-GRIP-SUCCESS-AUTHORED-FOREARM-HAND-SYMBOL-GATE
Status: READY
Task-Type: PRESENTATION AUTHORED VFX VISUAL GATE
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 809d530321e4042c607f3784a39e2d10a22de9a5
Review-Handoff: ACTION-11K technical PASS; User Visual Gate not yet accepted. User now wants to test one authored forearm+fist image only, using 2 markers per wrestler (4 total per settled pair) and rotating them approximately 30–45 degrees relative to the mawashi.
Handoff-Mode: GITHUB

# ACTION-11L — Authored Forearm+Hand Symbol Visual Gate

## Purpose

Replace the current procedural Grip-success symbolic marker with the User-provided authored forearm+fist image, and test whether it reads better as an anime-style grip symbol.

User direction:

- use only the latest first image supplied by the User
- each wrestler should show BOTH hands
- therefore 2 forearm+hand markers per wrestler / 4 total per settled pair
- each marker should cross the waist / mawashi at roughly 30–45 degrees
- detached symbolic representation remains correct
- the marker does not need to connect anatomically to the body.

This is Presentation-only.

Do not change gameplay.

---

# Required User Source Asset

The User-provided authored image must be available locally as:

```
tools/wrestler_art/input.local/grip_forearm_hand_symbol.png
```

Expected identity:

```
size: 1536 x 1024 RGBA

decoded RGBA pixel SHA-256:
2f00cba4d6256028fdbd3c545eb5c7923d030d89881a5f3680efe00c67b0dba1

PNG file SHA-256:
5f59a0c97e642cbdef3d5ae087ac5abc56e12ebbaff2279d9ca5848373b6543b
```

The file is transparent around the drawn arm.

The decoded RGBA hash is authoritative.

The source remains under `input.local/` and must NOT be committed.

## Stop condition

If the file is missing:
- STOP before Production changes
- report that `grip_forearm_hand_symbol.png` is required.

If size or decoded RGBA hash differs:
- STOP and report observed values.

Do not substitute:
- the second fist image
- the third flat-color fist image
- the current procedural marker
- any AI-regenerated alternative.

---

# Accepted Baselines — Preserve

## ACTION-11C Gameplay

No changes.

## ACTION-11F Pair Compression

Keep exactly:

```
GRIP_SUCCESS_FORWARD_OFFSET_R = +0.14
GRIP_SUCCESS_LATERAL_OFFSET_R = -0.20
```

## ACTION-11H Tone Match

Keep the current accepted Grip-success body tone correction exactly.

## ACTION-11J Pair READY Visibility

Preserve:

```
if either wrestler is TURNING:
  all Grip markers hidden

if both are READY:
  Grip markers visible
```

Do not add TURNING-specific arm art.

---

# Replace ACTION-11K Procedural Marker

ACTION-11K's procedural elbow+hand symbol is a useful placement baseline but is not the final visual.

For ACTION-11L:

- do not render the procedural forearm+hand texture
- use the authored PNG instead
- remove/disable obsolete procedural texture generation cleanly
- keep pair READY visibility and target-local placement concepts where useful.

Do not leave both authored and procedural markers active simultaneously.

---

# Runtime Asset Pipeline

Do not load the 1536x1024 source directly at gameplay scale.

Create a deterministic small runtime asset.

Preferred runtime path:

```
public/assets/action/wrestler/grip-symbol-gate/forearm_hand.png
```

Preferred exporter:

```
tools/wrestler_art/export_grip_symbol_gate.py
```

Preferred recipe:

```
tools/wrestler_art/grip_symbol_gate_recipe.json
```

Preferred focused test:

```
tools/wrestler_art/tests/test_export_grip_symbol_gate.py
```

Equivalent narrowly scoped names are acceptable.

---

# Runtime Export Rules

Use the exact User source.

Allowed offline operations:

1. verify source identity
2. trim transparent padding to the non-transparent alpha bounds, with a small deterministic padding margin
3. downscale deterministically for runtime
4. preserve alpha
5. preserve source RGB inside retained pixels.

Do NOT:
- repaint
- recolor
- relight
- change hue
- AI-edit
- add new outlines
- change hand anatomy.

The purpose is to test the authored image as-is.

## Preferred runtime size

Aim for an authored symbol that renders around:

```
0.70–0.95 R
```

from elbow-side end to fist-side end at gameplay scale.

The exact PNG pixel dimensions may be chosen from the trimmed aspect ratio.

Do not excessively sharpen or blur.

---

# Source Orientation

Inspect the source and establish a deterministic local axis:

```
elbow / upper-arm side -> hand / fist side
```

Record which side of the PNG is treated as the hand direction.

Do not runtime-mirror unless needed for complementary left/right grip markers.

Runtime rotation is allowed.

Runtime scale is allowed.

If reflection is used for one side:
- use a deterministic sprite flip / negative scale or offline mirrored runtime variant
- report which approach is used.

Prefer the smallest implementation.

---

# Marker Count

Required settled pair:

```
2 markers per wrestler
= 4 markers total
```

Each wrestler should visually appear to grip with both hands.

Do NOT render only two total markers.

---

# Marker Ownership

Use target-local placement.

Each WrestlerView may render the markers that represent the opponent gripping this wrestler.

Equivalent pair-level composition is acceptable if simpler.

The key visual result is:

- two markers overlap each wrestler's waist / mawashi
- four total in a settled face-to-face pair.

---

# Placement

Each wrestler receives two authored markers on complementary sides of its waist / mawashi.

Use the displayed Grip-success center including ACTION-11F offset.

Target-local frame:

- +X = target FRONT
- -X = target BACK / mawashi-knot direction
- +Y = target RIGHT
- -Y = target LEFT.

Preferred starting anchors:

## Target-right marker

Hand/fist contact around:

```
forward: -0.35 R to -0.55 R
lateral: +0.50 R to +0.75 R
```

## Target-left marker

Hand/fist contact around:

```
forward: -0.35 R to -0.55 R
lateral: -0.50 R to -0.75 R
```

The fist/hand portion should visibly overlap:
- mawashi edge
- adjacent waist.

Do not place both markers at identical coordinates.

---

# Angle

User requirement:

```
30–45 degrees relative to the mawashi / waist band
```

Initial target:

```
37.5 degrees
```

for both sides, mirrored/complementary as needed.

The two markers on one wrestler should form a readable paired grip rather than parallel horizontal bars.

Preferred concept:

- one leans approximately +37.5°
- the other approximately -37.5°
relative to the local waist / mawashi tangent.

Exact sign depends on source orientation and target side.

Agent may tune within:

```
30° <= |angle| <= 45°
```

if the initial 37.5° causes the fist to miss the mawashi.

Report final angles explicitly.

---

# Symbol Scale

Initial visual target:

- forearm+fist length around 0.75–0.90 R
- marker width scaled proportionally from the source.

The authored image should not dominate the wrestler body.

The fist should remain readable at gameplay scale.

Use one scale for all four markers unless a clear source-side issue requires otherwise.

---

# Depth

Markers should overlay the mawashi/body.

Preferred fixed depth:

```
body = 2.0
authored Grip marker = 2.3
Kuzushi sweat = 2.5
```

No dynamic z sorting.

All four markers can use the same fixed depth.

Stable creation order is acceptable for marker-marker overlap.

---

# Visibility

Show all four authored markers only when:

- both wrestlers are Grip-success pose
- neither wrestler is TURNING.

Hide all four when:

- either wrestler TURNING
- Grip attempt
- recovery
- release
- Push
- Tsuppari
- Counter
- Kuzushi
- idle / move / pre-bout.

No timer.
No fade.

---

# Neutral / Drive / Morozashi

Same four markers for:

- neutral
- Drive
- Morozashi holder
- Morozashi disadvantaged.

Do not encode advantage.

---

# Presentation Helper

Prefer a small Phaser-free helper, e.g.:

```
src/game/presentation/gripSuccessAuthoredSymbolVfx.ts
```

It should own:

- pair visibility
- two target-local marker definitions
- anchor positions
- angle
- scale / size.

WrestlerView may own the Phaser Image objects.

Do not create a generic VFX framework.

---

# WrestlerView

Per wrestler:

- create 2 authored Grip marker Images
- reuse them
- no create/destroy per frame
- position from displayed Grip-success center
- rotate from target facing + marker local angle
- hide/show using pair READY rule.

Do not alter:
- wrestler body texture
- body pivot
- body scale
- ACTION-11F body offset
- shadow
- Kuzushi sweat.

---

# Required Tests

## Source / Runtime Asset

A1. exact source identity.

A2. runtime asset deterministic.

A3. source alpha preserved through trim/downscale.

A4. no color/tone mutation beyond resampling.

## Marker Count

M1. exactly 2 marker images per WrestlerView.

M2. settled pair therefore has 4 markers total.

## Geometry

G1. target-left and target-right anchors differ.

G2. both hand/fist contacts fall in waist / mawashi region.

G3. each marker absolute local angle is between 30° and 45°.

G4. marker pair uses complementary signs / directions.

G5. facing 0 / π/2 / π / -π/2 transforms correctly.

G6. scale is R-relative.

G7. four markers are deterministic.

## Visibility

V1. READY neutral -> four total visible.

V2. READY Drive -> four visible.

V3. READY Morozashi -> four visible.

V4. either TURNING -> zero visible.

V5. attempt -> zero.

V6. release/recovery -> zero.

V7. other actions -> zero.

## Preservation

P1. ACTION-11F constants unchanged.

P2. ACTION-11H tone runtime unchanged.

P3. canonical bond 0.70 m unchanged.

P4. Snapshot unchanged.

P5. no src/game/sumo or src/game/input diff.

---

# Browser / Runtime Smoke

Capture standard 8-frame montage:

1. neutral immediately after success
2. neutral settled
3. Drive
4. Morozashi
5. release
6. TURNING immediately after success
7. TURNING mid
8. TURNING settled.

Expected:

1–4 / 8:
- four authored markers total
- two on each wrestler
- fists overlap the mawashi/waist
- each marker visibly angled 30–45°
- authored art integrates better than the procedural symbol.

6–7:
- zero markers.

5:
- zero markers.

Also verify:
- R restart
- no failed asset request
- no console error
- Push/Tsuppari/Counter/Kuzushi unaffected.

---

# User Visual Gate

REQUIRED.

Primary question:

> Does the User-authored forearm+fist image, used four times with 30–45° mawashi-crossing angles, read clearly as both wrestlers gripping with both hands?

Judge:

- authored art matches wrestler style
- fist reads as grip rather than punch
- four markers are not too busy
- marker length/scale is appropriate
- hand contacts the mawashi
- 30–45° angle looks natural
- neutral / Drive / Morozashi are coherent
- TURNING hide remains acceptable.

If the only remaining issue is that the fist looks too much like a punch:
- do not redesign placement first
- recommend a new User-authored "gripping hand" version using the same size/orientation contract.

---

# Scope

## In Scope

- exact first User-authored forearm+fist source
- deterministic small runtime export
- 2 markers per wrestler / 4 total
- 30–45° target angle
- target-waist placement
- pair READY visibility
- focused tests
- browser visual gate.

## Scope Out

Do NOT:

- use User image 2 or 3
- AI regenerate art
- change gameplay
- change Grappled Orientation
- change ACTION-11F compression
- change ACTION-11H tone
- change Grip body art
- add dynamic z sorting
- add audio/camera/particles
- modify PROJECT_HANDOFF.md.

---

# Stop Conditions

STOP if:

- exact source missing/hash mismatched
- authored symbol cannot be trimmed/downscaled without destroying transparency
- four-marker placement requires gameplay/canonical geometry changes
- dynamic z sorting is required
- source art is technically unsuitable for transparent overlay
- unrelated accepted visuals regress.

---

# Verification

Verification Level:
Standard Presentation Art Visual Gate

Required:

- focused authored-symbol exporter tests
- focused marker geometry/visibility tests
- Grip success presentation regression
- Grip/Grapple/Drive/Orientation regression
- Push/Tsuppari/Counter/Kuzushi presentation regression
- `pnpm test`
- `pnpm build`
- `git diff --check`
- deterministic asset export / --check
- browser/runtime smoke
- prove ACTION-11F/11H unchanged
- prove src/game/sumo / src/game/input unchanged.

---

# Completion Report

Include:

- Result
- exact source identity
- runtime asset path/size/hash
- trim/downscale method
- source orientation
- marker count
- final target-local anchors
- final angles
- final scale
- depth
- changed files
- proof ACTION-11F/11H unchanged
- proof gameplay/canonical bond unchanged
- focused/full verification
- 8-frame montage
- User Visual Gate: REQUIRED
- whether fist-vs-grip shape remains a concern
- Design Deviations
- Unexpected Scope
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

`art(presentation): test authored grip forearm symbol`

Do not modify:

- `main`
- `PROJECT_HANDOFF.md`
- `CURRENT_TASK.md`.

# Final Instruction

Use ONLY the exact User-provided first forearm+fist image.

Export it as one small transparent runtime symbol and reuse it four times in settled Grip:

- two markers on each wrestler
- fists on the waist / mawashi
- each marker angled approximately 30–45 degrees relative to the mawashi
- no anatomical body connection required.

Preserve pair READY visibility: if either wrestler is TURNING, hide all four markers.
