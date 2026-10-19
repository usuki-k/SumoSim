Task-ID: ACTION-05B-GRAPPLED-ORIENTATION-INVESTIGATION
Status: REVIEWED
Task-Type: INVESTIGATION / GRAPPLED FACING & ACTION ELIGIBILITY
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: 61a1a493a54a02cc7d171f3c70d722a6640f871f
Handoff-Mode: GITHUB

# ACTION-05B — Grappled Orientation / Facing Advantage Investigation

## Purpose

ACTION-05A Grip / Engagement FoundationはTechnical Review + User Play TestでAcceptされた。

User Play Testで新しい不足が見つかった。

Current behavior:
- Counter Success → side
- Counter Best → rear
- target Kuzushi
- Shift Grip → Morozashi
- Morozashi成立時にKuzushiを消費
- その後Current `updateFacing()` がstable participantを即座に相手へ向ける
- 結果、Grip後はside / rearの向き差がほぼ消える

Userが将来実現したいGameplay:

- 側面・背後からGripされたparticipantは、相手を正面に捉えるまで攻撃/防御Actionを使えない
- その間、向きを取っている側は一方的にActionできる
- sideは短いopening
- rearはより長いopening
- 正面まで旋回すれば通常の組みActionへ戻る

このTaskでは、Grappled Drive / Throw / Liftを実装する前に、
**Grappled中のfacing、旋回、Action eligibilityの最小設計を確定する。**

Investigation Only / No Production Changes.

