Task-ID: TOKUDAWARA-01A-RINGOUT-CORE
Status: REVIEWED
Task-Type: IMPLEMENTATION / SUMO CORE RULE / TOKUDAWARA RING-OUT
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 0842987418a386df9ce9ce52bf3bd502e2f7bde3
Handoff-Mode: GITHUB

# TOKUDAWARA-01A — Tokudawara-aware Ring-out Core

## Purpose

Implement Tokudawara-aware Ring-out gameplay using the Product geometry visually approved by the User.

This is a Sumo Core Rule task.

The goal is to make the Simulation boundary match the accepted Product Tokudawara geometry while preserving all existing first-out / fixed-tick / outcome semantics.

## Accepted Product Geometry — DO NOT REOPEN

User visually compared Product Candidates A / B / C and accepted **Candidate C**.

Accepted Product geometry:

### Art master space
- base circular gameplay radius: 800 px
- tawara width: 42 px
- Tokudawara depth: **42 px**
- Tokudawara half-angle: **9°**
- four cardinal Tokudawara:
  - +X
  - +Y
  - -X
  - -Y

### Product arena alignment
Candidate C supersedes the previous Product alignment.

Accepted:
- `--arena-scale 1.0952`
- `--arena-offset-x 5.48`
- `--arena-offset-y 95.28`

Do not reopen these art alignment values in this gameplay task.

### Simulation-space Tokudawara values

Base radius remains:
- `R = 2.275 m`

Tokudawara depth is derived from the accepted art ratio:

```
depth / R = 42 / 800
depth = 2.275 * 42 / 800
      = 0.1194375 m
```

Use:
- **depth = 0.1194375 m**
- **halfAngle = 9° = π / 20 radians**

These are now the Product gameplay geometry baseline for this Task.

## Accepted Gameplay Semantics

Preserve all existing Ring-out semantics except the allowed boundary shape.

### Center criterion
Ring-out remains based on the participant **center**.

Do NOT introduce:
- foot/contact criterion
- body-support-radius criterion
- ground-touch rule.

### Boundary
Exact gameplay boundary is IN.

OUT means the participant center is strictly outside the allowed boundary.

### First-out
First participant OUT loses.

### Canonical within-tick model
Use the canonical straight interpolation between:
- previous resolved center P0
- current resolved center P1

Internal solver substeps are NOT separate Ring-out events.

### CRITICAL — earliest IN→OUT

For Tokudawara's non-convex boundary, the crossing time is:

**the earliest IN→OUT transition along P(t), t∈[0,1].**

This is a reviewed correction and is mandatory.

Example:
`IN → OUT → IN → OUT`

must return the **first** exit, not the final exit.

Also:
- P0 already OUT -> defensive crossing fraction 0
- P0 IN / P1 IN may still produce Ring-out if the interpolation leaves the non-convex boundary and re-enters
- exact boundary remains IN.

### Same-tick comparison
If both are OUT during the same fixed tick:
- compare earliest IN→OUT fractions
- smaller fraction loses
- difference <= `RING_OUT_SIMULTANEOUS_EPSILON = 1e-9` -> Rematch.

Do not create a gameplay near-simultaneous window.

### After outcome
Preserve:
- final resolved physical state
- future step = exact no-op
- no wall/clamp/bounce.

## Current Circle Regression Firewall

When no Tokudawara is configured:

- preserve the current circular boundary behavior exactly
- preserve the existing circular crossing helper/math
- existing T151–T172 semantics must remain unchanged.

Prefer an explicit no-Tokudawara branch into the current circle code rather than rewriting the circle path into a new general solver.

This is a core regression requirement.

## Required Reading / Source Inspection

