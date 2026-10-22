Task-ID: ACTION-08A-COUNTER-ART-VISUAL-GATE
Status: REVIEWED
Task-Type: ART VISUAL GATE / PRESENTATION INTEGRATION
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 85bdc89205189e056af56506084aacaacdca6d5c
Review-Handoff: ACTION-07D technical review at b5ff6a3383418e41dac77740e7244c4a2e931f28; User final regression Play Test subsequently reported OK
Handoff-Mode: GITHUB

# ACTION-08A — Counter / Parry Art Visual Gate

## Purpose

Add the User-supplied provisional art for **引き・捌き（ArrowDown / Counter）** so the Counter action is visually readable in runtime.

The User explicitly says this image is not yet ideal and wants to use it **for now**.

Therefore this Task is a **Visual Gate**, not permanent Product-art acceptance.

Do NOT redesign Counter gameplay.
Do NOT change Counter timing / Success / Best / transition semantics.
Do NOT promote this image into the permanent Product art specification yet.

---

# Accepted Baseline

ACTION-07D final regression Play Test is accepted by the User.

Treat the following as Current Baseline and do not reopen:

- permanent four Tsuppari Product textures
- SEPARATE Tsuppari Product strategy
- current Tsuppari right-arm visual
- TSUPPARI_HAND_REACH = 0.55 m
- current Push / Tsuppari / Counter gameplay semantics
- accepted idle red-master workflow
- accepted red -> blue offline local-Y reflection + mawashi recolor rule.

ACTION-07D Visual-Gate cleanup is complete.
Do not reintroduce key 4 art switching or Tsuppari gate modes.

---

# User Source File — Required Before Start

The User must place the attached image at exactly:

```
tools/wrestler_art/input.local/candidate_red_counter.png
```

Expected source:

- 1254 x 1254
- RGBA
- attached image originally named `red_parry.png`
- expected decoded RGBA pixel SHA-256:

```
eb0f2e6058fe35c239ed571e1e576fc30b4648988c347b89d4e227a3a8b3e040
```

For reference, expected uploaded-file SHA-256 was:

```
842900c1a41b4b06ed16f2c0d167f7e132bc7fbf6956865a4699ddcc77d9d979
```

The decoded pixel hash is the identity check that matters.

Preflight:
- confirm the file exists at the exact path
- confirm size / RGBA
- confirm decoded RGBA hash matches.

If it does not match:
- STOP
- report the exact observed hash
- do not substitute another image.

Do not commit `input.local/`.

---

# Terminology

User-facing action:
- **引き・捌き**
- input: ArrowDown

Current gameplay/source term:
- **Counter**

For filenames / modules / code, use `counter`.
Do not introduce a second gameplay action called `parry`.

The source image may historically be called `red_parry.png`, but the Repository candidate name is:

```
candidate_red_counter.png
```

---

# Current Source Fact

Current presentation already exposes:

```
WrestlerVisualState.pose === 'counter'
```

when:

```
ParticipantActionState.kind === 'counter'
```

Use that existing presentation state.

Do not add Counter state to Simulation.
Do not infer Counter state from raw keyboard input in Phaser.

Required architecture remains:

```
BoutSimulation / Snapshot
-> WrestlerVisualState.pose === 'counter'
-> Counter candidate art selection
-> WrestlerView
```

---

# Scope

## In Scope

- validate and normalize the supplied red Counter candidate
- generate a provisional red runtime Counter texture
- derive a provisional blue Counter texture offline
- preload the two Counter candidate textures
- show them while `WrestlerVisualState.pose === 'counter'`
- return to existing Product art when Counter state ends
- focused art/tool/presentation tests
- browser/runtime visual smoke
- User Play Test gate.

## Scope Out

Do NOT:

- change Counter gameplay
- change `COUNTER_WINDOW_TICKS`
- change Best / Success / Fail windows
- change CounterTransition
- change side/rear transition movement
- change Kuzushi
- change Push
- change Tsuppari
- change input priority
- change ArrowDown binding
- change accepted idle art
- change accepted Tsuppari Product art
- add multi-frame Counter animation
- add extra Counter poses
- add left/right Counter variants
- add a generic pose/skin framework
- update `WRESTLER_PRODUCT_ART_SPEC.md` as permanent acceptance
- update `PROJECT_HANDOFF.md`.

---

# Visual-Gate Runtime Assets

This is provisional, so use a clearly temporary runtime location:

```
public/assets/action/wrestler/counter-gate/
```

Required runtime outputs:

```
red.png
blue.png
```

These are Visual-Gate assets only.

Do not place them under a permanent `counter/` Product directory yet.

If the User later accepts the image, a follow-up promotion Task may move/rename them into a permanent Product contract.