Repository変更は
`docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
のみ。

## Accepted Baseline

Accepted Production Source:
`61a1a493a54a02cc7d171f3c70d722a6640f871f`

Preserve unless this Investigation identifies an explicit conflict:

- FREE Movement / Contact
- Push / Counter
- Kuzushi
- Best→rear / Success→side relocation
- Counter overshoot
- pair-level Engagement SoT
- stable valid Grip → neutral GRAPPLED
- Kuzushi valid Grip → Morozashi
- Morozashi establishment consumes Kuzushi
- Grip range/reach/recovery
- Grapple bond
- ACTION-05A release semantics
- GRAPPLED normal WASD suppression
- Shift temporary Grip / Release key

Do not implement Drive / Throw / Lift in this Task.

## New User Requirement

Treat as Current design intent:

1. Grapple established from side/rear must preserve the victim's facing disadvantage.
2. Disadvantaged participant must rotate toward the opponent before normal grapple Actions are available.
3. Until aligned, advantaged participant may act while disadvantaged participant cannot.
4. Rear should naturally create a longer advantage window than side.
5. This must be gameplay-owned by Pure TypeScript Simulation, not presentation-only animation.

Exact:
- rotation speed
- alignment threshold
- allowed/blocked action list
- release behavior while misaligned
are not yet decided.

## Architecture Principle To Investigate

Strong preferred direction:

- Do NOT store `side`, `rear`, `orientationAdvantage`, `stunnedByRear` as duplicated persistent state if the same meaning can be derived.
- canonical Source remains:
  - participant position
  - participant facing
  - pair Engagement
- derive each participant's current facing error from:
  - their `facing`
  - bearing from them toward opponent
- Grappled action eligibility is derived from this error.
- gradual facing update reduces the error over fixed Simulation ticks.

This should naturally make:
- frontal ≈ immediately ready
- side ≈ ~90° turn
- rear ≈ ~180° turn

without separate side/rear timers.

If Current Source requires explicit additional state for correctness, explain why before recommending it.

## Investigation Questions

### Q1 — Exact Current Source conflict

Inspect Current Source and explain exactly where side/rear advantage disappears.

Confirm:
- when Kuzushi is consumed
- when `updateFacing()` runs
- how Grapple bond changes positions
- whether Grip establishment currently preserves the target's pre-Grip facing for any part of the tick

### Q2 — Alignment definition

Recommend a pure, deterministic definition of "participant is facing opponent enough to act".

Candidate:

```ts
targetAngle = atan2(opponent.y - self.y, opponent.x - self.x)
error = shortestSignedAngle(targetAngle - self.facing)
aligned = abs(error) <= GRAPPLE_FACING_TOLERANCE
```

Decide:
- radians helper semantics
- exact tie / ±π behavior
- whether tolerance should be one named provisional constant

Do not choose a final balance value without labeling it provisional.

### Q3 — Gradual Grappled turning

Recommend the smallest rule for GRAPPLED facing.

Preferred direction to evaluate:
- while FREE: preserve current instant auto-facing baseline
- while GRAPPLED: each participant rotates toward opponent by at most
  `GRAPPLE_TURN_RATE * TICK_SECONDS`
  per tick
- shortest deterministic angular path
- snap to target when remaining error <= one step

Compare against:
- fixed timer stun
- stored side/rear category
- player-controlled turn input

Recommend one.

### Q4 — Automatic vs manual turn

User wants simple action gameplay.

Determine whether disadvantaged participant should:
- auto-turn while grappled, or
- require input to rotate.

Preferred direction to evaluate:
**automatic fixed-rate turn**, because ACTION-05A suppresses ordinary WASD and no rotation input exists.

Explain Game Feel consequences.

### Q5 — Action eligibility model

Future GRAPPLED actions are expected to include:
- ↑ Drive / Yorikiri
- ←/→ Throw
- ↓ Lift
- Shift Release

Define the smallest rule for action eligibility.

Candidate:
- participant whose facing is aligned may use grapple actions
- participant still turning cannot use grapple offensive/defensive actions
- each participant evaluated independently

This allows:
- gripper aligned + target misaligned → gripper acts alone
- both aligned → both normal
- both misaligned → neither acts until individually aligned

Determine whether an explicit `canActInGrapple(participant)` pure helper is appropriate.

### Q6 — Release conflict

This is the most important User Decision.

ACTION-05A currently allows either participant to Shift-release immediately.

But if a rear/side-disadvantaged participant can release immediately:
- it can escape before turning
- FREE auto-facing then snaps toward opponent
- the new orientation advantage may be largely bypassed

Compare:

A. Release is also blocked until participant is aligned.
B. Release remains always allowed, but Recovery/other penalty preserves advantage.
C. Release remains allowed and FREE facing is also made gradual after release.
D. another minimal rule.

Recommend one, but mark it **User Decision Required** if it changes accepted ACTION-05A release semantics.

Do not silently change release behavior.

### Q7 — What does "何も出来ない" block?

Clarify design options for the disadvantaged turning participant.

Potential future actions:
- Drive
- Throw
- Lift
- Release
- future hand fighting/regrip
- passive turning itself

Recommend which are blocked in the first Orientation implementation.

Do not implement future actions; define only eligibility boundary.

### Q8 — Advantaged participant while target turns

Confirm what "一方的に攻撃Action出来る" should mean architecturally.

Preferred direction:
- advantaged participant uses the normal future Grapple action system
- no separate "free attack" state
- opponent action eligibility is simply false until aligned

Determine whether any action by advantaged participant should interrupt/reset the target's turn.

Default preference:
- no hidden reset unless the future action explicitly changes geometry/facing.

### Q9 — Morozashi vs Orientation advantage

Keep separate concepts:

- Morozashi = persistent Engagement advantage
- Orientation = derived current facing readiness

Investigate how future Drive / Throw resolver should read both without creating combined states such as:
- rear-morozashi
- side-morozashi

Recommend explicit inputs/boundaries.

### Q10 — Counter Best vs Success integration

Using Current Counter geometry, reason through:

- Success side → target facing error after Grip
- Best rear → target facing error after Grip

Confirm whether the proposed angle-based rule naturally makes Best's opening longer than Success at the same turn rate.

If Current geometry or facing state makes this unreliable, report it.

### Q11 — Neutral/front Grip

Normal frontal Grip should not create an artificial helpless period.

Define expected behavior:
- if already within facing tolerance on establishment, both immediately ready
- no mandatory startup stun solely because grapple began

Confirm whether Current auto-facing before normal Grip means this usually holds.

### Q12 — Bond / rotation interaction

Current Grapple bond fixes center distance but does not rotate positions around the pair.

Determine whether turning should:
- change facing only, leaving positions fixed
or
- orbit bodies around one another.

Preferred first Prototype:
**facing-only turn**.

Explain whether this is sufficient for action eligibility and visual readability.

Do not introduce orbit/constraint mechanics unless necessary.

### Q13 — Tick order

Recommend exact step ownership.

Need to decide whether GRAPPLED orientation update happens:
- before action eligibility checks
- after action resolution
- at end-of-tick replacing current instant `updateFacing`

Define off-by-one semantics:
- when participant crosses tolerance on a tick, may it act that same tick or next tick?

Prefer one deterministic rule and explain why.

### Q14 — Snapshot / presentation

Determine whether Snapshot needs new stored orientation state.

Preferred:
- no new canonical state if readiness can be derived
- optionally expose/use a shared pure helper for presentation

Minimum later debug presentation should make visible:
- TURNING / READY per participant
- current facing marker already exists
- maybe alignment error in debug text only if useful

Avoid duplicating core formula in Scene.

### Q15 — Future stats boundary

Do not implement stats.

Define how future:
- agility
- technique
- balance
or another decided stat
could later modify turn rate.

Do not choose a stat now.
Do not make turn rate part of ParticipantSetup yet unless required.

### Q16 — Directional Push advantage interaction

A separate Deferred requirement exists:
- side/rear Push should be stronger than frontal Push.

Explain how Grappled orientation rule coexists with it.

Preferred separation:
- FREE Push directional advantage derives from relative geometry/facing at Push resolution.
- GRAPPLED action readiness derives from each participant's facing alignment.
- no shared stored side/rear flag.

### Q17 — First implementation scope

Recommend whether next implementation should be:

**ACTION-05B1 Grappled Orientation Foundation**
only:
- gradual GRAPPLED facing
- derived readiness
- action gate boundary
- debug TURNING/READY
- Counter side/rear integration tests

then:

**ACTION-05C Grappled Drive**
- ↑ Drive
- normal vs Morozashi force difference
- orientation readiness gates who can Drive

Do not bundle Drive into Orientation Foundation unless there is no meaningful way to test orientation without one minimal action.

### Q18 — Automated test matrix

Specify focused tests for later Orientation implementation, including at minimum:

- frontal Grip → immediately ready
- side Grip → victim turning, gripper ready
- rear Grip → victim turning longer than side
- deterministic shortest-angle turn in both signs
- exact tolerance boundary
- exact turn-rate / no overshoot
- action readiness flips only at defined tick
- no stored side/rear duplicate state
- Morozashi remains separate from orientation readiness
- release behavior according to User Decision
- FREE auto-facing regression unchanged
- Counter Success→Grip and Best→Grip integration
- replay determinism / finite facing
- existing 148 tests remain PASS when new grapple actions unused

### Q19 — User Play Test plan

Define the later Orientation implementation Play Test:

- side feels like a short opening
- rear feels like a longer opening
- victim visibly turns instead of snapping
- holder can act first
- front Grip has no unnecessary delay
- turn speed is readable and not frustrating
- release rule is understandable
- neutral vs Morozashi remains distinct
- no jitter in bond/facing markers

### Q20 — User Decisions Required

List only decisions genuinely needed before implementation.

At minimum evaluate:
- provisional turn rate
- facing tolerance
- release while misaligned
- whether "cannot act" includes all future grapple actions

Give one recommended default for each.

## Constraints

Maintain:

```
Pure TS Simulation
  participant position/facing
  participant action/posture
  pair engagement
  derived grapple readiness
      ↓