Read directly:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/ARCHITECTURE.md`
- `docs/GAME_CONCEPT.md`
- current `CURRENT_TASK.md`
- previous Tokudawara Investigation / Review
- `src/game/sumo/BoutTypes.ts`
- `src/game/sumo/BoutSimulation.ts`
- `src/game/sumo/ringOut.ts`
- `src/game/sumo/BoutRingOut.test.ts`
- relevant `BoutSimulation.test.ts`
- `src/game/scenes/BoutScene.ts`
- `src/game/scenes/DohyoView.ts`
- `tools/dohyo_art/README.md` for the accepted visual geometry contract

Current Source outranks prior Review if materially inconsistent; STOP if such a conflict exists.

## Scope

Implement:

1. Tokudawara setup type/state
2. setup validation and snapshot copy
3. Tokudawara center-boundary classifier
4. earliest IN→OUT crossing fraction
5. Tokudawara-aware Ring-out resolution
6. no-Tokudawara exact regression path
7. BoutScene Prototype setup uses accepted Tokudawara values
8. provisional/debug Dohyo rendering shows the same four Tokudawara so runtime behavior can be Play Tested
9. focused Heavy tests
10. minimal Architecture documentation sync where current Ring-out semantics are documented
11. Browser/runtime smoke if environment permits
12. User Play Test preparation

## Scope Out

Do NOT:

- change Product Python art tool
- change Product arena alignment
- integrate Product PNG background into Phaser
- add HUD
- create wrestler Product art
- add wall/collision against tawara
- add bounce/friction at the boundary
- add foot/ground-touch Ring-out
- change Push / Counter / Grip / Drive formulas
- change body radius
- change fixed timestep
- change simultaneous epsilon
- add shared JSON geometry config
- generalize into a generic geometry/collision framework.

## State / Type Direction

Use the reviewed minimal optional setup model.

Recommended shape:

```ts
export interface TokudawaraSetup {
  readonly depth: number
  readonly halfAngle: number
}

