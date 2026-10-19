Task-ID: ACTION-04A1-COUNTER-KUZUSHI-FOUNDATION
Status: REVIEWED
Task-Type: IMPLEMENTATION / CORE COUNTER FOUNDATION
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: 730ba8f6fc1fbe8cb8dd939f61e2a67ab0180f17
Handoff-Mode: GITHUB

# ACTION-04A1 — Counter + Kuzushi Foundation

## 1. Purpose

ACTION-04 Investigation / ChatGPT Review / User Decisionに基づき、
Down CounterとKuzushiの**Gameplay foundationだけ**を実装する。

このTaskでは：

- ArrowDown = 1押下1回のCounter attempt
- Counter window
- Push Active + Contactとのtiming判定
- Best / Success / Fail tier判定
- Kuzushi posture
- Counter成功 → Push attackerがKuzushi
- Counter失敗 → Counter userがKuzushi
- Kuzushi中の行動不能 / movement brake / facing freeze
- Kuzushi中はPushされやすい
- Push DummyがKuzushiを尊重
- 最小presentation

までを成立させる。

**まだ実装しない：**
- Bestの背後移動
- Successの側面移動
- attacker overshoot
- 即決着 / 確率
- Grip
- Harite

これらはACTION-04A2以降。

## 2. Accepted User Decisions

### UD-1 — Counter meaning

ACCEPTED:

**1つの共有Down Counter**

- Best = pull-style result
- Success = deflection-style result
- Fail = Counter user Kuzushi

ACTION-04A1ではBest/Successとも「相手をKuzushi」にするところまで。
位置差はACTION-04A2で付ける。

### UD-2 — Prototype key

ACCEPTED:

`ArrowDown`

Temporary Prototype binding only。

### UD-3 — Failed Counter presentation

ACCEPTED:

- forced backward stepなし
- Counter window終了
- Counter userがKuzushi
- presentationは `COUNTER → KUZUSHI`

Gameplay penaltyはKuzushiそのもの。

### UD-4 — Best Push instant finish

ACCEPTED:

**最初のPrototypeでは省略。**

- PRNGなし
- BoutOutcomeなし
- 即決着なし
- Best成功はこのTaskでは相手Kuzushiまで

ACTION-04A2でrear positional rewardを追加する。
確率決着は将来のBoutOutcome / Parameters / deterministic RNG設計後。

## 3. Accepted Production Baseline

Accepted Production Source:

`730ba8f6fc1fbe8cb8dd939f61e2a67ab0180f17`

Current developにはReport / Review / User Decision等のcoordination-only commitsがある。

AGENTS.md Remote-Task-First Preflightに従い、
Source-Baseline..origin/developが`docs/agent_handoff/`だけであることを確認してFF-onlyする。

Preserve:

- screen/world-relative WASD
- ACTION-02B grounded Movement
- ACTION-03A2 Contact / Separation
- ArrowUp = discrete Push
- Push Startup / Active / Recovery
- Push direction lock
- Push steering lock
- selfVelocity / externalVelocity Model B
- accepted incoming / contested Push
- Push Dummy validation harness
- current provisional Push values
- current Push distance is Deferred tuning; do not change

## 4. Counter Input

Extend semantic intent minimally:

```ts
interface ParticipantIntent {
  readonly move: Vec2
  readonly pushPressed: boolean
  readonly counterPressed: boolean
}
```

`counterPressed` means one new semantic edge for one Simulation tick.

Scene:

- existing ArrowUp PressLatch remains
- add a second `PressLatch` instance for ArrowDown
- first subsequent Simulation tick consumes the pending Down edge
- later ticks receive false
- holding ArrowDown does not repeat
- release + new physical press can produce another edge
- no generic Input framework

### Same-tick Player Push + Counter edge

If the same participant receives:

- `pushPressed: true`
- `counterPressed: true`

on the same tick:

**Push wins; Counter edge is discarded.**

Do not queue Counter.

This is an explicit fixed rule.

## 5. Runtime State

### Action

Extend the existing small discriminated union:

```ts
type ParticipantActionState =
  | { kind: 'idle' }
  | { kind: 'push'; ...existing }
  | {
      kind: 'counter'
      ticksRemaining: number
    }
```

Do not add generic action framework.

Counter has one phase/window only in ACTION-04A1.

### Posture

Add a separate canonical runtime posture:

```ts
type ParticipantPosture =
  | { kind: 'stable' }
  | {
      kind: 'kuzushi'
      ticksRemaining: number
    }
```

Semantics:

- action = chosen commitment
- posture = current physical stability

This separation is accepted architecture.

Snapshot exposes an isolated copy of posture.

## 6. Counter Window

Provisional tuning:

- `COUNTER_WINDOW_TICKS = 12` (~200 ms)

Counter can start only when:

- participant posture is stable
- participant action is idle
- Counter edge is true
- no same-tick Push edge won priority

On Counter start:

- action becomes `counter`
- WASD steering is suppressed
- effective self movement = zero
- grounded self velocity brakes normally
- Counter can begin without Contact

During Push / Counter / Kuzushi:
- new Counter edge is ignored
- not queued

## 7. Counter Resolution Conditions

A Counter succeeds on the **first tick** where all are true:

1. defender action = Counter window
2. opponent action = Push Active
3. actual Simulation Contact exists on that tick

Use existing Simulation Contact result.
Do not create a separate near-contact gameplay rule.

Resolution must happen:

**after Contact resolution and before Push force resolution**

so a successful Counter can cancel the attacker's current Push before that tick adds new Push external acceleration.

If the window expires without a qualifying tick:
- Counter fails
- Counter user enters Kuzushi

## 8. Best / Success / Fail Tier

Use an exact unambiguous tick count.

Provisional:

- `COUNTER_BEST_TICKS = 3`

For an opponent currently in Push Active:

```
activeElapsed = PUSH_ACTIVE_TICKS - attacker.action.ticksRemaining

if activeElapsed < COUNTER_BEST_TICKS:
    Best
else:
    Success
```

Thus Best covers exactly:

- Active elapsed 0
- Active elapsed 1
- Active elapsed 2

No frame-perfect one-tick rule.

Fail means the Counter window ends without a qualifying Push Active + Contact tick.

### ACTION-04A1 gameplay result

- Best → attacker Kuzushi
- Success → attacker Kuzushi
- Fail → Counter user Kuzushi

The tier calculation must still be implemented/tested because ACTION-04A2 will attach different positional outcomes.

Do **not** add persistent event/history framework.

If direct testing of the tier classifier needs a small explicit Pure helper, keep it local/small and testable.
Do not add `lastCounter.seq` in this Task.

## 9. Entering Kuzushi

Use one explicit Simulation-owned entry path, e.g. `enterKuzushi()`.

Entering Kuzushi must:

- set posture to Kuzushi
- set its timer
- cancel current action → idle
- not queue previous inputs

Provisional tuning:

- `COUNTER_FAIL_KUZUSHI_TICKS = 30` (~500 ms)
- successful Counter may use the same initial `KUZUSHI_TICKS = 30` in this first Prototype

Prefer one provisional `KUZUSHI_TICKS = 30` unless a code reason clearly requires separate constants.

All values remain User Play Test tuning.

## 10. Kuzushi Tick Ownership / Off-by-One Rule

Make duration semantics exact.

Recommended tick order:

1. advance/decrement **existing** posture timers at the beginning of the Simulation tick
2. if timer expires, posture becomes stable before accepting new actions
3. process new input/actions
4. movement / contact / Counter / Push resolution
5. a Kuzushi entered during this tick starts with the full `KUZUSHI_TICKS` and is not decremented until the next tick

This prevents newly-entered Kuzushi from losing one tick immediately.

If implementation uses an equivalent deterministic scheme, document it and test exact duration.

## 11. Kuzushi Behavior

While posture = Kuzushi:

### Actions

- Push cannot start
- Counter cannot start
- existing action should already be idle
- action edges are ignored, not queued

### Movement

- effective self movement = zero
- existing grounded braking applies to selfVelocity
- do not teleport selfVelocity to zero unless existing brake naturally reaches zero

### Facing

