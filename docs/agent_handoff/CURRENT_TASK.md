Task-ID: ACTION-03A2-CONTACT-CREEP-CORRECTION
Status: REVIEWED
Task-Type: IMPLEMENTATION / FOCUSED CONTACT CORRECTION
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: 02a4047328e560a986d677ea13c890a43607b381
Handoff-Mode: GITHUB

# ACTION-03A2 — Contact Creep Correction

## 1. Purpose

ACTION-03AのContact Foundationは大部分Technical PASSだったが、User Play Test前にBlocking correctionが1点ある。

現状は、moving participantがstationary participantへ毎tick食い込むと、
overlapを常に50/50で対称分離するため、
Push未実装なのにstationary participantが約0.083 m/sでじわじわ移動する。

このTaskではこの **implicit positional Push / creep** だけを修正する。

目標：

- stationary participantへ歩き込んでも、Contactだけではstationary participantを動かさない
- 両者が互いに歩き込んだ場合は、双方のinward contributionに応じてpenetration correctionを分配する
- pre-existing overlap / same-center等でinward contributionが無い場合のみ、50/50 fallbackで安全に分離する
- existing Contact / Movement architectureを維持する

Push / external momentum / mass / Ring-outは実装しない。

## 2. Current Baseline / Review Handoff

Accepted Production Source Baseline:

`02a4047328e560a986d677ea13c890a43607b381`

Current developにはChatGPT Review coordination commitが上にある。
AGENTS.mdのRemote-Task-First Preflightに従い、
Source-Baseline..origin/developの変更が`docs/agent_handoff/`のみであることを確認してFF-onlyすること。

ACTION-03Aで維持するAccepted parts：

- Simulation-owned `bodyRadius`
- Snapshot exposes gameplay body geometry
- `BODY_RADIUS = 0.35 m` provisional
- `CONTACT_SLOP = 0.002 m` provisional
- deterministic contact normal
- same-center fallback
- closing normal self-velocity removal
- tangential velocity preservation
- Pure TypeScript contact core
- fixed timestep
- grounded ACTION-02B Movement baseline
- no Phaser Physics / Matter.js

Blocking finding：

- unconditional 50/50 positional correction creates hidden Push before Push exists

## 3. Required Correction Semantics

Keep the current step architecture.

For overlap correction, use each participant's **inward contribution toward the contact normal for the current tick**.

Normal is A → B.

Conceptually, before removing closing normal velocity:

- `inwardA = max(0, dot(vA, n))`
- `inwardB = max(0, -dot(vB, n))`

These are self-locomotion closing contributions only.

When `overlap > 0`:

### Case A — Only A moved inward

`inwardA > 0 && inwardB == 0`

- Apply the full penetration correction to A
- B position does not move from separation
- Contact still removes A's closing normal velocity

### Case B — Only B moved inward

`inwardB > 0 && inwardA == 0`

- Apply the full correction to B
- A position does not move from separation

### Case C — Both moved inward

`inwardA > 0 && inwardB > 0`

Split overlap proportionally:

- A correction share = `inwardA / (inwardA + inwardB)`
- B correction share = `inwardB / (inwardA + inwardB)`

A moves backward along `-n`.
B moves backward along `+n`.

For equal inward contributions this becomes 50/50.

### Case D — No meaningful inward contribution

Examples:

- invalid/pre-existing overlap in setup
- same-center setup with no movement
- numeric correction state where neither velocity explains the overlap

Use deterministic 50/50 separation fallback.

Do not leave an invalid overlap unresolved.

## 4. Important Ordering

The correction weights must be captured **before** closing normal velocity components are removed.

Current `resolveContact()` may remain one small explicit function.

Recommended internal order:

1. compute contact normal
2. compute inwardA / inwardB from current self velocity
3. remove closing normal velocity components
4. if overlap > 0:
   - choose correction shares from inward contributions
   - fallback 50/50 if contribution sum is effectively zero
   - apply position correction

Do not add a general solver/framework.

## 5. Numerical Safety

