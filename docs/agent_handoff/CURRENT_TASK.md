Task-ID: ACTION-04-DOWN-COUNTER-INVESTIGATION
Status: READY
Task-Type: INVESTIGATION / CORE ACTION DESIGN
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: 730ba8f6fc1fbe8cb8dd939f61e2a67ab0180f17
Handoff-Mode: GITHUB

# ACTION-04 — Down Pull / Deflection Counter Investigation

## 1. Purpose

ACTION-03B / 03B2により、以下がCurrent BaselineとしてUser Play TestでAcceptされた。

- 画面基準WASD
- Contact / Separation
- ArrowUp = 1押下1回のDiscrete Push
- Startup → Active → Recovery
- Push方向固定
- Push中steering lock
- selfVelocity / externalVelocity separation
- incoming Push
- equal-stat simultaneous Pushの拮抗
- Push Dummy validation harness

次は、Userが想定している

- Push（↑）にタイミング良く引き技 / 捌き（↓）を合わせる
- Pushを読んで相手のCommitmentを利用する
- 左右へ躱す回避とCounterを両立させる

ための **Down Counter** を、実装前に設計調査する。

このTaskは Investigation Only / No Production Fixes。

Production Source / package / lockfile / AGENTS / ARCHITECTURE / GAME_CONCEPTは変更しない。
Repository変更は `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md` のみ。

## 2. Accepted Baseline

Accepted Production Source:

`730ba8f6fc1fbe8cb8dd939f61e2a67ab0180f17`

Current develop上のそれ以降はcoordination / review / play-test recordsのみ。

Accepted gameplay baseline:

- Player Push: ArrowUp temporary binding
- Push is edge-triggered discrete action
- one physical press = one Push
- Startup 6 / Active 8 / Recovery 10 ticks are current provisional baseline
- Push direction locks at action start
- Push during action ignores further Push edges
- normal WASD steering suppressed during Push
- Push external momentum uses Model B
- Contact Push Feel accepted
- incoming / contested Push Feel accepted
- simultaneous equal Push feels natural to User
- current Push forward distance feels somewhat short but is explicitly Deferred tuning
- do not tune Push distance in this Task

Current validation harness:

- Mode 1 STATIONARY
- Mode 2 PUSH DUMMY
- deterministic per-tick semantic intents
- not CPU AI

## 3. User Goal for Counter

The intended combat read is:

```
Opponent chooses Push
        ↓
Push has readable commitment
        ↓
Defender can:
  A. match with own Push
  B. move laterally to evade
  C. time Down Counter / pull / deflection
```

The Counter must create a meaningful timing decision.

It must NOT become:

- a permanent guard button
- an automatic rock-paper-scissors hard counter
- a guaranteed "press Down after seeing PUSH = win"
- a hidden archetype matchup rule

The goal is readable action/reaction built from timing, contact, direction, momentum, and later parameters.


## User Design Update — Kuzushi / Counter Outcome / Automatic Side Selection

The following User intent is now part of the Investigation input.

### Kuzushi concept

User wants a Bout Runtime concept of **Kuzushi / 崩し**.

While a participant is in Kuzushi:

- they are vulnerable / effectively unguarded
- they should be easier than normal to Push
- a valid Grip attempt should be guaranteed to succeed
  - this guarantee applies only when the attacker is actually in a valid Grip/contact position
  - it must not allow gripping from arbitrary distance

Do not decide the exact duration, recovery rule, resistance multiplier, or final stat formula yet.

Investigation must determine:

- whether Kuzushi should be a separate runtime posture/state from the current action union
- how it coexists with `idle / push / future counter`
- whether Kuzushi suppresses or limits auto-facing so that side/back positional advantage remains meaningful
- how later Weight / LowerBody / Balance / Stamina can affect entry/recovery without being implemented now

### Desired Counter outcome hierarchy

#### Against Push

If Down Counter succeeds with **Best timing**:

- future target behavior: either
  1. the pull-down immediately decides the bout, or
  2. if the finish check does not decide the bout, the opponent enters Kuzushi and the defender gains the opponent's rear position