Snapshot / shared pure helpers
      ↓
Phaser presentation
```

Do not:
- make Scene authoritative
- create a side/rear persistent state unless proven necessary
- create a stun timer as substitute for actual turning
- add general state machine/rule engine
- add Physics
- add new dependency

## Scope Out

Do NOT implement:

- production facing changes
- Drive / Yorikiri
- Morozashi Drive multiplier
- Throw
- Lift
- release behavior change
- directional Push advantage
- stats
- Ring-out / BoutOutcome
- AI
- final animation
- Push/Counter/Grip tuning

This is Investigation Only.

## Stop Conditions

Return BLOCKED if:

- Current facing semantics cannot preserve side/rear advantage without changing FREE facing baseline
- release semantics make the User requirement impossible without an explicit User choice
- derived facing alignment is insufficient and requires persistent orientation state
- Grapple bond must be redesigned materially
- a Drive implementation is technically required just to validate orientation
- Current Source / Handoff materially conflict

Do not make Production changes to work around a design issue.

## Required Reading

Inspect at minimum:

- `AGENTS.md`
- `src/game/sumo/BoutTypes.ts`
- `src/game/sumo/BoutSimulation.ts`
- `src/game/sumo/BoutGrip.test.ts`
- `src/game/sumo/BoutCounter.test.ts`
- `src/game/sumo/BoutCounterPosition.test.ts`
- `src/game/scenes/BoutScene.ts`
- `docs/ARCHITECTURE.md`
- Current Task Final Review + User Play Test acceptance

## Verification

Investigation / Design Review.

Required:
- Q1–Q20 answered or explicit BLOCKED point
- Current Fact / Recommendation / User Decision / Deferred separated
- Production Source unchanged
- package / lockfile unchanged
- repository change only `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- `git diff --check` PASS

