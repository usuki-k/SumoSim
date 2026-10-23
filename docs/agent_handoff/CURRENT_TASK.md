Task-ID: ACTION-13A-GRAPPLE-THROW-INVESTIGATION
Status: REVIEWED
Task-Type: INVESTIGATION / DESIGN
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: fe27c90e63fe384edfe556669f3eb92d32019b83
Review-Handoff: ACTION-12B is accepted: GRAPPLED + both READY uses WASD tangential footwork at 90 deg/s, ArrowUp remains Drive, TURNING blocks manual rotation, canonical bond is 0.70 m, existing ring-out remains authoritative. ACTION-11N remains the accepted Grip visual baseline. Do not modify either in this Investigation.
Handoff-Mode: GITHUB

# ACTION-13A — Grapple Throw Investigation / Design

## Purpose

Investigate and design the first Grip Throw gameplay for SumoSim.

This Task is Investigation / Design only.

NO Production implementation.

The design must be implementation-ready for a later Throw Core Gameplay task, while keeping the first prototype small enough to verify through User Play Test.

Only `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md` may be changed/committed under the AGENTS.md Investigation-only Report Commit Exception.

---

# Authoritative User Requirements

Treat the following as current requirements unless Current Source reveals a material conflict.

## Controls

While GRAPPLED:

- ArrowLeft = throw to the wrestler's OWN left.
- ArrowRight = throw to the wrestler's OWN right.
- This should feel consistent with the existing world-space understanding created by WASD grapple rotation.

The exact world vector must be derived from that participant's canonical facing / grapple geometry, not from screen-side assumptions.

## Neutral Grip

Throw is allowed from a neutral Grip.

Morozashi is NOT required to access Throw.

## Morozashi

Morozashi should improve Throw in two ways:

1. increase the probability that the Throw becomes an immediate KO / fall finish;
2. if the Throw is NOT an immediate KO, increase the amount the opponent is thrown/displaced sideways.

Exact values are not yet decided.

Do not invent permanent balance numbers.

## KO / Non-KO

A Throw has two broad outcomes:

### Immediate KO
- the thrown opponent falls;
- the bout is decided even if the opponent remains inside the dohyo;
- the final KO decision is probabilistic.

### Non-KO
- the opponent is thrown / displaced to the requested left or right;
- this displacement may itself create an ordinary ring-out through the existing ring-out rules.

## Throw KO Probability

The Throw KO probability should be calculated before the bout, not continuously recalculated during the bout.

The UI does NOT need to display a live throw success percentage during the bout.

Future Management / wrestler parameters may determine the probability, but those parameter formulas do not exist yet and MUST NOT be invented in this Task.

The Investigation must define the boundary by which the Bout receives already-computed Throw capability.

## Deterministic Randomness

The User is open to either:

- a random determination when Throw occurs; or
- pre-generating approximately the first 20 Throw results and consuming / looping them.

However, the implementation must preserve deterministic / testable gameplay.

Do NOT recommend direct `Math.random()` inside core gameplay.

Investigate a deterministic approach that avoids participant-order / resolver-order dependence and avoids an obviously short repeating pattern if possible.

## Knockdown / Fall

A Throw KO adds a new non-ring-out finish: the opponent is considered fallen / defeated.

The Gameplay result and later visual fall animation should remain architecturally separated.

## Simultaneous Throw Inputs

Resolve both participants from one tick-local state, not by resolver call order.

### Throws toward opposite WORLD directions
Current intended behavior:
- they contest / stalemate ("Draw");
- neither should arbitrarily win because its resolver ran first.

Interpret "Draw" as an action-level Throw stalemate unless a Current Source conflict makes a Bout-level rematch necessary.

If this interpretation is materially ambiguous, report it explicitly.

### Throws toward the same WORLD direction
Future rule:
- the wrestler with the stronger Throw parameter wins.

Current prototype has no Throw parameter.

The User considers "both wrestlers move in that same direction" more natural than an arbitrary winner if their Throw strength is equal / absent.

Investigate and recommend a minimal prototype rule that can later accept Throw strength without redesign.

## Drive

Throw is NOT allowed while the participant is currently contributing Drive.

A Throw edge during an ineligible Drive state must not queue for later.

## TURNING

User preference:
- Throw should ideally be possible while TURNING.

But:
- if supporting TURNING Throw materially complicates the first prototype, it may be restricted to READY initially.

Investigate both.
Recommend whether v1 should:
A. allow Throw while TURNING, or
B. require READY.

Do not silently choose; justify the recommendation against current ACTION-05B1 / ACTION-12B ownership.

---

# Required Reading

Inspect Current Source, not only previous Handoffs.

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
- Bout Grip / Orientation / Drive / RingOut / ACTION-12B rotation tests
- result / HUD formatting code that currently assumes ring-out as the only finish reason.

Confirm the actual current file names and ownership.

---

# Current Baseline to Confirm

Report whether all of these are true:

1. ArrowLeft / ArrowRight currently feed Tsuppari press latches.
2. Tsuppari only starts in FREE state.
3. GRAPPLED currently ignores those Tsuppari action edges.
4. ArrowUp held is Drive while GRAPPLED.
5. Drive action state is timerless and re-decided every tick.
6. Grip release uses Shift / gripPressed and READY gating.
7. GRAPPLED manual WASD rotation uses both-READY gating.
8. canonical participant positions/facings live only in BoutSimulation.
9. canonical grapple bond is 0.70 m.
10. neutral / Morozashi are stored only in pair-level engagement.
11. BoutOutcome currently has ring-out as its only win reason.
12. Ring-out resolves after all positional changes using previous/final canonical positions.
13. there is currently no production RNG / bout seed / Throw parameter model.
14. result presentation currently formats only the existing outcome reasons.

If materially false, STOP the design and report the mismatch.

---

# Investigation Part 1 — Throw Direction Semantics

Define exactly how own-left / own-right maps to a world direction.

Current coordinate convention:
- +x right
- +y down
- facing = atan2 direction toward opponent while READY.

Investigate the exact local lateral vectors.

For facing unit:
```
f = (cos(facing), sin(facing))
```

A likely candidate in y-down coordinates is:
```
ownLeft  = ( f.y, -f.x)
ownRight = (-f.y,  f.x)
```

Verify against Current Source conventions and ACTION-12B world-direction semantics.

The Completion Report must include concrete fixtures:
- facing right
- facing down
- facing left
- facing up

and show the world vector for Left / Right.

Do not leave sign conventions implicit.

---

# Investigation Part 2 — Input / Intent Ownership

ArrowLeft / ArrowRight already have Tsuppari semantics while FREE.

Compare at least:

## Option I — add Throw semantic edges
Add future semantic fields such as:
- `throwLeftPressed`
- `throwRightPressed`

The same raw ArrowLeft/Right press may feed both Tsuppari and Throw semantic edges, while Simulation consumes only the state-appropriate action.

Evaluate:
- clarity;
- edge duplication;
- queue/drop behavior;
- same raw key mapping to state-specific gameplay;
- touch/gamepad future mapping.

## Option II — reuse Tsuppari edge fields while GRAPPLED
Interpret `tsuppariLeftPressed/rightPressed` as Throw while grappled.

Evaluate:
- semantic naming mismatch;
- test readability;
- future rebinding;
- whether it couples two unrelated actions unnecessarily.

## Option III — generic left/right action edge
Rename / redesign toward a contextual action field.

Evaluate scope impact and whether this is premature abstraction.

Recommend exactly one.

Preference: keep raw keys out of Simulation and keep semantic intent explicit, but do not introduce a generic action framework.

---

# Investigation Part 3 — Throw Eligibility / Action Timing

Define exact eligibility.

At minimum compare:

- GRAPPLED neutral
- GRAPPLED Morozashi holder
- GRAPPLED Morozashi disadvantaged
- participant action idle
- participant action drive
- participant TURNING / READY
- opponent Drive state
- simultaneous Throw edges
- release edge on the same tick
- WASD rotation on the same tick
- ArrowUp Drive hold + Throw edge same tick.

Required User rule:
- a participant currently contributing Drive cannot Throw.

Investigate whether Throw should require both participants not driving, or only the thrower not driving.

Recommend the exact same-tick priority among:
- Release
- Throw
- Drive
- WASD grapple rotation.

Do not allow queueing.

---

# Investigation Part 4 — TURNING Throw

This is a required design comparison.

## Candidate A — READY-only Throw

Advantages to evaluate:
- reuses canActInGrapple;
- own-left/right is unambiguous relative to an opponent-facing canonical orientation;
- preserves ACTION-05B1 progression;
- smaller implementation.

Cost:
- cannot immediately throw from side/rear Grip until auto TURNING finishes.

## Candidate B — TURNING Throw allowed

Investigate:
- what own-left/right means when canonical facing is still not toward opponent;
- whether throw direction uses current facing or pair axis;
- whether Throw cancels automatic TURNING;
- whether Morozashi from Counter Best becomes too immediately powerful;
- whether result is deterministic without a new orientation state.

Recommend A or B for Prototype v1.

If B requires a larger state/transition model, recommend A now and explicitly defer B.

---

# Investigation Part 5 — Throw Resolution Geometry

This is central.

For a NON-KO Throw, the User wants the opponent displaced sideways.

Compare at least these canonical geometry models.

## Geometry A — direct target lateral translation
Move only the target by a fixed left/right vector, then allow existing bond correction.

Evaluate:
- hidden movement of attacker caused by bond correction;
- midpoint shift;
- whether the final direction still reads as a Throw;
- ring-out behavior.

## Geometry B — target orbits around thrower
Keep thrower fixed and move the target around the thrower at the canonical bond radius by a Throw arc / lateral displacement.

Evaluate:
- preserves bond exactly;
- clear "throw opponent to my left/right" meaning;
- pair midpoint changes;
- facing updates needed;
- Grip can remain engaged naturally.

## Geometry C — pair-level lateral transition
Move both wrestlers in a controlled pair transition with target moving farther than thrower.

Evaluate:
- readability;
- whether it feels like a Throw versus ordinary pair translation;
- similarity to same-direction simultaneous Throw.

Recommend one minimal geometry for:
1. one successful non-KO Throw;
2. equal-strength same-world-direction simultaneous Throw if "both move" is selected.

Do not create a physics engine.

---

# Investigation Part 6 — Instantaneous vs Transitioned Throw

Compare:

## Instant resolution
- resolve KO or displacement in one Simulation tick;
- simple;
- but canonical position may visibly snap.

