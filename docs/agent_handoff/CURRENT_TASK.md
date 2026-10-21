Task-ID: ACTION-07A-TSUPPARI-INVESTIGATION
Status: REVIEWED
Task-Type: INVESTIGATION / CORE GAMEPLAY DESIGN / INPUT / ART INTEGRATION
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 7357788bd9b9091e50ef44859874cec4ae128671
Handoff-Mode: GITHUB

# ACTION-07A — Tsuppari Investigation / Implementation Design

## Purpose

Design the smallest correct implementation of **Tsuppari（突っ張り）** against the current BoutSimulation / input / Product-art architecture before writing Production gameplay code.

This is an **Investigation / Design only** Task.

Do NOT implement Tsuppari yet.
Do NOT modify Production gameplay behavior.
Do NOT tune unrelated systems.

The output must be a concrete implementation design that can be handed directly to the next Implementation Task.

---

# Terminology

For SumoSim, use **Tsuppari / 突っ張り** as the action name.

Do not create a separate "Harite" action.
The User has defined the previously discussed 張り手 action as Tsuppari for this project.

---

# Accepted Current Baseline

Current Product idle art baseline is accepted through User Play Test:

- authored red idle sprite is the canonical master
- blue idle sprite is derived offline by local-Y reflection + mawashi recolor
- runtime uses ordinary PNGs; no dynamic mirror/recolor in Phaser
- this baseline is accepted and must not be reopened.

Current gameplay source must be inspected directly.

Known current technical facts to verify from source include:
- fixed Simulation at 60 Hz
- Push phases: startup / active / recovery
- current Push external-force model
- current Counter window / Kuzushi behavior
- Counter transition for Push
- ParticipantIntent same-tick priority
- ArrowLeft / ArrowRight availability
- current rigid Product wrestler view.

---

# User-Accepted Tsuppari Gameplay Decisions

These are accepted requirements. Do not redesign them.

## Input / hand

Prototype keyboard binding:

- **ArrowLeft = left-hand Tsuppari**
- **ArrowRight = right-hand Tsuppari**

Meaning:
- ArrowLeft fires the wrestler's left hand
- ArrowRight fires the wrestler's right hand.

Both are discrete press edges, not held repeat.

If Left and Right are pressed on the same logical tick:
- **Left wins**
- Right is dropped
- do not queue Right.

Tsuppari is not allowed to have two simultaneous hand actions.

---

# Independent Hand Cooldowns

Initial Prototype value:

- left hand cooldown = **1.0 second**
- right hand cooldown = **1.0 second**
- at 60 Hz, investigate/design around **60 ticks per hand**.

Cooldowns are independent.

Example semantics:
- after using Left, Left cannot start again until its cooldown is ready
- Right may still start if Right is ready and the participant is otherwise allowed to start a Tsuppari
- after using Right, the same applies in reverse.

This is intended to reward alternating:
- Left -> Right -> Left -> Right

and allow approximately twice the sustained Tsuppari rate compared with repeatedly using only one hand.

The User delegates the exact cooldown-start convention to the implementation design:
- start-at-action-accept
- or start-at-action-end

Choose the simpler, deterministic model **only if it preserves the intended left/right alternating behavior**.
Report the exact semantics and an example tick timeline.

Cooldown is Bout runtime state only.
It resets for a new Bout.

Do not invent persistence / Management ownership.

---

# Tsuppari Movement / Lock

Tsuppari is fired **in place**.

- the attacker does not intentionally advance from the Tsuppari action
- WASD self-movement is fully locked while the Tsuppari action is active
- ordinary existing external momentum behavior must be inspected; do not silently erase unrelated momentum unless required by a clearly stated rule.

This distinguishes it from Push:
- Push = committed forward drive
- Tsuppari = stationary hand strike.

---

# Reach / Hit Rule

Tsuppari has its own fixed gameplay reach.

The reach is:
- Simulation-owned
- based on participant center geometry
- NOT a sprite-pixel collision
- NOT Phaser-owned
- NOT dependent on the currently rendered hand image.

