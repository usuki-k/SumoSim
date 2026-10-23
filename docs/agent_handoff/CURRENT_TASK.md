Task-ID: ACTION-11F-GRIP-SUCCESS-PAIR-COMPRESSION-TUNE
Status: READY
Task-Type: PRESENTATION VISUAL TUNE
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 97ef733bbad7cebdcdbc3d64621ff5909574354d
Review-Handoff: ACTION-11E technical PASS at 97ef733bbad7cebdcdbc3d64621ff5909574354d; User Visual Gate rejected lateral-only 0.30R because the pair looked less tightly engaged than before
Handoff-Mode: GITHUB

# ACTION-11F — Grip Success Pair Compression Tune

## Purpose

Improve the Grip-success pair silhouette after the ACTION-11E User Visual Gate.

User feedback:

> ACTION-11Eの左右ずらしだけでは少し変に見える。  
> 組む前の方が密着感があり、組んでいるように見える。  
> 互いをずらしつつ、2人の画像がめり込むくらい密着させたい。  
> 画像が重なってもよく、重なった部分はどちらか片方が見えていればよい。

The fix must remain **presentation-only**.

Do not change canonical Simulation positions, grapple bond distance, collision, facing or gameplay.

---

# Current Baseline

ACTION-11E currently uses:

```
GRIP_SUCCESS_LATERAL_OFFSET_R = -0.30
```

while visual pose is:

```
grapple
or
drive
```

This shifts each wrestler to its own LEFT.

Technical behavior is accepted, but User rejected the visual result because:
- heads are offset
- but the pair looks too separated / less tightly engaged.

The current canonical gameplay bond remains:

```
0.70 m
```

Do not change it.

---

# New Visual Direction

Replace the current lateral-only offset with a 2-component presentation offset:

1. smaller lateral shift
2. inward / forward compression toward the opponent.

Use the wrestler's own local frame:

- local +X = FRONT / canonical facing
- local +Y = wrestler RIGHT
- local -Y = wrestler LEFT.

Initial Visual Gate values:

```
GRIP_SUCCESS_FORWARD_OFFSET_R = +0.14
GRIP_SUCCESS_LATERAL_OFFSET_R = -0.20
```

Meaning:

- each wrestler is drawn 0.14 R forward, toward the opponent
- each wrestler is drawn 0.20 R to its own left.

For a face-to-face settled grapple:
- the forward terms move both sprites inward toward each other
- their rendered bodies may overlap
- overlap is intentional
- canonical Simulation centers remain unchanged.

These are provisional visual tuning values, not gameplay values.

Do not change them automatically after implementation unless a clear technical defect exists.

User Play Test owns visual acceptance.

---

# Presentation Offset Formula

Prefer one small pure presentation helper.

Conceptually:

```
forwardPx = GRIP_SUCCESS_FORWARD_OFFSET_R * R
lateralPx = GRIP_SUCCESS_LATERAL_OFFSET_R * R

worldOffset =
  facingForward * forwardPx
  +
  facingRight * lateralPx
```

For facing angle `f`:

```
forward = (cos(f), sin(f))
right   = (-sin(f), cos(f))
```

Therefore:

```
x = forwardPx * cos(f) - lateralPx * sin(f)
y = forwardPx * sin(f) + lateralPx * cos(f)
```

Equivalent correct math is acceptable.

Use the same local-axis convention already used by ACTION-11E / Kuzushi presentation.

---

# Exact Application Scope

Apply the new combined offset only while the Grip-success pose is shown:

```
state.pose === 'grapple'
|| state.pose === 'drive'
```

Required:

- neutral grapple -> combined offset
- Morozashi holder -> combined offset
- Morozashi disadvantaged -> combined offset
- Drive -> combined offset.

Offset must be zero for:

- Grip attempt / reach
- Grip recovery
- idle
- move
- Push
- Tsuppari
- Counter
- Kuzushi
- after release.

Do not change texture selection.

---

# Overlap Is Allowed

The User explicitly accepts visual overlap.

Required visual intent:

- shoulders / chest / arms may overlap substantially
- bodies may visually interpenetrate
- the pair should read as tightly engaged rather than carefully separated
- overlap is presentation only.

Do NOT:
- push canonical centers apart
- change collision
- change grapple bond
- change bodyRadius
- change sprite scale.

If one sprite visually covers part of the other, that is acceptable.

---

# Draw Order

Do not add new draw-order logic unless necessary.

