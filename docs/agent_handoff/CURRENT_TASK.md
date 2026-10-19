Task-ID: ACTION-06A-RINGOUT-BOUTOUTCOME-FOUNDATION
Status: REVIEWED
Task-Type: IMPLEMENTATION / CORE RING-OUT & BOUT OUTCOME FOUNDATION
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: 7a28a211cf718a15e29cc7b15817b55e38be6bbf
Handoff-Mode: GITHUB

# ACTION-06A — Ring-out / BoutOutcome Foundation

## Purpose

ACTION-05C1 Grappled DriveはTechnical Review + User Play TestでAccept済み。
ACTION-06 Investigation / ChatGPT Review / User correctionsに基づき、
Boutを最小限「終われる」状態にする。

今回実装する:
- 中心基準Ring-out
- 境界ぴったりIN
- 先に土俵外へ出たparticipantが負け
- 同時ならRematch
- BoutOutcomeをPure TypeScript Simulationのcanonical stateに追加
- outcome確定後のstep()完全no-op
- Scene最小結果表示
- R restartで新Bout

今回は実装しない:
- Result / Reward Scene
- Training / Stable loop
- Throw / Lift / touchdown
- kimarite
- support/foot based Ring-out
- whole-game tempo tuning

## Accepted User Decisions

### UD-R1 — Ring-out criterion

Prototypeでは participant center のみ。

```ts
Math.hypot(position.x, position.y) > arena.radius
```

でOUT。

bodyRadius / support circle / support ratioは使わない。

最終・代表的graphicsで違和感が出たら将来見直し可能。

### UD-R2 — Exact boundary

境界ぴったりはIN。

```ts
distance === arena.radius
```

はIN。

strictly greaterだけOUT。

### UD-R3 — Sumo first-out rule

- 先に土俵外へ出た方が負け。
- 同時に出た場合は取り直し = Rematch。
- 外へ出た「深さ」は勝敗判定に使わない。
- participant順 / randomで決めない。

### UD-R4 — Result wording

Target user-facing wording:
- `EAST XXX Win`
- `WEST XXX Win`
- `Draw Rematch`

XXXは力士名。

Current Sourceには正式な力士名metadataがないため、ACTION-06Aでは:
- side metadataをPresentation側へ追加
- Player / wrestler-a = EAST
- CPU / wrestler-b = WEST
- result formatterは `name ?? existing label` のように、将来正式名へ差し替え可能な境界を作る
- Current Prototypeでは正式名が未設定なので、既存のPLAYER / CPU表示をtemporary fallbackとして使ってよい
- PLAYER / CPUを正式な力士名として扱わない
- 名前確定後はPresentation metadataだけ差し替え可能にする

SimulationにはEAST/WEST/name/完成済みresult文字列を入れない。

## Accepted Technical Decisions

- same-tick first-out orderは、previous resolved position P0 → current resolved position P1 のlinear interpolation modelで判定する
- exact/effectively simultaneous crossing epsilon:
  `RING_OUT_SIMULTANEOUS_EPSILON = 1e-9`
  （tick fractionのtechnical epsilon only）
- gameplayとしての「数十ms以内なら同時」幅は入れない
- outcome確定後 `step()` は完全no-op
- final physical stateはそのままfreeze
- no wall / clamp / bounce
- Current Counter relocation validityは変更しない

## Important Semantics — Resolved Tick Interpolation

Ring-out orderingは、internal solverの実行時刻を再現しない。

正式なPrototype rule:

> 2つのresolved Simulation state間では、participant centerはprevious resolved center P0からcurrent resolved center P1へ直線補間したものとしてRing-out順序を判定する。

Therefore:
- tick開始時に各participantのresolved positionをlocal capture
- normal Bout tickを最後まで実行
- final resolved positionがOUTのparticipantだけ crossing fraction を計算
- internal Contact correction / bond / Grip attach / Counter relocation の中間位置は個別のRing-out eventとして扱わない
- final resolved positionがINなら、そのtickはRing-outなし

Do not claim literal sub-step physical crossing time.

将来Throw等の大きなteleport/trajectoryでこのモデルが不自然になった場合、そのmechanic taskで見直す。

## BoutOutcome Type

Add minimal Pure TS types:

```ts
export type BoutFinishReason = 'ring-out'
export type BoutRematchReason = 'simultaneous-ring-out'

export type BoutOutcome =
  | { readonly kind: 'ongoing' }
  | {
      readonly kind: 'win'
      readonly winnerId: ParticipantId
      readonly loserId: ParticipantId
      readonly reason: BoutFinishReason
    }
  | {
      readonly kind: 'rematch'
      readonly reason: BoutRematchReason
    }
```

