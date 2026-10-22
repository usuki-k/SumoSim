Task-ID: ACTION-11A-GRIP-ATTEMPT-ART-VISUAL-GATE
Status: REVIEWED
Task-Type: PRESENTATION ART VISUAL GATE
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: ed55d79ccd0907ab5f33f715e75f06956e6047f1
Review-Handoff: ACTION-10B technical review at 9bed3686f561c2f76d88c59921379781cd262b14; User reported the 24-tick Push result is OK for now
Handoff-Mode: GITHUB

# ACTION-11A — Grip Attempt Pose Visual Gate

## Purpose

Apply the User-provided red-wrestler image as the visual pose for **Grip attempt only**.

User decision:

- the attached image is for the Shift-key Grip **attempt**
- Grip success / grappled art is NOT ready yet and must remain deferred
- the future Grip success look will be designed separately
- future Grip success hand marks will be presentation VFX, not baked into this attempt sprite.

This Task is a small Presentation Art Visual Gate.

Do not redesign Grip gameplay.
Do not implement Grip success art.
Do not add hand-mark VFX yet.

---

# Required User Source Asset

The User-provided source image from this ChatGPT task must be available to the Agent locally as:

```
tools/wrestler_art/input.local/candidate_red_grip_attempt.png
```

Expected identity:

```
size: 1254 x 1254 RGBA

decoded RGBA pixel SHA-256:
323a7e79829c371345e8561ef3dd8ff6f49541eceb74450ec418b16c328478e0

reviewed PNG file SHA-256:
2dcc3b3f87a931098463a4168a0f31873c83b71e8b6badda376d4b1cc20f61f9
```

The source remains under `input.local/` and must not be committed.

## Stop condition for missing source

If this exact source is not present locally:
- STOP before Production changes
- report that `candidate_red_grip_attempt.png` is required
- do not substitute another image
- do not regenerate it
- do not use an older Grip candidate.

If size or decoded RGBA hash differs:
- STOP
- report the observed size/hash.

The decoded RGBA hash is the authoritative content identity.

---

# Current Grip Gameplay — Preserve Exactly

Current Grip gameplay already exists.

Do not change:

- Shift binding
- FREE + idle + stable start requirement
- `GRIP_REACH_TICKS = 6`
- `GRIP_RECOVERY_TICKS = 12`
- Grip range
- success conditions
- simultaneous Grip behavior
- Kuzushi -> Morozashi behavior
- release semantics
- Grappled Orientation
- Drive
- engagement ownership.

Current Presentation already exposes:

```
WrestlerVisualState.pose === 'grip'
WrestlerVisualState.gripPhase === 'reach' | 'recovery'
```

Use these existing fields.

No new Simulation state is required.

---

# Exact Display Semantics

The new attempt sprite is shown only when:

```
state.pose === 'grip'
&&
state.gripPhase === 'reach'
```

This is the Shift-key "reaching / trying to grab" window.

## Grip success

When Grip succeeds:

```
FREE Grip reach
-> engagement becomes grappled
-> action becomes idle
-> visual pose becomes grapple
```

At that moment:
- the attempt sprite must disappear immediately
- use the current existing grapple visual fallback exactly as today
- do NOT invent a Grip success pose in this Task
- do NOT retain the attempt pose during grapple.

The current "two normal wrestlers touching" grapple look is temporarily acceptable until the dedicated Grip success Task.

## Grip whiff / recovery

When Grip reach expires without success:

```
reach
-> recovery
```

During `gripPhase === 'recovery'`:
- return to the existing idle Product wrestler sprite
- do NOT keep the attempt sprite visible through recovery.

Reason:
- this image represents the grabbing attempt itself
- recovery visual is not being designed in this Task.

## Simultaneous attempts

If both participants are independently in Grip reach:
- both must show their own attempt texture
- no pair-level art state is needed.

---

# Red / Blue Art Strategy

Use exactly one authored source:

```
candidate_red_grip_attempt.png
```

Derive runtime blue offline from red using the accepted Product wrestler rule:

