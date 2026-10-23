Task-ID: ACTION-11D-GRIP-SUCCESS-ART-VISUAL-GATE
Status: READY
Task-Type: PRESENTATION ART VISUAL GATE
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 6264e95052c60dcbe4b4a998d169047d5c608e1f
Review-Handoff: ACTION-11C technical PASS at 6264e95052c60dcbe4b4a998d169047d5c608e1f; User Play Test subsequently reported OK, so current Grip lunge/contest gameplay is accepted baseline
Handoff-Mode: GITHUB

# ACTION-11D — Grip Success Pose Visual Gate

## Purpose

Apply the User-provided second image as a **Grip success / grappled-state visual candidate**.

This is NOT the existing Grip attempt image.

Current art ownership:

```
Grip attempt source:
tools/wrestler_art/input.local/candidate_red_grip_attempt.png

Grip success source for this Task:
tools/wrestler_art/input.local/candidate_red_grip_success.png
```

The existing Grip attempt image remains unchanged and continues to display during Grip reach.

The new success image is displayed after Grip succeeds and the pair is grappled.

This Task is presentation/art only.

Do NOT change accepted ACTION-11C Grip gameplay.

---

# Required User Source Asset

The User must place the newly supplied Grip success image at:

```
tools/wrestler_art/input.local/candidate_red_grip_success.png
```

Expected identity:

```
size: 1283 x 1226 RGBA

decoded RGBA pixel SHA-256:
b2d38c4fb70a7b91682dab8949b27b2ccc917c820ffd440a14906c3e23117a56

reviewed PNG file SHA-256:
0c08d0f9f7297531263398d3a42cfd2845d9cd414aaf09fa0bcf2fcccfb93154
```

The source stays under `input.local/` and must NOT be committed.

The decoded RGBA hash is the authoritative source identity.

## Stop condition

If the exact source is missing:
- STOP before Production changes
- report that `candidate_red_grip_success.png` is required.

If size or decoded hash differs:
- STOP and report observed values.

Do not substitute:
- candidate_red_grip_attempt.png
- idle art
- another generated image
- an older Grip candidate.

---

# Accepted Gameplay Baseline — Preserve Exactly

ACTION-11C is accepted by User Play Test.

Do not change:

```
GRIP_REACH_TICKS = 8
GRIP_MIN_ATTEMPT_TICKS = 4
GRIP_RECOVERY_TICKS = 12
```

Preserve:

- short locked-direction Grip lunge
- contact-driven Grip success
- Grip reach facing lock
- Tsuppari > Grip
- Push impact > Grip
- Grip > Counter -> neutral grapple / no Kuzushi
- Grip / Grip -> neutral grapple
- Kuzushi Grip -> Morozashi
- same-participant input priority
- release
- grapple bond
- Grappled Orientation
- Drive.

No `src/game/sumo/` or `src/game/input/` gameplay semantic change is expected.

---

# Existing Attempt Visual — Preserve

ACTION-11A remains unchanged.

Current attempt display:

```
state.pose === 'grip'
&& state.gripPhase === 'reach'
-> Grip Attempt gate art
```

Do NOT:
- replace attempt art
- modify its recipe/exporter
- modify its pivot/scale
- promote it in this Task.

Expected transition:

```
Shift
-> Grip attempt pose during reach/lunge
-> Grip success
-> Grip success pose
```

On whiff:

```
Grip reach
-> Grip recovery
-> existing idle Product art
```

---

# Grip Success Display Semantics

Current `WrestlerVisualState` already exposes:

- `pose === 'grapple'` while grappled and not actively Drive
- `pose === 'drive'` while grappled and contributing Drive.

For this Visual Gate, display the same Grip success texture for:

```
state.pose === 'grapple'
OR
state.pose === 'drive'
```

Reason:
- the success image represents the bonded / gripping state
- pressing Drive must not visually drop back to idle.