No full kimarite system.

`BoutSnapshot` gains:
```ts
readonly outcome: BoutOutcome
```

BoutSimulation:
- canonical `outcome`
- constructor starts ongoing
- getSnapshot returns copied outcome
- no duplicate winner/loser flags on participant

## Ring-out Pure Helper

Recommended small module:
`src/game/sumo/ringOut.ts`

Phaser-free.

Small functions may include:

```ts
isOutOfRing(position: Vec2, arenaRadius: number): boolean

firstRingBoundaryCrossingFraction(
  previous: Vec2,
  current: Vec2,
  arenaRadius: number
): number | null

resolveRingOut(
  participants: readonly {
    id: ParticipantId
    previous: Vec2
    current: Vec2
  }[],
  arenaRadius: number
): BoutOutcome
```

Equivalent explicit API is allowed.

Do not create generic Rule Engine.

## Boundary Helper Semantics

### isOutOfRing

- strictly `distance > radius`
- exact boundary IN
- no gameplay epsilon

### firstRingBoundaryCrossingFraction

Return:
- `null` if current/final resolved center is IN
- normalized fraction in `[0,1)` when final center is OUT

Expected cases:
- previous IN → current OUT: circle/segment intersection fraction
- previous exactly on boundary → current OUT: 0
- defensive previous already OUT: 0 is acceptable because normal canonical flow should already have finalized outcome
- finite deterministic result

Use stable circle/segment math.
No external geometry library.

Do not use final outside depth to infer order.

## Same-Tick Resolution

After full tick:

### nobody OUT
```
ongoing
```

### exactly one OUT
that participant loses.

### both OUT
compute crossing fraction for both.

If:
```
abs(tA - tB) <= RING_OUT_SIMULTANEOUS_EPSILON
```
→
```
{ kind:'rematch', reason:'simultaneous-ring-out' }
```

Else:
- smaller crossing fraction = first out = loser
- other participant = winner

No outside-depth tiebreak.

## Critical Tests Against Depth Comparison

Required:
- same tick, A crossing fraction earlier than B, but A's final outside depth is shallower than B → A still loses
- mirrored B-earlier equivalent
- proves final depth is not used

## Simulation Tick Order

Required semantics:

0. if `outcome.kind !== 'ongoing'` → immediate return; exact no-op

1. capture previous resolved positions:
```ts
const previousPositions = ...
```

2. existing normal tick:
- posture
- readiness
- release
- FREE actions / Drive
- self velocity
- external
- integrate
- Contact
- bond / Counter / Grip / Push
- action timers
- facing

3. resolve Ring-out once from:
- previous resolved positions
- final resolved positions

4. if result is win/rematch, store canonical outcome

No Ring-out special logic inside Push / Drive / Counter.

Equivalent order is allowed only if:
- all positional resolution occurs before outcome
- final Snapshot is stable
- report explains it

## Counter Interaction

Preserve accepted Counter geometry.

Current Counter relocation uses:
```
maxCenterDistance = arena.radius - defender.bodyRadius
```

Do not loosen to center criterion in ACTION-06A.

Therefore Counter relocation itself remains unable to place defender center outside.

Do not redesign Counter edge behavior as part of Ring-out.

## Push / Drive

Push:
- Ring-out evaluated only after full tick resolution
- final Snapshot may retain push action / velocity

Drive:
- bonded pair can translate outside
- each participant independently checked
- same-tick first-out resolved by crossing fraction

No special Push/Drive finish code.

## Outcome Freeze

Once outcome is final:

```ts
step(...) {
  if (this.outcome.kind !== 'ongoing') return
  ...
}
```

Required exact no-op includes:
- position
- velocity
- externalVelocity
- action
- posture
- facing
- engagement
- outcome
- action timers
- external decay
- orientation

Do not normalize:
- action to idle
- velocity to zero
- engagement to free

Final Snapshot is last physical state.

Outcome says Bout has ended.

## Scene Presentation

Add minimal result text only.

Current Presentation mapping should gain:
- `side: 'EAST' | 'WEST'`
- optional/future `name` or equivalent display-name field

Prototype assignment:
- wrestler-a / keyboard / Player = EAST
- wrestler-b / dummy / CPU = WEST

