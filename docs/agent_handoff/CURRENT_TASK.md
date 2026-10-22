Task-ID: ACTION-07C1-TSUPPARI-RIGHT-POSE-REFRESH
Status: READY
Task-Type: ART ASSET REFRESH / VISUAL GATE FOLLOW-UP
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: e30d6b407c3c98f086f4765a0847f3f74038fe0f
Review-Handoff: ACTION-07C technical review accepted at cd44ca1b4a1ffbc92171996534658df8ee388b38
Handoff-Mode: GITHUB

# ACTION-07C1 — Refresh Red Right Tsuppari Candidate

## Purpose

Refresh only the **red right-hand Tsuppari candidate** used by ACTION-07C and regenerate the affected Visual-Gate assets.

The User prefers **SEPARATE** over the mirror modes because the mirror modes visibly move the head/body asymmetry.

However, the original SEPARATE right-hand pose looked too diagonal (approximately 45 degrees), so the User created a new, more forward-facing replacement image.

This Task is a minimal Visual-Gate follow-up.

Do NOT redesign Tsuppari gameplay.
Do NOT change the 3-mode comparison system.
Do NOT promote SEPARATE into the permanent Product contract yet.

---

# Required Local Input

The User has replaced:

```
tools/wrestler_art/input.local/candidate_red_tsuppari_right.png
```

with the newly generated right-hand candidate.

Other candidate inputs should remain unchanged:

```
tools/wrestler_art/input.local/candidate_red_tsuppari_left.png
tools/wrestler_art/input.local/candidate_blue_tsuppari_left.png
tools/wrestler_art/input.local/candidate_blue_tsuppari_right.png
```

Preflight:
- confirm all four files exist
- confirm the right candidate's decoded pixel hash differs from the old ACTION-07C right candidate
- confirm the other three candidate pixel hashes are unchanged from ACTION-07C.

Old ACTION-07C red-right decoded RGBA pixel SHA-256:
```
d0e6070e2359a8309b07e7c3d76eba905c50fd379cf7e4b4d50bf14c1816d33b
```

If the right candidate still has that old hash:
- STOP
- report that the replacement has not actually been applied.

Do not commit `input.local/`.

---

# Current User Direction

Current visual preference:
- **SEPARATE is preferred**
- reason: idle -> pose does not flip the head/body asymmetry as the mirror modes do.

This is a preference for the current Visual Gate, not yet a permanent Product acceptance.

The purpose of this Task is to answer:

> Does the new red-right candidate make SEPARATE's right-hand strike direction sufficiently forward/natural?

Do not reopen MIRROR-L / MIRROR-R design unless required to keep the gate internally consistent.

---

# Scope

## In Scope

- update the red-right source identity in the Visual-Gate recipe
- remeasure / renormalize the new red-right pose
- regenerate runtime gate textures affected by red-right
- regenerate offline preview evidence affected by red-right
- update tests/hashes/metadata as required
- browser smoke for SEPARATE right-hand pose and its derived blue-left counterpart
- keep all ACTION-07C mode switching working.

## Scope Out

Do NOT:
- change ACTION-07B gameplay
- change Push / Tsuppari tuning
- change reach/cooldown/timing/buildup
- change Counter
- change idle art
- change red-left candidate
- change authored-blue candidates
- generate new art
- manually repaint
- remove MIRROR-L / MIRROR-R
- change the key-4 toggle
- promote SEPARATE into WRESTLER_PRODUCT_ART_SPEC
- refactor the art tool broadly.

---

# Required Normalization

Do not reuse the previous red-right measurements blindly.

Re-run the same explicit ACTION-07C measurement/normalization method for the new image:

- source identity validation
- explicit FRONT normalization
- measured root / pivot
- measured body-core
- body-core normalized to 2R
- deterministic runtime export.

Update only the red-right measurement fields that actually changed.

The red-left measurements and source identity must remain unchanged.

If the new right pose cannot be normalized cleanly using the existing method:
- STOP
- report the exact mismatch
- do not alter the normalization algorithm just to make this one image fit.

---

# Affected Hand / Color Mapping

Preserve ACTION-07C semantics exactly.

SEPARATE:

```
red left  = authored red-left
red right = NEW authored red-right
blue left = reflect(NEW red-right) + accepted blue mawashi recolor
blue right = reflect(red-left) + accepted blue mawashi recolor
```

Therefore the main User-facing changes are expected in:

- SEPARATE red right
- SEPARATE blue left.

MIRROR-R also derives from red-right, so its affected candidate textures must be regenerated consistently.

MIRROR-L should remain pixel-identical to ACTION-07C unless build metadata changes for non-image reasons.

---