```
red attempt
-> normalize to the Product body-core / FRONT convention

blue attempt
= local-Y reflection of normalized red
+ accepted shared mawashi recolor
```

Use the same meaning as idle / Counter:

```
(x, y) -> (x, H - y)
```

which preserves local +X = FRONT while swapping wrestler left/right.

Grip attempt has no left-hand/right-hand input semantic requiring separate authored hand poses, so one authored red pose + one derived blue pose is the preferred design.

Do NOT:
- runtime-mirror
- runtime-recolor
- author a second blue source
- add separate left/right Grip attempt art.

---

# Normalization

The runtime attempt sprite must match the existing Product wrestler scale/center contract.

Required outcome:

- local +X = FRONT
- explicit pivot at the canonical participant center/root
- body core = 2R at Product scale
- normal runtime PNG
- no Scene-side magic scale/pixel offset specific to this image.

Reuse existing deterministic wrestler-art normalization machinery where practical.

Preferred:
- use the existing idle/Tsuppari/Counter normalization helpers
- reuse shared recolor ownership from `runtime_wrestler_recipe.json`.

Do not build a new generic art framework.

## Measurement

Determine the source FRONT / root / body-core values from the actual attached source.

Do not copy arbitrary values from Counter/Tsuppari just because the image dimensions are similar.

Use the existing measurement approach if it is valid for this source.

If existing measurement helpers cannot identify the landmarks safely:
- STOP and report the exact measurement problem
- do not guess pivot/root/body-core.

---

# Visual-Gate Runtime Paths

This is not yet permanent Product Grip art.

Use a temporary gate location, preferred:

```
public/assets/action/wrestler/grip-attempt-gate/red.png
public/assets/action/wrestler/grip-attempt-gate/blue.png
```

Preferred pure metadata/selector module:

```
src/game/presentation/gripAttemptGateArt.ts
```

Preferred tooling:

```
tools/wrestler_art/grip_attempt_gate_recipe.json
tools/wrestler_art/export_grip_attempt_gate.py
```

Focused tests:

```
tools/wrestler_art/tests/test_export_grip_attempt_gate.py
src/game/presentation/gripAttemptGateArt.test.ts
```

Equivalent small names are acceptable if Current Source conventions require them.

Do not promote to permanent Product paths/spec until User Play Test accepts the attempt pose.

---

# Selector Integration

Keep existing accepted art behavior intact:

- idle/move/Push -> existing idle Product art
- Tsuppari -> Product Tsuppari
- Counter -> Product Counter
- Kuzushi -> existing idle body + sweat overlay
- Grip reach -> NEW Grip Attempt gate pose
- Grip recovery -> existing idle Product art
- grapple/drive -> existing fallback as today.

Do not modify Counter's 35-degree body-sabaki.

Do not modify Kuzushi sweat.

Do not add a generic pose router/framework unless Current Source already has one.

A small explicit composition is preferred.

For example, a Grip gate selector may wrap the existing Product selector:

```
if grip reach:
  grip attempt art
else:
  existing Counter/Tsuppari/idle selection
```

The exact function name is not prescribed.

---

# WrestlerView

Update preload to include the two Grip Attempt gate textures.

Rendering remains the existing rigid Product sprite contract:

- canonical Snapshot position
- canonical facing
- texture-specific explicit pivot
- Product body-core scale.

No:
- extra translation
- extra rotation
- scale animation
- camera effect
- Scene timer.

Grip attempt art must not influence gameplay geometry.

---

# Art Validation

The exporter must be deterministic and fail closed.

At minimum verify:

1. source decoded RGBA hash matches the required User source
2. source size matches 1254 x 1254
3. only one authored red Grip attempt source is used
4. exactly two runtime output PNGs are produced
5. red is deterministic normalized output
6. blue is exactly one local-Y reflection + shared mawashi recolor
7. alpha is preserved through reflection/recolor
8. pixels outside the mawashi recolor mask are unchanged by recolor
9. shared recolor rule is owned by existing `runtime_wrestler_recipe.json`
10. no runtime mirror/recolor is needed.