## Short Simulation-owned Throw transition
Analogous in spirit to CounterTransition:
- fixed deterministic duration;
- canonical positions/facing follow a small explicit path;
- input locked during transition;
- ring-out remains Simulation-owned;
- later presentation can animate from canonical state.

Evaluate:
- implementation size;
- Game Feel/readability;
- whether a transition is necessary for User Play Test;
- whether it creates unnecessary complexity before Throw feel is known.

Recommend the smallest approach that still allows meaningful gameplay/visual verification.

Do not design full skeletal animation here.

---

# Investigation Part 7 — Engagement After Non-KO Throw

Compare:

A. Grip remains GRAPPLED after a non-KO Throw.
B. Throw breaks the Grip and returns to FREE.
C. Result depends on advantage / outcome.

Current preferred hypothesis to evaluate:
- non-KO Throw keeps the Grip;
- new canonical positions/facing define the next decision state;
- player can continue WASD rotation / Drive / later Throw.

Assess:
- whether the chosen geometry can preserve bond/readiness;
- whether immediate repeat Throw spam becomes a problem;
- whether a short Throw action/recovery is required.

Recommend exactly one for Prototype v1.

---

# Investigation Part 8 — Throw Action State / Cooldown

The User has not specified timing.

Investigate whether a discrete `throw` ParticipantActionState is necessary.

Compare:

## No Throw action state
Edge resolves immediately.
Potential issue:
- no presentation-readable action phase;
- repeated key presses may resolve too quickly;
- difficult to animate later.

## Small Throw action
Possible phases:
- startup / resolve / recovery
or a simpler fixed transition/recovery.

Do not invent final timing without reason.

Recommend:
- whether a Throw state is needed;
- minimal state shape;
- what locks input;
- when KO/displacement resolves;
- whether non-KO Grip remains active after recovery.

Any numeric timing must be explicitly provisional / User Play Test.

---

# Investigation Part 9 — Pre-Bout Throw Capability Boundary

Do not invent wrestler stats.

Design a minimal interface by which the bout receives already-computed Throw capability.

Compare at least:

## Profile A
```
ThrowProfile {
  neutralKoChance
  morozashiKoChance
  neutralDisplacement
  morozashiDisplacement
}
```

Advantages:
- all effective Throw values are computed before bout;
- BoutSimulation does not know Management parameters.

## Profile B
```
ThrowProfile {
  baseKoChance
  baseDisplacement
}
```
and BoutSimulation applies fixed Morozashi multipliers.

Evaluate:
- "pre-bout calculation" requirement;
- future Management ownership;
- avoiding permanent balance formulas in core.

Also investigate how future `throwPower` for simultaneous same-direction contests should enter without forcing it into v1 prematurely.

Recommend the minimal BoutSetup / participant boundary.

No Management system implementation.

---

# Investigation Part 10 — Prototype Values

Implementation will require actual prototype values even though permanent balance is undecided.

Recommend provisional values/ranges for:
- neutral KO probability
- Morozashi KO probability or boost
- neutral non-KO displacement / arc
- Morozashi non-KO displacement / arc
- optional Throw recovery/transition duration.

Base recommendations on:
- BODY_RADIUS = 0.35 m
- grapple bond = 0.70 m
- current ring radius / Tokudawara geometry
- current Drive speed
- ACTION-12B manual rotation speed.

Do NOT present these as final accepted parameters.

Flag each for User Play Test.

---

# Investigation Part 11 — Deterministic KO Resolution

Compare deterministic approaches.

At minimum:

## RNG A — core-seeded PRNG state
Bout receives a numeric seed; core owns a small deterministic PRNG state.

Evaluate:
- replay determinism;
- simultaneous Throw order;
- snapshot/save implications;
- testability.

## RNG B — per-participant deterministic stream
Each participant has a pre-bout seed / stream and Throw attempt index.

Evaluate:
- participant-order independence;
- simultaneous Throw;
- future save/replay;
- whether extra state is needed.

## RNG C — pre-generated roll/result schedule
BoutSetup receives a sequence of future rolls/results.

Evaluate:
- simplest testing;
- where generation belongs;
- finite sequence exhaustion;
- whether looping ~20 values creates an obvious repeating pattern.

Recommend exactly one.

Requirements:
- no direct Math.random in Simulation;
- same setup/seed + same semantic input sequence => same Throw outcomes;
- simultaneous resolution must not change because participant array order changed;
- unused/ineligible Throw edges must not consume a KO roll;
- stalemated simultaneous Throw should have explicitly defined roll-consumption behavior.

Define whether KO probability comparison is:
```
roll < chance
```
or another exact boundary, including chance 0 and 1.

---

# Investigation Part 12 — Simultaneous Throw Contest

Resolve both participants from one immutable tick-local Throw request state.

First convert each local Left/Right request into a WORLD throw direction.

Then classify.

## Case S1 — opposite WORLD directions
User requirement:
- Throw contest stalemates / Draw.

Design:
- movement?
- action/recovery?
- KO rolls consumed or not?
- engagement stays?
- any cooldown?

Current preference to evaluate:
- no KO roll;
- no displacement;
- Grip continues;
- if a Throw action/recovery exists, both may still pay the commitment.

## Case S2 — same WORLD direction
Future:
- higher Throw strength wins.

