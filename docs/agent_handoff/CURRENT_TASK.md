Task-ID: ACTION-03B2-CONTESTED-PUSH-DUMMY
Status: REVIEWED
Task-Type: IMPLEMENTATION / PUSH VALIDATION HARNESS
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: 3c79fc18491c10d58105436b9cc424a608568558
Handoff-Mode: GITHUB

# ACTION-03B2 — Contested Push Dummy

## 1. Purpose

ACTION-03BのDiscrete Push FeelはUser Play TestでCurrent BaselineとしてAcceptされた。

次に、Counter実装へ進む前に最小Dummy opponentを使って、

- 相手から押される
- 押し返す
- Push同士が重なる / 拮抗する
- accepted Contact / Movement / Push baselineが双方向interactionでも壊れない

ことをUser Play Testする。

これは**CPU AI実装ではない**。
既存のsemantic `ParticipantIntent` を毎Simulation tick生成する、決定的なPrototype validation harnessだけを追加する。

Push Coreの仕様・係数は原則変更しない。

## 2. Accepted Production Baseline

Accepted Production Source:

`3c79fc18491c10d58105436b9cc424a608568558`

Current developにはChatGPT Review / User Play Test accept等のcoordination-only commitsがある。
AGENTS.md Remote-Task-First Preflightに従い、
Source-Baseline..origin/developが`docs/agent_handoff/`のみであることを確認してFF-onlyする。

Accepted baseline:

- screen/world-relative WASD
- ArrowUp = temporary Prototype Push key
- one keydown = one discrete Push
- Startup → Active → Recovery
- Push direction locks at action start
- action中はWASD steering lock
- ACTION-02B grounded movement
- ACTION-03A2 Contact / Separation
- Model B selfVelocity / externalVelocity
- Push/contact/movement Feel accepted as current baseline
- Push forward step distance and opponent displacement remain provisional / Deferred tuning
- no Phaser Physics / Matter.js

Do not reopen these without a verified regression.

## 3. Goal of the Dummy

Provide exactly two Prototype opponent modes:

### Mode 1 — STATIONARY

Current baseline.

- opponent emits zero move
- opponent emits no Push edge
- used to compare against accepted ACTION-03B behavior

### Mode 2 — PUSH DUMMY

A small deterministic test opponent.

Behavior:

1. if separated from Player, move directly toward Player using semantic world-frame `move`
2. once in Contact, stop ordinary movement pressure
3. while idle and eligible, emit one discrete `pushPressed: true`
4. let the existing Simulation-owned Startup / Active / Recovery run normally
5. after the Push finishes, wait a short fixed cooldown before the next Push
6. repeat while the mode remains active

The Dummy must use the same `ParticipantIntent` contract as Player/future CPU.

It must NOT:
- modify Simulation state directly
- bypass Push phases
- inject externalVelocity directly
- know Phaser GameObjects
- implement tactics / prediction / counterplay
- chase with sophisticated pathfinding

## 4. Deterministic Dummy Timing

Use Simulation ticks, never render-frame time.

Recommended provisional value:

- `DUMMY_PUSH_COOLDOWN_TICKS = 30` (~500 ms after returning idle before another Push edge)

Exact cooldown may be adjusted slightly if Browser Smoke shows the harness is impractical, but report the final value.

Requirements:

- countdown advances once per Simulation tick
- deterministic
- frame partition independent
- no `setTimeout` / wall-clock timing
- mode switch/restart resets Dummy timing state predictably

## 5. Contact / Approach Decision

The Dummy may use Snapshot geometry only.

Recommended Contact-ready check:

`distance <= bodyRadiusA + bodyRadiusB + CONTACT_SLOP-like tolerance`

Do not import/private-call Simulation contact internals.

To avoid duplicating hidden Gameplay rules:
- either use a small local tolerance in the Dummy harness, clearly labeled as test-harness proximity, or
- expose/reuse an already-public provisional contact constant only if that is already architecturally clean.

Do not redesign Contact API just for the Dummy.

When not in Contact:
- normalize center-to-center direction
- emit that as semantic `move`
- `pushPressed: false`

