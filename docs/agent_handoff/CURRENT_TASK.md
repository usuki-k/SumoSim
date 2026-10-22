Task-ID: ACTION-11B-GRIP-LUNGE-CONTEST-INVESTIGATION
Status: READY
Task-Type: INVESTIGATION ONLY / CORE GAMEPLAY / GRIP MOVEMENT + ACTION CONTEST
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 89b2d631bdd74b65f93558678f24b1b599165f4a
Review-Handoff: ACTION-11A technical review at 03d6045cf67ff94ec0ccb2a6f8682f5c38b58681; Grip attempt art remains provisional Visual Gate
Handoff-Mode: GITHUB

# ACTION-11B — Grip Lunge + Four-Way Contest Investigation

## Purpose

Investigate the next Grip gameplay design before implementation.

User-approved direction:

1. Shift / Grip should no longer look like a stationary range check.
2. On Shift, the wrestler should show the existing Grip-attempt pose while making a **short committed forward lunge**.
3. Grip success should come from that forward attempt reaching / contacting the opponent.
4. Target lunge travel should be roughly comparable to the **old pre-ACTION-10B Push self-travel**, approximately 0.10–0.13 m.
5. Push / Tsuppari / Grip / Counter should form a readable main four-way interaction cycle:

```
Push > Tsuppari > Grip > Counter > Push
```

6. The two diagonal relationships should preserve the currently proposed/accepted direction:

```
Push > Grip
Counter > Tsuppari
```

7. Same-action interactions should preserve their current identities unless evidence shows a conflict:
   - Push vs Push: contest / net Push force cancellation
   - Tsuppari vs Tsuppari: mutual hit when both hit
   - Grip vs Grip: neutral grapple
   - Counter vs Counter: neither attacks; both may eventually fail into Kuzushi.

This Task is **Investigation Only / No Production Fixes**.

Do not modify Production source/tests/specs.
Do not implement the contest system yet.

The output must recommend one concrete ACTION-11C implementation design.

---

# Important Definition: "Simultaneous"

Do NOT define contest by "both buttons were pressed on the same input tick".

Different actions have different startup / reach / movement timing.

For this investigation, define an interaction from the **logical tick on which their gameplay effects actually meet**.

Examples:

- Push: body contact while Push impact can open / is active
- Tsuppari: Tsuppari hit tick while target is in reach
- Grip: Grip lunge/reach tick that reaches the opponent under the proposed success boundary
- Counter: Counter window active when a catchable opponent effect arrives.

The final design must remain deterministic and fixed-step.

No wall-clock / render-frame rule.

---

# Current Source Baseline — Confirm First

Inspect Current Source before experimenting.

Expected current Grip baseline:

```
GRIP_REACH_TICKS = 6
GRIP_RECOVERY_TICKS = 12
GRIP_RANGE_MARGIN = 0.09 m
BODY_RADIUS = 0.35 m
```

Current success distance:

```
2 * BODY_RADIUS + GRIP_RANGE_MARGIN
= 0.79 m
```

Current behavior:

- Grip starts only in FREE + idle + stable
- Grip reach has no intentional self-movement
- Grip success can occur on the same Simulation tick as the Shift press if already in range
- that same-tick success can skip every rendered attempt-pose frame
- target must currently be action idle for unilateral Grip success
- both reaching / stable / in range -> neutral grapple
- Kuzushi target -> Morozashi and Kuzushi consumed
- whiff -> Grip recovery
- Grip success -> grapple, both actions idle.

Current FREE resolution order is approximately:

```
contact
-> Push impact opening
-> Counter
-> Grip
-> Push/Tsuppari forces
-> action timers
```

Confirm the exact Current Source truth.

---

# User Problem to Solve

ACTION-11A technically works, but Current Gameplay can immediately consume Grip reach on the press tick.

Result:

```
Shift
-> same-tick grapple
-> no Grip attempt visual frame
```

The User considers this visually wrong.

The intended new feel is:

```
Shift
-> Grip attempt pose is visibly entered
-> short forward lunge
-> opponent interaction
-> contest result
-> Grip success or failure
```

The investigation must solve this without making presentation own gameplay timing.

---

# Grip Lunge Travel Target

Target self-travel from a stationary wrestler in open space:

```
approximately 0.10–0.13 m
```

Reference from old Push:

- old active-only Push self travel: approximately 0.100 m
- old full Push movement including recovery coast: approximately 0.1267 m.

Do not treat exactly 0.100 or 0.1267 as mandatory.

The lunge should feel like:

> one short committed step to get hands onto the opponent

not:
- current 24-tick Push charge
- homing movement
- teleport
- large tackle.

---

# Grip Lunge Candidate Investigation

Compare at least these approaches.

## Candidate A — Extend Grip reach and use existing grounded movement

Use press-time facing direction and the existing movement model during Grip reach.

Evaluate at least:

```
6 ticks
8 ticks
9 ticks
10 ticks
```

Rough expectations only:

- 6 ticks: ~0.058 m
- 8 ticks: ~0.100 m
- 9 ticks: ~0.125 m
- 10 ticks: ~0.153 m

Measure exact Current movement behavior.

Assess:
- target travel
- total action duration
- readability of ACTION-11A attempt pose
- recovery timing
- dodge / counterplay
- whether changing reach duration materially affects Grip balance.

## Candidate B — Keep current reach duration, add Grip-specific lunge tuning

Keep `GRIP_REACH_TICKS = 6` but add a Grip-specific movement speed/acceleration rule sufficient to reach the target distance.

Evaluate:
- required tuning value
- motion feel / peak speed
- extra constants
- whether it becomes too instantaneous
- architecture cost.

Prefer not to add a new movement formula unless there is a clear gameplay reason.

## Candidate C — Separate Grip telegraph/startup from lunge/reach

Small explicit phases, for example:

```
attempt startup
-> lunge/reach
-> recovery
```

Do not implement.

Evaluate whether a separate short startup is necessary to guarantee the attempt pose is perceptible, especially from already-contacting starts.

Avoid generic state-machine abstraction.

---

# Direction / Facing

Investigate the smallest natural rule.

Preferred hypothesis:

- Grip lunge direction is captured from canonical facing at Shift press
- lunge does not home toward a sidestepping opponent
- canonical facing stays on the committed lunge direction during the lunge/reach
- after recovery/idle, normal facing resumes.

Compare against continuing the current per-tick face-opponent behavior.

Report whether facing-tracking would visually or mechanically create hidden homing.

Do not add a second presentation-facing Source of Truth.

---

# Grip Success Boundary

The User said:

> Shiftキーの前進で敵と接触したら掴みになる。

Investigate changing Grip success from the current 0.79 m margin range to an **actual body-contact-driven success**.

Compare:

## Boundary A — Existing Grip range

```
distance <= combined radius + 0.09 m
```

## Boundary B — Existing circle contact

Use the same contact result / geometry already owned by Simulation.

Primary question:

> Does actual contact better match the new lunge/attempt visual and reduce "grab from visible gap" behavior?

Measure any consequences for:
- neutral Grip
- Kuzushi -> Morozashi
- Grip vs Grip
- ring-edge behavior
- glancing contact.

Do not create a bespoke Grip collider.

---

# Minimum Visible Attempt / Immediate-Contact Problem

This is a required investigation point.

If Shift is pressed while the wrestlers are already touching, a pure "contact means success immediately" rule can still produce:

```
press tick
-> success
-> no visible attempt pose
```

The next implementation must avoid the original ACTION-11A problem.

Compare at least:

## Telegraph A — success allowed on the press tick

Baseline/reference only.
Expected to fail the visual goal.

## Telegraph B — a newly-started Grip cannot succeed until at least the next logical tick

No render timer.
The press-tick Snapshot must remain Grip attempt.

## Telegraph C — explicit short minimum attempt/startup commitment

A small fixed Simulation duration before Grip can resolve success.

Investigate a minimal range such as:

```
2–4 ticks
```

before success eligibility.

Evaluate:
- visual readability
- input responsiveness
- contest fairness
- whether a new Grip startup phase is justified.

Recommend exactly one rule for ACTION-11C.

Do not choose based only on code simplicity; the attempt pose must be actually perceivable.

---

# Four-Way Main Contest

User-approved main cycle:

```
Push > Tsuppari > Grip > Counter > Push
```

Interpretation:

## Push > Tsuppari

Preserve current accepted semantics unless evidence requires change:

- during Push impact/contact, Tsuppari may contribute its existing coupled effect
- Push normally remains the stronger forward contest
- do not automatically cancel Tsuppari merely to make the table visually symmetric.

