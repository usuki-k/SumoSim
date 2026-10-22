Task-ID: ACTION-10B-PUSH-CHARGE-IMPLEMENTATION
Status: REVIEWED
Task-Type: CORE GAMEPLAY IMPLEMENTATION / MOVEMENT-COLLISION-PUSH
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: f58c3448f32b2dc79fb800d5e664633627ac0716
Review-Handoff: ACTION-10A investigation accepted; User explicitly selected Option B with PUSH_CHARGE_TICKS = 24
Handoff-Mode: GITHUB

# ACTION-10B — Push 24-Tick Straight Charge + 8-Tick Impact

## Purpose

Implement the User-selected ACTION-10A Option B.

ArrowUp / Push becomes a long, committed straight-line charge:

```
ArrowUp press
-> startup
-> charge in the press-time facing direction
-> first body contact opens an 8-tick impact window
-> Push force / Counter interaction occurs only in that impact window
-> if the charge misses, the attacker runs the full commitment
-> recovery
```

The selected charge length is:

```
PUSH_CHARGE_TICKS = 24
```

At the current movement model, the investigated open-space full-action travel is approximately:

```
0.938 m
~= 7.41x the old full Push travel
```

This value is intentionally longer than the original ~3x idea because the User selected the version that can produce a natural whiff self-ring-out near the dohyo edge.

This is a Core Movement / Collision / Push change.
Game Feel requires User Play Test after technical verification.

---

# User Goal / Risk-Reward

The intended Push identity is:

> Strong committed straight-line rush.  
> If the opponent stays in the line, the attacker can drive them out near the edge.  
> If the opponent reads it and sidesteps, the attacker cannot home toward them and may run out of the dohyo.  
> If both wrestlers Push into each other, their Push force can cancel and they can contest the collision.

Do NOT interpret this as:

- sidestep always causes self-ring-out
- hit always guarantees opponent ring-out
- Push force becomes 7.4x stronger.

The long charge increases commitment / reach.
The impact force duration remains bounded to the current 8 ticks.

---

# Accepted Investigation Design

Use ACTION-10A Option B.

Preserve the architecture:

```
Pure TypeScript Simulation
-> canonical action / position / facing / contact / outcome
-> Snapshot
-> Phaser presentation
```

Do not use Phaser Physics.

Do not add:
- homing
- target snapping
- special dodge state
- dodge invulnerability
- bespoke tackle collision
- ring-edge braking
- auto clamp
- Push-specific ring-out rule.

Existing circle contact and existing ring-out own those results.

---

# Timing

Use:

```
PUSH_STARTUP_TICKS = 6        // unchanged
PUSH_CHARGE_TICKS = 24        // NEW, selected by User
PUSH_IMPACT_TICKS = 8         // current Push force duration
PUSH_RECOVERY_TICKS = 10      // unchanged
```

Preferred:
- rename the old `PUSH_ACTIVE_TICKS = 8` to `PUSH_IMPACT_TICKS = 8` if this can be done as a clean single-owner rename
- do not keep two independent constants for the same 8-tick impact duration.

If a compatibility alias is truly necessary for a public/internal API reason:
- explain why
- keep exactly one numeric Source of Truth
- report it as a Design Deviation if semantics are materially different.

Do NOT change:

```
PUSH_EXTERNAL_ACCELERATION = 26.25
FORWARD_ACCELERATION = 10
MAX_SPEED = 3
STOP_DECELERATION = 24
EXTERNAL_DECELERATION = 8
MAX_EXTERNAL_SPEED = 3
```

---

# Push State

Keep the existing explicit small Push state.

Preferred minimal shape:

```ts
{
  kind: 'push'
  phase: 'startup' | 'active' | 'recovery'
  ticksRemaining: number
  direction: Vec2
  impactTicksRemaining: number | null
}
```

Meaning:

- `direction`
  - locked from canonical `facing` when Push begins
  - never retargeted during this Push
- `impactTicksRemaining === null`
  - no impact has started yet
- positive `impactTicksRemaining`
  - first body contact has happened
  - this is the current Push force / Counter impact window.