When in Contact:
- ordinary `move` should be zero for this harness
- Push comes only from discrete Push Action

This keeps the test focused on explicit Push rather than walk-pressure.

## 6. Dummy Controller Boundary

Prefer one small Pure TypeScript module, for example:

`src/game/input/pushDummyController.ts`

or another nearby explicit name.

Recommended conceptual API may be stateful or state-in/state-out, but must remain small.

It should consume only semantic/runtime data needed to decide an Intent, such as:

- current `BoutSnapshot`
- dummy participant id
- internal cooldown state

It returns a normal `ParticipantIntent`.

No Phaser import.
No generic AI interface/framework.

If a simpler pure function + tiny state object is enough, prefer that.

## 7. Scene Integration

Add a small Prototype mode switch.

Recommended keys:

- `1` = STATIONARY
- `2` = PUSH DUMMY

These are test harness bindings only.

Requirements:

- default may remain STATIONARY
- changing mode resets Dummy controller timing state
- `R` restart resets Simulation and Dummy timing state, while either:
  - preserving currently selected mode, or
  - returning to STATIONARY
  Choose one and report it; do not overengineer settings.
- Player controls remain:
  - WASD movement
  - ArrowUp Push

Show a tiny presentation-only mode label, e.g.:

`DUMMY: STATIONARY`
`DUMMY: PUSH`

No full UI.

CPU Push phases should continue to use existing STARTUP / PUSH / RECOVERY phase display, so User can time contested Push attempts.

## 8. Critical Tick Integration Rule

Dummy Intent must be generated **per Simulation tick**, not once per render frame and reused for N ticks.

Reason:
- Dummy cooldown is tick-based
- `pushPressed` is an edge
- multi-tick render frames must not repeat one Dummy Push edge

Player ArrowUp latch behavior remains unchanged:
- pending Player edge consumed only once
- only first tick receives true

For each Simulation tick:

1. construct Player intent for that tick
2. construct Dummy intent for that tick from current Simulation Snapshot/controller state
3. call `simulation.step(intents)`
4. advance/update Dummy controller state only according to its explicit deterministic design

Do not make Scene frame rate alter Dummy behavior.

## 9. Preserve Push Core

Do not modify the following unless a real bug is proven and STOP/Report is required:

- PUSH_STARTUP_TICKS
- PUSH_ACTIVE_TICKS
- PUSH_RECOVERY_TICKS
- PUSH_EXTERNAL_ACCELERATION
- EXTERNAL_DECELERATION
- MAX_EXTERNAL_SPEED
- Push direction lock
- steering suppression
- selfVelocity/externalVelocity separation
- contact separation semantics
- Player PressLatch semantics

This Task validates the accepted Push Core; it is not a tuning Task.

## 10. Contested Push Semantics to Validate

Existing Simulation behavior already defines equal-stat simultaneous Push:

- both Active at the same time → net Push acceleration = 0
- partial phase overlap → only overlapping Active ticks cancel; unmatched Active ticks still drive

Do not add a new "clash" rule.

The purpose is to make this existing behavior interactively observable.

Because Push phases are visible, User should be able to:
- see Dummy STARTUP
- press ArrowUp at a chosen timing
- create overlapping Active windows
- feel more/less cancellation depending on timing

Do not add Counter mechanics yet.

## 11. Scope

Allowed:

- small Pure Dummy controller module + focused tests
- `src/game/scenes/BoutScene.ts`
- smallest type additions needed only for harness mode if unavoidable
- `docs/ARCHITECTURE.md` Current State sync
- `AGENTS.md` Current Source sync only if materially needed
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

Core Simulation files should remain unchanged if possible.

A comment-only correction to previously noted `externalVelocity` wording is allowed only if that file is otherwise legitimately touched; do not touch core Source solely for wording cleanup.

No new dependency.

## 12. Scope Out

Do NOT implement:

- real CPU AI
- difficulty
- random timing
- prediction of Player input
- ↓ pull / deflection / Counter
- dodge Action
- left/right thrust
- Push tuning changes
- Weight / Power / LowerBody
- mass / traction / pushForce
- Stamina / Balance
- Ring-out / BoutOutcome
- Tachiai
- Grapple / Throw / Lift
- animation framework
- VFX / camera / audio
- Touch / Gamepad
- Phaser Physics / Matter.js
- generic Controller/AI framework

