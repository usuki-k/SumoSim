Task-ID: ACTION-07D-TSUPPARI-PRODUCT-ART-PROMOTION
Status: READY
Task-Type: IMPLEMENTATION / PRODUCT ART PROMOTION / VISUAL-GATE CLEANUP
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: df2575d8520f2bb05edfb1c4f2677b6af207c060
Review-Handoff: ACTION-07C2 accepted by User Play Test at d73f717e957ae73baf0775644be073ca4f1223ce
Handoff-Mode: GITHUB

# ACTION-07D — Promote SEPARATE Tsuppari Art to Product Baseline

## Purpose

Promote the User-accepted SEPARATE Tsuppari art result from the temporary ACTION-07C Visual Gate into the permanent Product art/runtime contract.

The User has accepted through Play Test:

- SEPARATE is the Tsuppari art strategy to keep
- current left-hand pose
- refreshed shorter right-hand pose
- derived blue counterparts
- current Tsuppari reach = 0.55 m
- current Push / Tsuppari gameplay feel is acceptable.

This Task is primarily presentation/art tooling cleanup and Product-baseline promotion.

Do NOT redesign Tsuppari gameplay.
Do NOT retune reach or force.
Do NOT reopen MIRROR-L / MIRROR-R as Product candidates.

---

# Accepted Baseline — Do Not Reopen

## Gameplay

Keep ACTION-07B / 07C2 semantics unchanged:

- ArrowLeft = left-hand Tsuppari
- ArrowRight = right-hand Tsuppari
- startup / active / recovery = 6 / 1 / 9 ticks
- per-hand cooldown = 60 ticks
- TSUPPARI_HAND_REACH = 0.55 m
- equal-radius effective center threshold = 0.90 m
- TSUPPARI_IMPULSE = 2.13 m/s
- TSUPPARI_COUPLED_SHARE = 0.5
- 5 ordinary successful hits -> 6th hit adds Kuzushi
- Countered Tsuppari = in-place Kuzushi, no CounterTransition
- current Push acceleration / Push-vs-Tsuppari contest unchanged.

Do not change Simulation gameplay code except if a documentation/comment-only correction is strictly required.

## Idle Product art

Keep the accepted idle baseline:

- authored red idle master
- derived blue idle via offline local-Y reflection + mawashi recolor
- existing runtime red.png / blue.png unchanged.

## Tsuppari Product art

Accepted SEPARATE mapping:

```
red left  = authored red-left pose
red right = authored refreshed red-right pose
blue left = reflect(red-right) + accepted blue mawashi recolor
blue right = reflect(red-left) + accepted blue mawashi recolor
```

Accepted red source identities from ACTION-07C2:

- red-left decoded RGBA SHA-256:
  `219d66dcf13585e7149382f01c964fdd9074bf61e615b5d3f9bbb15b38cb84b3`
- red-right decoded RGBA SHA-256:
  `d7d5632f8357bd1e4427d2bcdcee5a6e74307fcd9d0caca2d86d102ec8719011`

Accepted current normalized runtime geometry:

- red-left: 198 x 177, pivot (83, 94)
- blue-right: 198 x 177, pivot (83, 83)
- red-right: 193 x 163, pivot (79, 87)
- blue-left: 193 x 163, pivot (79, 76)
- all body-core diameters = 123.076923 px.

Do not change the accepted visual result while promoting it.

---

# Required Local Sources

Expected local files:

```
tools/wrestler_art/input.local/candidate_red_tsuppari_left.png
tools/wrestler_art/input.local/candidate_red_tsuppari_right.png
```

The authored blue candidates may remain available as historical/reference inputs, but they are not Product runtime sources.

Preflight must validate the accepted red source hashes above.

If either accepted red source does not match:
- STOP
- report exact mismatch
- do not regenerate Product assets from a different source.

Do not commit `input.local/`.

---

# Permanent Runtime Contract

