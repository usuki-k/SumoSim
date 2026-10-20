Task-ID: ACTION-ART-01B-PRODUCT-BACKGROUND-INTEGRATION
Status: READY
Task-Type: IMPLEMENTATION / PRODUCT ART RUNTIME INTEGRATION / PHASER
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 294530e8adfd3f5402b043583032d766dc0d150c
Handoff-Mode: GITHUB

# ACTION-ART-01B — Product Background / Tokudawara Runtime Integration

## Purpose

Integrate the User-approved Product arena background and Tokudawara overlay into the Phaser Bout runtime.

This Task replaces the default provisional Graphics dohyo presentation with the accepted Product artwork while preserving the accepted Tokudawara Ring-out gameplay exactly.

After this Task, the Action screen should use the actual Product background baseline and be ready for the next Product-art phase: HUD.

## Accepted Baseline — DO NOT REOPEN

### Tokudawara Gameplay

Implementation commit:
`294530e8adfd3f5402b043583032d766dc0d150c`

Technical Review:
PASS.

User Play Test:
**ACCEPTED / no issues reported.**

Accepted gameplay:
- center-based Ring-out
- exact boundary IN
- first OUT loses
- earliest IN→OUT along canonical P0→P1 interpolation
- four cardinal Tokudawara
- depth = **0.1194375 m**
- halfAngle = **π/20**
- no wall / clamp / bounce
- no foot/ground-touch rule
- no Level 3 edge physics.

Do not change Ring-out gameplay in this Task.

### Product Tokudawara Art

User visually compared Candidates A/B/C and selected:

**Candidate C**

Accepted Product-art geometry:

Master:
- 3840×2160
- center (1920,1080)
- base radius 800 px
- tawara width 42 px
- Tokudawara depth 42 px
- halfAngle 9°

Runtime art:
- 1920×1080
- center (960,540)
- base radius 400 px
- tawara width 21 px
- Tokudawara depth 21 px
- halfAngle 9°.

### Accepted Product arena alignment

Candidate C supersedes the earlier arena alignment.

Accepted:
- `--arena-scale 1.0952`
- `--arena-offset-x 5.48`
- `--arena-offset-y 95.28`

Do not use the older 1.072 / 5.36 / 77.72 Product alignment.

## Product Inputs

Required local inputs:

```
tools/dohyo_art/input.local/arena_base.png
tools/dohyo_art/input.local/tawara_source.png
```

They are local authoring sources and remain ignored/uncommitted.

If missing, STOP/BLOCKED.

## Product Generation Source of Truth

Use the accepted deterministic Python compositor:

`tools/dohyo_art/compose_dohyo.py`

Before copying runtime assets, regenerate Candidate C from the real inputs using the accepted parameters.

Do not manually edit the exported Product runtime images.

## Authoring vs Runtime Layers

Maintain the accepted separation:

```
arena_base
+
exact dohyo/tokudawara overlay
=
runtime Product presentation
```

Runtime should use separate base and overlay layers rather than baking new gameplay geometry into Phaser Graphics.

The exact overlay remains replaceable without regenerating the painted arena.

## Explicit Directory Permission

This Task explicitly authorizes creation of:

`public/assets/action/background/`

Runtime Product assets will live there.

Do not create unrelated asset directories.

## Runtime Asset Export

The current compositor already creates:
- `arena_base_master.png` at 3840×2160
- `dohyo_ring_overlay_1920.png` at 1920×1080.

For clean runtime layering, add the smallest deterministic compositor output needed:

`arena_base_1920.png`

Requirements:
- exact 1920×1080
- derived from the aligned `arena_base_master`
- deterministic exact 2× downscale
- use the same high-quality / area-appropriate downscale strategy as other 2× review/runtime outputs
- no additional repainting.

Do NOT create a generic export framework.

Update:
- compositor
- manifest
- tests
- README

only as needed for this one runtime output.

### Runtime committed files

Generate Candidate C locally, then copy/commit:

```
public/assets/action/background/arena_base_1920.png
public/assets/action/background/dohyo_ring_overlay_1920.png
```

Do NOT commit:
- master 3840 images to `public/`
- local input sources
- `output*.local`
- geometry guides/manifests as runtime assets.

The committed runtime images must be the exact Candidate C outputs.

Record their SHA-256 and dimensions in the Completion Report.

## Phaser Logical Resolution

For this Product integration, set the initial Product logical resolution to:

**1920×1080**

Reason:
- 1:1 correspondence with the accepted runtime-art coordinate space
- exact Product geometry mapping without extra resampling inside Phaser
- current Product character-scale target was defined in this coordinate space
- CSS/Phaser Scale.FIT still controls browser display size.

This is the current Product presentation baseline, not an irreversible performance decision.

