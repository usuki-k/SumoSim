Task-ID: ACTION-04A4-COUNTER-TRANSITION-IMPLEMENTATION
Status: READY
Task-Type: IMPLEMENTATION / CORE GAMEPLAY MOVEMENT / COUNTER RESOLUTION
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 8731b0e2ad64113f7942ecf0b841d8daa3138397
Handoff-Mode: GITHUB

# ACTION-04A4 — Counter Success / Best Continuous Transition Implementation

## Purpose

Implement the accepted Simulation-owned ~2.0 second Counter resolution transition.

The current Counter result positions are already correct:

- Success -> Counter user ends at the pusher's true side
- Best -> Counter user ends at the pusher's true rear/back.

The problem is only that the current implementation relocates the Counter user in one Simulation tick.

Replace that teleport-like resolution with a deterministic fixed-step pair transition in which:

- the pusher/countered wrestler visibly staggers forward
- the successful Counter user moves continuously to side/rear
- both participants are input-locked during the transition
- canonical Simulation position/facing remain the single source of truth
- Phaser continues to render canonical positions/facing directly.

Do NOT implement dedicated Counter art in this Task.

---

# Accepted User Decisions — Do Not Reopen

## D1 — Pusher stagger distance

Use:

```
COUNTER_STAGGER_DISTANCE = 1.0R = 0.35 m
```

Same provisional base distance for Success and Best.

This is a tuning baseline subject to later User Play Test.

## D2 — Post-transition Kuzushi

After the CounterTransition completes:

- pusher receives the full existing `KUZUSHI_TICKS` (~0.5 s) again
- Counter user is stable and regains control.

Purpose:
preserve the existing Counter -> Grip / Morozashi follow-up opportunity.

Failed Counter behavior remains unchanged.

## D3 — Existing momentum

At CounterTransition entry:

- set both participants' `selfVelocity` to zero
- set both participants' `externalVelocity` to zero.

The transition path becomes the sole owner of pair movement.

Do NOT carry prior Push/external momentum as a second position driver.

## D4 — Final relative placement

At transition completion, after the pusher has moved its 1.0R stagger distance:

- Success: Counter user is exactly at the pusher's true side
- Best: Counter user is exactly at the pusher's true rear/back
- distance between centers = current combined body radius/contact distance.

The Counter user's absolute endpoint therefore moves with the pusher's final stagger endpoint.

---

# Accepted Design Direction

Use a pair-level Simulation-owned Counter transition.

Do NOT use a Phaser tween as gameplay movement.

Recommended conceptual shape:

```
CounterTransition
  none
  active {
    tier
    counterUserId
    pusherId
    ticksElapsed / ticksRemaining
    entry geometry / path data
  }
```

Exact internal field names may differ if a smaller explicit shape is cleaner.

Expose only the minimum useful public Snapshot state:
- none/active
- tier
- counterUserId
- pusherId
- ticksRemaining.

Do not expose redundant path coordinates if canonical participant position already contains what presentation needs.

---

# Duration

Add a named provisional constant:

```
COUNTER_TRANSITION_TICKS = 120
```

At current 60 Hz this is ~2.0 s.

Tick semantics must be explicit and deterministic.

Recommended:

- capture tick = transition entry, progress 0
- following 120 Simulation ticks advance the transition
- completion occurs at the end of tick 120
- normal input resumes on the next tick.

No render-delta gameplay movement.

---

# Required Reading

Read directly:

- `AGENTS.md`
- `CLAUDE.md`
- current `CURRENT_TASK.md`
- prior `CURRENT_COMPLETION_REPORT.md`
- `docs/ARCHITECTURE.md`
- `src/game/sumo/BoutTypes.ts`
- `src/game/sumo/BoutSimulation.ts`
- `src/game/sumo/ringOut.ts`
- `src/game/sumo/BoutCounter.test.ts`
- `src/game/sumo/BoutCounterPosition.test.ts`
- `src/game/sumo/BoutGrip.test.ts`
- `src/game/sumo/BoutOrientation.test.ts`
- `src/game/sumo/BoutRingOut.test.ts`
- `src/game/sumo/BoutTokudawara.test.ts`
- `src/game/input/pushDummyController.ts`
- `src/game/input/pushDummyController.test.ts`
- `src/game/presentation/wrestlerVisualState.ts`
- `src/game/scenes/BoutScene.ts`.

Review Handoff does not replace Source inspection.

---

# Role Naming

Use consistent terminology:

- **Counter user**:
  participant who pressed Down and successfully caught the Push
