Task-ID: ACTION-05C1-GRAPPLED-DRIVE-FOUNDATION
Status: REVIEWED
Task-Type: IMPLEMENTATION / CORE GRAPPLED DRIVE FOUNDATION
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: f28542fce7b5996916a7769b9690905c41ca0608
Handoff-Mode: GITHUB

# ACTION-05C1 — Grappled Drive Foundation

## Purpose

ACTION-05A Grip / Engagement、ACTION-05B1 Grappled OrientationはUser Play TestでAccept済み。

今回、GRAPPLED中の
**↑長押し = Drive / 寄り**
を最小Foundationとして実装する。

成立させるもの:
- ArrowUp held → semantic `driveHeld`
- READY participantだけDrive可能
- READY vs TURNINGならREADY側だけ一方的にDrive
- neutral同士の同時Driveは拮抗
- Morozashi holderはDriveが強い
- pairはGrapple bondを維持したままshared external velocityで移動
- READY participantはDrive中でもShift Release可能
- Dummy Mode 2はGRAPPLED中にDriveして押し返す
- 最小debug表示

今回は未実装:
- Ring-out / 勝敗
- stamina
- stats
- Throw / Lift
- directional FREE Push advantage
- 全体Tempo調整

## Accepted User Decisions

UD-1:
Driveは**continuous hold**。
↑を押している間だけDrive effort。

UD-2:
`ParticipantIntent`へ
```ts
readonly driveHeld: boolean
```
を追加。

同じArrowUp:
- `pushPressed` = edge、FREE Push用
- `driveHeld` = held state、GRAPPLED Drive用

SceneはGameplay contextで意味を分岐しない。
SimulationがFREE/GRAPPLEDに応じて解釈する。

UD-3 provisional:
- `GRAPPLE_DRIVE_SPEED = 0.6` m/s
- `GRAPPLE_DRIVE_ACCELERATION = 4` m/s²

UD-4:
- neutral strength = 1.0
- Morozashi holder = `MOROZASHI_DRIVE_FACTOR = 1.5`
- disadvantaged side = 1.0

UD-5:
Drive中でもREADY participantはShift Release可能。
ReleaseがDriveより優先。

UD-6:
Ring-outはまだ実装しない。
Driveを変位/contestとして先にPlayTestする。

## Accepted Baseline

Preserve:
- FREE Movement / Contact
- FREE ArrowUp Push
- Counter / Kuzushi
- Counter side/rear
- Grip / Engagement
- Morozashi
- Grapple bond
- GRAPPLED WASD suppression
- GRAPPLED Orientation TURNING/READY
- TURNING中Release不可
- Shift Grip/Release
- current provisional tuning

Do not retune:
- Movement
- Push
- Counter
- Kuzushi
- Grip
- Orientation
- overall Game Speed

## Intent / Input

Extend `ParticipantIntent`:
```ts
readonly driveHeld: boolean
```

All existing intent helpers/tests add `driveHeld:false`.

Scene:
- keep one ArrowUp Key reference
- key down still feeds existing Push PressLatch
- key `isDown` feeds `driveHeld`
- each Simulation tick receives current held state

Do not synthesize held state from repeated keydown events.

FREE:
- ignore `driveHeld`
- existing `pushPressed` semantics unchanged

GRAPPLED:
- FREE Push start remains unavailable
- `driveHeld` may contribute only if READY

## Drive Action State

Add minimal timerless action variant:
```ts
| { readonly kind: 'drive' }
```

Meaning:
- participant is actually contributing Drive this tick

No timer.
No startup/recovery.

While GRAPPLED:
- `driveHeld && canActInGrapple(...)` → action drive
- otherwise, if no other grapple action applies → idle

Important:
- held while TURNING = idle, no contribution
- held before READY may automatically become drive on the first tick it is READY
- releasing ↑ returns drive→idle

Do not add duplicate `isDriving` state.

## Drive Direction

Use current pair axis only.

Let:
```
n = normalized vector A → B
```

A Drive contribution is +n.
B Drive contribution is -n.

Do NOT use participant facing direction.
READY permits up to 15° error, so facing-based Drive could create lateral sliding and imperfect cancellation.

No stored Drive direction.

## Drive Strength / Net

Define a small Pure helper/boundary if useful.