`pnpm test` / `pnpm build` not required because Source must not change.

## Completion Report

Minimum:

- Result
- Preflight
- Current Source Findings
- Q1–Q20
- Recommended alignment formula
- recommended turn rule
- recommended action-readiness rule
- release conflict analysis
- Morozashi vs Orientation separation
- Counter Success/Best integration
- tick-order recommendation
- Snapshot/presentation boundary
- required automated tests
- User Play Test plan
- User Decisions Required
- Rejected / Deferred
- Next Implementation Sequence
- Design Deviations
- Unexpected Scope
- Verification
- Git delivery

Result:
- PASS if safe design exists and explicit User choices remain
- BLOCKED if a material prerequisite/design conflict prevents a safe implementation plan

## User Play Test

NOT REQUIRED for Investigation.

The report must identify the first implementation Task where Orientation Feel becomes REQUIRED.

## Git Delivery

Investigation-only Report Commit Exception:

- change only `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- explicit stage
- `git diff --check`
- one Report-only commit
- push `origin/develop`
- verify remote SHA / clean working tree

Commit message example:
`docs(agent): investigate grappled orientation advantage`

## Final Instruction

Stop after Investigation.

Do not implement Orientation, Drive, Throw, Lift, directional Push advantage, or stats.

After Report Commit / Push, report:

「ACTION-05B-GRAPPLED-ORIENTATION-INVESTIGATION が完了し、ChatGPT Review待ちです」


# Final ChatGPT Review

Overall Result: PASS / USER DECISIONS REQUIRED BEFORE IMPLEMENTATION

## Reviewed Investigation

- Investigation report commit:
  `4a8422d01ea11403ccd583e2c51af228e133f393`
- Agent-Start-Head:
  `191b79e152bf28aa0c28cf9c8ec42e83b6229170`
- Diff is exactly one Report-only commit:
  `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- Production Source / package / lockfile unchanged.
- `main` unchanged.

## Current Source Review

PASS.

Direct Source and prior accepted baseline support the Report's central diagnosis:

- Counter Success relocates defender to attacker side.
- Counter Best relocates defender to attacker rear.
- Countered attacker enters Kuzushi, which freezes its existing facing.
- stable Counter defender continues auto-facing the attacker.
- Grip on Kuzushi consumes Kuzushi and establishes Morozashi.
- Current `updateFacing()` then sees both participants stable and snaps both to face each other at the end of the Grip-establishment tick.
- therefore current side/rear orientation advantage disappears before the resulting Snapshot is presented.

Grapple bond is radial-only and does not itself erase the angular disadvantage.

## Accepted Architecture Direction

### A-1 — Do not store Side / Rear as new canonical state

Accept.

Use existing canonical:
- position
- facing
- Engagement

Derive orientation readiness from current facing error.

Do not add persistent:
- side
- rear
- orientationAdvantage
- rearStun
unless a later task proves derived geometry insufficient.

### A-2 — Derived facing error

Accept the proposed form:

```ts
bearing = atan2(opponent.y - self.y, opponent.x - self.x)
error = normalizeAngle(bearing - self.facing)
ready = abs(error) <= GRAPPLE_FACING_TOLERANCE
```

A small Pure TypeScript helper/module shared by Simulation and presentation is appropriate.

### A-3 — GRAPPLED-only gradual facing

Accept.

- FREE keeps current immediate auto-facing baseline.
- GRAPPLED participants rotate toward opponent by a fixed maximum angle per Simulation tick.
- use shortest angular path.
- no overshoot; snap when remaining error is smaller than one turn step.
- exact ±π tie must be deterministic.

This is smaller and clearer than:
- hidden stun timer
- saved side/rear categories
- new manual rotation input
- orbit/path mechanics.

### A-4 — Automatic turning

Accept as first Prototype direction.

ACTION-05A already suppresses normal GRAPPLED WASD and there is no rotation input.
Automatic fixed-rate reorientation keeps controls simple and makes opening length proportional to actual angular disadvantage.

### A-5 — Independent action readiness

Accept.

Each participant independently derives:
- TURNING
- READY

Future Grapple Actions should use one readiness boundary rather than bespoke checks.

Expected:
- gripper READY + target TURNING → gripper may act alone
- both READY → normal contested grapple
- both TURNING → each becomes eligible independently when aligned

### A-6 — Morozashi and Orientation are separate axes

Accept.

- Morozashi = persistent Engagement advantage.
- Orientation readiness = derived transient facing relationship.

Do not create combined states such as:
- sideMorozashi
- rearMorozashi.