Report the exact current outcome.

## Tsuppari > Grip

NEW desired relationship.

If a Grip attempt/lunge would succeed on the same logical interaction where an opponent Tsuppari hit reaches the gripper:

- Tsuppari wins
- Grip must fail
- no grapple should be entered from that Grip.

Investigate the smallest failure consequence:
- recommended hypothesis: cancel Grip into existing Grip recovery
- compare against immediate idle / Kuzushi only if needed.

Do not add Kuzushi as a punishment unless explicitly justified and recommended for User decision.

## Grip > Counter

NEW desired relationship.

If a valid Grip lunge/contact reaches an opponent whose Counter window is active:

- Grip wins
- Counter does not catch Grip
- grapple is entered
- Counter action is cancelled by grapple entry.

Investigate whether the losing Counter should:
- simply be cancelled into grapple (preferred hypothesis)
- or receive any Counter-fail Kuzushi penalty.

Do NOT assume a timeout-fail Kuzushi should occur when the Counter was actively beaten by Grip.
Recommend the smallest coherent rule.

## Counter > Push

Preserve current accepted Push-Counter semantics:
- only Push impact + contact is catchable
- Best / Success timing from impact
- pusher enters Kuzushi
- CounterTransition remains unchanged.

---

# Diagonal Contest Relationships

These are also User-approved as the proposed direction.

## Push > Grip

A Grip lunge colliding with a Push should not grab through the Push.

Investigate exact trigger:
- Push no-contact charge before impact
- same tick body contact opens Push impact
- Grip success would also be possible.

Preferred result on actual collision:
- Push wins the contest
- Grip fails
- existing Push impact proceeds.

Determine whether Grip should enter normal Grip recovery.

Do not let resolver call order accidentally decide this.

## Counter > Tsuppari

Preserve current accepted behavior:
- Counter window catches Tsuppari on its hit tick when in reach
- Tsuppari attacker enters Kuzushi
- no Tsuppari impulse/buildup change
- no CounterTransition.

Do not redesign.

---

# Same-Action Relationships

Preserve unless a measured conflict is found.

## Push vs Push
- both impact windows can open
- net Push force can cancel
- ordinary contact/self movement remains.

## Tsuppari vs Tsuppari
- both hits can resolve
- both can be pushed apart
- existing buildup/Kuzushi rules remain.

## Grip vs Grip
- if both valid attempts reach on the same interaction, enter neutral grapple
- no arbitrary participant-order winner.

## Counter vs Counter
- no offensive interaction to catch
- windows proceed independently
- if untouched, both may expire into Kuzushi.

---

# Required Full Pair Matrix

The Completion Report must include the final recommended matrix for all unordered pairs:

| Pair | Recommended Result | Trigger Tick | Loser/Follow-up State |
|---|---|---|---|
| Push / Push | | | |
| Push / Tsuppari | | | |
| Push / Grip | | | |
| Push / Counter | | | |
| Tsuppari / Tsuppari | | | |
| Tsuppari / Grip | | | |
| Tsuppari / Counter | | | |
| Grip / Grip | | | |
| Grip / Counter | | | |
| Counter / Counter | | | |

Also include:
- Idle / Grip
- Kuzushi / Grip

for completeness of Grip success semantics.

Do not use vague "A wins" only.
Specify actual state/result:
- force
- impulse
- Grip recovery
- grapple neutral
- Morozashi
- Kuzushi
- CounterTransition
etc.

---

# Contest Resolution Architecture

Current resolver order must not be the accidental owner of the four-way rules.

Investigate the smallest explicit Pure TypeScript design.

Preferred direction:

- derive tick-local interaction facts from canonical action/contact/hit state
- resolve explicit pair contests before applying mutually incompatible results
- keep existing specialized formulas (Push force, Tsuppari impulse, CounterTransition, Grip grapple) in their current owners where possible.

Possible small shapes:

- a pure `resolveFreeActionContest` / `freeActionContest` helper returning a small outcome
- a small explicit pairwise function/table for only these four actions
- explicit contest guards around existing resolvers.

Do NOT propose:
- generic Rule Engine
- ECS
- event bus
- extensible combat framework.

Compare at least:

1. keep current resolver order + ad hoc exceptions
2. one small explicit pair-contest helper.

Recommend one.

Primary requirement:

> Changing function call order later must not silently change who wins Tsuppari vs Grip or Grip vs Counter.

---

# Interaction Timing Cases

For each new relationship, test/measure timing offsets, not just exact same press.

At minimum:

## Tsuppari vs Grip

Test Grip press relative to Tsuppari press/hit such that:
- Grip begins earlier
- both gameplay effects meet on same tick
- Tsuppari hit occurs just before Grip would succeed
- Grip would succeed just before Tsuppari hit under naive resolver order.

Determine one deterministic rule from the actual effect tick.

## Grip vs Counter

Test:
- Counter already open before Grip press
- Grip already lunging before Counter press
- their relevant windows overlap only at contact.

Grip should win when the valid Grip interaction occurs during the Counter window.

## Push vs Grip

Test:
- Push starts earlier
- Grip starts earlier
- both contact on same tick
- Grip reaches Push during Push startup vs Push impact-opening tick.

The final rule must state whether a Push in startup is already "winning Push" or only an actual Push impact wins.

Do not leave this implicit.

---

# Same-Participant Input Priority

Current same-participant input priority is:

```
Push > Tsuppari > Counter > Grip
```

This is separate from cross-participant contest.

Do not change it in ACTION-11B.

Investigate only cross-participant Action interaction.

If the proposed four-way contest would require changing same-participant priority:
- report it as a conflict
- do not silently redesign input priority.

---

# Kuzushi Interaction

Preserve ACTION-09B:

```
valid Grip on Kuzushi
-> Morozashi
-> Kuzushi consumed
```

With Grip lunge, verify:
- no Kuzushi consumption during approach
- only actual successful Grip consumes it
- Tsuppari/Push defeating the Grip attempt does not accidentally consume target Kuzushi
- Grip success boundary change (range -> contact if recommended) still preserves Morozashi semantics.

Do not change 90 ticks or 1.5x follow-up rules.

---

# Grip Attempt Art

ACTION-11A remains a provisional Visual Gate.

Current attempt texture selection:

```
pose === 'grip'
&& gripPhase === 'reach'
```

The investigation should assess how each proposed Grip timing/lunge design affects visible attempt duration.

Do not:
- modify the art
- promote it to Product
- add Grip success art
- add hand-marker VFX.

The User's current complaint is gameplay timing, not the attempt image itself.

---

# Measurement Requirements

## Current Grip baseline

Report:

- success distance
- press-to-success ticks when already in current range
- reach duration
- recovery duration
- self travel
- attempt-visible Simulation snapshots for:
  - already-in-range start
  - just-out-of-range start
  - whiff.

## Lunge candidates

For each viable candidate report:

- reach/startup/lunge tick counts
- open-space self travel
- peak self speed
- total Grip action duration on whiff
- earliest success tick
- minimum guaranteed attempt-state duration before success
- distance from which stationary opponent can be reached
- no-homing behavior.

## Contact boundary

Compare existing 0.79 m range vs actual circle contact with measured examples.

---

# Verification / Investigation Scenarios

Use deterministic Pure Simulation scratch experiments.

At minimum cover:

1. Grip vs idle
2. Grip vs Kuzushi
3. Grip vs moving idle target
4. Grip vs Grip
5. Grip vs Counter
6. Grip vs Tsuppari
7. Grip vs Push startup
8. Grip vs Push impact
9. Push vs Tsuppari existing behavior
10. Counter vs Tsuppari existing behavior
11. Push vs Counter existing behavior
12. Push vs Push
13. Tsuppari vs Tsuppari
14. Counter vs Counter
15. participant array order swapped for every symmetric/new pair where relevant.

For the new contest pairs, run timing sweeps around the interaction tick.

---

# Ring-Out / Collision

Grip lunge should use ordinary Simulation movement/contact.

Investigate whether the short lunge can itself:
- cause ring-out
- create unwanted contact correction
- move an opponent before grapple entry.

Do not add:
- Grip-specific collider
- wall/clamp
- teleport.

If current `enterGrapple` bond correction causes a visible positional snap after a lunge, measure it and report it.

Do not fix in Investigation.

---

# Recommended ACTION-11C Output

The Completion Report must recommend exactly one implementation design including:

## Grip timing
- exact startup / reach / lunge / recovery ticks
- earliest success tick
- guaranteed attempt visibility rule.

