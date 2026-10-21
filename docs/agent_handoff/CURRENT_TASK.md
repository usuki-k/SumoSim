Task-ID: ACTION-04A3-COUNTER-TRANSITION-INVESTIGATION
Status: REVIEWED
Task-Type: INVESTIGATION / DESIGN / CORE GAMEPLAY MOVEMENT / COUNTER RESOLUTION
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 190c50b37ad217b9597a64323f357ad396ecb903
Handoff-Mode: GITHUB

# ACTION-04A3 — Counter Success / Best Continuous Transition Investigation

## Purpose

Investigate and design the smallest deterministic Simulation-owned transition that replaces the current one-tick Counter relocation with an approximately 2-second continuous exchange.

This is **Investigation / Design only**.

Do NOT implement Production changes.

The User has already accepted the current Counter result semantics:

- Counter **Success**:
  successful Counter wrestler ends at the opponent's **side**
- Counter **Best**:
  successful Counter wrestler ends at the opponent's **rear / back**

Those final positional semantics are correct and must be preserved unless a material conflict is found and reported.

The current problem is only the transition:

- the successful Counter wrestler currently jumps to the side/rear target in one Simulation tick
- the pushing / countered wrestler should visibly stagger forward
- the successful Counter wrestler should move naturally into the side/rear result
- both participants should be uncontrollable during the transition
- target feel is approximately **2 seconds**
- the User's `yoroke.mp4` is a feel reference for continuous stagger/movement, not a timing/formula source.

The task must determine how this should be represented in Simulation state before implementation.

---

# User-Confirmed Behavior

## Success case

Opponent Push is caught by Down Counter.

Result:
- current side-placement result remains
- successful Counter wrestler moves continuously toward that side result
- pushing/countered wrestler moves continuously forward in a stagger / loss-of-balance motion
- approximate duration: 2 seconds
- both participants ignore normal control input until the transition completes.

## Best case

Opponent Push is caught at Best timing.

Result:
- current rear-placement result remains
- successful Counter wrestler moves continuously around / behind toward that rear result
- pushing/countered wrestler moves continuously forward in a stagger / loss-of-balance motion
- approximate duration: 2 seconds
- both participants ignore normal control input until the transition completes.

## Failed Counter

Do NOT silently redesign failed Counter behavior in this Task.

Current failed Counter -> Kuzushi behavior is separate unless source inspection shows an unavoidable shared-state issue.

## Counter attempt art

Dedicated Counter artwork for Down input / whiff readability is planned separately.

Do NOT design or implement those images here.

This Task is about **successful Counter movement/state ownership only**.

---

# Terminology

Use the following terms consistently:

- **counter user / successful side**:
  the participant who pressed Down and successfully caught the Push
- **pusher / countered side**:
  the participant whose active Push was caught
- **Counter transition**:
  the new time-bearing pair exchange after a Success/Best catch
- **Kuzushi**:
  the current Simulation posture state; do not use it as a synonym for the whole Counter transition.

Current Source naming inside `resolveCounter()` uses `defender` for the Counter user and `attacker` for the pusher. Report that explicitly to avoid role confusion.

---

# Current Source Facts to Verify

Inspect Current Source directly.

At minimum verify:

- `BoutTypes.ts`
- `BoutSimulation.ts`
- Counter-focused tests in `BoutSimulation.test.ts`
- `ringOut.ts` and ring-out integration in the Simulation tick
- `grappleOrientation.ts`
- `FixedStepAccumulator.ts`
- `PushDummyController.ts`
- `BoutScene.ts`
- `wrestlerVisualState.ts`
- current Product `WrestlerView.ts`
- `docs/ARCHITECTURE.md`
- relevant current SPEC / Handoff.

Known current behavior to confirm:

1. successful Counter computes a side/rear target using `counterRelocationTarget()`
2. the Counter user is directly assigned to that target in the same tick
3. the pusher enters Kuzushi
4. the pusher receives `COUNTER_OVERSHOOT_SPEED` along its locked Push direction
5. ordinary facing/contact/ring-out order continues according to the current step pipeline.

Do not rely on the previous review summary in place of source inspection.

---

# Architecture Constraint

Most important question:

**Should the ~2-second Counter transition be canonical Simulation state, or presentation-only smoothing?**