Initial reach is provisional for User Play Test.

The User wants the provisional reach chosen so the supplied Tsuppari pose does not look obviously disconnected from the opponent.

Important:
- the user-provided Tsuppari candidate images may not exist in the Repository.
- if they are unavailable to the Agent, do not invent a fake image measurement.
- design a clear center-distance reach rule and propose a provisional numeric value from current gameplay scale/body radius, explicitly marked **Provisional / User Play Test**.
- explain how the value should be adjusted once the actual Tsuppari runtime pose is normalized.

Determine whether the cleanest rule is:
- direct center-to-center threshold
- or attacker center reach + opponent body radius

but keep the externally meaningful behavior a fixed Simulation distance, not sprite collision.

---

# Tsuppari Action Timing

The User delegates initial timing to the implementation design.

Design provisional:
- startup
- active
- recovery

ticks.

Constraints:
- deterministic integer ticks
- Tsuppari should feel lighter / lower commitment than Push
- WASD locked through the Tsuppari action
- hit resolution should be simple and explicit
- timing must work with the independent 60-tick hand cooldowns
- do not make animation timing the gameplay source of truth.

The visual pose is one-frame / one-pose, not multi-frame animation.

Provide the proposed tick values and rationale.

Do not modify Push timing in this Investigation unless a conflict is discovered; report such a conflict instead of silently changing accepted Push timing.

---

# Push vs Tsuppari Force Baseline

The User explicitly requests the next implementation to change the force relationship.

Current Push strength in Current Source must be measured / identified first.

Accepted target:

- **new Push knockback strength ~= 2 × current Push**
- **Tsuppari knockback strength ~= current Push**

Therefore initial intended relationship:

```
new Push > Tsuppari
approximately:
new Push : Tsuppari = 2 : 1
```

The User's goal is gameplay feel / displacement, not merely changing one constant.

Current source appears to use external acceleration + external-speed clamp rather than a literal fixed displacement.
Investigate the consequences.

Required design:
- identify the current Push force constants and clamp/decay interactions
- specify the smallest safe way to make Push feel about 2x stronger while Tsuppari starts around the old Push strength
- do NOT casually change `MAX_EXTERNAL_SPEED` or global external decay unless necessary
- if the speed clamp prevents a meaningful 2:1 result, report it and propose the smallest targeted model adjustment.

The next Implementation Task must be able to verify representative actual displacement, not only constant values.

All tuning remains **Provisional / User Play Test**.

---

# Tsuppari Hit Effect

On an ordinary successful Tsuppari hit:

- attacker does not advance because of Tsuppari
- opponent is pushed backward by the weaker Tsuppari force
- ordinary hit does not automatically enter Kuzushi
- successful hit increments that attacker's Tsuppari Kuzushi buildup.

A whiff:
- does not push
- does not increment Kuzushi buildup.

Do not add damage / HP.

---

# Deterministic Kuzushi Buildup

Kuzushi from Tsuppari is required in the first implementation.

Do NOT use randomness.

Initial Prototype behavior:

- each participant has Bout-local Tsuppari successful-hit buildup
- initial buildup = 0
- successful Tsuppari hits increment it
- whiffs do not increment it
- after **5 ordinary successful hits**, the **next successful hit (the 6th)** causes:
  - ordinary Tsuppari push
  - plus Kuzushi on the receiver
- then reset the buildup for the next cycle.

So the initial threshold semantics are:

```
hits 1..5: normal Tsuppari
hit 6: Tsuppari + Kuzushi
then reset
```

This threshold is provisional.

Future direction:
- a future Tsuppari-related Simulation/combat parameter may change:
  - Tsuppari push strength
  - Kuzushi buildup threshold.

Do NOT invent the final Management stat, progression rule, ability name, persistence model, or save format in this Task.

Investigation must recommend the smallest current ownership that:
- keeps this Bout-local and deterministic now
- does not block a future per-participant parameter
- avoids prematurely building a generic stats framework.

Buildup must reset between Bouts.

---

# Counter vs Tsuppari