Replace the temporary 3-mode gate runtime with exactly four permanent Tsuppari Product textures.

Preferred permanent location:

```
public/assets/action/wrestler/tsuppari/
```

Preferred filenames:

```
red_left.png
red_right.png
blue_left.png
blue_right.png
```

If a closely related naming/location is materially smaller because of Current Source, it is acceptable, but report it.

Permanent assets must reproduce the accepted SEPARATE pixels exactly.

Before deleting/renaming gate assets, capture their accepted pixel hashes and prove the permanent four textures match:

- permanent red_left == current `separate_red_left.png`
- permanent red_right == current `separate_red_right.png`
- permanent blue_left == current `separate_blue_left.png`
- permanent blue_right == current `separate_blue_right.png`.

Do not re-normalize into a visually different result merely because tooling is being cleaned up.

---

# Remove Temporary Visual-Gate Runtime Machinery

The Product no longer needs runtime comparison modes.

Remove/retire, as appropriate:

- MIRROR-L runtime textures
- MIRROR-R runtime textures
- gate-only SEPARATE naming
- key `4` art-mode cycling
- `TsuppariArtMode`
- `TSU ART: ...` debug mode label
- gate-only mode mapping tables.

Do NOT remove useful historical/offline comparison evidence if it is cheap to retain as history.

The browser/runtime should have one permanent Tsuppari art mapping after this Task.

Do not leave dead runtime assets preloaded.

---

# Permanent Presentation Mapping

Keep the architecture:

```
BoutSimulation / Snapshot
-> WrestlerVisualState
-> Product Tsuppari art selection
-> WrestlerView
```

Permanent selection is only by:
- wrestler art id: red / blue
- Tsuppari hand: left / right.

No Visual-Gate mode parameter should remain in runtime selection.

Prefer a small explicit pure presentation module, e.g.:

```ts
productTsuppariArt.ts
```

or a similarly clear extension of existing Product wrestler art metadata.

It should own:
- texture key
- asset path
- dimensions
- pivot
- body-core diameter
- left/right mapping.

Do not introduce a generic skin/pose framework.

`WrestlerView` should:
- show Product Tsuppari texture while `WrestlerVisualState.pose === 'tsuppari'`
- use the explicit pivot and body-core scale
- return to accepted idle art afterward
- preserve canonical position/facing.

Keep the currently accepted full-action held pose behavior unless explicitly required otherwise:
- startup + active + recovery.

Do not change gameplay timing.

---

# Permanent Art Export Tooling

Promote the accepted SEPARATE generation path into a permanent deterministic exporter.

Preferred small design:

- a permanent Tsuppari runtime recipe/config
- a deterministic export/check command
- reuse the existing accepted red->blue recolor rule from `runtime_wrestler_recipe.json`
- no duplicate live recolor constants.

You may evolve/rename the current gate exporter if that is smaller than creating parallel code.

Requirements:

- exactly two authored red pose sources
- exactly four permanent runtime outputs
- blue left derived from reflected red right
- blue right derived from reflected red left
- alpha preserved
- mask-outside pixels unchanged
- deterministic bytes
- fail closed on source/hash mismatch
- `--check` writes nothing.

Do not keep the 12-texture gate as the permanent exporter contract.

Historical preview comparison tooling may remain separate if useful.

---

# Measurement Reproducibility — Must Fix Now

This is a required part of Product promotion.

Known issue from 07C1/07C2:

- recipe prose says "7 px erosion"
- the calibrated measurement procedure actually used:
  - 1/2 BOX scale
  - max(RGB) < 80
  - alpha > 200
  - **7 px opening (erosion + dilation)**
  - largest hair component
- the measurement helper currently exists only in scratchpad, not Repository.

For Product promotion, make the accepted normalization measurement reproducible.

Implement the smallest deterministic solution.

Preferred:

- add a small helper under `tools/wrestler_art/`, for example
  `measure_tsuppari_pose.py`
