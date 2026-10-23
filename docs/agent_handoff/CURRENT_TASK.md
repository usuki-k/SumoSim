Task-ID: ACTION-12A-GRAPPLE-WASD-ROTATION-INVESTIGATION
Status: REVIEWED
Task-Type: INVESTIGATION / DESIGN
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 1fdf5b903bacf56e7a8e2f031a7f04190d0aae13
Review-Handoff: ACTION-11N is the accepted current Grip visual baseline (technical PASS; User Play Test provisionally accepted). Do not modify Grip visuals in this Task. Current GRAPPLED controls: ArrowUp held = Drive when READY; WASD move intent is suppressed to ZERO_MOVE while grappled; non-front Grip uses existing Grappled Orientation auto-TURNING until READY.
Handoff-Mode: GITHUB

# ACTION-12A — Grapple WASD Rotation Investigation / Design

## Purpose

Investigate and design a small deterministic gameplay rule for WASD input while GRAPPLED.

User goal:

> Grip状態からWASDキー操作で回転したい。
> WASDでは押したりはせず、回転だけするイメージ。
> 現状のGrip中の操作はArrowUpによる寄り（Drive）のみ。

This Task is Investigation / Design only.

NO Production implementation.

Do not modify gameplay source, presentation source, assets, or accepted docs/spec.

Only CURRENT_COMPLETION_REPORT.md may be written/committed under the AGENTS.md Investigation-only Report Commit Exception.

---

# Required Reading / Current Source

Inspect at minimum:

- AGENTS.md
- docs/ARCHITECTURE.md
- src/game/sumo/BoutTypes.ts
- src/game/sumo/BoutSimulation.ts
- src/game/sumo/grappleOrientation.ts
- src/game/input/movementVector.ts
- src/game/scenes/BoutScene.ts
- relevant existing tests for Grapple / Drive / Orientation / Ring-out / movement.

Do not rely on previous handoff summaries instead of Current Source.

---

# Current Baseline to Confirm

Confirm from Current Source:

1. ParticipantIntent.move is a world-frame normalized direction produced from WASD.
2. FREE movement uses move as grounded movement.
3. GRAPPLED currently suppresses ordinary WASD movement to ZERO_MOVE.
4. ArrowUp held maps to driveHeld.
5. Drive is allowed only when the participant is READY via canActInGrapple.
6. Release uses Grip edge and READY gating.
7. Grappled Orientation auto-turns participants toward each other with GRAPPLE_TURN_RATE.
8. Grapple readiness is derived, not stored.
9. canonical grapple bond is 0.70 m / sum of body radii.
10. Drive currently translates the bonded pair without rotating the pair axis.
11. Ring-out is resolved from canonical participant positions.
12. fixed-step Simulation owns gameplay movement/facing.

Report any material mismatch and STOP the design if Current Source contradicts these assumptions.

---

# Investigation Question

Design how the existing WASD world-frame move vector should become **rotation-only grapple footwork** while GRAPPLED + READY.

The design must satisfy:

- WASD must NOT directly push/translate the pair midpoint.
- WASD must NOT add external impulse.
- pair bond distance stays exactly canonical.
- both wrestler positions may orbit around their shared midpoint.
- both canonical facings should remain coherent with the rotated pair.
- fixed-step / frame-rate independence.
- deterministic / participant-order independent.
- ArrowUp Drive remains available.
- Drive + WASD rotation should be considered for simultaneous use.
- existing TURNING / READY semantics must remain understandable.
- existing ring-out rules should not be bypassed accidentally.
- no new generic physics framework.

---

# Candidate Input Semantics to Compare

Compare at least these three approaches.

## Option A — Tangential Projection / Grapple Footwork

Interpret each participant's existing world-frame move vector as desired footwork, but only keep its tangential component around the pair midpoint.

Conceptually:

- midpoint = (A.position + B.position) / 2
- radial unit for participant p = normalize(p.position - midpoint)
- tangent = perpendicular(radial)
- participant angular contribution = dot(moveIntent, tangent)
- combine both participants symmetrically into one signed pair rotation intent.

Investigate a combination rule such as:

```
angularIntent = clamp(contributionA + contributionB, -1, +1)
```