The User explicitly wants:
- both participants uncontrollable during the interval
- both participants to move through the exchange
- deterministic timing.

That strongly suggests Simulation ownership, but the Agent must inspect consequences before recommending a design.

Do NOT implement a Phaser-only tween as a shortcut.

Preserve:

```
Pure TypeScript Simulation
  -> canonical state / results
  -> Phaser presentation
```

No second gameplay-position Source of Truth.

---

# Investigation Questions

The Completion Report must answer all of the following.

## 1. State ownership

Compare at least these candidates:

### Candidate A — pair-level Counter transition state
Example concept only:

```
BoutCounterTransition
  tier
  counterUserId
  pusherId
  ticksRemaining
  start/target positions
  motion basis / progress
```

### Candidate B — participant action/posture extension
Represent the transition through per-participant action/posture state.

### Candidate C — presentation-only interpolation
Keep current instantaneous canonical result and visually interpolate.

Evaluate:
- single Source of Truth
- input lock
- deterministic fixed-step behavior
- Snapshot clarity
- contact/ring-out semantics
- future dedicated Counter art
- implementation size.

Recommend one.

Do not treat the example shape as pre-approved design.

## 2. Duration

User target is approximately **2 seconds**.

At current 60 Hz this is about 120 ticks.

Determine:
- whether the design should expose a named provisional `COUNTER_TRANSITION_TICKS`
- exact tick semantics:
  - when tick 1 begins
  - whether entry tick counts
  - when input resumes.

Do not tune final game feel numerically beyond what is needed for an implementable design.

## 3. Input lock

Define exactly what happens during the transition to:

- WASD movement
- Push press
- Counter press
- Grip press
- Drive held
- dummy-controller intents.

Required User behavior:
- no normal action starts during the transition.

Investigate whether:
- press edges during transition are simply consumed/ignored
- held movement begins immediately on the first post-transition tick
- held Drive has any relevance while FREE.

Recommend explicit semantics so no input is unintentionally queued.

## 4. Canonical movement paths

Determine the minimal deterministic path representation for both participants.

Successful Counter side:
- Success ends at current side target
- Best ends at current rear target.

Countered pusher:
- should move forward in a readable stagger / overshoot.

Compare simple deterministic options such as:
- start->target interpolation
- velocity profile
- fixed easing curve in canonical Simulation coordinates.

Do not design a full animation system.

Key requirement:
- both participants' canonical positions should evolve continuously if Simulation owns the transition.

Report whether exact final side/rear target should be stored at transition start or recomputed during transition.

## 5. Pusher final position

Current source gives the pusher forward external velocity rather than an explicit final position.

The User wants about 2 seconds of readable forward stagger.

Investigate:
- whether to retain the current overshoot impulse inside the new transition
- replace it with an explicit transition target/path
- or use another small deterministic rule.

This is a potentially semantic gameplay change.

Do NOT silently decide a new final displacement if Current Source does not already determine it.

If User judgment is required for the pusher's final distance, report a concrete decision point instead of inventing one.

## 6. Contact handling

During the pair transition, decide whether ordinary contact resolution should:

- run normally
- be bypassed for the two transitioning participants
- be replaced by transition-specific separation geometry.

Analyze:
- overlap
- jitter
- path interference
- maintaining readable side/rear placement.

Do not assume current contact correction can coexist with scripted canonical paths.

## 7. Ring-out / Tokudawara

This is mandatory.

Determine how ring-out should work while canonical positions move for ~2 seconds.

Questions:
- run ring-out every transition tick?
- can either wrestler lose during the transition before it completes?
- what happens if the successful side's path would cross out and re-enter?
- current target selection already validates the Counter user's final center; is that enough for the whole path?
- how does Tokudawara-aware earliest crossing interact with a multi-tick path?

Preserve current accepted ring-out semantics unless a design change is explicitly proposed for User decision.

## 8. Facing

Define candidate facing behavior during transition.

Possible considerations:
- pusher keeps locked Push facing while staggering
- successful side rotates toward its movement path / opponent / final orientation
- both face each other continuously.

Do not invent a visually complex rule.

Recommend the smallest deterministic behavior that supports:
- Success side movement
- Best rear movement
- current rigid sprite presentation.

If a User visual decision is needed, say so.

## 9. Velocity state

