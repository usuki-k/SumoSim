Task-ID: ACTION-05A-GRIP-ENGAGEMENT-FOUNDATION
Status: REVIEWED
Task-Type: IMPLEMENTATION / CORE GRIP ENGAGEMENT FOUNDATION
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: d72f43b0887203095eebe3f1c7efb1d1193a188d
Handoff-Mode: GITHUB

# ACTION-05A — Grip / Engagement Foundation

## Purpose

Grip / 組み / Morozashiの最小Foundationを実装する。

今回:
- Shift = Grip / Release
- FREE → neutral GRAPPLED
- Kuzushi targetへの有効Grip → MOROZASHI
- Kuzushi消費
- Grip reach / whiff recovery
- pair-level Engagement
- Grapple bond
- GRAPPLED中WASD抑制
- release
- DummyのEngagement対応
- 最小debug表示

今回は未実装:
- Grappled Drive / Yorikiri
- Morozashi Drive bonus
- Throw / Throw bonus
- Lift
- stats / RNG / Ring-out

## Accepted User Decisions

1. stable + idle targetへのvalid GripはFoundationでは決定的に成功 → neutral grapple。
2. Kuzushi + idle targetへのvalid Gripは確定成功 → Morozashi。target Kuzushiは即消費してstable。
3. unilateral Gripはaction-idle targetにだけ成立。Push / Counter / Grip中のtargetをinterruptしない。
4. GRAPPLED中は両者ともShiftでrelease可能。releaseした側だけGrip Recovery。両者同時releaseなら両者Recovery。
5. ACTION-05AではGRAPPLED中の通常WASDは抑制。
6. Grip rangeは combined radius + margin。初期値 `GRIP_RANGE_MARGIN = 0.09 m`。
7. Prototype Grip key = **Shift**。左右Shiftは同じ意味。hold auto-repeatなし。

## Current Baseline

Preserve:
- Movement / Contact
- ArrowUp Push
- ArrowDown Counter
- Push > Counter priority
- Kuzushi
- Best→rear / Success→side
- Counter overshoot
- current provisional tuning

Source-Baselineは`d72f43b...`。
Current developとの差分がcoordination-onlyであることをPreflightで確認する。

## Pair-Level Engagement

Add one Bout-level canonical state:

```ts
type GrappleAdvantage =
  | { kind: 'neutral' }
  | { kind: 'morozashi'; holderId: ParticipantId }

type BoutEngagement =
  | { kind: 'free' }
  | { kind: 'grappled'; advantage: GrappleAdvantage }
```

- constructor/reset = free
- Snapshot top-level `engagement` as isolated copy
- participant stateへduplicate grapple flagsを持たせない
- Morozashi holderはexactly one participant

Do not add LIFTED yet.

## Grip Intent / Action

Extend `ParticipantIntent`:

```ts
gripPressed: boolean
```

Scene:
- Shift → third `PressLatch`
- first subsequent Simulation tick only true
- hold does not repeat
- release + new press gives next edge

FREE same-tick action priority:

```
Push > Counter > Grip
```

Extend action union:

```ts
| { kind: 'grip'; phase: 'reach' | 'recovery'; ticksRemaining: number }
```

Provisional:
- `GRIP_REACH_TICKS = 6`
- `GRIP_RECOVERY_TICKS = 12`

Reach:
- starts only FREE + idle + stable
- WASD suppressed / grounded brake
- first eligible resolution tick succeeds

Whiff:
- Reach expiry → Grip Recovery
- no Kuzushi penalty

Recovery:
- steering suppressed
- no new Push / Counter / Grip
- no queue
- then idle

## Grip Resolution

Range:

```
distance <= radiusA + radiusB + GRIP_RANGE_MARGIN
```

Unilateral A→B succeeds only if:
- Engagement free
- A = Grip Reach
- A posture stable
- B action idle
- in range

Result:
- B stable → neutral grapple
- B Kuzushi → Morozashi(holder=A), B posture→stable

Kuzushi does not bypass range.

Use target posture at actual resolution tick after tick-start posture update.
If pre-step snapshot says Kuzushi ticksRemaining 0, it recovers at tick start and a later Grip that tick is neutral.

### Simultaneous Grip

If both participants are stable, both in Grip Reach, and in range on the same resolution tick:
- neutral grapple
- symmetric
- no participant-array-order winner

One participant Kuzushi:
- Kuzushi participant cannot initiate
- stable participant may Grip it → Morozashi

