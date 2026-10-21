Task-ID: ACTION-04A5-COUNTER-TRANSITION-DURATION-TUNING
Status: REVIEWED
Task-Type: IMPLEMENTATION / GAME FEEL TUNING / COUNTER TRANSITION
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: e91e4a3ed079500223afa16f8deed7105943be9a
Handoff-Mode: GITHUB

# ACTION-04A5 — Counter Transition Duration 2.0s -> 1.5s

## Purpose

Tune the accepted ACTION-04A4 CounterTransition duration from approximately 2.0 seconds to approximately 1.5 seconds.

User Play Test result on ACTION-04A4:
- the continuous Success / Best transition itself feels good
- the current ~2.0 second duration feels slightly too long
- reduce the transition to ~1.5 seconds
- do not redesign the path, final placement, stagger distance, input semantics, or Counter rules.

At the current 60 Hz logical tick rate, use:

```
COUNTER_TRANSITION_TICKS = 90
```

This is a focused tuning task, not a Counter redesign.

---

# Current Baseline

Implementation baseline:
`e91e4a3ed079500223afa16f8deed7105943be9a`

ACTION-04A4 currently provides:
- Simulation-owned pair-level `counterTransition`
- Success -> true side
- Best -> true rear/back
- pusher stagger distance = 1.0R = 0.35 m
- input lock for both participants during transition
- path-owned canonical positions
- ordinary ring-out / Tokudawara for both participants
- full `KUZUSHI_TICKS` after normal transition completion
- no Phaser-owned gameplay tween.

These semantics are the baseline and must be preserved unless explicitly listed below.

---

# Accepted User Decision — Do Not Reopen

Change only the duration baseline:

```
120 ticks (~2.0 s)
->
90 ticks (~1.5 s)
```

The purpose is to make the same motion feel more responsive.

Do not reinterpret this as:
- shorter stagger distance
- different Success / Best endpoint
- different easing
- different Counter timing window
- different Kuzushi duration.

---

# Must Preserve

## D1 — Stagger distance
Keep:
```
COUNTER_STAGGER_DISTANCE = 1.0R = 0.35 m
```

## D2 — Post-transition Kuzushi
Keep the full existing:
```
KUZUSHI_TICKS = 30
```
after normal transition completion.

## D3 — Entry momentum
Keep clearing both participants' self / external velocity at valid CounterTransition entry.

## D4 — Final placement
Keep:
- Success = pusher's true side
- Best = pusher's true rear/back
- center distance = current combined body radius/contact distance
- endpoint relative to the pusher's final stagger position.

## Path / easing
Keep the existing A4 path and easing functions unchanged unless a code-only mechanical adjustment is required by the tick-count constant.

## Input lock
Keep both participants input-locked for the entire active CounterTransition.
- held movement becomes effective on the first normal tick after completion
- discrete presses during the transition are discarded, not queued.

## Ring-out / Tokudawara
Keep current A4 semantics unchanged.
- both participants remain subject to ordinary ring-out every transition tick
- no Counter-user immunity
- outcome freeze remains unchanged.

## Null target / Failed Counter
Keep existing behavior unchanged.
- no-valid-target fallback remains ACTION-04A2 behavior
- failed Counter does not start CounterTransition.

---

# Scope

Expected production changes should be small.

Likely:
- `src/game/sumo/BoutSimulation.ts`
  - `COUNTER_TRANSITION_TICKS = 90`
- affected CounterTransition / regression tests that assert exact duration or tick counts
- `docs/ARCHITECTURE.md`
  - update current duration description from 120 / ~2.0s to 90 / ~1.5s
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

Update additional task-owned tests only if they explicitly depend on the old 120-tick timing.

---

# Scope Out

Do NOT:
- change Success / Best geometry
- change `COUNTER_STAGGER_DISTANCE`
- change easing curves
- add Counter art
- add Grip / Morozashi art
- change Counter timing window / tier boundary
- change failed-Counter penalty
- change ring-out winner semantics
- change Tokudawara geometry
- change null-target fallback
- change Kuzushi duration
- add Phaser tween gameplay movement
- fix the deferred post-Kuzushi facing snap
- refactor unrelated Simulation code.

If a non-trivial semantic change seems necessary to make 90 ticks work, STOP and report instead of expanding scope.

---

# Required Reading