---

# Red / Blue Art Ownership

For this Visual Gate:

## Red

- one authored red source only:
  `candidate_red_counter.png`

## Blue

Derive blue offline from the normalized red Counter texture using the already accepted idle workflow:

```
blue = local-Y reflection of normalized red
     + accepted mawashi-only recolor
```

Use the recolor rule owned by:

```
tools/wrestler_art/runtime_wrestler_recipe.json
```

Do not duplicate live recolor constants.

There is no left/right semantic hand mapping for Counter in this Task, so one red pose and its reflected blue counterpart are sufficient.

Runtime must use ordinary PNGs:
- no runtime reflection
- no runtime recolor.

---

# Normalization

Normalize the red candidate against the accepted idle red body scale / orientation.

Requirements:

- explicit source identity
- local +X = FRONT
- explicit root / pivot
- explicit body-core
- body-core normalized to 2R
- deterministic /4 runtime export
- no clipping
- canonical center must not jump when switching idle <-> Counter.

Use the same established landmark/normalization principles as the current wrestler-art tooling where applicable.

Because this image is only a provisional Visual-Gate candidate:
- do not broaden this Task into a generic pose-measurement refactor
- it is acceptable to record explicit measured values in a small Counter gate recipe
- a permanent measurement helper can be formalized only if/when this Counter image is accepted.

If the existing measurement method cannot cleanly normalize this candidate:
- STOP
- report the mismatch
- do not hand-tune arbitrary runtime offsets just to make it fit.

---

# Preferred Small Tooling

Prefer explicit provisional files such as:

```
tools/wrestler_art/counter_gate_recipe.json
tools/wrestler_art/export_counter_gate.py
```

A focused preview helper may be added only if useful.

Exporter requirements:

- reads only the authored red Counter source
- validates decoded pixel hash
- creates exactly red.png / blue.png
- reuses accepted red -> blue recolor ownership
- alpha preserved
- mask-outside pixels unchanged
- deterministic output
- `--check` is read-only
- fail closed on missing/changed source.

Do not generalize the permanent Tsuppari exporter into a broad pose framework.

---

# Presentation Integration

Prefer a small pure presentation module, e.g.:

```
src/game/presentation/counterGateArt.ts
```

It may own:

- red / blue texture keys
- asset paths
- dimensions
- pivots
- body-core diameter
- selection by Product wrestler id.

It must not import Phaser or Simulation implementation classes.

`WrestlerView` should select:

- Counter candidate art when `state.pose === 'counter'`
- accepted Product Tsuppari art when `state.pose === 'tsuppari'`
- accepted idle Product art for the currently unchanged other poses.

Keep this explicit.
Do not introduce a general animation framework.

---

# Counter Pose Lifetime

The candidate image should follow the current gameplay-derived Counter state.

Show the Counter texture while:

```
WrestlerVisualState.pose === 'counter'
```

Do not extend the image lifetime with a new presentation timer.

Therefore:

- while the Counter window is active -> Counter pose
- when the Counter action ends / whiffs -> return to current visual
- when Counter resolves into existing Success / Best / Kuzushi / CounterTransition behavior -> follow the already existing visual state afterward.

Do not change CounterTransition movement or add a new transition animation in this Task.

This Task is only the static Counter pose Visual Gate.

---

# Tests

At minimum verify:

1. accepted source hash is enforced
2. exporter uses exactly one red authored source
3. exactly two provisional runtime textures are produced
4. blue is local-Y reflection + accepted mawashi recolor
5. runtime recolor is not used
6. alpha preserved
7. mask-outside pixels unchanged
8. body-core is 2R
9. explicit metadata matches exported dimensions/pivots
10. deterministic export
11. `--check` detects stale/missing assets without writing
12. idle Product sprites unchanged
13. Tsuppari four Product textures unchanged
14. `WrestlerVisualState.pose === 'counter'` selects Counter candidate art
15. non-Counter / non-Tsuppari state still uses idle art
16. Tsuppari still selects its permanent Product art
17. no Counter gameplay source semantics changed.

---

# Verification

Verification Level:
Standard + User Visual Gate

Required:

- focused Counter art exporter tests
- relevant wrestler-art suite
- focused presentation tests
- `pnpm test`
- `pnpm build`
- `git diff --check`
- Counter exporter deterministic rerun
- Counter exporter `--check`
- accepted idle exporter `--check`
- permanent Tsuppari exporter `--check`
- prove `src/game/sumo/` and `src/game/input/` have no semantic diff from ACTION-07D baseline.

If Counter art integration requires a gameplay change:
- STOP and report.

---

# Browser / Runtime Smoke

Required.

Verify:

1. pre-bout / Enter still works
2. ArrowDown starts current Counter action
3. red wrestler shows provisional red Counter texture while Counter state is active
4. blue wrestler shows derived blue Counter texture while Counter state is active
5. pose is held only while current Counter state says `counter`
6. Counter ends cleanly back to current art
7. successful Counter still uses current Success / Best behavior
8. current CounterTransition side/rear movement is unchanged
9. Tsuppari Product art is unchanged
10. Push / Grip / movement remain unchanged
11. canonical center/facing/scale do not jump
12. R restart works
13. no missing texture / console errors.

Use existing dummy modes as appropriate to observe Counter catches.

---

# User Visual Gate

REQUIRED.

The User has already said this image is not necessarily final.

The User should judge only whether it is good enough as the current Counter visual candidate:

- idle -> Counter pose transition
- body/head alignment
- apparent body size
- arm placement/readability
- red version
- derived blue version
- whether ArrowDown visually reads as 引き・捌き
- whether the static pose duration feels readable
- whether Success / Best transition after the pose still looks understandable.

Technical PASS must not mark this art as permanently accepted.

---

# Product SPEC / Documentation

Do NOT promote the Counter image into the permanent Accepted section of `WRESTLER_PRODUCT_ART_SPEC.md` in this Task.

It is acceptable to update `docs/ARCHITECTURE.md` only if needed to truthfully say that a provisional Counter Visual Gate is currently wired to `WrestlerVisualState.pose === 'counter'`.

Keep the wording explicitly provisional.

---

# Implementation Evidence Required

Completion Report should include:

| Design Requirement | Implemented As | Verified By |
|---|---|---|

At minimum cover:

- source hash / path
- normalization / pivot / body-core
- red->blue derivation
- provisional runtime paths
- Counter-state presentation mapping
- accepted idle / Tsuppari preservation
- gameplay unchanged.

---

# Completion Report

Include:

- Result
- Preflight
- source file/hash
- normalization measurements
- runtime red/blue paths
- runtime size / pivot / body-core
- recolor/mask result
- presentation integration
- tests/build/checks
- browser smoke
- proof gameplay unchanged
- Design Deviations
- Unexpected Scope
- Known Untested Items
- User Visual Gate: REQUIRED
- Git delivery.

If none:
`Design Deviations: NONE`

---

# Stop Conditions

STOP if:

- required source file is missing
- decoded source hash differs
- candidate cannot be normalized cleanly
- recolor contaminates non-mawashi regions
- accepted idle/Tsuppari art would need to change
- Counter gameplay would need to change
- CounterTransition semantics would need to change
- a broad presentation framework/refactor becomes necessary
- Current Source materially conflicts with this Task.

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

`art(action): add counter pose visual gate`

Do not modify:

- `main`
- `PROJECT_HANDOFF.md`
- `CURRENT_TASK.md`.

# Final Instruction

Use the supplied image only as a provisional Counter / 引き・捌き Visual Gate.

Wire it to the existing Counter presentation state.
Keep all Counter gameplay and all accepted Tsuppari/idle baselines unchanged.


---

# ChatGPT Review Handoff

Review-Date: 2026-10-22
Overall Result: TECHNICAL PASS / USER VISUAL GATE REQUIRED
Accepted Technical Baseline: bc95f7117dbadf57cceee9d2a0b2a67e6fd10b56

## Reported Implementation vs Design

Accepted as aligned with ACTION-08A.

Confirmed from Current Source / diff:

- the User-supplied red Counter candidate is wired only as a provisional Visual Gate
- one authored red source is normalized offline
- blue is derived offline from normalized red by local-Y reflection + the accepted mawashi recolor
- runtime uses ordinary red/blue PNGs
- Counter art appears only when `WrestlerVisualState.pose === 'counter'`
- no new Counter timer/state was added
- accepted idle and permanent Tsuppari Product art are unchanged
- Counter gameplay, CounterTransition, input, Push and Tsuppari gameplay are unchanged
- WRESTLER_PRODUCT_ART_SPEC was correctly left unchanged because this candidate is not permanently accepted.

## Source Identity

Confirmed expected candidate contract:

```
tools/wrestler_art/input.local/candidate_red_counter.png
```

Decoded RGBA SHA-256:

```
eb0f2e6058fe35c239ed571e1e576fc30b4648988c347b89d4e227a3a8b3e040
```

The committed gate recipe pins this identity and the exporter fails closed on mismatch.

## Provisional Runtime Contract

Current Visual-Gate assets:

```
public/assets/action/wrestler/counter-gate/red.png
public/assets/action/wrestler/counter-gate/blue.png
```

Current normalized geometry:

- red: 203 x 190, pivot (79, 96)
- blue: 203 x 190, pivot (79, 94)
- body core: 123.076923 px for both.

