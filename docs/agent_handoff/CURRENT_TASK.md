Task-ID: ART-TOOL-01-DOHYO-COMPOSITOR
Status: REVIEWED
Task-Type: IMPLEMENTATION / ASSET-PRODUCTION TOOL / PYTHON IMAGE COMPOSITION
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 1c5b033addbb1adfb7fd19fc3c51b28a8bd96ca6
Handoff-Mode: GITHUB

# ART-TOOL-01 — Deterministic Dohyo Art Compositor

## Purpose

Create a small, reusable Python asset-production tool for SumoSim that deterministically builds:

- an exact-geometry `dohyo_ring_overlay`
- a geometry guide
- normalized Product background master
- master composite
- 1920×1080 runtime/review outputs

from:
- a User-approved `arena_base` image
- a User-approved tawara texture/source image

This tool is intended to be rerun many times while tuning:
- gameplay radius
- tawara width
- tawara texture
- ring texture repetition
- background source
- shikiri geometry

The goal is:
**AI / artist creates visual source material; Python owns exact geometry and deterministic composition.**

Do NOT implement this logic in Phaser.
This is an offline authoring tool only.

## Explicit Reference Permission

The User explicitly approved using:

`usuki-k/RobloxRts` branch `develop`, especially `tools/card_image/`

as a REFERENCE ONLY.

Relevant principles confirmed there:
- asset-production tools live outside runtime/gameplay
- AI/source art is separated from deterministic composition
- explicit CLI
- same inputs + same parameters -> same pixels
- fail closed instead of silently drawing placeholders
- tool-local requirements
- README with canonical commands
- focused automated tests
- review outputs are separate from runtime/gameplay

Do NOT copy Roblox/Card-specific architecture, classes, fonts, chrome logic, or its exact Pillow pin blindly.

SumoSim should get a much smaller explicit tool.

## Current Product Art Decisions

Accepted:

### Product art coordinate space
- runtime/review art space: **1920×1080**
- master art space: **3840×2160**
- 16:9

### Perspective
- strict top-down orthographic

### Exact gameplay geometry

Runtime:
- center: `(960, 540)`
- gameplay radius / tawara outer edge: `400 px`
- tawara inner edge: approximately `379 px`
- tawara width: `21 px`
- shikiri center X: `898`, `1022`
- shikiri center Y: `540`
- shikiri length: `140 px`
- shikiri width: `12 px`
- protected gameplay/presentation radius: approximately `532 px`

Master = exact ×2:
- canvas: `3840×2160`
- center: `(1920, 1080)`
- outer radius: `800 px`
- inner radius: `758 px`
- tawara width: `42 px`
- shikiri center X: `1796`, `2044`
- shikiri center Y: `1080`
- shikiri length: `280 px`
- shikiri width: `24 px`
- protected radius: approximately `1064 px`

These must be configurable by the offline tool so future changes do not require code edits.

### Accepted arena base

The User has visually accepted the current generated arena background direction.

Important:
- preserve the original accepted arena image before edits
- do not preemptively remove the broad central circular wear pattern
- first composite exact tawara over it
- only later apply a targeted background edit if User says the wear pattern competes with the gameplay boundary

### Tawara source

The User has generated a horizontal RGBA straw/tawara source image.

It is a visual texture source only.
It is NOT the final ring geometry.

The tool must convert the source texture into an exact annulus.

## Required Local Product Inputs — MUST EXIST BEFORE START

The User will place the two real Product source images inside the SumoSim working tree BEFORE the Agent starts.

Required paths:

```
tools/dohyo_art/input.local/arena_base.png
tools/dohyo_art/input.local/tawara_source.png
```

Meaning:
- `arena_base.png` = the User-approved Product arena background image
- `tawara_source.png` = the User-approved horizontal RGBA straw/tawara texture source

