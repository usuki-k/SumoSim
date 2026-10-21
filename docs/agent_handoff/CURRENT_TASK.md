Task-ID: ACTION-07B-TSUPPARI-GAMEPLAY-IMPLEMENTATION
Status: REVIEWED
Task-Type: IMPLEMENTATION / CORE GAMEPLAY / INPUT / PRESENTATION DEBUG
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 7357788bd9b9091e50ef44859874cec4ae128671
Review-Handoff: ACTION-07A accepted at 86f3bb385cfe1469a6fa327de9fc3fdeaf0c17f6; ChatGPT review at 6e449a9e3c58af00a0de6c43c751d272a16d6535
Handoff-Mode: GITHUB

# ACTION-07B — Tsuppari Gameplay Implementation

## Purpose

Implement the first playable Tsuppari（突っ張り）Prototype from the accepted ACTION-07A design.

This Task implements:
- Simulation-owned Tsuppari gameplay
- ArrowLeft / ArrowRight input edges
- per-hand cooldowns
- center-based reach / hit
- deterministic 5 ordinary hits -> 6th Kuzushi cycle
- Tsuppari Counter behavior
- Push vs Tsuppari / Tsuppari vs Tsuppari contest
- requested Push knockback increase
- debug/runtime verification support.

Do NOT integrate Product Tsuppari pose images in this Task.

The current idle rigid sprite may continue to display during Tsuppari. Debug labels must make gameplay timing observable until the later Art Visual Gate.

---

# Accepted Decisions — Do Not Redesign

## Terminology
Use **Tsuppari / 突っ張り**.

Do not create a separate Harite action.

## Input
Prototype keyboard:
- ArrowLeft = left-hand Tsuppari
- ArrowRight = right-hand Tsuppari.

These are press edges, not held-repeat actions.

Same-participant priority:
```
Push
> Tsuppari
> Counter
> Grip
> Move
```

Within Tsuppari:
- if Left and Right are both pressed and both hands are ready: Left wins
- if Left is unavailable because of cooldown but Right is ready and pressed: Right may start
- losing/unavailable edges are dropped, never queued.

## Per-hand cooldown
- left cooldown: 60 ticks
- right cooldown: 60 ticks
- independent
- count from accepted Tsuppari action start
- each cooldown counts down while the bout is progressing, including Kuzushi / grapple / CounterTransition
- Bout restart/new Bout resets both to 0.

## Movement
Tsuppari is fired in place:
- no intentional forward drive from Tsuppari
- WASD self-movement is locked for the full Tsuppari action
- do not silently clear unrelated external momentum.

## Timing — Prototype default
- startup = 6 ticks
- active = 1 tick
- recovery = 9 ticks
- total = 16 ticks.

Hit resolves exactly once on the active tick.

These values are Provisional / User Play Test.

## Reach — Prototype default
Simulation-owned center geometry only.

Initial rule:
```
hit iff centerDistance <= TSUPPARI_HAND_REACH + receiver.bodyRadius
TSUPPARI_HAND_REACH = 0.525 m
```

With current equal body radius 0.35 m:
- effective center threshold = 0.875 m.

No sprite overlap / Phaser collision.

This value is Provisional and will be revisited after Product pose normalization.

## Tsuppari ordinary hit
- attacker does not intentionally advance
- receiver gets Tsuppari impulse
- successful hit increments attacker's Tsuppari buildup
- whiff gives no impulse and does not change buildup.

Prototype:
- `TSUPPARI_IMPULSE = 2.13 m/s`

Expected representative displacement for idle receiver:
- about 0.266 m
- approximately equal to old Push feel.

## Deterministic Kuzushi buildup
Bout-local per participant.

Initial:
- buildup starts at 0
- successful hits 1..5: ordinary Tsuppari
- successful hit 6:
  - ordinary Tsuppari impulse
  - receiver enters Kuzushi
  - attacker buildup resets to 0
- whiffs do not change buildup
- Counter-caught Tsuppari does not increment or reset buildup.

Prototype threshold:
- `TSUPPARI_KUZUSHI_BUILDUP = 5`