- `updateFacing` must skip a Kuzushi participant
- its facing remains fixed
- stable opponent continues normal auto-facing
- once Kuzushi expires, normal auto-facing resumes

No turn-rate system.

### Push susceptibility

Kuzushi participant must be easier to Push.

Use one named provisional factor:

- `KUZUSHI_PUSH_SUSCEPTIBILITY`

Initial Prototype value:

- **1.5**

This value is provisional and subject to later tuning.

When one active Push is driving the pair:

- determine which participant is being driven backward by the net Push direction
- if that receiving participant is Kuzushi, multiply the Push external acceleration magnitude by `KUZUSHI_PUSH_SUSCEPTIBILITY`
- otherwise use current Push acceleration unchanged

Do not apply the factor to ordinary Movement.
Do not derive from Weight / LowerBody yet.

Equal simultaneous Push behavior when both stable must remain unchanged.

## 12. Grip Guarantee Boundary — DO NOT IMPLEMENT GRIP

Only document / preserve the future boundary.

Future rule:

- first pass valid Grip range/contact check
- if valid and target is Kuzushi, Grip success may bypass the ordinary success roll/check

Do not:
- add Grip action
- add Grip state
- add Grip code
- add Grip range beyond existing Contact mechanics

## 13. Resolution Order

Extend the current explicit fixed-tick order without creating a pipeline framework.

Target high-level order:

0. advance existing posture timers / restore stable if expired
1. sanitize intents
2. start Push or Counter from eligible idle+stable participants
   - same participant: Push edge priority over Counter edge
3. derive effective self move
   - Kuzushi → zero
   - Counter → zero
   - Push → existing Push semantics
   - idle stable → normal move
4. update selfVelocity using existing grounded rule
5. decay externalVelocity
6. integrate positions with self + external
7. resolve Contact / Separation
8. resolve Counter success against current Push Active + Contact
   - successful Counter enters attacker Kuzushi and cancels attacker Push
9. resolve remaining Push force
   - includes Kuzushi susceptibility of receiving participant
10. advance action timers
   - Counter expiration without success → Counter user Kuzushi
   - existing Push transitions unchanged
11. update facing
   - skip Kuzushi participants

Do not add side/rear relocation or overshoot here.

## 14. Push Dummy Update

Existing PushDummyController is a validation harness, not AI.

After posture is added:

- if Dummy participant posture is Kuzushi:
  - emit zero move
  - emit no Push edge
  - hold/reset cooldown at `DUMMY_PUSH_COOLDOWN_TICKS`
- after Kuzushi ends, cooldown begins normally
- do not Push immediately on the first stable tick unless the cooldown semantics explicitly reach ready

Use Snapshot posture only.
Do not access Simulation internals.

## 15. Presentation / Browser Controls

Player controls:

- WASD = movement
- ArrowUp = Push
- ArrowDown = Counter
- 1 / 2 = existing Dummy modes
- R = existing restart behavior

Minimal presentation:

- Counter action: display `COUNTER`
- Kuzushi posture: display `KUZUSHI`

No BEST/SUCCESS/FAIL result history is required in ACTION-04A1.

If both action text and posture text could compete:
- Kuzushi display takes visual priority, because entering Kuzushi cancels action.

No animation framework / VFX.

## 16. Scope

Allowed:

- `src/game/sumo/BoutTypes.ts`
- `src/game/sumo/BoutSimulation.ts`
- existing tests + focused new Counter/Kuzushi tests
- `src/game/input/pushDummyController.ts` + tests
- reuse existing `PressLatch`
- `src/game/scenes/BoutScene.ts`
- `docs/ARCHITECTURE.md`
- `AGENTS.md` only if Current Source responsibility wording materially requires sync
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

A small focused pure helper/module is allowed only if it makes tier/result logic materially clearer.

No new dependency.

## 17. Scope Out

Do NOT implement:

- side relocation
- rear relocation
- automatic side candidate selection
- ring-edge relocation fallback
- attacker overshoot
- Counter relocation animation
- persistent Counter result/event history
- instant/probabilistic bout finish
- seed / PRNG
- BoutOutcome
- Ring-out
- Harite
- Grip
- dedicated Dodge
- left/right thrust
- Weight / Power / LowerBody
- Stamina / Balance
- Tachiai
- Grapple / Throw / Lift
- Push distance tuning
- CPU AI
- Physics engine
- generic action framework