Important Git behavior:
- repository root `.gitignore` already contains `*.local`
- therefore the directory name `input.local` is intentionally ignored
- these Product source images are local authoring inputs and MUST NOT be staged/committed by this Task
- placing these files must still leave `git status --short` clean

After normal Remote-Task-First Git preflight succeeds, verify BOTH files exist and are readable before implementation.

If either file is missing/unreadable:
- STOP / BLOCKED
- do not substitute synthetic Product art
- do not proceed with Product composite verification

Synthetic temporary fixtures are still required for unit tests, but the real Product inputs MUST also be used for a real CLI smoke/composite in this Task.

The CLI must still support explicit input paths; do not hard-code these filenames into composition logic. The documented example may use these canonical local paths.

## Directory Permission

This Task explicitly authorizes creation of:

`tools/dohyo_art/`

Only for this dedicated asset-production tool.

Recommended minimal contents:

```
tools/dohyo_art/
  README.md
  requirements.txt
  compose_dohyo.py
  tests/
    test_compose_dohyo.py
```

A small helper module is allowed only if it materially improves clarity.

Do not create a broad generic art framework.

## Scope

Implement:

1. Python CLI
2. input validation
3. deterministic Product background normalization
4. exact annular tawara geometry
5. texture mapping around the annulus
6. exact shikiri lines
7. geometry guide
8. master composite
9. 1920×1080 downscaled outputs
10. deterministic build manifest
11. focused Python tests
12. README / usage instructions
13. tool-local Python dependency definition

## Scope Out

Do NOT:
- modify `src/`
- modify Phaser rendering
- integrate runtime assets
- change Gameplay / Ring-out rules
- alter HUD
- create wrestler assets
- use RobloxRts as a runtime dependency
- copy Roblox card-specific code
- create a generic image-processing framework
- commit User image inputs unless a later Task explicitly requests it
- modify accepted arena art automatically beyond normalization/crop/resize
- remove the center wear pattern
- use generative AI from the Python tool

## Tool Design

### CLI

Provide one explicit command, for example:

```bash
python tools/dohyo_art/compose_dohyo.py \
  --arena-base "/path/to/arena_base.png" \
  --tawara-source "/path/to/tawara_source.png" \
  --output-dir "/path/to/output"
```

Exact naming may vary slightly.

The CLI must expose the geometry/tuning values that are likely to change without code edits.

At minimum support:
- `--outer-radius` master-space px (default 800)
- `--tawara-width` master-space px (default 42)
- `--shikiri-offset-x` master-space px from center (default 124)
- `--shikiri-length` (default 280)
- `--shikiri-width` (default 24)
- tawara texture repetition/tiling tuning
- optional source-end trimming for the tawara source if needed to remove frayed ends
- master/output size should default to 3840×2160 but need not become a generic arbitrary-layout framework

Prefer clear named options rather than an opaque config system.

### Fail Closed

Invalid input must return non-zero and write no misleading final output.

Examples:
- arena missing/unreadable
- arena aspect materially incompatible with 16:9
- tawara source missing/unreadable
- invalid radius/width
- inner radius <= 0
- ring exceeds canvas
- invalid shikiri geometry
- output path collision/partial write concerns where relevant

Do not silently create placeholder art.

## Arena Base Normalization

The currently accepted arena source is very close to 16:9 but may not be exactly 3840×2160.

The tool should normalize it deterministically.

Requirements:
- preserve composition
- preserve aspect ratio
- no obvious non-uniform stretching
- accept very small aspect mismatch
- fail if mismatch is large enough that a material crop would be required

Recommended:
- validate input aspect against 16:9 with a small documented tolerance (for example ~0.2%, if justified)
- center-fit/crop only the tiny excess
- resize to exactly 3840×2160 with a high-quality deterministic filter

Do not hide a significant crop.

Output:
- `arena_base_master.png` — exact 3840×2160

## Tawara Texture Preparation

