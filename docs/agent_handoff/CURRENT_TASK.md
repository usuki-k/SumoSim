Task-ID: ACTION-02-MOVEMENT-FOUNDATION
Status: READY
Task-Type: IMPLEMENTATION / ACTION MOVEMENT FOUNDATION
Executor: Codex / Claude Code
Target-Branch: develop
Source-Baseline: 572990944674f82f31964f8c27b369eaf26faefc
Handoff-Mode: GITHUB

# ACTION-02 — Movement Foundation

## 1. Purpose

ACTION-01で確定したArchitectureに従い、SumoSimの最初の動くAction foundationを実装する。

今回の中心は：

- screen/world-relative WASD movement
- semantic movement intent
- fixed timestep + accumulator
- canonical position / velocity / facing in Pure TypeScript BoutSimulation
- Phaser Sceneへの一方向Snapshot同期
- stable participant identityとPlayer/CPU control roleの分離
- logical meter units → canvas presentation mapping

まで。

Collision / Push / Ring-out / Tachiai / Grapple / Throw / Lift等は実装しない。

このTaskのTechnical Completion後、User Play Testでmovement/control feelを確認する。

## 2. Current Baseline / Review Handoff

Accepted Production Baseline:

`572990944674f82f31964f8c27b369eaf26faefc`

Current developにはACTION-01 Investigation ReportとChatGPT Review coordination commitsが存在する。
AGENTS.mdのRemote-Task-First Preflightに従い、Source-Baseline..origin/develop が `docs/agent_handoff/` のみであることを確認してFF-onlyすること。

ACTION-01 Accepted Decisions:

- Gameplay CoreはCustom Pure TypeScript。Phaser Arcade Physics / Matter.jsをGameplay Coreにしない
- fixed timestep + accumulator
- `BoutSimulation.step()` はrender deltaを直接受けず、1 logical tick進める
- canonical position / velocity / facingはSimulation側
- raw keyboard inputをSimulationへ渡さない
- Player / future CPUはsemantic Intent contractを共有する方向
- Scene/GameObject positionはPresentationのみ
- logical gameplay unitsはcanvas pixelから分離
- internal unitはmeter/second方向
- 60 HzはACTION-02用の暫定technical value。Final値ではない
- velocityはACTION-02で導入してよい
- Balance / Stamina / CurrentAction / events等はまだ追加しない
- stable wrestler identityとPlayer/CPU roleを分離する
- render interpolationはDeferred

## 3. User Decision — WASD Semantics

User承認済み：

**WASDは画面基準 / world-relativeを採用する。**

つまり：

- W = screen/world up
- S = screen/world down
- A = screen/world left
- D = screen/world right

力士自身は相手をauto-faceする。

したがって、相手との位置関係によってWASDは前進・後退・横移動になる。

Simulationへはraw W/A/S/Dではなくworld-frameのmovement vectorを渡す。

## 4. User Direction — Tachiai → Normal Bout

将来のTachiaiと通常Actionは**シームレス接続を必須としない**。

許容される方向：

Tachiai
→ 一度結果を解決
→ その結果からnormal action開始時のinitial positions / state等を決定
→ Normal Bout開始

シームレスに自然かつ単純に作れる場合は将来採用してよいが、Architecture上の必須条件ではない。

ACTION-02ではTachiaiを実装しない。

ACTION-02のMovement foundationは、normal action prototypeが直接初期位置から開始できる構造でよい。
Future Tachiaiがnormal Bout initial conditionsを供給できる余地だけを壊さないこと。

Tachiai用の空Class / Phase Frameworkを先回り作成しない。

## 5. Architecture Constraints

### 5.1 State ownership

Pure TypeScript `BoutSimulation` が以下のcanonical stateを所有：

- participant position
- participant velocity
- participant facing

Phaser GameObjectの x/y/rotation はcanonical stateではない。

SceneからGameplay positionをSimulationへ書き戻さない。

### 5.2 Intent boundary

Movement inputはsemantic world-frame vector。

最小例：

