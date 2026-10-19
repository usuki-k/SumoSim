Task-ID: ACTION-04A2-COUNTER-POSITION-RESOLUTION
Status: REVIEWED
Task-Type: IMPLEMENTATION / CORE COUNTER POSITION RESOLUTION
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: 0dede47770b664f9fd01b99597403ad7bd92b55a
Handoff-Mode: GITHUB

# ACTION-04A2 — Counter Position Resolution

## 1. Purpose

ACTION-04A1 Counter + Kuzushi FoundationはTechnical ReviewおよびUser Play TestでAcceptされた。

次に、既に決定済みのCounter結果差を実装する。

- Push Counter Best
  - attackerはKuzushi
  - defenderはattackerの背後へ自動配置
  - attackerはPush方向へ少しovershootする
- Push Counter Success
  - attackerはKuzushi
  - defenderはattackerの側面へ自動配置
  - sideは手動選択せず、現在位置とgeometryから自動決定
  - attackerはPush方向へ少しovershootする
- Fail
  - ACTION-04A1どおりCounter userがKuzushi
  - relocationなし

このTaskで、Userが意図する

```
Best → 引き / 背後
Success → 捌き / 側面
Fail → 自分が崩れる
```

を最初にinteractiveに成立させる。

Full Counter FeelのUser Play Testが必須。

## 2. Accepted Production Baseline

Accepted Production Source:

`0dede47770b664f9fd01b99597403ad7bd92b55a`

Current develop上のそれ以降はReview / User Play Test等のcoordination-only commits。

PreflightはAGENTS.mdに従う。

Preserve without retuning:

- screen/world-relative WASD
- ACTION-02B Movement
- ACTION-03A2 Contact
- ArrowUp discrete Push
- Push Startup / Active / Recovery
- selfVelocity / externalVelocity Model B
- contested Push baseline
- ArrowDown discrete Counter
- same-tick Push priority
- Counter window = 12 ticks provisional
- Best = first 3 Push Active ticks provisional
- Fail → self Kuzushi
- Best / Success → attacker Kuzushi
- Kuzushi = separate posture
- Kuzushi action/movement lock
- Kuzushi facing freeze
- Kuzushi Push susceptibility = 1.5 provisional
- Push Dummy Kuzushi-awareness

User has explicitly accepted ACTION-04A1 and stated that wider Counter/Kuzushi timing may be desirable later, but **do not tune those values in this Task**.

## 3. Accepted Positional Semantics

### Best

Against Push, Best result:

1. capture attacker locked Push direction before its Push action is cancelled
2. attacker enters Kuzushi
3. defender attempts to move to a valid rear target
4. attacker receives one explicit forward overshoot along its locked Push direction
5. no instant bout finish yet

### Success

Against Push, Success result:

1. capture attacker locked Push direction
2. attacker enters Kuzushi
3. defender moves to one automatically selected valid side target
4. attacker receives one explicit forward overshoot along its locked Push direction

### Fail

Unchanged from ACTION-04A1:

- Counter user enters Kuzushi
- no relocation
- no overshoot

## 4. Direction Basis

The Counter position result is based on the **attacker's locked Push direction**, not its current auto-facing and not the current Contact normal.

Let:

```ts
d = attacker Push locked direction // unit Vec2
perp = { x: -d.y, y: d.x }
P = attacker center position at Counter resolution
R = attacker.bodyRadius + defender.bodyRadius
```

Important:

- capture/copy `d` **before** `enterKuzushi(attacker)` cancels the Push action
- do not recompute from facing after cancellation
- do not use random side selection
- do not add manual A/D side selection

Current Kuzushi facing freeze remains unchanged.
Do not add a new facing/turning system in this Task.

## 5. Rear Target — Best

Preferred rear target:

```
rear = P - d * R
```

This represents the defender gaining the attacker's rear at non-overlapping Contact distance.

Validity:

```
|rear| <= arena.radius - defender.bodyRadius
```

or mathematically equivalent finite check.

Do not clamp an invalid target back inside the ring.

Best fallback order:

1. valid rear
2. preferred valid side
3. opposite valid side
4. no relocation

Even if relocation falls back or fails:
- attacker still enters Kuzushi
- Best classification remains Best
- overshoot still applies

Do not convert Best into Success because rear was invalid.

## 6. Automatic Side Selection — Success

Manual side choice is rejected by User.

Side candidates:

```
sidePlus  = P + perp * R
sideMinus = P - perp * R
```

Both are exact non-overlap Contact-distance targets.

### Preferred side rule

Use defender's current pre-relocation position at Counter resolution.

```
lateralOffset = dot(perp, defender.position - P)
```

Provisional epsilon:

- `COUNTER_SIDE_EPSILON = 1e-6` meters

If:

- `lateralOffset > epsilon` → prefer `sidePlus`
- `lateralOffset < -epsilon` → prefer `sideMinus`
- otherwise treat as a tie

This is equivalent to choosing the geometrically nearer side candidate, but is simpler and deterministic.

### Tie-break

When effectively tied:

1. among valid side candidates, prefer the candidate closer to ring center
2. if still exactly/effectively tied, prefer fixed `sidePlus`

No randomness.

### Invalid preferred target

For Success:

1. preferred valid side
2. opposite valid side
3. no relocation

If neither side is valid:
- attacker still enters Kuzushi
- Success remains Success
- overshoot still applies
- defender stays at its current position

Do not clamp through invalid geometry.

## 7. Target Validity / Safety

A relocation target is valid only if:

- x/y are finite
- defender body remains fully inside the current arena circle:
  `hypot(target.x, target.y) <= arena.radius - defender.bodyRadius`

Current ring-out is still unimplemented.
This validity rule is only to prevent Counter relocation from teleporting a participant into an obviously invalid future ring state.

Do not implement Ring-out/BoutOutcome.

### Overlap

Target center distance from attacker must be exactly `R` within floating-point tolerance.

Do not intentionally add overlap or a hidden gap.

Do not run pathfinding or a route around the attacker.

## 8. Relocation Ownership

Relocation is canonical Simulation gameplay state.

On successful Counter:

- Simulation writes defender `position` directly to the chosen target on the resolution tick
- Phaser reads the Snapshot result
- no Scene-owned gameplay position
- no short gameplay trajectory / path
- no movement tween that feeds back into Simulation

For ACTION-04A2, an instantaneous visual jump is acceptable and is explicitly a User Play Test item.

Do not build navigation/pathfinding.

## 9. Attacker Overshoot

Current Contact removes much of the attacker's closing selfVelocity, so Counter must add a small explicit attacker-only forward carry.

Use Model B; do not create another physics system.

Provisional constant:

- `COUNTER_OVERSHOOT_SPEED = 1.0` m/s

On successful Best or Success:

```
attacker.externalVelocity += d * COUNTER_OVERSHOOT_SPEED
```

Then apply the existing external-speed clamp.

Requirements:

- applies once per successful Counter
- attacker only
- defender does not receive the overshoot delta
- direction = captured locked Push direction
- existing external momentum already present on each participant is preserved
- existing external decay handles overshoot afterward
- no reversal / no separate decay system
- no mass / Weight / LowerBody formula yet

This is Prototype tuning and may change after Play Test.

## 10. Counter Resolution Order

Preserve ACTION-04A1 high-level tick order.

Within successful `resolveCounter`:

1. identify defender Counter + attacker Push Active
2. capture attacker locked Push direction
3. determine tier
4. compute relocation preference/target from current post-Contact positions
5. enter attacker Kuzushi (cancels Push)
6. defender returns idle
7. apply chosen defender relocation, if any
8. apply attacker-only overshoot external velocity
9. return/finish resolution

Then existing `resolvePush` runs.

Because attacker Push has been cancelled:
- that tick adds no new Push acceleration

Do not change accepted Counter success condition:
- Counter window
- opponent Push Active
- actual Contact

## 11. Best / Success Result Visibility

Do not introduce a generic event bus/history framework.

The positional result itself should make the difference visible:

- Best → rear
- Success → side
- both → attacker KUZUSHI

The existing `KUZUSHI` label remains.

A persistent `lastCounter.seq` history field is **not required** in this Task.

If Agent finds that a tiny explicit BEST/SUCCESS presentation marker is strictly necessary for Browser/User testing:
- keep it narrowly scoped
- report why it was necessary
- do not create a generic event system

Default direction: no new result-history state.

## 12. No Facing Redesign

Do not change ACTION-04A1 facing semantics.

- attacker in Kuzushi keeps the facing it had when Kuzushi began
- defender remains stable and auto-faces normally
- side/rear geometry uses locked Push direction regardless of current facing

