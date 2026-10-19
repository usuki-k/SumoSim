Task-ID: ACTION-05C-GRAPPLED-DRIVE-INVESTIGATION
Status: REVIEWED
Task-Type: INVESTIGATION / GRAPPLED DRIVE & YORIKIRI DESIGN
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: f28542fce7b5996916a7769b9690905c41ca0608
Handoff-Mode: GITHUB

# ACTION-05C — Grappled Drive / Yorikiri Investigation

## Purpose

ACTION-05A Grip / EngagementとACTION-05B1 Grappled OrientationはUser Play TestでAccept済み。

次に、GRAPPLED中の「↑ = Drive / 寄り」を実装する前に、DriveのGameplay Ruleを確定する。

Userの既存意図:
- GRAPPLED中の↑はDrive / Yorikiri
- Morozashi holderは通常組みより大きく寄れる
- TURNING participantは何もできず、READY participantだけがgrapple actionを使える
- 将来的には全体のGame Speedを遅く調整したいが、今は既存速度を個別にretuneしない

このTaskは Investigation Only。
Production Sourceは変更しない。

## Accepted Baseline

Accepted Production Source:
`f28542fce7b5996916a7769b9690905c41ca0608`

Current developの以降はPlay Test / coordination only。

Preserve:
- FREE Movement / Contact
- Push / Counter / Kuzushi
- Counter Success→side / Best→rear
- Grip / pair-level Engagement
- Morozashi holder
- Grapple bond
- GRAPPLED WASD suppression
- GRAPPLED gradual orientation
- `canActInGrapple` READY gate
- TURNING中Release不可
- Shift Grip / Release
- existing provisional timing/force values

Do not retune current systems.

## Central Design Goal

Drive should make GRAPPLED feel like a two-person contest while preserving:

```
Pure TypeScript Simulation
  engagement
  participant action/readiness
  pair velocity/position
      ↓
Snapshot
      ↓
Phaser presentation
```

Do not put Drive force/formulas in BoutScene.

## Questions to Investigate

### Q1 — Input semantic

Current ArrowUp produces `pushPressed`, whose semantic meaning is specifically FREE Push.

GRAPPLED also wants ArrowUp for Drive.

Compare small options:
A. add `drivePressed` / `driveHeld` semantic field and let Scene map the same raw ArrowUp according to current Engagement
B. replace context-specific intent fields with a generic primary action semantic
C. reuse `pushPressed` as Drive while GRAPPLED

Recommend the smallest change that preserves:
- semantic, source-agnostic Simulation input
- current FREE Push tests/meaning
- future CPU/touch mapping

Avoid broad input redesign.

### Q2 — Continuous vs discrete Drive

Compare:
- hold ↑ = continuous Drive effort
- one press = discrete Drive pulse/action
- short action phases similar to Push

Consider:
- action-game readability
- contested Drive
- User preference for somewhat broad/simple action timing
- future stamina
- fixed-step determinism
- touch controls

Recommend one for first Prototype.

### Q3 — Drive direction

Define the canonical direction of one participant's Drive.

Candidate:
- from driver center toward opponent center / current grapple axis

Compare against:
- participant facing vector
- stored direction at action start

Because READY tolerance allows up to 15° error, explain whether Drive should follow exact pair axis or current facing.

### Q4 — Pair movement model

Investigate how Drive should move the grappled pair.

Preferred direction to assess:
- reuse Model B / shared external velocity
- compute a net grapple Drive acceleration along pair axis
- apply same external delta to both participants so bond moves as one pair

Compare with:
- selfVelocity drive
- moving only target
- positional teleport/correction

Recommend smallest deterministic rule.

### Q5 — One-sided neutral Drive

For neutral grapple, define what happens when only A Drives:
- pair moves toward B's side
- B is pushed backward while bond remains R

Specify which canonical velocities change and how existing external decay interacts.

### Q6 — Simultaneous Drive

Define deterministic behavior when both READY participants Drive simultaneously.

Candidate:
- each contributes signed strength along common pair axis
- equal neutral strengths cancel
- unequal strengths produce net movement

Avoid participant-array priority.

### Q7 — Morozashi advantage

