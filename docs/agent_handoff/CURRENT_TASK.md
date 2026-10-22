Task-ID: ACTION-11C-GRIP-LUNGE-CONTEST-IMPLEMENTATION
Status: READY
Task-Type: CORE GAMEPLAY IMPLEMENTATION / GRIP MOVEMENT + ACTION CONTEST
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: 710d86e58cb7c8d9b6695828a08175f931225043
Review-Handoff: ACTION-11B investigation accepted; User selected D1=4 ticks, D2=neutral, D3=preserve recovery non-grabbable, D4=preserve startup non-grabbable
Handoff-Mode: GITHUB

# ACTION-11C — Grip Lunge + Four-Way Contest Implementation

## Purpose

Implement the accepted ACTION-11B Grip redesign.

User-approved decisions:

```
GRIP_REACH_TICKS = 8
GRIP_MIN_ATTEMPT_TICKS = 4
Grip vs Counter -> neutral grapple
Push/Tsuppari startup and recovery remain non-grabbable
```

Grip becomes a short committed forward lunge using the current ACTION-11A attempt pose, with success driven by actual body contact rather than the old margin range.

Also implement the explicit cross-action relationships:

```
Push > Tsuppari > Grip > Counter > Push
```

with:

```
Push > Grip
Counter > Tsuppari
```

Do not redesign Push / Tsuppari / Counter / Kuzushi beyond the approved Grip interactions.

---

# Accepted Grip Timing

Use:

```
GRIP_REACH_TICKS = 8
GRIP_MIN_ATTEMPT_TICKS = 4
GRIP_RECOVERY_TICKS = 12
```

Meaning:

- Shift starts Grip reach immediately
- reach is the Grip lunge phase
- Grip cannot succeed until reach elapsed >= 4 ticks
- earliest possible success tick = tick 4
- this guarantees at least 4 Simulation Snapshots of the Grip attempt state before success from an already-contacting start
- no new Grip startup phase is added
- whiff enters existing 12-tick recovery.

Do not add presentation-owned timing.

---

# Grip Movement

When Grip starts:

- capture `direction = (cos(facing), sin(facing))`
- store it in Grip action state
- use the existing grounded movement model during Grip reach
- WASD is ignored during Grip reach
- recovery uses zero movement intent / normal braking
- no homing
- no target id
- no teleport.

Expected open-space movement from investigation:

```
reach travel ~= 0.100 m
total movement including braking ~= 0.1267 m
peak self speed ~= 1.333 m/s
```

Do not hardcode displacement.

Do not add Grip-specific acceleration.

Use existing:

- FORWARD_ACCELERATION
- MAX_SPEED
- STOP_DECELERATION
- LATERAL_DECELERATION
- REVERSE_BRAKING.

---

# Grip Facing

During Grip reach:

- canonical facing remains locked to the press-time Grip direction
- do not face-track a sidestepping opponent.

During Grip recovery:
- resume ordinary FREE facing behavior.

Reason:
- recovery is also used after grapple release
- freezing recovery facing would change existing release behavior.

Do not create presentation-only facing.

---

# Grip Action State

Extend canonical Grip action minimally.

Preferred shape:

```ts
{
  kind: 'grip'
  phase: 'reach' | 'recovery'
  ticksRemaining: number
  direction: Vec2
}
```

If direction is irrelevant in recovery, it may still remain in the state for shape simplicity.

Snapshot must deep-copy the direction.

Do not add:
- target id
- hit flag
- eligible flag
- separate startup timer.

Eligibility must be derived from ticksRemaining:

```
elapsed = GRIP_REACH_TICKS - ticksRemaining
eligible = phase === 'reach' && elapsed >= GRIP_MIN_ATTEMPT_TICKS
```

---

# Grip Success Boundary

Remove the old margin-based success boundary from Grip resolution.

Grip success now requires:

```
actual existing Simulation body contact
```

Use the same contact result / circle geometry already owned by BoutSimulation.