If this makes visual side/rear readability poor, record it in User Play Test.
Do not solve it by adding turn-rate/facing-snap logic inside this Task.

## 13. Existing External Momentum

Do not clear pair externalVelocity on Counter success.

Reason:

- existing momentum represents movement already accumulated before the successful Counter
- Success caught later in Active may already have some incoming pair movement
- Counter stops further Push acceleration, but does not retroactively erase prior movement

Overshoot is added on top of the attacker's current external component only.

Tests must distinguish:
- preserved pre-existing pair external momentum
- attacker-only overshoot delta

## 14. Scope

Allowed:

- `src/game/sumo/BoutSimulation.ts`
- `src/game/sumo/BoutTypes.ts` only if a small type is truly needed
- focused Counter tests
- minimal existing Scene presentation if required
- `docs/ARCHITECTURE.md`
- `AGENTS.md` only if material Current Source wording requires it
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

Prefer keeping the positional math as small Pure TypeScript helpers inside/near BoutSimulation.

No dependency.

## 15. Scope Out

Do NOT implement:

- probability / instant finish
- seed / PRNG
- BoutOutcome
- Ring-out
- Grip
- Harite
- dedicated Dodge
- thrust
- Weight / Power / LowerBody
- Stamina / Balance
- mass / traction
- separate pull/inashi actions
- lateral Counter impulse variant
- relocation path/pathfinding
- gameplay interpolation/tween
- facing redesign / turn-rate
- generic event/history system
- CPU AI
- Touch / Gamepad
- Push distance tuning
- Counter window / Best window / Kuzushi duration tuning
- Kuzushi susceptibility tuning

## 16. Required Automated Verification

All existing 108 tests must remain PASS.

Add focused tests at minimum:

### T78 — Best rear relocation

- valid Best Counter
- defender ends at `P - d * R`
- exact non-overlap Contact distance
- attacker Kuzushi
- defender stable/idle

### T79 — Success side selection from lateral offset

Test both signs:

- positive lateral offset → sidePlus
- negative lateral offset → sideMinus
- uses locked Push direction basis
- exact non-overlap Contact distance

### T80 — Side tie-break

Cover:

1. tied lateral offset, both valid, one candidate closer to ring center → choose center-nearer
2. exact remaining tie → deterministic sidePlus

No randomness.

### T81 — Invalid side fallback

- preferred side invalid, opposite valid → opposite
- both invalid → no relocation
- Success still produces attacker Kuzushi

### T82 — Best invalid rear fallback

- rear invalid, preferred side valid → preferred side
- rear + preferred side invalid, opposite valid → opposite
- all invalid → no relocation
- tier remains Best and attacker Kuzushi

### T83 — Relocation safety

Across rear / side / fallback:

- finite positions
- defender body fully inside arena for any applied relocation
- no overlap
- no clamp-generated invalid geometry

### T84 — Overshoot attacker only

On a first-active-tick Best with no prior external momentum:

- attacker externalVelocity gets exactly `COUNTER_OVERSHOOT_SPEED` along locked `d`
- defender gets no overshoot component
- existing MAX_EXTERNAL_SPEED clamp respected

### T85 — Success preserves prior pair momentum

Create a later Active Success after prior Push acceleration:

- pair external momentum accumulated before Counter is preserved
- attacker receives only the additional overshoot delta
- defender keeps its existing external component
- no same-tick new Push gain after Counter resolution

### T86 — Overshoot decay

After Counter:

- attacker overshoot decays through existing EXTERNAL_DECELERATION
- monotonic toward zero
- no reversal / NaN
- no new Counter-specific decay rule

### T87 — Locked direction basis

After Push begins, change geometry/facing before Counter success:

- relocation and overshoot use original locked Push direction
- do not retarget to current facing/contact normal

### T88 — No relocation on Fail

- failed Counter remains ACTION-04A1 behavior
- self Kuzushi
- no side/rear position jump
- no overshoot

### T89 — ACTION-04A1 regression

- Counter success still cancels same-tick Push force
- exact Best/Success classification unchanged
- Kuzushi timer/facing/susceptibility unchanged

### T90 — Push / Contact / Movement regressions

- existing accepted Push-vs-Push
- Contact no-creep
- grounded Movement
- Dummy harness
- all existing 108 tests PASS unchanged apart from harmless helper adaptation

### T91 — Determinism / finite

Mixed Best / Success / invalid-fallback cases:

- same input sequence = identical result
- finite positions/velocities
- no overlap

Do not add brittle tests for final animation/game feel.

## 17. Verification Level

Heavy / Core Counter Position Resolution.

Required:

- `pnpm test` PASS
- `pnpm build` PASS
- `git diff --check` PASS
- T78–T91 evidence
- existing 108 tests PASS
- no new dependency
- Simulation remains Phaser-free
- Scope Out absent

### Browser Smoke

If real browser/runtime is available:

- Mode 2 Dummy still approaches and Pushes
- ArrowDown Counter still works
- Best-looking timing places Player behind Dummy
- later successful timing places Player at Dummy side
- KUZUSHI remains visible
- attacker visibly carries forward after successful Counter
- no overlap/jitter/teleport to invalid location
- Fail still creates self Kuzushi without relocation
- Push/Contact/Movement baseline remains intact
- no runtime/console errors

If browser tool is unavailable:
- report NOT RUN honestly
- User Play Test is the required runtime/game-feel gate

## 18. User Play Test — REQUIRED / FULL COUNTER FEEL

This is the first full Counter positional Feel gate.

User should evaluate:

1. Best timing clearly feels stronger than normal Success.
2. Best → rear position is understandable and rewarding.
3. Success → side position feels like a believable sabaki/deflection.
4. Automatic side choice feels natural; no desire for manual A/D choice.
5. Tie situations do not feel obviously biased or strange.
6. Instant reposition is readable enough for Prototype, or whether later presentation interpolation is needed.
7. Attacker overshoot feels like being pulled/sent forward rather than teleporting or skating.
8. Overshoot amount is not absurd.
9. Kuzushi facing freeze makes side/rear advantage readable.
10. After Best/Success, following up with Push during opponent Kuzushi feels causally understandable.
11. Fail still feels appropriately risky.
12. Push-vs-Push contest remains natural.
13. Existing Movement / Contact / Push Feel remains intact.
14. Counter + lateral movement + Push contest now feel like distinct choices.
15. Report whether Counter feels too binary/easy/hard, but do not tune final timing unless it blocks the mechanic.

Agent report:

`User Play Test: REQUIRED / NOT RUN`

Technical PASS != Counter Feel accepted.

## 19. Acceptance Criteria

AC-01: Best uses captured locked Push direction.
AC-02: valid Best relocates defender to rear at exact non-overlap Contact distance.
AC-03: Success side selection is automatic and deterministic.
AC-04: side selection uses nearest-side/lateral-offset rule.
AC-05: tie prefers ring-center-nearer valid side, then fixed sidePlus.
AC-06: invalid preferred side falls back deterministically.
AC-07: invalid Best rear falls back rear→preferred side→other side→none.
AC-08: relocation never clamps through invalid geometry.
AC-09: no relocation still preserves Counter tier/Kuzushi result.
AC-10: successful Counter gives attacker-only overshoot.
AC-11: overshoot uses locked Push direction.
AC-12: overshoot preserves prior external momentum and uses existing clamp/decay.
AC-13: successful Counter still cancels current-tick Push force.
AC-14: Fail has no relocation/overshoot.
AC-15: ACTION-04A1 Counter/Kuzushi semantics unchanged.
AC-16: accepted Push/Contact/Movement/Dummy regressions PASS.
AC-17: no probability/BoutOutcome/Ring-out/Grip/Harite scope creep.
AC-18: no generic event/history/pathfinding/facing framework.
AC-19: T78–T91 + existing tests PASS.
AC-20: `pnpm build` PASS.
AC-21: Current State docs match material Source changes.
AC-22: User Play Test REQUIRED / NOT RUN.
AC-23: Scope外変更なし.

## 20. Stop Conditions

STOP if:

- Preflight fails
- Current Source / Review Handoff conflict
- relocation cannot be made deterministic without pathfinding
- valid side/rear placement requires implementing Ring-out/BoutOutcome
- overshoot requires replacing Model B
- successful Counter needs changing accepted A1 timing/Kuzushi semantics
- a facing redesign becomes necessary for technical correctness
- new dependency/Physics required
- task-external User changes/divergence exist

Do not broaden Scope.

## 21. Completion Report

Minimum:

- Result
- Preflight
- Changed Files
- Best rear algorithm
- automatic side algorithm
- tie-break and invalid-target fallback
- target validity rule
- overshoot constant/ownership
- external momentum preservation
- T78–T91 + regression tests
- Browser Smoke
- AC-01–AC-23
- Implementation Evidence
- Design Deviations
- Unexpected Scope
- Known Untested
- User Play Test: REQUIRED / NOT RUN
- Git delivery