User intent:
Morozashi holder should Drive more strongly than ordinary neutral grapple.

Investigate first Prototype rule.

Candidate:
```
driveStrength(driver) =
  BASE_DRIVE *
  (driver is Morozashi holder ? MOROZASHI_DRIVE_FACTOR : 1)
```

Questions:
- should disadvantaged participant remain base 1.0, or also receive a penalty?
- is holder bonus alone sufficient and simpler?
- how does simultaneous Drive contest resolve?

Do not invent final numbers without marking them provisional.
Recommend an initial factor suitable for Play Test.

### Q8 — Action readiness

Drive must use accepted `canActInGrapple`.

Confirm:
- TURNING participant cannot initiate/continue Drive
- READY participant may Drive while opponent TURNING
- when opponent becomes READY it may begin contesting

If continuous hold input is recommended, define what happens when held before READY:
- ignored until a new edge?
- automatically begins when READY?
- semantic held state active while READY?

Avoid hidden input queueing unless deliberate.

### Q9 — Drive commitment / recovery

If Drive is continuous:
- does releasing ↑ stop immediately?
- is there startup/recovery?

If discrete:
- define provisional startup/active/recovery structure.

Keep first Prototype small.
Do not add stamina yet.

### Q10 — Release interaction

While one/both participants Drive:
- can READY participant Shift-release immediately?
- does active Drive block Release?
- does release cancel Drive?
- what happens to pair external velocity after release?

Preserve ACTION-05A/B1 release semantics unless a material conflict requires User decision.

### Q11 — Facing / orientation while Drive moves pair

If both bodies translate together, pair bearing stays constant.

Confirm:
- TURNING continues normally during Drive
- Drive does not secretly reset facing error
- Drive does not rotate pair in first Prototype

### Q12 — Bond interaction

Current bond fixes radial distance R.

Determine whether applying shared external Drive velocity before/after bond is enough.
Identify exact recommended step order.

Do not add a general constraint solver.

### Q13 — Existing external momentum

Define how pre-existing shared external velocity interacts with Drive.

Recommended principles:
- do not clear momentum on Drive start
- add Drive acceleration
- existing external decay remains one source of decay

Check whether current `MAX_EXTERNAL_SPEED = 3` is suitable to reuse or whether Drive needs a separate cap.
Do not silently change Push behavior.

### Q14 — Drive as participant action/state

Determine whether Drive needs a new `ParticipantActionState` variant or can be derived directly from held intent while GRAPPLED.

Consider future:
- Throw / Lift mutual exclusion
- release
- presentation
- startup/recovery if any

Prefer explicit state only when necessary.

### Q15 — Action priority in GRAPPLED

Future conceptual controls:
- ↑ Drive
- ← Throw left
- → Throw right
- ↓ Lift
- Shift Release

Drive is first implemented, others are absent.

Define future-compatible priority/conflict rules without building them now.

At minimum decide:
- Drive vs Release same tick
- two participants' Drive independent
- TURNING gate first

### Q16 — Minimal debug presentation

Recommend what User must see in first Drive implementation:
- DRIVE label
- net pair movement direction/strength if useful
- neutral vs Morozashi
- TURNING/READY remains visible

Do not create final animation/UI.

### Q17 — Ring-out / BoutOutcome prerequisite

Ring-out is currently unimplemented.

Determine whether:
A. Drive can first be implemented/tested as displacement-only, with ring-out afterward
B. minimal Ring-out/BoutOutcome is required before Drive implementation because otherwise Yorikiri cannot be meaningfully evaluated

Separate:
- technical implementation feasibility
- Game Feel acceptance

Do not invent ring-out criterion here.
Existing deferred ring-out decisions remain unresolved unless Current SPEC says otherwise.

### Q18 — Arena edge behavior before Ring-out

If Drive implementation precedes Ring-out, pair can currently move beyond the ring.

Recommend a minimal test fixture/Play Test approach that does not accidentally define ring-out:
- large arena test fixture
- restart before edge
- or another small harness convention

Do not add invisible wall/clamp unless explicitly decided.

### Q19 — Morozashi + Orientation combined scenario

Define expected behavior:

Rear/Side Counter
→ Kuzushi
→ Grip
→ Morozashi
→ holder READY, target TURNING
→ holder Drive works unopposed
→ target reaches READY
→ target may contest Drive

Confirm this is achieved by independent:
- Engagement advantage
- Orientation readiness
- Drive strength

No combined rear-Morozashi state.

### Q20 — Future stats boundary

Do not implement stats.

Define where future:
- Power
- LowerBody
- Weight
- Grapple skill
could enter Drive strength/resistance without changing the basic architecture.

Do not choose exact stat formulas now.

### Q21 — Automated test matrix for first Drive implementation

Specify focused tests for:
- READY one-sided neutral Drive
- TURNING Drive blocked
- Drive while target TURNING
- simultaneous equal neutral Drive cancels
- Morozashi holder > neutral
- Morozashi holder vs disadvantaged simultaneous contest
- mirrored participant symmetry
- Drive stops according to chosen input semantics
- external momentum preserved
- external decay/cap
- bond distance maintained
- facing/orientation continues correctly
- Release interaction
- deterministic replay/finite values
- FREE Push/Counter/Grip regressions when Drive unused
- no Ring-out semantics accidentally added

### Q22 — User Play Test plan

Define what to evaluate:
- one-sided Drive feels like pair pressure, not skating
- equal contested Drive feels like stalemate
- Morozashi clearly moves pair more strongly
- Drive while opponent TURNING gives meaningful first-move reward
- release behavior is understandable
- bond remains stable
- Drive direction is readable
- current overall speed may still be too fast and should remain Deferred unless blocking

### Q23 — User Decisions Required

List only material decisions required before implementation.

Likely:
- continuous vs discrete Drive
- semantic input form
- provisional base acceleration/force
- provisional Morozashi factor
- release during Drive
- whether Ring-out precedes Drive

Give a recommended default for each.

### Q24 — Next Implementation Sequence

Recommend the smallest safe sequence.

Candidate:
1. ACTION-05C1 Grappled Drive Foundation
2. minimal Ring-out/BoutOutcome if needed
3. Drive refinement / Yorikiri Feel
4. Throw / Lift later

Or, if Ring-out is prerequisite:
1. minimal Ring-out/BoutOutcome investigation/implementation
2. ACTION-05C1 Drive

Do not bundle Drive + Ring-out + Throw + Lift into one Task.

## Important Design Constraints

- Simulation remains Phaser-free.
- Same meaning must not have multiple Sources of Truth.
- Drive must not alter accepted FREE Push formula unless explicitly required.
- Morozashi is Engagement advantage, not a new action type.
- Orientation readiness remains derived, not stored.
- no mass/traction framework yet.
- no ECS/DI/event bus/generic rule engine.
- no uncontrolled Math.random.

## Scope Out

Do NOT implement:
- Drive production code
- Ring-out production code
- BoutOutcome
- Throw
- Lift
- stamina
- stats
- directional FREE Push advantage
- AI
- final animation/audio
- global speed rebalance
- turn-rate rebalance
- Push/Counter/Grip retuning

Investigation Only.

## Required Reading

Inspect:
- AGENTS.md
- BoutTypes.ts
- BoutSimulation.ts
- grappleOrientation.ts
- BoutGrip.test.ts
- BoutOrientation.test.ts
- BoutPush.test.ts
- BoutScene.ts
- ARCHITECTURE.md
- GAME_CONCEPT.md
- Current Task Review / User Play Test acceptance

## Stop Conditions

Return BLOCKED if:
- Drive requires replacing Model B
- Drive cannot coexist with bond without a generic physics solver
- semantic input requires a broad input architecture redesign
- Ring-out is a mandatory prerequisite but its unresolved decisions block safe sequencing
- Morozashi advantage cannot be represented without duplicating state
- Current Source materially conflicts with accepted Handoff

Do not make Production changes.

## Verification

Investigation / Design Review.