Do not create:
- Grip collider
- hand collider
- sprite-based hitbox
- range-only grab.

`GRIP_RANGE_MARGIN` must no longer decide Grip success.

If the constant becomes fully unused:
- remove it cleanly
- update tests/docs accordingly.

If it is still referenced by historical tests/docs only:
- remove/update those stale assumptions rather than keeping a dead gameplay constant.

Do not change BODY_RADIUS / CONTACT_SLOP.

---

# Minimum Attempt Visibility

A newly started Grip may be in contact immediately, but cannot succeed until:

```
elapsed >= 4
```

So:

```
Shift at contact
-> Grip reach / attempt pose
-> 4 ticks of visible attempt state
-> then Grip may resolve success
```

Do not special-case rendering.

ACTION-11A selector remains:

```
pose === 'grip'
&& gripPhase === 'reach'
```

No changes to the attempt art are required.

Exception:
- if Grip is defeated by a Push impact or Tsuppari hit before tick 4, it may enter recovery immediately.
- this is intentional; the attempt loses before it can succeed.

---

# Small Explicit Contest Resolver

Do not rely on current function-call order to determine Grip interactions.

Add one small symmetric Pure TypeScript helper for Grip-related FREE contests.

Preferred conceptual name:

```
resolveFreeGripContest
```

or equivalent.

It must operate from one tick-local canonical state and determine:

- Grip cancellation(s)
- whether a Grip-created grapple should occur
- neutral vs Morozashi advantage.

Do not implement a generic combat rule engine.

The helper must be:
- deterministic
- participant-order independent
- Phaser-free.

---

# Recommended FREE Tick Order

Use the investigation-approved conceptual order:

```
integrate movement
-> resolveContact
-> openPushImpact
-> evaluate Grip contest from one state
-> apply Grip cancellations to recovery
-> resolveCounter
-> if Grip contest says grapple:
     consume target Kuzushi if applicable
     enterGrapple
-> if engagement still FREE:
     resolveForces
-> advanceAction
-> updateFacing
-> ring-out
```

Exact code structure may differ, but these semantics must hold.

Important:
- Tsuppari hit predicates used by the contest helper must be evaluated consistently with the same logical tick
- Push impact must be open before Push-vs-Grip is decided
- Grip-vs-Counter grapple must be determined before Counter timeout/advanceAction
- force formulas remain in current owners.

---

# Cross-Action Rules

## 1. Push > Tsuppari

Preserve current accepted behavior exactly.

When Tsuppari hit overlaps Push impact/contact:
- current coupled contribution remains
- Push normally wins the forward contest
- Tsuppari buildup still changes as today.

Do not simplify to "Tsuppari cancelled".

---

## 2. Tsuppari > Grip

NEW accepted rule.

If a participant is in Grip reach and the opponent's Tsuppari hit tick reaches them:

- Tsuppari wins
- Grip is cancelled
- Grip enters `recovery` with full `GRIP_RECOVERY_TICKS`
- no grapple
- Tsuppari hit resolves normally
- impulse unchanged
- buildup unchanged
- 6th-hit Kuzushi unchanged
- no extra Kuzushi just for losing Grip.

This applies even before Grip reaches its 4-tick eligibility.

The Grip attempt may therefore be interrupted early by a real Tsuppari hit.

---

## 3. Grip > Counter

NEW accepted rule.

If:

- Grip is in reach
- Grip is eligible (elapsed >= 4)
- actual contact exists
- target action is active Counter

then:

```
Grip wins
-> neutral grapple
-> Counter action cancelled by enterGrapple
-> Counter loser gets NO Kuzushi
-> no CounterTransition
```

If Counter timed out into Kuzushi before Grip succeeds:
- existing Kuzushi Grip -> Morozashi applies.

Do not grant Morozashi merely because the target was still Counter.

---

## 4. Counter > Push

Preserve current accepted Push Counter exactly.

