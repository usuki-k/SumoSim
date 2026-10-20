Task-ID: ACTION-ART-02A-HUD-SHELL
Status: REVIEWED
Task-Type: IMPLEMENTATION / PRODUCT UI / BOUT HUD SHELL
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 8bd9e0533d58fd6d06db687e8980ae7b80826f84
Handoff-Mode: GITHUB

# ACTION-ART-02A — Product Bout HUD Shell

## Purpose

Implement the first runtime Product HUD shell over the accepted Product arena.

This Task is deliberately small.

Implement only:
- East identity block
- West identity block
- center Day chip
- pure fixture presentation data
- cleanup of existing Prototype/debug text so the Product view is visually readable.

Do NOT implement the pre-bout comparison screen yet.

This Task exists to answer one visual question:

**Does the accepted HUD information hierarchy and panel treatment work over the actual Product arena during Action?**

Final gate:
**User Visual Check.**

## Accepted Baseline — DO NOT REOPEN

### Product visual baseline
Current Action Product presentation:
- stylized painted top-down 2D
- 1920×1080 current Product presentation baseline
- accepted Product arena / dohyo / Tokudawara runtime assets
- current wrestler display scale accepted by User
- provisional wrestler art quality is temporary / below Product bar.

Do not change:
- Product arena assets
- Product arena mapping
- wrestler bodyRadius
- wrestler meter-to-pixel scale
- Tokudawara geometry.

### HUD Product Spec
Authoritative:
`docs/ACTION_HUD_PRODUCT_SPEC.md`

Accepted always-visible content:
- East/left:
  - side
  - rank
  - wrestler name
  - current basho record
- West/right:
  - side
  - rank
  - wrestler name
  - current basho record
- center:
  - current tournament day.

Do NOT show during active Action:
- age
- height
- weight
- full public parameter list
- realtime stamina
- portrait
- birthplace.

Those belong to the later pre-bout comparison or remain Deferred.

### Player-controlled indicator
Still unresolved.

For this Task:
- **omit it**
- do not invent `YOU` / `自` / iconography
- do not render awkward empty reserved chrome for it.

This is not a blocker for the HUD shell.

## Architecture Constraint — Critical

Do not put HUD profile/tournament metadata into:
- `BoutSimulation`
- `ParticipantState`
- `BoutSnapshot`.

Use:

```
Fixture presentation context
      ↓
Phaser HUD view

BoutSimulation
      ↓
BoutSnapshot
      ↓
Action rendering
```

The only join key is participant id.

Keep the presentation context Pure TypeScript / Phaser-free.

Do not introduce:
- global event bus
- DI framework
- generic UI state framework
- Management/Tournament system.

## Required Reading / Current Source Inspection

Read directly before editing:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/GAME_CONCEPT.md`
- `docs/ARCHITECTURE.md`
- `docs/ACTION_HUD_PRODUCT_SPEC.md`
- current `CURRENT_TASK.md`
- current `CURRENT_COMPLETION_REPORT.md`
- `src/main.ts`
- `src/game/scenes/BoutScene.ts`
- `src/game/presentation/productArena.ts`
- `src/game/sumo/BoutTypes.ts`
- current wrestler/presentation code as needed.

If Current Source materially conflicts with the accepted HUD spec, STOP and report.

## Fixture Presentation Context

Create the smallest pure presentation model needed by the always-visible HUD.

Recommended direction:

```ts
type BoutSide = 'east' | 'west'

interface BoutHudWrestler {
  readonly participantId: ParticipantId
  readonly side: BoutSide
  readonly name: string
  readonly rankLabel: string
  readonly record: {
    readonly wins: number
    readonly losses: number
  }
}