```ts
interface ParticipantIntent {
  readonly move: Vec2
}
```

今回Action command fieldは不要。
後続Action Taskで同じIntent contractへ拡張できるようsmall explicit designにする。

Simulation側でもmove vector lengthを最大1へclampし、keyboard/touch/CPU sourceの不正値に依存しない。

### 5.3 Fixed timestep

Initial technical rate:

- 60 Hz provisional
- Final Game Feel valueではない

`BoutSimulation.step(...)` は1 tickだけ進める。
render deltaMsは受け取らない。

Phaser integration側でaccumulatorを管理する。

- frame deltaをaccumulate
- fixed step分たまったら0..N tick進める
- huge frame delta / spiral of deathに小さな明示的capを置く
- render interpolationは実装しない

Accumulator logicはPhaser依存を避け、Vitest可能なsmall Pure TypeScript helper/moduleにすること。

### 5.4 Movement model

ACTION-01 recommendationどおり、velocity + acceleration/deceleration方式を採用する。

Intent
→ target velocity
→ acceleration/decelerationでcurrent velocityが追従
→ position integration

Provisional tuning values：

- max speed
- acceleration
- deceleration

はAgentがmovement foundationを成立させる最小のtemporary valuesを選んでよい。

ただし：
- named constantsにする
- Completion Reportへ値を記載
- User Play Test前の暫定値と明記
- Accepted final balanceとしてDocへ固定しない

参加者間で能力差はまだ付けない。
Rikishi attributesはまだ追加しない。

### 5.5 Auto-facing

Facingはcanonical runtime stateとして保持する。

ACTION-02では毎simulation tickの終わりに、相手participantのposition方向へ即時auto-faceする。

Facing representation:
- radians
- 0 = +x 等、明示的なcoordinate conventionを1つ決めてcomment/documentする

将来のturn rate / action lock / henka / throw rotation等はDeferred。

2 participantが完全に同一点の場合など、方向が定義できないcaseをNaNにしない。
安全なprevious facing維持等の明示的挙動にする。

### 5.6 Logical units

Simulation positionはmeter-based logical unitsに移行する。

Current 1unit=1px fixtureは廃止。

Prototype ring radius / spawn positionsはmeter-basedのtemporary fixtureへ置き換える。
exact valuesはFinal Designではない。

Scene側で：

Simulation meters
→ pixels

のscale + translate mappingを行う。

No unit framework / branded type framework。

## 6. Control / Presentation Separation

Previous Correction C-1をACTION-02で解消する。

Current `player` / `cpu` participant IDをPresentation roleそのものとして扱う構造に依存しないこと。

最低限：

- Simulation participant identity
- keyboard-controlled participant selection
- stationary opponent / future CPU role
- presentation style

をSimulation外で明示的に対応付ける。

ただし `BoutControlAssignment` 等の概念名はFramework要件ではない。

小さなconstant / map / local structureで十分ならそれを優先する。

Future Management wrestler IDが任意文字列でも破綻しない形にする。

## 7. Keyboard Adapter

WASD keyboard stateをworld-frame Vec2へ変換するPresentation/Input側のsmall adapterを作る。

Required behavior：

- W: y negative
- S: y positive
- A: x negative
- D: x positive
- opposite keys cancel
- diagonal vector is normalized/clamped so diagonal speedが速くならない
- Simulationはkeyboard key codeを知らない

具体Key APIはCurrent Phaser 4に自然な方法を使用してよい。

Touch / Gamepadは実装しない。

## 8. Scene Integration

BoutSceneは：

1. BoutSimulationを作る
2. keyboard movement intentを読む
3. accumulatorで0..N simulation stepsを実行
4. latest snapshotを読む
5. persistent presentation objectsをsnapshotへ同期

する。

毎frame大量にGameObjectを作り直さない。

Player/CPU placeholderの見た目はFoundationとして維持してよい。

Auto-facingがUserから確認できるよう、placeholderへ小さな向きmarker / line等のpresentation-only表示を追加してよい。