# Expected Runtime Asset Impact

Under:

```
public/assets/action/wrestler/tsuppari-gate/
```

Expected changed pixels are limited to red-right-derived textures, including:

```
separate_red_right.png
separate_blue_left.png

mirror_r_red_right.png
mirror_r_red_left.png
mirror_r_blue_right.png
mirror_r_blue_left.png
```

Some of these may intentionally be pixel-identical pairs because of shared derivation.

Expected unchanged pixels include:

```
separate_red_left.png
separate_blue_right.png

mirror_l_red_left.png
mirror_l_red_right.png
mirror_l_blue_left.png
mirror_l_blue_right.png
```

If an expected-unchanged texture changes pixels:
- investigate
- do not silently accept it.

---

# Recolor / Mask

Revalidate the accepted red->blue mawashi recolor on the newly normalized red-right pose.

Required:
- alpha preserved
- no material skin/hair/arm contamination
- mask outside pixels unchanged
- mask limits still pass.

Do not change the accepted current recolor rule merely to fit the new pose.

If the existing mask no longer works:
- STOP
- report
- do not broaden into skin.

---

# Offline Preview Refresh

Regenerate ACTION-07C local preview evidence.

At minimum confirm/update:

- pivot guide for red-right
- SEPARATE mode sheet
- MIRROR-R mode sheet
- idle/Tsuppari alignment sheet
- rotation sheet
- faceoff sheet
- mawashi diagnostics
- blue reference vs derived comparison.

MIRROR-L preview may be regenerated by the existing deterministic tool, but its source textures should remain visually/pixel unchanged.

---

# Browser Smoke

Focus on the changed visual path.

Required:

1. run game
2. Enter
3. debug `0`
4. select `SEPARATE` with key `4`
5. ArrowRight:
   - red right pose appears when CPU/player assignment allows it
   - strike looks more forward than old candidate
6. verify derived blue Left uses the new red-right source path
7. idle -> pose -> idle has no new center/scale jump
8. key 4 still cycles all 3 modes
9. MIRROR-L remains unchanged visually
10. no texture load/console errors.

Use dummy mode 3 if useful to observe red CPU repeatedly.

This smoke verifies integration only.
Whether the new pose is visually better remains the User gate.

---

# Verification

Verification Level:
Lean/Standard Art Refresh

Required:

- focused `test_export_tsuppari_gate.py`
- full wrestler-art suite
- focused presentation tests
- `pnpm test`
- `pnpm build`
- `git diff --check`
- deterministic exporter `--check`
- accepted idle runtime `red.png / blue.png` unchanged
- `src/game/sumo` and `src/game/input` unchanged.

Do not require unrelated gameplay retuning.

---

# Acceptance Criteria

Technical completion requires:

- new right source is actually used
- new red-right normalization is explicit and deterministic
- SEPARATE red-right runtime texture is regenerated
- SEPARATE blue-left is regenerated from the new right source
- red-left path is unchanged
- MIRROR-L textures remain pixel-identical
- MIRROR-R is consistently regenerated
- idle Product sprites unchanged
- gameplay unchanged
- tests/build pass
- runtime comparison works.

Final visual acceptance is User-only.

---

# Completion Report

Include:

- Result
- old vs new red-right source hash
- new right-pose normalization measurements
- changed runtime gate texture hashes
- explicit list of textures proven unchanged
- recolor/mask result
- focused/full tests
- browser smoke
- offline preview outputs
- gameplay source unchanged evidence
- Design Deviations
- Unexpected Scope
- User Visual Gate: REQUIRED
- Git delivery.

Also state clearly:

```
SEPARATE is still a User preference, not yet promoted to permanent Product baseline.
```

---

# Stop Conditions

STOP if:

- right source hash is still the old one
- any of the other 3 candidate sources unexpectedly changed
- the new right pose cannot be normalized cleanly with the existing 07C method
- mawashi recolor contaminates non-mawashi regions
- gameplay code would need to change
- expected-unchanged red-left / MIRROR-L texture pixels unexpectedly change and the cause is not understood.

---

# Git Delivery

Follow `AGENTS.md`.

Normal successful Task:
- stage Task-owned files only
- one commit
- push `origin/develop`
- verify remote SHA
- clean working tree.

Suggested commit:

`art: refresh right tsuppari candidate`

Do not modify:
- `main`
- `PROJECT_HANDOFF.md`
- `CURRENT_TASK.md`.

# Final Instruction

Refresh only the right-hand Tsuppari candidate path and re-run the existing ACTION-07C Visual Gate.

Keep gameplay unchanged.
Do not permanently accept SEPARATE until the User reviews the refreshed runtime.
