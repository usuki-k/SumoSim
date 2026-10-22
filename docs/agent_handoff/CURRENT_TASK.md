Task-ID: ACTION-08B-COUNTER-PRESENTATION-ROTATION-GATE
Status: READY
Task-Type: PRESENTATION MOTION VISUAL GATE
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 592cbd86988fd9270ab03c7f0a04993b11ae2bfa
Review-Handoff: ACTION-08A1 implementation is current at 592cbd86988fd9270ab03c7f0a04993b11ae2bfa; User Play Test found the static Counter pose still insufficiently differentiated from Tsuppari
Handoff-Mode: GITHUB

# ACTION-08B — Counter Presentation Rotation Visual Gate

## Purpose

Make 引き・捌き / Counter visually distinct from Tsuppari by adding a short **presentation-only body rotation animation** to the current provisional Counter pose.

The User Play Test result for the current static Counter image is:

- the image itself is more sabaki-like than earlier candidates
- but a static sprite swap still reads too similarly to Tsuppari at game scale.

For this Task, keep the current Counter candidate art and gameplay unchanged.

Add only:

```
0° -> max 35° -> 0°
```

during the existing Counter window.

This is a Visual / Game Feel Gate.
Technical PASS does not mean the motion is accepted until User Play Test.

---

# Current Accepted / Preserved Baseline

Do not reopen or retune:

- Counter gameplay
- COUNTER_WINDOW_TICKS = 12
- Counter Best / Success / Fail
- Counter vs Push
- Counter vs Tsuppari
- CounterTransition side/rear movement
- Kuzushi
- ArrowDown binding
- input priority
- Push / Tsuppari gameplay
- TSUPPARI_HAND_REACH = 0.55 m
- permanent idle Product art
- permanent four Tsuppari Product textures.

Current Counter Visual-Gate art remains the current source/runtime candidate from ACTION-08A1:

```
public/assets/action/wrestler/counter-gate/red.png
public/assets/action/wrestler/counter-gate/blue.png
```

Do not regenerate or modify those PNGs in this Task.

---

# Architecture

Keep:

```
BoutSimulation / Snapshot
-> WrestlerVisualState
-> pure Presentation motion calculation
-> WrestlerView
```

Simulation owns:
- Counter state
- ticksRemaining
- results / transitions.

Presentation owns:
- extra temporary visual rotation only.

Do NOT:
- change participant.facing
- write presentation rotation back into Simulation
- derive motion from raw keyboard state
- add a new gameplay action/state
- add a Scene-owned timer.

---

# Counter Progress

Current `WrestlerVisualState.phaseProgress` is already used for other timed visual poses.

For Counter, populate it from the existing Simulation-owned Counter action:

```ts
progress(action.ticksRemaining, COUNTER_WINDOW_TICKS)
```

Import/reuse `COUNTER_WINDOW_TICKS`.

Do not add a Counter-specific stored timer.

The value remains presentation-derived from current canonical action state.

---

# Rotation Motion

Maximum absolute visual rotation:

```
35 degrees
```

Use radians internally:

```
35 * Math.PI / 180
```

The curve must be deterministic and symmetric:

```
offsetMagnitude = sin(PI * phaseProgress) * 35°
```

Intent:

- beginning of Counter: near 0°
- middle of Counter window: 35°
- end of Counter window: back near 0°
- leaving Counter state: exactly 0° because no Counter visual offset applies.

Do not use render delta or wall-clock time.

---

# Rotation Direction

Because blue Counter art is the local-Y reflection of red, apply opposite signs so both wrestlers visually sweep **away from the forward strike line** rather than one becoming more attack-forward.

Use:

```
red  Counter visual offset = +magnitude
blue Counter visual offset = -magnitude
```

where magnitude is the 0..35° curve above.

This sign convention is presentation-only.

Do not change the actual canonical facing.

If Current Source inspection proves these signs rotate the accepted candidate toward the forward/Tsuppari line rather than away from it:
- STOP
- report with concrete visual/vector evidence
- do not silently flip the design.

---

# Preferred Small Implementation

Keep this explicit and small.

Preferred:

- extend `wrestlerVisualState.ts` so Counter has meaningful `phaseProgress`
- add a pure function in the current Counter presentation module, e.g.:

```ts
counterVisualRotationOffset(id, state): number
```

- `WrestlerView` applies:

```ts
participant.facing + counterVisualRotationOffset(...)
```

to the **body sprite only**.

Do not build a generic animation/easing framework.

Do not add a Global Event Bus or pose timeline system.

---

# Shadow

Keep the current procedural shadow behavior unchanged.

The extra Counter body rotation is a pose/presentation effect.

Do not add the +/-35° offset to Simulation facing.

Do not add extra Counter translation in this Task.

No lateral position offset yet.

Reason:
- this Task isolates whether rotation alone solves the differentiation problem.

If rotation is insufficient, lateral visual offset may be evaluated in a separate User-directed Task.

---

# Counter Success / Best

Do not extend the rotation with a new timer after Counter resolves.

If a Push is caught and the existing Counter action ends:
- Counter visual offset stops
- existing CounterTransition begins exactly as today.

No changes to:
- transition path
- transition duration
- side/rear target
- stagger
- Kuzushi.

