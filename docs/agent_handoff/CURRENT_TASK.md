Task-ID: VISUAL-01A-WRESTLER-VISUAL-FOUNDATION
Status: REVIEWED
Task-Type: IMPLEMENTATION / ACTION VISUAL FOUNDATION
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: 43efaef5aa2bab5eeb6fa2fc8eceec1bf1fd3105
Handoff-Mode: GITHUB

# VISUAL-01A — Wrestler Visual Foundation

## Purpose

Replace the current debug-circle wrestler rendering with a validation-quality provisional top-down wrestler presentation so the User can judge whether the current Sumo Action actually reads and feels like a game.

This is NOT final art.

The immediate goal is:
- make the wrestlers look like articulated top-down sumo figures
- make facing readable without the facing-dot
- make core states readable without relying on debug labels
- preserve the Pure TS gameplay → Snapshot → Phaser presentation architecture
- prepare for a focused User Play Test that may later lead to either Presentation changes OR Gameplay changes

## Important User Direction — Gameplay Is Not Permanently Frozen

Previous wording that implied "Gameplay must not be reopened" is superseded.

Current rule:

- Do not silently change Gameplay formulas/rules inside this Visual implementation.
- First implement the provisional visual layer and run the focused User Play Test.
- If the visualized game still feels wrong, unreadable, too fast, too weak, too strong, or otherwise unnatural, Gameplay changes may be considered in a follow-up task.
- Accepted Gameplay is the current baseline, not an immutable final design.

Therefore:
- VISUAL-01A scope itself is presentation-only.
- But User Play Test may explicitly reopen:
  - movement feel
  - Push timing/force/distance
  - Counter window/position feel
  - Kuzushi duration
  - grapple orientation speed
  - Drive pressure
  - other accepted Action tuning
  if the visual pass reveals a real Gameplay problem.

If implementation discovers that a Gameplay change is a hard prerequisite to make the visual system function correctly, STOP and report it. Do not silently expand scope.

## Accepted Visual Direction

Use runtime-generated articulated wrestler parts in Phaser.

No external image files are required for this first Prototype.

Conceptual parts:
- shadow
- left/right feet
- broad torso
- mawashi / rear knot cue
- left/right arms
- head
- mage / rear-head cue

Use separate parts so pose changes can be expressed through transform/rotation/offset without requiring a full spritesheet.

Player and CPU may keep the current blue/red palette for Prototype readability.

This is a validation visual, not a final art style decision.

## Architecture

Maintain:

```
BoutSimulation / Snapshot
        ↓
Pure presentation mapping
        ↓
Phaser WrestlerView / DohyoView
```

Canonical gameplay remains in Pure TS.

Presentation may own only:
- current visual pose
- walk-cycle phase
- local tween/lerp state
- presentation-only smoothing
- debug visibility

Presentation must not:
- own gameplay position/facing/action/posture/engagement/outcome
- decide when Push/Counter/Grip phases end
- alter canonical participant positions
- use Phaser Physics for gameplay

## Explicit Directory Permission

AGENTS.md §5 requires Task authorization for new directories.

This Task explicitly permits:

`src/game/presentation/`

Use it only for small Phaser-free presentation mapping helpers.

Recommended files:
- `src/game/presentation/wrestlerVisualState.ts`
- focused tests for that helper

Phaser-specific view code may be added under:
- `src/game/scenes/WrestlerView.ts`

Optional:
- `src/game/scenes/DohyoView.ts`
if it materially keeps BoutScene smaller.

Do not create broader framework directories.

## Scope

Implement:

1. Pure visual-state resolver
2. Runtime-generated wrestler part textures / shapes
3. Articulated WrestlerView
4. Exact-facing rotation
5. Basic pose mapping for current accepted mechanics
6. Basic movement/foot cycle
7. Grapple / Morozashi / Turning visual modifiers
8. Drive visual pose
9. Minimal dohyo readability pass
10. Debug display toggle using `0`
11. Replace current circle body rendering with WrestlerView
12. Keep existing debug visuals available when debug mode is ON
13. Focused unit tests for Pure presentation mapping
14. Build/test verification
15. User Play Test preparation

