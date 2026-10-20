Task-ID: ACTION-ART-02B-PREBOUT-COMPARISON
Status: REVIEWED
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


# Final ChatGPT Review

Overall Result: TECHNICAL PASS / USER FLOW CONFIRMATION REQUIRED

## Reviewed Delivery

- Implementation commit:
  `c937db6931a830b79d6110077cb1b5e1cf0ce577`
- Agent-Start-Head:
  `3245cb8d76fea8a7832fa2c83cae0f5146e061b6`
- Diff is one implementation commit.
- No BoutSimulation/gameplay source changes.
- No new dependencies.
- No Product arena asset changes.

## Pre-bout Comparison Implementation

PASS.

The implementation matches the accepted ACTION-ART-02B scope:

- pre-bout comparison overlay
- East/West identity header
- rank / name / current record
- Age / Height / Weight
- every supplied public-parameter row
- English start prompt
- Scene-owned pre-bout/active presentation phase
- Enter starts Action
- R restart returns to pre-bout
- accepted always-visible Action HUD is hidden while comparison is visible.

No portrait, birthplace, realtime stamina, Management/Tournament system, or final stat design was introduced.

## State / Architecture Ownership

PASS.

Age / height / weight and public-parameter rows live in the pure presentation context.

They are NOT added to:
- `BoutSimulation`
- `ParticipantState`
- `BoutSnapshot`.

The comparison screen therefore remains presentation-only.

Participant id remains the join key.

This preserves the accepted Architecture.

## Public Parameter Discipline

PASS.

The fixture uses:

- Sample Stat A
- Sample Stat B
- ...
- Sample Stat G.

This is the correct approach because the final public parameter list remains unresolved.

The implementation does NOT invent:
- Power
- Technique
- Balance
- Stamina
- ranges
- formulas
- gameplay effects.

Do Not Reopen these fixture labels as real Product stats.

## Variable Row Handling

PASS for the current task.

The renderer iterates over all supplied rows in order.

Focused tests cover:
- 0 rows
- 1 row
- current 7-row fixture
- 12-row synthetic list.

No supplied rows are silently omitted.

For larger counts, current behavior compresses pitch to a minimum and may eventually exceed the panel.

This remains an explicitly Deferred design problem and is NOT a Product stat-count limit.

Do not treat 12 or 15 as a final maximum.

## English Copy Boundary

PASS.

The existing small English-first copy boundary was extended only with the fixed copy needed by this screen:

- Age
- Height
- Weight
- formatted years/cm/kg
- Press Enter to Start.

Public parameter labels/values remain data-driven presentation strings.

No localization framework or additional shipping language was introduced.

## Presentation Flow

PASS from Source inspection.

### Initial state
- Scene starts in `pre-bout`.
- Comparison is visible.
- accepted Action HUD is hidden.

### While waiting
- `BoutSimulation.step()` is not called.
- `FixedStepAccumulator.advance()` is not called.
- hidden gameplay time does not accumulate.

### Enter
- comparison hides
- Action HUD shows
- Push / Counter / Grip latches are cleared
- accumulator is recreated
- normal fixed-step Action begins.

This prevents queued edge presses made during pre-bout from firing on the first active tick.

Held movement state is read normally once Action is active; it is current input, not a queued pre-bout edge.

### Restart
- creates a fresh BoutSimulation
- clears press latches
- resets Dummy timing while preserving selected Dummy mode
- returns to pre-bout.

No gameplay rule was moved into the presentation phase.

## View Structure

PASS.

`PreBoutComparisonView.ts` is a dedicated small Phaser view.

The comparison is one visibility-controlled Container at depth 10.

It is visually above:
- arena
- wrestlers
- debug
- Action HUD.

The accepted Action HUD is not duplicated behind the comparison; it is hidden and restored by visibility state.

No generic UI framework was introduced.

## Shared HUD Styling

PASS.

The extraction of the existing HUD styling into `HudStyle.ts` is justified and small:

- shared paper palette
- ink text
- side accents
- system serif
- fitted text helper integration
- side pill.

It does not constitute a generic UI framework.

The accepted 02A1 Action HUD visual values were preserved.

## Screenshot Visual Review

The User supplied a runtime screenshot of the comparison screen.

ChatGPT visual review:
**PASS / no blocking visual issue observed.**

Positive observations:

- Product arena remains clearly recognizable behind the dimmer.
- Comparison panel visually belongs to the same warm paper / ink / subdued accent UI family as the accepted Action HUD.
- East / West are immediately distinguishable by position, label, and accent.
- Wrestler names are correctly the strongest identity text.
- Rank and record are readable without competing with names.
- Age / Height / Weight form a clear comparison table.
- Seven `Sample Stat` rows are readable and visibly placeholder-like rather than plausible final stat design.
- The screen is not overcrowded at the current fixture row count.
- `Press Enter to Start` has strong visual affordance.
- No portrait area is missing or visually required.
- Background dimming is strong enough for readability while still preserving venue context.

No visual correction task is recommended based on this screenshot alone.

## One Visual/Design Note

The comparison panel is intentionally large and dominates the screen.

For a pre-bout information screen this is appropriate.

Do not shrink it merely to expose more of the arena unless User feedback asks for that; readability and comparison are the purpose of this phase.

## Verification Completeness

Automated verification is complete for the technical scope:

- `pnpm test`: 257 PASS / 17 files
- `pnpm build`: PASS
- `tsc --noEmit`: PASS
- `git diff --check`: PASS
- no new dependency.

Agent browser interaction:
NOT RUN.

The User screenshot confirms that the comparison actually renders in a browser.

The remaining runtime gate is interaction-flow confirmation, which cannot be proven by the screenshot alone.

## Required User Flow Confirmation

Please verify in the running browser:

1. Before Enter, wrestlers do not actually advance/move through gameplay.
2. Pressing Push / Counter / Grip before Enter does not cause an action immediately after starting.
3. Enter hides the comparison and immediately shows the previously accepted Action HUD.
4. Normal movement / Push / Counter / Grip / Drive still work after Enter.
5. Key `0` still enables debug during active Action.
6. `R` returns to this pre-bout comparison screen.
7. Restarted wrestlers are back at their original initial positions.
8. No noticeable performance regression.

If these are all normal, ACTION-ART-02B can be fully User Accepted.

## Documentation

PASS.

The previously stale GAME_CONCEPT statement that Product HUD implementation was not started is now corrected.

The docs correctly distinguish:
- accepted English Action HUD
- implemented comparison pending User acceptance
- fixture public parameters are not Product stat decisions.

## Acceptance State

Technical:
PASS.

ChatGPT visual review:
PASS.

User runtime flow acceptance:
PENDING explicit confirmation.

## Next Step After User Acceptance

Do not automatically design final Simulation parameters next.

Once 02B is accepted, Product HUD foundation is sufficient for now.

The next Product-art priority should return to the planned sequence and evaluate the next visual task, likely the **Product wrestler art / part-based wrestler visual direction**, unless the User explicitly chooses another Action task.

Do not turn Sample Stat rows into a parameter-design task by inertia.
