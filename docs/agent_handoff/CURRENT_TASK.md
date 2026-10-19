Task-ID: VISUAL-01-ACTION-VISUAL-PROTOTYPE-INVESTIGATION
Status: READY
Task-Type: INVESTIGATION / ACTION VISUAL PROTOTYPE / PROVISIONAL SPRITES & ANIMATION
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: 43efaef5aa2bab5eeb6fa2fc8eceec1bf1fd3105
Handoff-Mode: GITHUB

# VISUAL-01 — Action Visual Prototype Investigation

## Purpose

Current Sumo Action Core is technically established through:

- grounded movement
- Contact
- discrete Push
- Counter / Kuzushi
- Counter side / rear relocation
- Grip / Engagement
- Morozashi
- Grappled Orientation
- Grappled Drive
- Ring-out / BoutOutcome

ACTION-06A Ring-out / BoutOutcome Foundation passed Technical Review and User Play Test.

However, Current Bout rendering is still a debug/prototype presentation:
- wrestlers are circles
- facing is a small marker
- grapple is a line
- action/posture/readiness is largely conveyed by debug text
- there are no wrestler art assets or animation assets in the repository

The User explicitly wants to stay in the **Action-first phase**.

Before Simulation / Management / MatchDayFlow work continues, determine the smallest provisional visual/sprite/animation pass that lets the User judge:

> Does the accepted Sumo Action actually read and feel like a game when it is no longer represented by debug circles?

Investigation Only / No Production Changes.

## Current User Direction

### Development priority

Do NOT proceed next into:
- Simulation / Management screen
- MatchDayFlow
- BashoRecord
- tournament scheduling
- Banzuke logic

Those are Deferred.

Current priority is Action presentation and game feel.

### Asset status

User has no wrestler sprite / animation assets prepared.

Therefore this Investigation must determine:
- how to create validation-quality provisional wrestler visuals
- which animation states are actually necessary
- what can remain simple
- how to integrate without committing to final art style/pipeline

### Finish-flow decisions recorded for future use

Deferred but Accepted:
- normal finish: Gyoji animation → Win / Lose hold → auto advance
- Rematch display text: `Rematch`
- no Result screen
- no per-bout reward

Do NOT implement these flow systems in VISUAL-01.

## Current Repository Facts Already Confirmed

At current develop:

- no `public/` or art-asset tree exists
- no wrestler image/spritesheet assets exist
- package.json has only:
  - Phaser
  - TypeScript
  - Vite
  - Vitest
- Aseprite is NOT installed/confirmed
- Tiled is NOT installed/confirmed
- no art-generation/build dependency exists
- logical canvas is currently 640×640
- BoutScene draws:
  - dohyo via Phaser Graphics
  - wrestler bodies via Phaser Circle/Arc
  - facing marker via small Circle
  - labels / debug state text
  - grapple line via Graphics
- simulation coordinates are converted to pixels only in BoutScene
- current approximate wrestler collision diameter renders around ~89 px at the existing ring scale
- no render interpolation exists
- gameplay remains Pure TS → Snapshot → Phaser presentation

Re-inspect Current Source; do not rely solely on this summary.

# Central Design Goal

Create a **validation-quality Action visual prototype**, not final art.

It must make the following readable without relying primarily on debug labels:

1. which wrestler is which
2. facing direction
3. locomotion / groundedness
4. Push startup / impact / recovery
5. Counter attempt
6. Kuzushi
7. Counter success positional advantage
8. Grip / ordinary grapple
9. Morozashi advantage
10. side/rear turning disadvantage
11. Grappled Drive / resistance
12. Ring-out finish
13. momentum / pressure / impact direction

The visual layer must NOT become gameplay Source of Truth.

# Architecture Constraint

Maintain:

```
BoutSimulation / Snapshot
        ↓
Presentation state mapping
        ↓
Phaser Sprite / Graphics / Animation / FX
```

Allowed presentation-only state:
- previous Snapshot for transition detection
- current animation clip
- one-shot FX timers
- small presentation easing/tween values

Not allowed:
- duplicating gameplay action/posture/engagement state as another canonical gameplay state
- moving canonical participant positions inside animation code
- changing Push/Counter/Grip formulas to make an animation easier
- using Phaser physics for gameplay
- important gameplay rules inside Scene animation callbacks

# Investigation Questions

## Q1 — Current rendering inventory

Inspect:
- `src/game/scenes/BoutScene.ts`
- `BoutTypes.ts`
- `BoutSimulation.ts`
- `grappleOrientation.ts`
- current debug labels / grapple line / result text
- package.json
- repository tree for assets

Document exactly what presentation information is currently available from Snapshot.

