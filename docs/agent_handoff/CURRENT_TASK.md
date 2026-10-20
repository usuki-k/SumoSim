Task-ID: ACTION-ART-02A1-HUD-ENGLISH-LOCALIZATION-BASELINE
Status: REVIEWED
Task-Type: IMPLEMENTATION / PRODUCT UI / ENGLISH-FIRST LOCALIZATION BASELINE
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 59761c1ba3e035e9def2e73097634ee6455f4fe9
Handoff-Mode: GITHUB

# ACTION-ART-02A1 — English-first HUD / Localization Baseline

## Purpose

Convert the accepted first Product HUD shell from Japanese prototype strings to the **initial-release English baseline**, while establishing the smallest practical boundary for future multilingual support.

This is a focused correction before the pre-bout comparison screen.

The User decision is explicit:

- future multilingual support should be possible
- **initial release supports English only**
- Japanese does NOT need to ship in the initial release
- Product HUD should be authored and visually tuned in English from the start.

Do not build a full localization system.

## Current Visual Baseline

ACTION-ART-02A technical implementation is accepted.

The User reviewed the Japanese HUD runtime screenshot and said the Japanese version is visually fine as a temporary layout direction.

Therefore preserve unless English fit requires a small adjustment:

- East block position/overall size
- West block position/overall size
- center Day chip position/overall size
- warm paper panel direction
- restrained blue/red accents
- name > rank/record visual hierarchy
- Product arena visibility.

The purpose of this Task is NOT a HUD redesign.

The visual gate is whether the same shell works cleanly with English.

## Accepted Release-language Decision — DO NOT REOPEN

### Initial release
Shipping language:
**English only**

Japanese:
**not required for initial release**

Do not add Japanese release resources in this Task.

### Future direction
The implementation must not make future multilingual support unnecessarily difficult.

Use:
- semantic data
- locale-resolved presentation strings
- one small copy/formatting boundary.

Do NOT add:
- language selector
- locale settings screen
- translation JSON/catalog infrastructure
- external i18n library
- Japanese translation pack
- browser auto-translation
- browser locale auto-detection
- CrazyGames SDK locale integration.

CrazyGames SDK is not currently installed; do not introduce it here.

For this release prototype, explicitly use English presentation copy.

## Authoritative Specs / Required Reading