- it reads the accepted source(s)
- computes/reports the landmarks and derived normalization evidence
- no manual image editing
- no ML/OpenCV/NumPy dependency unless already required
- output should be deterministic.

At minimum it must reproduce, within explicit documented rounding/tolerance, the accepted red-left and red-right measurements currently recorded in the recipe.

Update recipe prose so it says the actual implemented method.

Do not use the helper to alter the already accepted runtime pixels unless the existing recorded values are proven materially wrong.

If formalizing the helper reveals a material mismatch with the accepted normalized art:
- STOP
- report
- do not silently move the accepted pose.

---

# Product Art SPEC Update

Update `docs/WRESTLER_PRODUCT_ART_SPEC.md` so §0 is truthful.

Current Product baseline should state:

## Idle
- authored red idle master
- derived blue idle
- rigid sprite / canonical facing / explicit pivot.

## Tsuppari
- two authored red pose masters:
  - left
  - right
- blue variants derived deterministically:
  - blue left <- reflected red right + recolor
  - blue right <- reflected red left + recolor
- explicit pivot/body-core per texture
- pose selected from Simulation presentation state only
- pose held for current whole Tsuppari action
- no runtime mirror/recolor
- no sprite-based gameplay collision
- SEPARATE is the accepted Product strategy
- MIRROR-L / MIRROR-R were Visual-Gate experiments and are not the Product baseline.

Do not rewrite unrelated historical sections beyond removing contradictions.

---

# ARCHITECTURE Update

Update Product wrestler/Tsuppari presentation paragraphs so Current Architecture describes:

- permanent four Tsuppari Product textures
- deterministic red-source -> blue derivation
- permanent art selection by hand
- no key-4 Visual Gate mode
- no gameplay ownership in presentation.

Keep `TSUPPARI_HAND_REACH = 0.55 m` as the accepted current Prototype value.

Do not change gameplay formulas.

---

# Historical Gate Assets / Tools

It is acceptable to retain:

- historical gate recipe
- offline comparison sheets/tool

only if they are clearly marked historical and do not participate in current runtime/export ownership.

Prefer removing committed runtime-only 12 gate textures once the four permanent assets replace them.

Avoid duplicated current Sources of Truth.

The Completion Report must state:
- what was deleted
- what remains as history
- what is the single current Product source/export contract.

---

# Tests

Update/add tests for the permanent contract.

At minimum verify:

1. accepted red-left/red-right source hashes
2. permanent exporter uses exactly the two red sources
3. four runtime textures are produced
4. permanent four pixels match the accepted SEPARATE gate pixels
5. blue-left hand mapping = reflected red-right + recolor
6. blue-right hand mapping = reflected red-left + recolor
7. alpha preserved
8. mask-outside pixels unchanged
9. body-core remains 123.076923 px
10. permanent metadata matches exporter dimensions/pivots
11. repeated export is deterministic
12. `--check` is read-only and detects stale assets
13. accepted idle red/blue unchanged
14. runtime presentation has no art-mode dependency
15. no key-4 Tsuppari art toggle remains
16. Tsuppari still displays the correct left/right pose for the full action
17. non-Tsuppari states still use accepted idle art
18. Simulation gameplay source unchanged from ACTION-07C2 baseline.

---

# Verification

Verification Level:
Standard Product Art Promotion + Browser Runtime + final User check

Required:

- focused permanent Tsuppari-art tool tests
- full wrestler-art suite
- focused presentation tests
- `pnpm test`
- `pnpm build`
- `git diff --check`
- permanent exporter deterministic rerun
- permanent exporter `--check`
- accepted idle exporter `--check`
- verify `src/game/sumo` and `src/game/input` have no semantic change.

If Product promotion requires gameplay changes:
- STOP and report.

---

# Browser / Runtime Smoke

Required.

Verify:

- pre-bout works
- Enter starts Bout
- ArrowLeft always shows permanent left Tsuppari Product pose
- ArrowRight always shows permanent right Tsuppari Product pose
- red CPU and blue player both map to the accepted derived textures
- pose held through current Tsuppari action
- returns to idle cleanly
- no key-4 Visual Gate switching remains
- no gate mode debug label remains
- dummy mode 3 remains useful
- Push / Counter / Grip unaffected
- current 0.55 m reach behavior unchanged
- R restart works
- no missing texture / console errors.

---

# Final User Play Test

Required as a final integration regression gate.

The visual strategy and reach are already accepted.
The User only needs to confirm that Product promotion/cleanup did not alter the accepted result.

Check:

- same accepted SEPARATE left/right look
- same right-arm length balance
- same blue variants
- same 0.55 m reach feel
- no texture/pivot jump
- no gameplay regression.

Technical PASS does not replace this final integrated check.

---

# Scope Out

Do NOT:

- retune gameplay
- change reach
- change Push
- change cooldown/timing/buildup/Counter
- change idle Product art
- regenerate new candidate art
- re-evaluate MIRROR modes
- add multi-frame animation
- add skeletal animation
- add generic pose/skin systems
- change Management/Save/CPU/Touch systems
- update PROJECT_HANDOFF.md.

---

# Stop Conditions

STOP if:

- accepted red source hashes do not match
- permanent outputs cannot reproduce accepted SEPARATE pixels
- formalized measurement helper materially disagrees with accepted normalization
- recolor/mask contaminates non-mawashi regions
- runtime cleanup requires gameplay changes
- removing gate modes causes a broad presentation redesign
- Current Source materially conflicts with this Task.

---

# Expected Files

Likely:

- permanent Tsuppari runtime recipe/config
- permanent export/check tool
- deterministic measurement helper
- focused art tests
- `tools/wrestler_art/README.md`
- four permanent Tsuppari runtime PNGs
- removal of 12 temporary gate PNGs
- permanent pure presentation metadata module
- `WrestlerView.ts`
- `BoutScene.ts` cleanup of key 4 / gate debug state
- presentation tests
- `docs/WRESTLER_PRODUCT_ART_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`.

Do not modify `CURRENT_TASK.md`.

---

# Implementation Evidence Required

Completion Report must include:

| Design Requirement | Implemented As | Verified By |
|---|---|---|

At minimum:

- accepted SEPARATE promotion
- permanent red left/right source ownership
- permanent blue derivation mapping
- exact four runtime asset paths
- accepted-pixel preservation
- explicit pivot/body-core metadata
- deterministic export/check
- measurement helper/procedure
- Visual-Gate runtime cleanup
- gameplay unchanged
- SPEC/ARCHITECTURE updated.

---

# Completion Report

Include:

- Result
- Preflight
- accepted source hashes
- permanent source-of-truth ownership
- measurement-helper method/results
- old gate -> permanent asset mapping
- proof permanent pixels equal accepted SEPARATE pixels
- deleted/retained historical gate files
- runtime metadata
- tests/build
- browser smoke
- changed files
- gameplay files explicitly unchanged
- Design Deviations
- Unexpected Scope
- Known Untested Items
- Final User Play Test Required
- Git delivery.

If none:
`Design Deviations: NONE`

---

# Git Delivery

Follow `AGENTS.md`.

Normal successful Task:

- stage only Task-owned files
- one implementation commit
- fetch / fast-forward safety
- push `origin/develop`
- verify remote SHA
- clean working tree.

Suggested commit:

`refactor(art): promote tsuppari product poses`

Do not modify:
- `main`
- `PROJECT_HANDOFF.md`.

# Final Instruction

Promote the User-accepted SEPARATE Tsuppari art into the permanent Product runtime/export contract.

Remove temporary runtime comparison machinery.
Formalize measurement reproducibility.
Keep ACTION-07C2 gameplay exactly unchanged.
