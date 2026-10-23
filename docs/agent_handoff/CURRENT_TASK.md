Task-ID: ACTION-11K-GRIP-SUCCESS-SYMBOLIC-FOREARM-HAND-VFX
Status: REVIEWED
Task-Type: PRESENTATION SYMBOLIC VFX VISUAL GATE
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 148006a4181e28bf2e75a5d94b99fc6ab7e72a23
Review-Handoff: ACTION-11J technical PASS; User Visual Gate REJECTED. Pair READY visibility is technically good and should be preserved, but the anatomically connected shoulder->elbow->hand limbs are too literal/complex. User wants a much more symbolic anime-like forearm+hand mark placed over the opponent's mawashi, similar in spirit to the Kuzushi sweat VFX.
Handoff-Mode: GITHUB

# ACTION-11K — Grip Success Symbolic Forearm / Hand VFX Gate

## Purpose

Replace the current anatomically connected Grip-success limb VFX with a much simpler symbolic visual.

User direction:

> もっと記号的な表現で良い。  
> まわしの上に「肘から手」の記号を上から被せるだけで良い。  
> Kuzushiの汗のようなアニメっぽい表現が良い。  
> 体と腕が繋がっていなくてよい。  
> 現在のキャラクター絵と統一感のある記号にしたい。

This Task is Presentation-only.

Do not change gameplay.

---

# Key Design Change

The ACTION-11G / 11J model tried to visually reconstruct full connected arms:

```
body
-> shoulder
-> elbow
-> forearm
-> hand
-> opponent
```

That approach is now rejected.

ACTION-11K must instead use:

```
detached symbolic forearm + hand marker
placed directly over the opponent's mawashi / waist area
```

The symbol does NOT need to connect to the wrestler's body.

Do not try to fake anatomical continuity.

The VFX is a readable anime/gameplay symbol, similar in abstraction level to the existing Kuzushi sweat effect.

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

Keep the accepted Grip-success tone correction exactly.

Do not re-export or retune Grip-success body art.

## ACTION-11J Pair READY Rule

Preserve the technically accepted visibility rule:

```
if either wrestler is TURNING:
    symbolic Grip VFX hidden for both

if both wrestlers are READY:
    symbolic Grip VFX may be shown
```

This avoids floating VFX during Grappled Orientation.

Do not reintroduce TURNING limb geometry.

---

# Remove / Replace Current Limb Presentation

The current ACTION-11J connected-arm model is NOT visually accepted.

Replace its visible output.

The final rendered Grip VFX must NOT show:

- shoulder->elbow upper-arm segments
- roots emerging from the wrestler body
- long connected wrap geometry
- detached-looking bars extending from the torso.

The underlying helper/code may be simplified or replaced as needed within presentation scope.

Prefer removing dead geometry rather than leaving multiple competing VFX systems.

Do not leave old connected arms hidden but still maintained if a simpler replacement can cleanly own the same responsibility.

---

# Symbol Count

Preferred first Visual Gate:

```
2 symbolic forearm+hand markers total for the grapple pair
```

That means:

- one marker represents one wrestler's visible grip on the opponent;
- one marker represents the other wrestler's visible grip.

Do NOT draw four full arm symbols.

The goal is clarity, not anatomical completeness.

If the existing per-wrestler view architecture makes "one marker per wrestler" simpler, that is acceptable.

---

# Symbol Shape

Each symbol should depict only:

```
elbow / short forearm -> simplified hand
```

No shoulder/root connection.

Preferred silhouette:

- short curved or slightly bent forearm
- rounded elbow-side end
- small stylized hand / mitten-like palm at the distal end
- optional tiny thumb bump
- thick dark outline
- skin fill close to the corrected Grip-success body
- one simple highlight.

It should read as an anime/game VFX mark, not as a realistic detached severed arm.

Avoid:
- visible cut-cylinder face
- long straight bar
- full anatomical upper arm
- detailed fingers
- photorealism.

---

# Visual Style

Match the existing wrestler art and Kuzushi sweat philosophy:

- simple
- bold silhouette
- dark outline
- readable at gameplay scale
- minimal detail
- intentionally symbolic.

Preferred colors:

- skin fill sampled/derived from the corrected Grip-success body palette
- dark outline near existing wrestler outline
- small warm highlight.

Do NOT reuse ACTION-11G's fixed `#f3b47c` blindly if it is visibly brighter than the ACTION-11H-corrected body.

Prefer a named presentation constant derived/selected to visually match the corrected success body.

No glow.
No text.
No UI icon box.
No particles.

---

# Placement — Main Requirement