Read directly:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/GAME_CONCEPT.md`
- `docs/ARCHITECTURE.md`
- `docs/ACTION_HUD_PRODUCT_SPEC.md`
- current `CURRENT_TASK.md`
- current `CURRENT_COMPLETION_REPORT.md`
- `src/game/presentation/boutHudPresentation.ts`
- `src/game/presentation/boutHudPresentation.test.ts`
- `src/game/scenes/BoutHudView.ts`
- `src/game/scenes/BoutScene.ts`
- `src/game/presentation/productArena.ts`.

If Current Source materially conflicts with this handoff, STOP and report.

## Scope

Implement:

1. English Product HUD fixture/display strings
2. smallest future-localization-ready copy/formatting boundary
3. English-friendly East/West side treatment
4. English rank/name/day/result formatting
5. long English text fit verification
6. minimal HUD visual tuning only if English requires it
7. Product language decision sync in authoritative docs
8. focused tests
9. build/typecheck/runtime verification
10. User Visual Check preparation.

## Scope Out

Do NOT implement:

- pre-bout comparison screen
- age / height / weight UI
- public Simulation parameters
- Management / Tournament systems
- language selector
- additional shipping languages
- Japanese release UI
- locale detection
- CrazyGames SDK
- external font asset
- external localization package
- portrait
- stamina UI
- wrestler Product art
- gameplay changes.

## English Visible Baseline

Use English for the normal Product HUD.

Semantic examples:

| Semantic field | English baseline |
|---|---|
| East side | `East` |
| West side | `West` |
| Rank east fixture | `Maegashira 15` |
| Rank west fixture | `Maegashira 16` |
| Day | `Day 3` |
| Record | `2-0`, `1-1` |
| Rematch result | concise English equivalent |
| Win result | side + wrestler display name + concise English win wording |

Do not use:
- `東`
- `西`
- `前頭十五枚目`
- `3日目`
- Japanese result wording

in the normal Product HUD after this Task.

Debug-only development text may remain English as it already is.

## Wrestler Display Names

Initial-release Product UI should use Latin/romanized display names.

The current Japanese fixture names are not final game content.

For the explicit prototype fixture, use English/romanized sample display names, for example:

- East: `Asuiryu`
- West: `Toshinofuji`

or another clearly fixture-only romanized pair if Current Source naming suggests a cleaner choice.

Requirements:
- mark them as fixture/sample content
- do not define a shikona generation system
- do not define romanization rules
- do not treat fixture names as final Product content.

## Localization-ready Boundary

Create the smallest explicit boundary for fixed UI copy.

Preferred direction:

```ts
interface BoutHudCopy {
  readonly east: string
  readonly west: string
  readonly rematch: string
  formatDay(day: number): string
  formatWin(side: BoutSide, wrestlerName: string): string
}
```

with an English implementation such as:

```ts
ENGLISH_BOUT_HUD_COPY
```

Exact shape/name may differ.

The key requirement is:

- generic HUD presentation/view code does not contain scattered language-specific fixed copy
- English fixed copy lives in one small pure presentation module/object
- future languages could provide equivalent copy without changing gameplay.

### Content data vs UI copy

Keep locale-resolved content fields separate from fixed UI labels.

Current fixture may still contain:
- display name
- rank display label

as already formatted English presentation strings, because:
- rank system is not implemented
- romanization/content pipeline is not implemented.

Do NOT invent semantic rank enums/ranking rules merely for localization.

## Presentation Context

Keep the existing architecture:

```
Presentation fixture/context
      ↓
HUD view

BoutSimulation / BoutSnapshot
      ↓
