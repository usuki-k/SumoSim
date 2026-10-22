Task-ID: ACTION-09B-KUZUSHI-FOLLOWUP-WINDOW
Status: REVIEWED
Task-Type: CORE GAMEPLAY IMPLEMENTATION / KUZUSHI SEMANTICS
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 45a3916a0480d870239024f1645ec3754cab5ca4
Review-Handoff: ACTION-09A sweat Visual Gate implemented at 45a3916a0480d870239024f1645ec3754cab5ca4; User Play Test accepted sweat as sufficient Kuzushi readability
Handoff-Mode: GITHUB

# ACTION-09B — Kuzushi 1.5s Follow-up Window

## Purpose

Redefine the existing Kuzushi state from a short ~0.5 s vulnerability into a slower, clearer **maximum 1.5 s follow-up opportunity that is consumed by the first successful follow-up action**.

User direction:

- game speed should be slower
- Kuzushi should last at least 1.0–1.5 s
- use **1.5 s** for this implementation
- once a Kuzushi participant actually receives one successful follow-up action, Kuzushi ends
- Push against Kuzushi gets the existing 1.5x benefit
- Tsuppari against Kuzushi must now also get a 1.5x impulse
- valid Grip against Kuzushi keeps the existing Morozashi benefit and consumes Kuzushi.

This is a gameplay semantic change.
Treat as Core Gameplay.

Do NOT redesign Counter / Tsuppari / Grip beyond the Kuzushi interaction explicitly described here.

---

# Accepted Visual Baseline

ACTION-09A sweat is accepted by User Play Test as sufficient Kuzushi readability.

Preserve:

- no dedicated Kuzushi wrestler sprite
- current procedural sweat effect
- current R-relative placement
- current alpha driven by `kuzushiStrength`
- no body wobble.

The longer Kuzushi duration should naturally make the existing sweat persist longer.

Do not redesign the sweat in this Task.

---

# New Accepted Kuzushi Definition

Kuzushi becomes:

> A maximum 1.5-second vulnerable posture state.  
> The next successful Push, Tsuppari, or valid Grip follow-up receives its Kuzushi benefit and consumes the state immediately.  
> If no qualifying follow-up arrives, Kuzushi expires naturally after 1.5 seconds.

Use:

```
KUZUSHI_TICKS = 90
```

at the current fixed 60 Hz:

```
90 ticks = 1.5 s
```

The existing entry-tick timing rule remains:

- entering Kuzushi later in a tick does not spend one of the 90 full Kuzushi ticks
- countdown starts on the following progressing tick.

---

# Kuzushi Entry — Preserve Existing Sources

Do not change what causes Kuzushi.

Existing sources remain:

1. Counter Fail
   - failed Counter user enters Kuzushi
2. Counter catches Push
   - pusher enters Kuzushi
3. Counter catches Tsuppari
   - Tsuppari attacker enters Kuzushi in place
4. Tsuppari buildup
   - 6th successful Tsuppari hit puts receiver into Kuzushi.

All these now use the new full 90-tick duration.

---

# One Successful Follow-up Consumes Kuzushi

A Kuzushi participant remains Kuzushi until either:

```
A. timer expires
or
B. first qualifying successful follow-up is resolved
```

Qualifying follow-ups are exactly:

- Push that actually applies Push force to the Kuzushi participant
- successful Tsuppari hit on the Kuzushi participant
- valid Grip success on the Kuzushi participant.

Non-events do NOT consume Kuzushi:

- Push startup
- Push recovery
- active Push without contact
- equal opposing Pushes that produce no received Push force
- Tsuppari whiff
- Grip whiff / out of range
- ordinary body contact
- movement/contact correction
- external momentum decay
- Counter input itself
- waiting.

Do not add a separate "consumed" flag.
The existing `posture.kind === 'kuzushi'` is sufficient:
- snapshot/capture whether the participant was Kuzushi before the qualifying effect
- apply the benefit
- then set posture to stable.

Keep the invariant:

```
kuzushi => action idle
```

---

# Push Follow-up

Existing behavior:

```
KUZUSHI_PUSH_SUSCEPTIBILITY = 1.5
```

currently makes received Push acceleration 1.5x while Kuzushi.

New semantics:

- first actual Push force tick against a Kuzushi receiver uses **1.5x**
- after that force is applied, Kuzushi is immediately consumed
- remaining active Push ticks, if any, use normal 1.0x.

Because the mechanic now applies to more than Push, prefer renaming the tuning constant to a clear generic name, for example:

```
KUZUSHI_FOLLOWUP_FORCE_MULTIPLIER = 1.5
```

or an equivalently clear explicit name.