If browser/runtime performance is materially unacceptable, report it rather than silently choosing a lower logical resolution.

## Scale / Coordinate Mapping

Do not use the old square-screen `RING_FILL_RATIO = 0.9` mapping as the Product mapping.

Accepted Product art contract:

- logical canvas: 1920×1080
- Product art center: (960,540)
- base gameplay radius: 400 px
- Simulation radius: 2.275 m.

Therefore Product presentation mapping is:

```
pixelsPerMeter = 400 / 2.275
```

when logical canvas is exactly 1920×1080.

Prefer a small explicit mapping derived from Product art constants rather than a magic ratio.

It is acceptable to support uniform scaling from the 1920×1080 art reference if the Scene abstraction makes that trivial, but do not build a responsive-layout framework in this Task.

The exact Simulation origin must map to the exact art center.

## Phaser Asset Loading

Use Phaser's normal asset loader.

Recommended asset keys:
- Product arena base
- Product dohyo overlay.

Exact key names may follow current naming style.

Load from stable Vite public URLs, for example:

```
/assets/action/background/arena_base_1920.png
/assets/action/background/dohyo_ring_overlay_1920.png
```

Verify the exact Phaser 4.2.1 API in Current Source / installed package.

No new dependency.

## Runtime Layering

Expected visual depth:

1. Product `arena_base_1920.png`
2. Product `dohyo_ring_overlay_1920.png`
3. wrestler shadows
4. wrestler bodies
5. debug overlays
6. text / future HUD.

Existing WrestlerView depths currently use:
- shadow depth 1
- body depth 2.

Choose base/overlay depths below them, for example:
- base = 0
- overlay = 0.5

without changing gameplay.

Do not bake wrestler shadows or HUD into the background.

## DohyoView Responsibility After Integration

The Product images become the default visible dohyo.

Do NOT keep the old Graphics clay/tawara presentation visible underneath or on top by default.

Retain only what is useful for diagnostics.

Recommended:
- preserve `arenaBoundaryOutline`
- preserve exact debug boundary rendering
- allow debug mode to display the Simulation boundary over the Product overlay
- old provisional full `drawDohyo` may remain only if a clean debug/fallback role is genuinely useful.

Do not create two visible sources of truth for the ring.

The Product PNG overlay is presentation.
Simulation Snapshot remains gameplay geometry SoT.

## Debug Geometry Verification

This Task must make it easy to verify Product art vs Simulation.

With debug mode ON:
- draw the exact Simulation center-boundary over the Product overlay
- it must align with:
  - normal circular sections
  - all four Tokudawara outer sections
  - all eight side transitions.

The debug line may be intentionally high-contrast.

This verification is mandatory before User acceptance.

## BoutScene / Existing Prototype UI

The logical resolution changes from 640×640 to 1920×1080.

Do not redesign HUD in this Task.

However, existing prototype/debug text must remain usable.

Allowed:
- reposition existing control/debug/result text
- scale existing font sizes enough to remain readable
- keep debug text default hidden where already hidden.

Do NOT:
- create Product HUD panels
- add portraits
- add final meters/gauges
- invent new UI information.

HUD Product design is the next art phase.

## Wrestler Presentation

Do not redesign wrestler visuals in this Task.

The existing provisional articulated WrestlerView should continue to:
- use Simulation positions
- use exact facing
- scale from bodyRadius through pixelsPerMeter.

At Product mapping:
- body diameter should naturally become approximately 123 px for current 0.7 m diameter.

This is expected and is part of the Product visual-scale baseline.

Do not retune bodyRadius to match the art.

## Scope

Implement:

1. accepted Candidate C regeneration
2. `arena_base_1920.png` deterministic tool output
3. runtime Product asset commit
4. Phaser preload
5. 1920×1080 logical presentation baseline
6. Product base + exact Tokudawara overlay display
7. exact art↔Simulation coordinate mapping
8. removal/hiding of old default Graphics dohyo
9. debug boundary verification over Product art
10. minimal existing prototype text adaptation
11. focused tests where useful
12. build / runtime verification
13. User visual/gameplay Play Test preparation.

## Scope Out

Do NOT:
- change Ring-out gameplay
- change Tokudawara depth/angle
- change Candidate C arena alignment
- change Push/Counter/Grip/Drive
- create HUD Product art
- create wrestler Product part images
- create Gyoji
- add arena animations
- add audio
- add camera effects
- optimize/compress Product assets into a broader pipeline
- add CrazyGames SDK
- build responsive/mobile layout system.

## Art Tool Tests

Update Python tests for the new runtime arena output.

At minimum:
- `arena_base_1920.png` exists in BuildResult
- size = 1920×1080
- deterministic pixel output
- exact 2× derivation from master
- manifest records it
- existing Tokudawara / circle compatibility tests remain PASS.

