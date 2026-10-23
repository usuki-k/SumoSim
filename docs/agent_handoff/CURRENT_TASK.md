Task-ID: ACTION-11H-GRIP-SUCCESS-TONE-MATCH-GATE
Status: REVIEWED
Task-Type: PRESENTATION ART TONE-MATCH VISUAL GATE
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 5938e76372ae0fc5a5099c4091defe630804a920
Review-Handoff: ACTION-11G technical PASS but User Visual Gate REJECTED; current arm/hand VFX is not accepted. ACTION-11F pair compression remains accepted. This Task is brightness/tone correction only and must not redesign 11G limbs.
Handoff-Mode: GITHUB

# ACTION-11H — Grip Success Skin Tone / Brightness Match Gate

## Purpose

Make the Grip-success wrestler body match the brightness / lighting tone of the accepted normal wrestler more closely.

User feedback:

> 組む前と組んだ後でキャラクターの光の当たり具合がかなり違って気になる。  
> 組んだ後の画像を、組む前の画像の明るさに近づけたい。

This Task must test and implement a deterministic offline tone correction.

Do NOT regenerate the image with AI.

Do NOT change the authored source pixels in `input.local`.

---

# Reference / Target

Use the accepted in-game red idle runtime as the tone reference:

```
public/assets/action/wrestler/red.png
```

This is the actual "before Grip" Product body shown in the game and therefore is the correct visual target.

Verify it using the existing accepted idle exporter:

```
tools/wrestler_art/export_runtime_wrestlers.py --check
```

Do not alter the idle runtime image.

---

# Source to Correct

Grip success authored source remains:

```
tools/wrestler_art/input.local/candidate_red_grip_success.png
```

Current accepted source identity remains:

```
size: 1283 x 1226 RGBA

decoded RGBA SHA-256:
0cedde984646384514e3b1609b69f04450d04c5446888da966de206a183e566e

PNG file SHA-256:
aace9edc143176673aabf78b66120885d54fb722aa2f50a0f3a031cb1f679793
```

Do NOT overwrite / edit this source file.

The tone adjustment belongs in the deterministic Grip-success export pipeline.

---

# Current Runtime to Replace

Current provisional Grip success runtime:

```
public/assets/action/wrestler/grip-success-gate/red.png
public/assets/action/wrestler/grip-success-gate/blue.png
```

Current geometry / normalization must stay unchanged:

- source FRONT: 160.2°
- root: (662, 639)
- body core: (481, 139) – (781, 971)
- runtime body core: 123.076923 px
- runtime red size/pivot: 160 x 183 / (83, 98)
- runtime blue size/pivot: 160 x 183 / (83, 85).

Only tone/color values may change.

No geometry/pivot/alpha shape changes.

---

# Scope Discipline

This Task is brightness/tone correction only.

Preserve:

## ACTION-11C Gameplay
- all Grip gameplay
- Simulation position/facing/bond
- Drive / release
- Push/Tsuppari/Counter/Kuzushi interactions.

## ACTION-11F Accepted Pair Presentation
```
GRIP_SUCCESS_FORWARD_OFFSET_R = +0.14
GRIP_SUCCESS_LATERAL_OFFSET_R = -0.20
```

Do not change these values.

## ACTION-11G Rejected Limb VFX

Leave its implementation untouched in this Task.

The User rejected its visual design, but limb redesign is a separate future Task.

Do not:
- tune limb geometry
- hide/remove limbs
- change limb color
- change limb depth
- use limb appearance as the brightness reference.

This Task corrects only the Grip-success wrestler body art.

---

# Tone-Matching Principle

Prefer a **skin-only luminance / tone adjustment**.

Protect:

- black hair
- chonmage
- red/blue mawashi
- black outline
- transparent pixels / alpha.

The goal is not to repaint the art.

The goal is:

> Preserve the Grip-success drawing and shading structure while moving its skin brightness / light distribution closer to the accepted idle runtime.

Do not flatten highlights/shadows.

Do not recolor skin to a completely new palette.

---

# Work at Normalized Runtime Resolution

Preferred pipeline:

```
authored red success source
-> existing normalization
-> normalized red success
-> skin-tone correction
-> corrected red runtime
-> local-Y reflection
-> accepted mawashi recolor
-> corrected blue runtime
```

Reason:

- the reference `public/assets/action/wrestler/red.png` is runtime art
- both comparison images are then in the same display space / scale
- the blue should inherit exactly the corrected skin from corrected red.

Do not tone-correct red and blue independently.

---

# Deterministic Skin Mask

Use existing art-tool information where practical.

Preferred mask concept at runtime resolution:

```
opaque body pixels
- accepted mawashi region
- hair region
- dark/black outline pixels
= skin candidate region
```