```
strength(p) =
  MOROZASHI_DRIVE_FACTOR
    if engagement.morozashi && holderId === p.id
  1
    otherwise

net =
  strength(A) * ADriving
  - strength(B) * BDriving
```

where ADriving/BDriving are 1 or 0 from actual READY+held contribution.

Expected:
- A neutral only → net +1
- B neutral only → net -1
- neutral vs neutral → net 0
- Morozashi holder A vs neutral B → net +0.5
- Morozashi holder only → net +1.5

Participant order must not create priority.

## Pair Movement / Model B

Drive uses the current pair shared `externalVelocity`.

Do NOT:
- use selfVelocity as Drive force
- move only target
- teleport positions
- modify bond semantics
- create new physics system

Both participants must end each GRAPPLED Drive update with the same externalVelocity.

## Critical Drive Velocity Rule

This section is mandatory.

Current:
- `EXTERNAL_DECELERATION = 8 m/s²`
- Drive acceleration = 4 m/s²

Therefore, **do not call the existing full-vector `decayExternal()` first and then add Drive acceleration on the axis**.
That would prevent correct acceleration toward 0.6m/s.

### GRAPPLED shared external update

When GRAPPLED, update the shared pair external velocity once per tick.

Use pair axis `n`.

Decompose:
- parallel scalar along n
- perpendicular vector

### If net === 0

No new Drive contribution.

Apply existing external decay semantics to the shared external velocity.

Then copy same result to both participants.

This allows:
- equal Drive contest = no new acceleration
- pre-existing pair momentum still decays naturally

### If net !== 0

Define:
```
dirSign = sign(net)
strength = abs(net)
targetParallel =
  dirSign * GRAPPLE_DRIVE_SPEED * strength

driveStep =
  GRAPPLE_DRIVE_ACCELERATION * strength * TICK_SECONDS

decayStep =
  EXTERNAL_DECELERATION * TICK_SECONDS
```

Update axis component toward target:

- if current parallel is below/toward target:
  approach target by at most `driveStep`
  **without first subtracting axial EXTERNAL_DECELERATION**
- if current parallel is already beyond target in the same direction:
  bleed back toward target using existing `EXTERNAL_DECELERATION`
- if current parallel is opposite requested direction:
  Drive acceleration deterministically cancels it and then reverses toward target over subsequent ticks

Perpendicular component:
- decay toward zero using existing `EXTERNAL_DECELERATION`

Reconstruct shared external velocity.

Apply existing `MAX_EXTERNAL_SPEED` safety clamp.

Copy exact same resulting externalVelocity to both participants.

Equivalent minimal math is allowed if these semantics are identical.

Do not change FREE `decayExternal()` or FREE Push formula.

## Step Order

A small refactor of `step()` into separate velocity/update phases is allowed if needed.

Required semantics:

1. advance posture
2. determine tick-start grapple readiness
3. handle GRAPPLED Release
4. start FREE actions if FREE
5. set GRAPPLED drive/idle action contribution
6. update all selfVelocity
7. update external velocity:
   - FREE participants: existing decay behavior
   - GRAPPLED pair: one shared Drive/external update as above
8. integrate all positions
9. ordinary Contact
10. GRAPPLED bond or FREE Counter/Grip/Push resolution
11. advance timed actions
12. facing update

Important:
- Drive held input affects movement on that same tick when participant was READY at tick start.
- orientation READY transition from tick end remains actionable only next tick, as accepted 05B1.

Equivalent order allowed only with same semantics and explicit report.

## Release During Drive

Release gate remains:
- participant must be READY

If any READY participant Shift-releases:
- release happens before Drive contribution for that tick
- Engagement → FREE
- no Drive contribution that tick
- **clear/cancel drive action for both participants**
- releaser(s) → Grip Recovery
- non-releaser → idle
- shared externalVelocity is NOT hard-cleared
- FREE decay handles remaining motion

Never allow FREE participant with action.kind === drive.

TURNING Shift:
- ignored
- no queue
- no Recovery

## Drive / Orientation

Drive translation must not alter pair bearing.

Therefore:
- TURNING continues during Drive
- Drive does not reset facing error
- no pair rotation
- no orbit

READY participant can Drive while opponent TURNING.

Opponent begins contributing automatically once READY if it is already holding ↑.

## Dummy Mode 2

Existing validation harness, not real AI.