- **Pusher**:
  participant whose active Push was caught.

Current `resolveCounter()` variable names are historically:
- Counter user = `defender`
- Pusher = `attacker`.

Do not confuse these roles when implementing the transition.

---

# State / Snapshot

Add a pair-level Counter transition to the canonical Bout runtime state.

Recommended public type:

```
export type BoutCounterTransition =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'active'
      readonly tier: 'best' | 'success'
      readonly counterUserId: ParticipantId
      readonly pusherId: ParticipantId
      readonly ticksRemaining: number
    }
```

Add:

```
BoutSnapshot.counterTransition
```

Update all Snapshot-copy/isolation logic.

Update every test that asserts exact top-level Snapshot keys.

Do NOT put the transition inside only one participant's action/posture.

---

# Entry Semantics

On successful Counter capture:

1. determine Push direction `d`
2. determine tier exactly as current source does
3. determine accepted side/rear candidate ordering exactly as current source does
4. cancel the pusher's Push into Kuzushi as today
5. Counter user's action becomes idle
6. DO NOT directly assign Counter user's position to target
7. DO NOT add current `COUNTER_OVERSHOOT_SPEED`
8. clear both participants' self/external velocities to zero
9. initialize the pair CounterTransition at progress 0.

The capture tick should end with both canonical positions still at their resolved capture/contact positions.

Ring-out for that capture tick still runs through the existing pipeline.

---

# Transition Paths

Use a small deterministic path model.

## Pusher path

Pusher moves forward along the caught locked Push direction `d`.

Final displacement:

```
L = COUNTER_STAGGER_DISTANCE = BODY_RADIUS = 0.35 m
```

Recommended provisional easing:

```
pusherEase(u) = 1 - (1 - u)^2
```

for `u ∈ [0,1]`.

This gives stronger initial movement and a natural slowdown.

Exact easing is presentation/game-feel tuning, but do not substitute a complex animation system.

## Counter user path

Move relative to the moving pusher.

Use the pusher's fixed Push-axis basis:

```
d
perp = (-d.y, d.x)
```

Represent the Counter user's relative vector in polar form around the pusher.

Recommended:

```
s(u) = 3u^2 - 2u^3
theta(u) = theta0 + (theta1 - theta0) * s(u)
r(u) = r0 + (combined - r0) * s(u)
```

where:
- `r0/theta0` come from the capture geometry
- final radius = combined body radius
- Success final theta = preferred ±π/2
- Best final theta = π reached by rotating through the preferred side.

This should create:
- Success: natural side movement
- Best: natural wrap-around toward rear.

Do not let the Counter user's path pass through the pusher.

---

# Success / Best Candidate Ordering

Preserve existing semantics.

## Success

Candidate order:
- preferred side
- opposite side.

## Best

Candidate order:
- rear first
- then preferred side
- then opposite side.

Preserve the current side preference rules:
- existing lateral lean sign
- on tie, ring-center-nearer side
- then fixed side+ tie-break.

Do not change tier classification or Counter timing window.

---

# Boundary / No-Valid-Target Handling

This is a critical boundary case.

Do not invent a new gameplay outcome.

Preferred implementation approach:

- compute the transition's final side/rear candidate using the accepted candidate ordering and final pusher endpoint
- validate candidate final center using the same conservative current center-fit criterion used by Counter relocation
- if a valid transition target exists, start CounterTransition
- if no valid transition target exists, preserve the existing no-relocation fallback semantics as closely as possible and do NOT fabricate a new side/rear target.

However:

If preserving the existing null-target fallback while also satisfying D1/non-overlap cannot be implemented without a semantic change, STOP and report the exact conflict.

Do not silently:
- make Counter user ring-out-immune
- force an invalid target
- introduce a new special outcome
- let participants pass through one another.

This rare edge case must be explicitly tested.

---

# Input Lock

During active CounterTransition:

Ignore all normal participant intents:

- movement
- Push press
- Counter press
- Grip press
- Drive held.

Discrete presses during transition are discarded, not queued.

Held movement may begin on the first tick after transition completion.

Only newly pressed discrete action edges after completion count.

## Dummy harness

Update `PushDummyController` so:

```
snapshot.counterTransition.kind === 'active'
```

returns NO_INPUT and keeps its Push cooldown full, analogous to waiting through existing blocked states.

Do not let dummy immediately queue a Push for transition completion.

---

# Transition Tick Ownership

When `counterTransition.kind === 'active'`, use a dedicated transition branch in the Simulation tick.

