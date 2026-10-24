Task-ID: ACTION-13A2-GRIP-RPS-TIMING-STATE-INVESTIGATION
Status: REVIEWED
Task-Type: INVESTIGATION / DESIGN
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 67bd34cd56940150789ce45391594830f773fe09
Review-Handoff: ACTION-13A was reviewed implementation-ready, but the User has now materially changed the Grip design before ACTION-13B implementation. Random Throw KO is removed. Normal non-KO Throw now releases GRAPPLED -> FREE. Grip combat is now a three-way RPS: Yori > Lift > Throw > Yori. Best Timing acts as the Grip-state analogue of Kuzushi, usually ~1.5x effect, while Throw Best vs Yori is a Fall/KO. Shift Release is removed. ACTION-12B WASD grapple rotation and ACTION-11N Grip visuals remain accepted baselines unless this Investigation explicitly identifies a required integration change.
Handoff-Mode: GITHUB

# ACTION-13A2 — Grip Action RPS / Timing / State Design Investigation

## Purpose

Redesign the GRAPPLED gameplay loop around a coherent three-way action RPS before any Throw implementation begins.

This Task is Investigation / Design only.

NO Production implementation.

The goal is to produce one implementation-ready Grip combat design for:

- Yori / Drive on ArrowUp
- Throw on ArrowLeft / ArrowRight
- Lift on ArrowDown
- Best Timing
- Morozashi multipliers
- normal Throw -> FREE
- Shift Release removal
- Lifted state
- same-tick action contest / priority
- compatibility with ACTION-12B WASD grapple rotation.

Only `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md` may be changed/committed under the AGENTS.md Investigation-only Report Commit Exception.

---

# Authoritative User Decisions — These Supersede ACTION-13A Where Conflicting

## Grip RPS

The basic GRAPPLED RPS is:

```
Yori (ArrowUp) > Lift (ArrowDown) > Throw (ArrowLeft / ArrowRight) > Yori
```

Interpretation:

- Yori beats Lift.
- Lift beats Throw.
- Throw beats Yori.

This is the primary Grip-state action contest.

## Random Throw KO Removed

ACTION-13A's probabilistic Throw KO design is REJECTED / SUPERSEDED.

Do NOT design:
- Throw KO chance;
- Throw RNG;
- Throw seed;
- Throw roll counter;
- pre-generated Throw results.

Normal Throw is deterministic.

## Throw Best vs Yori

Throw wins against Yori.

If Throw is entered at the defined Best Timing against Yori:

- the Throw becomes an immediate Fall / KO;
- no random roll.

If Throw beats Yori outside Best Timing:

- it is a normal non-KO Throw.

## Normal Throw Releases Grip

A normal non-KO Throw:

1. moves the target laterally to the thrower's own Left / Right;
2. then changes the pair from GRAPPLED to FREE.

This is intentional.

Normal Throw is therefore also the primary deliberate escape from Grip.

The previous ACTION-13A design "non-KO Throw keeps Grip" is superseded.

## Shift Release Removed

Existing GRAPPLED Shift / gripPressed instant Release is to be removed in the future implementation.

While FREE:
- Shift remains the Grip-attempt input.

While GRAPPLED:
- Shift should no longer provide free Release.

Investigate the cleanest semantic behavior:
- normally ignore/drop the Grip edge while GRAPPLED;
- no queue.

Do NOT design a separate Grip Break in this Task.

Throw is the only planned Grip-break / return-to-FREE mechanic for now.

## Best Timing = Grip-State Kuzushi Analogue

GRIP state itself does not use the existing FREE-state Kuzushi posture.

Instead, the winning Grip RPS action may receive a Best Timing bonus analogous to Kuzushi's ~1.5x effect.

General concept:

```
normal winning effect = 1.0x
Best Timing winning effect = ~1.5x
```

Exception:
- Throw Best vs Yori = Fall / KO rather than "1.5x displacement".

Do NOT reuse or create ParticipantPosture.kuzushi inside GRAPPLED merely to model this.
Investigate a Grip-specific timing / contest result.

## Yori Reward

Yori should use approximately the same movement result as the current FREE Push baseline.

User intent:

- normal Yori movement amount ~= normal Push movement amount;
- Best Yori movement amount ~= Push against Kuzushi, i.e. approximately 1.5x the normal movement amount.

Important:
- future Simulation / Management will have separate Push strength and Yori strength parameters;
- do NOT merge those future parameters;
- for Prototype tuning only, matching the current Push displacement is the reference target.

## Lift Reward

When Lift wins over Throw:

- enter a Lifted state;
- for a fixed duration, the lifter can carry the opponent one-sidedly.

During Lifted:

- WASD = change direction / orientation;
- ArrowUp = move forward;
- only these 5 keys are usable:
  - W
  - A
  - S
  - D
  - ArrowUp
- Throw / Lift / other Grip actions are not usable during Lifted.

Best Lift:
- Lift effect is ~1.5x normal.

The exact meaning of "Lift effect" is not yet fixed.
Investigate whether the cleanest v1 multiplier should apply to:
- Lift duration;
- carry movement amount / speed;
- another single scalar;
- or a minimal combination.

Do NOT multiply multiple independent Lift dimensions unless clearly justified.

## Morozashi

Current design direction:

- Morozashi holder's Grip action effects ~= 1.5x.
- Morozashi disadvantaged wrestler's Grip action effects ~= 0.5x.
- Best Timing multiplies the applicable normal effect by ~1.5x.

Therefore a Morozashi holder + Best is approximately:

```
1.5 * 1.5 = 2.25x
```

A disadvantaged wrestler + Best would analogously be approximately:

```
0.5 * 1.5 = 0.75x
```

This is a design direction, not final balance.

Investigate exactly which quantitative effects this multiplier should apply to:

- Yori displacement / drive result;
- normal Throw displacement;
- Lift effect.

Throw Best KO does not need a numeric 2.25x KO.

Do NOT invent Management/stat formulas.

## Grip Ability Parameters

How future wrestler parameters affect:
- Best Window width;
- Yori strength;
- Throw strength;
- Lift strength;
- Grip escape;

is intentionally UNDECIDED.

Do not design these formulas.