Mode 2:
- while FREE: existing approach + discrete Push behavior unchanged
- while GRAPPLED:
  - move zero
  - FREE action edges false
  - `driveHeld = true`
  - hold/reset Push cooldown as current grapple behavior

Simulation readiness decides:
- Dummy TURNING → action idle / no contribution
- Dummy READY → action drive / contributes

Mode 1:
- always passive; `driveHeld=false`

Dummy does not Grip/Release.

## Presentation

Keep:
- ENGAGE
- READY/TURNING
- Morozashi line

Add:
- `DRIVE` phase label while participant action.kind === drive
- optional compact pair external speed debug text, if useful

No final animation.

Do not hide TURNING with DRIVE because TURNING participant cannot be drive.

## Ring / Arena

No Ring-out semantics.

Do not:
- declare winner
- stop pair at ring
- clamp
- bounce
- add invisible wall

Automated Drive tests should use large arena fixture where edge does not matter.

Browser PlayTest may cross the visible ring; User can R restart.

## Scope

Allowed:
- BoutTypes intent/action additions
- BoutSimulation Drive integration
- small Pure Drive helper/module if useful
- Scene ArrowUp held integration / presentation
- Dummy Mode 2 Drive extension
- focused Drive tests
- helper adaptation adding driveHeld:false
- ARCHITECTURE sync
- Completion Report

No dependency.

## Scope Out

Do NOT implement:
- Ring-out / BoutOutcome
- Yorikiri victory
- Throw
- Lift
- stamina
- Power/Weight/LowerBody/Grapple stat formulas
- mass / traction framework
- discrete/gaburi Drive pulse
- pair rotation
- directional FREE Push advantage
- AI
- final animation/audio
- whole-game speed tuning

## Required Automated Verification

All existing 163 tests must remain PASS, except harmless intent helper adaptation for `driveHeld:false`.

Add focused tests at minimum:

T131 FREE ignores driveHeld:
- FREE held ArrowUp semantic does not create Drive action
- FREE Push edge behavior unchanged

T132 one-sided neutral Drive:
- READY A only
- action A=drive, B=idle
- shared pair velocity accelerates monotonically toward +0.6m/s
- reaches/settles at target without stalling near one-tick velocity
- bond distance R

T133 mirrored one-sided Drive:
- B only gives exact mirrored result

T134 TURNING gate:
- TURNING participant holding driveHeld does not contribute/action idle
- READY opponent may Drive unopposed

T135 held-before-READY:
- participant holds ↑ while TURNING
- first actionable tick after READY begins Drive automatically
- no earlier contribution

T136 equal neutral contest:
- both READY, both held
- both actions=drive
- net contribution zero
- no jitter
- pre-existing shared momentum decays rather than being forcibly zeroed

T137 Morozashi holder solo:
- target speed / acceleration scale by 1.5 vs neutral

T138 Morozashi contest:
- holder vs disadvantaged both held
- net = 0.5 toward holder side
- disadvantaged participant remains strength 1.0

T139 external target-speed rule:
- 4m/s² acceleration reaches ~0.6m/s target despite EXTERNAL_DECELERATION=8
- proves no pre-decay-on-axis bug

T140 opposite momentum:
- start shared external velocity opposite Drive
- Drive cancels/reverses deterministically
- finite/no overshoot beyond target

T141 perpendicular momentum:
- Drive continues on axis
- perpendicular component decays toward zero

T142 release during Drive:
- READY Shift release wins
- no Drive contribution on release tick
- Engagement FREE
- releaser Recovery
- non-releaser idle
- no participant remains action=drive
- external velocity preserved then FREE decay

T143 TURNING release while held Drive:
- Shift ignored
- Drive blocked
- no queue / no Recovery

T144 bond/orientation:
- many Drive ticks keep exact R
- pair bearing stable
- TURNING continues normally
- facing finite

T145 Drive stop:
- releasing ↑ converts drive→idle
- shared momentum decays using existing rule
- no extra Drive recovery

T146 Dummy Mode 2:
- FREE behavior unchanged
- GRAPPLED TURNING → driveHeld emitted but no contribution
- READY → Dummy contributes Drive
- cooldown remains held/reset

T147 deterministic contest:
- mirrored/order-independent results
- equal contests symmetric

T148 Ring-out absent:
- large/normal arena crossing does not declare outcome or clamp
- no Ring-out code/semantic introduced

T149 regression:
- existing 163 tests PASS
- FREE Push/Counter/Grip/Orientation unchanged when driveHeld false

