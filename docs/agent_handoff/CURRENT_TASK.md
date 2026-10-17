Task-ID: ACTION-03B-DISCRETE-PUSH-EXTERNAL-MOMENTUM
Status: REVIEWED
Task-Type: IMPLEMENTATION / CORE PUSH PROTOTYPE
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: c11edc5c6e3ffcb7dcb192b4f80bb5af1243fb72
Handoff-Mode: GITHUB

# ACTION-03B — Discrete Push & External Momentum

## 1. Purpose

ACTION-03A2 Contact FeelはUser Play TestでAcceptされた。

次に、相撲Actionの最初の能動Actionとして **Push（↑）** を実装する。

Userが狙う将来の駆け引き：

- Pushにタイミング良く引き技 / 捌き（↓）を合わせる
- Pushを左右へ躱す
- 相手のCommitment / Recoveryを読んで差し返す

このため、Pushはhold型の連続圧力ではなく、**1回の押下で1回発生する短い踏み込みAction** とする。

このTaskの目的：

- ArrowUp押下をsemantic edgeとしてSimulationへ渡す
- PushにStartup → Active Drive → Recoveryの時間構造を持たせる
- Active中は開始時方向へ短く踏み込む
- Contact中のActive Pushだけが相手へ外力Momentumを与える
- grounded self movementとexternal momentumを分離する
- Push後にMomentumが自然に減衰する
- Counter / Pull / Dodge自体はまだ実装しない

Technical PASSだけではPush FeelをAcceptしない。User Play Testが必須。

## 2. Accepted User Decisions

### D1 — Push semantic: ACCEPTED

Pushは **edge-triggered discrete action**。

- 1回の押下につき1回
- holdによる自動連続Pushはしない
- Startup / Active Drive / Recoveryを持つ
- Active Drive中は短い前進Commitmentを持つ
- ContactしていればPushを伝える
- Contactしていなければ短い踏み込みだけ行う
- Action中の新しいPush入力は無視する
- 次のPushには新しいkey downが必要

目的は将来のCounter / lateral dodgeのTiming Windowを成立させること。

### D2 — Prototype key: ACCEPTED

Player Pushの仮Binding：

`ArrowUp`

これはPrototype bindingでありFinal control schemeではない。

## 3. Current Accepted Baseline

Accepted Production Source:

`c11edc5c6e3ffcb7dcb192b4f80bb5af1243fb72`

Current developにはReview / User Play Test / User Decisionのcoordination-only commitsがある。
AGENTS.mdのRemote-Task-First Preflightに従い、
Source-Baseline..origin/developが`docs/agent_handoff/`だけであることを確認してFF-onlyする。

Maintain:

- screen/world-relative WASD
- grounded ACTION-02B Movement
- Simulation-owned position / velocity / facing / body geometry
- fixed timestep 60Hz provisional
- ACTION-03A2 Contact / Separation
- no-contact Movement Feel accepted
- Contact Feel accepted
- stationary opponent does not drift from Contact-only correction
- tangential circling preserved
- Scene is one-way Snapshot presentation
- no Phaser Physics / Matter.js

## 4. Push Runtime State

Add the smallest explicit Push runtime state.

Recommended shape conceptually:

```ts
type PushPhase = 'startup' | 'active' | 'recovery'

type ParticipantActionState =
  | { kind: 'idle' }
  | {
      kind: 'push'
      phase: PushPhase
      ticksRemaining: number
      direction: Vec2
    }
```

Naming may follow surrounding code.

Requirements:

- action state is canonical Simulation runtime state
- direction is captured when Push begins
- Push direction does not retarget during the action
- normal auto-facing may continue visually/runtime as before, but Push Drive direction is locked separately
- Snapshot exposes enough action phase state for deterministic tests and minimal presentation/debug indication
- do not create a generic Action framework beyond this small discriminated union

## 5. Push Phase Semantics

Use provisional tick constants, all subject to User Play Test.

Recommended initial values:

- `PUSH_STARTUP_TICKS = 6` (~100 ms)
- `PUSH_ACTIVE_TICKS = 8` (~133 ms)
- `PUSH_RECOVERY_TICKS = 10` (~167 ms)

Total ~400 ms.

These are Prototype tuning, not final values.

### Startup

- capture locked direction from current facing at action start
- no Push force yet
- normal WASD steering is suppressed
- self locomotion should settle/brake using the existing grounded movement rule with zero effective move intent

### Active Drive