If renamed:
- update all current tests/docs
- do not keep two independently owned 1.5 constants.

Do not change `PUSH_EXTERNAL_ACCELERATION`.

Important:
- only the Push component receiving the Kuzushi benefit should be multiplied
- do not blindly multiply unrelated pair-force contributions.

---

# Tsuppari Follow-up

New behavior:

If the receiver is already Kuzushi **before the successful Tsuppari hit is resolved**:

```
received Tsuppari impulse
= TSUPPARI_IMPULSE * 1.5
```

Current:

```
TSUPPARI_IMPULSE = 2.13 m/s
```

so the initial expected boosted impulse is:

```
3.195 m/s
```

subject to the existing external-speed clamp.

After applying the boosted Tsuppari hit:
- consume the receiver's existing Kuzushi
- receiver becomes stable unless the same hit independently creates a fresh Kuzushi under an existing rule.

Do NOT change:
- Tsuppari reach
- startup / active / recovery
- cooldown
- buildup threshold
- ordinary hit impulse
- Countered-Tsuppari semantics.

---

# Critical Ordering: Kuzushi-Generating Hit vs Follow-up Bonus

Preserve the meaning:

> The attack that creates a new Kuzushi does not receive the new Kuzushi bonus from the state it is creating.

Example:

```
stable target
-> 6th Tsuppari hit
-> normal Tsuppari impulse
-> target enters fresh 90-tick Kuzushi
```

The 6th hit itself is not multiplied by 1.5.

However, if the receiver was **already Kuzushi before that hit**, then:
1. the hit gets the 1.5x follow-up bonus
2. the old Kuzushi is consumed
3. if the hit also satisfies the existing 6th-hit rule, it creates a new fresh 90-tick Kuzushi afterward.

This preserves the existing independent buildup rule while making consumption deterministic.

Add an explicit boundary test for this case.

---

# Grip Follow-up

Keep the existing Grip/Kuzushi semantics.

A valid Grip on a Kuzushi target:

```
range / normal Grip validity passes
-> Kuzushi consumed
-> target stable
-> gripper becomes Morozashi holder
```

This is the Grip Kuzushi benefit.

Do NOT invent a numeric "1.5x Grip" value; Grip has no current force magnitude to multiply.

Invalid / out-of-range / whiff Grip does not consume Kuzushi.

Keep:

```
Kuzushi never bypasses Grip range
```

---

# CounterTransition

Preserve the existing Push-Counter transition semantics.

Push Counter Success / Best:

```
pusher enters Kuzushi
-> CounterTransition ~1.5 s
-> pusher Kuzushi timer remains paused during transition
-> no normal follow-up actions resolve during transition
-> transition completes
-> pusher receives a fresh full KUZUSHI_TICKS state
```

With this Task:

```
fresh post-transition Kuzushi = 90 ticks = 1.5 s
```

Do not remove the existing fresh restart at transition completion.

The first successful Push / Tsuppari / valid Grip after transition then consumes the new Kuzushi according to the rules above.

Do not change:
- COUNTER_TRANSITION_TICKS
- path
- side/rear targets
- input lock
- stagger
- ring-out behavior.

---

# Sweat / kuzushiStrength

Keep presentation derivation:

```
kuzushiStrength = ticksRemaining / KUZUSHI_TICKS
```

With `KUZUSHI_TICKS = 90` this means:

- fresh Kuzushi: strength 1
- after ~45 consumed ticks: ~0.5
- near timeout: approaches 0
- successful follow-up consumption: immediately leaves Kuzushi, so sweat disappears immediately.

During CounterTransition:
- timer remains paused at full Kuzushi
- sweat remains full
- after transition, fresh 90-tick Kuzushi begins and then fades.

Do not add presentation exceptions.

---

# Determinism / Resolution Direction

Consumption must not depend on participant iteration order.

Resolve each qualifying interaction from the state that exists before its effect, then consume after applying the Kuzushi benefit.

Do not introduce randomness.

Do not use frame/render timing.

Keep gameplay fixed-step.

---

# Architecture Constraints

Keep:

```
Pure TypeScript Simulation
-> Snapshot / posture
-> WrestlerVisualState
-> Sweat Presentation
```

Kuzushi rules belong in `src/game/sumo/`.

Do not put:
- force multiplier decisions
- consumption decisions
- duration decisions

into Phaser / Scene / presentation.

---

# Scope

## In Scope