The transition path must be the sole canonical position owner for both participants.

Do NOT also run ordinary:
- grounded movement integration
- external momentum integration
- pair contact correction
- Push/Counter/Grip resolution
- Grapple/Drive movement.

Recommended transition tick responsibilities:

1. existing outcome freeze gate
2. capture previous canonical positions
3. ignore intents
4. keep/pause pusher Kuzushi semantics as specified below
5. advance deterministic transition progress
6. update both canonical positions from path
7. set velocity bookkeeping from actual path displacement
8. update facing
9. run ordinary arena ring-out for both participants
10. if outcome decided: freeze with current transition state/position
11. otherwise complete transition on final tick when appropriate.

Derive exact code ordering from Current Source and document any deviation.

---

# Contact Semantics

During active CounterTransition:

- do NOT run ordinary pair `resolveContact()`
- do NOT let contact correction modify path-owned canonical positions.

The path itself must maintain non-overlap/contact-distance geometry.

At transition entry, ordinary contact resolution has already occurred earlier in the capture tick.

There are only two participants.

---

# Ring-out / Tokudawara

Important correction from Design Review:

**Both participants remain subject to ordinary ring-out throughout the transition.**

Do NOT grant Counter user ring-out immunity.

Every transition tick:

- use previous -> current canonical positions
- call existing `resolveArenaRingOut`
- preserve Tokudawara-aware earliest exit behavior
- exact boundary remains IN
- first exit loses
- effectively simultaneous exits remain Rematch.

If outcome becomes decided:
- transition stops because post-outcome step remains no-op
- no final-position warp
- no forced transition completion.

Do not change winner semantics.

---

# Facing

Initial implementation:

## Pusher

Keep its caught Push-facing fixed during CounterTransition.

This should make the pusher read as stumbling forward.

## Counter user

Face the pusher continuously as both canonical positions move.

Use the existing canonical facing helper/rule if possible.

Do not add a second presentation-only facing.

Known Deferred issue:
when pusher's post-transition Kuzushi later ends, current FREE facing may snap significantly toward Counter user after Best.

Do not solve that in this Task unless it blocks the transition implementation.

Report it for User Play Test.

---

# Velocity Bookkeeping

Canonical positions are path-owned during transition, but Snapshot velocities should agree with those positions.

During each transition tick:

## Pusher

- `selfVelocity = 0`
- `externalVelocity = (currentPosition - previousPosition) / TICK_SECONDS`

## Counter user

- `selfVelocity = (currentPosition - previousPosition) / TICK_SECONDS`
- `externalVelocity = 0`.

Snapshot total velocity remains self + external.

Do NOT re-integrate these velocities into positions during the same transition tick.

At normal transition completion:
- explicitly set both self/external velocities to zero.

At ring-out freeze:
- preserve exact deciding-tick state as current freeze semantics require.

---

# Kuzushi Interaction

On Counter capture:
- pusher enters Kuzushi as today
- pusher action remains idle.

During active CounterTransition:
- pusher remains Kuzushi
- do not count down the Kuzushi timer as the pair transition progresses
- Counter user remains stable.

On normal transition completion:
- reset pusher posture to:
  `{ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS }`
- Counter user remains stable.

Then:
- Counter user can act on the next tick
- pusher remains in existing ~0.5 s Kuzushi
- existing Counter -> Grip / Morozashi opportunity remains.

Failed Counter:
- unchanged
- no CounterTransition.

---

# Engagement / Actions

CounterTransition only begins while FREE.

During transition:
- engagement stays FREE
- both actions remain idle
- no Grip attach
- no Release
- no Drive
- no new Push/Counter.

Completion:
- engagement remains FREE.

Do not combine with grapple state.

---

# Current COUNTER_OVERSHOOT_SPEED

The successful-transition path supersedes the current pusher overshoot impulse for valid CounterTransition cases.

Remove or retire `COUNTER_OVERSHOOT_SPEED` if no longer used.

Update tests that currently depend on the old overshoot velocity.

Do not leave dead gameplay tuning constants.

---

# Presentation

The current rigid Product WrestlerView already renders:

- canonical position
- canonical facing.

Therefore no Phaser movement tween should be necessary.

Do not add:
- scene-owned transition position
- extra body offset
- animation framework.

Optional minimal presentation updates:
- debug/phase text may display CounterTransition tier/role if useful.

Do not change Product art in this Task.

---

# Tests — Heavy

Verification Level:
**Heavy + Browser/Runtime Smoke + User Play Test**

