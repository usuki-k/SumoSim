Task-ID: ACTION-03A-CONTACT-SEPARATION
Status: REVIEWED
Task-Type: IMPLEMENTATION / CONTACT FOUNDATION
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: 29073732a123163bb11e81d7b4b82ac7ffeb5bbd
Handoff-Mode: GITHUB

# ACTION-03A — Contact & Separation

## 1. Purpose

ACTION-03 Investigationで確定した最小Contact Foundationを実装する。

今回の目標は：

- 2人の力士がFREE状態で互いをすり抜けない
- 接触後に重なり続けない
- contact中にガタつかない
- 正面接触では互いに食い込まない
- 斜め接触では回り込み / tangential movementが残る
- ACTION-02BでAcceptされたgrounded Movement Feelを、非接触時に完全に維持する

まで。

Push / impact transfer / external momentum / Ring-outはまだ実装しない。

Technical完了後、User Play TestでContact Feelを確認する。

## 2. Current Baseline / Review Handoff

Accepted Production Baseline:

`29073732a123163bb11e81d7b4b82ac7ffeb5bbd`

Current developにはACTION-03 Investigation ReportとChatGPT Review等のcoordination-only commitsが存在する。

AGENTS.mdのRemote-Task-First Preflightに従い、
Source-Baseline..origin/develop の変更が `docs/agent_handoff/` のみであることを確認してFF-onlyすること。

Accepted current Movement baseline:

- screen/world-relative WASD
- auto-facing opponent
- Pure TypeScript `BoutSimulation` owns canonical position / velocity / facing
- fixed timestep + accumulator
- 60Hz provisional
- semantic movement intent
- logical units: meter / m/s / radian
- grounded movement:
  - forward acceleration
  - grounded stop
  - lateral damping
  - reverse braking
- one-way Snapshot rendering
- Phaser Physics / Matter.js not used
- participant identity separated from control/presentation role
- Movement Feel accepted by User as current baseline

Accepted ACTION-03 Investigation direction relevant to this Task:

- FREE contact uses Simulation-owned circles
- first Prototype uses equal body radius
- simple deterministic two-circle math
- small CONTACT_SLOP
- same-center deterministic fallback normal
- overlap separation is symmetric for equal participants
- closing self-locomotion normal velocity is removed at solid contact
- glancing/tangential movement should remain
- CCD deferred while current fixed-step displacement is safely bounded
- no Push / external momentum / mass attributes yet

## 3. Architecture Constraints

Maintain:

```
Semantic Movement Intent
        ↓
Pure TypeScript BoutSimulation
        ↓ canonical position / velocity / facing / contact geometry
Snapshot
        ↓
Phaser Presentation
```

Rules:

- Contact / separation is Gameplay Core and belongs in Pure TypeScript
- Phaser Scene/GameObjects do not own contact state or gameplay collision geometry
- no Phaser Arcade Physics / Matter.js
- no generic collision framework
- no ECS / DI / Event Bus
- fixed timestep remains unchanged
- ACTION-02B grounded self-locomotion behavior remains unchanged when participants are not in contact

## 4. Gameplay Body Geometry

Introduce Simulation-owned gameplay body radius.

Initial Prototype:

- both participants use the same provisional radius
- initial value may use current presentation value: 0.35 m
- this is not final Rikishi size/balance

The radius must be available in Snapshot/state so Scene can render from gameplay geometry.

Current Scene-side `BODY_RADIUS_METERS` must no longer be the gameplay source of truth.

Preferred direction:

- Simulation has participant `bodyRadius`
- Snapshot exposes it
- Scene uses Snapshot `bodyRadius` for placeholder body rendering

Do not add Height / Weight attributes yet.

Do not derive radius from sprite size.

## 5. Contact Detection

For the two participants:

- let `delta = pB - pA`
- `distance = |delta|`
- `combinedRadius = rA + rB`

Contact detection should support a small provisional `CONTACT_SLOP`:

`distance <= combinedRadius + CONTACT_SLOP`

Purpose:
- stable resting contact
- avoid contact toggling due to tiny floating-point movement

CONTACT_SLOP is provisional tuning and must be reported.

Do not use SLOP to create visible separation gaps.

## 6. Contact Normal

Normal is A → B.

Normal case:

`n = delta / distance`

Same-center case:

If distance is effectively zero, use a deterministic fallback.

Preferred fallback order:

1. participant A's current facing direction, if finite/usable
2. otherwise +x