Requirements:
- preserve alpha
- crop transparent padding using the alpha bounding box
- reject an empty-alpha source
- do not assume the source dimensions
- allow controlled trimming of left/right source ends because generated straw may contain frayed ends
- prepare a horizontally repeatable texture deterministically

The source currently contains visible tied sections.
The tool should allow User iteration over texture repetition without code changes.

Do not assert one visually perfect repeat count as permanent.
Provide a documented default and CLI control.

## Exact Ring Mapping

Use a true polar/annular mapping, not a manually approximated polygon ring.

For every output pixel within the annulus:
- radius determines texture vertical coordinate
- angle determines texture horizontal coordinate
- horizontal texture repeats around 2π according to the configured repeat count

Requirements:
- exact circle center
- exact outer radius
- exact inner radius
- transparent everywhere outside the annulus, except shikiri lines
- anti-aliased ring edges
- deterministic sampling
- no visible geometry drift from texture dimensions

Implementation may use Pillow + NumPy if useful.

Do not add heavy CV/scientific dependencies unless genuinely required.

## Seam Handling

The full 360° texture wrap must not have an obvious hard seam at angle 0.

Implement one small deterministic strategy, such as:
- a horizontally seamless prepared texture,
- edge crossfade,
- mirror tiling,
- or equivalent.

Do not over-engineer procedural texture synthesis.

Expose only the small controls needed for likely visual iteration.

## Shikiri Lines

Draw shikiri lines deterministically in the exact master geometry.

Default:
- centers X = center ± 124
- center Y = 1080
- length = 280
- width = 24

Color:
- warm off-white / ivory appropriate for the accepted arena

The shikiri geometry must not be inferred from the AI image.

## Required Outputs

Default output directory should contain:

```
arena_base_master.png
dohyo_ring_overlay_master.png
geometry_guide_master.png
composite_master.png
dohyo_ring_overlay_1920.png
composite_preview_1920.png
build_manifest.json
```

### arena_base_master.png
- RGB/RGBA allowed
- exact 3840×2160
- normalized accepted arena input

### dohyo_ring_overlay_master.png
- RGBA
- exact 3840×2160
- transparent except:
  - tawara annulus
  - shikiri lines
  - very small/tightly controlled local shadow/edge treatment if implemented
- must NOT include arena/clay

### geometry_guide_master.png
Developer/art-production guide only.

Show clearly:
- canvas center
- outer gameplay radius
- inner tawara radius
- protected radius
- shikiri reference geometry
- optional initial participant centers

This image is not a runtime asset.

### composite_master.png
Exact alpha composite:
`arena_base_master + dohyo_ring_overlay_master`

### dohyo_ring_overlay_1920.png
Lossless downscale to 1920×1080.

### composite_preview_1920.png
Review image for User approval.

### build_manifest.json
Deterministic metadata only; no timestamp.

Include:
- tool/version/schema number
- input paths or basenames
- SHA-256 of input bytes
- source dimensions/modes
- normalized master dimensions
- center
- radius
- tawara width
- repeat count
- trim setting
- shikiri geometry
- resize/sampling mode
- output dimensions

Same inputs + same parameters + same canonical toolchain should produce identical decoded pixels.

## Optional Initial Participant Guide

Geometry guide may also show current participant center references:
- runtime x ≈ 960 ± 123, y = 540
- master x ≈ 1920 ± 246, y = 1080

This is reference/debug only.

Do not bake participant guides into the overlay or composite.

## Dependencies / Toolchain

Use a tool-local Python environment.

Likely dependencies:
- Pillow
- NumPy, only if used for vectorized polar mapping

Do not modify Node `package.json` / `pnpm-lock.yaml`.

Before choosing pins:
- inspect Agent Python version
- choose versions compatible with that Python
- pin the versions actually used for verification in `tools/dohyo_art/requirements.txt`

Do NOT blindly copy RobloxRts's `Pillow==9.5.0`; its pin exists for Roblox card-specific historical byte contracts.

