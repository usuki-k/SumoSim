Task-ID: ACTION-05-GRIP-ENGAGEMENT-MOROZASHI-INVESTIGATION
Status: REVIEWED
Task-Type: INVESTIGATION / GRAPPLE STATE DESIGN
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: d72f43b0887203095eebe3f1c7efb1d1193a188d
Handoff-Mode: GITHUB

# ACTION-05 — Grip / Engagement / Morozashi Investigation

## 1. Purpose

ACTION-04A1 / 04A2により、CounterとKuzushi、およびBest→rear / Success→sideの位置優位がCurrent Baselineとして成立した。

UserはKuzushiの次のRewardとして、Grip / 組みへ接続したい。

新しいUser intent:

- 通常のGrip成功 → 通常の組み状態
- **Kuzushi中の相手へ有効なGripを行った場合 → 通常の組みより一段有利な「もろ差し」状態**
- もろ差し:
  - 両腕を相手の腕の内側に入れた有利な組み
  - 通常の組みより、↑の寄り切りDriveを大きくしたい
  - 通常の組みより、投げの成功率を高くしたい

このTaskでは、Gripを実装する前に、

- Engagement stateのSource of Truth
- normal grapple と morozashi の表現
- Kuzushi → Morozashi transition
- Grip input / range / conflict semantics
- GRAPPLED時のmovement / facing / contact ownership
- 将来のDrive / Throw / Liftとの接続

を設計する。

**Investigation Only / No Production Fixes.**

Production Source / package / lockfile / AGENTS / ARCHITECTURE / GAME_CONCEPTは変更しない。
Repository変更は `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md` のみ。

## 2. Accepted Current Baseline

Accepted Production Source:

`d72f43b0887203095eebe3f1c7efb1d1193a188d`

Current develop上のそれ以降はReview / User Play Test / coordination recordsのみ。

Preserve:

- screen/world-relative WASD
- ACTION-02B Movement
- ACTION-03A2 Contact
- discrete Push
- incoming / contested Push
- ArrowDown Counter
- Best / Success / Fail timing
- Kuzushi as separate posture
- Kuzushi action/movement lock
- Kuzushi facing freeze
- Kuzushi Push susceptibility concept
- Best → rear relocation
- Success → automatic side relocation
- attacker overshoot exists in Simulation
- automatic side choice is not manual
- Push/Counter/Kuzushi numerical values remain provisional

Accepted future control direction from prior design:

### FREE

Conceptual actions:
- ↑ Push
- ↓ Counter / pull / deflection
- dedicated Grip / Grapple action
- left/right thrust and Custom are future/deferred

### GRAPPLED

Conceptual actions:
- ↑ drive / yorikiri
- ← left throw
- → right throw
- ↓ lift attempt
- Grip/Grapple button = release
- Custom future

### LIFTED

Future:
- lifter owns movement
- lifted participant is dependent
- WASD only during lifted
- then return to GRAPPLED

These are direction-level accepted concepts only. Exact binding / formulas are not yet implemented.

## 3. New User Decisions / Intent

Treat the following as design input.

### D1 — Kuzushi Grip Reward

If a Grip attempt is otherwise valid in range/contact and the target is currently in Kuzushi:

- Grip success is guaranteed
- result should be **Morozashi**, not ordinary grapple

Do not allow Grip from arbitrary distance.
Kuzushi does not bypass the valid Grip geometry/range requirement.

### D2 — Morozashi is a distinct advantageous grapple state

Morozashi is not merely a presentation label.

It must be able to influence future Gameplay rules distinctly from ordinary grapple.

Future intended advantages:

- ↑ drive / yorikiri is stronger than ordinary grapple
- throw success is higher than ordinary grapple

Exact multipliers, probabilities, relevant stats and formulas are **undecided**.

### D3 — Do not implement the numerical advantage yet

This Investigation should determine where these advantages belong architecturally.

Do not invent:

- Morozashi drive multiplier
- throw probability
- relevant Weight / Grapple / LowerBody / Throw stat formulas
- final Grip success formula

## 4. Central Architecture Question — Engagement Source of Truth

Current participant runtime already has:

- position / velocity / facing
- action
- posture