Both Kuzushi:
- neither initiates

## Enter Grapple

Use one explicit Simulation-owned path.

On success:
1. Engagement → grappled
2. both actions → idle
3. Morozashi case consumes target Kuzushi → stable
4. normalize pair externalVelocity
5. attach centers to exact combined radius

### External normalization

Current equal-body Prototype only:

```
avg = (A.externalVelocity + B.externalVelocity) / 2
A.externalVelocity = avg
B.externalVelocity = avg
```

per component.

This is pair external-velocity normalization, not final mass physics.
Do not zero momentum. Do not add mass.

## Attachment / Grapple Bond

On establishment, move pair symmetrically along center axis so center distance = combined radius exactly.

While GRAPPLED:
- resolve smallest deterministic radial bond each tick
- keep distance at combined radius
- ordinary WASD effective move = zero for both
- existing selfVelocity brakes
- shared external motion may carry pair
- no generic constraint solver / Physics engine

Run bond after ordinary Contact correction.

Use deterministic facing fallback only if center direction is undefined.

## GRAPPLED Actions / Facing

While GRAPPLED:
- no FREE Push / Counter / new Grip Reach
- Grip edge means Release
- ordinary WASD suppressed
- current simple auto-facing remains
- Morozashi does not change facing in this Task

## Release

If tick begins GRAPPLED:

- no Grip edge → remain GRAPPLED
- one participant Grip edge:
  - Engagement → FREE
  - releaser → Grip Recovery
  - other remains idle
- both Grip edge:
  - Engagement → FREE
  - both → Grip Recovery

Release:
- clears Morozashi
- no teleport
- no forced velocity/facing change
- same-tick Push/Counter edges are discarded, not queued
- non-releasing idle participant may use normal movement after release
- participant in Recovery cannot steer

## Step Order

Keep explicit small order:

1. advance posture timers
2. sanitize intents
3. handle GRAPPLED release if engagement began tick GRAPPLED
4. if FREE and not release-transition: start Push / Counter / Grip by priority
5. derive effective move
6. update selfVelocity
7. decay externalVelocity
8. integrate positions
9. ordinary Contact
10. if GRAPPLED: Grapple bond
11. if FREE: existing Counter resolution
12. if still FREE: Grip resolution
13. if still FREE + Contact: existing Push resolution
14. advance action timers
15. update facing

Equivalent deterministic order allowed only if semantics remain the same and reported.

## Dummy

If Snapshot engagement is GRAPPLED:
- move 0
- pushPressed false
- counterPressed false
- gripPressed false
- hold/reset cooldown

Dummy does not initiate Grip.

## Presentation

Controls:
- WASD movement
- ArrowUp Push
- ArrowDown Counter
- Shift Grip / Release
- 1/2 Dummy modes
- R restart

Minimal debug presentation must distinguish:
- FREE
- GRAPPLED
- MOROZASHI + holder
- GRIP
- GRIP REC
- existing KUZUSHI

Recommended top text:
- ENGAGE: FREE
- ENGAGE: GRAPPLED
- ENGAGE: MOROZASHI (PLAYER/CPU)

Simple presentation-only line between grappled participants is allowed/recommended.

## Scope Out

Do not implement:
- Grappled Drive
- Morozashi force bonus
- Throw
- Lift
- stats / probability / RNG
- hand fighting / regrip
- GRAPPLED WASD movement/rotation
- facing-based Grip quality
- directional side/rear Push advantage
- Ring-out / BoutOutcome
- final graphics/animation
- Physics / generic relationship framework
- Push/Counter/Kuzushi retuning

## Required Tests

All existing 124 tests remain PASS, except helper adaptation adding `gripPressed:false`.

Add focused coverage at minimum:

T92 default FREE + Snapshot isolation  
T93 stable valid Grip → neutral grapple  
T94 Kuzushi valid Grip → Morozashi, correct holder, Kuzushi consumed; mirrored case  
T95 exact range boundary / outside range / Kuzushi cannot bypass range / whiff→recovery  
T96 one-edge Grip + hold no-repeat + Push>Counter>Grip priority  
T97 target action eligibility: Push/Counter/Grip cannot be interrupted; reach may wait for idle  
T98 Kuzushi timing boundary including ticksRemaining 0  
T99 simultaneous stable Grip → symmetric neutral  
T100 one/both Kuzushi initiation cases  
T101 externalVelocity component-average normalization  
T102 attachment from margin distance → exact combined radius, symmetric  
T103 bond keeps exact distance under opposing WASD attempts; finite/no jitter  
T104 GRAPPLED suppresses Push/Counter/WASD/new Grip Reach  
T105 one-sided release from neutral/Morozashi; releaser Recovery; no same-tick FREE action  
T106 simultaneous release symmetric  
T107 release preserves position/velocity/facing and clears advantage  
T108 Best and Success Counter → Kuzushi → Shift within margin → Morozashi  
T109 Morozashi holder invariant / neutral has no holder / release clears holder  
T110 Dummy is inactive while GRAPPLED and cooldown resumes deterministically  
T111 Shift latch 0/N tick behavior, hold no-repeat, priority integration  
T112 exact Reach / Recovery timing  
T113 all prior 124 regressions PASS when Grip unused  
T114 mixed deterministic finite replay / valid Engagement invariants

## Verification

Heavy.

Required:
- `pnpm test`
- `pnpm build`
- `git diff --check`
- T92–T114 evidence
- existing regressions
- no dependency
- Simulation Phaser-free
- Scope Out absent

Browser Smoke if available:
- Shift one Grip
- hold no-repeat
- stable → GRAPPLED
- Counter→KUZUSHI→Shift→MOROZASHI
- pair cannot walk apart
- Push/Counter suppressed while GRAPPLED
- Shift release + Recovery
- R → FREE
- no runtime errors

If unavailable, report NOT RUN honestly.

## User Play Test — REQUIRED

Check:

1. Shift feels like one deliberate Grip attempt.
2. Whiff / Recovery is understandable.
3. stable Grip clearly becomes normal GRAPPLED.
4. Counter→KUZUSHI→Grip→MOROZASHI feels rewarding.
5. 0.09m margin does not feel like grabbing from far away.
6. pair attachment/bond does not jitter.
7. suppressing WASD while GRAPPLED is acceptable for Foundation.
8. neutral vs Morozashi and holder are readable.
9. either participant may release; release Recovery prevents obvious spam.
10. disadvantaged participant being able to release does not make Morozashi feel pointless.
11. Push / Counter / Movement outside Grapple remain unchanged.
12. Morozashi strength itself is intentionally deferred to Drive/Throw tasks.

Agent report:
`User Play Test: REQUIRED / NOT RUN`

## Acceptance Criteria

- single pair-level Engagement SoT
- default FREE
- Shift semantic edge
- Push>Counter>Grip
- deterministic Reach/Recovery
- stable→neutral
- Kuzushi→Morozashi + consume Kuzushi
- range margin 0.09m
- no target action interrupt
- simultaneous Grip symmetric
- external normalization
- exact attachment/bond
- GRAPPLED movement/FREE action suppression
- either participant release + Recovery
- Dummy Engagement-aware
- minimal debug presentation
- Counter→Kuzushi→Morozashi integration
- no Drive/Throw/Lift/stats/RNG scope creep
- T92–T114 + existing tests PASS
- build PASS
- User Play Test REQUIRED / NOT RUN
- no unexpected scope

## Stop Conditions

STOP if:
- Preflight fails
- Engagement requires duplicate participant relationship state
- bond needs a general constraint/Physics system
- 0.09m range cannot support Counter→Grip without changing accepted Counter semantics
- Grip Foundation requires interrupting Push/Counter
- Morozashi requires Drive/Throw bonus now
- Ring-out/BoutOutcome becomes prerequisite
- task-external divergence/WIP exists

## Git Delivery

Follow AGENTS.md.
One successful Task ≈ one commit.
Task-owned files only.
Push origin/develop.
Do not change main.

Example:
`feat: add grip engagement foundation`

## Final Instruction

Stop after Grip / Engagement Foundation.

Do not continue to Drive, Throw, Lift, Ring-out, stats.

After commit/push/report:
「ACTION-05A-GRIP-ENGAGEMENT-FOUNDATION が完了し、ChatGPT ReviewとUser Play Test待ちです」


# Final ChatGPT Review

Overall Result: TECHNICAL PASS WITH KNOWN UNTESTED RUNTIME / USER PLAY TEST REQUIRED

## Reviewed Delivery

- Implementation commit:
  `61a1a493a54a02cc7d171f3c70d722a6640f871f`
- Agent-Start-Head:
  `2108e0029279007d6f574e630c3cf3b772be5a1d`