## 13. Required Automated Verification

Existing 75 tests must remain PASS.

Add focused tests at minimum:

T50. STATIONARY mode
- emits zero move
- emits no Push edge
- deterministic

T51. PUSH DUMMY approach
- when separated, emits normalized move toward Player
- no Push edge while separated

T52. Contact Push edge
- when Contact-ready, idle, and cooldown-ready:
  - move = zero
  - emits exactly one `pushPressed: true`
- next tick does not repeat the edge

T53. Action respect
- while Dummy action is startup / active / recovery:
  - controller does not emit additional Push edges
  - ordinary harness move remains zero in Contact

T54. Cooldown
- after action returns idle, no new edge until exact cooldown expires
- then exactly one new Push edge
- deterministic tick count

T55. Mode/reset state
- switching mode resets pending cooldown/controller state as designed
- restart state is deterministic

T56. Multi-tick integration safety
- one Dummy Push edge cannot be reused for multiple Simulation ticks
- behavior depends on Simulation tick count, not render-frame grouping

T57. Contested equal Push integration
- use Dummy-generated semantic edge + Player semantic edge in a focused integration test
- overlapping equal Active windows preserve existing zero-net behavior
- no NaN / overlap/jitter

T58. Incoming Push
- Dummy can move Player backward through the existing Push Core
- no direct state mutation / external injection by controller

T59. Baseline regressions
- STATIONARY mode reproduces current accepted Player-vs-stationary behavior
- existing 75 tests all PASS
- Simulation remains Phaser-free

Do not make brittle assertions about final feel/tuning values beyond the accepted constants.

## 14. Verification Level

Heavy / Interaction Validation.

Required:

- `pnpm test` PASS
- `pnpm build` PASS
- `git diff --check` PASS
- T50〜T59 evidence
- existing 75 tests PASS
- no Simulation Core semantic change unless explicitly reported
- no new dependency
- Dummy module Phaser-free
- no AI/Counter/Ring-out scope creep

### Browser Smoke

Verify:

- Canvas starts; no runtime/console errors
- Mode 1: CPU remains stationary and accepted Push behavior is unchanged
- Mode 2: CPU approaches Player
- on Contact, CPU performs visible discrete Push phases
- CPU Push can drive Player backward
- CPU does not spam Push every tick
- Player ArrowUp still produces one Push per keydown
- User can time Player Push against Dummy STARTUP/PUSH and observe contested movement
- equal/near-equal timing can reduce/cancel movement compared with taking the Push uncontested
- mode switching works
- R restart works with the documented mode behavior
- no Contact creep when no Push is active
- ring remains non-functional

Browser Smoke is technical only; contested Push Feel requires User Play Test.

## 15. User Play Test — REQUIRED

User should compare Mode 1 and Mode 2.

Check:

1. Being pushed by the Dummy feels like the same Push system viewed from the receiving side.
2. Incoming Push does not produce unexpected skating/jitter/contact breakage.
3. The Dummy's rhythm is predictable enough to test timing, without feeling like real AI.
4. Watching CPU STARTUP / PUSH gives enough information to attempt a timed Push back.
5. Matching Push timing produces a believable sense of contest / stalemate.
6. Mistimed Push timing lets one side gain ground in an understandable way.
7. Accepted Player Push Feel remains intact.
8. Contact-only behavior remains intact between Pushes.
9. The interaction feels like a viable base for the future ↓ pull/deflection Counter.
10. Report whether Push-vs-Push currently feels too binary, too slippery, or too momentum-heavy.

Agent must report:

`User Play Test: REQUIRED / NOT RUN`

Technical PASS != contested Push accepted.

## 16. Acceptance Criteria

