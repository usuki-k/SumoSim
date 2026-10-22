Task-ID: ACTION-10A-PUSH-CHARGE-INVESTIGATION
Status: REVIEWED
Task-Type: INVESTIGATION ONLY / CORE MOVEMENT-COLLISION-PUSH
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 0897776142e854c0a91bc5a79ed6db25426a93ba
Review-Handoff: ACTION-09B accepted by User Play Test; Kuzushi 90-tick / one-follow-up baseline is current
Handoff-Mode: GITHUB

# ACTION-10A — Push Charge / Straight-Line Tackle Investigation

## Purpose

Investigate how to change ArrowUp / Push into a longer, committed straight-line charge that feels closer to an American-football tackle / sumo forward rush while preserving the current Push impact as much as possible.

User goal:

- pressing ArrowUp commits the wrestler to the direction they are facing at press time
- charge travel should be roughly **3x the current Push self-travel**
- the opponent should be able to read the charge and evade it with ordinary left/right Move
- no homing / retargeting during the charge
- if the charge misses, the attacker continues forward through the commitment
- near the dohyo edge, a missed charge should naturally be able to carry the attacker out of the ring
- this self-ring-out risk is desirable and should emerge from ordinary movement + ring-out rules.

This Task is **Investigation Only / No Fixes**.

Do not modify Production gameplay, presentation, constants, SPEC, or Product art.

The output must recommend a concrete implementation design for a later ACTION-10B Task.

---

# User-Approved Direction

The following direction is accepted for investigation:

```
ArrowUp press
-> lock charge direction from current facing
-> committed straight-line forward charge
-> defender may sidestep with ordinary Move
-> contact may produce Push
-> miss continues forward
-> near edge, miss may self-ring-out
-> recovery
```

Do not introduce:
- dodge invulnerability
- special evade action
- homing
- target snapping
- auto-correction toward the opponent.

Avoid solving this with a bespoke "tackle collision" if the existing Simulation circle contact can support it.

---

# Current Baseline to Confirm

Inspect Current Source before measuring.

Expected current Push baseline:

```
PUSH_STARTUP_TICKS = 6
PUSH_ACTIVE_TICKS = 8
PUSH_RECOVERY_TICKS = 10

FORWARD_ACCELERATION = 10 m/s^2
MAX_SPEED = 3 m/s
STOP_DECELERATION = 24 m/s^2
```

Current intended structure:

- Push is accepted only from FREE + idle + stable
- Push stores `direction = facing` at action start
- startup: steering suppressed / braking
- active: `effectiveMove` uses the stored direction
- recovery: steering suppressed / braking
- Push force is applied only while active + actual contact
- Push force uses `PUSH_EXTERNAL_ACCELERATION = 26.25 m/s^2`
- ordinary circle contact owns hit/contact
- ring-out is ordinary center-based Simulation ring-out
- no wall/clamp prevents a participant from moving out.

Confirm, do not assume.

---

# Important Current Facing Question

Current Source appears to lock Push **movement direction**, but FREE `updateFacing()` still points each stable wrestler toward the opponent every tick, including during Push.

Investigate this explicitly.

Question:

> If the defender sidesteps, does the charger's sprite/canonical facing rotate toward the defender while the charger's actual movement continues along the original locked Push direction?

If yes, assess whether this materially harms the intended straight-line / committed-charge readability.

Do NOT fix it in ACTION-10A.

Recommend the smallest later solution, comparing at least:

1. freeze canonical facing during Push
2. derive Push presentation orientation from the already canonical stored Push direction
3. leave current facing behavior unchanged.

Evaluate architecture / gameplay implications of each.

Do not create a duplicate facing Source of Truth.

---

# Baseline Measurement

Measure current Push from a stationary attacker in open space with no contact.

Report exact deterministic values for:

1. displacement during startup
2. displacement during active
3. residual/coasting displacement during recovery
4. total attacker center displacement from Push acceptance until action returns idle
5. peak selfVelocity
6. exact tick count.

