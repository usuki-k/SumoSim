Task-ID: ACTION-11J-GRIP-SUCCESS-LIMB-VFX-READY-ONLY
Status: READY
Task-Type: PRESENTATION VISUAL TUNE
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: f0816e7439b72edcf6c5c5a11d4927208c9e1ff5
Review-Handoff: ACTION-11I stopped before commit/push because tuned limbs floated badly during Grappled Orientation TURNING. Repository remained unchanged. User selected the minimal fix: adopt the improved settled/READY limb geometry from the 11I WIP, but hide both wrestlers' limb VFX whenever either wrestler is TURNING.
Handoff-Mode: GITHUB

# ACTION-11J — Grip Success Limb VFX: Settled Geometry + Pair TURNING Hide

## Purpose

Finish the rejected ACTION-11I visual tune safely.

User-approved direction:

1. keep the improved arm/hand geometry that looked better once both wrestlers were settled / facing each other;
2. while either wrestler is still TURNING in a grapple, hide arm/hand VFX for BOTH wrestlers;
3. once both are READY, show the tuned arm/hand VFX for both again.

This is Presentation-only.

Do not change gameplay, canonical positions, grapple bond, facing, or Grappled Orientation.

---

# Why ACTION-11I Stopped

ACTION-11I correctly hit its Stop Condition.

Observed problem:

- the longer tuned arm geometry looked good in settled neutral / Drive / Morozashi;
- during TURNING, the limb geometry still followed each wrestler's own facing;
- because the geometry assumes a face-to-face grip, the turning wrestler's arms projected into empty space, in one case by roughly 2R;
- the other wrestler's arm could also miss the opponent while the pair was not yet aligned.

This was a presentation-state mismatch, not a gameplay bug.

Do not try to solve it by changing Grappled Orientation.

---

# Accepted Baselines — Preserve

## ACTION-11C Gameplay

Preserve:

- Grip lunge / timing
- contact-driven Grip success
- Push / Tsuppari / Counter / Grip contest rules
- canonical 0.70 m grapple bond
- Grappled Orientation
- Drive
- release
- ring-out.

No Production changes under:

```
src/game/sumo/
src/game/input/
```

## ACTION-11F Pair Compression

Keep exactly:

```
GRIP_SUCCESS_FORWARD_OFFSET_R = +0.14
GRIP_SUCCESS_LATERAL_OFFSET_R = -0.20
```

## ACTION-11H Tone Match

Keep the accepted Grip-success tone correction exactly.

Do not change:
- tone curve
- skin mask
- runtime hashes by re-exporting
- source art
- exporter/recipe.

## ACTION-11G Existing Limb VFX

ACTION-11G was technically valid but visually rejected.

ACTION-11J replaces its visual geometry with the improved settled geometry developed during the stopped 11I work.

---

# Optional Local WIP Patch

The stopped ACTION-11I work was saved locally as:

```
C:\Users\Kazu\AppData\Local\Temp\claude\e--develop-CrazyGames-SumoSim\db9a9f45-e5aa-49b3-8e5b-2e28cda7a821\scratchpad\action11i_wip.patch
```

If this exact patch still exists on the same machine, it may be inspected or applied as a starting point.

Do NOT rely on it as the sole Source of Truth.

Before applying:
- inspect the patch;
- confirm it only contains intended ACTION-11I presentation changes;
- do not import scratch/debug-only code blindly.

If the patch is missing, reconstruct the settled geometry from this Task / previous report rather than stopping.

---

# Settled / READY Limb Geometry

The ACTION-11I WIP improved the arm model by splitting each visible arm into two segments:

```
shoulder -> elbow
elbow -> hand
```

Visual intent:

- shoulder -> elbow sits behind the body;
- body overlap hides the root / cut-face;
- elbow -> hand sits above the bodies;
- hand visibly lands on the opponent;
- high arm reaches opponent upper torso / shoulder;
- low arm wraps farther toward opponent flank / waist / mawashi.

Adopt that improved settled geometry rather than the ACTION-11G horizontal-bar geometry.

Do NOT revert to the old ACTION-11G single straight capsule if the WIP geometry can be recovered/reconstructed safely.

---

# Geometry Requirements

Exact numeric values are not prescribed because the stopped 11I work was never committed as an accepted baseline.

However, preserve the WIP's successful settled-state design principles:

## High arm

- shorter than the low arm;
- originates under/near own upper-side body;
- elbow wraps around opponent upper-side silhouette;
- hand lands around opponent upper torso / shoulder / upper flank;
- root hidden beneath own body;
- distal portion visible above body where useful.

