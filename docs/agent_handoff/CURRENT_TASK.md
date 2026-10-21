Task-ID: ACTION-07C-TSUPPARI-ART-VISUAL-GATE
Status: REVIEWED
Task-Type: ART VISUAL GATE / PRESENTATION INTEGRATION / RUNTIME COMPARISON
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 7b38c3ac3cef62115a7082f824b3eb56f29493d5
Review-Handoff: ACTION-07B technical review accepted at a94e14f1c59e077f909a9d0da91591b22a172ea9
Handoff-Mode: GITHUB

# ACTION-07C — Tsuppari Art Visual Gate

## Purpose

Make ACTION-07B Tsuppari visually readable in the actual Phaser runtime so the User can finally judge Game Feel.

The User Play Tested ACTION-07B and reported:
- Tsuppari currently has no dedicated visible pose, so rhythm / impact / feel cannot yet be judged
- current Push / Tsuppari displacement is acceptable enough to keep for now
- next step should be the Tsuppari Art Visual Gate.

This Task is presentation/art focused.

Do NOT rebalance Tsuppari gameplay unless a visual-integration prerequisite exposes a real blocker.
Do NOT change the accepted Push/Tsuppari force values in this Task.

---

# Required Local Candidate Inputs

The User has placed these four candidate PNG files in the existing git-ignored art input directory:

```
tools/wrestler_art/input.local/candidate_red_tsuppari_left.png
tools/wrestler_art/input.local/candidate_red_tsuppari_right.png
tools/wrestler_art/input.local/candidate_blue_tsuppari_left.png
tools/wrestler_art/input.local/candidate_blue_tsuppari_right.png
```

Treat them as Visual-Gate candidate source art, not yet accepted Product runtime sources.

Preflight must confirm all four exist and are readable RGBA/transparent PNGs.

If any required file is missing or unreadable:
- STOP
- report the exact missing/invalid path
- do not substitute another image
- do not generate replacement art.

Do not commit the files under `input.local/`.

---

# Accepted Baselines — Do Not Reopen

## Gameplay

ACTION-07B technical baseline is accepted for this Art Gate:

- ArrowLeft = left-hand Tsuppari
- ArrowRight = right-hand Tsuppari
- startup 6 / active 1 / recovery 9
- per-hand cooldown 60 ticks
- center-based reach
- deterministic buildup
- 6th successful hit Kuzushi
- Tsuppari Counter = in-place Kuzushi
- Push/Tsuppari contest rules
- Push/Tsuppari provisional displacement values.

The User said current push amounts are acceptable for now.

Do NOT change:
- `PUSH_EXTERNAL_ACCELERATION`
- `TSUPPARI_IMPULSE`
- reach
- cooldown
- timing
- buildup threshold
- Counter rules
- pair-force rules.

## Idle Product art

Accepted idle baseline remains:

- authored red idle master
- offline derived blue idle
- local-Y reflection + mawashi recolor
- ordinary runtime PNGs
- no dynamic runtime color recolor.

Do not redesign idle art.

---

# Visual Question to Answer

The User has not yet accepted how left/right Tsuppari pose art should be produced.

Compare these approaches in the actual game:

## Mode A — SEPARATE

Use the two separately authored red Tsuppari pose candidates:

- red Left = `candidate_red_tsuppari_left.png`
- red Right = `candidate_red_tsuppari_right.png`

Derive blue from the accepted red-master workflow semantics:
- blue Left is derived from the opposite red-hand source as required by local-Y reflection
- blue Right is derived from the opposite red-hand source.

The separately authored blue candidate PNGs are **reference/comparison evidence only** in this Task.
They may be shown in diagnostic sheets, but do not make them the Product source of truth.

## Mode B — MIRROR-L

Use only:
- `candidate_red_tsuppari_left.png`

Derive:
- red Right by local-Y reflection
- blue Right by local-Y reflection + blue mawashi recolor
- blue Left by the corresponding double-reflection / color-variant path needed to preserve semantic hand identity.

## Mode C — MIRROR-R

Use only:
- `candidate_red_tsuppari_right.png`

Derive the opposite-hand red and the two blue variants symmetrically.

Why three modes:
- do not arbitrarily choose which one-hand master is better before the User sees them
- the User can compare separate authored L/R vs either one-hand mirror source in the same runtime.

If Current Source makes three modes materially more complex than two, STOP and report rather than silently dropping a comparison mode.

---

# Critical Hand / Reflection Semantics

