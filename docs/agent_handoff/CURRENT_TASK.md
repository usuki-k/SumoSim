Task-ID: ACTION-06-RINGOUT-BOUTOUTCOME-INVESTIGATION
Status: READY
Task-Type: INVESTIGATION / RING-OUT & BOUT OUTCOME DESIGN
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: 7a28a211cf718a15e29cc7b15817b55e38be6bbf
Handoff-Mode: GITHUB

# ACTION-06 — Ring-out / BoutOutcome Investigation

## Purpose

ACTION-05C1 Grappled Drive FoundationはTechnical Review + User Play TestでAcceptされた。

Current Boutは:
- Pushで押し出せる
- Counterで位置が変わる
- Grip / Morozashiがある
- Grappled Driveでpairを土俵外まで運べる
- しかし土俵外へ出ても勝敗が発生しない

次は、超小型Gameplay LoopのBoutを「終われる」ようにするため、
**最小Ring-out判定 + BoutOutcomeのSimulation-owned設計**
を確定する。

Investigation Only / No Production Changes.

このTaskでは:
- Ring-outの境界
- 同時Ring-out
- Outcome state
- Outcome後のSimulation
- Sceneの最小表示
- Drive/Push/Counterとのtick順序
を決める。

まだ実装しない:
- Result / Reward画面
- 決まり手一般
- 倒れ/手付き
- Throw / Lift
- Training / Management loop

## Accepted Baseline

Accepted Production Source:
`7a28a211cf718a15e29cc7b15817b55e38be6bbf`

Current developとの差分はReview / PlayTest coordinationのみ。

Preserve:
- Movement / Contact
- Push
- Counter / Kuzushi
- Counter Success→side / Best→rear
- Grip / Engagement / Morozashi
- Grapple bond
- Grappled Orientation
- Grappled Drive
- Model B external/pair momentum
- current Input semantics
- current provisional numeric tuning

User Play Test:
- Grappled DriveはOK
- 全体Game Speedはまだ速いが、今は局所調整しない

Do not retune existing systems.

## Current Known Gap

Current Source:
- arena is a circle centered at (0,0) with `arena.radius`
- participant has `position` and `bodyRadius`
- bodyRadius is Contact geometry, not explicitly a foot/support radius
- there is no BoutOutcome / winner / loser
- Scene R restart exists
- Drive can move the pair arbitrarily beyond ring boundary
- no wall/clamp exists

Previous early Ring-out discussion contained only **recommendations**, not Accepted Decisions:
- a support-circle style criterion was suggested
- a provisional support ratio around 0.5 was suggested
- simultaneous Ring-out could compare who is deeper out
- exact tie could become redo

Treat these as prior proposals only.
Re-evaluate against Current Source.
Do not silently adopt them as fact.

## Central Design Goal

Ring-out must be:

- Pure TypeScript Simulation-owned
- deterministic
- independent of rendering pixels
- based on canonical position/geometry
- compatible with future unequal body sizes
- testable at exact boundaries
- small enough for Prototype
- able to terminate Bout after Push or Drive

Do not introduce general collision/physics/rule frameworks.

# Investigation Questions

## Q1 — What is Ring-out in this top-down Prototype?

Compare minimal geometric proxies:

A. **Center criterion**
```
distanceFromCenter > arena.radius
```

B. **Full body circle**
```
distanceFromCenter + bodyRadius > arena.radius
```

C. **Support-circle proxy**
```
supportRadius = bodyRadius * RING_OUT_SUPPORT_RATIO
distanceFromCenter + supportRadius > arena.radius
```

Explain Game Feel:
- how far the visible body can cross the dohyo line
- too-early vs too-late loss
- relation to feet/support rather than torso collision circle

Recommend one.

No real foot simulation exists yet.

## Q2 — Support ratio

If C is recommended, propose one provisional constant:

```ts
RING_OUT_SUPPORT_RATIO
```

Previous suggestion was about 0.5, but it was not accepted.

Evaluate:
- 0 = center criterion
- 0.5 = support area smaller than body collision circle
- 1 = body edge criterion

Recommend a Prototype value and explain expected visual feel.

All values remain balance/tuning.

## Q3 — Exact boundary semantics

Decide whether:
```
distance + supportRadius === arena.radius
```
is:
- still IN
or
- OUT