## Low arm

- longer wrap;
- originates under/near own lower-side body;
- elbow passes around opponent flank;
- hand reaches opponent waist / mawashi / back-side region;
- partial occlusion is preferred over showing the entire arm.

## Root

Do not expose a circular cut-face / detached cylinder root.

Bury the root beneath the owning wrestler body.

## Shape

Two-segment arm is preferred.

Do not make the arm perfectly horizontal unless that falls out naturally from the local geometry.

---

# Pair READY Visibility Rule

The new key rule:

> Limb VFX is visible only when Grip-success pose is active AND both wrestlers are READY / not TURNING.

Conceptually:

```
successPose =
  self.pose === 'grapple' || self.pose === 'drive'

pairReady =
  !self.turning && !opponent.turning

limbsVisible =
  successPose && pairReady
```

This rule applies symmetrically to both wrestlers.

If either participant is TURNING:

```
both wrestlers' limb VFX = hidden
```

Do not show one wrestler's arms while hiding only the turning wrestler's arms.

Reason:
- both arm layouts assume an aligned opponent;
- showing one side alone can still point to empty space.

---

# Ownership / State Flow

Do not add a new gameplay state.

Use existing Simulation-derived presentation data:

- `WrestlerVisualState.turning`
- opponent's `WrestlerVisualState.turning`.

Preferred implementation:

- derive a pair-level Presentation boolean in the Scene/View composition layer;
- pass only the visibility decision / pair-ready context needed by WrestlerView.

Do NOT:
- store pairReady in Simulation;
- duplicate Grappled Orientation state;
- add a timer.

A small pure helper is preferred, e.g.:

```
gripSuccessPairLimbsVisible(selfState, opponentState)
```

or equivalent.

It must be Phaser-free.

---

# WrestlerView / Scene Integration

Current WrestlerView resolves one wrestler at a time.

ACTION-11J may minimally extend the presentation call path so each wrestler's limb visibility can know whether the opponent is TURNING.

Preferred constraints:

- body art selection remains per-wrestler;
- ACTION-11F body offset remains per-wrestler;
- limb geometry remains per-wrestler;
- only visibility needs pair context.

Do not introduce a generic pair renderer unless strictly necessary.

If current scene code already has both visual states before calling WrestlerView.apply, derive pairReady there.

---

# Depth / Occlusion

Keep the simple explicit layer approach.

Preferred:

- shoulder -> elbow / root segment: behind bodies
- elbow -> hand / distal segment: above bodies.

Use fixed depth values only.

Do not add dynamic z sorting.

Stable overlap is acceptable.

If the WIP patch uses different small explicit depths, preserve them if they meet this intent.

---

# Drive / Neutral / Morozashi

When both participants are READY:

- neutral -> limbs visible;
- Drive -> limbs visible;
- Morozashi holder -> limbs visible;
- Morozashi disadvantaged -> limbs visible.

Same geometry for all.

Do not add Morozashi-specific pose yet.

---

# TURNING

Required:

- if either wrestler is TURNING, all Grip limb VFX are hidden;
- body success art and ACTION-11F pair compression remain visible;
- turning animation/facing continues normally;
- no limb flicker while turning remains true;
- at the first frame where both are READY, both wrestlers' limbs appear together.

Do not fade or interpolate.

The sudden appearance at READY is acceptable for this Visual Gate.

---

# Release

At release:

- success art ends as currently;
- pair compression ends as currently;
- limb VFX remains hidden.

No stale limb after release.

---

# Required Tests

## Pair visibility

V1. both grappled + both READY -> visible.

V2. self TURNING -> both hidden.

V3. opponent TURNING -> both hidden.

V4. both TURNING -> both hidden.

V5. TURNING -> READY transition -> both become visible on same logical presentation frame.

V6. Drive + both READY -> visible.

V7. Morozashi + both READY -> visible.

V8. Grip attempt/recovery/other actions -> hidden.

## Geometry

G1. settled tuned geometry is deterministic.

G2. high arm reaches upper torso / shoulder region.

G3. low arm reaches flank / waist / mawashi region.

G4. shoulder roots are buried / behind body.

G5. distal hands render above body where intended.

G6. geometry remains R-relative.

## Preservation

P1. ACTION-11F constants remain +0.14 / -0.20.

P2. ACTION-11H tone recipe / runtime textures unchanged.

P3. canonical grapple bond remains 0.70 m.

P4. Snapshot unchanged.

P5. no src/game/sumo or src/game/input Production diff.