Implementation Evidence minimum:

1. Best rear
2. Success sidePlus/sideMinus
3. tie-break
4. invalid fallback
5. no-overlap/arena validity
6. attacker-only overshoot
7. prior external preservation
8. locked direction basis
9. Fail unchanged
10. A1 + Push/Contact/Movement regressions

## 22. Git Delivery

Follow AGENTS.md.

Technical success:

- Task-owned files only
- tests / build / diff-check
- Completion Report in same Task commit
- 1 Agent Task ≈ 1 commit
- push `origin/develop`
- verify remote SHA / clean working tree

Commit message example:

`feat: add counter position resolution`

Do not change main.

## 23. Final Instruction

This Task ends after Counter positional resolution + overshoot.

Do not continue to:
- finish probability
- Ring-out
- Grip
- Harite
- stats
- animation framework

After commit / push / Completion Report, stop and report:

「ACTION-04A2-COUNTER-POSITION-RESOLUTION が完了し、ChatGPT ReviewとUser Play Test待ちです」


# Final ChatGPT Review

Overall Result: TECHNICAL PASS WITH KNOWN UNTESTED RUNTIME / FULL USER PLAY TEST REQUIRED

## Reviewed Delivery

- Accepted implementation commit for technical review:
  `d72f43b0887203095eebe3f1c7efb1d1193a188d`
- Agent-Start-Head:
  `fe80d5582bc7b6fabc615c453510a5add7d7975c`
- Agent Task Diff is exactly one implementation commit.
- `main` remains unchanged.
- Production changes are limited to:
  - Counter position resolution / overshoot
  - focused tests
  - Current-State documentation
- No new dependency.

## Reported Implementation vs Design

PASS.

Direct Source review confirmed:

### Best rear

- locked Push direction is copied before attacker Push is cancelled.
- Best preferred target is:
  `attackerPosition - lockedDirection * combinedRadius`.
- applied target is exact non-overlap Contact distance.

### Success automatic side

- side basis is perpendicular to locked Push direction.
- defender lateral offset selects sidePlus / sideMinus.
- effectively tied positions use deterministic ring-center preference.
- remaining tie uses fixed sidePlus.
- no manual A/D side selection.
- no randomness.

### Invalid-target fallback

- targets are finite and require the defender body to remain inside the arena circle.
- no positional clamp is used.
- Success:
  preferred side → opposite side → none.
- Best:
  rear → preferred side → opposite side → none.
- failure to relocate does not downgrade the Counter tier or cancel Kuzushi.

### Relocation ownership

- position is changed directly in BoutSimulation.
- Phaser remains Snapshot presentation.
- no gameplay tween, route solver, pathfinding, or Scene-owned gameplay position was added.

### Attacker overshoot

- `COUNTER_OVERSHOOT_SPEED = 1.0 m/s` provisional.
- only attacker externalVelocity receives the overshoot.
- direction is captured locked Push direction.
- existing external momentum is preserved.
- existing MAX_EXTERNAL_SPEED clamp and EXTERNAL_DECELERATION are reused.
- no second physics / decay system.

### Counter resolution order

- current Contact resolves first.
- Counter resolution then captures direction/tier/target, enters attacker Kuzushi, relocates defender, adds overshoot.
- existing Push resolution runs afterward.
- because attacker Push has been cancelled, no same-tick new Push force is added.

### Fail / A1 preservation

- failed Counter still has:
  - no relocation
  - no overshoot
  - self Kuzushi.
- Counter window, tier boundary, Kuzushi timer/facing/susceptibility remain ACTION-04A1 semantics.

## Verification Review

Reported:

- `pnpm test`: 124/124 PASS
- `pnpm build`: PASS
- `git diff --check`: PASS
- T78–T91 covered
- prior regressions remain PASS.

Direct test/source inspection confirmed coverage for:

- Best rear target
- both Success side signs
- tie-break
- preferred/alternate invalid fallback
- Best rear fallback chain
- finite / ring-contained / exact-contact relocation
- attacker-only overshoot
- prior pair external momentum preservation
- existing decay / no reversal
- locked Push direction vs changed facing/contact normal
- Fail unchanged
- A1 timing/Kuzushi regression
- deterministic mixed scenarios