Do not sample explicit boundary categories.

## New CounterTransition focused tests

Add a dedicated focused test file if useful.

Must cover at least:

### Entry / duration
1. Success capture starts active CounterTransition
2. Best capture starts active CounterTransition
3. capture tick does not teleport Counter user
4. `ticksRemaining` / duration is exactly 120 transition ticks
5. same intent script reproduces identical transition path.

### Input lock
6. movement ignored for both participants
7. Push press ignored/discarded
8. Counter press ignored/discarded
9. Grip press ignored/discarded
10. Drive ignored
11. held movement works on first post-transition tick
12. old discrete press is not queued.

### D1 / path
13. pusher final stagger displacement = 1.0R for ordinary valid case
14. Success final relative geometry = true side at combined distance
15. Best final relative geometry = true rear at combined distance
16. Counter user does not overlap/pass through pusher during transition
17. Success both side preferences
18. Best preferred wrap direction deterministic.

### D3 momentum
19. entry clears pre-existing self velocity
20. entry clears pre-existing external velocity
21. path movement is not affected by pre-entry momentum.

### Velocity semantics
22. pusher Snapshot external velocity matches per-tick displacement
23. Counter user Snapshot self velocity matches per-tick displacement
24. normal completion zeroes transition velocities.

### Contact
25. transition path not altered by ordinary contact correction
26. pair separation remains valid every transition tick.

### Ring-out / Tokudawara
27. pusher can ring out mid-transition and loses immediately
28. Counter user can ring out mid-transition and loses immediately
29. both crossing same tick uses existing earliest-exit ordering
30. effectively simultaneous crossing yields Rematch
31. exact boundary remains IN
32. Tokudawara cardinal extension respected during transition
33. Tokudawara side-window path exit/re-entry uses existing first-exit semantics
34. outcome freeze preserves deciding-tick transition state/position.

### D2 Kuzushi
35. pusher Kuzushi does not count down during transition
36. completion resets full `KUZUSHI_TICKS`
37. Counter user can start Grip after transition completion
38. existing Counter -> Grip/Morozashi opportunity is preserved after completion.

### Failed Counter
39. failed Counter remains current Kuzushi-only behavior
40. failed Counter does not create CounterTransition.

### Null / invalid target
41. preserve accepted current no-target fallback semantics or STOP if design conflict is discovered
42. no NaN / overlap / invalid ring-out behavior in this case.

### Snapshot
43. `counterTransition` is deep-copied / isolated
44. all exact top-level Snapshot-key assertions updated deliberately
45. transition roles/tier/ticks are correct in Snapshot.

### Symmetry / roles
46. mirror participant IDs / left-right setup gives symmetric semantics
47. player/dummy ownership does not change gameplay result.

---

# Existing Regression Tests

Update affected existing tests intentionally, including:

- `BoutCounterPosition.test.ts`
- `BoutCounter.test.ts`
- `BoutGrip.test.ts`
- `BoutOrientation.test.ts`
- `BoutRingOut.test.ts`
- `BoutTokudawara.test.ts`
- `pushDummyController.test.ts`
- Snapshot shape assertions elsewhere.

Do not weaken existing unrelated assertions just to make tests pass.

Preserve:
- Counter tier boundary
- Success side preference
- Best rear preference
- failed Counter semantics
- fixed-step determinism
- ring-out winner semantics
- Tokudawara semantics.

---

# Project Verification

Run:

```
pnpm test
pnpm build
git diff --check
```

Focused tests first.

No required Python art tests unless a touched file unexpectedly requires them; this Task does not change art assets/tooling.

---

# Browser / Runtime Smoke

Required if environment supports it.

Verify:

- no runtime console errors
- pre-bout/Enter flow works
- blue/red rigid sprites still load
- Counter Success visibly moves to side rather than teleport
- Counter Best visibly moves behind rather than teleport
- pusher moves forward continuously
- both remain uncontrollable during transition
- after transition Counter user can act
- pusher remains Kuzushi briefly
- R restart works
- debug root/facing remain aligned.

If Browser Smoke cannot be run:
report NOT RUN and do not claim visual/runtime PASS.

---

# User Play Test — REQUIRED

This is a Game Feel / Action transition.

Technical PASS is not Product acceptance.

User should specifically reproduce:

## Success
- opponent Push with Up
- Down Counter at Success timing
- observe ~2 s side transition.

Check:
- no teleport
- successful side moves naturally
- pusher visibly staggers forward
- controls are locked
- final side position still feels like current accepted behavior.