## Q2 — What can be animated from current Snapshot without new gameplay state?

Map current fields to visual meaning:

- position
- velocity
- externalVelocity
- facing
- action
- posture
- engagement
- outcome
- participant bodyRadius

Identify visual states that can be derived directly.

Identify any one-shot events that require comparing previous vs current Snapshot, for example:
- entering Kuzushi
- successful Counter
- engagement beginning
- Morozashi beginning
- release
- Push active contact/pressure
- outcome becoming final

Do not add a global event bus.

## Q3 — Provisional art production method

Compare at least these approaches:

A. Phaser Graphics only, but shaped like a top-down wrestler rather than circles  
B. Runtime-generated texture(s) from Phaser Graphics, then use Sprite + animation/tweens  
C. Hand-authored SVG/PNG frames checked into repo without Aseprite  
D. Small spritesheet asset created externally/generated for this Prototype

Evaluate:
- speed to implement
- readability
- animation flexibility
- replaceability by final art
- repository complexity
- whether it accidentally creates an art pipeline commitment
- Browser compatibility
- Phaser 4 integration

Recommend ONE approach for the first visual implementation.

Important:
User asked for "簡易Sprite / Animation", so pure debug circles with extra text are not sufficient.

## Q4 — Top-down wrestler silhouette

Recommend the minimum geometry/design that reads as a sumo wrestler from above.

Evaluate a silhouette containing some subset of:
- head
- torso
- shoulders
- arms
- hips/mawashi
- legs/feet
- shadow

Need a clear "front" so facing is readable without a dot marker.

The two wrestlers must remain visually distinct.

Do not decide final costume/art style.

## Q5 — Orientation strategy

Compare:

A. rotate one top-down sprite to `participant.facing`
B. use 4/8 directional sprite frames
C. hybrid

For the first visual prototype, prefer the smallest approach that preserves:
- exact Simulation facing
- GRAPPLED gradual turning
- side/rear readability

Explain replacement path for later final art.

## Q6 — Sprite/frame size

Given current 640×640 canvas and current wrestler scale, recommend:
- logical texture/frame dimensions
- on-screen scale
- transparent padding needs
- pivot/origin

Do not treat resolution as final.

Avoid oversized assets that complicate web loading.

## Q7 — Core animation state list

Determine the MINIMUM useful clips/poses for first implementation.

Candidates:

FREE:
- idle
- move
- push-startup
- push-active
- push-recovery
- counter
- kuzushi
- grip-reach

GRAPPLED:
- grapple-neutral
- grapple-morozashi-holder
- grapple-morozashi-disadvantaged
- turning
- drive
- resist-drive

FINISH:
- ring-out/frozen pose only for now

Do not mechanically require a unique frame sequence for every Simulation state.
Recommend which can share frames or use overlays/tweens.

## Q8 — Animation priority resolver

Current gameplay states can overlap conceptually:
- posture
- action
- engagement
- readiness/turning
- velocity

Recommend one explicit presentation priority.

Example concept only:
```
outcome final
> kuzushi
> active action
> grapple advantage/readiness
> locomotion
> idle
```

Define enough detail to prevent flickering between clips.

Prefer a small pure presentation helper if useful.

## Q9 — Push readability

Current Push has:
- startup
- active
- recovery
- locked direction

Recommend visual treatment so one press reads as a deliberate sumo shove rather than ordinary walking.

Investigate:
- body lean
- arms extend
- short anticipation
- impact squash/flash
- recovery settle

Do not alter Push timing yet.

## Q10 — Contact / impact cue

Current Push force only happens while Contact exists, but Snapshot does not expose an explicit Contact boolean.

Investigate whether impact/pressure can be derived from current state:
- geometry from participant positions/radii
- action phases
- externalVelocity change from previous Snapshot

Recommend the smallest robust presentation-only cue.

No gameplay contact duplication as a new Source of Truth.

## Q11 — Counter attempt and success

Need to distinguish:
- Counter window attempt
- failed Counter → self Kuzushi
- successful Counter → opponent Kuzushi + side/rear relocation

Recommend visual cues.

Important existing User feedback:
- Counter overshoot did not visually read with circles.
- future graphics should make the opponent's forward-flow/stumble understandable.
- do not hack Simulation purely for that visual problem.

Investigate animation/FX that can make current accepted Simulation motion readable.

## Q12 — Kuzushi

Recommend a readable presentation:
- tilted/offset pose
- wobble
- unstable foot placement
- brief visual marker/FX if needed

Kuzushi must look like vulnerability rather than generic stun.

Do not change KUZUSHI_TICKS in this task.

## Q13 — Grip / ordinary grapple

Current Engagement is pair-level.