Preferred convention to evaluate:
- exact touching = IN
- strictly greater = OUT

Need deterministic tests around:
- exact boundary
- +epsilon
- -epsilon

Do not add arbitrary gameplay epsilon unless technically required.

## Q4 — Ring-out depth

Define a deterministic measure for simultaneous resolution.

Candidate:
```
depth = distanceFromCenter + supportRadius - arena.radius
```

Positive = out.

Evaluate future unequal radii:
- raw distance beyond support boundary
- normalized depth / supportRadius

Recommend one.

Avoid body-size bias unless justified.

## Q5 — Simultaneous Ring-out

Push and especially Grappled Drive can move both participants in the same tick.

Compare:
A. deeper-out participant loses
B. any both-out = redo
C. first participant by array/order loses
D. random

Recommend deterministic behavior.

Preferred direction to evaluate:
- one out → that participant loses
- both out → deeper-out participant loses
- effectively equal depth → redo

No participant-order or random tie-break.

## Q6 — Exact / near tie

If deeper-out is used, define a technical tie rule.

Need decide:
- exact floating equality only
- small named `RING_OUT_TIE_EPSILON`

Recommend a small technical epsilon only if needed for deterministic mirror symmetry.

Tie must not be decided by participant order.

## Q7 — Redo representation

If simultaneous equal Ring-out yields no winner, how should Outcome represent it?

Candidate:

```ts
type BoutOutcome =
  | { kind: 'ongoing' }
  | {
      kind: 'win'
      winnerId: ParticipantId
      loserId: ParticipantId
      reason: 'ring-out'
    }
  | {
      kind: 'redo'
      reason: 'simultaneous-ring-out'
    }
```

Evaluate:
- explicit `redo` vs draw
- whether reason should already be a union for future loss types
- avoid speculative full kimarite system

Recommend minimal type.

## Q8 — Outcome Source of Truth

Recommend where Outcome lives.

Preferred:
- `BoutSimulation` owns canonical `outcome`
- constructor starts `ongoing`
- `BoutSnapshot` exposes a copied top-level outcome

Do not put winner state in Scene.
Do not duplicate winner/loser flags on participants.

Confirm whether this is sufficient.

## Q9 — Snapshot compatibility

Adding `outcome` changes the top-level Snapshot shape.

Identify current tests that intentionally assert exact Snapshot keys and will need scoped adaptation.

This is an intentional API extension, not regression.

Do not hide Outcome in a second Scene-only API merely to keep old key tests unchanged.

## Q10 — Evaluation tick order

Determine exactly when Ring-out is checked.

Need account for:
- position integration
- ordinary Contact correction
- Counter relocation
- Counter overshoot movement (overshoot is velocity, not same-tick relocation beyond integration)
- Grip attachment
- Grapple bond
- Drive pair translation
- action timers
- facing update

Preferred direction to evaluate:
**after all positional resolution for the tick (Contact / Counter relocation / Grip attachment / Grapple bond), before or at the end of tick state publication.**

Recommend exact order.

## Q11 — Counter relocation interaction

Current `counterRelocationTarget()` only places defender where its whole body fits inside ring:
```
|target| <= arena.radius - defender.bodyRadius
```

This predates actual Ring-out.

Investigate whether this validity constraint should:
- remain unchanged for now
- use future support radius instead
- be removed so Counter can relocate near/outside the ring

Important:
Do not silently redesign accepted Counter geometry in Ring-out implementation.

If changing it is required for coherent Ring-out, mark User Decision / separate task.

## Q12 — Push interaction

Define expected:
- FREE Push moves pair/external momentum
- at end of tick, if one crosses criterion → outcome win
- Push action state may still be active in final Snapshot

Decide whether Ring-out should cancel actions immediately or freeze final tick as-is.

Prefer smallest rule.

## Q13 — Grappled Drive interaction

Define expected:
- pair can translate while bonded
- after spatial resolution, Ring-out checks both independently
- one may be deeper out than the other even with constant bond distance

Ensure Drive itself does not need special Ring-out logic.

## Q14 — Outcome after win

Once Outcome is not ongoing, what does `step()` do?

Compare:
A. strict no-op forever
B. continue physics but ignore input
C. continue presentation-only timer in Simulation