These paths are intentionally temporary and must not be treated as permanent Product art until User acceptance.

## Normalization Review

Accepted for this Visual Gate.

Recorded candidate registration:

- source_front_deg: 170.7
- root_source_px: (750, 608)
- body_core_source_px: (678, 170) - (798, 899)
- rotation delta: +10.004 degrees
- scale: 1.1712.

The source is materially larger / somewhat more rotated than idle, but:
- the established normalization method was reused
- no arbitrary manual runtime offset was introduced
- normalized body-core remains 2R
- exporter clip checks pass
- browser placement uses canonical center/facing and explicit pivot.

This is sufficient for a provisional Visual Gate. It is not evidence that the art itself is visually accepted.

## Red -> Blue Derivation

Accepted:

```
normalized red
-> local-Y reflection
-> accepted mawashi-only recolor
-> blue
```

The recolor rule continues to be owned only by:

```
tools/wrestler_art/runtime_wrestler_recipe.json
```

Reported real mask result:

- mask: 2085 px
- missed band: 14 px
- fringe: 74 px.

Tests verify:
- alpha preserved
- mask-outside pixels unchanged
- one local-Y reflection only.

## Presentation Architecture Review

Accepted path:

```
BoutSimulation / Snapshot
-> resolveWrestlerVisualState()
-> pose === 'counter'
-> selectWrestlerPoseArt()
-> WrestlerView
```

`counterGateArt.ts` is presentation-only and Phaser-free.

For non-Counter states it delegates to the existing Product selector:
- Tsuppari -> permanent Product Tsuppari pose
- otherwise -> accepted idle art.

No duplicate gameplay state exists.

## Counter Pose Lifetime

Accepted as correctly following existing gameplay state only.

The pose is displayed while the current action resolves to:

```
WrestlerVisualState.pose === 'counter'
```

No presentation timer extends it.

A fresh Counter press advances one gameplay tick before the first inspected Snapshot, so the automated presentation test observes `COUNTER_WINDOW_TICKS - 1` subsequent held snapshots. This is consistent with the existing tick/Snapshot semantics and is not a Counter timing change.

## Gameplay Preservation

Confirmed no implementation diff under:

- `src/game/sumo/`
- `src/game/input/`.

Therefore ACTION-08A does not change:

- Counter window
- Best / Success / Fail
- Counter vs Push
- Counter vs Tsuppari
- CounterTransition side/rear motion
- Kuzushi
- ArrowDown binding
- same-tick input priority
- Push
- Tsuppari
- reach / force values.

Do not reopen these during art iteration.

## Accepted Baseline Preservation

Confirmed by focused tests / exporter checks:

- idle red / blue Product textures unchanged
- all four permanent Tsuppari Product textures unchanged
- permanent Tsuppari exporter remains clean
- idle exporter remains clean.

ACTION-07D remains the accepted Product-art baseline.

## Verification Review

Reported and accepted:

- focused Counter art exporter: 15 PASS
- wrestler-art suite: 166 PASS
- presentation tests: PASS
- pnpm test: 23 files / 358 PASS
- pnpm build / typecheck: PASS
- git diff --check: PASS
- Counter exporter deterministic rerun: PASS
- Counter exporter --check: PASS
- idle exporter --check: PASS
- permanent Tsuppari exporter --check: PASS
- browser/runtime smoke: 20 / 20 PASS.

This is sufficient for Technical PASS.

## User Visual Gate

REQUIRED.

This is the only remaining acceptance gate.

The User should judge:

- does ArrowDown clearly read as 引き・捌き
- idle -> Counter pose body/head alignment
- apparent body size
- arm placement
- red version
- derived blue version
- static Counter-window pose duration
- Counter Fail -> Kuzushi readability
- Push Counter Success / Best -> existing side/rear transition readability.

The supplied art was explicitly described by the User as provisional.

Therefore:
- Technical PASS does NOT permanently accept the image
- do not move it to a permanent `counter/` Product directory yet
- do not add it to the Accepted Product-art SPEC yet.

## Do Not Reopen

Unless explicitly requested:

- ACTION-07D permanent idle/Tsuppari Product art baseline
- Tsuppari reach 0.55 m
- current Counter gameplay semantics
- current CounterTransition behavior.

## Next Task Constraint

If the User says the Counter image is acceptable:
- create a small Counter Product-art promotion Task
- preserve the exact accepted gate pixels
- move/rename into a permanent Product Counter contract
- update WRESTLER_PRODUCT_ART_SPEC / ARCHITECTURE
- remove `counter-gate` temporary naming.

If the User does not like the image:
- refresh only `candidate_red_counter.png` and rerun this Visual Gate
- do not change gameplay.
