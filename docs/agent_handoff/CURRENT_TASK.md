Task-ID: ART-WRESTLER-04B-RED-MASTER-RUNTIME-PROMOTION
Status: READY
Task-Type: IMPLEMENTATION / PRODUCT ART WORKFLOW / RUNTIME ASSET PROMOTION
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 89b1e7c86402229d0489849637b7920f8560d8df
Handoff-Mode: GITHUB

# ART-WRESTLER-04B — Promote Red-Master Mirror/Recolor Workflow to Runtime

## Purpose

Promote the User-accepted ART-WRESTLER-04A mirror workflow into the current Product idle wrestler runtime/export contract.

Accepted User Visual Decision:
- canonical idle master = **authored red wrestler**
- red runtime sprite remains the canonical authored/master appearance
- blue runtime sprite is derived from the red master by the validated local-Y reflection
- local +X remains FRONT
- blue mawashi is produced by the validated deterministic recolor
- the previous requirement "blue and red are separately authored and never mirrored" is withdrawn.

This Task changes the idle Product art workflow only.

Do NOT implement Tsuppari yet.

---

# Accepted Baseline — Do Not Reopen

From ART-WRESTLER-04A User Visual Gate:

## Master
Use:
- **RED MASTER**

Do not choose blue master instead.

## Reflection
Use the validated normalized-local reflection:

```
(x, y) -> (x, H - y)
```

Semantics:
- reflect local Y / wrestler left-right asymmetry
- preserve local +X = FRONT
- reflect pivot and body-core points with the same mapping
- do not introduce a second facing convention.

## Recolor
Use the accepted deterministic mawashi-only recolor behavior from ART-WRESTLER-04A.

The conservative anti-aliased mawashi fringe observed in diagnostics is visually accepted at runtime scale.

Do not broaden the mask into skin just to eliminate that fringe.

## Visual result
The User accepted:
- `red master -> derived blue`
- same-body / color-variant appearance
- runtime-scale visual result.

---

# Required Runtime Result

After this Task:

- `public/assets/action/wrestler/red.png`
  - remains the red canonical runtime sprite
  - should remain pixel-identical to the current accepted red runtime asset if the normalization path is unchanged.

- `public/assets/action/wrestler/blue.png`
  - is no longer exported from a separately authored blue source
  - is generated deterministically from the normalized red runtime master:
    1. normalize/export red master
    2. reflect local Y while preserving FRONT = +X
    3. recolor only the mawashi to blue
    4. write the derived blue runtime asset.

The runtime filenames should remain:
- `red.png`
- `blue.png`

Do not force Scene/Bout code to care how the files were produced.

---

# Important Workflow Constraint

The **runtime exporter must prove this is a one-master workflow**.

The current separately authored high-resolution blue source must no longer be required to build/check the current runtime idle assets.

A clean runtime export/check should succeed with:
- canonical red source present
- separately authored blue source absent.

Historical / comparison preview tools may continue to use the old blue source when available.

Do not delete historical tools or old comparison evidence merely because they are no longer the runtime baseline.

---

# Source of Truth / Recipe Direction

Avoid having two live copies of the same mirror/recolor tuning constants.

There must be one clear current source of truth for:
- accepted master = red
- reflection rule
- blue recolor mask parameters
- target blue recolor values
- runtime pivot/body-core derivation.

Preferred direction:
- promote/evolve the ART-WRESTLER-04A mirror recipe into the accepted runtime mirror recipe,
  OR
- create one small explicit runtime recipe and make the preview/export tests read that same config.

Do not duplicate the same recolor constants independently in multiple production-current recipe files.

Historical `dual_rigid_recipe.json` may remain for old dual-sprite preview/reference, but it must not remain the semantic source of truth that requires a blue runtime source.

If the smallest safe implementation differs, report the exact ownership clearly in Completion Report.

---

# Current Source to Inspect