T150 mixed replay:
- Counter→Kuzushi→Morozashi→TURNING→Drive→contest→Release
- deterministic replay
- finite position/velocity/facing
- Engagement invariants

## Verification Level

Heavy / Core Grappled Drive.

Required:
- `pnpm test`
- `pnpm build`
- `git diff --check`
- T131–T150 evidence
- existing 163 regressions
- no dependency
- Simulation/helper Phaser-free
- Scope Out absent

Browser Smoke if available:
- normal Grip → hold ↑ moves pair
- Mode 2 normal grapple → CPU pushes back after READY
- equal neutral contest visibly stalls/contests
- Counter→Morozashi → ↑ moves pair while CPU TURNING
- CPU starts resisting after READY
- Morozashi holder visibly stronger
- releasing ↑ stops new Drive pressure
- Shift releases while READY
- no jitter/runtime errors

If browser unavailable, report NOT RUN honestly.

## User Play Test — REQUIRED

Evaluate:

1. ↑ hold feels like sustained pair pressure, not repeated Push.
2. one-sided Drive moves the pair clearly but does not feel like skating.
3. neutral vs neutral simultaneous Drive feels like stalemate.
4. Morozashi holder clearly overpowers neutral resistance.
5. Side/Rear Orientation gives a meaningful first-move Drive window.
6. CPU resistance begins naturally when it reaches READY.
7. releasing ↑ stops pressure cleanly.
8. Shift release during Drive is understandable.
9. bond remains stable.
10. Drive direction is readable.
11. current global game speed may still feel too fast; do NOT retune unless it blocks mechanic readability.
12. leaving the ring does not yet end the bout; this is expected.

Technical PASS != Drive Feel accepted.

## Acceptance Criteria

- driveHeld semantic exists
- FREE Push meaning preserved
- continuous hold Drive
- timerless drive action
- READY gate
- pair-axis direction
- signed symmetric net
- neutral equal contest cancels new Drive contribution
- Morozashi holder factor 1.5
- shared pair external Model B
- corrected Drive-axis acceleration/decay semantics
- target speed 0.6m/s, acceleration 4m/s² provisional
- opposite/perpendicular momentum handled deterministically
- bond/orientation preserved
- READY Release wins over Drive
- release clears all drive actions
- Dummy Mode 2 contested Drive
- no Ring-out semantics
- T131–T150 + regressions PASS
- build PASS
- User Play Test REQUIRED
- no scope creep

## Stop Conditions

STOP if:
- Drive cannot reach target speed without modifying FREE Push/decay
- GRAPPLED shared external update requires a generic physics system
- release can leave drive action in FREE state
- pair-axis contest cannot be made symmetric
- Dummy extension requires real AI
- Ring-out becomes technically mandatory
- Current Source/Handoff materially conflict
- unrelated divergence exists

## Completion Report

Minimum:
- Result / Preflight / Changed Files
- User Decisions
- driveHeld input implementation
- Drive action
- pair-axis/net
- shared external Drive update
- correction C-1 evidence
- Morozashi factor
- readiness
- release
- Dummy
- T131–T150 + regressions
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
`feat: add grappled drive foundation`

## Final Instruction

Stop after Grappled Drive Foundation.

Do not continue to Ring-out, Throw, Lift, stamina, stats, or global balance.

After commit/push/report:
「ACTION-05C1-GRAPPLED-DRIVE-FOUNDATION が完了し、ChatGPT ReviewとUser Play Test待ちです」


# Final ChatGPT Review

Overall Result: TECHNICAL PASS WITH KNOWN UNTESTED RUNTIME / USER PLAY TEST REQUIRED

## Reviewed Delivery

- Implementation commit:
  `7a28a211cf718a15e29cc7b15817b55e38be6bbf`
- Agent-Start-Head:
  `f752a9f06c16df5801a72ba26e8aafce991e468a`
- Task diff is exactly one implementation commit.
- `main` remains unchanged.
- No new dependency.
- Scope is limited to Grappled Drive Foundation, Dummy validation support, presentation, focused tests, and docs.

## Reported Implementation vs Design

PASS.

Direct Source review confirmed:

### Semantic input