No changes to:
- impact-only catch
- Best / Success
- CounterTransition
- Kuzushi
- overshoot fallback
- 35-degree visual.

---

# Diagonal Rules

## Push > Grip

A Push defeats Grip only when the Push has an actual active impact window and actual contact.

If:

```
Push impact active
+ actual contact
+ opponent is Grip reach
```

then:

- Grip is cancelled into full Grip recovery
- Push impact continues normally
- Push force continues normally
- no added Kuzushi to Grip just for losing.

Important distinction:

- Push startup is NOT a contest win
- Push pre-impact charge is NOT a contest win
- Push recovery is NOT a contest win.

However, per User-approved D4, Push remains a non-grabbable target while its action is non-idle.

So a Grip cannot successfully grab:
- Push startup
- Push charge before impact
- Push impact
- Push recovery.

Only the impact/contact tick actively cancels the Grip.

This distinction must be explicit in code/tests.

---

## Counter > Tsuppari

Preserve current accepted behavior exactly.

No changes.

---

# Target Eligibility

For unilateral Grip success, valid target actions are:

- idle
- counter
- grip reach.

Invalid target actions remain:

- push startup / charge / impact / recovery
- tsuppari startup / active / recovery
- grip recovery
- drive.

This preserves the User-selected D3/D4 minimal-scope behavior.

Do not broaden recovery punishment in this Task.

---

# Grip vs Grip

Avoid the timing hole found in ACTION-11B.

If:

- actual contact exists
- at least one participant has an eligible Grip reach
- the other participant is also in Grip reach

then:

```
neutral grapple
```

The other Grip does not need to be eligible yet.

This must be symmetric and participant-order independent.

No arbitrary winner.

---

# Idle / Grip

Eligible Grip + actual contact against idle target:

```
neutral grapple
```

---

# Kuzushi / Grip

Eligible Grip + actual contact against Kuzushi target:

```
Morozashi to gripper
-> target Kuzushi consumed
-> enter grapple
```

Do not consume Kuzushi:
- during lunge
- on contact alone before Grip success
- when Grip is defeated by Push/Tsuppari.

Preserve ACTION-09B.

---

# Counter / Counter

Preserve current behavior.

No direct contest.
Each window proceeds independently.
Untouched timeout -> each participant enters Kuzushi.

---

# Tsuppari / Tsuppari

Preserve current behavior.

Both hits can resolve.

---

# Push / Push

Preserve current behavior.

Both impact windows can open and net Push force cancels.

---

# Same-Participant Input Priority

Do not change:

```
Push > Tsuppari > Counter > Grip
```

This Task is cross-participant contest only.

---

# ACTION-11A Attempt Art

Preserve the current provisional Grip attempt Visual Gate.

Do not change:

- source image
- runtime textures
- red/blue derivation
- pivot
- scale
- selector.

Because Grip reach becomes 8 ticks and minimum success is 4 ticks:
- the attempt pose should now be visible in ordinary successful Grips.

Do not promote it to Product art in this Task.

---

# Grip Success Visual

Still Deferred.

After successful grapple:
- keep the current existing grapple visual fallback
- do not add Grip success sprite
- do not add head offset
- do not add hand-marker VFX.

Those are separate follow-up visual tasks.

---

# Exact Full Pair Matrix

Implement and test this matrix.

| Pair | Result |
|---|---|
| Push / Push | existing contest; net force cancellation while both impacts active |
| Push / Tsuppari | existing coupled semantics |
| Push / Grip | Push impact/contact cancels Grip -> Grip recovery |
| Push / Counter | existing Counter wins Push |
| Tsuppari / Tsuppari | existing mutual-hit behavior |
| Tsuppari / Grip | Tsuppari hit cancels Grip -> Grip recovery; hit resolves normally |
| Tsuppari / Counter | existing Counter catches Tsuppari |
| Grip / Grip | eligible+reach/contact -> neutral grapple |
| Grip / Counter | eligible Grip/contact -> neutral grapple; Counter cancelled, no Kuzushi |
| Counter / Counter | independent windows; untouched timeout -> Kuzushi |