Read directly:
- `AGENTS.md`
- `CLAUDE.md`
- current `docs/agent_handoff/CURRENT_TASK.md`
- current `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- `docs/ARCHITECTURE.md`
- `src/game/sumo/BoutSimulation.ts`
- `src/game/sumo/BoutCounterTransition.test.ts`
- `src/game/sumo/BoutCounterPosition.test.ts`
- `src/game/sumo/BoutGrip.test.ts`
- `src/game/input/pushDummyController.test.ts`

Inspect any additional current test only when needed because it depends on transition duration.

---

# Implementation Direction

Use the existing fixed-step transition design.

The expected semantic change is only:

```
COUNTER_TRANSITION_TICKS: 120 -> 90
```

At 60 Hz:
```
90 / 60 = 1.5 seconds
```

The same normalized path should still use:
```
u = ticksElapsed / COUNTER_TRANSITION_TICKS
```

Therefore:
- start geometry remains the same
- end geometry remains the same
- total displacement remains the same
- only the time to traverse the path becomes shorter.

Do not compensate by changing distance or easing.

---

# Verification

Verification Level:
Focused Standard + Runtime Smoke + User Play Test

Run focused tests first, then project checks.

Required:
```
pnpm test
pnpm build
git diff --check
```

At minimum verify:

1. valid Success starts `counterTransition` with `ticksRemaining = 90`
2. valid Best starts `counterTransition` with `ticksRemaining = 90`
3. capture tick still does not teleport
4. exactly 90 transition ticks are required for normal completion
5. transition is still active after 89 transition ticks
6. transition is `none` after the 90th transition tick when outcome remains ongoing
7. normal input resumes on the next tick
8. discrete action edges pressed during transition remain discarded
9. pusher total stagger displacement remains exactly 0.35 m for ordinary valid cases
10. Success final side geometry is unchanged
11. Best final rear geometry is unchanged
12. pair separation/non-overlap invariant remains valid
13. entry momentum clearing is unchanged
14. per-tick velocity bookkeeping still matches actual path displacement
15. normal completion still zeroes transition velocities
16. pusher Kuzushi remains paused during transition
17. completion still restores the full existing `KUZUSHI_TICKS`
18. Counter -> Grip / Morozashi follow-up remains available
19. failed Counter remains unchanged
20. no-valid-target fallback remains unchanged
21. Snapshot `ticksRemaining` semantics remain correct
22. deterministic replay remains deterministic.

Do not weaken unrelated assertions just to accommodate the new duration.

---

# Previous A4 Known Untested Items

ACTION-04A4 reported some explicit ring-out boundary fixtures that were not naturally reproduced in the actual transition geometry.

This tuning task does not redesign or claim to close those items.

Carry them forward honestly in the Completion Report if they remain unresolved:
- explicit natural transition fixture where both participants leave on the same tick
- explicit Tokudawara side-window same-tick exit/re-entry fixture
- real-GPU browser rendering remains subject to User Play Test.

Do not silently convert those inherited items to PASS.

---

# Browser / Runtime Smoke

Required if environment supports it.

Verify in the actual game flow:
- pre-bout -> Enter still works
- Success Counter visibly completes in about 1.5 seconds
- Best Counter visibly completes in about 1.5 seconds
- no teleport returns
- pusher still travels the same 1.0R distance
- Success still ends at side
- Best still ends behind
- both remain uncontrollable during transition
- after transition the Counter user can act
- pusher remains Kuzushi briefly
- R restart still works
- no new runtime console errors.

If browser/runtime smoke cannot be run, report NOT RUN.

---

# User Play Test — REQUIRED

Technical PASS is not gameplay acceptance.

After implementation, User should test:

## Success
- trigger Success Counter
- confirm the same side movement now feels better at ~1.5 s
- confirm it does not feel abrupt or too fast.

## Best
- trigger Best Counter
- confirm the wrap-behind remains readable at ~1.5 s
- confirm pusher stagger still reads clearly.

## Post-transition
- confirm control returns at a natural time
- confirm Counter -> Grip / Morozashi opportunity still feels understandable.

The final feel decision remains User-owned.

---

# Acceptance Criteria

Technical PASS requires:
1. `COUNTER_TRANSITION_TICKS = 90`
2. normal valid CounterTransition duration = exactly 90 fixed ticks
3. A4 D1-D4 semantics preserved
4. Success / Best endpoints unchanged
5. path/easing unchanged
6. input-lock semantics unchanged
7. ring-out/Tokudawara semantics unchanged
8. null-target fallback unchanged
9. failed Counter unchanged
10. post-transition Kuzushi remains 30 ticks
11. affected tests updated intentionally
12. `pnpm test` PASS
13. `pnpm build` PASS
14. `git diff --check` PASS
15. Browser/runtime smoke PASS or honestly NOT RUN
16. User Play Test marked REQUIRED.

---

# Completion Report

Include:
- Result
- Preflight
- exact duration change
- changed files
- tests updated
- verification
- browser/runtime smoke
- confirmation that D1-D4 are preserved
- confirmation that easing/path are unchanged
- confirmation that input / ring-out / null-target / failed-Counter semantics are unchanged
- inherited A4 Known Untested Items
- User Play Test Required
- Design Deviations
- Unexpected Scope
- Git delivery.

Design Deviations:
If none, write:
`Design Deviations: NONE`

---

# Git Delivery

Follow `AGENTS.md`.

Expected task-owned files:
- `src/game/sumo/BoutSimulation.ts`
- affected CounterTransition / regression tests
- `docs/ARCHITECTURE.md`
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

Do not modify `CURRENT_TASK.md`.

Suggested commit:
`tune: shorten counter transition`

Push `origin/develop`.
Do not modify `main`.

# Final Instruction

Implement only the accepted CounterTransition duration tuning from ~2.0 s to ~1.5 s.

Do not redesign Counter behavior.


---

# ChatGPT Review Handoff

Review-Date: 2026-10-22
Overall Result: TECHNICAL PASS / USER PLAY TEST REQUIRED
Accepted Baseline: 507eea0fbfeb3ee4a4563935051c7e7925cbbd31

## Accepted

- `COUNTER_TRANSITION_TICKS = 90` (~1.5 s at current 60 Hz) is the accepted technical tuning baseline.
- ACTION-04A4 D1-D4 remain preserved:
  - stagger distance 1.0R = 0.35 m
  - full post-transition `KUZUSHI_TICKS = 30`
  - entry self/external momentum cleared for valid transitions
  - Success = true side / Best = true rear relative to final pusher endpoint
- Existing path/easing, input-lock, ring-out/Tokudawara, no-valid-target fallback, failed-Counter, and Counter tier/window semantics are unchanged.
- Implementation scope is appropriately small: one production constant change, one explicit duration assertion update, documentation sync, and Completion Report.
- Reported verification: 292 tests PASS, build PASS, diff-check PASS, browser/runtime smoke PASS.

## Corrections

- None for ACTION-04A5 implementation.
- ACTION-04A4 inherited Known Untested Items remain unresolved and are not converted to PASS by this tuning task.

## Do Not Reopen

Unless the User requests another tuning change:
- do not redesign CounterTransition geometry
- do not change D1-D4
- do not change easing/path because of this duration task
- do not change ring-out/Tokudawara semantics
- do not change null-target fallback or failed-Counter semantics.

## User Play Test

Required before gameplay-feel acceptance.

Check:
- Success side transition at ~1.5 s: natural, not abrupt
- Best wrap-behind at ~1.5 s: readable, not too fast
- pusher stagger remains readable
- control return timing feels natural
- Counter -> Grip / Morozashi follow-up remains understandable.

Technical PASS does not by itself mean the 1.5 s Game Feel is accepted.

## Inherited Known Untested / Deferred

- natural transition fixture where both participants leave the ring on the same tick
- Tokudawara side-window same-tick exit/re-entry explicit fixture
- real-GPU rendering remains User Play Test dependent
- Counter user can lose by crossing out during the transition near the edge (accepted current rule consequence, not changed here)
- post-Kuzushi pusher facing may snap significantly after Best (deferred).

## Next Task Constraint

Do not create a follow-up implementation task solely from this review. First obtain the User Play Test result for the 1.5 s duration.


## User Play Test Result — ACCEPTED

User confirmed the ACTION-04A5 duration tuning at ~1.5 s feels good.

Accepted Game Feel Baseline:
- `COUNTER_TRANSITION_TICKS = 90` (~1.5 s at 60 Hz)

Do Not Reopen unless explicitly requested:
- do not revert to 120 ticks / ~2.0 s
- do not retune the CounterTransition duration as part of unrelated future tasks.

This closes the ACTION-04A5 User Play Test gate.
