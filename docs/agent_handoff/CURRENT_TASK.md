Task-ID: ACTION-08C-COUNTER-PRODUCT-ART-PROMOTION
Status: REVIEWED
Task-Type: IMPLEMENTATION / PRODUCT ART PROMOTION / TEMP-GATE CLEANUP
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: b65ab9a2e01835dc955248d5d4f7492361b78c1c
Review-Handoff: ACTION-08B accepted by User visual Play Test at a5f4fe3e9bb48cfad8c38cbc65723ae4a4bd4d78
Handoff-Mode: GITHUB

# ACTION-08C — Promote Counter / Hiki-Sabaki Art to Product Baseline

## Purpose

Promote the User-accepted Counter / 引き・捌き visual result from the temporary ACTION-08A/08B gate into the permanent Product art/runtime contract.

The User has accepted the integrated current result:

- current Counter red pose
- current derived blue Counter pose
- current explicit pivots/body-core
- current presentation-only body rotation
- max 35 degrees
- sine curve
- red + / blue - mirrored direction.

This Task is a Product promotion / cleanup only.

Do NOT redesign the pose.
Do NOT retune the 35-degree motion.
Do NOT change Counter gameplay.

---

# Accepted Baseline — Do Not Reopen

## Counter gameplay

Keep exactly:

- ArrowDown = Counter
- COUNTER_WINDOW_TICKS = 12
- Counter Best / Success / Fail semantics
- Counter vs Push behavior
- Counter vs Tsuppari behavior
- CounterTransition side/rear movement
- Kuzushi rules
- input priority
- participant canonical facing semantics.

No Simulation changes are expected.

## Counter visual

Keep exactly the currently accepted ACTION-08A1 / 08B result.

Current accepted provisional assets:

```
public/assets/action/wrestler/counter-gate/red.png
public/assets/action/wrestler/counter-gate/blue.png
```

Current accepted geometry:

- red: 210 x 207, pivot (74, 115)
- blue: 210 x 207, pivot (74, 92)
- body core: 123.076923 px.

Current accepted source identity:

```
tools/wrestler_art/input.local/candidate_red_counter.png
```

decoded RGBA pixel SHA-256:

```
5429d02f6f7ffad36754cbd5958c77bb1197027cce45572f81c825d1a02c37b8
```

Current accepted red/blue derivation:

```
red = normalized authored red Counter source
blue = local-Y reflection(red) + accepted mawashi-only recolor
```

Current accepted body motion:

```
phaseProgress = 1 - counter.ticksRemaining / COUNTER_WINDOW_TICKS
magnitude = sin(pi * phaseProgress) * 35 degrees

red  = canonical facing + magnitude
blue = canonical facing - magnitude
```

Outside Counter:
- visual rotation offset = 0.

Do not change any of these values or signs.

---

# Permanent Runtime Contract

Replace the temporary Counter gate asset location with a permanent Product location.

Preferred permanent path:

```
public/assets/action/wrestler/counter/
```

Preferred files:

```
red.png
blue.png
```

Permanent outputs must preserve the accepted pixels exactly.

Before removing/renaming the gate assets:
- capture their decoded pixel hashes
- prove permanent red == current counter-gate/red.png
- prove permanent blue == current counter-gate/blue.png
- preferably preserve identical PNG bytes as well if only moving/renaming.

Do not renormalize into a visually different result.

---

# Permanent Presentation Module

Replace temporary gate naming with permanent Product naming.

Preferred:

```
src/game/presentation/productCounterArt.ts
```

It should own:

- red / blue Product Counter metadata
- texture keys
- permanent asset paths
- width / height
- pivots
- body-core diameter
- accepted 35-degree presentation rotation constants/function
- Counter art selection.

Current pure architecture remains:

```
BoutSimulation / Snapshot
-> WrestlerVisualState
-> Product Counter art + pure presentation rotation
-> WrestlerView
```

Do not add Phaser imports to the pure presentation module.