Kuzushi duration:
- reuse existing `KUZUSHI_TICKS = 30`.

No randomness.
No Management stat framework.

## Counter vs Tsuppari
Use current Counter window timing as the initial basis.

When a Counter catches a Tsuppari active hit:
- Tsuppari attacker enters Kuzushi in place
- no Tsuppari impulse
- no buildup change
- no side relocation
- no rear relocation
- no CounterTransition
- no overshoot
- Counter user returns to idle/stable
- Counter tier is not used for Tsuppari.

"In place" means no special relocation is added.
Do not zero unrelated existing momentum merely because Tsuppari was Countered.

Existing Push Counter semantics must remain unchanged.

## Tsuppari vs Tsuppari
If both active Tsuppari hits succeed on the same tick:
- both hits succeed from the same pre-resolution state
- both participants receive their opposing impulses
- both successful-hit buildups update
- threshold Kuzushi is applied only after both hit/force results are determined
- participant ordering must not change the result.

Do NOT net equal Tsuppari strikes to zero.

## Push vs Tsuppari
They must contest.

- Tsuppari is not discarded because Push has higher same-participant input priority.
- Push should normally win the exchange because it is stronger.
- Tsuppari should visibly reduce/resist the Push result.
- use the 07A pair-force design as the first implementation.

Prototype coupled factor:
- `TSUPPARI_COUPLED_SHARE = 0.5`

This is Provisional / User Play Test.

## Push knockback increase
User request:
- new Push feel ~= 2x old Push displacement
- Tsuppari feel ~= old Push displacement.

07A measured representative current Push displacement:
- old Push: ~0.267 m

Accepted first implementation:
- `PUSH_EXTERNAL_ACCELERATION = 26.25 m/s^2`
- expected representative Push displacement: ~0.533 m
- keep current Push startup/active/recovery timing
- keep `MAX_EXTERNAL_SPEED`
- keep `EXTERNAL_DECELERATION`
- keep `KUZUSHI_PUSH_SUSCEPTIBILITY`.

Do NOT replace this with a literal 40 m/s² "2x acceleration" interpretation.

Final feel remains User Play Test gated.

---

# Required Architecture

Maintain:

```
Pure TypeScript Game / Simulation
-> State / Results
-> Phaser Input / Rendering / Presentation
```

Simulation owns:
- Tsuppari action state
- left/right cooldown
- reach
- hit/whiff
- force
- buildup
- threshold Kuzushi
- Counter result
- pair contest
- ring-out consequences through canonical state.

Phaser owns:
- ArrowLeft / ArrowRight key capture
- PressLatch
- debug text / presentation
- later pose rendering, not in this Task.

Do not put reach/force/hit formulas into `BoutScene.update()`.
Do not use sprite pixels for collision.
Do not add Physics/ECS/DI/event bus/stats framework.

---

# Required State / Type Direction

Implement the 07A design unless Current Source exposes a material blocker.

## ParticipantIntent

Add required boolean edges:
```ts
readonly tsuppariLeftPressed: boolean
readonly tsuppariRightPressed: boolean
```

Update all existing intent helpers/literals deliberately.

## Action types

Add:
```ts
export type TsuppariHand = 'left' | 'right'
export type TsuppariPhase = 'startup' | 'active' | 'recovery'
export type TsuppariStrike = 'pending' | 'hit' | 'whiff'
```

Extend `ParticipantActionState` and internal `MutableAction` with:
```ts
{
  kind: 'tsuppari'
  hand: TsuppariHand
  phase: TsuppariPhase
  ticksRemaining: number
  strike: TsuppariStrike
}
```

## Bout-local participant runtime state

Add Simulation-owned:
```ts
tsuppariCooldown: {
  left: number
  right: number
}
tsuppariBuildup: number
```

Expose deep-copied values in `ParticipantState` so debug/presentation/test code does not infer them from private Simulation state.

Do not create top-level duplicate Tsuppari state.

---

# Required Tick Semantics

Preserve fixed-step determinism.

Expected direction:

1. if outcome decided: no-op
2. decrement Tsuppari hand cooldowns for a progressing Bout
   - ensure accepted-action-start semantics still makes the same hand ready exactly 60 ticks later