Place each symbolic forearm+hand marker **on top of the opponent's waist / mawashi region**.

Do not anchor the visible symbol to the owner's shoulder.

The target is the opponent.

Preferred conceptual ownership:

```
self grips opponent
-> marker position is derived primarily from opponent displayed center + opponent facing
```

The symbol may rotate using the pair axis or opponent facing so the hand appears to land naturally on the mawashi.

The exact formula is a Presentation concern.

---

# Target-Local Placement

Use the opponent's displayed Grip-success center and local frame.

Local convention of the target wrestler:

- +X = target FRONT
- -X = target BACK / mawashi-knot direction
- +Y = target RIGHT
- -Y = target LEFT.

Preferred starting anchors for the two markers:

Marker A:
- opponent waist / mawashi side
- approximately target local:
  - forward = -0.35 R to -0.55 R
  - lateral = +0.55 R to +0.80 R

Marker B:
- opposite waist / mawashi side
- approximately target local:
  - forward = -0.35 R to -0.55 R
  - lateral = -0.55 R to -0.80 R

These are exploration ranges, not exact required constants.

The hand/palm should visibly overlap the opponent mawashi or adjacent waist.

---

# Forearm Orientation

The short forearm should point approximately into the hand / mawashi contact point.

It does NOT need to point back to the owner's shoulder.

Preferred:

- length roughly 0.35–0.60 R
- width roughly 0.16–0.22 R
- hand/palm roughly 0.15–0.20 R.

Allow small visual tuning within these ranges.

The forearm can be slightly diagonal rather than perfectly radial.

---

# Pair Symmetry

For a settled face-to-face pair:

- the two markers should appear on complementary sides;
- they should not stack exactly on top of each other;
- they should make the pair read as mutually gripping.

Do not require perfect mirror symmetry if a slightly asymmetric composition reads better.

A small art-id / side convention is allowed in presentation only if needed to keep the markers visually separated and deterministic.

Do not add gameplay semantics.

---

# Visibility

Show symbolic Grip markers only when:

- Grip success body art is active;
- BOTH wrestlers are READY.

Hide for:

- either wrestler TURNING
- Grip attempt
- Grip recovery
- release
- idle
- move
- Push
- Tsuppari
- Counter
- Kuzushi
- pre-bout.

No timer.
No fade.

---

# Neutral / Drive / Morozashi

Use the same symbolic markers for:

- neutral grapple
- Drive
- Morozashi holder
- Morozashi disadvantaged.

Do not encode advantage yet.

The symbols should remain visually attached to the opponent's waist as the pair moves.

---

# Rendering Strategy

Preferred: procedural Phaser-generated texture, like Kuzushi sweat.

Generate once and reuse.

A small dedicated helper is preferred, for example:

```
src/game/presentation/gripSuccessSymbolVfx.ts
```

It should be Phaser-free and own:

- visibility
- target-local anchor
- marker side
- rotation
- R-relative size.

WrestlerView / BoutScene may own actual Phaser objects.

Do not build a generic VFX framework.

---

# Reuse / Cleanup

The existing connected limb code may be replaced.

Preferred outcome:

- no obsolete shoulder/elbow geometry remains active;
- no four-segment connected-arm VFX remains rendered;
- tests describe the new symbolic model.

If a helper name can be retained without confusion, that is acceptable.

If retained names become misleading, rename narrowly.

Do not perform unrelated refactoring.

---

# Depth

The symbolic forearm+hand marker should be above the opponent body so it visibly overlays the mawashi.

Preferred depth:

```
body = 2.0
symbolic grip marker ~= 2.2–2.35
Kuzushi sweat = 2.5
```

Use one fixed depth.

No far/near split is required.

No dynamic sorting.

Stable current body ordering remains.

---

# Interaction with ACTION-11F Display Offset

The target anchor must use the **displayed Grip-success body position**, including ACTION-11F compression.

Do not anchor to raw canonical center alone if that makes the marker drift off the displayed mawashi.

Do not duplicate ACTION-11F formula.

Use the already-derived displayed position or equivalent existing presentation data.

---

# Required Visual Cases

## READY Neutral

- exactly two symbolic forearm/hand markers visible for the pair;
- each overlaps a waist / mawashi region;
- no connected upper-arm geometry;
- no obvious floating horizontal bars.

## Drive

- markers follow the displayed pair;
- remain on the waist / mawashi area.

## Morozashi

- same markers for now;
- stable.

## TURNING

- no symbolic markers for either wrestler.

## Release

- markers disappear immediately.

---

# Required Tests

## Symbol Geometry

G1. exactly one symbolic marker definition per wrestler / two total per pair.

