Task-ID: ACTION-01-MOVEMENT-INPUT-TIMESTEP-INVESTIGATION
Status: REVIEWED
Task-Type: INVESTIGATION / ACTION ARCHITECTURE DESIGN
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: 572990944674f82f31964f8c27b369eaf26faefc
Handoff-Mode: GITHUB

# ACTION-01 — Movement / Input / Time-Step Investigation

## 1. Purpose

SumoSimの相撲Actionを簡易Prototypeから段階的に作り込んでも破綻しないよう、
Movement / Input Intent / Interaction State / Simulation cadence / Physics採否の設計を調査し、
次のImplementation Taskで一意に実装できるレベルまでArchitectureを固める。

このTaskはInvestigation Only / No Production Fixes。

Production Source、package、lockfile、AGENTS、ARCHITECTURE、GAME_CONCEPT等を変更しない。
調査結果は `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md` のみへ記録する。

## 2. Accepted Baseline

Accepted implementation baseline:

`572990944674f82f31964f8c27b369eaf26faefc`

Current accepted architecture:

- Pure TypeScript Simulation → State / Results → Phaser Presentation
- `BoutSimulation` がcanonical Bout Runtime Stateを所有
- `BoutSetup` はfuture Management/Game StateからBoutへ入る明示的境界
- SetupとSnapshotはcaller/consumer mutable stateをaliasしない
- `BoutScene` はSnapshotから描画し、canonical gameplay positionを所有しない
- Simulation logical coordinatesとPhaser canvas mappingは分離
- Vitest導入済み
- Movement / Input / Physics / timestep / push / stamina / balance / CPU / ring-out / victoryは未実装
- Prototypeのring/spawn/scale/style値はFinal Designではない

Previous Review Correction:

- Stable wrestler identityとPlayer/CPU presentation roleを同一視しない
- 現在の `PARTICIPANT_STYLE[participant.id]` はPrototype限定
- speculative role systemは今作らない。必要な時点で明示的に分離する

## 3. User-Accepted Action Direction

以下は今回のInvestigationで前提として扱う。
ただしexact key binding、数値、formulaは未決。

### 3.1 Movement

- WASDで前後左右移動
- 力士は基本的に相手方向を自動で向く
- 見下ろし型Action
- Keyboardの具体的なキー配置は将来変更可能なInput Mappingとして扱う
- Touch対応を将来可能にするため、Simulationへraw keyそのものを渡さない

### 3.2 Tachiai Phase

取組開始時に通常Boutとは別の立合いPhaseを持つ方向。

Timing Gauge:
- 左右に動くゲージをPlayerがタイミング良く止める
- 0%〜100%相当の操作結果を得る
- Gauge結果は力士Parameterそのものではなく、その立合いでのPlayer操作結果

Tachiai action direction:

- Up: 当たり / 突進して押す
- Left: 変化
- Right: 掴みに行く
- Down: 様子を見る

立合い結果は将来的に、
力士Parameter + Timing結果 + 自他の選択Action / State
から決定する方向。

exact matchup table / formulaは未決。

### 3.3 Normal Bout — FREE

非掴み状態でのAction方向：

- Left: 左手突っ張り
- Right: 右手突っ張り
- Up: 押す
- Down: 引き技
- Grapple Action: 掴みに行く
- Custom Action: 事前設定技を試みる（例: 足払い）

Grapple Actionは専用Actionとして扱う。
最終Keyboard keyは未決。

Custom ActionのKeyboard案はSpaceだが、Simulation contractではraw Space keyに依存しない。

### 3.4 Normal Bout — GRAPPLED

掴み状態：

- Up: 寄る / 寄り切り方向に押す
- Left: 左投げ
- Right: 右投げ
- Down: 吊りを試みる
- Grapple Action: 自主的に掴み解除 → FREE
- Custom Action: 装備した技を試みる

Throw:
- 投げを実行し、Boutが継続する場合はFREEへ遷移
- 投げで決着した場合はBout終了
- Throw success/failure semanticsや決着判定formulaは未決

### 3.5 Normal Bout — LIFTED

吊り：