Properties to evaluate:
- one participant can rotate at full configured speed;
- both participants requesting the same rotational sense do not double the speed;
- opposite rotational requests can cancel;
- radial WASD component causes no push;
- all W/A/S/D remain meaningful depending on current pair orientation;
- world-frame input remains consistent with existing movementVector.

This is the current preferred candidate, but the Investigation must verify it against Current Source.

## Option B — Desired World Bearing / Orbit Target

Treat move vector as the world direction where the participant wants to move around the opponent/pair, and rotate the pair toward that target bearing.

Evaluate:
- responsiveness;
- 180-degree target ambiguity;
- continuous hold behavior;
- simultaneous participant intents;
- whether it creates surprising long rotations when pressing toward the opposite side.

## Option C — Fixed Clockwise / Counterclockwise Buttons

For example A/D determine signed rotation while W/S are ignored or duplicated.

Evaluate:
- simplicity;
- loss of normal WASD semantics;
- whether it conflicts with the User's request to use WASD generally;
- keyboard/touch future implications.

Recommend exactly one for implementation, with reasons.

---

# Pair Geometry to Investigate

For the recommended design, define the exact canonical geometry update.

Preferred invariant to evaluate:

```
midpoint before == midpoint after rotation
distance(A,B) before == distance(A,B) after == canonical grapple bond
```

Rigid pair orbit candidate:

```
A.position = midpoint + rotate(A.position - midpoint, deltaAngle)
B.position = midpoint + rotate(B.position - midpoint, deltaAngle)

A.facing += deltaAngle
B.facing += deltaAngle
```

Then normalize facing using existing angle conventions.

Investigate whether rotating BOTH canonical facings by the same delta is required to preserve READY and avoid repeatedly triggering Grappled Orientation.

Do not propose a presentation-only rotation. This is Gameplay / Simulation state.

---

# TURNING / READY Interaction

Investigate and recommend exact gating.

Preferred baseline to evaluate:

```
if either participant is not READY at tick start:
    manual grapple rotation disabled
```

Reason:
- existing side/rear Grip should first complete Grappled Orientation;
- manual input should not fight the automatic correction.

Then:

```
both READY
-> WASD manual rotation allowed
```

Determine whether readiness should use the same tick-start readiness snapshot already used by Release / Drive.

Prefer reusing canActInGrapple rather than inventing new readiness state.

---

# Drive + Rotation Interaction

Investigate simultaneous:

```
WASD + ArrowUp
```

User intent under consideration:

- WASD = rotate only
- ArrowUp = Drive translation
- both held = rotate while driving.

Determine the safest step ordering.

Compare at least:

### Ordering 1
manual pair rotation
-> update Grappled Drive using the newly rotated pair axis
-> translate

### Ordering 2
Drive uses tick-start pair axis
-> translate
-> manual pair rotation

Evaluate:
- responsiveness;
- determinism;
- preservation of existing Drive behavior when WASD is zero;
- unnecessary one-tick lag;
- effect on externalVelocity.

Recommend one exact order.

Do not change Drive tuning values in this Investigation.

---

# Velocity Ownership

Investigate what should happen to:

- selfVelocity
- shared externalVelocity
- Snapshot velocity

during manual pair rotation.

Strong candidate:
- manual rotation changes canonical positions/facings only;
- does not add linear velocity or impulse;
- does not rotate existing world-frame externalVelocity for free;
- existing grapple selfVelocity braking remains;
- Drive/external momentum remains world-frame canonical state.

Verify whether this creates any material artifact with current integration/bond order.

If an alternative is required, explain precisely why.

---

# Ring-Out Behavior

Investigate the consequence of orbiting canonical participant positions near the dohyo edge.

Preferred gameplay interpretation to evaluate:

- no special immunity;
- if rotation moves a wrestler center beyond the existing ring-out boundary, existing ring-out logic resolves it normally;
- no new special "rotation ring-out" rule.

Report:
- whether existing ring-out timing/order already supports this;
- any simultaneous ring-out/rematch implications;
- whether rotating around the midpoint can produce a legitimate self-ring-out / opponent-ring-out tradeoff.

Do not implement.

---

# Manual Rotation Rate

Do not finalize balance without User Play Test.

Investigate a provisional starting constant:

```
GRAPPLE_MANUAL_ROTATION_RATE
```

Candidate starting point:

```
π / 2 rad/s = 90 degrees/s
```