- normal WASD steering remains suppressed
- effective self movement intent is the locked Push direction
- use existing grounded locomotion behavior for the short forward drive rather than creating a second self-movement physics system
- Push force is active only during this phase and only while in Contact

### Recovery

- no Push force
- normal WASD steering remains suppressed
- use zero effective move intent so the participant settles
- after Recovery ends, return to idle and normal WASD immediately

If these initial timings feel poor, Agent may adjust them only as provisional tuning and must report before/after values.
Do not materially change the phase semantics.

## 6. Semantic Intent / Edge Input

Extend semantic intent minimally, e.g.:

```ts
interface ParticipantIntent {
  readonly move: Vec2
  readonly pushPressed: boolean
}
```

`pushPressed` means a **new semantic press edge for this Simulation tick**, not raw key state.

Raw keyboard handling stays outside Simulation.

### ArrowUp latch requirement

Current Scene samples keyboard state once per render frame and may run 0..N Simulation ticks.

A short ArrowUp press must not be:
- lost because a render frame had 0 Simulation ticks
- repeated across all N ticks in one frame
- repeated while ArrowUp remains held

Implement the smallest explicit pending-edge latch in the Input/Scene boundary.

Required behavior:

- ArrowUp key-down latches one pending Push edge
- first subsequent Simulation tick consumes it
- later ticks receive `pushPressed: false`
- holding ArrowUp does not queue repeats
- release + new press can queue the next edge
- do not introduce a generic Input Buffer framework

Movement keys may remain hold-state WASD.

## 7. Self Velocity vs External Momentum — Model B

ACTION-03 Investigation accepted Model B.

Concrete implementation begins now because external force actually exists.

Internal runtime concepts:

- `selfVelocity`
  - participant's own footwork
  - existing ACTION-02B grounded movement rule applies here
- `externalVelocity`
  - opponent-induced Push momentum
  - not processed by grounded movement acceleration/lateral/reverse braking

Actual displacement:

`totalVelocity = selfVelocity + externalVelocity`

Snapshot's existing `velocity` should continue to mean actual total movement velocity.

When `externalVelocity = 0`, all existing ACTION-02B / 03A2 movement behavior must remain unchanged.

Do not expose duplicate Sources of Truth.
The total Snapshot velocity is derived from the two distinct canonical components.

## 8. External Momentum Decay

Add a small explicit external momentum decay rule.

Requirements:

- externalVelocity decays toward exact zero
- overshoot/reversal impossible
- deterministic fixed-tick
- independent from grounded self movement damping
- finite and clamped to a provisional `MAX_EXTERNAL_SPEED`

Use named provisional constants.

Exact initial coefficients are Agent-tunable Prototype values.
Report all values.

Do not derive from Weight / LowerBody yet.

## 9. Push Force Prototype

Keep first Push formula deliberately simple because all participants are still equal-stat.

During Active phase and Contact:

- A Push contributes +1 along contact normal A→B
- B Push contributes -1 along the same axis
- `netPush = activePushA - activePushB`

Behavior:

- only A active → pair receives external acceleration toward B's side
- only B active → pair receives external acceleration toward A's side
- both active equally → net external Push acceleration = 0
- neither active → no new Push acceleration

Apply the same pair external velocity delta to both participants so they can move together while staying in Contact.

Use one named provisional `PUSH_EXTERNAL_ACCELERATION` constant.

No mass / traction / passive resistance / WALK_PRESSURE in this Task.

Reason:
first User Play Test should answer whether the **discrete Push interaction itself** feels promising before adding body parameters.

Do not add archetype branches.

## 10. Contact Interaction

Preserve ACTION-03A2 Contact semantics.

Important:

- penetration ownership remains based on **selfVelocity inward contribution**
- externalVelocity must not be interpreted as self locomotion and must not reintroduce stationary-body creep
- closing normal self velocity removal remains
- tangential self velocity preservation remains
- Contact-only behavior with no Push must be unchanged

Push is an explicit external-momentum layer on top of accepted Contact, not hidden positional correction.

## 11. Fixed Tick Resolution Order

Keep one explicit small order in `BoutSimulation.step()`.

Recommended high-level order:

1. sanitize semantic intents
2. begin Push action from `pushPressed` if participant is idle
3. derive effective self movement intent from current action phase
4. update `selfVelocity` using existing grounded locomotion rule
5. decay existing `externalVelocity`
6. integrate positions using `selfVelocity + externalVelocity`
7. resolve accepted Contact / Separation
8. if Contact and one/both Push actions are in Active phase:
   - resolve net Push
   - add external velocity delta to both participants