Use the current Push Counter timing/window as the initial Prototype reference.

User decision:
- Counter can catch Tsuppari
- if Tsuppari is countered:
  - the Tsuppari user enters Kuzushi **in place**
  - use the same Kuzushi duration as current Push Counter
  - **NO side relocation**
  - **NO rear relocation**
  - **NO CounterTransition wrap**
  - no Success/Best positional reward.

The Investigation must determine the cleanest Simulation resolution order and whether Counter tier should:
- be computed but ignored for positional effect
- or not be meaningful for Tsuppari.

Do not change the User-visible result:
**countered Tsuppari = attacker Kuzushi in place.**

The Counter user's behavior after a successful Tsuppari catch should also be explicitly specified.

---

# Tsuppari vs Tsuppari

If both participants' Tsuppari hit on the same tick:

- **both hits succeed**
- **both participants are pushed slightly backward / apart**
- do NOT simply net the two equal Tsuppari forces to zero.

This is intentionally different from current equal Push-vs-Push cancellation.

The design must explain how to represent this without making the same State source-of-truth exist twice.

Also specify:
- whether both successful hits increment each attacker's Kuzushi buildup
- if one/both hit is the threshold Kuzushi hit, how both results resolve symmetrically.

Preferred principle:
- symmetric / order-independent pair resolution.

---

# Push vs Tsuppari

User decision:

Push and Tsuppari should visibly **contest / push against each other**.

But Push is stronger.

Desired feel:
- both are contributing force
- Tsuppari partially resists Push
- Push normally wins the exchange because its force is larger
- result should look like Push pushing through weaker Tsuppari pressure
- do not model this as "Push has priority so Tsuppari simply disappears."

This is distinct from the **input start priority** below.

Investigation must inspect the current pair Push resolution and propose an order-independent pair-force model for:

- Push vs Push
- Push vs Tsuppari
- Tsuppari vs Push
- Tsuppari vs Tsuppari
- one active action vs idle.

Preserve current equal Push-vs-Push contest behavior unless the new model requires an equivalent refactor.

Do not introduce mass / traction systems.

---

# Same-Participant Input Priority

For multiple action edges from the same participant on the same tick, initial priority is:

```
Push
> Tsuppari
> Counter
> Grip
> Move
```

Within Tsuppari:
- Left > Right if both hand edges occur on the same tick.

"Move" means ordinary movement is only used when no higher-priority action state locks it.

Do not confuse same-participant input priority with pair-vs-pair force contest:
- Push edge beating Tsuppari edge on one participant does NOT mean an opponent's active Tsuppari is ignored.

---

# Grapple / CounterTransition / Non-Free State

Investigate and recommend minimal behavior for Tsuppari during:
- grappled state
- current CounterTransition
- Kuzushi
- another action
- decided/frozen bout.

Default direction unless Current Source gives a material reason otherwise:
- Tsuppari is a FREE-state action
- cannot start while grappled
- cannot start during CounterTransition
- cannot start during Kuzushi
- cannot start while another action is active
- inputs during those states are dropped, not queued.

Do not add Tsuppari inside grapple in this Task.

---

# Art / Presentation Direction

Tsuppari needs a dedicated one-frame pose.

User has candidate images outside the Repository.

Accepted art direction:
- no multi-frame limb animation for the first version
- Tsuppari action displays one pose while active
- existing red-master -> derived-blue color workflow should remain the default color-variant principle.

Open visual question:
- whether left-hand and right-hand Tsuppari should be:
  1. two separately accepted red pose masters
  2. one hand pose master + local mirror to create the other hand.

Do NOT decide this from theory alone.

The User wants to compare the visual result first.

Therefore this Investigation must propose a later Art Visual Gate that compares:
- separately supplied left/right poses
- one-side mirrored candidate

before locking left/right art production.

Important:
- blue counterpart should be derived from the accepted red pose master(s) using the established offline color workflow where applicable.
- do not revert to separately generated blue Product art as a requirement.

Do not import the user images into the Repository in this Investigation.

---

# Architecture Constraints

Maintain:

```
Pure TypeScript Game / Simulation
-> State / Results
-> Phaser Rendering / Input / Animation
```

Simulation owns:
- Tsuppari action state
- timing
- per-hand cooldown
- reach
- successful hit
- push effect
- Kuzushi buildup
- Counter result
- Push/Tsuppari pair contest
- deterministic outcome.

Phaser owns:
- ArrowLeft / ArrowRight press capture
- pose selection/rendering
- texture loading
- presentation only.

Do NOT put Tsuppari hit/reach/force formulas in `BoutScene.update()`.
Do NOT use sprite overlap as gameplay collision.
Do NOT let animation decide whether a hit occurred.

Keep fixed-step determinism.

Do not add ECS, DI, global event bus, generic rule engine, physics engine, or generic stats framework.

---

# Investigation Questions / Required Output

Return a concrete design answering at least:

1. Exact ParticipantIntent extension for Left / Right Tsuppari.
2. Exact same-tick input priority.
3. Exact MutableAction / public ParticipantActionState shape.
4. Where per-hand cooldown state lives.
5. Cooldown start/countdown semantics with an example tick timeline.
6. Proposed startup / active / recovery tick counts.
7. Exact tick(s) on which Tsuppari can hit.
8. Proposed provisional center-based reach and formula.
9. How facing/direction is captured for Tsuppari.
10. Whether Tsuppari hit can occur when not in ordinary body contact.
11. Proposed Tsuppari force constant/model based on current Push.
12. Proposed Push change giving approximately 2x old Push displacement.
13. Interaction with current external speed clamp / decay.
14. Symmetric Tsuppari-vs-Tsuppari pair resolution.
15. Push-vs-Tsuppari force contest resolution.
16. Current Push-vs-Push equivalence preservation.
17. Successful-hit buildup state and 1..5 -> 6th Kuzushi semantics.
18. Threshold-hit reset semantics.
19. Counter-vs-Tsuppari resolution and Counter user's post-action state.
20. Counter tier treatment for Tsuppari.
21. Tsuppari during grapple / CounterTransition / Kuzushi / other actions.
22. Ring-out implications: Tsuppari push must feed normal ring-out resolution.
23. Snapshot fields presentation needs.
24. WrestlerVisualState extension.
25. BoutScene input/latch changes.
26. Dummy / test harness changes needed for verification.
27. Art asset path/metadata strategy without implementing it.
28. Focused tests required in the Implementation Task.
29. Browser/runtime smoke cases.
30. User Play Test cases.

---

# Explicit Boundary Cases to Design

Do not sample these away. Address each:

- Left ready / Right ready
- Left cooldown / Right ready
- Left ready / Right cooldown
- both cooldown
- Left + Right same tick
- Push + Left same tick
- Left + Counter same tick
- Left + Grip same tick
- Left during WASD
- Tsuppari whiff
- Tsuppari ordinary hit
- 5th ordinary hit
- 6th threshold Kuzushi hit
- threshold hit after prior whiff
- new Bout reset
- Counter catches left Tsuppari
- Counter catches right Tsuppari
- Tsuppari vs Tsuppari same tick
- Tsuppari threshold hit vs Tsuppari ordinary hit same tick
- both Tsuppari threshold hits same tick
- Push vs Tsuppari
- equal Push vs Push after any resolver refactor
- Tsuppari at ring edge causing receiver ring-out
- Tsuppari attacker at ring edge receiving simultaneous Tsuppari
- input during CounterTransition
- input while grappled
- input during Kuzushi
- input during action recovery.

---

# Current Push Increase Is In Scope for the NEXT Implementation Design

The following User request is accepted and must be designed now so the next implementation can include it:

- current Push knockback feels too small
- increase Push knockback to approximately **2x the current feel**
- initial Tsuppari knockback should be approximately **the current Push feel**.

Do not implement the change in this Investigation.

Do not reinterpret this as an exact 2x mathematical displacement across all states if clamp/decay make that impossible.
Instead:
- define representative verification fixtures
- identify expected actual displacement/velocity relationship
- mark final feel as User Play Test gated.