Do not add:
- target participant id
- hit flag duplicated elsewhere
- homing state
- generic timeline/state-machine framework.

An equivalent equally-small representation is acceptable only if it preserves all semantics below.
Report any representation change.

---

# Startup

During startup:

```
6 ticks ~= 0.10 s
```

Preserve current behavior:

- no free steering
- grounded braking / zero effective Move
- no Push force
- no impact window yet
- canonical facing remains the press-time direction once Push has started.

After startup:
- enter the committed charge.

---

# Charge Movement

During Push active/charge before impact:

- use the already stored press-time `direction`
- ordinary WASD is ignored
- use the existing grounded movement model
- do not change acceleration / max speed
- no target tracking
- no steering toward opponent.

Maximum no-contact charge duration:

```
24 ticks ~= 0.40 s
```

Expected investigated free-space values:

- charge travel ~= 0.775 m
- full action including recovery ~= 0.938 m
- peak self speed = 3.0 m/s.

Verify actual implementation values.

Do not hardcode displacement.

---

# First Contact Opens Impact Window

The first actual Simulation body contact while the Push is in its charge-active state opens:

```
impactTicksRemaining = PUSH_IMPACT_TICKS
```

The impact window must open on the same logical tick as the first contact, before:

- Counter resolution
- Push force resolution
- Push-vs-Tsuppari coupled force resolution.

Therefore the first contact tick can:

- be Counter Best
- apply Push force
- participate in Push-vs-Push
- participate in Push-vs-Tsuppari.

Do not delay impact until the following tick.

If Push starts from ordinary body contact:
- the first active/charge tick should open impact immediately
- its contact-start behavior should reproduce the accepted/current 8-tick impact baseline.

---

# Impact Window

Once impact opens:

```
PUSH_IMPACT_TICKS = 8
```

For those 8 ticks:

- attacker remains committed to stored Push direction
- existing contact logic remains authoritative
- Push force only applies on ticks with actual contact
- window counts down even if contact later separates
- do not reopen or reset the window on later re-contact
- when the 8-tick impact window expires, enter recovery immediately.

The remaining unused no-contact charge budget does not resume after impact.

This is important:

```
first contact
-> bounded 8-tick impact commitment
-> recovery
```

not:

```
first contact
-> 8-tick force
-> resume unused 24-tick charge
```

---

# Whiff / Miss

If no impact ever opens:

- attacker completes all 24 charge ticks
- attacker does not stop because the opponent moved away
- no Push force occurs
- enter recovery after charge limit
- existing velocity/braking then determines the final coast.

This committed miss is required.

---

# Facing

ACTION-10A confirmed:

- movement direction is already locked correctly
- canonical facing currently rotates toward the sidestepping opponent, creating a sideways-slide visual mismatch.

For ACTION-10B:

**freeze canonical facing for the entire Push action.**

While:

```
action.kind === 'push'
```

do not auto-turn toward the opponent in FREE `updateFacing()`.

This includes:

- startup
- charge / impact
- recovery.

Use the canonical Simulation facing only.

Do NOT:
- derive a separate sprite-facing in Phaser
- add a second facing Source of Truth.

When Push returns to idle:
- existing FREE facing behavior may snap toward the opponent on the normal next update.
- do not add facing interpolation in this Task.

User Play Test will judge whether the recovery-end snap is acceptable.

---

# Contact / Collision

Keep existing Simulation circle contact.

Do not change:

- body radius
- CONTACT_SLOP
- overlap correction
- inward self-velocity removal
- tangential velocity preservation.

Therefore:

- early sidestep can produce MISS
- late sidestep can produce HIT
- glancing contact may preserve tangential movement
- there is no special tackle hitbox.

---

# Counter

Preserve accepted Counter results and CounterTransition semantics.

A Push may be Countered only when:

```
impact window is active
AND
actual body contact exists
```

Do not allow Counter to catch the long no-contact run-up.

Counter tier timing must be relative to the impact window, not the 24-tick charge start.

Required:

```
first impact ticks 0..2
-> Best

later impact ticks
-> Success
```

Use the existing:

```
COUNTER_BEST_TICKS = 3
```

Do not change:

- Counter window
- Best / Success meaning
- CounterTransition
- side / rear results
- Kuzushi
- stagger distance
- transition duration.

A first-contact Counter after a long run-up must still be able to be Best.

---

# Push Force

Preserve current contact Push force.

Do not change:

```
PUSH_EXTERNAL_ACCELERATION = 26.25
```

Representative contact-start baseline to preserve:

```
force ticks = 8
receiver / pair shove ~= 0.5325 m
receiver peak external velocity ~= 2.566667 m/s
```

Treat small floating-point-equivalent differences according to existing test tolerance.

Do NOT multiply Push force by the 24-tick charge length.

Charge reach and impact strength are separate.

---

# Push vs Push

Preserve the existing net rule.

If both wrestlers' impact windows are active in contact:

```
A Push = +1
B Push = -1
net = 0
```

so the Push external-force contribution cancels.

Required gameplay scenario:

> Both wrestlers charge directly into each other and their impact windows open on collision; neither receives the one-sided Push shove simply because the other charge was longer.

Do not add:
- mass advantage
- collision bounce
- special tackle clash.

Those are Deferred.

Note:
their self movement/contact correction still resolves normally.
"Push force cancels" does not mean every position/velocity value must become zero.

---

# Push vs Tsuppari

Preserve current coupled semantics, but couple only while a Push impact window is active.

Do not treat the whole 24-tick charge as active Push force.

Required:

- impact window length remains 8 ticks
- Tsuppari before body impact is handled as ordinary Tsuppari, subject to its existing rules
- Tsuppari during active impact/contact uses current coupled share
- do not retune `TSUPPARI_COUPLED_SHARE`
- do not retune Tsuppari reach / impulse / timing.

---

# Kuzushi

Preserve ACTION-09B exactly.

When a Kuzushi receiver takes the first qualifying Push force:

- first force tick uses `KUZUSHI_FOLLOWUP_FORCE_MULTIPLIER = 1.5`
- Kuzushi is consumed that tick
- later impact ticks are 1.0x.

The 24-tick run-up does not consume Kuzushi by itself.

Non-contact does not consume Kuzushi.

Do not redesign the sweat.

---

# Ring-Out / Self-Ring-Out

Use existing `resolveArenaRingOut` only.

No special self-ring-out rule.

Required miss scenario from ACTION-10A:

- attacker and defender start separated by ~0.8 m on a near-edge chord
- defender is approximately 0.1 m inside the boundary
- defender reads Push and sidesteps inward early enough to avoid contact
- attacker continues the committed 24-tick charge
- attacker crosses the allowed boundary during charge/recovery
- existing ring-out declares attacker loser.

Also verify:

- safely central whiff remains ongoing
- Tokudawara uses its existing allowed-radius behavior
- no wall / auto brake is introduced.

---

# Direct-Hit Near-Edge Reward

Verify the complementary risk/reward scenario.

Use a deterministic near-edge fixture where:

- defender is approximately 0.1 m inside the ordinary allowed boundary
- attacker is on the inward side and charges directly toward defender
- defender does not evade
- defender is not Push-countering.

Expected gameplay goal:

- charge makes contact
- 8-tick impact force applies
- defender is driven outward
- existing ring-out can produce a defender loss
- attacker should not need a special "tackle win" rule.

If exact chosen fixture geometry does not produce the defender ring-out:
- do not silently increase Push force
- report the exact measured result
- STOP before retuning force.

The point of ACTION-10B is to test the accepted 24/8 design, not to add extra shove tuning.

---

# Near-Edge Push-vs-Push Tradeoff

Verify a corresponding near-edge clash fixture:

- defender is near the boundary
- attacker charges outward toward defender
- defender also Pushes toward attacker in time for both impact windows to contest the collision.

Expected:

- both impact windows open
- Push external-force net cancels while both are active
- defender is not simply launched outward by the attacker's one-sided Push force.