Use Simulation measurements, not visual estimates.

The rough expectation from the current grounded model is:

- active-only displacement ~0.10 m
- full action displacement including recovery ~0.13 m.

These are expectations only.
Report measured Current Source truth.

---

# Target

User target:

> roughly 3x the current Push movement distance.

For investigation, define the primary metric as:

```
stationary attacker
+ open space
+ no contact
+ displacement from Push acceptance until Push returns idle
```

Target band:

```
approximately 2.7x – 3.3x current full-action displacement
```

Also report active/charge-only displacement separately.

Do not treat exactly 3.000x as mandatory.

---

# Candidate 14-Tick Hypothesis

Evaluate the previously proposed small hypothesis:

```
startup = 6 ticks
active/charge movement = 14 ticks
recovery = 10 ticks
existing grounded acceleration/speed/braking
```

Do not commit this value.

Measure it in a scratch harness / temporary local experiment.

Expected rough values:

- active/charge-only travel ~0.29 m
- full-action travel including braking ~0.38 m
- approximately 3x current full Push travel.

Confirm or reject with exact Simulation measurements.

---

# Core Design Problem: Movement Duration vs Push Force Duration

Do NOT assume that extending `PUSH_ACTIVE_TICKS` is the final design.

Today the same `active` phase owns both:

1. committed forward self-movement
2. contact Push force / Counter / Push-vs-Tsuppari active semantics.

Simply changing:

```
PUSH_ACTIVE_TICKS: 8 -> ~14
```

would therefore also lengthen the time during which:

- contact Push force is applied
- Counter can catch an active Push
- Push-vs-Push can cancel
- Push-vs-Tsuppari uses active-Push coupling.

This may materially change gameplay beyond the requested travel distance.

The investigation must quantify these side effects.

---

# Compare Implementation Options

Evaluate at least these three approaches.

## Option A — Extend Existing Active Phase

```
startup 6
active ~14
recovery 10
```

Same active state owns movement + Push force.

Evaluate:
- simplicity
- free-space travel
- contact shove distance
- Counter timing
- Tsuppari coupling
- dodgeability
- self-ring-out risk.

## Option B — Longer Charge Movement, Preserve a Shorter Push-Force Window

Preferred hypothesis to investigate.

Conceptually:

```
startup
-> committed charge movement
-> contact/impact Push force with bounded duration comparable to current Push
-> recovery
```

The exact state representation is NOT yet decided.

Investigate the smallest explicit Simulation design that can separate:

```
how long the attacker moves forward
from
how long contact Push force is applied
```

without:
- Scene timers
- generic state machine frameworks
- duplicated movement state
- hidden wall-clock timing.

Possible shapes may include:
- a distinct Push charge/impact phase
- an explicit force-window counter within Push state
- another small state representation.

Do not choose based only on code elegance; prefer smallest semantics that preserve accepted systems.

## Option C — Keep 8 Active Ticks, Increase Charge Acceleration/Speed

Keep current short duration but increase self-motion enough to approach 3x travel.

Evaluate:
- whether the resulting motion looks/feels too instantaneous
- defender reaction / sidestep opportunity
- edge self-ring-out behavior
- whether a new Push-only acceleration/speed constant would be needed.

The user prefers a readable committed rush, so this option should only be recommended if it genuinely supports that goal.

---

# Stationary Contact Force Comparison

For Current Baseline and each viable candidate, measure a representative Push starting from ordinary body contact against a stable stationary receiver.

Report:

- attacker displacement
- receiver displacement
- pair displacement
- receiver peak external velocity
- number of force-producing ticks
- final displacement after Push returns idle.

Primary question:

> Can we get ~3x attacker charge travel without accidentally making the current Push shove ~3x stronger/longer?

If Option A materially increases shove strength/distance, quantify it.