README must show:
- venv creation
- requirements install
- tool command
- test command
- verified Python / library versions

A local venv should not be committed.

If Python is missing or a compatible minimal toolchain cannot be established, STOP/BLOCKED.

## Determinism

Within the verified toolchain:

- no random numbers
- no timestamps in generated pixels/manifest
- no machine-dependent font usage
- no metadata that changes per run
- same inputs / args -> same decoded pixels and same manifest content except absolute input paths should preferably be normalized to basenames or stable relative values

Tests should compare deterministic pixel data/hashes where practical.

## Tests

Use stdlib `unittest` unless there is a strong reason otherwise.

Synthetic fixtures must be generated in temporary directories during tests and must never become Product art.

At minimum test:

1. CLI/library composition succeeds from synthetic valid inputs
2. master output dimensions = 3840×2160 (a reduced test geometry may be used internally for speed if the same functions are covered)
3. preview output dimensions = 1920×1080
4. ring center/radius are correct
5. pixels outside outer radius are transparent in overlay
6. pixels inside inner radius are transparent except shikiri
7. annulus has visible alpha
8. shikiri lines are at exact configured positions
9. alpha is preserved
10. source transparent padding crop works
11. invalid/empty tawara alpha fails
12. materially wrong arena aspect fails
13. invalid geometry fails
14. same inputs/parameters produce deterministic identical pixels
15. manifest contains the exact geometry/parameters
16. no dependency on Phaser / TypeScript / gameplay source

Avoid visual-golden tests that are fragile to irrelevant compression metadata.
Prefer decoded pixel assertions/hashes.

## Visual Quality / User Gate

Automated tests verify geometry and determinism, NOT whether the tawara looks good.

After the tool is implemented:

User will run it with the accepted real:
- arena base
- tawara source

and inspect `composite_preview_1920.png`.

Likely visual tuning controls:
- repeat count
- source end trim
- potentially tawara width

The User may rerun the tool several times.

This is expected and is the reason the tool exists.

Technical PASS != Product visual acceptance.

## README

Document:

- Purpose
- architecture:
  `AI/Artist Sources -> Deterministic Geometry/Composition -> Review/Runtime Assets`
- relationship to gameplay (none; offline only)
- install
- CLI example
- defaults
- all output files
- how to iterate repeat/trim/radius/width
- how to compare preview
- fail-closed behavior
- tests
- note that the center wear pattern in arena base is intentionally NOT edited by this tool
- note that actual Product inputs are supplied by file path and are not bundled with the tool

## Verification Level

Standard for the asset tool, no game-runtime changes.

Required:
- Python unit tests for the tool
- one CLI smoke using synthetic inputs
- deterministic rerun comparison
- `git diff --check`
- confirm no `src/` changes
- confirm no package/lock changes
- confirm no User images accidentally committed
- README commands verified

`pnpm test` / `pnpm build` are not required unless TypeScript/Node files are unexpectedly touched; they should not be.

## Implementation Evidence

Completion Report must include:

- Tool architecture
- Reference from RobloxRts used only as design guidance
- Changed files
- CLI contract
- exact default geometry
- image mapping approach
- seam strategy
- output list
- dependency versions
- deterministic evidence
- tests
- real Product inputs available/not available
- User visual check status

## Design Deviations

Required.

If none:
`Design Deviations: NONE`

If mapping/seam/dependency approach differs from this Task:
- Planned
- Implemented
- Reason
- Product semantics affected?

Do not change accepted gameplay geometry silently.

## Unexpected Scope

Report only.
Do not fix unrelated issues.

## Git Delivery

Follow AGENTS.md.

Task-owned files only:
- `tools/dohyo_art/**`
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

One Task ≈ one commit.

Suggested commit:
`tools: add deterministic dohyo art compositor`

Push `origin/develop`.
Do not modify `main`.

## User Play / Visual Test