- `KUZUSHI_TICKS: 30 -> 90`
- genericize/rename the existing 1.5 follow-up multiplier if appropriate
- Push first-follow-up consumption
- Tsuppari 1.5x-on-Kuzushi and consumption
- Grip consumption preservation/coverage
- ordering for 6th-hit/new-Kuzushi case
- CounterTransition post-transition duration update
- tests
- ARCHITECTURE documentation
- sweat regression verification
- User Play Test.

## Scope Out

Do NOT:

- change Kuzushi entry sources
- change Counter window
- change CounterTransition duration/path
- change Push base force
- change Tsuppari base impulse/reach/timing/cooldown
- change Tsuppari buildup threshold
- change Grip range
- change Morozashi mechanics
- change ring-out
- add mass/stamina/balance systems
- redesign sweat
- add Kuzushi sprite
- add body wobble
- change Product art
- modify PROJECT_HANDOFF.md.

---

# Required Boundary Cases

All cases below are required; do not sample.

## Duration

D1. Counter Fail enters full 90-tick Kuzushi.

D2. Kuzushi lasts 90 full progressing ticks if untouched.

D3. Exactly after expiry, participant is stable before normal input acceptance.

D4. `kuzushiStrength` tracks the new 90-tick duration correctly.

## Push

P1. Kuzushi + real active Push contact:
- first Push force tick uses 1.5x
- Kuzushi consumed after that force.

P2. Next active Push force tick is normal 1.0x.

P3. Push startup does not consume.

P4. Push active without contact does not consume.

P5. Push recovery does not consume.

P6. Equal/cancelled opposing Push with no received Push force does not consume Kuzushi.

## Tsuppari

T1. Kuzushi receiver + successful Tsuppari:
- impulse is 1.5x
- Kuzushi consumed.

T2. Following ordinary Tsuppari is normal 1.0x.

T3. Tsuppari whiff does not consume.

T4. Stable receiver's 6th hit:
- ordinary 1.0x impulse
- fresh Kuzushi created.

T5. Already-Kuzushi receiver hit by an attacker's 6th hit:
- old Kuzushi gives 1.5x to this hit
- old Kuzushi consumed
- existing 6th-hit rule creates fresh full 90-tick Kuzushi
- attacker buildup resets.

T6. Counter-caught Tsuppari existing semantics remain unchanged.

## Grip

G1. Valid in-range Grip on Kuzushi:
- Kuzushi consumed
- Morozashi holder assigned as before.

G2. Out-of-range Grip does not consume.

G3. Grip reach expiry/whiff does not consume.

G4. Kuzushi still does not bypass Grip range.

## Counter / Transition

C1. Counter Fail uses 90 ticks.

C2. Counter-caught Tsuppari attacker uses 90 ticks.

C3. Push Counter catch still starts existing transition.

C4. Pusher remains Kuzushi during transition with timer paused.

C5. Transition completion starts fresh full 90-tick Kuzushi.

C6. First valid post-transition Push/Tsuppari/Grip consumes according to the same rules.

## Presentation Regression

V1. Sweat is full on fresh 90-tick Kuzushi.

V2. Sweat alpha is approximately 0.5 at half remaining.

V3. Sweat disappears immediately after follow-up consumption.

V4. Sweat remains full while CounterTransition pauses the timer.

V5. Existing Counter Product 35-degree motion unchanged.

---

# Verification

Verification Level:
Heavy

Required:

- focused Kuzushi simulation tests
- focused Push/Kuzushi tests
- focused Tsuppari/Kuzushi tests
- focused Grip/Morozashi tests
- focused CounterTransition tests
- focused `wrestlerVisualState` / sweat presentation tests
- all explicitly listed D/P/T/G/C/V cases above
- `pnpm test`
- `pnpm build`
- `git diff --check`
- browser/runtime smoke
- prove Product art assets unchanged.

Do not mark overall PASS if any required boundary case is not run.

---

# Browser / Runtime Smoke

Required.

At minimum observe:

1. Counter Fail -> sweat/Kuzushi visibly lasts much longer than before (~1.5 s)
2. untouched Kuzushi naturally recovers
3. Push on Kuzushi produces the stronger first follow-up and sweat disappears immediately
4. continued Push after consumption is normal
5. Tsuppari on Kuzushi produces stronger push and sweat disappears
6. Grip on Kuzushi gives existing Morozashi and sweat disappears
7. Push Counter transition remains unchanged
8. transition pusher retains sweat during transition
9. post-transition Kuzushi is full 1.5 s unless consumed
10. Tsuppari / Counter Product visuals unchanged
11. no console/runtime errors.

Use debug readouts / controlled fixtures as needed to verify state timing; visual feel remains User-owned.

---

# User Play Test

REQUIRED.

Primary questions:

1. Is 1.5 s Kuzushi long enough to create a deliberate slower follow-up window?
2. Does one successful follow-up consuming Kuzushi feel fair and understandable?
3. Does Push 1.5x -> normal after consumption feel clear?
4. Does Tsuppari 1.5x -> normal after consumption feel clear?
5. Does Grip -> Morozashi -> Kuzushi removal feel consistent?
6. Does the sweat disappearing on consumption clearly communicate "the opening was used"?
7. Is post-CounterTransition 1.5 s too long / appropriate?

Technical PASS does not constitute Game Feel acceptance.

---

# Documentation

Update `docs/ARCHITECTURE.md` to the new Current Source truth.

Document at minimum:

- `KUZUSHI_TICKS = 90`
- maximum 1.5 s duration
- first qualifying Push/Tsuppari/Grip consumes
- Push and Tsuppari follow-up multiplier 1.5
- Grip uses Morozashi benefit rather than numeric multiplier
- Kuzushi-generating attack itself does not benefit from newly created Kuzushi
- CounterTransition pause/restart semantics remain.

Do not promote unrelated design ideas.

---

# Implementation Evidence Required

Completion Report must include:

| Design Requirement | Implemented As | Verified By |
|---|---|---|

At minimum:

- 90-tick duration
- single-follow-up consumption
- Push 1.5x then consume
- Tsuppari 1.5x then consume
- Grip Morozashi then consume
- 6th-hit ordering
- CounterTransition preservation
- sweat behavior
- gameplay/presentation ownership.

---

# Completion Report

Include:

- Result
- exact constants old -> new
- any constant rename
- exact consumption implementation points
- ordering semantics
- required boundary-case results D/P/T/G/C/V
- full verification
- browser smoke
- Design Deviations
- Unexpected Scope
- User Play Test: REQUIRED
- Git delivery.

If none:

```
Design Deviations: NONE
```

---

# Stop Conditions

STOP if:

- implementing consumption requires duplicating Kuzushi state
- participant iteration order affects outcome
- existing 6th-hit semantics cannot be preserved without an unapproved design change
- CounterTransition semantics would need redesign
- Grip/Morozashi semantics would need redesign beyond consumption
- presentation must own gameplay consumption
- unrelated gameplay systems need changes
- Current Source materially conflicts with this Task.

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

`feat(gameplay): extend and consume kuzushi followup window`

Do not modify:

- `main`
- `PROJECT_HANDOFF.md`
- `CURRENT_TASK.md`.

# Final Instruction

Change Kuzushi into a maximum 1.5-second, one-successful-follow-up vulnerability window.

Push and Tsuppari receive the 1.5x follow-up benefit and then consume Kuzushi.
Valid Grip keeps the existing Morozashi benefit and consumes Kuzushi.

Preserve all existing Kuzushi entry sources, CounterTransition semantics, Product art and sweat presentation ownership.


---

# ChatGPT Review Handoff

Review-Date: 2026-10-23
Overall Result: PASS / USER PLAY TEST ACCEPTED / MINOR DOCUMENTATION CORRECTION NOTED
Accepted Technical Baseline: 82e62f7d0ebd7de0362d49cb11e4f20494cc31b8

## Reported Implementation vs Design

Accepted as aligned with ACTION-09B.

Confirmed from Current Source / diff:

- KUZUSHI_TICKS changed from 30 to 90
- 90 ticks = 1.5 s at current 60 Hz
- the old Push-only susceptibility constant was replaced by one shared Kuzushi follow-up multiplier
- first actual Push follow-up uses 1.5x and consumes Kuzushi
- first successful Tsuppari follow-up uses 1.5x impulse before the existing clamp and consumes Kuzushi
- valid Grip keeps the existing Morozashi benefit and consumes Kuzushi
- whiffs / out-of-range / startup / recovery / non-contact / cancelled Pushes do not consume
- 6th-hit ordering preserves "creating hit does not benefit from the Kuzushi it creates"
- already-Kuzushi + 6th hit uses old Kuzushi for 1.5x, consumes it, then creates a fresh 90-tick Kuzushi
- CounterTransition pause / fresh restart semantics are preserved
- presentation continues to read Simulation posture only.

## Accepted Kuzushi Baseline

User Play Test result: ACCEPTED.

Current Kuzushi definition:

> A maximum 1.5-second vulnerability state.  
> The first successful Push, Tsuppari, or valid Grip follow-up uses the Kuzushi benefit and consumes the state.  
> If unused, Kuzushi expires naturally after 90 full ticks.

Accepted constants:

```
KUZUSHI_TICKS = 90
KUZUSHI_FOLLOWUP_FORCE_MULTIPLIER = 1.5
```