---

# Required Reading

Read directly:
- `AGENTS.md`
- `CLAUDE.md`
- current `CURRENT_TASK.md`
- current `CURRENT_COMPLETION_REPORT.md`
- `docs/ARCHITECTURE.md`
- `docs/WRESTLER_PRODUCT_ART_SPEC.md`
- relevant Action/Counter/Grip specs if present
- `src/game/sumo/BoutTypes.ts`
- `src/game/sumo/BoutSimulation.ts`
- relevant BoutSimulation tests
- `src/game/input/pressLatch.ts`
- `src/game/input/pushDummyController.ts`
- relevant input tests
- `src/game/scenes/BoutScene.ts`
- `src/game/presentation/wrestlerVisualState.ts`
- `src/game/scenes/WrestlerView.ts`
- `src/game/presentation/productWrestlerArt.ts`
- current wrestler art tools/recipes only as needed for presentation boundary.

Review Handoff is not a substitute for Current Source inspection.

---

# Scope In

- inspect Current Source
- design Tsuppari Simulation state/rules
- design input boundary
- design per-hand cooldowns
- design deterministic buildup/Kuzushi
- design pair-force interaction matrix
- design provisional timing/reach/force constants
- design current Push force increase
- design Counter interaction
- design presentation state boundary
- design test and runtime verification plan
- identify exact files/modules expected for implementation
- write `CURRENT_COMPLETION_REPORT.md`.

---

# Scope Out

Do NOT:
- implement Tsuppari Production code
- change Push Production tuning yet
- modify runtime assets
- commit user-uploaded Tsuppari images
- add final Management/ability stats
- add stamina/balance
- add CPU AI
- add Touch/Gamepad
- implement throws/lifts
- modify Counter transition behavior for Push
- modify Grip/Drive rules
- refactor unrelated Simulation architecture
- change ring-out rules
- change idle red-master art baseline.

Investigation Only / No Fixes.

---

# Stop Conditions

STOP / report rather than implementing if:

- the requested symmetric Tsuppari-vs-Tsuppari behavior fundamentally conflicts with the current external-velocity ownership in a way requiring a broad physics rewrite
- approximately 2:1 Push/Tsuppari feel cannot be achieved without changing global movement/physics semantics
- Counter-vs-Tsuppari cannot be added without materially changing accepted Push Counter semantics
- a new long-term stats/Management architecture is required to represent the prototype parameter
- Current Source materially contradicts the accepted decisions above
- a required prerequisite outside this Task is discovered.

A small explicit extension to pair-force resolution is acceptable to propose.
A broad physics rewrite is not.

---

# Verification Level

Investigation only.

Required evidence:
- Current Source inspection
- exact current Push constants / timing / clamp behavior
- relevant current tests identified
- no Production source changes
- `git diff --check` for documentation/report changes.

Do not run or claim Implementation verification that does not exist.

---

# Completion Report

Include:

- Result
- Current Source findings
- exact current Push model
- proposed Tsuppari state model
- proposed constants:
  - startup
  - active
  - recovery
  - each-hand cooldown
  - reach
  - Tsuppari force
  - new Push force
  - Kuzushi threshold
  - Kuzushi duration
- force interaction matrix
- Counter interaction matrix
- same-tick input priority
- cooldown timeline example
- buildup timeline example
- state ownership
- expected changed files for Implementation
- explicit boundary-case test matrix
- Browser/runtime smoke plan
- User Play Test checklist
- Art Visual Gate plan
- Design Deviations
- Unexpected Scope
- unresolved decisions, if any
- recommendation whether Implementation is READY or BLOCKED.

If no design deviation:
`Design Deviations: NONE`

Do not implement Production changes.

---

# Git Delivery

Follow `AGENTS.md`.