## 18. Required Automated Verification

All existing 86 tests must remain PASS unless only helpers require adding `counterPressed: false`.

Add focused tests at minimum:

T60. Counter edge
- one edge starts exactly one Counter
- hold/mashing during Counter does not repeat or queue
- new edge after returning stable/idle works

T61. Same-tick Push + Counter priority
- same participant receives both edges
- Push starts
- Counter does not start / queue

T62. Counter window duration
- exactly `COUNTER_WINDOW_TICKS`
- no negative timer
- expiry without success → self Kuzushi

T63. Best tier exact boundary
- Push Active elapsed 0,1,2 => Best
- elapsed 3 => Success
- test exact `COUNTER_BEST_TICKS` meaning

T64. Success timing
- later Push Active + Contact resolves success
- attacker Push is cancelled before current tick Push force is applied

T65. No Push / early / late failure
- no qualifying Active+Contact during window → Fail → self Kuzushi
- opponent Recovery does not count

T66. Counter can begin before Contact
- non-contact window waits
- if Contact + Active occurs before expiry, success
- otherwise Fail

T67. Successful Counter Kuzushi
- Best and Success both put attacker into Kuzushi in A1
- defender returns idle/stable
- no relocation occurs

T68. Kuzushi duration
- newly-entered Kuzushi gets full exact duration
- returns stable deterministically
- no off-by-one

T69. Kuzushi action suppression
- Push/Counter edges while Kuzushi are ignored/not queued
- move intent does not steer
- selfVelocity brakes via existing grounded rule

T70. Kuzushi facing freeze
- Kuzushi participant does not auto-face moving opponent
- stable participant still auto-faces
- facing resumes after posture recovery

T71. Kuzushi Push susceptibility
- same one-sided Push against stable vs Kuzushi defender
- Kuzushi case receives larger external pair acceleration by exact provisional factor
- normal stable Push baseline unchanged

T72. Simultaneous Counter
- both Counter with no Push
- both expire into Kuzushi symmetrically
- deterministic / finite

T73. Existing Push-vs-Push regression
- equal simultaneous Push semantics unchanged when stable

T74. Dummy Kuzushi behavior
- no move/Push during Kuzushi
- cooldown held/reset
- no immediate Push on Kuzushi exit before cooldown

T75. Counter unused regression
- existing Movement / Contact / Push / Dummy behavior unchanged
- existing 86 tests PASS

T76. Determinism / finite / no overlap
- mixed Counter/Push sequence replay identical
- no NaN/Infinity
- Contact invariants preserved

T77. ArrowDown edge latch integration
- second PressLatch semantics match Push latch
- pending edge consumed by one Simulation tick
- multi-tick render frame cannot repeat Counter edge

Do not make tests depend on side/rear relocation; those belong to ACTION-04A2.

## 19. Verification Level

Heavy / Core Counter Foundation.

Required:

- `pnpm test` PASS
- `pnpm build` PASS
- `git diff --check` PASS
- T60–T77 evidence
- all existing regressions PASS
- no new dependency
- Simulation / Pure input helpers Phaser-free
- Scope Out absent

### Runtime Smoke

Because ACTION-04A1 adds a new keyboard edge and visible posture:

Verify if the Agent environment supports a real browser/runtime:

- ArrowDown starts COUNTER once per physical press
- hold does not repeat
- Mode 2 Dummy Push can trigger Counter success
- whiffing Counter leads to KUZUSHI
- Kuzushi participant cannot move/Push
- Kuzushi facing remains frozen
- after Kuzushi ends, normal control/facing returns
- no runtime/console errors

If real browser runtime is unavailable:
- report `Browser Smoke: NOT RUN (environment limitation)`
- do not fabricate PASS
- automated technical result may be `PASS WITH KNOWN UNTESTED ITEMS` if all required core tests/build/diff-check pass
- User Play Test remains the runtime/game-feel gate