- GRAPPLEDでLift actionを試みる
- Lift失敗 → GRAPPLED
- Lift成功 → LIFTED
- LIFTED中は吊っている側のWASD Movementのみ
- 他の通常Actionは行わない
- 吊り状態を維持できる時間/能力限界に達すると自動でGRAPPLEDへ戻る
- LIFTED中は吊る側がMovement主体で、吊られる側のpositionは独立通常Movementではなく従属する方向

exact Lift formula / duration formulaは未決。

### 3.6 Interaction State

設計概念として最低限：

- FREE
- GRAPPLED
- LIFTED

を扱う。

実際のType/State Machine shapeは今回調査して提案する。
過剰なState Machine Frameworkは導入しない。

## 4. User-Accepted Parameter Direction

将来のRikishi Parametersは以下の方向で検討する。
このInvestigationでは数値rangeやformulaを決めない。

### Body
- Height
- Weight

### Physical
- Power
- LowerBody / 足腰
- Speed
- StaminaCapacity

### Sumo Skill
- Tachiai
- ThrustPower
- ThrustTempo
- Grapple
- Throw
- Lift
- Counter

Important distinction:

- Rikishi Parameter = 育成で変化する比較的恒久的な能力
- Bout Runtime State = 取組中に変化する状態

Bout Runtime候補：

- Position
- Facing
- Momentum
- CurrentStamina
- CurrentBalance
- Engagement/Interaction State
- CurrentAction
- Recovery / Commitment
- LIFTED維持に必要なruntime data

Balanceは現時点では育成ParameterではなくRuntime Stateとして扱う方向。
LowerBody等のParameterと現在のMomentum/Impulse/Stamina等から変動する可能性がある。

このTaskでexact formulaを決めない。

## 5. Core Investigation Questions

以下をCurrent Sourceと上記Accepted Directionに照らして調査し、明確な推奨案を出す。

### Q1 — Input Intent Boundary

Keyboard / Touch / CPUからSimulationへ渡すIntentの最小構造を提案する。

最低限検討：

- Movement intent
- directional action intent
- Grapple action
- Custom technique action
- Tachiai input / timing result
- FREE / GRAPPLED / LIFTEDで同じIntent contractを使うか、Phase別contractに分けるか
- raw key dependencyをSimulationへ入れない方法
- PlayerとCPUが同じSimulation input contractを共有できる形

目的は将来Touch / CPU / remappingを増やしてもSimulationを壊さないこと。

### Q2 — Movement Ownership

Movementの正本と更新責務をどこに置くべきか決める。

最低限：

- desired movement / intent
- canonical position
- facing
- movement result
- Scene synchronization
- LIFTED時のdependent participant position
- GRAPPLED時に2 participantをどう扱うか。ただし具体的な押し/衝突formulaはまだ決めない

Phaser GameObjectのpositionをcanonical stateにしないこと。

### Q3 — Time-Step / Simulation Cadence

以下を比較し、SumoSimに推奨する方式を1つ選ぶ：

- variable delta direct simulation
- fixed timestep
- fixed timestep + accumulator / render interpolation等

検討観点：

- Browser frame rate差
- deterministic/testable gameplay
- Player input responsiveness
- CPUとPlayerの同一rule
- push / momentum / balance / collisionを将来追加する拡張性
- implementation complexity
- Phaserとの接続
- pause / slow frame / tab background等
- CrazyGames等Web配信

必要ならlogical simulation Hzのrangeを提案してよいが、
未検証の具体HzをFinal Gameplay値として固定しない。

### Q4 — Coordinate / Time Units

Simulation内部でCanvas pixelそのものをGameplay単位として固定すべきか、
logical unitsを別にすべきか提案する。

最低限：

- logical position unit
- movement speed unit
- momentum / velocityを将来導入する場合の単位
- seconds / milliseconds / tick基準
- Scene側transform責務

過剰なUnit Frameworkは不要。

### Q5 — Physics Adoption

Phaser Arcade Physics / Matter.js / custom Pure TypeScript movementのどれが、
このゲームの現在のAction方向に最も適するか調査し、推奨を出す。

検討対象：

- 2人の力士
- 円形土俵
- 押し合い
- momentum
- balance
- grapple
- throw
- lift
- deterministic / testable core
- SceneとSimulation分離
- 将来のGame Feel tuning

結論は：
- Use
- Do Not Use for Gameplay Core
- Defer pending specific prototype evidence

のどれかを明確にする。

Physics LibraryをProductionへ導入しない。