Preferred:
**A — Simulation step is no-op after outcome.**

This creates a stable final Snapshot for Result transition.

Recommend exact semantics:
- positions/velocities/actions/posture/facing/outcome stay unchanged
- no timers continue
- no Drive/Push decay after result

## Q15 — Final action cleanup

If step freezes immediately after deciding outcome, final Snapshot may contain:
- `action: push`
- `action: drive`
- Grip state
- nonzero velocity

Is that acceptable as the last physical instant?

Compare:
- preserve final state exactly
- normalize all actions/velocities to idle/zero

Preferred direction:
preserve final physical state; Outcome is what says Bout ended.
Presentation/Result transition decides what to show later.

Do not mutate unrelated state solely for cleanliness unless required.

## Q16 — Scene behavior

For first Ring-out implementation, recommend minimum presentation:

- show outcome text:
  - PLAYER WIN
  - CPU WIN
  - REDO
- current bodies stay at final positions
- input can still be collected, but Simulation no-op makes it harmless
- R restart starts new Bout

Decide whether Scene must suppress input itself.
Preferred: not necessary for correctness.

No Result Scene yet.

## Q17 — Redo UX

If Outcome = redo:
- should R remain manual restart in this Foundation?
- auto restart?
- timer?

Recommend minimal Prototype behavior.

Preferred:
- show REDO
- manual R restart
- no auto timer

## Q18 — Arena boundary / rendering

Confirm no wall/clamp/bounce is added.

When Ring-out occurs:
- body can visually be partly/outside ring
- state freezes at the crossing tick

This should preserve the feeling of being pushed out.

## Q19 — Body size future compatibility

Future rikishi may have different bodyRadius.

If support criterion uses:
```
supportRadius = bodyRadius * ratio
```
does larger body lose earlier geometrically?

Discuss whether that is acceptable as a Prototype proxy or whether support radius should eventually become a separate physical parameter.

Do not add a new persistent stat now unless necessary.

## Q20 — Ring-out helper boundary

Recommend small Pure helper(s), for example:

```ts
ringOutDepth(position, bodyRadius, arenaRadius): number
resolveRingOut(...): BoutOutcome
```

Should these live:
- in BoutSimulation.ts
- or small `ringOut.ts` Pure module

Prefer small explicit design.

No generic Rule Engine.

## Q21 — Outcome reason extensibility

Future losses may include:
- touching ground
- Throw/fall
- maybe other finish

Do not implement them now.

Decide whether `reason:'ring-out'` should be a string literal union now so future reasons can extend without changing architecture.

Avoid building full kimarite classification.

## Q22 — Result / Reward boundary

The tiny loop eventually needs:
Stable → Training → Bout → Result/Reward → Stable.

Define only the boundary:
- BoutSimulation produces final Outcome
- a future higher-level game state reads it and transitions to Result

Do not implement Result/Reward in this task.

Confirm no Management state should enter BoutSimulation.

## Q23 — Determinism / frame rate

Confirm Ring-out checks once per fixed Simulation tick after spatial resolution.

No render delta.
No continuous collision detection is needed under current speeds/geometry unless investigation proves otherwise.

Assess tunneling risk:
- MAX external speed
- body/ring scale
- 60Hz

If current discrete tick can skip from clearly inside to clearly outside, that is still okay if criterion checks final position, unless first-crossing precision is necessary.

Do not add CCD unless required.

## Q24 — Automated test matrix

Specify tests for later implementation, including at minimum:

- initial outcome ongoing
- Snapshot outcome copy isolation
- exact inside boundary
- exact boundary
- epsilon outside
- A out / B in
- B out / A in
- both out, A deeper
- both out, B deeper
- mirrored equality → redo
- near tie around technical epsilon
- unequal bodyRadius behavior if test setup allows
- Push causes Ring-out
- Grappled Drive causes Ring-out
- Counter relocation near edge interaction
- no wall/clamp
- final state freezes
- repeated step after outcome exact no-op
- R/new Bout returns ongoing at Scene/harness level if practical
- deterministic replay
- finite values
- existing 182 regression tests with intentional Snapshot-shape updates only

Do not sample one participant only; both directions required.

## Q25 — User Play Test plan

First Ring-out implementation should require User Play Test.

