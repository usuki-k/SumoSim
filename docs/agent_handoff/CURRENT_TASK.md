Task-ID: ACTION-03-PUSH-CONTACT-COLLISION-INVESTIGATION
Status: READY
Task-Type: INVESTIGATION / CORE ACTION DESIGN
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: 29073732a123163bb11e81d7b4b82ac7ffeb5bbd
Handoff-Mode: GITHUB

# ACTION-03 — Push / Contact / Collision Investigation

## 1. Purpose

ACTION-02BでMovement FeelがUser Play TestによりCurrent BaselineとしてAcceptされた。

次のProduction実装へ進む前に、相撲Actionの中心となる以下を設計調査する：

- participant body / contact representation
- collision / separation
- push action
- momentum / impulse transfer
- Weight / Power / LowerBody等のparameter boundary
- current grounded locomotionとの相互作用
- ring boundary / ring-out geometry
- numerical stability / fixed-step boundary cases
- 次の最小Implementation sequence

このTaskはInvestigation Only / No Production Fixes。

Production Source、package、lockfile、AGENTS、ARCHITECTURE、GAME_CONCEPT等を変更しない。
調査結果は `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md` のみへ記録する。

## 2. Accepted Baseline

Accepted Production Baseline:

`29073732a123163bb11e81d7b4b82ac7ffeb5bbd`

Current accepted Movement baseline:

- screen/world-relative WASD
- auto-facing opponent
- Pure TypeScript `BoutSimulation` owns canonical position / velocity / facing
- fixed timestep + accumulator
- 60Hz is provisional, not final
- semantic movement intent; raw key does not enter Simulation
- logical units: meter / m/s / radian
- grounded locomotion:
  - forward acceleration
  - strong grounded stop
  - lateral damping / turning grip
  - reverse braking
- Scene is one-way Snapshot presentation
- Phaser Physics / Matter.js are not Gameplay Core
- participant identity is separate from controller/presentation role

Current provisional Movement values:

- MAX_SPEED = 3 m/s
- FORWARD_ACCELERATION = 10 m/s²
- STOP_DECELERATION = 24 m/s²
- LATERAL_DECELERATION = 36 m/s²
- REVERSE_BRAKING = 30 m/s²
- SIMULATION_HZ = 60

These are current Prototype tuning values, not final balance.

User Play Test result:

- previous skating/ice feel is materially reduced
- current grounded Movement is accepted as working baseline
- full human/rikishi-like feel is not yet complete, but no concrete additional correction is currently required
- do not reopen movement preemptively without new evidence

## 3. User-Accepted Future Action Direction Relevant to This Task

Normal Bout — FREE:

- Left action: left-hand thrust
- Right action: right-hand thrust
- Up action: push
- Down action: pull/counter-style action
- Grapple Action: attempt grapple
- Custom Action: equipped technique

This Investigation focuses only on **contact + push + ring boundary**.

Do not design thrust / pull / grapple / custom technique implementation beyond interfaces that must remain extensible.

Important:
- exact keyboard binding for action buttons is still not final
- Simulation must receive semantic action intent, not raw key codes
- whether Push is hold/repeat/edge-triggered is a Player-facing semantic that must be explicitly addressed; do not silently assume if it materially affects the design

## 4. User-Accepted Parameter Direction Relevant to Push

Future Rikishi Parameters include the following direction:

Body:
- Height
- Weight

Physical:
- Power
- LowerBody / 足腰
- Speed
- StaminaCapacity

Sumo Skills include Tachiai / ThrustPower / ThrustTempo / Grapple / Throw / Lift / Counter.

For Push specifically, User expectation includes:

Weight:
- push strength influence
- resistance to being pushed
- throw/lift resistance later

LowerBody:
- push strength
- resistance to being pushed
- balance
- throw strength/resistance later

Power is also an accepted general physical candidate.

However:
- exact stat ranges are undecided
- exact formulas are undecided
- Balance is currently a Bout Runtime candidate, not a permanent Rikishi parameter
- Stamina is deferred

This Investigation must decide the **minimum safe parameter boundary** for the first Push Prototype without prematurely locking the full progression/balance system.

## 5. Core Investigation Questions

Current Source and Accepted Decisions must be inspected directly.

### Q1 — Body / Contact Representation

Recommend the smallest body representation for FREE-state contact.

Compare at minimum:

- participant center + constant circle radius
- participant-specific circle radius derived later from body attributes
- other simple shape only if materially better

Determine:

- canonical collision/contact geometry ownership
- whether body radius belongs in BoutSetup/static participant data or temporary Prototype configuration
- whether current presentation-only BODY_RADIUS_METERS should remain presentation-only or a separate simulation contact radius should be introduced
- how future Height / Weight may or may not affect contact radius

Do not equate sprite size with gameplay collision geometry by accident.

### Q2 — Contact Detection / Separation

Design minimal deterministic participant collision/separation for exactly two participants.

Address:

- overlap detection
- separation direction
- equal-position / zero-distance case
- whether position correction is symmetric
- whether movement velocity should be altered by separation
- jitter/resting-contact prevention
- tunneling risk at current fixed-step/max speed and future higher-impact states
- whether continuous collision detection is needed now or Deferred

