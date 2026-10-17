Task-ID: ACTION-02B-GROUNDED-MOVEMENT-FEEL-CORRECTION
Status: REVIEWED
Task-Type: IMPLEMENTATION / FOCUSED GAME FEEL CORRECTION
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: 8b9acf7444c13648ea36b603b9c642d7c07ca046
Handoff-Mode: GITHUB

# ACTION-02B — Grounded Movement Feel Correction

## 1. Purpose

ACTION-02のMovement ArchitectureはTechnical PASSだが、User Play TestでMovement Feelは未受理。

User feedback:

- 現在は「スケートリンクを滑っている」ように感じる
- もう少し「人間が移動している」「足で踏ん張っている」重さが欲しい

このTaskではArchitectureを変更せず、Movement model / provisional tuningだけをFocusedに修正する。

目標は：

- 発進には少し重さがある
- 入力中は意図した方向へしっかり進む
- キーを離すと足で踏ん張るように止まる
- 方向転換時に横滑り・円弧状の慣性を引きずりすぎない
- 逆方向入力時は一度現在の勢いを殺してから反対方向へ移る感覚
- screen-relative WASDとauto-facingは維持

Technical PASSだけでは受理しない。最終GateはUser Play Test。

## 2. Current Baseline / Handoff

Accepted Production Source Baseline:

`8b9acf7444c13648ea36b603b9c642d7c07ca046`

Current developにはChatGPT Review / User Play Test feedbackのcoordination-only commitsが存在する。
AGENTS.mdのRemote-Task-First Preflightに従い、Source-Baseline..origin/developが`docs/agent_handoff/`のみであることを確認してFF-onlyすること。

ACTION-02 Technical ArchitectureはAccepted:

- screen/world-relative WASD
- Pure TypeScript BoutSimulationがcanonical position / velocity / facing owner
- fixed timestep + accumulator
- 60Hzは暫定technical value
- raw keysはSimulationへ入れない
- SceneはSnapshotを一方向描画
- meter / m/s / radian logical units
- auto-facingはSimulation rule
- Phaser Physics / Matter.jsをGameplay Coreに使わない
- stable participant identityとcontrol/presentation roleを分離
- Collision / Push / Ring-out等は未実装

変更してよいのはMovement Feelに必要な最小範囲だけ。

## 3. User Play Test Result

Movement Feel: NOT ACCEPTED YET

UserがRejectしたのはArchitectureではなく現在の移動感。

Current provisional model:

- MAX_SPEED = 3 m/s
- ACCELERATION = 12 m/s²
- DECELERATION = 15 m/s²
- velocity全体をtarget velocityへ等方的に近づける

この方式により、方向転換時にも横方向のvelocityが滑らかに残り、
「慣性を持つ円が氷上を滑る」感覚が出ている。

今回の修正は「慣性を完全に無くす」ことではない。
後続のMomentum / Push拡張に耐えるvelocity stateは維持する。

## 4. Required Movement Behavior

### 4.1 No input — grounded stop

入力が0なら、current velocityを0へ明示的に減速する。

Currentより「踏ん張って止まる」感覚を強めてよい。

ただし瞬間停止に固定しない。
停止の速さはprovisional tuningとしてUser Play Test対象。

### 4.2 Same-direction acceleration

現在velocityとdesired movementがおおむね同方向の場合：

- desired directionへ加速
- max speedまで段階的に到達
- accelerationは残す
- immediate teleport / immediate max speedは禁止

発進の「重さ」を残す。

### 4.3 Perpendicular / turning grip

desired movement directionに対してcurrent velocityの横成分がある場合、
そのperpendicular componentを通常加速とは別に強く減衰させる。

目的：

- 90°方向転換で大きな円弧を描いて滑り続けない
- 足を踏み替えて進行方向を変える感覚を出す
- screen-relative WASDの応答性を保つ

Small explicit vector mathで実装する。
Physics engineやgeneric locomotion frameworkを導入しない。

### 4.4 Reverse direction

current velocityとdesired movementが逆向きの場合：

- まず現在方向の勢いを強く減らす
- その後、新しいdesired directionへ加速する
- 1 tickで不自然にフルスピード反転しない

「重いが滑らない」方向を狙う。

### 4.5 Velocity remains canonical

velocity fieldは削除しない。

後続のPush / Momentumで利用できるcanonical runtime stateとして維持する。

Movement Feel修正のためにposition直接補正やPhaser TweenをGameplay movementへ使わない。

## 5. Recommended Small Design

Current「velocity vectorをtarget velocityへ1種類のrateで追従」から、
movement intent方向を基準にvelocityを分解するsmall explicit modelを推奨する。

概念：

```
desired direction
      │
      ├─ parallel velocity     → acceleration / reversal braking
      └─ perpendicular velocity → stronger turn/grip damping
```