G2. forearm length/width/hand size are R-relative.

G3. target-local anchor lies in waist/back/mawashi-side region.

G4. marker transforms correctly for facing 0, π/2, π, -π/2.

G5. complementary pair markers are deterministic and not coincident.

G6. no shoulder/root geometry is part of the new marker model.

## Visibility

V1. READY neutral -> visible.

V2. READY Drive -> visible.

V3. READY Morozashi -> visible.

V4. either TURNING -> both hidden.

V5. attempt -> hidden.

V6. release/recovery -> hidden.

V7. other actions -> hidden.

## Preservation

P1. ACTION-11F constants unchanged.

P2. ACTION-11H tone recipe/runtime unchanged.

P3. canonical bond remains 0.70 m.

P4. Snapshot unchanged.

P5. no src/game/sumo or src/game/input diff.

P6. no public wrestler asset / wrestler-art tooling diff.

---

# Browser / Runtime Smoke

Required.

Capture the standard 8-frame montage:

1. neutral immediately after success
2. neutral settled
3. Drive
4. Morozashi
5. release
6. turning immediately after success
7. turning mid
8. turning settled.

Expect:

1–4 / 8 when READY:
- exactly two symbolic markers;
- markers overlap waist / mawashi;
- visual reads as "gripping";
- no long arms growing from bodies.

6–7 TURNING:
- no markers.

5 release:
- no markers.

Also verify:
- R restart
- no new runtime errors
- Push/Tsuppari/Counter/Kuzushi unchanged.

---

# User Visual Gate

REQUIRED.

Primary question:

> Do the detached symbolic forearm+hand marks over the mawashi make the pair read as gripping, in the same simple anime-VFX spirit as Kuzushi sweat, without needing anatomically connected arms?

Judge:

- symbol feels intentional, not severed
- hand clearly lands on mawashi/waist
- forearm is short enough
- art style matches wrestler illustration
- exactly two markers are enough
- neutral/Drive/Morozashi remain clear
- TURNING hide is acceptable
- release removal is clean.

If the procedural symbol still does not match the character art:
- report that an authored small forearm+hand PNG would be the next smallest step.

Do not automatically create external image assets in this Task.

---

# Should the User Provide an Image?

For ACTION-11K, **no image is required initially**.

First attempt the symbolic mark procedurally.

If the User Visual Gate rejects the procedural drawing specifically because of art-style mismatch rather than placement/size:
- the next Task may ask the User to provide one small transparent PNG of a stylized elbow-to-hand symbol.

Do not ask for that asset before this Gate is tested.

---

# Scope

## In Scope

- remove/replace connected limb VFX
- detached symbolic elbow/forearm/hand marker
- target-waist / mawashi placement
- pair READY visibility
- simple procedural art
- focused tests
- browser montage.

## Scope Out

Do NOT:

- change gameplay
- change Grappled Orientation
- change ACTION-11F compression
- change ACTION-11H tone matching
- change Grip success/attempt body images
- AI regenerate wrestler art
- add Morozashi-specific symbol
- add dynamic z sorting
- add particles/audio/camera
- modify PROJECT_HANDOFF.md.

---

# Stop Conditions

STOP if:

- target-waist marker placement requires gameplay/canonical position changes
- current presentation flow cannot access opponent displayed position without broad architecture changes
- procedural symbolic mark cannot be made coherent without external art
- dynamic z sorting is required
- unrelated accepted visuals regress.

If stopped for art-style mismatch:
- recommend a minimal transparent forearm+hand PNG specification for the User.

---

# Verification

Verification Level:
Standard Presentation Visual Gate

Required:

- focused symbolic geometry tests
- pair READY visibility tests
- Grip success presentation regression
- Grip/Grapple/Drive/Orientation regression
- Push/Tsuppari/Counter/Kuzushi presentation regression
- `pnpm test`
- `pnpm build`
- `git diff --check`
- browser/runtime smoke
- prove ACTION-11F/11H unchanged
- prove src/game/sumo / src/game/input unchanged
- prove public/assets/action/wrestler / tools/wrestler_art unchanged.

---

# Completion Report

Include:

- Result
- old connected limb model -> new symbolic model
- marker count
- final R-relative geometry
- target-local anchor values
- render style/colors/depth
- changed files
- proof ACTION-11F/11H unchanged
- proof gameplay/canonical bond unchanged
- focused/full verification
- 8-frame montage
- Design Deviations
- Unexpected Scope
- User Visual Gate: REQUIRED
- whether a User-authored small PNG is recommended next
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

`feat(presentation): replace grip limbs with symbolic markers`