First use the existing stable scene/body ordering.

Browser smoke must check:

- no frame-to-frame flicker where overlap occurs
- no unstable alternating top sprite.

If existing order is stable:
- leave it unchanged.

If actual runtime inspection proves overlap order visibly flickers:
- STOP and report before adding a broader depth/z-order system.

Do not add generic layer management.

---

# Body and Shadow

As in ACTION-11E:

- body receives the combined display offset
- procedural shadow receives the same combined display offset
- shadow's existing relative shadow offset remains unchanged.

Do not offset:
- gameplay position
- debug/canonical collision geometry
- Simulation Snapshot
- Kuzushi sweat.

The success pose and Kuzushi do not coexist, so sweat remains unchanged.

---

# Grip Success Art

Preserve ACTION-11D success assets exactly.

Do not modify:

```
public/assets/action/wrestler/grip-success-gate/red.png
public/assets/action/wrestler/grip-success-gate/blue.png
```

Do not change:
- source image
- exporter
- recipe
- pixel hashes
- pivot
- scale
- red/blue derivation.

This Task changes transforms only.

---

# Grip Attempt Art

Preserve ACTION-11A exactly.

Attempt pose must remain at canonical display position:

```
Grip reach
-> attempt texture
-> display offset = 0
```

The success compression must begin only after grapple is established.

---

# Gameplay Baseline — Do Not Reopen

ACTION-11C was accepted by User Play Test.

Do not change:

```
GRIP_REACH_TICKS = 8
GRIP_MIN_ATTEMPT_TICKS = 4
GRIP_RECOVERY_TICKS = 12
```

Preserve:

- Grip lunge
- actual-contact Grip success
- Tsuppari > Grip
- Push impact > Grip
- Grip > Counter
- Grip vs Grip neutral
- Kuzushi -> Morozashi
- 0.70 m canonical grapple bond
- Grappled Orientation
- Drive
- release.

No `src/game/sumo/` or `src/game/input/` Production change is allowed.

---

# Grappled Orientation / Turning

ACTION-11E did not visually inspect turning.

ACTION-11F must inspect it because the new forward component depends on each wrestler's current facing.

Required smoke scenarios:

1. normal front-facing neutral grapple
2. grapple where one participant begins TURNING after a side/rear situation if practical with current fixtures
3. settled READY grapple after turning.

Judge only presentation correctness:

- offset follows each participant's current canonical facing
- no sudden sideways teleport unrelated to facing change
- pair does not visually explode apart during turning
- gameplay positions remain canonical.

Do not add a turning-specific special-case unless a clear visual break is observed.

If turning is materially broken:
- STOP and report
- do not redesign Grappled Orientation inside this Task.

---

# Release

When grapple ends:

```
grapple / drive
-> FREE
```

the combined success offset becomes zero immediately.

This means each displayed sprite returns to its canonical display center on the same frame that success art is removed.

This is allowed for this Visual Gate.

Do not add easing/interpolation yet.

User Play Test will judge whether the snap is noticeable.

---

# Preferred Pure API

Update the existing helper rather than adding another overlapping Source of Truth.

Current helper:

```
gripSuccessDisplayOffsetPx(...)
```

Preferred:
- keep the same helper
- extend it from lateral-only to forward+lateral.

Add one new constant:

```
GRIP_SUCCESS_FORWARD_OFFSET_R = 0.14
```

Change:

```
GRIP_SUCCESS_LATERAL_OFFSET_R
-0.30 -> -0.20
```

Do not create separate helpers for x/y or red/blue.

---

# Required Tests

At minimum verify:

## Pure Geometry

P1. success pose gets forward +0.14 R.

P2. success pose gets lateral -0.20 R.

P3. offset magnitude/components rotate correctly with arbitrary facing.

P4. forward component is along canonical facing.

P5. lateral component is perpendicular to facing and to wrestler LEFT.

P6. non-success poses return exactly zero.

P7. two face-to-face wrestlers receive opposite world-space forward offsets.

P8. two face-to-face wrestlers receive opposite world-space lateral offsets.

P9. pair display midpoint remains unchanged for exact opposite facings.

## State Scope

S1. grapple -> combined offset.

S2. drive -> combined offset.

S3. neutral -> combined offset.

S4. Morozashi holder -> combined offset.

S5. Morozashi disadvantaged -> combined offset.

S6. attempt -> zero.

S7. release recovery -> zero.