## Scope Out

Do NOT implement in VISUAL-01A:

- Action Feel FX layer from VISUAL-01B
- camera shake
- dust particles
- impact ring/flash polish
- Counter afterimage polish
- Gyoji finish presentation
- MatchDayFlow / BashoRecord
- Simulation / Management UI
- audio
- external art files
- spritesheet pipeline
- Aseprite/Tiled installation
- 8-direction final sprite frames
- final pixel-art style
- gameplay tuning/formula changes
- Throw/Lift
- ground-touch/fall
- Tachiai

## Current Source Baseline

Production Source baseline:
`43efaef5aa2bab5eeb6fa2fc8eceec1bf1fd3105`

Current develop may contain later Handoff/Review documentation commits only.

Preserve:
- fixed-step Simulation
- all existing gameplay state semantics
- Ring-out / BoutOutcome behavior
- current controls
- current Dummy modes

## Required Reading

Inspect at minimum:

- `AGENTS.md`
- `package.json`
- `src/main.ts`
- `src/game/scenes/BoutScene.ts`
- `src/game/sumo/BoutTypes.ts`
- `src/game/sumo/BoutSimulation.ts`
- `src/game/sumo/grappleOrientation.ts`
- `docs/ARCHITECTURE.md`
- `docs/GAME_CONCEPT.md`
- CURRENT_TASK Investigation review notes

## Runtime Texture / Shape Strategy

Preferred:
- use supported Phaser 4.2.1 runtime texture or generated graphics mechanisms
- verify actual API in the installed version before implementing

Acceptable:
- Graphics-generated textures
- DynamicTexture / RenderTexture if that is the cleaner supported Phaser 4 path

Do NOT:
- add image-generation dependency
- add canvas library
- add external runtime asset generator

If Phaser runtime texture APIs differ from expectation, use the smallest supported mechanism and report it as a non-semantic implementation detail.

## Pure Visual State

Create a Phaser-free resolver that derives presentation state from canonical Snapshot state.

Example shape — exact naming may differ:

```ts
type WrestlerVisualPose =
  | 'idle'
  | 'move'
  | 'push'
  | 'counter'
  | 'kuzushi'
  | 'grip'
  | 'grapple'
  | 'drive'

type GrappleVisualRole =
  | 'none'
  | 'neutral'
  | 'morozashi-holder'
  | 'morozashi-disadvantaged'

interface WrestlerVisualState {
  pose: WrestlerVisualPose
  pushPhase?: PushPhase
  gripPhase?: GripPhase
  grappleRole: GrappleVisualRole
  turning: boolean
  frozen: boolean
  locomotionSpeed: number
}
```

This is only an example.

The helper may use:
- participant action/posture
- engagement
- outcome
- participant/opponent relationship
- existing `canActInGrapple`

Do not duplicate gameplay formulas.

## Visual Priority

Use one deterministic priority so the body does not flicker between poses.

Required semantics:

1. final outcome freezes visual progression, but does not force a generic finish pose
2. kuzushi
3. FREE explicit actions: push / counter / grip
4. GRAPPLED drive
5. GRAPPLED turning / ready role
6. locomotion
7. idle

Outcome is a freeze modifier.

Walk/idle smoothing may use simple presentation-only hysteresis if required.

## Wrestler Shape

Top-down articulated silhouette should clearly show front/back.

Required cues:
- head toward the front
- mage / rear-head cue toward the back
- mawashi/rear knot cue
- shoulders/arms
- two feet

Old facing-marker dot must not be required in default game view.

Debug mode may still show it.

## Facing

Rotate the full WrestlerView according to exact `participant.facing`.

Do not quantize to 4/8 directions.

This must make GRAPPLED turning visually continuous.