## 20. User Play Test

ACTION-04A1 User Play Test: **REQUIRED but focused**, not full Counter Feel acceptance.

User should verify only the foundation:

1. ArrowDown feels like one committed Counter attempt, not guard/hold.
2. Counter whiff reliably creates a vulnerable KUZUSHI state.
3. Correct timing against Dummy Push makes the attacker enter KUZUSHI instead.
4. Kuzushi visibly prevents immediate action/movement.
5. Kuzushi facing freeze is understandable.
6. Kuzushi target is noticeably easier to Push, without feeling absurd.
7. Counter input/timing does not break accepted Push / Contact / Movement.
8. Best vs Success positional difference is intentionally NOT visible yet.

Full Counter Feel acceptance happens after ACTION-04A2 positional resolution.

Agent report:

`User Play Test: REQUIRED / NOT RUN`

## 21. Acceptance Criteria

AC-01: ArrowDown semantic edge implemented with existing latch pattern.
AC-02: one press = one Counter attempt; no hold auto-repeat.
AC-03: Push priority over same-tick Counter is deterministic.
AC-04: Counter window is deterministic and exact.
AC-05: Best boundary is exactly first `COUNTER_BEST_TICKS` Active ticks.
AC-06: success requires Counter window + opponent Push Active + actual Contact.
AC-07: Best/Success classification exists and is tested.
AC-08: success cancels attacker Push before same-tick Push force.
AC-09: Fail puts Counter user into Kuzushi.
AC-10: Best/Success put Push attacker into Kuzushi.
AC-11: Kuzushi is separate posture state.
AC-12: entering Kuzushi cancels action.
AC-13: Kuzushi suppresses actions and movement steering.
AC-14: Kuzushi freezes auto-facing.
AC-15: Kuzushi expires deterministically and restores normal facing/control.
AC-16: Kuzushi increases received Push by provisional susceptibility factor only.
AC-17: Dummy respects Kuzushi.
AC-18: no side/rear relocation or overshoot.
AC-19: no finish probability / PRNG / BoutOutcome.
AC-20: accepted Push / Contact / Movement regressions PASS.
AC-21: T60–T77 + existing tests PASS.
AC-22: `pnpm build` PASS.
AC-23: Current State docs materially match Source.
AC-24: User Play Test REQUIRED / NOT RUN.
AC-25: Scope外変更なし.

## 22. Stop Conditions

STOP if:

- Preflight fails
- Current Source / Review Handoff conflict
- Counter success cannot cancel Push before same-tick force without materially redesigning accepted Push semantics
- separate posture causes a Source-of-Truth conflict
- Kuzushi susceptibility requires introducing Weight/traction now
- side/rear relocation becomes necessary to make Counter foundation technically valid
- Physics/new dependency required
- task-external User changes / divergence exist

Do not broaden Scope.

## 23. Completion Report

Minimum:

- Result
- Preflight
- Changed Files
- User Decisions implemented
- Counter input / window semantics
- exact Best tick rule
- Counter success/fail resolution
- Kuzushi state / duration
- Kuzushi facing rule
- Kuzushi Push susceptibility constant
- Dummy integration
- T60–T77 + regression tests
- Runtime Smoke
- AC-01–AC-25
- Implementation Evidence
- Design Deviations
- Unexpected Scope
- Known Untested
- User Play Test: REQUIRED / NOT RUN
- Git delivery

Implementation Evidence minimum:

1. one-edge Counter
2. Push-vs-Counter input priority
3. exact Best/Success boundary
4. success cancels Push
5. Fail → self Kuzushi
6. success → attacker Kuzushi
7. Kuzushi action/movement/facing behavior
8. Push susceptibility
9. Dummy Kuzushi-awareness
10. no relocation/finish scope creep

## 24. Git Delivery

Follow AGENTS.md.

Technical success:

- Task-owned files only
- tests / build / diff-check
- Completion Report in same Task commit
- 1 Agent Task ≈ 1 commit
- push `origin/develop`
- verify remote SHA / clean working tree

Commit message example:

`feat: add counter kuzushi foundation`

Do not change main.