Also verify:
- Idle / Grip -> neutral grapple
- Kuzushi / Grip -> Morozashi + Kuzushi consumed.

---

# Required Boundary Cases

All required; do not sample.

## Grip Timing / Movement

G1. `GRIP_REACH_TICKS = 8`.

G2. `GRIP_MIN_ATTEMPT_TICKS = 4`.

G3. `GRIP_RECOVERY_TICKS = 12`.

G4. stationary open-space Grip reach travel ~= 0.100 m.

G5. full movement with braking ~= 0.1267 m.

G6. peak self speed ~= 1.333 m/s.

G7. press-time direction is locked.

G8. reach facing stays locked.

G9. recovery resumes ordinary facing.

G10. whiff enters recovery after full reach.

## Attempt Visibility

V1. already-contacting start cannot grapple on press tick.

V2. cannot grapple before elapsed 4.

V3. can grapple on elapsed 4 if all other conditions hold.

V4. successful Grip has at least 4 reach snapshots before grapple.

V5. if defeated by Push/Tsuppari before eligibility, Grip can cancel earlier.

V6. ACTION-11A attempt texture remains selected throughout reach until cancellation/success.

## Contact Success

C1. Grip success requires actual contact.

C2. old 0.79m margin alone no longer succeeds.

C3. no bond snap for ordinary contact success beyond floating-point tolerance.

C4. practical stationary-target reach remains around 0.80m via lunge.

C5. glancing contact can succeed if eligibility/target rules hold.

## Tsuppari > Grip

TG1. Tsuppari hit during Grip reach cancels Grip.

TG2. Grip enters full recovery.

TG3. no grapple.

TG4. Tsuppari impulse unchanged.

TG5. Tsuppari buildup unchanged.

TG6. 6th-hit Kuzushi still works.

TG7. participant order independent.

## Push > Grip

PG1. Push startup does not actively cancel Grip.

PG2. pre-impact Push charge does not actively cancel Grip.

PG3. actual Push impact/contact cancels Grip.

PG4. Grip enters full recovery.

PG5. Push force resolves normally.

PG6. Push recovery does not actively cancel Grip.

PG7. Push remains non-grabbable during all Push phases.

PG8. participant order independent.

## Grip > Counter

GC1. eligible Grip/contact during Counter window enters neutral grapple.

GC2. Counter gets no Kuzushi.

GC3. no CounterTransition.

GC4. Counter action is cancelled by grapple entry.

GC5. if Counter has already timed out into Kuzushi, Grip gives Morozashi instead.

GC6. participant order independent.

## Grip vs Grip

GG1. both eligible + contact -> neutral grapple.

GG2. one eligible + other still reach + contact -> neutral grapple.

GG3. neither eligible -> no grapple yet.

GG4. participant order independent.

## Idle / Kuzushi

IK1. eligible Grip + idle + contact -> neutral.

IK2. eligible Grip + Kuzushi + contact -> Morozashi.

IK3. Kuzushi consumed only on successful grapple tick.

IK4. defeated/whiff Grip does not consume target Kuzushi.

## Existing Pair Regression

R1. Push / Push unchanged.

R2. Push / Tsuppari unchanged.

R3. Push / Counter unchanged.

R4. Tsuppari / Tsuppari unchanged.

R5. Tsuppari / Counter unchanged.

R6. Counter / Counter unchanged.

R7. same-participant input priority unchanged.

## Grapple / Drive Regression

D1. enterGrapple momentum averaging unchanged.

D2. grapple bond unchanged.

D3. release unchanged.

D4. Grappled Orientation unchanged.

D5. Drive unchanged.

## Presentation Regression

P1. Grip attempt art still reach-only.

P2. Grip recovery uses idle art.