必要に応じて以下のnamed provisional constantsへ整理してよい：

- MAX_SPEED
- FORWARD_ACCELERATION
- STOP_DECELERATION
- TURN_GRIP / LATERAL_DECELERATION
- REVERSE_BRAKING

名前はCurrent code styleに合わせて調整可。

すべてPrototype tuning values。
Final balance / final Rikishi stat semanticsではない。

Implementationをより小さく同じbehaviorで実現できる場合は可。
Materialに異なるmovement semanticsを採用する場合はDesign DeviationとしてSTOP / Reportする。

## 6. Do Not Change

以下はBaseline維持：

- screen-relative WASD
- W=-y / S=+y / A=-x / D=+x
- diagonal normalization
- fixed timestep + accumulator
- BoutSimulation canonical ownership
- 60Hz provisional simulation cadence
- meter logical units
- auto-facing
- identity/control role separation
- one-way Snapshot rendering
- opponent stationary
- no Collision / Push / Ring-out

## 7. Scope

変更可：

- `src/game/sumo/BoutSimulation.ts`
- `src/game/sumo/BoutSimulation.test.ts`
- Movement Feel実装に本当に必要ならsmall Pure helper file / test
- `docs/ARCHITECTURE.md` Current movement descriptionの最小同期
- `AGENTS.md` Current Stateの時間依存記述の最小同期
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

前Review Correctionとして、AGENTS.mdの
「Phaser 4.2.1（src/main.tsからGame起動。表示のみのFoundation）」
というstale wordingを、Current Sourceに合う最小表現へ修正してよい。

Scene/Input変更は原則不要。
Movement Feel correctionに必須でない限り触らない。

## 8. Scope Out

実装しない：

- body collision / separation
- push / impulse
- ring-out
- Tachiai
- FREE / GRAPPLED / LIFTED
- Grapple / Throw / Lift
- Thrust / Pull / Counter
- Stamina / Balance
- Weight / Power / LowerBody等のRikishi attributes
- CPU gameplay
- Touch / Gamepad
- animation / footstep animation
- camera / VFX / audio
- render interpolation
- Phaser Physics / Matter.js
- generic movement framework
- input event buffering framework
- short-tap問題の先回り修正

今回の「人間らしさ」をAnimationで誤魔化さない。
まずPure Simulation movementのFeelを改善する。

## 9. Required Automated Verification

Existing T1〜T11 regressionを維持し、Movement model変更に合わせて必要なexpected値のみ更新する。

さらに最低限：

T12. Grounded stop
- moving stateからzero intent
- speedが単調に減少
- overshoot / reverse / NaNなし
- finite ticksでexact zeroへ停止

T13. 90-degree turn
- 右移動中に上入力等へ変更
- perpendicular旧velocity成分が明示的に減衰
- 新方向成分が増加
- 横滑り成分が無制限に残らない

T14. Reverse
- 右移動中に左入力
- 旧方向velocityが減速してから符号反転
- 1 tickで +MAX_SPEED → -MAX_SPEED にならない
- reverse transitionがdeterministic

T15. Same-direction acceleration
- stopからhold input
- 段階的に加速
- max speedを超えない

T16. Diagonal / arbitrary normalized intent
- speed advantageなし
- turn modelでもfinite / stable

T17. Frame partition regression
- fixed-step accumulator architectureは変更されず、同じtick intent sequenceなら同じSimulation結果

T18. Existing alias / snapshot / facing / Phaser-free tests PASS。

Testが特定のFeel値を「最終正解」と固定しすぎないよう、
behavioral invariantとprovisional constantsに対するfocused assertionを分ける。

## 10. Verification Level

Heavy寄りStandard / Game Feel Correction。

Required：

- `pnpm test` PASS
- `pnpm build` PASS
- `git diff --check` PASS
- Existing Movement tests regression PASS
- T12〜T18 PASS
- new dependencyなし
- Simulation core Phaser-free
- Scope外Gameplayなし

### Browser Smoke

最低限：

- Canvas起動 / runtime errorなし
- WASD screen-relative movement維持
- key release後に停止
- 90°方向転換が機能
- reverse入力が機能
- auto-facing維持
- opponent stationary
- collision / ring boundaryなし
- Snapshot描画同期維持

AgentはBrowser Smokeで「人間らしくなった」「Feel改善PASS」と判断しない。
FeelはUserだけがAcceptする。

## 11. User Play Test — REQUIRED

Technical完了後、Userが再度Play Testする。

比較ポイント：

1. 前回の「スケートリンクを滑る」感覚が減ったか
2. 発進時に身体の重さを感じるか
3. キーを離した時に踏ん張って止まる感じがあるか
4. 90°方向転換で不自然な横滑りがないか
5. 逆方向へ切り返した時に、重量感と操作 responsivenessの両方があるか
6. auto-facingしながらの横移動 / 後退が自然か
7. 動きが重すぎて操作ストレスになっていないか
8. 相撲Actionの土台として「人間が足で動いている」方向に近づいたか