export interface ArenaSetup {
  readonly radius: number
  readonly tokudawara?: TokudawaraSetup
}
```

Exact naming may differ slightly.

Requirements:
- existing `{ radius }` setups remain valid
- Tokudawara absent = existing circle
- Tokudawara is copied into Simulation-owned arena state
- Snapshot returns a copy, not shared mutable input.

Validation when present:
- finite depth
- depth > 0
- finite halfAngle
- 0 < halfAngle < π/4.

Do not encode art pixels in gameplay state.

## Boundary Classifier

Implement one canonical Pure TypeScript classifier for the allowed center region.

Recommended Product-v1 geometry:

For `P=(x,y)`:
- fold four cardinal directions symmetrically:
  - `ax = abs(x)`
  - `ay = abs(y)`
  - `along = max(ax, ay)`
  - `across = min(ax, ay)`
- determine whether the direction is inside a Tokudawara angular window equivalent to:
  `|angle - k·π/2| <= halfAngle`

Avoid `atan2` if the reviewed folding/tangent formulation remains simpler and symmetric.

Semantics:
- outside a Tokudawara window:
  allowed radius = R
- inside:
  allowed radius = R + depth
- side boundary itself belongs to the Tokudawara window / allowed boundary
- exact allowed outer boundary is IN.

Use one canonical classifier for:
- direct point OUT/IN
- crossing interval classification.

Do not duplicate slightly different boundary tests.

## Crossing Fraction — Required Algorithmic Semantics

For Tokudawara only:

Given:
`P(t)=P0+t(P1-P0)`

find the earliest IN→OUT transition.

A small analytic/piecewise implementation is expected.

Recommended approach from Investigation:

### Candidate boundary times
Collect possible `t` values in (0,1) from:
- intersections with circle radius R
- intersections with circle radius R+depth
- intersections with the 8 Tokudawara side rays
- include endpoints 0 and 1.

Only include a side-ray intersection if the intersection lies on the relevant outward ray / radial span as needed.

### Classify intervals
- sort candidates
- deterministically deduplicate technical-near-equal candidate values if required
- classify each open interval at a midpoint using the canonical point classifier
- starting from t=0 classification, return the first boundary where:
  `IN -> OUT`.

Important:
- if P0 OUT -> 0
- if no IN→OUT transition -> null
- P1 IN does NOT imply null for Tokudawara
- exact candidate point/boundary remains IN.

Do not use coarse time sampling.

Do not use Phaser geometry.

If the Agent finds a smaller analytic method with identical semantics, it may be used, but report the Design Deviation and verify all required cases.

## Numeric Robustness

Do not reuse the gameplay simultaneous epsilon to hide geometry bugs.

If candidate root deduplication requires a technical tolerance:
- define it separately
- document it as technical only
- keep it much smaller than gameplay-scale differences
- verify side/corner/tangent cases.

All returned crossing fractions must be finite and in [0,1).

## Ring-out Resolver

The final resolver must work for both:
- plain circle arena
- Tokudawara arena.

For circle:
- current helper result preserved.

For Tokudawara:
- use earliest IN→OUT fractions.

Outcome behavior remains:
- neither exits -> ongoing
- only A exits -> A loses
- only B exits -> B loses
- both exit -> earlier loses
- epsilon-equal -> Rematch.

## Counter Relocation

Do NOT broaden Counter relocation to use Tokudawara.

Keep current conservative circular whole-body condition:
`arena.radius - bodyRadius`.

This intentionally prevents Counter relocation into the Tokudawara extension for now.

Add a focused regression test confirming this remains unchanged.

## BoutScene Prototype Setup

Update the Prototype arena setup to use the accepted Tokudawara gameplay values:

- radius 2.275
- depth 0.1194375
- halfAngle π/20.

This allows runtime/manual testing.

Do not change initial wrestler positions unless strictly necessary; they should not be.

## Provisional / Debug Dohyo Rendering

Update the current Graphics-based `DohyoView` only enough to display the same Tokudawara geometry during this pre-Product-integration phase.

Requirements:
- four cardinal sections
- same radius/depth/halfAngle from Snapshot/ArenaSetup
- exact presentation correspondence to Simulation parameters
- no duplicated gameplay decision state
- plain circle still renders when Tokudawara absent.

This is temporary/provisional presentation and will later be replaced by Product overlay PNGs.

Do not attempt to match final painted tawara texture here.

If helpful, debug mode may show the exact center-boundary shape as a thin line.

## Required Test Matrix — HEAVY

### Circle regression
All existing T151–T172 must remain semantically unchanged and PASS.

No-Tokudawara circle helper outputs must remain bit-compatible where previously directly tested.

### Point classification

Test ALL four Tokudawara directions.

For each cardinal center line:
- R < r < R+depth -> IN
- r = R+depth -> IN
- r > R+depth -> OUT.

Normal sections:
- r = R -> IN
- r > R -> OUT.

Both side boundaries for all four sections:
- side boundary at R < r <= R+depth -> IN
- infinitesimally/window-clearly outside side angle with r > R -> OUT.

Also:
- inside window at same r is IN while outside window is OUT.

### Crossing fraction

Required cases:

1. normal circular section IN -> OUT
2. Tokudawara outer arc IN -> OUT
3. each side-boundary transition class
4. tangent / corner-near cases
5. P0 already OUT -> 0
6. P0 IN / P1 OUT
7. **P0 IN / P1 IN but path goes OUT then IN -> return first exit**
8. **IN -> OUT -> IN -> OUT -> return first exit**
9. no exit -> null
10. returned values finite and [0,1).

### Resolve outcome

- Player exits first
- CPU exits first
- same tick, different fractions
- mirrored equal fractions -> Rematch
- epsilon just inside / just outside simultaneous threshold
- one exits via Tokudawara outer arc while other exits via normal circle
- outcome deterministic.

### Symmetry

Test:
- +X
- -X
- +Y
- -Y
- both sides of each Tokudawara window.

Do not rely on one sampled direction merely because implementation folds coordinates.

### BoutSimulation integration

At minimum:
- straight Push / Drive toward a Tokudawara cardinal direction survives beyond R and loses after R+depth
- a non-window direction such as 45° still loses at R
- final state freeze preserved
- no wall/clamp
- setup/snapshot deep copy
- invalid Tokudawara setup rejected
- Counter relocation remains circular conservative behavior.

## Verification Level

HEAVY because this changes Core Ring-out semantics.

Required:
- focused Pure TS tests above
- full current `pnpm test`
- `pnpm build`
- `git diff --check`
- deterministic repeat scenarios
- no Phaser import in Simulation helpers
- Browser/runtime smoke if environment permits.

If browser smoke cannot run:
- report NOT RUN
- User Play Test remains required.

Do not report Overall PASS if required automated boundary cases are missing.

## User Play Test — REQUIRED

After technical review, run the current Bout prototype.

First use debug visualization if needed.

User should verify:

1. walk/push out through +X Tokudawara:
   - survives in the extension
   - loses only after leaving its outer boundary
2. -X
3. +Y
4. -Y
5. diagonal / normal circular section:
   - still loses at the base circular boundary
6. visually, the provisional Tokudawara and actual outcome agree
7. simultaneous/edge behavior does not look obviously contradictory.

This is not final Product-art approval; it is gameplay-rule acceptance.

## Documentation

Update only the smallest authoritative documentation needed.

If `docs/ARCHITECTURE.md` currently documents Ring-out semantics, sync it to state:

- center-based boundary
- optional four-cardinal Tokudawara
- exact boundary IN
- earliest IN→OUT on P0→P1
- first-out / simultaneous epsilon behavior.

Do not expand into historical sumo documentation.

## Implementation Evidence

Completion Report must map:

- accepted Tokudawara geometry
- type/state ownership
- classifier
- earliest crossing implementation
- circle regression path
- BoutSimulation integration
- provisional visualization
- tests
- browser smoke / User Play Test status.

## Design Deviations

Required.

If none:
`Design Deviations: NONE`

Any change to:
- center criterion
- Candidate C geometry
- earliest IN→OUT
- simultaneous epsilon
- circle regression semantics

is Material and must STOP rather than silently deviate.

## Stop Conditions

STOP/BLOCKED if:

- earliest IN→OUT cannot be implemented deterministically without a broad geometry framework
- current Source conflicts materially with reviewed Ring-out semantics
- preserving circle behavior requires a large rewrite
- Tokudawara geometry cannot be represented with the accepted optional setup cleanly
- required side/corner cases cannot be made reliable
- a new physics/collision framework appears necessary.

Do not broaden into Level 3.

## Git Delivery

Follow AGENTS.md.

Expected task-owned files may include:

- `src/game/sumo/BoutTypes.ts`
- `src/game/sumo/ringOut.ts`
- `src/game/sumo/BoutSimulation.ts`
- focused Ring-out / Simulation tests
- `src/game/scenes/BoutScene.ts`
- `src/game/scenes/DohyoView.ts`
- `docs/ARCHITECTURE.md` only if needed
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

Stage task-owned files explicitly.

One successful Task ≈ one commit.

Suggested commit:
`feat: add tokudawara ring-out boundary`

Push `origin/develop`.
Do not modify `main`.

## Final Instruction

Stop after Tokudawara-aware Ring-out core + provisional runtime visualization + verification.

Do NOT:
- integrate Product background PNG
- change Product Python compositor
- start HUD
- start wrestler Product art
- add Level 3 edge physics.

After commit/push/report:
「TOKUDAWARA-01A-RINGOUT-CORE が完了し、ChatGPT ReviewとUser Play Test待ちです」


# Final ChatGPT Review

Overall Result: TECHNICAL PASS / USER PLAY TEST REQUIRED

## Reviewed Delivery

- Implementation commit:
  `294530e8adfd3f5402b043583032d766dc0d150c`
- Agent-Start-Head:
  `908b09f171876cbbeea451cfb6c56ce4ede79df2`
- Diff is one implementation commit.
- `main` remains unchanged.
- Product Python art tool remains unchanged.
- No package/lock changes.

## Core Gameplay Review

PASS.

The implemented boundary matches the accepted Product Tokudawara geometry:

- base radius R = 2.275 m
- depth = 0.1194375 m
- halfAngle = π/20
- four cardinal windows
- exact allowed boundary is IN
- center criterion remains canonical.

## First-out Semantics

PASS.

The material Review correction from the Investigation is implemented correctly:

**Tokudawara uses the earliest IN→OUT transition along canonical P0→P1 interpolation.**

Important verified behavior:

- P0 already OUT -> 0
- P0 IN / P1 OUT -> earliest exit
- P0 IN / P1 IN but the straight interpolation exits and re-enters -> still Ring-out
- IN→OUT→IN→OUT -> first exit, not final exit
- exact boundary remains IN.

No coarse sampling is used by Production logic.

## Circle Regression Firewall

PASS.

When `arena.tokudawara` is absent:

- `isOutOfArena` delegates to the existing circle classifier
- `firstArenaExitFraction` delegates to the existing circle crossing helper
- existing circle API remains available
- existing T151–T172 remain unchanged and PASS
- added tests confirm bit-identical crossing-helper output in selected circle cases.

This is the correct regression-preserving structure.

## Boundary Representation

PASS.

The Pure TS classifier uses the symmetric folded cardinal representation:

- abs X/Y
- min/max
- half-angle tangent test.

This corresponds to the Python Product-art geometry.

The crossing solver uses candidate intersections with:
- R circle
- R + depth circle
- four through-origin side lines carrying the eight cardinal window sides

then classifies open intervals with the single canonical `isOutOfArena`.

No generic geometry framework was introduced.

## Numeric Robustness

PASS WITH NON-BLOCKING RISK NOTE.

No candidate-root dedup tolerance is used.

The test suite includes:
- all eight side boundaries
- exact/near-corner cases
- tangents
- IN→OUT→IN cases
- IN→OUT→IN→OUT cases
- deterministic pseudo-random 1500-segment comparison against a dense classifier oracle.

This is sufficient for the current Product baseline.

Known microscopic risk:
floating-point representations at an exact circle/side corner can create a sub-ulp interval classified as OUT even when the mathematical path only touches the corner.

The focused test explicitly constrains such a case to a non-material ~1e-9 neighborhood.

Do not introduce a geometry tolerance preemptively.
If User/runtime testing exposes a real edge-case contradiction, investigate with a dedicated regression task.

## State Ownership

PASS.

`ArenaSetup.tokudawara?` is the canonical configuration.

BoutSimulation:
- validates it
- deep copies it
- exposes copied snapshot state.

Scene does not own gameplay boundary state.

## Counter Behavior

PASS.

Counter relocation remains constrained by the original circular:
`arena.radius - bodyRadius`

and does not use the Tokudawara extension.

This preserves the reviewed conservative behavior and avoids scope expansion.

## Provisional Rendering

PASS for pre-Product-integration validation.

`DohyoView` derives a visual boundary from Snapshot arena values:
- R arcs
- R + depth arcs
- radial connectors.

Debug mode can show the boundary.

Gameplay decisions are not made from the Phaser polyline.

This is acceptable until the Product PNG background/overlay integration task replaces the provisional Graphics visuals.

## Verification Review

Reported required automated verification is complete:

- `pnpm test`: 237 PASS / 14 files
- new Tokudawara tests: 28
- `pnpm build`: PASS
- `tsc --noEmit`: PASS
- `git diff --check`: PASS
- deterministic scenarios covered
- Pure Simulation helper has no Phaser import.

Browser graphical smoke:
NOT RUN due Agent environment limitation.

Therefore the remaining mandatory gate is User Play Test.

## Non-Blocking Documentation Note

`BoutScene.ts` still comments that 2.275 m derives from the real dohyo inner diameter of approximately 4.55 m.

The current Product visual contract treats the gameplay R as the visible tawara outer-edge boundary.

These are not literally the same real-world geometric reference.

This does not change current gameplay correctness, but the comment should be clarified during a later Product background integration/documentation cleanup so it does not imply exact real-world dimensional fidelity.

Do not reopen gameplay radius in this Task.

## User Play Test — REQUIRED

Run:

`pnpm dev`

Use `0` to show the debug boundary when useful.

### Required directions

Test all five categories, not only one Tokudawara:

1. +X / right Tokudawara
2. -X / left Tokudawara
3. +Y / down Tokudawara
4. -Y / up Tokudawara
5. diagonal normal-circle section.

### For each Tokudawara direction

First use movement if easiest.

Verify:
- crossing the old base circle R inside the Tokudawara window does NOT end the bout
- remaining inside the extension is allowed
- crossing the Tokudawara outer boundary DOES end the bout
- final position remains outside; no clamp/bounce.

Then test at least one practical Push/Drive case:
- pushing/yorikiri toward a Tokudawara direction visibly gets the extra survival space.

### Normal circular area

Move diagonally between Tokudawara windows.

Verify:
- Ring-out still happens at the normal circular boundary R
- there is no extra extension there.

### Debug agreement

With `0` ON:
- red debug boundary and visible provisional tawara should agree
- outcome should occur when the center crosses that same boundary.

### Feel questions

Please report:
- Does “徳俵で残る” feel understandable?
- Is the extension amount too large/small in actual gameplay?
- Does the sudden side edge of the Tokudawara feel visually/gameplay-wise unnatural?
- Does center-based Ring-out still feel acceptable now that representative boundary graphics exist?

The final point is important:
the User previously allowed Gameplay rules to be reconsidered after representative visuals.

Technical PASS does NOT permanently lock center-based Ring-out if the Play Test feels wrong.

## Acceptance State

Tokudawara Ring-out technical implementation:
PASS.

Gameplay acceptance:
PENDING USER PLAY TEST.

Do not start Product background Phaser integration or HUD automatically until User feedback on the Ring-out behavior is reviewed.

## Next Step After Play Test

If User accepts gameplay:
- record Tokudawara Ring-out as Accepted Baseline
- proceed to Product background / overlay runtime integration.

If boundary feel is wrong:
- classify whether the issue is:
  - Tokudawara depth/angle
  - center-based criterion
  - presentation
  - another Ring-out rule
- create a focused follow-up rather than adjusting unrelated Action systems.