Do not retune `PUSH_EXTERNAL_ACCELERATION` during investigation.

---

# Lateral Dodge Investigation

Use existing ordinary Move only.

No dodge-specific state.

Test deterministic scenarios where the attacker commits straight ahead and the defender moves perpendicular to the charge line.

At minimum test center separations:

```
0.80 m
0.90 m
1.00 m
1.10 m
```

or explain any adjusted set that better matches current body radius/contact geometry.

For viable charge candidates, test defender lateral movement beginning at least at:

1. same tick Push is accepted / perfect read
2. first charge/active tick (after startup)
3. 3 ticks after charge/active begins
4. 6 ticks after charge/active begins.

For each, report:

- whether body contact occurs
- first contact tick if any
- minimum center distance
- defender lateral displacement at closest approach
- whether Push force occurs
- whether attacker continues past the defender on a miss.

Do not define a special "dodge success radius".
Use existing circle contact only.

Goal:

> A visibly read straight charge should have real sidestep outcomes using current Move, while late reactions may still be hit.

Do not force all tested reactions to succeed.

---

# No-Homing Verification

For a sidestepping defender, record:

- stored Push direction
- attacker selfVelocity direction
- attacker path
- participant.facing.

Prove whether movement itself remains locked to the press-time direction.

If facing rotates but trajectory does not, separate those facts in the report.

---

# Whiff / Forward Pass-By

Test a defender that moves fully out of the charge path.

Required outcome for the target design:

- no contact
- no Push force
- attacker still completes committed forward movement
- attacker does not stop merely because the target moved away
- recovery happens after the committed charge according to the proposed design.

If current mechanics prevent this, identify the exact cause.

---

# Edge Self-Ring-Out Investigation

This is a desired gameplay possibility.

Using existing ring-out rules only, test missed outward-facing charges near the dohyo edge.

For Current Baseline and viable candidates, determine:

- starting center distance from the ring boundary at which a whiff can carry the attacker OUT
- tick of boundary crossing
- whether crossing occurs during charge/active or recovery/coast
- whether ordinary `resolveArenaRingOut` correctly declares the loss
- whether Tokudawara introduces any special concern.

Do not add an artificial "self ring-out" rule.

Desired architecture:

```
missed committed movement
-> ordinary center crosses allowed arena boundary
-> existing ring-out system resolves loss
```

Also test that an inward-facing or safely central whiff does not produce a false ring-out.

---

# Interaction Risks to Quantify

## Counter

Current Counter catches:

```
opponent Push active
+ actual contact
```

Investigate how each candidate changes:

- Best timing
- Success timing
- late contact after a longer run-up
- total catchable active duration.

Do not redesign Counter in this Task.

Preferred later implementation should preserve the accepted Counter result/transition semantics.

## Push vs Tsuppari

Current coupling depends on an active Push in contact.

Quantify whether extending the active phase enlarges the coupled interaction window.

Do not retune Tsuppari.

## Push vs Push

Confirm consequences for simultaneous/opposing Push cancellation if the active duration changes.

## Kuzushi

Preserve ACTION-09B:

- first Push force on Kuzushi gets 1.5x
- Kuzushi is then consumed
- later force ticks are 1.0x.

Verify any candidate remains compatible.

---

# Ring-Out / Collision Architecture

Preserve:

```
Pure TypeScript Simulation
-> positions / contact / result
-> Snapshot
-> Phaser presentation
```

Do not propose Phaser Physics as a shortcut unless Current Source proves pure Simulation cannot support the requirement.

Do not move collision or ring-out ownership into the Scene.

Do not add a wall or auto-brake at the ring edge; the desired self-ring-out depends on ordinary movement continuing.

---

# Scope

## In Scope

- Current Push movement measurements
- current facing-vs-locked-direction inspection
- ~3x travel candidates
- Option A / B / C comparison
- contact shove side-effect measurements
- lateral dodge simulations
- no-homing proof
- forward miss/pass-by behavior
- edge self-ring-out simulations
- Counter / Tsuppari / Push-vs-Push / Kuzushi interaction analysis
- concrete ACTION-10B recommendation.

