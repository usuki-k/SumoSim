Task-ID: ACTION-07C2-TSUPPARI-RIGHT-POSE-AND-REACH-TUNE
Status: READY
Task-Type: ART REFRESH + SMALL GAMEPLAY TUNE
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 4ba81157e3525bfb150e374f9937259b77d55a03
Review-Handoff: ACTION-07C1 technical review accepted at b290eda7979045e9e78629554ee1d2ce6353e61c
Handoff-Mode: GITHUB

# ACTION-07C2 — Refresh Right Tsuppari Pose + Small Reach Tune

## Purpose

Apply exactly two small follow-up changes:

1. replace the current red right-hand Tsuppari candidate with the User's newly regenerated shorter-arm image
2. increase Tsuppari reach slightly.

This is a focused follow-up to ACTION-07C1.

Do NOT reopen broad Tsuppari design.
Do NOT retune Push.
Do NOT redesign the Visual Gate comparison system.

---

# Current Baseline

- ACTION-07B gameplay is the accepted technical baseline for Tsuppari.
- ACTION-07C / 07C1 provide the current 3-mode Art Visual Gate.
- User currently prefers **SEPARATE** because MIRROR modes visibly flip head/body asymmetry.
- ACTION-07C1 improved right-hand strike direction.
- User now wants:
  - one more right-pose replacement to better match left/right arm length
  - a slightly longer Tsuppari reach.

SEPARATE is still a User preference, not yet the permanent Product art baseline.

---

# Required Local Inputs

The User has replaced:

```
tools/wrestler_art/input.local/candidate_red_tsuppari_right.png
```

with the newly regenerated right-hand candidate.

These should remain unchanged:

```
tools/wrestler_art/input.local/candidate_red_tsuppari_left.png
tools/wrestler_art/input.local/candidate_blue_tsuppari_left.png
tools/wrestler_art/input.local/candidate_blue_tsuppari_right.png
```

Preflight:

- confirm all four files exist
- confirm the new red-right decoded pixel hash differs from ACTION-07C1
- confirm the other three candidate pixel hashes are unchanged.

ACTION-07C1 red-right decoded RGBA SHA-256:

```
3db3260bc3d90a88694bb65959c83919f148985847c4575c104394261e92cace
```

If red-right still has that hash:
- STOP
- report that the replacement has not been applied.

Do not commit `input.local/`.

---

# Scope

## In Scope

- update red-right source identity in the gate recipe
- remeasure / renormalize the new red-right pose
- regenerate red-right-derived Visual-Gate textures
- regenerate affected offline preview evidence
- update metadata/tests/hashes as required
- increase Tsuppari reach slightly
- focused runtime/browser verification.

## Scope Out

Do NOT:

- change Push tuning
- change Tsuppari impulse
- change cooldown
- change startup / active / recovery
- change buildup threshold
- change Counter behavior
- change pair-force rules
- change left Tsuppari source
- change authored-blue candidates
- change idle Product art
- remove MIRROR-L / MIRROR-R
- remove key-4 gate toggle
- promote SEPARATE into WRESTLER_PRODUCT_ART_SPEC
- refactor the art tool broadly.

---

# Accepted Gameplay Change

Only Tsuppari reach changes.

Current:

```
TSUPPARI_HAND_REACH = 0.525 m
```

Current equal-radius effective center threshold:

```
0.525 + BODY_RADIUS(0.35) = 0.875 m
```

New provisional value:

```
TSUPPARI_HAND_REACH = 0.55 m
```

New equal-radius effective center threshold:

```
0.55 + BODY_RADIUS(0.35) = 0.90 m
```

This is intentionally a small increase (+0.025 m).

Keep the existing center-based hit rule:

```
hit iff centerDistance <= TSUPPARI_HAND_REACH + receiver.bodyRadius
```

Do not use sprite collision.

This remains Provisional / User Play Test.

---

# Gameplay Values That Must Not Change

Do not change:

- `PUSH_EXTERNAL_ACCELERATION`
- `TSUPPARI_IMPULSE`
- `TSUPPARI_COUPLED_SHARE`
- per-hand cooldown
- startup / active / recovery
- deterministic 5 ordinary hits -> 6th Kuzushi
- Countered Tsuppari semantics
- Push Counter semantics
- Push/Tsuppari contest
- Tsuppari/Tsuppari contest
- global clamp / decay
- ring-out rules.

Production gameplay source delta should be limited to the reach constant and directly related test/document expectations.

---

# Art Refresh

Re-run the existing ACTION-07C / 07C1 red-right path using the new image.

Do not blindly reuse the 07C1 right-pose measurements.

Use the same explicit normalization method:

- source identity validation
- FRONT normalization
- root/pivot measurement
- body-core measurement
- normalize body core to 2R
- deterministic Product-scale export.

Do not alter the normalization algorithm merely to fit this image.

If it cannot be normalized cleanly:
- STOP and report.

---

# Hand / Color Mapping

Preserve existing semantics exactly.

SEPARATE:

```
red left  = authored red-left
red right = NEW authored red-right
blue left = reflect(NEW red-right) + accepted blue mawashi recolor
blue right = reflect(red-left) + accepted blue mawashi recolor
```

MIRROR-R also derives from the new red-right and must be regenerated consistently.

MIRROR-L must remain pixel-identical unless a understood metadata-only reason exists.

---

# Expected Gate Asset Delta

Expected changed pixels:

```
separate_red_right.png
separate_blue_left.png

mirror_r_red_right.png
mirror_r_red_left.png
mirror_r_blue_right.png
mirror_r_blue_left.png
```

Expected unchanged pixels:

```
separate_red_left.png
separate_blue_right.png

mirror_l_red_left.png
mirror_l_red_right.png
mirror_l_blue_left.png
mirror_l_blue_right.png

public/assets/action/wrestler/red.png
public/assets/action/wrestler/blue.png
```

