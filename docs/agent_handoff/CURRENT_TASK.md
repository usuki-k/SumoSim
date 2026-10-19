Task-ID: ACTION-05B1-GRAPPLED-ORIENTATION-FOUNDATION
Status: READY
Task-Type: IMPLEMENTATION / CORE GRAPPLED ORIENTATION FOUNDATION
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: 61a1a493a54a02cc7d171f3c70d722a6640f871f
Handoff-Mode: GITHUB

# ACTION-05B1 — Grappled Orientation Foundation

## Purpose

ACTION-05A Grip / Engagement FoundationはUser Play TestでAccept済み。
ACTION-05B Investigation / ChatGPT Review / User Decisionsに基づき、
GRAPPLED中のSide / Rear advantageを「実際のFacing差」としてGameplayに残す。

今回実装するもの:
- GRAPPLED中だけ段階的auto-turn
- canonical position + facingからTURNING / READYを導出
- Side Gripは短いTURNING
- Rear Gripは長いTURNING
- TURNING中はRelease不可
- 将来のGrapple Actions用の共通readiness境界
- 最小TURNING / READY debug表示

今回は実装しない:
- Grappled Drive / Yorikiri
- Throw
- Lift
- Morozashiの力補正
- directional Push advantage
- stats

## Accepted User Decisions

UD-1:
`GRAPPLE_TURN_RATE = Math.PI` rad/s
= 180°/s（暫定）。

UD-2:
`GRAPPLE_FACING_TOLERANCE = Math.PI / 12`
= 15°（暫定）。
誤差が15°以内ならREADY。

UD-3:
GRAPPLEDでTURNING中のparticipantはShift Release不可。
Grip edgeは無視し、queueしない。
READY participantだけRelease可能。

UD-4:
TURNING中は将来のparticipant-initiated GRAPPLED actionsをすべて禁止する。
対象:
- Release
- Drive
- Throw
- Lift
- regrip / hand-fighting
受動的なauto-turnだけは継続する。

## Accepted Baseline

Preserve:
- FREEの即時auto-facing
- Movement / Contact
- Push / Counter / Kuzushi
- Counter Success→side / Best→rear
- Counter overshoot
- pair-level Engagement SoT
- Grip / Morozashi
- Kuzushi→Morozashi時のKuzushi消費
- Grapple bond
- GRAPPLED WASD抑制
- Shift Grip / Release
- Grip Reach / Recovery
- current tuning values

Do not retune existing systems.

## Core Architecture

Do NOT add persistent:
- side
- rear
- orientationAdvantage
- rearStun
- turningTicks

Canonical state remains:
- participant position
- participant facing
- pair Engagement

Orientation readiness is derived each tick from geometry.

Preferred Pure TS module:
`src/game/sumo/grappleOrientation.ts`

It must be Phaser-free.

Minimal helpers may include:

```ts
normalizeAngle(angle): number
grappleFacingError(selfPosition, selfFacing, opponentPosition): number
isGrappleReady(selfPosition, selfFacing, opponentPosition): boolean
turnFacingTowardGrapple(selfPosition, selfFacing, opponentPosition): number
```

Equivalent small naming is allowed.

Scene must reuse the same Pure helper for TURNING / READY presentation.
Do not duplicate the formula in Phaser code.

## Angle Semantics

Coordinate convention remains current +y-down canvas coordinates.

Define normalized signed error in:
`(-Math.PI, Math.PI]`

```
bearing = atan2(opponent.y - self.y, opponent.x - self.x)
error = normalizeAngle(bearing - self.facing)
```

READY:
```
abs(error) <= GRAPPLE_FACING_TOLERANCE
```

### Exact rear tie

Best/rear commonly produces approximately ±π error.

Use a small technical epsilon, e.g. `1e-9`.

If error is effectively exactly π in magnitude:
- choose a fixed +angular direction
- no random
- no participant-order choice

This is a deterministic technical tie-break, not balance.

If centers are effectively coincident and bearing is undefined:
- treat facing error as 0 / READY
- use existing deterministic conventions
- do not create a new state

## Facing Update Rule

### FREE

Preserve current behavior exactly:
- stable participant instantly faces opponent at tick end
- Kuzushi participant keeps facing frozen

### GRAPPLED

Replace instant auto-facing with fixed-rate turning.

Per tick:
```
maxTurn = GRAPPLE_TURN_RATE * TICK_SECONDS
```