Only preserve a clean boundary so future pre-bout / Simulation data can tune them later.

---

# Required Reading

Inspect Current Source before designing.

At minimum:

- AGENTS.md
- docs/ARCHITECTURE.md
- docs/agent_handoff/CURRENT_TASK.md
- docs/agent_handoff/CURRENT_COMPLETION_REPORT.md
- src/game/sumo/BoutTypes.ts
- src/game/sumo/BoutSimulation.ts
- src/game/sumo/grappleOrientation.ts
- src/game/sumo/ringOut.ts
- src/game/input/pressLatch.ts
- src/game/input/movementVector.ts
- src/game/input/pushDummyController.ts
- src/game/scenes/BoutScene.ts
- ACTION-12B grapple rotation tests
- current Drive tests
- current Grip / Orientation / RingOut / Push / Kuzushi tests.

Also inspect ACTION-13A review handoff in CURRENT_TASK before replacing assumptions.

Current Source outranks old discussion.

---

# Current Baseline to Confirm

Report whether these are currently true:

1. GRAPPLED ArrowUp hold becomes timerless `driveHeld`.
2. GRAPPLED Drive is re-decided every tick and stored as action kind `drive`.
3. Drive contributes pair shared external velocity along the pair axis.
4. current Drive target speed is 0.6 m/s and acceleration is 4 m/s^2.
5. Morozashi holder currently receives MOROZASHI_DRIVE_FACTOR = 1.5 for Drive only.
6. ACTION-12B manual WASD rotation is allowed only when both participants are READY.
7. GRAPPLED Shift edge currently releases from Grip when the participant is READY.
8. ArrowLeft / Right are currently Tsuppari edges in FREE.
9. ArrowDown is currently Counter edge in FREE.
10. GRAPPLED currently ignores Tsuppari / Counter action edges.
11. canonical grapple bond is 0.70 m.
12. existing ParticipantPosture.kuzushi is not a GRAPPLED contest state.
13. BoutOutcome currently only has ring-out finish.
14. no Lifted state exists.
15. no Throw transition exists.

If Current Source materially contradicts these assumptions, report and STOP if it affects the design.

---

# Investigation Part 1 — Define the Grip Action Model

The major design question is whether GRAPPLED actions remain "held continuous controls" or become explicit contest actions.

Current Yori/Drive is timerless and held.

Throw / Lift need timing windows and same-tick contest resolution.

Compare at least:

## Model A — all three are discrete Grip actions

- ArrowUp edge starts Yori action.
- ArrowLeft/Right edge starts Throw.
- ArrowDown edge starts Lift.
- actions have short commitment / contest windows.
- Best Timing is defined relative to the opponent's action start / phase.

Pros:
- clean RPS;
- clear Best window;
- easy presentation state;
- symmetric contest resolver.

Cons:
- changes existing hold-to-Drive feel materially;
- requires ArrowUp edge/hold ownership redesign.

## Model B — Yori remains held, Throw/Lift are edges

- ArrowUp hold starts / sustains Yori;
- Throw / Lift are discrete edges;
- Best Timing against Yori is measured from the transition into Yori / beginning of continuous pressure;
- after the initial Best window, Yori continues normally.

Pros:
- preserves current ArrowUp hold-to-Drive feel;
- smaller change.

Cons:
- asymmetric action model;
- must define when a new Yori "attempt" begins after hold/release;
- repeated Yori contest timing needs care.

## Model C — short Yori pulse repeated while held

- ArrowUp hold automatically starts discrete Yori pulses separated by commitment/recovery.
- Throw/Lift remain edge actions.

Evaluate:
- clarity;
- spam;
- feel;
- implementation complexity.

Recommend exactly one for v1.

The recommendation must preserve User intent:
- ArrowUp still feels like "寄り";
- Yori has meaningful risk against Throw;
- Yori can have Success / Best outcomes;
- RPS is readable.

Do not silently preserve current Drive if it makes Best Timing impossible to define cleanly.

---

# Investigation Part 2 — Grip RPS Resolver

Design one symmetric tick-local contest resolver for:

- Yori
- Lift
- Throw Left
- Throw Right
- no Grip action

Do not resolve participant A then B.

The resolver must decide from one immutable state.

Base RPS:

```
Yori > Lift
Lift > Throw
Throw > Yori
```

Define what happens for:

- one participant acts, other does nothing;
- both choose different RPS actions;
- same action vs same action;
- one participant is in action recovery / commitment;
- one participant is TURNING;
- Morozashi holder vs disadvantaged;
- Throw Left vs Throw Right;
- simultaneous conflicting edges from one participant.

Explicitly distinguish:

1. intra-participant same-tick input priority;
2. inter-participant RPS contest.

Do not conflate them.

---

# Investigation Part 3 — "No Action" Behavior

The User mentioned "非グリップ" when discussing simultaneous choices, but has now approved removing Shift Release.

Therefore investigate the clean v1 interpretation of "no Grip action":

- no Yori / Lift / Throw this tick;
- participant may still use ACTION-12B WASD rotation if eligible;
- Shift edge while GRAPPLED is ignored/dropped;
- no free Release.

Define how a RPS action behaves against an opponent choosing no Grip action.

Likely candidates:

- Yori vs none -> ordinary Yori effect;
- Throw vs none -> ordinary Throw -> FREE;
- Lift vs none -> does Lift succeed, fail, or require catching Throw?

This last point is important.

The RPS says Lift beats Throw, but it is not yet explicit whether Lift is also a standalone action against none.

Compare:
A. Lift can be initiated against no action.
B. Lift only succeeds as a counter to Throw.
C. Lift initiates normally but weaker than a counter success.

Recommend one.

---

# Investigation Part 4 — Best Timing General Rule

Design a Grip-specific Success / Best timing model analogous in spirit to Counter/Kuzushi but not stored as Kuzushi posture.

Need a clean answer for:

- what event starts the timing clock;
- whose timing is measured;
- how many ticks are Success vs Best;
- whether the window exists only when the opponent's losing action begins;
- how same-tick inputs classify;
- whether "Best" means earliest response or a centered timing window;
- whether Best can be derived from opponent action phase rather than a new timer.

Minimum required matchups:

- Throw timing against Yori.
- Lift timing against Throw.
- Yori timing against Lift.

The User wants all three RPS winners to have Best Timing.

General effect:
- Success winner = normal effect.
- Best winner = ~1.5x effect.
- Throw Best vs Yori = Fall / KO.

Recommend one common timing model if possible.

If one common model produces unnatural behavior, explain the minimal exception.

Do not design wrestler-stat influence on window width.

Prototype window width may be a named provisional constant.

---

# Investigation Part 5 — Same-Tick Inputs and Best

Define whether simultaneous starts count as Best.

Examples:

- Yori and Throw begin on the exact same tick.
- Throw and Lift begin on same tick.
- Lift and Yori begin on same tick.

Candidate interpretations:

A. exact same tick = Best.
B. exact same tick = normal Success; Best requires reaction after seeing commitment.
C. matchup-specific.

Recommend one consistent rule.

This materially affects risk/reward and must be explicit.

---

# Investigation Part 6 — Yori Redesign

Current Drive is not yet the desired final Yori.

User requirement:
- normal Yori should move approximately as much as current FREE Push.
- Best Yori should move approximately as much as Push against Kuzushi (~1.5x normal).

Investigate how to produce a discrete, testable Yori outcome while preserving existing Grip movement ownership.

Compare:

## Yori A — impulse/displacement action
One successful Yori produces a fixed Simulation-owned forward pair displacement/transition roughly matching current Push result.

## Yori B — short high-strength Drive phase
A successful Yori temporarily applies tuned grapple Drive until cumulative movement matches the target displacement.

## Yori C — retain current Drive hold, but RPS victory temporarily boosts its effect

Evaluate:
- predictable movement amount;
- compatibility with Best 1.5x;
- edge/ring-out;
- visual readability;
- future Yori strength parameter.

Recommend one.

The movement reference is current Push displacement, not permanent formula equality.

Do not make Yori literally use Push strength state.

---

# Investigation Part 7 — Yori Same-Action Contest

Define Yori vs Yori.

Current Drive vs Drive nets contributions.

Possible v1:
- both commit Yori;
- their effective Yori strengths contest;
- equal Prototype strengths cancel / no net movement;
- future Yori parameter can resolve difference.

Compare with current Drive net behavior and recommend.

Morozashi multiplier must be considered carefully:
- if holder is 1.5x and disadvantaged 0.5x, equal base Prototype may no longer cancel.

Determine whether this is desired.

Do not invent a future stat formula.

---

# Investigation Part 8 — Throw Redesign

ACTION-13A random KO is removed.

Accepted baseline to design around:

## Throw vs none / ordinary Throw
- non-KO;
- target displaced toward thrower's own Left / Right;
- after the Throw transition, engagement -> FREE;
- both participants' post-Throw positions/facings/velocities must be explicitly defined;
- no free Shift Release.

## Throw beats Yori
- ordinary Success -> normal Throw -> FREE;
- Best -> immediate Fall / KO.

## Throw loses to Lift
- no Throw displacement;
- Lift winner gets Lift result.

Investigate whether ACTION-13A's target-orbit geometry is still appropriate now that Grip breaks afterward.

Compare:
- orbit target around thrower during transition then FREE;
- direct lateral throw path then FREE;
- another smallest explicit path.

Recommend exact post-Throw FREE geometry:
- final distance between wrestlers;
- facings;
- velocities;
- recovery states;
- whether thrown target receives recovery/stagger;
- how normal ring-out is checked during transition.

Do not leave them at exact contact in FREE if that would immediately create confusing re-contact.

---

# Investigation Part 9 — Throw Best / Fall

Throw Best against Yori is deterministic Fall / KO.

No RNG.

Design the minimal BoutOutcome extension.

Review the ACTION-13A proposal:
- generic reason `fall`
- cause `throw`

Determine whether it remains appropriate.

Define:
- whether Throw Best uses a transition before outcome or resolves immediately;
- final canonical position/facing frozen at outcome;
- what later Presentation needs for fall direction.

Do not implement fall animation.

---

# Investigation Part 10 — Lift Eligibility

Define whether Lift:

- is usable only while GRAPPLED;
- requires the lifter to be READY;
- requires the opponent to be READY;
- can begin while opponent is TURNING;
- can begin against no action;
- wins only against Throw;
- loses to Yori.

User intent is a real action, not merely a hidden resolver outcome.

Recommend exact v1 eligibility consistent with Throw/Yori.

---

# Investigation Part 11 — Lifted State Ownership

Design the smallest explicit Lifted state.

Do NOT store duplicate participant flags.

Compare:

## Lifted pair-level engagement variant
For example:
```
engagement:
  free
  grappled { advantage }
  lifted { lifterId, targetId, ... }
```

## Separate pair-level liftTransition / liftState alongside grappled engagement

Evaluate:
- whether lifted still semantically counts as Grip;
- what happens to Morozashi;
- release / throw after Lift ends;
- ring-out ownership;
- snapshot/presentation clarity.

Recommend one Source of Truth.

User intent:
- during Lifted, one wrestler is carrying the other one-sidedly for a limited duration.

No physics engine.

---

# Investigation Part 12 — Lifted Controls

During Lifted only these inputs are active:

- W/A/S/D: change orientation / direction
- ArrowUp: move forward

All other action keys are ignored/dropped:
- ArrowLeft / Right
- ArrowDown
- Shift
- other Grip actions.

Design exact semantics.

WASD:
- should it set desired facing direction like FREE movement?
- should it use ACTION-12B tangential pair rotation?
- should it rotate the carrier/lifted pair around a midpoint?
- or should it steer a carrier-centered formation?

ArrowUp:
- forward relative to which canonical facing?
- how does the carried target follow?
- pair distance / carried offset?
- canonical movement owner?

Recommend the smallest deterministic top-down rule.

The user says "WASDで向きの変更可能、↑キーで前進" — preserve this control feel.

---

# Investigation Part 13 — Lift Duration and "Effect"

Best Lift effect = ~1.5x.

Morozashi holder effect = ~1.5x.
Morozashi holder + Best = ~2.25x.

Disadvantaged effect direction = ~0.5x.

Determine the single clearest Lift scalar to multiply.

Compare:

A. duration multiplier
B. forward carry speed multiplier
C. maximum carry distance multiplier
D. another single scalar

Recommendation should avoid multiplying duration AND speed unless necessary, because that would square the effect.

Example:
- if duration is the effect, 1.5x means 1.5x carry opportunity;
- if speed is the effect, duration stays readable and 1.5x means 1.5x distance.

Recommend one for v1 and explain User Play Test implications.

All values provisional.

---

# Investigation Part 14 — Lift End

Define how Lifted ends:

- timer expires;
- ring-out;
- bout Fall if any? (do not invent unless required);
- whether releasing ArrowUp affects duration;
- whether Lift can be manually dropped.

User has not requested a drop key.

Prefer no extra input unless required.

At normal timer end, define:
- return to GRAPPLED or FREE?
- neutral or previous Morozashi advantage?
- positions/facings;
- readiness/TURNING.

Because User said Yori and Lift keep Grip, preferred hypothesis:
- Lift end -> GRAPPLED.

But verify ownership and balance.

---

# Investigation Part 15 — Morozashi Multiplier Model

Design a clean function / conceptual rule for effective Grip action strength.

Prototype direction:

```
advantageMultiplier:
  neutral = 1.0
  morozashi holder = 1.5
  morozashi disadvantaged = 0.5

timingMultiplier:
  Success = 1.0
  Best = 1.5
```

Then:

```
effectiveMultiplier = advantageMultiplier * timingMultiplier
```

Examples:
- neutral Success = 1.0
- neutral Best = 1.5
- holder Success = 1.5
- holder Best = 2.25
- disadvantaged Success = 0.5
- disadvantaged Best = 0.75

Investigate whether this can consistently drive:
- Yori effect;
- normal Throw displacement;
- Lift effect.

Throw Best Fall is a categorical exception.

Also determine what happens when RPS loser has Morozashi:
- does multiplier ever overturn the RPS result?
Preferred direction:
- NO. RPS winner remains winner; multiplier changes reward magnitude only.

Verify and recommend explicitly.

---

# Investigation Part 16 — Best Timing and Morozashi

Do NOT use Morozashi to widen Best Window in v1 unless clearly necessary.

User's latest direction is primarily:
- Morozashi = effect multiplier;
- Best = effect multiplier;
- future parameters/window tuning undecided.

Therefore compare:
A. Best window identical for everyone in Prototype.
B. Morozashi also widens Best window.

Prefer A unless strong reason otherwise.

Do not invent skill-stat timing formulas.

---

# Investigation Part 17 — Recovery / Commitment

To prevent action spam, design minimal action/recovery timing for:

- Yori
- Throw
- Lift attempt/win/loss
- RPS stalemate/same-action contest.

Need enough state for:
- Best timing;
- readable gameplay;
- future animation.

Do not overbuild phases.

Compare:
- startup + resolve + recovery
- active contest window + recovery
- pair transition + recovery.

Recommend minimal shape per action.

All numeric durations provisional.

---

# Investigation Part 18 — Same-Action Contests

Define:

## Yori vs Yori
- equal base strengths?
- Morozashi effects?
- movement/no movement?
- future Yori strength extension.

## Throw vs Throw
Preserve the useful ACTION-13A direction logic where appropriate:
- opposite WORLD directions -> action stalemate?
- same WORLD direction -> both shift?
But note normal Throw now releases Grip.
Determine whether same-direction tie:
- stays GRAPPLED;
- becomes FREE;
- pair shifts then remains Grip;
- pair shifts then both break Grip.

Recommend exact v1.

## Lift vs Lift
No rule exists yet.

Compare:
- stalemate/recovery;
- future Lift strength contest;
- another simple rule.

Do not use participant order to choose a winner.

---

# Investigation Part 19 — Same Participant Multiple Action Inputs

Define deterministic handling if one participant has more than one Grip action edge/hold in the same tick.

Examples:
- ArrowUp + ArrowLeft
- ArrowUp + ArrowDown
- ArrowLeft + ArrowRight
- ArrowDown + ArrowRight

This is separate from the between-wrestler RPS.

Compare:
A. explicit priority
B. conflicting actions cancel/drop
C. held Yori loses to discrete Throw/Lift edges
D. another small rule.

Recommend one.

Do not let raw property order decide.

---

# Investigation Part 20 — Shift Release Removal

Design exact future behavior:

FREE:
- Shift starts Grip exactly as current baseline.

GRAPPLED:
- Shift edge is ignored/dropped;
- no Release;
- no recovery;
- no queue.

Lifted:
- Shift ignored/dropped.

Throw normal is the intentional Grip escape.

Review current tests/docs that will need deliberate updates.

---

# Investigation Part 21 — RPS and ACTION-12B WASD Rotation

Outside Lifted:

- ACTION-12B WASD manual rotation should remain available when no higher-priority Grip action consumes the tick and existing readiness allows.

Define exact order:

- Grip action resolver vs WASD rotation.
- Throw/Yori/Lift accepted action should normally consume that tick's manual rotation?
- recovery ticks and WASD rotation?
- same-action stalemate and rotation?

Recommend exact behavior.

Do not silently alter ACTION-12B semantics on no-action ticks.

---

# Investigation Part 22 — Ring-Out / Tokudawara

All canonical movement must continue to use existing ring-out ownership.

Cover:

- Yori pushes pair toward edge.
- normal Throw crosses edge before Grip breaks.
- Throw transition finishes inside vs outside.
- Lift carry moves opponent/carrier across edge.
- same-action pair shift.
- Tokudawara windows.

No new Throw/Lift/Yori-specific wall or boundary.

Define outcome priority if:
- RPS action would later transition state but ring-out happens first.

---

# Investigation Part 23 — Outcome / Presentation Boundary

Design the minimum Simulation/Snapshot data needed for later visuals.

Potential needs:

- Grip action state / phase / side;
- contest result tier Success / Best;
- Yori transition progress;
- Throw transition progress;
- Lifted state / remaining ticks / lifterId;
- Fall cause and direction.

Do not create an event bus.

Do not implement final art.

Keep Pure Simulation -> State -> Phaser.

---

# Investigation Part 24 — Prototype Tuning

Recommend provisional named values only where implementation requires them.

