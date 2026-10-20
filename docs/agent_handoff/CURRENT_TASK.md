Task-ID: ART-TOOL-02-TOKUDAWARA-PREVIEW
Status: READY
Task-Type: IMPLEMENTATION / ASSET-PRODUCTION TOOL / TOKUDAWARA PRODUCT PREVIEW
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 791fb16b1934a68d2840404809d1e17d32e70904
Handoff-Mode: GITHUB

# ART-TOOL-02 — Tokudawara Product Geometry Preview

## Purpose

Extend the offline deterministic `tools/dohyo_art/` compositor so it can render exact four-section Tokudawara geometry and produce real Product composite previews.

This Task exists to visually choose the Product Tokudawara geometry BEFORE changing gameplay Ring-out logic.

No gameplay implementation in this Task.

User-approved direction:
- Level 2 is the intended destination:
  visual Tokudawara + Tokudawara-aware Ring-out
- first choose the visible geometry using the real Product arena
- then implement the same geometry in Pure TypeScript Ring-out core

## Current Accepted Baseline

### Arena / background
Accepted Product arena source and alignment remain:

```
--arena-scale 1.072
--arena-offset-x 5.36
--arena-offset-y 77.72
```

Do not silently replace these accepted alignment values.

### Product art space
Master:
- 3840×2160
- center (1920,1080)
- base gameplay radius / normal tawara outer edge = 800 px
- tawara width = 42 px

Runtime/review:
- 1920×1080
- center (960,540)
- base gameplay radius = 400 px
- tawara width = 21 px

### Real local Product inputs

Required before start:

```
tools/dohyo_art/input.local/arena_base.png
tools/dohyo_art/input.local/tawara_source.png
```

These are ignored local files and must not be committed.

### Current Product output/tool
- deterministic compositor accepted
- arena alignment tool accepted
- current circular exact overlay accepted technically
- gameplay remains circular during this Task

## Critical Investigation Review Correction

The previous Tokudawara Investigation is accepted with one material correction for later gameplay implementation:

Tokudawara Ring-out must eventually use the **earliest IN→OUT crossing** along canonical fixed-tick P0→P1 interpolation.

Do not implement this in this Task, but keep the visual geometry compatible with that later boundary.

## Scope

Implement Product Tokudawara preview support in `tools/dohyo_art/`.

Required:

1. exact Tokudawara geometry parameters
2. deterministic four-cardinal visual geometry
3. reuse the existing tawara texture source
4. exact overlay generation
5. exact geometry guide
6. manifest recording
7. CLI controls
8. focused tests
9. real Product composite previews
10. controlled visual candidate comparison for User decision

## Scope Out

Do NOT:
- modify `src/`
- modify Ring-out gameplay
- modify BoutTypes/BoutSimulation/ringOut
- integrate Product background into Phaser
- begin HUD
- begin wrestler Product art
- regenerate arena_base with AI
- repaint central wear marks
- implement wall/collision/edge physics
- implement foot-touch / ground-touch Ring-out
- introduce shared JSON geometry infrastructure
- alter accepted arena alignment automatically

## Tokudawara Product-v1 Geometry Model

Use the approved minimal visual abstraction:

- four identical Tokudawara sections
- cardinal directions:
  - +X
  - +Y
  - -X
  - -Y
- base normal boundary radius = R
- each Tokudawara section occupies an angular window:
  `|angle - k·π/2| <= halfAngle`
- within that window, the tawara section is shifted outward by `depth`
- normal ring is absent within the Tokudawara window
- side transitions connect normal and shifted sections cleanly

Product visual should read as:
- mostly circular tawara
- four local bales/sections offset outward
- not four large rectangular protrusions
- not a smooth inflated four-lobed circle.

Do not model construction detail beyond what is needed for readable Product art.

## First Candidate Geometry

The first Product candidate must use:

- depth = **42 master px**
  - one current tawara visual width
  - runtime = 21 px
  - approximately 0.12 m under the current art/game scale
- halfAngle = **9 degrees**
  - full Tokudawara angular span = 18 degrees

These are CANDIDATE values, not final accepted gameplay constants.

The User will decide after seeing previews.

## CLI

Extend the existing CLI with small explicit controls.

Recommended:

```
--tokudawara-depth PX
--tokudawara-half-angle-deg DEG
```

Semantics:
- depth = 0 means Tokudawara disabled / existing circular output
- positive depth enables four identical cardinal Tokudawara
- half angle required/validated when enabled

Exact naming may differ slightly if clearer.

Do not add a generic shape/config framework.

## Backward Compatibility

This is critical.