Reuse existing:
- mawashi mask / hue ownership from `runtime_wrestler_recipe.json`
- hair measurement/component logic where practical.

Do not build a generic semantic segmentation system.

A small Grip-success tone helper is sufficient.

## Mask safety

The mask must not materially include:

- black hair
- red/blue mawashi
- black outline/background.

Report mask pixel count and contamination diagnostics.

If reliable skin isolation cannot be established:
- STOP and report
- do not apply a global brightness filter as a shortcut.

---

# Measurement Before Correction

Measure and report skin brightness statistics for:

1. accepted idle runtime red
2. current uncorrected normalized Grip-success red.

Use a documented luminance space.

Preferred:
- relative luminance or linear-light luma
- report at least P20 / P50 / P80 or equivalent lower/mid/high quantiles.

Also report:
- mean if useful
- number of skin pixels.

The important point is to compare **distribution**, not only one average.

---

# Candidate Tone Curves

Evaluate at least these deterministic candidates offline before selecting one:

## Candidate A — no correction

Reference only.

## Candidate B — skin-only gamma/exposure-style correction

A monotonic curve that:
- keeps darks/highlights ordered
- matches median brightness toward idle
- preserves hue/chroma as much as possible.

## Candidate C — skin-only percentile/levels correction

A monotonic mapping using at least two skin luminance quantiles, e.g. lower/high percentiles, to better match both midtone and highlight/shadow spread.

Do not implement arbitrary per-pixel histogram equalization if it introduces visible banding or destroys authored shading.

Do not alter non-skin pixels.

---

# Selection Rule

Use objective statistics to choose the best first candidate, then visually inspect.

Preferred objective comparison:

- difference in idle-vs-success P20
- difference in P50
- difference in P80
- weighted aggregate error.

The selected candidate should improve the brightness-distribution match materially over Candidate A.

However:

**Technical metric PASS != User visual acceptance.**

If the objectively closest candidate looks obviously washed out / flat / unnatural:
- prefer the visually safer deterministic candidate
- report the metric tradeoff.

Do not manually paint pixels.

---

# Preserve Skin Hue

The transform should primarily change luminance / value, not hue.

Required diagnostics:

- representative skin hue/chroma shift before vs after
- ensure no gross orange/red hue rotation.

Small numeric changes caused by luminance scaling are acceptable.

Do not intentionally shift hue unless required and explicitly reported.

---

# Alpha / Geometry Invariants

Required:

- alpha channel byte-for-byte unchanged by tone correction
- non-transparent footprint unchanged
- runtime dimensions unchanged
- pivots unchanged
- body core unchanged
- FRONT/root normalization unchanged.

Only RGB values inside the accepted skin mask may change.

Outside-mask pixels must be byte-identical before/after tone correction.

---

# Exporter / Recipe Ownership

Update the existing Grip-success gate pipeline only.

Preferred files:

```
tools/wrestler_art/grip_success_gate_recipe.json
tools/wrestler_art/export_grip_success_gate.py
tools/wrestler_art/tests/test_export_grip_success_gate.py
```

Add a small explicit tone section to the Grip-success recipe, for example:

```
"skin_tone_match": {
  "reference": "...",
  "method": "...",
  "parameters": ...
}
```

Exact schema is not prescribed.

Do not move ownership into `runtime_wrestler_recipe.json`; that recipe owns the accepted idle Product art and shared red->blue recolor rule.

Do not modify idle / Tsuppari / Counter / Grip-attempt exporters.

---

# Comparison Artifacts

Create local scratch comparison images, not committed Product assets.

At minimum create:

1. idle red runtime vs uncorrected success red
2. idle red runtime vs Candidate B
3. idle red runtime vs Candidate C
4. chosen corrected success red / blue pair.

Prefer:
- same scale
- neutral background
- labeled candidate name/statistics.

These are User Visual Gate evidence only.

Do not commit scratch sheets unless Task conventions explicitly require it.

---

# In-Game Browser Smoke

Required after selected tone correction is exported.

Use the current accepted ACTION-11F pair presentation.

The rejected ACTION-11G limb VFX may still be present because this Task must not change it.

Verify body tone in:

- Grip attempt -> success transition
- neutral grapple
- Drive
- Morozashi
- turning settled
- release -> idle.

Primary transition to inspect:

```
idle / attempt
-> Grip success
```

The skin should no longer appear to jump to a materially different lighting/brightness treatment.

---

# Required Tests

## Source / Reference

T1. Grip-success source identity remains unchanged.

T2. accepted idle runtime reference exporter --check passes.

## Mask

T3. deterministic skin mask.

T4. mawashi pixels excluded.

T5. hair/dark outline excluded.

T6. mask non-empty and sufficiently large.