Action rendering
```

Do not put language fields into Simulation.

Participant id remains the join key.

## HUD Side Tag — English Fit

The existing 38px square side tag was designed for `東 / 西`.

It is not appropriate for full `East / West`.

Change the internal side treatment as needed.

Recommended:
- replace square tag with a small horizontal pill/label
- full words `East` / `West`
- approximately 70–90 logical px wide
- keep the same subdued side accent
- preserve explicit text so color is not the only distinction.

Do not abbreviate to E/W unless full words genuinely fail visually and the Completion Report explains why.

This internal tag change is expected and is NOT a Material Design Deviation.

## Identity Block English Layout

Keep initial outer zones unless English forces a minor adjustment:

- East block: (24,24,440,150)
- West block: (1456,24,440,150)
- Day chip: (810,10,300,44).

Preferred hierarchy:

Row 1:
- English side label
- English rank label

Row 2:
- romanized wrestler name, largest

Row 3:
- numeric current record.

West remains right-aligned / mirrored.

## Day Chip

Change to:
`Day 3`

Use the same semantic day number from the fixture.

Do not add:
- tournament name
- date
- round
- division.

## Result Text

Convert current Japanese fixture result strings to English.

Keep behavior functionally identical:
- ongoing -> empty
- win -> concise side/name/win text
- rematch -> concise English rematch text.

Examples are allowed:
- `East Asuiryu Wins`
- `West Toshinofuji Wins`
- `Rematch`

Exact capitalization may be tuned.

Do not design the final result screen.

## Font Direction

Because initial release is English-only, remove the runtime HUD's dependency on Japanese-capable system fonts.

Use a broadly available Latin-friendly system serif/sans stack that fits the current traditional Product direction.

Possible direction:
- Georgia
- Times New Roman
- serif fallback

or another no-asset system stack.

Do NOT add a font file/dependency in this Task.

Font selection remains provisional until later Product typography work.

## English Long-text Robustness

English is usually wider than the Japanese prototype labels.

Verify at minimum:

- `Maegashira 15`
- `Maegashira 16`
- `Asuiryu`
- `Toshinofuji`
- at least one intentionally long romanized fixture name
- at least one intentionally longer rank label.

Preserve:
1. preferred size
2. shrink to minimum
3. ellipsis.

Current minimums remain good starting constraints:
- name >= 36 logical px
- rank >= 28 logical px.

If full English `East / West` reduces available rank width, adjust the side pill/tag layout rather than immediately shrinking all text.

## Product HUD Spec Sync

Update `docs/ACTION_HUD_PRODUCT_SPEC.md` minimally to record the new accepted language baseline:

### Initial release
- English only
- Product HUD visual tuning is performed in English
- Japanese not required for first release.

### Future
- multilingual-ready presentation boundary
- no final localization framework yet
- no language selector yet
- locale/platform integration Deferred.

Update examples where necessary so the authoritative implementation baseline is not Japanese-first.

Do not rewrite the HUD spec broadly.

## GAME_CONCEPT Sync

Because the User's language decision applies to the Product release as a whole, add one concise confirmed Product-language statement to `docs/GAME_CONCEPT.md` if no equivalent current statement exists:

- initial release language = English
- architecture should allow future multilingual support
- additional release languages remain Deferred.

Do not turn GAME_CONCEPT into a localization design document.

## Architecture Sync

Update `docs/ARCHITECTURE.md` only if needed to reflect:
- English copy boundary
- fixture remains separate from Simulation
- no localization framework yet.

Keep it minimal.

## Tests

Verification Level:
**Standard + User Visual Gate**

Required focused tests:

### Copy / formatting
- `East`
- `West`
- `Day 3`
- numeric record remains correct
- English win result
- English rematch result.

### Release-language regression
Add a focused check that the normal Product HUD copy/fixture no longer contains the Japanese release strings used by 02A.

Do not write a repository-wide “no Japanese anywhere” test because:
- docs/comments may legitimately contain Japanese
- debug/development content is separate.

Test the actual shipping HUD copy boundary/fixture only.

### Long text
Verify pure fitting helper with:
- English rank
- romanized names
- shrink
- ellipsis.

### Architecture
- localization/copy module remains Phaser-free
- HUD metadata remains outside BoutTypes/BoutSimulation.

### Regression
Run:
- `pnpm test`
- `pnpm build`
- `tsc --noEmit`
- `git diff --check`.

No Python art work required.

## Browser Runtime Smoke

Required if environment permits.

Check debug OFF:

- visible HUD is English
- no Japanese Product HUD text remains
- `East / West` fit
- `Maegashira 15 / 16` fit
- romanized names fit
- Day 3 fits
- no panel overlap
- Product arena remains unobstructed
- controls/gameplay unchanged.

Key `0`:
- debug tools still work
- HUD remains English
- no gameplay change.

If browser graphical smoke is unavailable:
- report NOT RUN
- User Visual Check remains required.

## User Visual Check — REQUIRED

Run:

`pnpm dev`

Please prepare the runtime for a screenshot.

User should judge:

1. full `East / West` labels look natural
2. `Maegashira 15 / 16` remain readable
3. romanized wrestler names fit and remain visually dominant
4. Day 3 looks balanced
5. outer panel dimensions still feel right
6. side pill/tag does not crowd the rank
7. English typography fits the traditional arena
8. no Japanese Product HUD text remains
9. Action visibility is unchanged
10. performance is unchanged.

This User Visual Check is the final Product gate.

## Acceptance Criteria

Technical PASS requires:

1. normal Product HUD is English
2. initial-release English-only decision is reflected in authoritative docs
3. future multilingual support has a small explicit presentation/copy boundary
4. no full localization framework is introduced
5. no Japanese release resource is added
6. no locale selector/detection is added
7. full East/West labels are supported
8. English rank/name/day/result fit the current shell
9. presentation data remains outside Simulation
10. gameplay unchanged
11. pre-bout comparison remains unimplemented
12. tests/build/typecheck/diff-check PASS
13. no new dependency.

## Design Deviations

Required.

If none:
`Design Deviations: NONE`

Material deviations requiring STOP:
- keeping Japanese as the normal Product HUD
- adding a full localization framework
- adding platform locale integration
- redesigning HUD information hierarchy
- implementing pre-bout comparison
- adding Management state
- gameplay changes.

Small side-tag/text spacing changes needed for English are expected and should be reported, not treated as Material deviation.

## Expected Task-owned Files

Likely:

- `src/game/presentation/boutHudPresentation.ts`
- optional small English copy module, if separated
- focused presentation tests
- `src/game/scenes/BoutHudView.ts`
- `src/game/scenes/BoutScene.ts` only if needed for copy injection/result formatting
- `docs/ACTION_HUD_PRODUCT_SPEC.md`
- `docs/GAME_CONCEPT.md`
- `docs/ARCHITECTURE.md` only if needed
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`.