Use a small explicit epsilon only where necessary to decide whether inward contribution is effectively zero.

Requirements:

- deterministic
- finite
- no division by zero
- no NaN / Infinity
- exact stationary body remains stationary in one-sided walk-in
- same-center fallback still separates safely
- CONTACT_SLOP behavior unchanged
- resulting circles non-overlapping within numeric tolerance

Do not add mass weighting.

## 6. Do Not Change

Preserve:

- screen-relative WASD
- grounded Movement constants/behavior
- fixed timestep / accumulator
- auto-facing
- Simulation ownership
- body radius
- CONTACT_SLOP
- contact normal rule
- tangential velocity preservation
- Scene Snapshot rendering
- no-contact movement behavior

## 7. Scope

Allowed:

- `src/game/sumo/BoutSimulation.ts`
- `src/game/sumo/BoutSimulation.test.ts`
- `docs/ARCHITECTURE.md` only if Current contact description needs minimal clarification
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

Touch `BoutTypes.ts` / Scene / AGENTS only if strictly required by the correction; otherwise leave unchanged.

New dependency prohibited.

## 8. Scope Out

Do NOT implement:

- Push / press action
- externalVelocity
- impact transfer
- mass / pushForce / traction
- Weight / Power / LowerBody
- Ring-out / BoutOutcome
- Tachiai
- Grapple / Throw / Lift
- Stamina / Balance
- CPU AI
- Physics engine
- contact framework
- CCD
- animation / camera / VFX / audio

This Task is only about removing implicit positional Push from penetration correction.

## 9. Required Automated Verification

All existing 45 tests must continue to pass unless the old creep-finding test is intentionally replaced by the corrected expectation.

Add / update focused tests:

T29. One-sided walk-in against stationary participant
- A moves directly into stationary B for a prolonged period
- B's position remains unchanged within strict tolerance
- A stops at contact
- no overlap
- no jitter

T30. Mirrored one-sided walk-in
- B moves into stationary A
- A remains unchanged
- symmetric behavior by participant role/order

T31. Equal head-on walk-in
- A and B move toward each other equally
- correction remains symmetric
- settle without jitter

T32. Unequal inward contribution
- both move inward with different movement magnitudes / velocities
- penetration correction follows contribution ratio
- higher inward contributor receives larger backward correction
- deterministic and finite

T33. Pre-existing overlap with no movement
- fallback 50/50 separation
- same-center and ordinary overlap both safe
- no NaN

T34. Glancing contact regression
- tangential component preserved
- stationary participant is not spuriously translated by a purely one-sided penetration correction beyond what geometry requires
- circling remains possible

T35. No-contact ACTION-02B regression
- unchanged

T36. Existing CONTACT_SLOP / exact-touch / high-speed / determinism / Phaser-free tests remain PASS.

Remove or rewrite the previous test that intentionally asserted positive stationary-body creep.
The test suite must now assert creep is absent.

## 10. Verification Level

Heavy / Focused Core Contact Correction.

Required:

- `pnpm test` PASS
- `pnpm build` PASS
- `git diff --check` PASS
- T29〜T36 evidence
- existing contact + movement tests PASS
- no new dependency
- no Push / externalVelocity / mass / Ring-out
- Agent Task Diff limited to Scope

### Browser Smoke

Verify at minimum:

- Canvas starts / no runtime errors
- direct walk-in stops at opponent
- stationary opponent does not drift during sustained walk-in
- opposite-side/mirrored contact behaves consistently if practical
- diagonal contact still allows circling
- no resting jitter
- non-contact Movement unchanged
- Player can still leave ring

Technical Smoke does not accept Contact Feel.

## 11. User Play Test — REQUIRED

After Technical PASS, User Play Test becomes ready.

User should verify:

1. Player no longer passes through opponent.
2. Stationary opponent does not visibly drift when merely walked into.
3. Direct contact has no large visual gap.
4. Resting contact has no jitter.
5. Circling around opponent remains possible.
6. Contact is not sticky.
7. Non-contact Movement still feels like accepted ACTION-02B baseline.
8. It is acceptable that no real Push exists yet.