## Pose Requirements

### Idle
- readable stance
- subtle breathing/sway acceptable
- no excessive motion

### Movement
- feet visibly step/shuffle
- motion should look grounded
- avoid obvious foot skating where possible
- canonical position still comes directly from Snapshot

### Push
One parametric pose family driven by gameplay phase:
- startup: anticipation / arms pulled in / feet planted
- active: forward lean + arms extended
- recovery: return to stance

Do not change Push phase durations.

### Counter
- visually distinct from Push startup
- lower/open waiting stance

Do not attempt Counter-success one-shot FX yet; that belongs in VISUAL-01B.

### Kuzushi
- off-balance body
- disrupted feet
- open arms
- small instability motion

Must read as loss of balance, not stun/dizziness.

No stars/dizzy symbol.

### Grip
- arms reaching forward
- grip recovery returns arms

### Grapple
Ordinary neutral grapple must visibly look like an established clinch.

Use arm placement/body relation rather than relying on the current white line.

### Morozashi
Must materially differ from neutral grapple.

Holder:
- both arms visually inside/deep
- stronger established position

Disadvantaged:
- arms visibly outside/up

Do not use text as the primary cue.

### Turning
While not READY:
- wrestler visibly rotates using exact Simulation facing
- grapple arms are not fully established
- feet show a turning/shuffle motion

READY:
- established grapple arms return

Rear should naturally take longer than side because the Simulation rotation distance is larger.

Do not change GRAPPLE_TURN_RATE.

### Drive
- forward lean
- shuffling feet
- bracing opponent

In equal Drive stalemate:
- both wrestlers should visibly show effort even if position barely changes

Do not add dust/compression polish beyond minimal pose adjustment; stronger FX belong in VISUAL-01B.

## Dohyo Readability Pass

Improve the existing Graphics-based dohyo enough to support Action readability.

Allowed:
- clearer clay shading
- stronger tawara/ring edge
- light outside-sand band
- shikiri lines
- darker background contrast

Do not create arena/crowd/background art.

Ring boundary must remain easy to see.

## Debug UI

Add a provisional `0` key toggle.

Default:
- game-readable presentation
- hide most phase/debug labels and debug grapple line/facing marker
- keep necessary prototype controls/hints minimal
- result text remains visible

Debug ON:
preserve/show useful diagnostics such as:
- existing phase text
- engagement
- pair velocity
- facing marker
- grapple line
- other already useful debug information

Do not delete diagnostic functionality.

## BoutScene Integration

Replace the old circle participant body view with WrestlerView.

BoutScene should remain responsible for:
- reading input
- fixed-step stepping
- snapshot retrieval
- one-way sync into views

Do not move Gameplay formulas into WrestlerView.

Avoid turning BoutScene into a large animation framework.

## Tests

At minimum add focused tests for Pure presentation mapping.

Cover:
- idle
- locomotion
- push startup / active / recovery
- counter
- kuzushi priority
- grip/recovery
- grapple neutral
- Morozashi holder
- Morozashi disadvantaged
- turning/not-ready
- drive
- outcome frozen modifier
- participant-order/mirrored roles where relevant
- deterministic output
- Phaser-free module

Existing gameplay tests must continue to pass.

Do not add brittle pixel-coordinate tests for Phaser visuals unless a small pure calculation genuinely benefits from them.

## Verification Level

Standard + focused visual runtime verification.

Required:
- `pnpm test`
- `pnpm build`
- `git diff --check`
- no new dependency
- Pure presentation helper has no Phaser import
- no Gameplay Source changes unless STOP condition triggered
- Browser Smoke if environment permits

Browser Smoke should verify:
- no runtime errors
- wrestler bodies render
- exact facing rotates
- actions visually switch
- debug toggle works
- ring boundary remains visible

## User Play Test — REQUIRED

Run `pnpm dev`.

First test with debug OFF.

Evaluate:

1. Do the two wrestlers now read as top-down sumo wrestlers rather than debug objects?
2. Can facing be understood without the facing dot?
3. Does movement look grounded enough to judge?
4. Does Push read as startup → strike → recovery?
5. Is Counter stance distinct from Push?
6. Does Kuzushi look like unstable footing?
7. Can Grip be understood without the white line?
8. Is Morozashi clearly different from neutral grapple?
9. Can you see which wrestler is disadvantaged while turning?
10. Does rear exposure feel longer/more dangerous than side exposure?
11. Does Drive look like sustained pressure rather than ordinary movement?
12. Does neutral Drive stalemate show visible effort?
13. Is Ring-out boundary visually readable?
14. Does the game now begin to feel like an Action Game?

Then debug ON may be used to diagnose discrepancies.

### Gameplay Re-evaluation Gate

After the visual test, explicitly classify each negative feeling as one of:

- Presentation issue
- Gameplay issue
- both / unclear

Gameplay changes are allowed as a future follow-up.

Examples:
- Orientation still feels too fast after the turning animation is readable
- Kuzushi still ends too quickly to exploit
- Push still travels too little
- Counter advantage still feels too weak
- movement still feels too fast/slow

Do NOT dismiss these solely because the underlying rule was previously Accepted.

Technical PASS != Gameplay Accepted.

## Stop Conditions

STOP and report instead of broadening scope if:

- runtime-generated articulated visuals cannot be implemented cleanly with installed Phaser
- a new asset/dependency/tool becomes necessary
- current Snapshot truly lacks required state for a basic accepted mechanic
- a Gameplay rule change is required as a hard prerequisite
- significant unrelated refactor is required
- Current Source materially conflicts with this Task

## Implementation Evidence

Completion Report should include concise evidence for:

- Pure visual resolver
- WrestlerView
- exact facing
- Push/Counter/Kuzushi/Grip/Grapple/Morozashi/Turning/Drive mapping
- Dohyo pass
- debug toggle
- architecture preservation
- tests/build/browser

## Design Deviations

Required.

If none:
`Design Deviations: NONE`

If runtime texture mechanism differs from the plan:
report:
- Planned
- Implemented
- Reason
- Semantics changed? NO

Any Gameplay semantic change is NOT an acceptable deviation in this task; STOP first.

## Git Delivery

Follow AGENTS.md.

One successful Task ≈ one commit.

Task-owned files only.
Push origin/develop.
Do not change main.

Suggested commit:
`feat: add provisional wrestler visuals`

## Final Instruction

Stop after VISUAL-01A.

Do not continue into VISUAL-01B FX or Gameplay tuning.

After commit/push/report:
「VISUAL-01A-WRESTLER-VISUAL-FOUNDATION が完了し、ChatGPT ReviewとUser Play Test待ちです」


# Final ChatGPT Review

Overall Result: TECHNICAL PASS / USER PLAY TEST REQUIRED

## Reviewed Delivery

- Implementation commit:
  `1c5b033addbb1adfb7fd19fc3c51b28a8bd96ca6`
- Agent-Start-Head:
  `dff973d27a890240868fbaba26c39c1cee5715a1`
- Task diff is exactly one implementation commit.
- `main` remains unchanged.
- No new dependency.
- No image/spritesheet asset was added.

## Scope / Architecture Review

PASS.

Direct source review confirms:

- Gameplay source files were not changed:
  - BoutSimulation
  - BoutTypes
  - grappleOrientation
  - ringOut
  - input
  - Dummy
- new Pure presentation mapping lives under the explicitly approved:
  `src/game/presentation/`
- Pure presentation mapping has no Phaser import.
- Phaser-specific articulated view remains in Scene-side code.
- canonical position/facing/action/posture/engagement/outcome stay Simulation-owned.
- no Phaser Physics or animation callback controls gameplay.

The direction remains:

```
Simulation Snapshot
→ Pure WrestlerVisualState
→ Phaser WrestlerView
```