Do not create a generic pose framework.

---

# Permanent Counter Export Tooling

Promote the current gate exporter/recipe into a permanent deterministic Counter exporter contract.

Preferred names:

```
tools/wrestler_art/counter_recipe.json
tools/wrestler_art/export_counter.py
```

The permanent contract should:

- use exactly one authored red Counter source
- validate the accepted decoded source hash
- produce exactly two runtime outputs:
  - red.png
  - blue.png
- derive blue by local-Y reflection + accepted shared mawashi recolor
- preserve alpha
- preserve pixels outside recolor mask
- fail closed on source mismatch
- be deterministic
- support read-only `--check`.

Reuse the existing accepted recolor rule owned by:

```
tools/wrestler_art/runtime_wrestler_recipe.json
```

Do not duplicate recolor constants.

---

# Counter-Specific Mask Limit

Preserve the accepted Counter-only validation allowance introduced in ACTION-08A1:

```
max_missed_px = 80
```

Reason:
- current accepted image has 70 missed band pixels
- 69 of those are semi-transparent outline/fringe pixels with alpha < 128
- no material skin/hair/arm contamination was observed.

Important:
- this is Counter-specific
- do NOT change idle or Tsuppari mask limits
- do NOT change the recolor algorithm
- do NOT change the shared recolor rule
- permanent Counter exporter must still fail if missed > 80
- permanent Counter exporter must still fail/report if material contamination appears.

Document this as a narrow accepted property of this Counter source, not a global standard.

---

# Remove Temporary Gate Naming

After permanent Product paths/modules/tools are in place, remove/retire temporary runtime/tool naming where appropriate:

- `counter-gate/` runtime directory
- `counterGateArt.ts`
- `counterGateArt.test.ts`
- `counter_gate_recipe.json`
- `export_counter_gate.py`
- corresponding README wording that calls the current accepted Counter art a Visual Gate.

Use git mv/rename where appropriate to preserve history.

Do not remove useful historical notes explaining the earlier gate process.

Do not leave duplicate active Sources of Truth.

---

# WrestlerView Integration

Keep behavior unchanged.

WrestlerView should still:

- preload idle Product art
- preload permanent Tsuppari Product art
- preload permanent Counter Product art
- select Counter art only when `state.pose === 'counter'`
- apply accepted Counter presentation rotation to body sprite only
- keep canonical participant position
- keep canonical participant facing unchanged
- keep shadow on canonical facing
- keep scale unchanged.

No extra translation.
No extra scale animation.
No new timer.

---

# WrestlerVisualState

Keep current Counter progress derivation unchanged:

```
phaseProgress = progress(action.ticksRemaining, COUNTER_WINDOW_TICKS)
```

Do not change progress semantics.

Do not add new Counter presentation state.

---

# Product Art SPEC Update

Update:

```
docs/WRESTLER_PRODUCT_ART_SPEC.md
```

so §0 truthfully includes permanent Counter art.

Accepted Counter section should state:

- one authored red Counter master
- blue derived offline by local-Y reflection + shared mawashi recolor
- permanent runtime red/blue textures
- explicit pivot/body-core metadata
- pose selected by `WrestlerVisualState.pose === 'counter'`
- Counter pose shown for current Counter action state only
- presentation-only body rotation:
  - 0 -> 35 -> 0
  - sine curve
  - red + / blue -
- body rotation does not change Simulation facing
- no runtime reflection/recolor
- sprite shape does not determine gameplay collision
- the integrated visual result was accepted by User Play Test.

Also state that the previous `counter-gate` naming was temporary Visual-Gate infrastructure and is no longer the Product contract.

Do not rewrite unrelated historical sections.

---

# ARCHITECTURE Update

Update Current Architecture so it describes:

- permanent Counter Product art
- permanent red->blue derivation
- presentation-only 35-degree body-sabaki rotation
- canonical `participant.facing` remains Simulation-owned and unchanged
- Counter art/motion is presentation only.

