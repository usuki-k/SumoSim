Task-ID: ACTION-11N-GRIP-SUCCESS-LOWER-MARKER-REFLECTION-TUNE
Status: REVIEWED
Task-Type: PRESENTATION VISUAL TUNE
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: c3d11081693f80bfc77a1cebece5c55cd32c9ba7
Review-Handoff: ACTION-11M technical PASS but User Visual Gate REJECTED. User accepts the authored forearm/fist art and upper markers. The remaining issue is the lower two markers' orientation/chirality. User explicitly wants Claude Code to use image reflection if needed so the lower markers resemble the latest reference: symbolically reaching from the opponent shoulder/back area toward the opponent mawashi. Self-character anatomical shoulder position is irrelevant.
Handoff-Mode: GITHUB

# ACTION-11N — Grip Success Lower Marker Reflection Tune

## Purpose

Tune ONLY the two lower/foot-side authored Grip-success markers by reflecting the existing authored forearm/fist art as needed.

The target is the User's latest visual reference:
- upper markers remain as they are;
- lower markers should have the same kind of visual flow as the upper markers;
- each lower arm should read symbolically as curving from the opponent shoulder/back region toward the opponent mawashi;
- fist/hand shape is accepted and must not be redesigned;
- self-character shoulder/anatomical continuity is not important.

This is presentation-only.

## Accepted Baselines — Preserve

Do not change:
- ACTION-11C Grip gameplay;
- ACTION-11F pair compression:
  - GRIP_SUCCESS_FORWARD_OFFSET_R = +0.14
  - GRIP_SUCCESS_LATERAL_OFFSET_R = -0.20;
- ACTION-11H tone correction;
- ACTION-11J pair READY visibility:
  - either TURNING -> all markers hidden
  - both READY -> markers visible;
- ACTION-11L authored forearm/fist source artwork;
- upper/head-side marker geometry and appearance;
- four-marker total count;
- canonical 0.70 m grapple bond;
- Grip attempt/success wrestler body assets.

No changes under:
- src/game/sumo/
- src/game/input/

## Current ACTION-11M State

Upper markers are accepted for this Task and must remain byte/value-equivalent in placement and texture choice.

Current lower hand/grip contacts are acceptable:
- keep the fist on the mawashi unless a tiny pixel-level placement correction is unavoidable.

The ACTION-11M failure is primarily image orientation/chirality:
- the lower arm still does not visually match the desired reference;
- changing elbow coordinates alone was insufficient.

## Reflection Is Explicitly Allowed

Claude Code may reflect the existing authored forearm/fist image.

User does NOT need to provide a new image for this Task.

The goal is to reuse the existing accepted marker art.

Preferred minimal implementation:
- preserve the hand anchor on the mawashi;
- reflect only the lower marker image around the hand-anchor transform;
- keep upper markers unchanged.

## Candidate Reflection Comparison

Before choosing the final lower-marker orientation, create a local scratch comparison for the lower marker using the same hand contact / intended elbow direction.

Compare at minimum:
1. current orientation;
2. horizontal reflection (flip X);
3. vertical reflection (flip Y / existing opposite-side orientation);
4. both axes / 180-degree equivalent only if needed to disambiguate.

The comparison is implementation scratch only and must not become four runtime modes.

Choose ONE deterministic lower-marker transform that best matches the User reference.

Primary selection criterion:
> Does the visible arm curl from the opponent shoulder/back area into the mawashi, rather than looking like it originates from self or bends away from the pair?

If horizontal reflection clearly fixes the visual, prefer the smallest solution and stop exploring.

## Runtime vs Offline Reflection

Prefer the smallest deterministic solution.

Option A — runtime presentation flip:
- allowed for this Visual Gate;
- only lower markers may use it;
- the hand anchor must remain fixed on the mawashi;
- flip must be deterministic and state-independent;
- no per-frame mode switching.

Option B — offline derived variant:
- also allowed if it makes anchor math / testing cleaner;
- derive only from the existing accepted authored runtime marker;
- do not require a second user source;
- record the derived anchor transform.

Do not build a new art pipeline unless necessary.

If runtime flip around the hand anchor is clean, it is preferred for this placement-only Task.

## Anchor Rule

The fist/hand anchor is authoritative.

Reflection must not cause the fist to drift off the mawashi.

For each lower marker:
- hand contact remains the current target-local mawashi point;
- reflection occurs around the texture/origin transform;
- elbow/forearm silhouette may move to the opposite visual side as a result;
- scale remains unchanged unless a small visual correction is necessary.