interface BoutHudContext {
  readonly day: number
  readonly wrestlers: readonly [BoutHudWrestler, BoutHudWrestler]
}
```

Exact naming may differ.

Requirements:
- no Phaser import
- no gameplay formulas
- no Management system
- no age/height/weight/publicParameters yet unless strictly needed by a future-compatible type with zero extra behavior.

Prefer the smallest shape needed for 02A.

## Fixture Data

Use explicit **prototype fixture data**.

It must be obvious in Source that the values are sample presentation data, not final game content.

Use plausible Japanese sumo-like display examples.

Recommended fixture values are allowed to reuse the HUD SPEC examples, e.g.:

East:
- name: `朝翠龍`
- rank: `前頭十五枚目`
- record: 2-0

West:
- name: `寿之富士`
- rank: `前頭十六枚目`
- record: 1-1

Tournament:
- day: 3.

These values are examples/fixtures only.

Do not create:
- wrestler database
- rank rules
- tournament progression
- persistence.

## Presentation-side Existing Metadata

Current `BoutScene` has `PARTICIPANT_PRESENTATION` containing:
- controller
- color
- debug label
- side
- optional name.

Refactor only as much as necessary to avoid duplicate ownership.

Preferred:
- fixture HUD context owns current prototype side/name/rank/record/day
- Scene input/presentation metadata keeps only what it genuinely needs, such as:
  - participant id
  - controller assignment
  - provisional wrestler color.

Do not duplicate the same side/name in two separate presentation sources.

If result text needs side/name:
- derive it from the same fixture HUD context
- do not maintain a second side/name table.

## HUD Rendering Module

Create a small dedicated Phaser view rather than embedding all panel drawing directly into `BoutScene.create()`.

Recommended:
`src/game/scenes/BoutHudView.ts`

Responsibilities:
- create East identity block
- create West identity block
- create Day chip
- accept the pure fixture/presentation context
- presentation only.

BoutScene:
- creates the HUD view
- passes the fixture context
- does not own the panel layout details.

Avoid a generic component framework.

## Layout Baseline

Start from the HUD SPEC Recommended/Provisional zones:

### East identity block
`x=24, y=24, w=440, h=150`

### West identity block
`x=1456, y=24, w=440, h=150`

### Day chip
`x=810, y=10, w=300, h=44`

These are starting values, not permanent Product constants.

Do not place the HUD into the accepted Action critical circle.

### Identity block hierarchy

Recommended:

Row 1:
- side tag
- rank

Row 2:
- wrestler name, largest text

Row 3:
- current record.

West should be a visual mirror / right-aligned equivalent.

### Day chip
Show a compact localized prototype string, for example:
`3日目`

Do not add tournament name, date, or round labels in this Task.

## Product Visual Treatment

Implement the shell using simple Phaser primitives/Text.

No new image assets are required.

Direction:
- warm off-white / paper-like panel surface
- high opacity, at least approximately 0.9
- dark ink-like text
- restrained side accents
  - East: subdued blue/indigo
  - West: subdued red/vermilion
- thin dark border / restrained framing
- no sponsor/logo treatment
- no portrait area.

Do not copy TV broadcast graphics.

Do not create ornate production-grade UI texture work yet.

The goal is:
**Product-readable visual shell that can be judged in the actual runtime.**

Final colors / panel dimensions remain User Visual Check tuning.

## East / West Identification

Do not rely on color alone.

Each block must explicitly display:
- `東`
- `西`

as visible side labels.

Current mapping remains:
- East = left
- West = right.

Do not change participant spawn or gameplay based on this.

## Text / Localization Boundary

Do not build a localization system.

However:
- keep semantic fixture data separate from display formatting where practical
- avoid scattering Japanese formatting strings throughout `BoutScene`.

A tiny pure formatter is acceptable if useful, e.g.:
- record -> `2-0`
- day -> `3日目`.

Do not overbuild localization infrastructure.

## Long Text Robustness

HUD must not assume only short strings.

At minimum implement reasonable single-line handling for:
- long wrestler names
- long rank labels.

Preferred behavior:
1. start at preferred font size
2. reduce to a documented minimum
3. if still too long, ellipsize.

Minimum targets from the HUD spec:
- name >= 36 logical px before ellipsis
- rank >= 28 logical px before ellipsis.

Do not introduce scrolling/marquee.

Focused tests for any pure truncation/formatting helper are recommended.

## Prototype / Debug Text Cleanup

Current runtime has Product-unfriendly prototype text.

In normal debug-OFF Product view:

### Hide
- `DUMMY: STATIONARY / PUSH`
- long control help line
- engagement text
- player/CPU labels
- phase labels
- debug geometry.

Existing per-wrestler/debug elements are already mostly debug-gated; preserve that.

### Debug ON
Key `0` should continue to expose development information needed for testing:
- Dummy mode
- control help
- engagement / pair velocity
- participant debug labels
- phase labels
- debug geometry / boundary.

The mode/control text may be consolidated into debug-only text if that is cleaner.

Do not remove the underlying debug/test harness functionality.

### Result text
Keep current result text behavior functionally intact.

It is allowed to use the fixture wrestler names/side from the new presentation context instead of `PLAYER` / `CPU`.

Do not design a final result screen.

## Gameplay Preservation

Do not change:
- inputs
- movement
- Push
- Counter
- Grip
- Drive
- Ring-out
- Tokudawara
- fixed step
- Dummy behavior
- restart behavior.

HUD must remain read-only presentation.

## Pre-bout Comparison — STRICTLY OUT

Do NOT implement:
- age
- height
- weight
- public parameter rows
- full-screen comparison overlay
- pre-bout waiting state
- transition into Action
- input-to-start flow.

That is the next Task:
`ACTION-ART-02B`.

## Product Portrait — OUT

Do not:
- reserve a portrait box
- generate random faces
- add face assets.

## Stamina — OUT

Do not:
- create stamina value
- create stamina bar
- create current stamina state.

## Tests

Verification Level:
**Standard + User Visual Gate**

Required automated checks:

### Pure presentation module
Test at minimum:
- fixture context has exactly 2 wrestlers
- participant ids match current Bout participants
- East/West unique and correctly mapped
- record/day formatting if formatter exists
- presentation module remains Phaser-free.

### HUD-specific formatting
If long-text handling has pure helpers:
- preferred size case
- shrink case
- ellipsis case.

Do not unit-test Phaser rendering through brittle implementation-detail assertions unless current test setup supports it naturally.

### Regression
Run:
- `pnpm test`
- `pnpm build`
- `tsc --noEmit`
- `git diff --check`.

No Python art-tool work is needed.

## Browser Runtime Smoke

Required if environment permits.

Check:

- Product background still loads
- HUD panels render
- no missing font/asset/runtime errors
- HUD does not cover critical dohyo action
- controls still work
- key `0` still toggles debug presentation
- debug-only text is hidden when debug OFF
- R restart works
- Dummy mode keys still work.

If Agent cannot perform graphical browser smoke:
- report NOT RUN
- User Visual Check remains required.

## User Visual Check — REQUIRED

Run:

`pnpm dev`

With debug OFF, User should judge:

1. East block is readable
2. West block is readable
3. Day chip is readable
4. HUD does not cover the critical dohyo / Tokudawara action
5. warm panel treatment fits the Product arena
6. East/West accents are useful but not too saturated
7. names are visually dominant over rank/record
8. current wrestler scale still feels correct
9. screen no longer looks like a debug prototype because control/Dummy text is hidden
10. no performance regression.

Then press `0`.

Verify:
- debug information remains available
- HUD remains visible
- debug overlay does not change gameplay.

User Visual Check is the acceptance gate.

## Acceptance Criteria

Technical PASS requires:

1. pure HUD presentation context exists outside BoutSimulation
2. fixture data drives rank/name/record/day
3. identity blocks render left/right
4. Day chip renders center-top
5. no portrait
6. no realtime stamina
7. no age/height/weight/public-parameter UI
8. no Management/Tournament system
9. side/name are not duplicated across two presentation ownership tables
10. debug/prototype text is hidden in normal Product view
11. debug remains available through key 0
12. gameplay behavior unchanged
13. tests/build/typecheck/diff-check PASS
14. no new dependencies.

Product acceptance remains pending User Visual Check.

## Implementation Evidence

Completion Report should map:

- presentation context/view model
- fixture data
- BoutScene ownership cleanup
- HUD view implementation
- exact initial layout values
- visual styling values
- long-text behavior
- prototype/debug cleanup
- result text handling
- verification
- browser smoke
- User Visual Check status.

## Design Deviations

Required.

If none:
`Design Deviations: NONE`

Material changes requiring STOP:
- changing HUD information hierarchy
- implementing pre-bout comparison now
- adding Management data/state
- changing gameplay
- adding portrait/stamina UI
- moving HUD into the critical Action region for design reasons.

Recommended/provisional pixel/color tuning is not a Material Deviation if reported.

## Stop Conditions

STOP/BLOCKED if:

- Current Source materially conflicts with the accepted HUD spec
- making the HUD requires modifying BoutSimulation metadata/state
- Japanese fixture text cannot be rendered/readable with the current runtime environment without adding a new font dependency/asset
- layout cannot avoid materially obstructing Action at 1920×1080
- a new UI framework appears necessary.

Do not solve blockers by broadening scope.

## Expected Task-owned Files

Likely:

- `src/game/presentation/boutHudPresentation.ts` (or equivalent)
- focused pure tests
- `src/game/scenes/BoutHudView.ts` (or equivalent)
- `src/game/scenes/BoutScene.ts`
- `docs/ARCHITECTURE.md` only if a small current-implementation ownership sync is required
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`.