Current art coordinates after normalization:
- local +X = FRONT
- local Y distinguishes wrestler left/right.

The accepted local-Y reflection swaps hand identity.

Therefore do NOT map files by filename alone.

For the separate-red-master mode, preserve semantic hand identity explicitly.

Expected relationship after normalization:

- reflect(red Left pose) -> opposite-hand blue pose
- reflect(red Right pose) -> opposite-hand blue pose.

The Completion Report must state the exact hand mapping used for all runtime candidate textures.

Do not introduce a second facing convention.

---

# Art Normalization

Each candidate pose must be normalized as a rigid whole-body sprite using the existing Product art principles:

- explicit source identity
- transparent source
- one whole-sprite orientation normalization so FRONT = local +X
- explicit participant root / pivot
- explicit body-core scale = 2R
- deterministic downscale to Product runtime scale
- no limb warping
- no skeletal manipulation
- no sprite-pixel gameplay collision.

The goal is that switching idle <-> Tsuppari:
- does not visibly jump the wrestler center
- does not change apparent body scale
- does not rotate the body unexpectedly.

The candidate sources may require their own measured:
- source_front_deg
- root_source_px
- body_core_source_px.

Do not blindly reuse idle source coordinates if the candidate body is shifted.

Record the chosen measurements in an explicit Visual-Gate recipe/config.

All pose geometry remains presentation only.

---

# Recolor

For derived blue candidates:

- use deterministic offline mawashi recolor
- preserve alpha
- preserve shading
- keep pixels outside the selected mawashi mask unchanged from the reflected/relevant source
- reuse the accepted red->blue algorithm where it remains valid.

Important:
Tsuppari arms may overlap or approach the mawashi differently.

Therefore validate the mawashi mask separately for each pose.

If the existing hue-band / connected-component method materially contaminates skin/hair/arm or misses a large visible section:
- STOP and report the mask problem
- do not silently broaden into skin.

The authored blue candidate images may be used as visual references for blue tone / anatomy comparison.

---

# Runtime Visual Gate

The User needs to judge the pose while actually playing ACTION-07B.

Integrate temporary Visual-Gate runtime textures into the browser build.

Recommended committed generated output location:

```
public/assets/action/wrestler/tsuppari-gate/
```

Suggested files:

```
separate_red_left.png
separate_red_right.png
separate_blue_left.png
separate_blue_right.png

mirror_l_red_left.png
mirror_l_red_right.png
mirror_l_blue_left.png
mirror_l_blue_right.png

mirror_r_red_left.png
mirror_r_red_right.png
mirror_r_blue_left.png
mirror_r_blue_right.png
```

Exact filenames may differ if one explicit manifest is cleaner.

These are Visual-Gate runtime assets, not yet the final Product source contract.

They must be generated deterministically from the local candidate inputs via an explicit tool/recipe, not manually edited after export.

Do not overwrite the accepted idle `red.png` / `blue.png`.

---

# Browser Mode Toggle

Provide a lightweight developer-only way to compare the three art modes without code edits.

Preferred:

- key `4` cycles:
  - SEPARATE
  - MIRROR-L
  - MIRROR-R

Show the active art mode in debug UI.

Mode switching:
- is presentation-only
- must not restart Simulation
- must not change cooldown/buildup/gameplay state
- must not alter outcome
- must not alter participant position/facing.

If key 4 materially conflicts with Current Source controls, choose another unused debug key and report it.

---

# Pose Selection

Use ACTION-07B's existing presentation state:

- `WrestlerVisualState.pose === 'tsuppari'`
- `tsuppariHand === 'left' | 'right'`
- `tsuppariPhase`.

For this Visual Gate:

- show the selected Tsuppari pose for the **entire Tsuppari action**
  - startup
  - active
  - recovery.

Reason:
- the User currently cannot judge the action because it is visually invisible
- one visible held pose is the smallest first comparison.

Do not create multi-frame animation.

Do not let image timing decide gameplay.

When action leaves Tsuppari:
- return to existing idle/move/current rigid sprite behavior.

---

# Presentation Architecture

Keep:

```
Simulation / Snapshot
-> WrestlerVisualState
-> WrestlerView / texture selection
```

Simulation already exposes the required hand/phase.

Do not add Tsuppari art mode to BoutSimulation.

Art mode is presentation-only.

Prefer a small explicit presentation type such as:

```ts
type TsuppariArtMode = 'separate' | 'mirror-left' | 'mirror-right'
```