The result must be deterministic and never produce NaN/Infinity.

Do not use randomness.

## 7. Overlap Separation

After normal movement integration for the tick, if:

`distance < combinedRadius`

resolve overlap by symmetric position correction:

- A moves `-n * overlap/2`
- B moves `+n * overlap/2`

because participants are equal in this Prototype.

No mass weighting yet.

No iteration framework.

For exactly two circles, one explicit projection is sufficient.

After resolution, positions should be non-overlapping within a small numeric tolerance.

## 8. Closing Self-Velocity Removal

When participants are in solid contact, self-locomotion velocity must not continue pointing through the opponent.

Remove only the closing normal component.

Important:

- tangential velocity must remain
- this allows circling / sliding around the opponent
- no bounce / restitution
- no external impulse transfer yet
- no Push effect yet

Conceptually, for A:

- if A's self velocity has positive component toward B along n, remove that normal component
- preserve tangential component

For B, mirror the rule.

Do not zero the entire velocity vector on contact.

Do not modify accepted grounded movement behavior outside contact.

## 9. Step Resolution Order

Within `BoutSimulation.step()`, keep the order small and explicit.

Target order for ACTION-03A:

1. sanitize movement intent
2. update grounded self velocity (existing ACTION-02B rule)
3. integrate positions
4. resolve participant contact:
   - detect overlap/contact
   - compute deterministic normal
   - remove closing normal self velocity
   - separate overlap symmetrically
5. update facing

No Push / external momentum / Ring-out stages yet.

If implementation needs minor ordering adjustment to avoid a verified bug, report it as Design Deviation rather than silently changing semantics.

## 10. Contact Test Harness

Keep the test harness minimal.

Opponent behavior may support:

- stationary opponent
- simple walk-toward opponent

Do not add CPU AI.

A tiny Scene-local or small Pure dummy controller is allowed only if necessary for User Play Test.

Avoid controller framework.

If no additional dummy controller is needed to test contact manually, do not add one.

## 11. Scope

Allowed:

- `src/game/sumo/BoutTypes.ts`
- `src/game/sumo/BoutSimulation.ts`
- `src/game/sumo/BoutSimulation.test.ts`
- small focused contact helper/module only if clearly simpler than keeping logic local
- `src/game/scenes/BoutScene.ts` only for reading/rendering Simulation body radius and minimal contact test support
- focused tests
- `docs/ARCHITECTURE.md` Current State sync
- `AGENTS.md` Current Source sync if necessary
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

New dependency prohibited.

## 12. Scope Out

Do NOT implement:

- Push / press action
- impact transfer
- externalVelocity
- mass
- pushForce
- traction
- Weight / Power / LowerBody attributes
- Ring-out
- BoutOutcome
- Tachiai
- thrust
- pull/counter
- FREE / GRAPPLED / LIFTED state machine
- Grapple / Throw / Lift
- Stamina / Balance
- CPU AI
- Touch / Gamepad
- animation / camera / VFX / audio
- render interpolation
- Phaser Physics / Matter.js
- generic collision/contact framework

Do not create unused placeholders for later Push architecture.

## 13. Required Automated Verification

Existing movement/fixed-step tests must remain PASS.

Add focused tests at minimum:

T19. Exact touch
- `distance == rA + rB`
- no overlap correction
- contact remains numerically stable

T20. Slight overlap
- after one tick resolution, participants are separated to non-overlap
- equal participants move symmetrically

T21. Same center
- deterministic fallback normal
- separated safely
- no NaN / Infinity

T22. Head-on high-speed approach
- current max self movement cannot tunnel through
- participants do not swap sides
- closing normal velocity is removed

T23. Tangential / glancing contact
- tangential velocity remains
- participant can move around/circle rather than becoming a sticky wall

T24. Two participants moving directly toward each other
- settle into stable contact
- no visible/numerical jitter
- after many ticks positions remain stable within tolerance

T25. No-contact movement regression
- ACTION-02B grounded movement behavior remains unchanged when circles do not contact

T26. Snapshot isolation
- bodyRadius and existing state remain isolated copies as appropriate

T27. Phaser independence
- Simulation/contact code has no Phaser import

T28. Determinism / finite values
- same setup + same intents = same result
- no NaN / Infinity in contact cases

If a contact-speed invariant is encoded, test it explicitly.

## 14. Verification Level

Heavy / Core Movement-Contact.

Required:

- `pnpm test` PASS
- `pnpm build` PASS
- `git diff --check` PASS
- T19〜T28 evidence
- existing ACTION-02/02B movement tests PASS
- no new dependency
- Simulation/contact core Phaser-free
- Push/Ring-out scope absent

### Browser Smoke

Verify:

- Phaser Canvas starts
- runtime error none
- Player no longer passes through opponent
- direct approach stops at contact
- diagonal approach can slide/circle around opponent
- no obvious resting jitter
- accepted non-contact movement still feels unchanged
- opponent behavior matches the minimal test setup
- Player can still leave ring because Ring-out is not implemented

Browser Smoke is technical only.

## 15. User Play Test — REQUIRED

User must test after Technical PASS.

Check:

1. The two bodies feel solid rather than ghosting through each other.
2. Direct contact does not feel like an invisible wall with a large gap.
3. Resting contact does not shake/jitter.
4. Sliding/circling around the opponent remains possible.
5. Contact does not make movement feel unexpectedly sticky.
6. Non-contact grounded movement still feels like the accepted ACTION-02B baseline.
7. It is acceptable that a stationary opponent does not get pushed yet.
8. It feels like a good base for adding Push next.

Agent must report:

`User Play Test: REQUIRED / NOT RUN`

Do not call Contact Feel accepted automatically.

If User rejects contact feel, do not proceed to ACTION-03B Push.

## 16. Acceptance Criteria

AC-01: gameplay body radius is Simulation-owned, not Scene-owned.
AC-02: Snapshot exposes body geometry needed for rendering.
AC-03: exact contact / overlap detection is deterministic.
AC-04: CONTACT_SLOP exists as provisional tuning for stable contact.
AC-05: same-center case is deterministic and finite.
AC-06: overlap separation is symmetric for equal participants.
AC-07: closing normal self velocity is removed at contact.
AC-08: tangential self velocity is preserved.
AC-09: participants cannot pass through each other at current movement limits.
AC-10: prolonged resting contact has no numeric jitter.
AC-11: no-contact ACTION-02B Movement behavior regresses materially.
AC-12: no externalVelocity / mass / Push / Ring-out implementation.
AC-13: no Phaser Physics / Matter.js.
AC-14: T19〜T28 + existing tests PASS.
AC-15: `pnpm build` PASS.
AC-16: Browser Smoke PASS.
AC-17: Current State docs materially match Source.
AC-18: User Play Test REQUIRED / NOT RUN is reported.
AC-19: Scope outside Task is unchanged.

## 17. Stop Conditions

STOP if:

- GitHub Handoff Preflight fails
- Current Source / Review Handoff materially conflicts
- contact cannot be made stable without changing accepted Movement architecture
- Push / external momentum is required to make basic non-penetration work
- CCD is required at current movement limits
- a Physics engine becomes necessary
- new dependency required
- task-external User changes / divergence exist
- solving contact requires Weight / mass semantics now

Do not broaden Scope.

## 18. Completion Report

Minimum:

- Result
- Preflight
- Changed Files
- Contact Geometry
- CONTACT_SLOP provisional value
- Contact normal / same-center fallback
- Separation behavior
- Closing velocity handling
- T19〜T28 + regression tests
- Browser Smoke
- AC-01〜AC-19
- Implementation Evidence
- Design Deviations
- Unexpected Scope
- Known Untested
- User Play Test: REQUIRED / NOT RUN
- Git delivery

Implementation Evidence minimum:

1. Simulation-owned body radius
2. deterministic contact normal
3. symmetric separation
4. closing-normal velocity removal
5. tangential preservation
6. no-contact Movement regression preservation
7. no Push/externalVelocity scope creep
8. Scene reads Snapshot geometry

## 19. Git Delivery

Follow AGENTS.md.

Technical PASS:

- stage only Task-owned files
- tests / build / diff-check
- include CURRENT_COMPLETION_REPORT in same Task commit
- 1 Agent Task ≈ 1 commit
- push `origin/develop`
- verify remote SHA / clean working tree

Commit message example:

`feat: add bout contact separation`

Do not change main.

## 20. Final Instruction

This Task ends at Contact & Separation.

Do not continue to Push / external momentum / Ring-out after completion.

After commit / push / Completion Report, stop and report:

「ACTION-03A-CONTACT-SEPARATION が完了し、ChatGPT ReviewとUser Play Test待ちです」


# Final ChatGPT Review