Do not change Product background assets.

## Git Delivery

Follow `AGENTS.md`.

One successful Task ≈ one commit.

Suggested commit:
`feat: add product bout hud shell`

Push `origin/develop`.

Do not modify `main`.

## Final Instruction

Stop after the always-visible HUD shell and runtime verification.

Do NOT continue into:
- pre-bout comparison
- Management/Tournament implementation
- Product wrestler art
- gameplay tuning.

After commit/push/report:

「ACTION-ART-02A-HUD-SHELL が完了し、ChatGPT ReviewとUser Visual Check待ちです」


# Final ChatGPT Review

Overall Result: TECHNICAL PASS / USER VISUAL CHECK REQUIRED

## Reviewed Delivery

- Implementation commit:
  `59761c1ba3e035e9def2e73097634ee6455f4fe9`
- Agent-Start-Head:
  `ece5d75b28a1c3d4375ce4e533196dad4d9ab0e5`
- Diff is one implementation commit.
- `main` remains unchanged.
- No package/lock changes.
- No Product background asset changes.

## Reported Implementation vs Design

PASS.

The implementation matches the accepted ACTION-ART-02A scope:

- East identity block
- West identity block
- center Day chip
- explicit fixture presentation data
- debug/prototype text cleanup
- no pre-bout comparison screen
- no Management/Tournament implementation
- no portrait
- no stamina UI
- no gameplay change.