Required:
- Q1–Q24 answered or explicit BLOCKED point
- Current Fact / Recommendation / User Decision / Deferred separated
- Production Source unchanged
- package / lockfile unchanged
- repository change only `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- `git diff --check` PASS

Tests/build are not required because Source must not change.

## Completion Report

Minimum:
- Result
- Preflight
- Current Source Findings
- Q1–Q24
- recommended input semantics
- recommended continuous/discrete model
- Drive direction / pair acceleration model
- simultaneous Drive
- Morozashi advantage
- readiness/release interaction
- external momentum/cap
- Ring-out prerequisite analysis
- test matrix
- User Play Test plan
- User Decisions Required
- Rejected / Deferred
- Next Implementation Sequence
- Design Deviations
- Unexpected Scope
- Verification
- Git delivery

## User Play Test

NOT REQUIRED for Investigation.

Identify first implementation task where Drive Feel becomes REQUIRED.

## Git Delivery

Investigation-only Report Commit Exception:
- change only CURRENT_COMPLETION_REPORT.md
- explicit stage
- git diff --check
- one Report-only commit
- push origin/develop
- verify remote SHA / clean tree

Example commit:
`docs(agent): investigate grappled drive design`

## Final Instruction

Stop after investigation.
Do not implement Drive, Ring-out, Throw, Lift, or stats.

After Report Commit / Push:
「ACTION-05C-GRAPPLED-DRIVE-INVESTIGATION が完了し、ChatGPT Review待ちです」


# Final ChatGPT Review

Overall Result: PASS WITH CORRECTIONS / USER DECISIONS REQUIRED BEFORE IMPLEMENTATION

## Reviewed Investigation

- Investigation report commit:
  `a03a0e39e6e86b392d0cea5ab3921a5a6c874401`
- Agent-Start-Head:
  `cf5e8153c173c5214ed590702d3af2c8a365540a`
- Diff is exactly one Report-only commit:
  `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- Production Source / package / lockfile unchanged.
- `main` unchanged.

## Current Source Review

PASS.

Source confirms:

- ArrowUp currently provides only the FREE Push edge; no held semantic exists.
- GRAPPLED pair externalVelocity is equalized on Grip establishment.
- both participants receive identical external decay afterward.
- Grapple bond only corrects radial separation and is compatible with shared pair translation.
- GRAPPLED orientation is independent of pair translation.
- current Dummy intentionally outputs no grapple action while GRAPPLED.

The Report correctly identifies that a naive continuous acceleration using the existing Push-style external update is not sufficient for Drive.

## Accepted Design Direction

### A-1 — Dedicated held semantic

Accept:

```ts
ParticipantIntent.driveHeld: boolean
```

- ArrowUp remains the existing `pushPressed` edge for FREE Push.
- the same physical ArrowUp also supplies held state for `driveHeld`.
- Scene should not decide FREE vs GRAPPLED gameplay meaning.
- Simulation ignores `driveHeld` while FREE and ignores FREE Push start while GRAPPLED.

Do not replace the semantic intent model with a generic primary-action abstraction.

### A-2 — Continuous Drive

Accept.

First Prototype:
- hold ↑ = continuous Drive effort
- release ↑ = Drive contribution stops
- no startup/recovery
- future stamina can later consume per Drive tick.

A held ↑ before READY may begin contributing automatically once READY.
This is held-state behavior, not queued edge behavior.

### A-3 — Drive direction

Accept pair axis:
- driver center → opponent center.

Do not use facing direction, because READY still allows angular error and that would create lateral skating / imperfect cancellation.

### A-4 — Shared pair external velocity / Model B

Accept.

Drive moves the GRAPPLED pair through shared `externalVelocity`.
Do not:
- drive via selfVelocity
- move only the target
- teleport pair positions
- replace the Grapple bond.

### A-5 — Signed simultaneous contest

Accept the symmetric net concept:

```
net = strength(A) * ADriving - strength(B) * BDriving
```

on one common A→B axis.

Consequences:
- equal neutral vs neutral → no new Drive contribution
- one-sided → pair translates toward defender side
- unequal → stronger side wins by the difference
- no participant-array priority.

Existing momentum may still continue/decay when net is zero; "stalemate" means no new Drive contribution, not mandatory zero velocity.

### A-6 — Morozashi strength

Accept first Prototype direction:

- neutral participant strength = 1.0
- Morozashi holder = provisional 1.5
- disadvantaged participant remains 1.0
- no extra penalty.