3. if CounterTransition active:
   - run existing transition
   - ignore new intents
4. advance posture
5. grapple/release readiness
6. FREE action start with priority:
   - Push
   - ready Left Tsuppari
   - ready Right Tsuppari
   - Counter
   - Grip
7. movement / external decay / integrate using existing architecture
8. contact
9. resolve Counter, including Tsuppari catch
10. resolve Grip where existing semantics allow
11. resolve Push/Tsuppari force/hits in one explicit, order-independent place
12. advance action timers
13. update facing
14. existing ring-out resolution.

The exact internal order may differ if required by Current Source, but all externally required semantics must match and must be reported.

Do not make CounterTransition own Tsuppari state.

---

# Force Resolution Requirements

Implement pair resolution so it is participant-order independent.

Let:
- `n` = A -> B axis/contact normal where applicable
- `P = PUSH_EXTERNAL_ACCELERATION`
- `J = TSUPPARI_IMPULSE`.

Required semantic matrix:

## Push only
Preserve current model:
- active Push in contact contributes shared external velocity to the pair
- equal Push vs Push cancels as today.

## Tsuppari vs idle/non-Push
- hit receiver only gets Tsuppari impulse
- attacker gets no Tsuppari impulse.

## Tsuppari vs Tsuppari
- A receives B's opposing impulse
- B receives A's opposing impulse
- do not cancel them.

## Push vs Tsuppari during active Push contact
Use the 07A coupled model:
- combine Push shared contribution with Tsuppari coupled resistance in one order-independent calculation
- initial `TSUPPARI_COUPLED_SHARE = 0.5`
- both participants may receive the same pair contribution on the contest tick
- Push should still win overall in the representative exchange.

## Push not yet active / not in contact
Do not invent pair coupling.
If Tsuppari reaches and hits a Push user outside the active-contact contest case:
- treat it as ordinary Tsuppari hit on that receiver.

## Kuzushi susceptibility
Keep existing Push susceptibility behavior for Push.

Do not multiply Tsuppari impulse by `KUZUSHI_PUSH_SUSCEPTIBILITY`.

---

# Counter Requirements

Refactor `resolveCounter()` only as much as needed.

Must preserve Push Counter exactly:
- active Push + contact
- Best / Success
- existing CounterTransition
- existing fallback
- existing ring-out behavior.

Add Tsuppari Counter:
- Counter window + Tsuppari active hit + reach success
- attacker enters Kuzushi
- defender returns idle
- no Tsuppari hit/force/buildup
- no transition
- no positional relocation.

Because Tsuppari can hit outside ordinary body contact, do not require `resolveCounter()` itself to be called only when body contact exists if that would block valid Tsuppari Counter.

Guard Push Counter's body-contact condition explicitly.

---

# Cooldown Requirements

Cooldown begins when Tsuppari is accepted.

Acceptance tick behavior must be verified so:
- same hand accepted at t0
- rejected through t0+59
- ready again at t0+60.

Other hand remains independent.

Inputs during:
- own action
- Push/Counter/Grip recovery
- Kuzushi
- grapple
- CounterTransition

are dropped, not queued.

Cooldown continues to decrease while Bout progresses.

Outcome freeze stops all progression.

---

# Presentation / Input Integration

## BoutScene

Add:
- `tsuppariLeftLatch`
- `tsuppariRightLatch`
- ArrowLeft / ArrowRight key-down handlers
- clear both in `clearPressLatches()`
- consume on first Simulation tick of the frame like existing action edges
- feed semantic intent fields.

Do not use keyboard auto-repeat as Tsuppari repeat.

## Debug display

Until Product Tsuppari art is integrated, provide enough debug visibility to Play Test gameplay.

At minimum:
- phase label identifies Tsuppari and hand
- cooldown left/right readable in debug mode
- buildup readable in debug mode
- help text includes ArrowLeft / ArrowRight.

Keep debug-only information out of Product HUD.

## WrestlerVisualState

Add a `tsuppari` pose/state and hand/phase metadata so the later Art Task can switch textures without reading gameplay internals directly.