### Q6 — Interaction State Model

FREE / GRAPPLED / LIFTEDの最小State modelを提案する。

最低限、以下の遷移を矛盾なく表現：

FREE
→ Grapple成功 → GRAPPLED

GRAPPLED
→ Grapple Action → FREE
→ Throw & Bout continues → FREE
→ Throw & Bout ends → Finished Outcome
→ Lift failure → GRAPPLED
→ Lift success → LIFTED

LIFTED
→ duration/end condition → GRAPPLED

LIFTED中：
- lifter movementのみ
- lifted participantは通常Movementしない
- standard actionsは無効

State modelとBout Outcomeを混同しないこと。

### Q7 — Auto-Facing

常に相手方向を向く設計をどうSimulationへ置くか提案する。

検討：

- facingをcanonical runtime stateとして持つ必要があるか
- positionからderivedで十分か
- throw / side attack / custom technique等の将来拡張で明示Facingが必要になる境界
- automatic facingがMovement/techniqueの表現を制限しないか

初期Prototypeと将来拡張の両方を考える。

### Q8 — Momentum / Balance Foundation

今回実装はしないが、次のMovement Implementationが将来Momentum / Balanceを追加できる形になるために、
最小限どのState/Result boundaryを予約すべきか提案する。

注意：
- placeholder fieldを大量に追加する提案は避ける
- formulaを決めない
- Current Movement implementationに本当に必要になるまでfieldを作らない方針を優先

### Q9 — Parameter Boundary

上記Rikishi Parametersを将来Boutへ渡す際、
Management StateとBout Runtimeを直接共有しない構造を提案する。

特に：
- immutable setup snapshotとして渡すか
- static participant attributesとruntime stateをどう分けるか
- Height / Weight等の体格値とSkill値の扱い
- stable wrestler identityとPlayer/CPU presentation roleを分離する方法

このTaskでManagement Systemを設計しすぎない。

### Q10 — Minimal Implementation Sequence

調査結果を基に、次の3〜5個程度の小さなImplementation Task順序を提案する。

各TaskがUser Play Test可能か、
何をTechnical Gateにするかも簡潔に示す。

中心仮説を最短で検証できる順序を優先する。

## 6. Scope Out

このInvestigationではProduction実装しない：

- input code
- movement code
- simulation step
- fixed-step loop
- Physics
- collision
- push mechanics
- stamina/balance mechanics
- tachiai implementation
- grapple implementation
- throw/lift implementation
- ring-out/victory
- CPU
- real Rikishi Parameters
- Management
- Custom Technique system
- animation/audio/camera effects
- new dependency
- source refactor

Current Sourceに問題を見つけても修正しない。

## 7. Stop Conditions

以下の場合は推測で設計確定せず、Completion ReportをBLOCKEDとしてUser判断点を明示：

- Current Source / AGENTS / ARCHITECTURE / accepted directionにMaterial Conflict
- Movement architectureを決めるために未決のGame Design選択が必須で複数案が同等
- Physics採否がSource inspectionだけでは安全に判断できず、Prototype experimentが必須
- accepted input/state transitionに矛盾があり一意に整理できない
- Task Scopeを超えるProduction experimentが必要

Preflight Safety STOPの場合はAGENTS.mdに従いRepositoryへ何も書かない。

## 8. Investigation Method

Current Sourceを直接inspectする。

最低限：

- `src/game/sumo/BoutTypes.ts`
- `src/game/sumo/BoutSimulation.ts`
- `src/game/sumo/BoutSimulation.test.ts`
- `src/game/scenes/BoutScene.ts`
- `src/main.ts`
- `package.json`
- `docs/ARCHITECTURE.md`
- `docs/GAME_CONCEPT.md`
- `AGENTS.md`
- Previous Final Review Handoff

必要ならPhaser 4のcurrent API/behaviorを公式Documentationで確認してよい。
外部資料を使った場合はCompletion ReportにSource / conclusionを簡潔に記録する。

Production changesは禁止。

## 9. Verification Level

Investigation / Design Review。

必須：

- Current Source inspection完了
- Q1〜Q10すべてに回答、またはBLOCKED理由を明記
- RecommendationとRejected/Deferred alternativesを区別
- Current accepted designとのConflict有無を明記
- Production Source変更なし
- package / lockfile変更なし
- `git diff --check`（Reportのみ）
- Repository変更が `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md` のみ

