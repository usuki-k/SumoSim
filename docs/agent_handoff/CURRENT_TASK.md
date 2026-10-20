Task-ID: ACTION-ART-02-HUD-PRODUCT-SPEC
Status: READY
Task-Type: DOCUMENTATION / PRODUCT UI SPEC / ACTION HUD
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: dc3df77c9d8e7463c53292b46b7d8e1c3d5bf4ae
Handoff-Mode: GITHUB

# ACTION-ART-02 — Product HUD Specification

## Purpose

Create the first authoritative Product HUD specification for the SumoSim Bout screen.

This Task is Documentation / Product UI Specification only.

Do NOT implement Phaser HUD in this Task.

The spec must turn the User-approved HUD direction into an implementation-ready information hierarchy while preserving:
- the accepted Product arena
- the accepted wrestler scale
- current gameplay
- Management/Bout state ownership separation
- unresolved Simulation parameter design.

## Current Product Baseline

### Runtime Product arena
ACTION-ART-01B technical integration is PASS.

Current runtime presentation:
- 1920×1080 logical Product art space
- Product arena base + exact Tokudawara overlay
- Simulation origin -> art center (960,540)
- base gameplay radius -> 400 px
- existing provisional wrestler diameter -> about 123 px.

The User reviewed the runtime screenshot and reported:
- wrestler size is not unnatural
- provisional wrestler visual quality is noticeably below the Product background quality bar
- proceed to HUD.

Therefore:
- current wrestler scale is an Accepted presentation baseline
- do not adjust bodyRadius / meter-to-pixel scale for HUD
- wrestler Product-art replacement remains a later task.

The User explicitly instructed the project to proceed to HUD.

Do not infer unreported browser-performance/debug-boundary results from that instruction.

## Reference Direction

The User supplied a real sumo broadcast reference.

Use it only as a reference for:
- instant side-by-side competitor identification
- rank/name/current-record readability
- compact information grouping.

Do NOT copy:
- broadcaster graphics
- sponsor areas
- logos
- exact typography
- exact box shapes/layout
- portrait treatment.

The SumoSim HUD should be its own stylized game UI matching the warm Product arena.

## User-approved Information Architecture

There are TWO different UI surfaces.

### A. Always-visible Bout HUD

Keep this concise during Action.

Required for both wrestlers:
- wrestler name
- current rank
- current tournament / basho record (wins-losses)

Required center/context information:
- current tournament day / day number.

Example semantic data only:
- Rank: 前頭15
- Name: 朝翠龍
- Record: 2-0
- Day: 3日目.

Do not lock these exact fictional names/ranks as content.

### B. Pre-bout comparison presentation

Shown before active Bout gameplay.

Required for both wrestlers:
- name
- rank
- current tournament record
- age
- height
- weight
- all public Simulation / wrestler parameters that exist in the final design.

The User intends Simulation parameters to be openly visible rather than hidden.

Important:
The actual parameter list is NOT decided yet.

The spec must support a variable/extensible list without inventing:
- parameter names
- parameter count
- final numeric ranges
- formulas
- gameplay effects.

## Explicit Product Decisions

### Face portrait
For Product v1 HUD:
**NO wrestler face portrait is required.**

Do not:
- design a random low-quality portrait generator
- require portrait assets
- reserve the layout around an assumed portrait dependency.

The layout should work cleanly with no face image.

Portraits may be reconsidered later as a separate Product-art feature.

### Birthplace
Birthplace is NOT required in the always-visible Bout HUD.

It is a possible future profile field, especially if foreign wrestler backgrounds are later introduced.

Current Task:
- document it as Optional / Deferred
- do not create location-generation rules
- do not create nationality rules
- do not make it a required pre-bout field yet.

### Stamina
Do NOT add a real-time stamina bar or current-depletion meter in this HUD spec.

If/when Stamina exists as a public wrestler/Simulation parameter:
- its parameter VALUE should be visible in the pre-bout public-parameter list like other stats.

Do not define:
- stamina formula
- maximum
- depletion
- recovery
- realtime display.

## Tournament Context

The Product concept uses sumo tournament / basho context.

The User expects:
- current tournament wins-losses to be visible
- current day number to be visible
- top-division style context can have a 15-day tournament
- tournament events are conceptually periodic, including the real-sumo-like two-month rhythm discussed by the User.

However:
- tournament scheduling rules
- calendar/time implementation
- ranking promotion/demotion
- record aggregation
- division rules

are NOT part of this Task.