Do not guarantee "no ring-out under every geometry".
Ordinary self movement, contact correction and existing ring-out still apply.

Report the actual result.

---

# Dodge Verification

Use ordinary Move only.

No dodge mechanic.

Re-run the ACTION-10A 24-tick matrix or an equivalently complete deterministic matrix for:

center separations:

```
0.80 m
0.90 m
1.00 m
1.10 m
```

reaction start:

1. same tick Push is accepted
2. first charge tick after startup
3. charge + 3 ticks
4. charge + 6 ticks.

For every case report/verify:

- HIT / MISS
- first contact tick if any
- whether impact opened
- minimum center distance
- whether Push force occurred
- final attacker continuation on a miss.

Required qualitative pattern:

- early reads have real MISS outcomes
- late reactions have real HIT outcomes
- no homing
- no special invulnerability.

Do not force every distance into the same result.

---

# No-Homing Verification

For at least one sidestep scenario, prove:

- stored Push direction remains constant
- self movement stays on the locked direction except ordinary collision/contact effects
- canonical facing remains frozen to the Push direction
- defender lateral Move does not retarget attacker.

---

# Presentation

Do not add a dedicated Push sprite or animation in this Task.

Existing Product art remains unchanged.

Presentation should simply render the canonical Snapshot:

- body follows canonical facing
- because Simulation facing is frozen during Push, the body should visually face the charge direction.

No:
- camera shake
- impact flash
- new sprite
- scale/stretch
- trail.

Those can be evaluated after gameplay feel is accepted.

---

# Push Visual State / phaseProgress

Current `WrestlerVisualState` exposes:

- `pose = push`
- `pushPhase`
- `phaseProgress`.

Update it only as needed to truthfully represent the new Push timing.

Do not make Presentation own gameplay timing.

If `impactTicksRemaining` is exposed in Snapshot:
- use the canonical Push state to derive any active progress semantics.

Preferred meaning:

- startup progress follows 6 ticks
- before impact, active progress may represent 24-tick charge progress
- after impact opens, active progress may represent the current 8-tick impact progress
- recovery progress follows 10 ticks.

If preserving a single continuous active progress is simpler and does not misrepresent gameplay, document it.

Do not add a Presentation timer.

---

# Snapshot / Copy Semantics

If Push state gains `impactTicksRemaining`:

- expose it in `ParticipantActionState`
- deep-copy it in Snapshot like current Push direction
- Snapshot mutation must not affect Simulation
- invariants must be explicit:
  - null before first impact
  - positive while impact active
  - Push exits to recovery when it reaches 0.

Do not expose a redundant target/hit state.

---

# Scope

## In Scope

- 24-tick committed Push charge
- first-contact 8-tick impact window
- Push state extension needed for that window
- Push facing freeze
- Counter timing from impact start
- Push-vs-Push preservation
- Push-vs-Tsuppari preservation
- ACTION-09B Kuzushi preservation
- ordinary lateral dodge outcomes
- natural whiff self-ring-out
- direct-hit near-edge verification
- ARCHITECTURE current-truth update
- tests / browser smoke / User Play Test.

## Scope Out

Do NOT:

- retune Push external force
- retune general movement acceleration
- retune body radius
- add special tackle collider
- add homing
- add dodge state
- add stamina/balance/mass
- add bounce
- change Counter results/transition
- change Tsuppari
- change Kuzushi
- change Grip
- change ring-out geometry
- change Tokudawara
- create Push Product art
- add Push VFX/audio/camera
- fix unrelated stale documentation from ACTION-09B
- modify PROJECT_HANDOFF.md.

---

# Required Boundary Cases

All listed cases are required.

## Timing / Travel

M1. startup remains exactly 6 ticks.

M2. no-contact charge has exactly 24 charge ticks.

M3. recovery remains exactly 10 ticks.

M4. open-space total travel is approximately the investigated 0.938 m.

M5. peak self speed reaches existing 3.0 m/s clamp, not above.

M6. no-contact Push returns idle after the expected full action duration.

## Impact

I1. no impact window during startup.

I2. no-contact charge has impact = null throughout.