- `ParticipantIntent.driveHeld` is a held semantic input.
- ArrowUp key-down still feeds the existing FREE Push PressLatch.
- the same ArrowUp Key's `isDown` supplies `driveHeld`.
- Scene does not choose FREE-vs-GRAPPLED gameplay meaning.
- Simulation ignores `driveHeld` while FREE.

### Drive action

- timerless `{kind:'drive'}` exists.
- it is used only while GRAPPLED and actually contributing.
- TURNING + held input stays idle.
- held input can begin Drive on the first tick that starts READY.
- no duplicate `isDriving` state exists.

### Pair-axis Drive

- Drive direction uses current pair axis, not participant facing.
- signed net is:
  strength(A) * ADriving - strength(B) * BDriving.
- equal neutral contest contributes net zero.
- mirrored participant order is tested.

### Morozashi

- holder strength is provisional 1.5.
- disadvantaged participant remains 1.0.
- Morozashi remains Engagement data rather than a Drive-specific state.

### Shared external Model B

- one shared GRAPPLED external update is computed per tick.
- both participants receive the exact same resulting externalVelocity.
- Drive does not use selfVelocity or direct position teleport.
- Grapple bond remains unchanged.

## Critical C-1 Review — PASS

The mandatory correction from ACTION-05C Review is implemented correctly.

With:
- `GRAPPLE_DRIVE_ACCELERATION = 4 m/s²`
- `EXTERNAL_DECELERATION = 8 m/s²`

the implementation does **not** pre-decay the axial Drive component before applying Drive acceleration.

For `net != 0`:

- axial component approaches the signed target using Drive acceleration.
- target overspeed bleeds back using existing EXTERNAL_DECELERATION.
- opposite axial momentum is canceled/reversed by Drive acceleration.
- perpendicular momentum uses existing decay.
- MAX_EXTERNAL_SPEED remains the global safety clamp.

Direct tests verify one-sided neutral Drive reaches 0.6 m/s rather than stalling at a one-tick crawl.

FREE:
- existing `decayExternal()` behavior is preserved.
- existing Push formula is preserved.

## Step / Tick Semantics

PASS.

- readiness is from tick-start state.
- READY held Drive affects that same tick's motion.
- orientation becoming READY at tick end only enables Drive next tick.
- self velocity update and position integration are now separated into two loops.
- existing FREE regressions confirm the refactor did not change prior behavior.

## Release Review

PASS.

READY Shift release:

- happens before Drive contribution.
- clears every existing Drive action.
- releaser enters Grip Recovery.
- non-releaser becomes/stays idle.
- Engagement becomes FREE.
- no participant remains `drive` in FREE.
- pair external momentum is not hard-cleared; FREE decay applies.

TURNING Shift remains ignored/no queue/no Recovery.

## Dummy Review

PASS as validation harness, not AI.

Mode 2:

- FREE: previous Push behavior remains.
- GRAPPLED: emits only `driveHeld=true` with FREE edges off.
- TURNING: Simulation prevents contribution.
- READY: Dummy contributes Drive.
- Push cooldown remains held during grapple.

This is sufficient for contested Drive User Play Test without introducing real CPU AI.

## Ring-out Boundary

PASS.

No Ring-out / BoutOutcome behavior was added.

Pair may cross the arena boundary:
- no winner
- no clamp
- no bounce
- no invisible wall.

This is intentional for ACTION-05C1.

## Verification Review

Reported:

- `pnpm test`: 182/182 PASS
- `pnpm build`: PASS
- `git diff --check`: PASS
- existing 163 regressions PASS
- new Drive coverage T131–T148 and T150

Direct source/test inspection confirms coverage for:

- FREE ignoring driveHeld
- one-sided neutral acceleration to 0.6
- mirrored Drive
- TURNING gate / READY first-move reward
- held-before-READY semantics
- equal neutral contest
- existing momentum decay under net zero
- Morozashi solo and contested advantage
- C-1 no-decay-stall behavior
- opposite momentum reversal
- perpendicular decay
- Drive release
- TURNING release block
- bond/orientation stability
- Drive stop/no Recovery
- Dummy contested Drive
- participant-order symmetry
- no Ring-out semantics
- deterministic mixed replay.

### Non-blocking verification note

There is no literal test named `T149`.

The Task's T149 requirement was:
"existing 163 tests PASS / FREE Push-Counter-Grip-Orientation unchanged when driveHeld=false."