## Scope Out

Do NOT:

- modify `BoutSimulation.ts`
- modify tests as Production changes
- change constants
- change Push art/animation
- add tackle sprite
- add camera shake
- add sound
- add stamina
- add special dodge state
- change Counter
- change Tsuppari
- change Kuzushi
- change Grip
- change ring-out rules
- change Tokudawara geometry
- fix the stale ARCHITECTURE Grip sentence from ACTION-09B
- modify PROJECT_HANDOFF.md.

Scratch scripts/tests that are not committed are allowed for measurement.

---

# Required Investigation Output

Completion Report must include:

## 1. Current Baseline Table

At minimum:

| Metric | Current |
|---|---:|
| startup ticks | |
| active ticks | |
| recovery ticks | |
| active-only self travel | |
| recovery/coast travel | |
| total free-space Push travel | |
| peak self speed | |
| force-producing ticks in contact | |

## 2. Candidate Comparison

At minimum:

| Metric | Current | Option A | Option B | Option C |
|---|---:|---:|---:|---:|
| free-space total travel | | | | |
| ratio vs current | | | | |
| charge duration | | | | |
| contact force duration | | | | |
| stationary receiver displacement | | | | |
| sidestep readability | | | | |
| self-ring-out possible | | | | |
| architecture complexity | | | | |

If an option is rejected before full simulation, explain why with evidence.

## 3. Dodge Matrix

For the required separation / reaction-delay combinations:
- HIT / MISS
- first contact tick
- closest distance
- lateral displacement.

## 4. Edge Matrix

For representative boundary distances:
- IN / OUT
- crossing tick
- phase at crossing.

## 5. Facing Finding

State clearly:

- movement direction behavior
- canonical facing behavior
- visual consequence
- recommended ownership for later fix, if needed.

## 6. Interaction Findings

Counter / Tsuppari / Push-vs-Push / Kuzushi.

## 7. Recommended ACTION-10B Design

Recommend exactly one implementation direction.

Specify:

- proposed Push state shape
- exact candidate timing values
- movement rule
- force window rule
- facing rule
- contact behavior
- miss behavior
- recovery behavior
- ring-out behavior
- expected travel distance
- why it is the smallest safe design.

List rejected alternatives and why.

---

# Verification

Verification Level:
Heavy Investigation / No Production Fixes

Required:

- deterministic pure-Simulation measurements
- all requested free-space measurements
- all requested lateral-dodge scenarios
- all requested edge/ring-out scenarios
- current contact shove baseline
- viable candidate contact shove measurements
- Counter interaction analysis
- Push-vs-Tsuppari interaction analysis
- Push-vs-Push interaction analysis
- ACTION-09B Kuzushi compatibility analysis
- inspect both normal circle ring and Tokudawara implications
- `git diff --check`
- prove no Production source changes.

Do not report Overall PASS if required matrices are incomplete.

No User Play Test is required for ACTION-10A because this is Investigation Only.

---

# Stop Conditions

STOP and report if:

- ~3x self-travel cannot be achieved without materially changing unrelated movement globally
- ordinary circle contact cannot support lateral evasion
- current ring-out architecture prevents natural self-ring-out
- the desired behavior requires new physics middleware
- the minimal design would materially change accepted Counter/Kuzushi semantics and no isolated alternative exists
- Current Source materially conflicts with the User-approved direction.

Do not silently broaden scope.

---

# Completion Report

Include:

- Result
- Current Source findings
- baseline measurements
- Option A/B/C measurements
- dodge matrix
- whiff/pass-by result
- edge self-ring-out matrix
- facing finding
- interaction risks
- recommended ACTION-10B exact design
- rejected alternatives
- Production Changes: NONE
- Design Deviations
- Unexpected Scope
- Git delivery.