For this Task:
- current idle runtime sprite may continue rendering for the Tsuppari pose
- do not add Tsuppari PNGs
- do not change Product art baseline.

---

# Dummy / Harness

Extend the existing prototype harness, not CPU AI.

Add mode:
- `tsuppari`
- key 3.

Purpose:
- deterministic browser testing of Tsuppari.

Harness should:
- move into a safe in-range distance
- use a ready hand
- prefer Left when ready, otherwise Right
- respect Snapshot cooldown
- not duplicate Simulation hit/reach formulas beyond a small conservative harness approach distance.

Do not turn it into combat AI.

Existing stationary / push modes must remain unchanged.

---

# Explicit Required Boundary Tests

Do not sample these.

## Input / cooldown
1. Left ready / Right ready -> Left starts
2. Left cooldown / Right ready + Left only -> no Tsuppari
3. Left cooldown / Right ready + Right -> Right starts
4. Left ready / Right cooldown + Right only -> no Tsuppari
5. both cooldown -> no Tsuppari; lower-priority Counter/Grip can start if pressed
6. Left + Right same tick, both ready -> Left
7. Left cooldown + Right same tick -> Right
8. Push + Left -> Push
9. Left + Counter -> Left
10. Left + Grip -> Left
11. WASD + Tsuppari -> movement locked for whole Tsuppari action
12. exact cooldown timeline: ready again at t0+60
13. new Bout resets cooldowns and buildup.

## Hit / reach / buildup
14. whiff beyond reach
15. ordinary hit at contact
16. ordinary hit while not in body contact but within Tsuppari reach
17. reach boundary ± epsilon
18. 5th hit ordinary
19. 6th hit = ordinary impulse + Kuzushi + buildup reset
20. 5 hits -> whiff -> next hit still threshold hit.

## Counter
21. Counter catches Left Tsuppari
22. Counter catches Right Tsuppari
23. Tsuppari Counter creates no CounterTransition
24. Tsuppari Counter does not alter buildup
25. Counter window + Tsuppari whiff does not catch
26. existing Push Counter behavior remains intact.

## Pair contest
27. Tsuppari vs Tsuppari same tick: both hit / both displaced
28. participant array/order symmetry
29. threshold hit vs ordinary same tick
30. threshold vs threshold same tick
31. Push vs Tsuppari simultaneous start / active contest
32. Push vs Tsuppari when Tsuppari lands during Push startup
33. Push vs Tsuppari after Push active ends
34. equal Push vs Push still cancels as before.

## Force / displacement
35. representative old/new relation test:
   - proposed Push ~0.50–0.57 m
   - Tsuppari ~0.25–0.285 m
   - Push/Tsuppari ratio about 1.8–2.2
   - Tsuppari attacker intentional displacement = 0 in idle receiver fixture
36. existing global clamp/decay constants unchanged.

## Ring-out / states
37. Tsuppari can ring receiver out through normal resolver
38. simultaneous Tsuppari at edge uses existing simultaneous ring-out/rematch semantics
39. Tsuppari edge during CounterTransition dropped
40. during grapple dropped
41. during Kuzushi dropped
42. during action/recovery dropped
43. outcome freeze no-ops
44. Snapshot cooldown/buildup/action values are deep copies.

---

# Existing CounterTransition Test Guardrail

07A found that raising Push strength to 26.25 makes three existing `BoutCounterTransition.test.ts` fixtures miss their intended scenario.

Allowed:
- adjust fixture starting positions only
- only enough to recreate the same existing scenario under stronger Push.

Required:
- keep original assertion meaning
- keep ring-out/no-immunity assertions
- keep transition semantics
- report exact fixture changes.

Not allowed:
- weaken assertions
- delete cases
- change CounterTransition rules
- change ring-out rules
- mask a real regression.

If more than fixture geometry is needed, STOP and report.

---

# Expected Files