Formatter:
- win:
  - find winner Presentation metadata
  - name = configured wrestler name if present, otherwise current existing label as temporary Prototype fallback
  - `${side} ${name} Win`
- rematch:
  - `Draw Rematch`
- ongoing:
  - no result text

Do not store result text in Simulation.

Important:
- current fallback may render `EAST PLAYER Win` / `WEST CPU Win`
- this is a temporary Prototype presentation only
- do not document PLAYER/CPU as canonical wrestler names

Bodies stay in final positions.

Input suppression in Scene is not required for correctness because Simulation no-ops.
R must still restart.

No Result Scene.

## Snapshot API Intentional Change

`BoutSnapshot` gains top-level `outcome`.

Known focused updates:
- Orientation T126 exact top-level keys → add `outcome`
- Drive T148 old "no Ring-out" expectation is obsolete and must be replaced/scoped
- any other exact Snapshot-key tests must be found and updated intentionally

Do not hide Outcome outside Snapshot just to preserve old tests.

## Existing Small-Arena Tests

Inspect Counter Position T81/T82/T91 and any other small arena fixture.

Rules:
- if existing test purpose remains valid and participants stay ongoing → preserve assertion
- if Ring-out now legitimately freezes a long unrelated replay before its intended later steps, adjust that test fixture minimally so it continues testing its original subsystem rather than accidentally testing Ring-out
- do not weaken Counter edge/fallback tests
- report every intentional test adaptation

## Scope

Allowed:
- BoutOutcome types
- ringOut.ts Pure helper
- BoutSimulation canonical outcome / tick-end resolution / freeze
- BoutSnapshot outcome
- Scene result display / presentation side metadata
- focused tests
- necessary existing-test adaptations caused directly by Snapshot/outcome semantics
- ARCHITECTURE sync
- Completion Report

No dependency.

## Scope Out

Do NOT implement:
- Result Scene
- Reward
- Training/Stable loop
- automatic Rematch restart
- support/foot Ring-out
- touchdown/fall
- Throw
- Lift
- kimarite
- stamina/stats
- Counter relocation retune
- whole-game tempo tuning
- final graphics/audio

## Required Automated Verification

All existing 182 tests must remain PASS except intentional, explicitly reported adaptations caused by Ring-out/Outcome.

Add focused tests at minimum:

T151 default outcome:
- constructor normal setup → ongoing
- Snapshot outcome copy isolation

T152 boundary:
- exactly radius → IN
- radius - epsilon → IN
- radius + epsilon → OUT
- both x/y representative directions

T153 A-only OUT:
- A loses / B wins

T154 B-only OUT:
- B loses / A wins

T155 earlier tick:
- participant crossing in earlier Simulation tick loses
- subsequent steps cannot let opponent later overwrite outcome

T156 same tick A-first:
- both final OUT
- A crossing fraction smaller → A loses

T157 same tick B-first:
- mirrored equivalent

T158 depth-not-used:
- earlier crosser ends less deeply outside than later crosser
- earlier crosser still loses
- mirror case

T159 simultaneous:
- exactly/mirrored equal crossing fractions → rematch

T160 simultaneous epsilon:
- crossing fraction difference <= 1e-9 → rematch
- difference > 1e-9 → first crosser loses
- use pure helper fixture if easier

T161 crossing helper:
- IN→IN null
- boundary→OUT fraction 0
- representative cardinal/diagonal crossings
- finite range [0,1)
- defensive OUT start deterministic

T162 bodyRadius independence:
- differing bodyRadius/helper setup does not affect center criterion
- no support-radius rule

T163 Push integration:
- FREE Push causes Ring-out
- pushed-out participant loses
- final position remains outside

T164 Drive integration:
- Grappled Drive causes Ring-out / Yorikiri-style finish
- first center across loses
- bond is not clamped at edge

T165 Counter near edge:
- accepted Counter relocation validity remains unchanged
- Counter relocation itself does not place center outside under current rule

T166 no wall:
- final position stays beyond ring
- no clamp/bounce

T167 freeze:
- capture final Snapshot
- many subsequent step() calls with varied inputs
- exact Snapshot equality every time
- includes no timer/decay/facing changes

T168 outcome immutability:
- final outcome cannot be overwritten by later input/positions

T169 new Bout:
- fresh BoutSimulation instance is ongoing

T170 resolved interpolation model:
- construct a case where internal positional correction could conceptually have an intermediate path
- assert Ring-out uses only previous resolved center → final resolved center
- no hidden sub-step event