- the immediate finish is intended to become parameter-dependent / probabilistic later
- exact probability formula and relevant stats are Deferred

If Down Counter succeeds but is **not Best timing**:

- resolve as a lateral deflection / sabaki
- opponent enters Kuzushi
- defender gains the opponent's side position

#### Against future Harite / slap attack

Harite itself is not implemented in this Task, but Counter architecture must preserve this future result mapping:

- Best success:
  - opponent enters Kuzushi
  - defender gains the opponent's side position
- normal Success:
  - opponent enters Kuzushi
  - no forced positional relocation

Do not implement or fully design Harite production behavior here.
Use this only as an extensibility requirement for Counter result representation.

#### Failed Down Counter

- the Counter user enters Kuzushi

This is intended to make Down a real risk/reward action and prevent safe mashing.

### Timing tiers

Investigation must evaluate an explicit result tier:

- Best
- Success
- Fail

The first implementation should avoid a single-frame / frame-perfect Best window unless there is a strong reason.

Recommend how Best and Success windows relate to the current Push Startup / Active / Recovery phases.

### Automatic side selection — USER DECISION

Manual left/right selection is **not wanted**.

Do not require A/D, another action button, or a follow-up choice to select which side is gained after a successful lateral Counter.

Preferred robust/simple design to investigate:

1. Use the opponent's relevant committed direction basis:
   - for Push, prefer the locked Push direction when resolving the Counter
   - otherwise use a clearly defined facing/direction basis appropriate to that attack
2. Construct deterministic left-side and right-side target positions relative to that basis.
3. Choose whichever candidate is closer to the Counter user's current position at resolution time.
4. If distances are effectively equal, use a deterministic fallback; never randomness.

This is the preferred implementation direction because it:

- requires no extra Player input
- naturally tends to move the defender to the side they were already closer to
- avoids manually encoding “always left” / “always right”
- can remain deterministic and testable
- can generalize later without changing controls

Investigation must compare this with any even simpler automatic geometry rule only if materially useful.

**Do not** choose side based on random chance.

### Rear-position selection

For Best Push Counter that does not immediately finish:

- defender should gain a rear positional advantage automatically
- no manual side/direction choice

Investigation must define a deterministic rear target using the attacker's locked Push direction / appropriate opponent direction basis.

### Positional result safety

For automatic side/rear relocation, Investigation must address:

- target distance from opponent center
- avoiding overlap
- avoiding instant teleport into an invalid ring/contact position
- what to do if the preferred target is outside/invalid near the ring edge
- whether Prototype should:
  - resolve position instantly as gameplay state, or
  - use a short deterministic resolution movement
- how to keep Simulation as the gameplay Source of Truth
- how later presentation/animation can visualize the result without owning the rule

Do not add a generic nav/pathfinding system.

### Finish chance boundary

For Best Push Counter, User wants a future parameter-dependent chance to win by pull-down.

This Investigation must define only the boundary/ownership:

- Simulation owns whether the bout is decided
- outcome must remain deterministic/testable
- do not use uncontrolled `Math.random()`
- if probability is introduced later, recommend a seeded/deterministic random boundary or another explicit deterministic input
- do not choose stat ranges or finish probability formula in this Task

### Counter vs auto-facing

Current auto-facing instantly turns each participant toward the opponent every tick.

Investigation must explicitly solve the conflict:

- if successful Counter puts the defender at the opponent's side/rear,
- the advantage must not disappear one tick later because the Kuzushi opponent instantly auto-faces them.

Compare minimal options such as:

- Kuzushi temporarily suppresses auto-facing
- Kuzushi limits turn rate / delays facing recovery
- another small explicit state rule

Recommend the smallest rule that preserves readable side/rear advantage without redesigning the full facing system.

### Additional required Investigation questions

In addition to Q1–Q14, the Completion Report must answer:

**Q15 — Kuzushi State Boundary**
- separate posture/runtime state vs action state
- entry / exit ownership
- interaction with Push susceptibility and guaranteed valid-range Grip

