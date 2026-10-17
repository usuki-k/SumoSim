Task-ID: ACTION-03-PUSH-CONTACT-COLLISION-INVESTIGATION
Status: REVIEWED
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


# Final ChatGPT Review

Overall Result: PASS WITH CORRECTIONS

## Accepted Baseline

- Investigation report commit: `bdffe83384ddc1c434654b1733aecd7547eb3606`
- Agent-Start-Head: `43c8085a6fe2326675ac8e2661fd247ad0618a3e`
- Agent Task Diff is exactly one Report-only commit.
- The only changed repository file is `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`.
- Production Source / package / lockfile were not changed.
- ACTION-02B grounded Movement Feel remains the accepted current baseline.

## Accepted Decisions

- Keep custom Pure TypeScript gameplay contact/push logic; do not adopt Phaser Arcade Physics or Matter.js for Gameplay Core.
- FREE contact uses a Simulation-owned circle representation.
- Initial gameplay body radius may use a single provisional equal value (0.35 m), distinct from future sprite/art size semantics.
- Scene must render gameplay body geometry from Snapshot/state rather than owning collision radius as a gameplay rule.
- Initial collision/separation is explicit deterministic two-circle math; no generic collision framework.
- Use a small CONTACT_SLOP to stabilize resting contact.
- Equal-center contact must have a deterministic fallback normal and never produce NaN/Infinity.
- ACTION-03A uses equal participants and symmetric overlap separation. Participant-specific mass weighting is deferred until a Task actually introduces mass.
- Closing self-locomotion velocity into the contact normal should be removed at solid contact so Snapshot velocity does not claim motion through the opponent.
- CCD is deferred while fixed-step displacement remains safely below the body-diameter boundary; this must be protected by tests and revisited when faster Tachiai/impulse states are added.
- For Push/Momentum architecture, accept Model B as the future direction:
  - self locomotion velocity = footwork / accepted grounded movement
  - external velocity = opponent-induced impulse/momentum
  - actual displacement uses their sum
  - these are distinct runtime concepts, not duplicate Sources of Truth
- Existing ACTION-02B self-locomotion behavior must remain unchanged when no contact/external force exists.
- Push force should act primarily along the contact normal, not via sprite/facing position hacks.
- First Push prototype should use equal participant physical constants; Weight / Power / LowerBody-derived differences are deferred until the push interaction itself is accepted.
- No archetype-specific matchup bonuses. Future archetypes should emerge from parameters/state/intent.
- Bout outcome remains Simulation-owned; Scene/flow handles presentation/restart.
- Implementation sequence is accepted in principle:
  1. ACTION-03A Contact & Separation
  2. ACTION-03B Push & External Momentum
  3. ACTION-03C Ring-out & Outcome
  4. ACTION-03D Body Parameters
- Each interaction step has its own User Play Test gate rather than bundling the entire action core.

## Corrections

### C-1 — Do not add unused externalVelocity or mass placeholders in ACTION-03A

The Report proposes that ACTION-03A introduce the Model B `externalVelocity` container while it remains permanently zero, and references mass-ratio separation while participants are still equal.

This would violate the current small-explicit / no-speculative-placeholder discipline.

For ACTION-03A:
- implement gameplay `bodyRadius`
- contact detection
- CONTACT_SLOP
- deterministic fallback normal
- symmetric overlap separation
- closing **self** velocity removal
- minimal stationary / walk-toward dummy behavior needed for contact testing

Do **not** add `externalVelocity`, `mass`, `pushForce`, or `traction` yet.

Introduce `externalVelocity` in ACTION-03B, where external momentum/impact actually exists.
Introduce mass/push/traction constants only when the Push implementation needs them.

This does not reject Model B; it defers its concrete field until first use.

### C-2 — Q7 Push formula is a Prototype design direction, not permanent accepted game balance

The Report's Q7 formula shape is useful and sufficiently concrete for a future ACTION-03B prototype, but the following are not permanent accepted rules yet:

- exact passive/braced resistance semantics
- WALK_PRESSURE
- IMPACT_TRANSFER behavior
- exact resistance subtraction shape
- any numeric coefficients

Treat them as prototype semantics/tuning subject to Push User Play Test.

The durable accepted architecture is:
- semantic press input
- contact-normal force resolution
- self vs external motion separation
- deterministic fixed-tick resolution
- parameter-driven behavior without archetype conditionals

### C-3 — Ring-out semantics remain pending User decisions

Do not treat support-circle ring-out or simultaneous ring-out handling as accepted rules yet.

D3 and D4 remain User decisions required before ACTION-03C.

## User Decisions Required

The following decisions are preserved from the Investigation:

- D1 — Push input semantic before ACTION-03B
  - Recommended: hold / continuous pressure
- D2 — Prototype press key before ACTION-03B
  - Recommended: ArrowUp (temporary binding only)
- D3 — Ring-out criterion before ACTION-03C
  - Recommended: support-circle criterion with provisional ratio
- D4 — simultaneous ring-out before ACTION-03C
  - Recommended: deeper-out participant loses; exact tie = redo

No User decision is required before ACTION-03A.

## Do Not Reopen

- Do not reopen accepted grounded Movement Feel without new evidence.
- Do not introduce Phaser Physics / Matter.js.
- Do not derive gameplay collision from sprite size.
- Do not add a generic collision/contact framework for two participants.
- Do not add full Rikishi attributes before Push interaction is proven.
- Do not add Balance/Stamina/Tachiai/Grapple systems into Contact work.
- Do not introduce archetype-specific matchup branches.
- Do not implement Ring-out during ACTION-03A or ACTION-03B.

## Deferred

- externalVelocity concrete state until ACTION-03B
- mass / pushForce / traction until ACTION-03B prototype constants
- Weight / Power / LowerBody attribute derivation until ACTION-03D design/implementation
- Push input/key decisions D1/D2
- Ring-out decisions D3/D4
- CCD
- lateral push force
- Balance / Stamina
- Tachiai / thrust / pull / counter
- Grapple / Throw / Lift
- kimarite

## User Play Test

ACTION-03 Investigation: NOT REQUIRED.

ACTION-03A Contact & Separation: REQUIRED, focused on:
- bodies no longer passing through each other
- resting contact stability / jitter
- whether contact feels unnaturally rigid
- whether glancing movement / circling around the opponent is still possible
- whether accepted non-contact Movement Feel is preserved

ACTION-03B Push: REQUIRED and is the first full Push Feel gate.

## Regression Risks

- Separation logic accidentally changing accepted movement when participants are not in contact.
- Contact correction creating jitter or a sticky invisible wall.
- Closing-velocity removal eliminating tangential movement and preventing natural circling.
- Future external momentum being damped by grounded self-locomotion if Model B boundary is not preserved.
- Gameplay body radius becoming coupled to sprite scale/presentation.
- Prototype push coefficients being mistaken for final balance.

## Next Task Constraints

The next Task may be ACTION-03A Contact & Separation without further User decisions.

ACTION-03A must remain narrow:
- Simulation-owned equal body radius
- deterministic contact detection
- CONTACT_SLOP
- symmetric overlap separation
- closing normal self-velocity removal
- minimal contact test harness
- no Push / impact transfer / externalVelocity / mass attributes / Ring-out

Technical Verification must include exact touch, slight overlap, same-center fallback, head-on high-speed approach, glancing contact, prolonged resting contact, determinism, finite values, and full no-contact ACTION-02B movement regression.

User Play Test is required before proceeding to ACTION-03B.