Define checks:
- being pushed over edge feels like loss at visually understandable point
- Drive produces a believable Yorikiri-style finish
- body is not called out too early/late
- simultaneous edge cases do not look arbitrary
- outcome freeze is clear
- R restart works
- no invisible wall
- current overall speed remains Deferred

## Q26 — User Decisions Required

List only material decisions before implementation.

At minimum evaluate:
- Ring-out criterion
- support ratio if used
- exact boundary IN/OUT
- simultaneous deeper-out vs redo
- tie handling
- Outcome type including redo
- step freeze after outcome

Give one recommended default for each.

## Q27 — Next Implementation Sequence

Recommend smallest safe sequence.

Likely:
1. ACTION-06A Ring-out / BoutOutcome Foundation
2. User Play Test
3. minimal Result/Reward transition investigation
4. Throw / Lift can proceed in parallel only if they do not require new finish semantics

Do not bundle Result/Reward into Ring-out Foundation.

# Architecture Constraints

Maintain:

```
Pure TS BoutSimulation
  positions / geometry
  engagement / actions
  outcome
      ↓
BoutSnapshot
      ↓
Phaser presentation
      ↓
future higher-level Result transition
```

Outcome is gameplay state, not Scene state.

Do not:
- add Phaser rules
- add Physics
- add wall/clamp
- add ECS/rule engine
- add generic event bus
- add random tie-break
- add Management state to BoutSimulation

# Scope Out

Do NOT implement:
- Production Ring-out
- BoutOutcome code
- Result screen
- Reward
- Training/Stable loop
- Throw
- Lift
- hand-touch/fall detection
- full kimarite
- stamina
- stats
- whole-game tempo tuning
- directional FREE Push advantage
- final art/audio

Investigation Only.

# Required Reading

Inspect at minimum:

- `AGENTS.md`
- `src/game/sumo/BoutTypes.ts`
- `src/game/sumo/BoutSimulation.ts`
- `src/game/sumo/BoutDrive.test.ts`
- `src/game/sumo/BoutPush.test.ts`
- `src/game/sumo/BoutCounterPosition.test.ts`
- `src/game/scenes/BoutScene.ts`
- `docs/ARCHITECTURE.md`
- `docs/GAME_CONCEPT.md`
- Current Task Final Review + User Drive Play Test acceptance

# Stop Conditions

Return BLOCKED if:
- coherent Ring-out requires changing accepted Contact/Drive/Counter architecture
- Counter edge validity materially conflicts with Ring-out and cannot be deferred
- simultaneous Ring-out cannot be resolved without a new unaccepted gameplay rule
- Outcome ownership requires Management state inside BoutSimulation
- current discrete timestep creates unacceptable tunneling requiring a new collision approach
- Current Source materially conflicts with Handoff

Do not make Production changes.

# Verification

Investigation / Design Review.