S8. idle/Push/Tsuppari/Counter/Kuzushi -> zero.

## Ownership

O1. Snapshot is unchanged by helper/selector.

O2. canonical participant positions remain 0.70 m apart in grapple.

O3. WrestlerView applies offset only to body/shadow display position.

O4. no src/game/sumo gameplay semantic change.

O5. no asset/tooling change.

---

# Browser / Runtime Smoke

Required.

At minimum verify:

1. Enter starts Bout
2. Grip attempt remains unshifted
3. neutral Grip success switches to success pose + combined offset
4. pair appears more compressed than ACTION-11E
5. visible sprite overlap is allowed and stable
6. heads remain laterally offset rather than returning nose-to-nose
7. shoulders/chests visibly interpenetrate enough to read as tight grapple
8. body/scale/pivot unchanged
9. shadow remains under its displayed body
10. Simulation/debug canonical centers remain at 0.70 m
11. Drive preserves combined offset
12. Morozashi preserves combined offset
13. release removes combined offset immediately
14. later Grip attempt still uses zero offset
15. Push/Tsuppari/Counter/Kuzushi remain zero-offset
16. Grappled Orientation turning is visually inspected
17. no new console/runtime errors.

Capture screenshots/crops for:

- neutral immediately after success
- neutral settled
- Drive
- Morozashi
- release
- turning, if reproducible.

---

# User Visual Gate

REQUIRED.

Primary question:

> Does reducing the lateral shift and moving both success sprites inward make the wrestlers look tightly interlocked rather than separated?

Judge:

- bodies look intentionally overlapped / compressed
- heads remain offset toward shoulders
- amount of overlap feels natural
- `-0.20 R lateral` is enough but not too much
- `+0.14 R inward` creates enough density
- Drive remains readable
- Morozashi remains acceptable
- release snap is acceptable
- turning does not look broken.

If overlap is still insufficient:
- next tune should change only `GRIP_SUCCESS_FORWARD_OFFSET_R` first.

If lateral separation is still wrong:
- tune `GRIP_SUCCESS_LATERAL_OFFSET_R` separately.

Do not immediately add rotation/new source art.

---

# Scope

## In Scope

- replace ACTION-11E lateral-only transform with forward+lateral transform
- tune provisional constants to +0.14 R / -0.20 R
- pure helper/tests
- WrestlerView body/shadow presentation
- browser visual verification
- turning visual inspection.

## Scope Out

Do NOT:

- change gameplay
- change canonical position/bond
- change facing
- change Grip success/attempt assets
- change exporter/recipe
- add hand VFX
- add rotation
- add scale animation
- add easing
- add new pair state
- add draw-order framework
- promote Product art
- modify PROJECT_HANDOFF.md.

---

# Stop Conditions

STOP if:

- combined presentation offset requires Simulation changes
- current 0.70 m bond must be changed to make the visuals function
- the pair needs success-image regeneration to avoid a technical artifact
- overlap causes unstable render-order flicker that would require a broader z-order design
- turning becomes materially broken and needs new Gameplay/facing semantics
- unrelated accepted visuals regress.

---

# Verification

Verification Level:
Standard Presentation Visual Tune

Required:

- focused pure offset tests
- focused Grip success presentation tests
- attempt regression
- Grip/Grapple/Drive gameplay regressions
- existing Counter/Tsuppari/Kuzushi/Push presentation regressions
- `pnpm test`
- `pnpm build`
- `git diff --check`
- browser/runtime smoke
- prove src/game/sumo and src/game/input unchanged
- prove public/assets and tools/wrestler_art unchanged.

---

# Completion Report

Include:

- Result
- old values -> new values
- exact final transform formula
- changed files
- proof Simulation/canonical bond unchanged
- pure test results
- full test/build/check
- browser smoke
- neutral/Drive/Morozashi/release screenshots
- turning result
- overlap/draw-order observation
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

`feat(presentation): compress grip success pair`

Do not modify:

- `main`
- `PROJECT_HANDOFF.md`
- `CURRENT_TASK.md`.

# Final Instruction

Replace ACTION-11E's lateral-only 0.30 R display shift with:

```
forward = +0.14 R
lateral = -0.20 R
```

while Grip success / Drive art is shown.

Allow the two rendered wrestler sprites to overlap substantially.

Keep Simulation positions, 0.70 m bond, facing, gameplay, assets and Grip attempt completely unchanged.