Do not revert to the old 30-tick / 0.5-second baseline in unrelated tasks.

## Push Follow-up

Accepted:

- only a real received Push force qualifies
- first qualifying Push force tick uses 1.5x
- Kuzushi is consumed after that force is resolved
- later active Push ticks are ordinary 1.0x
- cancelled/equal Pushes do not consume.

Base Push tuning remains unchanged.

## Tsuppari Follow-up

Accepted:

- receiver must already be Kuzushi before the hit
- impulse calculation is:
  `TSUPPARI_IMPULSE * 1.5`
- existing MAX_EXTERNAL_SPEED clamp remains in force
- Kuzushi is consumed after the hit
- ordinary Tsuppari remains unchanged.

Current base impulse remains 2.13 m/s.

## Grip Follow-up

Accepted:

- valid range rules are unchanged
- Kuzushi does not bypass Grip range
- valid Grip on a Kuzushi target consumes Kuzushi
- existing Morozashi holder benefit is the Grip follow-up benefit
- no separate numeric 1.5x Grip force was introduced.

## 6th-Hit Ordering

Accepted deterministic order:

```
capture old Kuzushi state
-> resolve hit / force using old state
-> consume old Kuzushi if follow-up used
-> apply fresh 6th-hit Kuzushi afterward
```

Therefore:

- stable receiver + 6th hit = ordinary impulse + fresh 90-tick Kuzushi
- already-Kuzushi receiver + 6th hit = 1.5x follow-up, old Kuzushi consumed, then fresh 90-tick Kuzushi.

Do not change this ordering casually.

## CounterTransition

Preserved:

- Push Counter catch puts pusher in Kuzushi
- CounterTransition still lasts 90 ticks
- pusher Kuzushi timer is paused during transition
- normal follow-up actions do not resolve during transition
- completion starts a fresh full 90-tick Kuzushi
- first valid post-transition Push/Tsuppari/Grip consumes it using the same rules.

No transition path / side / rear / stagger change was introduced.

## Sweat / Presentation

ACTION-09A sweat remains accepted and unchanged.

Because it reads:

```
kuzushiStrength = ticksRemaining / KUZUSHI_TICKS
```

the accepted behavior is now:

- fresh Kuzushi: full sweat
- ~half duration: ~0.5 alpha
- qualifying follow-up consumption: sweat disappears immediately
- CounterTransition: full sweat stays visible while timer is paused
- post-transition: fresh 90-tick fade window.

No dedicated Kuzushi sprite or body wobble exists.

## Determinism / Ownership

Accepted architecture:

```
Pure Simulation owns:
- duration
- multiplier
- consumption
- ordering

Snapshot/posture
-> WrestlerVisualState
-> sweat presentation
```

The follow-up decision is made from the pre-force Kuzushi set, then consumed only after forces are applied, avoiding participant-order dependence.

No duplicate consumed flag/state was added.

## Verification Review

Reported and accepted:

- required D / P / T / G / C / V boundary cases: ALL PASS
- focused gameplay/presentation: 182 PASS
- pnpm test: 25 files / 400 PASS
- pnpm build / typecheck: PASS
- git diff --check: PASS
- Product art exporter checks: PASS
- Browser/runtime smoke: 51 / 51 PASS
- Product art assets unchanged.

This satisfies the Task's Heavy Verification requirement.

## Documentation Correction

One stale statement remains in `docs/ARCHITECTURE.md` inside the older "Counter + Kuzushi (ACTION-04A1)" paragraph:

> the Grip guarantee is described as a future/unimplemented boundary.

This is no longer true.

Current Source and later Architecture sections correctly show:

- Grip is implemented
- a valid in-range Grip on Kuzushi consumes Kuzushi
- gripper receives Morozashi.

Treat the stale sentence as documentation debt only, not as Current gameplay truth.

Before relying on that paragraph for future design, correct/remove that obsolete "未実装" wording in a suitable documentation/task edit.

Do not reinterpret Current Source to match the stale sentence.

## Do Not Reopen

Unless explicitly requested:

- Kuzushi duration = 90 ticks / 1.5 s
- one-successful-follow-up consumption model
- follow-up multiplier = 1.5
- Push consumption timing
- Tsuppari 1.5x + existing clamp
- Grip -> Morozashi consumption
- 6th-hit ordering
- CounterTransition pause/restart semantics
- accepted sweat effect
- current Counter / Tsuppari Product art.

## User Goal Attainment

User Play Test was reported as good.

Therefore the current slower Kuzushi window and one-follow-up consumption model are accepted as the current Game Feel baseline.

Future tuning should treat this as an accepted decision unless the User explicitly asks to change it.