## Presentation State Ownership

PASS.

`src/game/presentation/boutHudPresentation.ts` is Pure TypeScript and owns the prototype HUD fixture:

- participant id
- side
- name
- rank label
- current record
- day.

The HUD metadata is not added to:
- `BoutSimulation`
- `ParticipantState`
- `BoutSnapshot`.

The only Simulation join key is participant id.

This preserves the accepted architecture.

## Single Source of Truth

PASS.

The previous `PARTICIPANT_PRESENTATION` side/name fields were removed.

Current ownership is clean:

### HUD context
- side
- wrestler name
- rank
- record
- day.

### Scene input/debug metadata
- participant id
- controller
- provisional wrestler color
- debug-only PLAYER / CPU label.

Result text also reads side/name from the same HUD context.

Do not reintroduce a second side/name table.

## Fixture Data

Accepted as Prototype fixture only:

- East / wrestler-a:
  - 朝翠龍
  - 前頭十五枚目
  - 2-0
- West / wrestler-b:
  - 寿之富士
  - 前頭十六枚目
  - 1-1
- Day 3.

These values remain sample presentation data, not final game content.

Do not build game rules around them.

## HUD View Structure

PASS.

`BoutHudView.ts` is a small dedicated Phaser presentation module rather than expanding `BoutScene.create()` with panel details.