Recommend how to visually communicate:
- FREE → GRAPPLED transition
- ordinary neutral grapple
- release

The current white line can remain as temporary debug fallback, but the wrestler visuals themselves should convey contact.

## Q14 — Morozashi

This must look materially different from neutral grapple.

Recommend a provisional visual language:
- inside-arm pose
- arm overlay
- body offset
- sash/highlight
- other minimal device

Avoid depending only on text or line thickness.

Do not invent new Morozashi gameplay multipliers.

## Q15 — Side/rear orientation advantage

Existing User feedback:
- side/rear advantage is mechanically present but currently hard to feel/read.
- overall game speed may later need a coherent tuning pass.

Need to make visually obvious:
- advantaged wrestler can act
- disadvantaged wrestler is rotating back to face
- rear opening lasts longer than side opening

Since facing already turns gradually in Simulation, evaluate whether rotating the sprite alone is sufficient or if a body/foot turning pose is needed.

Do not retune `GRAPPLE_TURN_RATE` in the visual task.

## Q16 — Grappled Drive

Recommend visuals for:
- one-sided drive
- equal contest/stalemate
- Morozashi holder slowly winning
- opponent resistance after READY

Possible cues:
- forward lean
- foot shuffle
- pair compression
- dust/pressure
- subtle squash/stretch

Canonical center positions must remain Snapshot-driven.

## Q17 — Momentum / externalVelocity

Determine whether presentation should use:
- total velocity
- externalVelocity
- difference between them

for:
- lean
- trailing shadow
- stumble direction
- pressure lines

Do not display raw debug vectors by default.

## Q18 — Ring-out finish

Current Outcome freezes exact final physical state.

Recommend minimal visual finish for this first Action visual pass:
- preserve final frozen positions
- small finish flash/camera cue/text if useful
- do NOT implement Gyoji flow yet unless it is a strict prerequisite

Gyoji is future Finish Presentation work.

## Q19 — Dohyo/background pass

Current dohyo is a filled circle.

Evaluate the smallest environment improvements that materially help Action readability:
- rope/edge readability
- clay color variation
- center/start marks
- shadow/background contrast

Do not expand into full arena/crowd art.

## Q20 — Debug UI strategy

The point of this pass is to test visual readability.

Recommend:
- default game-readable mode with most debug phase labels hidden
- optional debug toggle preserving labels/readouts for development

Do not delete valuable diagnostic information.

If adding a key toggle later, choose a provisional key and document it; do not conflict with current controls.

## Q21 — Camera / impact feel

Current camera is static.

Investigate whether first implementation should include:
- no camera changes
- tiny hit shake on successful Push/Counter
- subtle zoom/punch

Prefer minimal presentation.
Do not let camera movement hide Ring-out boundary or make controls confusing.

## Q22 — Sound

Audio is Deferred in current project state.

Confirm whether this visual pass should remain silent.
Do not add sound assets/dependencies unless explicitly justified.

## Q23 — Asset directory

AGENTS.md requires explicit approval for new directories.

Recommend exact asset path for later implementation, if file assets are chosen.

Candidates:
- `public/assets/bout/`
- `src/assets/bout/`
- another minimal path

Explain Vite/Phaser loading implications.

Investigation itself must not create the directory.

## Q24 — Phaser module structure

Current visual logic is concentrated in BoutScene.

Determine whether first implementation should:
A. keep it in BoutScene
B. extract a small `WrestlerView` / presentation helper
C. create a larger animation framework

Prefer Small explicit design.

If new directory/file is needed, name it and request explicit Task permission.

## Q25 — Pure presentation-state helper

Investigate whether a Phaser-free mapping such as:

```ts
resolveWrestlerVisualState(participant, opponent, engagement): WrestlerVisualState
```

would help tests and keep Scene small.

It may read existing pure helpers such as grapple readiness.

Do not create duplicate gameplay formulas.

## Q26 — Previous Snapshot / transition detector

For one-shot FX, recommend a minimal mechanism.

Example:
```
previousSnapshot
currentSnapshot
→ presentation events
```

Possible events:
- entered-kuzushi
- grapple-started
- morozashi-started
- outcome-finalized

Should this be:
- local Scene comparison
- small pure helper

No global event bus.

## Q27 — Animation timing ownership

Gameplay phases already have tick durations.

Decide when animation should:
- directly follow gameplay phase duration
- use a one-shot visual tween independent of the rule timer

Rule:
Presentation must not delay/change Simulation actions.

Avoid creating animation callbacks that decide when gameplay phases end.

## Q28 — Game speed re-evaluation

User previously felt:
- whole game may be too fast
- Grappled Orientation may be too fast
- Kuzushi may be too short

But these were Deferred until presentation improved.

