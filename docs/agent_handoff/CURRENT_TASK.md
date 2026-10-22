Task-ID: ACTION-09A-KUZUSHI-SWEAT-VISUAL-GATE
Status: READY
Task-Type: PRESENTATION VISUAL EFFECT GATE
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 6c6a3f0cc2fcaffa2cef26d057713a8e783bf9c7
Review-Handoff: ACTION-08C technical review at 23ba65ed8e85893656eb0a3f000023304701bc90
Handoff-Mode: GITHUB

# ACTION-09A — Kuzushi Sweat Visual Gate

## Purpose

Make the existing Kuzushi gameplay state visually readable **without adding a dedicated Kuzushi wrestler sprite**.

For this first Visual Gate, add only a small procedural **sweat effect around the wrestler's head** while the existing presentation state is Kuzushi.

Do not add body wobble yet.
Do not add a new pose image.
Do not change Kuzushi gameplay.

Primary User question:

> Is a simple sweat effect enough to make "this wrestler is currently Kuzushi / off-balance" readable?

If not, a later Task may add a small body wobble or another symbol.

---

# Current Source Definition — Preserve Exactly

Kuzushi is already Simulation-owned as:

```
posture:
  stable
  | kuzushi { ticksRemaining }
```

Current constants / semantics:

- `KUZUSHI_TICKS = 30` (~0.5 s of full Kuzushi ticks)
- entering Kuzushi always cancels the current action to idle
- Kuzushi participant cannot start normal FREE actions
- effective movement input is zero / braking
- facing is frozen while Kuzushi
- Push received while Kuzushi uses `KUZUSHI_PUSH_SUSCEPTIBILITY = 1.5`
- normal gameplay momentum/ring-out rules continue
- a valid Grip on a Kuzushi target consumes Kuzushi and gives the gripper Morozashi
- Counter Fail puts the Counter user into Kuzushi
- Counter catching Tsuppari puts the Tsuppari attacker into Kuzushi in place
- Tsuppari 6th successful hit puts the receiver into Kuzushi
- Push Counter success puts the pusher into Kuzushi.

Do not alter any of the above.

---

# Important CounterTransition Semantics

Push Counter Success / Best has special existing timing.

When the pusher is caught:

- pusher enters Kuzushi
- CounterTransition starts
- during the ~1.5 s CounterTransition, the pusher's Kuzushi timer is paused
- after transition completion, a fresh full `KUZUSHI_TICKS = 30` is started again.

Therefore a simple presentation rule:

```
show effect whenever WrestlerVisualState.pose === 'kuzushi'
```

will intentionally keep the effect visible during the CounterTransition and then through the post-transition Kuzushi window.

Do NOT add a special exception for CounterTransition in this Task.

The User will judge whether this duration reads correctly.

---

# Existing Presentation State

Current pure presentation already exposes:

```
WrestlerVisualState.pose === 'kuzushi'
WrestlerVisualState.kuzushiStrength
```

Current meaning of `kuzushiStrength`:

```
1.0  = fresh/full Kuzushi
...
0.0  = about to recover
```

derived from:

```
ticksRemaining / KUZUSHI_TICKS
```

Use this existing state.

Do not derive Kuzushi from raw input or scene state.

Architecture remains:

```
BoutSimulation / Snapshot
-> WrestlerVisualState
-> pure Kuzushi effect parameters
-> Phaser WrestlerView presentation
```

---

# Visual Effect — First Gate

Use the existing wrestler art unchanged.

Add **two simple procedural sweat drops** around the head.

No external PNG asset is required.

Preferred visual language:

- pale cyan / light blue sweat
- high contrast enough to read on the current arena
- one larger drop and one smaller drop
- stylized teardrop / comic-sweat shape
- no text
- no stars
- no exclamation mark
- no red damage flash.

The intention is:

```
"sweating / under pressure / balance broken"
```

not:
- stun
- damage
- KO
- attack impact.

This is a Prototype Visual Gate; exact colour/shape remains provisional until User Play Test.

---

# Placement

Place the effect in **wrestler-local geometry**, not fixed screen-up geometry.

Use canonical participant facing.

Suggested local offsets in units of body radius R:

```
large drop:
  forward = +0.90 R
  lateral = +0.62 R

small drop:
  forward = +0.78 R
  lateral = -0.58 R
```

where:
- local +X = wrestler FRONT
- local +Y = wrestler RIGHT.

Convert local offsets to world/canvas coordinates using canonical `participant.facing`.

Do not use the Counter's presentation-only +/-35° body offset for the sweat placement.