The HUD spec should consume these values from future Management/Tournament state.

Do not turn presentation requirements into new Simulation rules.

## Architecture Constraint — Critical

Do not put long-term wrestler/tournament metadata into BoutSimulation merely because HUD needs it.

Examples of data that should NOT become Bout runtime physics state:
- age
- height
- weight
- rank
- tournament record
- tournament day
- birthplace
- long-term parameters that belong to wrestler/management data.

Preserve:

```
Management / Wrestler / Tournament State
        ↓
Bout presentation context / view model
        ↓
Phaser HUD
```

separate from:

```
BoutSimulation
        ↓
BoutSnapshot
        ↓
Action rendering
```

The spec should define the smallest future presentation-data boundary needed to combine these sources.

Do not implement that boundary yet.

Do not introduce DI framework, global event bus, generic UI state system, or ECS.

## Required Source Inspection

Read directly:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/ARCHITECTURE.md`
- `docs/GAME_CONCEPT.md`
- current `CURRENT_TASK.md`
- current `CURRENT_COMPLETION_REPORT.md`
- `src/main.ts`
- `src/game/scenes/BoutScene.ts`
- `src/game/presentation/productArena.ts`
- `src/game/sumo/BoutTypes.ts`
- any current presentation metadata / participant presentation code.

Review Handoff does not replace Current Source inspection.

If Current Source materially contradicts this handoff, STOP and report.

## Deliverable

Create:

`docs/ACTION_HUD_PRODUCT_SPEC.md`

This becomes the authoritative Product HUD spec for the current Action prototype.

Update `docs/ARCHITECTURE.md` only if a very small state-ownership note is required to prevent future implementation mistakes.

Do not modify Production Source.

## Required Spec Sections

The new HUD spec must include at minimum:

### 1. Purpose / Product goals
Define the HUD goals:
- immediate opponent identification
- current basho context
- readable Action screen
- public wrestler-information philosophy
- preserve arena readability.

### 2. Information hierarchy
Separate clearly:
- Always-visible Bout HUD
- Pre-bout comparison presentation
- Debug-only Prototype information
- Deferred profile information.

### 3. Always-visible HUD content
Specify required semantic fields:
- East/left wrestler identity area
- West/right wrestler identity area
- rank
- name
- current tournament record
- current day.

Do not require age/height/weight/stats to remain onscreen during action.

### 4. Pre-bout comparison content
Required:
- name
- rank
- current record
- age
- height
- weight
- all public parameters.

Explain how a variable number of parameters should be accommodated conceptually:
- table/list/grid
- no fixed final parameter count.

Do not invent final parameters.

### 5. Data ownership
Classify each field by likely owner/source:

Examples:
- BoutSnapshot gameplay state
- Wrestler/Management profile
- Tournament context
- Presentation-only side assignment/localization.

Do not claim unimplemented systems exist.

Mark future ownership where source is not implemented.

### 6. Product visual direction
Document the approved art direction:

- warm traditional sumo visual language
- warm off-white / paper-like panels
- dark ink-like high-contrast text
- restrained red/blue accents for the two sides
- readable over the detailed Product arena
- stylized game UI, not a TV broadcast copy
- no sponsor/logo treatment
- no face portrait requirement.

### 7. 1920×1080 layout zones
Create a practical wireframe / safe-area proposal for the current Product canvas.

Requirements:
- Action play area remains visually dominant
- avoid covering the central dohyo more than necessary
- always-visible identity blocks should prefer upper left / upper right
- day/context should be compact and centered or otherwise balanced
- should coexist with future wrestler Product art.

Provide proposed zones/relationships in the spec.

Exact pixel values may be:
- Recommended / provisional
rather than irrevocable Product constants.

Clearly label them as such.

### 8. Pre-bout screen layout
Define the side-by-side comparison structure.

It must work:
- without portraits
- with long/short names
- with rank text of varying length
- with variable parameter rows.

Do not specify final transition animation.

### 9. Localization / text robustness
Because CrazyGames distribution is international-facing:

Do not lock the implementation to Japanese-only fixed-width labels.

The spec should distinguish:
- semantic field
- example Japanese display
- localization responsibility.

Do not design a full localization system.

### 10. Stamina decision
Record:
- no realtime stamina depletion bar in current Product HUD
- if stamina becomes a public parameter, display its base/stat value in comparison information.

### 11. Portrait decision
Record:
- no portrait requirement for v1
- random portrait generation Deferred.

### 12. Birthplace decision
Record:
- optional/deferred profile field
- not required for Bout HUD.

### 13. Prototype debug text transition
Current BoutScene contains control/debug/status text.

Specify which current text is:
- debug/development-only
- temporary control help
- actual Product information.

Do not assume current debug strings become Product HUD.

The future implementation should be able to hide/remove prototype text without losing gameplay.

### 14. Accessibility/readability constraints
At minimum:
- sufficient contrast over detailed background
- avoid tiny type at 1920×1080
- do not encode wrestler side only by color
- long name/rank behavior must be specified conceptually
- UI must not hide critical ring edge/Tokudawara action unnecessarily.

Do not create a full accessibility framework.

### 15. Future data contract direction
Recommend the smallest future presentation model.

Example only:

```ts
interface BoutWrestlerPresentation {
  id: ParticipantId
  side: ...
  name: string
  rank: string
  currentRecord: ...
  age: number
  heightCm: number
  weightKg: number
  publicParameters: readonly PublicParameterView[]
}