Agent Completion Report:

`User Play Test: REQUIRED / NOT RUN`

Technical PASS != Movement Feel Accepted。

UserがAcceptするまでPush / Contact / Collision Designへ進まない。

## 12. Acceptance Criteria

AC-01: ACTION-02 Architectureを維持。
AC-02: screen-relative WASDを維持。
AC-03: velocity canonical stateを維持。
AC-04: zero inputでgrounded stop behaviorを持つ。
AC-05: turn時のperpendicular slipを明示的に抑える。
AC-06: reverse時に旧momentumを殺してから新方向へ移るbehaviorを持つ。
AC-07: same-direction accelerationは段階的。
AC-08: max speed / diagonal normalization regressionなし。
AC-09: fixed-step determinism regressionなし。
AC-10: auto-facing regressionなし。
AC-11: Collision / Push / Ring-out等のScope creepなし。
AC-12: T12〜T18 + existing tests PASS。
AC-13: `pnpm build` PASS。
AC-14: Browser Smoke PASS。
AC-15: AGENTS stale Current wordingが同期される。
AC-16: provisional tuning constantsがCompletion Reportへ明記される。
AC-17: User Play Test REQUIRED / NOT RUNとして報告。
AC-18: Scope外変更なし。

## 13. Stop Conditions

STOP：

- Preflight failure
- Current Source / Review Handoff conflict
- grounded movementを作るためCollision / Weight / Animation等が必須と判明
- Architecture変更が必要
- new dependencyが必要
- Task外User changes / remote divergence
- Feel改善のためPhaser Physicsが必要という結論になる
- Movement semanticsをscreen-relativeから変更する必要が出る

数値tuningのprovisional変更はSTOP不要。
必ずCompletion Reportに記載しUser Play Testへ渡す。

## 14. Completion Report

最低限：

- Result
- Preflight
- Changed Files
- Root Cause / Previous Feel
- Implemented Grounded Movement Model
- Provisional constants: before → after
- Direction-change behavior
- T12〜T18 + regression tests
- Browser Smoke
- AC-01〜AC-18
- Implementation Evidence
- Design Deviations
- Unexpected Scope
- Known Untested
- User Play Test: REQUIRED / NOT RUN
- Git delivery

Implementation Evidence：

1. fixed-step architecture preserved
2. grounded stop
3. lateral/turn grip
4. reverse braking
5. max speed / diagonal invariants
6. Simulation ownership preserved
7. no Collision/Push scope creep
8. docs Current State correction

## 15. Git Delivery

AGENTS.mdに従う。

Technical PASS時：

- Task-owned filesのみstage
- tests / build / diff-check
- Completion Reportを同Commitへ含める
- 1 Agent Task ≈ 1 Commit
- `origin/develop`へpush
- remote SHA / clean working tree確認

Commit message例：

`fix: ground bout movement feel`

mainは変更しない。

## 16. Final Instruction

このTaskではMovement Feel correctionまで。

Technical実装後、Push / Contact / Collisionへ進まない。

Commit / Push / Completion Report後停止し、

「ACTION-02B-GROUNDED-MOVEMENT-FEEL-CORRECTION が完了し、ChatGPT ReviewとUser Play Test待ちです」

と日本語で報告する。


# Final ChatGPT Review

Overall Result: TECHNICAL PASS / USER PLAY TEST REQUIRED

## Accepted Baseline

- Accepted implementation commit for technical review: `29073732a123163bb11e81d7b4b82ac7ffeb5bbd`
- Agent-Start-Head: `d282a51eae4f88e465a6125f596c64d416aa17d3`
- Agent Task Diff is exactly one implementation commit.
- Changed Production scope is limited to `BoutSimulation.ts` / tests plus Current-State docs and Completion Report.
- Scene / Input / FixedStepAccumulator / package / lockfile were not changed.
- Technical Verification is accepted from Completion Report + direct Source/Diff review.
- Movement Feel is NOT accepted until User Play Test.

## Accepted Decisions

- ACTION-02 architecture remains accepted:
  - screen/world-relative WASD
  - Pure TypeScript canonical position / velocity / facing
  - fixed timestep + accumulator
  - semantic movement intent
  - one-way Snapshot rendering
  - auto-facing
  - no Phaser Physics / Matter.js
- Velocity remains canonical runtime state for later Push / Momentum work.
- Grounded movement now decomposes velocity relative to desired movement direction:
  - parallel component for forward acceleration / reverse braking
  - perpendicular component for stronger lateral damping