Do not claim internal solver chronology.

T171 deterministic replay:
- Push/Drive/outcome/rematch scenarios replay exactly
- finite values

T172 Snapshot API:
- top-level outcome present
- no participant winner/loser flags
- exact key tests updated intentionally

T173 regressions:
- existing Movement / Contact / Push / Counter / Grip / Orientation / Drive behavior remains unchanged until outcome
- all prior 182 PASS after scoped adaptations

Both participant directions and both same-tick first-out orders are required; do not sample.

## Verification Level

Heavy / Core Bout Outcome.

Required:
- `pnpm test`
- `pnpm build`
- `git diff --check`
- focused T151–T173 evidence
- prior regression coverage
- no new dependency
- ringOut helper Phaser-free
- no wall/clamp
- no depth winner rule
- no Scope Out code

Browser Smoke if available:
- Push out → result appears and freeze
- Drive out → result appears and freeze
- no invisible wall
- R restart → ongoing
- result text side mapping correct
- no runtime/console errors

If Browser unavailable, report NOT RUN honestly.

## User Play Test — REQUIRED

Run after technical review.

Evaluate:

1. Pushで中心が土俵線を越えた時点の負けが、見た目として早すぎ/遅すぎない。
2. Driveで押し出してBoutが終わることが寄り切りらしく分かる。
3. bodyが土俵外位置でfreezeし、見えない壁がない。
4. 結果表示が:
   - EAST ... Win
   - WEST ... Win
   - Draw Rematch
   の形になっている。
5. Rでrestartできる。
6. outcome後に入力してもstateが動かない。
7. simultaneous / Rematchが不自然にparticipant順で決まって見えない。
8. current center criterionはPrototypeとして受け入れられるか。
9. final graphics導入後のRing-out criterion見直しはDeferred。
10. 全体Tempoは引き続きDeferred。

Technical PASS != Ring-out Feel accepted.

## Acceptance Criteria

- center criterion only
- exact boundary IN
- no support/body-radius criterion
- first-out loses
- simultaneous Rematch
- no outside-depth winner logic
- technical crossing epsilon = 1e-9 tick fraction
- P0→P1 resolved-state interpolation model
- BoutOutcome Simulation-owned
- Snapshot outcome
- post-outcome exact no-op
- no wall/clamp/bounce
- Counter geometry preserved
- Push/Drive integrate without special finish logic
- Player/wrestler-a = EAST, CPU/wrestler-b = WEST for current Prototype presentation
- result formatter supports future wrestler names and uses existing labels only as temporary fallback
- `Draw Rematch`
- R restart
- T151–T173 + regressions PASS
- build PASS
- User Play Test REQUIRED
- no scope creep

## Stop Conditions

STOP if:
- first-out ordering cannot be implemented from resolved P0→P1 without depth tiebreak
- existing Counter/Contact/Drive architecture must materially change
- outcome freeze breaks core state invariants beyond scoped test adaptation
- result presentation requires inventing permanent wrestler names
- Ring-out requires Physics/CCD framework
- unrelated repository divergence exists
- Current Source/Handoff materially conflict

## Completion Report

Minimum:
- Result / Preflight / Changed Files
- User Decisions implemented
- BoutOutcome type
- ringOut helper/math
- resolved interpolation semantics
- first-out/simultaneous logic
- proof no depth tiebreak
- tick order
- freeze semantics
- Counter/Push/Drive integration
- Snapshot API changes
- Scene EAST/WEST/result formatter
- temporary name fallback note
- intentional existing-test adaptations
- T151–T173 + regressions
- Browser Smoke
- Implementation Evidence
- Design Deviations
- Unexpected Scope
- Known Untested
- User Play Test REQUIRED / NOT RUN
- Git delivery

## Git Delivery

Follow AGENTS.md.
1 Task ≈ 1 commit.
Task-owned files only.
Push origin/develop.
Do not change main.

Example:
`feat: add ring-out bout outcome`

## Final Instruction

Stop after Ring-out / BoutOutcome Foundation.

Do not continue to Result/Reward, Throw, Lift, stats, or balance.

After commit/push/report:
「ACTION-06A-RINGOUT-BOUTOUTCOME-FOUNDATION が完了し、ChatGPT ReviewとUser Play Test待ちです」


# Final ChatGPT Review

Overall Result: TECHNICAL PASS WITH KNOWN UNTESTED RUNTIME / USER PLAY TEST REQUIRED

## Reviewed Delivery

