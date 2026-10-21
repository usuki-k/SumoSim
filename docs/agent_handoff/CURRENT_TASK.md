Task-ID: ART-WRESTLER-04A-IDLE-MIRROR-WORKFLOW-VALIDATION
Status: READY
Task-Type: INVESTIGATION / ART WORKFLOW / VISUAL VALIDATION
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 8ffadc83167c917bdc54a97f052e9f9d5988142b
Handoff-Mode: GITHUB

# ART-WRESTLER-04A — Idle Sprite Mirror + Mawashi Recolor Visual Validation

## Purpose

Before implementing Tsuppari, validate whether the current Product wrestler idle art can move from the existing
"two separately authored blue / red sprites, no mirroring" workflow to a smaller deterministic workflow based on:

- one canonical idle master
- deterministic mirror/reflection for the counterpart
- deterministic mawashi recoloring
- the same runtime pivot/body-core scale contract.

This Task is a visual/workflow investigation only.

Do NOT implement Tsuppari gameplay.
Do NOT change Bout input.
Do NOT replace the current committed runtime wrestler assets yet.

The goal is to give the User a clear side-by-side visual comparison and enough technical evidence to decide whether
the mirror workflow becomes the new Product art baseline.

---

# User Decision / Current Context

The User explicitly permits withdrawing the previous Accepted art constraint:

> blue and red are separately authored sprites and are never mirrored.

That previous constraint must therefore NOT be treated as immutable in this investigation.

However, mirror-based idle art is NOT yet accepted as the new Product baseline.

This Task must first prove whether it looks acceptable.

If the User accepts the preview after this Task, a later implementation Task may replace the runtime asset/export contract.

---

# Current Baseline

Current runtime:
- `public/assets/action/wrestler/blue.png`
- `public/assets/action/wrestler/red.png`
- each is a separately authored rigid full-body sprite
- `productWrestlerArt.ts` has separate metadata for blue/red
- `WrestlerView` places canonical participant position at the explicit pivot and rotates the whole sprite by canonical facing
- gameplay body radius/contact geometry is independent of sprite pixels.

Current tooling:
- `tools/wrestler_art/preview_dual_rigid_wrestlers.py`
- `tools/wrestler_art/dual_rigid_recipe.json`
- `tools/wrestler_art/export_runtime_wrestlers.py`

The current no-mirror assumption is embedded in documentation/tool comments/tests.
Do not broadly rewrite that workflow during this investigation.

---

# Critical Geometry Rule

Do NOT assume that "mirror" means a raw screen-space left-right flip.

The current runtime contract normalizes the wrestler so:
- local +X = FRONT
- canonical facing rotates the whole sprite at runtime.

A counterpart derivation must preserve the semantic FRONT axis.

Investigate the correct reflection in the normalized local character frame.

Preferred candidate to test:
- reflect local Y (left/right body asymmetry) while preserving local +X as FRONT.

If a screen-space flip is used internally, compensate explicitly so the resulting derived sprite still has:
- FRONT = local +X
- the same participant root/pivot meaning
- the same body-core scale reference.

Report exactly what transform is used.

Do not introduce a hidden second facing convention.

---

# Investigation Questions

Answer at least:

1. Can one current idle sprite be used as the canonical master and produce a visually acceptable counterpart by reflection + mawashi recolor?
2. Which current master is the better source candidate?
   - blue -> derived red
   - red -> derived blue
   - or both are materially equivalent.
3. Does mirroring create obvious visual problems in:
   - topknot / hair
   - hands / feet
   - shoulder / torso anatomy
   - mawashi knot
   - lighting / painted highlights
   - silhouette / weight distribution?
4. Does the derived counterpart still look acceptable through whole-sprite runtime rotation?
5. Does it still look acceptable face-to-face at:
   - prototype start distance
   - near contact
   - side position / oblique line?
6. Can mawashi recoloring be deterministic while preserving painted shading/highlights?
7. Can recoloring be limited to the mawashi with no visible skin/hair/body color contamination?
8. Can root/pivot and body-core scale remain stable without gameplay or runtime-position changes?
9. Would the mirror workflow materially reduce future pose-production burden compared with separately generating red/blue versions?
10. What exact workflow should be recommended if the User accepts it?

---

# Scope