P3. successful grapple uses current fallback.

P4. Push / Tsuppari / Counter / Kuzushi visuals unchanged.

P5. Product asset hashes unchanged.

---

# Timing Sweeps

Required for new contest relationships.

Run deterministic offset sweeps comparable to ACTION-11B.

At minimum:

## Grip / Counter
- gap 0.70 / 0.75 / 0.80
- Counter press offsets covering before / overlapping / after Grip success.

## Grip / Tsuppari
- gap 0.70 / 0.75 / 0.80 / 0.85
- Tsuppari press offsets covering hit before / during / after Grip reach.

## Grip / Push
- gap 0.70 / 0.75 / 0.80 / 1.2 / 1.6
- Push press offsets covering startup / pre-impact / impact / recovery.

## Grip / Grip
- gap 0.70 / 0.75 / 0.80 / 0.90
- relative Grip press offsets covering one-eligible / both-eligible / neither-eligible cases.

For every symmetric/new pair:
- swap role A/B
- swap participant array order
- verify semantically identical outcomes.

---

# Resolver Order Independence

Required.

Tests must prove the winner is encoded in the contest helper semantics, not accidental downstream function order.

At minimum:
- Tsuppari / Grip
- Grip / Counter
- Push / Grip
- Grip / Grip.

Do not merely snapshot one participant ordering.

---

# Ring-Out / Movement Safety

Verify:

- short Grip lunge by itself does not introduce false ring-out in ordinary legal setups
- no Grip-specific wall/clamp
- no special ring-out reason
- contact correction does not push the opponent before grapple success
- grapple contact success has negligible/no bond snap.

Tokudawara regression as relevant.

---

# Architecture

Keep:

```
Pure TypeScript Simulation
-> Snapshot
-> WrestlerVisualState
-> Phaser presentation
```

Gameplay contest logic stays under `src/game/sumo/`.

Do not put contest decisions in:
- WrestlerView
- BoutScene
- input layer.

Small explicit helper preferred.

Do not introduce:
- generic Rule Engine
- ECS
- DI
- event bus.

---

# Documentation

Update `docs/ARCHITECTURE.md` to Current Source truth.

Document at minimum:

- Grip reach 8
- minimum success eligibility at 4 elapsed ticks
- short locked-direction lunge
- facing lock during reach only
- contact-driven success
- no margin-based Grip success
- explicit Grip contest relationships
- failure -> Grip recovery
- Grip > Counter -> neutral/no Kuzushi
- Grip vs Grip symmetry
- target eligibility during Push/Tsuppari startup/recovery
- ACTION-11A attempt art remains provisional presentation.

Do not promote Grip attempt art in WRESTLER_PRODUCT_ART_SPEC.

---

# Scope

## In Scope

- Grip 8-tick lunge
- Grip direction state
- minimum attempt 4
- contact-driven success
- explicit Grip contest helper
- Tsuppari > Grip
- Push > Grip
- Grip > Counter
- Grip vs Grip timing-gap fix
- tests / docs / browser smoke
- User Play Test.

## Scope Out

Do NOT:

- change Push tuning
- change Tsuppari tuning
- change Counter timing/tuning
- change Kuzushi tuning
- change Grapple/Drive mechanics
- change same-participant input priority
- implement Grip success art
- implement hand VFX
- promote Grip attempt art
- change Push/Tsuppari recovery grabbability
- change Push/Tsuppari startup grabbability
- add recovery punish beyond current behavior
- modify PROJECT_HANDOFF.md.

---

# Stop Conditions

STOP if:

- explicit Grip contest cannot be implemented without broad combat framework
- participant order changes any required result
- contact-driven Grip success requires changing body radius/contact rules
- preserving Push/Tsuppari/Counter accepted semantics requires retuning them
- minimum 4-tick visibility requires presentation-owned timing
- Grip lunge requires global movement tuning changes
- current Grip attempt art integration must be redesigned
- material conflict with Current Source / accepted ACTION-11B design appears.