Prototype:
- no meaningful Throw stat yet.

Compare:
A. action-level stalemate
B. both wrestlers move in that world direction while Grip persists
C. deterministic arbitrary winner (not preferred)

User considers B more natural.

Recommend one prototype rule and define exact geometry.

## Case S3 — one participant requests Throw
Resolve the normal Throw.

## Case S4 — both inputs from same participant in one tick
If both Left and Right edges are somehow present:
- define deterministic priority or drop both.

Do not leave this to object/property order.

---

# Investigation Part 13 — KO Outcome / Fall Result

Current `BoutFinishReason` only includes `ring-out`.

Design the minimal new outcome semantics.

Candidate:
```
reason: 'throw'
```
or
```
reason: 'fall'
```

Recommend which semantic best represents:
- Throw caused a fall / KO;
- later other techniques may also cause a fall.

Avoid encoding presentation text into Simulation.

Determine:
- whether KO Throw immediately ends the engagement/bout;
- what final canonical position/facing/action is frozen;
- what data later Presentation needs to know throw direction / loser fall direction.

If a one-shot Throw result/event must be retained for presentation, propose the smallest explicit state/result boundary.
Do not introduce a global event bus.

---

# Investigation Part 14 — KO vs Ring-Out Priority

Define exact semantics when a Throw attempt can both:
- pass its KO roll; and
- move the opponent across the ring boundary.

Possible approaches:
1. KO Throw resolves first => reason Throw/Fall.
2. perform non-KO displacement only when KO roll fails; therefore KO and displacement never coexist.
3. always apply displacement and then choose outcome priority.

Current simplest candidate to evaluate:
- roll first;
- KO => finish immediately without non-KO displacement;
- KO fail => perform displacement, then existing ring-out may decide.

Recommend explicitly.

Also cover simultaneous Throw contest + ring edge cases.

---

# Investigation Part 15 — Throw Direction and Existing WASD Rotation

Ensure the design remains coherent after ACTION-12B pair rotation.

Required:
- own-left/right is computed from current canonical orientation on the Throw tick;
- rotating the pair with WASD changes the future world direction of a Throw naturally;
- no cached throw direction survives from before rotation unless a Throw action intentionally locks it.

If Throw and WASD rotation occur on the same tick, define exact priority:
- does Throw direction use tick-start facing?
- or facing after that tick's manual rotation?

Recommend one exact order.

---

# Investigation Part 16 — Drive Interaction

User requirement:
- Drive participant cannot Throw.

Define exact same-tick behavior for:
- ArrowUp already held from previous tick + new Throw edge;
- ArrowUp and Throw edge begin on same tick;
- opponent is Driving but thrower is not;
- both are Driving + Throw edges;
- Throw state / recovery and later Drive.

Recommend whether:
- Throw edge loses to Drive if driveHeld is true; or
- Throw edge has priority and prevents Drive from starting that tick.

User wording strongly implies "Drive中に投げられない", but same-tick start priority is not yet explicit.
Recommend the least surprising rule.

---

# Investigation Part 17 — Release Interaction

Define same-tick priority:
- Shift Release + Throw edge.

Existing Grip release currently precedes Drive and WASD rotation.

Preferred candidate:
- Release wins;
- Throw edge dropped;
- no roll consumed.

Verify against current step ownership.

---

# Investigation Part 18 — Ring-Out / Tokudawara

Non-KO Throw displacement/transition must use canonical positions and existing ring-out ownership.

No Throw-specific ring boundary.

Investigate:
- one throw directly creates ring-out;
- throw movement crosses a Tokudawara window;
- if transition is multi-tick, ring-out checked every transition tick;
- if instant, existing previous/final interpolation semantics apply.

No wall/clamp/bounce.

---

# Investigation Part 19 — Presentation Boundary

Do not create final Throw art in this Task.

Determine what a later Visual Task needs from Simulation:
- participant action = throw?
- direction = left/right?
- throwerId / targetId?
- KO vs non-KO?
- transition progress?
- final outcome reason?

Keep gameplay canonical.
Do not make Phaser Scene infer gameplay outcome from pixels/animation.

Recommend the smallest Snapshot-facing data.

---

# Required Design Alternatives Summary

Completion Report must explicitly compare and choose:

1. input fields:
   - dedicated Throw edges vs reuse Tsuppari vs generic contextual edge
2. TURNING:
   - allowed vs READY-only v1
3. non-KO geometry:
   - target translate vs target orbit vs pair transition
4. throw timing:
   - instant vs Simulation transition
5. engagement after non-KO:
   - retain Grip vs release
6. deterministic probability:
   - seeded core PRNG vs per-participant stream vs pre-generated schedule
7. simultaneous same-world-direction prototype:
   - stalemate vs both move
8. KO outcome semantic:
   - throw-specific vs generic fall reason
9. same-tick Throw vs Drive priority
10. Throw vs WASD rotation order.

Recommend exactly one coherent v1 design.

---

# Required Boundary Cases for Future Implementation Plan

Do not sample these away.