Likely:
- `src/game/sumo/BoutTypes.ts`
- `src/game/sumo/BoutSimulation.ts`
- new Tsuppari-focused Simulation tests
- relevant existing Simulation test helpers
- `src/game/input/pushDummyController.ts`
- dummy tests
- `src/game/scenes/BoutScene.ts`
- `src/game/presentation/wrestlerVisualState.ts`
- visual-state tests
- possibly focused input tests
- `docs/ARCHITECTURE.md`
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`.

Fixture-only changes to `BoutCounterTransition.test.ts` are allowed under the guardrail above.

Do not modify `CURRENT_TASK.md`.

---

# Scope Out

Do NOT:
- integrate uploaded Tsuppari images
- add Product Tsuppari textures
- choose separate-left/right vs mirrored pose production
- change idle red-master art
- add final ability/stat names
- add Management persistence
- add stamina/balance
- add CPU AI
- add Touch/Gamepad
- add throws/lifts
- change Push timing
- redesign CounterTransition
- change Grip/Drive rules
- change ring-out/Tokudawara rules
- add generic physics / ECS / rule framework
- opportunistically refactor unrelated code.

---

# Verification Level

**Heavy / Core Gameplay**

Required:

```
pnpm test
pnpm build
git diff --check
```

Plus focused Tsuppari tests and browser/runtime smoke.

Do not claim overall PASS if any required boundary case is missing or failing.

If a case cannot be executed:
- mark PARTIAL / NOT RUN
- do not silently sample it away.

---

# Browser / Runtime Smoke

Required if environment supports it.

Check:
- pre-bout still works
- Enter starts Bout
- ArrowLeft starts left Tsuppari
- ArrowRight starts right Tsuppari
- Left/Right simultaneous handling
- debug phase/cooldown/buildup readability
- in-range hit
- out-of-range whiff
- alternating hands
- 6th successful hit gives Kuzushi
- dummy mode 3 Tsuppari
- Player Push vs dummy Tsuppari
- Player Counter vs dummy Tsuppari -> Tsuppari attacker Kuzushi in place
- Push/Counter/Grip existing controls still work
- R restart clears cooldown/buildup
- no console/runtime errors.

The dedicated Tsuppari pose is not expected in this Task.

---

# User Play Test Gate

Required after technical review.

User must judge:
- Tsuppari timing
- 1 second hand cooldown
- alternating-hand rhythm
- reach
- ordinary Tsuppari push distance
- strengthened Push distance
- Push vs Tsuppari contest feel
- Tsuppari vs Tsuppari feel
- Counter timing/readability
- 6th-hit Kuzushi cadence
- whether one-frame pose should later display through whole action or a smaller phase.

Technical PASS does not accept these Game Feel values.

---

# Implementation Evidence Required

Completion Report must include:

| Design Requirement | Implemented As | Verified By |
|---|---|---|

At minimum:
- Left/Right semantic intent
- per-hand cooldown
- fixed Tsuppari timing
- center-based reach
- impulse model
- deterministic buildup
- Counter in-place Kuzushi
- Tsuppari-vs-Tsuppari symmetry
- Push-vs-Tsuppari contest
- Push displacement increase
- Push-vs-Push preservation
- ring-out path
- state ownership
- input latches
- dummy mode
- presentation/debug boundary.

---

# Completion Report

Include:

- Result
- Preflight
- Current Source delta
- exact constants actually implemented
- exact tick order used
- exact action/cooldown/buildup state shape
- same-tick input priority
- reach formula
- Counter behavior
- force interaction matrix
- representative measured displacements
- all explicit boundary-case results
- existing regression suite results
- CounterTransition fixture-only changes, if any
- browser/runtime smoke
- changed files
- files explicitly not changed
- Implementation Evidence
- Design Deviations
- Unexpected Scope
- Known Untested Items
- User Play Test Required
- Git delivery.

If none:
`Design Deviations: NONE`

Any semantic change from ACTION-07A must be reported and must not be silently treated as accepted.

---

# Stop Conditions

STOP / report if:
- Push/Tsuppari contest requires a broad physics rewrite
- equal Push-vs-Push semantics cannot be preserved
- Tsuppari Counter requires changing accepted Push Counter behavior
- 2:1 representative displacement requires changing global speed/decay semantics
- more than fixture geometry must change in CounterTransition tests
- Product Tsuppari art becomes a prerequisite for gameplay correctness
- a new long-term stat/Management architecture becomes necessary
- Current Source materially contradicts this design.

---

# Git Delivery

Follow `AGENTS.md`.

Normal successful Task:
- stage only Task-owned files
- one implementation commit
- fetch / fast-forward safety check
- push `origin/develop`
- verify remote SHA
- clean working tree.

Suggested commit:
`feat(action): implement tsuppari gameplay`

Do not modify `main`.
Do not modify `PROJECT_HANDOFF.md`.

# Final Instruction

Implement ACTION-07A exactly enough to make Tsuppari playable and testable.

Keep Product Tsuppari pose art out of this Task.
Preserve fixed-step deterministic Simulation ownership and accepted Push Counter semantics.


---

# ChatGPT Review Handoff

Review-Date: 2026-10-22
Overall Result: TECHNICAL PASS / USER PLAY TEST REQUIRED
Accepted Technical Baseline: 7b38c3ac3cef62115a7082f824b3eb56f29493d5

## Reported Implementation vs Design

Accepted as aligned with ACTION-07A / ACTION-07B.

Confirmed from Current Source:
- Tsuppari gameplay is owned by BoutSimulation.
- ArrowLeft / ArrowRight are semantic press edges only.
- left/right hand cooldowns are Bout-local Simulation state.
- action timing is fixed-step 6 / 1 / 9 ticks.
- reach is center-based and independent of sprite pixels.
- successful-hit buildup is deterministic.
- Tsuppari Counter produces in-place Kuzushi with no CounterTransition.
- Push/Tsuppari and Tsuppari/Tsuppari interactions are resolved in Simulation.
- dedicated Product Tsuppari pose art was not added.
- current red-master idle art baseline remains untouched.

## Accepted Implemented Prototype Constants

Provisional / User Play Test gated:

- PUSH_EXTERNAL_ACCELERATION = 26.25 m/s^2
- TSUPPARI_STARTUP_TICKS = 6
- TSUPPARI_ACTIVE_TICKS = 1
- TSUPPARI_RECOVERY_TICKS = 9
- TSUPPARI_HAND_COOLDOWN_TICKS = 60
- TSUPPARI_HAND_REACH = 0.525 m
- current effective equal-radius center reach = 0.875 m
- TSUPPARI_IMPULSE = 2.13 m/s
- TSUPPARI_COUPLED_SHARE = 0.5
- TSUPPARI_KUZUSHI_BUILDUP = 5
- Tsuppari Kuzushi duration = existing KUZUSHI_TICKS = 30

Do not treat these values as final balance before User Play Test.

## State / Ownership Review

Accepted:

- ParticipantIntent:
  - tsuppariLeftPressed
  - tsuppariRightPressed
- ParticipantActionState:
  - tsuppari { hand, phase, ticksRemaining, strike }
- participant runtime:
  - tsuppariCooldown { left, right }
  - tsuppariBuildup
- Snapshot exposes deep copies for presentation/debug/test use.

No duplicate top-level Tsuppari state was introduced.

## Tick / Cooldown Review

Implemented order is acceptable:

- outcome freeze
- cooldown decrement
- CounterTransition short-circuit
- posture / grapple logic
- FREE action start
- movement/external integration
- contact
- Counter
- Grip
- Push/Tsuppari force resolution
- action timers
- facing
- ring-out.

Cooldown semantics are accepted:
- hand accepted at t0 gets 60
- same hand is unavailable through t0+59
- ready at t0+60
- cooldown continues during progressing CounterTransition / Kuzushi / grapple
- outcome freeze stops it.

## Input Priority Review

Accepted:

Push
> ready Left Tsuppari
> ready Right Tsuppari
> Counter
> Grip
> Move

If Left and Right are both pressed:
- Left wins when both ready
- if Left is on cooldown and Right is ready, Right may start.

Edges are dropped, not queued.

## Counter Review

Tsuppari Counter implementation is accepted:

- Counter window + active Tsuppari hit tick + in reach
- attacker enters Kuzushi
- Counter user returns idle/stable
- no Tsuppari impulse
- no buildup increment/reset
- no side/rear relocation
- no overshoot
- no CounterTransition
- existing momentum is preserved.

Existing Push Counter logic remains contact-gated and retains Best / Success / transition / fallback semantics.

## Force Resolution Review

Accepted first Prototype model:

### Tsuppari vs idle/non-Push
- receiver only gets the impulse
- attacker has no intentional Tsuppari advance.

### Tsuppari vs Tsuppari
- both hit decisions are made before force/Kuzushi mutation
- both impulses apply
- both buildups update
- threshold Kuzushi is applied afterward
- participant order symmetry is explicitly tested.

### Push vs Tsuppari
- active-contact contest is coupled
- Tsuppari is not discarded
- Push wins the representative exchange overall
- TSUPPARI_COUPLED_SHARE = 0.5 remains provisional.

The short reverse/resistance effect during a contest is a Game Feel question, not technically accepted as final tuning.

## Push Tuning Review

Measured implementation result is consistent with the User request:

- old Push reference: ~0.267 m
- new Push: ~0.5325 m
- Tsuppari: ~0.2658 m
- representative Push / Tsuppari displacement ratio: ~2.00

Global:
- MAX_EXTERNAL_SPEED unchanged
- EXTERNAL_DECELERATION unchanged
- KUZUSHI_PUSH_SUSCEPTIBILITY unchanged
- Push phase timing unchanged.

This is accepted as the first Play Test tuning.

## CounterTransition Regression Guardrail

Confirmed:
- only the intended fixture geometry changed:
  - COUNTER_USER_OUT.mid.x: 1.75 -> 1.73
- assertions were not weakened
- cases were not removed
- CounterTransition rules were not changed.

This is accepted as a fixture-only adaptation to stronger Push.

## Verification Review

Reported and accepted:

- focused Tsuppari boundary tests: all required 44 cases PASS
- additional dummy / visual-state tests PASS
- pnpm test: 21 files / 340 tests PASS
- pnpm build: PASS
- git diff --check: PASS
- Browser/runtime smoke: PASS for required core interactions.

Browser Push-vs-dummy-Tsuppari timing was not deterministic in every CDP attempt, but deterministic Simulation tests cover the required contest cases. This does not block Technical PASS.

## Known Untested / Remaining Gates

Still not finally accepted:

- real-device/GPU visual behavior
- Game Feel
- Tsuppari dedicated pose art
- pose duration/readability
- Tokudawara-specific Tsuppari-only fixture is not added; existing ring-out/Tokudawara resolver coverage remains unchanged.

These do not block the present technical result.

## User Play Test Required

User should now test the actual game and judge:

1. ArrowLeft / ArrowRight alternating rhythm
2. 1-second per-hand cooldown
3. startup / recovery timing
4. 0.875 m effective reach
5. Tsuppari push distance (~0.27 m)
6. strengthened Push distance (~0.53 m)
7. Push vs Tsuppari contest feel
8. Tsuppari vs Tsuppari exchange
9. Counter vs Tsuppari readability / timing
10. 6th-hit Kuzushi cadence
11. ring-edge feel.

Controls:
- ArrowLeft / ArrowRight = Tsuppari
- 3 = Tsuppari dummy mode
- 0 = debug
- R = restart.

Dedicated Tsuppari art is not expected yet.

## Do Not Reopen

Unless explicitly requested:
- Tsuppari terminology
- ArrowLeft / ArrowRight hand mapping
- deterministic 5 ordinary hits -> 6th Kuzushi rule
- Countered Tsuppari = in-place Kuzushi / no wrap
- Push Counter existing relocation semantics
- Simulation ownership / fixed-step architecture
- current red-master idle art baseline.

## Next Task Constraint

Do not begin Product Tsuppari pose integration until the User reports the ACTION-07B gameplay Play Test result.

If gameplay is accepted or only small tuning is requested:
- preserve accepted gameplay semantics
- then run a separate Tsuppari Art Visual Gate comparing:
  - separate red left/right pose masters
  - one-side master + reflection.

If gameplay tuning is requested:
- make the smallest focused tuning Task before art integration.