Morozashi remains Engagement data, not a Drive state.

### A-7 — READY gate

Accept.

A participant contributes to Drive only when:

```
driveHeld && canActInGrapple(...)
```

Therefore:
- READY holder can Drive while opponent TURNING.
- TURNING participant cannot contribute.
- a held input automatically starts contributing once that participant becomes READY.

### A-8 — Release

Accept existing semantics:

- READY participant may Shift-release even while Driving.
- Release has higher priority than continuous Drive.
- release cancels Drive contribution on that tick.
- TURNING participant still cannot Release.
- retained external pair motion is not hard-cleared; FREE decay handles it afterward.

### A-9 — Ring-out sequence

Accept Drive-before-Ring-out.

ACTION-05C1 can test:
- pair pressure
- neutral stalemate
- Morozashi advantage
- orientation first-move reward
without defining victory yet.

Do not add:
- invisible arena walls
- clamp
- provisional ring-out rule.

Automated Drive tests should use a large arena where appropriate.
User Play Test may restart before/after leaving the visible ring.

## Correction C-1 — Drive decay/update order

The Report's F3 diagnosis is useful, but Q4 / step-order wording is internally inconsistent.

It proposes:

```
external decay
→ Drive apply
```

while also saying that during acceleration toward Drive target speed the axial decay should not be subtracted again.

With:
- `GRAPPLE_DRIVE_ACCELERATION = 4 m/s²`
- `EXTERNAL_DECELERATION = 8 m/s²`

pre-decaying the Drive-axis component every tick and then adding only 4m/s² does **not** accelerate toward 0.6m/s. It collapses into a small tick-sized speed.

### Correct implementation direction for ACTION-05C1

FREE remains exactly as today:
- existing `decayExternal()`
- existing Push behavior
- no formula changes.

GRAPPLED gets a small Drive-specific shared-external update.

Conceptually:

1. update/brake selfVelocity as already required.
2. derive pair axis and Drive net from tick-start readiness + `driveHeld`.
3. update the **single shared pair external velocity once**:
   - if `net === 0`: use existing external decay behavior.
   - if `net !== 0`:
     - decompose shared external velocity into pair-axis parallel + perpendicular components.
     - perpendicular component decays toward zero using `EXTERNAL_DECELERATION`.
     - parallel component approaches the signed Drive target speed:
       - while below/toward target, approach by `GRAPPLE_DRIVE_ACCELERATION * |net| * dt` **without first subtracting axial EXTERNAL_DECELERATION**.
       - if already beyond the target in the same direction, bleed back toward target using `EXTERNAL_DECELERATION`.
       - if moving opposite the requested target, Drive acceleration first cancels/reverses it deterministically.
     - reconstruct shared external velocity.
     - preserve the existing global `MAX_EXTERNAL_SPEED` safety clamp.
4. copy the resulting shared external velocity to both participants.
5. integrate both participants.
6. Contact/Bond etc.

Equivalent small math is allowed if these semantics are preserved.

Important:
- do not run current full-vector `decayExternal()` first and then add 4m/s² on the Drive axis.
- do not alter FREE Push decay semantics.
- do not introduce a second arbitrary friction constant; `EXTERNAL_DECELERATION` remains the decay source.

This correction is required before implementation.

## Accepted provisional Drive constants, pending User confirmation

Recommended:
- `GRAPPLE_DRIVE_SPEED = 0.6 m/s`
- `GRAPPLE_DRIVE_ACCELERATION = 4 m/s²`
- `MOROZASHI_DRIVE_FACTOR = 1.5`

All are Prototype tuning and will be revisited with the later whole-game tempo pass.

## Review Decision — Drive action state

Accept adding a minimal timerless action variant:

```ts
{ kind: 'drive' }
```

Reason:
- Snapshot/presentation can show actual Drive contribution.
- future Throw/Lift can share the existing action exclusivity boundary.
- future stamina can inspect actual Drive state.
- no duplicate separate `isDriving` flag is needed.

Semantics:
- participant action is `drive` only while it is actually contributing this tick.
- held but TURNING participant remains idle.
- releasing ↑ returns to idle.
- equal simultaneous contest may have both participants in `drive` even though net=0; both are exerting effort.