If an expected-unchanged texture changes:
- investigate
- do not silently accept it.

---

# Recolor / Mask

Revalidate accepted red->blue mawashi recolor on the newly normalized red-right pose.

Required:

- alpha preserved
- no material skin/hair/arm contamination
- pixels outside the mask unchanged
- configured mask limits still pass.

Do not change the accepted recolor rule to fit the new pose.

If it fails:
- STOP and report.

---

# Reach Verification

Update focused Tsuppari tests for the new boundary.

At minimum verify:

1. equal-radius center distance just below 0.90 m -> hit
2. just above 0.90 m -> whiff
3. ordinary contact hit still works
4. non-contact hit in the newly extended band works
5. Counter can catch Tsuppari within the new reach
6. whiff outside new reach remains whiff
7. Push/Tsuppari interaction semantics unchanged
8. all Tsuppari gameplay constants except reach remain unchanged.

Do not weaken existing tests.

---

# Offline Preview Refresh

Regenerate current local gate evidence.

At minimum update/confirm:

- red-right pivot guide
- SEPARATE sheet
- MIRROR-R sheet
- idle/Tsuppari alignment
- rotations
- faceoff sheet using current reach
  - contact ~0.70 m
  - new Tsuppari reach ~0.90 m
- mawashi diagnostics
- blue-reference comparison.

MIRROR-L may be regenerated but its textures must remain unchanged.

---

# Browser / Runtime Smoke

Required.

Focus on:

1. Enter starts Bout
2. key 4 still cycles all gate modes
3. SEPARATE uses the new red-right candidate
4. SEPARATE derived blue-left uses the new red-right path
5. right-arm length looks closer to left-arm length
6. idle -> pose -> idle has no new position/scale jump
7. reach is slightly longer than before
8. situations around 0.88–0.90 m behave according to the new reach
9. Push / Counter / Grip still work
10. dummy mode 3 still works
11. no missing texture / console errors.

The smoke verifies integration only.
Final visual/game-feel acceptance remains User-owned.

---

# Measurement Reproducibility Guardrail

ACTION-07C1 review identified a deferred issue:

- the normalization measurement helper used in 07C was not committed
- recipe prose says "7 px erosion"
- 07C1 reconstructed the actual behavior as "7 px opening (erosion + dilation)".

For this small Task:

- do not broaden Scope into a large art-tool refactor
- use the same 07C1-calibrated measurement interpretation for consistency
- record any new measurement evidence clearly.

If a tiny deterministic helper is absolutely necessary to avoid another ambiguous measurement, it may be added only if it stays narrowly scoped and is reported.

Permanent Product promotion must later reconcile this measurement method explicitly.

---

# Expected Files

Likely:

- `tools/wrestler_art/tsuppari_gate_recipe.json`
- red-right-derived runtime gate PNGs
- `src/game/presentation/tsuppariGateArt.ts`
- focused art test expectation(s)
- `src/game/sumo/BoutSimulation.ts` — reach constant only
- focused Tsuppari test(s) — reach boundary only
- `docs/ARCHITECTURE.md` — update current provisional reach
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`.

Do not modify `CURRENT_TASK.md`.

---

# Verification

Verification Level:
Standard focused follow-up

Required:

- focused wrestler-art tests
- full wrestler-art suite
- focused Tsuppari Simulation tests
- `pnpm test`
- `pnpm build`
- `git diff --check`
- deterministic gate exporter `--check`
- accepted idle runtime art unchanged
- verify gameplay source change is limited to the intended reach tune.

Do not claim PASS if another gameplay semantic changed.

---

# Acceptance Criteria

Technical completion requires:

- new right-pose source is actually used
- new red-right normalization is explicit
- SEPARATE red-right updated
- SEPARATE blue-left updated
- MIRROR-R regenerated consistently
- red-left / MIRROR-L unchanged
- idle sprites unchanged
- `TSUPPARI_HAND_REACH: 0.525 -> 0.55`
- effective equal-radius threshold: 0.875 -> 0.90 m
- no other gameplay semantic changed
- tests/build/runtime smoke pass.

Final visual/game-feel acceptance is User-only.

---

# Completion Report

Include:

- Result
- Preflight
- old vs new red-right source hashes
- new red-right normalization measurements
- changed gate texture hashes
- unchanged texture evidence
- recolor/mask result
- exact gameplay change:
  - old/new `TSUPPARI_HAND_REACH`
  - old/new effective equal-radius threshold
- focused reach tests
- full verification
- browser/runtime smoke
- changed files
- files explicitly not changed
- measurement-method note
- Design Deviations
- Unexpected Scope
- User Visual Gate / Play Test Required
- Git delivery.

If none:
`Design Deviations: NONE`

---

# Stop Conditions

STOP if:

- red-right source hash is still the ACTION-07C1 value
- any other candidate source unexpectedly changed
- new right pose cannot be normalized with the established method
- recolor contaminates non-mawashi regions
- extending reach requires broader collision redesign
- any gameplay semantic besides reach must change
- expected-unchanged textures change for unknown reasons.

---

# Git Delivery

Follow `AGENTS.md`.

Normal success:

- stage only Task-owned files
- one commit
- fetch / fast-forward safety
- push `origin/develop`
- verify remote SHA
- clean working tree.

Suggested commit:

`art(action): refresh right tsuppari pose and tune reach`

Do not modify:

- `main`
- `PROJECT_HANDOFF.md`.

# Final Instruction

Apply exactly two functional changes:

1. refresh the red right-hand Tsuppari candidate again
2. increase Tsuppari reach from 0.525 m to 0.55 m.

Keep everything else unchanged as much as possible.
