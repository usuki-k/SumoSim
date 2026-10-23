Task-ID: ACTION-12A-GRAPPLE-WASD-ROTATION-INVESTIGATION
Status: READY
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