- No-input movement uses stronger explicit braking to exact zero.
- Reverse input brakes existing opposite momentum to zero before accelerating in the new direction.
- 90-degree turns explicitly damp old lateral velocity instead of carrying ice-like arc momentum.
- A final MAX_SPEED clamp preserves the speed invariant during turning.
- Current provisional values are:
  - MAX_SPEED = 3 m/s
  - FORWARD_ACCELERATION = 10 m/s²
  - STOP_DECELERATION = 24 m/s²
  - LATERAL_DECELERATION = 36 m/s²
  - REVERSE_BRAKING = 30 m/s²
  - SIMULATION_HZ = 60
- These values are Prototype tuning values only and are not final accepted balance.
- No Collision / Push / Ring-out / Rikishi attributes / Animation / Physics scope creep was introduced.
- The stale AGENTS.md Phaser wording from ACTION-02 has been corrected.

## Corrections

NONE required before User Play Test.

## Do Not Reopen

- Do not replace this with Phaser Physics merely to alter movement feel.
- Do not change screen-relative WASD without explicit User request.
- Do not remove canonical velocity; later Push / Momentum should build on it.
- Do not add Weight / LowerBody / Stamina to solve the current movement feel before their dedicated design.
- Do not add Collision / Push / Ring-out until Movement Feel is accepted.
- Do not treat current movement constants as final balance.
- Do not add Animation as a substitute for unresolved Simulation movement feel.

## Deferred

- body collision / separation
- push / impulse / momentum transfer
- ring-out / victory
- Rikishi Weight / Power / LowerBody influence
- FREE / GRAPPLED / LIFTED
- Tachiai
- grapple / throw / lift
- stamina / balance
- CPU gameplay
- Touch / Gamepad
- animation / footsteps
- short-tap input buffering
- render interpolation

## User Play Test

REQUIRED / PENDING.

User should compare directly against the rejected ACTION-02 feel.

Verify:

1. The previous skating / ice-gliding sensation is materially reduced.
2. Starting movement still has enough body weight without feeling sluggish.
3. Releasing WASD feels like planting the feet / stopping, not coasting.
4. A 90-degree direction change does not produce an obvious sliding arc.
5. Reversing direction feels weighted but responsive.
6. Sideways/backward movement while auto-facing remains controllable.
7. Movement is not now too stiff or robotic.
8. This feels closer to a human / rikishi moving on the dohyo and is acceptable as the baseline for later Push/Contact work.

If accepted:
- ACTION-02B Movement Feel becomes the current baseline.
- Push / Contact / Collision Investigation may be created next.
- Numeric values remain tunable later when Weight / Push / stamina interactions are introduced.

If rejected:
- record the concrete feel issue and perform another focused Movement correction.
- do not proceed to Push / Contact / Collision.

## Regression Risks

- Later Push code overwriting the grounded movement model rather than applying impulse/momentum through the canonical velocity boundary.
- Weight/LowerBody tuning accidentally changing ordinary locomotion beyond the accepted User baseline.
- Strong lateral damping making future external push impulses disappear too quickly unless self-locomotion damping vs external impulse semantics are designed explicitly.
- Current provisional constants becoming treated as permanent balance values.

## Next Task Constraints

1. User Play Test ACTION-02B first.
2. Do not create Push / Contact / Collision implementation before User acceptance.
3. After User accepts Movement Feel, create the previously required focused Push / Contact / Collision Investigation / Design Task.
4. That design must explicitly consider how grounded self-movement damping interacts with external push/impulse so that future pushing is not unintentionally cancelled by the locomotion grip model.


# User Play Test Result — 2026-10-18

Movement Feel: ACCEPTED AS CURRENT BASELINE

User feedback:
- The previous skating / ice-gliding sensation is materially reduced.
- Current movement is acceptable for now.
- It still does not fully feel human / rikishi-like, but the User does not yet have a concrete preferred correction direction.

Accepted baseline:
- Keep the current grounded movement model and current provisional tuning as the working baseline for subsequent Action work.
- This acceptance is about current Movement Feel only; numeric constants remain tunable when later Push / Weight / LowerBody / Stamina interactions are introduced.
- Do not reopen Movement Feel preemptively without a concrete regression, new interaction requirement, or User feedback.

Deferred feel improvement:
- Additional human/rikishi-like locomotion feel is deferred until there is concrete evidence from later gameplay interactions.
- Candidate future sources of that feel may include Push/Contact response, body/weight parameters, animation/footwork presentation, or action commitment, but none are accepted solutions yet.
- Do not add any of those systems solely to chase an undefined movement feel issue.

Next Task Constraint:
- Movement baseline is accepted, so Push / Contact / Collision Investigation may proceed.
- Push / Contact / Collision must preserve the accepted grounded locomotion behavior unless an explicit interaction rule requires otherwise.