Need candidates/ranges for:

- common Grip Best Window ticks;
- Yori normal displacement target (reference current Push);
- Yori transition/action duration if needed;
- Throw normal lateral/orbit displacement;
- Throw transition duration;
- Throw post-release separation if needed;
- Lift duration;
- Lift carry speed or whichever single effect scalar is chosen;
- action recovery/commitment durations.

Also recommend:
- MOROZASHI_EFFECT_MULTIPLIER = ~1.5
- MOROZASHI_DISADVANTAGED_EFFECT_MULTIPLIER = ~0.5
- GRIP_BEST_EFFECT_MULTIPLIER = ~1.5

All are provisional User Play Test tuning.

Do not treat current example values as final balance.

---

# Investigation Part 25 — Future Parameter Boundary

Do NOT design Simulation/Management stat formulas.

But report what future effective values the Bout layer may eventually need, e.g.:

- yoriStrength/effect
- throwEffect
- liftEffect
- Best window ticks

Only if needed.

Prefer effective pre-bout values over raw Management stats.

Do not add these to Production in this Task.

---

# Required Coherent V1 State Machine

Completion Report must provide one compact state machine covering at least:

```
FREE
  -> Grip attempt
  -> GRAPPLED

GRAPPLED
  -> Yori contest/result
  -> Throw contest/result
  -> Lift contest/result
  -> WASD rotate
  -> normal Throw -> FREE
  -> Throw Best vs Yori -> FALL outcome
  -> Lift win -> LIFTED

LIFTED
  -> steer with WASD
  -> ArrowUp carry
  -> timer end -> GRAPPLED
  -> ring-out outcome
```

Include recoveries/transitions without creating duplicate state ownership.

---

# Required Same-Tick Priority Proposal

Completion Report must recommend exact order for future BoutSimulation.step() around:

1. CounterTransition / existing special transitions
2. future Grip-action transition / Lifted update
3. tick-start readiness
4. GRAPPLED Shift edge (now ignored)
5. Grip action request capture
6. RPS contest resolution
7. Yori / Throw / Lift result start
8. existing Drive replacement / deprecation
9. ACTION-12B WASD rotation
10. velocity/integration
11. bond
12. facing
13. ring-out.

Make explicit which existing `driveHeld` semantics remain, change, or are replaced by Yori.

---

# Required Boundary Cases for Future Implementation

Map every case to a future test plan.

## RPS / Timing

1. Yori vs Lift -> Yori Success.
2. Yori Best vs Lift -> ~1.5x Yori.
3. Lift vs Throw -> Lift Success.
4. Lift Best vs Throw -> ~1.5x Lift effect.
5. Throw vs Yori -> normal Throw -> FREE.
6. Throw Best vs Yori -> Fall / KO.
7. exact-same-tick Yori/Throw classification.
8. exact-same-tick Lift/Throw classification.
9. exact-same-tick Yori/Lift classification.
10. late input outside Best -> normal Success.

## No Action / Standalone

11. Yori vs none.
12. Throw Left vs none -> normal Throw -> FREE.
13. Throw Right vs none -> normal Throw -> FREE.
14. Lift vs none according to chosen v1 rule.
15. no action -> ACTION-12B rotation unchanged.

## Morozashi

16. neutral Success multiplier = 1.0.
17. neutral Best = 1.5.
18. holder Success = 1.5.
19. holder Best = 2.25.
20. disadvantaged Success = 0.5.
21. disadvantaged Best = 0.75.
22. multiplier does not overturn RPS winner.
23. Throw Best remains KO categorical result.

## Yori

24. normal Yori movement ~= current Push reference.
25. Best Yori ~= 1.5x reference.
26. Yori near edge -> existing ring-out.
27. Yori vs Yori neutral equal case.
28. Yori vs Yori Morozashi asymmetry according to chosen design.
29. no Yori input -> old ACTION-12B zero-input behavior unchanged.

## Throw

30. own-left / own-right world direction at four cardinal facings.
31. arbitrary facing direction.
32. normal Throw transition lateral displacement.
33. normal Throw ends GRAPPLED -> FREE.
34. final post-Throw separation/facing/velocity per design.
35. normal Throw near edge -> ordinary ring-out before/at release.
36. Tokudawara crossing.
37. Throw Best outcome = fall cause throw.
38. no RNG / no seed / deterministic replay.
39. Throw vs Throw opposite world directions.
40. Throw vs Throw same world direction.
41. one participant Left+Right same tick.
42. same-direction future strength extension point without fake v1 stat.

## Lift / Lifted

43. Lift win enters Lifted state.
44. Lift loser cannot act during Lifted.
45. Lifted W/A/S/D steering.
46. Lifted ArrowUp forward carry.
47. Lifted ArrowLeft/Right/Down/Shift ignored.
48. normal Lift effect.
49. Best Lift = ~1.5x effect.
50. holder Lift = ~1.5x.
51. holder Best Lift = ~2.25x.
52. disadvantaged Lift = ~0.5x.
53. Lift timer end -> GRAPPLED.
54. Grip advantage after Lift end according to chosen design.
55. Lift ring-out.
56. Lift Tokudawara.
57. Lift vs Lift same-action rule.
58. no hidden second Lift/Grip source of truth.

## Input / State / Release

59. FREE Shift still starts Grip.
60. GRAPPLED Shift no longer Releases.
61. LIFTED Shift ignored.
62. normal Throw is the Grip-break path.
63. same participant Up+Left.
64. same participant Up+Down.
65. same participant Left+Right.
66. same participant Down+Right.
67. RPS accepted action vs WASD same tick.
68. action recovery vs WASD rotation.
69. TURNING eligibility according to chosen rule.
70. first READY tick.
71. no action edge queueing.

## Regression

72. FREE Push unchanged.
73. FREE Tsuppari Left/Right unchanged.
74. FREE Counter Down unchanged.
75. Grip attempt Shift unchanged.
76. ACTION-12B WASD rotation unchanged on no-action ticks.
77. ring-out fixtures unchanged.
78. CounterTransition unchanged.
79. Kuzushi FREE-state logic unchanged.
80. ACTION-11N Grip visuals unchanged.

Future Implementation must not reduce this to representative sampling.