AC-01: a minimal deterministic non-AI Push Dummy exists.
AC-02: Mode 1 preserves stationary baseline.
AC-03: Mode 2 approaches Player using semantic move intent.
AC-04: Mode 2 uses discrete semantic Push edges only.
AC-05: Dummy Push timing is fixed-tick deterministic.
AC-06: no render-frame-dependent repeated Push edge.
AC-07: Dummy respects existing Simulation action phases.
AC-08: incoming Push uses existing Push Core, not direct state mutation.
AC-09: contested equal Push behavior remains existing zero-net semantics.
AC-10: accepted Player Input/Push behavior is unchanged.
AC-11: accepted Contact/Movement behavior is unchanged when Push inactive.
AC-12: no Push tuning/core semantic changes.
AC-13: no CPU AI / Counter / Ring-out / attributes scope creep.
AC-14: T50〜T59 + existing tests PASS.
AC-15: `pnpm build` PASS.
AC-16: Browser Smoke PASS.
AC-17: Current State docs match material changes.
AC-18: User Play Test REQUIRED / NOT RUN.
AC-19: Scope外変更なし.

## 17. Stop Conditions

STOP if:

- Preflight fails
- Current Source / Handoff conflict
- Dummy validation requires changing accepted Push formula/phase semantics
- incoming Push reveals a Core bug requiring material Simulation redesign
- a real CPU AI system appears necessary
- Controller framework becomes necessary
- new dependency/Physics required
- task-external User changes / divergence exist

If a Core Push bug is discovered, do not fix it under the Dummy Task. Report and stop for review.

## 18. Completion Report

Minimum:

- Result
- Preflight
- Changed Files
- Dummy Controller design
- mode controls
- fixed-tick timing/cooldown
- per-tick Scene integration
- T50〜T59 + regression tests
- Browser Smoke
- AC-01〜AC-19
- Implementation Evidence
- Design Deviations
- Unexpected Scope
- Known Untested
- User Play Test: REQUIRED / NOT RUN
- Git delivery

Implementation Evidence minimum:

1. STATIONARY baseline
2. deterministic approach
3. one-edge Dummy Push
4. cooldown/action respect
5. per-tick integration
6. incoming Push through existing Core
7. contested Push through existing Core
8. no Core/AI scope creep

## 19. Git Delivery

Follow AGENTS.md.

Technical PASS:

- Task-owned files only
- tests / build / diff-check
- Completion Report in same Task commit
- 1 Agent Task ≈ 1 commit
- push `origin/develop`
- verify remote SHA / clean working tree

Commit message example:

`feat: add contested push dummy`

Do not change main.

## 20. Final Instruction

This Task ends at contested Push validation harness.

Do not continue to Counter / AI / Ring-out / attributes.

After commit / push / Completion Report, stop and report:

「ACTION-03B2-CONTESTED-PUSH-DUMMY が完了し、ChatGPT ReviewとUser Play Test待ちです」


# Final ChatGPT Review

Overall Result: PARTIAL — SOURCE / AUTOMATED VERIFICATION PASS, REQUIRED BROWSER SMOKE NOT RUN

## Reviewed Implementation

- Implementation commit: `730ba8f6fc1fbe8cb8dd939f61e2a67ab0180f17`
- Coordination head before implementation: `bd616cce20c269dd7b5af0cbcde181de5a928a47`
- Agent Task Diff is exactly one implementation commit from that coordination head.
- Core Simulation files were not modified.
- Push constants / phase semantics / Contact core were not modified.
- Changed production scope is limited to:
  - Pure PushDummyController
  - focused tests
  - BoutScene harness integration
  - Current-State docs

## Implementation Result

SOURCE REVIEW: PASS

Accepted implementation details:

- PushDummyController is Pure TypeScript and Phaser-free.
- It returns ordinary semantic `ParticipantIntent`; it does not mutate Simulation state.
- STATIONARY and PUSH modes are explicit and minimal.
- PUSH mode approaches using normalized world-frame movement.
- At Contact-ready range it stops ordinary movement and emits discrete Push edges only.
- Existing Simulation-owned startup / active / recovery phases are respected.
- Cooldown is fixed-tick deterministic (`DUMMY_PUSH_COOLDOWN_TICKS = 30`).
- Dummy intent is regenerated once per Simulation tick from the current Snapshot.
- One Dummy Push edge is not reused across multiple fixed ticks in one render frame.
- Existing accepted Push Core is used for incoming and contested Push.
- No AI tactics, randomness, prediction, Counter, Ring-out, attributes, Physics, or new dependency were introduced.
- Mode keys 1/2 and presentation-only mode label are appropriately scoped.
- R restart resets Dummy timing and preserves selected mode.
- Existing Push / Contact / Movement source semantics remain unchanged.