Goal:
participants should not pass through each other in FREE contact, while preserving Pure TypeScript ownership and deterministic tests.

### Q3 — Push Intent Semantics

Determine the semantic Push input contract.

Address:

- Push as hold/continuous pressure vs edge-triggered discrete action vs repeated pulses
- how it fits future common `ParticipantIntent`
- whether movement + push can occur simultaneously
- whether Push requires contact at tick resolution
- what happens if Push is attempted out of contact
- how future CPU can use the same contract
- how future Touch can map to it

If a Player-facing choice is required, mark it as **User Decision Required before implementation** rather than silently fixing it.

### Q4 — Push Ownership / Resolution Order

Recommend exact high-level order inside one fixed Simulation tick.

At minimum address the relationship between:

- semantic intents
- grounded self-locomotion update
- contact detection
- push effort / impulse
- velocity update
- position integration
- overlap separation / constraints
- facing
- ring-out / outcome

The order must be explicit enough that the Implementation Task is not forced to invent semantics.

Avoid generic pipeline/framework architecture.

### Q5 — Grounded Locomotion vs External Push Momentum

This is the highest-risk architecture question.

Current self-locomotion strongly damps lateral / reverse velocity to create grounded human movement.

A future external Push impulse must not be unintentionally erased immediately by those self-locomotion damping rules.

Compare concrete alternatives such as:

A. One canonical total velocity, with locomotion and external push both modifying it and traction/damping applying to the whole value.

B. Separate self-locomotion velocity and externally induced momentum/impulse component, combined for movement but with distinct damping semantics.

C. Another smaller explicit model if better.

Evaluate against:

- single Source of Truth
- deterministic behavior
- Push Feel tuning
- Weight / LowerBody influence
- future thrust / tachiai
- future grapple/lift
- complexity
- existing accepted movement feel

Recommend one architecture.

If separate components are recommended, explain why they are distinct physical/runtime concepts rather than duplicate Sources of Truth.

### Q6 — Minimal Parameter Boundary for Push

Recommend what the first Push Prototype needs.

Options may include:

- equal-stat participants first; formula constants only
- introduce only Weight
- introduce Weight + Power
- introduce Weight + Power + LowerBody
- another minimal subset

For each chosen parameter, define only its **semantic role**, not final numeric range/formula.

Example distinction:

- Weight: inertia/resistance contribution
- Power: active pushing effort
- LowerBody: traction / force transfer / resistance

Do not invent full progression values.

Also specify where immutable static attributes belong:
Management future state → copied BoutSetup participant attributes → immutable during Bout.

### Q7 — Push Formula Shape

Do not finalize tuning numbers, but recommend the **shape** of the first formula.

Address:

- active push effort
- attacker parameters
- defender resistance
- relative facing/contact normal
- current velocity / momentum
- simultaneous push from both participants
- no-input defender
- stronger but lighter vs heavier but weaker wrestlers
- avoiding hard-coded archetype matchup bonuses

The design should allow the six future archetypes to emerge from parameters/states rather than `if archetype === ...`.

Specify which quantities are:
- accepted rule semantics
- provisional tuning coefficients
- Deferred

### Q8 — Contact Direction / Facing

Current fighters auto-face each other.

Determine how Push direction is resolved:

- attacker facing direction
- center-to-center contact normal
- movement direction
- combination

Address side contact / glancing contact even if first Prototype simplifies it.

Do not make every contact automatically a full-strength frontal Push unless explicitly justified.

### Q9 — Ring Boundary / Ring-out Geometry

Compare and recommend a simple top-down ring-out criterion.

At minimum compare:

- participant center crosses ring radius
- gameplay contact/support circle touches/crosses ring boundary
- whole gameplay circle leaves ring
- another small criterion

Consider:
- intuitive visual feedback
- edge tension
- current top-down circle abstraction
- future body/foot presentation
- deterministic geometric test
- possibility of later refinement

This is a gameplay rule. If multiple reasonable choices exist and materially change feel, mark a User Decision instead of silently locking one.

### Q10 — Outcome Boundary

Recommend the minimum `BoutOutcome` / finished-state boundary needed for ring-out implementation.

Do not design the full kimarite system.

Address:
- winner/loser identity
- minimal reason/category
- no post-finish movement
- reset/restart responsibility
- Scene vs Simulation ownership

### Q11 — Numerical / Boundary Cases

Specify required tests for the implementation.

At minimum:

- exact touching circles
- slight overlap
- exact same center
- high-speed approach at current max movement speed
- both pushing equally
- one pushes / one neutral
- opposite simultaneous pushes
- diagonal/glancing contact
- participant at ring threshold
- both near/outside boundary same tick
- deterministic replay from same intents
- no NaN/Infinity
- frame partition independence remains intact
- movement feel regression invariants remain intact

If any simultaneous-outcome rule is not designable without User choice, report it.

### Q12 — Prototype Test Harness / User Play Test

Recommend the smallest interactive setup for Push Feel validation.

Examples to compare:

- Player pushes stationary opponent
- opponent holds forward constantly as dummy CPU
- two-keyboard local control
- small toggle/debug mode

Prefer minimal production code and avoid temporary framework.

Define what the User should be able to feel/test:

- first contact
- resistance
- pushing opponent backward
- being pushed / contested
- edge tension
- whether movement baseline survives contact

### Q13 — Minimal Implementation Sequence

Based on findings, propose the next 2–4 Tasks.

Do not bundle all of Contact + Push + Ring-out if splitting gives a safer User Play Test loop.

For each proposed Task:
- exact scope
- technical verification
- User Play Test gate
- prerequisites / User Decisions

## 6. Important Architecture Constraints

Maintain:

```
Input Adapter / CPU
        ↓ semantic Intent
Pure TypeScript BoutSimulation
        ↓ Snapshot / Outcome
Phaser Presentation
```

- Phaser Scene is not gameplay rule Source of Truth
- Phaser Physics / Matter.js remain excluded unless this Investigation finds a Material reason and reports BLOCKED for User review
- fixed timestep remains
- grounded Movement baseline remains
- Simulation logical units remain independent from pixels
- no ECS / DI / Event Bus / generic collision framework
- no full stat system
- no speculative FREE/GRAPPLED/LIFTED implementation

## 7. Scope Out

Do NOT implement or fully design beyond necessary boundaries:

- Production collision code
- Production push code
- ring-out code
- keyboard action binding
- thrust left/right
- pull/counter
- Tachiai
- Grapple / Throw / Lift
- Stamina / Balance mechanics
- CPU AI
- Management
- full Rikishi stat progression/ranges
- Animation / Camera / VFX / Audio
- CrazyGames SDK
- new dependency
- source refactor

Current Source problems found during investigation are reported, not fixed.

## 8. Stop Conditions

Return reportable BLOCKED if:

- Current Source / Review / Accepted Movement baseline materially conflict
- Push architecture cannot be chosen safely without a User gameplay decision
- Ring-out semantics require a User choice before Production implementation
- Grounded locomotion and external push cannot coexist without a Material movement redesign
- Physics engine adoption appears necessary
- a prototype experiment requiring Production Source change is necessary before choosing the architecture
- Scope expansion is required

Git Safety / Preflight STOP follows AGENTS.md and produces no repository write.

## 9. Investigation Method

Inspect at minimum:

- `src/game/sumo/BoutTypes.ts`
- `src/game/sumo/BoutSimulation.ts`
- `src/game/sumo/BoutSimulation.test.ts`
- `src/game/sumo/FixedStepAccumulator.ts`
- `src/game/input/movementVector.ts`
- `src/game/scenes/BoutScene.ts`
- `docs/ARCHITECTURE.md`
- `docs/GAME_CONCEPT.md`
- `AGENTS.md`
- previous Final Review / User Play Test Handoff

External research is optional.
If real sumo rules or physics references are used, distinguish:
- real-world fact/reference
- proposed game abstraction
- accepted project rule

Do not silently turn real sumo detail into game specification.

## 10. Verification

Investigation / Design Review.

Required:

- Q1〜Q13 all answered, or explicit BLOCKED point
- Recommendation / Rejected / Deferred clearly separated
- User Decisions Required explicitly listed
- Accepted Rule vs Prototype Tuning clearly separated
- Production Source unchanged
- package / lockfile unchanged
- repository change only `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- `git diff --check` PASS

`pnpm test` / `pnpm build` not required unless Source integrity concern appears.

## 11. Completion Report

Use Investigation-only Report Commit Exception.

Minimum sections:

- Result
- Preflight
- Current Source Findings
- Q1〜Q13
- Recommended Contact Model
- Recommended Push/Momentum Architecture
- Recommended Parameter Boundary
- Recommended Ring-out Rule / alternatives
- Fixed Tick Resolution Order
- Accepted Rule Semantics vs Provisional Tuning
- Required Boundary Tests
- Prototype User Play Test Plan
- Rejected / Deferred alternatives
- Design Conflicts / Ambiguities
- User Decisions Required
- Next Implementation Sequence
- Design Deviations
- Unexpected Scope
- Verification
- Git delivery

Result:
- PASS: safe recommendation exists and implementation can proceed after any explicitly non-blocking decisions
- BLOCKED: User decision / prototype evidence is required before safe implementation
- PARTIAL / FAIL as AGENTS defines

## 12. User Play Test

NOT REQUIRED for Investigation itself.

Completion Report must identify the earliest subsequent Implementation Task where Push / Contact Feel becomes a REQUIRED User Play Test gate.

## 13. Git Delivery

If Preflight succeeds and investigation reaches a reportable conclusion:

- change only `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- explicit stage
- `git diff --check`
- one Report-only commit
- push `origin/develop`
- verify remote SHA / clean working tree

Commit message example:

`docs(agent): investigate push contact architecture`

## 14. Final Instruction

This Task ends at investigation/design.

Do not implement Contact / Push / Ring-out.

After Report Commit / Push, stop and report:

「ACTION-03-PUSH-CONTACT-COLLISION-INVESTIGATION が完了し、ChatGPT Review待ちです」