Compare against:
- existing automatic GRAPPLE_TURN_RATE = π rad/s = 180 degrees/s;
- wrestler orbit radius ≈ 0.35 m at the 0.70 m bond;
- corresponding tangential foot speed at 90°/s ≈ 0.55 m/s.

Recommend a provisional starting value only.

Mark it User Play Test tuning, not Accepted balance.

---

# Participant-Order Independence

For the recommended input-combination rule, prove by reasoning and/or scratch tests that:

- swapping participant array order does not change signed physical result;
- one participant's input rotates the pair consistently regardless of whether that participant is A or B;
- equal opposite rotational intent cancels;
- cooperative same-sense intent does not exceed max configured rotation rate.

If Option A is recommended, explicitly verify tangent sign conventions.

---

# Input / Intent Ownership

Determine whether implementation should:

A. reuse existing ParticipantIntent.move while grappled; or
B. add a new semantic grappleRotation field.

Preferred direction to evaluate:
- reuse move, because it is already the source-independent world-frame WASD vector and the same physical footwork input can have state-dependent Simulation semantics.

But assess:
- type/comment clarity;
- dummy controller behavior;
- future touch/gamepad mapping;
- risk of duplicated input state.

Recommend one.

Do not add raw key logic to Simulation.

---

# Dummy / CPU Harness

Inspect pushDummyController behavior while GRAPPLED.

Report whether the current dummy emits move = 0 while driving.

Ensure the proposed design would not accidentally make the dummy rotate unless its intent explicitly requests rotation.

No CPU AI design in this Task.

---

# Exact Proposed Step Order

Completion Report must propose the exact Simulation step order for a future Implementation Task.

Show where manual rotation belongs relative to:

- tick-start readiness
- release
- Drive action decision
- effective move / selfVelocity braking
- grappledExternalVelocity
- integration
- grapple bond
- facing update
- ring-out.

The proposed order must preserve current behavior exactly when grapple WASD = zero.

---

# Required Boundary Cases

Design / verification plan must cover at least:

1. READY neutral grapple, one participant presses one cardinal direction.
2. same with diagonal input.
3. radial input relative to pair axis under recommended semantics.
4. tangential input relative to pair axis.
5. both participants request same rotation sense.
6. both request opposite rotation sense.
7. one participant TURNING -> manual rotation disabled.
8. both READY after TURNING -> rotation begins next eligible tick.
9. WASD + Drive simultaneously.
10. release + WASD same tick.
11. near-ring rotation causing one wrestler ring-out.
12. near-ring rotation causing simultaneous ring-out if geometrically possible.
13. Morozashi holder/disadvantaged: same rotation authority unless explicitly justified otherwise.
14. zero WASD -> current Drive/orientation behavior byte/semantically unchanged.
15. frame-rate independence via fixed-step.
16. participant order swapped.

Do not sample away any listed boundary case in the future implementation plan.

---

# Architecture Constraints

Maintain:

Pure TypeScript Simulation
-> canonical positions/facing/state
-> Phaser rendering.

Do not:
- put grapple rotation formula in BoutScene;
- create Scene-owned gameplay angle;
- add a second pair-position Source of Truth;
- introduce physics engine;
- introduce generic constraint system / ECS / event bus;
- modify accepted Grip VFX in this Task.

---

# Scope

## In Scope

- Current Source inspection
- input semantics comparison
- pair-rotation geometry
- state ownership
- Drive interaction
- TURNING/readiness interaction
- velocity semantics
- ring-out interaction
- provisional rotation-rate recommendation
- exact future implementation plan
- exact future test matrix
- identify any User decisions still required.

## Scope Out

NO Production implementation.