Expected:

```
Production Changes: NONE
```

---

# Git Delivery

Follow `AGENTS.md`.

This is Investigation Only.

Allowed committed repository change:

- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md` only.

Do not modify Production source/tests/docs/specs.

Normal delivery:

- stage Completion Report only
- one investigation/report commit
- fetch / fast-forward safety
- push `origin/develop`
- verify remote SHA
- clean working tree.

Suggested commit:

`docs(investigation): analyze push charge movement`

Do not modify:

- `main`
- `PROJECT_HANDOFF.md`
- `CURRENT_TASK.md`.

# Final Instruction

Investigate, do not implement.

Find the smallest deterministic Simulation design that makes ArrowUp a roughly 3x-longer committed straight-line charge, allows ordinary lateral Move to evade it, preserves Push impact semantics as much as possible, and naturally allows a missed outward charge to self-ring-out through the existing ring-out system.


---

# ChatGPT Review Handoff

Review-Date: 2026-10-23
Overall Result: PASS — INVESTIGATION COMPLETE / USER DECISION REQUIRED BEFORE ACTION-10B
Accepted Investigation Baseline: 2480fb71951028e6c2e109efb3764c9c4419a24a

## Production Change Review

Confirmed:

- ACTION-10A made no Production source/test/spec changes
- only CURRENT_COMPLETION_REPORT.md changed
- Investigation Only scope was respected.

Production Changes: NONE

## Accepted Findings

The investigation is sufficient to proceed to a design decision.

Current measured Push baseline from stationary / open-space / no-contact:

- startup: 6 ticks
- active: 8 ticks
- recovery: 10 ticks
- active-only self travel: 0.100000 m
- recovery/coast travel: 0.026667 m
- full Push travel: 0.126667 m
- peak self speed: 1.333333 m/s
- contact force duration: 8 ticks
- representative contact shove: 0.5325 m.

The User's requested ~3x travel target is reproduced by the 14-tick charge candidate:

- full travel: 0.3861 m
- ratio: 3.05x.

## Accepted Architecture Recommendation

Option B is the accepted recommendation for the next implementation design:

```
Push press
-> startup
-> committed straight charge using press-time direction
-> first contact opens a bounded 8-tick impact window
-> impact window owns Push force / Counter tier timing
-> if no contact, charge runs to its charge limit
-> recovery
```

Key ownership remains Simulation-side.

Do not use:
- Phaser Physics
- homing
- dodge state
- special tackle collision
- ring-edge wall / clamp.

Existing circle contact and ring-out are sufficient.

## Why Option A Is Rejected

Simply extending the current active phase couples longer movement with longer Push force.

Measured result at 14 ticks:

- receiver shove grows from 0.5325 m to ~0.957 m
- receiver external speed reaches the existing clamp
- Counter catch duration expands
- Push/Tsuppari coupled duration expands.

This is not a movement-only change.

## Why Option C Is Rejected

Keeping 8 ticks and raising Push-specific acceleration reaches ~3x travel but:

- reaches 3 m/s within the short 133 ms active window
- at 0.8 m, even the earliest ordinary lateral Move test can still be hit
- does not produce a readable committed rush
- still cannot naturally self-ring-out from a valid opponent-facing start.

## Lateral Dodge Finding

Existing ordinary Move + existing circle contact are sufficient for dodge outcomes.

No special dodge mechanic is needed.

For viable longer-charge candidates:

- early lateral reactions can miss
- later reactions can be hit
- the attacker remains on the original stored Push direction
- a miss continues forward through the committed charge.

This directly supports the intended read / evade interaction.

## Facing Finding

Current Push movement direction is already locked at press time.

However canonical participant.facing continues to track the sidestepping opponent during Push, producing a visual sideways-slide mismatch.

Accepted recommendation for ACTION-10B:

- freeze canonical facing for the participant for the entire Push action (startup through recovery)
- keep Simulation as the sole facing owner
- do not create a separate presentation-facing truth.

This is preferred over deriving a different sprite orientation in Phaser.

## Ring-Out Finding / Required User Decision

A material geometric constraint was correctly identified.

Because Push direction is initially toward the opponent, and the two centers must be at least approximately 0.70 m apart, a total travel of only ~0.386 m cannot carry the attacker beyond a still-in-ring opponent and across the boundary after a whiff.

Therefore these two goals cannot both be achieved with the same charge distance:

### Choice A — ~3x travel

```
PUSH_CHARGE_TICKS = 14
full open-space travel ~= 0.386 m
current ratio ~= 3.05x
```

Pros:
- matches the original ~3x request
- early sidestep can evade
- current Push impact can remain bounded to 8 ticks.

Cons:
- a normal opponent-facing whiff cannot naturally self-ring-out.

### Choice B — natural whiff self-ring-out

```
PUSH_CHARGE_TICKS = 24
full open-space travel ~= 0.938 m
current ratio ~= 7.41x
```

Pros:
- early sidestep can evade
- near-edge outward whiff can naturally carry attacker OUT through existing ring-out
- no special self-ring-out rule is needed
- contact Push impact can still remain bounded to 8 ticks.

Cons:
- substantially longer than the original ~3x request.

The User must choose the charge-length priority before ACTION-10B is finalized.

## Interaction Clarification

The report's phrase that Option B keeps Counter / Push-vs-Tsuppari / Push-vs-Push "completely the same" must be interpreted narrowly.

Accepted meaning:

- once the impact window begins, the force window length and existing impact semantics can remain at the current 8 ticks
- contact-start fixtures can reproduce the current shove / Counter tier timing / Kuzushi behavior.

Not identical globally:

- the longer charge reaches distances the current Push cannot reach
- therefore Counter, Tsuppari coupling and Push-vs-Push encounters can now occur from previously unreachable starting separations
- the report's matrices correctly show these new encounter opportunities.

This is an expected consequence of increasing charge reach, not an Investigation failure.

## Counter Recommendation

For ACTION-10B, if Option B is chosen:

- Counter should catch only while the impact window is active and actual contact exists
- Best / Success tier timing should be measured from impact-window start / first contact, not from the beginning of the long charge
- existing Counter result / Kuzushi / CounterTransition semantics remain unchanged.

This preserves the meaning of "Counter the impact" rather than penalizing a longer run-up.

## Kuzushi Preservation

ACTION-09B remains compatible.

At contact-start fixtures, Option B preserves:

- first Push force on Kuzushi = 1.5x
- Kuzushi consumed that tick
- later force ticks = 1.0x.

Do not redesign Kuzushi in ACTION-10B.

## Tokudawara / Ring-Out

Existing ring-out architecture is sufficient.

Tokudawara only changes the local allowed radius; no special Push rule is required.

Do not introduce:
- edge braking
- auto-clamp
- Push-specific ring-out logic.

## Verification Review

Accepted investigation coverage includes:

- deterministic Current baseline measurement
- Option A / B / C
- additional B18 / B20 / B24 / B28 edge candidates
- 4 separation x 4 reaction timing dodge matrix
- no-homing trace
- pass-by / whiff
- normal ring + Tokudawara edge matrix
- Counter timing sweep
- Push-vs-Tsuppari timing sweep
- Push-vs-Push
- ACTION-09B Kuzushi compatibility
- clean Production diff.

Heavy Investigation requirement is satisfied.

## Next Task Constraint

Do not create ACTION-10B until the User selects the charge-length direction:

- 14 ticks / ~3.05x travel
or
- 24 ticks / ~7.41x travel with natural near-edge self-ring-out.

All other major ACTION-10B design choices may use the accepted Option B recommendation above.

No User Play Test was required for ACTION-10A because it was Investigation Only.