Overall Result: TECHNICAL PARTIAL / CORRECTION REQUIRED BEFORE USER PLAY TEST

## Accepted Parts

- Implementation commit inspected: `02a4047328e560a986d677ea13c890a43607b381`
- Agent-Start-Head: `c63505280c0aadec31d332c9af28431879914256`
- Agent Task Diff is one implementation commit.
- Simulation-owned `bodyRadius` is correct.
- Snapshot exposes gameplay body geometry and Scene reads it for presentation.
- `CONTACT_SLOP = 0.002 m` is a valid provisional contact-stability value.
- Contact normal is deterministic; same-center fallback is finite and deterministic.
- Closing self-locomotion normal velocity is removed while tangential velocity is preserved.
- No Phaser Physics / Matter.js / generic collision framework was introduced.
- No externalVelocity / mass / Push / Ring-out / Rikishi attributes were introduced.
- No-contact ACTION-02B movement architecture remains preserved.
- Automated verification coverage is strong and the reported 45/45 tests / build / diff-check are consistent with inspected Source.

## Blocking Correction

### C-1 — Symmetric penetration correction creates implicit Push before Push exists

Current contact resolution performs symmetric positional separation after integration:

- mover penetrates stationary opponent
- overlap is split 50/50
- stationary opponent is translated by half of the mover's penetration every tick

Under sustained walk-in this produces approximately 0.083 m/s of opponent drift, as the Agent correctly reported and tested.

This is not acceptable as the ACTION-03A baseline because:

1. ACTION-03A explicitly excludes Push / external momentum.
2. User Play Test is supposed to evaluate solid contact before Push.
3. The visual result looks like weak pushing and therefore contaminates that test.
4. If left in place, ACTION-03B explicit Push would be layered on top of an existing hidden positional Push.
5. It would make future Push tuning harder to reason about.

Therefore ACTION-03A is not yet accepted for User Play Test.

## Required Correction Semantics

Create a focused ACTION-03A correction before User Play Test.

Keep all accepted Contact architecture, but change overlap positional correction so that penetration correction follows **who actually moved inward during the tick**, not an unconditional 50/50 split.

Recommended minimal deterministic rule:

- Compute each participant's inward closing contribution along the contact normal for the current tick.
- If only A moved inward and B was stationary, apply the full overlap correction to A; B does not drift.
- If only B moved inward, apply the full correction to B.
- If both moved inward, split correction proportionally to their inward closing contributions.
- If there is no meaningful inward contribution (for example pre-existing overlap / same-center setup), use symmetric 50/50 fallback only to restore a valid non-overlap state.

The exact implementation may use current self velocity / per-tick inward displacement, but must remain:
- deterministic
- Pure TypeScript
- mass-free
- Push-free
- externalVelocity-free
- fixed-step
- small and explicit

Do not introduce mass weighting or Push semantics to solve this.

## Required Regression Behavior After Correction

- Walking into a stationary participant does not translate the stationary participant.
- Two equal participants walking directly into each other settle symmetrically.
- Glancing/tangential contact still permits circling.
- Existing closing-normal velocity removal remains.
- Same-center/pre-existing overlap remains deterministic and finite.
- No-contact ACTION-02B behavior remains unchanged.
- No Push / external momentum appears.

## User Play Test

NOT READY YET.

Do not ask User to accept/reject Contact Feel using commit `02a4047`, because the implicit positional creep would conflate Contact with Push.

After the focused correction passes review, User Play Test should check:

- no pass-through
- no visible gap
- no jitter
- natural circling
- no sticky wall feel
- stationary opponent remains stationary when merely walked into
- accepted non-contact Movement Feel remains intact

## Do Not Reopen

- Simulation-owned circle contact geometry
- CONTACT_SLOP concept
- deterministic same-center fallback
- closing-normal self velocity removal
- tangential velocity preservation
- fixed timestep
- grounded Movement baseline
- no Phaser Physics / Matter.js

## Deferred

- explicit Push / press
- externalVelocity
- mass / pushForce / traction
- Weight / Power / LowerBody
- Ring-out / Outcome
- Tachiai / Grapple / Throw / Lift
- CCD until higher-speed states require reevaluation

## Next Task Constraint

The next Task must be a narrow ACTION-03A Contact Correction only.

Do not proceed to ACTION-03B Push until:
1. implicit position-correction creep is removed,
2. technical review passes,
3. User Play Test accepts Contact Feel.