- Implementation commit:
  `43efaef5aa2bab5eeb6fa2fc8eceec1bf1fd3105`
- Agent-Start-Head:
  `3e91fc38883edf13a2711017354f1da631e4c1f6`
- Task diff is exactly one implementation commit.
- `main` remains unchanged.
- No new dependency.
- Scope is limited to Ring-out / BoutOutcome Foundation, focused presentation/tests/docs.

## Reported Implementation vs Design

PASS.

Direct Source review confirmed:

### Ring-out criterion

- center only.
- `Math.hypot(x,y) > arena.radius` is OUT.
- exact boundary is IN.
- bodyRadius/support geometry is not used.

### First-out ordering

- no outside-depth winner logic.
- no participant-order/random tiebreak.
- same-tick ordering uses previous resolved center P0 and final resolved center P1.
- boundary crossing fraction is computed by a Pure TS circle/segment helper.
- smaller crossing fraction loses.
- effectively equal crossing fractions produce Rematch.

T158 explicitly proves the critical rule:
an earlier crosser that ends **less deeply outside** still loses.

### Resolved interpolation semantics

Implementation matches the accepted Prototype model:

- P0 is captured at tick start.
- the normal full tick resolves.
- Ring-out is evaluated only from P0 → final resolved P1.
- Contact/bond/Grip/Counter internal intermediate positions are not separate Ring-out events.

This is a fixed-tick interpolation gameplay rule, not a claim that internal solver operations occur continuously at those times.

### Simultaneous technical epsilon

- `RING_OUT_SIMULTANEOUS_EPSILON = 1e-9` tick fraction.
- used only to absorb numerical equality noise.
- no broader gameplay "close enough" time window was added.

### BoutOutcome ownership

- BoutSimulation owns one canonical `outcome`.
- BoutSnapshot exposes an isolated copy.
- participant state has no winner/loser flags.
- Scene has no independent gameplay result state.

### Tick ordering / freeze

- outcome final → `step()` immediately returns.
- normal tick completes before first Ring-out decision.
- final physical state is preserved.
- later input cannot change:
  - position
  - velocity/external velocity
  - action
  - posture
  - facing
  - engagement
  - outcome
  - timers/decay.

### No wall / clamp

- final participant position remains outside the ring.
- no bounce/clamp/invisible wall.

### Counter / Push / Drive

- accepted Counter relocation validity remains unchanged.
- Push has no special Ring-out logic.
- Drive has no special Ring-out logic.
- both are resolved through the common tick-end Ring-out rule.

## Crossing Helper Review

PASS.

`src/game/sumo/ringOut.ts` is Phaser-free and small/explicit.

The root calculation handles:
- current IN → null
- boundary moving outward → 0
- radial/diagonal crossings
- boundary moving inward first then exiting the opposite side
- defensive already-OUT start when final remains OUT
- finite [0,1) crossing fractions.

No geometry dependency/framework was added.

## Verification Review

Reported:

- `pnpm test`: 200/200 PASS
- `pnpm build`: PASS
- `git diff --check`: PASS

Direct test/source inspection confirms coverage for:

- ongoing/default outcome
- exact boundary IN
- just inside / just outside
- both one-sided loser directions
- earlier-tick loss
- same-tick A-first and B-first
- depth-not-used
- simultaneous Rematch
- technical epsilon
- crossing helper
- bodyRadius independence
- Push Ring-out
- Drive/Yorikiri Ring-out
- Counter edge baseline
- no wall
- exact post-outcome freeze
- fresh Bout ongoing
- resolved P0→P1 model
- deterministic replay
- Snapshot outcome ownership.

## Intentional Existing-Test Adaptations

Reviewed and acceptable:

- exact Snapshot key tests add `outcome`.
- old Drive T148 "Ring-out absent" is replaced by implemented Ring-out behavior.
- old test fixtures at x=1000 are moved inside their radius-100 arena because they were invalid under the new rule.
- small-arena long replay is shortened/scoped so it continues testing Counter geometry rather than accidentally turning into a Ring-out test.

These are direct consequences of the accepted Outcome semantics, not weakened subsystem verification.

## Scene / Result Presentation

PASS for Prototype Foundation.

Presentation metadata now owns:
- EAST/WEST side
- optional wrestler name.

Current Prototype mapping:
- wrestler-a / Player = EAST
- wrestler-b / CPU = WEST.

Simulation stores only IDs/reason.

User-facing formatter:
- `EAST <name> Win`
- `WEST <name> Win`
- `Draw Rematch`.