Reason:
- Kuzushi is its own visual state
- canonical facing is Simulation-owned
- the effect should stay anchored to the wrestler/head region rather than inherit unrelated Counter presentation motion.

If Current Product geometry shows these suggested offsets place the drops materially away from the head:
- adjust the local offsets minimally
- report the final R-relative values
- do not add asset-specific magic pixel coordinates.

---

# Size

Suggested provisional sizes, in R:

```
large drop:
  width  ~0.20 R
  height ~0.34 R

small drop:
  width  ~0.15 R
  height ~0.26 R
```

Keep them readable at the 1920x1080 logical resolution without covering the wrestler.

Do not make the effect larger than the head/body silhouette.

---

# Strength / Fade

Use `kuzushiStrength` directly as the main effect alpha.

Required:

```
alpha = clamp(kuzushiStrength, 0, 1)
```

So:

- newly entered Kuzushi -> full sweat visibility
- post-transition ordinary Kuzushi -> gradually fades as recovery approaches
- final Kuzushi state with strength near 0 -> nearly/fully invisible
- stable -> effect hidden.

Do not use wall-clock time.

Do not use render delta.

Do not add a presentation timer.

Do not add pulsing/bobbing in this Task.

Reason:
- the first Gate should isolate whether the state marker itself is useful
- a frozen bout should not have an independently moving effect.

---

# Rendering

Keep implementation small and explicit.

Preferred options:

- a tiny generated Phaser texture for one sweat-drop shape, reused for both drops, or
- two small Phaser Graphics objects owned by WrestlerView.

Do not add an effect framework.

Do not add a generic particle system.

Recommended depth:

```
body = existing depth 2
Kuzushi sweat = depth 3
HUD/debug = existing higher layers
```

The effect should render above wrestler bodies and below normal HUD/debug UI.

---

# Preferred Pure Helper

Prefer a small pure presentation helper, for example:

```
src/game/presentation/kuzushiVisualEffect.ts
```

It may expose data such as:

```ts
interface KuzushiSweatVisual {
  visible: boolean
  alpha: number
  drops: readonly [
    { forwardR: number; lateralR: number; widthR: number; heightR: number },
    ...
  ]
}
```

or an equivalent small explicit shape.

The helper must:

- depend only on `WrestlerVisualState`
- be Phaser-free
- return hidden / alpha 0 outside Kuzushi
- use `kuzushiStrength` without inventing gameplay state.

Do not create a generic status-effect abstraction.

---

# WrestlerView Integration

WrestlerView should:

- keep current idle/Tsuppari/Counter Product body selection unchanged
- keep Counter 35° presentation rotation unchanged
- add/update/hide two sweat objects based on the pure Kuzushi visual data
- position sweat from canonical participant center/facing and body radius R
- never alter body position, scale, pivot, texture, or canonical facing because of the sweat effect.

The sweat is an overlay only.

---

# Scope

## In Scope

- pure Kuzushi sweat-effect parameters
- two procedural sweat marks
- strength-based fade
- local-R placement around the head
- rendering for both red and blue wrestlers
- CounterTransition compatibility
- focused tests
- browser smoke
- User Visual Gate.

## Scope Out

Do NOT:

- add a Kuzushi sprite
- modify Product wrestler PNGs
- modify Tsuppari PNGs
- modify Counter PNGs
- change Counter 35° motion
- add body wobble
- add body rotation for Kuzushi
- add translation/scale animation
- add stars / exclamation marks
- add particles
- add sound
- change Kuzushi gameplay
- change Kuzushi duration
- change Push susceptibility
- change Grip/Morozashi behavior
- change CounterTransition
- update WRESTLER_PRODUCT_ART_SPEC as Accepted
- modify PROJECT_HANDOFF.md.

---

# Required Scenario Coverage

The effect must correctly follow all existing ways Kuzushi can appear.

At minimum verify:

## A. Counter Fail

```
Counter expires
-> Counter user enters Kuzushi
-> sweat appears full
-> fades across the ~0.5 s Kuzushi
-> disappears on recovery
```

## B. Counter catches Tsuppari

```
Tsuppari attacker enters Kuzushi in place
-> sweat appears on attacker
-> Counter user does not get sweat
```

## C. Tsuppari 6th-hit Kuzushi

```
receiver enters Kuzushi
-> sweat appears on receiver
```

## D. Push Counter Success / Best

```
pusher enters Kuzushi
-> sweat appears
-> remains full while CounterTransition pauses Kuzushi timer
-> after transition, fresh 30-tick Kuzushi starts
-> sweat then fades with kuzushiStrength
```

## E. Grip consumes Kuzushi

```
valid Grip on Kuzushi target
-> Kuzushi consumed
-> Morozashi engagement begins
-> sweat disappears immediately
```