P6. no public wrestler asset / wrestler-art tool diff.

---

# Browser / Runtime Smoke

Required.

Capture the same 8-frame sequence:

1. neutral immediately after success
2. neutral settled
3. Drive while grappled
4. Morozashi grapple
5. immediately after release
6. turning immediately after success
7. turning mid
8. turning settled.

Required visual expectations:

## 1–4 settled/READY
- tuned arms/hands visible;
- high arm wraps upper body;
- low arm reaches waist/mawashi;
- no detached horizontal bars;
- no exposed cut-face roots.

## 6–7 TURNING
- NO arm/hand VFX on either wrestler;
- success body art / pair compression remain;
- no floating limbs.

## 8 settled after TURNING
- both wrestlers' limb VFX appear again together;
- tuned settled geometry matches ordinary neutral/Drive look.

## 5 release
- no limbs.

Also verify:
- no new console/runtime errors;
- R restart;
- Push/Tsuppari/Counter/Kuzushi unchanged.

---

# User Visual Gate

REQUIRED.

Primary questions:

1. In settled Grip, do the arms now read as wrapping upper torso + waist/mawashi?
2. Do roots look attached rather than cut off?
3. Is hiding arms during TURNING visually acceptable?
4. Does the simultaneous reappearance once both are READY feel acceptable?
5. Does neutral / Drive / Morozashi remain coherent?

If the settled geometry is still rejected:
- identify whether the problem is root, elbow path, hand endpoint, width, or procedural shape.

If TURNING hide/reappear is rejected:
- then investigate a dedicated TURNING limb pose in a later Task.

Do not change Gameplay.

---

# Scope

## In Scope

- adopt/reconstruct ACTION-11I settled limb geometry
- two-segment limb rendering if needed
- fixed far/near segment depths
- pair-level READY visibility
- minimal presentation plumbing
- tests / browser smoke / montage.

## Scope Out

Do NOT:

- change Grip gameplay
- change Grappled Orientation
- change canonical positions/bond/facing
- change ACTION-11F offsets
- change ACTION-11H tone correction
- modify wrestler source/runtime assets
- AI regenerate art
- add TURNING-specific limb pose
- add dynamic z sort
- add generic pair renderer/framework
- modify PROJECT_HANDOFF.md.

---

# Stop Conditions

STOP if:

- pair TURNING visibility requires changing Simulation state
- settled geometry still requires pair compression/gameplay changes
- dynamic z sorting is required
- current presentation flow cannot expose opponent.turning without broad architecture changes
- external authored limb art becomes necessary
- unrelated accepted visuals regress.

---

# Verification

Verification Level:
Standard Presentation Visual Tune

Required:

- focused limb geometry tests
- pair READY visibility tests
- Grip success presentation tests
- Grip/Grapple/Drive/Orientation regression
- Push/Tsuppari/Counter/Kuzushi presentation regression
- `pnpm test`
- `pnpm build`
- `git diff --check`
- browser/runtime smoke
- prove ACTION-11F/11H unchanged
- prove src/game/sumo / src/game/input unchanged
- prove public/assets/action/wrestler / tools/wrestler_art unchanged.

---

# Completion Report

Include:

- Result
- whether WIP patch was used or geometry was reconstructed
- old ACTION-11G geometry -> final settled geometry
- two-segment/depth model
- pair READY visibility implementation
- changed files
- proof ACTION-11F/11H unchanged
- proof gameplay/canonical bond unchanged
- focused/full verification
- 8-frame montage
- explicit screenshots showing:
  - TURNING limbs hidden
  - READY limbs visible
- Design Deviations
- Unexpected Scope
- User Visual Gate: REQUIRED
- Git delivery.

If none:

```
Design Deviations: NONE
```

---

# Git Delivery

Follow `AGENTS.md`.

Normal successful Task:

- stage Task-owned files only
- one implementation commit
- fetch / fast-forward safety
- push `origin/develop`
- verify remote SHA
- clean working tree.

Suggested commit:

`feat(presentation): hide grip limbs while turning`

Do not modify:

- `main`
- `PROJECT_HANDOFF.md`
- `CURRENT_TASK.md`.

# Final Instruction

Adopt the improved ACTION-11I settled/READY arm geometry, but show Grip-success arm/hand VFX only when BOTH grappled wrestlers are READY.

If either wrestler is TURNING, hide limb VFX for BOTH wrestlers.

Do not change Gameplay, Grappled Orientation, ACTION-11F pair compression, ACTION-11H tone matching, wrestler assets, or canonical 0.70 m bond.
