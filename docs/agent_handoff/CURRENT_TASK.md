Task-ID: ACTION-05C-GRAPPLED-DRIVE-INVESTIGATION
Status: READY
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