Do NOT change the image based on:
- neutral vs Morozashi
- holder vs disadvantaged
- turning vs ready.

Those distinctions are Deferred.

Grip success texture must disappear immediately when grapple ends / release occurs.

After release recovery:
- current existing idle Product art remains.

---

# Pair Usage / Intended Visual

The User's intent is:

> The single authored Grip-success image should be usable as one side of a two-wrestler grapple.  
> The blue counterpart is derived by reflection, and when the two wrestlers face each other at the current grapple bond distance, their heads/shoulders should look more like interlocked wrestlers than the current two idle sprites touching forehead-to-forehead.

This Task must test that hypothesis.

Do NOT preemptively alter:
- grapple bond distance
- canonical positions
- facing
- pair translation
- pair rotation
- head offset
- body overlap rules.

First test the image at the Current Source canonical grapple positions.

If it is not visually convincing:
- report User Visual Gate required
- do not invent positional offsets in this Task.

---

# Red / Blue Art Strategy

Use exactly one authored source:

```
candidate_red_grip_success.png
```

Derive blue offline using the accepted red -> blue Product rule:

```
red success
-> normalize to Product body-core / FRONT convention

blue success
= local-Y reflection of normalized red
+ accepted shared mawashi recolor
```

Use:

```
(x, y) -> (x, H - y)
```

This preserves local +X = FRONT.

This reflection strategy is especially intentional here because the User plans for the two success sprites to face one another as a mirrored pair.

Do NOT:
- runtime mirror
- runtime recolor
- author a separate blue source
- add separate neutral / Morozashi success sprites.

---

# Normalization

The success sprite must conform to the same rigid Product body contract:

- local +X = FRONT
- explicit root/pivot
- body core = 2R at Product scale
- canonical participant center unchanged by texture swap
- no Scene-side image-specific scale or pixel offsets.

Measure FRONT / root / body-core from this actual success source.

Reuse existing deterministic measurement / normalization machinery where valid.

Do not copy values from:
- Grip attempt
- Counter
- idle
solely because they look similar.

If safe landmark measurement cannot be established:
- STOP and report the exact problem
- do not guess.

---

# Visual-Gate Runtime Paths

This is provisional, not permanent Product Grip art.

Preferred runtime:

```
public/assets/action/wrestler/grip-success-gate/red.png
public/assets/action/wrestler/grip-success-gate/blue.png
```

Preferred pure metadata module:

```
src/game/presentation/gripSuccessGateArt.ts
```

Preferred tooling:

```
tools/wrestler_art/grip_success_gate_recipe.json
tools/wrestler_art/export_grip_success_gate.py
tools/wrestler_art/tests/test_export_grip_success_gate.py
```

Focused TS test:

```
src/game/presentation/gripSuccessGateArt.test.ts
```

Equivalent small naming is acceptable if Current Source conventions require it.

Do not use permanent `grip/` Product paths yet.

---

# Selector Composition

Keep selection small and explicit.

Preferred composition:

1. Grip success selector for `grapple` / `drive`
2. otherwise existing Grip attempt selector
3. otherwise existing Counter / Tsuppari / idle selector.

For example conceptually:

```
if pose is grapple or drive:
  success gate art
else:
  existing Grip-attempt / Counter / Tsuppari / idle selection
```

Do not duplicate existing selectors.

A small pure wrapper is preferred.

Do not introduce a generic pose framework.

---

# WrestlerView

Only presentation integration is expected:

- preload success red/blue textures
- use final selector
- existing canonical position
- existing canonical facing
- texture-specific pivot
- texture-specific Product scale.

Do NOT add:

- pair-local offset
- extra rotation
- scale animation
- sprite deformation
- body wobble
- camera effect
- timer
- hand VFX.

The current procedural shadow remains unchanged.

---

# Drive Behavior

Drive is part of the grappled state.

Required:

```
grapple pose
-> Grip success texture

Drive pressed
-> still Grip success texture

Drive released
-> still Grip success texture
```