I3. first body contact opens impact at 8 on the same tick.

I4. first impact tick can apply Push force.

I5. impact counts down once per progressing tick.

I6. losing contact does not reset/pause/reopen impact.

I7. impact expiry enters recovery immediately.

I8. unused charge does not resume after impact.

I9. contact-start Push produces the same 8-force-tick shove baseline as before.

## Facing / No-Homing

F1. facing at Push acceptance is the locked Push direction.

F2. facing stays fixed through startup / active / recovery.

F3. defender sidestep does not rotate attacker facing or stored direction.

F4. after Push returns idle, ordinary facing-to-opponent behavior resumes.

## Dodge

D1-D16. Full 4 separation x 4 reaction-start matrix is executed.

At minimum prove both:
- representative early MISS
- representative late HIT.

## Counter

C1. no-contact charge cannot be Counter-caught.

C2. first contact opens impact before Counter resolution.

C3. first three impact elapsed ticks are Best.

C4. later impact ticks are Success.

C5. a long run-up does not prevent first-contact Best.

C6. Counter result/transition/Kuzushi semantics remain unchanged.

## Push vs Push

PP1. simultaneous/contact impact windows can cancel net Push force.

PP2. longer run-up alone does not multiply Push force.

PP3. participant ordering does not change the symmetric clash result.

## Push vs Tsuppari

PT1. no-contact charge is not treated as Push-force coupling.

PT2. impact/contact uses existing coupled semantics.

PT3. coupling duration is bounded by the 8-tick impact window.

## Kuzushi

K1. charge without impact does not consume Kuzushi.

K2. first qualifying Push impact on Kuzushi is 1.5x.

K3. Kuzushi is consumed on that first force tick.

K4. later impact ticks are ordinary 1.0x.

## Ring-Out

R1. central whiff remains IN / ongoing.

R2. selected near-edge early sidestep fixture produces attacker self-ring-out naturally.

R3. ring-out reason is existing `ring-out`; no special reason/state.

R4. Tokudawara path uses existing allowed-radius behavior.

R5. direct-hit near-edge fixture is measured; expected goal is defender ring-out without extra force tuning.

R6. near-edge Push-vs-Push fixture is measured; while both impact windows are active, net Push external-force contribution cancels.

## Regression

G1. Counter Product 35-degree body-sabaki unchanged.

G2. Kuzushi sweat unchanged.

G3. Tsuppari Product art/gameplay unchanged except expected new encounter opportunities from charge reach.

G4. Grip/Grapple unchanged.

G5. idle movement globals unchanged.

G6. Product asset hashes unchanged.

---

# Verification

Verification Level:
Heavy

Required:

- focused Push charge state tests
- free-space movement tests
- contact/impact tests
- complete D1-D16 dodge matrix
- edge/self-ring-out tests
- direct-hit near-edge test
- near-edge Push-vs-Push test
- Counter timing tests
- Push-vs-Tsuppari tests
- Push-vs-Push symmetry/order tests
- ACTION-09B Kuzushi follow-up tests
- ring-out / Tokudawara regression tests
- presentation / facing tests
- `pnpm test`
- `pnpm build`
- `git diff --check`
- browser/runtime smoke
- prove Product art assets unchanged.

Do not report Overall PASS if any required M/I/F/D/C/PP/PT/K/R/G case is not run.

---

# Browser / Runtime Smoke

Required.

At minimum visually/runtime verify:

1. Enter starts Bout
2. ArrowUp visibly commits to a longer forward rush
3. body remains facing the locked charge direction
4. attacker does not rotate toward a sidestepping opponent
5. early lateral Move can evade
6. attacker continues forward after the miss
7. central miss does not ring-out
8. near-edge miss can self-ring-out
9. direct near-edge hit can push defender outward using existing impact force
10. Push-vs-Push clash visibly stalls/contests rather than applying one-sided shove while both impact windows are active
11. long-run first contact can still be Counter Best
12. later impact Counter Success still works
13. Kuzushi first Push impact remains 1.5x and consumes sweat/Kuzushi
14. Tsuppari still behaves correctly outside/inside impact coupling
15. R restart works
16. no console/runtime errors.