9. advance Push phase timers/state
10. update facing

This means a Push external acceleration resolved on this tick affects displacement starting next tick.
That one-tick latency is accepted for the Prototype if deterministic and consistent.

If Agent finds a Material reason this ordering fails, STOP and report rather than silently redesigning.

## 12. No Separate Impact Transfer Yet

Do NOT add a separate collision impact / tachiai-like impulse in this Task.

The short Active Push drive + explicit external acceleration is enough for the first Push Feel test.

One-time impact transfer is Deferred until User feedback shows it is needed.

## 13. Minimal Presentation / Test Harness

Player:

- WASD = existing movement
- ArrowUp = discrete Push

Add only minimal presentation needed to understand Push state.

Recommended:
- show current Push phase near Player label:
  - STARTUP
  - PUSH
  - RECOVERY
- idle shows no extra phase text

This is presentation only.

A minimal `R` restart/reset-to-prototype-setup key is allowed and recommended for repeated Push testing.

Do not add full UI.

CPU may remain stationary in this Task.

Do not create CPU AI or automatic Push loops unless strictly necessary for technical verification.
Incoming/contested Push can be covered by Simulation tests; User Play Test for this Task focuses first on Player Push Feel.

## 14. Scope

Allowed:

- `src/game/sumo/BoutTypes.ts`
- `src/game/sumo/BoutSimulation.ts`
- `src/game/sumo/BoutSimulation.test.ts`
- smallest focused input latch helper/test if useful
- `src/game/scenes/BoutScene.ts`
- `src/game/input/` only for semantic Push edge handling if cleaner
- `docs/ARCHITECTURE.md`
- `AGENTS.md` only if Current Source description requires sync
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

No new dependency.

## 15. Scope Out

Do NOT implement:

- Down counter / pull / deflection
- lateral dodge Action
- left/right thrust Action
- Push auto-repeat / hold repeat
- Push combo system
- Stamina
- Balance
- Weight / Power / LowerBody
- mass / traction / pushForce attributes
- passive/braced formula
- WALK_PRESSURE
- one-time impact transfer
- Tachiai
- Grapple / Throw / Lift
- Ring-out / BoutOutcome
- CPU AI
- Touch / Gamepad
- animation framework
- camera / VFX / audio
- Phaser Physics / Matter.js
- generic Action / Input framework

## 16. Required Automated Verification

Existing 51 tests must remain PASS, updating internals only where Snapshot velocity now means total velocity.

Add focused tests at minimum:

T37. Push starts on one `pushPressed` edge
- idle → startup
- locked direction captured from facing

T38. Phase timing
- startup → active → recovery → idle
- exact deterministic tick counts
- no negative timers / invalid phase

T39. Direction commitment
- opponent/facing changes after Push begins
- locked Push direction does not retarget during current action

T40. Movement suppression during Push
- WASD input does not steer during startup/active/recovery
- active uses locked forward drive
- normal WASD resumes after idle

T41. Non-contact Push
- produces a short forward committed step
- no external Push momentum is created without Contact
- does not become a long dash

T42. One-sided Contact Push
- Player Active Push against neutral opponent moves the pair in defender direction via externalVelocity
- accepted Contact non-penetration remains

T43. Equal simultaneous Push
- equal active Push from both sides yields zero net Push acceleration
- no NaN/jitter

T44. External momentum decay
- decays monotonically to exact zero
- no reversal
- respects max external speed

T45. External momentum independence
- grounded self damping does not immediately erase external momentum
- external component remains behaviorally distinct

T46. No-Push Contact regression
- ACTION-03A2 stationary no-creep / circling / contact tests remain unchanged

T47. No-contact Movement regression
- ACTION-02B behavior remains unchanged when no Push/external momentum exists

T48. Determinism / finite values
- repeated same intent sequence yields identical action/movement result
- all state finite

T49. Semantic edge integration
- holding ArrowUp in Browser/input boundary triggers only one Push action
- release + new press triggers another
- a pending press is consumed by exactly one Simulation tick

Input-boundary edge behavior may use focused unit tests where practical plus Browser Smoke.

## 17. Verification Level

Heavy / Core Push Action.

Required:

- `pnpm test` PASS
- `pnpm build` PASS
- `git diff --check` PASS
- T37〜T49 evidence
- existing Movement + Contact regression PASS
- new dependency none
- Simulation Phaser-free
- no Counter / Ring-out / attributes scope creep