## 25. Final Instruction

This Task ends after Counter + Kuzushi Foundation.

Do not continue to:
- side/rear positioning
- overshoot
- finish chance
- Ring-out
- Grip
- Harite

After commit / push / Completion Report, stop and report:

「ACTION-04A1-COUNTER-KUZUSHI-FOUNDATION が完了し、ChatGPT ReviewとUser Play Test待ちです」


# Final ChatGPT Review

Overall Result: TECHNICAL PASS WITH KNOWN UNTESTED RUNTIME / USER PLAY TEST REQUIRED

## Reviewed Delivery

- Accepted implementation commit for technical review:
  `0dede47770b664f9fd01b99597403ad7bd92b55a`
- Agent-Start-Head:
  `59c34b3762c4c7b67814f820c56314cfce3ff9d6`
- Agent Task Diff is exactly one implementation commit.
- Production scope matches ACTION-04A1:
  - Counter semantic edge
  - Counter window / Best-Success classification
  - Kuzushi posture
  - Kuzushi facing / movement / action behavior
  - provisional Push susceptibility
  - Dummy Kuzushi-awareness
  - minimal Scene input/presentation
- No side/rear relocation, attacker overshoot, finish probability, PRNG, BoutOutcome, Grip, Harite, Ring-out, or new dependency was introduced.

## Reported Implementation vs Design

PASS.

Direct Source review confirmed:

- `ParticipantIntent.counterPressed` is a semantic per-tick edge.
- ArrowDown uses a second existing `PressLatch`; no generic Input framework was introduced.
- Same-tick Push + Counter uses explicit Push priority and does not queue Counter.
- Counter is part of the canonical Simulation action union.
- Kuzushi is a separate canonical posture state.
- `enterKuzushi()` cancels the current action and is the explicit entry path.
- Counter window is `COUNTER_WINDOW_TICKS = 12`.
- Best is unambiguously the first `COUNTER_BEST_TICKS = 3` Push Active ticks:
  - elapsed 0 / 1 / 2 = Best
  - elapsed 3+ = Success.
- Counter success requires:
  - defender Counter window
  - opponent Push Active
  - actual Simulation Contact.
- Resolution order is correct:
  - Contact
  - Counter resolution
  - remaining Push resolution.
- Successful Counter cancels the attacking Push before that tick can add new Push acceleration.
- Window expiry without success causes self Kuzushi.
- Best / Success both cause attacker Kuzushi in ACTION-04A1, with no positional difference yet.
- Kuzushi movement uses zero effective intent and existing grounded braking rather than hard-zeroing selfVelocity.
- Kuzushi participant does not auto-face; stable opponent still does.
- Normal auto-facing/control resumes after Kuzushi expiry.
- Kuzushi Push susceptibility is isolated to received Push acceleration via provisional factor `1.5`.
- Existing stable-vs-stable Push semantics remain unchanged.
- Push Dummy reads Snapshot posture and does not act while Kuzushi.

## Verification Review

Reported:

- `pnpm test`: 108/108 PASS
- `pnpm build`: PASS
- `git diff --check`: PASS
- T60–T77 covered
- prior 86 tests remain PASS with only required intent-helper adaptation
- deterministic / finite / no-overlap coverage present

The focused tests directly inspected include coverage for:

- one-edge Counter / no queue
- same-tick Push priority
- exact Counter window
- exact Best/Success boundary
- same-tick Push-force cancellation
- no-Push / early / late failure
- pre-Contact Counter
- success / fail Kuzushi ownership
- exact Kuzushi duration
- Kuzushi action / movement suppression
- facing freeze and recovery
- exact susceptibility factor
- simultaneous Counter symmetry
- accepted Push-vs-Push regression
- Dummy Kuzushi behavior
- deterministic mixed replay
- ArrowDown latch behavior across 0/N Simulation ticks

## Runtime Verification

Browser Smoke: NOT RUN due Agent environment limitation.

This is a Known Untested item, not a Source failure, because ACTION-04A1 explicitly allowed this state when automated Core verification/build/diff-check passed.

User manual runtime test is therefore the remaining gate.