**Q16 — Best / Success / Fail Result Model**
- how timing tier is represented
- Push result mapping above
- future Harite result mapping without implementing Harite

**Q17 — Side / Rear Position Resolution**
- deterministic automatic side choice
- deterministic rear target
- invalid target / ring-edge handling
- instant vs short deterministic reposition

**Q18 — Kuzushi Facing Rule**
- how side/rear advantage survives current auto-facing
- recovery boundary

**Q19 — Future Finish Chance Boundary**
- deterministic/probabilistic architecture boundary
- no formula/range implementation now

### Additional User Decisions

Already decided:

- side selection is automatic, not manual
- no A/D or extra input for choosing left/right
- preferred initial rule is nearest valid side candidate relative to opponent committed direction, with deterministic tie-break

Still potentially requiring User decision after Investigation:

- first Prototype Counter should be primarily pull-first, deflection-first, or one shared Down Counter result model
- ArrowDown as temporary binding
- exact visible behavior of a whiffed Counter
- whether Best Push Counter Prototype should initially omit the probabilistic instant finish and always produce Kuzushi + rear until parameters/outcome systems exist

Do not invent these remaining preferences.

## 4. Core Investigation Questions

Inspect Current Source directly before answering.

### Q1 — What exactly is Down Counter?

Compare at minimum:

A. Pull / hiki-style:
- defender gives ground / pulls backward
- attacker continues committed forward
- success creates overshoot / positional advantage

B. Deflection / inashi-style:
- defender redirects attacker's force laterally
- success changes attacker trajectory rather than simply pulling backward

C. One generic "Counter" action whose resolved effect depends on geometry / defender movement state

D. Separate actions should eventually exist, but first Prototype should implement only one

Recommend the smallest first Prototype that preserves room for both "pull" and "deflect" later.

Do not silently collapse distinct future techniques if doing so would block expansion.

### Q2 — Input semantics

Recommend whether Down Counter should be:

- edge-triggered discrete action
- short hold window
- another form

Address:

- temporary Prototype binding (likely ArrowDown, but do not assume final control scheme)
- one press = one attempt?
- hold auto-repeat?
- whether input during own Push is ignored
- whether Counter can be queued during Recovery
- whether it uses the existing PressLatch pattern or needs a second small edge latch

Prefer symmetry with accepted Push semantics unless gameplay reason says otherwise.

### Q3 — Counter phase structure

Determine whether Counter needs its own:

- startup
- active/counter window
- recovery

If yes, define semantic roles, not final tuning.

Address:

- how short/long the active window should conceptually be relative to Push Startup/Active
- whether whiffed Counter has meaningful Recovery
- whether successful Counter changes/cuts Recovery
- whether Counter direction locks at action start
- whether normal WASD is suppressed during Counter

Do not fix final tick values unless needed for a concrete prototype recommendation.

### Q4 — Success timing against Push

Define the timing relation clearly enough for later implementation.

At minimum compare:

- success if Counter active overlaps opponent Push Active
- success if Counter active overlaps only the beginning of Push Active
- success based on contact + incoming external acceleration / momentum threshold
- hybrid timing + physical condition

Recommend one.

Clarify:

- too early
- correctly timed
- too late
- Counter after Push has already displaced defender
- Counter against opponent Startup
- Counter against opponent Recovery

Avoid magic frame-perfect rules unless justified.

### Q5 — Contact requirement

Determine whether Counter requires:

- current Contact
- near-contact
- incoming Push contact on the same tick
- can begin before Contact but only resolve on Contact

The design should allow readable anticipation without requiring impossible reaction timing.

### Q6 — Resolution effect on success

This is the main architecture question.

Compare small explicit effects such as:

A. Cancel incoming Push external acceleration and reduce attacker forward selfVelocity.

B. Preserve attacker committed forward selfVelocity while defender removes contact / steps backward, causing attacker to overshoot naturally.

C. Redirect part of attacker's motion into a lateral externalVelocity component.

