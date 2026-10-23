Task-ID: ACTION-12B-GRAPPLE-WASD-ROTATION-IMPLEMENTATION
Status: READY
Task-Type: IMPLEMENTATION
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: bdc016064be076a592dca3428ebb33d87dc1e742
Review-Handoff: ACTION-12A investigation reviewed PASS / implementation-ready. Implement exactly the accepted Option A tangential-projection grapple footwork design. ACTION-11N remains the accepted current Grip visual baseline and must not be changed.
Handoff-Mode: GITHUB

# ACTION-12B — Grapple WASD Rotation Implementation

## Purpose

Implement the accepted ACTION-12A design:

- while GRAPPLED and BOTH participants are READY, WASD rotates the bonded pair around its shared midpoint;
- WASD must not directly push or translate the pair midpoint;
- only the tangential component of each participant's existing world-frame `ParticipantIntent.move` contributes;
- ArrowUp Drive remains available and can be used simultaneously;
- TURNING disables manual rotation;
- existing ring-out rules remain authoritative.

This is a Core Gameplay / Movement/Input implementation.

User Play Test is required after Technical PASS.

---

# Required Reading

Read current versions before editing:

- AGENTS.md
- docs/ARCHITECTURE.md
- docs/agent_handoff/CURRENT_TASK.md
- docs/agent_handoff/CURRENT_COMPLETION_REPORT.md
- src/game/sumo/BoutTypes.ts
- src/game/sumo/BoutSimulation.ts
- src/game/sumo/grappleOrientation.ts
- src/game/sumo/ringOut.ts
- src/game/input/movementVector.ts
- src/game/input/pushDummyController.ts
- src/game/scenes/BoutScene.ts
- relevant Grip / Orientation / Drive / RingOut / input tests.

Current Source is authoritative.

If Current Source materially conflicts with the reviewed ACTION-12A design, STOP before implementation.

---

# Accepted Design — Do Not Redesign

Use Option A from ACTION-12A.

## Input semantics

Reuse existing `ParticipantIntent.move`.

Do NOT add a new raw key or a separate `grappleRotation` input field.

FREE:
- move keeps existing grounded movement semantics.

GRAPPLED + both READY:
- move is interpreted only as desired grapple footwork direction;
- only tangential projection contributes to pair rotation;
- radial component does nothing;
- no direct push / pull / pair translation is produced by WASD.

GRAPPLED + either TURNING:
- manual WASD rotation is disabled for both participants.

## Coordinate/sign convention

Use current Simulation coordinates:

- +x right
- +y down
- positive angle = atan2 increase = clockwise on screen.

For pair midpoint `m` and participant `p`:

```
r = p.position - m
rHat = normalize(r)
tHat = (-rHat.y, rHat.x)
c_p = dot(sanitizeMove(intent_p.move), tHat)
```

Then:

```
angularIntent = clamp(c_A + c_B, -1, +1)
delta = angularIntent * GRAPPLE_MANUAL_ROTATION_RATE * TICK_SECONDS
```

Important:
- sum is symmetric / participant-order independent;
- cooperative same-sense input clamps at magnitude 1;
- opposite-sense input cancels;
- radial input contributes zero.

Do not introduce arbitrary per-player weights.

---

# Manual Rotation Rate

Add provisional gameplay tuning constant:

```
GRAPPLE_MANUAL_ROTATION_RATE = Math.PI / 2
```

Meaning:
- 90 deg/s
- 1.5 deg/tick at 60 Hz.

This is provisional and User Play Test owned.

Do not reuse `GRAPPLE_TURN_RATE`; keep automatic orientation and manual pair rotation as separate tuning values.

Preferred ownership:
- near existing grapple/Drive constants in `BoutSimulation.ts`, unless Current Source clearly indicates a smaller dedicated pure module is better.

Do not create a generic tuning framework.

---

# Pair Rigid Rotation

When manual rotation is allowed and `delta !== 0`:

1. compute current midpoint:
   `m = (A.position + B.position) / 2`

2. rotate each position around `m` by the same `delta`

3. rotate each canonical facing by the same `delta`

4. normalize facings using the existing `normalizeAngle`.

Use the standard 2D rotation:

```
x' = x*cos(delta) - y*sin(delta)
y' = x*sin(delta) + y*cos(delta)
```

Apply to each participant's vector relative to the midpoint.

Required invariants:

- midpoint before == midpoint after, modulo floating-point roundoff;
- pair distance before == pair distance after;
- READY facing error remains unchanged by the manual rotation;
- no second pair-angle Source of Truth;
- no Scene-owned gameplay rotation.

If `delta === 0`, skip the rotation block entirely.

This is important because `normalizeAngle` maps exactly -PI to +PI; zero-input behavior should preserve current values as closely/bitwise as possible.

---

# Readiness / TURNING Gate

Reuse the existing tick-start readiness already computed for Release / Drive:

```
ready(p) = canActInGrapple(p, opponent, startEngagement)
```

Manual rotation is allowed only if:

```
grappled && ready(A) && ready(B)
```

Do not recompute readiness after rotation for the gate.

Do not add stored READY/TURNING state.

Do not change:
- automatic Grappled Orientation
- `GRAPPLE_TURN_RATE`
- `GRAPPLE_FACING_TOLERANCE`
- Release readiness behavior.

---

# Exact Step Ordering

Preserve current step semantics except for the new manual-rotation block.

Required order:

1. Tsuppari cooldown
2. CounterTransition early path
3. previous positions for ring-out
4. posture timer
5. tick-start readiness
6. grapple release
7. determine `grappled`
8. grappled Drive action decision
9. **NEW: manual grapple rotation**
10. existing participant action/effective-move processing
11. existing grapple selfVelocity braking (ZERO_MOVE)
12. `updateGrappledExternal()`
    - it must now naturally read the ROTATED pair axis
13. integrate velocities
14. contact
15. grapple bond
16. action timers
17. facing update
18. ring-out.

If the Current Source groups steps 10/11 differently, preserve semantics, but manual rotation must occur:
- after Release and Drive readiness/action decision;
- before `updateGrappledExternal()`;
- before integration.

Update misleading comments such as "tick-start pair axis" only where necessary.

---

# Drive + Rotation

WASD + ArrowUp must work together.

Accepted behavior:

- manual rotation happens first;
- Drive uses the pair axis after that rotation on the same tick;
- Drive constants remain unchanged:
  - GRAPPLE_DRIVE_SPEED
  - GRAPPLE_DRIVE_ACCELERATION
  - MOROZASHI_DRIVE_FACTOR.

Do not rotate existing `externalVelocity` as a free side effect of manual rotation.

Existing world-frame momentum stays world-frame.

Do not change Drive strength/net calculation.

---

# Velocity Semantics

Manual rotation:

- changes canonical positions + facings only;
- adds no `selfVelocity`;
- adds no `externalVelocity`;
- adds no impulse;
- does not rotate existing external momentum;
- does not redefine Snapshot velocity.

GRAPPLED selfVelocity braking remains current behavior:
- ordinary linear WASD movement remains suppressed;
- pair orbit is handled by the new explicit rigid-rotation block.

Do not make the orbit velocity part of Snapshot velocity in this Task.

---

# Ring-Out

Do not add special immunity or a new ring-out rule.

Existing `resolveRingOutFrom(previousA, previousB)` remains authoritative.

Therefore:
- rotation may move one participant out of the dohyo;
- that participant can lose normally;
- degenerate simultaneous exits use existing rematch semantics;
- Tokudawara continues to work through current ring-out code.

Do not add edge slowdown in this Task.

This behavior is intentional and must be User Play Tested.

---

# Morozashi

Manual rotation authority is equal for:
- neutral grapple
- Morozashi holder
- Morozashi disadvantaged.

Do NOT apply `MOROZASHI_DRIVE_FACTOR` to manual rotation.

Any advantage-specific rotation authority is Deferred.

---

# ParticipantIntent / Input Ownership

Reuse `ParticipantIntent.move`.

Update the relevant comment/type documentation so it is clear:

- FREE: world-frame locomotion vector
- GRAPPLED + both READY: world-frame grapple footwork vector whose tangential component rotates the pair.

Do not add raw keyboard semantics to Simulation.

BoutScene already supplies the move vector every tick.

Only update BoutScene help/debug text if needed for clarity, e.g.:
- "WASD move/rotate"

Do not put gameplay formulas in BoutScene.

---

# Dummy / Harness

Current PushDummyController emits move = 0 while GRAPPLED.

Preserve this.

Do not make dummy rotate automatically.

No CPU AI design in this Task.

Add/retain regression proof that a grappled dummy with zero move contributes zero manual rotation.

---

# Preferred Pure Helpers

Keep design small and explicit.

A pure helper is recommended for signed pair rotation intent / geometry, e.g. one or more of:

- `grappleManualRotationIntent(...)`
- `rotateGrappledPair(...)`

Do not introduce:
- ECS
- physics/constraint framework
- global event bus
- generic pair-motion abstraction.

If helper ownership fits `grappleOrientation.ts` cleanly, that is acceptable.
If keeping tuning and pair mutation local to `BoutSimulation.ts` is simpler, that is also acceptable.

Report final ownership.

---

# Required Boundary Cases — ALL MUST BE VERIFIED

Do not sample these.

## B1 — one cardinal input
READY neutral, horizontal pair, Player on left:
- Player W -> positive rotation;
- Player moves upward, opponent downward;
- midpoint unchanged;
- bond unchanged.

## B2 — diagonal
W + D:
- radial component ignored;
- angular magnitude = ~0.7071 of max in the horizontal fixture.

## B3 — radial input
Player D toward opponent:
- zero manual rotation;
- no push;
- no pair midpoint movement from WASD.

Player A away from opponent:
- same: zero manual rotation;
- no pull.

## B4 — tangential directions / pair orientations
Verify correct sign for:
- pair axes at 0°, 45°, 90°, 135° or equivalent coverage;
- cardinal WASD directions.

## B5 — same-sense two-participant input
Both request the same physical rotation sense:
- sum clamps to ±1;
- speed does not double.

## B6 — opposite-sense input
Equal opposite rotation:
- cancel to 0.

## B7 — TURNING gate
If either participant is TURNING:
- both participants' manual rotation input is ignored;
- existing automatic Grappled Orientation progresses unchanged.

## B8 — first READY tick
After TURNING completes:
- manual rotation starts only on the first tick that begins with both READY.

## B9 — WASD + Drive
- rotation and Drive occur on same tick;
- Drive uses rotated axis;
- Drive values otherwise unchanged.

## B10 — Release + WASD
- Release wins;
- no grapple rotation on release tick;
- existing release recovery semantics unchanged.

## B11 — edge / one-side ring-out
Construct a near-edge grapple where manual rotation moves exactly one participant outside:
- existing ring-out declares that participant loser.

## B12 — simultaneous ring-out boundary case
If geometrically constructible in current arena:
- verify existing simultaneous/rematch behavior.
If truly impossible under a valid bonded pair fixture, prove why with an explicit boundary case and mark it NOT APPLICABLE, not silently omitted.

## B13 — Morozashi
- holder and disadvantaged contribute with identical manual rotation authority;
- Drive factor remains Drive-only.

## B14 — zero WASD regression
- existing Drive / Orientation / Grip / RingOut behavior remains semantically unchanged;
- delta=0 path does not normalize/change facing unnecessarily.

## B15 — fixed-step determinism
- no render delta;
- replay / repeated simulation produces identical result.

## B16 — participant-order swap
- swapping physical participant order does not change the corresponding physical outcome.

## B17 — long-duration invariants
Sustained manual rotation:
- midpoint drift is negligible/within explicit floating tolerance;
- bond remains 0.70 m;
- facing error remains READY;
- no NaN / instability.

## B18 — natural stop behavior
Hold a world direction:
- as that direction becomes radial, tangential contribution trends to 0;
- no oscillation/overshoot caused by a hidden target state.

## B19 — dummy
Grappled dummy with move=0:
- contributes zero manual rotation.

---

# Existing Tests / Regression

Inspect and update existing tests whose old expectation was "WASD suppressed while READY grappled".

Expected candidates include Grip / Orientation / Drive tests identified by ACTION-12A.

Do not delete coverage just to make tests pass.

Where old tests intentionally assert no grapple movement:
- preserve that assertion using radial move, zero move, or TURNING state as appropriate;
- add explicit new rotation cases separately.

Preserve all unrelated existing tests.

---

# Verification Level

Heavy.

Required:

- focused pure rotation-intent tests;
- focused pair rigid-rotation tests;
- all B1–B19 boundary cases;
- Grip regression;
- Grappled Orientation regression;
- Drive regression;
- RingOut / Tokudawara regression;
- movement/input regression;
- participant-order/determinism tests;
- `pnpm test`
- `pnpm build`
- `git diff --check`
- browser/runtime smoke.

Browser smoke must include at minimum:

1. normal front Grip -> WASD orbit
2. radial WASD -> no push / no rotation
3. diagonal WASD
4. WASD + Drive
5. side/rear Grip TURNING -> WASD ignored
6. READY after TURNING -> WASD works
7. release + WASD
8. near-edge rotation ring-out
9. Morozashi rotation
10. restart
11. no new console/runtime errors.

