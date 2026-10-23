Task-ID: ACTION-11E-GRIP-SUCCESS-PAIR-OFFSET-TUNE
Status: REVIEWED
Task-Type: PRESENTATION VISUAL TUNE
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 4db810ed790434e4b73186297faa7a2727f440c0
Implementation-Commit: 2df789ba542dad5eb86a905038f21b307c693f75
Handoff-Mode: GITHUB

# ACTION-11E — Grip Success Pair Offset Tune

## Purpose

Presentation-only visual tuning after ACTION-11D.

While Grip success art is shown, offset each wrestler laterally relative to its own facing so the pair's heads no longer meet nose-to-nose.

No Simulation/gameplay geometry changes.

---

# ChatGPT Review Handoff

Review-Date: 2026-10-23
Overall Result: TECHNICAL PASS / USER VISUAL GATE REQUIRED
Accepted Technical Baseline: 2df789ba542dad5eb86a905038f21b307c693f75

## Accepted Technical Implementation

Current provisional visual rule:

```
GRIP_SUCCESS_LATERAL_OFFSET_R = -0.30
```

Meaning:

- while visual pose is `grapple` or `drive`
- each wrestler sprite is shifted 0.30 R to that wrestler's own LEFT
- the procedural shadow receives the same display offset
- the canonical Simulation center is unchanged
- the canonical facing is unchanged
- grapple bond distance remains 0.70 m
- contact / collision / ring-out geometry is unchanged.

The pure helper:

```
gripSuccessDisplayOffsetPx(state, facing, bodyRadiusPx)
```

returns the lateral display offset only for Grip-success poses and zero for every other pose.

## Preservation

Confirmed from Current Source / diff:

- no src/game/sumo changes
- no src/game/input changes
- no public asset changes
- no wrestler-art exporter/recipe changes
- Grip attempt art unchanged
- Grip success textures unchanged
- Push / Tsuppari / Counter / Kuzushi visuals unchanged
- release immediately removes the offset
- later Grip attempt starts with offset zero.

## Verification Review

Accepted:

- focused Grip success presentation tests: 17 / 17 PASS
- pnpm test: 29 files / 503 PASS
- pnpm build: PASS
- git diff --check: PASS
- src/game/sumo / src/game/input / public / tools diff: 0
- browser/runtime smoke: 15 / 16; the only failure is pre-existing /favicon.ico 404 and is outside this Task.

This is sufficient for Technical PASS.

## Visual Intent

The implemented offset is intended to make the mirrored Grip-success pair point-symmetric in display space:

- blue and red move in opposite world-space lateral directions
- pair midpoint remains visually centered
- head separation changes by approximately 0.60 R
- shoulders/arms remain close enough to preserve grapple density.

## User Visual Gate

REQUIRED.

Judge:

1. Do the heads now look offset toward the opponent's shoulder rather than nose-to-nose?
2. Is 0.30 R the right amount?
3. Does the pair still feel tightly engaged rather than separated?
4. Does Drive remain visually natural?
5. Does Morozashi remain visually acceptable with the same pose/offset?
6. Is the immediate snap back to canonical display position on release acceptable?
7. Is the appearance during Grappled Orientation turning acceptable?

Do not promote Grip success art or the 0.30 R offset to permanent Product baseline until User acceptance.

## Known Untested Item

Grappled Orientation turning was not visually inspected in ACTION-11E.

During turning, each wrestler still applies the same local-left offset from its own current facing, so the pair is not guaranteed to remain perfectly point-symmetric until both facings settle.

If User notices a visual problem during turning, investigate that specifically rather than changing gameplay geometry.

## Do Not Reopen

Unless User explicitly requests it:

- ACTION-11C Grip gameplay
- 0.70 m canonical gameplay bond
- Grip attempt art
- Grip success source pixels
- Push / Tsuppari / Counter / Kuzushi tuning.

## Deferred

- Grip hand-marker VFX on mawashi
- permanent Product promotion of Grip attempt/success art
- separate neutral / Morozashi success visuals
- turning-specific presentation treatment, only if User reports a problem.

## Next Task Constraint

Wait for User Visual Gate on ACTION-11E.

If accepted:
- treat 0.30 R presentation-only pair offset as current Grip-success visual baseline.
- next focused visual task may add the previously requested hand-marker VFX.

If not accepted:
- tune only `GRIP_SUCCESS_LATERAL_OFFSET_R` first before adding rotation, pair-local transforms, or new source art.