interface BoutTournamentPresentation {
  day: number
}
```

Do NOT mandate exact field/type names if Current Source suggests a cleaner minimal shape.

Do NOT implement it in this Task.

Do not put these fields inside `ParticipantState`.

### 16. Implementation staging recommendation
Recommend the smallest next implementation sequence.

Expected direction to evaluate:

1. static/prototype Product HUD shell with presentation fixtures
2. User visual check
3. connect future Management/Tournament data when those systems exist

or another minimal sequence.

Avoid blocking Product visual progress on unimplemented full Management systems.

## Important Unresolved Items

Do NOT decide these in this Task:

- final Simulation parameter list
- final wrestler names
- rank progression rules
- tournament progression implementation
- tournament result aggregation rules
- birthplace generation
- nationality system
- portrait generation
- stamina gameplay
- realtime stamina meter
- final touch/mobile layout
- final localization system
- final UI sound/animation.

Mark them explicitly as Deferred / unresolved.

## Acceptance Criteria

The spec is accepted technically if:

1. Always-visible vs pre-bout information is clearly separated.
2. Required User-approved fields are all covered.
3. No final Simulation parameters are invented.
4. Portrait is optional/deferred, not required.
5. Birthplace is optional/deferred.
6. Realtime stamina meter is explicitly out.
7. Public-parameter philosophy is preserved.
8. 1920×1080 layout proposal is concrete enough for implementation.
9. Product art direction is compatible with the accepted arena.
10. Management/tournament metadata is kept out of BoutSimulation.
11. Current prototype/debug text is classified.
12. Deferred decisions are clearly separated from accepted decisions.
13. A minimal next implementation Task is recommended.

## Verification

Lean / Documentation Only.

Required:
- direct Current Source inspection
- documentation consistency check
- no Production Source changes
- no Product asset changes
- no package/lock changes
- `git diff --check` PASS.

No `pnpm test` or build required unless Source is accidentally touched; it must not be.

## Completion Report

Include:

- Result
- Preflight
- Source findings relevant to HUD
- Created/changed docs
- Accepted Product decisions captured
- Always-visible HUD summary
- Pre-bout comparison summary
- data ownership matrix
- layout/wireframe summary
- portrait/birthplace/stamina decisions
- Deferred
- recommended implementation sequence
- User Decisions Required, if any
- Design Deviations
- Unexpected Scope
- Verification
- Git delivery.

## Stop Conditions

STOP/BLOCKED if:

- Current Source already has a conflicting authoritative HUD spec
- required data ownership cannot be described without deciding an unresolved Management architecture
- the task would require Production Source changes
- a missing User decision prevents the HUD information hierarchy itself from being specified.

Do not invent missing gameplay/management rules to complete the document.

## Git Delivery

Documentation-only Task.

Expected task-owned files:

- `docs/ACTION_HUD_PRODUCT_SPEC.md` (new)
- `docs/ARCHITECTURE.md` only if minimally necessary
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`.

Suggested commit:
`docs: specify product bout hud`

Push `origin/develop`.
Do not modify `main`.

## User Visual Gate

NOT REQUIRED for this Documentation Task.

A later HUD implementation/mockup will require User Visual Approval.

## Final Instruction

Stop after the Product HUD specification and Completion Report.

Do NOT:
- implement Phaser HUD
- create HUD image assets
- change Product background
- change wrestler visuals
- implement Management/Tournament systems.

After commit/push/report:
「ACTION-ART-02-HUD-PRODUCT-SPEC が完了し、ChatGPT Review待ちです」