Grip introduces a **relationship between the two participants**.

Investigate whether the canonical Engagement state should be pair-level, for example conceptually:

```ts
type BoutEngagement =
  | { kind: 'free' }
  | {
      kind: 'grappled'
      advantage:
        | { kind: 'neutral' }
        | { kind: 'morozashi'; holderId: ParticipantId }
    }
  | {
      kind: 'lifted'
      lifterId: ParticipantId
      // exact fields deferred
    }
```

or whether another small explicit representation is safer.

Strong constraint:

- do not store duplicated independent "I am grappling" state on both participants if they can disagree
- one Source of Truth for the pair relationship
- do not introduce ECS / generic relationship framework

Answer whether:
- `FREE / GRAPPLED / LIFTED` should be a Bout-level engagement union
- normal grapple should be neutral/symmetric
- Morozashi should identify exactly which participant owns the advantage

## 5. Core Investigation Questions

Inspect Current Source directly before answering.

### Q1 — Engagement state ownership

Recommend the smallest canonical representation for:

- free
- ordinary grapple
- morozashi
- future lifted

Address:

- pair-level vs participant-level ownership
- Snapshot exposure
- setup/reset behavior
- invariant safety

### Q2 — What exactly is ordinary Grip success?

The project has not yet fixed a normal Grip success rule.

Compare minimal Prototype options such as:

A. valid Contact + Grip input always enters ordinary grapple
B. stable target uses a provisional success check; Kuzushi target bypasses it
C. first Prototype makes stable Grip deterministic/guaranteed, leaving probability/stat checks Deferred

Do not silently invent a probability system.

Recommend the smallest first implementation that allows User to test:
- FREE → normal grapple
- Kuzushi → Morozashi

while preserving future stat-based Grip success.

Identify any User decision required.

### Q3 — Valid Grip geometry / range

Define the smallest valid-range rule.

Investigate whether first Prototype should use:

- existing Simulation Contact only
- Contact + relative-facing condition
- another explicit short range

User has already decided that Kuzushi guarantee applies only **after** valid range/contact is satisfied.

Prefer existing Contact if sufficient.
Do not add arm reach/hitboxes unless necessary.

### Q4 — Grip input semantics

Recommend:

- edge-triggered dedicated Grip action?
- hold?
- one press = one attempt?
- behavior while already GRAPPLED (prior direction: same Grip button releases)
- whether Grip can start during Push / Counter / Kuzushi
- whether Grip input can be queued

Exact keyboard binding is currently undecided unless a prior Current Source decision exists.

Do not invent final binding.

### Q5 — Kuzushi → Morozashi timing

Define exact semantics when:

- target is Kuzushi when Grip edge occurs
- target has `ticksRemaining = 0` in the pre-step Snapshot but would recover at tick start
- target recovers on the same tick the Grip is attempted
- Grip starts just before Kuzushi expires

Recommend which state at which point in `BoutSimulation.step()` is authoritative.

Maintain deterministic fixed-tick behavior.

### Q6 — What happens to Kuzushi after Morozashi is established?

This is unresolved and important.

Compare:

A. entering Morozashi consumes Kuzushi immediately → target posture becomes stable, but Morozashi advantage persists
B. Kuzushi timer continues independently while already in Morozashi
C. Grip/Morozashi changes posture to another state

Recommend one.

Consider:
- avoiding double-stacking excessive vulnerability
- preserving the User's reward
- clear state ownership
- future Balance / Throw / Drive

Do not assume User preference if materially subjective.

### Q7 — Position / Contact relationship while GRAPPLED

Current Contact is circle-based and does not bind participants together.

Investigate what minimum rule is needed so "grappled" is meaningful:

- must participants remain at Contact distance?
- may they separate slightly?
- should GRAPPLED constrain relative distance?
- should ordinary WASD still operate for both?
- should movement be pair-coupled only when Drive action occurs?

Do not design a full constraint solver.

Recommend the smallest deterministic Prototype that prevents a GRAPPLED state while bodies freely walk apart.

### Q8 — Facing while GRAPPLED

Current stable participants auto-face each other.

Determine:

- ordinary grapple facing behavior
- Morozashi holder / disadvantaged target facing behavior
- whether pair should share a grapple orientation
- how this interacts with existing Kuzushi facing freeze

Avoid full turn-rate redesign.

### Q9 — Morozashi ownership / symmetry

Morozashi must identify a holder.

Specify expected invariants:

- only A holds Morozashi, or only B
- cannot both own Morozashi simultaneously
- how holder changes, if at all
- whether ordinary grapple is symmetric

Do not design hand-fighting/regrip systems unless required.

### Q10 — Morozashi ↑ Drive architecture

User intent:

- ordinary grapple ↑ = drive / yorikiri
- Morozashi ↑ = stronger drive

Investigate where the modifier should apply.

Compare:
- external acceleration multiplier
- traction/resistance modifier
- self-drive speed
- another small explicit grapple drive rule

Recommend the smallest architecture compatible with:
- future Weight
- LowerBody
- Power
- Kuzushi
- directional side/rear advantage

Do not choose final numeric multiplier.

### Q11 — Morozashi Throw advantage architecture

User intent:

- Morozashi increases throw success.

Throw itself is not implemented yet.

Define only the boundary:

- where throw success resolution should read engagement advantage
- how to preserve deterministic/testable probability later
- whether Morozashi is a modifier/input to a future throw resolver rather than a hard-coded throw branch

Do not implement Throw or PRNG.

### Q12 — Interaction with current side/rear Counter reward

Counter currently gives:

- Best → rear
- Success → side
- attacker Kuzushi

User can then attempt Grip.

Investigate:

- whether ordinary Contact geometry after current relocation is sufficient for immediate Grip
- whether side/rear position should matter independently of Kuzushi for Grip
- whether **Kuzushi alone** is the accepted condition for guaranteed Morozashi in the first design

Do not silently add:
- rear always gives Morozashi even without Kuzushi
- side always gives Morozashi

unless explicitly recommended as a separate future rule.

### Q13 — Interaction with future directional Push advantage

A separate Deferred candidate already exists:

- side/rear Push should be stronger than frontal Push

Do not implement or merge that rule into Grip.

Explain how Engagement / Morozashi should coexist with it without duplicate directional advantage Sources of Truth.

### Q14 — Release semantics

Prior direction:

- while GRAPPLED, Grip/Grapple button releases.

Investigate:

- immediate return to FREE?
- any Recovery/commitment?
- whether Morozashi holder and disadvantaged target may both release
- what happens to velocities / position / facing on release

Keep first Prototype small.

### Q15 — Simultaneous Grip conflict

Define deterministic behavior when both participants press Grip on the same tick while FREE.

Cases:

- both stable
- one Kuzushi
- both Kuzushi

Avoid hidden participant-array-order advantage.

Recommend:
- symmetric ordinary grapple
- Kuzushi/Morozashi priority
- tie rule
or identify User decision required.

### Q16 — Grip while actions are active

Specify behavior if Grip edge occurs during:

- Push Startup / Active / Recovery
- Counter window
- Kuzushi
- existing GRAPPLED
- future LIFTED

Prefer no queue unless a concrete gameplay reason requires it.

### Q17 — Future LIFTED transition

Without implementing Lift, ensure the Engagement model can later support:

- GRAPPLED → LIFTED
- lifter id
- Morozashi/normal grapple history if needed
- return from LIFTED → GRAPPLED

Determine whether return should preserve prior Morozashi ownership or default to ordinary grapple.
If not safely decidable now, mark Deferred/User Decision.

### Q18 — Presentation / debugging needs

Recommend minimal Prototype presentation for later implementation:

- FREE
- GRAPPLED
- MOROZASHI (and holder)
- future LIFTED

Do not build final animation/UI.

State what User must be able to visually distinguish during Play Test.

### Q19 — Automated test matrix for first Grip implementation

Specify focused tests at minimum for:

- FREE → ordinary grapple
- valid Kuzushi Grip → Morozashi
- invalid range does not Grip even if Kuzushi
- Morozashi holder identity
- simultaneous Grip
- release
- cannot remain GRAPPLED while spatially separated
- deterministic replay / finite state
- Counter→Kuzushi→Grip integration
- existing Push / Counter / Contact / Movement regression when Grip unused
- no duplicate engagement Source of Truth