## Grip movement
- direction ownership
- facing ownership
- movement rule
- expected travel.

## Success boundary
- actual contact vs existing margin range.

## Contest matrix
- all 10 action pairs
- Idle/Kuzushi Grip outcomes.

## Failure consequences
Explicitly define what happens to losing Grip in:
- Grip loses to Tsuppari
- Grip loses to Push.

Explicitly define what happens to losing Counter in:
- Counter loses to Grip.

## Resolver architecture
- exact recommended helper / call-order concept
- how it avoids participant/resolver-order dependence.

## Preservation
State exactly how existing:
- Push
- Tsuppari
- Counter
- Kuzushi
- Grip/Drive/Grapple
are preserved outside the newly approved interactions.

---

# Scope

## In Scope

- Grip lunge measurement/design
- attempt visibility timing
- success boundary investigation
- full four-action pair matrix
- Tsuppari > Grip
- Grip > Counter
- Push > Grip
- existing diagonal/same-action preservation
- explicit contest-resolution architecture
- timing sweeps
- ACTION-11C recommendation.

## Scope Out

Do NOT:

- modify BoutSimulation.ts
- modify BoutTypes.ts
- modify production tests
- change Grip attempt art
- implement Grip success art
- implement hand VFX
- change Push tuning
- change Tsuppari tuning
- change Counter tuning
- change Kuzushi tuning
- change Grapple/Drive
- change same-participant input priority
- update WRESTLER_PRODUCT_ART_SPEC
- fix unrelated stale docs
- modify PROJECT_HANDOFF.md.

Scratch files outside committed source are allowed for deterministic measurement.

---

# Stop Conditions

STOP and report if:

- the approved main cycle cannot be made deterministic without a broad combat framework
- Grip > Counter materially conflicts with accepted CounterTransition architecture
- Tsuppari > Grip cannot be resolved without changing Tsuppari's accepted hit semantics
- short Grip lunge requires changing global movement tuning
- guaranteeing a visible attempt pose requires presentation-owned time
- actual contact success cannot preserve Grip/Morozashi semantics
- same-participant input priority would have to change
- Current Source materially conflicts with User-approved direction.

Do not silently broaden scope.

---

# Verification Level

Heavy Investigation / No Production Fixes.

Required:

- Current Source inspection
- deterministic baseline measurements
- all lunge candidates
- current range vs contact comparison
- full 10-pair matrix
- timing sweeps for Push/Grip, Tsuppari/Grip, Grip/Counter
- participant-order checks
- Kuzushi/Morozashi preservation
- ring-out/contact/bond-snap observations
- no Production changes
- `git diff --check`.

No User Play Test is required for ACTION-11B because it is Investigation Only.

---

# Completion Report

Include:

- Result
- Current Source findings
- current Grip baseline table
- lunge candidate table
- attempt-visibility comparison
- range vs contact comparison
- full pair matrix
- timing sweep results
- participant-order findings
- resolver architecture comparison
- exact recommended ACTION-11C design
- rejected alternatives
- Production Changes: NONE
- Design Deviations
- Unexpected Scope
- User Decisions Required, if any
- Git delivery.

Expected:

```
Production Changes: NONE
```

---

# Git Delivery

Follow `AGENTS.md`.

Investigation Only.

Allowed committed repository change:

```
docs/agent_handoff/CURRENT_COMPLETION_REPORT.md
```

only.

Do not modify Production source/tests/docs/specs.

Normal Investigation delivery:

- stage Completion Report only
- one report commit
- fetch / fast-forward safety
- push `origin/develop`
- verify remote SHA
- clean working tree.

Suggested commit:

`docs(investigation): analyze grip lunge contest rules`

Do not modify:

- `main`
- `PROJECT_HANDOFF.md`
- `CURRENT_TASK.md`.

# Final Instruction

Investigate, do not implement.

Find the smallest deterministic Pure TypeScript design that:

- makes Shift visibly enter the Grip-attempt pose
- moves the wrestler forward roughly 0.10–0.13 m
- resolves Grip success from the committed attempt reaching the opponent
- guarantees the attempt is perceptible even from immediate-contact starts
- implements the User-approved interaction direction:

```
Push > Tsuppari > Grip > Counter > Push
```

with:

```
Push > Grip
Counter > Tsuppari
```

while preserving current same-action identities and avoiding resolver-order-dependent outcomes.