Do not modify:

- `main`
- `PROJECT_HANDOFF.md`
- `CURRENT_TASK.md`.

# Final Instruction

Replace the anatomically connected Grip-success limb VFX with two detached, symbolic elbow-to-hand markers placed directly over the opponent waist / mawashi region.

The symbols do not need to connect to the wrestler body.

Keep the visual abstraction similar to the Kuzushi sweat effect: simple, anime-like, readable, and presentation-only.

Preserve pair READY visibility: if either wrestler is TURNING, hide both symbolic markers.


---

# ChatGPT Review Handoff

Review-Date: 2026-10-23
Overall Result: TECHNICAL PASS / USER VISUAL GATE NOT YET ACCEPTED
Accepted Technical Baseline: dc8401a6c157b779502b71ed3defad7dbc26f08a

## Reported Implementation vs Design

Accepted as aligned with ACTION-11K.

Confirmed from Current Source / diff:

- the connected ACTION-11G / 11J shoulder->elbow->hand model was removed
- a detached symbolic forearm+hand model replaced it
- one marker is rendered per wrestler view, therefore two markers total per settled pair
- marker placement is target-local around waist / mawashi
- marker depth = 2.3, above body 2.0 and below Kuzushi sweat 2.5
- marker uses the ACTION-11H corrected body palette rather than the rejected fixed flat limb tone
- marker visibility preserves the ACTION-11J pair READY rule
- TURNING hides markers for both wrestlers
- release / recovery / non-Grip actions hide markers
- no src/game/sumo / src/game/input changes
- ACTION-11F pair compression remains +0.14 R / -0.20 R
- ACTION-11H tone correction remains unchanged
- canonical grapple bond remains 0.70 m.

## Current Symbol Baseline

Current provisional marker geometry:

```
elbow = (-0.10 R, +0.95 R)
hand  = (-0.55 R, +0.60 R)

length      ~= 0.570 R
width       = 0.20 R
hand radius = 0.18 R
bend        = 0.12
```

Current render style:

- dark outline
- two-tone skin
- small highlight
- simplified mitten-like hand
- no shoulder/root connection
- no particles / glow / UI box.

This direction is visually closer to the User's requested symbolic/anime-like VFX than the prior connected-arm model.

## Verification Review

Accepted:

- focused symbolic VFX tests: 14 / 14 PASS
- pnpm test: 30 files / 519 PASS
- pnpm build: PASS
- git diff --check: PASS
- browser/runtime smoke: 27 / 27 PASS
- ACTION-11F compression / ACTION-11H tone / gameplay regressions preserved
- public wrestler assets / wrestler-art tooling unchanged.

This is sufficient for Technical PASS.

## User Visual Gate

NOT YET ACCEPTED.

User feedback after visual inspection:

- the symbolic approach is close to the intended direction
- two markers total are not enough
- both hands should be represented for each wrestler
- desired count is therefore:

```
2 markers per wrestler
= 4 symbolic forearm+hand markers total for the settled pair
```

- marker orientation should be more clearly diagonal relative to the mawashi
- desired visual angle is approximately 30–45 degrees relative to the mawashi / waist band, rather than appearing too aligned with it.

The User-provided zoom confirms the current symbolic style itself is reasonably close; the main remaining issues are count / placement / angle, not the need to return to connected anatomy.

## Correction Direction

Future focused tune should preserve the detached symbolic model and change only marker layout.

Preferred next direction:

- two symbolic forearm+hand markers per wrestler
- four total per settled pair
- place them on complementary mawashi / waist positions
- each marker visually crosses the mawashi at roughly 30–45 degrees
- avoid exact stacking
- maintain pair READY visibility:
  - either TURNING -> all markers hidden
  - both READY -> all markers visible
- no body connection required
- keep the same simple anime-like procedural style unless User later rejects the art style itself.

Do not reopen connected shoulder/elbow anatomy.

## Do Not Reopen

Unless explicitly requested:

- ACTION-11C Grip gameplay
- ACTION-11F pair compression
- ACTION-11H tone correction
- Grip success / attempt body art
- canonical 0.70 m bond
- ACTION-11J pair READY visibility.

## Next Task Constraint

The next Grip VFX task should be a narrow symbolic-marker layout tune only.

It should NOT:
- redesign gameplay
- reintroduce connected arms
- change tone matching
- change pair compression
- add external PNG assets unless procedural style itself is later rejected.

Primary User Gate for the next task:

> Do four symbolic forearm+hand markers, angled about 30–45° across the mawashi, make the pair read as both wrestlers using both hands to grip?