### Critical release invariant

If Engagement is released while either participant is in `drive`:
- **clear/cancel Drive action for both participants before returning to FREE**.
- releaser(s) then enter Grip Recovery.
- non-releaser becomes idle.

Never leave a `drive` action in FREE state.

This must be explicitly tested because current FREE action/effective-move logic does not know how to carry a GRAPPLED Drive state.

## Review Decision — Dummy Mode 2

Accept extending the existing validation harness, not real AI.

Mode 2:
- while FREE: current Push behavior unchanged.
- while GRAPPLED: emit `driveHeld = true` and no FREE-action edges.
- Simulation readiness decides whether the Dummy actually contributes:
  - TURNING → no Drive action/contribution
  - READY → Drive.

Mode 1 remains passive.

While GRAPPLED, keep existing Push cooldown held/reset so releasing the grapple does not produce an immediate stale Push.

## Input implementation constraint

Current Scene does not retain the ArrowUp Key object; it only wires its down event to `pushLatch`.

ACTION-05C1 should keep one ArrowUp key reference so each render frame/tick intent can supply:
- edge → existing Push latch
- held state → `driveHeld`.

Do not infer `driveHeld` from repeated keydown events.

## Ring-out / arena boundary

Drive Foundation must not silently define ring-out.

Do not:
- stop at ring edge
- bounce
- clamp
- declare winner.

Leaving the ring remains possible until the dedicated Ring-out/BoutOutcome task.

## User Decisions Required

Recommended as one coherent Prototype baseline:

### UD-1 — Drive mode
Continuous hold.

### UD-2 — semantic input
Add `driveHeld`.

### UD-3 — provisional Drive tuning
- target speed: 0.6 m/s
- acceleration: 4 m/s²

### UD-4 — Morozashi Drive factor
Holder = 1.5.
Disadvantaged side = 1.0.

### UD-5 — Release during Drive
READY participant may release immediately; Release wins over Drive.

### UD-6 — sequencing with Ring-out
Implement/test Drive displacement first.
Ring-out/BoutOutcome remains the next separate investigation.

## Required implementation constraints after User confirmation

ACTION-05C1 should include:

- `driveHeld` semantic input
- timerless `drive` action
- pair-axis signed net
- corrected GRAPPLED shared-external velocity update from C-1
- READY gating
- Morozashi factor
- release cancellation of both Drive actions
- Dummy Mode 2 contested Drive
- minimal DRIVE/pair-speed debug presentation
- large-arena focused tests where ring edge is irrelevant
- no Ring-out semantics.

## Tests that must explicitly cover the correction

In addition to the Investigation matrix:

- neutral one-sided Drive reaches ~0.6m/s under continuous hold rather than stalling near one-tick velocity.
- acceleration progression is independent of the pre-existing `EXTERNAL_DECELERATION = 8` subtraction because axial Drive update owns that component while active.
- Drive at 4m/s² does not require changing `EXTERNAL_DECELERATION`.
- opposite pre-existing axial momentum is canceled and reverses deterministically.
- perpendicular pre-existing momentum decays while Drive continues.
- releasing Engagement clears every `drive` action before FREE state.
- FREE Push regression remains bit-for-bit/test equivalent.

## Next Sequence

After UD-1–UD-6 confirmation:

1. **ACTION-05C1 Grappled Drive Foundation**
   - User Play Test REQUIRED.
2. **Minimal Ring-out / BoutOutcome Investigation**
3. Ring-out implementation / Yorikiri win-loop integration
4. later Throw / Lift.

Do not bundle these tasks.

## Do Not Reopen

Unless Drive implementation exposes a concrete conflict:
- pair-level Engagement
- Grapple bond
- Orientation readiness
- TURNING/READY rules
- Counter side/rear geometry
- Kuzushi→Morozashi
- FREE Push formula.

## Deferred

- whole-game tempo rebalance
- stamina
- Power / Weight / LowerBody formulas
- mass/traction
- discrete/gaburi Drive pulses
- pair rotation
- Ring-out/BoutOutcome
- Throw
- Lift
- directional FREE Push advantage
- final animation/audio