## Automated Verification

Reported and Source-consistent:

- `pnpm test`: 86/86 PASS
- `pnpm build`: PASS
- `git diff --check`: PASS
- T50–T59 covered
- existing 75 tests remain PASS

## Blocking Verification Gap

Browser Smoke: REQUIRED / NOT RUN.

The Task explicitly required runtime verification of:

- keys 1 / 2 / R
- mode label
- Mode 2 approach in the actual Phaser Scene
- visible CPU Startup / Push / Recovery
- incoming Push moving Player
- Player ArrowUp remaining one-edge
- contested timing being observable
- no runtime / console errors

Because the Agent environment had no browser automation capability, these checks were not executed.

Per repository Verification Policy, a required verification item that is NOT RUN prevents Overall PASS.

No source correction is required before performing this check.

## Non-Blocking Report Correction

The Completion Report lists:

`Agent-Start-Head: 3c79fc18491c10d58105436b9cc424a608568558`

but the Agent also reports that it then fast-forwarded the coordination commit and began work from `bd616cce...`.

For review semantics, the effective Agent Task start head / diff base is:

`bd616cce20c269dd7b5af0cbcde181de5a928a47`

This metadata discrepancy does not affect the implementation, but future Completion Reports should use the post-preflight / post-FF head as Agent-Start-Head.

## User Browser Smoke + Play Test

READY for User manual verification.

Run:

`pnpm dev`

Then verify:

1. Default display says `DUMMY: STATIONARY`.
2. In Mode 1, CPU stays stationary and current Player Push behavior remains unchanged.
3. Press `2`: label changes to `DUMMY: PUSH`.
4. CPU approaches Player rather than teleporting or sliding erratically.
5. On contact, CPU visibly cycles STARTUP → PUSH → RECOVERY.
6. CPU can push Player backward.
7. CPU does not spam a Push every tick; there is a readable interval between actions.
8. ArrowUp still triggers only one Player Push per physical press.
9. Time ArrowUp against CPU STARTUP/PUSH:
   - near-simultaneous Active windows should reduce/cancel net movement relative to taking the Push uncontested.
10. Press `1`: CPU returns to stationary harness behavior.
11. Press `R`: positions reset and selected Dummy mode remains active.
12. No visible contact jitter / creep between Pushes.
13. No runtime or console error.
14. Ring-out remains intentionally non-functional.

Feel questions:

- Does being pushed feel like the same system from the receiving side?
- Is the Dummy rhythm readable enough for timing practice?
- Does matched Push timing feel like a believable contest/stalemate?
- Does mistiming clearly give ground to one side?
- Does Push-vs-Push feel too binary, slippery, or momentum-heavy?
- Is this a good base for the future ↓ pull/deflection Counter?

## Acceptance State

Contested Push Harness: NOT YET ACCEPTED.

If the User Browser Smoke passes and the interaction feels acceptable:
- ACTION-03B2 may become the current validation baseline.
- No additional Dummy tuning is required unless User feedback identifies a concrete issue.
- Next work may move to focused design of ↓ pull / deflection Counter.

If Browser Smoke reveals a functional/runtime problem:
- do not proceed to Counter.
- create a focused correction task for the observed issue.

## Do Not Reopen

- accepted ACTION-03B Push timings / constants merely because Dummy exists
- Player one-keydown-one-Push semantics
- accepted Contact/Movement baseline
- Simulation Push Core unless a concrete runtime defect is reproduced
- Dummy into a full CPU AI system

## Deferred

- real CPU AI
- Counter / pull / deflection
- dodge
- thrust
- Weight / Power / LowerBody
- Ring-out
- Stamina / Balance
- Tachiai
- Grapple / Throw / Lift