Required:
- Q1–Q27 answered or explicit BLOCKED
- Current Fact / Recommendation / User Decision / Deferred separated
- Production Source unchanged
- package/lockfile unchanged
- repository change only `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- `git diff --check` PASS

Tests/build not required because Source must not change.

# Completion Report

Minimum:
- Result
- Preflight
- Current Source Findings
- Q1–Q27
- recommended Ring-out criterion
- support geometry
- simultaneous/tie rule
- BoutOutcome type
- tick order
- Counter/Push/Drive interaction
- post-outcome freeze semantics
- Scene boundary
- Result/Reward boundary
- automated test matrix
- User Play Test plan
- User Decisions Required
- Rejected / Deferred
- Next Implementation Sequence
- Design Deviations
- Unexpected Scope
- Verification
- Git delivery

# User Play Test

NOT REQUIRED for Investigation.

Identify first implementation Task where Ring-out Feel becomes REQUIRED.

# Git Delivery

Investigation-only Report Commit Exception:
- change only CURRENT_COMPLETION_REPORT.md
- explicit stage
- git diff --check
- one Report-only commit
- push origin/develop
- verify remote SHA / clean tree

Example:
`docs(agent): investigate ring-out bout outcome`

# Final Instruction

Stop after Investigation.

Do not implement Ring-out, Outcome, Result/Reward, Throw, Lift, stats, or balance changes.

After Report Commit / Push:
「ACTION-06-RINGOUT-BOUTOUTCOME-INVESTIGATION が完了し、ChatGPT Review待ちです」


# Current User Decisions — 2026-10-20

These decisions override earlier recommendation-only alternatives in this Task.

## UD-R1 — Ring-out criterion: CENTER

For this Prototype, Ring-out is based on participant center only.

```ts
distanceFromRingCenter > arena.radius
```

means OUT.

Do NOT use:
- bodyRadius
- support-circle proxy
- support ratio

in ACTION-06A.

Reason:
User wants to start with the simplest center criterion and may revise it later after final/representative graphics make the visual feel easier to judge.

Therefore:
- Q1 is decided: use center criterion.
- Q2 support ratio is NOT APPLICABLE / Deferred.
- future change from center criterion is allowed if later graphics/Play Test show visual mismatch.

## UD-R2 — Exact boundary is IN

If:

```
distanceFromRingCenter === arena.radius
```

the participant is still IN.

Only strict:

```
distanceFromRingCenter > arena.radius
```

is OUT.

Required later tests:
- exact boundary → IN
- just inside → IN
- just outside → OUT

Do not add gameplay epsilon to the single-participant boundary unless a concrete numerical issue is demonstrated.

## UD-R3 — Both OUT in same Simulation tick

User wants near-simultaneous resolution to be a **Rematch**.

Preferred interpretation for this Investigation:

- one participant OUT → that participant loses.
- both OUT in the same fixed Simulation tick:
  - if one is materially deeper outside → deeper participant loses.
  - if outside depths are effectively the same / near-tied → Rematch.

Because fixed-step Simulation cannot know sub-tick real-world crossing order without introducing continuous-time crossing logic, do NOT infer a hidden first-out order.

The Investigation must still recommend:
- exact depth definition under center criterion:
  `depth = distanceFromCenter - arena.radius`
- technical near-tie epsilon for deciding "effectively the same"
- tests for mirrored symmetry.

Terminology:
Use **Rematch**, not Redo, in user-visible naming.

## UD-R4 — User-visible result text

Target result wording:

- `EAST XXX Win`
- `WEST XXX Win`
- `Draw Rematch`

where XXX is the wrestler's name.

Do NOT hard-code `PLAYER WIN` / `CPU WIN` as the target UX.

### Current Source gap

Current Production Source has participant:
- id
- position

and Scene presentation currently has PLAYER/CPU labels.

It does NOT yet have canonical wrestler:
- display name
- EAST/WEST side assignment

Therefore ACTION-06 Investigation must explicitly decide the minimum boundary for result presentation without inventing names or side assignments.

Preferred architecture to evaluate:

- `BoutOutcome` remains gameplay-semantic and stores participant IDs, not formatted text:
  - winnerId
  - loserId
  - reason
- EAST/WEST and display name are presentation/setup metadata outside the outcome rule.
- Scene formats the User-facing text from that mapping.

Do not put strings like `"EAST Foo Win"` inside BoutSimulation as canonical gameplay state.

### Stop / User Decision rule

If ACTION-06A implementation requires concrete wrestler names or an EAST/WEST assignment that Current Source does not provide:
- do not invent them.
- report the smallest required setup/presentation extension for User decision before implementation, or use an already-existing presentation mapping only if it can represent the requested semantics without pretending PLAYER/CPU are EAST/WEST.

## Terminology update for Investigation

Where the original Task says:
- `redo`
- `REDO`
- `simultaneous-ring-out redo`

the report should evaluate/express the accepted user-facing concept as:
- `rematch`
- `Draw Rematch`

Internal type naming may be `rematch` or another precise semantic name, but do not retain `redo` merely from the earlier recommendation if `rematch` is clearer.

## Questions now resolved vs still open

Resolved by User:
- Q1: center criterion.
- Q2: support ratio not used.
- Q3: exact boundary IN.
- Q5 direction: deeper-out loses unless near-tied.
- Q7 concept: near-tie result is Rematch, not winner.
- Q16 target visible result wording: EAST/WEST + wrestler name / Draw Rematch.

Still Investigation-required:
- exact near-tie epsilon.
- exact BoutOutcome type naming.
- outcome tick order.
- post-outcome freeze.
- Counter edge interaction.
- East/West + wrestler-name metadata boundary.
- whether current Source needs a small setup/presentation extension in ACTION-06A.