Formal wrestler names remain unset.
Current runtime therefore temporarily falls back to:
- `EAST PLAYER Win`
- `WEST CPU Win`.

PLAYER / CPU are not treated as canonical wrestler names.
A later real name can be supplied by presentation metadata without changing Ring-out logic.

## Non-Blocking Note — Initial OUT setup invariant

Current normal Prototype setup starts both participants inside the ring.

BoutSimulation constructor still accepts any finite initial position and does not:
- reject a participant already OUT, or
- decide an Outcome immediately at construction.

The Ring-out helper contains defensive already-OUT behavior, but the canonical flow assumes an ongoing Bout begins with valid in-ring resolved positions.

This does not block ACTION-06A because the current game setup satisfies that invariant.

If future BoutSetup becomes Management/data-driven, explicitly decide whether:
- initial OUT setup is invalid and rejected, or
- constructor evaluates an initial Outcome.

Do not broaden ACTION-06A now solely for this defensive case.

## Browser Smoke

NOT RUN due Agent environment limitation.

This is a Known Untested runtime item.

## Accepted Technical Baseline Pending User Play Test

If User Play Test passes:

- center-based Ring-out is current Prototype rule.
- exact ring boundary remains IN.
- first center across loses.
- same-time crossing = Rematch.
- P0→P1 resolved-state interpolation is current within-tick ordering model.
- BoutOutcome is Simulation-owned.
- post-outcome Simulation is frozen.
- no wall/clamp.
- EAST/WEST result display boundary is presentation-owned.
- current PLAYER/CPU result names are temporary fallbacks only.

## User Play Test — REQUIRED / READY

Run `pnpm dev`.

### Push finish

1. Use the normal FREE Push flow near the ring edge.
2. Push CPU until its **center** passes the dohyo line.
3. Confirm:
   - result appears as `EAST PLAYER Win` for the current temporary metadata when Player wins.
   - CPU remains visibly outside rather than being clamped back.
   - bodies/state freeze immediately after the result.

### Player loss

4. Mode 2: allow CPU to push Player out.
5. Confirm:
   - result appears as `WEST CPU Win`.
   - Player center has actually crossed the ring line before loss is shown.

### Yorikiri-style Drive finish

6. Establish a grapple and use Drive to move the pair toward an edge.
7. Confirm:
   - the participant whose center crosses first loses.
   - result/freeze feels like a believable current Prototype finish.
   - the pair is not stopped by an invisible wall.

### Freeze / restart

8. After a result, press movement / Push / Counter / Grip / Drive inputs.
9. Confirm nothing in the Bout moves or advances.
10. Press R.
11. Confirm a fresh Bout starts with no result text and normal input works again.

### Visual criterion

12. Judge the current center-based criterion:
   - too early?
   - acceptable?
   - too late?

Remember:
the User already chose center-based Ring-out as the current Prototype and may revisit it after representative/final graphics.

### Rematch

A natural exact simultaneous case may be difficult to produce manually with the current harness.
Automated tests cover symmetric same-tick crossing and `Draw Rematch`.

If a manual simultaneous case occurs, confirm the displayed text is:
`Draw Rematch`.

### Regression

13. Confirm normal:
- Movement
- Push
- Counter
- Grip
- Orientation
- Drive

still feel unchanged before Outcome.

14. Check browser console/runtime errors.

## Acceptance State

Technical implementation: PASS.

Ring-out / finish Feel: PENDING USER PLAY TEST.

Do not start Result / Reward transition work until this focused Play Test is reviewed.

If accepted:
- ACTION-06A becomes the current Bout termination baseline.
- next task should be minimal Result / Reward transition Investigation for the tiny Gameplay Loop.

If rejected:
classify narrowly:
- center criterion visual feel
- first-out timing
- freeze
- result presentation
- restart
- regression/runtime bug.

Do not reopen first-out vs depth logic; depth comparison is explicitly rejected by User.

## Do Not Reopen

Unless explicit User change:

- center criterion for current Prototype.
- exact boundary IN.
- first-out loses.
- simultaneous Rematch.
- no outside-depth tiebreak.
- Outcome Simulation ownership.
- no wall/clamp.
- accepted Push/Drive/Counter foundations.

## Deferred

- support/foot-based Ring-out after representative graphics.
- wrestler names / richer presentation metadata.
- Result / Reward transition.
- touchdown/fall/Throw finish.
- kimarite.
- whole-game tempo rebalance.