For each participant:
- compute current signed error
- rotate by at most maxTurn toward zero
- shortest path
- exact π tie uses fixed +direction
- if remaining abs(error) <= maxTurn, snap exactly to opponent bearing
- never overshoot
- keep facing finite

Only facing changes.
Do not orbit positions or rotate bodies around the pair.

Grapple bond remains radial-only and unchanged.

## Readiness / Tick Ownership

Readiness for input at tick t is derived from the state visible at the **start of tick t**.

Turning occurs at tick end in the facing-update stage.

Therefore:
- if tick t end enters the 15° tolerance
- participant becomes action-eligible starting tick t+1

This is required for Snapshot/input consistency.

No stored READY flag.

## Release Gate

At the current GRAPPLED release-processing stage:

For each participant with `gripPressed=true`:
- if READY at tick start → may request release
- if TURNING → edge ignored, not queued, no Recovery

If one READY participant requests release:
- preserve ACTION-05A release semantics
- Engagement → FREE
- releaser → Grip Recovery
- other participant no Recovery

If both READY and both press:
- both Recovery

If one READY and one TURNING both press:
- READY participant can release
- TURNING participant's edge is ignored

Once released:
- existing FREE semantics resume
- no same-tick Push/Counter start, as in ACTION-05A
- do not change FREE auto-facing behavior

## Future Grapple Action Boundary

No Drive/Throw/Lift is added now.

Add/keep one small Simulation-owned readiness boundary suitable for later use, e.g.:

```ts
canActInGrapple(participant, opponent, engagement)
```

Semantics:
- false unless engagement is GRAPPLED
- true only when that participant is READY

Do not add placeholder Drive/Throw action types.

Morozashi and Orientation stay independent:
- Morozashi = persistent Engagement advantage
- READY/TURNING = derived facing readiness

Do not create combined states.

## Counter Integration

Required expected results after Counter→Grip:

### Success / side
- gripper should be READY or effectively READY
- previously Kuzushi target should be TURNING
- target initial error approximately 90°
- with 180°/s and 15° tolerance, READY after approximately 25 turn updates

### Best / rear
- gripper READY
- target TURNING
- target initial error approximately 180°
- READY after approximately 55 turn updates

Rear must remain TURNING longer than Side without stored side/rear state.

Use actual geometry/facing in tests; do not special-case Counter tier.

## Front Grip

Normal frontal Grip must not create an artificial helpless period.

If participant error is already within 15°:
- READY immediately
- no mandatory Grapple startup stun

Normal ACTION-05A release behavior remains available because participants are READY.

## Presentation

Keep existing:
- facing markers
- ENGAGE: FREE / GRAPPLED / MOROZASHI

Add minimal GRAPPLED readiness display using shared Pure helper.

Recommended:
- participant phase/debug text shows `TURNING` or `READY` while GRAPPLED and no higher-priority existing label is needed
- KUZUSHI existing priority remains where applicable
- optional angle text only if useful for debugging

Do not build final animation/UI.

User must visibly see the disadvantaged marker rotating rather than snapping.

## Scope

Allowed:
- new Pure TS orientation helper module
- BoutSimulation facing/release integration
- focused orientation tests
- BoutScene minimal debug presentation
- docs/ARCHITECTURE.md
- existing test adaptation only if required
- CURRENT_COMPLETION_REPORT.md

BoutTypes.ts should not need new canonical fields.
If new canonical orientation state seems necessary, STOP and report instead.

No dependency.

## Scope Out

Do NOT implement:
- Drive / Yorikiri
- Morozashi Drive bonus
- Throw
- Lift
- manual turn controls
- GRAPPLED WASD movement/rotation
- pair orbit
- side/rear persistent flags
- stun timers
- directional FREE Push advantage
- stats / turn-rate stats
- Ring-out / BoutOutcome
- AI
- final animation
- Physics / generic state machine
- existing Grip/Push/Counter tuning

## Required Automated Verification

All existing 148 tests must remain PASS, except only assertions that intentionally change accepted GRAPPLED instant-facing/release-during-TURNING semantics.

Add focused tests at minimum:

T115 normalizeAngle:
- output in (-π, π]
- -π maps to +π
- finite inputs remain finite

T116 frontal Grip:
- both participants READY immediately / by resulting Snapshot
- no artificial delay

T117 side Counter→Grip:
- gripper READY
- target TURNING
- target does not snap
- target reaches tolerance after exact expected fixed-turn progression

T118 rear Counter→Grip:
- gripper READY
- target TURNING
- rear TURNING duration > side
- expected progression approximately 55 turns with current constants

