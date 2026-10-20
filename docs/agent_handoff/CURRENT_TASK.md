Task-ID: TOKUDAWARA-RINGOUT-INVESTIGATION-01
Status: READY
Task-Type: INVESTIGATION / SUMO CORE RULE / RING BOUNDARY + PRODUCT ART
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 791fb16b1934a68d2840404809d1e17d32e70904
Handoff-Mode: GITHUB

# TOKUDAWARA-RINGOUT-INVESTIGATION-01 — Tokudawara Visual vs Ring-out Boundary Investigation

## Purpose

Investigate whether SumoSim should implement Tokudawara:

A. visually only, while keeping the current circular Ring-out boundary

or

B. both visually and in the Ring-out boundary / first-out calculation.

The User preference is:

- if Ring-out support is reasonably small, local, deterministic, and compatible with the current architecture, implement it in a later Task
- if it materially complicates gameplay/core rules or creates disproportionate risk, visual-only Tokudawara is acceptable

This Task is INVESTIGATION ONLY / NO FIXES.

Do not change Production code, art-tool code, or runtime assets.

## Current Accepted Baseline

### Product arena / art
- Product arena direction accepted
- Product arena alignment accepted:
  - `--arena-scale 1.072`
  - `--arena-offset-x 5.36`
  - `--arena-offset-y 77.72`
- exact ring overlay is generated deterministically by `tools/dohyo_art/`
- gameplay/art-space center remains fixed
- current exact ring is circular
- Phaser integration of Product background has NOT started yet

### Current Ring-out gameplay
Accepted existing rule:
- participant **center** determines Ring-out
- exact current circular boundary is IN
- `distance > arena.radius` is OUT
- first participant out loses
- if both cross during the same fixed tick, compare previous resolved P0 -> current resolved P1 boundary-crossing fractions
- only equal/effectively equal crossing times are simultaneous Rematch
- technical epsilon only; no gameplay near-simultaneous window
- post-outcome step is a no-op / final physical state preserved
- no wall/clamp
- Outcome remains Simulation-owned

Important:
The User has already stated that Gameplay is not permanently frozen. Product visuals may justify later gameplay changes.

## User Goal

Decide whether a Tokudawara-aware Ring-out implementation is practical enough to adopt now.

Do not optimize for historical realism at any cost.

Prefer:
- small explicit design
- deterministic Pure TypeScript
- clear tests
- direct correspondence between visual boundary and gameplay boundary
- minimal disruption to accepted BoutSimulation architecture

## Required Reading / Direct Source Inspection