1. neutral READY + Left Throw.
2. neutral READY + Right Throw.
3. pair rotated 90° via WASD, then Left/Right maps to rotated world directions.
4. Morozashi holder Throw.
5. Morozashi disadvantaged Throw.
6. neutral KO roll succeeds.
7. neutral KO roll fails -> non-KO movement.
8. Morozashi KO probability enhancement.
9. Morozashi non-KO displacement enhancement.
10. chance 0.
11. chance 1.
12. deterministic repeated replay.
13. participant-order swap with identical semantic inputs.
14. unused/ineligible Throw edge consumes no roll.
15. Drive + Throw same tick.
16. participant already Driving + Throw edge.
17. opponent Driving while thrower is eligible.
18. Release + Throw same tick.
19. Throw + WASD same tick.
20. TURNING Throw behavior according to recommended v1 rule.
21. both Throw opposite WORLD directions.
22. both Throw same WORLD direction.
23. both Left+Right edges on one participant.
24. same-direction prototype equal-strength behavior.
25. future unequal Throw-strength boundary represented in API/design even if not implemented.
26. non-KO Throw near edge -> ordinary ring-out.
27. Tokudawara crossing.
28. KO Throw near edge -> chosen KO/ring-out priority.
29. Grip state after non-KO Throw.
30. immediate repeat Throw / recovery/cooldown behavior.
31. four cardinal facing directions -> own-left/right mapping.
32. diagonal/arbitrary facing -> own-left/right mapping.
33. Morozashi holder/disadvantaged participant array order swapped.
34. result presentation can distinguish Throw/Fall finish from ring-out.
35. existing ACTION-12B WASD rotation unchanged when no Throw edge.
36. existing Drive unchanged when no Throw edge.
37. existing Tsuppari ArrowLeft/Right behavior unchanged while FREE.
38. existing ring-out-only fixtures unchanged.

Future Implementation must explicitly account for every case.

---

# Suggested Task Split After Investigation

The Investigation must recommend final split, but evaluate this default:

## ACTION-13B — Throw Core Gameplay
Include:
- semantic Throw input
- eligibility / contest
- deterministic KO resolution
- KO outcome
- non-KO canonical movement
- ring-out interaction
- tests / browser smoke.

## ACTION-13C — Throw / Fall Presentation
Include:
- Throw pose/transition visual
- fall/KO presentation
- impact/camera feel if requested
- User Visual Gate.

If the Investigation concludes a Simulation-owned multi-tick Throw transition is necessary for Core correctness/readability, include that transition in ACTION-13B but leave authored art/animation to 13C.

Do not split KO probability into a disconnected later Task if doing so would prevent ACTION-13B from testing the central Throw gameplay hypothesis.

---

# Architecture Constraints

Maintain:

Pure TypeScript Game / Simulation
-> canonical State / Results
-> Phaser Rendering / Input / Animation.

Do not:
- put Throw success probability in BoutScene;
- call Math.random from Scene or Simulation;
- make pixels decide Throw result;
- store duplicate grapple state on participants;
- add global event bus;
- add ECS / physics engine / generic rule engine;
- implement Management stats;
- implement Save;
- redesign ACTION-12B WASD rotation;
- modify ACTION-11N Grip VFX.

---

# Scope

## In Scope

- Current Source inspection
- Throw input ownership
- own-left/right mapping
- Throw eligibility
- TURNING comparison
- Drive/Release/WASD same-tick priority
- non-KO geometry
- Grip retention/release
- Throw action/transition need
- pre-bout Throw capability boundary
- deterministic probability strategy
- simultaneous Throw resolution
- KO/fall BoutOutcome design
- ring-out/Tokudawara interaction
- presentation-facing state boundary
- prototype tuning recommendations
- future Implementation file/test plan.

## Scope Out

NO Production implementation.