Do not modify Product arena assets.

## Git Delivery

Follow `AGENTS.md`.

One successful Task ≈ one commit.

Suggested commit:
`feat: switch product HUD to English baseline`

Push `origin/develop`.

Do not modify `main`.

## Next Task

After Technical PASS + User Visual Approval:

`ACTION-ART-02B-PREBOUT-COMPARISON`

can implement the pre-bout comparison screen using the same English-first, multilingual-ready presentation boundary.

## Final Instruction

Stop after the English HUD/localization baseline and verification.

Do NOT continue into the pre-bout comparison screen.

After commit/push/report:

「ACTION-ART-02A1-HUD-ENGLISH-LOCALIZATION-BASELINE が完了し、ChatGPT ReviewとUser Visual Check待ちです」


# Final ChatGPT Review

Overall Result: TECHNICAL PASS / USER VISUAL CHECK REQUIRED

## Reviewed Delivery

- Implementation commit:
  `f8ac92652a876b1ec82fe358ad9ed12e88fb91b7`
- Agent-Start-Head:
  `96f718e252761fb3ac45430a1103d8e44bd46c6a`
- Diff is one implementation commit.
- No gameplay changes.
- No new dependencies.
- No Product arena asset changes.

## English-first Release Baseline

PASS.

The normal Product HUD is now English-first:

- East / West
- Maegashira 15 / Maegashira 16
- Asuiryu / Toshinofuji fixture names
- Day 3
- numeric records
- English win/rematch wording.

The Japanese 02A fixture/release strings are no longer part of the shipping HUD copy path.

Initial release language baseline is therefore:
**English only.**

Future additional languages remain Deferred.

## Localization Boundary

PASS.

`src/game/presentation/boutHudCopy.ts` provides the smallest useful fixed-copy boundary:

- side labels
- rematch text
- day formatting
- win formatting.

`BoutHudView` and `BoutScene` receive this copy explicitly.

This is appropriately small:
- no language selector
- no locale detection
- no translation catalog
- no i18n dependency
- no CrazyGames SDK coupling.

Do Not Reopen by adding a localization framework until there is an actual additional shipping language / platform-locale integration task.

## Presentation Data vs Fixed Copy

PASS.

The separation is correct:

### Semantic / content presentation context
- participant id
- side
- romanized display name
- rank display label
- record
- day.

### Fixed English UI copy
- East / West
- Day N
- Wins
- Rematch.

Rank labels and wrestler names remain locale-resolved fixture display strings because rank/content systems and romanization rules do not exist yet.

Do not invent rank enums or shikona-generation rules solely for localization.

## HUD English Layout

PASS structurally.

Outer Product zones remain unchanged:

- East block: (24,24,440,150)
- West block: (1456,24,440,150)
- Day chip: (810,10,300,44).

The old one-character square side tag was correctly replaced with a dynamic-width horizontal pill for the full words:
- East
- West.

Pill width is measured from the actual Phaser Text width, and rank fitting uses the remaining width.

This is the right solution; do not abbreviate to E/W unless a later User Visual Check explicitly prefers it.

## Long English Text Handling

PASS.

Existing shrink-then-ellipsis behavior remains.

Focused tests cover:
- Maegashira 15 / 16
- fixture romanized names
- longer romanized names
- longer rank labels
- shrink cases
- ellipsis cases.