`pnpm test` / `pnpm build` はProduction Sourceを変更しないInvestigationのため原則不要。
Source integrityに疑義があり実行した場合は結果を報告する。

## 10. Completion Report

Remote-Task-First Preflight成功後、
Investigation-only Report Commit Exceptionに従って
`docs/agent_handoff/CURRENT_COMPLETION_REPORT.md` のみ更新してよい。

Result:
- 推奨設計を一意に提示できた → PASS
- 一部にUser Decisionが必須で実装へ進めない → BLOCKED
- Materialな不足がある → PARTIAL / FAILを適切に使用

Report最低限：

- Result
- Preflight
- Current Source Findings
- Q1〜Q10
- Recommended Architecture
- Recommended State / Intent Flow
- Recommended Time-Step
- Physics Recommendation
- Interaction State Transition
- Parameter vs Runtime Boundary
- Rejected / Deferred Alternatives
- Design Conflicts / Ambiguities
- Next Implementation Sequence
- User Decisions Required
- Design Deviations: NONE または詳細
- Unexpected Scope
- Verification
- Git delivery

図示できる場合は簡潔なASCII diagramを使ってよい。

## 11. User Play Test

NOT REQUIRED for Investigation acceptance。

ただしCompletion ReportのNext Implementation Sequenceでは、
Movement Feel / control feel / push feel等、どのTaskからUser Play Testを必須Gateにすべきか提案すること。

## 12. Git Delivery

Investigation-only Report Commit Exceptionを使用する。

成功した調査結果またはreportable BLOCKEDの場合：