T119 turn direction:
- positive/negative errors use shortest path
- exact ±π tie uses deterministic +direction

T120 turn step:
- per tick facing change <= GRAPPLE_TURN_RATE*TICK_SECONDS
- no overshoot
- final snap to bearing
- facing finite

T121 tolerance:
- exactly 15° is READY
- just outside is TURNING

T122 tick boundary:
- enters tolerance at tick t end
- release/action eligibility is only available starting tick t+1

T123 release blocked while TURNING:
- Shift ignored
- no Recovery
- no queue
- engagement stays GRAPPLED

T124 READY release:
- one-sided release preserves ACTION-05A semantics
- simultaneous READY release remains symmetric

T125 mixed release:
- READY participant + TURNING participant both press
- READY participant releases
- TURNING edge has no separate effect

T126 Morozashi separation:
- holderId persists while orientation changes
- READY/TURNING is not stored in Engagement
- no side/rear fields in Snapshot/participant

T127 bond interaction:
- turning changes facing only
- positions/bond distance remain stable
- no jitter/NaN

T128 FREE regression:
- FREE stable instant auto-facing unchanged
- Kuzushi facing freeze unchanged
- existing Counter orientation before Grip unchanged

T129 deterministic replay:
- side/rear/front sequences reproduce exactly
- finite facing/state

T130 prior regression:
- existing Grip / Push / Counter / Contact / Movement tests PASS after intentional orientation expectation updates

Do not sample Side vs Rear: both are required.

## Verification Level

Heavy / Core Facing & Action Eligibility.

Required:
- `pnpm test`
- `pnpm build`
- `git diff --check`
- T115–T130 evidence
- prior regressions
- Simulation + helper Phaser-free
- no new dependency
- no Scope Out code

Browser Smoke if environment supports it:
- normal front Grip does not visibly hesitate
- Success→Grip: target visibly turns from side
- Best→Grip: target visibly turns from rear for longer
- no snap
- Shift while target TURNING does not release if controlling that participant is testable
- READY Shift releases normally
- no jitter/console errors

If browser unavailable, report NOT RUN honestly.

## User Play Test — REQUIRED

Run after technical review.

Evaluate:
1. front Grip feels immediate, not artificially delayed.
2. Side Grip creates a readable short opening.
3. Rear Grip creates a clearly longer opening.
4. target visibly rotates rather than snaps.
5. 180°/s feels readable and not too fast/slow.
6. 15° READY threshold does not look obviously premature.
7. TURNING/READY display matches what facing marker shows.
8. bond does not jitter while facing changes.
9. Morozashi display remains distinct from orientation readiness.
10. normal FREE Push/Counter/Movement/Grip feel unchanged.
11. current task need not yet make the advantaged side attack; that is ACTION-05C Drive.

Technical PASS != Orientation Feel accepted.

## Acceptance Criteria

- no persistent side/rear/orientation state
- shared Pure angle/readiness helper
- FREE instant auto-facing preserved
- GRAPPLED gradual turn = π rad/s
- tolerance = π/12
- deterministic exact-rear tie
- Side TURNING shorter than Rear
- front Grip immediately READY
- readiness derived, not stored
- TURNING participant cannot Release
- ignored TURNING Shift is not queued
- READY Release preserves ACTION-05A semantics
- future Grapple action gate boundary exists without implementing actions
- Morozashi remains independent
- presentation shows TURNING/READY
- T115–T130 + regressions PASS
- build PASS
- User Play Test REQUIRED
- no scope creep

## Stop Conditions

STOP if:
- derived orientation requires new canonical side/rear state
- FREE facing baseline must change
- Grapple bond requires material redesign
- release gate cannot be implemented from start-of-tick readiness
- Drive/Throw must be implemented to make readiness technically meaningful
- new dependency/Physics required
- Current Source / Handoff materially conflict
- task-external divergence exists

## Completion Report

Minimum:
- Result / Preflight / Changed Files
- User Decisions implementation
- angle normalization / exact π tie
- turn-rate/tolerance
- tick ownership
- release gate
- Side/Rear integration
- front Grip behavior
- Morozashi separation
- T115–T130 + regressions
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
`feat: add grappled orientation readiness`

## Final Instruction

Stop after Grappled Orientation Foundation.

Do not continue to Drive, Throw, Lift, directional Push advantage, Ring-out, or stats.

After commit/push/report:
「ACTION-05B1-GRAPPLED-ORIENTATION-FOUNDATION が完了し、ChatGPT ReviewとUser Play Test待ちです」