### Q20 — User Play Test plan

Define what should be tested after first Grip implementation:

- ordinary Grip readability
- Kuzushi → Morozashi reward readability
- release
- pair movement/contact feel
- whether Morozashi feels clearly advantageous once a temporary Drive difference is eventually added
- whether GRAPPLED state is understandable before final art/animation

### Q21 — User decisions required

Explicitly list any decisions needed before implementation.

Potential candidates:
- normal stable Grip success semantics for first Prototype
- whether Kuzushi is consumed when Morozashi begins
- simultaneous Grip rule
- release commitment
- whether Morozashi survives future Lift cycle

Do not invent preferences.

### Q22 — Minimal implementation sequence

Recommend the smallest next Tasks.

Preferred direction to assess:

1. Grip / Engagement Foundation
   - FREE / GRAPPLED / Morozashi
   - Grip input
   - Kuzushi→Morozashi
   - release
   - minimum spatial coherence
2. Grappled Drive / Yorikiri Prototype
   - ↑ Drive
   - normal vs Morozashi difference
3. Throw / Lift only after Grappled movement is accepted

Do not bundle Grip + Drive + Throw + Lift in one Task.

## 6. State Model Constraints

Maintain:

```
Input / Dummy
    ↓ semantic intent
Pure TS BoutSimulation
    ↓
Bout runtime:
  participant action
  participant posture
  pair engagement
    ↓
Snapshot
    ↓
Phaser
```

Important:

- `action` remains chosen short-term commitment
- `posture` remains physical stability (stable / Kuzushi)
- `engagement` should represent the pair relationship
- do not overload Kuzushi to mean grapple advantage
- do not encode Morozashi as a temporary action if it is a persistent relationship state
- one Source of Truth for Engagement

## 7. Scope Out

Do NOT implement:

- Grip production code
- Engagement production types
- keyboard binding
- GRAPPLED movement
- yorikiri Drive
- Throw
- Lift
- Morozashi multipliers
- Grip/Throw probability
- RNG / seed
- directional side/rear Push advantage
- Ring-out / BoutOutcome
- Weight / Power / LowerBody / Grapple / Throw stat formulas
- animation framework
- new dependency
- generic action/engagement framework

Do not retune:
- Push
- Counter
- Kuzushi
- overshoot
- game speed

## 8. Stop Conditions

Return reportable BLOCKED if:

- Grip cannot be represented without duplicating pair state
- current Contact model cannot support even a minimal Grappled spatial invariant without architecture redesign
- Kuzushi→Morozashi conflicts materially with current posture/action semantics
- LIFTED compatibility forces premature Lift implementation
- normal Grip success semantics require User decision before any safe implementation plan
- Physics/new dependency appears necessary
- source experiment is required before choosing a safe model

Git Safety STOP follows AGENTS.md and writes nothing.

## 9. Investigation Method

Inspect at minimum:

- `src/game/sumo/BoutTypes.ts`
- `src/game/sumo/BoutSimulation.ts`
- `src/game/sumo/BoutSimulation.test.ts`
- `src/game/sumo/BoutCounter.test.ts`
- `src/game/sumo/BoutCounterPosition.test.ts`
- `src/game/input/pressLatch.ts`
- `src/game/input/pushDummyController.ts`
- `src/game/scenes/BoutScene.ts`
- `docs/ARCHITECTURE.md`
- `docs/GAME_CONCEPT.md`
- `AGENTS.md`
- Current Final Review / User Play Test Handoff

External sumo reference is optional.
If used, separate:
- real sumo reference
- proposed game abstraction
- accepted project decision

## 10. Verification

Investigation / Design Review.

Required:

- Q1–Q22 answered, or explicit BLOCKED point
- Current Fact / Recommendation / User Decision / Deferred separated
- Production Source unchanged
- package / lockfile unchanged
- repository change only `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- `git diff --check` PASS

`pnpm test` / `pnpm build` not required because Source must not change.

## 11. Completion Report

Use Investigation-only Report Commit Exception.

Minimum:

- Result
- Preflight
- Current Source Findings
- Q1–Q22
- Recommended Engagement State
- Normal Grip semantics recommendation
- Kuzushi→Morozashi transition
- Kuzushi consumption recommendation
- GRAPPLED spatial/facing invariant
- Morozashi Drive boundary
- Morozashi Throw boundary
- simultaneous Grip rule
- release semantics
- future Lift compatibility
- required automated tests
- User Play Test plan
- Rejected / Deferred
- User Decisions Required
- Next Implementation Sequence
- Design Deviations
- Unexpected Scope
- Verification
- Git delivery

Result:
- PASS if a safe implementation direction exists and only explicit User decisions remain
- BLOCKED if a material User decision or architectural prerequisite is required first

## 12. User Play Test

NOT REQUIRED for Investigation.

The report must identify the first implementation Task where Grip / Engagement Feel becomes REQUIRED.

## 13. Git Delivery

If Preflight succeeds and Investigation reaches a reportable conclusion:

- change only `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- explicit stage
- `git diff --check`
- one Report-only commit
- push `origin/develop`
- verify remote SHA / clean working tree

Commit message example:

`docs(agent): investigate grip and morozashi design`

## 14. Final Instruction

This Task ends at Grip / Engagement / Morozashi investigation.

Do not implement Grip, Drive, Throw, Lift, stats, or directional Push advantage.

After Report Commit / Push, stop and report:

「ACTION-05-GRIP-ENGAGEMENT-MOROZASHI-INVESTIGATION が完了し、ChatGPT Review待ちです」


# Final ChatGPT Review

Overall Result: PASS WITH CORRECTIONS / USER DECISIONS REQUIRED BEFORE IMPLEMENTATION

## Reviewed Investigation

- Investigation report commit:
  `41b380c0975d0d5e54448ad3c6b875022d77db7c`
- Agent-Start-Head:
  `771e3e7628c38c20e912eaeb9bd2606f877f8463`
- Investigation diff is Report-only:
  `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- Production Source / package / lockfile / AGENTS / ARCHITECTURE / GAME_CONCEPT are unchanged.
- `main` remains unchanged.

## Current Source Findings Review

Accepted as source-grounded:

- Current runtime has participant-level action/posture but no pair relationship state.
- Current Contact is circle-based and does not bind the pair.
- Current stable participants auto-face each other; Kuzushi freezes facing.
- Existing action input is edge-triggered and non-queued.
- PushDummyController knows action/posture only and will require Engagement-awareness once GRAPPLED exists.
- Counter positional reward plus overshoot can create a small gap on subsequent ticks, so exact Contact-only Grip range would make Counter → Kuzushi → Grip unnecessarily timing-sensitive.

### C-1 — Counter overshoot distance calculation correction

The Report states the Best-case eventual separation from `COUNTER_OVERSHOOT_SPEED = 1.0` and `EXTERNAL_DECELERATION = 8` as approximately:

`1.0² / (2 × 8) = 0.0625 m`

That is the continuous-motion approximation.

Current Simulation decays externalVelocity **before** integrating each subsequent tick, so the actual discrete additional forward travel from a fresh 1.0 m/s overshoot is approximately **0.0544 m** over 8 ticks.

This does not change the design conclusion:
- Contact-only (2 mm slop) is still too strict for an intended follow-up Grip.
- a small explicit Grip range margin remains justified.

Do not use the 0.0625 m value as an exact Current Source fact.

## Accepted Architecture Direction

### Pair-level Engagement Source of Truth

Accept the direction:

```ts
type GrappleAdvantage =
  | { kind: 'neutral' }
  | { kind: 'morozashi'; holderId: ParticipantId }

type BoutEngagement =
  | { kind: 'free' }
  | { kind: 'grappled'; advantage: GrappleAdvantage }
  // future lifted variant