No generic component/UI framework was introduced.

The initial zones exactly match the Product HUD spec's provisional baseline:

- East: (24,24,440,150)
- West: (1456,24,440,150)
- Day: (810,10,300,44).

These remain provisional until User Visual Check.

## Visual Styling

Technically acceptable for the first Product shell:

- warm paper panel
- dark ink-like text
- subdued indigo East accent
- subdued vermilion West accent
- explicit 東 / 西 tags
- name visually dominant
- no portrait area
- no player-controlled indicator.

The exact colors, opacity, panel size, typography and spacing are NOT accepted yet.

They are User Visual Check values.

## Action Visibility

PASS structurally.

The specified HUD zones remain outside the documented 483 px Action critical circle.

The central Day chip has only a very small calculated clearance from that boundary, so actual runtime viewing is especially important.

Do not enlarge or move it downward before User review.

## Long-text Handling

PASS for current scope.

The implementation:
1. uses preferred font size
2. shrinks to the documented minimum
3. ellipsizes if still too long.

Name minimum:
- 36 logical px.

Rank minimum:
- 28 logical px.

No marquee/scroll was added.

This is sufficient for the shell.

## Debug / Prototype Cleanup

PASS.

With debug OFF:
- Dummy mode is hidden
- control-help text is hidden
- engagement/pair velocity is hidden
- PLAYER / CPU labels are hidden
- phase labels and debug geometry remain hidden.

With key `0`:
- development information becomes visible again
- HUD remains visible.

The Dummy/restart/debug harness functionality remains intact.

## Result Text

Accepted as a non-final presentation adjustment.

The existing result behavior is preserved while the wording now uses HUD fixture identity:

- `東 朝翠龍 勝ち`
- `西 寿之富士 勝ち`
- `同体 取り直し`.

This is not acceptance of a final result screen.

Result presentation remains Deferred.

## Gameplay Preservation

PASS from source inspection.

No changes were made to:
- movement
- Push
- Counter
- Grip
- Drive
- Ring-out
- Tokudawara
- fixed step
- Dummy behavior
- restart.

HUD remains read-only presentation.

## Verification Completeness

Automated verification is complete for the technical scope:

- `pnpm test`: 248 PASS / 16 files
- `pnpm build`: PASS
- `tsc --noEmit`: PASS
- `git diff --check`: PASS
- no new dependency.

Browser graphical smoke:
NOT RUN.

Therefore technical implementation passes, but Product visual acceptance remains pending.

## Japanese Font Risk

Non-blocking but important.

The current font stack relies on system fonts:

- Yu Mincho
- Hiragino Mincho
- Noto Serif JP
- MS PMincho
- generic serif.

No font asset is bundled.

This is acceptable for this prototype visual gate because Product font selection/license is Deferred.

However:
- User must confirm Japanese characters render correctly in the current browser
- this does NOT establish cross-platform/CrazyGames font reliability.

Do not add a font dependency in this Task.

A Product font/assets decision can be made later when localization/font work is explicitly in scope.

## Minor Technical Note — Ellipsis Helper

`fitSingleLine` can theoretically return only the ellipsis even when the available width is smaller than the ellipsis glyph itself.

Current HUD widths are hundreds of pixels, so this is not a runtime issue for the actual identity blocks.

No follow-up fix is required now.

If the helper is later reused for extremely narrow UI, add a dedicated contract for that case instead of broadening this Task.

## User Visual Check — REQUIRED

Run:

`pnpm dev`

### Debug OFF

Please check:

1. Japanese text renders correctly, not tofu/missing glyphs
2. East block is readable
3. West block is readable
4. Day chip is readable
5. names feel clearly more important than rank/record
6. panel size does not feel too large
7. HUD does not cover Tokudawara/edge action
8. paper color fits the accepted arena
9. indigo/vermilion accents are restrained enough
10. no Dummy/control/debug text remains in the normal view
11. current wrestler scale still feels correct
12. no noticeable performance regression.

### Debug ON — key 0

Verify:

- Dummy/control text appears bottom-left
- engagement/debug labels appear
- contact/facing/grapple/boundary diagnostics appear
- Product HUD remains visible
- gameplay is unchanged.

## What to Report Back

A screenshot is preferred.

Please mention specifically if:

- panels are too large/small
- text is too large/small
- Day chip is too close to the dohyo action
- paper panel feels too bright/opaque
- East/West colors feel too strong/weak
- Mincho-style text fits or does not fit the Product background.

## Acceptance State

Technical implementation:
PASS.

HUD Product visual acceptance:
PENDING USER VISUAL CHECK.

## Next Task

Do NOT automatically start ACTION-ART-02B until the HUD shell receives User Visual Approval.

If the shell is accepted:
- record its visual baseline
- then proceed to `ACTION-ART-02B-PREBOUT-COMPARISON`.

If visual changes are requested:
- make a focused 02A visual-tuning task first
- do not mix pre-bout comparison into that correction.


# User Product Language Decision — 2026-10-21

The User reviewed the first Product HUD shell in Japanese and accepted the general visual direction, then made the following Product language decision.

## Accepted Decision

SumoSim should be implemented with **future multilingual support in mind**, but the **initial release will support English only**.

For the initial release:

- English is the only required shipping language.
- Japanese does NOT need to ship.
- The Product HUD should be authored and visually tuned in English from the start.
- Japanese fixture strings currently used by ACTION-ART-02A are temporary prototype content and are NOT the release baseline.

## Architecture Constraint

Do not hard-code Product UI structure around one language.

Use semantic presentation data and a small presentation/localization boundary so future languages can be added without changing gameplay or Management state ownership.

However, do NOT build a full localization framework yet.

Prefer:
- stable semantic fields / keys
- one small English formatting/presentation layer
- layout that tolerates longer English strings.

Do not add:
- language selector
- translation files for languages not shipping
- Japanese release strings
- external localization library
- browser auto-translation behavior.

## Initial English HUD Direction

The next HUD correction should convert the visible Product HUD to English.

Expected semantic examples:

- 東 / 西 -> `East` / `West`
- 前頭十五枚目 -> `Maegashira 15`
- 前頭十六枚目 -> `Maegashira 16`
- 3日目 -> `Day 3`
- 2-0 / 1-1 -> may remain numeric record format
- result wording should also use English fixture names/side formatting.

Wrestler shikona handling for the release should use an English/romanized display form.

The exact final fictional wrestler names remain fixture/content decisions, not gameplay rules.

## User Visual Feedback on Current HUD Shell

- Current Japanese HUD shell is visually acceptable as a layout direction.
- No request to change current panel size/position/color baseline was made in this feedback.
- The next visual gate should therefore focus on:
  - English text fit
  - longer rank labels
  - romanized wrestler names
  - keeping the same Product arena readability.

## Next Task Constraint

Before implementing ACTION-ART-02B pre-bout comparison, perform a focused HUD language-baseline correction.

Recommended next Task:

`ACTION-ART-02A1-HUD-ENGLISH-LOCALIZATION-BASELINE`

Scope:
- convert the always-visible HUD fixture/display to English
- add the smallest localization-ready semantic formatting boundary
- verify long English text fits the accepted shell
- keep Product layout/style otherwise unchanged unless English text requires small visual tuning
- no full localization system
- no additional shipping languages
- no Management/Tournament implementation
- no pre-bout comparison yet.

User Visual Check is required after the English HUD update.