Read at minimum:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/ARCHITECTURE.md`
- `docs/GAME_CONCEPT.md`
- current `CURRENT_TASK.md`
- current `CURRENT_COMPLETION_REPORT.md`
- `src/game/sumo/BoutTypes.ts`
- `src/game/sumo/BoutSimulation.ts`
- current Ring-out helper/module(s), including `ringOut.ts`
- related Ring-out tests
- `src/game/scenes/BoutScene.ts`
- `src/game/scenes/DohyoView.ts`
- `tools/dohyo_art/compose_dohyo.py`
- `tools/dohyo_art/README.md`

Review Handoff does NOT replace Current Source inspection.

## Investigation Scope

### Q1 — Current Ring-out ownership
Document exactly:
- which module owns the current boundary test
- which module owns first-crossing interpolation
- how previous/current positions are passed
- how simultaneous crossing is resolved
- where arena radius is stored
- which tests protect these semantics

### Q2 — Tokudawara physical/visual abstraction needed for the game
Do NOT attempt to model every historical construction detail.

Define the smallest gameplay-relevant abstraction for SumoSim.

At minimum investigate:
- number / placement of Tokudawara sections required for the intended visual
- whether they are best understood as local outward boundary extensions from the base circle
- whether all Tokudawara use one shared extension depth / angular width for Product v1
- which exact dimensions remain User/Art tuning values rather than fixed rules

Do not silently pick final real-world dimensions unless Current SPEC already defines them.

### Q3 — Visual-only option
Evaluate:
- exact changes required in `tools/dohyo_art`
- whether gameplay remains a circle
- where visible Tokudawara would differ from the actual Ring-out boundary
- how large that visual/gameplay mismatch could be
- whether a wrestler could appear visibly inside a Tokudawara extension but already be OUT, or visibly outside the normal circle but still appear playable
- whether this is acceptable for Product quality

Give a clear recommendation, not just pros/cons.

### Q4 — Visual + Ring-out option
Investigate the smallest Pure TypeScript boundary representation that can support Tokudawara.

Compare at minimum:

#### Option A — angular allowed radius
Concept:
`allowedRadius(theta)`

Base:
- normal angle -> arena radius
- Tokudawara angle window -> slightly larger allowed radius
- transition shape may be step, smooth interpolation, or piecewise geometry

Assess:
- clarity
- first-crossing math
- discontinuities at Tokudawara side edges
- exact-boundary semantics
- simultaneous-crossing calculation

#### Option B — explicit closed boundary / segments
Examples:
- circular arcs + line/arc Tokudawara segments
- polygon / sampled closed path only if justified

Assess:
- point-inside/outside
- segment intersection for P0 -> P1
- exact crossing fraction
- determinism
- maintainability

#### Option C — any simpler representation directly suggested by Current Source

Do NOT propose a generic geometry engine unless truly required.

### Q5 — First-crossing interpolation
This is critical.

Current accepted semantics compare P0 -> P1 crossing fraction during the fixed tick.

For each viable Tokudawara boundary representation, explain how to compute:

`first t in [0,1] where P(t) becomes OUT`

with:
`P(t) = P0 + t(P1-P0)`

Requirements:
- deterministic
- exact boundary remains IN unless design deliberately changes it
- handles a path crossing a normal circular section
- handles crossing a Tokudawara section
- handles crossing near the Tokudawara side transition
- supports comparing Player/CPU first-out times in the same tick
- preserves Rematch only for effectively equal first crossings

If this requires approximate sampling, quantify and justify it.
Prefer analytic/piecewise solutions if they remain small and readable.

### Q6 — State / type ownership
Investigate whether current `arena.radius` is enough.

Possible future shapes may require an arena boundary specification.

Recommend the smallest type change if needed.

Examples only, not mandated:

```ts
type ArenaBoundary =
  | { kind: 'circle'; radius: number }
  | { kind: 'tokudawara'; radius: number; ... }