Use mask diagnostics/fail-closed limits consistent with current tooling.

Do not silently widen mask limits globally.

If this candidate requires a Grip-specific narrow allowance:
- STOP and report the diagnostics first
- do not invent/raise a threshold without review.

---

# Presentation Tests

At minimum verify:

## Attempt

A1. stable idle -> idle Product art.

A2. Shift Grip starts -> `pose = grip`, `gripPhase = reach`.

A3. Grip reach selects red Grip attempt texture for red wrestler.

A4. Grip reach selects derived blue Grip attempt texture for blue wrestler.

A5. both participants can independently show attempt art when both are reaching.

## Success

S1. valid Grip success enters existing grapple engagement.

S2. on success, attempt texture disappears immediately.

S3. current grapple visual fallback remains unchanged.

S4. Kuzushi Grip -> Morozashi behavior remains gameplay-identical; attempt disappears once grapple starts.

## Whiff

W1. whiffed reach transitions to Grip recovery.

W2. Grip recovery uses existing idle Product texture, not attempt texture.

W3. after recovery -> idle remains normal.

## Regression

R1. Tsuppari Product textures/selectors unchanged.

R2. Counter Product textures/selectors and 35-degree motion unchanged.

R3. Push 24-tick charge / facing behavior unchanged.

R4. Kuzushi sweat unchanged.

R5. grapple / drive gameplay unchanged.

R6. Product idle art unchanged.

R7. no `src/game/sumo/` or `src/game/input/` Production semantic change.

---

# Browser / Runtime Smoke

Required.

Verify:

1. Enter starts Bout
2. Shift while free/stable shows Grip attempt pose immediately for the reach phase
3. red participant uses red attempt texture
4. blue participant uses derived blue attempt texture
5. body center/pivot does not jump when switching idle -> attempt
6. body scale does not jump materially
7. facing remains canonical
8. attempt lasts only through Grip reach
9. whiff -> recovery returns to idle texture
10. successful Grip -> grapple removes attempt texture immediately
11. current grapple result remains visually the existing fallback
12. Kuzushi Grip -> Morozashi still works
13. Tsuppari / Counter / Push / Kuzushi visuals remain unchanged
14. R restart works
15. no console errors / failed asset requests.

Capture representative screenshots for:

- blue Grip reach
- red Grip reach
- immediately after Grip success
- Grip recovery after whiff.

---

# User Visual Gate

REQUIRED.

Primary question:

> Does the attached pose clearly read as "Shiftを押して掴みに行っている / Grip attempt" at gameplay scale?

Judge:

- distinct from idle
- distinct from Push
- distinct from Tsuppari
- arms/hands look like reaching to grab
- pivot/scale switch is not distracting
- red/blue both look natural
- 6-tick reach duration is readable enough
- transition back to idle on whiff is acceptable
- transition from attempt to current temporary grapple look is understandable enough until Grip success art is added.

Do not permanently promote this pose until User accepts it.

---

# Scope

## In Scope

- attached red Grip-attempt source validation
- deterministic temporary red/blue runtime export
- Grip reach-only sprite selection
- preload/integration
- focused art/presentation tests
- browser visual smoke
- User Visual Gate.

## Scope Out

Do NOT:

- implement Grip success pose
- implement hand-mark VFX
- change two-wrestler grapple positioning
- change head placement during grapple
- change grapple distance
- change Grip gameplay/range/timing
- change Morozashi
- change Drive
- add Grip animation frames
- change Push
- change Tsuppari
- change Counter
- change Kuzushi
- promote Grip attempt to permanent Product art
- rewrite WRESTLER_PRODUCT_ART_SPEC Accepted section
- modify PROJECT_HANDOFF.md.

---

# Documentation

Because this is a provisional Visual Gate:

- do NOT add Grip attempt as Accepted Product art in `WRESTLER_PRODUCT_ART_SPEC.md`
- a short provisional Current Source note in `docs/ARCHITECTURE.md` is allowed if needed
- clearly label it Visual Gate / provisional.

---

# Stop Conditions

STOP if:

- required source image is missing or hash mismatched
- safe FRONT/root/body-core measurement cannot be established
- blue recolor contaminates skin/hair/arms
- candidate needs a global recolor-rule change
- candidate needs a global mask-limit relaxation
- gameplay changes are required
- Grip success visuals are required to make the attempt technically function
- a generic animation framework becomes necessary
- Current Source materially conflicts with this Task.

---

# Verification

Verification Level:
Standard Presentation / Art Visual Gate

Required:

- focused Grip attempt exporter tests
- full wrestler-art suite
- focused presentation selector tests
- existing Grip gameplay regression tests
- Product Counter/Tsuppari presentation regressions
- `pnpm test`
- `pnpm build`
- `git diff --check`
- Grip attempt exporter deterministic rerun
- Grip attempt exporter `--check`
- idle / Tsuppari / Counter exporter `--check`
- browser/runtime smoke
- prove Product art assets unchanged
- prove `src/game/sumo/` and `src/game/input/` Production semantics unchanged.

---

# Implementation Evidence Required

Completion Report must include:

| Design Requirement | Implemented As | Verified By |
|---|---|---|

At minimum:

- exact source identity
- normalization/pivot/body-core
- red -> blue derivation
- runtime gate paths
- reach-only selection
- recovery fallback
- success/grapple fallback
- gameplay unchanged
- Product art regressions.

---

# Completion Report

Include:

- Result
- source size/hash
- measured FRONT/root/body-core
- runtime red/blue dimensions/pivots
- runtime pixel/file hashes
- mask diagnostics
- changed files
- selector semantics
- Grip success/whiff transition results
- focused/full verification
- browser smoke
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

`art(action): add grip attempt visual gate`

Do not modify:

- `main`
- `PROJECT_HANDOFF.md`
- `CURRENT_TASK.md`.

# Final Instruction

Use the exact User-provided red image as the authored Grip attempt source.

Show the derived Grip-attempt art only during:

```
pose === 'grip'
&& gripPhase === 'reach'
```

On whiff recovery or Grip success/grapple, immediately return to the existing visual behavior.

Do not implement Grip success art or hand VFX in this Task.


---

# ChatGPT Review Handoff

Review-Date: 2026-10-23
Overall Result: TECHNICAL PASS / USER VISUAL GATE REQUIRED
Accepted Technical Baseline: 89b2d631bdd74b65f93558678f24b1b599165f4a

## Source Identity Review

The User-provided source was independently rechecked from the uploaded file.

Confirmed:

- size: 1254 x 1254
- decoded RGBA SHA-256:
  `323a7e79829c371345e8561ef3dd8ff6f49541eceb74450ec418b16c328478e0`
- PNG file SHA-256:
  `2dcc3b3f87a931098463a4168a0f31873c83b71e8b6badda376d4b1cc20f61f9`

This exactly matches the Task and recipe identity.

## Reported Implementation vs Design

Accepted as aligned with ACTION-11A.

Confirmed from Current Source / diff:

- one authored red Grip-attempt source is the only authored source
- runtime red is normalized to the Product body-core / pivot convention
- runtime blue is derived offline by local-Y reflection + the shared accepted mawashi recolor
- no runtime mirror/recolor was added
- Grip attempt selection is exactly:
  `state.pose === 'grip' && state.gripPhase === 'reach'`
- Grip recovery falls back to the existing idle Product art
- successful Grip / grapple falls back to the existing current grapple visual
- WrestlerView only adds preload + selector integration
- no dedicated Grip success art or hand VFX was added
- Counter / Tsuppari / Kuzushi / Push selection remains intact.

## Temporary Runtime Gate

Current provisional runtime:

```
public/assets/action/wrestler/grip-attempt-gate/red.png
public/assets/action/wrestler/grip-attempt-gate/blue.png
```

Current metadata:

- red: 195 x 190, pivot (81, 105)
- blue: 195 x 190, pivot (81, 85)
- body core: 123.076923 px.

Current pixel hashes:

- red:
  `9501d5301bbb982072bf419636c2ffb19f0ab9a3c72477172158a64f9dee57da`