Agent report:

`User Play Test: REQUIRED / NOT RUN`

Do not proceed to ACTION-03B.

## 12. Acceptance Criteria

AC-01: implicit positional Push/creep is removed.
AC-02: one-sided walk-in corrects only the inward-moving participant.
AC-03: mirrored one-sided case is symmetric.
AC-04: two-sided inward motion splits correction by inward contribution.
AC-05: no-contribution overlap uses deterministic 50/50 fallback.
AC-06: closing normal velocity removal remains.
AC-07: tangential velocity remains.
AC-08: CONTACT_SLOP semantics remain.
AC-09: same-center remains finite/deterministic.
AC-10: prolonged resting contact has no jitter.
AC-11: no-contact grounded Movement regressionなし.
AC-12: no Push / externalVelocity / mass / Ring-out.
AC-13: T29〜T36 + existing tests PASS.
AC-14: `pnpm build` PASS.
AC-15: Browser Smoke PASS.
AC-16: User Play Test REQUIRED / NOT RUN.
AC-17: Scope外変更なし.

## 13. Stop Conditions

STOP if:

- Preflight failure
- Current Source / Review conflict
- creep cannot be removed without introducing Push/mass/externalVelocity
- accepted Movement architecture must change
- contact stability requires Physics/CCD at current speeds
- new dependency is required
- task-external User changes / divergence exist

Do not broaden Scope.

## 14. Completion Report

Minimum:

- Result
- Preflight
- Changed Files
- Root Cause
- Corrected Penetration Ownership Rule
- Inward Contribution Calculation
- Fallback behavior
- T29〜T36 + regression tests
- Browser Smoke
- AC-01〜AC-17
- Implementation Evidence
- Design Deviations
- Unexpected Scope
- Known Untested
- User Play Test: REQUIRED / NOT RUN
- Git delivery

Implementation Evidence minimum:

1. one-sided stationary-body no-creep
2. mirrored case
3. proportional two-sided correction
4. 50/50 fallback
5. closing velocity preserved semantics
6. tangential preservation
7. movement/contact regression
8. no Push scope creep

## 15. Git Delivery

Follow AGENTS.md.

Technical PASS:

- Task-owned files only
- tests / build / diff-check
- Completion Report in same Task commit
- 1 Agent Task ≈ 1 commit
- push `origin/develop`
- verify remote SHA / clean working tree

Commit message example:

`fix: prevent contact separation creep`

Do not change main.

## 16. Final Instruction

This Task ends after the Contact creep correction.

Do not continue to Push / external momentum / Ring-out.

After commit / push / Completion Report, stop and report:

「ACTION-03A2-CONTACT-CREEP-CORRECTION が完了し、ChatGPT ReviewとUser Play Test待ちです」


# Final ChatGPT Review

Overall Result: TECHNICAL PASS / USER PLAY TEST REQUIRED

## Accepted Baseline

- Accepted implementation commit for technical review: `c11edc5c6e3ffcb7dcb192b4f80bb5af1243fb72`
- Agent-Start-Head: `417cec630b82e37b675fae04ad8537ea8d2e31c5`
- Agent Task Diff is one implementation commit.
- Changed Production scope is limited to contact correction logic/tests plus Current-State docs and Completion Report.
- Technical Verification is accepted from Completion Report + direct Source/Diff review.
- Contact Feel remains NOT accepted until User Play Test.

## Accepted Decisions

- ACTION-03A Contact architecture remains accepted:
  - Simulation-owned circle body geometry
  - `BODY_RADIUS = 0.35 m` provisional
  - `CONTACT_SLOP = 0.002 m` provisional
  - deterministic normal / same-center fallback
  - closing normal self-velocity removal
  - tangential velocity preservation
  - fixed-step Pure TypeScript ownership
  - no Phaser Physics / Matter.js