Do not change:
- src/game/**
- public/**
- tools/**
- accepted architecture docs/spec
- Grip visual assets/VFX
- tuning values in source.

Do not implement manual rotation.

---

# Stop Conditions

STOP / Result BLOCKED if:

- Current Source materially conflicts with the assumptions above;
- preserving ACTION-05B1 Grappled Orientation and adding manual rotation are structurally incompatible without a larger state redesign;
- existing ParticipantIntent.move cannot support the recommended semantics without a material input architecture change;
- Drive + rotation requires changing accepted Drive semantics in a way that needs User decision;
- ring-out semantics present a material design ambiguity requiring User decision before implementation.

If blocked, report the smallest concrete decision needed.

---

# Verification

Investigation-only.

Required:
- source inspection;
- read relevant existing tests;
- run focused existing tests if useful to confirm current semantics;
- scratch calculations / temporary local scripts allowed but must not be committed;
- no Production source changes;
- no docs changes except CURRENT_COMPLETION_REPORT.md.

A Report-only commit/push is allowed under AGENTS.md §13 if Preflight is clean and only CURRENT_COMPLETION_REPORT.md changes.

User Play Test:
- Not Applicable to this Investigation.
- Future Implementation must require User Play Test for rotation feel/rate/control.

---

# Completion Report Required

Include:

- Result: PASS / BLOCKED
- Current Source findings
- confirmed current step/order ownership
- Option A/B/C comparison
- recommended input semantics
- exact signed rotation formula
- participant-order proof
- exact pair position/facing update
- readiness/TURNING rule
- Drive + rotation order
- velocity semantics
- ring-out semantics
- recommended provisional GRAPPLE_MANUAL_ROTATION_RATE
- whether ParticipantIntent.move is reused or new field is needed
- dummy/controller impact
- exact future changed-file candidates
- exact future implementation sequence
- full boundary-case verification matrix
- User decisions required, if any
- Design Deviations: N/A (Investigation)
- Unexpected Scope
- Git delivery.

Do not write implementation code.

# Final Instruction

Investigate and design WASD-only grapple rotation.

WASD must rotate the grapple pair without directly pushing/translating the pair midpoint.

Preserve ArrowUp Drive, existing Grappled Orientation, canonical 0.70 m bond, fixed-step determinism, ring-out ownership, and Simulation as the gameplay Source of Truth.

Return a concrete implementation-ready design, but make no Production changes.


---

# ChatGPT Review Handoff

Review-Date: 2026-10-24
Overall Result: PASS — IMPLEMENTATION-READY DESIGN
Accepted Investigation Baseline: af45d5d7c928994f7dfb0e87b0cde7323f16cadc

## Current Source Alignment

The Investigation findings are accepted as aligned with Current Source.

Confirmed:

- ParticipantIntent.move is already a source-independent world-frame WASD vector.
- FREE movement consumes move as grounded locomotion.
- GRAPPLED currently suppresses move to ZERO_MOVE.
- ArrowUp hold is already separate as driveHeld.
- Release and Drive both use tick-start canActInGrapple readiness.
- Grappled Orientation readiness is derived, not stored.
- Drive translates the bonded pair through shared externalVelocity.
- canonical grapple bond is 0.70 m.
- fixed-step Simulation owns canonical position/facing.
- ring-out consumes canonical previous/current positions after all positional changes.

No material Source/SPEC conflict was found.

## Accepted Design Direction

Recommend Option A: Tangential Projection / Grapple Footwork.

Reuse the existing ParticipantIntent.move.

For each READY grappled participant p:

- pair midpoint m = (A.position + B.position) / 2
- radial unit r_p = normalize(p.position - m)
- positive-angle tangent t_p = (-r_p.y, r_p.x)
- contribution c_p = dot(sanitizeMove(move_p), t_p)
- pair angular intent = clamp(c_A + c_B, -1, +1)
- delta = angularIntent * GRAPPLE_MANUAL_ROTATION_RATE * TICK_SECONDS.

This means WASD does not push or translate the pair midpoint directly.
Only the tangential component contributes to orbiting.

Important control semantics:

- WASD means a desired WORLD direction for that wrestler's grapple footwork.
- Example: with a horizontal pair, Player on the left pressing W moves the Player toward the upper side of the opponent.
- As the wrestler approaches the requested world direction, the tangential projection naturally decreases toward zero.
- Therefore this is target-like world-direction orbit control, not a constant clockwise/counterclockwise spinner.

This semantic is accepted for the future implementation.

## Canonical Pair Update

When delta != 0:

- rotate both participant positions rigidly around the current pair midpoint by the same delta;
- rotate both canonical facings by the same delta;
- normalize facing with existing angle conventions.

Required invariants:

- pair midpoint unchanged by WASD rotation itself;
- pair distance unchanged;
- readiness/facing error unchanged by the rigid rotation;
- no new pair-angle state.

Do not perform a presentation-only rotation.

## Readiness / TURNING

Accepted:

- manual grapple rotation is allowed only when BOTH participants are READY at tick start;
- use the same tick-start canActInGrapple readiness already used by Release / Drive;
- if either participant is TURNING, both participants' WASD grapple rotation is ignored;
- once both are READY at tick start, manual rotation may begin.

Do not add a stored READY/TURNING state.

## Drive + Rotation

Accepted ordering:

1. tick-start readiness
2. Release
3. Drive action decision
4. manual grapple rotation
5. existing grapple self-velocity braking
6. updateGrappledExternal using the ROTATED pair axis
7. integration
8. contact / grapple bond
9. facing update
10. ring-out.

Therefore:

- WASD + ArrowUp can rotate and Drive on the same tick;
- Drive uses the newly rotated axis;
- Drive tuning values remain unchanged;
- zero grapple-WASD must preserve existing Drive behavior.

## Velocity Semantics

Accepted:

- manual rotation changes canonical positions + facings only;
- no linear impulse is created;
- selfVelocity is not populated from the orbit;
- existing grapple ZERO_MOVE braking remains;
- existing world-frame externalVelocity is NOT rotated for free;
- Snapshot velocity remains the current self + external definition.

This deliberately avoids turning manual rotation into a hidden momentum/force mechanic.

## Ring-Out

Accepted:

- no immunity or special rotation-ring-out rule;
- existing ring-out logic evaluates the final canonical positions;
- rotating near the edge may legitimately ring out either wrestler;
- existing simultaneous ring-out/rematch semantics remain the owner.

This is a desired gameplay tradeoff subject to User Play Test.

## Provisional Tuning

Initial implementation value:

GRAPPLE_MANUAL_ROTATION_RATE = PI / 2 rad/s = 90 deg/s.

This is PROVISIONAL.

It is not accepted balance and must be User Play Tested.

At the current 0.70 m bond:
- orbit radius ~0.35 m;
- maximum tangential speed ~0.55 m/s.

## Morozashi

Initial implementation should give Morozashi holder and disadvantaged wrestler the SAME manual-rotation authority.

Do not apply MOROZASHI_DRIVE_FACTOR to rotation.

Any advantage-specific rotation strength is Deferred until User Play Test demonstrates a need.

## Input Ownership

Accepted:

- reuse ParticipantIntent.move;
- do not add a separate grappleRotation semantic field;
- do not add raw-key logic to Simulation;
- no BoutScene gameplay formula.

PushDummyController already emits move = zero while grappled, so it will not rotate accidentally.

## Participant-Order Independence

The symmetric tangential contribution design is accepted.

Implementation tests must explicitly prove:

- participant-array swap invariance;
- one participant moves in its requested tangential world direction regardless of array index;
- cooperative same-sense contributions clamp at max 1;
- opposite-sense contributions cancel.

## Required Implementation Verification

Future Implementation must cover ALL boundary cases listed by ACTION-12A, including:

- cardinal / diagonal / radial / tangential input;
- same-sense and opposite-sense two-participant input;
- TURNING gate;
- first READY tick;
- WASD + Drive;
- release + WASD;
- one-side / simultaneous ring-out cases;
- Morozashi;
- zero-input regression;
- fixed-step determinism;
- participant-order swap;
- long-duration bond/midpoint/readiness invariants;
- dummy non-rotation.

Do not reduce this to representative sampling.

## User Play Test Required After Implementation

Primary feel gates:

1. Is 90 deg/s too slow / right / too fast?
2. Does W/A/S/D as world-direction orbit control feel intuitive?
3. Is WASD + Drive understandable and useful?
4. Does rotation near the dohyo edge create interesting risk/reward?
5. Should Morozashi later affect rotation authority?
6. Does radial input producing zero rotation feel natural?

Technical PASS will not answer these.

## Do Not Reopen

Unless a future Task explicitly changes them:

- ACTION-11N Grip visual baseline
- current Drive tuning
- ACTION-05B1 automatic Grappled Orientation
- canonical 0.70 m bond
- existing ring-out criterion.

## Next Task Constraint

A future implementation should implement exactly the accepted Option A design above.

If implementation reveals that preserving current Drive semantics requires a material change to velocity ownership, readiness, or ring-out ordering, STOP rather than silently deviating.