No gameplay Play Test required.

**Product Visual Check: REQUIRED AFTER TOOL IMPLEMENTATION**, using the real accepted images supplied by the User.

The real Product inputs are a prerequisite for this Task.

Required real run:
- use `tools/dohyo_art/input.local/arena_base.png`
- use `tools/dohyo_art/input.local/tawara_source.png`
- generate the real Product composite outputs
- report exact output paths and dimensions

If the real inputs are absent, the Task is BLOCKED rather than PASS.

Do not claim Product visual acceptance automatically: after the real composite is generated, User visual approval is still REQUIRED.

## Final Instruction

Stop after implementing and verifying the reusable Python compositor.

Do not integrate outputs into Phaser.
Do not begin HUD.
Do not alter gameplay.

After commit/push/report:
「ART-TOOL-01-DOHYO-COMPOSITOR が完了し、ChatGPT Reviewと実画像Composite確認待ちです」


## Local Input Setup — User Preparation

Before sending the Agent start instruction, the User should place the real images exactly here:

```
SumoSim/
  tools/
    dohyo_art/
      input.local/
        arena_base.png
        tawara_source.png
```

It is acceptable that `tools/dohyo_art/` does not yet contain the implementation files; the ignored `input.local/` directory may be created first.

Expected:
`git status --short` remains empty because `input.local` matches the existing `*.local` ignore rule.

Do not rename, move, delete, stage, or commit the files in `input.local/`.


# Final ChatGPT Review

Overall Result: TECHNICAL PASS / PRODUCT VISUAL CHECK REQUIRED

## Reviewed Delivery

- Implementation commit:
  `3dff5c7aa3c080a8578dc8eab835eccdc4a23373`
- Agent-Start-Head:
  `117c158ef0726c697e3dbe573a4328d13bdd6739`
- Task diff is one implementation commit.
- Changed production scope is limited to:
  - `tools/dohyo_art/**`
  - `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- no `src/` changes
- no Node package/lock changes
- User Product inputs remain under ignored `input.local/`.

## Technical Assessment

PASS.

Direct source review confirms the intended architecture:

```
AI / artist source images
        ↓
offline Python tool
        ↓
exact deterministic geometry / composition
        ↓