---

# Verification

Verification Level:
Heavy

Required:

- focused Grip lunge tests
- focused contest helper tests
- all G/V/C/TG/PG/GC/GG/IK/R/D/P cases
- timing sweeps
- participant-order / role-order checks
- existing Push/Tsuppari/Counter/Kuzushi regression
- Grip/Grapple/Drive regression
- ring-out/contact regression
- ACTION-11A presentation regression
- `pnpm test`
- `pnpm build`
- `git diff --check`
- browser/runtime smoke
- prove Product art assets unchanged.

Do not report Overall PASS if any required case is not run.

---

# Browser / Runtime Smoke

Required.

At minimum observe:

1. Enter starts Bout
2. Shift visibly shows Grip attempt pose
3. Grip moves forward a short step
4. already-touching Shift still shows attempt before success
5. after ~4 ticks, contact can become grapple
6. Grip whiff completes lunge then recovery
7. Grip direction/facing do not home
8. Tsuppari hit cancels Grip attempt
9. Push impact cancels Grip attempt
10. Grip catches active Counter into neutral grapple
11. Counter loser does not become Kuzushi
12. Grip on Kuzushi becomes Morozashi
13. simultaneous Grip attempts become neutral grapple
14. Push / Tsuppari / Counter visuals remain correct
15. R restart works
16. no console/runtime errors.

Capture representative screenshots/logs for:
- early Grip attempt before success
- Grip success after minimum attempt
- Tsuppari beats Grip
- Push beats Grip
- Grip beats Counter
- Grip vs Grip neutral.

---

# User Play Test

REQUIRED.

Primary questions:

1. Does Shift now visibly feel like a short grab-in step?
2. Is ~0.10 m lunge distance right?
3. Are 4 minimum attempt ticks enough to read the attempt pose?
4. Does contact-based Grip feel more natural than old 0.79 m range?
5. Does Tsuppari > Grip feel intuitive?
6. Does Push > Grip feel intuitive?
7. Does Grip > Counter feel intuitive?
8. Does Grip vs Grip resolve naturally?
9. Does the four-way cycle feel understandable:
   `Push > Tsuppari > Grip > Counter > Push`?
10. Does preserving Push/Tsuppari startup/recovery as non-grabbable feel acceptable?
11. Do Counter / Tsuppari / Push / Kuzushi still feel readable?

Technical PASS does not constitute Game Feel acceptance.

---

# Implementation Evidence Required

Completion Report must include:

| Design Requirement | Implemented As | Verified By |
|---|---|---|

At minimum:

- Grip 8-tick lunge
- minimum attempt 4
- contact success
- facing/direction lock
- contest helper
- Tsuppari > Grip
- Push > Grip
- Grip > Counter
- Grip vs Grip
- Kuzushi/Morozashi
- resolver-order independence
- existing systems preserved.

---

# Completion Report

Include:

- Result
- exact constants
- final Grip action shape
- exact FREE tick resolution order
- measured lunge travel / peak speed
- attempt-visible snapshots
- full pair matrix results
- timing sweep results
- participant-order results
- contact/bond-snap measurements
- regression results
- browser smoke
- Design Deviations
- Unexpected Scope
- User Play Test: REQUIRED
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

`feat(gameplay): add grip lunge contest rules`

Do not modify:

- `main`
- `PROJECT_HANDOFF.md`
- `CURRENT_TASK.md`.

# Final Instruction

Implement ACTION-11B's accepted design with:

```
Grip reach = 8 ticks
minimum attempt = 4 ticks
contact-driven success
short locked-direction lunge
```

and explicit deterministic Grip contest semantics:

```
Tsuppari > Grip
Push impact > Grip
Grip > Counter
Grip / Grip -> neutral
```

while preserving all accepted Push / Tsuppari / Counter / Kuzushi / Grapple / Drive behavior outside these approved interactions.