Expected repository change:
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md` only, unless a very small investigation note is explicitly required by AGENTS.md.

Do not modify `CURRENT_TASK.md`.
Do not modify Production source.
Do not modify `PROJECT_HANDOFF.md`.
Do not modify `main`.

Suggested commit:
`docs(action): design tsuppari prototype`

# Final Instruction

Investigate and design Tsuppari against Current Source.

Return a concrete, implementation-ready design.
Do not implement Tsuppari yet.


---

# ChatGPT Review Handoff

Review-Date: 2026-10-22
Overall Result: DESIGN PASS / IMPLEMENTATION READY
Accepted Investigation Baseline: 86f3bb385cfe1469a6fa327de9fc3fdeaf0c17f6

## Reported Investigation vs Task

The investigation satisfies ACTION-07A.

- Production source was not changed.
- Current Push / Counter / Grip / input / presentation source was inspected directly.
- The current Push displacement model was measured rather than inferred from the acceleration constant alone.
- Tsuppari was designed as Simulation-owned fixed-step gameplay, not Phaser/sprite collision.
- Left/right independent cooldowns, deterministic buildup, Counter behavior, Push/Tsuppari contest, ring-out path, input latches, Snapshot/presentation boundary, dummy harness, test matrix and art follow-up are all covered.
- No broad physics rewrite, generic stats framework or unrelated refactor is required.

Implementation may proceed as a separate Task.

## Accepted Provisional Implementation Defaults

The following are accepted as **Prototype defaults for 07B**, not final balance:

- `TSUPPARI_STARTUP_TICKS = 6`
- `TSUPPARI_ACTIVE_TICKS = 1`
- `TSUPPARI_RECOVERY_TICKS = 9`
- per-hand cooldown = 60 ticks, counted from accepted action start
- provisional hand reach = 0.525 m from attacker center plus receiver body radius
  - current equal-radius center threshold = 0.875 m
- `TSUPPARI_IMPULSE = 2.13 m/s`
- `TSUPPARI_KUZUSHI_BUILDUP = 5`
  - hits 1..5 ordinary
  - hit 6 ordinary impulse + Kuzushi
  - then reset
- Tsuppari Kuzushi uses existing `KUZUSHI_TICKS = 30`
- new Push provisional acceleration = `26.25 m/s^2`
  - chosen because the representative fixture gives about 2x the current Push displacement
- `MAX_EXTERNAL_SPEED` and `EXTERNAL_DECELERATION` remain unchanged.

These values remain User Play Test gated.

## Accepted Action / Input Semantics

- ArrowLeft = left-hand Tsuppari.
- ArrowRight = right-hand Tsuppari.
- Same participant priority:
  - Push > Tsuppari > Counter > Grip > Move.
- Within Tsuppari:
  - Left is preferred when both hands are ready and both edges occur on the same tick.
  - If the preferred hand is unavailable because of cooldown, an available Right edge may start instead.
- Inputs that cannot start are dropped, not queued.
- Tsuppari locks WASD for the full action.
- Tsuppari is FREE-state only.
- No Tsuppari start while grappled, in CounterTransition, in Kuzushi, during another action, or after bout outcome.
- Cooldowns continue to count down while the bout is still progressing, including Kuzushi / grapple / CounterTransition.
- Bout restart resets cooldowns and buildup.

## Accepted Hit / Counter Semantics

- Tsuppari can hit without ordinary body contact if the center-based reach test succeeds.
- Hit is evaluated once on the active tick.
- Ordinary hit:
  - attacker gets no intentional Tsuppari advance
  - receiver gets Tsuppari impulse
  - successful-hit buildup increments.
- Whiff:
  - no impulse
  - buildup unchanged.
- Counter catching Tsuppari:
  - Tsuppari user enters Kuzushi in place
  - no side/rear relocation
  - no CounterTransition
  - no Tsuppari impulse
  - no buildup increment/reset
  - Counter user returns to idle/stable
  - Counter tier is not meaningful for Tsuppari.
- Existing external momentum is not silently zeroed by a Tsuppari Counter. "In place" means no special relocation/overshoot is added.

## Pair Resolution Baseline

The pair resolver must be symmetric / participant-order independent.

- Push vs Push:
  - preserve current equal-force cancellation semantics.
- Tsuppari vs Tsuppari on the same hit tick:
  - both hits succeed from the same pre-resolution state
  - both impulses apply
  - both buildups update
  - threshold Kuzushi is applied after both hit/force results are determined.
- Push vs Tsuppari:
  - do not discard Tsuppari merely because Push has higher same-participant input priority
  - both contributions contest
  - Push must win overall in the intended representative exchange
  - initial coupled contribution may use the proposed `TSUPPARI_COUPLED_SHARE = 0.5`.

`TSUPPARI_COUPLED_SHARE = 0.5` is a **provisional tuning choice**, not a permanent rule. User Play Test must judge whether the short reverse impulse / resistance looks natural.

## Push Tuning Review

The report correctly distinguishes acceleration from observed displacement.

Current representative result:
- old Push: about 0.267 m
- proposed Push at 26.25: about 0.533 m
- proposed Tsuppari: about 0.266 m.

Therefore the proposed first-pass relationship satisfies the requested target:

```
Push displacement ~= 2 x old Push
Tsuppari displacement ~= old Push
```

Do not change global `MAX_EXTERNAL_SPEED` or `EXTERNAL_DECELERATION` merely to obtain a literal 2x acceleration constant.

The Implementation Task must verify actual representative displacement, not only constants.

## Required Correction / Guardrail for 07B

The report found three existing `BoutCounterTransition.test.ts` fixtures that fail when Push strength is raised.

07B may adjust **fixture starting positions only** if needed to recreate the same intended CounterTransition scenarios.

It must NOT:
- weaken those assertions
- delete those cases
- change Counter / CounterTransition semantics to make them pass
- treat the fixture adjustment as evidence that Counter behavior changed.

Report the exact fixture-only changes.

## Presentation / Art Boundary

07B should implement gameplay + input + debug/presentation state using the current idle sprite if necessary.

Do not bundle Product Tsuppari pose integration into 07B.

The later Art Visual Gate must compare:
- separately authored left/right red pose masters
- one-side red master + reflection.

The User has not accepted which left/right pose-production method wins yet.

The accepted idle art baseline remains:
- authored red master
- derived blue via offline local-Y reflection + mawashi recolor.

## Verification Required for 07B

Treat 07B as Heavy/Core Gameplay verification.

At minimum:
- all explicit boundary cases from the ACTION-07A matrix
- participant-order symmetry for simultaneous Tsuppari
- left/right cooldown timing
- Push > Tsuppari > Counter > Grip priority
- Tsuppari whiff/hit/reach boundary
- 1..5 -> 6th Kuzushi cycle
- new-Bout reset
- Counter catches left/right Tsuppari
- no CounterTransition for Tsuppari Counter
- Tsuppari vs Tsuppari, including threshold cases
- Push vs Tsuppari contest
- unchanged equal Push-vs-Push semantics
- representative Push/Tsuppari displacement
- ring-out / simultaneous ring-out paths
- grapple / CounterTransition / Kuzushi / recovery input suppression
- Snapshot deep-copy/state ownership
- full relevant automated suite
- build
- browser/runtime smoke.

User Play Test remains the final gate for:
- Push force feel
- Tsuppari force feel
- reach
- 1-second cooldown
- action timing
- Push-vs-Tsuppari contest feel
- Counter timing/readability
- Tsuppari-vs-Tsuppari feel.

## Do Not Reopen

Unless explicitly requested:
- Tsuppari terminology
- ArrowLeft / ArrowRight hand mapping
- independent 1-second hand cooldown concept
- deterministic 5 ordinary hits -> 6th Kuzushi concept
- Push stronger than Tsuppari
- Tsuppari Counter = in-place Kuzushi with no wrap
- Push Counter existing relocation semantics
- Tsuppari FREE-state-only direction for the first prototype
- current red-master idle art baseline.

## Next Task

Implementation is READY.

Recommended next Task:
`ACTION-07B-TSUPPARI-GAMEPLAY-IMPLEMENTATION`

Scope should be gameplay / input / debug presentation only.
Product Tsuppari pose art should remain a separate subsequent Visual Gate / integration Task.