OpponentはACTION-02ではstationaryでよい。
CPU Gameplay Logicは実装しない。

## 9. Scope

変更可：

- `src/game/sumo/` のMovement / Intent / fixed-stepに必要なsmall Pure TypeScript files
- `src/game/scenes/BoutScene.ts`
- 必要なら `src/game/input/` 等のsmall keyboard adapter file
- Existing Bout Types / Simulation / Tests
- additional focused Vitest files
- `docs/ARCHITECTURE.md` Current State同期
- `AGENTS.md` Current Source / Technology / Architectureの時間依存記述の最小同期
- `docs/agent_handoff/CURRENT_COMPLETION_REPORT.md`

新Dependency追加は禁止。

## 10. Scope Out

実装しない：

- body collision
- participant separation
- push / impulse / pressure
- ring-out / victory / reset
- Tachiai
- FREE / GRAPPLED / LIFTED runtime interaction implementation
- grapple
- throw
- lift
- thrust
- pull / counter
- custom technique
- Stamina
- Balance
- Rikishi attributes / stats
- CPU gameplay AI
- Touch / Gamepad
- render interpolation
- Phaser Physics
- Matter.js
- animation system
- camera effects
- audio
- management
- result/reward loop

Playerがopponentを通り抜けたりring外へ移動できても、このTaskではexpected。
Collision / ring boundaryをついでに追加しない。

## 11. Required Automated Verification

最低限以下をVitestで確認する。

T1. Same initial setup + same intent sequence → same snapshot/state（deterministic）。

T2. zero movement intentではpositionが移動せず、既存velocityがある場合はdeceleration ruleに従う。

T3. world-frame cardinal movement：
- up/down/left/rightがcorrect axisへ進む。

T4. diagonal inputがclampされ、cardinalより高速にならない。

T5. acceleration：
- velocityがtarget speedへ段階的に近づく。
- provisional constantsに対してexpected boundaryを確認。

T6. deceleration：
- input release後にvelocityが安全に0へ近づき、overshoot / NaNしない。

T7. fixed-step accumulator：
- equivalent unclamped elapsed time partitioningで同tick数になる。
  例：16ms + 17ms等の分割差で結果がframe partitionに依存しない。
- large delta cap / max steps behaviorも明示Test。

T8. auto-facing：
- participantが相手方向を向く。
- relative positionsが変われば更新される。
- coincident positionでもNaN/Infinityにならない。

T9. snapshot isolation / existing setup alias protection regression PASS。

T10. Simulation / fixed-step coreにPhaser dependencyがない。

T11. keyboard adapterのvector semantics：
- W/S/A/D
- opposite cancel
- diagonal clamp

Test implementationを簡潔に保つ。
Gameplay formulaをTestのために追加しない。

## 12. Verification Level

Heavy寄りStandard / Movement Foundation。

Required：

- `pnpm test` PASS
- `pnpm build` PASS
- `git diff --check` PASS
- T1〜T11 evidence
- Simulation coreにPhaser importなし
- new dependencyなし
- Scope外Gameplayなし
- Agent Task Diff review

### Browser Smoke

Browserで最低限確認：

- Phaser Canvas起動
- runtime errorなし
- W/A/S/Dでcontrolled participantが画面基準に移動
- diagonal movementが異常に速く見えない
- key release後、provisional decelerationで停止
- opponentはstationary
- both placeholdersが互いをauto-faceしていることがpresentation markerで確認可能
- Scene表示がSnapshotに追従
- Vite starter UIなし

Browser automationのためのDependency追加禁止。

## 13. User Play Test — REQUIRED

Technical Verification完了後、UserがBrowserでmovement/control feelを確認する。

確認項目：

- 画面基準WASDが直感的か
- auto-facingしながら横移動/後退する感覚
- 加速が重すぎない / 軽すぎない
- 減速が滑りすぎない / 急停止すぎない
- diagonal movement
- 反応速度
- 60Hz fixed-stepで違和感がないか
- 「相撲Actionの移動土台として調整を続けられそうか」