Do not change gameplay to make these scenarios easier to render.

---

# Tests

At minimum verify:

1. non-Kuzushi visual state -> sweat hidden / alpha 0
2. fresh Kuzushi -> visible / alpha 1
3. half remaining -> alpha ~0.5
4. near recovery -> alpha approaches 0
5. no wall-clock/render-delta input is used
6. local drop geometry is deterministic
7. world placement rotates correctly with canonical participant facing
8. red and blue use the same effect semantics
9. Counter body rotation logic remains unchanged
10. Tsuppari/Counter/idle body art selection remains unchanged
11. body texture/pivot/scale metadata unchanged
12. Counter Fail path drives effect correctly
13. Counter-caught Tsuppari path drives effect correctly
14. Tsuppari 6th hit drives effect correctly
15. Push Counter transition keeps effect while Kuzushi timer is paused
16. Grip consumption removes effect
17. src/game/sumo and src/game/input have no semantic changes.

Do not weaken existing tests.

---

# Verification

Verification Level:
Standard Presentation Visual Gate

Required:

- focused pure Kuzushi visual tests
- focused `wrestlerVisualState` tests
- relevant Counter / Tsuppari / Grip gameplay regression tests
- existing Product presentation tests
- `pnpm test`
- `pnpm build`
- `git diff --check`
- browser/runtime smoke
- prove `src/game/sumo/` and `src/game/input/` unchanged
- prove idle/Tsuppari/Counter Product asset hashes unchanged.

---

# Browser / Runtime Smoke

Required.

Verify at least:

1. pre-bout / Enter works
2. ordinary stable wrestler has no sweat
3. Counter Fail shows sweat on the failed Counter user
4. sweat is near the head and follows canonical facing
5. alpha decreases as ordinary Kuzushi recovers
6. Push Counter Success / Best shows sweat on the pusher during CounterTransition
7. Counter user does not incorrectly receive the effect
8. effect remains positioned correctly while the pair moves through CounterTransition
9. after transition, effect fades through the fresh 30-tick Kuzushi
10. Grip consuming Kuzushi removes the effect if practical to observe in smoke
11. Tsuppari / Counter Product poses remain unchanged
12. Counter 35° motion remains unchanged
13. Push / Grip / movement gameplay unchanged
14. R restart clears the effect
15. no console errors.

Capture screenshots for:
- fresh ordinary Kuzushi
- about half-recovered Kuzushi
- CounterTransition pusher Kuzushi.

---

# User Visual Gate

REQUIRED.

Primary question:

> Does the sweat overlay make Kuzushi immediately readable without needing a dedicated wrestler sprite?

Judge:

- sweat is visible enough at gameplay scale
- sweat placement feels attached to the head/wrestler
- effect does not look like damage/KO/stun
- effect is not visually noisy
- full-strength display during CounterTransition is acceptable
- fade during the post-transition 0.5 s recovery feels understandable
- red and blue are equally readable
- existing Tsuppari / Counter visuals remain clear.

If sweat alone is insufficient:
- next Task may test **sweat + very small body wobble**
- do not add that wobble inside ACTION-09A.

---

# Documentation

Do not add this Visual Gate to the Accepted Product-art section yet.

It is acceptable to add a short provisional note to `docs/ARCHITECTURE.md` only if needed to describe Current Source truthfully.

Do not update `WRESTLER_PRODUCT_ART_SPEC.md` as Accepted until User acceptance.

---

# Stop Conditions

STOP if:

- implementing the effect requires Kuzushi gameplay changes
- a new Simulation state/timer is required
- CounterTransition semantics need modification
- body Product assets need modification
- effect placement requires hard-coded per-PNG pixel offsets rather than R-relative presentation geometry
- a generic particle/status-effect framework becomes necessary
- Current Source materially conflicts with this Task.

---

# Completion Report

Include:

- Result
- final sweat shape/render method
- final R-relative offsets/sizes
- alpha rule
- changed files
- scenario coverage A-E
- focused/full verification
- browser smoke screenshots/results
- proof gameplay unchanged
- proof Product art assets unchanged
- Design Deviations
- Unexpected Scope
- User Visual Gate: REQUIRED
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

`feat(presentation): add kuzushi sweat visual gate`

Do not modify:

- `main`
- `PROJECT_HANDOFF.md`
- `CURRENT_TASK.md`.

# Final Instruction

Add only a presentation-only Kuzushi sweat overlay.

Use the existing `pose === 'kuzushi'` and `kuzushiStrength`.

Do not add a Kuzushi sprite or body wobble yet.
Keep all gameplay and accepted Product art unchanged.
