Task-ID: PRODUCT-VISUAL-BASELINE-SPEC-SYNC-01
Status: REVIEWED
Task-Type: DOCUMENTATION / PRODUCT VISUAL BASELINE SYNC
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 8a6015643cccf253524f31f5ee3c027be27d3ec4
Handoff-Mode: GITHUB

# PRODUCT-VISUAL-BASELINE-SPEC-SYNC-01 — Sync GAME_CONCEPT to Current Product Visual Baseline

## Purpose

Synchronize the stale Product visual / resolution wording in `docs/GAME_CONCEPT.md` with the Product presentation that has already been explicitly accepted and implemented.

This is a small Documentation-only consistency Task.

Do NOT redesign the game or broaden the Product art direction.

## Why This Task Exists

Current `docs/GAME_CONCEPT.md` still states as a confirmed direction:

```
ドット絵・簡素な2D Presentationを基本方向とする
```

That is now materially stale relative to the accepted Current Product baseline:

- stylized painted 2D Product arena
- deterministic Product dohyo / Tokudawara overlay
- committed Product runtime background assets
- 1920×1080 current Product Action presentation baseline
- Product HUD visual direction designed to match the painted arena.

A future Agent must not treat the old pixel-art/simple-2D line as authority and redesign current Action presentation backward.

## Current Accepted Product Visual Baseline

The following are already accepted and must be reflected accurately:

### Action presentation
- top-down 2D Action remains accepted
- Product Action presentation uses stylized painted 2D artwork
- warm traditional sumo visual direction
- detailed Product arena/background is already integrated into runtime
- exact dohyo / Tokudawara overlay is generated deterministically
- Product HUD is specified to visually match that arena.

### Product action art space
Current baseline:
- 1920×1080 logical Product Action presentation
- Product runtime art is authored/exported to that coordinate space
- Phaser currently renders that space 1:1 before browser Scale.FIT.

Important distinction:
- **1920×1080 is the current Product Action presentation baseline**
- it is NOT necessarily a forever-final platform/performance resolution policy.

Therefore `Resolution` must no longer be described simply as wholly unresolved without qualification.

### Wrestler presentation
- current procedural wrestlers remain temporary
- User accepted their current scale
- their visual quality is below the Product background bar
- Product wrestler art is still Deferred.

Do NOT invent the final wrestler art style/details in this Task.

### Product HUD
- Product HUD spec is authoritative at:
  `docs/ACTION_HUD_PRODUCT_SPEC.md`
- implementation has not started yet
- its warm traditional game-UI direction is aligned with the Product arena.

## Required Reading

Read directly:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/GAME_CONCEPT.md`
- `docs/ARCHITECTURE.md`
- `docs/ACTION_HUD_PRODUCT_SPEC.md`
- current `CURRENT_TASK.md`
- current `CURRENT_COMPLETION_REPORT.md`
- `src/main.ts`
- `src/game/presentation/productArena.ts`

Use Current Source / Current SPEC as authority.

## Scope

Modify only the visual/resolution concept wording needed to remove the stale contradiction.

Primary target:
- `docs/GAME_CONCEPT.md`

Completion report:
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

No Production Source changes.

## Required GAME_CONCEPT Changes

### 1. Replace stale pixel-art confirmed direction

Remove/supersede:

```
ドット絵・簡素な2D Presentationを基本方向とする
```

Replace it with a concise confirmed statement equivalent to:

- Action Product presentation is stylized painted 2D
- top-down presentation remains
- current arena / dohyo Product visual baseline is accepted.

Do not over-specify:
- character rendering method
- final wrestler art
- HUD exact colors/layout
- Management art style.

### 2. Clarify Art style status

The current document also lists:

`Art styleの詳細`

under unresolved items.

Do not simply delete all art-style uncertainty.

Instead distinguish:

**Confirmed**
- current Action Product baseline = stylized painted 2D
- warm traditional sumo direction for current Action presentation.

**Still unresolved**
- detailed final wrestler art treatment
- broader Management presentation details
- other visual details not yet accepted.

Keep this distinction compact.

### 3. Clarify Resolution status

The current document lists:

`Resolution`

as wholly unresolved.

Update so the document reflects:

**Confirmed current baseline**
- Action Product logical presentation currently uses 1920×1080
- browser display is scaled from that baseline.

**Still unresolved**
- final performance/platform resolution policy
- whether production optimization later changes internal rendering/export choices.

Do not claim 1920×1080 is immutable forever.

### 4. Preserve current accepted development order

Do not redesign the project sequence.

Keep:
- Action-first focus
- Management expansion after Action is sufficiently established.

## Scope Out

Do NOT modify:

- gameplay formulas
- Ring-out
- Tokudawara
- HUD spec contents
- wrestler code/assets
- runtime assets
- Phaser logical resolution in Source
- package/lock
- Management rules
- tournament rules
- public parameter list
- stamina design
- portrait decisions.

Do not implement anything.

## Important Scope Discipline — Other Stale Concept Text

If `GAME_CONCEPT.md` contains other wording that appears stale or inconsistent but is unrelated to the Product visual/resolution sync, do NOT silently fix it in this Task.

Report it under:
`Unexpected Scope / Other Stale Documentation`

and leave it unchanged unless it blocks this visual sync.

In particular, do not turn this Task into a broad GAME_CONCEPT rewrite.

## Acceptance Criteria

PASS only if:

1. the obsolete “pixel art / simple 2D” confirmed direction is no longer authoritative
2. current stylized painted Action Product baseline is recorded as confirmed
3. top-down Action direction remains unchanged
4. current 1920×1080 Action Product presentation baseline is recorded accurately
5. final platform/performance resolution policy remains explicitly open
6. final wrestler Product-art details remain Deferred
7. broader Management presentation details are not accidentally fixed
8. Product HUD spec is not duplicated or rewritten
9. no Production Source/assets/package/lock changes
10. `git diff --check` PASS.

## Verification

Lean / Documentation Only.

Required:
- direct Current Source/SPEC inspection
- documentation consistency review
- verify only task-owned docs changed
- `git diff --check`.

No tests/build required because Production Source must remain unchanged.

## Completion Report

Include:

- Result
- Preflight
- stale wording found
- exact concept changes
- confirmed Product visual baseline after sync
- remaining unresolved visual items
- resolution wording after sync
- Other Stale Documentation / Unexpected Scope
- Design Deviations
- Verification
- Git delivery.

## Design Deviations

If none:

`Design Deviations: NONE`

Do not materially reinterpret the current Product baseline.

## Stop Conditions

STOP/BLOCKED if:

- Current Source contradicts the accepted Product background/runtime baseline
- another authoritative current SPEC says pixel art is still the intended Action Product baseline
- synchronizing the visual wording would require deciding final wrestler art or final platform resolution.

Do not guess through a material contradiction.

## Git Delivery

Documentation-only Task.

Expected changed files:

- `docs/GAME_CONCEPT.md`
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

Do not modify `main`.

Suggested commit:

`docs: sync product visual baseline`

Push `origin/develop`.

## Next Task

After this Documentation Sync passes review:

`ACTION-ART-02A-HUD-SHELL`

can implement the first runtime Product HUD shell with fixture presentation data.

## Final Instruction

Stop after the visual/resolution concept sync.

Do NOT implement the HUD in this Task.

After commit/push/report:

「PRODUCT-VISUAL-BASELINE-SPEC-SYNC-01 が完了し、ChatGPT Review待ちです」


# Final ChatGPT Review

Overall Result: PASS

## Reviewed Delivery

- Documentation commit:
  `8bd9e0533d58fd6d06db687e8980ae7b80826f84`
- Agent-Start-Head:
  `4198f58aac78e639c8b0a80419a5fd5f9b6d52ce`
- Diff is one documentation commit.
- Changed only:
  - `docs/GAME_CONCEPT.md`
  - `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- No Production Source / assets / package / lock changes.