If any required boundary cannot be run:
- report PARTIAL / NOT RUN;
- do not mark Overall PASS if a mandatory case is missing.

---

# User Play Test

REQUIRED after Technical PASS.

User should judge:

- 90°/s speed
- world-direction WASD semantics
- diagonal feel
- radial input doing nothing
- WASD + Drive feel
- edge risk/reward
- Morozashi equal rotation authority
- whether rotation feels like footwork rather than sliding/pushing.

Technical PASS != Gameplay Accepted.

---

# Scope

## In Scope

- Pure TypeScript grapple manual rotation
- reuse ParticipantIntent.move
- pair rigid position/facing rotation
- Drive ordering integration
- comments/type docs
- focused/full tests
- minimal BoutScene help text update if useful
- docs/ARCHITECTURE.md update to Current accepted implementation semantics
- CURRENT_COMPLETION_REPORT.md.

## Scope Out

Do NOT:

- change Grip VFX / ACTION-11N visuals
- change Drive tuning
- change automatic GRAPPLE_TURN_RATE
- change grapple bond
- add rotation advantage for Morozashi
- add edge slowdown
- add CPU rotation AI
- add touch/gamepad implementation
- add throws/lifts
- change Push/Tsuppari/Counter balance
- introduce physics engine / generic constraint system
- modify PROJECT_HANDOFF.md.

---

# Stop Conditions

STOP before broadening scope if:

- implementation requires a new stored pair-angle Source of Truth;
- existing Drive semantics cannot be preserved with rotation-before-Drive;
- preserving readiness requires changing ACTION-05B1 semantics;
- ring-out needs a new special-case rule;
- participant-order independence cannot be achieved with the accepted formula;
- required all-case verification exposes a material design contradiction;
- unrelated accepted Gameplay or Grip visuals regress.

If a Material Design Deviation becomes necessary:
- do not silently accept it;
- STOP and report the planned vs required change.

---

# Implementation Evidence Required

Completion Report must include concise evidence for:

1. Design Requirement: tangential projection only
   - file/module/function
   - implemented formula
   - verified by B1–B6/B18

2. Design Requirement: rigid midpoint rotation / bond preservation
   - function
   - position/facing update
   - verified by invariants/B17

3. Design Requirement: both-READY gate
   - integration point
   - verified by B7/B8

4. Design Requirement: rotation before Drive
   - step order
   - verified by B9

5. Design Requirement: no velocity/impulse ownership change
   - preserved fields
   - verification

6. Design Requirement: existing ring-out
   - no new rule
   - B11/B12

7. Design Requirement: participant-order independence
   - formula and test B16.

Design Deviations:
- NONE if implementation matches;
- otherwise Planned / Implemented / Reason / Semantics changed? and STOP if material.

Unexpected Scope:
- explicitly list if any.

---

# Completion Report

Include:

- Result
- Implementation Commit
- Current Source files changed
- final helper/function ownership
- final `GRAPPLE_MANUAL_ROTATION_RATE`
- exact formula
- exact step order
- B1–B19 matrix with PASS / FAIL / NOT RUN
- focused test results
- full test/build/check
- browser smoke results
- ring-out observations
- Drive + rotation observation
- zero-input regression evidence
- Implementation Evidence
- Design Deviations
- Unexpected Scope
- User Play Test: REQUIRED
- Git delivery.

---

# Git Delivery

Follow AGENTS.md.

Normal successful Task:
- stage Task-owned files only
- one implementation commit
- fetch
- fast-forward safety
- push origin/develop
- verify remote SHA
- clean working tree.

Suggested commit:

`feat(gameplay): add grapple wasd rotation`

Do not modify:
- main
- PROJECT_HANDOFF.md
- CURRENT_TASK.md.

# Final Instruction

Implement the reviewed ACTION-12A Option A design exactly.

While GRAPPLED and both READY, reuse ParticipantIntent.move as world-frame grapple footwork: only each participant's tangential component contributes to one symmetric signed pair rotation.

Rigidly rotate both canonical positions and facings around the pair midpoint at provisional 90°/s maximum.

Do not translate the pair midpoint from WASD, do not add impulse, preserve 0.70 m bond, preserve existing Drive/Orientation/ring-out ownership, and require Heavy verification plus User Play Test.