```

or retaining:
```ts
arena: {
  radius: number
  tokudawara?: ...
}
```

Compare:
- migration cost
- current tests/setup impact
- avoiding duplicate geometry SoT
- art-tool/runtime handoff.

Do not redesign unrelated `BoutSetup`.

### Q7 — Shared geometry between Simulation and Python art tool
This is important.

We need visual Tokudawara and gameplay Tokudawara to agree.

Investigate the smallest practical contract for shared parameters.

Possibilities:
- one documented set of numeric constants copied intentionally to both systems with tests/manual verification
- checked-in JSON geometry spec consumed by both TypeScript and Python
- another small explicit method

Assess whether introducing a shared JSON/config file is worth it NOW.

Avoid adding a cross-language configuration framework unless it materially prevents mismatch.

### Q8 — Art-tool impact
Explain how `tools/dohyo_art` would need to change to render Tokudawara.

Determine whether the existing pure annulus mapping can be adapted by:
- a modified mask / distance field
- separate Tokudawara pieces composed over the base annulus
- another small deterministic method

Do not implement.

Important:
- arena alignment values remain fixed
- base accepted arena should not need regeneration solely for Tokudawara
- Product source `tawara_source.png` should ideally remain reusable

### Q9 — Phaser/rendering impact
Determine whether Phaser runtime integration later needs special gameplay logic.

Preferred:
- Simulation owns boundary/outcome
- Product background/overlay visually matches it
- Scene does not reimplement Tokudawara rule

State whether any debug geometry overlay should visualize the actual Tokudawara boundary for verification.

### Q10 — Test impact
If Ring-out supports Tokudawara, enumerate required focused tests.

At minimum consider:
- normal circular section exact boundary IN
- normal section just OUT
- each Tokudawara exact outer boundary IN
- each Tokudawara just OUT
- Tokudawara center line
- both side edges / transition boundaries
- path starts IN -> ends OUT across normal section
- IN -> OUT across Tokudawara
- path crossing near side transition
- Player first
- CPU first
- same-tick different crossing fractions
- effectively equal crossing -> Rematch
- both remain IN
- participant starts OUT invariant behavior (do not silently redesign it)
- all Tokudawara positions / symmetries required by the selected model

If there are four Tokudawara, do not sample only one if directional symmetry is not guaranteed by code.

### Q11 — Complexity classification
Classify Visual + Ring-out as one of:
- SMALL / safe
- MODERATE / manageable
- LARGE / defer

Base this on Current Source, not theory.

Include:
- approximate files/modules affected
- whether `BoutSimulation` itself needs major changes
- whether current first-crossing helper can be extended locally
- expected verification level
- regression risks

### Q12 — Level recommendation
Compare:

#### Level 1
Visual Tokudawara only

#### Level 2
Visual + Ring-out boundary

#### Level 3
Visual + Ring-out + collision/edge-interaction gameplay

Recommend one for the next implementation.

Current User preference:
- choose Level 2 if reasonably straightforward
- Level 1 is acceptable if Level 2 is materially risky
- Level 3 should normally remain Deferred unless surprisingly necessary

### Q13 — Suggested implementation split
If Level 2 is recommended, decide whether the safest implementation sequence is:

A.
1. Simulation Ring-out shape
2. Review
3. Art-tool Tokudawara rendering
4. visual composite check

or

B.
1. shared geometry contract
2. Simulation + art tool in one Task

or another split.

Prefer investigation/review between high-risk gameplay changes and Product-art integration when useful.

### Q14 — Gameplay consequences
Call out any semantic differences introduced by Tokudawara Ring-out.

Examples:
- participant survives slightly farther outward at specific angular regions
- simultaneous crossing order can change near Tokudawara
- current center-based Ring-out remains center-based, just with a non-circular allowed boundary

Do NOT implicitly introduce:
- foot/contact Ring-out
- ground-touch rule
- collision against tawara
- wall physics
unless explicitly required.

### Q15 — Recommended next Task
Provide a concrete next Task recommendation:
- name / purpose
- Investigation result assumptions
- Scope
- Scope Out
- Verification level
- User Play/Visual Gate

Do not implement it.

## Important Constraints

### No production fixes
This Task is Investigation Only.

Do not change:
- `src/`
- `tools/dohyo_art/`
- package/lock
- Product local images

### Current visual baseline
Do not reopen accepted arena alignment:
- scale 1.072
- offset X 5.36
- offset Y 77.72

unless Current Source reveals a material contradiction.

### Gameplay not immutable
Previously accepted circular Ring-out is allowed to be changed in a later explicit implementation Task if Tokudawara Level 2 is selected.

But do not implement during this Investigation.

## Stop Conditions

STOP / report BLOCKED if:

- Current Source contradicts the accepted Ring-out handoff in a material way
- first-crossing semantics cannot be retained without a major redesign
- the real Tokudawara visual requirement is too ambiguous to define a gameplay shape at all
- adding Level 2 would require a broad generic collision/boundary framework
- the art-tool and Simulation cannot reasonably share equivalent geometry
- an important rule decision from the User is required before a technical recommendation can be made

Do not guess through a material ambiguity.

## Verification

Investigation-only.

Required:
- direct Source inspection
- current Ring-out tests inspected
- current art-tool geometry inspected
- options compared concretely
- no Production Source/tool changes
- package/lock unchanged
- repository change only:
  `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- `git diff --check` PASS

Tests/build are not required unless needed for a focused investigation experiment.
If any temporary experiments are run, do not commit them.

## Completion Report

Include:

- Result
- Preflight
- Current Ring-out Source Findings
- Current Art-tool Geometry Findings
- Tokudawara Gameplay Abstraction
- Visual-only analysis
- Visual + Ring-out analysis
- boundary representation comparison
- first-crossing design
- state/type ownership
- cross-language geometry contract recommendation
- art-tool impact
- Phaser/debug impact
- full test matrix
- complexity classification
- Level 1 / 2 / 3 comparison
- recommended next implementation split
- Gameplay semantic changes
- User Decisions Required, if any
- Deferred
- Design Deviations
- Unexpected Scope
- Verification
- Git delivery

## User Play / Visual Test

NOT REQUIRED for Investigation.

If Level 2 is later implemented:
- automated Heavy/Standard verification as appropriate for Ring-out core
- Product composite visual check
- User Play Test after runtime integration

will be required.

## Git Delivery

Investigation-only Report Commit Exception.

Change only:
`docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

Suggested commit:
`docs(agent): investigate tokudawara ring-out`

Push `origin/develop`.
Do not modify `main`.

## Final Instruction

Stop after Investigation.

Do not implement Tokudawara in Simulation or the Python compositor.

After commit/push/report:
「TOKUDAWARA-RINGOUT-INVESTIGATION-01 が完了し、ChatGPT Review待ちです」