## Pure Visual Resolver Review

PASS.

`resolveWrestlerVisualState` derives:

- pose
- Push / Grip phase progress
- grapple role
- turning readiness
- frozen modifier
- own locomotion speed
- Kuzushi strength

from canonical state.

Important:
- locomotion uses `velocity - externalVelocity`, so being externally pushed is not misclassified as walking.
- grapple turning uses existing `canActInGrapple`.
- Morozashi holder/disadvantaged roles come from canonical Engagement.
- outcome is a freeze modifier, not a duplicate finish-state machine.
- move/idle hysteresis is presentation-only memory.

No duplicate gameplay Source of Truth was introduced.

## WrestlerView Review

PASS for a validation Prototype.

The view is articulated from runtime-generated parts:

- shadow
- feet
- torso
- mawashi/rear knot cue
- arms
- head/mage cue

The root is positioned from the canonical Snapshot position and rotated using exact Simulation facing.

This preserves the accepted gradual grapple orientation rather than quantizing it to directional frames.

### Runtime texture note

The implementation uses Phaser `Graphics.generateTexture`.

The TypeScript build verifies the API surface, but actual browser rendering was NOT RUN by the Agent.

This remains a mandatory User/runtime check.

## Pose Coverage

PASS structurally.

Current implementation has visual treatment for:

- idle
- move
- Push startup / active / recovery
- Counter
- Kuzushi
- Grip reach / recovery
- neutral grapple
- Morozashi holder
- Morozashi disadvantaged
- turning/not-ready
- Drive

No VISUAL-01B one-shot impact FX were pulled into scope.

## Gameplay Re-evaluation Policy

Important User direction remains:

The current Gameplay baseline is NOT immutable.

VISUAL-01A itself correctly does not alter gameplay.

After User Play Test, any negative result must be classified as:

- Presentation issue
- Gameplay issue
- both / unclear

If the visualized game still feels wrong, a follow-up task may reopen:
- Movement
- Push
- Counter
- Kuzushi
- grapple orientation
- Drive
- other Action tuning/rules.

Do not reject Gameplay feedback merely because those rules were previously accepted in circle-debug form.

## Dohyo / Debug Review

PASS.

Dohyo now has:
- stronger clay contrast
- visible tawara/ring edge
- outside sand band
- shikiri lines
- darker surrounding background

The ring-out criterion itself remains Simulation-owned and unchanged.

Debug:
- default OFF
- `0` toggles diagnostic overlays
- existing labels / phase / engagement / grapple line / facing marker remain available for diagnosis.

This is appropriate because User Play Test should first judge readability without debug labels.

## Verification Review

Reported:
- `pnpm test`: 209/209 PASS
- `pnpm build`: PASS
- `git diff --check`: PASS

New Pure resolver tests cover:
- idle / move / hysteresis
- external momentum not walking
- Push phases
- Counter / Grip
- Kuzushi priority
- neutral / Morozashi roles
- rear turning → READY → Drive
- outcome frozen modifier
- deterministic / Phaser-free mapping.

Existing 200 gameplay tests remain unchanged and PASS.

## Non-Blocking Technical Notes

### N1 — Runtime visuals remain unverified

Because Browser Smoke was not available, the following are still unknown until User Play Test:

- whether all generated textures render correctly in Phaser runtime
- whether part origins/scales visually align
- whether layered limbs look coherent during overlap/grapple
- whether exact-facing rotation reads naturally
- whether the improved tawara remains visually consistent with the center-based Ring-out criterion

These are expected Visual Task unknowns, not reasons to add speculative fixes before viewing the result.

### N2 — Outcome freezes presentation interpolation immediately

When Outcome becomes final, `WrestlerView` stops its presentation-time interpolation.

This is consistent with the requested "freeze final visual state" direction, but it means the body can freeze part-way between presentation pose targets.

Do not change this preemptively.

If it looks awkward at Ring-out, classify it as Presentation feedback and adjust in a focused visual task.

