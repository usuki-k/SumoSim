Task-ID: ACTION-05-GRIP-ENGAGEMENT-MOROZASHI-INVESTIGATION
Status: READY
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
