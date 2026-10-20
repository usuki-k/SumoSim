Task-ID: ACTION-ART-02B-PREBOUT-COMPARISON
Status: READY
Task-Type: IMPLEMENTATION / PRODUCT UI / PRE-BOUT COMPARISON
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: f8ac92652a876b1ec82fe358ad9ed12e88fb91b7
Handoff-Mode: GITHUB

# ACTION-ART-02B — Pre-bout Comparison Screen

## Purpose

Implement the first Product pre-bout comparison screen using explicit English fixture data.

The screen appears before active Bout gameplay and compares the East / West wrestlers side by side.

Required information:

- side
- rank
- wrestler name
- current basho record
- age
- height
- weight
- every public parameter row supplied by the presentation fixture.

This Task is a Product UI / presentation-flow implementation.

It must NOT create Management, Tournament, rank, wrestler-generation, stamina, or Simulation parameter systems.

Final gate:
**User Visual Check.**

## Accepted Baseline — DO NOT REOPEN

### Product language
Initial release:
**English only**

Future multilingual support:
allowed by the existing small presentation/copy boundary.

Do not add:
- language selector
- locale detection
- translation catalog
- external i18n package
- Japanese release resources
- CrazyGames SDK locale integration.

### Always-visible HUD
ACTION-ART-02A1 is Technical + User Visual Accepted.

Preserve the accepted Action HUD shell:

- East / West side pills
- Maegashira rank presentation
- romanized names
- numeric record
- Day chip
- current block sizes / positions
- current warm paper / ink / restrained accent direction
- English-first copy boundary.

Do not redesign the accepted always-visible HUD in this Task.

### Product arena / gameplay
Do not change:
- Product background
- Product overlay
- logical 1920×1080 baseline
- wrestler scale
- inputs / gameplay
- Ring-out / Tokudawara
- Simulation formulas.

## Authoritative Spec

Read and follow:

`docs/ACTION_HUD_PRODUCT_SPEC.md`

Current accepted information hierarchy:

### During active Action
Only:
- side
- rank
- name
- current basho record
- current day.

### Before active Action
Add:
- age
- height
- weight
- all supplied public parameter rows.

Portrait:
not required.

Birthplace:
not required.

Realtime Stamina bar:
not allowed.

Final Simulation parameter list:
unresolved.

## Required Reading / Source Inspection

Read directly:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/GAME_CONCEPT.md`
- `docs/ARCHITECTURE.md`
- `docs/ACTION_HUD_PRODUCT_SPEC.md`
- current `CURRENT_TASK.md`
- current `CURRENT_COMPLETION_REPORT.md`
- `src/game/presentation/boutHudCopy.ts`
- `src/game/presentation/boutHudPresentation.ts`
- related presentation tests
- `src/game/scenes/BoutHudView.ts`
- `src/game/scenes/BoutScene.ts`
- `src/game/sumo/BoutTypes.ts`
- `src/game/sumo/BoutSimulation.ts`.

If Current Source materially conflicts with this handoff, STOP.

## Architecture Constraint — Critical

Keep the comparison data out of gameplay state.

Do NOT add these fields to:
- `BoutSimulation`
- `ParticipantState`
- `BoutSnapshot`.

Use the existing presentation flow:

```
Prototype / future Management presentation data
           ↓
Pure Bout presentation context
           ↓
Phaser pre-bout comparison view

BoutSimulation → BoutSnapshot
           ↓