### N3 — Current wrestler draw ordering is Prototype-level

Both wrestler bodies share the same body depth, so overlapping limb/body ordering is not a full character-to-character occlusion system.

This is acceptable for the validation pass.

If grappling becomes visually confusing because one whole wrestler consistently layers over the other, fix presentation ordering after seeing the actual runtime result; do not add a complex z/limb interleaving system now.

## Browser Smoke

NOT RUN due Agent environment limitation.

For this task Browser/User visual verification is mandatory before acceptance.

## User Play Test — REQUIRED / READY

Run:

`pnpm dev`

### First pass: debug OFF

Do NOT press `0` initially.

Check:

1. **Basic silhouette**
   - Do they look like two top-down wrestlers rather than circles?
   - Can Player/CPU be distinguished?
   - Is front/back readable from head/mage/mawashi/arms?

2. **Facing**
   - Move around the opponent.
   - Can you understand which way each wrestler faces without the old white facing dot?
   - During side/rear grapple, can you actually see the disadvantaged wrestler rotate?

3. **Movement**
   - Does foot movement look grounded?
   - Does it look like walking/shuffling rather than the character image sliding over the dohyo?

4. **Push**
   - One ArrowUp press should visually read:
     anticipation → arm extension/drive → recovery.
   - Is it obviously different from ordinary movement?

5. **Counter**
   - ArrowDown stance must look different from Push startup.
   - Current 01A does NOT yet add successful-Counter afterimage/stumble polish.
   - Judge whether the base stance/position change is understandable enough to proceed to 01B.

6. **Kuzushi**
   - Does it look like disrupted balance/footing?
   - Does it look vulnerable rather than stunned/dizzy?

7. **Grip / Grapple**
   - Can ordinary grapple be understood without the debug white line?
   - Do arms/body visibly establish a clinch?

8. **Morozashi**
   - Is it visually obvious which wrestler has the inside-arm advantage?
   - Can you distinguish it from neutral grapple without text?

9. **Side / Rear advantage**
   - Is the disadvantaged wrestler visibly not yet established while turning?
   - Does rear exposure clearly last/read longer than side exposure?

10. **Drive**
    - Does Drive look like sustained pressure?
    - When both drive equally, does the stalemate still show visible effort?

11. **Ring-out**
    - Is the tawara/edge easy to understand?
    - Does the frozen final state look acceptable?

12. **Overall**
    - Does this finally begin to read as an Action Game?
    - Or does it still look mainly like a technical prototype?

### Second pass: debug ON

Press `0`.

Use labels/facing/grapple diagnostics to identify any mismatch between:
- what the Simulation says
- what the visual appears to show.

## Feedback Classification

For each problem, please classify if possible:

- Presentation
- Gameplay
- Both / unsure

Especially re-evaluate the previously deferred issues:

- overall speed
- Push distance/strength
- Counter readability/advantage
- Kuzushi duration
- grapple orientation speed
- side/rear advantage
- Drive pressure.

It is explicitly acceptable for this Play Test to conclude that the Gameplay itself should change.

## Acceptance State

Technical implementation: PASS.

Runtime rendering: NOT YET VERIFIED.
Visual readability: PENDING USER PLAY TEST.
Game Feel: PENDING USER PLAY TEST.

Do not start VISUAL-01B automatically.

First review the User's actual visual/gameplay feedback from VISUAL-01A.

## Next Task Decision

After Play Test:

### If base wrestler presentation is readable
Proceed to VISUAL-01B for:
- Push impact
- Counter forward-flow/stumble/afterimage
- dust
- Morozashi highlight
- Ring-out FX
- optional small camera impact.

### If base presentation is not readable
Fix VISUAL-01A presentation first.

### If Gameplay itself now feels wrong
Create a focused Gameplay investigation/correction before or alongside later visual polish, depending on severity.

Do not force the old Gameplay baseline merely to stay on the visual roadmap.