Allowed:
- add a small deterministic preview tool under `tools/wrestler_art/`
- add a small explicit recipe/config for mirror/recolor preview
- add focused Python tests
- use current committed runtime blue/red sprites as comparison/reference inputs
- if needed, use existing reviewed local 03A source inputs when available
- generate git-ignored local preview outputs
- minimally update tool README to explain how to run the experiment
- write the Completion Report.

Preferred new tool shape:

`tools/wrestler_art/preview_idle_mirror_workflow.py`

Exact filename may differ if extending an existing preview tool is substantially smaller/clearer.

Do not turn this into a general image-processing framework.

---

# Source / Input Policy

Prefer using committed current runtime sprites for the visual comparison so the Task can run from the Repository baseline:

- `public/assets/action/wrestler/blue.png`
- `public/assets/action/wrestler/red.png`

If the higher-resolution local source is required for a fair comparison:
- it may be used from `tools/wrestler_art/input.local/`
- it must remain local / uncommitted
- the Completion Report must distinguish results that require local source from results reproducible from committed runtime assets.

Do not add user-uploaded Tsuppari images to this Task.
They are for the later Tsuppari work, not this idle-workflow validation.

---

# Mawashi Recolor Direction

Use a deterministic recolor method that preserves shading rather than painting a flat replacement color.

Required properties:
- alpha unchanged
- body/hair/skin pixels outside the selected mawashi mask unchanged
- luminance/value structure of folds/highlights substantially preserved
- deterministic output from the same input/config
- explicit target blue/red colors in the recipe/config
- debug preview of the selected mawashi mask.

A small mask-generation method is acceptable, for example:
- explicit source-color / hue range + region constraint / connected component
- explicit seed + deterministic flood/region rule
- another small deterministic method.

Do NOT manually repaint the PNG.
Do NOT use an ML segmentation dependency.
Do NOT add OpenCV/NumPy unless current repository already requires it and it is genuinely necessary.

If a reliable mawashi-only mask cannot be produced without also changing skin/hair, STOP and report instead of hiding the contamination.

---

# Required Preview Outputs

Generate git-ignored previews under a clear local directory, e.g.:

`tools/wrestler_art/output-idle-mirror.local/`

At minimum produce:

## A. Baseline vs derived comparison
One labeled sheet showing:
- current authored blue
- current authored red
- blue-master -> mirrored/recolored red candidate
- red-master -> mirrored/recolored blue candidate

All at the same runtime scale and aligned by participant pivot.

## B. Rotation comparison
For each derived candidate:
- 0°
- 45°
- 90°
- 180°
- 270°

Use the same pivot and body circle reference.

A 16-angle sheet is welcome if existing helper reuse makes it cheap, but the listed angles are mandatory.

## C. Arena faceoff
Show:
1. current authored blue/red baseline
2. blue-master-derived pair
3. red-master-derived pair

At:
- prototype start distance
- near contact
- at least one oblique/side arrangement.

Use the accepted Product arena.

## D. Mirror / recolor diagnostics
Show:
- source sprite
- mirror-only result
- mawashi mask
- mirror + recolor result
- pivot/body-core overlay.

## E. Optional motion preview
If small helper reuse makes it cheap:
- a short whole-sprite rotation or advance GIF for current vs derived.

Do not add animation systems merely to satisfy this optional item.

---

# Visual Evaluation Criteria

The User must be able to judge:

- "same wrestler / same art family" rather than "another AI-generated body"
- no obviously backwards anatomy
- no broken hand/foot/topknot orientation
- no strange mawashi knot direction
- no obvious lighting reversal that becomes distracting
- no body jump caused by pivot mismatch
- no size jump caused by body-core mismatch
- red/blue distinction remains clear
- derived art remains readable at actual runtime size (~123 px body core)
- faceoff still looks natural when one wrestler is rotated toward the other.

Do not judge Product acceptance from automated tests.

---

# Runtime / Production Changes — Scope Out

Do NOT change:
- `public/assets/action/wrestler/blue.png`
- `public/assets/action/wrestler/red.png`
- `src/game/presentation/productWrestlerArt.ts`
- `src/game/scenes/WrestlerView.ts`
- `BoutScene`
- any Simulation / gameplay file
- input bindings
- Counter / Push / Grip / Drive behavior
- Tsuppari gameplay or Tsuppari art integration.