- Penetration correction is now assigned by inward self-locomotion contribution:
  - one-sided inward motion → only the inward-moving participant is corrected backward
  - two-sided inward motion → overlap correction is split proportionally to inward contributions
  - equal inward motion → symmetric split
  - no meaningful inward contribution → deterministic fallback
- The focused Case-D refinement is accepted for the current Prototype:
  - if inward contribution is effectively zero but only one participant still has motion, correct that moving participant rather than translating the stationary participant
  - if both/neither are moving, use 50/50 fallback
- This refinement is accepted because it prevents curvature/circling contact from reintroducing slow stationary-body creep.
- Stationary participant drift from Contact-only positional correction is no longer part of the baseline.
- Push / externalVelocity / mass / Ring-out remain unimplemented as required.
- No-contact ACTION-02B grounded Movement remains the accepted baseline.

## Design Deviation Review

Reported deviation:
- Planned: zero-inward Case D always uses 50/50 fallback.
- Implemented: zero-inward + only-one-moving uses full correction on the moving participant.

Review result: ACCEPTED FOR CURRENT CONTACT PROTOTYPE.

Reason:
- preserves the explicit Task goal that Contact alone must not move a stationary opponent
- avoids the measured long-term circling creep
- does not introduce Push, mass, external momentum, or a new framework
- remains deterministic and tested
- does not alter normal one-sided/two-sided inward cases

This is not a permanent physical model. If future Push/traction/mass interaction requires a different contact projection rule, it must be revisited explicitly rather than silently changed.

## Corrections

NONE required before User Play Test.

## Do Not Reopen

- Do not restore unconditional 50/50 separation for one-sided walk-in.
- Do not add Push / externalVelocity / mass before ACTION-03B.
- Do not change accepted grounded Movement to solve Contact issues.
- Do not introduce Physics / CCD without new high-speed evidence.
- Do not treat body radius / slop values as final Rikishi tuning.
- Do not conflate Contact positional correction with actual Push force.

## Deferred

- explicit Push / press input
- externalVelocity / impact transfer
- mass / pushForce / traction
- Weight / Power / LowerBody
- Ring-out / BoutOutcome
- Tachiai / thrust / pull / counter
- Grapple / Throw / Lift
- Stamina / Balance
- CCD for future higher-speed states

## User Play Test

REQUIRED / READY.

User should verify in Browser:

1. Player cannot pass through the stationary opponent.
2. Holding movement directly into the opponent does not visibly drift the opponent.
3. Contact does not leave a noticeable artificial gap.
4. Resting contact does not jitter/shake.
5. Diagonal movement can circle around the opponent.
6. Contact does not feel excessively sticky or like sliding along an invisible square wall.
7. Non-contact grounded Movement still feels like the accepted ACTION-02B baseline.
8. It is acceptable that there is still no real Push response yet.

Additional observation to pay attention to:
- circling may feel very free/frictionless because tangential velocity is intentionally preserved. This is not automatically a bug; User should judge the feel before Push is added.

If accepted:
- ACTION-03A Contact & Separation becomes current baseline.
- Proceed to D1/D2 decisions and ACTION-03B Push & External Momentum.

If rejected:
- record the concrete Contact Feel issue and correct it before Push.

## Regression Risks

- Future Push positional correction being layered on top of Contact correction rather than entering through explicit external momentum.
- Future mass weighting accidentally reintroducing stationary drift.
- Tangential preservation becoming too frictionless once Push is present.
- Higher-speed Tachiai/thrust states invalidating the current no-CCD assumption.
- Contact SLOP becoming visible if body scale/presentation changes.

## Next Task Constraints

1. User Play Test ACTION-03A2 first.
2. Do not create ACTION-03B implementation until Contact Feel is accepted.
3. Before ACTION-03B, obtain User decisions:
   - D1 Push semantic: recommended hold / continuous pressure
   - D2 Prototype Push key: recommended ArrowUp, temporary only
4. ACTION-03B may then introduce externalVelocity / push constants / impact transfer, but must preserve accepted Contact and Movement behavior when Push is absent.