---

# Recommended Task Split to Evaluate

The Investigation must recommend the safest implementation sequence.

Default candidate:

## ACTION-13B — Grip RPS Foundation + Yori + Throw
- new GRAPPLED semantic action inputs
- Shift Release removal
- Grip action resolver
- common Best Timing
- Yori redesign
- Throw normal -> FREE
- Throw Best -> Fall
- Morozashi effect multiplier
- transitions/recoveries
- Heavy verification + User Play Test

## ACTION-14A — Lift Core Investigation/Implementation
Because Lifted introduces a materially new state/control mode:
- Lifted pair state
- WASD steering
- ArrowUp carry
- Lift duration/effect
- return to GRAPPLED
- ring-out
- User Play Test.

Alternatively, if Current Source makes Lift cheap enough to integrate safely, explain why all three RPS actions should land together.

Prioritize small verifiable gameplay over implementing every subsystem at once.

---

# Architecture Constraints

Maintain:

Pure TypeScript Game / Simulation
-> State / Results
-> Phaser Rendering / Input / Animation.

Do not:
- put RPS formulas in BoutScene;
- add Scene-owned timers;
- reuse ParticipantPosture.kuzushi for Grip Best;
- create duplicate Grip/Lift state on both participants;
- introduce RNG for Throw;
- create generic rule engine;
- add ECS/physics framework;
- implement Management stats;
- implement Save;
- modify accepted art.

ACTION-12B canonical position/facing ownership must remain the basis unless explicitly superseded by a reviewed state transition.

---

# Scope

## In Scope

- Current Source inspection
- Grip action RPS
- Yori action redesign
- common Best Timing
- Throw deterministic redesign
- normal Throw -> FREE
- Throw Best Fall
- Lift/Lifted state design
- Lift controls
- Morozashi effect multipliers
- Shift Release removal
- same-action contests
- same-participant input conflicts
- transitions/recovery
- state ownership
- ring-out/Tokudawara interaction
- future effective parameter boundary
- recommended implementation task split.

## Scope Out

NO Production implementation.