```

Key accepted principles:

- Engagement is one Bout-level pair relationship state.
- Do not duplicate "grappled" state independently on both participants.
- ordinary grapple is symmetric / neutral.
- Morozashi identifies exactly one holder.
- Snapshot exposes a copy of the pair-level Engagement.
- constructor/reset begins FREE.
- no generic relationship framework.

### Kuzushi → Morozashi

Accept the User-intended transition:

- Grip must first satisfy valid Grip geometry/range.
- if target is Kuzushi at the actual Grip **resolution tick**, the result is guaranteed Morozashi with the gripping participant as holder.
- Kuzushi does not allow Grip from arbitrary distance.
- side/rear position alone does not automatically grant Morozashi.
- current Counter reward connects naturally into this because successful Counter creates Kuzushi.

### Morozashi is persistent engagement advantage

Accept:

- Morozashi is not a short action.
- it belongs in Engagement state.
- future Grappled Drive and Throw resolvers may read that advantage.
- no multiplier / probability is chosen now.

### Stable-target normal Grip

Accept as the recommended first Prototype direction, subject to User Decision:

- valid eligible stable target + valid Grip timing/range → deterministic neutral grapple.
- do not invent temporary RNG or stats before the stat system exists.

### Grip range

Accept the need for a named small Simulation-owned range margin rather than exact Contact-only.

For ACTION-05A:
- choose one provisional named `GRIP_RANGE_MARGIN`
- around 0.08–0.10 m is a reasonable initial test range
- the exact number is Prototype tuning
- no arm hitboxes / reach framework

User confirmation is still required.

### Kuzushi consumption

Accept Recommendation A as the preferred architecture, subject to User Decision:

- successful Kuzushi → Morozashi converts the temporary posture reward into persistent engagement advantage.
- target posture becomes stable when Morozashi is established.
- do not keep both Kuzushi vulnerability and Morozashi advantage stacked by default.

This preserves:
- posture = stability
- engagement advantage = grappling relationship advantage

### GRAPPLED spatial ownership

Accept the small first Prototype direction:

- GRAPPLED pair must not freely walk apart.
- a small Simulation-owned bond keeps centers at the combined body-radius Contact distance.
- no general constraint solver.
- normal WASD is suppressed during the first Foundation Prototype.
- future Drive owns deliberate pair movement.
- existing auto-facing can keep the pair facing each other for now.

### Morozashi Drive / Throw boundary

Accept only the architecture boundary:

- future Grappled Drive reads Engagement advantage as one input to its force/drive resolver.
- future Throw resolver reads Engagement advantage as one input to success resolution.
- do not hard-code a separate Morozashi physics system.
- do not choose numeric Drive multiplier / Throw success chance now.
- deterministic probability boundary remains Deferred.

## Corrections

### C-2 — Do not let Grip Foundation silently become an action-interrupt system

The Investigation recommends that Grip may resolve against a target that is:

- Countering
- Push Startup
- Push Recovery
- another Grip attempt

and cancel that target action, while only Push Active is protected.

That is a material new combat-priority rule and has not been decided by User.

For the first ACTION-05A Foundation, the recommended smaller rule is:

**Grip may resolve only when the target is action-idle.**

Therefore:

- target idle + stable → neutral grapple
- target idle + Kuzushi → Morozashi
- target Push / Counter / Grip action → Grip does not resolve on that tick
- the gripping participant's reach window may continue waiting
- if target becomes eligible before reach expires, Grip may resolve then
- otherwise Grip whiffs into recovery

Benefits:

- avoids silently making Grip a Counter/Push-startup interrupt
- keeps Push / Counter accepted action semantics unchanged
- still fully tests ordinary Grip and Kuzushi → Morozashi
- interaction priority can be expanded later from play evidence

If User explicitly wants Grip to interrupt Startup / Recovery / Counter, make that a later explicit decision/task.

This replaces the Report's proposed Q16 target-action cancellation behavior for the Foundation implementation.

### C-3 — Do not require Lift decisions before Grip Foundation

The Report lists UD-8 (whether Morozashi survives a future Lift cycle).

This is valid Deferred design, but it is **not required before ACTION-05A**.

Do not add:
- LIFTED production state
- resumeAdvantage
- Lift preservation semantics
in ACTION-05A.

Decide it when Lift becomes the Current Task.

### C-4 — Keep Momentum normalization narrowly scoped and explicit

The Investigation proposes setting both participants' `externalVelocity` to their pair average when Grapple establishes.

This is acceptable as a first Prototype method to prevent the new bond from immediately fighting unequal existing external velocities.

However:
- current `externalVelocity` is a gameplay velocity component, not yet mass-weighted physical momentum
- therefore do not document this as physically exact momentum conservation.

For ACTION-05A, describe it as:

**pair external-velocity normalization for stable Grapple attachment under the current equal-body Prototype**

rather than a permanent momentum formula.

No mass system should be introduced.

## User Decisions Required Before ACTION-05A

### UD-1 — Stable normal Grip

Recommended:

**valid idle+stable target → deterministic neutral grapple**

No stat/RNG success check yet.

### UD-2 — Kuzushi after Morozashi establishment

Recommended:

**consume Kuzushi immediately**

- target posture → stable
- Morozashi advantage remains in Engagement.

### UD-3 — Foundation target action eligibility

Recommended correction:

**Grip resolves only against an action-idle target in ACTION-05A.**

It does not interrupt Push / Counter / Grip actions.

A reach attempt may wait for target eligibility until its reach window expires.

### UD-4 — Release rights

Recommended:

**either participant may release**

- Grip button while GRAPPLED immediately returns pair to FREE.
- releasing participant pays Grip Recovery.
- if both release same tick, both pay Recovery.
- Morozashi ends on release.

### UD-5 — GRAPPLED WASD

Recommended:

**suppress ordinary WASD during ACTION-05A**

The pair remains attached and stationary except for residual shared/normalized external motion.

Deliberate Grappled movement is introduced with the later Drive Task.

### UD-6 — Grip range

Recommended:

**Contact distance + small explicit range margin**

Initial Prototype range margin:
approximately **0.08–0.10 m**.

Exact value remains tuning.

### UD-7 — Temporary Grip key

Still requires User selection.

Suggested Prototype candidates:
- `Space`: easy dedicated action key, but may later compete with Custom action.
- `G`: explicit Grapple mnemonic and leaves Space available.

No final control scheme is implied.

## Accepted Simultaneous Grip Rule

No further User decision required unless User objects:

- both stable, both valid Grip on same resolution tick → neutral grapple
- one participant Kuzushi → Kuzushi participant cannot initiate; stable participant may gain Morozashi
- both Kuzushi → neither can initiate

Implementation must evaluate simultaneous eligibility symmetrically, not participant-array first.

## Accepted Release / Bond Direction Pending User Confirmation

If UD-4/UD-5 are accepted:

- GRAPPLED Grip edge means release rather than new Grip attempt.
- release does not teleport or alter facing.
- pair returns to normal FREE Contact state.
- GRAPPLED bond keeps distance coherent without a generic solver.
- exact bond correction must be deterministic and symmetric.

## Do Not Reopen

- Kuzushi as participant posture
- Morozashi as distinct advantageous Engagement state
- Morozashi holder identity
- automatic side/rear Counter baseline
- Push / Counter / Contact accepted baselines
- probability/stat formulas now
- directional side/rear Push advantage in this task

## Deferred

- Morozashi Drive multiplier
- Throw success formula
- Grapple stats / Weight / LowerBody interaction
- GRAPPLED free WASD / rotation mechanics
- hand fighting / regrip / advantage switching
- LIFTED state and Morozashi preservation after Lift
- RNG / probability
- directional Push advantage
- final graphics / grapple animation
- Ring-out / BoutOutcome

## Next Implementation Sequence

After UD-1 through UD-7 are confirmed:

1. **ACTION-05A Grip / Engagement Foundation**
   - pair-level FREE / GRAPPLED neutral / Morozashi
   - Grip edge with reach / recovery
   - idle-target eligibility
   - normal Grip
   - Kuzushi → Morozashi and Kuzushi consumption
   - small range margin
   - simultaneous Grip symmetry
   - minimum Grapple bond
   - ordinary WASD suppression
   - release
   - Dummy Engagement-awareness
   - minimal debug presentation
   - User Play Test REQUIRED

2. Review ACTION-05A before any Drive implementation.

3. Then choose whether:
   - minimal Ring-out/BoutOutcome must precede Drive testing, or
   - Grappled Drive can first be tested as displacement-only.

Do not automatically proceed to Throw/Lift.