Action rendering
```

Participant id remains the join key.

The pre-bout waiting/active state is Scene/presentation state, not BoutSimulation state.

No event bus / DI / UI framework.

## Presentation Context Extension

Extend the existing pure HUD presentation context only as much as 02B needs.

### Wrestler profile fields

Add presentation data for each wrestler:

- age in years
- height in cm
- weight in kg.

Recommended shape:

```ts
interface BoutHudWrestler {
  ...
  readonly ageYears: number
  readonly heightCm: number
  readonly weightKg: number
}
```

Exact naming may vary.

These are presentation fixture/profile values, NOT physics state.

Do not connect:
- height to bodyRadius
- weight to Push
- age to gameplay.

### Public parameter rows

The final Simulation parameter model is unresolved.

For this Task, model only what the comparison UI needs.

Prefer a presentation-level comparison row list, for example:

```ts
interface PublicParameterComparisonRow {
  readonly key: string
  readonly label: string
  readonly values: Readonly<Record<BoutSide, string>>
  readonly group?: string
}
```

and:

```ts
interface BoutHudContext {
  ...
  readonly publicParameterRows: readonly PublicParameterComparisonRow[]
}
```

This is presentation data only.

Do not infer how Management stores those parameters.

Do not create:
- stat enums
- ranges
- formulas
- gameplay effects.

If Current Source supports a smaller equivalent shape, use it and report it.

## Fixture Data

Extend the existing English prototype fixture.

Suggested physical profile fixture values:

East / Asuiryu:
- age: 26
- height: 175 cm
- weight: 120 kg.

West / Toshinofuji:
- age: 29
- height: 183 cm
- weight: 148 kg.

These are sample presentation values only.

### Public parameters

Use clearly placeholder rows.

Do NOT use plausible final gameplay-stat names such as:
- Power
- Technique
- Balance
- Stamina

because the final parameter list is unresolved.

Use unmistakable prototype labels, e.g.:

- `Sample Stat A`
- `Sample Stat B`
- `Sample Stat C`
- etc.

Values can be simple display strings such as:
- `72`
- `64`.

Recommended fixture count:
6–8 rows.

Source comments must explicitly say:
**prototype comparison-layout data; not final game parameters.**

The runtime comparison must render all fixture parameter rows.

Do not silently hide/truncate rows.

## Variable Parameter Count

The renderer must not hard-code a specific parameter count.

Required:
- iterate over the supplied list
- support at least 0, 1, 6–8, and 12 rows in focused layout/presentation tests where practical
- current Product fixture may use 6–8 rows.

The final behavior when there are too many rows for one screen remains Deferred.

Do NOT implement:
- scroll
- paging
- 2-column stat pages
- automatic parameter omission.

Do not add a Product limit such as "there can only be 12 stats."

## English Copy Boundary

Extend the existing `BoutHudCopy` / English copy only with the fixed comparison copy actually needed.

Likely fixed copy:

- `Age`
- `Height`
- `Weight`
- prototype start prompt, e.g. `Press Enter to Start`.

Locale-sensitive formatters are appropriate for:

- age
- height
- weight.

Recommended English output examples:

- `26 yrs`
- `175 cm`
- `120 kg`.

Do not scatter these fixed English strings through the Phaser view.

Public parameter labels/values are already locale-resolved presentation strings and should come from the context.

## Pre-bout Presentation Flow

Add the smallest Scene-owned presentation phase:

```ts
'pre-bout' | 'active'
```

or equivalent.

This is NOT gameplay state.

### Initial scene state

When `BoutScene` is created:

- Product arena may be visible behind the comparison
- wrestlers may remain visible but static beneath the dim overlay
- active always-visible HUD is hidden
- comparison overlay is visible
- Simulation does NOT advance.

### Start input

Use:
**Enter**

as a prototype-only "start Bout" input.

This is not the final control scheme.

Display:
`Press Enter to Start`

through the English copy boundary.

On Enter:

1. hide comparison screen
2. show the accepted always-visible HUD
3. clear any latched gameplay press edges so pre-bout input cannot leak into the first gameplay tick
4. begin normal Bout update/Simulation stepping.

Do not create a countdown or tachiai flow.

### While pre-bout is visible

Do NOT call `BoutSimulation.step()`.

Do NOT accumulate hidden gameplay time that later runs in a burst.

Do NOT queue Push/Counter/Grip presses for the active Bout.

WASD/Action key activity before Enter must not cause an immediate queued action on start.

If needed, clear input latches at transition.

### Restart

Current `R` restart should reset the Bout and return to the pre-bout comparison state.

This makes each prototype Bout begin through the same comparison flow.

Preserve selected Dummy mode if current restart semantics already do so.

Do not redesign restart controls.

## Always-visible HUD Visibility

The accepted 02A1 HUD should NOT be duplicated behind the comparison screen.

During pre-bout:
- hide the always-visible Action HUD.

After Enter:
- show it unchanged.

Modify `createBoutHud` / view ownership minimally so visibility can be controlled.

Do not rebuild the HUD every frame.

Preferred:
- return a small view handle/container with `setVisible()`.

No generic component framework.

## Pre-bout Comparison View Module

Create a dedicated small Phaser view, recommended:

`src/game/scenes/PreBoutComparisonView.ts`

or equivalent.

Responsibilities:
- full-screen dimmer
- comparison panel
- header identity data
- Age / Height / Weight rows
- supplied public parameter rows
- start prompt
- visibility control.

It should not:
- read Simulation formulas
- mutate Simulation
- own game state
- know Management rules.

## Visual Direction

Match the accepted Product HUD / arena:

- warm off-white paper panel
- dark ink-like text
- subdued indigo East accent
- subdued vermilion West accent
- English system serif
- no portrait
- no sponsor/logo.

Do not copy a TV broadcast layout.

### Background treatment

Use a simple full-screen dark translucent dimmer over the Product arena.

Do not add blur/post-processing in this Task.

### Panel

Recommended starting area:

`x ≈ 240, y ≈ 70, w ≈ 1440, h ≈ 940`

This is Provisional.

User Visual Check can tune it.

Do not hide the arena completely; the background should remain recognizable beneath the dimmer.

## Comparison Layout

Follow the accepted 3-column reading model:

```
East value  |  Field label  |  West value
```

### Header area

Show:

- `Day 3`
- East:
  - side
  - rank
  - name
  - record
- West:
  - side
  - rank
  - name
  - record.

Reuse the same presentation context and English copy as the always-visible HUD.

Do not duplicate identity fixture data.

### Profile rows

At minimum:

- Age
- Height
- Weight.

### Public parameter rows

Then render every supplied public parameter row.

Field label:
center column once.

East value:
right-aligned toward center.

West value:
left-aligned toward center.

No comparison bars yet.

## Group Headings

The spec allows future groups.

For 02B:
- the data type may include optional `group`
- rendering group headings is optional if it stays small.

Do not invent Product group names.

If group rendering would materially complicate the first comparison shell, leave group headings Deferred and report it.

Do not create fake final categories.

## Typography / Fit

Reuse the existing English-first Product typography where practical.

Required:

- long romanized name handling
- long rank handling
- public parameter labels fit reasonably in center column
- public parameter values remain readable.

Do not add marquee/scroll.

If a parameter label is too long:
- use the existing shrink/ellipsis helper or a small equivalent.

Do not change the accepted always-visible HUD font sizing unless required for shared helper reuse.

## Depth / Visibility

The comparison must render above:

- Product arena
- wrestlers
- always-visible HUD.

A dedicated comparison depth above current HUD depth 4 is appropriate.

When visible, it should visually dominate.

When hidden:
- it must not block input or remain visible.

## Gameplay Preservation

Strictly preserve:

- movement
- Push
- Counter
- Grip
- Drive
- Ring-out
- Tokudawara
- fixed step
- Dummy behavior
- outcome logic.

The only new runtime flow is:
**presentation waits at pre-bout until Enter before Simulation ticks begin.**

No BoutSimulation changes should be necessary.

If an Agent believes BoutSimulation must change, STOP and report.

## Debug

Key `0` remains a development debug toggle.

No need to optimize debug appearance while the pre-bout screen is open.

After active Bout starts:
- debug behavior must remain as accepted.

Do not remove debug/test harness functionality.

## Documentation Sync

### ACTION_HUD_PRODUCT_SPEC
Update status minimally:
- always-visible shell implemented and User accepted
- English-first baseline accepted
- pre-bout comparison now implemented by 02B after successful Task
- fixture public parameters are placeholders, not Product stat decisions.

### GAME_CONCEPT
Correct the stale phrase that still says Product HUD implementation is "未着手".

Use concise wording:
- Product HUD implementation has started / always-visible HUD baseline is implemented
- do not duplicate the HUD spec.

Keep English-only initial release statement.

### ARCHITECTURE
Add only the smallest current implementation note:
- Scene-owned pre-bout presentation phase
- comparison context remains outside Simulation
- Simulation does not advance until pre-bout is dismissed
- no Management system yet.

Do not broaden docs.

## Focused Tests

Verification Level:
**Standard + User Visual Gate**

Required:

### Presentation context

- age / height / weight fixture values exist and are outside Simulation
- public parameter row list is presentation-only
- all public parameter keys in fixture are unique
- East/West values are present.

### Copy

- Age / Height / Weight English labels
- age / height / weight formatting
- English start prompt.

### Parameter-row behavior

Test:
- empty list
- one row
- current 6–8 row fixture
- 12-row synthetic list.

Confirm:
- order preserved
- no silent omission
- labels/values preserved.

Do not claim >12 Product behavior is solved.

### Architecture

Focused check:
- `BoutTypes.ts` / `BoutSimulation.ts` do not gain age/height/weight/public-parameter/HUD fields.

### Existing HUD

Existing 02A1 tests must remain PASS.

### Regression

Run:

- `pnpm test`
- `pnpm build`
- `tsc --noEmit`
- `git diff --check`.

No Python art-tool work.

## Runtime / Browser Smoke

Required if environment permits.

Verify:

### On load
- comparison screen visible
- Product arena recognizable behind dimmer
- always-visible HUD hidden
- wrestlers do not move
- Simulation outcome remains ongoing.

### Before Enter
- waiting does not advance the Bout
- Push/Counter/Grip presses do not queue into the Bout.

### Enter
- comparison hides
- Action HUD appears
- Bout starts from unchanged initial positions
- no queued action fires unexpectedly.

### Active Bout
- movement/actions still work
- key 0 debug works
- R restarts and returns to comparison screen.

If graphical browser smoke is unavailable:
- report NOT RUN
- User Visual Check remains required.

## User Visual Check — REQUIRED

Run:

`pnpm dev`

Please prepare a screenshot of the pre-bout comparison.

User should judge:

1. arena remains recognizable behind the overlay
2. comparison panel feels like the same Product UI family as the Action HUD
3. East/West identities are immediately understandable
4. name > rank/record hierarchy is clear
5. Age / Height / Weight are easy to compare
6. 6–8 placeholder public parameter rows are readable
7. placeholder nature does not look like final stat design
8. screen is not too dense
9. start prompt is clear
10. Enter transition into Action feels immediate and clean.

Then confirm:
- active HUD after Enter is unchanged
- gameplay feels unchanged
- R returns to comparison.

## Acceptance Criteria

Technical PASS requires:

1. pre-bout comparison is displayed before gameplay
2. Simulation does not step while waiting
3. Enter starts the active Bout
4. pre-bout inputs do not leak into first active tick
5. R restart returns to comparison
6. always-visible HUD is hidden during comparison and restored after
7. age / height / weight are presentation-only
8. public parameter list is presentation-only and variable-length
9. no final parameter names/ranges/formulas are invented
10. every supplied fixture parameter row is rendered
11. English-only initial release baseline is preserved
12. no portrait/birthplace/realtime stamina
13. no Management/Tournament system
14. no gameplay changes
15. tests/build/typecheck/diff-check PASS
16. no new dependency.

Product acceptance:
User Visual Check required.

## Design Deviations

Required.

If none:
`Design Deviations: NONE`

Material deviations requiring STOP:

- adding stats to BoutSimulation/BoutSnapshot
- inventing final public parameters
- implementing a full localization system
- adding Portrait or realtime Stamina
- changing gameplay
- building Management/Tournament
- replacing Enter prototype start with a broader control-system redesign.

Provisional panel/spacing/color tuning is not Material if reported.

## Expected Task-owned Files

Likely:

- `src/game/presentation/boutHudPresentation.ts`
- `src/game/presentation/boutHudCopy.ts`
- related presentation tests
- `src/game/scenes/BoutHudView.ts`
- new `src/game/scenes/PreBoutComparisonView.ts` or equivalent
- `src/game/scenes/BoutScene.ts`
- `docs/ACTION_HUD_PRODUCT_SPEC.md`
- `docs/GAME_CONCEPT.md`
- `docs/ARCHITECTURE.md`
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`.

Do not modify Product arena assets.

## Git Delivery

Follow `AGENTS.md`.

One successful Task ≈ one commit.

Suggested commit:

`feat: add pre-bout comparison screen`

Push `origin/develop`.

Do not modify `main`.

## Final Instruction

Stop after pre-bout comparison implementation and verification.

Do NOT continue into:
- final Simulation parameter design
- Management/Tournament
- Product wrestler art
- Result screen
- gameplay tuning.

After commit/push/report:

「ACTION-ART-02B-PREBOUT-COMPARISON が完了し、ChatGPT ReviewとUser Visual Check待ちです」