## Best
- opponent Push with Up
- Down Counter at Best timing
- observe ~2 s rear transition.

Check:
- no teleport
- wrap-behind motion is readable
- pusher stagger is readable
- final rear position remains correct
- no awkward spin/overlap.

## Edge cases
- near dohyo edge
- Tokudawara direction if practical
- observe ring-out during transition.

## Post-transition
- confirm Counter -> Grip / Morozashi opening still exists
- judge whether extra 0.5 s Kuzushi is too long/short.

## Visual note
Current same rigid sprite remains intentional during this Task.
Dedicated Counter attempt/whiff art is separate.

---

# Acceptance Criteria

PASS technically only if:

1. Simulation-owned pair CounterTransition exists
2. Success/Best no longer teleport for valid transition cases
3. duration = 120 fixed ticks
4. D1 = 1.0R pusher stagger
5. D2 = full Kuzushi after transition
6. D3 = old momentum absorbed/cleared
7. D4 = final side/rear relative to final pusher position
8. both participants input-locked
9. canonical positions move continuously
10. no presentation-only duplicate position
11. contact does not fight scripted path
12. ordinary ring-out/Tokudawara applies to both every transition tick
13. outcome freeze works
14. Snapshot exposes minimal transition state
15. failed Counter unchanged
16. Counter timing/tier unchanged
17. tests/build/diff-check pass
18. Browser Smoke PASS or honestly NOT RUN
19. User Play Test marked REQUIRED.

If null-target boundary semantics cannot be preserved without a material gameplay change:
STOP/BLOCKED rather than inventing behavior.

---

# Scope Out

Do NOT:

- create Counter attempt/whiff sprites
- generate new art
- implement Grip/Morozashi art
- implement Tsuri
- change rigid wrestler assets
- change Push/Counter input bindings
- change Counter timing window
- change tier boundary
- change failed Counter penalty
- change accepted Success/Best meaning
- add Phaser tween gameplay movement
- change ring-out winner semantics
- change Tokudawara geometry
- refactor unrelated Simulation systems.

---

# Documentation

Update minimally after implementation:

- `docs/ARCHITECTURE.md`
  - CounterTransition ownership/tick order
- relevant gameplay/SPEC documentation only if current docs would materially lie after implementation.

Do not broadly rewrite historical art docs.

---

# Implementation Evidence

Completion Report must include:

| Design Requirement | Implementation Evidence | Verified By |
|---|---|---|

At minimum:
- pair-level canonical transition
- 120 ticks
- D1
- D2
- D3
- D4
- input lock
- contact bypass
- ring-out/Tokudawara
- velocity bookkeeping
- Snapshot exposure
- failed Counter unchanged.

---

# Completion Report

Include:

- Result
- Preflight
- Current Source delta
- State shape
- Entry semantics
- Transition tick order
- Completion semantics
- Success / Best path
- null-target behavior
- D1–D4 evidence
- Input lock evidence
- Contact evidence
- Ring-out/Tokudawara evidence
- Facing evidence
- Velocity evidence
- Kuzushi / Morozashi follow-up evidence
- Snapshot/API changes
- Changed Files
- Tests
- Build
- Browser/Runtime Smoke
- User Play Test Required
- Implementation Evidence
- Design Deviations
- Unexpected Scope
- Git delivery.

---

# Design Deviations

Required.

If none:

`Design Deviations: NONE`

STOP before semantic deviation if implementation would require:
- changing D1–D4
- changing Success/Best result meaning
- changing ring-out winner rules
- Counter-user ring-out immunity
- new failed-Counter semantics
- Phaser-owned gameplay movement.

---

# Git Delivery

Follow `AGENTS.md`.

Expected Task-owned files may include:

- `src/game/sumo/BoutTypes.ts`
- `src/game/sumo/BoutSimulation.ts`
- focused CounterTransition tests
- affected Counter/Grip/Orientation/RingOut/Tokudawara tests
- `src/game/input/pushDummyController.ts` + test
- optional minimal debug presentation wiring
- `docs/ARCHITECTURE.md`
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`.

Do not stage unrelated files.

Suggested commit:

`feat: animate counter resolution in simulation`

Push `origin/develop`.
Do not modify `main`.

# Final Instruction

Implement only the accepted Simulation-owned Counter Success/Best transition.

Do NOT add Counter art or Grip art.

After commit/push/report:

「ACTION-04A4-COUNTER-TRANSITION-IMPLEMENTATION が完了し、ChatGPT ReviewとUser Play Test待ちです」