Future Drive/Throw may read both independently.

## Counter Integration Review

Accepted.

With current geometry:

- Success side is approximately 90° target-facing error.
- Best rear is approximately 180° target-facing error.
- same turn rate naturally makes rear opening longer than side.

With the Report's provisional values:
- turn rate = 180°/s
- tolerance = 15°
- side opening ≈ 25 ticks / 0.42s
- rear opening ≈ 55 ticks / 0.92s

These are correct Prototype-scale values, not final balance.

## Tick Ownership

Accept the Report recommendation:

- readiness used for an input tick is derived from the state visible at the start of that tick.
- GRAPPLED turning happens at the end-of-tick facing update.
- if turning enters tolerance at tick t end, Grapple action eligibility begins at tick t+1.

This matches Snapshot-visible state and avoids same-tick hidden eligibility changes.

## Release Conflict

The Report correctly identifies a material conflict with ACTION-05A.

If the disadvantaged participant may always Shift-release while facing away:

- Engagement becomes FREE immediately.
- FREE auto-facing restores front-facing at tick end.
- only Grip Recovery remains.
- rear/side orientation advantage can be bypassed much more cheaply than actually turning.

Recommended change:

**While GRAPPLED and TURNING, that participant cannot Release.**

A READY participant may still Release normally.

This is the cleanest interpretation of User's stated future rule:
"相手は正面に旋回するまで何も出来ない。"

However, because this changes accepted ACTION-05A Release semantics, record it as explicit User Decision before production implementation.

## User Decisions Required

Recommended all as one coherent Prototype baseline:

### UD-1 — GRAPPLED turn rate

Recommended:
`GRAPPLE_TURN_RATE = π rad/s`
= 180°/s.

This yields approximately:
- side opening: 0.42s
- rear opening: 0.92s
with 15° tolerance.

### UD-2 — READY tolerance

Recommended:
`GRAPPLE_FACING_TOLERANCE = π/12`
= 15°.

### UD-3 — Release while TURNING

Recommended:

**Not allowed.**

Shift release is accepted only when that participant is READY.

Input while TURNING is ignored, not queued.

### UD-4 — Meaning of "cannot act"

Recommended:

Until READY, block all participant-initiated GRAPPLED actions:
- Release
- future Drive
- future Throw
- future Lift
- future regrip / hand-fighting

Automatic reorientation continues because it is not an Action.

## Technical Decisions Accepted Without Further User Choice

- angle normalization range `(-π, π]`
- exact rear ±π tie uses one fixed deterministic turn direction
- no randomness
- facing-only rotation; positions stay fixed by current bond
- no new canonical Orientation state
- presentation uses the same Pure helper rather than duplicating formulas
- normal frontal Grip does not receive a mandatory stun
- FREE instant auto-facing stays unchanged in this task

## Implementation Sequence

After UD-1–UD-4 are confirmed:

1. **ACTION-05B1 Grappled Orientation Foundation**
   - Pure angle/readiness helpers
   - GRAPPLED gradual facing
   - TURNING / READY derivation
   - release gate according to UD-3
   - debug presentation
   - Success-side / Best-rear integration tests
   - User Play Test REQUIRED

2. **ACTION-05C Grappled Drive / Yorikiri**
   - ↑ Drive
   - orientation READY gates action availability
   - neutral vs Morozashi strength difference
   - decide whether minimal Ring-out/BoutOutcome is prerequisite for meaningful testing

3. Throw / Lift only after Drive is accepted.

## Orientation Foundation User Play Test Goal

The first implementation should verify only:

- front Grip has essentially no extra delay
- side Grip visibly creates a shorter TURNING period
- rear Grip visibly creates a longer TURNING period
- target rotates rather than snaps
- release while TURNING follows accepted rule
- no facing/bond jitter
- neutral vs Morozashi state remains distinct

"Advantaged participant can attack while target cannot" will become fully playable when ACTION-05C adds Drive.

## Do Not Reopen

Unless later Play Test exposes a concrete issue:

- pair-level Engagement SoT
- Kuzushi → Morozashi
- Kuzushi consumption
- Counter Success side / Best rear geometry
- GRAPPLED bond
- FREE instant auto-facing
- Shift as temporary Grip/Release binding

## Deferred

- Grappled Drive / Morozashi Drive bonus
- Throw
- Lift
- turn-rate stat scaling
- manual grapple rotation
- pair orbit mechanics
- directional FREE Push advantage
- Ring-out / BoutOutcome
- final animation