## Desired Lower Marker Direction

The lower marker should visually resemble the lower arms in the latest User reference:

- elbow/forearm body appears nearer the opponent shoulder/back side;
- fist ends on the opponent mawashi;
- forearm curves inward across the opponent body;
- it should NOT hang down from the self-character side;
- it should NOT visually point away from the pair.

Keep a roughly 30–45 degree diagonal relationship to the mawashi as a visual target.

If exact numeric angle must change slightly to match the reference, keep it within 30–45 degrees and report the final value.

## Upper Markers

Upper/head-side markers are frozen for this Task.

Must remain unchanged:
- hand point;
- elbow point;
- texture choice/orientation;
- scale;
- rotation;
- depth.

Add tests that pin their ACTION-11M values exactly.

## Lower Geometry

Prefer preserving current lower fist contacts.

Allowed:
- reflection flag / reflected texture selection;
- small lower-only elbow adjustment;
- small lower-only rotation adjustment;
- small lower-only scale adjustment if absolutely necessary.

Not allowed:
- moving upper markers;
- changing authored pixels;
- changing body compression;
- changing gameplay.

## Marker Art

Do not:
- redraw fist;
- change fist shape;
- recolor;
- tone-match;
- AI-regenerate;
- modify source PNG;
- alter existing authored gate runtime PNG pixels unless adding a deterministic reflected derived variant is chosen.

If using runtime flip, public assets remain unchanged.

## Visibility

Preserve:
- READY neutral -> 4 markers
- READY Drive -> 4 markers
- READY Morozashi -> 4 markers
- either TURNING -> 0 markers
- release/recovery/other actions -> 0 markers.

## Required Tests

1. upper markers remain exactly ACTION-11M values;
2. lower markers use the selected reflection/orientation only;
3. lower hand contacts remain on the mawashi;
4. reflection leaves hand-anchor world position invariant;
5. lower marker visual axis remains 30–45 degrees to the mawashi;
6. lower markers are deterministic for red/blue;
7. READY pair -> 4 markers;
8. TURNING -> 0;
9. release/recovery/other actions -> 0;
10. ACTION-11F constants unchanged;
11. ACTION-11H runtime/body tone unchanged;
12. Snapshot and canonical 0.70 m bond unchanged;
13. no src/game/sumo or src/game/input diff.

If runtime flip is used:
- tests must prove only the lower marker images are flipped;
- upper images remain unflipped;
- flip state does not leak across texture swaps/frames.

If offline reflection is used:
- deterministic derived output + anchor test is required.

## Browser / Runtime Smoke

Capture:
1. neutral immediately after success
2. neutral settled
3. Drive
4. Morozashi
5. release
6. turning immediately after success
7. turning mid
8. turning settled

Also create:
- close-up of neutral settled;
- before/after ACTION-11M -> ACTION-11N;
- scratch orientation comparison if useful.

Visual expectations:
- upper markers unchanged;
- lower markers now match the latest User reference direction;
- lower forearms visually curl from opponent shoulder/back toward mawashi;
- fists remain on mawashi;
- no lower arm appears to originate from self;
- no markers during TURNING;
- release clears markers.

## User Visual Gate

Required.

Primary question:
> Do the reflected lower markers now match the intended reference, with the arm visually reaching from the opponent shoulder/back into the mawashi while the upper markers remain unchanged?

Judge:
- lower orientation/chirality;
- fist contact point;
- 30–45 degree diagonal;
- symmetry/readability of four markers;
- Drive/Morozashi;
- TURNING hide.

## Stop Conditions

STOP if:
- reflection cannot achieve the desired lower-arm direction without editing the authored image;
- upper markers must change;
- gameplay/bond/facing changes are required;
- dynamic z-order is required;
- unrelated accepted visuals regress.

If reflection alone is insufficient, report the closest candidate and the exact remaining visual mismatch. Do not ask for a new User asset unless this Task proves reflection insufficient.

## Verification

Verification Level: Standard Presentation Visual Tune

Required:
- focused marker reflection/layout tests
- Grip success presentation regression
- Grip/Grapple/Drive/Orientation regression
- Push/Tsuppari/Counter/Kuzushi presentation regression
- pnpm test
- pnpm build
- git diff --check
- browser/runtime smoke
- prove ACTION-11F/11H unchanged
- prove src/game/sumo / src/game/input unchanged.

## Completion Report