## Existing Test Updates

Accepted.

Two ACTION-04A1 tests were updated only where A2 intentionally changes semantics:

- T64 now distinguishes preserved pair momentum from attacker-only overshoot.
- T67 no longer asserts "no relocation"; position-specific behavior is covered by T78+.

This is not a regression-test weakening of unrelated behavior.

## Browser Smoke

NOT RUN due Agent environment limitation.

No technical PASS claim is made for actual browser presentation/runtime.

The remaining runtime/game-feel gate is User Play Test.

## Non-Blocking Notes

### N-1 — Straight-on Success often uses the deterministic tie fallback

In the common symmetric case, defender lateral offset is near zero, so automatic side selection often reaches the tie rules.

At the centered prototype setup, ring-center distances may also tie, producing fixed `sidePlus`.

This is expected by the accepted deterministic design, not a bug.

User Play Test should judge whether repeated same-side outcomes from perfectly straight attacks feel acceptable.

### N-2 — Instant relocation is deliberately gameplay-first

The defender position changes instantly in Simulation.

No presentation interpolation was added.

If this looks visually abrupt, treat that as a later presentation/Game Feel correction; do not move the gameplay rule into Phaser.

### N-3 — Numerical values remain provisional

Do not treat:
- overshoot 1.0 m/s
- Counter/Kuzushi timings
- susceptibility
as final balance.

User already accepted that broader/longer action timing may be desirable later.

## Accepted Technical Baseline Pending Play Test

If User Play Test passes:

- Best Push Counter → attacker Kuzushi + defender rear position
- Success Push Counter → attacker Kuzushi + deterministic automatic side position
- invalid target → deterministic fallback / possibly no relocation
- successful Counter → attacker-only forward overshoot
- prior external momentum preserved
- Fail → self Kuzushi, no relocation/overshoot
- ACTION-04A1 Counter/Kuzushi foundation remains accepted

## Full Counter Feel User Play Test — REQUIRED / READY

Run `pnpm dev` and use Mode 2 (`2`).

Evaluate:

1. Best timing visibly puts Player behind the Dummy.
2. A later successful Counter visibly puts Player at a side.
3. Best feels meaningfully stronger / more rewarding than Success.
4. Automatic side choice feels natural without manual A/D choice.
5. Straight-on/tie cases choosing a deterministic side do not feel obviously strange.
6. Instant position change is readable enough for Prototype.
7. If instant relocation is too abrupt, note it as presentation feedback rather than Gameplay-rule failure unless it causes genuine confusion.
8. Dummy's forward overshoot looks like it was pulled/sent past the defender.
9. Overshoot amount does not look absurdly large/small.
10. The Kuzushi attacker keeps its facing frozen, making side/rear advantage readable.
11. Following with ArrowUp while opponent is Kuzushi feels causally understandable.
12. Failed Counter still gives self Kuzushi with no position reward.
13. Push-vs-Push contest still feels like the accepted baseline.
14. Normal Movement / Contact / Push remain unchanged outside Counter.
15. Counter now feels like a distinct third choice alongside Push contest and lateral movement.
16. Check for runtime/console errors.

## Acceptance State

Technical implementation: PASS.

Full Counter positional Feel: PENDING USER PLAY TEST.

Do not proceed to probabilistic finish, Grip, Harite, Ring-out, or stats until this Play Test is reviewed.

If accepted:
- ACTION-04A2 becomes current Counter positional baseline.
- Next task should be explicitly chosen; do not automatically add the Deferred systems.

If rejected:
- classify feedback narrowly:
  - side selection
  - instant relocation readability
  - overshoot amount/direction
  - position geometry
  - Counter timing/Kuzushi tuning
  - runtime bug
and correct only the relevant area.

## Do Not Reopen

Unless User feedback identifies a concrete problem:

- shared Down Counter semantics
- automatic, non-manual side selection
- locked Push direction as position basis
- deterministic tie/fallback
- ACTION-04A1 Kuzushi architecture
- accepted Push / Contact / Movement baseline
- probabilistic finish deferral

## Deferred

- probability / deterministic RNG / BoutOutcome
- Ring-out
- Grip
- Harite
- dedicated Dodge
- thrust
- Weight / Power / LowerBody / Balance / Stamina
- relocation visual interpolation / animation
- Push distance tuning
- final Counter/Kuzushi balance tuning