D. Add a small explicit "counter impulse" to attacker.

Evaluate against:

- current selfVelocity / externalVelocity ownership
- Contact projection
- locked Push direction
- deterministic fixed-step
- future Weight / LowerBody / Balance
- future throw / slap-down / inashi
- Game Feel readability
- complexity

Recommend the smallest rule for Prototype.

Do not add a second physics system.

### Q7 — Failure / whiff semantics

Define what happens when Down is used:

- with no incoming Push
- too early
- too late
- out of Contact
- while opponent just moves normally
- against simultaneous opponent Counter

The action should carry enough commitment that mashing Down is not dominant.

Recommend whether failed Counter:

- simply spends Recovery
- causes backward self-step
- freezes/limits movement
- creates another penalty

Keep it small.

### Q8 — Interaction with lateral evade

User also wants left/right evasion to be a valid response to Push.

Determine whether the current accepted systems already support this sufficiently:

- opponent Push direction is locked
- defender idle can use WASD
- tangential Contact movement exists

If existing WASD is enough for first Prototype, explicitly recommend **no dedicated Dodge action yet**.

If not, explain the concrete missing behavior.

Do not implement/design a full dodge system unless required.

### Q9 — Interaction with simultaneous Push

Current simultaneous equal Push already produces natural contest.

Specify:

- if defender starts Counter while already in own Push, what happens?
- if defender Counters instead of matching Push, how should this differ from Push-vs-Push?
- if both participants Counter, what should happen?
- if one Counters and the other is not Pushing, what should happen?

Avoid hidden priority rules.

### Q10 — Runtime state / type boundary

Recommend the smallest extension of current action state.

Current shape is conceptually:

`idle | push{phase,ticks,direction}`

Assess:

- add `counter{phase,ticks,...}` to same discriminated union
- separate Counter state
- other

Maintain one Source of Truth for participant action.

Address whether Snapshot needs:
- counter phase
- success/whiff marker
- temporary resolution state

Do not create a generic action framework.

### Q11 — Dummy harness for later Play Test

Use the existing PUSH DUMMY if possible.

Recommend the smallest interactive validation setup for Counter:

- Dummy approaches + Pushes predictably
- Player presses ArrowDown
- visible Counter phase text
- optional success marker only if needed

Define what the User should be able to test:

- early Counter
- correct timing
- late Counter
- no-Push whiff
- lateral evade vs Counter
- Push-vs-Push vs Counter-vs-Push

Do not add real AI.

### Q12 — Boundary / automated tests

Specify required implementation tests.

At minimum:

- edge input one attempt
- action timing exact/deterministic
- correct timing success
- too early failure
- too late failure
- no Push whiff
- out-of-contact case
- Push direction lock preserved
- accepted Push-vs-Push behavior unchanged
- lateral movement / Contact regression
- no NaN / overlap
- deterministic replay
- frame-partition-independent edge behavior
- existing Push / Contact / Movement tests unchanged when Counter unused

### Q13 — User decisions required

Identify decisions that must be made by User before Implementation.

Already decided:
- lateral side selection after a successful Counter is automatic, not manually selected
- preferred automatic rule is nearest valid left/right candidate relative to the opponent's committed direction, with deterministic tie-break

Likely remaining candidates:
- Prototype Counter meaning: pull-first vs deflection-first vs a shared Down Counter result model
- temporary key (ArrowDown)
- exact whiff presentation / commitment
- whether the first Best-Push Prototype should defer instant-finish probability and always resolve to Kuzushi + rear until parameter/outcome systems exist

Do not invent User preference.

### Q14 — Minimal implementation sequence

Recommend next 1–3 Tasks.

Possible direction:

1. Counter Implementation Prototype
2. Counter Feel correction if needed
3. only after accepted, decide whether to add dedicated deflection variant / lateral evade changes / Ring-out

Do not bundle Counter + Ring-out + attributes.

## 5. Architecture Constraints

Maintain:

```
Keyboard / Dummy
      ↓ semantic edge + move
Pure TypeScript BoutSimulation
      ↓
Snapshot
      ↓
Phaser Presentation
```

- Phaser Scene is not gameplay rule Source of Truth
- current fixed timestep remains
- accepted Push action semantics remain
- accepted Contact semantics remain
- accepted Movement semantics remain
- selfVelocity / externalVelocity ownership remains unless Investigation finds a Material conflict
- no Physics engine
- no generic Action framework
- no Event Bus / ECS / DI
- no stat system yet

## 6. Scope Out

Do NOT implement:

- Counter production code
- ArrowDown binding
- new action phases in Source
- dedicated Dodge
- thrust left/right
- Ring-out / BoutOutcome
- Weight / Power / LowerBody
- Stamina / Balance
- Tachiai
- Grapple / Throw / Lift
- CPU AI
- animation / VFX / camera / sound
- new dependency
- Push tuning changes

Do not "fix" the short Push distance.

## 7. Stop Conditions

Return reportable BLOCKED if:

- a safe Counter model cannot be selected without User deciding Pull vs Deflection semantics
- Counter requires changing accepted Push semantics materially
- current Model B cannot represent the Counter without architecture redesign
- a dedicated Dodge system is required before Counter can be meaningful
- Physics/new dependency appears necessary
- source experiment is required before choosing design

Git Safety STOP follows AGENTS.md and writes nothing.

## 8. Investigation Method

Inspect at minimum:

- `src/game/sumo/BoutTypes.ts`
- `src/game/sumo/BoutSimulation.ts`
- `src/game/sumo/BoutPush.test.ts`
- `src/game/sumo/BoutSimulation.test.ts`
- `src/game/input/pressLatch.ts`
- `src/game/input/pushDummyController.ts`
- `src/game/scenes/BoutScene.ts`
- `docs/ARCHITECTURE.md`
- `docs/GAME_CONCEPT.md`
- `AGENTS.md`
- previous Final Review / User Play Test Handoff

External sumo references are optional.
If used, clearly separate:
- real-world reference
- proposed game abstraction
- accepted project rule

## 9. Verification

Investigation / Design Review.

Required:

- Q1–Q19 answered, or explicit BLOCKED point
- Recommendation / Rejected / Deferred separated
- User Decisions Required explicit
- accepted baseline vs proposed semantics separated
- Production Source unchanged
- package / lockfile unchanged
- repository change only `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- `git diff --check` PASS

`pnpm test` / `pnpm build` not required because Source must not change.

## 10. Completion Report

Use Investigation-only Report Commit Exception.

Minimum sections:

- Result
- Preflight
- Current Source Findings
- Q1–Q19
- Recommended Counter Semantics
- Recommended Timing Model
- Recommended Success Resolution
- Kuzushi Runtime State / Facing Rule
- Best / Success / Fail result mapping
- Automatic side / rear position resolution
- Future finish-chance boundary
- Failure / Whiff behavior
- Interaction with lateral evade
- Runtime State extension
- Required tests
- Prototype User Play Test plan
- Rejected / Deferred alternatives
- User Decisions Required
- Next Implementation Sequence
- Design Deviations
- Unexpected Scope
- Verification
- Git delivery

Result:
- PASS if a safe recommendation exists and only explicit User decisions remain
- BLOCKED if User decision is required before implementation semantics can be selected

## 11. User Play Test

NOT REQUIRED for Investigation.

Completion Report must identify the first implementation Task where Counter Feel becomes REQUIRED.

## 12. Git Delivery

If Preflight succeeds and Investigation reaches a reportable conclusion:

- change only `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`
- explicit stage
- `git diff --check`
- one Report-only commit
- push `origin/develop`
- verify remote SHA / clean working tree

Commit message example:

`docs(agent): investigate down counter design`

## 13. Final Instruction

This Task ends at Counter investigation/design.

Do not implement Counter.

After Report Commit / Push, stop and report:

「ACTION-04-DOWN-COUNTER-INVESTIGATION が完了し、ChatGPT Review待ちです」