Read directly:
- `AGENTS.md`
- `CLAUDE.md`
- current `CURRENT_TASK.md`
- current `CURRENT_COMPLETION_REPORT.md`
- `docs/WRESTLER_PRODUCT_ART_SPEC.md`
- `docs/ARCHITECTURE.md`
- `tools/wrestler_art/README.md`
- `tools/wrestler_art/preview_idle_mirror_workflow.py`
- `tools/wrestler_art/idle_mirror_recipe.json`
- `tools/wrestler_art/export_runtime_wrestlers.py`
- `tools/wrestler_art/preview_dual_rigid_wrestlers.py`
- `tools/wrestler_art/dual_rigid_recipe.json`
- relevant `tools/wrestler_art/tests/`
- `src/game/presentation/productWrestlerArt.ts`
- `src/game/scenes/WrestlerView.ts`
- `src/game/scenes/BoutScene.ts`.

Review Handoff does not replace Current Source inspection.

---

# Implementation Direction

## 1. Export red master

Keep the current accepted red authored source normalization:
- explicit source identity
- one whole-sprite orientation normalization to FRONT = local +X
- explicit root/pivot
- body-core = 2R
- exact runtime downscale.

Prefer preserving current red runtime pixels exactly.

If the red runtime output changes unexpectedly, STOP and report rather than silently accepting a new red appearance.

## 2. Derive blue from the normalized runtime red

The derivation should happen from the normalized runtime red image/geometry so the runtime result matches the ART-WRESTLER-04A User-approved candidate.

Use:
- local-Y reflection
- reflected pivot/body-core metadata
- accepted mawashi recolor.

Do not derive blue from a separately authored blue source.

## 3. Runtime metadata

Update `productWrestlerArt.ts` deliberately.

Expected if the accepted ART-WRESTLER-04A candidate is reproduced exactly:

- red:
  - current metadata unchanged
- derived blue:
  - dimensions match normalized red runtime dimensions
  - pivot = reflected red pivot
  - body-core diameter unchanged.

From the validated preview evidence, the expected candidate was approximately:
- red: 158×178, pivot (82,95), body-core 123.076923
- derived blue: 158×178, pivot (82,83), body-core 123.076923

Do not copy these values blindly; verify them from the actual exporter output.

## 4. Presentation

Keep:
- same texture keys / public paths if practical
- `WrestlerView` canonical position/facing behavior
- canonical facing unquantized
- gameplay body radius and Simulation completely independent.

No runtime `setFlipX/setFlipY` should be necessary if the exporter writes the derived blue PNG.

Prefer offline deterministic derivation.

---

# Product Art SPEC Update

Update `docs/WRESTLER_PRODUCT_ART_SPEC.md` so §0 becomes truthful.

New Accepted baseline should state, in substance:

- canonical authored idle master = red
- blue counterpart = deterministic local-Y reflection + blue mawashi recolor
- both are exported as normal runtime PNGs
- runtime still rotates the whole sprite by canonical facing
- gameplay geometry is unchanged
- separate authored blue/red requirement is withdrawn
- historical ART-WRESTLER-03A two-source/no-mirror workflow remains history/reference only.

Do not rewrite unrelated historical sections beyond what is needed to remove contradictions about the current baseline.

---

# ARCHITECTURE Update

Update the Product wrestler art paragraph minimally so Current Architecture no longer claims the two runtime wrestlers are separately authored.

Document the one-master derivation boundary as presentation/art tooling only.

Do not alter gameplay architecture.

---

# Tests

Verification Level:
Standard Art Tool / Presentation Asset Promotion + Browser Runtime Smoke + User Visual Check

Add/update tests intentionally.

At minimum verify:

## Export contract
1. runtime export uses red as the single canonical authored source
2. runtime export succeeds when separate blue source is absent
3. runtime `red.png` matches a fresh red-master export
4. runtime `blue.png` matches a fresh derived export
5. red output remains pixel-identical to the pre-Task accepted red runtime
6. blue output equals the accepted red-master mirror/recolor algorithm result
7. repeated export is deterministic
8. `--check` writes nothing and detects stale/changed runtime assets
9. invalid red source fails closed
10. missing red source fails closed.

## Geometry
11. derived blue preserves local +X = FRONT
12. blue pivot is the reflected red pivot
13. body-core diameter remains unchanged
14. runtime scale contract in `productWrestlerArt.ts` matches fresh exporter output
15. no extra presentation-only gameplay offset is introduced.

## Recolor
16. alpha preserved
17. pixels outside the mawashi mask equal the reflected red source
18. accepted conservative mask/fringe behavior remains unchanged
19. recolor output is deterministic.

## Repository / presentation
20. current Product paths/textures load
21. current red/blue metadata matches generated assets
22. gameplay / Simulation source is unchanged.