Remove wording that says the Counter art is still provisional/gate-only.

Do not alter Counter gameplay formulas.

---

# Tests

At minimum verify:

1. accepted Counter source hash is enforced
2. permanent exporter uses exactly one authored red source
3. exactly two permanent Counter runtime textures are produced
4. permanent red pixels equal accepted gate red pixels
5. permanent blue pixels equal accepted gate blue pixels
6. blue is local-Y reflected red + shared mawashi recolor
7. Counter-only mask limit remains 80
8. idle/Tsuppari mask rules remain unchanged
9. alpha preserved
10. mask-outside pixels unchanged
11. body core remains 123.076923 px
12. permanent TypeScript metadata matches exporter dimensions/pivots
13. deterministic exporter
14. `--check` is read-only and detects stale/missing assets
15. accepted idle sprites unchanged
16. accepted Tsuppari textures unchanged
17. Counter selector works only during Counter
18. accepted 35-degree sine rotation is unchanged
19. red/blue signs remain +/-
20. participant.facing / Snapshot unchanged by presentation rotation
21. no temporary `counter-gate` runtime dependency remains
22. Simulation/input source unchanged.

Do not weaken existing tests.

---

# Verification

Verification Level:
Standard Product Art Promotion + final regression check

Required:

- focused permanent Counter art exporter tests
- full wrestler-art suite
- focused presentation tests
- relevant Counter gameplay regression tests
- `pnpm test`
- `pnpm build`
- `git diff --check`
- permanent Counter exporter deterministic rerun
- permanent Counter exporter `--check`
- idle exporter `--check`
- Tsuppari exporter `--check`
- prove `src/game/sumo/` and `src/game/input/` unchanged from ACTION-08B baseline.

If promotion requires gameplay changes:
- STOP and report.

---

# Browser / Runtime Smoke

Required.

Verify:

1. Enter starts Bout
2. ArrowDown shows permanent Counter Product art
3. blue uses accepted derived texture
4. red uses accepted authored-derived texture
5. accepted 0 -> 35 -> 0 motion is unchanged
6. red + / blue - direction is unchanged
7. body rotates around the explicit pivot/canonical center
8. position/scale unchanged
9. participant.facing unchanged
10. shadow remains canonical-facing
11. Counter Fail behavior unchanged
12. Push Counter Success / Best unchanged
13. CounterTransition side/rear movement unchanged
14. Tsuppari Product art unchanged
15. Push / Grip / movement unchanged
16. no temporary counter-gate runtime texture is loaded
17. R restart works
18. no console errors.

---

# Final User Regression Play Test

Required, but this is only a regression gate.

The User already accepted:
- current Counter image
- current blue derivation
- current 35-degree body rotation.

The final check is only to confirm promotion/cleanup changed nothing visually.

Judge:

- same Counter pose
- same red/blue look
- same 35-degree movement
- same Tsuppari distinction
- same Success/Best transition
- no pivot/scale jump
- no gameplay regression.

Do not redesign during this Task.

---

# Scope Out

Do NOT:

- change Counter image
- change source hash
- change normalization values
- change pivots
- change body-core
- change 35 degrees
- change sine curve
- change red/blue sign
- add lateral offset
- add scale/camera/impact animation
- change Counter gameplay
- change CounterTransition
- change Push / Tsuppari
- change idle Product art
- create generic animation framework
- modify PROJECT_HANDOFF.md.

---

# Stop Conditions

STOP if:

- accepted source hash does not match
- permanent outputs cannot reproduce accepted gate pixels
- promotion changes pivot/body-core/visual pixels
- Counter-only mask allowance no longer safely covers the source
- recolor contaminates skin/hair/arms
- Counter gameplay changes become necessary
- CounterTransition changes become necessary
- removing gate naming requires broad architecture redesign
- Current Source materially conflicts with this Task.

---

# Implementation Evidence Required

Completion Report must include a table:

| Design Requirement | Implemented As | Verified By |
|---|---|---|

At minimum cover:

- accepted gate -> permanent Product promotion
- exact permanent runtime paths
- source ownership/hash
- red->blue derivation
- accepted-pixel preservation
- Counter-only max_missed=80
- explicit geometry/pivots
- accepted 35-degree motion preservation
- temporary gate cleanup
- SPEC/ARCHITECTURE update
- gameplay unchanged.

---

# Completion Report

Include:

- Result
- Preflight
- accepted source hash
- accepted gate pixel hashes
- permanent pixel hashes
- proof gate == permanent pixels
- permanent runtime paths
- permanent exporter/recipe ownership
- renamed/deleted temporary gate files
- geometry/pivots/body-core
- mask diagnostics
- 35-degree motion preservation
- tests/build/checks
- browser smoke
- gameplay unchanged evidence
- Design Deviations
- Unexpected Scope
- Known Untested Items
- Final User Regression Play Test Required
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

`refactor(art): promote counter product pose`

Do not modify:

- `main`
- `PROJECT_HANDOFF.md`
- `CURRENT_TASK.md`.

# Final Instruction

Promote the already accepted Counter visual result into the permanent Product art contract.

Preserve exact accepted pixels and exact accepted 35-degree presentation motion.

Remove temporary gate naming only.
Keep Counter gameplay completely unchanged.


---

# ChatGPT Review Handoff

Review-Date: 2026-10-22
Overall Result: TECHNICAL PASS / FINAL USER REGRESSION PLAY TEST REQUIRED
Accepted Technical Baseline: 6c6a3f0cc2fcaffa2cef26d057713a8e783bf9c7

## Reported Implementation vs Design

Accepted as aligned with ACTION-08C.

Confirmed from Current Source / diff:

- accepted Counter gate textures were promoted by rename/move into permanent Product paths
- permanent red/blue Counter pixels are unchanged from the accepted gate baseline
- permanent Product metadata preserves accepted dimensions/pivots/body-core
- accepted 35-degree sine rotation is unchanged
- accepted red + / blue - sign convention is unchanged
- temporary counter-gate runtime path is removed
- temporary gate module/tool/recipe names were promoted to permanent Product names
- WRESTLER_PRODUCT_ART_SPEC and ARCHITECTURE now describe the permanent Counter Product contract
- src/game/sumo and src/game/input are unchanged.

## Permanent Counter Product Contract

Accepted technical contract:

```
public/assets/action/wrestler/counter/red.png
public/assets/action/wrestler/counter/blue.png
```

Permanent presentation ownership:

```
src/game/presentation/productCounterArt.ts
```

Permanent tooling ownership:

```
tools/wrestler_art/counter_recipe.json
tools/wrestler_art/export_counter.py
```

Current authored source identity:

```
tools/wrestler_art/input.local/candidate_red_counter.png
```

decoded RGBA SHA-256:

```
5429d02f6f7ffad36754cbd5958c77bb1197027cce45572f81c825d1a02c37b8
```

## Accepted Pixel Preservation

Permanent Product decoded RGBA hashes:

- red:
  `83b96783ebdd741ab07e435d25ce7a4ce6557b734d40c8873560bab2b630d5d3`
- blue:
  `1dec7025670ba375287166078cbb52dd3b6701fa52618646107fd4f50153e439`

These are the same accepted ACTION-08A1/08B gate pixels.

Permanent geometry remains:

- red: 210 x 207, pivot (74, 115)
- blue: 210 x 207, pivot (74, 92)
- body core: 123.076923 px.

No visual renormalization occurred during promotion.

## Accepted Counter Derivation

Permanent mapping remains:

```
red = normalized authored red Counter source
blue = local-Y reflection(red) + shared accepted mawashi recolor
```

The shared recolor rule remains owned by:

```
runtime_wrestler_recipe.json
```

No runtime reflection/recolor is introduced.

## Counter-Specific Mask Allowance