## Tone

T7. correction changes only skin-mask RGB.

T8. alpha unchanged exactly.

T9. outside-mask pixels unchanged exactly.

T10. selected tone transform is monotonic.

T11. corrected brightness quantile error vs idle improves over uncorrected.

T12. no severe clipping at 0/255.

## Red / Blue

T13. red is corrected first.

T14. blue is derived from corrected red using the existing local-Y reflection + mawashi recolor.

T15. skin correction is not independently recomputed for blue.

## Geometry

T16. runtime dimensions/pivots/body-core unchanged.

---

# Regression

Must prove unchanged:

- idle Product art
- Tsuppari Product art
- Counter Product art
- Grip attempt gate art
- Grip gameplay
- ACTION-11F offsets
- ACTION-11G limb code/geometry
- public assets outside `grip-success-gate/`.

No changes under:

```
src/game/sumo/
src/game/input/
```

No changes expected under `src/game/presentation/` unless a test needs to update an expected Grip-success pixel hash/metadata reference.

Runtime metadata dimensions/pivots must remain unchanged.

---

# User Visual Gate

REQUIRED.

Primary question:

> Does Grip success now look like the same character under the same lighting as the normal/attempt state, without losing the success pose's authored shading?

Judge:

- skin brightness jump is reduced
- highlights feel consistent
- shadows still read
- skin hue remains natural
- red mawashi unchanged
- black hair/outline unchanged
- blue derived wrestler also looks consistent
- idle/attempt -> success transition no longer feels like switching to a differently lit illustration.

If still mismatched:
- report whether the remaining issue is brightness, contrast, hue, or highlight placement.

Do not use AI regeneration in this Task.

---

# Stop Conditions

STOP if:

- safe skin isolation is not possible
- correcting brightness requires editing hair/mawashi/outline substantially
- a global runtime Phaser tint/filter is required
- source geometry/pivot must change
- AI regeneration becomes necessary
- accepted idle Product art would need modification
- correcting body tone would require modifying ACTION-11F/11G presentation geometry.

---

# Verification Level

Standard Art / Presentation Visual Gate

Required:

- focused Grip-success exporter tests
- full wrestler-art suite
- deterministic export + --check
- idle/Tsuppari/Counter/Grip-attempt exporter --check
- `pnpm test`
- `pnpm build`
- `git diff --check`
- browser/runtime smoke
- comparison sheets
- Product-regression proof.

---

# Completion Report

Include:

- Result
- reference image identity
- source identity
- skin-mask method/diagnostics
- before idle/success brightness statistics
- Candidate A/B/C statistics
- selected method and parameters
- corrected red/blue runtime hashes
- proof alpha/outside-mask invariants
- proof geometry metadata unchanged
- comparison artifact paths
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

`art(action): tone match grip success wrestler`

Do not modify:

- `main`
- `PROJECT_HANDOFF.md`
- `CURRENT_TASK.md`.

# Final Instruction

Do not regenerate Grip-success art with AI.

Keep the authored Grip-success source, geometry, ACTION-11F pair compression and gameplay unchanged.

Deterministically tone-match only the Grip-success skin at export time toward the accepted idle runtime `public/assets/action/wrestler/red.png`, then derive blue from the corrected red using the existing accepted reflection + mawashi recolor pipeline.


---

# ChatGPT Review Handoff

Review-Date: 2026-10-23
Overall Result: TECHNICAL PASS / USER VISUAL GATE REQUIRED
Accepted Technical Baseline: fe7fa46f473a09fa0df1d4c4fa02cf8179508b90

## Reported Implementation vs Design

Accepted as aligned with ACTION-11H.

Confirmed from Current Source / diff:

- authored Grip-success source remains unchanged in input.local
- accepted idle runtime red is the tone reference
- tone correction runs after Grip-success normalization and before red -> blue derivation
- only skin-mask RGB is changed
- alpha is unchanged
- non-skin pixels are unchanged
- geometry / FRONT / root / pivot / body-core remain unchanged
- corrected blue is derived from corrected red by the existing local-Y reflection + mawashi recolor
- no AI regeneration
- no runtime Phaser tint/filter
- no src/game/sumo or src/game/input changes
- ACTION-11F pair-compression constants remain unchanged
- ACTION-11G limb geometry/code remains unchanged.

## Accepted Tone Method

Selected deterministic method:

Candidate C — skin-only monotonic levels / piecewise-linear luminance mapping.

Runtime skin luminance uses linear-light sRGB relative luminance:

```
Y = 0.2126 R + 0.7152 G + 0.0722 B
```

Recorded curve points:

```
(0, 0)
(0.44367 -> 0.32912)
(0.55539 -> 0.534612)
(0.56370 -> 0.554119)
(1, 1)
```