Do not change:
- src/**
- public/**
- tools/**
- accepted architecture docs/spec
- gameplay tuning in source
- Grip visuals.

Do not implement Yori / Throw / Lift.

Do not design:
- raw Management stat formulas;
- Save;
- final CPU AI;
- final Touch/Gamepad;
- final Throw/Lift art.

---

# Stop Conditions

Result BLOCKED / STOP if:

- Current Source materially conflicts with the accepted baseline;
- one coherent RPS cannot be defined without redesigning engagement ownership beyond a small explicit model;
- Yori Best Timing cannot coexist with held ArrowUp semantics without a User decision between materially different control models;
- Lifted requires a fundamentally separate physics/constraint framework;
- Morozashi multipliers can overturn RPS in unavoidable ways;
- removing Shift Release creates an unavoidable deadlock without inventing another escape;
- implementation order cannot be split into small verifiable tasks without semantic duplication.

If blocked, identify the smallest exact User decision needed.

---

# Verification

Investigation-only.

Required:
- Current Source inspection;
- relevant tests inspection;
- focused current tests if useful;
- scratch calculations allowed, not committed;
- no Production source/docs changes.

Allowed repository change:
- CURRENT_COMPLETION_REPORT.md only.

Use AGENTS.md Investigation-only Report Commit Exception.

User Play Test:
- Not Applicable to this Investigation.
- Future implementation requires User Play Test.

---

# Completion Report

Must include:

- Result: PASS / BLOCKED
- Current Source findings
- explicit list of ACTION-13A decisions superseded
- chosen Yori control model A/B/C
- exact Grip RPS resolver
- no-action behavior
- exact common Best Timing model
- exact same-tick / Best rule
- Yori movement model
- Yori vs Yori
- Throw normal geometry + final FREE state
- Throw Best Fall semantics
- Lift eligibility
- Lifted Source of Truth
- Lifted controls
- chosen Lift effect scalar
- Lift end state
- Morozashi multiplier function
- Best + Morozashi composition
- same-action contests
- same-participant input conflict rule
- Shift Release removal semantics
- ACTION-12B WASD integration
- exact future step order
- ring-out/Tokudawara
- minimal Snapshot/presentation boundary
- provisional tuning candidates
- future effective parameter boundary
- coherent state machine
- all 80 future boundary cases mapped to verification
- recommended implementation task split
- User decisions still required, if any
- Design Deviations: N/A
- Unexpected Scope
- Git delivery.

# Final Instruction

Design the complete GRAPPLED action RPS before implementation.

Use:

```
Yori > Lift > Throw > Yori
```

Remove random Throw KO. Best Throw vs Yori is deterministic Fall / KO. Normal Throw displaces laterally and then breaks Grip to FREE. Yori and Lift keep Grip. Shift no longer releases while GRAPPLED.

Use a Grip-specific Best Timing concept analogous to Kuzushi: normal winning effect 1.0x, Best ~1.5x, without entering Kuzushi posture.

Treat Morozashi as an effect multiplier direction: holder ~1.5x, disadvantaged ~0.5x; Best compounds to ~2.25x for holder, while RPS winner itself never changes because of multiplier.

Yori should approximately match current Push displacement; Best Yori approximately matches Kuzushi-amplified Push displacement.

Lift win enters a temporary one-sided Lifted state. During Lifted, only WASD steering and ArrowUp forward carry are active. Determine one clean Lift effect scalar for Best/Morozashi multiplication.

Keep future wrestler-stat formulas undecided.

Return one coherent implementation-ready state machine and recommend whether Yori+Throw should be implemented before Lifted as a separate later task.


---

# ChatGPT Review Handoff

Review-Date: 2026-10-24
Overall Result: PASS WITH USER DECISION REQUIRED
Accepted Investigation Baseline: dae8bc3fd90e098bca5687decb04ba9ddfc49c85

## Scope / Source Review

Accepted:

- Investigation-only scope was respected.
- Agent Task diff changes only CURRENT_COMPLETION_REPORT.md.
- No Production source, tests, assets, or accepted architecture docs were modified.
- Current Source findings match the report.
- Focused existing regression run: 11 files / 259 PASS.

No material Current Source/SPEC conflict was found.

## Accepted High-Level Grip RPS

The following is accepted:

```
Yori > Lift > Throw > Yori
```

- Yori / Throw / Lift are explicit GRAPPLED actions.
- RPS result is resolved symmetrically from one tick-local state.
- Morozashi/effect multipliers never overturn the RPS winner.
- Shift no longer releases while GRAPPLED.
- normal Throw is the intentional Grip-break path to FREE.
- Throw Best vs Yori is deterministic Fall / KO.
- no Throw RNG / seed / roll system.
- Lifted is a later explicit pair-level state.
- ACTION-12B remains the no-action GRAPPLED footwork baseline.

## Accepted Yori Control Model

Model C is accepted for Prototype design:

- ArrowUp press starts one Yori action.
- Holding ArrowUp repeats discrete Yori actions after execution + recovery.
- Yori therefore keeps the current "hold to keep pressing" control feel while exposing discrete starts for RPS timing.
- current timerless Drive is superseded by Yori in the future implementation.

This is a material gameplay change from ACTION-12B Drive and must receive User Play Test after implementation.

## Review Correction RC-1 — Best Timing Is Directional

The report proposed a symmetric Best test based only on the absolute difference between action start ticks.

Correct this.

User wording is consistently:
- Throw is entered at Best Timing **against Yori**;
- Lift is **matched to Throw** at Best Timing;
- Grip Best is analogous to timing a winning response.

Therefore v1 Best must reward the WINNING action being timed to the LOSING action.

Accepted rule:

1. Each Grip action has an explicit startup.
2. When two different RPS actions overlap, determine the RPS winner first.
3. Let loserStart be the losing action's accepted start tick.
4. Let winnerStart be the winning action's accepted start tick.
5. Tier:
   - if winnerStart === loserStart: Best
   - else if winnerStart > loserStart AND winnerStart - loserStart < GRIP_BEST_TICKS: Best
   - otherwise, while the startups still overlap: Success.

Consequences:

- Yori starts -> Throw is entered within Best window => Throw Best -> Fall.
- Throw starts -> Lift is entered within Best window => Lift Best.
- Lift starts -> Yori is entered within Best window => Yori Best.
- Winning action started first and the losing action arrived later => Success, NOT Best.
- Same-tick starts count as Best prediction/read.

This is still phase-derived; no Kuzushi posture or extra Best timer is required.

Future tests must explicitly cover both directions for every RPS pair:
- loser first -> winner responds inside Best;
- winner first -> loser responds later => Success;
- same tick => Best;
- response outside Best but still overlapping => Success.

## Review Correction RC-2 — Own Left/Right Uses Canonical Facing

The report changed Throw left/right from the thrower's canonical facing to the pair-axis perpendicular in order to make simultaneous directions exactly antiparallel.

Do not make that semantic change.

User requirement is "自分から見て左 / 右".

Accepted Throw direction source:

```
f = (cos(thrower.facing), sin(thrower.facing))
ownLeft  = ( f.y, -f.x)
ownRight = (-f.y,  f.x)
```

Use the thrower's canonical facing at the accepted Throw start tick.

Reason:

- the wrestler sprite/body faces canonical facing;
- "own left/right" should follow the wrestler's own orientation;
- READY tolerance may leave up to a small facing error; pair-axis substitution would invisibly rotate the requested direction away from the wrestler's body.

For simultaneous Throw classification:
- compute each wrestler's own requested world vector independently;
- classify same/opposite direction using their dot product as ACTION-13A originally proposed;
- do not require exact bitwise antiparallel vectors.

This remains deterministic and participant-order independent.

## Accepted Grip Best / Morozashi Structure — Pending Yori Distance Decision

General design remains accepted:

- neutral effect baseline = 1.0
- Morozashi holder effect direction = ~1.5
- Morozashi disadvantaged effect direction = ~0.5
- Best effect direction = ~1.5
- RPS winner is determined before any multiplier
- Throw Best vs Yori is categorical Fall, not numeric displacement.

However, Yori exposes a real conflict between two User requirements and Current Source behavior. See User Decision D1.

## User Decision D1 — Yori Best Movement Reference

Current Source / Agent scratch result:

- normal contact Push displacement ≈ 0.5325 m
- current Push against Kuzushi displacement ≈ 0.6293 m
- current actual ratio ≈ 1.18x

The reason is current Kuzushi follow-up: the 1.5 force multiplier is consumed on the first successful Push-force tick, so final displacement is not 1.5x.

The User previously specified BOTH:

A. "Best Yori should have the same movement amount as current Push against Kuzushi."

B. Grip Best effect should be about 1.5x, and Morozashi holder + Best should be about 2.25x.

These cannot both be literal displacement rules with the current Push implementation.

Choose one before ACTION-13B implementation:

### D1-A — Literal current Push/Kuzushi movement reference

- neutral Yori Success target ≈ 0.5325 m
- neutral Yori Best target ≈ 0.6293 m
- Best is therefore ~1.18x in actual displacement for Yori.
- Morozashi composition needs a Yori-specific interpretation instead of a universal 1.5x distance multiplier.

This follows the explicit "same movement as current Kuzushi Push" instruction most literally.

### D1-B — Unified Grip effect multiplier

- neutral Yori Success = 0.5325 m
- neutral Yori Best = 0.5325 * 1.5 ≈ 0.79875 m
- holder Success = 0.5325 * 1.5
- holder Best = 0.5325 * 2.25 ≈ 1.1981 m
- disadvantaged Success = 0.5325 * 0.5
- disadvantaged Best = 0.5325 * 0.75

This follows the common 1.5x / 2.25x Grip-effect model and is the ACTION-13A2 report recommendation, but it is NOT the same movement as the current Kuzushi Push.

No implementation task should be registered until D1 is selected.

## Accepted Yori Geometry Subject to D1

Yori A is accepted structurally:

- successful Yori uses a Simulation-owned pair forward transition;
- pair translates along actor -> opponent axis;
- bond and relative facing are preserved;
- Yori does not reuse Push action/force state;
- future Yori parameter remains separate from Push parameter;
- ring-out remains existing canonical ownership.

Only the exact distance/effect composition is pending D1.

## Accepted Yori vs Yori

Prototype direction accepted:

- same-action contest is not RPS.
- neutral equal effects cancel.
- Morozashi asymmetry may create a net Yori result.
- no participant-order winner.
- future Yori strength can later replace Prototype equal base strength.

Exact Yori displacement still depends on D1.

## Accepted Throw Redesign

Normal Throw:

- deterministic; no RNG;
- target moves toward thrower's own Left/Right per RC-2;
- Thrower stays stationary during the Throw path;
- add a small fixed separation component so FREE does not end at immediate body contact;
- ring-out is checked during the transition;
- on successful non-ring-out completion:
  - engagement -> FREE;
  - Morozashi is gone;
  - final positions/facing/velocities are explicit.

Throw Best vs Yori:
- immediate fall outcome;
- no random roll;
- no normal Throw displacement.

Normal Throw is the current planned Grip escape.

The report's provisional post-Throw recovery / thrown-stagger values are accepted only as Prototype tuning for User Play Test, not as permanent rules.

## Accepted Lift / Lifted Design Direction

Accepted for later ACTION-14A:

- Lift may be a standalone action against none.
- Lift beats Throw; loses to Yori.
- Lifted should be a new pair-level BoutEngagement variant, not duplicate participant flags.
- Lifted retains the previous GrappleAdvantage so normal expiry returns to the same neutral/Morozashi relation.
- During Lifted:
  - lifter WASD steers world-facing direction;
  - lifter ArrowUp moves forward;
  - all other action inputs are dropped;
  - carried wrestler has no input authority.
- Lift duration is fixed in v1.
- Best/Morozashi effect multiplier applies to carry speed only.
- do not also multiply duration or turn rate.
- expiry returns to GRAPPLED.
- ring-out/Tokudawara remain existing owners.

These values remain provisional and require User Play Test.

## Accepted Shift Release Removal

Future implementation:

- FREE Shift = current Grip attempt.
- GRAPPLED Shift = ignored/dropped, no Release, no recovery, no queue.
- LIFTED Shift = ignored/dropped.
- transition input lock drops Shift as normal.

No Grip Break action in current scope.

## Accepted Same-Participant Input Direction

The report's explicit deterministic priority is acceptable as a Prototype proposal:

1. Left+Right Throw together -> both Throw directions dropped as ambiguous.
2. Yori press > Throw press > Lift press > Yori held.
3. losing same-participant inputs are dropped, not queued.

This must be User Play Tested because it determines control conflicts, but it is implementation-safe.

## Accepted ACTION-12B Integration

On GRAPPLED ticks with no Grip action startup/contest/transition:

- ACTION-12B WASD rotation remains unchanged.

During Grip-action startup:
- manual WASD rotation is paused so action direction/timing does not move under the contest.

During recovery:
- WASD rotation may resume under existing both-READY gate.

Transitions/Lifted own their movement.

No second pair-angle source of truth.

## Accepted State Ownership

The proposed ownership is architecturally acceptable:

- participant action: Grip action startup/recovery and post-Throw thrown state;
- pair-level gripTransition: Yori / Throw / same-direction pair shift execution;
- BoutEngagement: FREE / GRAPPLED / later LIFTED;
- BoutOutcome: ring-out / generic fall with Throw cause.

No global event bus, no duplicated Lift flag, no Phaser gameplay ownership.

## Accepted Implementation Split

Keep the split:

### ACTION-13B
Grip RPS foundation + Yori + Throw:
- semantic action inputs
- directional Best timing per RC-1
- Shift Release removal
- replace Drive with Yori
- Yori transition
- Throw normal -> FREE
- Throw Best -> Fall
- Morozashi effect framework
- Throw same-action contest
- ACTION-12B integration
- Heavy verification
- User Play Test.

### ACTION-14A
Lift + Lifted:
- Lift input
- complete Yori > Lift > Throw RPS row
- Lifted engagement state
- Lifted steering/carry
- expiry to GRAPPLED
- ring-out
- Heavy verification
- User Play Test.

13B Play Test is for foundation/Yori/Throw mechanics, not complete three-way balance.

## Required Verification Corrections

In addition to the ACTION-13A2 matrix, future tests must cover:

RC1-1 Yori starts first, Throw responds inside Best -> Throw Best/Fall.
RC1-2 Throw starts first, Yori arrives inside the same numerical window -> Throw Success, NOT Best.
RC1-3 Throw starts first, Lift responds inside Best -> Lift Best.
RC1-4 Lift starts first, Throw arrives inside window -> Lift Success, NOT Best.
RC1-5 Lift starts first, Yori responds inside Best -> Yori Best.
RC1-6 Yori starts first, Lift arrives inside window -> Yori Success, NOT Best.
RC1-7 exact same tick for each RPS pair -> winner Best.
RC1-8 winner response outside Best but overlapping startup -> Success.

RC2-1 cardinal canonical facings map own-left/right exactly.
RC2-2 arbitrary facing maps own-left/right from facing, not pair axis.
RC2-3 simultaneous Throw direction classification remains order-independent with small READY facing errors.
RC2-4 ACTION-12B rotation changes canonical facing; subsequent Throw direction follows the rotated facing.

D1 tests depend on User choice and must be written only after D1 is selected.

## User Play Test Required After Implementation

Still required for:

- hold-repeat Yori feel;
- startup/recovery rhythm;
- Best window;
- Yori movement amount;
- Throw lateral/release feel;
- post-Throw recovery/stagger;
- Morozashi magnitude;
- same-action contests;
- ACTION-12B rotation interaction.

## Do Not Reopen

Unless explicitly requested:

- base RPS Yori > Lift > Throw > Yori;
- no random Throw KO;
- Throw Best vs Yori = Fall;
- normal Throw -> FREE;
- Shift Release removed;
- Grip Best is not ParticipantPosture.kuzushi;
- future Grip ability/stat formulas remain undecided;
- ACTION-11N visual baseline;
- ACTION-12B no-action footwork semantics.

## Next Task Constraint

Do NOT register ACTION-13B until User Decision D1 is resolved.

After D1:
- update this Review Handoff with the selected Yori Best movement interpretation if needed;
- then create ACTION-13B from the accepted design + RC-1 + RC-2.