Current participant state has:
- self velocity
- external velocity
- total Snapshot velocity.

Determine what those should mean during the transition.

Avoid contradictory states such as:
- position moving by scripted interpolation while velocity reports zero or unrelated values, unless intentionally defined and justified.

Specify:
- whether transition velocity is reflected in Snapshot `velocity`
- what happens to pre-existing self/external velocity on entry
- what velocity remains on completion.

## 10. Kuzushi interaction

Current pusher enters `posture.kind === 'kuzushi'` for about 0.5 seconds.

The proposed transition is about 2 seconds.

Investigate:
- keep Kuzushi nested/parallel to transition?
- extend Kuzushi duration?
- transition supersedes the posture?
- posture remains semantic but input lock comes from pair transition?

Do not change failed-Counter Kuzushi semantics accidentally.

## 11. Action / engagement interaction

Determine:
- actions of both participants on transition entry
- whether engagement must remain FREE
- whether Grip can occur during transition (expected no)
- completion state.

Preserve current Push cancellation semantics.

## 12. Outcome / freeze interaction

If a ring-out occurs during transition:
- does transition stop immediately?
- does outcome freeze motion as current runtime does?

Recommend explicit behavior.

## 13. Snapshot / presentation needs

The current rigid renderer can display canonical position/facing directly.

Determine whether Snapshot also needs a pair-level transition state for:
- debug labels
- future dedicated Counter art
- transition progress
- User-facing presentation.

Avoid exposing data the runtime does not need.

## 14. Determinism / fixed-step

The design must remain:
- 60 Hz fixed-step
- frame-rate independent
- deterministic from the same intent sequence.

No Scene delta-time gameplay movement.

---

# Required Design Output

The Completion Report must contain a concrete recommended design that is ready for ChatGPT review.

At minimum include:

## Recommended state shape

Pseudotype / TypeScript-like shape for:
- pair transition state if recommended
- any Snapshot exposure.

## Transition entry

Exact current Counter-success pipeline point where transition begins.

## Transition tick

Ordered steps for one tick during transition.

Example structure only:

```
input ignored
-> advance transition progress
-> update canonical positions
-> update canonical velocities/facing
-> contact policy
-> ring-out
-> transition completion
```

Do not copy this order blindly; derive it from current source.

## Transition completion

State of:
- positions
- actions
- posture
- velocities
- facing
- input eligibility.

## Success vs Best

Show what is shared and what differs.

## Boundary cases

Cover explicitly:
- no valid Counter target
- near ring edge
- Tokudawara path
- ring-out during transition
- simultaneous/near-simultaneous boundary crossing
- outcome already decided
- transition completion on exact final tick.

---

# User Decisions vs Agent Recommendations

Clearly separate:

## Already User-decided

- Success final relative placement = side
- Best final relative placement = rear
- approximately 2-second visible transition
- both participants uncontrollable during transition
- pusher visibly staggers forward
- successful side also moves naturally
- base rigid sprite may be reused for movement
- Counter attempt art handled separately.

## Agent may recommend

- state ownership shape
- tick bookkeeping
- path representation
- contact policy
- facing policy
- velocity bookkeeping
- Snapshot exposure.

## Must STOP for User decision if discovered

- changing Success/Best final-placement meaning
- changing ring-out winner semantics
- inventing a materially different final pusher displacement
- changing Counter timing window/tier classification
- changing failed Counter penalty semantics.

---

# Scope Out

Do NOT:

- edit Production TypeScript gameplay/source
- add the transition state
- change Counter relocation
- add animation/tween code
- add Counter art
- add Grip/Morozashi art
- change current rigid wrestler assets
- change Push/Counter timing values
- change ring-out logic
- change input bindings
- change HUD.

This is Investigation / Design only.

---

# Verification Level

Investigation / Design with focused source/test inspection.

Required:

- map current Counter success tick order from source
- identify all existing Counter tests that depend on instantaneous relocation
- identify ring-out/contact tests that the transition could affect
- identify any current invariant that would be broken by a 2-second pair state
- identify exact Production files likely touched by the later implementation
- run no Production-changing command.

Running existing tests is optional unless needed to confirm a source interpretation.

If tests are run, report them honestly.

---

# Completion Report

Write only:

`docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

Use the Investigation-only Report Commit Exception in `AGENTS.md` if applicable.

Required sections:

- Result
- Preflight
- Current Counter Pipeline
- Current Instant-Relocation Evidence
- Affected State / Tests
- Candidate Designs
- Recommended Design
- Recommended State Shape
- Entry / Tick / Completion Semantics
- Success vs Best
- Input Lock Semantics
- Movement / Velocity Semantics
- Contact Semantics
- Ring-out / Tokudawara Semantics
- Facing Semantics
- Kuzushi Interaction
- Snapshot / Presentation
- Boundary Cases
- User Decisions Preserved
- User Decisions Still Needed
- Expected Implementation Files
- Verification
- Design Deviations
- Unexpected Scope
- Git delivery.

---

# Acceptance Criteria

PASS if the Investigation produces a design that:

1. preserves Success side / Best rear final semantics
2. owns the ~2-second no-input interval explicitly
3. avoids duplicate canonical positions
4. defines both participants' movement ownership
5. defines input suppression
6. defines contact behavior
7. defines ring-out/Tokudawara behavior
8. defines facing
9. defines velocity bookkeeping
10. defines Kuzushi interaction
11. remains deterministic/fixed-step
12. is narrow enough for a focused implementation Task
13. clearly identifies any unresolved User decision instead of inventing it.

If a material design choice cannot be resolved without User judgment:
Result may be `BLOCKED` with a concrete decision request.

Do NOT implement a fix.

---

# Git Delivery

Follow `AGENTS.md`.

Because this is Investigation / Design only:

- Production/source files must remain unchanged
- only `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md` may be committed/pushed under the Investigation-only Report Commit Exception
- do not edit `CURRENT_TASK.md`
- do not update Product SPEC yet
- push to `origin/develop`
- do not modify `main`.

Suggested report-only commit:

`docs(agent): investigate counter transition`

# Final Instruction

Investigate and design only.

Do NOT implement the 2-second Counter transition.

After report/commit/push:

「ACTION-04A3-COUNTER-TRANSITION-INVESTIGATION が完了し、ChatGPT Design Review待ちです」


# Final ChatGPT Design Review

Overall Result: INVESTIGATION PASS / DESIGN CONDITIONALLY ACCEPTED / USER DECISIONS REQUIRED

## Reviewed Delivery

- Report-only commit:
  `2ee911996c516808b4bf15443d449c2929256b76`
- Agent-Start-Head:
  `3f4adb0e1aa460fa063d187c2931c62d4c63b40e`
- Diff contains only:
  `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- No Production / source / test / SPEC change.

Investigation-only Report Commit Exception was used correctly.

## Current Source Reading

PASS.

The report correctly maps the current Counter-success pipeline.

Important confirmed current facts:

- Counter user = local variable `defender`
- pusher/countered side = local variable `attacker`
- Success / Best tier comes from the pusher's active Push timing
- pusher enters Kuzushi
- Counter user's action returns idle
- current Counter user relocation is assigned directly in one tick
- pusher receives forward external velocity
- facing and ring-out are then resolved later in the same tick.

The reported instant relocation is therefore a real canonical Simulation jump, not a Phaser artifact.

## Candidate Design Review

### Candidate A — pair-level Simulation-owned CounterTransition

**ACCEPTED DIRECTION**

This best matches the User requirement:

- both participants move through the exchange
- both participants are input-locked for about 2 s
- movement is deterministic/fixed-step
- canonical positions remain the single source of truth
- Phaser only renders Snapshot position/facing
- future Counter art can read tier / role / progress.

### Candidate B — per-participant duplicated transition states

Not preferred.

The motion is a pair relationship and synchronizing two independent participant states adds unnecessary split ownership.

### Candidate C — presentation-only tween

REJECTED.

It would create:
- canonical gameplay position at the resolved location
- a second visible presentation position still moving toward it.

That conflicts with:
- contact
- ring-out
- input lock
- state ownership.

Do Not Reopen unless architecture requirements change.

## Recommended Pair State

The reported conceptual shape is acceptable as the basis for implementation:

- tier
- counterUserId
- pusherId
- deterministic tick progress
- fixed entry geometry / path data.

Top-level Snapshot exposure is also reasonable because:
- debug/presentation may need role/tier/progress
- future Counter art can read it
- the relationship is pair-level like engagement.