### Browser Smoke

Verify:

- Canvas starts / runtime errors none
- WASD idle movement unchanged
- ArrowUp press starts one Push
- holding ArrowUp does not auto-repeat
- release + press triggers second Push
- visible Startup / Active / Recovery indication if implemented
- non-contact Push moves Player only a short distance
- Contact Push moves stationary CPU backward
- after Recovery, WASD control returns
- Contact still has no creep when Push is not active
- circling still works outside Push
- ring remains non-functional; leaving ring is still allowed
- R restart works if implemented

Browser Smoke does not accept Push Feel.

## 18. User Play Test — REQUIRED

User should evaluate:

1. ArrowUp feels like one deliberate Action, not continuous hold pressure.
2. Holding ArrowUp does not machine-gun Push.
3. Startup is responsive enough but creates a readable commitment.
4. Active phase feels like a short step-in / drive, not a dash.
5. Contact Push visibly moves the opponent and feels causally connected to the button press.
6. Recovery creates some vulnerability/commitment without feeling frustrating.
7. During Push, inability to freely steer feels appropriate for future lateral dodge counterplay.
8. After Push, normal WASD returns cleanly.
9. Contact without Push still behaves like the accepted 03A2 baseline.
10. Non-contact Movement still feels like the accepted ACTION-02B baseline.
11. The action seems suitable as the future target for ↓ counter / lateral evade timing.

Agent report:

`User Play Test: REQUIRED / NOT RUN`

Technical PASS != Push Feel Accepted.

Do not proceed to Counter or Ring-out.

## 19. Acceptance Criteria

AC-01: D1 discrete edge Push semantics implemented.
AC-02: D2 ArrowUp temporary binding implemented.
AC-03: one keydown creates one Push only; hold does not repeat.
AC-04: Push has deterministic startup / active / recovery state.
AC-05: Push direction locks at action start.
AC-06: Push suppresses free steering during commitment.
AC-07: non-contact Push creates only a short forward step.
AC-08: Active Contact Push creates explicit external momentum.
AC-09: selfVelocity and externalVelocity remain distinct canonical runtime concepts.
AC-10: Snapshot velocity represents total actual velocity.
AC-11: external momentum decays independently to zero.
AC-12: equal simultaneous Push yields no net external drive.
AC-13: ACTION-03A2 Contact no-creep regression PASS.
AC-14: ACTION-02B no-contact Movement regression PASS.
AC-15: no attributes / Counter / Ring-out / impact-transfer scope creep.
AC-16: T37〜T49 + existing tests PASS.
AC-17: `pnpm build` PASS.
AC-18: Browser Smoke PASS.
AC-19: Current State docs match material Source changes.
AC-20: User Play Test REQUIRED / NOT RUN.
AC-21: Scope外変更なし.

## 20. Stop Conditions

STOP if:

- Preflight fails
- Current Source / Review Handoff conflict
- discrete Push cannot work without changing accepted Contact semantics
- external momentum requires reworking accepted grounded Movement behavior
- input edge cannot be delivered reliably without a broad Input framework
- Physics engine/new dependency appears required
- Push needs Weight / mass / traction to function at all
- task-external User changes / divergence exist

Do not broaden Scope.

## 21. Completion Report

Minimum:

- Result
- Preflight
- Changed Files
- D1 / D2 Implementation
- Push Runtime State
- provisional phase timings
- Input edge latch
- selfVelocity / externalVelocity ownership
- Push force / external momentum constants
- Contact integration
- T37〜T49 + regression tests
- Browser Smoke
- AC-01〜AC-21
- Implementation Evidence
- Design Deviations
- Unexpected Scope
- Known Untested
- User Play Test: REQUIRED / NOT RUN
- Git delivery

Implementation Evidence minimum:

1. one press = one Push
2. hold no-repeat
3. startup/active/recovery
4. locked direction
5. short non-contact drive
6. Contact Push external momentum
7. self/external separation
8. Contact + Movement regression preservation

## 22. Git Delivery

Follow AGENTS.md.

Technical PASS:

- Task-owned files only
- tests / build / diff-check
- Completion Report in same Task commit
- 1 Agent Task ≈ 1 commit
- push `origin/develop`
- verify remote SHA / clean working tree

Commit message example:

`feat: add discrete push action`

Do not change main.

## 23. Final Instruction

This Task ends after the discrete Push prototype.

Do not continue to ↓ Counter, thrust, attributes, Ring-out, or Tachiai.

After commit / push / Completion Report, stop and report:

「ACTION-03B-DISCRETE-PUSH-EXTERNAL-MOMENTUM が完了し、ChatGPT ReviewとUser Play Test待ちです」


# Final ChatGPT Review

Overall Result: TECHNICAL PASS WITH NON-BLOCKING CORRECTION / USER PLAY TEST REQUIRED

## Accepted Baseline

- Accepted implementation commit: `3c79fc18491c10d58105436b9cc424a608568558`
- Agent-Start-Head: `baa772e123b623e6e1f9edf675c984ef5991821d`
- Agent Task Diff is exactly one implementation commit.
- `main` remains unchanged at `4ebe840e029a0c8b7faa515934fbeea7e7e05acf`.
- Production changes are limited to the Push/Input implementation, focused tests, Current-State docs, and Completion Report.
- Reported 75/75 tests, build PASS, and diff-check PASS are consistent with direct Source/Diff review.
- Push Feel is NOT accepted until User Play Test.

## Accepted Decisions

- D1 remains accepted: Push is edge-triggered and discrete, not hold-auto-repeat.
- D2 remains accepted: ArrowUp is the temporary Prototype Push binding.
- Push runtime state is Simulation-owned and intentionally small:
  - idle
  - startup
  - active
  - recovery
- Initial provisional phase timings are accepted for User Play Test:
  - startup 6 ticks (~100 ms)
  - active 8 ticks (~133 ms)
  - recovery 10 ticks (~167 ms)
- Push direction is captured from facing at action start and remains locked for the current action.
- WASD steering is suppressed throughout startup / active / recovery.
- Startup and Recovery use zero effective movement input; Active uses the locked Push direction through the existing grounded movement rule.
- Presses received while an action is already active are ignored and not queued.
- A new Push requires a later new key-down after returning to idle.
- The small Pure `PressLatch` is accepted:
  - key-down latches one semantic edge
  - a zero-tick render frame does not lose it
  - first subsequent Simulation tick consumes it
  - later ticks do not repeat it
  - no generic Input Buffer framework was introduced
- Model B is now concretely accepted as the current Push prototype architecture:
  - `selfVelocity` = own grounded locomotion
  - `externalVelocity` = Push/external pair-momentum component
  - actual displacement and Snapshot `velocity` = self + external
- Grounded locomotion damping applies only to selfVelocity.
- External momentum has its own deterministic decay and speed clamp.
- Current provisional external values are accepted for User Play Test only:
  - `PUSH_EXTERNAL_ACCELERATION = 20 m/s²`
  - `EXTERNAL_DECELERATION = 8 m/s²`
  - `MAX_EXTERNAL_SPEED = 3 m/s`
- Contact-only ACTION-03A2 behavior remains preserved when Push is absent.
- Push is applied as explicit external momentum, not hidden penetration correction.
- Equal simultaneous active Pushes cancel in this equal-stat Prototype.
- Separate one-time collision impact / Tachiai impulse remains Deferred.
- Minimal STARTUP / PUSH / RECOVERY presentation and R restart are acceptable Prototype aids.

## Non-Blocking Correction

### C-1 — externalVelocity wording is narrower than current semantics

Some code/type comments describe `externalVelocity` as strictly “momentum received from the opponent”.

Current implementation intentionally applies the same Push delta to both participants so the contacting pair translates together. Therefore the pushing participant can also carry non-zero `externalVelocity` from its own Push.

For the current Prototype, interpret the field as:

- **external / pair momentum not produced by grounded footwork**

rather than literally only “momentum received from opponent”.

No Production correction is required before User Play Test.
At the next legitimate Current-State/code-comment sync, adjust wording if those comments are touched.

This does not change the accepted Model B state ownership.

## Verification Review

Direct Source review confirmed:

- `ParticipantIntent.pushPressed` is semantic, not a raw key.
- action Snapshot is copied and isolated.
- Push phase timing is deterministic and tested.
- direction locking is tested against later facing changes.
- Action steering suppression and return to WASD are tested.
- non-contact Push creates a short self-driven step with zero external momentum.
- contact Push creates external pair movement.
- external momentum decay is independent from grounded damping.
- no-Push Contact no-creep regression remains covered.
- no-contact Movement regression remains covered.
- PressLatch is Pure TypeScript and has focused consumption tests.
- Browser wiring consumes the latch only for the first Simulation tick in a multi-tick frame.
- No Counter, Ring-out, Rikishi attributes, Physics engine, or new dependency was introduced.