Technical PASSだけでMovement Feel Acceptedとしない。

AgentはUser Play Testを自分でPASS扱いしない。
Completion Reportは：

`User Play Test: REQUIRED / NOT RUN`

とする。

Technical gatesが全PASSの場合、Production commit/pushは可能。
ResultはAGENTS vocabularyに従い、User Play Test未実施をKnown Untested / pending acceptanceとして明示する。

## 14. Acceptance Criteria

AC-01: semantic world-frame movement intentが存在し、Simulationはraw keyboardを知らない。
AC-02: WASDは画面基準で正しくworld vectorへ変換される。
AC-03: diagonal inputはspeed advantageを生まない。
AC-04: BoutSimulationがcanonical position / velocity / facingを所有する。
AC-05: fixed timestepでSimulationがframe-rate-independentに進む。
AC-06: accumulatorはPure/testableで、large-delta safetyを持つ。
AC-07: velocity acceleration/deceleration modelがsmall explicit constantsで実装される。
AC-08: auto-facingがSimulation ruleとして実装される。
AC-09: meter logical unitsとpixel presentation mappingが分離される。
AC-10: SceneはSnapshotからpresentation objectを一方向同期する。
AC-11: stable participant identityとKeyboard/CPU roleをSimulation外で分離する。
AC-12: Phaser Physics / Matter.jsを使わない。
AC-13: Collision / Push / Ring-out / Tachiai / Grapple等を実装していない。
AC-14: T1〜T11 PASS。
AC-15: `pnpm build` PASS。
AC-16: Browser Smoke PASS。
AC-17: Docs Current StateがSourceとMaterialに一致。
AC-18: Scope外変更なし。
AC-19: User Play TestはREQUIRED / pendingとして正しく報告される。

## 15. Stop Conditions

以下ではSTOPし、Scopeを広げない：

- Preflight failure
- Current Source / Review HandoffとのMaterial Conflict
- new dependencyが必要
- fixed-step設計を成立させるためProduction architectureのMaterial変更が必要
- movement実装にCollision / Push formulaが必須と判明
- Phaser 4 input/update behaviorがCurrent assumptionとMaterialに異なる
- Task外User changes / remote divergence
- movement constantsをFinal balanceとして固定しないと進めない状況

Minor provisional tuningはAgent判断で選択可。
その場合必ずReportしてUser Play Test対象とする。

## 16. Completion Report

AGENTS.mdに従う。

最低限：

- Result
- Preflight
- Changed Files
- Implemented Movement Architecture
- Fixed-Step / Accumulator
- Keyboard Adapter
- State Ownership
- Provisional constants and fixture values
- T1〜T11
- Browser Smoke
- AC-01〜AC-19
- Implementation Evidence
- Design Deviations
- Unexpected Scope
- Known Untested
- User Play Test: REQUIRED / NOT RUN
- Git delivery

Implementation Evidence最低限：

1. semantic Input boundary
2. canonical Simulation movement ownership
3. fixed timestep
4. accumulator frame partition independence
5. auto-facing
6. Scene one-way snapshot sync
7. identity/control role separation
8. no Collision/Push/Tachiai scope creep

Design Deviationsなし：

`Design Deviations: NONE`

## 17. Git Delivery

AGENTS.mdに従う。

成功時：

- Task-owned filesだけstage
- focused diff review
- tests/build/diff-check
- CURRENT_COMPLETION_REPORTを同じImplementation Commitへ含める
- 1 Agent Task ≈ 1 Commit
- `origin/develop`へpush
- remote SHA / clean working tree確認

Commit message例：

`feat: add bout movement foundation`

mainは変更しない。

## 18. Final Instruction

このTaskはMovement Foundationまで。

Technical implementation完了後にCollision / Push / Ring-out / Tachiaiへ進まない。

Commit / Push / Completion Report後停止し、

「ACTION-02-MOVEMENT-FOUNDATION が完了し、ChatGPT ReviewとUser Play Test待ちです」

と日本語で報告する。