Capture representative screenshots/log measurements for:

- early sidestep MISS
- direct near-edge HIT
- near-edge self-ring-out MISS
- Push-vs-Push clash
- long-run Counter Best.

---

# User Play Test

REQUIRED.

Primary questions:

1. Does ArrowUp now feel like a committed forward rush / tackle rather than a tiny shove?
2. Is the ~0.4 s / 24-tick charge readable rather than too long?
3. Can an early left/right Move evade it naturally?
4. Does a late dodge appropriately fail?
5. Does the attacker continuing forward after a miss feel convincing?
6. Is the near-edge self-ring-out risk fun rather than frustrating?
7. Does a direct hit near the edge feel rewarding enough?
8. Does Push-vs-Push feel like a meaningful contest rather than a guaranteed one-sided launch?
9. Does freezing facing make the straight-line intention visually clear?
10. Is the snap back toward the opponent after recovery acceptable?
11. Do Counter / Tsuppari / Kuzushi still feel understandable?

Technical PASS does not constitute Game Feel acceptance.

---

# Documentation

Update `docs/ARCHITECTURE.md` to Current Source truth for Push.

Document:

- 6-tick startup
- 24-tick maximum committed charge
- press-time locked direction
- canonical facing frozen for entire Push
- first body contact opens 8-tick impact window
- impact owns Push force / Counter impact timing
- impact expiry goes directly to recovery
- whiff completes full charge
- ordinary circle contact
- ordinary ring-out including possible self-ring-out
- Push-vs-Push net cancellation
- Counter tier from impact-window elapsed time.

Do not alter unrelated sections except the minimum needed for consistency.

Do not fix the unrelated stale ACTION-09B Grip sentence in this Task.

---

# Implementation Evidence Required

Completion Report must include:

| Design Requirement | Implemented As | Verified By |
|---|---|---|

At minimum:

- 24-tick charge
- 8-tick impact
- first-contact opening order
- impact ends Push into recovery
- facing freeze
- no homing
- ordinary dodge/contact
- self-ring-out
- direct-hit near-edge result
- Push-vs-Push result
- Counter timing
- Tsuppari coupling
- Kuzushi preservation
- presentation ownership.

---

# Completion Report

Include:

- Result
- exact constants
- final Push state shape
- exact first-contact / impact update order
- measured free-space travel
- measured contact-start shove
- D1-D16 dodge results
- direct-hit near-edge result
- whiff self-ring-out result
- near-edge Push-vs-Push result
- Counter Best/Success results
- Push-vs-Tsuppari result
- Kuzushi result
- facing/no-homing evidence
- full verification
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

# Stop Conditions

STOP if:

- 24-tick charge cannot reproduce the investigated committed travel without changing global movement tuning
- first-contact impact cannot open before Counter/force resolution without broad architecture changes
- preserving 8-tick impact requires changing accepted Push force
- ordinary circle contact cannot reproduce the dodge behavior
- natural self-ring-out requires a special ring-out rule
- Push-vs-Push cancellation requires new mass/bounce semantics
- Counter/Kuzushi accepted semantics require redesign rather than timing-source adaptation
- implementation requires Phaser Physics
- Current Source materially conflicts with this Task.

For the direct-hit near-edge fixture:
- if existing 8-tick Push force is not enough to create the expected defender ring-out, report and STOP before retuning force.

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

`feat(gameplay): add committed push charge`

Do not modify:

- `main`
- `PROJECT_HANDOFF.md`
- `CURRENT_TASK.md`.

# Final Instruction

Implement the User-selected ACTION-10A Option B with:

```
startup = 6 ticks
maximum charge = 24 ticks
first-contact impact = 8 ticks
recovery = 10 ticks
```

Lock movement direction and canonical facing for the Push.

Keep impact force bounded to the accepted 8-tick Push behavior.

Use ordinary Move + circle contact for sidesteps and ordinary ring-out for both defender push-outs and attacker whiff self-ring-outs.


