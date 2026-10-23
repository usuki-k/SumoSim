Task-ID: ACTION-11M-GRIP-SUCCESS-LOWER-MARKER-POSITION-TUNE
Status: READY
Task-Type: PRESENTATION VISUAL TUNE
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 903fe8a372fdc37979a1e29b73a638e59592ccdf
Review-Handoff: ACTION-11L technical PASS. User accepts the authored forearm/fist art itself and does not want hand-shape changes. Current issue is position only: the lower two markers look as if they originate from the self character. User wants them to read symbolically as extending from the opponent character's shoulder/back area toward the opponent mawashi, like the upper markers. Handoff-Mode: GITHUB

# ACTION-11M — Grip Success Lower Marker Position Tune

## Purpose

Tune only the two LOWER authored Grip-success forearm/hand markers.

User visual feedback:

- fist/forearm art is acceptable; do not replace or redraw it;
- upper two markers are acceptable and should remain unchanged;
- lower two markers currently look too tied to the self character's shoulder/body;
- anatomical attachment to self is NOT important;
- treat the marker symbolically;
- the lower marker should visually read as:
  opponent shoulder / upper-back area
  -> diagonally down toward
  opponent mawashi / waist grip point;
- preserve an approximately 30–45 degree visual relationship to the mawashi.

This is presentation-only.

## Accepted Baselines — Preserve

Do not change:

- ACTION-11C Grip gameplay;
- ACTION-11F pair compression:
  - GRIP_SUCCESS_FORWARD_OFFSET_R = +0.14
  - GRIP_SUCCESS_LATERAL_OFFSET_R = -0.20
- ACTION-11H Grip-success tone match;
- ACTION-11J pair READY visibility:
  - either wrestler TURNING -> all Grip markers hidden
  - both READY -> markers visible;
- ACTION-11L authored forearm/fist source/runtime art;
- marker count = four total per settled pair;
- canonical grapple bond = 0.70 m;
- Grip attempt/success wrestler body assets;
- fist/forearm image shape itself.

No Production changes under:
- src/game/sumo/
- src/game/input/

## Current ACTION-11L Layout

Per target wrestler, ACTION-11L renders two markers:

RIGHT:
- hand = (-0.45 R, +0.62 R)
- elbow = (-0.03 R, +1.18 R)

LEFT:
- hand = (-0.45 R, -0.62 R)
- elbow = (-0.03 R, -1.18 R)

Each is 0.70 R and ~36.87 degrees relative to the target local lateral/mawashi axis.

Do not assume both need identical geometry after this Task.

## Required Change

Only the lower/visually-bottom marker pair should be tuned.

The tuned lower marker must read symbolically as if it comes from the OPPONENT shoulder/back region and reaches the opponent mawashi.

Important:

- do NOT try to connect the marker to the self character;
- self shoulder/body geometry should not constrain placement;
- grip-point/hand should stay on or immediately over the opponent mawashi;
- move mainly the elbow / forearm-side placement and rotation to create the visual line:
  opponent shoulder/back -> opponent mawashi;
- the visible forearm may overlap body art;
- anatomical continuity is not required.

Upper marker geometry must remain unchanged.

## Recommended Layout Strategy

Keep the hand contact near the existing mawashi point unless visual evidence shows a small move is required.

For the lower marker, explore only target-local presentation geometry.

Preferred target:
- hand remains near back-half waist / mawashi;
- elbow is moved inward/upward toward the target's shoulder/back silhouette;
- marker crosses the mawashi at a visually clear 30–45 degree diagonal;
- marker should not appear to hang vertically downward from the wrestler;
- marker should not look like it originates from the self character.

If necessary, define separate upper/lower marker geometry explicitly rather than mirroring one geometry mechanically.

A small asymmetry is acceptable if it produces the intended symbolic read.

## Art / Asset Constraints

Do not modify:
- candidate_grip_forearm_hand_symbol.png
- exporter crop/downscale
- authored/mirrored runtime PNG pixels
- anchors unless a true technical anchor error is discovered.

Do not AI-regenerate art.

This Task is placement-only.

## Visibility

Preserve:
- READY neutral -> four markers
- READY Drive -> four markers
- READY Morozashi -> four markers
- either TURNING -> zero markers
- release/recovery/other actions -> zero markers.

## Required Tests

Focused presentation tests must prove:

1. upper marker geometry is byte/value-identical to ACTION-11L expected values;
2. lower marker has distinct tuned geometry;
3. lower hand remains on/near the target mawashi;
4. lower elbow/forearm direction is toward target shoulder/back rather than self;
5. final lower visual angle remains 30–45 degrees relative to the target mawashi/lateral axis;
6. four markers total in READY pair;
7. TURNING -> zero;
8. release/recovery/other actions -> zero;
9. ACTION-11F constants unchanged;
10. ACTION-11H runtime/body tone assets unchanged;
11. Snapshot and canonical 0.70 m bond unchanged;
12. no src/game/sumo or src/game/input diff.

## Browser / Runtime Smoke

Capture at minimum:

1. neutral immediately after success
2. neutral settled
3. Drive
4. Morozashi
5. release
6. turning immediately after success
7. turning mid
8. turning settled

Also create a close-up / before-after that clearly shows the LOWER marker change.

Visual expectations:

- upper markers look unchanged from ACTION-11L;
- lower markers now visually run from opponent shoulder/back area toward opponent mawashi;
- hand/grip end still lands on mawashi;
- lower markers no longer appear to be positioned from the self character;
- no marker during TURNING;
- no stale marker after release.

## User Visual Gate

Required.

Primary question:

> Do the lower two authored markers now read symbolically as extending from the opponent shoulder/back toward the opponent mawashi, matching the visual direction of the upper markers?

Judge:
- upper markers unchanged;
- lower marker direction;
- hand contact point;
- 30–45 degree diagonal;
- four-marker readability;
- Drive/Morozashi coherence;
- TURNING hide.

## Stop Conditions

STOP if:

- correcting lower placement requires changing wrestler body art;
- upper markers must be materially changed to make lower markers work;
- gameplay/bond/facing changes are required;
- authored marker PNG must be edited;
- dynamic z sorting is required;
- unrelated accepted visuals regress.

## Verification

Verification Level: Standard Presentation Visual Tune

Required:
- focused marker-layout tests
- Grip success presentation regression
- Grip/Grapple/Drive/Orientation regression
- Push/Tsuppari/Counter/Kuzushi presentation regression
- pnpm test
- pnpm build
- git diff --check
- browser/runtime smoke
- prove ACTION-11F/11H unchanged
- prove authored marker assets unchanged
- prove src/game/sumo / src/game/input unchanged.

## Completion Report

Include:
- Result
- old lower geometry -> new lower geometry
- upper geometry unchanged evidence
- final lower marker angle
- final hand/grip contact location
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
feat(presentation): tune lower grip hand markers

Do not modify:
- main
- PROJECT_HANDOFF.md
- CURRENT_TASK.md.

# Final Instruction

Tune only the two lower authored Grip-success markers.

Keep the fist/forearm art and upper markers unchanged.

Position the lower markers symbolically so they appear to extend from the opponent shoulder/back area toward the opponent mawashi, with the hand still contacting the mawashi and a clear ~30–45 degree diagonal.