Do NOT delete the existing dual-sprite tool or recipe.

This Task produces evidence only.

---

# Documentation Rule

Do not prematurely rewrite `docs/WRESTLER_PRODUCT_ART_SPEC.md` to say mirror is accepted.

The previous "never mirror" decision has been explicitly reopened by the User, but the replacement workflow requires this visual gate first.

In the Completion Report, clearly state:
- previous constraint reopened by User
- mirror workflow is Candidate / Pending User Visual Gate
- no runtime baseline changed yet.

A later review may update the Product art SPEC if the User accepts the mirror workflow.

---

# Required Reading

Read directly:
- `AGENTS.md`
- `CLAUDE.md`
- current `docs/agent_handoff/CURRENT_TASK.md`
- current `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- `docs/WRESTLER_PRODUCT_ART_SPEC.md`
- `docs/ARCHITECTURE.md`
- `tools/wrestler_art/README.md`
- `tools/wrestler_art/preview_dual_rigid_wrestlers.py`
- `tools/wrestler_art/preview_single_wrestler.py`
- `tools/wrestler_art/export_runtime_wrestlers.py`
- `tools/wrestler_art/dual_rigid_recipe.json`
- relevant tests under `tools/wrestler_art/tests/`
- `src/game/presentation/productWrestlerArt.ts`
- `src/game/scenes/WrestlerView.ts`.

---

# Verification

Verification Level:
Focused Art Tool Verification + User Visual Gate

Required:
1. run the focused new/updated Python tool tests
2. run the existing wrestler_art test suite
3. deterministic rerun: same inputs/config -> identical output pixel hashes
4. confirm current committed runtime blue/red files are unchanged
5. confirm no gameplay/source file outside the allowed tool/docs/report scope changed
6. `git diff --check`.

If the tool modifies no TypeScript/runtime source, full `pnpm test` / `pnpm build` are not required merely for ceremony.
If any TS/runtime file is unexpectedly touched, STOP and report scope conflict instead of expanding the Task.

Technical tests must verify at least:
- reflection keeps explicit pivot mapping correct
- derived FRONT convention remains local +X
- body-core diameter/scale remains unchanged
- alpha preserved
- pixels outside the mawashi mask are byte/pixel identical to the mirrored source
- recolor is deterministic
- source runtime assets are read-only
- preview output is deterministic.

---

# Stop Conditions

STOP / BLOCKED if:
- the mirror transform cannot preserve the current FRONT/pivot contract cleanly
- mawashi recolor visibly or measurably contaminates skin/hair/body outside the intended mask
- a fair preview would require changing current runtime assets
- a gameplay/runtime architecture change becomes necessary
- the only way to make the result look acceptable is manual painting or a new AI-generated second wrestler
- Current Source materially conflicts with this Task.

Do not silently fix unrelated art issues.

---

# Completion Report

Include:
- Result
- Preflight
- source files inspected
- exact mirror/reflection transform
- exact recolor/mask method
- master candidates tested
- preview output paths
- comparison of blue-master and red-master approaches
- pivot/body-core evidence
- deterministic output evidence
- focused test results
- existing wrestler_art suite results
- files changed
- files explicitly not changed
- recommendation:
  - ACCEPT CANDIDATE: blue master
  - ACCEPT CANDIDATE: red master
  - EITHER
  - REJECT mirror workflow
  - or USER VISUAL DECISION REQUIRED if technical evidence cannot choose
- User Visual Gate: REQUIRED
- Design Deviations
- Unexpected Scope
- Git delivery.

Do not claim Product acceptance before the User sees the previews.

---

# Git Delivery

Follow `AGENTS.md`.

Expected task-owned repository files may include:
- new/updated `tools/wrestler_art/` preview tool
- small mirror/recolor recipe/config
- focused tests
- `tools/wrestler_art/README.md`
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

Preview image/GIF outputs remain in git-ignored `*.local` output directories and are NOT committed.

Do not modify `CURRENT_TASK.md`.
Do not modify `main`.

Suggested commit:
`test(art): validate mirrored idle wrestler workflow`

# Final Instruction

Validate the idle mirror + mawashi recolor workflow only.

Do not implement Tsuppari.
Do not replace the current Product runtime wrestler assets.
Do not declare the mirror workflow accepted until the User Visual Gate.