## Runtime / TypeScript Verification

Required:

- `pnpm test`
- `pnpm build`
- TypeScript noEmit if repository workflow uses it
- `git diff --check`
- Python `tools/dohyo_art` unit suite
- runtime asset dimensions verified
- committed asset hashes match regenerated Candidate C local output
- no local Product inputs/outputs staged
- no new dependency.

## Browser Smoke — REQUIRED IF AVAILABLE

Verify:

- canvas is 16:9
- Product arena fills the canvas
- no stretch
- no black/blank edge inside the Phaser canvas
- exact overlay aligns with the arena
- wrestlers appear at expected size/positions
- controls still work
- debug toggle works
- debug boundary lies on the Product Tokudawara boundary
- Ring-out outcome still matches visible boundary
- R restart and Dummy modes still work
- no console/runtime asset-load errors.

If Agent environment cannot perform browser graphical smoke:
- report NOT RUN
- do not mark visual acceptance complete
- User visual check remains mandatory.

## User Play / Visual Test — REQUIRED

Run:

`pnpm dev`

First inspect with debug OFF.

Verify:

1. Product arena appears at 16:9 without distortion
2. Tokudawara Candidate C looks the same as the accepted composite preview
3. all four Tokudawara fit inside the painted platform
4. provisional wrestlers sit at the expected scale relative to the Product dohyo
5. no old Graphics ring is visibly doubled underneath
6. normal gameplay controls still work.

Then press `0`.

Verify:
7. exact debug boundary aligns with Product ring
8. +X / -X / +Y / -Y Tokudawara all align
9. diagonal normal-circle boundary aligns
10. Ring-out result occurs on the same visible boundary.

Also report:
- whether 1920×1080 logical rendering feels performant in the browser
- whether background detail is too soft/sharp
- whether current provisional wrestlers now look obviously below the Product background quality bar.

The last item will guide the later Wrestler Product-art task; do not fix it here.

## Acceptance Criteria

Technical:
- Candidate C runtime assets are reproducible
- exact asset dimensions/hashes recorded
- Product background is default runtime rendering
- simulation↔art center/radius mapping exact
- no gameplay changes
- debug boundary verifies geometry
- tests/build pass.

Product:
- User confirms Product background looks correct in runtime
- no visible geometry mismatch
- no unacceptable 1920×1080 performance problem.

Technical PASS != Product visual acceptance.

## Stop Conditions

STOP/BLOCKED if:

- Candidate C local Product inputs are missing
- regenerated Candidate C differs unexpectedly from the previously accepted preview
- runtime asset generation cannot be deterministic
- exact overlay does not align with Simulation geometry under the chosen logical resolution
- 1920×1080 logical resolution causes a material runtime problem that prevents meaningful testing
- Phaser 4 loading/rendering requires an unexpected dependency
- integrating Product images requires changing gameplay geometry.

Do not compensate by changing Ring-out values.

## Implementation Evidence

Completion Report must include:

- accepted Candidate C command used
- local generated output hashes
- committed runtime asset paths + hashes + dimensions
- Python tool change evidence
- Phaser preload/render integration
- logical resolution/mapping
- debug boundary alignment method
- old Graphics presentation handling
- tests/build
- browser smoke
- User Play Test status
- Design Deviations / Unexpected Scope.

## Design Deviations

Required.

If none:
`Design Deviations: NONE`

Material deviations requiring STOP:
- different Candidate geometry
- different arena alignment
- gameplay rule changes
- non-uniform background scaling.

## Git Delivery

Follow AGENTS.md.

Explicitly stage task-owned files only.

Expected files may include:

- `tools/dohyo_art/compose_dohyo.py`
- `tools/dohyo_art/tests/test_compose_dohyo.py`
- `tools/dohyo_art/README.md`
- `public/assets/action/background/arena_base_1920.png`
- `public/assets/action/background/dohyo_ring_overlay_1920.png`
- `src/main.ts`
- `src/game/scenes/BoutScene.ts`
- `src/game/scenes/DohyoView.ts`
- focused presentation tests if added
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`.

Do not stage local ignored art inputs/outputs.

One Task ≈ one commit.

Suggested commit:
`feat: integrate product dohyo background`

Push `origin/develop`.
Do not modify `main`.

## Final Instruction

Stop after Product background / Tokudawara runtime integration and verification.

Do NOT continue into:
- Product HUD
- wrestler Product art
- Gyoji
- gameplay tuning.

After commit/push/report:
「ACTION-ART-01B-PRODUCT-BACKGROUND-INTEGRATION が完了し、ChatGPT ReviewとUser Visual Check待ちです」