## GAME_CONCEPT Visual Baseline

PASS.

The obsolete confirmed statement:

`ドット絵・簡素な2D Presentationを基本方向とする`

has been removed as an authoritative Product direction.

The confirmed current Action Product baseline now accurately records:

- top-down Action remains
- stylized painted 2D Product presentation
- accepted warm traditional sumo arena / dohyo visual baseline
- Product HUD direction is specified separately in `docs/ACTION_HUD_PRODUCT_SPEC.md`.

This matches Current Source and accepted Product work.

## Resolution Wording

PASS.

The document now distinguishes correctly:

### Confirmed current baseline
- Action Product presentation currently uses a 1920×1080 logical/art coordinate baseline
- browser display is scaled from that baseline.

### Still unresolved
- final platform/performance resolution policy
- future rendering/export optimization choices.

Therefore 1920×1080 is not incorrectly treated as an immutable forever-final decision.

## Deferred Visual Items

PASS.

The sync does NOT prematurely decide:

- final wrestler Product-art treatment
- Management presentation details
- remaining visual details not yet accepted.

Current provisional wrestlers remain temporary while their scale baseline stays accepted.

## Product HUD Relationship

PASS.

The GAME_CONCEPT update points to the Product HUD spec rather than duplicating it.

Authoritative HUD detail remains:

`docs/ACTION_HUD_PRODUCT_SPEC.md`

No conflict introduced.

## Scope Discipline

PASS.

The Agent did not:
- touch runtime art
- change Phaser resolution
- change gameplay
- alter HUD spec
- redesign Management
- invent final wrestler art.

The existing Kairosoft-like Management presentation direction was correctly left untouched because it belongs to a different visual layer and was outside this narrow sync.

## Verification

PASS for Documentation-only scope.

- direct Current Source/SPEC inspection reported
- `git diff --check`: PASS
- no Source tests/build required.

## Accepted Baseline After This Review

Do Not Reopen without explicit design change:

- Action Product visual baseline = stylized painted top-down 2D
- current accepted arena / dohyo Product art remains baseline
- current Action presentation coordinate baseline = 1920×1080
- final platform/performance resolution remains open
- final wrestler Product art remains Deferred
- Product HUD spec remains authoritative.

## Next Task

Proceed to:

`ACTION-ART-02A-HUD-SHELL`

Scope should remain small:

- pure fixture presentation/view-model data
- East / West identity blocks
- center Day chip
- Product-style panel treatment
- debug/prototype text cleanup as defined by the HUD spec
- no Management/Tournament implementation
- no pre-bout comparison screen yet
- no Simulation parameter design
- no wrestler art changes
- no gameplay changes.

Required final gate:
User Visual Check in the actual Product arena runtime.