- blue:
  `828bbf803a41bbc19f16a1d691c0c3dc8dbb26d87c83a7ce673bc5f682c59098`

This remains Visual Gate infrastructure, not permanent Product art.

## Measurement / Normalization

Accepted technical measurement:

- source FRONT: 162.5 degrees
- root: (683, 608)
- body core: (568, 244) - (759, 850)
- body-core perpendicular deviation: approximately 0.03 degrees.

The hair / mawashi scale ratios are close to idle and support the selected registration.

No unsafe guessed pivot/root/body-core was introduced.

## Recolor / Mask Review

Standard shared Product mask limits were sufficient:

- mask_px = 2220
- missed_band_px = 15 <= 60
- fringe_px = 72 <= 120.

No Grip-specific relaxation was added.

The shared recolor rule remains owned by runtime_wrestler_recipe.json.

## Exact Visual Semantics

Accepted technical rule:

```
Grip reach
-> Grip attempt gate art

Grip recovery
-> existing idle Product art

Grip success / grapple
-> existing grapple fallback
```

No presentation timer extends the attempt pose.

### Important current gameplay consequence

If Grip is pressed while already in valid success range, the Simulation can enter grapple on that same tick.

In that case there may be no rendered Grip-reach frame, so the attempt pose may not become visible before the grapple fallback appears.

This is consistent with Current Gameplay and ACTION-11A scope.

Do not change Grip timing only to force the attempt pose to appear unless the User explicitly requests that behavior after Play Test.

## Gameplay Preservation

Confirmed no Production file changes under:

- src/game/sumo/
- src/game/input/.

Therefore ACTION-11A does not change:

- Grip range
- Grip timing
- Grip success
- simultaneous Grip
- Kuzushi -> Morozashi
- release
- Grappled Orientation
- Drive
- Push charge
- Counter
- Tsuppari.

## Regression Preservation

Accepted:

- Product Tsuppari selection unchanged
- Product Counter selection and 35-degree rotation unchanged
- Push 24-tick charge visual selection unchanged
- Kuzushi sweat unchanged
- idle Product art unchanged
- grapple / drive current fallback unchanged
- Product asset source files outside this temporary gate unchanged.

## Verification Review

Reported and accepted:

- Grip attempt exporter focused tests: 17 / 17
- full wrestler-art suite: 185 / 185
- focused presentation selector: 10 / 10
- presentation regression suite: 81 PASS
- Grip / Drive / Orientation / PushCharge regression: 93 PASS
- pnpm test: 27 files / 449 PASS
- pnpm build: PASS
- git diff --check: PASS
- Grip attempt deterministic export + --check: PASS
- idle / Tsuppari / Counter exporter checks: PASS
- browser/runtime smoke: 28 / 28 PASS
- no Product art regression.

This is sufficient for Technical PASS.

## User Visual Gate

REQUIRED before promotion.

Primary question:

> Does this pose read clearly as "Grip attempt / 掴みに行く" during the short reach window?

Judge especially:

- distinction from idle
- distinction from Push / Tsuppari
- red / blue readability
- pivot / scale continuity
- whether approximately 100 ms is enough to perceive the pose
- whether immediate-success cases with no visible attempt frame are acceptable
- whether whiff -> idle recovery transition is acceptable
- whether attempt -> current temporary grapple fallback is understandable until Grip success art is added.

## Do Not Promote Yet

Until User acceptance:

- do not move from grip-attempt-gate to permanent Product paths
- do not add it as Accepted in WRESTLER_PRODUCT_ART_SPEC
- do not add Grip success art
- do not add hand-mark VFX
- do not modify Grip gameplay/timing merely to lengthen the visible pose.

## Next Task Constraint

If the User accepts ACTION-11A visually:

- the attempt pose can be promoted later, or retained provisionally while Grip success visual work continues.

The next visual design task may independently address Grip success:
- two-wrestler head/shoulder offset
- success pose
- mawashi hand-marker VFX.

Do not combine those into ACTION-11A retroactively.