The transform scales linear RGB by Y'/Y so chromaticity is substantially preserved.

## Brightness Match Evidence

Accepted measured skin luminance:

Idle reference:
- P20 = 0.3291
- P50 = 0.5346
- P80 = 0.5541

Uncorrected success:
- P20 = 0.4437
- P50 = 0.5554
- P80 = 0.5637

Corrected success:
- P20 = 0.3294
- P50 = 0.5354
- P80 = 0.5556

RMS quantile error:

```
uncorrected A: 0.0674
gamma B:       0.0524
levels C:      0.0010
```

Therefore the selected correction materially improves the idle-vs-success luminance-distribution match.

The main original difference was not blown highlights but overly bright shadows / shallow contrast in the success art.

## Skin Mask

Accepted runtime skin mask:

- alpha >= 250
- outside accepted mawashi mask
- hue 12–50 degrees
- saturation >= 0.2
- value >= 0.35.

Reported real Grip-success skin pixels: 11073.

Diagnostics accepted:

- overlap with mawashi mask = 0
- hair / dark outline excluded by mask conditions
- no clipping introduced.

This is sufficiently narrow for the current Visual Gate.

## Color Preservation

No intentional hue shift was introduced.

Reported median skin hue/chroma:

- success before: hue 65.93°, chroma 41.75
- success after: hue 65.89°, chroma 41.50.

Per-pixel hue change:
- median ~0.37°
- max ~1.73°.

A pre-existing approximately 3.7° more-yellow skin hue versus idle remains intentionally uncorrected because ACTION-11H is brightness/tone matching, not hue repainting.

## Runtime Outputs

Corrected provisional Grip-success runtime hashes:

Red:
`5852751b85dae79826848bd6daec751fa3addc572b5943ff95047f22c1187221`

Blue:
`624d2d51b9fba3a24aebcf6750335abc8054dd1fd5cfd239469daa679ee542e2`

Geometry remains:

- red 160 x 183, pivot (83,98)
- blue 160 x 183, pivot (83,85)
- body core 123.076923 px.

## Invariants

Accepted:

- alpha byte-for-byte unchanged
- outside-mask pixels byte-for-byte unchanged
- no corrected-skin channel clipping to 0/255
- dimensions unchanged
- pivots unchanged
- body core unchanged
- source FRONT/root unchanged
- idle/Tsuppari/Counter/Grip-attempt art unchanged.

## Verification Review

Accepted:

- focused Grip-success exporter tests: 24 / 24
- full wrestler-art suite: 209 / 209
- deterministic exporter rerun / --check: PASS
- idle / attempt / Tsuppari / Counter exporter checks: PASS
- pnpm test: 30 files / 518 PASS
- pnpm build: PASS
- git diff --check: PASS
- browser/runtime smoke: 27 / 27 PASS
- no src gameplay diff.

This satisfies the Task's Standard Art / Presentation verification.

## ACTION-11G Limb Note

The rejected ACTION-11G limb VFX was correctly left unchanged.

Because ACTION-11G uses a fixed procedural skin color (#f3b47c), those rejected limbs may now look brighter than the corrected success body.

This is NOT an ACTION-11H failure and must not be corrected inside the tone-matching task.

When arm/hand VFX is redesigned later, its color should be derived/aligned from the corrected body palette rather than retaining the rejected fixed visual.

## User Visual Gate

REQUIRED before visual acceptance.

Primary question:

> Does the corrected Grip-success body now look like the same wrestler under approximately the same lighting as idle / Grip attempt?

Judge:

- brightness jump at attempt -> success
- shadow depth
- highlight consistency
- whether the remaining ~3.7° yellow hue difference is noticeable
- red mawashi / hair / black outlines remain visually unchanged
- blue success is consistent
- authored success shading still looks natural.

If still wrong, report the remaining problem specifically as one of:
- brightness
- contrast
- hue
- highlight placement.

Do not reopen AI regeneration automatically.

## Do Not Reopen

Unless User explicitly requests:

- ACTION-11C Grip gameplay
- ACTION-11F +0.14R / -0.20R pair compression
- Grip success geometry/pivot
- Grip attempt art
- accepted idle Product art.

## Deferred

- redesign of rejected ACTION-11G arm/hand VFX using the User's desired arm placement
- possible hue/chroma matching only if User says brightness is fixed but color still differs
- permanent Product promotion after visual gates are accepted.

## Next Task Constraint

Wait for User Visual Gate on ACTION-11H.

If accepted:
- treat Candidate C skin-tone correction as current Grip-success visual baseline
- next visual task may return to the rejected arm/hand VFX redesign.

If rejected:
- adjust only the specific remaining tone dimension reported by User before touching pose/geometry/gameplay.