No texture flicker back to idle during Drive.

Drive gameplay itself remains unchanged.

---

# Release Behavior

Current release semantics remain.

When grapple is released:

```
engagement -> free
releaser -> Grip recovery
```

At the first released/free visual state:
- Grip success texture disappears
- existing idle Product art is used for recovery.

Do not show the Grip attempt texture during release recovery.

---

# Neutral / Morozashi

For ACTION-11D only, both use the same success texture.

Required:

```
neutral grapple
-> success texture

Morozashi holder
-> success texture

Morozashi disadvantaged
-> success texture
```

Do not add:
- hand mark
- holder marker
- different pose
- color effect.

The existing gameplay advantage remains Simulation-owned and unchanged.

---

# Future Hand VFX — Explicitly Deferred

The User wants hand marks around the mawashi in a later Task.

Do NOT implement them now.

No:
- hand icon
- handprint
- glow
- mawashi marker
- grip point marker.

This Task isolates whether the success body pose itself improves the two-wrestler grapple silhouette.

---

# Art Validation

Exporter must be deterministic and fail closed.

At minimum verify:

1. source size/hash matches exact User source
2. one authored red success source only
3. exactly two runtime output files
4. deterministic normalized red
5. blue = exactly one local-Y reflection + shared mawashi recolor
6. alpha preserved
7. recolor only changes accepted mawashi mask
8. shared recolor rule remains owned by `runtime_wrestler_recipe.json`
9. no runtime mirror/recolor
10. committed gate outputs equal a fresh export.

Use existing standard mask limits where possible.

Do not silently relax global mask limits.

If this image requires a Grip-success-specific allowance:
- STOP and report mask diagnostics
- do not widen thresholds without review.

---

# Required Presentation Cases

## Selection

S1. idle -> idle Product art.

S2. Grip reach -> existing Grip Attempt gate art.

S3. Grip recovery -> idle Product art.

S4. successful neutral grapple -> Grip Success gate art for both wrestlers.

S5. successful Morozashi grapple -> Grip Success gate art for both wrestlers.

S6. Drive -> Grip Success gate art remains.

S7. Drive stops but grapple remains -> success art remains.

S8. release -> success art disappears immediately.

S9. release recovery -> idle Product art.

## Existing Art Regression

R1. Tsuppari Product art unchanged.

R2. Counter Product art / 35-degree motion unchanged.

R3. Kuzushi sweat unchanged.

R4. Push still uses current idle art.

R5. Grip attempt gate unchanged.

R6. Product idle assets unchanged.

---

# Pair Visual Smoke

Browser/runtime smoke must explicitly inspect the two-wrestler grapple.

At minimum:

1. Enter starts Bout
2. Shift shows attempt pose
3. after accepted minimum attempt/contact, grapple succeeds
4. both wrestlers switch to success textures on the same grapple frame
5. red/blue textures face each other using canonical facing
6. current 0.70 m grapple bond remains unchanged
7. centers do not jump from the texture swap itself
8. scale does not materially jump
9. heads are no longer simply the old idle forehead-to-forehead silhouette
10. no severe visual self-overlap / clipping caused by pivot error
11. Drive does not change the success texture
12. Morozashi also uses the success texture
13. release removes success texture immediately
14. attempt on a later new Grip still works
15. Push/Tsuppari/Counter/Kuzushi art remains unchanged
16. R restart works
17. no console errors / failed asset requests.

Capture screenshots for:

- neutral grapple immediately after success
- settled neutral grapple
- Drive while grappled
- Morozashi grapple
- immediately after release.

---

# User Visual Gate

REQUIRED.

Primary question:

> When the red success pose and its derived blue reflection face each other at the existing grapple bond distance, does the pair now read as "組み合っている / Grip success" rather than "two idle wrestlers touching"?

Judge:

- head positions appear interlocked rather than forehead-to-forehead
- shoulder/chest silhouette feels more tightly engaged
- reflected blue looks natural
- red/blue pair looks coherent
- pivot/scale swap is not distracting
- current 0.70 m bond distance is visually acceptable with this art
- success art remains natural during Drive
- Morozashi using the same temporary pose is acceptable
- transition attempt -> success is understandable
- release -> idle is acceptable.

If the pair still does not read as a grapple:
- do NOT change gameplay
- likely next visual Task should test pair-local presentation offset / success-pose refinement / hand VFX.

Technical PASS does not mean visual acceptance.

---

# Scope

## In Scope

- exact new red Grip-success source
- deterministic red/blue temporary gate export
- grapple/drive success texture selection
- preload/integration
- focused presentation/art tests
- browser pair visual smoke
- User Visual Gate.

## Scope Out

Do NOT:

- change Grip gameplay
- change Grip lunge
- change minimum attempt ticks
- change grapple bond distance
- change Grappled Orientation
- change Drive
- add pair position offsets
- add head/shoulder runtime offsets
- add hand-marker VFX
- implement separate neutral/Morozashi poses
- modify Grip attempt art
- promote either Grip art to permanent Product
- modify WRESTLER_PRODUCT_ART_SPEC Accepted section
- modify PROJECT_HANDOFF.md.

---

# Documentation

Because this is provisional:

- do NOT add success pose as Accepted Product art
- a short provisional ACTION-11D note in `docs/ARCHITECTURE.md` is allowed
- clearly mark it Visual Gate / provisional.

---

# Stop Conditions

STOP if:

- required success source is missing/hash mismatched
- FRONT/root/body-core cannot be safely measured
- blue recolor contaminates skin/hair
- global mask rule/limit change would be required
- success art requires gameplay/bond-distance change to function technically
- success selector cannot be composed without disturbing attempt/Counter/Tsuppari selection
- Current Source materially conflicts with this Task.

---

# Verification

Verification Level:
Standard Presentation / Art Visual Gate

Required:

- focused success exporter tests
- full wrestler-art suite
- focused success selector tests
- existing Grip attempt selector tests
- existing Grip/Grapple/Drive gameplay regression tests
- Counter/Tsuppari/Kuzushi/Push presentation regressions
- `pnpm test`
- `pnpm build`
- `git diff --check`
- Grip success exporter deterministic rerun
- Grip success exporter `--check`
- attempt / idle / Tsuppari / Counter exporters `--check`
- browser/runtime smoke
- prove `src/game/sumo/` and `src/game/input/` gameplay semantics unchanged
- prove accepted Product asset hashes unchanged.

---

# Implementation Evidence Required

Completion Report must include:

| Design Requirement | Implemented As | Verified By |
|---|---|---|

At minimum cover:

- exact source identity
- measured FRONT/root/body-core
- red -> blue derivation
- temporary runtime paths
- grapple/drive-only selection
- attempt preservation
- neutral/Morozashi same temporary pose
- release fallback
- gameplay unchanged
- Product art regression.

---

# Completion Report

Include:

- Result
- exact source size/hash
- measurement evidence
- runtime red/blue dimensions/pivots/body-core
- runtime pixel/file hashes
- mask diagnostics
- changed files
- selector composition
- neutral/Morozashi/Drive/release results
- pair screenshots/smoke results
- full verification
- gameplay unchanged evidence
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

`art(action): add grip success visual gate`

Do not modify:

- `main`
- `PROJECT_HANDOFF.md`
- `CURRENT_TASK.md`.

# Final Instruction

Use the exact User-provided `candidate_red_grip_success.png` as the only authored Grip-success source.

Keep ACTION-11A Grip attempt unchanged.

Show the new success pose throughout grapple and Drive:

```
pose === 'grapple' || pose === 'drive'
```

Use the existing canonical grapple positions/facing first.

Do not add hand VFX, pair offsets, bond-distance changes or gameplay changes in ACTION-11D.