## Reported Unexpected Scope Review

The one trailing-whitespace cleanup in `BoutSimulation.test.ts` is behavior-neutral and occurred in a Task-owned file already being edited.

Accepted as non-material for this Task, but do not use unrelated cleanup as a reason to expand future Task scope.

## Do Not Reopen

- discrete one-press Push semantics
- ArrowUp as current temporary Prototype binding
- locked Push direction during one action
- selfVelocity / externalVelocity separation
- accepted ACTION-03A2 Contact behavior
- grounded ACTION-02B Movement baseline
- no Physics engine
- no auto-repeat Push in this Prototype

Do not add Counter / Dodge / Ring-out / attributes until Push Feel is evaluated.

## Deferred

- ↓ pull / deflection / counter
- explicit lateral dodge Action
- left/right thrust
- Push combo / auto-repeat
- one-time impact / Tachiai impulse
- Weight / Power / LowerBody
- mass / traction / pushForce derivation
- Stamina / Balance
- Ring-out / BoutOutcome
- CPU AI
- Touch / Gamepad
- animation / VFX / camera / audio

## User Play Test

REQUIRED / READY.

User should verify:

1. ArrowUp feels like one deliberate Push action.
2. Holding ArrowUp does not repeatedly Push.
3. Startup feels responsive enough while still creating a readable commitment.
4. Active movement feels like a short step-in/drive, not a dash.
5. Contact Push visibly moves the opponent and feels causally connected to ArrowUp.
6. Recovery feels like useful commitment/vulnerability rather than frustrating lockout.
7. Steering lock during Push feels appropriate for future side-step/counter play.
8. WASD returns cleanly after Recovery.
9. Contact without Push still feels like accepted ACTION-03A2.
10. Normal non-contact movement still feels like accepted ACTION-02B.
11. Push seems like a good future target for ↓ pull/deflection and lateral evasion timing.
12. Note whether the opponent moves too far/too little per Push and whether momentum lingers too long/too briefly.

If accepted:
- ACTION-03B becomes the current Push baseline.
- Do not immediately add all combat actions.
- Next design step should choose whether to validate incoming/contested Push feel with a minimal dummy opponent before implementing Counter, or proceed to the next explicitly chosen interaction.

If rejected:
- record concrete phase/timing/drive/momentum feedback and perform a focused Push Feel correction.

## Regression Risks

- Future traction/mass parameters accidentally damping self and external components together.
- Counter implementation modifying Push phase semantics rather than reacting to them.
- Future impact/Tachiai impulse being layered in without distinguishing it from sustained Push momentum.
- Push external tuning becoming treated as final balance.
- Future Input work bypassing the semantic edge latch and reintroducing frame-dependent actions.

## Next Task Constraints

1. User Play Test ACTION-03B first.
2. Do not create Counter / Ring-out / parameter implementation before Push Feel is accepted.
3. Preserve one-keydown-one-action semantics unless User explicitly changes it.
4. If User accepts Push but wants the opponent to push back interactively, use the smallest dummy-controller test path before introducing full CPU AI.


# User Play Test Result — 2026-10-18

Push Feel: ACCEPTED AS CURRENT BASELINE

User feedback:
- Current discrete Push is acceptable for now.
- One-press Action semantics, timing, recovery, steering lock, and return to WASD are acceptable as the working baseline.
- The forward step distance feels slightly short, but this is not a blocker at the current stage.
- The amount the opponent moves is also acceptable for the current equal-stat Prototype.
- Both forward step distance and opponent displacement are expected to be revisited when later parameters / balance (e.g. Weight / Power / LowerBody and related Push tuning) are introduced.

Accepted baseline:
- ArrowUp remains the temporary Prototype Push key.
- Push remains one keydown = one discrete action.
- Startup / Active / Recovery structure remains.
- Push direction remains locked during the action.
- Action-time steering lock remains.
- Model B selfVelocity / externalVelocity separation remains.
- Current Push/contact behavior is accepted as the working baseline.

Deferred tuning:
- Push forward step distance
- opponent displacement amount
- phase timings
- PUSH_EXTERNAL_ACCELERATION / EXTERNAL_DECELERATION / MAX_EXTERNAL_SPEED
- future parameter-derived differences

Do not reopen these values preemptively without a concrete later interaction requirement, regression, or User feedback.

Next-step choice remains open:
- validate incoming / contested Push with the smallest dummy opponent first, or
- move to focused design of the next counter interaction (Down pull / deflection), preserving the accepted Push baseline.