Keep path internals private unless runtime actually needs them.

## Duration

Accept as provisional implementation baseline:

`COUNTER_TRANSITION_TICKS = 120`

at 60 Hz = approximately 2.0 s.

This is a User-requested approximate duration, not final Game Feel tuning.

User Play Test remains the final gate.

## Input Lock

The recommended semantics are accepted:

During transition:
- movement ignored
- Push edge ignored / not queued
- Counter edge ignored / not queued
- Grip edge ignored / not queued
- Drive irrelevant / ignored while FREE
- dummy harness waits.

On the first tick after completion:
- held movement may act normally
- only newly pressed discrete action edges count.

This matches the existing no-queue principle.

## Canonical Path Ownership

Accepted principle:

During active CounterTransition:
- the transition path is the sole owner of canonical participant position for the pair
- ordinary velocity integration does not also move them
- ordinary pair contact correction does not alter the scripted pair path.

This avoids two simultaneous position solvers.

## Contact Policy

Accepted direction:

Skip ordinary contact resolution between the two participants during the transition.

The transition path itself must maintain a valid/non-overlapping pair relationship.

There are only two participants, so no third-party contact problem exists.

## Ring-out / Tokudawara — CORRECTION

The Agent report recommended preventing the Counter user from leaving the ring by validating the entire path conservatively before accepting a candidate.

Do NOT adopt that as the default.

Reason:
- current accepted ring-out is based on actual canonical center movement
- both participants should remain subject to the same ring-out rule while they move
- path-wide immunity would introduce a new Counter-specific protection
- it would also eliminate possible simultaneous/earlier-crossing cases by construction.

### Corrected recommendation

During every transition tick:

- update both canonical positions
- call the existing `resolveArenaRingOut` on previous -> current for both participants
- use existing Tokudawara-aware `firstArenaExitFraction`
- exact boundary remains IN
- first exit loses
- effectively simultaneous exits remain Rematch.

If either participant exits during the 2-second exchange:
- outcome resolves immediately
- existing post-outcome freeze semantics stop further transition progress.

Do not grant the Counter user ring-out immunity.

### Candidate target validity

Preserve the current final-target candidate rule as much as possible.

Do not silently broaden or narrow candidate eligibility based on the entire future path.

The designed curved movement path itself may create new boundary interactions compared with the current instantaneous straight resolved-state interpolation; that is an unavoidable consequence of making the movement canonical over time and must be covered by focused tests + User Play Test.

## Facing

The Agent recommendation is accepted as the initial implementation direction:

- pusher:
  keeps the caught Push-facing while in Kuzushi/transition
- Counter user:
  continues to face the pusher as canonical positions move.

This naturally produces continuous Counter-user rotation during a side/rear move.

Known Deferred risk:
when pusher Kuzushi later ends, current FREE facing can snap toward the opponent, potentially by a large angle after Best.

Do not broaden the next implementation Task to fix that unless required as a prerequisite.

## Velocity Bookkeeping

Accepted principle:

Snapshot velocity must agree with actual canonical transition displacement.

During transition:
- counter user's transition motion may be represented as self velocity
- pusher's forced stagger motion may be represented as external velocity
- those values are reporting/state semantics; positions are still path-owned, not re-integrated from those velocities.

Completion should not leave unintended residual transition velocity.

## Kuzushi

The transition lock must NOT rely on Kuzushi alone because:
- Counter user is not Kuzushi
- both participants must be locked.

Pair transition owns the pair lock.

Failed Counter -> Kuzushi remains separate and unchanged.

## Critical Design Decisions Still Required

The report correctly identified D1/D2 and also contains two additional material choices that must be explicit before implementation.

### D1 — Pusher stagger distance

Current pusher post-Counter displacement varies substantially with existing momentum and stops quickly.

User wants a readable ~2-second forward stagger.

A new canonical distance materially affects:
- ring-out likelihood
- final world positions.

Agent recommendation:
**fixed 1.0R = 0.35 m as a provisional first tuning value**, same for Success and Best.

This is NOT accepted until User confirms.

### D2 — Post-transition Kuzushi / Morozashi opportunity

Options:

A. After the 2-second transition, give the pusher the existing full `KUZUSHI_TICKS` (~0.5 s) window.
- preserves existing Counter -> Grip / Morozashi opportunity
- pusher remains unable to act for ~0.5 s after pair transition
- Counter user regains input and can exploit the opening.

B. Kuzushi expires during/with the transition.
- total lock closer to exactly 2 s
- existing immediate Counter -> Grip / Morozashi opportunity effectively disappears.

Agent recommendation:
**A**, to preserve existing follow-up gameplay.

Not accepted until User confirms.

### D3 — Pre-existing momentum on transition entry

The proposed pair path cannot safely coexist with ordinary pre-existing self/external momentum as a second position driver.

Options:

A. Clear both participants' existing self/external velocity on Counter-transition entry; transition path absorbs the exchange.
B. Carry old momentum into the path/final state, requiring a more complex model.

Agent recommendation:
**A — clear/absorb prior momentum**.

This changes current momentum carry behavior and requires User confirmation.

### D4 — Meaning of final Success / Best position while the pusher also moves

Two reasonable interpretations exist:

A. At transition completion, Counter user is still exactly:
- Success: at the pusher's **current/final side**
- Best: at the pusher's **current/final rear**.

This means the Counter user's absolute world endpoint moves forward together with the pusher.

B. Counter user moves to the **current pre-transition world target** computed at the catch moment, while pusher separately staggers forward.
The final relative geometry may no longer be exact side/rear after the pusher advances.

Based on the User wording:
- successful side moves to side/rear
- countered side also moves forward through the same exchange

Agent recommendation:
**D4-A — preserve side/rear as the final relative geometry after both have moved.**

This is a material clarification and requires User confirmation.

## Path Shape

Conditionally accepted once D1/D4 are resolved.

The Agent's minimal path idea is suitable:

- pusher moves forward along fixed caught Push direction
- Counter user moves around pusher in a deterministic polar path
- Success rotates relative angle toward ±90°
- Best rotates relative angle toward 180°
- smooth deterministic easing
- no body intersection.

Do not lock exact easing as immutable Game Feel.
It is a provisional first implementation and User Play Test tuning surface.

## No-valid-target Edge Case

The report's proposed fallback:
- 2-second lock
- both participants do not move

is NOT accepted yet.

It changes current no-target behavior and is visually/gameplay-significant.

Implementation Task must preserve existing semantics as far as possible or STOP with a focused decision if this edge case cannot be reconciled cleanly.

Do not invent Counter immunity or a new fallback outcome.

## Outcome / Freeze

Accepted:

If ring-out resolves during transition:
- current tick outcome becomes authoritative
- transition stops because subsequent `step()` calls already no-op after outcome
- final frozen state remains the exact state at deciding tick.

No post-outcome completion warp.

## Snapshot / Presentation

Accepted:

Expose a small top-level pair transition state with:
- active/none
- tier
- participant roles
- ticksRemaining.

Do not expose redundant path positions because participant canonical position/facing already contains what rendering needs.

This also gives future dedicated Counter art a clean presentation signal.

## Affected Tests / Files

The report correctly identifies significant existing dependencies:
- Counter position tests
- Counter/Kuzushi tests
- Counter -> Grip/Morozashi tests
- orientation tests
- ring-out/Tokudawara
- dummy harness
- Snapshot-shape assertions.

A later implementation Task must update all explicit Snapshot top-level key assertions when `counterTransition` is added.

Do not sample only one Counter scenario.

## Investigation Verification

PASS.

- Current Source inspected
- relevant tests inspected
- baseline `pnpm test`: 262 PASS
- scratch measurement performed without Production modification
- report-only commit only.

## Overall Design Result

Architecture direction:
**ACCEPTED**

Implementation readiness:
**BLOCKED ON USER DECISIONS D1–D4**

No Production implementation should start before those decisions are recorded.

## Next Task Constraint

After D1–D4 are decided, create one focused Heavy implementation Task for:

- Simulation-owned pair CounterTransition
- deterministic Success/Best paths
- pair input lock
- canonical continuous positions
- velocity/facing bookkeeping
- ordinary ring-out every transition tick
- existing outcome freeze
- focused regression tests
- runtime User Play Test.

Do NOT combine:
- dedicated Counter attempt sprite
- Grip/Morozashi art
- Tsuri
with that movement/state implementation.