Accepted and preserved:

```
max_missed_px = 80
```

for this Counter source only.

Current diagnostics:

- mask: 1724 px
- missed: 70 px
- fringe: 75 px.

The idle/Tsuppari limits remain unchanged at 60.

Do not generalize this Counter-specific allowance into a global art rule.

## Accepted Motion Preservation

Permanent presentation motion remains exactly:

```
phaseProgress = 1 - counter.ticksRemaining / COUNTER_WINDOW_TICKS
magnitude = sin(pi * phaseProgress) * 35 degrees

red  = canonical facing + magnitude
blue = canonical facing - magnitude
```

Outside Counter:
- rotation offset = 0.

The body sprite alone receives this offset.

Unchanged:
- participant.facing
- shadow rotation
- canonical position
- scale
- Simulation state.

## Temporary Gate Cleanup

Confirmed promoted/removed from current ownership:

- `counter-gate/` runtime path
- `counterGateArt.ts`
- `counter_gate_recipe.json`
- `export_counter_gate.py`
- temporary gate texture keys.

Historical gate information remains only as documentation/history where useful.

The active runtime contract is now the permanent Product Counter contract above.

## Gameplay Preservation

Confirmed no diff under:

- `src/game/sumo/`
- `src/game/input/`.

Therefore ACTION-08C does not change:

- COUNTER_WINDOW_TICKS
- Counter Best / Success / Fail
- Counter vs Push
- Counter vs Tsuppari
- CounterTransition
- side/rear target semantics
- Kuzushi
- ArrowDown
- input priority
- canonical participant facing.

Do not reopen these in Product-art cleanup tasks.

## Verification Review

Reported and accepted:

- focused permanent Counter exporter: 17 PASS
- full wrestler-art suite: 168 PASS
- presentation tests: 57 PASS
- pnpm test: 23 files / 364 PASS
- pnpm build / typecheck: PASS
- git diff --check: PASS
- permanent Counter exporter deterministic rerun: PASS
- permanent Counter exporter --check: PASS
- idle exporter --check: PASS
- Tsuppari exporter --check: PASS
- browser/runtime smoke on GPU: 28 / 28 PASS.

This is sufficient for Technical PASS.

## Product SPEC / Architecture Review

Accepted:

- WRESTLER_PRODUCT_ART_SPEC §0 now includes permanent Counter art
- one authored red Counter master is the Product source
- blue is derived offline
- explicit pivots/body-core are documented
- Counter pose selection remains presentation-driven by `pose === 'counter'`
- accepted 35-degree sine body-sabaki is documented as presentation-only
- Simulation facing remains canonical and unchanged
- sprite shape does not own gameplay collision.

## Final User Regression Play Test

REQUIRED.

This is not a new design gate.

The User already accepted:
- Counter pose
- blue derivation
- 35-degree motion
- red + / blue - directions.

Only verify that promotion/cleanup changed nothing:

1. ArrowDown shows the same accepted Counter pose
2. red/blue look identical to pre-promotion
3. 0 -> 35 -> 0 movement feels identical
4. Tsuppari remains clearly distinct
5. Success / Best transitions are unchanged
6. no pivot / scale jump appears
7. Counter gameplay is unchanged.

If this regression Play Test is OK:
- ACTION-08C can be considered fully accepted
- Counter Visual Gate phase is closed
- future tasks should treat the permanent Product Counter art and 35-degree motion as the baseline.

## Do Not Reopen

Unless explicitly requested:

- permanent Counter red/blue pixels
- accepted source image
- Counter-specific max_missed_px = 80
- 35-degree maximum
- sine curve
- red + / blue - signs
- current Counter gameplay
- current CounterTransition
- accepted idle/Tsuppari Product art.

## Next Task Constraint

Do not start another Counter art redesign before the final ACTION-08C regression Play Test result.

After acceptance, Counter art/motion should be treated as a closed Product baseline unless the User explicitly requests changes.