- Agent Task Diff is exactly one implementation commit.
- `main` remains unchanged.
- No new dependency.
- Scope is limited to Grip / Engagement Foundation, focused tests, Dummy/Scene integration, and Current-State docs.

## Reported Implementation vs Design

PASS.

Direct Source review confirmed:

### Engagement Source of Truth

- BoutSimulation owns exactly one pair-level `engagement`.
- participant state contains no duplicate grapple flags.
- Snapshot exposes an isolated top-level Engagement copy.
- default constructor/reset state is FREE.
- neutral grapple is symmetric.
- Morozashi identifies one holderId.

### Grip input / action

- `gripPressed` is a semantic edge.
- Shift uses a third PressLatch.
- FREE priority is Push > Counter > Grip.
- Grip is explicit `reach / recovery`.
- reach/recovery suppress normal steering.
- inputs during Grip are ignored/not queued.

### Grip eligibility

- valid range is combined body radius + `GRIP_RANGE_MARGIN = 0.09 m`.
- unilateral Grip only resolves against action-idle target.
- Grip does not interrupt Push / Counter / Grip actions.
- reach may wait until the target becomes idle.
- target posture at actual resolution tick decides neutral vs Morozashi.

### Kuzushi → Morozashi

- in-range Kuzushi target resolves to Morozashi.
- holder is the gripping participant.
- target Kuzushi is consumed immediately to stable.
- Kuzushi does not bypass range.
- mirrored holder case is tested.

### Simultaneous Grip

- both stable / both reaching / in range resolves to neutral grapple.
- resolution is symmetric rather than participant-array first.
- Kuzushi participant cannot initiate Grip.

### Establishment / pair state

- successful Grip cancels both current actions.
- externalVelocity is normalized to the component-wise pair average under the current equal-body Prototype.
- this is correctly treated as Prototype normalization, not permanent mass physics.
- initial attachment puts the centers at exact combined body-radius distance.
- Grapple bond keeps that distance without a generic constraint solver.

### GRAPPLED behavior

- ordinary WASD is suppressed.
- FREE Push / Counter starts are suppressed.
- Grip edge is interpreted as release.
- current auto-facing remains; no turn-rate/facing redesign.
- no Drive / Throw / Lift advantage was added.

### Release

- either participant may release.
- one-sided release returns FREE immediately and puts only releaser in Grip Recovery.
- simultaneous release puts both in Recovery.
- Morozashi clears on release.
- no same-tick Push/Counter starts are allowed on the relationship-transition tick.
- position/velocity/facing are not artificially reset by release.

### Dummy / presentation

- Dummy is inactive while GRAPPLED and holds cooldown.
- Dummy does not initiate Grip.
- FREE / GRAPPLED / MOROZASHI and holder identity have minimal debug presentation.
- GRIP / GRIP REC presentation exists.

## Verification Review

Reported:

- `pnpm test`: 148/148 PASS
- `pnpm build`: PASS
- `git diff --check`: PASS
- prior 124 regressions PASS with only required intent-helper adaptation
- T92–T114 covered

Direct source/test inspection confirms focused coverage for:

- default FREE / Snapshot isolation
- stable → neutral
- Kuzushi → Morozashi, mirrored holder
- exact Grip range boundary
- one-edge / action priority
- target-action protection and reach waiting
- Kuzushi timer boundary
- simultaneous Grip
- one/both Kuzushi cases
- Counter → Kuzushi → Morozashi integration
- pair external normalization
- attachment / bond
- GRAPPLED action/movement suppression
- one-sided/simultaneous release
- release state preservation
- holder invariant
- exact Reach/Recovery timing
- deterministic mixed replay

## Browser Smoke

NOT RUN due Agent environment limitation.

This is a Known Untested runtime item, not a Source failure.

## Non-Blocking Notes

### N-1 — Disadvantaged-side release Feel is not interactively testable yet

The Foundation correctly allows either participant to release, including the Morozashi-disadvantaged participant.

However, the current Push Dummy:
- never initiates Grip
- never issues Release

Therefore the current single-player harness cannot directly let the User experience:
- CPU holding Morozashi on Player
- disadvantaged Player/CPU choosing release under pressure
- whether this makes Morozashi feel too easy to escape

The rule is technically tested, but this particular **Feel question remains Deferred** until a harness/CPU path can exercise opponent Grip/Release.

Do not build real AI solely to solve this now.

### N-2 — Successful in-range Grip can resolve on the press tick