Run the full wrestler-art suite after focused tests.

---

# Required Verification

Run, as applicable:

```
python -m unittest discover -s tools/wrestler_art/tests -v
pnpm test
pnpm build
git diff --check
```

Use the repository's documented Python environment/tool command on the actual machine.

Why pnpm test/build are required this time:
- committed runtime Product assets and TypeScript presentation metadata are changing.

Report actual counts/results.

---

# Browser / Runtime Smoke

Required if environment supports it.

Verify:
- pre-bout comparison still opens
- Enter starts Bout
- red wrestler loads
- derived blue wrestler loads
- no missing texture / console errors
- both pivots align with canonical debug body circles
- both rotate correctly with canonical facing
- start faceoff looks like the User-approved red-master preview
- movement / Push / Counter / Grip still render with the same rigid-sprite mechanics
- R restart works.

Do not claim visual Product acceptance solely from headless rendering.

---

# User Visual Check — REQUIRED

Although the preview candidate is already accepted, this Task changes the actual runtime assets.

The final integration check should confirm:
- actual Phaser red/blue faceoff matches the accepted preview
- derived blue does not visibly jump in size/pivot
- blue mawashi looks natural in runtime
- rotation remains natural
- no unexpected texture filtering/artifact was introduced.

If those are good, the red-master runtime workflow becomes the accepted integrated Product baseline.

---

# Scope Out

Do NOT:
- implement Tsuppari
- use the four uploaded Tsuppari images in this Task
- change input bindings
- add new action states
- change Simulation / Bout rules
- change bodyRadius/contact geometry
- change Counter / Push / Grip / Drive
- create skeletal/limb animation
- add runtime dynamic recoloring if offline export is sufficient
- redesign arena/HUD
- modify Management state.

Do not opportunistically fix unrelated art issues.

---

# Stop Conditions

STOP / BLOCKED if:
- reproducing the accepted derived blue requires a material visual change from the User-approved preview
- red runtime output changes unexpectedly
- a separate blue authored source is still technically required for the current runtime exporter and cannot be removed without a larger architecture change
- mirror/recolor rules would need to change materially from the User-approved candidate
- gameplay/Simulation changes become necessary
- Current Source materially conflicts with this accepted design.

Do not silently substitute a different mirror or recolor algorithm.

---

# Expected Changed Files

May include:
- `tools/wrestler_art/export_runtime_wrestlers.py`
- accepted runtime mirror recipe/config
- related wrestler_art tests
- `tools/wrestler_art/README.md`
- `public/assets/action/wrestler/blue.png`
- possibly `public/assets/action/wrestler/red.png` only if byte re-export is identical; no visual change accepted
- `src/game/presentation/productWrestlerArt.ts`
- `docs/WRESTLER_PRODUCT_ART_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`.

Do not edit `CURRENT_TASK.md`.

---

# Implementation Evidence

Completion Report should include a compact table:

| Design Requirement | Implemented As | Verified By |
|---|---|---|

At minimum:
- red single master
- separate blue source no longer required
- exact reflection convention
- mawashi recolor ownership
- red pixel preservation
- derived blue output
- pivot/body-core metadata
- deterministic export/check
- runtime presentation unchanged
- gameplay source untouched.

---

# Completion Report

Include:
- Result
- Preflight
- Current Source delta
- final recipe/source-of-truth ownership
- red master source/export path
- blue derivation path
- exact generated dimensions/pivots/body-core
- old vs new runtime asset hashes
- proof red did not visually change
- proof blue matches accepted derived candidate
- test results
- pnpm test/build
- Browser/Runtime Smoke
- User Visual Check Required
- Changed Files
- Files explicitly not changed
- Design Deviations
- Unexpected Scope
- Known Untested Items
- Git delivery.

If none:
`Design Deviations: NONE`

---

# Git Delivery

Follow `AGENTS.md`.

Normal successful Task:
- stage only Task-owned files
- one implementation commit
- fetch / fast-forward safety check
- push `origin/develop`
- verify remote SHA
- clean working tree.

Suggested commit:
`refactor(art): derive blue wrestler from red master`

Do not modify `main`.

# Final Instruction

Promote only the accepted red-master idle mirror/recolor workflow into the runtime/export baseline.

Do not implement Tsuppari yet.