---

# ChatGPT Review Handoff

Review-Date: 2026-10-23
Overall Result: TECHNICAL PASS / USER PLAY TEST REQUIRED
Accepted Technical Baseline: ed55d79ccd0907ab5f33f715e75f06956e6047f1

## Reported Implementation vs Design

Accepted as aligned with ACTION-10B.

Confirmed from Current Source / diff:

- PUSH_STARTUP_TICKS remains 6
- PUSH_CHARGE_TICKS = 24
- PUSH_IMPACT_TICKS = 8 and old PUSH_ACTIVE_TICKS numeric ownership was removed/renamed
- PUSH_RECOVERY_TICKS remains 10
- Push state now carries impactTicksRemaining
- press-time direction remains locked
- canonical facing is frozen for the whole Push action
- first contact opens the impact window before Counter / force resolution
- impact expiry enters recovery directly; unused charge does not resume
- a full whiff completes the 24-tick committed charge
- existing circle contact and existing ring-out remain the owners of collision / outcome
- no special dodge, homing, tackle collider, edge brake or Push-specific ring-out rule was added.

## Accepted Technical Push State

Current canonical Push state:

```
{
  kind: 'push'
  phase: 'startup' | 'active' | 'recovery'
  ticksRemaining
  direction
  impactTicksRemaining: number | null
}
```

Semantics:

- `impactTicksRemaining = null`: no impact has opened
- first active-charge body contact opens an 8-tick impact window internally on that same tick
- the first impact tick is consumed within that tick, so the post-step Snapshot normally reports 7
- positive impact value: impact remains active
- impact expiry enters recovery and reports 0 in recovery
- whiff recovery keeps impact null.

This Snapshot convention is consistent with the implementation and tests.

## Movement / Travel

Verified reported free-space result:

- startup: 6 ticks
- no-contact charge: 24 ticks
- recovery: 10 ticks
- full action: 40 applied ticks
- total open-space travel: approximately 0.938333 m
- peak self speed: 3.0 m/s.

This is intentionally about 7.41x the previous full Push travel because the User explicitly selected the natural self-ring-out version.

Do not reduce this to the earlier 14-tick / ~3x proposal unless explicitly requested after Play Test.

## Impact / Push Force

Accepted technical preservation:

- impact window = 8 ticks
- PUSH_EXTERNAL_ACCELERATION remains 26.25 m/s^2
- contact-start representative shove remains approximately 0.5325 m
- receiver peak external velocity remains approximately 2.566667 m/s
- long run-up does not multiply per-tick Push force.

The longer charge changes encounter reach, not the base Push force.

## Facing / No Homing

Accepted technical behavior:

- Push direction is captured from canonical facing at acceptance
- Push direction does not retarget
- canonical facing is frozen during startup / active / recovery
- sidestepping opponent does not rotate the charging wrestler
- after Push ends, normal FREE facing resumes and may snap back toward the opponent.

The recovery-end snap remains a User Play Test question, not a technical failure.

## Lateral Dodge

The full required D1-D16 matrix was executed.

Confirmed qualitative result:

- early reads produce real MISS outcomes
- later reactions produce real HIT outcomes
- ordinary Move only
- ordinary circle contact only
- no dodge invulnerability / special evade state
- whiff attacker completes the committed forward movement.

This satisfies the target "read the charge and sidestep it" mechanically.

## Risk / Reward Near Edge

The required complementary scenarios passed using ordinary ring-out:

### Direct hit

Representative near-edge fixture:

- first contact around tick 13
- existing impact force only
- defender ring-out around tick 19
- no Push force retuning.

Thus the selected design can produce the desired high-reward near-edge direct-hit outcome.

This does NOT mean every hit or every near-edge geometry guarantees a win.

### Early sidestep / whiff

Representative near-edge fixture:

- no contact
- no impact window
- attacker continues full commitment
- attacker ring-out around tick 33 during recovery
- existing reason = ring-out.

No special self-ring-out rule exists.

This is the intended natural risk.

## Push vs Push

Accepted technical result:

- both impact windows can open on the collision
- net Push external-force contribution cancels while both are active
- participant ordering does not change the symmetric result
- representative near-edge clash remained ongoing rather than one side receiving the attacker's one-sided shove.

Important:
Push force cancellation does not imply all self movement/contact correction is zero.

## Counter

Accepted:

- no-contact run-up cannot be caught as Push impact
- first body contact opens impact before Counter resolution
- first impact elapsed ticks 0..2 remain Best
- later impact ticks remain Success
- a long run-up can still be Countered Best on first contact
- existing Counter result / Kuzushi / CounterTransition semantics remain unchanged.

Counter timing is now correctly based on impact timing, not charge-start timing.

## Push vs Tsuppari

Accepted:

- Tsuppari during no-contact run-up is ordinary Tsuppari
- only impact/contact uses Push/Tsuppari coupled semantics
- coupled duration is bounded by the 8-tick impact window
- Tsuppari base reach / impulse / timing are unchanged.

The longer charge creates new encounter opportunities; this is an expected gameplay consequence.

## Kuzushi

ACTION-09B is preserved:

- run-up without impact does not consume Kuzushi
- first qualifying impact Push force on Kuzushi gets 1.5x
- Kuzushi is consumed that tick
- later impact ticks use 1.0x
- sweat remains presentation-derived and unchanged.

## Presentation

No Push Product art / VFX / camera / sound changes were added.

Existing body sprite follows canonical facing, so the Simulation facing freeze now makes the charge visually point along its travel direction.

Product assets remain unchanged.

## Verification Review

Heavy Verification accepted:

- new Push charge suite: 39 PASS
- required M / I / F / D1-D16 / C / PP / PT / K / R / G cases: ALL PASS
- pnpm test: 26 files / 439 PASS
- pnpm build / typecheck: PASS
- git diff --check: PASS
- Product art exporter checks: PASS
- Browser/runtime smoke: 64 / 64 PASS
- Product asset diff: none.

This is sufficient for Technical PASS.

## Unexpected-but-Expected Interaction Change

The updated existing Tsuppari test correctly exposes one semantic consequence of longer reach:

- a pusher knocked backward by Tsuppari during Push startup may still have enough remaining 24-tick charge to return to contact later and open impact
- the previous short 8-tick movement could not reach again.

This follows the accepted committed-charge design and is not treated as a regression.

Do not "fix" this back to the old short-range behavior without a User-directed design change.

## User Play Test

REQUIRED before Gameplay Acceptance.

Judge especially:

1. Does ArrowUp feel like a committed sumo rush / tackle rather than a tiny shove?
2. Is 24 ticks / about 0.4 s of charge readable and enjoyable?
3. Is early lateral evasion achievable in real play?
4. Does late evasion fail in a fair/readable way?
5. Does the attacker continuing forward after MISS feel convincing?
6. Is near-edge whiff self-ring-out fun rather than overly punishing?
7. Is the direct-hit near-edge reward satisfying?
8. Does Push-vs-Push feel like an understandable contest?
9. Does facing freeze make the line of attack clear?
10. Is the snap back toward the opponent after recovery acceptable?
11. Do Counter / Tsuppari / Kuzushi remain readable with the longer charge?

Technical PASS does not accept Game Feel.

## Do Not Reopen Yet

Until User Play Test feedback:

- do not retune 24-tick charge
- do not retune 8-tick impact
- do not retune Push force
- do not add Push animation/VFX/audio/camera
- do not add bounce / mass / stamina
- do not redesign Counter / Tsuppari / Kuzushi to compensate preemptively.

## Documentation Note

The unrelated stale ACTION-09B ARCHITECTURE sentence about Kuzushi Grip remains known documentation debt and was correctly left outside ACTION-10B scope.

## Next Task Constraint

Do not treat ACTION-10B as Game Feel accepted until the User reports the Play Test result.

If accepted:
- 24-tick committed charge + 8-tick impact becomes the current Push baseline.

If rejected/tuned:
- adjust only the specific reported feel issue first; do not reopen the entire Push architecture by default.