A snap back caused by an early successful catch is acceptable for this Visual Gate and must be judged by User Play Test.

Do not solve it preemptively by adding new state.

---

# Tsuppari Distinction Goal

The intended visual language is now:

## Tsuppari

```
forward-directed hand strike
body facing remains canonical
```

## Counter / 引き・捌き

```
lateral-sweep Counter pose
+
whole body visibly turns sideways up to 35°
+
returns toward canonical facing
```

At game scale, the motion direction itself should distinguish Counter from Tsuppari.

---

# Scope

## In Scope

- Counter `phaseProgress` derived from existing Counter ticks
- pure presentation rotation calculation
- max 35° visual rotation
- mirrored sign by red/blue Product wrestler id
- WrestlerView body rotation integration
- focused tests
- browser/runtime visual smoke
- User Play Test.

## Scope Out

Do NOT:

- change Counter image assets
- change Counter exporter / recipe / mask rules
- change Counter gameplay
- change CounterTransition
- add position offset
- add scale animation
- add camera animation
- add impact animation
- change Tsuppari
- change Push
- change idle art
- add multi-frame sprites
- add a generic animation framework
- update permanent Counter Product-art SPEC
- modify PROJECT_HANDOFF.md.

---

# Tests

At minimum verify:

1. non-Counter states have rotation offset exactly 0
2. Counter progress is derived from `COUNTER_WINDOW_TICKS`
3. offset magnitude follows the specified sine curve
4. maximum is 35° at/around the midpoint represented by the tick sequence
5. red and blue have equal magnitude / opposite sign
6. rotation depends only on canonical visual state + wrestler art id
7. Snapshot / participant.facing is unchanged
8. Tsuppari art selection and body rotation remain unchanged
9. idle/move/Push/Grip remain unchanged
10. Counter art is still selected only during Counter
11. current CounterTransition gameplay tests remain unchanged
12. `src/game/sumo/` and `src/game/input/` have no semantic modification.

Do not weaken existing tests.

---

# Verification

Verification Level:
Standard Presentation / Game Feel Gate

Required:

- focused `wrestlerVisualState` / Counter presentation tests
- existing Counter gate presentation tests
- relevant Counter gameplay tests
- `pnpm test`
- `pnpm build`
- `git diff --check`
- browser/runtime smoke
- prove `src/game/sumo/` and `src/game/input/` unchanged
- prove Counter PNG hashes unchanged
- prove idle and Tsuppari Product assets unchanged.

---

# Browser / Runtime Smoke

Required.

Verify:

1. Enter starts Bout
2. ArrowDown still starts the same Counter action
3. blue Counter body visibly turns in the specified mirrored direction
4. red Counter body turns the opposite mirrored direction
5. peak observed rotation is approximately 35°
6. body rotates around the explicit sprite pivot / canonical participant center
7. no visual position or scale translation is added
8. participant.facing in Snapshot does not change because of the effect
9. Counter whiff / Fail gameplay remains unchanged
10. Push Counter Success / Best remains unchanged
11. CounterTransition side/rear movement remains unchanged
12. Tsuppari remains unrotated by this effect
13. Push / Grip / movement remain unchanged
14. R restart works
15. no console errors.

Capture representative screenshots/measurements at:
- early Counter
- near peak
- late Counter

for both blue and red if practical.

---

# User Play Test

REQUIRED.

Primary question:

> Does the 35° body-sabaki rotation make ArrowDown clearly distinguishable from Tsuppari?

Judge:

- Counter now looks like a body sabaki / receiving motion
- 35° is enough / too much / too little
- red and blue both read naturally
- rotation direction feels correct
- idle -> Counter motion is not distracting
- early Success / Best snap-back is acceptable
- existing side/rear CounterTransition still reads correctly
- Tsuppari remains clearly a forward strike.

Do not permanently accept the Counter image/motion until the User says it is acceptable.

---

# Stop Conditions

STOP if:

- achieving the rotation requires Simulation gameplay changes
- participant.facing would need to be changed
- CounterTransition would need semantic changes
- current Counter image/runtime assets must be regenerated
- red/blue mirrored sign cannot be determined consistently from Current Source
- a generic animation framework becomes necessary
- Current Source materially conflicts with this Task.

---

# Completion Report

Include:

- Result
- exact max angle
- exact rotation curve
- red / blue sign convention
- Counter progress derivation
- changed files
- proof participant.facing / Simulation unchanged
- focused/full tests
- browser smoke
- representative observed rotation values
- Counter/Transition regression result
- Design Deviations
- Unexpected Scope
- User Play Test: REQUIRED
- Git delivery.

If none:

```
Design Deviations: NONE
```

---

# Git Delivery

Follow `AGENTS.md`.

Normal successful Task:

- stage Task-owned files only
- one implementation commit
- fetch / fast-forward safety
- push `origin/develop`
- verify remote SHA
- clean working tree.

Suggested commit:

`feat(presentation): animate counter body rotation`

Do not modify:

- `main`
- `PROJECT_HANDOFF.md`
- `CURRENT_TASK.md`.

# Final Instruction

Add only a presentation-only Counter body rotation:

```
0° -> 35° -> 0°
```

with mirrored red/blue direction.

Keep Counter gameplay, CounterTransition, assets, position, scale and canonical facing unchanged.