Include:
- Result
- reflection candidates compared
- selected reflection method
- whether runtime flip or offline variant was used
- old lower orientation -> new lower orientation
- upper unchanged evidence
- lower hand contact location
- final lower angle
- changed files
- preservation evidence
- verification results
- close-up before/after
- 8-frame montage
- Design Deviations
- Unexpected Scope
- User Visual Gate: REQUIRED
- Git delivery.

If none:
Design Deviations: NONE

## Git Delivery

Follow AGENTS.md.

Normal successful Task:
- stage Task-owned files only
- one implementation commit
- fetch / fast-forward safety
- push origin/develop
- verify remote SHA
- clean working tree.

Suggested commit:
feat(presentation): reflect lower grip hand markers

Do not modify:
- main
- PROJECT_HANDOFF.md
- CURRENT_TASK.md.

# Final Instruction

Keep upper authored Grip markers unchanged.

For the lower two markers, use deterministic image reflection as needed so the visible forearm/fist silhouette matches the User's latest reference: opponent shoulder/back -> mawashi.

Keep the fist anchored on the mawashi, preserve the four-marker READY rule, and do not change gameplay or wrestler body art.


---

# ChatGPT Review Handoff

Review-Date: 2026-10-24
Overall Result: ACCEPTED — TECHNICAL PASS / USER PLAY TEST ACCEPTED PROVISIONALLY
Accepted Baseline: 1384036d768b88a8f97bd5515cef73fc0544a571

## Technical Review

Confirmed from Current Source / diff:

- Grip hand VFX remains presentation-only;
- four authored markers remain visible only for READY grapple states;
- either wrestler TURNING -> all markers hidden;
- release / recovery / non-Grip actions -> zero markers;
- authored runtime marker pixels remain unchanged;
- no src/game/sumo or src/game/input changes;
- canonical grapple bond remains 0.70 m;
- ACTION-11F pair compression remains unchanged;
- ACTION-11H tone correction remains unchanged.

Current final marker layout:

Red:
- headSide:
  - hand (-0.40, +0.80)
  - elbow (+0.25, +1.15)
  - authored
  - ~0.74 R
  - 61.70°
- footSide:
  - hand (-0.55, -0.45)
  - elbow (-0.05, -0.95)
  - mirrored
  - ~0.71 R
  - 45.00°

Blue is the lateral reflection of Red:
- headSide uses mirrored
- footSide uses authored.

## Design Deviation Review

The final ACTION-11N state differs from the original Task constraints:

- upper/head-side markers were originally required to stay fixed;
- original visual target requested roughly 30–45°;
- final head-side angle is 61.70°.

This deviation is ACCEPTED because, during the same Task, the User:
- PlayTested the first implementation,
- supplied a new reference image,
- explicitly selected the P1 layout for all four markers.

The later direct User instruction supersedes the earlier Task constraint.

No gameplay semantics changed.

## Verification Review

Accepted:

- focused marker tests: 18 / 18 PASS
- pnpm test: 30 files / 523 PASS
- pnpm build: PASS
- git diff --check: PASS
- browser/runtime smoke: 27 / 27 PASS
- TURNING visibility regression: PASS
- release / other-action hiding: PASS
- ACTION-11F / 11H preservation: PASS
- gameplay / canonical bond preservation: PASS.

Known verification caveat:

- `export_grip_forearm_hand_gate.py --check` was not run because the local ignored source image present at review time had a different decoded hash from the accepted ACTION-11L source.
- ACTION-11N does not modify the authored marker runtime assets or exporter/tooling.
- committed authored runtime PNG hashes remained unchanged.

This does not block acceptance of this placement-only Task.

## User Play Test

User result:

> 少し見た目に違和感はありますが一旦良いです。

Treat this as provisional visual acceptance.

The current four-marker Grip-success VFX is now the baseline unless a later Task explicitly reopens it.

## Accepted Grip Success Visual Baseline

Preserve unless explicitly changed:

- ACTION-11F pair compression
- ACTION-11H body tone correction
- authored forearm/fist runtime markers
- four markers total
- current ACTION-11N marker placement/orientation
- pair READY-only visibility
- TURNING hides all markers
- release removes all markers.

## Deferred

Potential future polish only if explicitly requested:

- refine hand/forearm visual awkwardness;
- improve grip-specific hand shape;
- tune upper marker angle/position;
- replace temporary Grip visual-gate assets with final Product art.

Do not reopen these automatically.

## Next Task Constraint

Future Action work should treat ACTION-11N as the accepted current Grip visual baseline.

Do not modify Grip success VFX incidentally while working on unrelated Push / Tsuppari / Counter / Management tasks.