Do not change:
- src/**
- public/**
- tools/**
- accepted architecture docs/spec
- Grip visuals
- current gameplay values.

Do not implement Throw.

---

# Stop Conditions

Result BLOCKED / STOP if:

- Current Source materially contradicts the baseline assumptions;
- adding Throw requires redesigning existing engagement ownership before any small prototype can work;
- deterministic KO resolution cannot be made participant-order independent without a broader RNG/save architecture decision;
- TURNING support materially changes ACTION-05B1 and no clean READY-only v1 exists;
- same-direction simultaneous Throw cannot be represented without inventing a full Throw stat system;
- user decision is required on a semantic issue that materially changes the Core implementation.

If BLOCKED, identify the smallest exact User decision needed.

---

# Verification

Investigation-only.

Required:
- Current Source inspection;
- relevant existing tests inspection;
- run focused current tests if useful;
- scratch pure calculations/scripts allowed but not committed;
- no Production source/docs changes.

Allowed repository change:
- CURRENT_COMPLETION_REPORT.md only.

Use AGENTS.md Investigation-only Report Commit Exception.

User Play Test:
- Not Applicable to this Investigation.
- Future Throw Core implementation requires User Play Test.

---

# Completion Report

Must include:

- Result: PASS / BLOCKED
- Current Source findings
- confirmed ArrowLeft/Right current ownership
- own-left/right world-vector formula with cardinal examples
- Input Option I/II/III comparison + recommendation
- exact Throw eligibility
- TURNING A/B comparison + recommendation
- exact same-tick action priority
- non-KO Geometry A/B/C comparison + recommendation
- instant vs transition comparison
- engagement-after-non-KO recommendation
- Throw action state/recovery recommendation
- pre-bout ThrowProfile boundary
- provisional prototype values/ranges
- deterministic RNG A/B/C comparison + recommendation
- exact roll consumption rules
- simultaneous Throw S1–S4 rules
- future Throw strength extension point
- KO/fall BoutOutcome shape
- KO vs ring-out priority
- ring-out/Tokudawara semantics
- Presentation/Snapshot data needed later
- exact future step order
- exact future changed-file candidates
- all 38 future boundary cases mapped to verification
- recommended ACTION-13B / 13C split
- User decisions still required, if any
- Design Deviations: N/A
- Unexpected Scope
- Git delivery.

# Final Instruction

Design the first Grip Throw implementation without writing Production code.

ArrowLeft / ArrowRight mean the thrower's own left / right. Neutral Grip can Throw. Morozashi raises KO chance and non-KO displacement. A Throw either wins immediately by a deterministic probabilistic fall/KO, or moves the opponent sideways and may then ring out through existing rules.

Resolve simultaneous Throws symmetrically from one tick-local state. Opposite world directions stalemate. Same world direction must have a clean prototype tie rule that can later be replaced by Throw-strength comparison.

Throw cannot be used while Driving. Investigate whether TURNING can safely support Throw; if not, recommend READY-only for v1.

Define a deterministic pre-bout Throw capability / KO-roll boundary that does not invent Management stats and does not use Math.random in gameplay.

Return one coherent implementation-ready v1 design and recommended task split.


---

# ChatGPT Review Handoff

Review-Date: 2026-10-24
Overall Result: PASS WITH REVIEW CORRECTIONS — IMPLEMENTATION-READY
Accepted Investigation Baseline: 97cc7672a468e3b6a6d7041184b2cacbae61c179

## Current Source / Scope Review

Accepted:

- Investigation-only scope was respected.
- Agent Task diff changes only CURRENT_COMPLETION_REPORT.md.
- No Production source, tests, assets, or accepted docs were modified.
- Current Source findings match the report.
- Existing focused regression run: 7 files / 145 PASS.

No Source/SPEC material conflict was found.

## Accepted V1 Throw Direction

Own-left / own-right mapping is accepted.

For canonical facing f = (cos(phi), sin(phi)) in +y-down coordinates:

- ownLeft  = ( f.y, -f.x)
- ownRight = (-f.y,  f.x)

ArrowLeft = throw toward ownLeft.
ArrowRight = throw toward ownRight.

Direction is derived from the thrower's canonical facing on the accepted Throw tick. No cached screen-side direction.

## Accepted Input Ownership

Use dedicated semantic edges:

- throwLeftPressed
- throwRightPressed

Do not reuse Tsuppari-named fields as Throw semantics.

The Scene may consume the physical ArrowLeft/ArrowRight latch once and copy the same edge value into:
- Tsuppari semantic fields;
- Throw semantic fields.

Simulation consumes only the state-appropriate semantic action.

No generic contextual-action framework.

## Accepted V1 Eligibility / TURNING Rule

V1 Throw eligibility is participant-local:

- engagement is GRAPPLED;
- release did not win this tick;
- thrower is READY at tick start via existing canActInGrapple;
- thrower's tick-start action is not Drive;
- thrower is not in Throw recovery;
- exactly one of Left / Right Throw edges is present.

Opponent READY is NOT required.

Therefore:

- a READY wrestler may Throw while the opponent is still TURNING;
- a wrestler who is itself TURNING cannot Throw in v1.

This is the accepted small Prototype interpretation of the User preference to allow TURNING Throw where practical.

If User Play Test later shows rear/Morozashi Throw is too strong, the smallest future adjustment is both-READY gating. Do not add that now.

## Accepted Same-Tick Priority

Accepted priority:

Release > Throw > Drive > WASD grapple rotation.

Rules:

- Release + Throw: Release wins; Throw dropped; no roll.
- Already Drive at tick start + Throw: Throw dropped; Drive may continue; no roll.
- ArrowUp and Throw begin on same tick while not already Driving: Throw wins.
- Opponent may be Driving while thrower is eligible.
- Throw + WASD on same tick: accepted Throw uses tick-start facing and suppresses manual WASD rotation for that tick.
- No queueing.

### Review Correction RC-1 — Throw Contest Consumes the Tick

For S1 opposite-world-direction simultaneous Throw:

- no KO roll;
- no displacement;
- Grip remains;
- both participants enter Throw recovery;
- **do not continue into Drive or ACTION-12B WASD rotation on that same tick**.

Reason:
Release > Throw > Drive > rotation means an accepted Throw contest consumes the grapple action opportunity for that tick. The report's proposed step order would otherwise allow WASD rotation after S1 because it continued the normal tick.

Implementation must explicitly return/skip the later Drive + manual-rotation stages for S1 while still performing any required final canonical ring-out/no-op bookkeeping consistently.

S4 (one participant presses both Left+Right and both are dropped) is different: that participant has no accepted Throw request, so normal lower-priority behavior may continue.

## Accepted Non-KO Geometry

Single successful non-KO Throw:

- Geometry B accepted.
- Thrower remains fixed.
- Target orbits around thrower at canonical grapple bond radius.
- ownLeft = negative throw arc;
- ownRight = positive throw arc under current angle convention.
- both canonical facings rotate by the same incremental Throw angle so facing errors remain unchanged.
- Grip remains engaged after non-KO Throw.

This keeps bond exact and makes left/right readable.

Same-world-direction simultaneous equal-strength Prototype contest:

- neither wrestler wins;
- no KO roll;
- pair shifts rigidly in the normalized shared requested world direction;
- Grip remains;
- both pay Throw recovery after the transition.

This is accepted as the v1 placeholder for future Throw-power comparison.

## Accepted Throw Transition

Use a short Simulation-owned pair Throw transition rather than one-tick teleportation.

Accepted reasons:
- meaningful Play Test/readability;
- existing ring-out can run every transition tick;
- avoids a large arc being approximated by one long ring-out chord;
- later Presentation can read canonical progress.

Transition is explicit and small, similar in architectural spirit to CounterTransition.

During an active Throw transition:
- input is ignored / dropped;
- canonical path owns position/facing;
- ring-out is checked every transition tick;
- no Phaser gameplay path.

## Review Correction RC-2 — Existing Action State at Transition Entry

A Throw may start while the opponent is currently Driving.

Therefore implementation must explicitly avoid stale opponent Drive action during the Throw transition:

- when Throw/shift transition begins, any participant action.kind === 'drive' involved in the pair is set to idle immediately;
- Drive does not remain visible/stored while the transition owns movement.

If the target was already in a prior Throw recovery:
- preserve that recovery state and pause its timer while the pair-level Throw transition is active;
- resume the remaining recovery after the transition;
- do not silently cancel or reset that recovery.

The new thrower's own recovery begins after the new transition ends.

This preserves existing committed recovery while correctly stopping timerless Drive.

## Accepted Recovery / Engagement

After non-KO single Throw:
- engagement remains GRAPPLED;
- thrower enters provisional Throw recovery;
- target does not receive a new recovery merely for being thrown;
- any pre-existing target Throw recovery follows RC-2 pause/resume.

During Throw recovery:
- that participant cannot start Throw or contribute Drive;
- Release and ACTION-12B WASD rotation may remain available when existing readiness gates permit.

These are Prototype semantics subject to User Play Test.

## Accepted Pre-Bout Capability Boundary

Use precomputed effective Throw capability; BoutSimulation must not know Management-stat formulas.

Accepted effective profile concept:

- neutralKoChance
- morozashiKoChance
- neutralThrowAngle
- morozashiThrowAngle

Morozashi-disadvantaged thrower uses neutral values.
Morozashi holder uses Morozashi values.

### Review Correction RC-3 — Separate Capability from RNG Seed

Do NOT put koRollSeed inside ThrowProfile.

ThrowProfile is effective gameplay capability computed before the bout.
Random stream identity is match/setup randomness, not wrestler capability.

Preferred minimal boundary:

- ParticipantSetup.throwProfile?: ThrowProfile
- ParticipantSetup.throwKoSeed?: uint32

or an equivalently explicit nested setup shape that keeps:
- effective capability;
- deterministic random seed

semantically separate.

Do not introduce Management or Save infrastructure.

For Prototype fixtures, explicit defaults are allowed only if clearly marked Prototype.

### Prototype Restart Seed Guidance

Do not make every new Prototype bout silently replay the identical first Throw roll forever if User Play Test is meant to judge probabilistic KO feel.

Preferred minimal approach:
- build each Prototype BoutSetup with explicit deterministic per-participant seeds derived from a small Scene-owned prototype bout serial/base constants;
- the seed remains part of the created Bout setup;
- same setup + same semantic inputs still produces identical results;
- no Math.random.

Tests should always pass explicit seeds.

This is Prototype fixture behavior, not a permanent RNG framework.

## Accepted Deterministic KO Strategy

Use participant-specific counter-based deterministic Throw roll streams.

Requirements:

- no Math.random in core;
- participant-specific seed + eligible KO-attempt counter;
- roll in [0,1);
- KO iff roll < chance;
- chance 0 never KO;
- chance 1 always KO;
- only a normal single-participant Throw resolution that reaches KO evaluation consumes that participant's next roll;
- ineligible/dropped requests do not consume;
- S1 opposite-direction contest consumes none;
- S2 equal same-direction shift consumes none;
- participant-array order does not affect rolls/results.

The exact fmix32-style function proposed by ACTION-13A is acceptable if implemented as a small pure deterministic helper with tests.

Hidden Throw roll counters do not need to be presentation Snapshot fields in this Prototype.

## Accepted KO / Fall Outcome

Extend gameplay finish semantics with generic fall plus Throw cause.

Accepted conceptual shape:

- BoutFinishReason includes 'fall';
- fall outcome carries a small Throw cause payload identifying:
  - kind: throw
  - throwerId
  - local side left/right
  - locked world direction

Reason:
- fall can later be caused by techniques other than Throw;
- presentation should not be encoded into the reason string;
- outcome is sufficient as the persistent one-shot result; no event bus.

KO Throw:
- evaluate deterministic roll first;
- on KO, finish immediately as fall;
- no non-KO Throw displacement is applied;
- existing canonical position/facing may freeze at Throw-start state;
- later Presentation owns the visual falling motion.

If KO roll fails:
- start non-KO Throw transition;
- existing ring-out owns any boundary finish during the path.

## Accepted Simultaneous Throw Rules

Resolve requests symmetrically from one immutable tick-local state.

S1 opposite world directions:
- action-level stalemate, not Bout rematch;
- no roll;
- no displacement;
- Grip continues;
- both recovery;
- RC-1: no lower-priority Drive/WASD rotation that tick.

S2 same world direction, equal/no Throw power in v1:
- no roll;
- pair rigid shift in shared direction;
- Grip continues;
- both recovery after transition.

S3 one valid requester:
- normal Throw roll -> KO or non-KO transition.

S4 same participant Left+Right edges:
- drop both requests deterministically;
- no roll;
- the other participant may still resolve as S3 if eligible.

Future Throw power:
- a dedicated same-direction contest helper may later compare power;
- stronger participant becomes the normal S3 Throw winner;
- equal continues to use v1 shared shift.
Do not add a fake Throw-power stat in 13B.

## Accepted KO / Ring-Out Priority

Accepted:

- KO roll first.
- KO success -> fall immediately, no displacement.
- KO failure -> Throw transition.
- transition positions are judged by existing ring-out / Tokudawara every tick.
- no Throw-specific wall/clamp/boundary.

## Accepted Prototype Tuning for Initial 13B

Provisional, User Play Test owned:

- neutralKoChance = 0.15
- morozashiKoChance = 0.35
- neutralThrowAngle = 45 deg
- morozashiThrowAngle = 75 deg
- THROW_TRANSITION_TICKS = 18 (~0.3 s)
- THROW_RECOVERY_TICKS = 30 (~0.5 s)
- THROW_SHARED_SHIFT = 0.30 m
- transition easing candidate = 1 - (1-u)^2

These are not permanent balance decisions.

13B may implement them as explicitly provisional prototype tuning.

## Accepted Step-Order Direction

Future 13B should preserve:

1. cooldown / existing CounterTransition early path
2. active Throw transition early path
3. previous positions
4. posture timer
5. tick-start readiness
6. Release
7. determine grappled
8. Throw request resolution from tick-start state
9. if accepted single/shift Throw starts transition, run its first transition step and return
10. if S1 stalemate, apply recovery and RC-1 consume the tick
11. otherwise existing Drive decision
12. existing ACTION-12B WASD rotation
13. existing self/external update
14. integration/contact/bond/action timers/facing/ring-out

No-Throw path must remain semantically/bitwise compatible with current ACTION-12B behavior.

## Accepted Task Split

ACTION-13B — Throw Core Gameplay:
- semantic Throw edges
- eligibility/priority
- simultaneous contest
- deterministic KO streams
- fall outcome
- Simulation-owned Throw/shift transition
- recovery
- ring-out/Tokudawara interaction
- provisional tuning
- Heavy verification + Browser smoke
- User Play Test required
- minimal outcome formatting only as needed.

ACTION-13C — Throw / Fall Presentation:
- authored/symbolic Throw pose as later decided
- thrown/fall visuals
- impact/camera feel
- presentation polish
- User Visual Gate.

Do not split KO probability out of 13B.

## Verification Requirement for 13B

All 38 ACTION-13A boundary cases remain mandatory.

Add explicit tests for Review Corrections:

RC1. S1 opposite-world contest + simultaneous WASD/Drive:
- no Drive contribution;
- no manual pair rotation;
- both enter recovery;
- no roll.

RC2a. opponent was Driving when single Throw begins:
- Drive action cleared at transition entry;
- no stale Drive state during transition.

RC2b. target already had Throw recovery when new Throw transition begins:
- remaining recovery value is preserved/paused through transition;
- resumes after transition.

RC3. two setups with identical profiles but different explicit seeds:
- capabilities are identical;
- deterministic KO sequence differs;
- seed is not part of ThrowProfile semantics.

Prototype restart seed:
- consecutive generated Prototype setups have explicit different deterministic seeds;
- recreating the same prototype bout serial gives identical seeds/results.

## User Play Test Required After 13B

Judge:

- Left/Right directional understanding;
- READY-side Throw while opponent TURNING;
- whether rear/Morozashi Throw is too strong;
- 15% / 35% KO feel;
- 45° / 75° non-KO displacement;
- 0.3 s Throw motion;
- 0.5 s recovery;
- same-direction simultaneous pair shift;
- opposite-direction stalemate;
- Drive-to-Throw timing;
- repeated Throw pacing;
- edge/Tokudawara risk.

Technical PASS != accepted Throw feel.

## Do Not Reopen

Unless explicitly changed by User:

- ACTION-11N Grip visual baseline;
- ACTION-12B WASD rotation semantics/rate;
- ArrowUp Drive tuning;
- canonical 0.70 m bond;
- existing ring-out / Tokudawara ownership.

## Deferred

- Throw strength parameter and unequal same-direction contest;
- TURNING wrestler's own Throw before READY;
- Management formulas for Throw profile;
- Save/replay system;
- final Throw/Fall art and animation;
- Morozashi balance retuning beyond the provisional profile;
- Touch/Gamepad binding.

## Next Task Constraint

ACTION-13B may proceed from this reviewed design plus RC-1 / RC-2 / RC-3.

If implementation requires changing:
- ACTION-12B canonical rotation ownership;
- Drive semantics beyond the accepted priority;
- existing ring-out ownership;
- engagement model beyond explicit Throw transition/recovery;
- deterministic roll ownership beyond participant-specific Throw streams;

STOP and report rather than silently deviating.