owned by Scene/presentation.

Avoid generic skin/theme systems.

---

# Wrestler Art Metadata

Extend presentation metadata only as needed.

Each Visual-Gate texture needs:
- texture key
- path
- width / height
- pivot
- bodyCoreDiameterPx.

Do not force every pose to share identical texture dimensions.

WrestlerView should:
- use the correct origin from that texture's explicit pivot
- use the correct body-core scale
- keep the canonical participant position/facing.

Switching textures must not create an extra gameplay offset.

---

# Required Offline Preview Evidence

In addition to browser runtime integration, generate git-ignored comparison evidence, e.g.:

```
tools/wrestler_art/output-tsuppari-gate.local/
```

At minimum:

1. normalized source/pivot guide for each authored candidate
2. separate mode red/blue left/right sheet
3. mirror-left mode sheet
4. mirror-right mode sheet
5. idle <-> Tsuppari alignment sheet
6. rotation sheet at:
   - 0
   - 45
   - 90
   - 180
   - 270 degrees
7. faceoff at:
   - ordinary body contact (~0.70 m)
   - current Tsuppari reach threshold (~0.875 m)
8. mawashi mask diagnostics
9. authored-blue-reference vs derived-blue comparison.

Do not commit the `*.local` preview output.

---

# Authored Blue Candidate Role

These two files:

```
candidate_blue_tsuppari_left.png
candidate_blue_tsuppari_right.png
```

are not the accepted runtime production source.

Use them to answer:
- does derived blue preserve the expected blue tone?
- does red-master derivation create a materially worse anatomy/silhouette than the separately generated blue reference?
- does reflection introduce an obvious visual problem?

Do not switch the project back to separately authored blue source merely because the files exist.

If the derived blue is materially worse, report that to the User at the Visual Gate rather than silently changing the accepted art workflow.

---

# Scope In

- inspect/validate the four local candidate images
- deterministic normalization/export tooling
- temporary Visual-Gate runtime assets
- explicit presentation metadata
- Tsuppari texture switching in WrestlerView/presentation
- presentation-only 3-mode toggle
- debug label for active art mode
- offline comparison sheets
- focused tests
- browser/runtime smoke
- Completion Report.

---

# Scope Out

Do NOT:
- change Tsuppari gameplay formulas
- change Push gameplay
- change Counter logic
- change reach
- change cooldown
- change buildup
- change Simulation state shape unless a compile-only presentation prerequisite is unavoidable
- change ring-out
- change Grip/Drive
- change idle runtime assets
- create new AI-generated images
- manually repaint candidate sources
- add multi-frame animation
- add skeletal animation
- build a general pose/skin framework
- update WRESTLER_PRODUCT_ART_SPEC as though one Tsuppari art strategy is already accepted.

The User Visual Gate must choose the final strategy first.

---

# Expected Files

Likely:

- new Visual-Gate recipe under `tools/wrestler_art/`
- new/updated deterministic Tsuppari preview/export tool
- focused Python tests
- `tools/wrestler_art/README.md`
- generated temporary runtime candidate PNGs under `public/assets/action/wrestler/tsuppari-gate/`
- `src/game/presentation/productWrestlerArt.ts` or a small adjacent Tsuppari art metadata module
- `src/game/scenes/WrestlerView.ts`
- `src/game/scenes/BoutScene.ts`
- presentation tests
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`.

Do not modify `CURRENT_TASK.md`.

---

# Verification

Verification Level:
Standard Presentation / Art Integration + Browser Runtime + User Visual Gate

Required:

1. focused wrestler-art tool tests
2. full wrestler-art test suite
3. focused presentation tests
4. `pnpm test`
5. `pnpm build`
6. `git diff --check`
7. deterministic rerun of generated Visual-Gate runtime assets
8. confirm accepted idle `red.png` / `blue.png` are unchanged
9. confirm Simulation gameplay files are unchanged, except purely mechanical type propagation if absolutely required.

If any gameplay semantic file changes materially:
- STOP
- report scope conflict.

---

# Browser / Runtime Smoke

Required.

Check:

- pre-bout still works
- Enter starts Bout
- ArrowLeft visibly shows left Tsuppari pose
- ArrowRight visibly shows right Tsuppari pose
- pose remains visible through the full Tsuppari action
- pose returns cleanly afterward
- key 4 cycles all three modes
- art-mode debug label updates
- mode toggle does not change Simulation Snapshot state
- dummy mode 3 makes repeated visual checking practical
- current Push / Counter / Grip controls still work
- idle/movement still use accepted idle sprite
- R restart works
- no missing texture / console errors.

---

# Visual Gate Acceptance Criteria

The User must be able to judge, in actual gameplay:

## Separate
- authored red left vs authored red right
- derived blue pair
- hand identity
- idle -> pose consistency.

## Mirror-L
- whether mirroring left master into right looks natural
- whether knot/hair/body asymmetry flips distractingly.

## Mirror-R
- same question starting from right master.

## Across all modes
- body does not jump in position/size
- left/right hand is understandable
- reach looks visually believable
- blue derivation looks acceptable
- Tsuppari is visible enough to judge rhythm/impact
- full-action pose hold is readable or feels too long.

Do not declare one mode accepted before User review.

---

# Completion Report

Include:

- Result
- Preflight / all four local inputs
- exact input hashes/sizes
- normalization measurements for each authored candidate
- exact hand/reflection mapping
- exact recolor/mask result per pose
- runtime Visual-Gate asset paths
- mode toggle key
- presentation state ownership
- changed files
- files explicitly not changed
- deterministic export evidence
- focused tests
- full tests/build
- browser/runtime smoke
- offline preview output paths
- authored-blue-reference comparison findings
- Design Deviations
- Unexpected Scope
- Known Untested Items
- User Visual Gate: REQUIRED
- Git delivery.

Do not claim Product Tsuppari art acceptance.

---

# Stop Conditions

STOP / report if:

- any of the four required local candidate PNGs is missing/unreadable
- candidate transparency is unusable
- root/body-core/front cannot be normalized without a materially subjective redraw
- mawashi recolor contaminates skin/arm/hair materially
- derived blue is technically impossible with the accepted deterministic workflow
- runtime texture switching requires gameplay ownership changes
- three-mode comparison requires a broad presentation framework
- Current Source materially conflicts with this Task.

Do not silently substitute assets or redesign gameplay.

---

# Git Delivery

Follow `AGENTS.md`.

Normal success:
- stage only Task-owned files
- one commit
- push `origin/develop`
- verify remote SHA
- clean working tree.

Suggested commit:
`feat(art): add tsuppari visual gate`

Do not modify:
- `main`
- `PROJECT_HANDOFF.md`.

# Final Instruction

Create a runtime-comparable Tsuppari Art Visual Gate from the four User-provided local candidate PNGs.

Keep ACTION-07B gameplay unchanged.
Do not select the final Tsuppari art strategy before the User Visual Gate.


---

# ChatGPT Review Handoff

Review-Date: 2026-10-22
Overall Result: TECHNICAL PASS / USER VISUAL GATE REQUIRED
Accepted Technical Baseline: e30d6b407c3c98f086f4765a0847f3f74038fe0f

## Reported Implementation vs Design

Accepted as aligned with ACTION-07C.

Confirmed from Current Source / diff:

- all four required local candidate inputs were validated after the filename prerequisite was corrected
- candidate source files remain under git-ignored `input.local/`
- 12 temporary Visual-Gate runtime textures were generated deterministically
- all three required comparison modes exist:
  - SEPARATE
  - MIRROR-L
  - MIRROR-R
- authored blue candidates are reference/comparison inputs only
- runtime candidate textures are derived from the red pose masters
- key 4 cycles the three art modes
- current art mode is presentation-only Scene state
- Simulation / Snapshot / ACTION-07B gameplay state was not changed
- accepted idle `red.png` / `blue.png` were not changed
- Product Tsuppari art strategy was not prematurely accepted.

## Presentation Ownership Review

Accepted flow:

```
BoutSimulation / Snapshot
-> resolveWrestlerVisualState
-> selectWrestlerArt(...)
-> WrestlerView
```

- `TsuppariArtMode` lives in presentation code.
- `BoutScene` owns the currently selected Visual-Gate mode.
- `WrestlerView` switches texture, origin and body-core scale only from presentation metadata.
- canonical participant center and facing remain Snapshot-owned.
- changing mode does not modify gameplay state.

This preserves the project architecture.

## Hand / Reflection Mapping Review

The explicit mapping is technically coherent with local +X = FRONT and local-Y reflection swapping hand identity.

Accepted for Visual Gate:

### SEPARATE
- red left = authored red L
- red right = authored red R
- blue left = reflected red R + recolor
- blue right = reflected red L + recolor

### MIRROR-L
- all four variants derive from authored red L
- semantic hand identity is preserved through the documented reflection/double-reflection mapping.

### MIRROR-R
- all four variants derive from authored red R
- semantic hand identity is preserved likewise.

The TypeScript metadata and Python exporter tests enforce this mapping.

## Normalization Review

Accepted as technically sufficient for a Visual Gate:

- every candidate has explicit measured front/root/body-core values
- candidates are normalized independently rather than blindly reusing idle coordinates
- body-core diameter is held at 123.076923 px for all 12 gate textures
- each texture carries its own dimensions and pivot
- no limb warp / skeletal transformation is used.

The landmark-based normalization is a Visual-Gate measurement method, not yet a permanent Product art contract.

## Recolor Review

Accepted technically:

- current red->blue recolor rule remains owned by the accepted runtime recipe
- gate recipe does not duplicate that current rule
- alpha is preserved
- pixels outside the mawashi mask remain unchanged
- mask limits fail closed
- reported real-pose masks remain within the configured limits.

No evidence of gameplay or idle-art ownership leakage was found.

## Runtime / Mode Review

Accepted:

- key `4` cycles:
  - SEPARATE
  - MIRROR-L
  - MIRROR-R
- mode switch does not restart the Bout
- mode switch does not alter Snapshot state
- full Tsuppari action uses the selected held pose
- when Tsuppari ends, the accepted idle sprite returns
- Product Tsuppari art is not yet accepted.

## Verification Review

Reported:

- focused wrestler-art: 19 / 19 PASS
- full wrestler-art suite: 144 / 144 PASS
- focused presentation: 7 / 7 PASS
- pnpm test: 347 / 347 PASS
- pnpm build: PASS
- git diff --check: PASS
- deterministic re-export: PASS
- accepted idle runtime export check: PASS
- gameplay source diff: 0
- browser/runtime smoke: 38 / 38 PASS.

This is sufficient for Technical PASS.

## Important Visual Differences — User Must Decide

These are not technical blockers, but must NOT be silently accepted.

### MIRROR modes: head-side jump

The report measured that some mirror-derived poses flip the non-symmetric head/body placement relative to accepted idle.

Approximate visible shift:
- about 52 runtime px
- roughly 0.3 m in Product scale.

Therefore the User should specifically watch idle -> Tsuppari -> idle in:
- MIRROR-L right-hand cases
- MIRROR-R left-hand cases
- corresponding blue variants.

If the jump is visually distracting, the mirror strategy should be rejected even though it is technically valid.

### SEPARATE: asymmetric strike direction

Reported normalized hand direction:
- authored red Left: approximately straight ahead
- authored red Right: approximately +46 degrees to wrestler-right.

Therefore SEPARATE may look less symmetric between left/right, even though it avoids the mirror head jump.

This is a Visual Gate question, not something to auto-correct in tooling.

### Full-action pose hold

Current gate holds one pose through startup + active + recovery (~267 ms).

This is deliberately provisional.
User must judge whether:
- readable and satisfying
- too long/static
- or later should show only a smaller phase.

Do not change gameplay timing based only on this art hold.

## User Visual Gate

REQUIRED.

Recommended test:

1. `pnpm dev`
2. Enter
3. `0` for debug
4. `4` to cycle SEPARATE / MIRROR-L / MIRROR-R
5. ArrowLeft / ArrowRight for player Tsuppari
6. `3` for repeating dummy Tsuppari.

Judge:

- which of SEPARATE / MIRROR-L / MIRROR-R looks best
- left/right hand readability
- idle -> pose -> idle positional/body jump
- strike direction
- derived blue quality
- reach plausibility
- whether Tsuppari is now readable enough to judge rhythm/impact
- whether the full-action held pose is too long.

## Do Not Reopen

Unless explicitly requested:

- ACTION-07B gameplay formulas and current provisional push amounts
- ArrowLeft / ArrowRight hand semantics
- deterministic buildup rule
- Countered Tsuppari behavior
- accepted idle red-master art baseline
- authored blue candidates remaining reference-only for this gate.

## Next Task Constraint

Do not promote any gate texture/mode into `WRESTLER_PRODUCT_ART_SPEC.md` or the permanent runtime contract until the User selects a Visual-Gate result.

After User selection:
- promote only the accepted Tsuppari art strategy
- remove/retire temporary gate-only mode machinery as appropriate
- then perform a final runtime Play Test with the selected art.