With Tokudawara disabled:
- circular overlay output must remain pixel-identical to the accepted pre-Task compositor for the same inputs/args
- geometry guide behavior should remain unchanged unless an explicitly documented guide-only rendering change is unavoidable
- existing CLI calls remain valid

Preferred:
- default Tokudawara = disabled

Product Tokudawara commands pass the parameters explicitly.

## Geometry / Visual Construction

The exact visual boundary should correspond to the future gameplay boundary.

For each cardinal window:

### Normal section
Outside Tokudawara windows:
- tawara outer edge remains at R
- tawara inner edge remains at R - width

### Tokudawara section
Within window:
- tawara outer edge = R + depth
- tawara inner edge = R + depth - width

### Side connection
At each window side:
- connect the shifted tawara section back to the normal tawara without leaving a visual gap
- preserve exact deterministic geometry
- the visible connection must correspond to the future radial side boundary between allowed R and R+depth

Use the smallest deterministic raster approach.

Possible implementation:
- exact mask based on folded/cardinal angle classification and analytic/pixel coverage
- separate side connector geometry
- reuse current polar-mapped texture for each section

Do NOT use a generic vector/path dependency.

## Texture Mapping

Reuse:
`input.local/tawara_source.png`

The texture should remain coherent around:
- normal circular sections
- shifted Tokudawara sections
- side connectors.

Do not require a new AI asset for the first preview.

Small deterministic texture-phase choices are allowed.

Expose a texture-phase/repeat control only if actually necessary for visual iteration.

Do not broaden into a full procedural rope system.

## Geometry Guide

Update `geometry_guide_master.png` when Tokudawara is enabled.

It must clearly show:
- base R
- Tokudawara outer boundary
- Tokudawara side boundaries
- center
- existing protected region / participant references as appropriate

Purpose:
verify future visual/gameplay correspondence.

Do not add text/font dependencies.

## Manifest

Increase manifest schema only if required by the output contract.

Record Tokudawara values explicitly, for example:

```json
"tokudawara": {
  "enabled": true,
  "count": 4,
  "depth": 42,
  "half_angle_deg": 9,
  "directions": "cardinal"
}
```

No timestamps.

Same inputs/args/toolchain -> same pixels + same manifest.

## Product Visual Constraint Discovered Previously

Current accepted arena alignment has limited lower clearance.

Previous Investigation estimated:
- lower clearance from circular ring outer edge to inner painted frame is much smaller than upper/side clearance
- one full tawara-width outward Tokudawara may visually overlap lower painted structure.

This Task must test this using real composites.

Do NOT decide from estimates alone.

## Required Controlled Product Previews

Use the real Product inputs.

Generate at least the following controlled previews locally.

### Candidate A — Full one-bale depth / accepted alignment

Geometry:
- depth 42 master px
- halfAngle 9°
- accepted arena alignment:
  - scale 1.072
  - offset x 5.36
  - offset y 77.72

This is the primary candidate.

### Candidate B — Maximum visually safe depth with accepted alignment

Only if Candidate A materially overlaps/collides with the painted inner frame:

- keep halfAngle 9°
- keep accepted arena alignment unchanged
- derive a smaller depth that preserves a small visible buffer from the painted frame
- report the measurement method and chosen depth
- do NOT automatically accept it

If Candidate A does not materially collide, Candidate B is optional.

### Candidate C — Full one-bale depth with minimal alternate alignment

Only if Candidate A materially collides and Candidate B makes Tokudawara visually insignificant:

- retain depth 42 / halfAngle 9°
- derive the smallest uniform arena re-alignment/zoom needed to fit it
- generate ONE alternate preview
- do not overwrite or redefine the accepted alignment
- report exact alternative transform for User comparison

Do not create a large parameter grid.
Maximum expected Product variants: 3.

## Output Directories

Use ignored local review directories.

Recommended:

```
tools/dohyo_art/output-tokudawara-a.local/
tools/dohyo_art/output-tokudawara-b.local/
tools/dohyo_art/output-tokudawara-c.local/
```

Only generate directories that are actually needed.

Each candidate should contain the normal compositor outputs including:
- overlay master
- geometry guide
- composite master
- 1920 overlay
- 1920 composite preview
- manifest

Do not commit PNG outputs.

## Visual Acceptance Questions

For Candidate A and any fallback candidate, evaluate:

1. Does it clearly read as Tokudawara?
2. Do all four extensions look symmetric and intentional?
3. Is the outward amount visually meaningful?
4. Does the lower Tokudawara collide with the painted frame/decor?
5. Do upper/left/right sections fit naturally?
6. Does the current circular wear pattern still look acceptable?
7. Does the tawara texture warp unnaturally at the side connectors?
8. Are there visible gaps/overlaps/seams?
9. Does the exact geometry still feel like a real sumo dohyo rather than a four-lobed game shape?
10. Is the geometry suitable to become gameplay Ring-out SoT next?

Agent visual judgment is provisional only.
User Visual Approval is REQUIRED.

## Tests

Extend the Python test suite.

At minimum:

1. disabled Tokudawara reproduces previous circular overlay pixel hash for same synthetic input
2. four cardinal Tokudawara are present
3. symmetry X mirror
4. symmetry Y mirror
5. symmetry x↔y where texture-phase does not intentionally break RGB; alpha geometry must be symmetric
6. normal-section outer radius remains R
7. Tokudawara center-line outer radius is R+depth
8. Tokudawara inner edge is R+depth-width
9. side connections contain no alpha gap
10. no unintended tawara remains at base R inside the Tokudawara window
11. outside overlay remains transparent
12. shikiri geometry remains unchanged
13. arena alignment does not affect overlay geometry
14. manifest records Tokudawara exactly
15. depth=0 behaves as disabled
16. invalid depth / halfAngle fail closed
17. deterministic rerun identical
18. full-size CLI smoke
19. existing compositor/alignment tests remain PASS

Test all four sections; do not sample only one.

## Validation Rules

When enabled:
- depth finite and > 0
- halfAngle finite
- 0 < halfAngle < π/4
- depth must not make geometry exceed the master canvas
- tawara width remains valid
- side connectors must remain non-degenerate.

If disabled:
- legacy circle behavior.

## Documentation

Update `tools/dohyo_art/README.md`.

Document:
- Tokudawara purpose
- visual geometry
- candidate vs final values
- CLI options
- canonical Candidate A command
- how to compare candidate previews
- no gameplay rule is changed by this tool
- later Simulation implementation must use the User-approved geometry
- accepted arena alignment remains separate from Tokudawara geometry

## Verification Level

Standard for offline Product-art tool.

Required:
- full Python test suite
- real Product Candidate A run
- deterministic rerun comparison for A
- Candidate B/C only under the conditions above
- verify no `src/` changes
- no package/lock changes
- no Product images committed
- `git diff --check`
- output dimensions verified
- manifest verified.

`pnpm test` / `pnpm build` are not required because runtime code must not change.

## Completion Report

Include:

- Result
- Preflight
- changed files
- implemented Tokudawara geometry
- CLI contract
- backwards-compatibility evidence
- exact Candidate A parameters
- real Product Candidate A output paths
- Candidate A visual assessment
- whether lower-frame collision actually occurs
- Candidate B/C parameters and outputs if generated
- tests
- deterministic evidence
- geometry symmetry evidence
- manifest changes
- Product Visual Check REQUIRED
- recommended User choice based on previews, but do not mark accepted
- Design Deviations
- Unexpected Scope
- Verification
- Git delivery

## Stop Conditions

STOP/BLOCKED if:
- exact four-section geometry cannot be rendered without redesigning the compositor broadly
- the accepted tawara source cannot make a visually coherent Tokudawara without a new art asset
- Candidate A requires a destructive arena repaint
- current accepted arena cannot accommodate any meaningful Tokudawara even with a modest alternate alignment
- Product inputs are missing
- Current Source conflicts materially with the reviewed Investigation

Do not solve by changing gameplay geometry.

## Git Delivery

Follow AGENTS.md.

Task-owned repository files:
- `tools/dohyo_art/**` implementation/docs/tests
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

Do NOT commit:
- `input.local/**`
- any `output*.local/**`
- Product PNG sources/outputs

Suggested commit:
`tools: add tokudawara product preview`

Push `origin/develop`.
Do not modify `main`.

## User Visual Gate

Gameplay Play Test: NOT REQUIRED.

Product Visual Approval: REQUIRED.

After implementation the User should inspect:
- Candidate A `composite_preview_1920.png`
- any Candidate B/C preview produced

The User will decide:
- final Tokudawara depth
- final halfAngle
- whether accepted arena alignment remains
- which geometry proceeds into Ring-out core.

## Final Instruction

Stop after Product Tokudawara preview generation and technical verification.

Do NOT implement Ring-out gameplay.

Do NOT integrate into Phaser.

Do NOT begin HUD or wrestler Product art.

After commit/push/report:
「ART-TOOL-02-TOKUDAWARA-PREVIEW が完了し、ChatGPT ReviewとUser Product Visual Approval待ちです」