Define a User Play Test plan that reassesses speed AFTER visual animation is applied.

Do not tune numbers in the visual implementation unless animation proves the mechanic unreadable and the task is explicitly changed.

## Q29 — Visual acceptance matrix

For each current mechanic, specify what the User should be able to understand with debug text hidden:

- movement
- facing
- push startup/active/recovery
- counter attempt
- successful counter
- kuzushi
- grip
- morozashi
- side/rear turning
- drive
- stalemate/resistance
- ring-out

Use this as the later implementation acceptance checklist.

## Q30 — Implementation split

Recommend the smallest safe next implementation sequence.

Likely options:

A. one implementation:
- provisional wrestler asset generation
- visual state mapping
- animation
- minimal FX
- debug toggle
- User Play Test

B. split:
1. wrestler visual/sprite foundation
2. action animation states / FX
3. User Play Test

Choose based on Current Source complexity.

Keep iteration fast.

# Candidate Provisional Visual Direction to Evaluate

This is a recommendation candidate, NOT an accepted design:

- top-down stylized wrestler made from a small texture/frame set
- rotate whole wrestler to Simulation facing
- separate PLAYER/CPU palette
- body shadow anchored to canonical position
- 4–6 key poses rather than dozens of frames
- animation via subtle scale/limb/pose frame changes
- presentation-only previous-Snapshot transition FX
- debug text hidden by default but toggleable
- no final pixel-art pipeline yet

Agent should compare alternatives and recommend the smallest credible approach.

# Required Reading

Inspect at minimum:

- `AGENTS.md`
- `package.json`
- repository tree for current assets
- `src/main.ts`
- `src/game/scenes/BoutScene.ts`
- `src/game/sumo/BoutTypes.ts`
- `src/game/sumo/BoutSimulation.ts`
- `src/game/sumo/grappleOrientation.ts`
- `docs/ARCHITECTURE.md`
- `docs/GAME_CONCEPT.md`
- relevant accepted Review Handoff in CURRENT_TASK
- previous User Play Test notes for Counter overshoot / side-rear readability / overall speed

# Scope Out

Do NOT implement:

- wrestler assets
- animation code
- production source changes
- final art style
- Aseprite/Tiled/tool installation
- Gyoji finish flow
- MatchDayFlow/BashoRecord
- Simulation/Management screen
- gameplay formula/timing tuning
- new actions
- ground-touch/fall
- Throw/Lift
- audio
- camera system
- mobile/touch
- Save
- final UI

Investigation Only.

# Stop Conditions

Return BLOCKED if:

- Current Source lacks enough state to visualize an accepted mechanic without adding gameplay state
- provisional sprite approach requires a new art tool/dependency that should be a User decision
- a proposed visual requires changing accepted gameplay semantics
- asset pipeline choice would materially lock final art direction
- Current Source materially conflicts with this Task/Handoff

Do not make Production changes.

# Verification

Investigation / Design Review.

Required:
- Q1–Q30 answered or explicit BLOCKED
- asset inventory directly checked
- Current Fact / Recommendation / User Decision / Deferred separated
- Production Source unchanged
- package/lockfile unchanged
- repository change only `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- `git diff --check` PASS

Tests/build not required because Production Source must not change.

# Completion Report

Minimum:

- Result
- Preflight
- Current asset/rendering inventory
- Snapshot → visual-state mapping
- recommended provisional art production method
- recommended wrestler silhouette / frame size
- facing/orientation strategy
- minimum animation/pose list
- visual priority resolver
- Push / Counter / Kuzushi visual design
- Grip / Morozashi / Orientation / Drive visual design
- momentum/impact FX
- Ring-out visual treatment
- dohyo/environment pass
- debug UI strategy
- asset path recommendation
- module/file structure recommendation
- previous-Snapshot transition strategy
- animation timing ownership
- User Play Test matrix
- User Decisions Required
- Deferred
- implementation split
- Design Deviations
- Unexpected Scope
- Verification
- Git delivery

# User Play Test

NOT REQUIRED for Investigation.

The first provisional visual implementation MUST require User Play Test.

The test should be performed with debug labels hidden first, then debug mode can be used to diagnose mismatches.

# Git Delivery

Investigation-only Report Commit Exception:
- change only CURRENT_COMPLETION_REPORT.md
- explicit stage
- git diff --check
- one Report-only commit
- push origin/develop
- verify remote SHA / clean tree

Example:
`docs(agent): investigate action visual prototype`

# Final Instruction

Stop after Investigation.

Do not implement assets/animation or tune gameplay.

After Report Commit / Push:
「VISUAL-01-ACTION-VISUAL-PROTOTYPE-INVESTIGATION が完了し、ChatGPT Review待ちです」