This is sufficient for the current HUD shell.

## Font Direction

PASS for Prototype / first visual gate.

HUD uses a Latin system-serif stack:
- Georgia
- Times New Roman
- Times
- serif.

This removes the previous Japanese-font dependency.

No font asset/dependency was added.

Final Product typography/font licensing remains Deferred.

## Result Text

PASS for current scope.

Current temporary result wording is English:
- East <name> Wins
- West <name> Wins
- Rematch.

This remains temporary Product information, not a final Result screen.

## Architecture / Gameplay

PASS.

HUD/localization data remains outside:
- BoutSimulation
- ParticipantState
- BoutSnapshot.

The Simulation join remains participant id only.

No movement / Push / Counter / Grip / Drive / Ring-out / Tokudawara / fixed-step behavior changed.

## Verification

Automated verification is complete for this task:

- `pnpm test`: 249 PASS
- `pnpm build`: PASS
- `tsc --noEmit`: PASS
- `git diff --check`: PASS
- no new dependency.

Browser graphical smoke:
NOT RUN.

Therefore Product visual acceptance is still pending.

## Documentation Note — Non-blocking Correction Required

`docs/GAME_CONCEPT.md` now correctly records:
- initial release language = English only
- future multilingual-ready structure.

However, the existing Product visual sentence still says:

`Product HUD ... 仕様化済み（実装は未着手）`

That status is now stale.

Current Source already contains:
- ACTION-ART-02A HUD shell
- ACTION-ART-02A1 English baseline.

This does not invalidate the current implementation or language decision.

Required:
- next HUD-related Task must update that small phrase so GAME_CONCEPT does not claim Product HUD implementation has not started.

Do not create a standalone framework/refactor for this wording.

## User Visual Check — REQUIRED

Run:

`pnpm dev`

Please provide a screenshot.

Check:

1. `East` pill looks natural
2. `West` pill looks natural
3. `Maegashira 15 / 16` are readable
4. `Asuiryu / Toshinofuji` fit and remain the dominant text
5. `Day 3` is balanced
6. side pill does not crowd the rank
7. English serif typography fits the Product arena
8. no Japanese Product HUD strings remain
9. panel dimensions still feel right
10. Action / Tokudawara visibility is unchanged
11. no noticeable performance regression.

Key `0`:
- debug tools remain available
- Product HUD remains English
- gameplay remains unchanged.

## Acceptance State

Technical English HUD/localization baseline:
PASS.

Product visual acceptance:
PENDING USER VISUAL CHECK.

## Next Step

If User visually accepts the English shell:
- record English HUD shell as Accepted Baseline
- correct the stale GAME_CONCEPT “実装は未着手” wording in the next HUD task
- proceed to `ACTION-ART-02B-PREBOUT-COMPARISON`.

If English fit/style needs adjustment:
- create a focused 02A1 visual-tuning follow-up first
- do not combine it with the pre-bout comparison screen.


# User Visual Acceptance — English HUD Shell

User reviewed the ACTION-ART-02A1 runtime screenshot and reported no issues.

Accepted Product visual baseline:

- normal Product HUD language: English
- full `East` / `West` side pills
- `Maegashira 15 / 16` rank presentation
- romanized fixture wrestler names
- `Day 3` center chip
- current East/West identity block sizes and positions
- current panel paper/ink/accent direction
- current text hierarchy: wrestler name > rank / record
- current Product arena visibility remains acceptable
- current wrestler presentation scale remains acceptable.

No Japanese Product HUD text is required for the initial release.

Do Not Reopen without an explicit visual/design task:
- switching the normal Product HUD back to Japanese
- shrinking side labels to E/W solely for space
- changing the accepted shell layout without a concrete visual need.

Technical + User Visual status:
**ACTION-ART-02A1 ACCEPTED**

Next allowed Product HUD task:
`ACTION-ART-02B-PREBOUT-COMPARISON`

Constraint:
- retain the English-first / future-multilingual presentation boundary
- use English fixture content
- do not implement Management/Tournament systems
- do not invent final Simulation parameter list.