- Production Sourceを変更しない
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md` だけを明示Stage
- `git diff --check`
- Report-only 1 commit
- `origin/develop`へpush
- remote SHA / clean working tree確認

Commit message例：

`docs(agent): investigate action movement architecture`

## 13. Final Instruction

このTaskでは設計調査まで。

Movement / Input / Physics / fixed-step等をProductionへ実装しない。

Report Commit / Push後停止し、

「ACTION-01-MOVEMENT-INPUT-TIMESTEP-INVESTIGATION が完了し、ChatGPT Review待ちです」

と日本語で報告する。


# Final ChatGPT Review

Overall Result: PASS WITH CORRECTIONS / USER DECISION REQUIRED BEFORE ACTION-02

## Accepted Baseline

- Investigation report commit: `3fa3c446361db136e60e93fd308bd9210c8f6586`
- Agent-Start-Head: `073277f1092bea8113a7e7693ede1aae0b6eceba`
- Agent Task Diff is exactly one Report-only commit.
- The only changed repository file is `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`.
- Production Source / package / lockfile were not changed.
- `main` remains outside this normal develop workflow and is unchanged by this Task.

## Accepted Decisions

- Gameplay Core uses custom Pure TypeScript movement/state, not Phaser Arcade Physics or Matter.js as the gameplay Source of Truth.
- Simulation cadence uses a fixed timestep with an accumulator at the Phaser/integration boundary.
- Initial simulation rate may use 60 Hz as a provisional technical value for ACTION-02 Play Test; it is not a final gameplay constant.
- `BoutSimulation.step()` advances one logical tick and does not consume render-frame delta directly.
- Raw keyboard/touch/gamepad keys do not enter the Simulation. Input adapters produce semantic Participant Intent.
- Player and future CPU should feed the same Simulation intent contract.
- Continuous movement input and edge-triggered action input are distinct; action edges must be buffered/consumed exactly once across 0..N fixed ticks per render frame.
- Canonical position / velocity / facing stay in Pure TypeScript Simulation. Scene/GameObject position is presentation only.
- Logical gameplay units are independent of canvas pixels. Meter/second-based units are accepted as an internal direction; concrete ring/spawn/movement values remain provisional.
- Interaction is a bout-level relationship represented minimally as FREE / GRAPPLED / LIFTED; Bout Phase and Bout Outcome remain separate concepts.
- In LIFTED, the lifter is the movement owner and the lifted participant does not perform independent normal movement.
- Facing is canonical runtime state. Initial ACTION-02 behavior may auto-face the opponent immediately each tick; future turn limits/action locks may refine this.
- ACTION-02 may introduce velocity as the only momentum-related runtime foundation. Balance/Stamina/CurrentAction/etc. remain deferred until first needed.
- Future Rikishi attributes enter Bout through copied immutable Setup data; Management State is not shared as mutable Bout runtime state.
- Stable wrestler identity remains separate from Player/CPU control role and presentation style.

## Corrections

### C-1 — WASD reference frame is blocking for ACTION-02

The Report lists U1 as non-blocking and recommends screen/world-relative movement by default.

This is a user-facing control semantic and must not be silently fixed by the Agent.

Before ACTION-02 is registered, User must choose one:

A. Screen/world-relative:
- W = screen up, S = screen down, A/D = screen left/right
- wrestler still auto-faces opponent
- movement therefore naturally includes strafing/backpedaling relative to facing

B. Wrestler-relative:
- W = toward current facing/opponent
- S = backward
- A/D = left/right strafe relative to current facing

The Simulation intent boundary can support either; this decision belongs in the input adapter semantics.

### C-2 — ACTION-03 Push/Collision requires its own design gate

Do not move directly from Movement Play Test into a combined Production implementation of:
body contact + separation + push + ring-out.

Movement/Collision/Push are high-risk Game Feel/Core Rule areas.

After ACTION-02 is implemented and User Play Tested, perform a focused Push/Contact/Collision Investigation or Design Task before its Production implementation.

That Task should define at minimum:
- body/contact representation
- overlap/separation semantics
- push/impulse ownership
- mass/weight influence boundary
- momentum transfer boundary
- edge/ring-out geometric criterion
- numerical stability / fixed-tick boundary cases
- what is tuning vs accepted rule

### C-3 — Control-role separation is required; a framework is not

The requirement to separate stable participant identity from Player/CPU controller role is Accepted.

However, `BoutControlAssignment` is a conceptual name, not a required new framework/class.
ACTION-02 should implement the smallest explicit mapping needed and avoid speculative controller architecture.

## Do Not Reopen

- Do not use Phaser Physics as Gameplay Core without a future explicit architecture change.
- Do not make Phaser GameObject positions canonical.
- Do not feed raw keys directly into BoutSimulation.
- Do not use render delta directly for gameplay advancement.
- Do not add Balance/Stamina/Action/Event placeholder fields before a Task needs them.
- Do not treat 60 Hz, meter-scale fixture values, acceleration values, ring radius, spawn positions or movement constants as final accepted tuning.
- Do not add generic State Machine / ECS / Event Bus / controller framework.
- Do not conflate wrestler identity with player/CPU role.

## Deferred

- Exact ACTION key bindings
- Tachiai input confirmation semantics
- GRAPPLED symmetric vs asymmetric grip details
- render interpolation
- turn-rate limits / facing lock
- body collision / separation
- push / momentum transfer formulas
- ring-out criterion
- stamina / balance
- tachiai implementation
- grapple / throw / lift implementation
- CPU gameplay behavior
- real Rikishi attributes
- custom techniques

## User Play Test

- ACTION-01 Investigation: NOT REQUIRED.
- ACTION-02 Movement Foundation: REQUIRED for movement/control feel.
- Push/Contact implementation: REQUIRED for push/impact/edge feel after its design gate.

## Regression Risks

- Accumulator/tick orchestration leaking gameplay rules into BoutScene instead of remaining a small testable integration boundary.
- An action edge being lost or fired multiple times when a render frame executes 0 or multiple simulation ticks.
- Scene position becoming a second source of truth.
- Future collision code relying on frame delta rather than fixed ticks.
- Prototype movement constants becoming accidental permanent balance rules.
- Over-generalizing control assignment before CPU/Touch actually require it.

## Next Task Constraints

1. Resolve C-1 with User before ACTION-02 task creation.
2. Then create ACTION-02 Movement Foundation only:
   - fixed-step integration
   - semantic movement intent
   - velocity + provisional accel/decel/max speed
   - canonical facing
   - keyboard adapter
   - minimal identity→controller/presentation separation
   - meter-to-pixel presentation mapping
   - automated deterministic/fixed-step tests
   - Browser Smoke
   - User Play Test
3. Do not include body collision, push, ring-out, Tachiai, Grapple or CPU gameplay logic in ACTION-02.
4. After ACTION-02 User Play Test, design/investigate Push/Contact/Collision before implementing it.