That requirement is substantively satisfied by:
- all existing 163 tests passing
- helper-only `driveHeld:false` adaptations
- only T110 assertion intentionally updated for the accepted Dummy behavior change.

No correction task is required solely to add a meta-test label.

## Non-Blocking Documentation Note

Some older type/comments still describe `externalVelocity` narrowly as Push momentum.

After ACTION-05C1 it also represents shared Grappled Drive pair momentum.

Canonical implementation semantics are correct, but future documentation cleanup should describe it consistently as:
"external / pair momentum not produced by grounded footwork."

Do not reopen Gameplay code only for this wording.

## Browser Smoke

NOT RUN due Agent environment limitation.

This is a Known Untested runtime item.

## Accepted Technical Baseline Pending User Play Test

If User Play Test passes:

- ArrowUp hold = Grappled Drive
- `driveHeld` semantic input
- timerless Drive action
- Drive requires READY
- Drive direction = pair axis
- neutral equal contest = no new Drive acceleration
- target speed = 0.6 m/s provisional
- acceleration = 4 m/s² provisional
- Morozashi holder factor = 1.5 provisional
- shared external Model B Drive
- Drive-axis dedicated acceleration/decay semantics
- READY release wins over Drive
- Dummy Mode 2 contests Drive when READY
- Ring-out remains unimplemented.

All numerical values remain Prototype tuning and are subject to the later whole-game tempo/balance pass.

## User Play Test — REQUIRED / READY

Run `pnpm dev`.

### Neutral Drive

1. Use Mode 1 and establish a normal frontal grapple.
2. Hold ArrowUp.
3. Confirm:
   - Player shows DRIVE.
   - pair moves together toward CPU side.
   - movement looks like pair pressure rather than one circle sliding away.
   - releasing ArrowUp stops new pressure and residual motion dies quickly.

### Neutral contest

4. Switch/use Mode 2 and establish a normal grapple.
5. Hold ArrowUp.
6. Once both are READY, confirm:
   - both show DRIVE.
   - pair approximately stalls rather than either side steadily winning.
   - bond remains stable/no jitter.

### Morozashi + Orientation

7. Mode 2: Counter the CPU Push successfully.
8. Grip CPU while Kuzushi to obtain Morozashi.
9. Immediately hold ArrowUp.
10. Confirm:
    - Player DRIVE works while CPU is still TURNING.
    - pair moves toward CPU side during this uncontested window.
    - CPU begins resisting only after it reaches READY.
    - even after CPU resists, Morozashi holder still slowly wins the contest.

### Release / stability

11. While READY and Driving, press Shift.
12. Confirm release occurs immediately and no DRIVE label remains in FREE.
13. Confirm remaining pair momentum decays rather than snapping to zero.
14. Confirm no bond/facing jitter during sustained Drive.
15. Confirm FREE Push / Counter / Movement / Grip still feel unchanged.
16. Confirm no console/runtime errors.

### Expected current limitations

- crossing the ring does not end the bout.
- neutral equal Drive can remain an indefinite stalemate while both hold ↑.
- final overall game speed is still intentionally untuned.
- current 0.6 / 4 / 1.5 values are only Prototype values.

## Acceptance State

Technical implementation: PASS.

Drive Feel: PENDING USER PLAY TEST.

Do not start Ring-out / BoutOutcome investigation until this focused Drive Play Test is reviewed.

If accepted:
- ACTION-05C1 becomes the current Grappled Drive baseline.
- next task should be Minimal Ring-out / BoutOutcome Investigation.

If rejected:
classify narrowly:
- Drive speed/acceleration
- pair-pressure feel
- neutral contest
- Morozashi advantage
- READY/Orientation interaction
- release
- Dummy behavior
- runtime bug.

Do not fold the deferred whole-game tempo pass into a local Drive correction unless the mechanic cannot be evaluated otherwise.

## Do Not Reopen

Unless concrete Play Test feedback requires it:

- Model B shared external structure
- pair-axis Drive direction
- Orientation readiness
- pair-level Engagement / Morozashi ownership
- FREE Push formula
- Grapple bond
- TURNING/READY rules.

## Deferred

- Ring-out / BoutOutcome
- Yorikiri victory
- whole-game tempo rebalance
- stamina
- Power / Weight / LowerBody / Grapple formulas
- mass/traction
- discrete/gaburi Drive
- pair rotation
- Throw / Lift
- directional FREE Push advantage
- final animation/audio