## Non-Blocking Notes

### N-1 — Dummy cooldown after Kuzushi is one tick conservative

Because the Dummy generates its Intent from the pre-step Snapshot, a Snapshot with:

`posture = kuzushi, ticksRemaining = 0`

is still seen as Kuzushi by the controller, while the Simulation will restore stable at the start of that same upcoming tick.

Therefore the harness effectively holds cooldown one extra tick around Kuzushi recovery.

The Completion Report disclosed this correctly.

This is acceptable for the deterministic validation harness:
- it does not change Gameplay Core
- it prevents immediate Push after recovery
- it is only a 1-tick conservative delay

Do not add cross-layer prediction solely to remove this harness-only tick.

### N-2 — Kuzushi Snapshot timer semantics are unusual but explicit

`kuzushi { ticksRemaining: 0 }` means:
- still Kuzushi in the current Snapshot
- restores to stable at the beginning of the next Simulation tick.

This is deterministic and tested. Preserve this exact meaning unless a future Task explicitly redesigns posture timers.

## Accepted Technical Baseline Pending Play Test

If User Play Test passes, ACTION-04A1 becomes accepted baseline with:

- ArrowDown = temporary Counter binding
- one keydown = one Counter attempt
- Push priority on same-tick Up+Down
- Counter window 12 ticks provisional
- Best first 3 Push Active ticks provisional
- Fail → self Kuzushi
- Best / Success → attacker Kuzushi
- Kuzushi 30 full ticks provisional
- Kuzushi action lock / grounded brake / facing freeze
- Kuzushi Push susceptibility 1.5 provisional
- no positional reward yet

All numerical values remain Prototype tuning, not final balance.

## User Play Test — REQUIRED / READY

Run `pnpm dev`.

Use Mode 2 (`2`) for predictable incoming Push.

Verify:

1. ArrowDown produces one `COUNTER` attempt per physical press.
2. Holding ArrowDown does not repeatedly Counter.
3. Whiff a Counter:
   - after the Counter window, Player becomes `KUZUSHI`.
4. During Player Kuzushi:
   - WASD cannot steer
   - ArrowUp / ArrowDown do not start actions
   - facing remains frozen.
5. After Kuzushi ends:
   - movement/actions return cleanly
   - auto-facing resumes.
6. Against Dummy Push, time ArrowDown so the Dummy becomes `KUZUSHI` instead.
7. While Dummy is Kuzushi:
   - it does not immediately Push again.
8. Push a Kuzushi target:
   - it should move more easily than a stable target.
   - judge whether 1.5× feels noticeable but not absurd.
9. Existing ArrowUp Push still feels like the accepted baseline.
10. Existing Contact / movement behavior still feels unchanged outside Counter/Kuzushi.
11. BEST vs SUCCESS positional difference is intentionally absent in A1.

Also confirm no browser/console/runtime error.

## Acceptance State

Technical implementation: PASS.

Gameplay / runtime acceptance: PENDING USER PLAY TEST.

Do not create ACTION-04A2 until User reports the ACTION-04A1 focused Play Test result.

If accepted:
- ACTION-04A2 may add automatic side/rear positional resolution and attacker overshoot.

If rejected:
- record the concrete problem as:
  - Counter timing
  - Kuzushi duration
  - susceptibility
  - input feel
  - facing behavior
  - runtime bug
and create only the smallest focused correction.

## Do Not Reopen

- accepted Push / Contact / Movement baseline
- automatic side-selection decision (belongs to A2)
- shared Down Counter meaning
- ArrowDown temporary binding
- probabilistic instant finish deferral
- no forced backward step on Counter whiff

## Deferred To ACTION-04A2

- Best → rear position
- Success → automatically selected side position
- deterministic invalid-target fallback
- attacker overshoot
- minimal BEST/SUCCESS result presentation if needed
- full Counter Feel Play Test

## Still Deferred Beyond ACTION-04A2

- probabilistic finish / PRNG / BoutOutcome
- Grip production behavior
- Harite
- dedicated Dodge
- Weight / Power / LowerBody / Balance / Stamina formulas
- Ring-out
- Push distance tuning