review/runtime image outputs
```

The tool has no Phaser/TypeScript/gameplay dependency.

## Accepted Tool Baseline

Accept `tools/dohyo_art/` as the SumoSim-specific offline Product-art compositor.

Accepted characteristics:
- explicit CLI
- explicit local input paths
- deterministic output
- exact annular geometry
- exact shikiri geometry
- Product arena normalization
- geometry guide
- master + 1920 preview outputs
- manifest with input hashes / parameters / output pixel hashes
- tool-local Python requirements
- focused synthetic tests
- real Product-input smoke run.

This follows the useful RobloxRts asset-tool principle without importing Roblox/Card-specific architecture.

## Geometry Review

PASS.

Default master geometry matches the accepted current Product-art contract:

- canvas: 3840×2160
- center: (1920,1080)
- tawara outer/gameplay radius: 800 px
- tawara width: 42 px
- inner radius: 758 px
- shikiri centers: x=1796 / 2044, y=1080
- shikiri length: 280 px
- shikiri width: 24 px.

The 1920 outputs are exact half-scale equivalents.

The ring is generated mathematically from the center/radii rather than inferred from the AI art.

## Mapping Review

PASS.

The horizontal RGBA tawara source is:
- alpha-cropped,
- optionally end-trimmed,
- made periodically tileable through a deterministic seam crossfade,
- resampled with premultiplied alpha,
- polar-mapped onto the exact annulus.

This is materially better than trying to generate a mathematically exact ring with image generation.

## Arena Normalization Review

PASS for the intended use.

The accepted 1672×941 arena is close enough to 16:9 to normalize through a tiny centered crop and uniform resize.

The tool correctly refuses materially incompatible aspect ratios instead of silently stretching/cropping them.

Important:
normalization does NOT attempt to move/repaint the arena contents.

## Verification Review

Reported verification is sufficient for the offline tool:

- Python unit tests: 25 PASS
- synthetic full-size CLI smoke
- real Product-input CLI run
- deterministic rerun:
  - manifest byte-identical
  - all six PNG outputs SHA-identical
- geometry/alpha/shikiri assertions
- invalid-input fail-closed cases
- no Product source images committed
- ignored local inputs/outputs confirmed
- `git diff --cached --check` PASS.

No `pnpm test` / `pnpm build` is required because runtime/TS code is untouched.

## Non-Blocking Technical Note — Output replacement atomicity

The implementation stages all files first and then replaces final files one by one.

This is adequate for the local authoring tool.

Strictly speaking, an OS/filesystem failure during the final sequence of `os.replace` calls could leave a partially updated output set.

Do not expand this Task to solve that theoretical case.
If this tool later becomes CI/release-critical, directory-swap/versioned-output hardening can be considered separately.

## Product Visual Gate — STILL OPEN

Technical PASS does NOT mean the generated Product composite is visually accepted.

The real output to inspect is:

`tools/dohyo_art/output.local/composite_preview_1920.png`

Two visual risks must be judged from the actual preview.

### V1 — Arena art center vs exact gameplay center

The Agent reports that the painted square dohyo/platform in the accepted arena source appears slightly above the exact canvas center.

The Python ring is correctly centered at gameplay center.

Therefore the exact ring may visually sit too low relative to:
- the painted platform,
- surrounding stone/clay border,
- existing central wear pattern,
- lower decorative/tawara-like elements in the generated arena.

This is NOT a geometry bug in the Python tool.

Do not change gameplay center to fit the painting.

If the composite looks misaligned, choose a Product-art correction:
- targeted arena-base alignment/edit,
- or add an explicit deterministic arena-art offset/normalization option in a small follow-up tool task.

Do not silently move the gameplay ring.

### V2 — Tawara repetition density

`--repeat auto` resolves to 18 for the current source.

The current horizontal source itself already contains several tied sections.

Therefore the final circle may contain too many visible binding bands / repeated motifs.

This is a visual tuning question, not a technical correctness problem.

If it looks too dense:
- try explicit `--repeat N`,
- or prepare a better single/repeatable tawara source strip.

Do not change the mapping algorithm just because the first texture frequency is visually imperfect.

## Required User Visual Check

Please inspect or upload:

`tools/dohyo_art/output.local/composite_preview_1920.png`

Optional diagnostic:
`tools/dohyo_art/output.local/geometry_guide_master.png`

Evaluate:

1. Does the exact tawara sit naturally on the painted dohyo/platform?
2. Is the ring visually centered where the background says the dohyo center is?
3. Does the lower edge collide with painted structural/decorative elements?
4. Does the broad circular wear mark help or compete with the exact ring?
5. Are there too many rope/binding repetitions?
6. Does the ring texture look naturally curved rather than mechanically warped?
7. Are shikiri lines believable in the painted environment?
8. Is the overall result Product-quality enough to lock the background?

## Acceptance State

Tool implementation: ACCEPTED.
Deterministic geometry/composition architecture: ACCEPTED.
Current Product composite appearance: PENDING USER VISUAL CHECK.

Do not integrate into Phaser yet.
Do not start HUD yet.

## Next Step

If the composite is visually good:
- lock the Product background master,
- then create ACTION-ART-01B background/runtime integration.

If geometry is correct but the painted arena is misaligned:
- first perform a focused arena-art alignment correction.

If only tawara repetition/trim is wrong:
- rerun the existing tool with tuned CLI parameters; no implementation task is necessarily needed.

If the central wear circle competes with the exact ring:
- make one targeted/non-destructive arena-base edit only after seeing the composite.
