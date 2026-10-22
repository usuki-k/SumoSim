Task-ID: ACTION-08A1-COUNTER-ART-CANDIDATE-REFRESH
Status: READY
Task-Type: ART VISUAL GATE REFRESH / PRESENTATION VERIFICATION
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: bc95f7117dbadf57cceee9d2a0b2a67e6fd10b56
Review-Handoff: ACTION-08A technical review at abccf9d16287864b2ba9733cbdacef555f2f6860
Handoff-Mode: GITHUB

# ACTION-08A1 — Refresh Counter / Hiki-Sabaki Candidate

## Purpose

Replace only the current provisional Counter / 引き・捌き Visual-Gate image with the User's newly generated candidate.

The previous candidate was technically integrated correctly but failed the User Visual Gate because it looked too similar to Tsuppari.

The new candidate is visually more suitable because:
- the active arm sweeps laterally instead of extending straight forward
- the opposite arm is pulled toward the torso
- the torso/stance is asymmetric and reads more like receiving / parrying / sabaki than pushing.

This Task is still a **Visual Gate refresh**, not permanent Product-art promotion.

Do NOT change Counter gameplay.
Do NOT change CounterTransition.
Do NOT change accepted idle/Tsuppari Product art.

---

# Required Local Input

Overwrite:

```
tools/wrestler_art/input.local/candidate_red_counter.png
```

with the newly supplied image.

Expected new source:

- size: 1254 x 1254
- mode: RGBA
- decoded RGBA pixel SHA-256:

```
11d5157b9a25a4717d78808f2005b2d541f4f100e041bd00e34d2f5c5b3b9e85
```

- uploaded file SHA-256 (reference only):

```
02179babfcaf0dc2d828f6080ae81b95236aa43bc98a3d05a629a90936021b3d
```

Old ACTION-08A decoded RGBA pixel SHA-256:

```
eb0f2e6058fe35c239ed571e1e576fc30b4648988c347b89d4e227a3a8b3e040
```

Preflight:
- confirm the file exists
- confirm 1254x1254 RGBA
- confirm the new decoded pixel hash exactly matches the expected value above
- confirm it differs from the old ACTION-08A hash.

If it does not match:
- STOP
- report observed hash
- do not substitute another image.

Do not commit `input.local/`.

---

# Scope

## In Scope

- update the Counter gate recipe source identity
- remeasure / renormalize the new red candidate
- regenerate provisional Counter red/blue runtime textures
- update Counter gate metadata dimensions/pivots
- update focused art tests / expected mask values as necessary
- browser smoke for the refreshed pose
- User Visual Gate.

## Scope Out

Do NOT:
- change `src/game/sumo/`
- change `src/game/input/`
- change Counter window/timing
- change Best / Success / Fail
- change side/rear CounterTransition
- change Kuzushi
- change ArrowDown binding
- change Push / Tsuppari
- change idle Product art
- change permanent Tsuppari Product art
- add animation frames
- add presentation timers
- promote Counter art into permanent Product SPEC
- create a generic pose framework
- modify PROJECT_HANDOFF.md.

---

# Existing Presentation Contract

Preserve the ACTION-08A architecture exactly:

```
BoutSimulation / Snapshot
-> WrestlerVisualState.pose === 'counter'
-> selectWrestlerPoseArt()
-> Counter Visual-Gate texture
-> WrestlerView
```

Show the candidate only while the existing visual state is `counter`.

Do not infer Counter from keyboard input.
Do not add a new state or timer.

---

# Normalization

Do not reuse the old candidate's measurements.

Re-run the established Counter-gate normalization against the accepted idle red master.

Required:
- explicit FRONT
- explicit root/pivot
- explicit body-core
- body-core normalized to 2R
- deterministic /4 runtime export
- no clipping
- no arbitrary manual runtime offset.

The new pose has a more asymmetric torso/leg/arm silhouette, so verify especially:
- canonical body center
- head alignment
- apparent body scale
- idle -> Counter switch.

If the established landmark method cannot normalize this candidate cleanly:
- STOP
- report
- do not modify the algorithm simply to force a result.

---

# Red / Blue Derivation

Keep exactly the existing gate strategy:

```
red = normalized authored red candidate
blue = local-Y reflection(red) + accepted mawashi-only recolor
```

Recolor ownership remains:

```
tools/wrestler_art/runtime_wrestler_recipe.json
```

No runtime reflection/recolor.

Runtime paths remain:

```
public/assets/action/wrestler/counter-gate/red.png
public/assets/action/wrestler/counter-gate/blue.png
```

Do not promote to permanent `counter/` yet.

---

# Visual Intent

The new candidate should preserve the visual distinction that motivated this refresh.

In runtime it should read as:
- lateral sweep / parry / sabaki
- one arm extended sideways
- opposite arm pulled in
- not a straight forward strike
- clearly distinguishable from Tsuppari at game scale.

Do not alter the art to make it more forward-facing merely to resemble the old candidate.

The User Visual Gate decides whether it is good enough.

---

# Verification

Verification Level:
Standard focused Art Refresh + User Visual Gate

Required:
- focused `test_export_counter_gate.py`
- wrestler-art suite
- focused presentation tests
- `pnpm test`
- `pnpm build`
- `git diff --check`
- deterministic Counter export
- `export_counter_gate.py --check`
- idle exporter `--check`
- permanent Tsuppari exporter `--check`
- prove `src/game/sumo/` and `src/game/input/` unchanged.

---

# Browser Smoke

Required.

Verify:
1. pre-bout / Enter works
2. ArrowDown shows new blue Counter candidate
3. red Counter candidate can be observed
4. texture is shown for existing Counter state only
5. idle -> Counter -> next state does not visibly jump in canonical center/scale
6. Counter Fail behavior unchanged
7. Push Counter Success / Best and side/rear transition unchanged
8. Tsuppari images unchanged
9. Push / Grip / movement unchanged
10. no console / texture load errors.

---

# Acceptance Criteria

Technical completion requires:
- new source hash is actually used
- red candidate is freshly normalized
- blue is derived from the new red candidate
- exactly two counter-gate runtime textures remain
- metadata matches exported size/pivot
- accepted idle/Tsuppari assets unchanged
- Counter gameplay unchanged
- tests/build/smoke pass.

Final art acceptance remains User-only.

---

# Completion Report

Include:
- Result
- Preflight
- old/new source hashes
- new normalization measurements
- red/blue runtime size/pivot/body-core
- old/new runtime pixel hashes
- recolor/mask result
- presentation integration status
- verification
- browser smoke
- gameplay unchanged evidence
- Design Deviations
- Unexpected Scope
- User Visual Gate: REQUIRED
- Git delivery.

If none:
`Design Deviations: NONE`

---

# Stop Conditions

STOP if:
- new source hash does not match
- normalization cannot cleanly align the candidate
- recolor contaminates skin/hair/arms
- accepted idle/Tsuppari assets would need changes
- gameplay changes are required
- CounterTransition changes are required
- broad refactor becomes necessary.

---

# Git Delivery

Follow `AGENTS.md`.

Normal successful Task:
- stage Task-owned files only
- one commit
- fetch / fast-forward safety
- push `origin/develop`
- verify remote SHA
- clean working tree.

Suggested commit:

`art(action): refresh counter pose candidate`

Do not modify:
- `main`
- `PROJECT_HANDOFF.md`
- `CURRENT_TASK.md`.

# Final Instruction

Refresh only the provisional Counter / 引き・捌き candidate.

Preserve all existing gameplay and accepted Product art.
Do not permanently accept this Counter art until the User reviews it in runtime.