Because Grip Reach opens before resolution and the target is already eligible/in range, a valid Grip may become GRAPPLED in the same fixed tick as Shift.

This is consistent with the Task. User Play Test should judge responsiveness; do not add artificial Startup unless it feels too instantaneous.

### N-3 — Bond is intentionally minimal

The bond corrects only radial distance.
It does not implement:
- grapple rotation
- free pair footwork
- hand fighting
- traction/mass physics

Those remain later systems.

## Accepted Technical Baseline Pending Play Test

If User Play Test passes:

- Shift = temporary Grip / Release key
- pair-level Engagement is canonical
- stable idle valid Grip → neutral GRAPPLED
- Kuzushi idle valid Grip → Morozashi, Kuzushi consumed
- Grip range margin 0.09 m provisional
- Grip Reach 6 ticks / Recovery 12 ticks provisional
- Push > Counter > Grip
- unilateral Grip does not interrupt target actions
- simultaneous stable Grip → neutral
- GRAPPLED ordinary WASD / FREE actions suppressed
- bond keeps exact body contact distance
- either participant may release; releaser pays Recovery
- Morozashi is a distinct persistent advantage state with no Drive/Throw bonus yet

All numerical values remain Prototype tuning.

## User Play Test — REQUIRED / READY

Run `pnpm dev`.

### Normal Grip

1. Use Mode 1 or approach the stationary CPU.
2. Press Shift while in range.
3. Confirm `ENGAGE: GRAPPLED`.
4. Confirm pair does not separate when WASD is pressed.
5. Confirm ArrowUp / ArrowDown do not start FREE Push/Counter while GRAPPLED.
6. Press Shift again and confirm release to FREE.
7. Confirm releaser shows `GRIP REC` briefly.

### Whiff / range

8. Press Shift clearly too far away.
9. Confirm Grip does not occur and `GRIP → GRIP REC` is readable.
10. Approach closer and verify the 0.09 m margin does not feel like grabbing from an obviously excessive distance.

### Counter → Morozashi reward

11. Mode 2: Counter a Dummy Push successfully so CPU enters KUZUSHI.
12. Press Shift while CPU is still Kuzushi and in range.
13. Confirm:
    - `ENGAGE: MOROZASHI (PLAYER)`
    - CPU KUZUSHI label disappears because Kuzushi was consumed
    - Morozashi line/display clearly differs from neutral grapple.
14. Confirm the pair stays attached and does not jitter.

### Release / regressions

15. Release Morozashi with Shift.
16. Confirm Morozashi advantage disappears and Player enters Grip Recovery.
17. Confirm normal Push / Counter / Movement still feel unchanged while FREE.
18. Confirm R resets Engagement to FREE.
19. Check for browser/console/runtime errors.

Important:
- Morozashi is **not supposed to be stronger yet** in movement/Throw.
- its gameplay strength is deliberately deferred to the Grappled Drive / Throw tasks.

### Known Play-Test limitation

The current Dummy cannot Grip or Release, so the User cannot yet fairly judge:
- Morozashi held by CPU against Player
- disadvantaged-side voluntary release Feel

Do not treat that missing Feel check as a failure of this Foundation Task.

## Acceptance State

Technical implementation: PASS.

Grip / Engagement Feel: PENDING USER PLAY TEST.

Do not start Grappled Drive until this focused Play Test is reviewed.

If accepted:
- ACTION-05A becomes current Engagement baseline.
- next design choice should be whether minimal Ring-out/BoutOutcome is needed before Grappled Drive testing.

If rejected:
- classify feedback narrowly:
  - Shift input
  - Grip reach/range
  - whiff/recovery
  - bond/attachment
  - release
  - Morozashi readability
  - runtime bug

and correct only that area.

## Do Not Reopen

Unless User feedback provides a concrete reason:

- pair-level Engagement SoT
- Kuzushi → Morozashi conversion
- Kuzushi consumption on Morozashi
- action-idle target rule
- automatic Counter side/rear baseline
- accepted Push / Counter / Contact baseline

## Deferred

- Grappled Drive / Yorikiri
- Morozashi Drive advantage
- Throw / Morozashi Throw advantage
- Lift
- opponent Grip/Release harness or AI
- hand fighting / regrip
- GRAPPLED WASD/rotation
- stats / RNG
- directional side/rear Push advantage
- Ring-out / BoutOutcome
- final graphics / grapple animation
